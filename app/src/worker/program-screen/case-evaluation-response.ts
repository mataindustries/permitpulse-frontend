import type { ProgramScreenResult } from "../../shared/program-screen/types";
import type { CaseProgramScreenEvaluation, ReviewedLotSummary } from "./evaluate-case";

export const PROGRAM_SCREEN_CASE_EVALUATION_VERSION = "program-screen-case-evaluation-v1" as const;

type HazardRouteOverlayState = "computed" | "unavailable";

/** The HTTP contract. Every field is copied explicitly; nothing internal is spread into it. */
export interface ProgramScreenCaseEvaluationResponse {
  schema_version: typeof PROGRAM_SCREEN_CASE_EVALUATION_VERSION;
  case_id: string;
  as_of: string;
  as_of_basis: "server_utc_calendar_date";
  reviewed_lot: ReviewedLotSummary | null;
  hazard_routes: [
    { route: "gov_51178"; authority_source_id: "calfire-lra-fhsz-2025-03-24-v1"; overlay: HazardRouteOverlayState },
    { route: "prc_4202"; authority_source_id: "calfire-sra-fhsz-2023-09-29"; overlay: HazardRouteOverlayState },
  ];
  screen: ProgramScreenResult;
}

/** The server's evaluation date: the UTC calendar date of `now`, never a caller-supplied date. */
export function programScreenAsOf(now: Date): string {
  return now.toISOString().slice(0, 10);
}

/**
 * Allowlist DTO. The reviewed-lot record, route overlays, geometry, datasets, issues, store
 * paths, hashes and file references stay inside the worker.
 */
export function buildProgramScreenCaseEvaluationResponse(
  result: Pick<CaseProgramScreenEvaluation, "screen" | "route_overlays" | "reviewed_lot">,
  asOf: string,
): ProgramScreenCaseEvaluationResponse {
  const { screen, route_overlays: routes, reviewed_lot: lot } = result;
  if (screen.as_of !== asOf) throw new Error("Program Screen evaluation date differs from the server date.");
  if (screen.subject.property_id !== null) throw new Error("Program Screen case evaluation subject must be server-supplied.");
  return {
    schema_version: PROGRAM_SCREEN_CASE_EVALUATION_VERSION,
    case_id: screen.subject.case_id,
    as_of: screen.as_of,
    as_of_basis: "server_utc_calendar_date",
    reviewed_lot: lot === null ? null : {
      review_id: lot.review_id,
      reviewed_on: lot.reviewed_on,
      next_review_on: lot.next_review_on,
      legal_lot_identity: lot.legal_lot_identity,
    },
    hazard_routes: [
      { route: "gov_51178", authority_source_id: "calfire-lra-fhsz-2025-03-24-v1", overlay: routes.gov_51178.inputs === undefined ? "unavailable" : "computed" },
      { route: "prc_4202", authority_source_id: "calfire-sra-fhsz-2023-09-29", overlay: routes.prc_4202.inputs === undefined ? "unavailable" : "computed" },
    ],
    screen: {
      schema_version: screen.schema_version,
      screen_id: screen.screen_id,
      screen_scope: screen.screen_scope,
      subject: { case_id: screen.subject.case_id, property_id: null },
      as_of: screen.as_of,
      facts: screen.facts,
      pathways: screen.pathways,
      planning_questions: screen.planning_questions,
      review_tasks: screen.review_tasks,
      release: screen.release,
      counts: screen.counts,
    },
  };
}
