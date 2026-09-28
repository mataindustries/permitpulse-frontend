import type { CanonicalEvidenceRecord } from "../build-week-integrity/types";
import type {
  EnforcedAuthorityRequirement,
  ProgramAuthorityRegistries,
  ProgramFactAuthorityEstablishingEntry,
  ProgramFactAuthorityPolicy,
} from "./authority-policy";
import {
  authorityRecordFailureCodes,
  daysBetween,
  type AuthorityQualifiers,
  type AuthorityRecordFailureCode,
  type ProgramCriterionAuthorityResult,
  type ProgramEvidenceAuthority,
  type ProgramFactAuthorityResult,
} from "./evidence-authority";
import type { KnownFactValue, ProgramCriterion, ProgramFactAssessment, ProgramFactKey } from "./types";

/**
 * The evidence-authority gate (Layer 2).
 *
 * Layer 1, the canonical fact assessment, is unchanged: every record takes
 * part in conflict detection whatever its authority (D4). The gate runs only
 * for a criterion with an enforced authority requirement, and only after
 * every earlier status check passed (D2), so each fact it sees is
 * established, reviewed, and free of conflict. It asks one question per
 * fact: does at least one record carrying the recorded value establish it
 * under the registries? It never reads free text, never changes a fact, and
 * can only leave the criterion `unknown` (D3).
 */

export interface ProgramAuthorityContext {
  registries: ProgramAuthorityRegistries;
  /** Authority blocks keyed by evidence_id. A record without one is unattested. */
  blocks: ReadonlyMap<string, ProgramEvidenceAuthority>;
  records: readonly CanonicalEvidenceRecord[];
}

/**
 * The nine zones SHRA memo FAQ Q.1 lists as zoned for single-family
 * residential development. Used only as an exact-match tripwire that can
 * refuse (D6): zoning strings are never parsed or normalized.
 */
export const shraMemoSingleFamilyZones: readonly string[] = ["A1", "A2", "RA", "RE", "RS", "R1", "RU", "RZ", "RW1"];

function valueToken(value: KnownFactValue): string {
  if (value.kind === "boolean") return value.value ? "true" : "false";
  if (value.kind === "number") return "number";
  return value.value;
}

function sameKnownValue(record: CanonicalEvidenceRecord, value: KnownFactValue): boolean {
  const own = record.normalized_value;
  if (own.kind !== value.kind) return false;
  if (own.kind === "number" && value.kind === "number") return own.value === value.value && own.unit === value.unit;
  return own.value === value.value;
}

function isComparable(record: CanonicalEvidenceRecord): boolean {
  return (
    (record.classification === "verified_fact" || record.classification === "source_observation") &&
    record.normalized_value.kind !== "unknown" &&
    record.normalized_value.kind !== "unresolved"
  );
}

function dateOf(timestamp: string): string {
  return timestamp.slice(0, 10);
}

/** A check made on `asOf` that is not after it and not older than the window. */
function checkedWithin(checkedOn: string | null, asOf: string, maxAgeDays: number | null): boolean {
  if (checkedOn === null || checkedOn > asOf) return false;
  return maxAgeDays === null || daysBetween(checkedOn, asOf) <= maxAgeDays;
}

function identityFailures(
  entry: ProgramFactAuthorityEstablishingEntry,
  block: ProgramEvidenceAuthority,
  key: ProgramFactKey,
  registries: ProgramAuthorityRegistries,
): AuthorityRecordFailureCode[] {
  if (entry.identity === "registered_authority_source") {
    const id = block.source_identifier.value;
    const source =
      block.source_identifier.scheme === "authority_source_id" && entry.authority_source_ids.includes(id)
        ? registries.sources.find((candidate) => candidate.authority_source_id === id)
        : undefined;
    if (
      source === undefined ||
      source.record_kind !== block.record_kind ||
      source.issuer_id !== block.issuer.issuer_id ||
      !source.fact_keys.includes(key) ||
      source.superseded_by !== null ||
      source.edition.date !== block.edition.date
    ) {
      return ["authority_source_not_registered"];
    }
    const capture = block.capture;
    return capture?.store === "repo_official_source" &&
      capture.source_id === source.capture.source_id &&
      capture.sha256_extracted === source.capture.sha256_extracted
      ? []
      : ["capture_not_verified"];
  }

  const failures: AuthorityRecordFailureCode[] = [];
  if (!["recorder_document_number", "map_book_page", "city_case_number"].includes(block.source_identifier.scheme)) {
    failures.push("record_identity_incomplete");
  }
  // D10: a parcel's own instrument or map is verified against the
  // case-scoped private evidence store, never a public repo capture. That
  // store is not built yet, so no instrument identity can establish a fact.
  failures.push("capture_not_verified");
  return failures;
}

function familyFailures(
  policy: ProgramFactAuthorityPolicy,
  qualifiers: AuthorityQualifiers | null,
  value: KnownFactValue,
  entry: ProgramFactAuthorityEstablishingEntry | undefined,
  asOf: string,
): AuthorityRecordFailureCode[] {
  const family = policy.family_policy;
  if (family === null || qualifiers === null || family.family !== qualifiers.family) return [];
  const failures: AuthorityRecordFailureCode[] = [];
  const token = valueToken(value);

  if (family.family === "lot_area" && qualifiers.family === "lot_area") {
    if (!family.accepted_area_bases.includes(qualifiers.area_basis)) failures.push("lot_area_basis_not_accepted");
    // D5: only an exact area can be compared with the threshold.
    if (qualifiers.area_precision !== "exact") failures.push("lot_area_not_exact");
  }

  if (family.family === "zone_record" && qualifiers.family === "zone_record") {
    const listed = shraMemoSingleFamilyZones.includes(qualifiers.base_zone_as_recorded);
    if (token === "single_family_listed_zone" && !listed) failures.push("zone_tripwire_refused");
    if (token === "zone_not_on_single_family_list" && listed) failures.push("zone_tripwire_refused");
  }

  if (family.family === "map_history" && qualifiers.family === "map_history") {
    const { search, maps } = qualifiers;
    if (
      search.scope !== "complete_reviewed_history" ||
      family.required_search_repositories.length === 0 ||
      !family.required_search_repositories.every((repository) => search.repositories_searched.includes(repository)) ||
      !checkedWithin(search.searched_on, asOf, family.search_max_age_days) ||
      family.search_max_age_days === null
    ) {
      failures.push("map_search_incomplete");
    }
    if (
      maps.some(
        (map) => map.statute_basis === "not_established" || map.recording === "not_established" || map.relation === "not_established",
      )
    ) {
      failures.push("map_history_not_established");
    }
    const shraOrSb9 = maps.filter((map) => map.statute_basis === "shra" || map.statute_basis === "sb9_2021");
    if (shraOrSb9.length > 0 && qualifiers.lineage_changed_after_shra_or_sb9_map !== "no") {
      failures.push("map_lineage_uncertain");
    }
    const recordedPursuant = (statute: "shra" | "sb9_2021") =>
      maps.some(
        (map) =>
          map.stage === "final" &&
          map.recording === "recorded" &&
          map.statute_basis === statute &&
          map.relation === "screened_lot_recorded_pursuant",
      );
    const supported =
      token === "shra_map_recorded"
        ? recordedPursuant("shra")
        : token === "sb9_map_recorded"
          ? recordedPursuant("sb9_2021")
          : token === "other_basis_map_recorded"
            ? shraOrSb9.length === 0 && maps.some((map) => map.recording === "recorded" && map.statute_basis === "other_statute")
            : token === "no_map_recorded"
              ? shraOrSb9.length === 0 && maps.every((map) => map.recording !== "recorded")
              : token === "shra_or_sb9_tentative_map_not_recorded"
                ? shraOrSb9.some((map) => map.stage === "tentative" && map.recording === "never_recorded") &&
                  !shraOrSb9.some((map) => map.recording === "recorded")
                : false;
    if (!supported) failures.push("map_history_does_not_support_value");
  }

  if (family.family === "hazard_map" && qualifiers.family === "hazard_map") {
    if (qualifiers.parcel_responsibility_area === "not_established" || qualifiers.map_covers_that_area !== "yes") {
      failures.push("hazard_area_not_covered");
    }
    if (family.require_legend_class && qualifiers.legend_defines_class_for_area !== "yes") {
      failures.push("hazard_legend_class_not_defined");
    }
  }

  if (family.family === "adopted_plan" && qualifiers.family === "adopted_plan") {
    if (
      qualifiers.adoption_status !== "adopted_in_effect" ||
      !checkedWithin(qualifiers.status_checked_on, asOf, entry?.currency_max_age_days ?? null)
    ) {
      failures.push("plan_not_adopted_in_effect");
    }
    if (qualifiers.identification_basis !== "explicit_plan_language_or_map") {
      failures.push("plan_identification_not_explicit");
    }
    if (
      qualifiers.adoption_reference === null ||
      qualifiers.adoption_date === null ||
      qualifiers.adoption_date > asOf ||
      qualifiers.map_or_text_reference === null
    ) {
      failures.push("plan_reference_incomplete");
    }
  }

  if (family.family === "recorded_instrument" && qualifiers.family === "recorded_instrument") {
    if (qualifiers.document_number === null || qualifiers.recording_date === null || qualifiers.recording_date > asOf) {
      failures.push("record_identity_incomplete");
    }
    if (qualifiers.instrument_character !== "expressly_conservation_easement") failures.push("instrument_not_express");
    if (qualifiers.in_force !== "no_release_or_extinguishment_of_record") failures.push("instrument_not_in_force");
    const releaseSearch = qualifiers.release_search;
    if (
      releaseSearch.scope !== "complete_reviewed_history" ||
      family.required_release_search_repositories.length === 0 ||
      !family.required_release_search_repositories.every((repository) =>
        releaseSearch.repositories_searched.includes(repository),
      ) ||
      !checkedWithin(releaseSearch.searched_on, asOf, null)
    ) {
      failures.push("instrument_release_search_incomplete");
    }
  }
  return failures;
}

/** Every reason one record cannot establish `value` for `key`. Empty: it establishes it. */
function recordAuthorityFailures(input: {
  key: ProgramFactKey;
  value: KnownFactValue;
  record: CanonicalEvidenceRecord;
  block: ProgramEvidenceAuthority | undefined;
  policy: ProgramFactAuthorityPolicy | undefined;
  registries: ProgramAuthorityRegistries;
  asOf: string;
}): AuthorityRecordFailureCode[] {
  const { key, value, record, block, policy, registries, asOf } = input;
  if (block === undefined) return ["no_authority_block"];
  const failures = new Set<AuthorityRecordFailureCode>();
  const token = valueToken(value);

  if (record.source.authority !== "official") failures.add("source_not_official");

  // The declared kind only selects which entries could apply; it never
  // authorizes anything by itself.
  let matched: ProgramFactAuthorityEstablishingEntry | undefined;
  if (policy === undefined) {
    failures.add("record_kind_not_establishing");
  } else {
    if (policy.prohibited_establishing_kinds.includes(block.record_kind)) failures.add("record_kind_prohibited_for_fact");
    const byKind = policy.establishing.filter((entry) => entry.record_kind === block.record_kind);
    const byValue = byKind.filter((entry) => entry.values.includes(token));
    const issuerId = block.issuer.issuer_id;
    const byIssuer = byValue.filter(
      (entry) =>
        issuerId !== null &&
        entry.issuer_ids.includes(issuerId) &&
        registries.issuers.some((issuer) => issuer.issuer_id === issuerId),
    );
    if (byKind.length === 0) failures.add("record_kind_not_establishing");
    else if (byValue.length === 0) failures.add("value_not_establishable");
    else if (byIssuer.length === 0) failures.add("issuer_not_registered");
    else {
      const identities = byIssuer.map((entry) => ({ entry, failures: identityFailures(entry, block, key, registries) }));
      const passing = identities.find((candidate) => candidate.failures.length === 0);
      if (passing !== undefined) matched = passing.entry;
      else identities[0].failures.forEach((failure) => failures.add(failure));
    }
  }

  const review = block.authority_review;
  if (review.status !== "reviewed" || review.reviewer?.kind !== "human" || review.reviewed_on === null || review.reviewed_on > asOf) {
    failures.add("authority_review_incomplete");
  }
  if (dateOf(record.source.retrieved_at) > asOf) failures.add("retrieved_after_as_of");
  if (block.edition.date === null || block.edition.date_kind === null || block.edition.date > asOf) {
    failures.add("edition_not_established");
  }
  if (
    block.edition.currency !== "current_on_as_of" ||
    !checkedWithin(block.edition.currency_checked_on, asOf, matched?.currency_max_age_days ?? null)
  ) {
    failures.add("edition_not_current");
  }
  if (block.parcel_relationship.matched_by === "address_only" || block.parcel_relationship.matched_by === "not_established") {
    failures.add("parcel_match_not_established");
  }
  if (policy?.requires_legal_lot_identity && block.parcel_relationship.legal_lot_identity !== "parcel_is_one_legal_lot") {
    failures.add("legal_lot_identity_not_established");
  }
  if (policy !== undefined) {
    familyFailures(policy, block.qualifiers, value, matched, asOf).forEach((failure) => failures.add(failure));
  }
  return authorityRecordFailureCodes.filter((code) => failures.has(code));
}

function factAuthority(
  fact: ProgramFactAssessment,
  context: ProgramAuthorityContext,
  asOf: string,
): ProgramFactAuthorityResult {
  const policy = context.registries.fact_policies[fact.key];
  const value = fact.normalized_value as KnownFactValue;
  const candidates = context.records
    .filter((record) => record.claim.key === fact.key && isComparable(record) && sameKnownValue(record, value))
    .sort((left, right) => left.id.localeCompare(right.id));

  const establishing: string[] = [];
  const nonEstablishing: ProgramFactAuthorityResult["non_establishing"] = [];
  for (const record of candidates) {
    const failures = recordAuthorityFailures({
      key: fact.key,
      value,
      record,
      block: context.blocks.get(record.id),
      policy,
      registries: context.registries,
      asOf,
    });
    if (failures.length === 0) establishing.push(record.id);
    else nonEstablishing.push({ evidence_id: record.id, failures });
  }

  const failures: ProgramFactAuthorityResult["failures"] = [];
  if (policy === undefined) failures.push("no_fact_policy");
  else if (policy.establishing.length === 0) failures.push("no_establishing_entries");
  if (establishing.length === 0) failures.push("no_establishing_record");
  return {
    key: fact.key,
    established: establishing.length > 0,
    establishing_evidence_ids: establishing,
    non_establishing: nonEstablishing,
    failures,
  };
}

/**
 * Evaluates an enforced authority requirement for a criterion whose facts
 * are all established and reviewed. `established: false` means the
 * criterion must stay `unknown`.
 */
export function evaluateCriterionAuthority(input: {
  criterion: ProgramCriterion;
  requirement: EnforcedAuthorityRequirement;
  facts: readonly ProgramFactAssessment[];
  context: ProgramAuthorityContext;
  asOf: string;
}): ProgramCriterionAuthorityResult {
  const { criterion, requirement, facts, context, asOf } = input;
  const factResults = facts.map((fact) => factAuthority(fact, context, asOf));
  const criterionFailures: ProgramCriterionAuthorityResult["criterion_failures"] = [];

  for (const precondition of requirement.scope_preconditions) {
    const fact = criterion.fact_keys.includes(precondition.fact_key)
      ? facts.find((candidate) => candidate.key === precondition.fact_key)
      : undefined;
    if (fact === undefined) {
      criterionFailures.push({ code: "requirement_fact_not_read", fact_key: precondition.fact_key });
      continue;
    }
    const value = fact.normalized_value;
    const holds =
      (value.kind === "boolean" || value.kind === "text") && value.value === precondition.must_equal;
    if (!holds) criterionFailures.push({ code: "scope_precondition_not_met", fact_key: precondition.fact_key });
  }
  for (const boundary of requirement.numeric_boundaries) {
    if (!criterion.fact_keys.includes(boundary.fact_key)) {
      criterionFailures.push({ code: "requirement_fact_not_read", fact_key: boundary.fact_key });
    }
  }

  return {
    established: factResults.every((result) => result.established) && criterionFailures.length === 0,
    facts: factResults,
    criterion_failures: criterionFailures,
  };
}
