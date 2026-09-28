# Program Screen human review, Round 1: decisions

Decided 2026-09-27 by **Sergio Mata, Project Owner / Human Reviewer**. Machine-readable twin: `app/fixtures/program-screen/human-review-rounds/round-1-decisions.json`.

This file records the Round 1 decisions exactly as the reviewer gave them. Each decision text appears below verbatim, in a fenced block, and a test checks every block against the JSON record. Where these decisions differ from the proposals in the Round 1 packet (`docs/PROGRAM_SCREEN_HUMAN_REVIEW_ROUND_1.md`) or its manifest (`round-1.json`), these decisions govern; the packet and manifest are kept as they were reviewed.

## Outcome

- Six criteria: APPROVE WITH REVISION. Two criteria: KEEP PENDING.
- **No criterion is promoted.** Every Round 1 criterion stays `pending_human` with no encoded rule: `human_verified` stays 0 and `pending_human` stays 46.
- No outcome ceiling changes, no fact-model additions, and no provenance-schema changes. Production evaluator output is byte-identical to before the review; a test pins the evaluator and public-demo output hashes.
- Every decision records the conditions that must be met before its criterion can become `human_verified`. The next step is a separate design and review branch for the evidence-authority and provenance model.

| | Criterion | Decision | Tier after review |
| --- | --- | --- | --- |
| a | `la_shra.single-family-lot-area-threshold` | APPROVE WITH REVISION | Gated |
| b | `la_shra.prior-shra-or-sb9-map` | APPROVE WITH REVISION | Gated |
| c | `la_shra.very-high-fire-hazard-severity-zone` | APPROVE WITH REVISION | Gated |
| d | `la_shra.high-fire-hazard-severity-zone` | APPROVE WITH REVISION | Gated |
| e | `la_shra.prime-or-statewide-farmland` | KEEP PENDING | Pending source capture |
| f | `la_shra.natural-community-conservation-plan-land` | APPROVE WITH REVISION | Gated |
| g | `la_shra.conservation-easement` | APPROVE WITH REVISION | Gated |
| h | `la_sb79.permanent-exemption-shown` | KEEP PENDING | Pending source capture |

## Reviewer's conditions for this change (verbatim)

```text
Therefore, after Phase 1:
human_verified must remain 0
pending_human must remain 46
production evaluator behavior must remain byte-identical
evaluator/demo hashes must remain unchanged
no outcome ceiling changes
no fact-model additions
no provenance-schema changes yet
Do not implement Phase 2 or Phase 3 in this branch.
Phase 2 should become a separate design/review branch for the evidence-authority/provenance model. Once that design is reviewed, we can promote the criteria whose approved rules can actually be enforced.
```

## a. `la_shra.single-family-lot-area-threshold`: APPROVE WITH REVISION

Decision (verbatim):

```text
APPROVE WITH REVISION
I approve the single-family lot-area rule and the proposed outcome ceiling.
Revisions:
Keep the authoritative threshold expressed as 1.5 acres because that is what the official memo states. The implementation may normalize it to 65,340 sq ft, but record that as a mathematical conversion, not quoted source language.
consistent_with_source requires a listed Chapter 1 single-family zone and a reliably established lot area below the threshold.
disqualifying_per_source requires a listed Chapter 1 single-family zone and a reliably established lot area at or above the threshold.
If the available lot-area record is rounded or otherwise too imprecise to determine which side of 1.5 acres the lot falls on, return unknown rather than applying an invented tolerance.
If APN boundaries, legal-lot boundaries, tied lots, a pending merger, or proposed merger/re-subdivision make it unclear which lot the 1.5-acre test applies to, return unknown / requires human review rather than calculating through the ambiguity.
Keep R1 Variation Zones and Chapter 1A parcels unknown until separately sourced.
Keep a zone outside the nine-item Q.1 list from producing a clearing result. It may route to judgment or another separately reviewed SHRA pathway.
I accept the reading that page 2's “single-family zoned lots” uses the Q.1 definition it expressly cross-references.
```

Promotion tier decision (verbatim):

```text
Move a to Tier 2 / gated as well. Do not promote it in Round 1.
I do not want one production criterion becoming human_verified while important parts of its approved rule still rely only on recording instructions that the evaluator cannot enforce.
Specifically, a must remain gated until the implementation can fail closed on:
imprecise / rounded lot area near the 1.5-acre boundary;
unclear legal-lot identity, tied lots, pending merger or re-subdivision;
R1 Variation Zone handling;
Chapter 1A handling;
whatever provenance requirements we ultimately adopt for lot-area evidence.
The proposed zoning-code-chapter code backstop is useful, but it does not resolve the other recording-only conditions.
```

**Status after review:** `pending_human`. Gated: stays pending_human until the gates below can be enforced in code or fail closed.

**Rule as decided (summary; the verbatim text above governs):**

- Source threshold: “under 1.5 acres” (memo page 2). 65,340 sq ft may be used only as an arithmetic conversion (1.5 x 43,560), never as quoted source wording.
- Disqualifying: the base zone is one of the nine FAQ Q.1 zones on a Chapter 1 parcel, and a reliably established lot area is at or above 1.5 acres.
- Consistent: the same zone condition, and a reliably established lot area below 1.5 acres.
- A zone outside the nine never produces a clearing result; it may route to judgment or to another separately reviewed SHRA pathway.
- Unknown: a rounded or imprecise lot-area record that cannot place the lot on one side of 1.5 acres (no invented tolerance); unclear lot identity (parcel versus legal-lot boundaries, tied lots, a pending or proposed merger or re-subdivision); R1 Variation Zones and Chapter 1A parcels until separately sourced.
- Page 2's “single-family zoned lots” uses the FAQ Q.1 definition it cross-references.
- Outcome ceiling unchanged.

**Before `human_verified`:**

- `lot_area_precision_fails_closed`: The evaluator fails closed on a rounded or imprecise lot area near the 1.5-acre boundary.
- `legal_lot_identity_fails_closed`: The evaluator fails closed on unclear legal-lot identity (tied lots, parcel versus legal-lot boundaries, a pending or proposed merger or re-subdivision).
- `r1_variation_zone_fails_closed`: The evaluator fails closed on R1 Variation Zones.
- `chapter_1a_fails_closed`: The evaluator fails closed on Chapter 1A parcels.
- `evidence_provenance_enforced_or_fails_closed`: The evaluator enforces, or fails closed on, the evidence provenance this decision requires (for a: whatever provenance is adopted for lot-area evidence).
- `reviewer_confirms_encoded_rule`: The reviewer checks the encoded rule against this decision before promotion.
- `human_verification_record`: The criterion carries a complete human-verification record naming the reviewer.

## b. `la_shra.prior-shra-or-sb9-map`: APPROVE WITH REVISION

Decision (verbatim):

```text
APPROVE WITH REVISION
I approve the source-backed rule that a lot recorded pursuant to SHRA or SB 9 is a documented disqualifier, and I accept the memo’s explicit exception when the relevant tentative map was never recorded.
Revise the fact semantics and clearing logic as follows:
Do not limit the blocking rule to “the map that created the lot’s current boundaries.” The captured memo does not say that. A recorded SHRA or SB 9 map associated with the lot’s history may matter.
shra_map_recorded or sb9_map_recorded may produce disqualifying_per_source only when the reviewed record clearly establishes that the legal lot being screened was recorded pursuant to that law.
If an SHRA or SB 9 map appears earlier in the parcel/lot lineage but the lot was later merged, reconfigured, or re-recorded under another authority, return requires_judgment / unknown rather than assuming either that the old restriction survives or disappears.
other_basis_map_recorded may produce consistent_with_source only after a complete reviewed map history establishes that no recorded SHRA or SB 9 map applies to the legal lot being screened.
no_map_recorded may produce consistent_with_source only after a sufficiently complete reviewed history supports that absence. A single portal result or partial search is not enough.
shra_or_sb9_tentative_map_not_recorded may produce consistent_with_source only when the reviewed evidence establishes that the relevant SHRA/SB 9 tentative map was never recorded and there is no separate recorded SHRA/SB 9 map creating the ambiguity.
If the applicable law, legal-lot identity, map lineage, recording status, or completeness of the search is uncertain, fail closed to unknown or requires_judgment.
Keep adjacency out of this criterion. The cited FAQ does not establish an adjacency restriction.
Update the existing “first value that applies” code comment so it cannot turn any historical SHRA/SB 9 reference into an automatic blocker without the required lot/map relationship being established.
The outcome ceiling stays unchanged.
I am not deciding from this memo alone whether an older SHRA/SB 9 map remains disqualifying after a later merger or re-subdivision. That remains a human-review case until the controlling statute or another official source answers it.
```

Promotion tier decision (verbatim):

```text
Confirm Tier 2 / gated.
Do not promote b based only on recorder discipline. The requirements around complete map history, legal-lot identity, applicable law, and search completeness are material to the result and are not currently enforceable.
```

**Status after review:** `pending_human`. Gated: stays pending_human until the gates below can be enforced in code or fail closed.

**Rule as decided (summary; the verbatim text above governs):**

- Disqualifying (shra_map_recorded, sb9_map_recorded): only when the reviewed record clearly establishes that the legal lot being screened was recorded pursuant to that law. The rule is not limited to the map that created the lot's current boundaries.
- An SHRA or SB 9 map earlier in the lot's lineage, with the lot later merged, reconfigured, or re-recorded under another authority: requires_judgment or unknown. Neither survival nor disappearance of the restriction is assumed.
- Consistent: other_basis_map_recorded only after a complete reviewed map history shows no recorded SHRA or SB 9 map applies to the legal lot; no_map_recorded only after a sufficiently complete reviewed history (one portal result or a partial search is not enough); shra_or_sb9_tentative_map_not_recorded only when reviewed evidence shows the relevant tentative map was never recorded and no separate recorded SHRA or SB 9 map creates doubt.
- Uncertain applicable law, legal-lot identity, map lineage, recording status, or search completeness: unknown or requires_judgment.
- Adjacency stays out of this criterion.
- The fact's former list-order comment is rewritten in this change (comment only).
- Left open: whether an older SHRA or SB 9 map still disqualifies after a later merger or re-subdivision stays a human-review case until the controlling statute or another official source answers it.
- Outcome ceiling unchanged.

**Before `human_verified`:**

- `map_history_completeness_fails_closed`: The evaluator fails closed unless the lot's map history is complete.
- `legal_lot_identity_fails_closed`: The evaluator fails closed on unclear legal-lot identity (tied lots, parcel versus legal-lot boundaries, a pending or proposed merger or re-subdivision).
- `applicable_law_fails_closed`: The evaluator fails closed when the law a map was recorded under is uncertain.
- `search_completeness_fails_closed`: The evaluator fails closed unless the map search is complete (one portal result or a partial search is not enough).
- `reviewer_confirms_encoded_rule`: The reviewer checks the encoded rule against this decision before promotion.
- `human_verification_record`: The criterion carries a complete human-verification record naming the reviewer.

**Re-review when:**

- `controlling_statute_or_official_source_on_lot_lineage_captured`: The controlling statute or another official source answers whether an older SHRA or SB 9 map survives a later merger or re-subdivision.

**Done in this change:**

- `prior_shra_or_sb9_map_fact_comment_rewritten`: The `prior-shra-or-sb9-map` fact comment in `app/src/shared/program-screen/facts.ts` no longer says values are chosen in list order (comment only; no behavior change).

## c. `la_shra.very-high-fire-hazard-severity-zone`: APPROVE WITH REVISION

Decision (verbatim):

```text
APPROVE WITH REVISION
I approve the source-backed reading that the memo places High and Very High Fire Hazard Severity Zones on the first, prohibited-site list, while fire zones do not appear on the second conditional list. I also accept the page-image reading that 42021 in the extracted text is PRC §4202 plus footnote marker 1, not section 42021.
Revise the criterion as follows:
Keep this criterion limited to Very High. High Fire Hazard Severity Zone remains criterion d.
Do not treat any City display as independently authoritative for YES or NO. Prefer the current official fire-hazard map/designation from the responsible agency. A City/ZIMAS display may corroborate it, but if the two disagree the result must be conflict, as in the fictional fixture.
YES → disqualifying_per_source only when the reviewed authoritative record clearly establishes that the relevant project site is within a Very High Fire Hazard Severity Zone.
Because this is currently a parcel screen rather than a project-footprint screen:
if the entire parcel is inside the Very High zone, YES may safely block;
if only part of the parcel is inside the zone, return unknown / requires_judgment, not a disqualifier, because the memo speaks about where the project is located and the project footprint is not modeled;
do not invent an overlap percentage or tolerance.
NO → consistent_with_source only when the authoritative current map establishes that no part of the parcel is in a Very High zone. A ZIMAS “No” by itself is not enough for a clearing result if the authoritative hazard map has not been reviewed.
Require the evidence to record the map/source identity and edition/effective date. If those are unclear, return unknown.
Footnote 1 is accepted as applying to item 3, so the criterion covers both state and local responsibility areas.
Keep the page 5 statutory-reference issue documented, but do not change the outcome ceiling from this memo alone. The memo expressly puts High and Very High fire zones in the “may not be located” list. When GCS 66499.41(a)(9) is captured, re-review this criterion for any statutory exception or condition.
Update the client-facing fact label later so it explicitly says Very High Fire Hazard Severity Zone, rather than the vague “fire-hazard designation.”
Outcome ceiling remains unchanged.
I am not approving a rule that a partial-parcel overlap automatically disqualifies the parcel, and I am not approving a City/ZIMAS display by itself as sufficient proof of absence.
```

**Status after review:** `pending_human`. Gated: stays pending_human until the gates below can be enforced in code or fail closed.

**Rule as decided (summary; the verbatim text above governs):**

- Scope: Very High only; High stays criterion d.
- Accepted: item 3 is on the memo's first list, not the conditional list; the text layer's 42021 is PRC section 4202 plus footnote marker 1; footnote 1 covers state and local responsibility areas.
- Authoritative record: the responsible agency's current official fire-hazard map or designation. A City or ZIMAS display may corroborate but never establishes YES or NO alone; if they disagree, the result is conflict.
- Disqualifying: only when the reviewed authoritative record shows the whole parcel inside a Very High zone.
- Partial overlap: unknown or requires_judgment, never a disqualifier; no overlap percentage or tolerance.
- Consistent: only when the authoritative current map shows no part of the parcel in a Very High zone.
- Map identity and edition or effective date must be recorded; if unclear, unknown.
- Outcome ceiling unchanged.

**Before `human_verified`:**

- `evidence_provenance_enforced_or_fails_closed`: The evaluator enforces, or fails closed on, the evidence provenance this decision requires (for a: whatever provenance is adopted for lot-area evidence).
- `map_identity_and_edition_recorded`: The evidence records the map or source identity and its edition or effective date, and the evaluator fails closed when it does not.
- `reviewer_confirms_encoded_rule`: The reviewer checks the encoded rule against this decision before promotion.
- `human_verification_record`: The criterion carries a complete human-verification record naming the reviewer.

**Re-review when:**

- `gcs_66499_41_a_9_captured`: GCS 66499.41(a)(9) is captured: re-review for any statutory exception, condition, or definition.

**Deferred to a later reviewed change:**

- `very_high_fire_client_label`: Reword the Very High fact's client label, now `the property's fire-hazard designation`, to name the Very High Fire Hazard Severity Zone.

## d. `la_shra.high-fire-hazard-severity-zone`: APPROVE WITH REVISION

Decision (verbatim):

```text
APPROVE WITH REVISION
I approve the source-backed reading that the memo treats High or Very High Fire Hazard Severity Zones as part of the prohibited-site list, and that criterion d should remain separate from criterion c.
Revise criterion d as follows:
Scope stays High only. Very High remains criterion c. Never infer High from the Very High fact, in either direction.
Authoritative source: use the responsible agency’s current official fire-hazard map/designation. A City/ZIMAS display may corroborate it, but cannot independently establish YES or NO. If they disagree, return conflict.
YES → disqualifying_per_source only when the reviewed authoritative record shows the whole parcel is inside a High Fire Hazard Severity Zone.
Partial overlap → unknown / requires_judgment, never a blocker. Do not invent an overlap threshold.
NO → consistent_with_source only if the authoritative map actually uses a High classification for that parcel’s applicable responsibility area and clearly shows no part of the parcel in that High class.
If the map or legend does not assign a High class for that responsibility area, do not interpret absence of a High polygon as NO. Return unknown. We should not manufacture a negative result from a classification scheme that may not contain that class.
Require the evidence to record the map/source identity, edition/effective date, responsibility area, and enough legend/context to establish whether High is a class used by that map. If any of those are unclear, return unknown.
Footnote 1 is accepted as applying to item 3, so the memo intends the restriction to reach both state and local responsibility areas. That does not by itself prove that every current map uses the same High/Very High classification scheme.
Keep the page 5 GCS 66499.41(a)(9) issue documented and re-review after the statute is captured. Do not widen the rule based on uncaptured law.
Keep the outcome ceiling unchanged.
Record as a future fact-model issue that the memo states one combined category, “High or very high fire hazard severity zones.” With separate c/d facts, a parcel partially High and partially Very High could leave both criteria unknown even if the whole parcel lies within the combined prohibited category. Do not solve that by inference in this review round. If it matters in real cases, add a separately reviewed combined-coverage fact or criterion later.
The same implementation gap identified in criterion c remains: the evaluator currently cannot distinguish an authoritative hazard map from a ZIMAS-only record. Do not mark this rule human_verified until that provenance restriction is enforceable in code or otherwise fails closed.
```

**Status after review:** `pending_human`. Gated: stays pending_human until the gates below can be enforced in code or fail closed.

**Rule as decided (summary; the verbatim text above governs):**

- Scope: High only; never inferred from the Very High fact in either direction.
- Authoritative record: the responsible agency's current official map or designation; a City or ZIMAS display may only corroborate; disagreement is conflict.
- Disqualifying: only when the authoritative record shows the whole parcel inside a High zone.
- Partial overlap: unknown or requires_judgment; no threshold.
- Consistent: only when the authoritative map uses a High class for the parcel's responsibility area and shows no part of the parcel in it. No High class in that map or legend: unknown, never NO.
- The evidence must record map identity, edition or effective date, responsibility area, and enough legend to show whether High is a class; if unclear, unknown.
- Future fact-model issue: the memo's combined High-or-Very-High category versus separate c and d facts; not solved by inference.
- Outcome ceiling unchanged.

**Before `human_verified`:**

- `evidence_provenance_enforced_or_fails_closed`: The evaluator enforces, or fails closed on, the evidence provenance this decision requires (for a: whatever provenance is adopted for lot-area evidence).
- `map_identity_and_edition_recorded`: The evidence records the map or source identity and its edition or effective date, and the evaluator fails closed when it does not.
- `responsibility_area_and_legend_recorded`: The evidence records the responsibility area and enough legend to show whether the map uses a High class, and the evaluator fails closed when it does not.
- `reviewer_confirms_encoded_rule`: The reviewer checks the encoded rule against this decision before promotion.
- `human_verification_record`: The criterion carries a complete human-verification record naming the reviewer.

**Re-review when:**

- `gcs_66499_41_a_9_captured`: GCS 66499.41(a)(9) is captured: re-review for any statutory exception, condition, or definition.

**Deferred to a later reviewed change:**

- `combined_high_or_very_high_coverage_fact_if_needed`: If real cases need it, add a separately reviewed combined High-or-Very-High coverage fact or criterion.

## e. `la_shra.prime-or-statewide-farmland`: KEEP PENDING

Decision (verbatim):

```text
KEEP PENDING
I accept the source proposition that the SHRA memo places Prime Farmland and Farmland of Statewide Importance on the first prohibited-site list.
I am not approving a deterministic parcel rule yet.
Reasons:
The captured memo does not identify the authoritative agency, map, dataset, edition, or statutory definition that establishes whether a parcel is in either category.
Because the authoritative record has not been captured and approved, even the proposed YES → disqualifying_per_source direction is not ready to become human_verified. We know what the memo says about the category, but not yet what evidence PermitPulse may safely rely on to establish the category for a parcel.
Do not allow a ZIMAS field, generic GIS layer, search result, or manually chosen farmland map to create the blocking result merely because its terminology looks similar.
Keep partial-parcel coverage unknown / requires judgment. Do not invent an overlap threshold.
NO must never produce consistent_with_source from the current evidence model.
Keep the current block-only proposal as a candidate design, but leave the criterion pending_human until we capture and review an official source that:
defines Prime Farmland and Farmland of Statewide Importance;
identifies or supports the authoritative parcel-level record/map;
lets us determine what map edition/date should be used; and
clarifies, if necessary, how site/parcel overlap is treated.
Re-review the page 5 GCS 66499.41(a)(9) reference when the statute is captured, because it may add conditions or definitions relevant to this criterion.
Do not widen the outcome ceiling or remove the criterion. The memo itself supports keeping it in the model; the unresolved issue is how the parcel fact is established.
So the distinction is:
Source proposition: accepted.
Deterministic evidence rule: not approved yet.
Status: KEEP PENDING.
```

**Status after review:** `pending_human`. Pending: stays pending_human until the missing official record is captured and reviewed.

**Rule as decided (summary; the verbatim text above governs):**

- Source proposition accepted: the memo places both farmland categories on the first list.
- No deterministic evidence rule is in force; the block-only design stays a candidate.
- Before re-review, capture and review an official source that defines both categories, identifies or supports the authoritative parcel-level record or map, fixes the map edition or date, and clarifies overlap if necessary.
- A ZIMAS field, generic GIS layer, search result, or hand-picked map with similar wording never blocks.
- Partial coverage stays unknown or requires judgment; NO never clears.
- Outcome ceiling unchanged; the criterion is not removed.

**Before `human_verified`:**

- `defining_official_source_captured`: An official source defining the category and supporting the parcel-level record is captured and reviewed.
- `evidence_provenance_enforced_or_fails_closed`: The evaluator enforces, or fails closed on, the evidence provenance this decision requires (for a: whatever provenance is adopted for lot-area evidence).
- `reviewer_confirms_encoded_rule`: The reviewer checks the encoded rule against this decision before promotion.
- `human_verification_record`: The criterion carries a complete human-verification record naming the reviewer.

**Re-review when:**

- `gcs_66499_41_a_9_captured`: GCS 66499.41(a)(9) is captured: re-review for any statutory exception, condition, or definition.

## f. `la_shra.natural-community-conservation-plan-land`: APPROVE WITH REVISION

Decision (verbatim):

```text
APPROVE WITH REVISION
I approve the source-backed proposition and the block-only design for la_shra.natural-community-conservation-plan-land, subject to the following revisions and implementation gate.
The authoritative record is the adopted natural community conservation plan itself, including its official adopted maps, exhibits, or text. A City/ZIMAS display may corroborate the plan but cannot establish the fact independently.
YES → disqualifying_per_source only when reviewed evidence establishes all of the following:
the document is an adopted natural community conservation plan;
its adoption status is established;
the applicable map/text is identified and dated;
the plan itself identifies the relevant land for conservation; and
the whole parcel being screened is within that identified land.
If only part of the parcel is identified for conservation, return unknown / requires_judgment. The memo speaks to where the project is located, while the Program Screen currently models the parcel rather than the project footprint. Do not invent an overlap threshold.
If determining whether a plan label means “identified for conservation” requires interpretation rather than explicit plan language or mapping, return unknown / requires judgment.
A draft, proposed, pending, expired, superseded, or otherwise unconfirmed plan cannot produce a blocking result. If current adoption status cannot be established, return unknown.
NO must not produce consistent_with_source at this stage. Absence can only be used as a clearing result after we have an approved method for establishing that all applicable adopted NCCPs covering the parcel were checked.
Do not require that PermitPulse already contain a master list of every NCCP before this rule can exist. The memo itself identifies the controlling record type. However, an actual parcel result cannot block unless the particular adopted plan and its applicable map/text have been captured and reviewed.
Keep the page 5 GCS 66499.41(a)(9) issue documented and re-review after that statute is captured.
Keep the outcome ceiling unchanged.
Implementation gate: do not mark this criterion human_verified until the evaluator can enforce, or otherwise fail closed on, provenance showing that YES came from the adopted plan itself rather than from a ZIMAS field, generic GIS layer, or unsupported secondary source.
This differs from criterion e: farmland stays pending because the captured source does not identify the defining record at all. Here, the memo expressly identifies an adopted natural community conservation plan as the relevant record, so the blocking direction is reviewable once provenance is enforced.
```

**Status after review:** `pending_human`. Gated: stays pending_human until the gates below can be enforced in code or fail closed.

**Rule as decided (summary; the verbatim text above governs):**

- Authoritative record: the adopted natural community conservation plan itself (its official adopted maps, exhibits, or text). A City or ZIMAS display may corroborate but never establishes the fact.
- Disqualifying only when reviewed evidence establishes all five: an adopted plan; its adoption status; the applicable map or text, identified and dated; the plan itself identifies the land for conservation; the whole parcel lies within that land.
- Unknown or judgment: partial identification (no threshold); a label that needs interpretation; a draft, proposed, pending, expired, superseded, or unconfirmed plan; adoption status that cannot be established.
- NO never clears until there is a reviewed and accepted method for showing that every applicable adopted plan covering the parcel was checked.
- No master list of plans is required for the rule to exist, but a parcel cannot block until its particular plan and map or text have been captured and reviewed.
- Outcome ceiling unchanged.

**Before `human_verified`:**

- `evidence_provenance_enforced_or_fails_closed`: The evaluator enforces, or fails closed on, the evidence provenance this decision requires (for a: whatever provenance is adopted for lot-area evidence).
- `adopted_plan_identity_adoption_and_map_date_recorded`: The evidence records the adopted plan's identity, adoption status, and the dated map or text, and the evaluator fails closed when it does not.
- `reviewer_confirms_encoded_rule`: The reviewer checks the encoded rule against this decision before promotion.
- `human_verification_record`: The criterion carries a complete human-verification record naming the reviewer.

**Re-review when:**

- `gcs_66499_41_a_9_captured`: GCS 66499.41(a)(9) is captured: re-review for any statutory exception, condition, or definition.

## g. `la_shra.conservation-easement`: APPROVE WITH REVISION

Decision (verbatim):

```text
APPROVE WITH REVISION
I approve the source-backed proposition and a block-only design for la_shra.conservation-easement, subject to these revisions:
Preserve the source proposition exactly as “lands under a conservation easement.” Do not rewrite the legal/source rule as requiring a “recorded” conservation easement, because the memo does not use that word.
For PermitPulse’s deterministic evidence rule, an explicit recorded instrument may be used as a conservative sufficient basis for YES. That is an evidence standard, not a claim that only recorded easements can satisfy the memo.
YES → disqualifying_per_source only when reviewed evidence establishes all of the following:
an identifiable instrument expressly creates or establishes a conservation easement;
the instrument applies to the parcel being screened;
the easement is still in force, with no reviewed release/extinguishment that defeats it;
the whole parcel is covered by the easement.
If deciding whether an instrument is actually a conservation easement requires interpretation, rather than explicit language, return unknown / requires_judgment.
If only part of the parcel is covered, return unknown / requires judgment. The memo speaks about where the project is located, while the Program Screen currently models the parcel rather than the project footprint. Do not invent an overlap threshold.
If release, termination, extinguishment, parcel identity, instrument identity, or coverage cannot be established, return unknown.
A ZIMAS field, title summary, GIS layer, or other secondary source may corroborate the instrument but cannot independently establish YES.
NO must never produce consistent_with_source under the current fact model. A negative result would require a reviewed method for establishing that the relevant title/easement history was sufficiently complete.
Change the client-facing label later so it does not imply that “recorded” is part of the memo’s legal standard. Something like “whether the parcel is under a conservation easement” is closer to the source.
Keep the page 5 GCS 66499.41(a)(9) issue documented and re-review when that statute is captured.
Keep the outcome ceiling unchanged.
Implementation gate: do not mark this criterion human_verified until provenance can be enforced, or otherwise fails closed, so that a blocking YES cannot come from ZIMAS or another unsupported secondary record.
This approval is deliberately one-directional: an explicit, reviewed, in-force conservation easement can support a blocker; absence of such evidence cannot clear the parcel.
```

**Status after review:** `pending_human`. Gated: stays pending_human until the gates below can be enforced in code or fail closed.

**Rule as decided (summary; the verbatim text above governs):**

- Source proposition kept exactly: “Lands under a conservation easement”. The rule is never restated as requiring a recorded easement.
- Evidence standard: an explicit recorded instrument may be a conservative sufficient basis for YES; that is not a claim that only recorded easements meet the memo.
- Disqualifying only when reviewed evidence establishes all four: an identifiable instrument expressly creates a conservation easement; it applies to the parcel; it is still in force; it covers the whole parcel.
- Unknown or judgment: an instrument that needs interpretation; partial coverage (no threshold); release, termination, extinguishment, parcel identity, instrument identity, or coverage that cannot be established.
- A ZIMAS field, title summary, GIS layer, or other secondary source may corroborate but never establishes YES.
- NO never clears under the current fact model.
- Outcome ceiling unchanged.

**Before `human_verified`:**

- `evidence_provenance_enforced_or_fails_closed`: The evaluator enforces, or fails closed on, the evidence provenance this decision requires (for a: whatever provenance is adopted for lot-area evidence).
- `instrument_identity_in_force_status_and_coverage_recorded`: The evidence records the instrument's identity, that it is in force, and its coverage, and the evaluator fails closed when it does not.
- `reviewer_confirms_encoded_rule`: The reviewer checks the encoded rule against this decision before promotion.
- `human_verification_record`: The criterion carries a complete human-verification record naming the reviewer.

**Re-review when:**

- `gcs_66499_41_a_9_captured`: GCS 66499.41(a)(9) is captured: re-review for any statutory exception, condition, or definition.

**Deferred to a later reviewed change:**

- `conservation_easement_client_label`: Reword the conservation-easement client label so it does not imply that recorded is part of the memo's standard.

## h. `la_sb79.permanent-exemption-shown`: KEEP PENDING

Decision (verbatim):

```text
KEEP PENDING
I accept the source proposition that Ordinance 188968 creates permanent SB 79 exemptions under Section 1 and authorizes the Director of Planning under Section 3 to issue and update maps showing permanent or temporary exemption status.
I am not approving a deterministic parcel rule yet.
Reasons:
The Director’s issued §3 map is not captured in the repo.
Ordinance 188968 itself contains no parcel-level map, exhibit, schedule, or parcel list, so the ordinance alone cannot establish that a specific parcel is permanently exempt.
The page 3 recital describing a draft map that identified all of the City as “eligible for permanent and temporary exemption” is not sufficient evidence of permanent exemption for a parcel.
A combined map or layer that does not distinguish permanent from temporary exemption cannot produce a YES for this criterion.
A real YES → disqualifying_per_source may only be considered after the Director’s issued map is captured and reviewed and it affirmatively identifies the parcel as permanently exempt under Section 1.
NO must never produce consistent_with_source under the current evidence. Failure to appear on a map does not establish that the parcel is not permanently exempt.
A ZIMAS “covered / not covered” display is not enough because the captured ordinance does not establish that this display independently distinguishes permanent exemption from temporary exemption.
Keep the existing outcome ceiling:
disqualifying_per_source
requires_judgment
never consistent_with_source
Keep the criterion pending_human until we have captured and reviewed:
the Director’s actual issued §3 map;
its publication/version date;
its legend;
whether it distinguishes permanent from temporary status;
whether it identifies permanent exemption parcel by parcel.
Do not use the fictional fixture ps-sb79-permanent-exclusion as evidence for a real parcel. It remains test data only.
If the eventual map uses wording such as “eligible for exemption” rather than affirmatively “permanently exempt,” re-review the rule before allowing it to block.
Status: KEEP PENDING.
The source proposition is accepted; the missing piece is the parcel-level authoritative record.
```

**Status after review:** `pending_human`. Pending: stays pending_human until the missing official record is captured and reviewed.

**Rule as decided (summary; the verbatim text above governs):**

- Source proposition accepted: Ordinance 188968 Section 1 creates permanent SB 79 exemptions, and Section 3 authorizes the Director of Planning to issue and update maps of permanent or temporary exemption status.
- No deterministic parcel rule is in force.
- Not enough for YES: the ordinance alone; the page 3 draft-map recital; a combined permanent-and-temporary layer; a ZIMAS covered or not covered display.
- Before re-review, capture and review the Director's issued Section 3 map, its publication or version date, its legend, whether it separates permanent from temporary status, and whether it identifies permanent exemption parcel by parcel.
- NO never clears. The fictional fixture record ps-sb79-permanent-exclusion stays test data only.
- If the issued map describes parcels with exemption wording other than permanently exempt, re-review the rule before it may block.
- Outcome ceiling unchanged: disqualifying_per_source and requires_judgment, never consistent_with_source.

**Before `human_verified`:**

- `directors_section_3_map_captured`: The Director's issued Section 3 map is captured and reviewed, with its publication or version date and legend, showing whether it separates permanent from temporary status and identifies permanent exemption parcel by parcel.
- `reviewer_confirms_encoded_rule`: The reviewer checks the encoded rule against this decision before promotion.
- `human_verification_record`: The criterion carries a complete human-verification record naming the reviewer.

**Re-review when:**

- `directors_map_wording_not_permanently_exempt`: The issued map uses exemption wording other than permanently exempt: re-review before the rule may block.

## Preparer notes (not reviewer decisions)

- Partial-coverage handling for c, d, f, and g (a parcel only partly inside the zone, plan land, or easement) can only be recorded as unknown today; the yes/no facts have no way to carry it. The provenance design branch should cover it alongside the provenance gates.
- The Round 1 manifest's recording instruction for b (the map that created the lot's current boundaries) was not adopted; decision b above governs.
- The Round 1 manifest marked a and b as candidates that could run in both directions. Both are gated by the promotion tier decisions above.
- Dates: the packet and manifest show 2026-09-28 as their preparation date, in UTC. In Los Angeles time they were prepared, reviewed, and decided on 2026-09-27.
