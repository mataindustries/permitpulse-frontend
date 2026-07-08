import type {
  CaseRecord,
  EvidenceItemRecord,
  TimelineEntryRecord,
} from "../db/schema";
import type { Bindings } from "../types";
import {
  caseListScope,
  createsOwnerParticipant,
  mayLinkAnyEvidenceToTimeline,
  mayManageAnyEvidence,
  mayManageAnyTimeline,
  mayEditAnyCase,
  mayEditParticipatingCase,
  mayReadAnyCase,
  type CaseActor,
} from "./authorization";
import type {
  CaseActivityQuery,
  CreateCaseInput,
  CreateEvidenceInput,
  CreateTimelineInput,
  EvidenceTimelinePagination,
  UpdateCaseMetadataInput,
  UpdateCaseStatusInput,
  UpdateEvidenceInput,
  UpdateTimelineInput,
} from "./validation";

export const caseStatusTransitions = {
  intake: ["researching", "needs_information"],
  researching: ["needs_information", "ready_for_review"],
  needs_information: ["researching", "ready_for_review"],
  ready_for_review: ["researching"],
} as const satisfies Record<
  CaseRecord["currentStatus"],
  readonly CaseRecord["currentStatus"][]
>;

export function isAllowedStatusTransition(
  from: CaseRecord["currentStatus"],
  to: CaseRecord["currentStatus"],
): boolean {
  return (caseStatusTransitions[from] as readonly CaseRecord["currentStatus"][])
    .includes(to);
}

export interface CaseResponse {
  id: string;
  project_name: string;
  client_name: string;
  address: string;
  city: string;
  jurisdiction: string;
  permit_number: string | null;
  current_status: CaseRecord["currentStatus"];
  version: number;
  created_at: string;
  updated_at: string;
}

interface CaseRow {
  id: string;
  project_name: string;
  client_name: string;
  address: string;
  city: string;
  jurisdiction: string;
  permit_number: string | null;
  current_status: CaseRecord["currentStatus"];
  version: number;
  created_at: string;
  updated_at: string;
}

export interface CaseActivityResponse {
  id: string;
  action: "case_created" | "case_updated" | "case_status_changed";
  changed_fields: string[];
  from_status: CaseRecord["currentStatus"] | null;
  to_status: CaseRecord["currentStatus"] | null;
  actor: {
    id: string;
    name: string | null;
  } | null;
  created_at: string;
}

interface CaseActivityRow {
  id: string;
  action: CaseActivityResponse["action"];
  changed_fields: string;
  from_status: CaseRecord["currentStatus"] | null;
  to_status: CaseRecord["currentStatus"] | null;
  actor_id: string | null;
  actor_name: string | null;
  created_at: string;
}

export interface CaseListPagination {
  limit: number;
  offset: number;
}

export type CaseMutationResult =
  | { outcome: "success"; record: CaseResponse }
  | { outcome: "conflict" }
  | { outcome: "not_found" }
  | { outcome: "no_changes" }
  | { outcome: "invalid_transition" }
  | { outcome: "same_status" };

const createdCaseChangedFields = JSON.stringify([
  "project_name",
  "client_name",
  "address",
  "city",
  "jurisdiction",
  "permit_number",
  "current_status",
]);

const metadataFieldOrder = [
  "project_name",
  "client_name",
  "address",
  "city",
  "jurisdiction",
  "permit_number",
] as const;

type MetadataField = (typeof metadataFieldOrder)[number];

const metadataColumns = {
  project_name: "project_name",
  client_name: "client_name",
  address: "address",
  city: "city",
  jurisdiction: "jurisdiction",
  permit_number: "permit_number",
} as const satisfies Record<MetadataField, string>;

function caseSelectColumns(): string {
  return `id,
    project_name,
    client_name,
    address,
    city,
    jurisdiction,
    permit_number,
    current_status,
    version,
    created_at,
    updated_at`;
}

function rowToCaseResponse(row: CaseRow): CaseResponse {
  return {
    id: row.id,
    project_name: row.project_name,
    client_name: row.client_name,
    address: row.address,
    city: row.city,
    jurisdiction: row.jurisdiction,
    permit_number: row.permit_number,
    current_status: row.current_status,
    version: row.version,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

function toActivityResponse(row: CaseActivityRow): CaseActivityResponse {
  const changedFields = JSON.parse(row.changed_fields) as unknown;

  return {
    id: row.id,
    action: row.action,
    changed_fields: Array.isArray(changedFields)
      ? changedFields.filter(
          (field): field is string => typeof field === "string",
        )
      : [],
    from_status: row.from_status,
    to_status: row.to_status,
    actor: row.actor_id
      ? {
          id: row.actor_id,
          name: row.actor_name,
        }
      : null,
    created_at: row.created_at,
  };
}

function auditEventId(): string {
  return crypto.randomUUID();
}

function mutationNonce(): string {
  return crypto.randomUUID();
}

function caseFieldValue(
  record: CaseResponse,
  field: MetadataField,
): string | null {
  return record[field];
}

function metadataInputValue(
  input: UpdateCaseMetadataInput,
  field: MetadataField,
): string | null | undefined {
  return input[field];
}

function changedMetadataFields(
  record: CaseResponse,
  input: UpdateCaseMetadataInput,
): MetadataField[] {
  return metadataFieldOrder.filter((field) => {
    const suppliedValue = metadataInputValue(input, field);

    return (
      suppliedValue !== undefined &&
      suppliedValue !== caseFieldValue(record, field)
    );
  });
}

function createAuditInsert(
  database: Bindings["DB"],
  params: {
    id: string;
    caseId: string;
    actorUserId: string | null;
    action: CaseActivityResponse["action"];
    changedFields: string;
    fromStatus: CaseRecord["currentStatus"] | null;
    toStatus: CaseRecord["currentStatus"] | null;
    requestId: string;
    timestamp: string;
  },
) {
  return database
    .prepare(
      `INSERT INTO audit_events (
        id,
        case_id,
        actor_user_id,
        action,
        changed_fields,
        from_status,
        to_status,
        request_id,
        created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      params.id,
      params.caseId,
      params.actorUserId,
      params.action,
      params.changedFields,
      params.fromStatus,
      params.toStatus,
      params.requestId,
      params.timestamp,
    );
}

export async function createCase(
  database: Bindings["DB"],
  input: CreateCaseInput,
  requestId: string = crypto.randomUUID(),
): Promise<CaseResponse> {
  const id = crypto.randomUUID();
  const timestamp = new Date().toISOString();
  const permitNumber = input.permit_number ?? null;

  await database.batch([
    database
      .prepare(
        `INSERT INTO cases (
          id,
          project_name,
          client_name,
          address,
          city,
          jurisdiction,
          permit_number,
          current_status,
          created_at,
          updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        id,
        input.project_name,
        input.client_name,
        input.address,
        input.city,
        input.jurisdiction,
        permitNumber,
        input.current_status,
        timestamp,
        timestamp,
      ),
    createAuditInsert(database, {
      id: auditEventId(),
      caseId: id,
      actorUserId: null,
      action: "case_created",
      changedFields: createdCaseChangedFields,
      fromStatus: null,
      toStatus: input.current_status,
      requestId,
      timestamp,
    }),
  ]);

  return {
    id,
    project_name: input.project_name,
    client_name: input.client_name,
    address: input.address,
    city: input.city,
    jurisdiction: input.jurisdiction,
    permit_number: permitNumber,
    current_status: input.current_status,
    version: 1,
    created_at: timestamp,
    updated_at: timestamp,
  };
}

export async function getCaseById(
  database: Bindings["DB"],
  id: string,
): Promise<CaseResponse | null> {
  const row = await database
    .prepare(
      `SELECT ${caseSelectColumns()}
       FROM cases
       WHERE id = ?
       LIMIT 1`,
    )
    .bind(id)
    .first<CaseRow>();

  return row ? rowToCaseResponse(row) : null;
}

export async function listCases(
  database: Bindings["DB"],
): Promise<CaseResponse[]> {
  const result = await database
    .prepare(
      `SELECT ${caseSelectColumns()}
       FROM cases
       ORDER BY updated_at DESC, id DESC
       LIMIT 50`,
    )
    .all<CaseRow>();

  return result.results.map(rowToCaseResponse);
}

export async function createCaseForActor(
  database: Bindings["DB"],
  input: CreateCaseInput,
  actor: CaseActor,
  requestId: string = crypto.randomUUID(),
): Promise<CaseResponse> {
  const id = crypto.randomUUID();
  const timestamp = new Date().toISOString();
  const permitNumber = input.permit_number ?? null;
  const insertCase = database
    .prepare(
      `INSERT INTO cases (
        id,
        project_name,
        client_name,
        address,
        city,
        jurisdiction,
        permit_number,
        current_status,
        created_at,
        updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      id,
      input.project_name,
      input.client_name,
      input.address,
      input.city,
      input.jurisdiction,
      permitNumber,
      input.current_status,
      timestamp,
      timestamp,
    );
  const insertAudit = createAuditInsert(database, {
    id: auditEventId(),
    caseId: id,
    actorUserId: actor.id,
    action: "case_created",
    changedFields: createdCaseChangedFields,
    fromStatus: null,
    toStatus: input.current_status,
    requestId,
    timestamp,
  });

  if (createsOwnerParticipant(actor)) {
    await database.batch([
      insertCase,
      database
        .prepare(
          `INSERT INTO case_participants (
            case_id,
            user_id,
            participant_role,
            created_at
          ) VALUES (?, ?, 'owner', ?)`,
        )
        .bind(id, actor.id, timestamp),
      insertAudit,
    ]);
  } else {
    await database.batch([insertCase, insertAudit]);
  }

  return {
    id,
    project_name: input.project_name,
    client_name: input.client_name,
    address: input.address,
    city: input.city,
    jurisdiction: input.jurisdiction,
    permit_number: permitNumber,
    current_status: input.current_status,
    version: 1,
    created_at: timestamp,
    updated_at: timestamp,
  };
}

export async function listCasesForActor(
  database: Bindings["DB"],
  actor: CaseActor,
  pagination: CaseListPagination,
): Promise<CaseResponse[]> {
  const scope = caseListScope(actor);
  const query =
    scope === "all"
      ? database
          .prepare(
            `SELECT ${caseSelectColumns()}
             FROM cases
             ORDER BY updated_at DESC, id DESC
             LIMIT ? OFFSET ?`,
          )
          .bind(pagination.limit, pagination.offset)
      : database
          .prepare(
            `SELECT ${caseSelectColumns()}
             FROM cases
             WHERE EXISTS (
               SELECT 1
               FROM case_participants
               WHERE case_participants.case_id = cases.id
                 AND case_participants.user_id = ?
             )
             ORDER BY updated_at DESC, id DESC
             LIMIT ? OFFSET ?`,
          )
          .bind(actor.id, pagination.limit, pagination.offset);

  const result = await query.all<CaseRow>();

  return result.results.map(rowToCaseResponse);
}

export async function getCaseForActor(
  database: Bindings["DB"],
  actor: CaseActor,
  id: string,
): Promise<CaseResponse | null> {
  const query =
    mayReadAnyCase(actor)
      ? database
          .prepare(
            `SELECT ${caseSelectColumns()}
             FROM cases
             WHERE id = ?
             LIMIT 1`,
          )
          .bind(id)
      : database
          .prepare(
            `SELECT ${caseSelectColumns()}
             FROM cases
             WHERE id = ?
               AND EXISTS (
                 SELECT 1
                 FROM case_participants
                 WHERE case_participants.case_id = cases.id
                   AND case_participants.user_id = ?
               )
             LIMIT 1`,
          )
          .bind(id, actor.id);

  const row = await query.first<CaseRow>();

  return row ? rowToCaseResponse(row) : null;
}

export async function getEditableCaseForActor(
  database: Bindings["DB"],
  actor: CaseActor,
  id: string,
): Promise<CaseResponse | null> {
  if (mayEditAnyCase(actor)) {
    return getCaseById(database, id);
  }

  if (!mayEditParticipatingCase(actor)) {
    return null;
  }

  const row = await database
    .prepare(
      `SELECT ${caseSelectColumns()}
       FROM cases
       WHERE id = ?
         AND EXISTS (
           SELECT 1
           FROM case_participants
           WHERE case_participants.case_id = cases.id
             AND case_participants.user_id = ?
             AND case_participants.participant_role = 'owner'
         )
       LIMIT 1`,
    )
    .bind(id, actor.id)
    .first<CaseRow>();

  return row ? rowToCaseResponse(row) : null;
}

export async function updateCaseMetadataForActor(
  database: Bindings["DB"],
  actor: CaseActor,
  existing: CaseResponse,
  input: UpdateCaseMetadataInput,
  requestId: string,
): Promise<CaseMutationResult> {
  if (input.expected_version !== existing.version) {
    return { outcome: "conflict" };
  }

  const changedFields = changedMetadataFields(existing, input);

  if (changedFields.length === 0) {
    return { outcome: "no_changes" };
  }

  const timestamp = new Date().toISOString();
  const nonce = mutationNonce();
  const setClauses = changedFields.map(
    (field) => `${metadataColumns[field]} = ?`,
  );
  const values = changedFields.map((field) => {
    const value = metadataInputValue(input, field);

    return value === undefined ? null : value;
  });
  const authorizationClause = mayEditAnyCase(actor)
    ? ""
    : `AND EXISTS (
        SELECT 1
        FROM case_participants
        WHERE case_participants.case_id = cases.id
          AND case_participants.user_id = ?
          AND case_participants.participant_role = 'owner'
      )`;
  const authorizationBindings = mayEditAnyCase(actor) ? [] : [actor.id];
  const updateStatement = database
    .prepare(
      `UPDATE cases
       SET ${setClauses.join(", ")},
         version = version + 1,
         updated_at = ?,
         lifecycle_mutation_nonce = ?
       WHERE id = ?
         AND version = ?
         ${authorizationClause}
       RETURNING ${caseSelectColumns()}`,
    )
    .bind(
      ...values,
      timestamp,
      nonce,
      existing.id,
      input.expected_version,
      ...authorizationBindings,
    );
  const insertAuditStatement = database
    .prepare(
      `INSERT INTO audit_events (
        id,
        case_id,
        actor_user_id,
        action,
        changed_fields,
        from_status,
        to_status,
        request_id,
        created_at
      )
      SELECT
        ?,
        id,
        ?,
        'case_updated',
        ?,
        NULL,
        NULL,
        ?,
        ?
      FROM cases
      WHERE id = ?
        AND lifecycle_mutation_nonce = ?`,
    )
    .bind(
      auditEventId(),
      actor.id,
      JSON.stringify(changedFields),
      requestId,
      timestamp,
      existing.id,
      nonce,
    );

  const [updateResult, auditResult] = await database.batch<CaseRow>([
    updateStatement,
    insertAuditStatement,
  ]);
  const row = updateResult.results?.[0];

  if (!row) {
    return { outcome: "conflict" };
  }

  if (auditResult.meta.changes !== 1) {
    throw new Error("Case metadata update did not create exactly one audit event.");
  }

  return {
    outcome: "success",
    record: rowToCaseResponse(row),
  };
}

export async function updateCaseStatusForActor(
  database: Bindings["DB"],
  actor: CaseActor,
  existing: CaseResponse,
  input: UpdateCaseStatusInput,
  requestId: string,
): Promise<CaseMutationResult> {
  if (input.expected_version !== existing.version) {
    return { outcome: "conflict" };
  }

  if (input.current_status === existing.current_status) {
    return { outcome: "same_status" };
  }

  if (
    !isAllowedStatusTransition(
      existing.current_status,
      input.current_status,
    )
  ) {
    return { outcome: "invalid_transition" };
  }

  const timestamp = new Date().toISOString();
  const nonce = mutationNonce();
  const [updateResult, auditResult] = await database.batch<CaseRow>([
    database
      .prepare(
        `UPDATE cases
         SET current_status = ?,
           version = version + 1,
           updated_at = ?,
           lifecycle_mutation_nonce = ?
         WHERE id = ?
           AND version = ?
         RETURNING ${caseSelectColumns()}`,
      )
      .bind(
        input.current_status,
        timestamp,
        nonce,
        existing.id,
        input.expected_version,
      ),
    database
      .prepare(
        `INSERT INTO audit_events (
          id,
          case_id,
          actor_user_id,
          action,
          changed_fields,
          from_status,
          to_status,
          request_id,
          created_at
        )
        SELECT
          ?,
          id,
          ?,
          'case_status_changed',
          ?,
          ?,
          ?,
          ?,
          ?
        FROM cases
        WHERE id = ?
          AND lifecycle_mutation_nonce = ?`,
      )
      .bind(
        auditEventId(),
        actor.id,
        JSON.stringify(["current_status"]),
        existing.current_status,
        input.current_status,
        requestId,
        timestamp,
        existing.id,
        nonce,
      ),
  ]);
  const row = updateResult.results?.[0];

  if (!row) {
    return { outcome: "conflict" };
  }

  if (auditResult.meta.changes !== 1) {
    throw new Error("Case status update did not create exactly one audit event.");
  }

  return {
    outcome: "success",
    record: rowToCaseResponse(row),
  };
}

export async function listCaseActivity(
  database: Bindings["DB"],
  caseId: string,
  pagination: CaseActivityQuery,
): Promise<CaseActivityResponse[]> {
  const result = await database
    .prepare(
      `SELECT
        audit_events.id,
        audit_events.action,
        audit_events.changed_fields,
        audit_events.from_status,
        audit_events.to_status,
        audit_events.actor_user_id AS actor_id,
        "user".name AS actor_name,
        audit_events.created_at
      FROM audit_events
      LEFT JOIN "user"
        ON "user".id = audit_events.actor_user_id
      WHERE audit_events.case_id = ?
      ORDER BY audit_events.created_at DESC, audit_events.id DESC
      LIMIT ? OFFSET ?`,
    )
    .bind(caseId, pagination.limit, pagination.offset)
    .all<CaseActivityRow>();

  return result.results.map(toActivityResponse);
}

export interface ContributorResponse {
  id: string;
  name: string | null;
}

export interface EvidenceResponse {
  id: string;
  evidence_type: EvidenceItemRecord["evidenceType"];
  title: string;
  summary: string;
  source_url: string | null;
  source_label: string | null;
  source_date: string | null;
  verification_status: EvidenceItemRecord["verificationStatus"];
  contributor: ContributorResponse;
  version: number;
  created_at: string;
  updated_at: string;
}

interface EvidenceRow {
  id: string;
  case_id: string;
  created_by_user_id: string;
  evidence_type: EvidenceResponse["evidence_type"];
  title: string;
  summary: string;
  source_url: string | null;
  source_label: string | null;
  source_date: string | null;
  verification_status: EvidenceResponse["verification_status"];
  version: number;
  created_at: string;
  updated_at: string;
  contributor_name: string | null;
}

export interface TimelineResponse {
  id: string;
  occurred_on: string;
  timeline_type: TimelineEntryRecord["timelineType"];
  title: string;
  details: string;
  is_canonical: boolean;
  contributor: ContributorResponse;
  evidence_ids: string[];
  version: number;
  created_at: string;
  updated_at: string;
}

interface TimelineRow {
  id: string;
  case_id: string;
  created_by_user_id: string;
  occurred_on: string;
  timeline_type: TimelineResponse["timeline_type"];
  title: string;
  details: string;
  is_canonical: number;
  version: number;
  created_at: string;
  updated_at: string;
  contributor_name: string | null;
  evidence_ids: string;
}

export type EvidenceMutationResult =
  | { outcome: "success"; record: EvidenceResponse }
  | { outcome: "conflict" }
  | { outcome: "forbidden" }
  | { outcome: "not_found" }
  | { outcome: "no_changes" };

export type TimelineMutationResult =
  | { outcome: "success"; record: TimelineResponse }
  | { outcome: "conflict" }
  | { outcome: "forbidden" }
  | { outcome: "not_found" }
  | { outcome: "no_changes" }
  | { outcome: "invalid_link" }
  | { outcome: "duplicate_link" };

export type LinkMutationResult =
  | { outcome: "success"; record: TimelineResponse }
  | { outcome: "forbidden" }
  | { outcome: "not_found" }
  | { outcome: "duplicate_link" };

const evidenceFieldOrder = [
  "evidence_type",
  "title",
  "summary",
  "source_url",
  "source_label",
  "source_date",
  "verification_status",
] as const;

type EvidenceField = (typeof evidenceFieldOrder)[number];

const evidenceColumns = {
  evidence_type: "evidence_type",
  title: "title",
  summary: "summary",
  source_url: "source_url",
  source_label: "source_label",
  source_date: "source_date",
  verification_status: "verification_status",
} as const satisfies Record<EvidenceField, string>;

const timelineFieldOrder = [
  "occurred_on",
  "timeline_type",
  "title",
  "details",
  "is_canonical",
] as const;

type TimelineField = (typeof timelineFieldOrder)[number];

const timelineColumns = {
  occurred_on: "occurred_on",
  timeline_type: "timeline_type",
  title: "title",
  details: "details",
  is_canonical: "is_canonical",
} as const satisfies Record<TimelineField, string>;

function evidenceSelectColumns(): string {
  return `evidence_items.id,
    evidence_items.case_id,
    evidence_items.created_by_user_id,
    evidence_items.evidence_type,
    evidence_items.title,
    evidence_items.summary,
    evidence_items.source_url,
    evidence_items.source_label,
    evidence_items.source_date,
    evidence_items.verification_status,
    evidence_items.version,
    evidence_items.created_at,
    evidence_items.updated_at,
    "user".name AS contributor_name`;
}

function timelineSelectColumns(): string {
  return `timeline_entries.id,
    timeline_entries.case_id,
    timeline_entries.created_by_user_id,
    timeline_entries.occurred_on,
    timeline_entries.timeline_type,
    timeline_entries.title,
    timeline_entries.details,
    timeline_entries.is_canonical,
    timeline_entries.version,
    timeline_entries.created_at,
    timeline_entries.updated_at,
    "user".name AS contributor_name,
    COALESCE((
      SELECT json_group_array(evidence_id)
      FROM (
        SELECT timeline_entry_evidence.evidence_item_id AS evidence_id
        FROM timeline_entry_evidence
        INNER JOIN evidence_items
          ON evidence_items.id = timeline_entry_evidence.evidence_item_id
        WHERE timeline_entry_id = timeline_entries.id
          AND evidence_items.deleted_at IS NULL
        ORDER BY evidence_item_id
      )
    ), '[]') AS evidence_ids`;
}

function rowToEvidenceResponse(row: EvidenceRow): EvidenceResponse {
  return {
    id: row.id,
    evidence_type: row.evidence_type,
    title: row.title,
    summary: row.summary,
    source_url: row.source_url,
    source_label: row.source_label,
    source_date: row.source_date,
    verification_status: row.verification_status,
    contributor: {
      id: row.created_by_user_id,
      name: row.contributor_name,
    },
    version: row.version,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

function rowToTimelineResponse(row: TimelineRow): TimelineResponse {
  const evidenceIds = JSON.parse(row.evidence_ids) as unknown;

  return {
    id: row.id,
    occurred_on: row.occurred_on,
    timeline_type: row.timeline_type,
    title: row.title,
    details: row.details,
    is_canonical: row.is_canonical === 1,
    contributor: {
      id: row.created_by_user_id,
      name: row.contributor_name,
    },
    evidence_ids: Array.isArray(evidenceIds)
      ? evidenceIds.filter((id): id is string => typeof id === "string")
      : [],
    version: row.version,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

function evidenceValue(
  record: EvidenceResponse,
  field: EvidenceField,
): string | null {
  return field === "verification_status"
    ? record.verification_status
    : record[field];
}

function evidenceInputValue(
  input: UpdateEvidenceInput,
  field: EvidenceField,
): string | null | undefined {
  return input[field];
}

function changedEvidenceFields(
  record: EvidenceResponse,
  input: UpdateEvidenceInput,
): EvidenceField[] {
  return evidenceFieldOrder.filter((field) => {
    const suppliedValue = evidenceInputValue(input, field);

    return (
      suppliedValue !== undefined &&
      suppliedValue !== evidenceValue(record, field)
    );
  });
}

function timelineValue(
  record: TimelineResponse,
  field: TimelineField,
): string | boolean {
  return record[field];
}

function timelineInputValue(
  input: UpdateTimelineInput,
  field: TimelineField,
): string | boolean | undefined {
  return input[field];
}

function changedTimelineFields(
  record: TimelineResponse,
  input: UpdateTimelineInput,
): TimelineField[] {
  return timelineFieldOrder.filter((field) => {
    const suppliedValue = timelineInputValue(input, field);

    return (
      suppliedValue !== undefined &&
      suppliedValue !== timelineValue(record, field)
    );
  });
}

async function getEvidenceByCase(
  database: Bindings["DB"],
  caseId: string,
  evidenceId: string,
): Promise<EvidenceResponse | null> {
  const row = await database
    .prepare(
      `SELECT ${evidenceSelectColumns()}
       FROM evidence_items
       INNER JOIN "user"
         ON "user".id = evidence_items.created_by_user_id
       WHERE evidence_items.case_id = ?
         AND evidence_items.id = ?
         AND evidence_items.deleted_at IS NULL
       LIMIT 1`,
    )
    .bind(caseId, evidenceId)
    .first<EvidenceRow>();

  return row ? rowToEvidenceResponse(row) : null;
}

async function getTimelineByCase(
  database: Bindings["DB"],
  caseId: string,
  timelineId: string,
): Promise<TimelineResponse | null> {
  const row = await database
    .prepare(
      `SELECT ${timelineSelectColumns()}
       FROM timeline_entries
       INNER JOIN "user"
         ON "user".id = timeline_entries.created_by_user_id
       WHERE timeline_entries.case_id = ?
         AND timeline_entries.id = ?
         AND timeline_entries.deleted_at IS NULL
       LIMIT 1`,
    )
    .bind(caseId, timelineId)
    .first<TimelineRow>();

  return row ? rowToTimelineResponse(row) : null;
}

async function countLinkableEvidence(
  database: Bindings["DB"],
  caseId: string,
  evidenceIds: string[],
  actor: CaseActor,
): Promise<number> {
  if (evidenceIds.length === 0) {
    return 0;
  }

  const placeholders = evidenceIds.map(() => "?").join(", ");
  const creatorClause = mayLinkAnyEvidenceToTimeline(actor)
    ? ""
    : "AND created_by_user_id = ?";
  const bindings = mayLinkAnyEvidenceToTimeline(actor)
    ? [caseId, ...evidenceIds]
    : [caseId, ...evidenceIds, actor.id];
  const row = await database
    .prepare(
      `SELECT COUNT(*) AS count
       FROM evidence_items
       WHERE case_id = ?
         AND id IN (${placeholders})
         AND deleted_at IS NULL
         ${creatorClause}`,
    )
    .bind(...bindings)
    .first<{ count: number }>();

  return row?.count ?? 0;
}

export async function createEvidenceForActor(
  database: Bindings["DB"],
  caseId: string,
  actor: CaseActor,
  input: CreateEvidenceInput,
): Promise<EvidenceResponse> {
  const id = crypto.randomUUID();
  const timestamp = new Date().toISOString();

  await database
    .prepare(
      `INSERT INTO evidence_items (
        id,
        case_id,
        created_by_user_id,
        evidence_type,
        title,
        summary,
        source_url,
        source_label,
        source_date,
        verification_status,
        version,
        created_at,
        updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'unverified', 1, ?, ?)`,
    )
    .bind(
      id,
      caseId,
      actor.id,
      input.evidence_type,
      input.title,
      input.summary,
      input.source_url,
      input.source_label,
      input.source_date,
      timestamp,
      timestamp,
    )
    .run();

  const record = await getEvidenceByCase(database, caseId, id);

  if (!record) {
    throw new Error("Created evidence could not be loaded.");
  }

  return record;
}

export async function listEvidenceForCase(
  database: Bindings["DB"],
  caseId: string,
  pagination: EvidenceTimelinePagination,
): Promise<EvidenceResponse[]> {
  const result = await database
    .prepare(
      `SELECT ${evidenceSelectColumns()}
       FROM evidence_items
       INNER JOIN "user"
         ON "user".id = evidence_items.created_by_user_id
       WHERE evidence_items.case_id = ?
         AND evidence_items.deleted_at IS NULL
       ORDER BY evidence_items.source_date IS NULL ASC,
         evidence_items.source_date DESC,
         evidence_items.created_at DESC,
         evidence_items.id DESC
       LIMIT ? OFFSET ?`,
    )
    .bind(caseId, pagination.limit, pagination.offset)
    .all<EvidenceRow>();

  return result.results.map(rowToEvidenceResponse);
}

export async function readEvidenceForActor(
  database: Bindings["DB"],
  caseId: string,
  evidenceId: string,
): Promise<EvidenceResponse | null> {
  return getEvidenceByCase(database, caseId, evidenceId);
}

export async function updateEvidenceForActor(
  database: Bindings["DB"],
  caseId: string,
  actor: CaseActor,
  existing: EvidenceResponse,
  input: UpdateEvidenceInput,
): Promise<EvidenceMutationResult> {
  if (input.verification_status !== undefined && !mayManageAnyEvidence(actor)) {
    return { outcome: "forbidden" };
  }

  if (
    !mayManageAnyEvidence(actor) &&
    existing.contributor.id !== actor.id
  ) {
    return { outcome: "forbidden" };
  }

  if (input.expected_version !== existing.version) {
    return { outcome: "conflict" };
  }

  const changedFields = changedEvidenceFields(existing, input);

  if (changedFields.length === 0) {
    return { outcome: "no_changes" };
  }

  const timestamp = new Date().toISOString();
  const setClauses = changedFields.map(
    (field) => `${evidenceColumns[field]} = ?`,
  );
  const values = changedFields.map((field) => evidenceInputValue(input, field));
  const result = await database
    .prepare(
      `UPDATE evidence_items
       SET ${setClauses.join(", ")},
         version = version + 1,
         updated_at = ?
       WHERE id = ?
         AND case_id = ?
         AND version = ?
         AND deleted_at IS NULL
       RETURNING id`,
    )
    .bind(
      ...values,
      timestamp,
      existing.id,
      caseId,
      input.expected_version,
    )
    .first<{ id: string }>();

  if (!result) {
    return { outcome: "conflict" };
  }

  const record = await getEvidenceByCase(database, caseId, existing.id);

  if (!record) {
    return { outcome: "not_found" };
  }

  return {
    outcome: "success",
    record,
  };
}

export async function createTimelineForActor(
  database: Bindings["DB"],
  caseId: string,
  actor: CaseActor,
  input: CreateTimelineInput,
): Promise<TimelineMutationResult> {
  if (input.is_canonical && !mayManageAnyTimeline(actor)) {
    return { outcome: "forbidden" };
  }

  if (
    input.evidence_ids.length > 0 &&
    (await countLinkableEvidence(database, caseId, input.evidence_ids, actor)) !==
      input.evidence_ids.length
  ) {
    return { outcome: "invalid_link" };
  }

  const id = crypto.randomUUID();
  const timestamp = new Date().toISOString();
  const statements = [
    database
      .prepare(
        `INSERT INTO timeline_entries (
          id,
          case_id,
          created_by_user_id,
          occurred_on,
          timeline_type,
          title,
          details,
          is_canonical,
          version,
          created_at,
          updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`,
      )
      .bind(
        id,
        caseId,
        actor.id,
        input.occurred_on,
        input.timeline_type,
        input.title,
        input.details,
        input.is_canonical ? 1 : 0,
        timestamp,
        timestamp,
      ),
    ...input.evidence_ids.map((evidenceId) =>
      database
        .prepare(
          `INSERT INTO timeline_entry_evidence (
            timeline_entry_id,
            evidence_item_id,
            created_at
          ) VALUES (?, ?, ?)`,
        )
        .bind(id, evidenceId, timestamp),
    ),
  ];

  await database.batch(statements);

  const record = await getTimelineByCase(database, caseId, id);

  if (!record) {
    throw new Error("Created timeline entry could not be loaded.");
  }

  return {
    outcome: "success",
    record,
  };
}

export async function listTimelineForCase(
  database: Bindings["DB"],
  caseId: string,
  pagination: EvidenceTimelinePagination,
): Promise<TimelineResponse[]> {
  const result = await database
    .prepare(
      `SELECT ${timelineSelectColumns()}
       FROM timeline_entries
       INNER JOIN "user"
         ON "user".id = timeline_entries.created_by_user_id
       WHERE timeline_entries.case_id = ?
         AND timeline_entries.deleted_at IS NULL
       ORDER BY timeline_entries.occurred_on DESC,
         timeline_entries.created_at DESC,
         timeline_entries.id DESC
       LIMIT ? OFFSET ?`,
    )
    .bind(caseId, pagination.limit, pagination.offset)
    .all<TimelineRow>();

  return result.results.map(rowToTimelineResponse);
}

export async function readTimelineForActor(
  database: Bindings["DB"],
  caseId: string,
  timelineId: string,
): Promise<TimelineResponse | null> {
  return getTimelineByCase(database, caseId, timelineId);
}

export async function updateTimelineForActor(
  database: Bindings["DB"],
  caseId: string,
  actor: CaseActor,
  existing: TimelineResponse,
  input: UpdateTimelineInput,
): Promise<TimelineMutationResult> {
  if (input.is_canonical !== undefined && !mayManageAnyTimeline(actor)) {
    return { outcome: "forbidden" };
  }

  if (!mayManageAnyTimeline(actor)) {
    if (existing.is_canonical || existing.contributor.id !== actor.id) {
      return { outcome: "forbidden" };
    }
  }

  if (input.expected_version !== existing.version) {
    return { outcome: "conflict" };
  }

  const changedFields = changedTimelineFields(existing, input);

  if (changedFields.length === 0) {
    return { outcome: "no_changes" };
  }

  const timestamp = new Date().toISOString();
  const setClauses = changedFields.map(
    (field) => `${timelineColumns[field]} = ?`,
  );
  const values = changedFields.map((field) => {
    const value = timelineInputValue(input, field);

    return typeof value === "boolean" ? (value ? 1 : 0) : value;
  });
  const result = await database
    .prepare(
      `UPDATE timeline_entries
       SET ${setClauses.join(", ")},
         version = version + 1,
         updated_at = ?
       WHERE id = ?
         AND case_id = ?
         AND version = ?
         AND deleted_at IS NULL
       RETURNING id`,
    )
    .bind(
      ...values,
      timestamp,
      existing.id,
      caseId,
      input.expected_version,
    )
    .first<{ id: string }>();

  if (!result) {
    return { outcome: "conflict" };
  }

  const record = await getTimelineByCase(database, caseId, existing.id);

  if (!record) {
    return { outcome: "not_found" };
  }

  return {
    outcome: "success",
    record,
  };
}

async function getLinkableTimelineAndEvidence(
  database: Bindings["DB"],
  caseId: string,
  timelineId: string,
  evidenceId: string,
): Promise<{
  timeline: TimelineResponse | null;
  evidence: EvidenceResponse | null;
}> {
  const [timeline, evidence] = await Promise.all([
    getTimelineByCase(database, caseId, timelineId),
    getEvidenceByCase(database, caseId, evidenceId),
  ]);

  return { timeline, evidence };
}

export async function linkEvidenceToTimelineForActor(
  database: Bindings["DB"],
  caseId: string,
  actor: CaseActor,
  timelineId: string,
  evidenceId: string,
): Promise<LinkMutationResult> {
  const { timeline, evidence } = await getLinkableTimelineAndEvidence(
    database,
    caseId,
    timelineId,
    evidenceId,
  );

  if (!timeline || !evidence) {
    return { outcome: "not_found" };
  }

  if (!mayLinkAnyEvidenceToTimeline(actor)) {
    const canClientLink =
      timeline.contributor.id === actor.id &&
      evidence.contributor.id === actor.id &&
      !timeline.is_canonical;

    if (!canClientLink) {
      return { outcome: "forbidden" };
    }
  }

  const insertResult = await database
    .prepare(
      `INSERT OR IGNORE INTO timeline_entry_evidence (
        timeline_entry_id,
        evidence_item_id
      ) VALUES (?, ?)`,
    )
    .bind(timelineId, evidenceId)
    .run();

  if (insertResult.meta.changes !== 1) {
    return { outcome: "duplicate_link" };
  }

  const record = await getTimelineByCase(database, caseId, timelineId);

  if (!record) {
    return { outcome: "not_found" };
  }

  return {
    outcome: "success",
    record,
  };
}

export async function unlinkEvidenceFromTimelineForActor(
  database: Bindings["DB"],
  caseId: string,
  actor: CaseActor,
  timelineId: string,
  evidenceId: string,
): Promise<LinkMutationResult> {
  const { timeline, evidence } = await getLinkableTimelineAndEvidence(
    database,
    caseId,
    timelineId,
    evidenceId,
  );

  if (!timeline || !evidence) {
    return { outcome: "not_found" };
  }

  if (!mayLinkAnyEvidenceToTimeline(actor)) {
    const canClientUnlink =
      timeline.contributor.id === actor.id &&
      evidence.contributor.id === actor.id &&
      !timeline.is_canonical;

    if (!canClientUnlink) {
      return { outcome: "forbidden" };
    }
  }

  const result = await database
    .prepare(
      `DELETE FROM timeline_entry_evidence
       WHERE timeline_entry_id = ?
         AND evidence_item_id = ?`,
    )
    .bind(timelineId, evidenceId)
    .run();

  if (result.meta.changes !== 1) {
    return { outcome: "not_found" };
  }

  const record = await getTimelineByCase(database, caseId, timelineId);

  if (!record) {
    return { outcome: "not_found" };
  }

  return {
    outcome: "success",
    record,
  };
}
