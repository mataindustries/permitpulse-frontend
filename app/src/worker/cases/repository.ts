import { desc, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import { cases, type CaseRecord } from "../db/schema";
import type { Bindings } from "../types";
import {
  caseListScope,
  createsOwnerParticipant,
  mayReadAnyCase,
  type CaseActor,
} from "./authorization";
import type { CreateCaseInput } from "./validation";

export interface CaseResponse {
  id: string;
  project_name: string;
  client_name: string;
  address: string;
  city: string;
  jurisdiction: string;
  permit_number: string | null;
  current_status: CaseRecord["currentStatus"];
  created_at: string;
  updated_at: string;
}

function toCaseResponse(record: CaseRecord): CaseResponse {
  return {
    id: record.id,
    project_name: record.projectName,
    client_name: record.clientName,
    address: record.address,
    city: record.city,
    jurisdiction: record.jurisdiction,
    permit_number: record.permitNumber,
    current_status: record.currentStatus,
    created_at: record.createdAt,
    updated_at: record.updatedAt,
  };
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
  created_at: string;
  updated_at: string;
}

export interface CaseListPagination {
  limit: number;
  offset: number;
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
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

export async function createCase(
  database: Bindings["DB"],
  input: CreateCaseInput,
): Promise<CaseResponse> {
  const db = drizzle(database);
  const timestamp = new Date().toISOString();
  const [created] = await db
    .insert(cases)
    .values({
      id: crypto.randomUUID(),
      projectName: input.project_name,
      clientName: input.client_name,
      address: input.address,
      city: input.city,
      jurisdiction: input.jurisdiction,
      permitNumber: input.permit_number,
      currentStatus: input.current_status,
      createdAt: timestamp,
      updatedAt: timestamp,
    })
    .returning();

  if (!created) {
    throw new Error("D1 did not return the created case.");
  }

  return toCaseResponse(created);
}

export async function getCaseById(
  database: Bindings["DB"],
  id: string,
): Promise<CaseResponse | null> {
  const db = drizzle(database);
  const [record] = await db
    .select()
    .from(cases)
    .where(eq(cases.id, id))
    .limit(1);

  return record ? toCaseResponse(record) : null;
}

export async function listCases(
  database: Bindings["DB"],
): Promise<CaseResponse[]> {
  const db = drizzle(database);
  const records = await db
    .select()
    .from(cases)
    .orderBy(desc(cases.updatedAt), desc(cases.id))
    .limit(50);

  return records.map(toCaseResponse);
}

export async function createCaseForActor(
  database: Bindings["DB"],
  input: CreateCaseInput,
  actor: CaseActor,
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
    ]);
  } else {
    await insertCase.run();
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
            `SELECT
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
            FROM cases
            ORDER BY updated_at DESC, id DESC
            LIMIT ? OFFSET ?`,
          )
          .bind(pagination.limit, pagination.offset)
      : database
          .prepare(
            `SELECT
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
            `SELECT
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
            FROM cases
            WHERE id = ?
            LIMIT 1`,
          )
          .bind(id)
      : database
          .prepare(
            `SELECT
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
