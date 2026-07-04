import { desc, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import { cases, type CaseRecord } from "../db/schema";
import type { Bindings } from "../types";
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
