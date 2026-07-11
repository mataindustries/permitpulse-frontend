import { buildPacketModel } from "../../shared/packet/build-packet-model";
import {
  evaluatePacketQuality,
  type DeliveryQualityEvaluation,
} from "../../shared/packet/quality-gate";
import {
  packetDocumentStatusForDeliveryState,
  withPacketDocumentStatus,
} from "../../shared/packet/presentation";
import type {
  PacketDocumentStatus,
  PacketModel,
  PacketPresentationWarning,
} from "../../shared/packet/types";
import type { DeliveryLifecycle } from "../../shared/delivery-lifecycle/types";
import {
  listCaseActivity,
  listEvidenceForCase,
  listTimelineForCase,
  type CaseResponse,
} from "../cases/repository";
import {
  packetComparableDigest,
  readDeliveryLifecycle,
  readGeneratedPacketSnapshot,
} from "../delivery/repository";
import type { Bindings } from "../types";
import { readReviewerWorkspace } from "../reviewer/repository";

export const packetEvidenceLimit = 50;
export const packetTimelineLimit = 50;
export const packetActivityLimit = 25;

interface BuildCurrentPacketInput {
  caseRecord: CaseResponse;
  database: Bindings["DB"];
  documentStatus?: PacketDocumentStatus;
  generatedAt: Date | string;
}

export interface PacketDeliveryContext {
  export_supported: boolean;
  lifecycle: DeliveryLifecycle;
  live_packet: PacketModel;
  packet: PacketModel;
  persisted_snapshot: boolean;
  quality: DeliveryQualityEvaluation;
}

function truncationWarning(
  id: string,
  text: string,
): PacketPresentationWarning {
  return { id, text, information_class: "warning" };
}
const internalActionResidue=/\b(regenerate (?:the )?packet|rerun (?:the )?quality gate|quality[- ]gate implementation|verify evidence metadata|update packet snapshot|mutation success|toast message)\b/i;
function isClientAction(value:string):boolean{return !internalActionResidue.test(value);}
const mutationResidue=/^(edited|updated|saved|success|mutation successful)$/i;
function isCleanClientContent(value:string):boolean{return !mutationResidue.test(value.trim())&&!/\b(toast message|mutation success)\b/i.test(value);}

export async function buildCurrentPacketPresentation({
  caseRecord,
  database,
  documentStatus = "draft",
  generatedAt,
}: BuildCurrentPacketInput): Promise<PacketModel> {
  const [evidenceRows, timelineRows, activityRows, reviewer] = await Promise.all([
    listEvidenceForCase(database, caseRecord.id, {
      limit: packetEvidenceLimit + 1,
      offset: 0,
    }),
    listTimelineForCase(database, caseRecord.id, {
      limit: packetTimelineLimit + 1,
      offset: 0,
    }),
    listCaseActivity(database, caseRecord.id, {
      limit: packetActivityLimit,
      offset: 0,
    }),
    readReviewerWorkspace(database, caseRecord.id),
  ]);
  const evidenceTruncated = evidenceRows.length > packetEvidenceLimit;
  const timelineTruncated = timelineRows.length > packetTimelineLimit;
  const model = buildPacketModel({
    activityResponse: { activity: activityRows.slice(0, packetActivityLimit) },
    caseRecord,
    documentStatus,
    editorialContent: {
      findings: reviewer.findings.filter((item) => item.approved&&isCleanClientContent(item.summary)).map((item) => ({ id:item.id, text:item.summary, title:item.title, severity:item.severity, finding_type:item.finding_type, confidence:item.confidence, recommended_resolution:item.recommended_resolution, supporting_source_ids:[...item.evidence_ids,...item.timeline_ids], grounded:item.evidence_ids.length > 0, reviewer_approved:true })),
      openQuestions: reviewer.questions.filter((item) => item.publishable && item.status !== "closed"&&isCleanClientContent(item.question)).map((item) => ({ id:item.id, text:item.question, reviewer_approved:true })),
      recommendedNextActions: reviewer.actions.filter((item) => item.approved && isClientAction(item.description)&&isCleanClientContent(item.description)).map((item) => ({ id:item.id, text:item.description, supporting_source_ids:item.evidence_ids, reviewer_approved:true })),
      actionKit: reviewer.action_kit && [reviewer.action_kit.current_position,reviewer.action_kit.message_body,...reviewer.action_kit.requested_confirmations].every(isCleanClientContent) ? { ...reviewer.action_kit } : undefined,
    },
    evidence: evidenceRows.slice(0, packetEvidenceLimit),
    generatedAt,
    timeline: timelineRows.slice(0, packetTimelineLimit),
  });

  if (evidenceTruncated) {
    model.warnings.push(
      truncationWarning(
        "evidence-register-truncated",
        `The Evidence Register shows the ${packetEvidenceLimit} most recent records. Additional case evidence is not included in this packet snapshot.`,
      ),
    );
  }

  if (timelineTruncated) {
    model.warnings.push(
      truncationWarning(
        "permit-timeline-truncated",
        `The Permit Timeline shows the ${packetTimelineLimit} most recent events. Additional case events are not included in this packet snapshot.`,
      ),
    );
  }

  return model;
}

export async function readPacketDeliveryContext(input: {
  caseRecord: CaseResponse;
  database: Bindings["DB"];
  evaluatedAt: Date | string;
}): Promise<PacketDeliveryContext> {
  const { caseRecord, database, evaluatedAt } = input;
  const [lifecycle, livePacket] = await Promise.all([
    readDeliveryLifecycle(database, caseRecord.id),
    buildCurrentPacketPresentation({
      caseRecord,
      database,
      generatedAt: evaluatedAt,
    }),
  ]);
  const snapshotResult = lifecycle.active_packet_generation_id
    ? await readGeneratedPacketSnapshot(
        database,
        caseRecord.id,
        lifecycle.active_packet_generation_id,
      )
    : { exists: false as const, packet: null };
  const staleSnapshot = Boolean(
    snapshotResult.packet &&
      (await packetComparableDigest(snapshotResult.packet)) !==
        (await packetComparableDigest(livePacket)),
  );
  const status = packetDocumentStatusForDeliveryState(lifecycle.current_state);
  const presentationPacket = withPacketDocumentStatus(
    snapshotResult.packet ?? livePacket,
    status,
  );
  const quality = evaluatePacketQuality({
    evaluatedAt,
    lifecycleState: lifecycle.current_state,
    snapshot: snapshotResult.packet,
    snapshotPresent: snapshotResult.exists,
    staleSnapshot,
  });

  lifecycle.live_preview_differs = staleSnapshot;
  lifecycle.quality = quality;

  return {
    export_supported: !snapshotResult.exists || Boolean(snapshotResult.packet),
    lifecycle,
    live_packet: livePacket,
    packet: presentationPacket,
    persisted_snapshot: Boolean(snapshotResult.packet),
    quality,
  };
}
