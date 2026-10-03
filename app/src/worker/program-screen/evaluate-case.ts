import type { CanonicalEvidenceRecord } from "../../shared/build-week-integrity/types";
import { programAuthorityRegistries, type ProgramAuthorityRegistries } from "../../shared/program-screen/authority-policy";
import { isIsoCalendarDate, parseProgramEvidenceAuthority, PROGRAM_EVIDENCE_AUTHORITY_VERSION, type ProgramEvidenceAuthority } from "../../shared/program-screen/evidence-authority";
import { evaluateProgramScreen } from "../../shared/program-screen/evaluate";
import { programFactSpecs } from "../../shared/program-screen/facts";
import { computeLotOverlay, type LotOverlayComputation } from "../../shared/program-screen/lot-overlay";
import type { ReviewedLotGeometry } from "../../shared/program-screen/lot-overlay";
import { loadOverlayDatasetView, overlayCandidates, overlayIndexPinFor } from "../../shared/program-screen/overlay-dataset";
import { bytesSha256, verifyReviewedLotEvidence, type ReviewedLotRecord } from "../../shared/program-screen/reviewed-lot";
import type { ProgramLotOverlayInputs } from "../../shared/program-screen/authority-gate";
import type { ProgramScreenResult } from "../../shared/program-screen/types";
import { mayEvaluateProgramScreen, type CaseActor } from "../cases/authorization";
import type { Bindings } from "../types";
import { openProgramScreenCaseStore, type ProgramScreenCaseEvidenceStore } from "./case-evidence";

const SOURCE_ID = "calfire-sra-fhsz-2023-09-29";
const HIGH = "high-fire-hazard-severity-zone" as const;
const VERY_HIGH = "very-high-fire-hazard-severity-zone" as const;
type HazardRoute = "prc_4202" | "gov_51178";
const routeSources = { prc_4202: SOURCE_ID, gov_51178: "calfire-lra-fhsz-2025-03-24-v1" } as const;
const SOURCE_URL = "https://osfm.fire.ca.gov/what-we-do/community-wildfire-preparedness-and-mitigation/fire-hazard-severity-zones";

export interface CaseOverlayResult {
  record: ReviewedLotRecord | null;
  computed: LotOverlayComputation;
  semantic_zone_labels: readonly string[];
  inputs: ProgramLotOverlayInputs | undefined;
  issues: readonly string[];
}

function unavailable(issue: string): CaseOverlayResult {
  return { record: null, computed: { lot_within_features: "not_established", classes_on_lot: [], candidate_records: [], issues: [issue] }, semantic_zone_labels: [], inputs: undefined, issues: [issue] };
}

interface ReviewedLotSnapshot {
  readonly revision: string;
  readonly record: ReviewedLotRecord;
  readonly geometry: ReviewedLotGeometry;
}
type SnapshotResult = { snapshot: ReviewedLotSnapshot; issue?: never } | { snapshot: null; issue: string };

function freezeReviewedRecord<T>(value: T): T {
  if (value !== null && typeof value === "object") {
    for (const child of Object.values(value)) freezeReviewedRecord(child);
    Object.freeze(value);
  }
  return value;
}

/** Verify the review and its normalized bytes once, before either route reads its source. */
async function loadReviewedLotSnapshot(store: ProgramScreenCaseEvidenceStore, asOf: string): Promise<SnapshotResult> {
  try {
    const review = await store.readReview();
    if (review === null) return { snapshot: null, issue: "No current reviewed-lot record." };
    const { record, geometry } = await verifyReviewedLotEvidence(store, review.record, asOf);
    return { snapshot: Object.freeze({ revision: review.revision, record: freezeReviewedRecord(record), geometry }) };
  } catch (error) {
    return { snapshot: null, issue: error instanceof Error ? error.message : "Case overlay evidence could not be verified." };
  }
}

/** Load only private reviewed normalized bytes and candidate records verified against the shipped pins. */
export async function loadCaseOverlay(store: ProgramScreenCaseEvidenceStore, asOf: string, registries: ProgramAuthorityRegistries = programAuthorityRegistries): Promise<CaseOverlayResult> {
  return loadCaseHazardOverlay(store, asOf, registries, SOURCE_ID, "prc_4202");
}

/** Compatible single-route loader for the registered LRA dataset. */
export async function loadCaseLraOverlay(
  store: ProgramScreenCaseEvidenceStore,
  asOf: string,
  registries: ProgramAuthorityRegistries = programAuthorityRegistries,
): Promise<CaseOverlayResult> {
  return loadCaseHazardOverlay(store, asOf, registries, routeSources.gov_51178, "gov_51178");
}

async function loadCaseHazardOverlay(
  store: ProgramScreenCaseEvidenceStore,
  asOf: string,
  registries: ProgramAuthorityRegistries,
  sourceId: string,
  route: HazardRoute,
): Promise<CaseOverlayResult> {
  try {
    if (registries !== programAuthorityRegistries && !(import.meta.env.MODE === "test" && !import.meta.env.PROD)) return unavailable("Test registry overrides cannot enter production evaluation.");
    const loaded = await loadReviewedLotSnapshot(store, asOf);
    if (loaded.snapshot === null) return unavailable(loaded.issue);
    const result = await computeRouteOverlay(store, loaded.snapshot, asOf, registries, sourceId, route);
    if (!(await store.revisionIsCurrent(loaded.snapshot.revision))) return unavailable("Reviewed lot changed while loading evidence.");
    return result;
  } catch (error) {
    return unavailable(error instanceof Error ? error.message : "Case overlay evidence could not be verified.");
  }
}

/** Route-local source failures never invalidate the other route's verified dataset. */
async function computeRouteOverlay(
  store: ProgramScreenCaseEvidenceStore,
  snapshot: ReviewedLotSnapshot,
  asOf: string,
  registries: ProgramAuthorityRegistries,
  sourceId: string,
  route: HazardRoute,
): Promise<CaseOverlayResult> {
  try {
    const { record, geometry } = snapshot;
    const source = registries.sources.find((entry) => entry.authority_source_id === sourceId);
    const pack = source?.package;
    if (source === undefined || source.superseded_by !== null || pack === undefined || pack.statutory_basis !== route ||
      (pack.statutory_basis === "prc_4202"
        ? pack.adoption.status !== "adopted"
        : pack.identification.status !== "state_identification_recommendation") || source.edition.date > asOf) return unavailable("CAL FIRE package is missing, superseded, or not applicable.");
    const dataset = pack.members.overlay_dataset;
    const pin = overlayIndexPinFor(dataset);
    if (pin === undefined) return unavailable("CAL FIRE overlay dataset is not pinned.");
    const index = await store.getOverlayIndex(pin.index_sha256);
    if (index === null) return unavailable("CAL FIRE overlay index is missing.");
    if ((await bytesSha256(index)) !== pin.index_sha256) return unavailable("CAL FIRE overlay index bytes differ from the pinned SHA-256.");
    const indexText = new TextDecoder("utf-8", { fatal: true }).decode(index);
    // Establish index integrity BEFORE it can select records to retrieve.
    const indexView = await loadOverlayDatasetView({ index_text: indexText, records: [] });
    if (indexView.crs_epsg !== 3310 || indexView.class_field !== pack.overlay.class_field || indexView.layer !== pack.overlay.dataset_name) return unavailable("CAL FIRE index CRS/layer/semantic class field differs from the package.");
    const positions = geometry.rings();
    const xs = positions.flatMap((ring) => ring.filter((_, index) => index % 2 === 0));
    const ys = positions.flatMap((ring) => ring.filter((_, index) => index % 2 === 1));
    const candidates = overlayCandidates(indexView.entries(), [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)]);
    const records: Array<{ record_number: number; content: Uint8Array }> = [];
    for (const candidate of candidates) {
      const content = await store.getOverlayRecord(candidate.content_sha256);
      if (content !== null) records.push({ record_number: candidate.record_number, content });
    }
    const view = await loadOverlayDatasetView({ index_text: indexText, records });
    const computed = computeLotOverlay(view, geometry);
    const labels = computed.classes_on_lot.map((label) => pack.overlay.class_labels[label]);
    if (labels.some((label) => label === undefined)) return unavailable(`CAL FIRE ${pack.overlay.class_field} contains an unmapped semantic label.`);
    const issues = [...computed.issues];
    if (record.legal_lot_identity !== "parcel_is_one_legal_lot") issues.push("Current one-legal-lot identity is not established.");
    if (computed.lot_within_features === "part_of_lot" || computed.lot_within_features === "none") issues.push(`Whole-lot ${route === "prc_4202" ? "SRA" : "LRA"} coverage is not established.`);
    return { record, computed, semantic_zone_labels: [...new Set(labels)].sort(), inputs: { datasets: [view], lot_geometries: [geometry] }, issues };
  } catch (error) {
    return unavailable(error instanceof Error ? error.message : "Case overlay evidence could not be verified.");
  }
}

/** Both routes retain the same frozen geometry object, even when one source is unavailable. */
export async function loadCaseHazardOverlays(
  store: ProgramScreenCaseEvidenceStore,
  asOf: string,
  registries: ProgramAuthorityRegistries = programAuthorityRegistries,
): Promise<{ prc_4202: CaseOverlayResult; gov_51178: CaseOverlayResult; snapshot: ReviewedLotSnapshot | null }> {
  const missing = (issue: string) => ({ prc_4202: unavailable(issue), gov_51178: unavailable(issue), snapshot: null });
  if (registries !== programAuthorityRegistries && !(import.meta.env.MODE === "test" && !import.meta.env.PROD)) return missing("Test registry overrides cannot enter production evaluation.");
  const loaded = await loadReviewedLotSnapshot(store, asOf);
  if (loaded.snapshot === null) return missing(loaded.issue);
  const snapshot = loaded.snapshot;
  const prc_4202 = await computeRouteOverlay(store, snapshot, asOf, registries, routeSources.prc_4202, "prc_4202");
  const gov_51178 = await computeRouteOverlay(store, snapshot, asOf, registries, routeSources.gov_51178, "gov_51178");
  try {
    if (!(await store.revisionIsCurrent(snapshot.revision))) return missing("Reviewed lot changed while loading evidence.");
  } catch (error) {
    return missing(error instanceof Error ? error.message : "Reviewed lot revision could not be verified.");
  }
  if ([prc_4202, gov_51178].some((result) => result.inputs !== undefined &&
    (result.inputs.lot_geometries.length !== 1 || result.inputs.lot_geometries[0] !== snapshot.geometry))) {
    return { prc_4202: unavailable("Hazard routes do not reference the reviewed snapshot geometry."), gov_51178: unavailable("Hazard routes do not reference the reviewed snapshot geometry."), snapshot };
  }
  return { prc_4202, gov_51178, snapshot };
}

function classValue(overlay: CaseOverlayResult, cls: "high" | "very_high"): boolean | null {
  if (overlay.record?.legal_lot_identity !== "parcel_is_one_legal_lot" || overlay.computed.lot_within_features !== "whole_lot" || overlay.semantic_zone_labels.length === 0) return null;
  if (cls === "very_high" && !overlay.semantic_zone_labels.every((label) => ["very_high", "high", "moderate", "non_wildland"].includes(label))) return null;
  if (overlay.semantic_zone_labels.every((label) => label === cls)) return true;
  return overlay.semantic_zone_labels.includes(cls) ? null : false;
}

function computedHighEvidence(overlay: CaseOverlayResult, subject: CanonicalEvidenceRecord["subject"], asOf: string): CanonicalEvidenceRecord {
  const value = classValue(overlay, "high");
  const known = value !== null;
  const spec = programFactSpecs[HIGH];
  return {
    id: `computed-calfire-high-${overlay.record?.review_id ?? "unavailable"}`,
    subject, claim: { key: HIGH, label: spec.label, client_label: spec.client_label },
    source: { agency: "CAL FIRE / Office of the State Fire Marshal", title: "Computed overlay on the reviewed CAL FIRE SRA package", description: "Derived from verified case geometry and pinned candidate records.", url: SOURCE_URL, authority: "official", retrieved_at: overlay.record?.source_provenance.retrieved_at_utc ?? `${asOf}T00:00:00Z` },
    raw_observed_value: known ? { kind: "boolean", value } : { kind: "not_observed", value: null },
    normalized_value: known ? { kind: "boolean", value } : { kind: "unknown", value: null, reason: "insufficient_evidence" },
    evidence_type: "official_map", classification: known ? "source_observation" : "unknown", confidence: known ? 100 : 0,
    conflicts_with: [], review_status: "reviewed", notes: [], limitations: [],
    provenance: { source_record_id: overlay.record?.review_id ?? "computed-overlay-unavailable", capture_method: "system_import", is_ai_generated: false },
  };
}

function computedAuthority(record: CanonicalEvidenceRecord, overlay: CaseOverlayResult, registries: ProgramAuthorityRegistries, asOf: string): ProgramEvidenceAuthority | null {
  const lot = overlay.record;
  const source = registries.sources.find((entry) => entry.authority_source_id === SOURCE_ID);
  if (lot === null || source?.package === undefined) return null;
  return {
    schema_version: PROGRAM_EVIDENCE_AUTHORITY_VERSION, evidence_id: record.id, fact_key: HIGH, record_kind: "agency_hazard_map",
    issuer: { name: "Office of the State Fire Marshal", issuer_id: "calfire-osfm" },
    source_identifier: { scheme: "authority_source_id", value: SOURCE_ID }, document_title: source.title,
    edition: { ...source.edition, currency: "current_on_as_of", currency_checked_on: asOf },
    retrieved_at: record.source.retrieved_at, source_url: record.source.url, capture: { store: "repo_official_source", ...source.capture },
    parcel_relationship: { matched_by: "spatial_overlay", parcel_identifier: lot.parcel.apn, legal_lot_reference: `Tract ${lot.legal_lot_reference.tract}, Lot ${lot.legal_lot_reference.lot}, MB ${lot.legal_lot_reference.map_book} pp ${lot.legal_lot_reference.map_pages.first}–${lot.legal_lot_reference.map_pages.last}`, legal_lot_identity: lot.legal_lot_identity },
    // Compatibility field derived only from the computed value; the authority gate
    // still verifies the actual overlay and legal-lot identity independently.
    coverage: record.normalized_value.kind === "boolean" ? record.normalized_value.value ? "whole_parcel" : "none_of_parcel" : "not_established",
    qualifiers: {
      family: "hazard_map", hazard_class: "high", statutory_basis: "prc_4202", adoption_status: "adopted", named_agency: "department_of_forestry_and_fire_protection",
      map_covers_lot: "not_established", legend_defines_class_for_lot: Object.values(source.package.overlay.class_labels).includes("high") ? "yes" : "not_established", responsibility_area_as_stated: "state",
      lot_overlay: { method: "deterministic_spatial_overlay", dataset: source.package.members.overlay_dataset, lot_geometry: { store: "case_evidence_file", file_id: lot.normalized_geometry.file.file_id, sha256: lot.normalized_geometry.file.sha256 } },
    },
    authority_review: { status: "reviewed", reviewer: lot.review.reviewer, reviewed_on: lot.review.reviewed_on }, notes: [], is_ai_generated: false,
  };
}

function computedVeryHighEvidence(overlay: CaseOverlayResult, route: HazardRoute, subject: CanonicalEvidenceRecord["subject"], asOf: string): CanonicalEvidenceRecord {
  const value = classValue(overlay, "very_high");
  const known = value !== null;
  const spec = programFactSpecs[VERY_HIGH];
  return {
    id: `computed-calfire-very-high-${route}-${overlay.record?.review_id ?? "unavailable"}`,
    subject, claim: { key: VERY_HIGH, label: spec.label, client_label: spec.client_label },
    source: { agency: "CAL FIRE / Office of the State Fire Marshal", title: `Computed overlay on the reviewed CAL FIRE ${route === "prc_4202" ? "SRA" : "LRA"} package`, description: "Derived from verified case geometry and pinned candidate records.", url: SOURCE_URL, authority: "official", retrieved_at: overlay.record?.source_provenance.retrieved_at_utc ?? `${asOf}T00:00:00Z` },
    raw_observed_value: known ? { kind: "boolean", value } : { kind: "not_observed", value: null },
    normalized_value: known ? { kind: "boolean", value } : { kind: "unknown", value: null, reason: "insufficient_evidence" },
    evidence_type: "official_map", classification: known ? "source_observation" : "unknown", confidence: known ? 100 : 0,
    conflicts_with: [], review_status: "reviewed", notes: [], limitations: [],
    provenance: { source_record_id: overlay.record?.review_id ?? "computed-overlay-unavailable", capture_method: "system_import", is_ai_generated: false },
  };
}

function computedVeryHighAuthority(record: CanonicalEvidenceRecord, overlay: CaseOverlayResult, route: HazardRoute, registries: ProgramAuthorityRegistries, asOf: string): ProgramEvidenceAuthority | null {
  const lot = overlay.record;
  const sourceId = routeSources[route];
  const source = registries.sources.find((entry) => entry.authority_source_id === sourceId);
  if (lot === null || source?.package === undefined) return null;
  return {
    schema_version: PROGRAM_EVIDENCE_AUTHORITY_VERSION, evidence_id: record.id, fact_key: VERY_HIGH, record_kind: "agency_hazard_map",
    issuer: { name: "Office of the State Fire Marshal", issuer_id: "calfire-osfm" },
    source_identifier: { scheme: "authority_source_id", value: sourceId }, document_title: source.title,
    edition: { ...source.edition, currency: "current_on_as_of", currency_checked_on: asOf },
    retrieved_at: record.source.retrieved_at, source_url: record.source.url, capture: { store: "repo_official_source", ...source.capture },
    parcel_relationship: { matched_by: "spatial_overlay", parcel_identifier: lot.parcel.apn, legal_lot_reference: `Tract ${lot.legal_lot_reference.tract}, Lot ${lot.legal_lot_reference.lot}, MB ${lot.legal_lot_reference.map_book} pp ${lot.legal_lot_reference.map_pages.first}–${lot.legal_lot_reference.map_pages.last}`, legal_lot_identity: lot.legal_lot_identity },
    coverage: record.normalized_value.kind === "boolean" ? record.normalized_value.value ? "whole_parcel" : "none_of_parcel" : "not_established",
    qualifiers: {
      family: "hazard_map", hazard_class: "very_high", statutory_basis: route, adoption_status: route === "prc_4202" ? "adopted" : "not_established", named_agency: "department_of_forestry_and_fire_protection",
      map_covers_lot: "not_established", legend_defines_class_for_lot: Object.values(source.package.overlay.class_labels).includes("very_high") ? "yes" : "not_established", responsibility_area_as_stated: route === "prc_4202" ? "state" : "local",
      lot_overlay: { method: "deterministic_spatial_overlay", dataset: source.package.members.overlay_dataset, lot_geometry: { store: "case_evidence_file", file_id: lot.normalized_geometry.file.file_id, sha256: lot.normalized_geometry.file.sha256 } },
    },
    authority_review: { status: "reviewed", reviewer: lot.review.reviewer, reviewed_on: lot.review.reviewed_on }, notes: [], is_ai_generated: false,
  };
}

interface StoredCaseProgramScreenResult {
  overlay: CaseOverlayResult;
  route_overlays: { gov_51178: CaseOverlayResult; prc_4202: CaseOverlayResult };
  screen: ProgramScreenResult;
}

/** Sanitized reviewed-lot fields that may leave the worker: no parcel, legal-lot reference, reviewer, file or hash values. */
export interface ReviewedLotSummary {
  readonly review_id: string;
  readonly reviewed_on: string;
  readonly next_review_on: string;
  readonly legal_lot_identity: ReviewedLotRecord["legal_lot_identity"];
}

export interface CaseProgramScreenEvaluation extends StoredCaseProgramScreenResult {
  /** Present only when the verified reviewed-lot snapshot survived the whole evaluation. */
  reviewed_lot: ReviewedLotSummary | null;
}

type StoredCaseInput = { evidence_records: readonly CanonicalEvidenceRecord[]; evidence_authority?: unknown; as_of: string };

function reviewedLotSummary(snapshot: ReviewedLotSnapshot | null): ReviewedLotSummary | null {
  if (snapshot === null) return null;
  const { review_id, review, legal_lot_identity } = snapshot.record;
  return Object.freeze({ review_id, reviewed_on: review.reviewed_on, next_review_on: review.next_review_on, legal_lot_identity });
}

/** Shared evaluation body. Every caller binds `subject` to the authorized store before reaching it. */
async function evaluateStoredCaseForSubject(
  store: ProgramScreenCaseEvidenceStore,
  subject: CanonicalEvidenceRecord["subject"],
  input: StoredCaseInput,
  registries: ProgramAuthorityRegistries,
): Promise<{ result: StoredCaseProgramScreenResult; reviewed_lot: ReviewedLotSummary | null }> {
  if (registries !== programAuthorityRegistries && !(import.meta.env.MODE === "test" && !import.meta.env.PROD)) throw new Error("Test registry overrides cannot enter production evaluation.");
  if (subject.case_id !== store.case_id) throw new Error("Program Screen evidence must belong to the authorized case.");
  const routes = await loadCaseHazardOverlays(store, input.as_of, registries);
  const overlay = routes.prc_4202;
  const evidence = computedHighEvidence(overlay, subject, input.as_of);
  const veryHighLra = computedVeryHighEvidence(routes.gov_51178, "gov_51178", subject, input.as_of);
  const veryHighSra = computedVeryHighEvidence(overlay, "prc_4202", subject, input.as_of);
  const existing = [...parseProgramEvidenceAuthority(input.evidence_authority, input.evidence_records).values()].filter((block) => block.qualifiers?.family !== "hazard_map");
  const block = computedAuthority(evidence, overlay, registries, input.as_of);
  const hazardBlocks = [block, computedVeryHighAuthority(veryHighLra, routes.gov_51178, "gov_51178", registries, input.as_of), computedVeryHighAuthority(veryHighSra, overlay, "prc_4202", registries, input.as_of)].filter((entry): entry is ProgramEvidenceAuthority => entry !== null);
  const lot_overlay = routes.snapshot === null ? undefined : {
    datasets: [routes.gov_51178, overlay].flatMap((result) => result.inputs?.datasets ?? []),
    lot_geometries: [routes.snapshot.geometry],
  };
  const screen = evaluateProgramScreen({
    evidence_records: [...input.evidence_records, evidence, veryHighLra, veryHighSra], evidence_authority: [...existing, ...hazardBlocks],
    as_of: input.as_of, authority_registries: registries, lot_overlay,
  });
  return { result: { overlay, route_overlays: { gov_51178: routes.gov_51178, prc_4202: overlay }, screen }, reviewed_lot: reviewedLotSummary(routes.snapshot) };
}

/**
 * Server ingestion/evaluation boundary. Typed hazard values remain observations for conflict
 * detection; only server-computed records receive hazard authority blocks.
 * No typed classes_on_lot, coverage attestation, registry override, or reprojection input is accepted.
 */
export async function evaluateStoredCaseProgramScreen(store: ProgramScreenCaseEvidenceStore, input: {
  evidence_records: readonly CanonicalEvidenceRecord[]; evidence_authority?: unknown; as_of: string;
}, registries: ProgramAuthorityRegistries = programAuthorityRegistries): Promise<StoredCaseProgramScreenResult> {
  if (registries !== programAuthorityRegistries && !(import.meta.env.MODE === "test" && !import.meta.env.PROD)) throw new Error("Test registry overrides cannot enter production evaluation.");
  const subject = input.evidence_records[0]?.subject;
  if (subject === undefined || input.evidence_records.some((record) => record.subject.case_id !== store.case_id)) throw new Error("Program Screen evidence must belong to the authorized case.");
  if (input.evidence_records.some((record) => record.id.startsWith("computed-calfire-"))) throw new Error("Computed hazard evidence ID is reserved.");
  return (await evaluateStoredCaseForSubject(store, subject, input, registries)).result;
}

/**
 * Production entry point (Phase 3J): an administrator evaluates an already-prepared case read-only.
 * The server supplies the subject and the date. No caller evidence, authority, subject, registry,
 * pack, lot overlay or review revision can be passed; only server-computed records are evaluated.
 */
export async function evaluateCaseProgramScreen(bindings: Pick<Bindings, "DB" | "EVIDENCE_FILES">, actor: CaseActor, caseId: string, asOf: string): Promise<CaseProgramScreenEvaluation> {
  if (!mayEvaluateProgramScreen(actor)) throw new Error("Program Screen evaluation permission denied.");
  if (!isIsoCalendarDate(asOf)) throw new Error("Program Screen evaluation requires the server calendar date.");
  const store = await openProgramScreenCaseStore(bindings, actor, caseId, "read");
  const subject = Object.freeze({ case_id: store.case_id, property_id: null });
  const { result, reviewed_lot } = await evaluateStoredCaseForSubject(store, subject, { evidence_records: [], as_of: asOf }, programAuthorityRegistries);
  return { ...result, reviewed_lot };
}
