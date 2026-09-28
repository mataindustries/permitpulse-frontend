# Program Screen evidence authority (Phase 2)

Phase 2 adds the infrastructure that lets the Program Screen tell apart:

- an **establishing** record: one a reviewed policy accepts as able to establish a parcel fact;
- a **corroborating or secondary** record, such as a ZIMAS display, which still takes part in conflict detection but can never establish a gated fact by itself;
- an **unattested, incomplete, or unsupported** record, which can never drive a deterministic result.

This change is infrastructure only. It promotes nothing and registers no real authority:

- `human_verified` = 0, `pending_human` = 46; no criterion is promoted;
- no issuing authority and no authority source is registered; every fact policy's establishing list is empty;
- no outcome ceiling, fact key, fact label, predicate, or source-capture host changes;
- no worker, database, or client integration;
- the evaluator and public-demo output hashes are byte-identical (`app/tests/program-screen-authority.test.ts`, section 10, and the existing Round 1 pin).

The Round 1 decisions that set these requirements are recorded in `docs/PROGRAM_SCREEN_HUMAN_REVIEW_ROUND_1_DECISIONS.md`.

## Design review decisions (verbatim)

Decided in the Phase 2 design review, as given:

```text
D1 — APPROVE.
Keep authority metadata as a sidecar keyed by evidence_id. Do not extend the shared canonical evidence record.
D2 — APPROVE.
Run the authority gate after the existing unreviewed/pending checks so currently pending criteria preserve their exact production output.
D3 — APPROVE.
A valid-but-insufficient authority record fails closed to unknown, not unreviewed.
Distinguish this from malformed authority metadata:
no sidecar / unreviewed / incomplete / stale / unsupported / unregistered → unknown
structurally malformed, contradictory, duplicated, or falsely linked authority block → INVALID_PROGRAM_EVIDENCE_AUTHORITY
D4 — APPROVE for Phase 2.
Keep Layer 1 conflict behavior unchanged. Secondary, stale, superseded, or otherwise non-establishing records still participate in conflict detection. The new gate must never erase or resolve an existing conflict.
D5 — REJECT the proposed ± last-printed-unit rule.
Do not invent a numerical uncertainty interval, rounding tolerance, significant-figure rule, or ± one-unit envelope.
Use the Round 1 decision literally:
authoritative threshold: under 1.5 acres
65,340 sq ft is only the exact arithmetic conversion
an exact, approved authoritative area may be compared directly
approximate, rounded, estimated, unsupported GIS-calculated, or otherwise boundary-uncertain area → unknown
deciding what level of numerical precision is acceptable beyond that requires another human review
Remove the current D5 proposal from the implementation.
D6 — APPROVE, narrowly.
Exact comparison against the nine reviewed base zones may act only as a refusal/tripwire. Do not parse or normalize zoning strings. R1 variations, suffixes, supplements, or anything not explicitly approved fail closed to unknown/judgment.
D7 — APPROVE: apply the promotion guard to all 46 atomic criteria.
No atomic criterion may become human_verified unless it has an explicit reviewed authority-requirement entry, even if that entry later says authority gating is not applicable for that criterion.
This is a promotion-safety requirement, not permission to populate authorities.
D8 — APPROVE.
Include e and h as deny-by-default entries now. They remain pending_human.
D9 — DEFER.
Do not add a new split-zoning rule in Phase 2. Round 1 did not separately review split-zoned parcel semantics. Fail closed through existing uncertainty mechanisms if encountered, and list explicit split-zoning behavior as a future review item.
D10 — APPROVE.
Real parcel instruments/maps and case-specific evidence belong in a case-scoped/private evidence store, not committed into the public repo.
D11 — APPROVE.
Future non-City hosts must be enabled through reviewed per-source/per-authority exceptions. Do not broaden the global allowlist.
D12 — APPROVE.
Use one authority policy per fact across pathways. Program-specific applicability and scope checks remain criterion-level.
```

## Two layers

**Layer 1 (unchanged).** The canonical Case Integrity evaluator assesses each fact from every record: establishing, secondary, stale, superseded, or unattested alike. It alone decides `conflict`, `unknown`, or an established value (D4).

**Layer 2 (new).** The authority gate (`app/src/shared/program-screen/authority-gate.ts`) runs only for a criterion with an **enforced** authority requirement, and only after every earlier check passed (D2). Criterion status precedence is now:

| Step | Condition | Status |
| --- | --- | --- |
| 1 | any required fact in conflict | `conflict` |
| 2 | any required fact unknown or inference only | `unknown` |
| 3 | professional-judgment criterion | `professional` |
| 4 | rule pending (including any unmet promotion gate), not encoded, or evidence unreviewed | `unreviewed` |
| 5 | **enforced authority requirement not met** | **`unknown`** |
| 6 | predicate, checked against its outcome ceiling | its outcome |

Because every criterion with an authority requirement is still pending, step 5 is unreachable in production. When it is reached, it can only turn a would-be result into `unknown` (D3). It never sees a conflicted or unknown fact, never changes a fact, and never reads free text. A criterion result carries an `authority` field only when the gate ran, so every other result is byte-identical.

For each fact the criterion reads, at least one record carrying the recorded value must be **establishing**. Whether it is establishing is worked out from the registries, never declared on the record.

## The authority sidecar (D1)

Canonical evidence records are unchanged. `evaluateProgramScreen` takes an optional `evidence_authority` list: one block per `evidence_id` (`app/src/shared/program-screen/evidence-authority.ts`). A block records:

| Field | Meaning |
| --- | --- |
| `record_kind` | What the record is (agency hazard map, adopted plan document, recorded instrument, City parcel display, and so on). Declared and reviewed; never authorizing by itself. |
| `issuer` | Name as printed (display only) and a registry `issuer_id`, or null. |
| `source_identifier` | A registered authority source ID, a recorder document number, a map book and page, a City case number, or a portal URL only. |
| `document_title`, `edition` | Title (display only); edition label, date and date kind, currency on the screen date, and when currency was checked. |
| `retrieved_at`, `source_url` | Must equal the canonical record's. |
| `capture` | A pinned repo capture, a case-store file (D10; not yet supported, fails closed), or null. |
| `parcel_relationship` | How the record was matched to the parcel, and whether the parcel is one legal lot. |
| `coverage` | Whole parcel, partial, none, not applicable, or not established. |
| `qualifiers` | Fact-family details: lot area, zone record, map history, hazard map, adopted plan, or recorded instrument. |
| `authority_review` | Reviewed or unreviewed, with a human reviewer and date. |
| `notes`, `is_ai_generated: false` | Notes are display only. |

**Rejected with `INVALID_PROGRAM_EVIDENCE_AUTHORITY`** (malformed, contradictory, duplicated, or falsely linked):

- a sidecar that is not a list; a missing or extra field; `is_ai_generated` not false; a non-human reviewer;
- two blocks for one record; a block for a record that was not supplied;
- `fact_key`, `retrieved_at`, or `source_url` that differs from the record;
- a record kind the record's evidence type cannot be;
- qualifiers of the wrong family, or a High block on the Very High fact (or the reverse);
- coverage that contradicts the value: on a coverage fact YES is whole parcel only and NO is none of the parcel only, and partial or unestablished coverage must carry an unknown value; other facts record coverage as not applicable;
- a High YES with a legend that defines no High class;
- a zone value that contradicts `zone_match` (an unresolved zone is recorded as unknown);
- a lot area that is not the exact arithmetic conversion of the figure as recorded;
- a reviewed block without reviewer and date, or an unreviewed block naming one; a review before retrieval; an edition date without its kind; an authority source ID that is not a registry ID.

**Leaves the criterion `unknown`** (valid but insufficient): no block, an unreviewed block, incomplete provenance, a stale or superseded edition, an unregistered issuer or source, an unsupported kind or value, or any family check that does not pass.

## Registries (deny-by-default)

`app/src/shared/program-screen/authority-policy.ts` holds four registries. Tests may pass TEST-ONLY registries the way they pass `packs`; the shipped ones are:

| Registry | Shipped contents |
| --- | --- |
| `issuers` | none |
| `sources` | none |
| `fact_policies` | Ten deny entries (`establishing: []`): `lot-area`, `shra-zone-category`, `zoning-code-chapter` (a); `prior-shra-or-sb9-map` (b); `very-high-fire-hazard-severity-zone` (c); `high-fire-hazard-severity-zone` (d); `prime-or-statewide-farmland` (e); `nccp-conservation-land` (f); `conservation-easement` (g); `sb79-permanent-exemption-shown` (h). |
| `criterion_requirements` | Eight enforced entries, one per Round 1 criterion a-h (e and h included per D8), each listing its decision's promotion gates. |

A fact policy is shared by every pathway that reads the fact (D12). Criterion requirements hold program-specific checks: scope preconditions and declared thresholds.

Reviewer rulings are pinned in code, and the registry schema rejects a registry that breaks them:

| Rule | Source |
| --- | --- |
| A City parcel display can never establish c, d, e, f, g, or h. | Decisions c, d, e, f, g, h |
| Also prohibited: generic GIS layer and search result (e); generic GIS layer and other secondary source (f); title summary, generic GIS layer, and other secondary source (g). | Decisions e, f, g |
| NO can never be established for e, f, g, h. | Decisions e, f, g, h |
| The High policy must require the map legend to define a High class for the parcel's responsibility area. | Decision d |
| A registered source needs a registered issuer, a pinned capture, and a human review; an establishing entry naming a registered source needs a currency window. | Round 1 provenance gates |
| A map-history or instrument policy must name its required search repositories before it can establish anything. | Decisions b, g |
| A declared threshold's fact-unit value must be the exact arithmetic conversion of the source figure. | D5 |

## Criterion-specific checks

**a. Single-family lot area.** Lot area is established only by an exact area (`area_precision: exact`) on an accepted basis (none accepted yet), with the parcel recorded as one legal lot. Approximate, rounded, estimated, unestablished-precision, unaccepted-basis (such as GIS-calculated), or unclear legal-lot identity leaves it unknown. No interval, tolerance, or significant-figure rule exists (D5): an exact area is compared directly. The requirement declares the threshold as the memo words it (“under 1.5 acres”); 65,340 sq ft is recorded only as its exact arithmetic conversion. What numeric precision is acceptable beyond an exact figure needs another human review.

The zone category is established only when the recorded base zone string is exactly one of the nine zones the memo lists (A1, A2, RA, RE, RS, R1, RU, RZ, RW1). This exact match can only refuse (D6). Zoning strings are never parsed or normalized; R1 variations, suffixes, supplements, whitespace, or case differences fail closed.

The requirement also names a Chapter 1 precondition. The criterion does not read `zoning-code-chapter` yet, so the gate reports `requirement_fact_not_read` and the `chapter_1a_fails_closed` gate stays unmet until a reviewed change adds the input.

Split-zoned parcels have no rule of their own (D9). They fail closed through existing uncertainty, since an unresolved zone is recorded as unknown. Explicit split-zoning behavior is a future review item.

**b. Prior SHRA or SB 9 map.** Requires:

- the parcel recorded as one legal lot;
- a complete reviewed search covering every required repository within the age window (none registered yet);
- every map's statute, recording status, and relation to the lot established.

A lineage change after an SHRA or SB 9 map, or an uncertain lineage, gives unknown. Each value needs map history that supports it; adjacency is never read. A parcel's own maps are verified against the case-scoped private store (D10), which is not built yet, so no map-history record can establish b today even when every other check passes.

**c. Very High Fire Hazard Severity Zone.** Requires:

- a registered agency hazard map (a specific edition, captured and reviewed, not superseded) whose edition date is recorded and current;
- a map that covers the parcel's responsibility area.

YES is whole parcel only and NO is none of the parcel only; partial coverage is unknown.

**d. High Fire Hazard Severity Zone.** Everything in c, plus the legend must define a High class for the area. A map without that class never yields NO. High and Very High never stand in for each other.

**f. Natural community conservation plan.** Requires:

- a registered adopted plan document (the particular plan and its map or text) whose status is adopted and in effect, checked within the window;
- adoption reference, adoption date, and map or text reference recorded;
- identification by explicit plan language or map;
- coverage of the whole parcel.

NO is never established.

**g. Conservation easement.** Requires:

- an identifiable instrument: document number, recording date, registered issuer, and a verified capture;
- express conservation-easement language;
- no release or extinguishment of record, backed by a complete release search;
- coverage of the whole parcel.

NO is never established. Like b, the instrument is verified against the case-scoped private store (D10), which is not built yet, so no instrument can establish g today.

**e and h** stay deny-by-default with their pinned prohibitions (D8). They are not unlockable until their defining sources are captured.

## Promotion guard (D7)

An atomic criterion (one of the 46) waits — it runs no rule and stays release-blocking — while `criterionPromotionBlockers` is non-empty, even with a complete human-verification record. With no reviewed authority requirement the blocker is `authority_requirement_missing`. A requirement may later say authority gating does not apply (`applicability: not_applicable`), but it must still be a reviewed entry with a decision reference, and it cannot claim the provenance gate.

Each promotion gate is computed from the registries and the criterion, never from a note:

| Gate | Met only when |
| --- | --- |
| `evidence_provenance_enforced_or_fails_closed` | the requirement is enforced and every fact the criterion reads has at least one establishing entry |
| `map_identity_and_edition_recorded` | every such entry names a registered source and a currency window |
| `responsibility_area_and_legend_recorded` | a hazard-map policy the criterion reads requires the legend class and can establish |
| `lot_area_precision_fails_closed` | the criterion reads `lot-area`, its policy can establish, and the requirement declares the threshold |
| `legal_lot_identity_fails_closed` | every lot-area or prior-map fact read requires legal-lot identity and can establish |
| `r1_variation_zone_fails_closed` | the criterion reads the zone category under a zone-record policy that can establish |
| `chapter_1a_fails_closed` | the criterion reads `zoning-code-chapter`, its policy can establish, and the requirement has the Chapter 1 precondition |
| `map_history_completeness_…`, `search_completeness_…`, `applicable_law_fails_closed` | the prior-map policy can establish and names required repositories and an age window |
| `adopted_plan_identity_adoption_and_map_date_recorded` | the plan policy can establish from registered sources with a currency window |
| `instrument_identity_in_force_status_and_coverage_recorded` | the easement policy can establish and names required release-search repositories |
| `defining_official_source_captured` | a live registered source exists for every fact the criterion reads |
| `directors_section_3_map_captured` | a live registered Director-issued map exists for a fact the criterion reads |
| `reviewer_confirms_encoded_rule` | the human-verification record's `decision_ref` matches the requirement's |
| `human_verification_record` | the criterion carries a complete human-verification record |

Today every gate of every Round 1 criterion is unmet, and the 38 other atomic criteria have no requirement.

## Unlocking a criterion later (Phase 3, one reviewed change each)

1. Capture and review the authority source (Phase 2b capture extensions, `docs/PROGRAM_SCREEN_SOURCE_CAPTURE_2B.md`; D11 host exceptions per source). `authoritySourceCaptureIssues` must report nothing for the capture before it is registered.
2. Register the issuer and source, and populate the fact policy, in a reviewed change.
3. Encode the predicate the decision approved, inside the unchanged outcome ceiling.
4. Add a human-verification record whose `decision_ref` matches the requirement.
5. Confirm `criterionPromotionBlockers` is empty, and deliberately re-pin the output hashes.

## Not in Phase 2

- Source-capture extensions. Phase 2b (`docs/PROGRAM_SCREEN_SOURCE_CAPTURE_2B.md`) since added agency maps, a statute source type for GCS 66499.41(a)(9), and per-source host exceptions (D11, shipped empty). Adopted plans, recorded instruments, and Director-issued maps remain later phases.
- The case-scoped private evidence store for real parcel instruments and maps (D10).
- Explicit split-zoning behavior (D9).
- The numeric precision acceptable beyond an exact area (D5).
- Deferred from Round 1: an optional sixth value for b; the Very High and conservation-easement client-label cleanups; moving ZIMAS fire data to observation-only; a combined High-or-Very-High coverage fact; farmland authority research (e); capture of the SB 79 Director Section 3 map (h).
