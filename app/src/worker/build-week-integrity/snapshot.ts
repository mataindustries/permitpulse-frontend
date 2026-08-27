import type { IntegrityCanonicalSnapshot } from "../../shared/build-week-integrity/types";
import { packetPresentationVersion } from "../../shared/packet/types";
import {
  listEvidenceForCase,
  listTimelineForCase,
  type CaseResponse,
  type EvidenceResponse,
  type TimelineResponse,
} from "../cases/repository";
import { readDeliveryLifecycle, sha256 } from "../delivery/repository";
import {
  packetInputRevisionFields,
  packetInputRevisionsEqual,
  readPacketInputRevision,
  type PacketInputRevision,
} from "../packet/revision";
import { buildCurrentPacketPresentation } from "../packet/service";
import { readReviewerWorkspace } from "../reviewer/repository";
import type { ReviewerWorkspace } from "../../shared/reviewer/types";
import type { Bindings } from "../types";

const integrityEvidenceLimit = 50;
const integrityTimelineLimit = 50;
const maximumIntegritySnapshotBytes = 768 * 1024;

export class IntegritySnapshotError extends Error {
  readonly code: "INPUT_CHANGED" | "INPUT_TOO_LARGE";

  constructor(code: "INPUT_CHANGED" | "INPUT_TOO_LARGE", message: string) {
    super(message);
    this.name = "IntegritySnapshotError";
    this.code = code;
  }
}

function stableValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stableValue);
  if (!value || typeof value !== "object") return value;

  return Object.fromEntries(
    Object.entries(value)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, child]) => [key, stableValue(child)]),
  );
}

export function stableIntegrityJson(value: unknown): string {
  return JSON.stringify(stableValue(value));
}

function evidenceRecord(record: EvidenceResponse): Record<string, unknown> {
  return {
    id: record.id,
    evidence_type: record.evidence_type,
    title: record.title,
    summary: record.summary,
    source_url: record.source_url,
    source_label: record.source_label,
    source_date: record.source_date,
    verification_status: record.verification_status,
    version: record.version,
    created_at: record.created_at,
    updated_at: record.updated_at,
  };
}

function timelineRecord(record: TimelineResponse): Record<string, unknown> {
  return {
    id: record.id,
    occurred_on: record.occurred_on,
    timeline_type: record.timeline_type,
    title: record.title,
    details: record.details,
    is_canonical: record.is_canonical,
    evidence_ids: [...record.evidence_ids].sort(),
    version: record.version,
    created_at: record.created_at,
    updated_at: record.updated_at,
  };
}

function reviewerSnapshot(workspace: ReviewerWorkspace) {
  const byId = <T extends { id: string }>(values: T[]) =>
    [...values].sort((left, right) => left.id.localeCompare(right.id));

  return {
    findings: byId(workspace.findings).map((finding): Record<string, unknown> => ({
      id: finding.id,
      title: finding.title,
      finding_type: finding.finding_type,
      severity: finding.severity,
      summary: finding.summary,
      confidence: finding.confidence,
      recommended_resolution: finding.recommended_resolution,
      evidence_ids: [...finding.evidence_ids].sort(),
      timeline_ids: [...finding.timeline_ids].sort(),
      approved: finding.approved,
      version: finding.version,
      updated_at: finding.updated_at,
    })),
    questions: byId(workspace.questions).map((question): Record<string, unknown> => ({
      id: question.id,
      question: question.question,
      why_it_matters: question.why_it_matters,
      evidence_requested: question.evidence_requested,
      status: question.status,
      publishable: question.publishable,
      version: question.version,
      updated_at: question.updated_at,
    })),
    actions: byId(workspace.actions).map((action): Record<string, unknown> => ({
      id: action.id,
      priority: action.priority,
      description: action.description,
      estimated_impact: action.estimated_impact,
      responsible_party: action.responsible_party,
      due_date: action.due_date,
      evidence_ids: [...action.evidence_ids].sort(),
      approved: action.approved,
      version: action.version,
      updated_at: action.updated_at,
    })),
    actionKit: workspace.action_kit
      ? {
          id: workspace.action_kit.id,
          current_position: workspace.action_kit.current_position,
          confirmed_record: workspace.action_kit.confirmed_record,
          unconfirmed_record: workspace.action_kit.unconfirmed_record,
          primary_blocker: workspace.action_kit.primary_blocker,
          why_appropriate: workspace.action_kit.why_appropriate,
          evidence_readiness: workspace.action_kit.evidence_readiness,
          review_readiness: workspace.action_kit.review_readiness,
          requested_confirmations: [...workspace.action_kit.requested_confirmations],
          escalation_trigger: workspace.action_kit.escalation_trigger,
          follow_up_date: workspace.action_kit.follow_up_date,
          evidence_ids: [...workspace.action_kit.evidence_ids].sort(),
          timeline_ids: [...workspace.action_kit.timeline_ids].sort(),
          approved: workspace.action_kit.approved,
          version: workspace.action_kit.version,
          updated_at: workspace.action_kit.updated_at,
        }
      : null,
  };
}

function revisionRecord(revision: PacketInputRevision): Record<string, string> {
  return {
    case_revision: revision.case_revision,
    contributor_revision: revision.contributor_revision,
    evidence_revision: revision.evidence_revision,
    reviewer_revision: revision.reviewer_revision,
    timeline_link_revision: revision.timeline_link_revision,
    timeline_revision: revision.timeline_revision,
  };
}

export async function integritySnapshotIsCurrent(input: {
  caseId: string;
  database: Bindings["DB"];
  snapshot: IntegrityCanonicalSnapshot;
}): Promise<boolean> {
  const [revision, lifecycle] = await Promise.all([
    readPacketInputRevision(input.database, input.caseId),
    readDeliveryLifecycle(input.database, input.caseId, 1),
  ]);
  return (
    packetInputRevisionFields.every(
      (field) => input.snapshot.packet_input_revision[field] === revision[field],
    ) &&
    input.snapshot.active_packet_generation_id ===
      lifecycle.active_packet_generation_id
  );
}

export async function buildIntegritySnapshot(input: {
  caseRecord: CaseResponse;
  database: Bindings["DB"];
}): Promise<{
  snapshot: IntegrityCanonicalSnapshot;
  inputHash: string;
  evidenceIds: Set<string>;
}> {
  const { caseRecord, database } = input;

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const before = await readPacketInputRevision(database, caseRecord.id);
    if (before.case_revision !== String(caseRecord.version)) {
      continue;
    }
    const [evidence, timeline, reviewer, packet, lifecycle] = await Promise.all([
      listEvidenceForCase(database, caseRecord.id, {
        limit: integrityEvidenceLimit + 1,
        offset: 0,
      }),
      listTimelineForCase(database, caseRecord.id, {
        limit: integrityTimelineLimit + 1,
        offset: 0,
      }),
      readReviewerWorkspace(database, caseRecord.id),
      buildCurrentPacketPresentation({
        caseRecord,
        database,
        generatedAt: "2000-01-01T00:00:00.000Z",
      }),
      readDeliveryLifecycle(database, caseRecord.id, 1),
    ]);
    const [after, lifecycleAfter] = await Promise.all([
      readPacketInputRevision(database, caseRecord.id),
      readDeliveryLifecycle(database, caseRecord.id, 1),
    ]);

    if (
      !packetInputRevisionsEqual(before, after) ||
      lifecycle.active_packet_generation_id !==
        lifecycleAfter.active_packet_generation_id
    ) {
      continue;
    }

    if (
      evidence.length > integrityEvidenceLimit ||
      timeline.length > integrityTimelineLimit
    ) {
      throw new IntegritySnapshotError(
        "INPUT_TOO_LARGE",
        "The case exceeds the current Build Week review input limit.",
      );
    }

    const editorial = reviewerSnapshot(reviewer);
    const snapshot: IntegrityCanonicalSnapshot = {
      snapshot_version: "permitpulse-build-week-integrity-input-v1",
      case_record: {
        id: caseRecord.id,
        project_name: caseRecord.project_name,
        address: caseRecord.address,
        city: caseRecord.city,
        jurisdiction: caseRecord.jurisdiction,
        permit_number: caseRecord.permit_number,
        current_status: caseRecord.current_status,
        version: caseRecord.version,
        created_at: caseRecord.created_at,
        updated_at: caseRecord.updated_at,
      },
      evidence_register: evidence
        .map(evidenceRecord)
        .sort((left, right) => String(left.id).localeCompare(String(right.id))),
      timeline: timeline
        .map(timelineRecord)
        .sort((left, right) => String(left.id).localeCompare(String(right.id))),
      reviewer_findings: editorial.findings,
      reviewer_questions: editorial.questions,
      reviewer_actions: editorial.actions,
      reviewer_action_kit: editorial.actionKit,
      agency_dependencies: (packet.agency_dependencies ?? []).map(
        (dependency): Record<string, unknown> => ({
          id: dependency.id,
          discipline: dependency.discipline,
          blocking_issue: dependency.blocking_issue,
          dependent_review: dependency.dependent_review,
          recommended_next_step: dependency.recommended_next_step,
          citation_references: [...dependency.citation_references],
        }),
      ),
      packet_input_revision: revisionRecord(after),
      active_packet_generation_id: lifecycleAfter.active_packet_generation_id,
      presentation_version: packetPresentationVersion,
    };
    const serializedSnapshot = stableIntegrityJson(snapshot);
    if (
      new TextEncoder().encode(serializedSnapshot).byteLength >
      maximumIntegritySnapshotBytes
    ) {
      throw new IntegritySnapshotError(
        "INPUT_TOO_LARGE",
        "The canonical case snapshot exceeds the current Build Week review limit.",
      );
    }

    return {
      snapshot,
      inputHash: await sha256(serializedSnapshot),
      evidenceIds: new Set(evidence.map((item) => item.id)),
    };
  }

  throw new IntegritySnapshotError(
    "INPUT_CHANGED",
    "Case inputs changed during Integrity Review assembly.",
  );
}
