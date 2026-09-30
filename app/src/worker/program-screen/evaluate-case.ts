import type { CanonicalEvidenceRecord } from "../../shared/build-week-integrity/types";
import { programAuthorityRegistries, type ProgramAuthorityRegistries } from "../../shared/program-screen/authority-policy";
import { parseProgramEvidenceAuthority, PROGRAM_EVIDENCE_AUTHORITY_VERSION, type ProgramEvidenceAuthority } from "../../shared/program-screen/evidence-authority";
import { evaluateProgramScreen } from "../../shared/program-screen/evaluate";
import { programFactSpecs } from "../../shared/program-screen/facts";
import { computeLotOverlay, type LotOverlayComputation } from "../../shared/program-screen/lot-overlay";
import { loadOverlayDatasetView, overlayCandidates, overlayIndexPinFor } from "../../shared/program-screen/overlay-dataset";
import { bytesSha256, verifyReviewedLotEvidence, type ReviewedLotRecord } from "../../shared/program-screen/reviewed-lot";
import type { ProgramLotOverlayInputs } from "../../shared/program-screen/authority-gate";
import type { ProgramScreenResult } from "../../shared/program-screen/types";
import type { CaseActor } from "../cases/authorization";
import type { Bindings } from "../types";
import { openProgramScreenCaseStore, type ProgramScreenCaseEvidenceStore } from "./case-evidence";

const SOURCE_ID = "calfire-sra-fhsz-2023-09-29";
const HIGH = "high-fire-hazard-severity-zone" as const;
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

/** Load only private reviewed normalized bytes and candidate records verified against the shipped pins. */
export async function loadCaseOverlay(store: ProgramScreenCaseEvidenceStore, asOf: string, registries: ProgramAuthorityRegistries = programAuthorityRegistries): Promise<CaseOverlayResult> {
  return loadCaseHazardOverlay(store, asOf, registries, SOURCE_ID, "prc_4202");
}

/** Route 1 infrastructure only. Criterion c remains pending; the Phase 3F d
 * evaluator continues to use its independently assessed SRA input. */
export async function loadCaseLraOverlay(
  store: ProgramScreenCaseEvidenceStore,
  asOf: string,
  registries: ProgramAuthorityRegistries = programAuthorityRegistries,
): Promise<CaseOverlayResult> {
  return loadCaseHazardOverlay(store, asOf, registries, "calfire-lra-fhsz-2025-03-24-v1", "gov_51178");
}

async function loadCaseHazardOverlay(
  store: ProgramScreenCaseEvidenceStore,
  asOf: string,
  registries: ProgramAuthorityRegistries,
  sourceId: string,
  route: "prc_4202" | "gov_51178",
): Promise<CaseOverlayResult> {
  try {
    if (registries !== programAuthorityRegistries && !(import.meta.env.MODE === "test" && !import.meta.env.PROD)) return unavailable("Test registry overrides cannot enter production evaluation.");
    const snapshot = await store.readReview();
    if (snapshot === null) return unavailable("No current reviewed-lot record.");
    const { record, geometry } = await verifyReviewedLotEvidence(store, snapshot.record, asOf);
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
    if (!(await store.revisionIsCurrent(snapshot.revision))) return unavailable("Reviewed lot changed while loading evidence.");
    const issues = [...computed.issues];
    if (record.legal_lot_identity !== "parcel_is_one_legal_lot") issues.push("Current one-legal-lot identity is not established.");
    if (computed.lot_within_features === "part_of_lot" || computed.lot_within_features === "none") issues.push(`Whole-lot ${route === "prc_4202" ? "SRA" : "LRA"} coverage is not established.`);
    return { record, computed, semantic_zone_labels: [...new Set(labels)].sort(), inputs: { datasets: [view], lot_geometries: [geometry] }, issues };
  } catch (error) {
    return unavailable(error instanceof Error ? error.message : "Case overlay evidence could not be verified.");
  }
}

function highValue(overlay: CaseOverlayResult): boolean | null {
  if (overlay.record?.legal_lot_identity !== "parcel_is_one_legal_lot" || overlay.computed.lot_within_features !== "whole_lot" || overlay.semantic_zone_labels.length === 0) return null;
  if (overlay.semantic_zone_labels.every((label) => label === "high")) return true;
  return overlay.semantic_zone_labels.includes("high") ? null : false;
}

function computedHighEvidence(overlay: CaseOverlayResult, subject: CanonicalEvidenceRecord["subject"], asOf: string): CanonicalEvidenceRecord {
  const value = highValue(overlay);
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

/**
 * Server ingestion/evaluation boundary. Typed hazard values remain observations for conflict
 * detection; only the server-computed record receives a hazard authority block.
 * No typed classes_on_lot, coverage attestation, registry override, or reprojection input is accepted.
 */
export async function evaluateStoredCaseProgramScreen(store: ProgramScreenCaseEvidenceStore, input: {
  evidence_records: readonly CanonicalEvidenceRecord[]; evidence_authority?: unknown; as_of: string;
}, registries: ProgramAuthorityRegistries = programAuthorityRegistries): Promise<{ overlay: CaseOverlayResult; screen: ProgramScreenResult }> {
  if (registries !== programAuthorityRegistries && !(import.meta.env.MODE === "test" && !import.meta.env.PROD)) throw new Error("Test registry overrides cannot enter production evaluation.");
  const subject = input.evidence_records[0]?.subject;
  if (subject === undefined || input.evidence_records.some((record) => record.subject.case_id !== store.case_id)) throw new Error("Program Screen evidence must belong to the authorized case.");
  const overlay = await loadCaseOverlay(store, input.as_of, registries);
  const evidence = computedHighEvidence(overlay, subject, input.as_of);
  if (input.evidence_records.some((record) => record.id === evidence.id)) throw new Error("Computed hazard evidence ID is reserved.");
  const existing = [...parseProgramEvidenceAuthority(input.evidence_authority, input.evidence_records).values()].filter((block) => block.qualifiers?.family !== "hazard_map");
  const block = computedAuthority(evidence, overlay, registries, input.as_of);
  const screen = evaluateProgramScreen({
    evidence_records: [...input.evidence_records, evidence], evidence_authority: [...existing, ...(block === null ? [] : [block])],
    as_of: input.as_of, authority_registries: registries, lot_overlay: overlay.inputs,
  });
  return { overlay, screen };
}

/** Production entry point: authorize against the existing private case boundary before reading files. */
export async function evaluateCaseProgramScreen(bindings: Pick<Bindings, "DB" | "EVIDENCE_FILES">, actor: CaseActor, caseId: string, input: Parameters<typeof evaluateStoredCaseProgramScreen>[1]): Promise<{ overlay: CaseOverlayResult; screen: ProgramScreenResult }> {
  return evaluateStoredCaseProgramScreen(await openProgramScreenCaseStore(bindings, actor, caseId), input);
}
