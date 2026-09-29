# Program Screen Phase 3B: statute-triggered re-review decisions for c–g

Decided 2026-09-28 by **Sergio Mata, Project Owner / Human Reviewer**. Machine-readable twin: `app/fixtures/program-screen/human-review-rounds/phase-3b-rereview-decisions.json`.

Phase 3B is the human re-review triggered by the capture of GOV § 66499.41 (`gcs_66499_41_a_9_captured`, Phase 3A). The reviewer re-reviewed Round 1 decisions c, d, e, f, and g one at a time. The only sources used were:

- the captured SHRA memo (`shra-2025-10-28`);
- the captured statute (`gcs-66499-41`);
- the Round 1 decisions;
- the Phase 3A re-review memo (`docs/PROGRAM_SCREEN_PHASE_3A_GCS_66499_41_A_9_REVIEW.md`).

This file records the decisions. It changes nothing in production.

- **Nothing is promoted.** `human_verified` = 0 and `pending_human` = 46. Every c–g criterion stays `pending_human`, with no encoded rule and the same outcome ceiling.
- **Round 1 history is kept.** Each decision here supersedes the rule text of the Round 1 decision with the same letter. `round-1-decisions.json`, `round-1.json`, and both Round 1 documents are unedited.
- **Recording only.** Nothing else changes: no evaluator logic, fact, criterion, authority policy, client label, or capture. No issuer or authority source is registered, and the evaluator and public-demo output hashes are unchanged.
- **New gates are recorded here, not wired.** The authority registry still requires exactly the Round 1 gates, so it never requires less than these decisions do. A later reviewed change wires each new gate (see [Gate wiring](#gate-wiring)).

Tests: `app/tests/program-screen-rereview-3b.test.ts`.

## Outcome

| | Criterion | Round 1 | Phase 3B | Tier after re-review |
| --- | --- | --- | --- | --- |
| c | `la_shra.very-high-fire-hazard-severity-zone` | approve_with_revision | APPROVE REVISED RULE | Gated |
| d | `la_shra.high-fire-hazard-severity-zone` | approve_with_revision | APPROVE REVISED RULE | Gated |
| e | `la_shra.prime-or-statewide-farmland` | keep_pending | APPROVE REVISED RULE (candidate rule) | Pending source capture |
| f | `la_shra.natural-community-conservation-plan-land` | approve_with_revision | APPROVE REVISED RULE | Gated |
| g | `la_shra.conservation-easement` | approve_with_revision | APPROVE REVISED RULE | Gated |

SHRA pathway completeness blockers G1 and G2 are open (see [below](#shra-pathway-completeness-blockers)).

## How to read this record

- **Decision (verbatim)** is the reviewer's reply exactly as given, including the process instructions in it.
- **Rule as decided** is the proposal the reviewer reviewed, numbered as reviewed, with the reviewer's corrections and the confirmations below applied. Where the two differ, the verbatim texts govern.
- Every rule uses the common terms below.

## Terms used in every rule

```text
The lot means the lot proposed to be subdivided. Every rule measures coverage against the whole lot proposed to be subdivided.
Lot identity rule: if APN/parcel and legal-lot identity are unclear, the result is unknown.
Non-qualifying record: a record that cannot establish the fact. On its own, the authority gate returns unknown. Where it disagrees with another known-value record, existing Layer 1 conflict detection decides. There is no special conflict rule, and the authority gate does not manufacture conflict.
```

## Confirmations (verbatim)

After the five decisions, the reviewer confirmed the consolidated record with these answers:

```text
Confirmations:
1. c point 2: REWORD. Use the same semantics as the approved d correction: “A non-qualifying record cannot establish the fact. Alone, the authority gate returns unknown. Disagreement between known-value records is handled by existing Layer 1 conflict detection. The authority gate does not manufacture conflict.”
2. d label: ADD. Add deferred high_fire_client_label. The eventual client-facing label should not imply that “state or local responsibility area” is part of the deterministic d rule.
3. c route gate: ACCEPT. Record statutory_routes_assessed_separately as a Phase 3C promotion gate. Do not change the approved c rule. Until route-separated assessment is implemented and fail-closed, c remains pending_human and cannot be promoted.
Date correction: record the Phase 3B human-review decision date as 2026-09-28, not 2026-09-29.
G1 and G2 remain SHRA pathway completeness blockers exactly as proposed.
```

Their effects on this record:

- c point 2 uses the confirmed wording.
- d gains the deferred change `high_fire_client_label`.
- c gains the promotion gate `statutory_routes_assessed_separately`. The c rule itself does not change for it.
- The decision date is 2026-09-28.

## c. `la_shra.very-high-fire-hazard-severity-zone`: APPROVE REVISED RULE

Supersedes the rule text of Round 1 decision c (approve_with_revision).

Decision (verbatim):

```text
APPROVE REVISED RULE, with one terminology revision:
Wherever the rule says “whole parcel,” use “whole lot proposed to be subdivided.”
If the parcel/APN and the legal lot proposed to be subdivided are not clearly the same unit, return unknown.
I approve points 1–8 with that correction.
Keep c pending_human.
Preserve all listed gates, including the need to distinguish the two statutory routes and the fail-closed rule that a NO under only one route cannot clear the criterion.
Do not edit files yet. Continue to criterion d.
```

Rule as decided:

```text
1. Scope: Very High only. A High class on any record, including a PRC §4202 map, never establishes c. High stays d.
2. Qualifying records. A record counts toward a route only if it names CAL FIRE (the Department of Forestry and Fire Protection) as the agency and that route's section as its basis. Route 1: a Very High zone “as determined” by CAL FIRE under GOV §51178. Route 2: a Very High zone on a map adopted by CAL FIRE under PRC §4202. Any other record, City/ZIMAS included, may only corroborate. “A non-qualifying record cannot establish the fact. Alone, the authority gate returns unknown. Disagreement between known-value records is handled by existing Layer 1 conflict detection. The authority gate does not manufacture conflict.”
3. YES → disqualifying_per_source when a qualifying record under either route shows the whole lot proposed to be subdivided inside a Very High zone. A negative under one route never cancels a YES under the other.
4. Partial coverage → unknown / requires_judgment, judged separately for each route. Partial coverage under Route 1 is not added to partial coverage under Route 2. No overlap threshold.
5. NO → consistent_with_source only when qualifying records under both routes each show no part of the lot in a Very High zone. A negative under one route alone gives unknown. There is no "only one route applies here" shortcut unless a later captured, reviewed source supports it.
6. Required fields: agency, route (statutory basis), record identity, and edition or effective date (adoption date for Route 2). If any is missing, the result is unknown.
7. Responsibility areas: footnote 1 stays as memo context. Responsibility area is never used to pick or rule out a route.
8. The lot identity rule applies. Ceiling unchanged.
```

**Status after re-review:** `pending_human`. Gated: stays `pending_human` until the gates below can be enforced in code or fail closed.

**Before `human_verified`** (★ = recorded here, not yet wired into the authority registry):

- `evidence_provenance_enforced_or_fails_closed`
- `map_identity_and_edition_recorded`
- ★ `statutory_route_recorded`
- ★ `statutory_routes_assessed_separately`
- ★ `legal_lot_identity_fails_closed`
- `reviewer_confirms_encoded_rule`
- `human_verification_record`

**Deferred to a later reviewed change:**

- `very_high_fire_client_label`: Round 1: reword the Very High fact's client label to name the Very High Fire Hazard Severity Zone.

## d. `la_shra.high-fire-hazard-severity-zone`: APPROVE REVISED RULE

Supersedes the rule text of Round 1 decision d (approve_with_revision).

Decision (verbatim):

```text
APPROVE REVISED RULE, with one correction.
I approve points 1–8, including:
High is limited to the PRC §4202 map route.
Responsibility area is no longer an independent required condition. Record it as context only when the source states it.
Map coverage of the lot and the map legend’s actual High class are the operative checks.
Use “whole lot proposed to be subdivided” consistently, and fail closed if APN/parcel and legal-lot identity are unclear.
Keep combined High/Very High coverage deferred.
Correction to points 2, 5 and the gate summary:
A non-qualifying record that shows or denies High does not, by itself, produce conflict.
If only non-qualifying evidence exists, it cannot establish the fact and the authority gate returns unknown.
If a non-qualifying record disagrees with another known-value record, existing Layer 1 conflict detection determines whether the fact is conflict.
Do not add a special rule saying “any non-qualifying High record = conflict.”
Preserve the existing architecture: authority gating may downgrade an established result to unknown, but it does not manufacture conflicts.
Keep d pending_human with all remaining gates.
Do not edit files yet. Continue to criterion e
```

Rule as decided:

```text
1. Scope: High only, never inferred from Very High in either direction. A Very High class on a §4202 map belongs to c.
2. Only one kind of record qualifies: a map adopted by CAL FIRE under PRC §4202. A §51178 determination never establishes d, because that route names only Very High. Any other record showing or denying High, including City/ZIMAS and any High designation resting on another basis, is a non-qualifying record (see the common terms).
3. YES → disqualifying_per_source only when a qualifying §4202 map shows the whole lot proposed to be subdivided inside a High zone. The lot identity rule applies.
4. Partial coverage → unknown / requires_judgment. No threshold. A lot that is partly High and partly Very High stays unknown on both c and d. The combined-coverage fact stays deferred and is not solved by inference.
5. NO → consistent_with_source only when all three hold: a qualifying §4202 map covers the lot; its legend defines a High class for the area containing the lot; it shows no part of the lot in High. If no §4202 map covers the lot, or its legend has no High class there, the result is unknown.
6. Required fields: CAL FIRE as the adopting agency, PRC §4202 as the basis, map identity, edition or adoption date, whether the map covers the lot, and whether the legend defines High there. If any is missing, the result is unknown. Responsibility area is recorded only when the source states it, as context. It is not a condition: map coverage of the lot and the legend's High class are the operative checks.
7. Memo reading: footnote 1 and the memo's “as referenced in GCS 51178” are memo context only. They add no YES route.
8. Ceiling unchanged.
```

**Status after re-review:** `pending_human`. Gated: stays `pending_human` until the gates below can be enforced in code or fail closed.

**Before `human_verified`** (★ = recorded here, not yet wired into the authority registry):

- `evidence_provenance_enforced_or_fails_closed`
- `map_identity_and_edition_recorded`
- ★ `statutory_route_recorded`
- ★ `prc_4202_map_coverage_and_legend_class_recorded`
- ★ `legal_lot_identity_fails_closed`
- `reviewer_confirms_encoded_rule`
- `human_verification_record`

`responsibility_area_and_legend_recorded` (Round 1) stays in the registry until `prc_4202_map_coverage_and_legend_class_recorded` is wired, so the registry never requires less than before.

**Deferred to a later reviewed change:**

- `combined_high_or_very_high_coverage_fact_if_needed`: Round 1: if real cases need it, add a separately reviewed combined High-or-Very-High coverage fact or criterion.
- `high_fire_client_label`: New (confirmation 2): reword the High fact's client label, which now reads “whether the parcel is mapped in a High Fire Hazard Severity Zone, in a state or local responsibility area”, so it does not imply that responsibility area is part of the d rule.

## e. `la_shra.prime-or-statewide-farmland`: APPROVE REVISED RULE

Supersedes the rule text of Round 1 decision e (keep_pending).

Decision (verbatim):

```text
APPROVE REVISED RULE, with one additional fail-closed condition.
I approve points 1–8 as the candidate rule, and e remains pending_human.
Add this clarification to points 2, 3 and the remaining gates:
A Department of Conservation Farmland Mapping and Monitoring Program map is the correct statutory record type.
However, a map designation may establish YES only after the captured map edition and its official legend/documentation establish that the displayed categories Prime Farmland and Farmland of Statewide Importance are the categories defined pursuant to the USDA land inventory and monitoring criteria referenced by §66499.41(a)(9)(A).
Do not assume that relationship merely because the map comes from FMMP.
If the captured map/legend does not establish that relationship, return unknown and keep the criterion pending.
Keep:
whole lot proposed to be subdivided wording;
legal-lot identity fail closed;
partial coverage unknown;
NO never clears;
ZIMAS/generic GIS/search results non-establishing;
map edition/date unresolved until a specific official edition is captured;
ballot-measure agricultural land as a separate unmodeled statutory gap, not something e tries to absorb.
e stays pending_human in the pending-source-capture tier.
Do not edit files yet. Continue to criterion f.
```

Rule as decided:

```text
1. Source proposition unchanged. The statute scopes e to prime farmland or farmland of statewide importance “designated on the maps prepared by the Farmland Mapping and Monitoring Program of the Department of Conservation”.
2. Record type: a Department of Conservation Farmland Mapping and Monitoring Program map is the statutory record type. Any other record, including ZIMAS fields, generic GIS layers, search results, and City or County farmland layers, is a non-qualifying record (see the common terms). A designation on a program map may establish YES only after the captured map edition and its official legend or documentation establish that the displayed categories Prime Farmland and Farmland of Statewide Importance are the categories defined pursuant to the USDA land inventory and monitoring criteria referenced by §66499.41(a)(9)(A). That relationship is never assumed merely because the map comes from the program. If it is not established, the result is unknown and the criterion stays pending.
3. YES → disqualifying_per_source only when a captured, reviewed edition of that map designates the whole lot proposed to be subdivided as Prime Farmland or Farmland of Statewide Importance, and point 2's relationship is established. The lot identity rule applies.
4. Partial coverage → unknown / requires_judgment. No threshold.
5. NO never clears (block-only, unchanged). A "not designated" result also says nothing about (A)'s ballot-measure agricultural land, which is SHRA pathway completeness blocker G1.
6. Required fields: the Department of Conservation program as preparer, map identity, edition or date, and the designation shown for the lot. If any is missing, the result is unknown.
7. Edition: not set by the statute, and the most recent edition is not assumed. The edition or date stays unresolved until a specific official edition is captured and reviewed.
8. Status: the rule stays a candidate. e stays pending_human in the pending-source-capture tier. Ceiling unchanged, and the criterion is not removed. Ballot-measure agricultural land is not part of e (G1).
```

**Status after re-review:** `pending_human`. Pending source capture: the rule above is a candidate rule. It stays pending until a specific official map edition is captured and reviewed.

**Before `human_verified`** (★ = recorded here, not yet wired into the authority registry):

- `defining_official_source_captured`
- ★ `fmmp_categories_tied_to_usda_criteria`
- `evidence_provenance_enforced_or_fails_closed`
- ★ `map_identity_and_edition_recorded`
- ★ `legal_lot_identity_fails_closed`
- `reviewer_confirms_encoded_rule`
- `human_verification_record`

`defining_official_source_captured` is restated: A specific Department of Conservation Farmland Mapping and Monitoring Program map edition, with its official legend or documentation, is captured as an agency_map and reviewed. The statute supplies only the program's identity, not an edition or date.

**Pathway completeness blocker:** G1 (see [below](#shra-pathway-completeness-blockers)).

## f. `la_shra.natural-community-conservation-plan-land`: APPROVE REVISED RULE

Supersedes the rule text of Round 1 decision f (approve_with_revision).

Decision (verbatim):

```text
APPROVE REVISED RULE, with one additional release-safety condition.
I approve points 1–6.
Keep:
f scoped only to land identified for conservation in an adopted NCCP under the Natural Community Conservation Planning Act;
whole lot proposed to be subdivided wording;
legal-lot identity fail closed;
partial coverage unknown;
interpretation-dependent plan labels unknown;
draft/proposed/pending/superseded/unconfirmed plans non-establishing;
NO never clears;
provenance from the adopted plan itself required;
plan type and statutory basis recorded;
ceiling unchanged.
Add this condition for statutory gap G2:
§66499.41(a)(9)(H) also covers:
habitat conservation plans under the federal Endangered Species Act; and
other adopted natural resource protection plans.
Criterion f does not absorb those categories.
Record G2 as a separate SHRA pathway completeness blocker: before the overall SHRA pathway can ever produce a fully clear/consistent result, those two statutory categories must either:
receive separately reviewed criteria/facts, or
be explicitly resolved by a later human review.
Do not infer that passing criterion f means §66499.41(a)(9)(H) as a whole is satisfied.
This does not change f’s own outcome ceiling or rule. It prevents the broader statutory category from being silently lost later.
Also keep the distinction that “expired/superseded/current status” is a fail-closed evidence requirement, not wording supplied by §66499.41(a)(9)(H) itself.
f stays pending_human behind its implementation/provenance gates.
Do not edit files yet. Continue to criterion g.
```

Rule as decided:

```text
1. The record is the adopted plan itself, meaning its official adopted maps, exhibits, or text; provenance from the adopted plan itself is required. f is scoped only to land identified for conservation in a natural community conservation plan adopted pursuant to the Natural Community Conservation Planning Act (Fish and Game Code §2800 et seq.), and the plan type and statutory basis are recorded. A habitat conservation plan, or any other natural resource protection plan, never establishes f. City/ZIMAS, generic GIS layers, and secondary sources are non-qualifying records (see the common terms).
2. YES → disqualifying_per_source only when reviewed evidence establishes all five Round 1 elements: the plan is an NCCP adopted under the Act; its adoption status is established; the applicable map or text is identified and dated; the plan itself identifies the land for conservation; the whole lot proposed to be subdivided lies within that land. The lot identity rule applies.
3. Unknown / requires_judgment in each of these cases, unchanged from Round 1: partial identification (no threshold); a label that needs interpretation; a draft, proposed, pending, expired, superseded, or unconfirmed plan; adoption status that cannot be established. Expired, superseded, and current status is a fail-closed evidence requirement, not wording supplied by §66499.41(a)(9)(H) itself.
4. NO never clears. This keeps Round 1's future door: a reviewed method showing that every applicable adopted NCCP covering the lot was checked. Even then, a clearing NO would speak only to NCCP land, never to (H)'s other plans, which are SHRA pathway completeness blocker G2. Passing f never means §66499.41(a)(9)(H) as a whole is satisfied.
5. No master list of plans is required. A lot cannot block until its particular plan and map or text are captured and reviewed (unchanged).
6. Ceiling unchanged.
```

**Status after re-review:** `pending_human`. Gated: stays `pending_human` until the gates below can be enforced in code or fail closed.

**Before `human_verified`** (★ = recorded here, not yet wired into the authority registry):

- `evidence_provenance_enforced_or_fails_closed`
- `adopted_plan_identity_adoption_and_map_date_recorded`
- ★ `nccp_plan_type_and_statutory_basis_recorded`
- ★ `legal_lot_identity_fails_closed`
- `reviewer_confirms_encoded_rule`
- `human_verification_record`

**Pathway completeness blocker:** G2 (see [below](#shra-pathway-completeness-blockers)).

## g. `la_shra.conservation-easement`: APPROVE REVISED RULE

Supersedes the rule text of Round 1 decision g (approve_with_revision).

Decision (verbatim):

```text
APPROVE REVISED RULE.
I approve points 1–7.
Preserve these distinctions explicitly:
The source proposition is only “Land under conservation easement.”
“Recorded instrument” is a PermitPulse conservative evidence standard for establishing YES, not part of the statutory definition and not a claim that only recorded easements qualify.
A recorded instrument can support YES only when it expressly creates or establishes a conservation easement, applies to the whole lot proposed to be subdivided, remains in force, and lot/instrument identity is established.
If APN/parcel and legal-lot identity are unclear, return unknown.
Partial coverage, interpretation-dependent instruments, uncertain release/extinguishment, or unclear instrument identity remain unknown / requires_judgment.
Secondary sources cannot establish the fact. They remain subject to existing Layer 1 conflict handling and the authority gate; do not create new conflict logic.
NO never clears.
Keep the deferred client-label fix so the UI does not present “recorded” as part of the legal/source rule.
g stays pending_human behind the existing provenance and instrument-status gates.
Do not edit files yet.
Also record for the final decisions stage: I want G1 treated consistently with G2. The ballot-measure agricultural-land category in §66499.41(a)(9)(A) should become a separate SHRA pathway completeness blocker. Passing criterion e must never imply that subsection (A) as a whole is satisfied until that category has its own reviewed fact/criterion or an explicit later human resolution.
Now produce the consolidated Phase 3B decisions record and proposed implementation plan for c–g, but stop before editing files.
```

Rule as decided:

```text
1. The source proposition is only “Land under conservation easement.” (statute), the same proposition as the memo's “Lands under a conservation easement.” It is never restated as requiring a recorded easement.
2. Recorded instrument: a PermitPulse conservative evidence standard for establishing YES. It is not part of the statutory definition and not a claim that only recorded easements qualify.
3. YES → disqualifying_per_source only when a recorded instrument expressly creates or establishes a conservation easement, applies to the whole lot proposed to be subdivided, remains in force, and lot and instrument identity are established. The lot identity rule applies.
4. Unknown / requires_judgment in each of these cases: partial coverage (no threshold); an instrument that needs interpretation; uncertain release, termination, or extinguishment; unclear instrument identity or coverage. These are fail-closed evidence requirements, not wording supplied by §66499.41(a)(9)(J).
5. A ZIMAS field, title summary, GIS layer, or other secondary source is a non-qualifying record (see the common terms). No new conflict logic.
6. NO never clears (unchanged).
7. Ceiling unchanged. The deferred conservation_easement_client_label change stays, so the client label does not present recorded as part of the source rule.
```

**Status after re-review:** `pending_human`. Gated: stays `pending_human` until the gates below can be enforced in code or fail closed.

**Before `human_verified`** (★ = recorded here, not yet wired into the authority registry):

- `evidence_provenance_enforced_or_fails_closed`
- `instrument_identity_in_force_status_and_coverage_recorded`
- ★ `legal_lot_identity_fails_closed`
- `reviewer_confirms_encoded_rule`
- `human_verification_record`

**Deferred to a later reviewed change:**

- `conservation_easement_client_label`: Round 1: reword the conservation-easement client label so it does not present recorded as part of the source rule.

## New gates

These gates are introduced by this record. Each is recorded here and wired by a later reviewed change.

- `statutory_route_recorded`: The evidence records the agency (the Department of Forestry and Fire Protection) and the statutory basis of the record: GOV §51178 or PRC §4202 for c, and PRC §4202 only for d. The evaluator fails closed when either is missing. Today the hazard_map qualifier has no statutory-basis field, and the agency_hazard_map record kind always describes a map, which may not fit a §51178 determination.
- `statutory_routes_assessed_separately`: c is assessed per statutory route: a YES under either route is enough, a NO under only one route cannot clear the criterion, and partial coverage is judged per route and never combined across routes. Under today's single Very High fact, a Route 1 YES and a Route 2 NO would be a Layer 1 conflict, so c cannot be promoted until route-separated assessment is implemented and fails closed (Phase 3C).
- `prc_4202_map_coverage_and_legend_class_recorded`: The evidence records whether a PRC §4202 map covers the lot and whether its legend defines a High class for the area containing the lot, and the evaluator fails closed when it does not. It replaces responsibility_area_and_legend_recorded; responsibility area is recorded as context only, when the source states it. Today the hazard_map qualifier keys map coverage and legend class to parcel_responsibility_area.
- `fmmp_categories_tied_to_usda_criteria`: The captured Farmland Mapping and Monitoring Program map edition and its official legend or documentation establish that its Prime Farmland and Farmland of Statewide Importance categories are the categories defined pursuant to the USDA land inventory and monitoring criteria referenced by §66499.41(a)(9)(A). The relationship is never assumed from the map's source; until it is established, a designation cannot establish YES.
- `nccp_plan_type_and_statutory_basis_recorded`: The evidence records that the plan is a natural community conservation plan adopted pursuant to the Natural Community Conservation Planning Act (Fish and Game Code §2800 et seq.), not a habitat conservation plan or another plan, and the evaluator fails closed when it does not. Today the adopted_plan qualifier has no plan-type or statutory-basis field.

Two gates that already exist are newly decided for criteria that did not require them in Round 1:

- `legal_lot_identity_fails_closed` (c, d, e, f, g). Its current check reads only the `lot-area` and `prior-shra-or-sb9-map` facts, so it stays unmet for c–g until that check is extended.
- `map_identity_and_edition_recorded` (e).

## SHRA pathway completeness blockers

Each blocker names a statutory category in § 66499.41(a)(9) that no criterion models. While a blocker is open, two things hold:

- Passing its related criterion never implies that the statutory subparagraph as a whole is met.
- The SHRA pathway must never roll up to `no_disqualifier_found_in_reviewed_sources`.

A blocker closes only through a separately reviewed criterion or fact for the category, or an explicit later human review that resolves it. Neither blocker changes its related criterion's rule or outcome ceiling.

### G1. (a)(9)(A): `shra_a9a_ballot_measure_agricultural_land`

- **Category (statute):** “land zoned or designated for agricultural protection or preservation by a local ballot measure that was approved by the voters of that jurisdiction”
- **Related criterion:** `la_shra.prime-or-statewide-farmland`, which does not absorb this category.
- **Status:** open.

Reviewer's text (verbatim):

```text
Also record for the final decisions stage: I want G1 treated consistently with G2. The ballot-measure agricultural-land category in §66499.41(a)(9)(A) should become a separate SHRA pathway completeness blocker. Passing criterion e must never imply that subsection (A) as a whole is satisfied until that category has its own reviewed fact/criterion or an explicit later human resolution.
```

### G2. (a)(9)(H): `shra_a9h_hcp_and_other_resource_protection_plans`

- **Category (statute):** “habitat conservation plan pursuant to the federal Endangered Species Act of 1973 (16 U.S.C. Sec. 1531 et seq.), or another adopted natural resource protection plan”
- **Related criterion:** `la_shra.natural-community-conservation-plan-land`, which does not absorb this category.
- **Status:** open.

Reviewer's text (verbatim):

```text
Add this condition for statutory gap G2:
§66499.41(a)(9)(H) also covers:
habitat conservation plans under the federal Endangered Species Act; and
other adopted natural resource protection plans.
Criterion f does not absorb those categories.
Record G2 as a separate SHRA pathway completeness blocker: before the overall SHRA pathway can ever produce a fully clear/consistent result, those two statutory categories must either:
receive separately reviewed criteria/facts, or
be explicitly resolved by a later human review.
Do not infer that passing criterion f means §66499.41(a)(9)(H) as a whole is satisfied.
This does not change f’s own outcome ceiling or rule. It prevents the broader statutory category from being silently lost later.
```

Enforcing the blockers at the SHRA roll-up is evaluator logic and waits for a later reviewed change. Until then, a test fails if any SHRA pathway result in the shipped fixtures rolls up to `no_disqualifier_found_in_reviewed_sources` while a blocker is open.

## Gate wiring

The authority registry's requirement for each criterion is unchanged in Phase 3B. It still points to the Round 1 decision and requires exactly the Round 1 gates:

| | Registry today (Round 1 gates) | Decided here, not yet wired | Retained until replacement wired |
| --- | --- | --- | --- |
| c | `evidence_provenance_enforced_or_fails_closed`, `map_identity_and_edition_recorded`, `reviewer_confirms_encoded_rule`, `human_verification_record` | `statutory_route_recorded`, `statutory_routes_assessed_separately`, `legal_lot_identity_fails_closed` | none |
| d | `evidence_provenance_enforced_or_fails_closed`, `map_identity_and_edition_recorded`, `responsibility_area_and_legend_recorded`, `reviewer_confirms_encoded_rule`, `human_verification_record` | `statutory_route_recorded`, `prc_4202_map_coverage_and_legend_class_recorded`, `legal_lot_identity_fails_closed` | `responsibility_area_and_legend_recorded` |
| e | `defining_official_source_captured`, `evidence_provenance_enforced_or_fails_closed`, `reviewer_confirms_encoded_rule`, `human_verification_record` | `fmmp_categories_tied_to_usda_criteria`, `map_identity_and_edition_recorded`, `legal_lot_identity_fails_closed` | none |
| f | `evidence_provenance_enforced_or_fails_closed`, `adopted_plan_identity_adoption_and_map_date_recorded`, `reviewer_confirms_encoded_rule`, `human_verification_record` | `nccp_plan_type_and_statutory_basis_recorded`, `legal_lot_identity_fails_closed` | none |
| g | `evidence_provenance_enforced_or_fails_closed`, `instrument_identity_in_force_status_and_coverage_recorded`, `reviewer_confirms_encoded_rule`, `human_verification_record` | `legal_lot_identity_fails_closed` | none |

A test holds each registry requirement to the decided gates, minus the not-yet-wired ones, plus the retained ones. Every c–g criterion still has at least one decided gate that is not wired. A second test therefore fails if any c–g criterion gains a human-verification record, which blocks a promotion that uses only the Round 1 gates.

## The re-review trigger

`statuteRereviewWarnings` still flags c–g from the Round 1 record, because that record's `rereview_triggers` are history and are not edited. Each flagged criterion now has a Phase 3B decision that answers `gcs_66499_41_a_9_captured`. The answer is pinned to the capture's `sha256_original` (`3521eb92f68d966461eb0c7b60ebffad8371b487eff2f014417cd74fc077ec72`) and `sha256_extracted` (`48815c8e2a892ca8e3aa523c6d3237d9c014fc556b3e332e31f0894f5bcf0759`). If the capture changes, a test fails and a new re-review is needed.

## Invariants (tested)

- `human_verified` = 0 and `pending_human` = 46. Every guarded criterion still has promotion blockers.
- `programAuthorityRegistries.issuers` and `.sources` are empty.
- Every fact policy's `establishing` list is empty.
- `sourceHostExceptions` is empty.
- `canSupportCriterionRule` is false for `gcs-66499-41`.
- The evaluator output SHA-256 is `2b0c6ea651dfc55191090ab0c6129a8c22692a28bfdce3f046425437e1acecca`, unchanged.
- The public-demo output SHA-256 is `d00a74d195a2749da877775c0204a3435820fd13189f2ae05880b744ab45f57f`, unchanged.
- The five official-source captures are byte-for-byte unchanged.
- The Round 1 records and documents, and the Phase 3A memo, are byte-for-byte unchanged.
- The c, d, and g client labels still read as shipped. The deferred label changes are not made here.

## Not in Phase 3B

Each of these is a later, separately reviewed change.

**Promotion guard (Phase 3C)**

- Add the new gates to `criterionPromotionGates` and `gateMet`, and point the c–g requirements at the Phase 3B decisions.
- Extend `legal_lot_identity_fails_closed` to c–g.
- Retire `responsibility_area_and_legend_recorded` only when `prc_4202_map_coverage_and_legend_class_recorded` is wired.

**Evidence qualifiers**

- `hazard_map`: add a statutory-basis field, and key map coverage and legend class to the §4202 map rather than the responsibility area.
- A record kind for a §51178 determination, once GOV § 51178 is captured and the form of the determination is known.
- A farmland-map family: edition, legend class, and the USDA-criteria documentation.
- A plan-type and statutory-basis field on `adopted_plan`.

**Assessment and evaluator**

- Route-separated assessment for c.
- Enforce G1 and G2 at the SHRA roll-up.

**Client labels:** `very_high_fire_client_label`, `high_fire_client_label`, `conservation_easement_client_label`.

**Captures**, each its own reviewed step, with its issuer:

- GOV § 51178 and PRC § 4202, then the Department of Forestry and Fire Protection map.
- A Farmland Mapping and Monitoring Program map edition and its documentation.
- The Natural Community Conservation Planning Act, then specific plans.

**Other (a)(9) criteria:** whether the other criteria tied to (a)(9) join a review round is a separate human decision. They are hazardous waste, special flood hazard area, regulatory floodway, earthquake fault zone, wetlands, and protected-species habitat.
