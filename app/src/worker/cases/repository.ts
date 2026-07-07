import type { CaseRecord } from "../db/schema";
import type { Bindings } from "../types";
import {
  caseListScope,
  createsOwnerParticipant,
  mayEditAnyCase,
  mayEditParticipatingCase,
  mayReadAnyCase,
  type CaseActor,
} from "./authorization";
import type {
  CaseActivityQuery,
  CreateCaseInput,
  UpdateCaseMetadataInput,
  UpdateCaseStatusInput,
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
