# Program Screen Phase 3C: Phase 3B promotion gates and fact-model changes for c–g

Phase 3C makes the Phase 3B decisions (`docs/PROGRAM_SCREEN_PHASE_3B_REREVIEW_DECISIONS.md`, record `app/fixtures/program-screen/human-review-rounds/phase-3b-rereview-decisions.json`) enforceable in code, and makes every one of them fail closed. It is implementation only: no new human decision is recorded here.

- **Nothing is promoted.** `human_verified` = 0 and `pending_human` = 46. Every c–g criterion stays `pending_human` with no encoded rule and the same outcome ceiling.
- **Nothing is registered or captured.** `programAuthorityRegistries.issuers` and `.sources` are empty, every fact policy's `establishing` list is empty, and `sourceHostExceptions` is empty. No official source is captured.
- **The Phase 3B record and decisions document are unchanged**, byte for byte. Its `gates_not_yet_wired` lists stay as history of the state at Phase 3B.

Tests: `app/tests/program-screen-promotion-gates-3c.test.ts`. Assertions in earlier phase tests that described the pre-3C code are updated where 3C supersedes them, and are marked.

## Route-separated assessment for c

c reads one fact, `very-high-fire-hazard-severity-zone`, which SB 79 and Low-Rise also read. The fact and its canonical Layer 1 assessment are unchanged. c alone declares `statutory_routes: { fact_key: "very-high-fire-hazard-severity-zone", routes: ["gov_51178", "prc_4202"] }`, and the evaluator (`assessStatutoryRoutes` in `evaluate.ts`) assesses that fact's records once per route before the roll-up:

1. **Partition.** A record whose authority block names a route in `qualifiers.statutory_basis` counts only toward that route. Every other record (no block, another basis, an unestablished basis, a City display) counts toward **both** routes, so it is still compared with each route's records. Records joined by an explicit `conflicts_with` link are assessed together.
2. **Layer 1 per route.** Each route's records go through the canonical Case Integrity evaluator, unchanged. Contradictory records within a route stay a conflict.
3. **Roll-up.** Any route in conflict: conflict. Otherwise YES if any route is established YES; NO only if both routes are established NO; anything else is unknown. The predicate, once encoded, receives that combined value.
4. **Authority gate per route.** Only the routes that carry the combined value are gated (for YES, the YES routes; for NO, both). A record counts only for the route its block names. YES needs one YES route established; NO needs both routes established. A NO route is never gated against a YES, so it never cancels one.
5. **No routed record, no change.** With no routed record both routes hold the same records, so each route's assessment is the single-fact assessment and the result is identical to the pre-3C result. The result gains `statutory_routes` only when a record is routed.

Consequences:

- A Route 1 YES and a Route 2 NO give c a YES candidate (today `unreviewed`, since c is pending), not a generic conflict. The shared fact itself still reads as a conflict for SB 79 and Low-Rise, whose rules are not route-separated.
- A City display that disagrees with a routed record is compared with it on every route, so it still produces a Layer 1 conflict. A YES record can never be hidden from a clearing NO.
- Partial coverage (an unknown value) on each route never combines into a YES.
- **GOV §51178 fails closed.** `statutoryRouteRecordKinds.gov_51178` is `null`: what a §51178 record looks like is not decided until GOV §51178 is captured and reviewed. Any record on Route 1 fails with `statutory_route_record_kind_undefined`, so c can establish YES only through PRC §4202 and can never establish NO.

The abstraction is limited to one optional criterion field, and the schema accepts it only for a hazard fact whose class has more than one route, with exactly those routes.

## Legal-lot identity

`legalLotIdentityFacts` extends the existing mechanism from `lot-area` and `prior-shra-or-sb9-map` to the five c–g facts. Every c–g fact policy sets `requires_legal_lot_identity: true`, and the registry schema rejects a policy for any of these facts that does not. A record establishes one of these facts only when its block records `legal_lot_identity: "parcel_is_one_legal_lot"` (the APN/parcel and the legal lot are one screening unit) **and** names the legal lot in `legal_lot_reference`. Anything else fails with `legal_lot_identity_not_established` and the criterion stays unknown; the named-lot check also applies to a and b. No merger, tied-lot, lot-line, or subdivision logic is added.

## Qualifier fields

| Family | Field | Values | Use |
| --- | --- | --- | --- |
| `hazard_map` | `statutory_basis` (new) | `gov_51178`, `prc_4202`, `other_basis`, `not_established` | The route. Very High rests on either route, High on `prc_4202` only (`hazardClassStatutoryRoutes`). |
| `hazard_map` | `named_agency` (new) | `department_of_forestry_and_fire_protection`, `other_agency`, `not_established` | The agency the record names. |
| `hazard_map` | `map_covers_lot` (was `map_covers_that_area`) | `yes`, `no`, `not_established` | Keyed to the lot, not a responsibility area. |
| `hazard_map` | `legend_defines_class_for_lot` (was `legend_defines_class_for_area`) | `yes`, `no`, `not_established` | Whether the legend defines the fact's class for the area containing the lot. |
| `hazard_map` | `responsibility_area_as_stated` (was `parcel_responsibility_area`) | `state`, `local`, `federal`, `not_stated` | Context only. No check reads it. |
| `farmland_map` (new family, `prime-or-statewide-farmland`) | `map_program` | `farmland_mapping_and_monitoring_program`, `other_program`, `not_established` | The FMMP as the map program. |
| `farmland_map` | `designation_class` | `prime_farmland`, `farmland_of_statewide_importance`, `other_or_none`, `not_established` | The one class shown for the whole lot; a lot shown in more than one class is `not_established`. |
| `farmland_map` | `usda_criteria_documentation` | capture reference or `null` | The captured legend or documentation tying the categories to the USDA criteria. |
| `adopted_plan` | `plan_type` (new) | `natural_community_conservation_plan`, `habitat_conservation_plan`, `other_natural_resource_protection_plan`, `not_established` | Only an NCCP can back f. |
| `adopted_plan` | `statutory_basis` (new) | `fish_and_game_code_2800_et_seq`, `federal_endangered_species_act`, `other_basis`, `not_established` | Only the NCCP Act can back f. |

Map identity and edition stay in the existing block fields (`source_identifier`, `document_title`, `edition`). A PRC §4202 record's edition date must be its adoption date (`date_kind: "adopted"`, c point 6). A new record kind, `agency_farmland_map`, is the only kind a farmland policy may list. The farmland family policy gains `accepted_usda_criteria_documentation`, shipped empty; a populated farmland policy must name at least one.

New record failure codes: `statutory_route_not_accepted`, `statutory_route_record_kind_undefined`, `statutory_agency_not_recorded`, `hazard_map_adoption_date_not_recorded`, `farmland_map_program_not_established`, `farmland_designation_not_established`, `farmland_usda_criteria_not_established`, `plan_type_not_nccp`. `hazard_area_not_covered` no longer reads responsibility area.

## Promotion gates

The five Phase 3B gates join `criterionPromotionGates`. Each c–g requirement now points at its Phase 3B decision (`decision_ref: { phase: "3B", letter }`) and lists exactly the decided gates, in the decided order. The c–g fact policies list both the Round 1 and the Phase 3B decision. A human record confirms the encoded rule only when it cites the Phase 3B decision.

| Gate | Met only when |
| --- | --- |
| `statutory_route_recorded` | every hazard fact read is established only through record kinds that carry a route its class rests on, and each such route has a defined record kind. Unmet for c until a GOV §51178 record kind exists. |
| `statutory_routes_assessed_separately` | the criterion declares `statutory_routes` over every route of its fact's class, and that fact's policy is populated. |
| `prc_4202_map_coverage_and_legend_class_recorded` | the High policy requires the legend class and establishes only through PRC §4202 maps. The gate code checks lot coverage and the legend class unconditionally. |
| `fmmp_categories_tied_to_usda_criteria` | the farmland policy is populated and accepts reviewed USDA-criteria documentation. |
| `nccp_plan_type_and_statutory_basis_recorded` | the NCCP policy is populated; the gate code refuses any plan not recorded as an NCCP under the Act. |
| `legal_lot_identity_fails_closed` (now for c–g) | every legal-lot fact read is populated and requires legal-lot identity. |
| `map_identity_and_edition_recorded` (now for e) | unchanged definition. |

`responsibility_area_and_legend_recorded` is **retired**: it stays in the gate list so the Round 1 and Phase 3B records still parse, but it is never met and the registry rejects any requirement that lists it. It was removed from d's requirement in the same change that wired and tested its replacement.

Under the shipped registries every c–g gate except the two reviewer gates is unmet, because nothing can establish a c–g fact. The tests also show each new gate becoming met once its enforcement is configured in TEST-ONLY registries; c then still waits on `statutory_route_recorded`.

The Phase 3B record schema now accepts that the gates its record defines exist in code (`rereviewIntroducedPromotionGates`), and still rejects a redefinition of any earlier gate.

## SHRA completeness guard (G1, G2)

`programPathwayCompletenessBlockers` mirrors G1 (`shra_a9a_ballot_measure_agricultural_land`) and G2 (`shra_a9h_hcp_and_other_resource_protection_plans`), both open. `rollUpProgramPathway` is keyed to the pathway, not the pack: while a pathway has an open blocker, a roll-up that would be `no_disqualifier_found_in_reviewed_sources` is `undetermined` instead, the related criteria (e, f) are named as decisive, and the pathway result gains `open_completeness_blockers`. No new outcome is added. A documented disqualifier, a conflict, and a flag divergence are unaffected: a program flag is still compared with what the criteria found, so a display that points to a blocker still escalates to `contested`. No G1 or G2 criterion or fact is created.

## Client labels

Only the three deferred labels, and the question wording built from the same terms:

| Fact | Before | After |
| --- | --- | --- |
| `very-high-fire-hazard-severity-zone` | the property's fire-hazard designation | whether the parcel is mapped in a Very High Fire Hazard Severity Zone |
| `high-fire-hazard-severity-zone` | whether the parcel is mapped in a High Fire Hazard Severity Zone, in a state or local responsibility area | whether the parcel is mapped in a High Fire Hazard Severity Zone |
| `conservation-easement` | whether the parcel is under a recorded conservation easement | whether the parcel is under a conservation easement |

The c, d, and g question designations drop "(state or local responsibility area)" and "recorded" in the same way. The fictional fixture's two Very High records carry the new label, which the evidence schema requires to match. The Case Integrity fixture keeps its own label.

## Evaluator and demo output

| | Before (main) | After |
| --- | --- | --- |
| Evaluator SHA-256 | `2b0c6ea651dfc55191090ab0c6129a8c22692a28bfdce3f046425437e1acecca` | `68341529825b41e7dcd3b25a5daec94385fe6641e07cc03d29003c94c256b45a` |
| Public-demo SHA-256 | `d00a74d195a2749da877775c0204a3435820fd13189f2ae05880b744ab45f57f` | `11081860902438dd881cb743c98de30f4b4c3c425675a6e0eb2b6d41474a84a1` |

The only cause is the label text. Replacing the six old strings in the pre-3C output with their new wording reproduces the post-3C evaluator and demo output byte for byte. Every fact classification, criterion status, pathway roll-up, release decision, count, and the screen ID are unchanged. The fixture has no routed record and no authority sidecar, so route separation leaves it as it was, and its SHRA pathway is `contested`, so the completeness guard does not fire.

## Not in Phase 3C

- A record kind for a GOV §51178 determination, after GOV §51178 is captured and reviewed.
- Registering CAL FIRE, the Department of Conservation, any plan, or any recorder, and capturing their sources.
- The source-capture registration check still asks an agency-map capture to list responsibility areas; aligning it with d's rule belongs with the first fire-map capture.
- A G1 or G2 criterion or fact, or a human resolution of either.
- Combined High-or-Very-High coverage (deferred by Phase 3B d).
