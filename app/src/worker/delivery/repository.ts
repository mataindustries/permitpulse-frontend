import { packetPresentationVersion, type PacketModel } from "../../shared/packet/types";
import { isPacketPresentationModel } from "../../shared/packet/presentation";
import { nextDeliveryEvents, resultingDeliveryState } from "../../shared/delivery-lifecycle/state-machine";
import type { DeliveryEvent, DeliveryEventType, DeliveryLifecycle, DeliveryState } from "../../shared/delivery-lifecycle/types";
import type { CaseActor } from "../cases/authorization";
import {
  packetInputRevisionCaseBindings,
  packetInputRevisionFields,
  packetInputRevisionSelectSql,
  packetInputRevisionValues,
  type PacketInputRevision,
} from "../packet/revision";
import type { Bindings } from "../types";

interface EventRow {
  id: string;
  case_id: string;
  event_type: DeliveryEventType;
  actor_user_id: string | null;
  actor_name: string | null;
  created_at: string;
  note: string | null;
  packet_generation_id: string | null;
  content_sha256: string | null;
  case_version: number | null;
  previous_state: DeliveryState;
  resulting_state: DeliveryState;
  sequence: number;
  idempotency_key: string;
  request_fingerprint: string;
}

const eventSelect = `SELECT e.id, e.case_id, e.event_type, e.actor_user_id,
  u.name AS actor_name, e.created_at, e.note, e.packet_generation_id,
  p.content_sha256, p.case_version, e.previous_state, e.resulting_state,
  e.sequence, e.idempotency_key, e.request_fingerprint
  FROM delivery_lifecycle_events e
  LEFT JOIN "user" u ON u.id = e.actor_user_id
  LEFT JOIN packet_generations p ON p.id = e.packet_generation_id`;

function mapEvent(row: EventRow): DeliveryEvent {
  return {
    id: row.id,
    case_id: row.case_id,
    event_type: row.event_type,
    actor: row.actor_user_id ? { id: row.actor_user_id, name: row.actor_name } : null,
    created_at: row.created_at,
    note: row.note,
    packet_generation_id: row.packet_generation_id,
    packet_digest: row.content_sha256,
    case_version: row.case_version,
    previous_state: row.previous_state,
    resulting_state: row.resulting_state,
    sequence: row.sequence,
  };
}

export async function readDeliveryLifecycle(
  database: Bindings["DB"],
  caseId: string,
  eventLimit = 50,
): Promise<DeliveryLifecycle> {
  const result = await database.prepare(
    `${eventSelect} WHERE e.case_id = ? ORDER BY e.sequence DESC LIMIT ?`,
  ).bind(caseId, eventLimit).all<EventRow>();
  const events = result.results.map(mapEvent);
  const latest = events[0] ?? null;
  const currentState = latest?.resulting_state ?? "draft";
  return {
    case_id: caseId,
    current_state: currentState,
    events,
    latest_event: latest,
    next_events: nextDeliveryEvents(currentState),
    active_packet_generation_id: latest?.packet_generation_id ?? null,
    live_preview_differs: false,
  };
}

export async function sha256(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function packetComparableDigest(packet: PacketModel): Promise<string> {
  return sha256(JSON.stringify({
    ...packet,
    readiness: packet.readiness ? { ...packet.readiness, lastEvaluated: null } : null,
    document_status: null,
    document_status_label: null,
    draft_notice: null,
    generated_at: null,
    generated_at_label: null,
    recent_activity_summaries: null,
  }));
}

export async function deliveryTransitionReplayStatus(input: {
  caseId: string;
  database: Bindings["DB"];
  eventType: DeliveryEventType;
  idempotencyKey: string;
  note: string | null;
}): Promise<"none" | "matching" | "conflict"> {
  const fingerprint = await sha256(JSON.stringify({
    eventType: input.eventType,
    note: input.note,
  }));
  const row = await input.database.prepare(
    "SELECT request_fingerprint FROM delivery_lifecycle_events WHERE case_id = ? AND idempotency_key = ? LIMIT 1",
  ).bind(input.caseId, input.idempotencyKey).first<{
    request_fingerprint: string;
  }>();

  if (!row) {
    return "none";
  }

  return row.request_fingerprint === fingerprint ? "matching" : "conflict";
}

export type RecordDeliveryOutcome =
  | { kind: "created" | "retry"; lifecycle: DeliveryLifecycle }
  | { kind: "invalid_transition" | "idempotency_conflict" | "concurrent_transition" | "presentation_changed" };

export interface ExpectedDeliveryLifecycle {
  activePacketGenerationId: string;
  sequence: number;
  state: DeliveryState;
}

const packetInputRevisionMatchSql = packetInputRevisionFields
  .map((field) => `packet_input_revision.${field} = ?`)
  .join(" AND ");

export async function recordDeliveryTransition(input: {
  actor: CaseActor;
  caseId: string;
  caseVersion: number;
  database: Bindings["DB"];
  eventType: DeliveryEventType;
  idempotencyKey: string;
  note: string | null;
  expectedLifecycle?: ExpectedDeliveryLifecycle;
  packet?: PacketModel;
  packetInputRevision?: PacketInputRevision;
}): Promise<RecordDeliveryOutcome> {
  const { database, caseId, eventType, idempotencyKey, note } = input;
  const fingerprint = await sha256(JSON.stringify({ eventType, note }));
  const retry = await database.prepare(
    `${eventSelect} WHERE e.case_id = ? AND e.idempotency_key = ? LIMIT 1`,
  ).bind(caseId, idempotencyKey).first<EventRow>();
  if (retry) {
    if (retry.request_fingerprint !== fingerprint) return { kind: "idempotency_conflict" };
    return { kind: "retry", lifecycle: await readDeliveryLifecycle(database, caseId) };
  }

  const requiresPacketInputRevision =
    eventType === "packet_generated" ||
    eventType === "approved_for_delivery" ||
    eventType === "delivery_recorded";
  const requiresEvaluatedLifecycle =
    eventType === "approved_for_delivery" || eventType === "delivery_recorded";

  if (
    (requiresPacketInputRevision && !input.packetInputRevision) ||
    (requiresEvaluatedLifecycle && !input.expectedLifecycle)
  ) {
    return { kind: "invalid_transition" };
  }

  const before = await readDeliveryLifecycle(database, caseId, 1);
  if (
    input.expectedLifecycle &&
    (
      before.current_state !== input.expectedLifecycle.state ||
      before.active_packet_generation_id !==
        input.expectedLifecycle.activePacketGenerationId ||
      before.latest_event?.sequence !== input.expectedLifecycle.sequence
    )
  ) {
    const racedRetry = await database.prepare(
      `${eventSelect} WHERE e.case_id = ? AND e.idempotency_key = ? LIMIT 1`,
    ).bind(caseId, idempotencyKey).first<EventRow>();
    if (racedRetry?.request_fingerprint === fingerprint) {
      return {
        kind: "retry",
        lifecycle: await readDeliveryLifecycle(database, caseId),
      };
    }
    if (racedRetry) return { kind: "idempotency_conflict" };
    return { kind: "concurrent_transition" };
  }
  const resultingState = resultingDeliveryState(before.current_state, eventType);
  if (!resultingState) return { kind: "invalid_transition" };

  const eventId = crypto.randomUUID();
  const packetId = eventType === "packet_generated" ? crypto.randomUUID() : before.active_packet_generation_id;
  if (
    eventType === "packet_generated" &&
    (!input.packet || !isPacketPresentationModel(input.packet))
  ) {
    return { kind: "invalid_transition" };
  }
  if (eventType !== "packet_generated" && !packetId) return { kind: "invalid_transition" };

  const statements = [];
  const guarded = input.packetInputRevision;
  if (input.packet && eventType === "packet_generated") {
    const snapshot = JSON.stringify(input.packet);
    const snapshotDigest = await sha256(snapshot);
    statements.push(guarded
      ? database.prepare(
          `WITH packet_input_revision AS (${packetInputRevisionSelectSql})
           INSERT INTO packet_generations (id, case_id, case_version, generated_by_user_id, snapshot_json, content_sha256)
           SELECT ?, ?, ?, ?, ?, ?
           FROM packet_input_revision
           WHERE ${packetInputRevisionMatchSql}`,
        ).bind(
          ...packetInputRevisionCaseBindings(caseId),
          packetId,
          caseId,
          input.caseVersion,
          input.actor.id,
          snapshot,
          snapshotDigest,
          ...packetInputRevisionValues(guarded),
        )
      : database.prepare(
          `INSERT INTO packet_generations (id, case_id, case_version, generated_by_user_id, snapshot_json, content_sha256)
           VALUES (?, ?, ?, ?, ?, ?)`,
        ).bind(packetId, caseId, input.caseVersion, input.actor.id, snapshot, snapshotDigest));
  }
  const eventStatementIndex = statements.length;
  const eventValues = [eventId, caseId, eventType, input.actor.id, note, packetId, before.current_state, resultingState, (before.latest_event?.sequence ?? 0) + 1, idempotencyKey, fingerprint];
  statements.push(guarded
    ? database.prepare(
        `WITH packet_input_revision AS (${packetInputRevisionSelectSql})
         INSERT INTO delivery_lifecycle_events
           (id, case_id, event_type, actor_user_id, note, packet_generation_id, previous_state, resulting_state, sequence, idempotency_key, request_fingerprint)
         SELECT ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
         FROM packet_input_revision
         WHERE ${packetInputRevisionMatchSql}`,
      ).bind(
        ...packetInputRevisionCaseBindings(caseId),
        ...eventValues,
        ...packetInputRevisionValues(guarded),
      )
    : database.prepare(
        `INSERT INTO delivery_lifecycle_events
          (id, case_id, event_type, actor_user_id, note, packet_generation_id, previous_state, resulting_state, sequence, idempotency_key, request_fingerprint)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ).bind(...eventValues));

  try {
    const results = await database.batch(statements);
    if (guarded && results[eventStatementIndex].meta.changes !== 1) {
      return { kind: "presentation_changed" };
    }
  } catch (error) {
    let racedRetry: EventRow | null;

    try {
      racedRetry = await database.prepare(
        `${eventSelect} WHERE e.case_id = ? AND e.idempotency_key = ? LIMIT 1`,
      ).bind(caseId, idempotencyKey).first<EventRow>();
    } catch {
      throw error;
    }

    if (racedRetry?.request_fingerprint === fingerprint) {
      return { kind: "retry", lifecycle: await readDeliveryLifecycle(database, caseId) };
    }
    if (racedRetry) return { kind: "idempotency_conflict" };

    try {
      const after = await readDeliveryLifecycle(database, caseId, 1);
      if ((after.latest_event?.sequence ?? 0) !== (before.latest_event?.sequence ?? 0)) {
        return { kind: "concurrent_transition" };
      }
    } catch {
      throw error;
    }

    throw error;
  }
  return { kind: "created", lifecycle: await readDeliveryLifecycle(database, caseId) };
}

export async function readGeneratedPacket(
  database: Bindings["DB"], caseId: string, generationId: string,
): Promise<PacketModel | null> {
  return (await readGeneratedPacketSnapshot(database, caseId, generationId)).packet;
}

export async function readGeneratedPacketSnapshot(
  database: Bindings["DB"],
  caseId: string,
  generationId: string,
): Promise<{
  exists: boolean;
  integrity: "digest_mismatch" | "invalid" | "outdated" | "valid" | "missing";
  packet: PacketModel | null;
}> {
  const row = await database.prepare(
    "SELECT snapshot_json, content_sha256 FROM packet_generations WHERE id = ? AND case_id = ? LIMIT 1",
  ).bind(generationId, caseId).first<{ snapshot_json: string; content_sha256: string }>();

  if (!row) {
    return { exists: false, integrity: "missing", packet: null };
  }

  if ((await sha256(row.snapshot_json)) !== row.content_sha256) {
    return { exists: true, integrity: "digest_mismatch", packet: null };
  }

  try {
    const value: unknown = JSON.parse(row.snapshot_json);

    if (
      typeof value === "object" &&
      value !== null &&
      "presentation_version" in value &&
      value.presentation_version !== packetPresentationVersion
    ) {
      return { exists: true, integrity: "outdated", packet: null };
    }

    const valid = isPacketPresentationModel(value);

    return {
      exists: true,
      integrity: valid ? "valid" : "invalid",
      packet: valid ? value : null,
    };
  } catch {
    return { exists: true, integrity: "invalid", packet: null };
  }
}
