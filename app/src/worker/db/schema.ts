import { sql } from "drizzle-orm";
import { index, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const caseStatuses = [
  "intake",
  "researching",
  "needs_information",
  "ready_for_review",
] as const;

export const cases = sqliteTable(
  "cases",
  {
    id: text("id").primaryKey().notNull(),
    projectName: text("project_name").notNull(),
    clientName: text("client_name").notNull(),
    address: text("address").notNull(),
    city: text("city").notNull(),
    jurisdiction: text("jurisdiction").notNull(),
    permitNumber: text("permit_number"),
    currentStatus: text("current_status", {
      enum: caseStatuses,
    })
      .notNull()
      .default("intake"),
    createdAt: text("created_at")
      .notNull()
      .default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`),
    updatedAt: text("updated_at")
      .notNull()
      .default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`),
  },
  (table) => [
    index("cases_current_status_updated_at_idx").on(
      table.currentStatus,
      table.updatedAt,
    ),
    index("cases_city_jurisdiction_idx").on(
      table.city,
      table.jurisdiction,
    ),
  ],
);

export type CaseRecord = typeof cases.$inferSelect;
