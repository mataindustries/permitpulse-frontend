# Program Screen criterion verification ledger

Scope: the City of Los Angeles Program Screen criteria that were `pending_human` when the core shipped (PR #15), now split into atomic criteria.

Passes:

- **2026-09-27, criterion-verification pass (PR #16).** Added the human-verification gate. Nothing verified.
- **2026-09-27, official-source capture tooling (PR #17).** Added capture tooling, capture integrity checks, the draft-versus-operative guard, and one proposed verification target per criterion. No official source captured. Nothing verified.
- **2026-09-27, official-source capture (PR #18).** Captured the four official PDFs the repository owner supplied, with the existing capture tool. Filled all nine proposals with candidate pages, pinpoints, excerpts, and proposed splits, and moved them to `awaiting_human_review`. Nothing verified.
- **2026-09-27, atomic criterion split (this branch).** Retired the nine broad criteria and shipped 46 atomic criteria in their place, each resting on one proposition in a captured operative source. Added a data class to every fact, retired ten fact keys, migrated the fictional fixture explicitly, and rebuilt the nine proposals around the atomic IDs. Nothing verified.

## Outcome

| Result | Criteria |
| --- | --- |
| A. `human_verified` and encoded | **None** |
| B. `pending_human` | **All 46 atomic criteria**: 36 with the rule not encoded (status `unreviewed` whenever their facts are established) and 10 professional judgment (status `professional`). Every one carries a `pending_human_criterion` release blocker. |
| C. Removed or narrowed | **The nine broad criteria are retired** (their IDs are rejected by the criterion schema). Ten fact keys are retired. The zoning string, RSO status, and the ZIMAS program fields are source observations, and occupancy history, the structure count, and the generic historic designation are professional input; no rule may read any of them. |
| Official sources captured | **Four**: `ordinance-188967`, `ordinance-188968`, `shra-2025-10-28` (operative), and `low-rise-draft-2026-09-24` (proposed draft, not operative). Unchanged in this pass. |
| Proposed verification records | **Nine**, one per retired criterion, all `awaiting_human_review`, with 58 components: 46 shipped atomic criteria, 7 recorded as having no rule in the source, and 5 recorded as outside the screen. No reviewer, no review date. |

Nothing in this ledger is a verification. The captures pin what the City's documents say; the atomic split and the proposals are one preparer's reading for a named human reviewer to accept, change, or reject. The fictional Program Screen fixture and the public demo stay non-releasable, now with 46 `pending_human_criterion` blockers.

## Atomic criterion model

Each atomic criterion:

- quotes one proposition from one captured operative source (`basis.repo_path` is the capture's `extracted.txt`; every excerpt is checked on its page by the tests) and cites it with a pinpoint;
- reads one controlled fact, or a tightly coupled set (a Fire Restriction Area is a Very High zone and a Hillside Area), or no fact at all when the source's test is an analysis no parcel record holds (8 professional-judgment criteria);
- declares `permitted_outcomes`, the only outcomes its rule may ever return, now or once verified. `requires_judgment` is always permitted. The schema enforces it, and the evaluator rejects any other outcome even for callers that skip validation (`PREDICATE_OUTCOME_NOT_PERMITTED`). This is how a one-direction criterion stays one-direction;
- declares `exception_paths`, the source exceptions that can override its blocking direction. A criterion may permit `disqualifying_per_source` only if every exception names a fact and the criterion reads it. No exception has a modeled fact yet, so no criterion with an exception can block;
- stays `pending_human`: a rule that is not encoded never runs, and a professional-judgment criterion only routes to Planning. Both block release.

The two predicate kinds are chosen by the source, not by convenience: professional judgment where the source's test turns on the project, a site analysis, or a legal definition; rule not encoded where the source states a test that a verified rule might encode.

### Old criteria to atomic criteria

| Retired criterion | Atomic criterion | Kind | May return (ceiling) |
| --- | --- | --- | --- |
| `la_shra.lot-area-and-zoning` | `la_shra.zone-category` | rule not encoded | consistent, judgment |
|  | `la_shra.multifamily-lot-area-threshold` | rule not encoded | consistent, judgment |
|  | `la_shra.single-family-lot-area-threshold` | rule not encoded | consistent, blocking, judgment |
|  | `la_shra.single-family-vacancy-condition` | rule not encoded | consistent, judgment |
| `la_shra.existing-structures-and-occupancy` | `la_shra.protected-housing-demolition-or-alteration` | professional judgment | judgment |
|  | `la_shra.protected-housing-affordability-covenant` | rule not encoded | consistent, judgment |
|  | `la_shra.protected-housing-price-control` | rule not encoded | consistent, judgment |
|  | `la_shra.protected-housing-tenant-occupancy` | professional judgment | judgment |
|  | `la_shra.ellis-act-withdrawal` | rule not encoded | consistent, judgment |
| `la_shra.prior-subdivisions` | `la_shra.prior-shra-or-sb9-map` | rule not encoded | consistent, blocking, judgment |
| `la_shra.housing-element-site-status` | `la_shra.housing-element-projected-units` | rule not encoded | consistent, judgment |
|  | `la_shra.housing-element-lower-income-units` | rule not encoded | consistent, judgment |
| `la_shra.environmental-constraints` | `la_shra.very-high-fire-hazard-severity-zone` | rule not encoded | consistent, blocking, judgment |
|  | `la_shra.high-fire-hazard-severity-zone` | rule not encoded | consistent, blocking, judgment |
|  | `la_shra.prime-or-statewide-farmland` | rule not encoded | consistent, blocking, judgment |
|  | `la_shra.wetlands` | rule not encoded | blocking, judgment |
|  | `la_shra.natural-community-conservation-plan-land` | rule not encoded | consistent, blocking, judgment |
|  | `la_shra.protected-species-habitat` | professional judgment | judgment |
|  | `la_shra.conservation-easement` | rule not encoded | consistent, blocking, judgment |
|  | `la_shra.hazardous-waste-site` | rule not encoded | consistent, judgment |
|  | `la_shra.special-flood-hazard-area` | rule not encoded | consistent, judgment |
|  | `la_shra.regulatory-floodway` | rule not encoded | consistent, judgment |
|  | `la_shra.earthquake-fault-zone` | rule not encoded | consistent, judgment |
| `la_sb79.permanent-exclusion` | `la_sb79.permanent-exemption-shown` | rule not encoded | blocking, judgment |
|  | `la_sb79.permanent-exemption-walking-path` | professional judgment | judgment |
|  | `la_sb79.permanent-exemption-industrial-hub` | professional judgment | judgment |
| `la_sb79.temporary-exemption` | `la_sb79.temporary-exemption-all-parcels` | rule not encoded | judgment |
|  | `la_sb79.temporary-exemption-period` | rule not encoded | consistent, judgment |
|  | `la_sb79.temporary-exemption-shown` | rule not encoded | judgment |
|  | `la_sb79.temporary-exemption-capacity-criteria` | professional judgment | judgment |
|  | `la_sb79.temporary-exemption-tod-alternative-plan` | rule not encoded | consistent, judgment |
|  | `la_sb79.temporary-exemption-fire-or-state-responsibility-area` | rule not encoded | consistent, judgment |
|  | `la_sb79.temporary-exemption-sea-level-rise` | rule not encoded | consistent, judgment |
| `la_sb79.site-and-overlay-standards` | `la_sb79.temporary-exemption-historic-resource` | rule not encoded | consistent, judgment |
| `la_low_rise.geographic-criteria` | `la_low_rise.incentive-area-map-subarea` | rule not encoded | consistent, judgment |
|  | `la_low_rise.subarea-distance-bands` | professional judgment | judgment |
|  | `la_low_rise.subarea-geographic-criteria` | professional judgment | judgment |
|  | `la_low_rise.underlying-zone` | rule not encoded | consistent, judgment |
|  | `la_low_rise.manufacturing-zone-exclusion` | rule not encoded | consistent, judgment |
|  | `la_low_rise.single-family-zone-exclusion` | rule not encoded | consistent, judgment |
|  | `la_low_rise.fire-restriction-area-exclusion` | rule not encoded | consistent, judgment |
|  | `la_low_rise.coastal-zone-exclusion` | rule not encoded | consistent, judgment |
|  | `la_low_rise.sea-level-rise-area-exclusion` | rule not encoded | consistent, judgment |
|  | `la_low_rise.excluded-plan-area` | rule not encoded | consistent, judgment |
|  | `la_low_rise.c10-exception-path` | professional judgment | judgment |
|  | `la_low_rise.tod-subarea-historic-limit` | professional judgment | judgment |

The mapping is also in `app/src/shared/program-screen/criteria/retired.ts`, and each proposal's components list the same IDs; the tests keep all three identical.

### SB 79 temporary exemption: highest-risk unresolved item

Ordinance 188968 Sec. 4 (page 6) says "all parcels within the City’s jurisdiction are subject to temporarily exempt status under Government Code Section 65912.161(b)." Read literally, that would block the SB 79 pathway for every City parcel until one year after the seventh Housing Element revision. Sec. 2 (page 4) instead adopts the exemption "on eligible sites meeting any one of the criteria referenced below", and Ordinance 188967 ((c)(10), (g)(1)(iii)b) refers to sites "not exempt" under this ordinance.

**None of the eight temporary-exemption criteria may become a production disqualifier merely from this refactor.** Each one's `permitted_outcomes` excludes `disqualifying_per_source`; `la_sb79.temporary-exemption-all-parcels` and `la_sb79.temporary-exemption-shown` may only route to judgment. A code comment in `criteria/sb79-low-rise.ts` and a pinned test say the same. Lifting that ceiling needs a named human reviewer's verification of the Sec. 4 reading and a deliberate change to the ceilings.

The question for the reviewer: does Sec. 4 exempt every parcel in the City from SB 79 now, or only make every parcel eligible to be mapped as exempt under Sec. 2, and how does either reading square with Ordinance 188967's references to sites not exempt under the Phased Implementation Ordinance and with GCS 65912.161(b)?

### Fact data classes

Every fact now has a data class (`programFactDataClasses` in `types.ts`):

- **A. `controlled_value`**: a yes/no, a number with a unit, or one of a closed list of values, recorded by a person from a named record. Only these may feed a rule. The criterion schema rejects any encoded or pending rule that reads anything else.
- **B. `source_observation`**: what a record displays, kept as recorded: the zoning string and the ZIMAS program fields. Never read by a rule.
- **C. `professional_input`**: context for a professional-judgment criterion: free-text occupancy history, a structure count, a generic historic designation. Never read by a rule.
- **D. retired**: removed from `programFactKeys` and listed in `retiredProgramFacts` (`facts.ts`). Evidence for a retired key is rejected with the reason, never reinterpreted.

No free-text value is read by any rule, and no zoning string is parsed: zone groups (`shra-zone-category`, `low-rise-zone-class`, `low-rise-manufacturing-zone-lot`, `low-rise-single-family-zone-lot`) are separate controlled facts a person records. An incomplete or failed lookup stays unknown; it is never recorded as a "none" value.

| Fact | Class | Value | Read by |
| --- | --- | --- | --- |
| `parcel-match` | A. controlled value | yes/no | `la_shra.parcel-match`, `la_sb79.parcel-match`, `la_low_rise.parcel-match` |
| `jurisdiction` | A. controlled value | controlled list | `la_shra.jurisdiction`, `la_sb79.jurisdiction`, `la_sb79.temporary-exemption-all-parcels`, and 1 more |
| `zoning` | B. source observation | free text | none (observation only) |
| `hpoz` | A. controlled value | yes/no | `la_low_rise.overlay-review`, `la_low_rise.tod-subarea-historic-limit` |
| `historic-designation` | C. professional input | yes/no | `la_low_rise.overlay-review` |
| `historic-cultural-monument` | A. controlled value | yes/no | `la_low_rise.tod-subarea-historic-limit` |
| `zoning-code-chapter` | A. controlled value | controlled list | `la_shra.implementation-memo-scope` |
| `lot-area` | A. controlled value | number (sq ft) | `la_shra.multifamily-lot-area-threshold`, `la_shra.single-family-lot-area-threshold` |
| `shra-zone-category` | A. controlled value | controlled list | `la_shra.zone-category`, `la_shra.multifamily-lot-area-threshold`, `la_shra.single-family-lot-area-threshold`, and 1 more |
| `very-high-fire-hazard-severity-zone` | A. controlled value | yes/no | `la_shra.very-high-fire-hazard-severity-zone`, `la_sb79.temporary-exemption-fire-or-state-responsibility-area`, `la_low_rise.overlay-review`, and 1 more |
| `high-fire-hazard-severity-zone` | A. controlled value | yes/no | `la_shra.high-fire-hazard-severity-zone` |
| `state-responsibility-area` | A. controlled value | yes/no | `la_sb79.temporary-exemption-fire-or-state-responsibility-area` |
| `hillside-area` | A. controlled value | yes/no | `la_low_rise.overlay-review`, `la_low_rise.fire-restriction-area-exclusion` |
| `coastal-zone` | A. controlled value | yes/no | `la_low_rise.overlay-review`, `la_low_rise.coastal-zone-exclusion` |
| `sea-level-rise-area` | A. controlled value | yes/no | `la_low_rise.sea-level-rise-area-exclusion` |
| `sb79-sea-level-rise-vulnerability` | A. controlled value | yes/no | `la_sb79.temporary-exemption-sea-level-rise` |
| `prime-or-statewide-farmland` | A. controlled value | yes/no | `la_shra.prime-or-statewide-farmland` |
| `wetlands` | A. controlled value | yes/no | `la_shra.wetlands` |
| `nccp-conservation-land` | A. controlled value | yes/no | `la_shra.natural-community-conservation-plan-land` |
| `conservation-easement` | A. controlled value | yes/no | `la_shra.conservation-easement` |
| `hazardous-waste-site` | A. controlled value | yes/no | `la_shra.hazardous-waste-site` |
| `special-flood-hazard-area` | A. controlled value | yes/no | `la_shra.special-flood-hazard-area` |
| `regulatory-floodway` | A. controlled value | yes/no | `la_shra.regulatory-floodway` |
| `earthquake-fault-zone` | A. controlled value | yes/no | `la_shra.earthquake-fault-zone` |
| `existing-structures` | C. professional input | number (structures) | `la_shra.vacant-site-definition` |
| `rso-status` | B. source observation | yes/no | none (observation only) |
| `occupancy-history` | C. professional input | free text | `la_shra.vacant-site-definition`, `la_shra.protected-housing-tenant-occupancy` |
| `affordability-restricted-housing` | A. controlled value | yes/no | `la_shra.protected-housing-affordability-covenant` |
| `price-controlled-housing` | A. controlled value | yes/no | `la_shra.protected-housing-price-control` |
| `ellis-act-withdrawal-recorded` | A. controlled value | yes/no | `la_shra.ellis-act-withdrawal` |
| `prior-shra-or-sb9-map` | A. controlled value | controlled list | `la_shra.prior-shra-or-sb9-map` |
| `housing-element-site-listing` | A. controlled value | controlled list | `la_shra.housing-element-projected-units`, `la_shra.housing-element-lower-income-units` |
| `sb79-permanent-exemption-shown` | A. controlled value | yes/no | `la_sb79.permanent-exemption-shown` |
| `sb79-temporary-exemption-shown` | A. controlled value | yes/no | `la_sb79.temporary-exemption-shown` |
| `seventh-housing-element-revision-adopted` | A. controlled value | yes/no | `la_sb79.temporary-exemption-period` |
| `tod-alternative-plan-area` | A. controlled value | yes/no | `la_sb79.temporary-exemption-tod-alternative-plan` |
| `hcm-or-hpoz-designated-by-2025-01-01` | A. controlled value | yes/no | `la_sb79.temporary-exemption-historic-resource` |
| `low-rise-incentive-area-map-subarea` | A. controlled value | controlled list | `la_low_rise.incentive-area-map-subarea` |
| `low-rise-transportation-row` | A. controlled value | controlled list | `la_low_rise.underlying-zone` |
| `low-rise-zone-class` | A. controlled value | controlled list | `la_low_rise.underlying-zone` |
| `low-rise-manufacturing-zone-lot` | A. controlled value | controlled list | `la_low_rise.manufacturing-zone-exclusion` |
| `low-rise-single-family-zone-lot` | A. controlled value | yes/no | `la_low_rise.single-family-zone-exclusion` |
| `low-rise-excluded-plan-area` | A. controlled value | controlled list | `la_low_rise.excluded-plan-area` |
| `zimas-shra-program-field` | B. source observation | yes/no | none (observation only) |
| `zimas-sb79-category` | B. source observation | free text | none (observation only) |
| `zimas-sb79-tier` | B. source observation | free text | none (observation only) |
| `zimas-sb79-exemption` | B. source observation | yes/no | none (observation only) |
| `zimas-low-rise-category` | B. source observation | free text | none (observation only) |

### Retired fact keys

| Retired key | Migration | Replaced by | Reason |
| --- | --- | --- | --- |
| `general-plan-land-use` | `drop` | none | Ordinance 188967 states no General Plan land-use test for Low-Rise geography, and no other criterion used it. |
| `specific-plan-area` | `drop` | `low-rise-excluded-plan-area` | A yes/no cannot name the one Specific Plan that Ordinance 188967 (c)(9) lists, and Ordinance 188968 states no Specific Plan test. |
| `landslide-area` | `drop` | none | The SHRA memo names no landslide-area site limit, and no other criterion used it. |
| `flood-zone` | `drop` | `special-flood-hazard-area`, `regulatory-floodway` | Broader than the memo's designations: a mapped flood zone is not necessarily a special flood hazard area or a regulatory floodway. |
| `fault-zone` | `drop` | `earthquake-fault-zone` | Broader than the memo's earthquake fault zone designation. |
| `existing-dwelling-units` | `drop` | none | Ordinance 188968 states no existing-housing test, and SB 79's own text is not captured. |
| `prior-subdivisions` | `drop` | `prior-shra-or-sb9-map` | A yes/no for any prior subdivision shows neither whether a map was recorded nor the statute it was recorded under; the memo restricts only SHRA and SB 9 maps. |
| `housing-element-site-status` | `drop` | `housing-element-site-listing` | Free text; replaced by the controlled Housing Element appendix listing. |
| `sb79-permanent-exclusion` | `rename` | `sb79-permanent-exemption-shown` | Ordinance 188968 Section 1 says "permanently exempt". Renamed from exclusion to exemption; same record, same value. |
| `sb79-temporary-exemption` | `rename` | `sb79-temporary-exemption-shown` | Renamed to say that it records only an affirmative showing; same record, same value. |

### Fictional fixture migration

The fixture's `migrations` list records every change, and the fixture schema checks it: each migration names a retired key; a `rename` keeps the evidence ID, source, and value under the one replacement key; a `drop` removes the record. Two records were renamed (`ps-sb79-permanent-exclusion` YES and `ps-sb79-temporary-exemption` NO, exclusion to exemption and "shown" wording, values unchanged) and eight dropped (General Plan land use, Specific Plan, landslide, flood zone, fault zone, existing dwelling units, prior subdivisions, Housing Element status). No dropped value was converted into a new fact: a generic flood-zone NO is not a special-flood-hazard-area NO, and a prior-subdivisions NO is not a map history. The 30 new atomic facts have no fixture record, so they stay unknown.

Fixture results, before and after:

| | Before (nine broad criteria) | After (atomic criteria) |
| --- | --- | --- |
| Criteria | 18 | 55 |
| SHRA / SB 79 / Low-Rise | contested / undetermined / contested | contested / contested / contested |
| Decisive SB 79 criteria | the three broad SB 79 criteria (unreviewed) | `la_sb79.temporary-exemption-fire-or-state-responsibility-area` (the fire-hazard conflict now reaches Sec. 2.F) |
| Criterion statuses | 7 consistent, 2 conflict, 2 unknown, 7 unreviewed | 7 consistent, 4 conflict, 32 unknown, 8 professional, 4 unreviewed |
| `pending_human_criterion` blockers | 9 | 46 |
| Client releasable | no | no |
| Documented disqualifiers | 0 | 0 |

## Captured official sources

All four PDFs were supplied to the capture session by the repository owner on 2026-09-27. The capture environment still could not reach `cityclerk.lacity.org` or `planning.lacity.gov` (egress 403), so the bytes were **not** compared with the files the hosts serve, and `retrieved_at` records the upload time, not the original download time. Recapture with `--replace` and the true download time if it is known.

| Source ID | Type / status | Pages | Text layer | `sha256_original` | `sha256_extracted` |
| --- | --- | --- | --- | --- | --- |
| `ordinance-188967` | `adopted_ordinance` / `operative` | 21 | City OCR (ABBYY FineReader) | `d03eda1a3b6d790d1e1331040118c5661b2d87f202e6389839982b9e5a2ed24f` | `279b3724eb25b8e9bee0efeedd1eb500089b993a5dd7af6925c05019db605e25` |
| `ordinance-188968` | `adopted_ordinance` / `operative` | 8 | City OCR (ABBYY FineReader) | `e355179f5e7dfb58626f596d2023549279a53b4a3431f691a599557b5f7519e3` | `91ea56cfb5db7b1d0f42bba4afef52179fd9052ef726d7a337fe35091410a588` |
| `shra-2025-10-28` | `official_memo` / `operative` | 20 | born-digital (Acrobat PDFMaker) | `c7063b881987dc855bb74a674f0d344233f7b7d2859544850c54176d347d8b5e` | `f44574084091c51419d0475d4b8501d9a2c3577b3a16830fc6ecb2a88b20f6e2` |
| `low-rise-draft-2026-09-24` | `proposed_draft` / `proposed_not_operative` | 3 | scan; pages 1-2 have **no text** | `c451896908430f573206209c6c154c62c95b2c396ffdebe5a7e8505560a8d9a7` | `3f31319db3820b36cd3755f7e5572ef414181c283fb7659c0eea13f61dd4ec65` |

What each document prints about its own status:

- **Ordinance 188967** (Low-Rise, Council File 25-1083-S3), page 21: passed June 23, 2026 by a vote of not less than three-fourths; approved 06/26/2026; published 06/30/2026; effective 06/30/2026. Sec. 15 makes it operative when it becomes effective, unless the State suspends or extends SB 79 first. The Director of Planning's Charter Section 559 block records **disapproval** on behalf of the City Planning Commission; the Council adopted it by a three-fourths vote. `document_date` 2026-06-30.
- **Ordinance 188968** (Phased Implementation, Council File 25-1083-S4), page 8: the same dates and the same Charter 559 disapproval. Sec. 7 (urgency) makes it effective on publication. `document_date` 2026-06-30.
- **SHRA memo**, page 1, dated October 28, 2025: it "pertains to Chapter 1 of the Zoning Code" (a Chapter 1A memo "will follow"), "summarizes key SHRA provisions for reference and does not include all applicable planning, building, or other departmental/agency regulations," "reflects LACP's current understanding ... and may be updated," and replaces the October 9, 2024 SB 684 memo. It is recorded as operative subject to those limits. Whether a later memo has replaced it was not checked.
- **Draft** (Council File 25-1083-S3 attachment dated September 24, 2026): unnumbered and unpassed; the City Attorney and Director of Planning signature blocks are dated September 17, 2026. `official_url` is the Council File record page already listed in this ledger (`https://cityclerk.lacity.org/lacityclerkconnect/index.cfm?fa=ccfi.viewrecord&cfnumber=25-1083-S3`), because the attachment's own document URL was not recorded and was not guessed.

**OCR caution.** Both ordinances are scans with the City's OCR text layer. `extracted.txt` reproduces that layer exactly, in content-stream order: paragraphs can appear out of reading order, table cells are scattered (Table 12.22 A.38.(g)(1)(i) can only be quoted in fragments), and OCR errors are kept (for example, Ordinance 188968 page 8 reads "Approved 96/26/2026" where the image shows 06/26/2026, and page 5 reads "ora local government"). An excerpt that matches `extracted.txt` must still be read against the page image. In the memo, "Public Resources Code Section 42021" is the text layer's rendering of "Section 4202" followed by footnote marker 1.

Capture commands used (from `app/`; the notes are abbreviated here, and the full text is in each `metadata.json`):

```sh
npm run program-screen:capture -- --file <upload>/25-1083-S3_ord_188967_06-30-26.pdf \
  --source-id ordinance-188967 --type adopted_ordinance --operative-status operative \
  --title "City of Los Angeles Ordinance No. 188967 (Low-Rise Ordinance)" \
  --url https://cityclerk.lacity.org/onlinedocs/2025/25-1083-S3_ord_188967_06-30-26.pdf \
  --document-date 2026-06-30 --retrieved-at 2026-09-27T16:19:21Z --notes "..."

npm run program-screen:capture -- --file <upload>/25-1083-S4_ord_188968_06-30-26.pdf \
  --source-id ordinance-188968 --type adopted_ordinance --operative-status operative \
  --title "City of Los Angeles Ordinance No. 188968 (SB 79 Phased Implementation Ordinance)" \
  --url https://cityclerk.lacity.org/onlinedocs/2025/25-1083-S4_ord_188968_06-30-26.pdf \
  --document-date 2026-06-30 --retrieved-at 2026-09-27T16:19:20Z --notes "..."

npm run program-screen:capture -- --file <upload>/SB_684_1123_Memo_Update_ACP.pdf \
  --source-id shra-2025-10-28 --type official_memo --operative-status operative \
  --title "Implementation of Senate Bills 1123 (2024) and 684 (2023) and Assembly Bill 130 (2025) - Starter Home Revitalization Act (interdepartmental memorandum, October 28, 2025)" \
  --url https://planning.lacity.gov/odocument/1b081b86-f735-43e8-bba6-c2d73a192db7/SB_684_1123_Memo_Update_ACP.pdf \
  --document-date 2025-10-28 --retrieved-at 2026-09-27T16:19:20Z --notes "..."

npm run program-screen:capture -- --file <upload>/25-1083-s3_misc_9-24-26.pdf \
  --source-id low-rise-draft-2026-09-24 --type proposed_draft --operative-status proposed_not_operative \
  --may-change ordinance-188967 \
  --title "Council File 25-1083-S3: September 24, 2026 draft Low-Rise Ordinance (proposed)" \
  --url "https://cityclerk.lacity.org/lacityclerkconnect/index.cfm?fa=ccfi.viewrecord&cfnumber=25-1083-S3" \
  --document-date 2026-09-24 --retrieved-at 2026-09-27T16:19:20Z --notes "..."
```

`npm run program-screen:capture:verify` reports `ok` for all four official captures and all five TEST-ONLY captures (the two v1 synthetic captures and the three Phase 2b agency-map and statute captures), and `npm run program-screen:capture:selftest` passes every check. Each capture matches its `expectedOfficialSources` entry (URL, type, `may_change_source_ids`), and only the three operative sources satisfy `canSupportCriterionRule`.

## Capture format and tool

Each source is one directory under `app/fixtures/program-screen/official-sources/<source-id>/`:

- `original.pdf`: the supplied bytes, unchanged.
- `extracted.txt`: text extracted from exactly those bytes by `pdfjs-dist` (pinned in `app/package.json`) and normalized by `program-screen-text-v1` (`normalizeExtractedPage` in `app/src/shared/program-screen/source-capture.ts`). Only whitespace and unrenderable control characters change. Pages are separated by a form feed on its own line, so the page of an excerpt can be computed.
- `metadata.json`: `source_id`, `title`, `official_url`, `source_type`, `document_date`, `retrieved_at`, `sha256_original`, `sha256_extracted`, `operative_status`, `notes`, `may_change_source_ids`, the byte size, the page count, pages without text, the extractor and its version, the normalization version, and `is_ai_generated: false`.

`app/scripts/capture-program-screen-source.ts` (`npm run program-screen:capture`) writes all three. It:

- ingests a **local** file only and never downloads;
- accepts only a PDF (checked by its `%PDF-` header);
- accepts only HTTPS URLs on `cityclerk.lacity.org`, `clkrep.lacity.org`, `planning.lacity.gov`, or `leginfo.legislature.ca.gov`;
- refuses a draft recorded as anything but `proposed_not_operative`, and an ordinance or memo recorded as proposed;
- refuses an image-only PDF (no extractable text on any page), which would need a text layer or a human transcription; a PDF with some text-less pages, like the draft, is captured and those pages are listed in `pages_without_text`;
- refuses to overwrite an existing capture unless `--replace` is passed;
- re-verifies what it wrote before reporting success.

`npm run program-screen:capture:verify` re-hashes every capture and re-extracts every PDF. It fails if any file changed, if a capture directory holds any other file, or if the installed `pdfjs-dist` would extract different text. `npm run program-screen:capture:selftest` runs the tool against the TEST-ONLY synthetic captures in a temporary directory and checks every refusal above.

Phase 2b (`docs/PROGRAM_SCREEN_SOURCE_CAPTURE_2B.md`) adds metadata v2 for two more source types:

- `agency_map`: a PDF, with its issuing agency, edition, responsibility areas, legend classes, and supersession statement each pinned to text on its page.
- `statute`: a code-section page captured as the exact HTML the official host served, or an official PDF. The code, section, and pinpoint are pinned by the URL, a whole-line heading, and excerpts.

A v2 capture takes `--context <json>`. v1 metadata, and the four captures above, are unchanged.

A non-allowlisted host needs a reviewed, source-specific exception. None is shipped. No map or statute capture can support a criterion rule, and none is an authority source until a separate, reviewed registration.

`app/tests/program-screen-source-capture.test.ts` re-checks every capture on every test run. The tests run inside workerd, which receives each module over a WebSocket capped at 32 MiB, and Ordinance 188967's PDF alone exceeds that once inlined as base64. So `app/tests/program-screen-capture-bytes.global-setup.ts` reads every official capture's exact bytes in Node, runs the same `officialSourceCaptureIssues` check, and provides the result; the test fails on any issue, on any capture directory the setup did not check, and on any hash that differs from the pins in the test. The extracted text is loaded and re-hashed inside the worker as well. The test also requires every official capture to match its entry in `expectedOfficialSources`, and it rejects any other file in `official-sources/` (HTML, notes, or loose text).

## Operative law versus drafts

The September 24, 2026 draft in Council File 25-1083-S3 is captured as its own source (`low-rise-draft-2026-09-24`, `proposed_draft`, `proposed_not_operative`). It never replaces Ordinance 188967.

| A draft may | Enforced by |
| --- | --- |
| appear in this ledger | the capture list above, the change report below, and `related_draft_source_ids` on the Low-Rise proposal |
| create a change warning and trigger a human re-review | `draftChangeWarnings` returns only `{ kind: "draft_change_warning", action: "human_re_review" }`; with the real captures it flags only the twelve Low-Rise atomic criteria (pinned in the test) |

| A draft may not | Enforced by |
| --- | --- |
| support a criterion rule, and so generate a disqualifier or a consistent finding | The production schema accepts a human-verification `source_capture` only with `source_type` `adopted_ordinance` or `official_memo` and `operative_status: "operative"`. Otherwise the criterion stays pending: status `unreviewed`, release blocked. `humanRecordCaptureIssues` also rejects a record that relabels a draft capture as operative. |
| support a proposal | `proposedVerificationSchema` rejects a proposal whose `source_id` is a draft, and `proposalCaptureIssues` rejects any proposal checked against the draft capture. |
| replace the adopted source | `expectedSourceIssues` pins each source ID to one source type and URL; a draft filed as `ordinance-188967` fails the tests |
| make a pathway releasable | follows from the above: a criterion without a valid record always carries a `pending_human_criterion` release blocker |

If the draft is adopted, the adopted ordinance is captured as a new `adopted_ordinance` source with its own ID. The affected criteria are then re-reviewed against it by a human.

## Adopted Ordinance 188967 versus the September 24, 2026 draft

The draft is non-operative whatever its similarity to the adopted text. It can only prompt a re-review.

**Limits of this comparison.** The draft's pages 1-2, which carry its only substantive section, have no text layer. The comparison below was made from the page images, not from `extracted.txt`, so the pipeline cannot excerpt-check it. A reviewer should read both PDFs.

**What the draft is.** A three-page ordinance "amending Sections 12.22 A.38 of Article 2, Chapter I" to implement SB 79 and update the Mixed Income Incentive Program. Sec. 1 amends only Table 12.22 A.38(g)(3)(i), Low-Rise Incentive Area Base Incentives. Sec. 2 is severability and Sec. 3 publication. It has no operative-date or urgency section; it is unnumbered and unpassed; and its Charter 559 block records the Director's **approval**, where the adopted ordinance records disapproval.

**Substantive differences** (adopted pages 9-10 against draft pages 1-2):

| Table 12.22 A.38(g)(3)(i) | Adopted Ordinance 188967 | September 24, 2026 draft |
| --- | --- | --- |
| LR-1 density rows | 5-11 units (FAR 1.30:1 to 2.15:1) | 5-10 units (FAR 1.30:1 to 2.0:1) |
| LR-2 density rows | 12-16 units (FAR 2.30:1 to 2.90:1) | 11-16 units (FAR 2.15:1 to 2.90:1) |
| FAR for each unit count | 5 units 1.30:1 rising to 16 units 2.90:1 | unchanged; the 11-unit row moves from LR-1 to LR-2 |
| Parking | No parking required | unchanged |
| LR-1 height | "2 stories" and "3 stories" cells marked with footnote 4 | 2 stories (5-6 units), 3 stories (7-10 units), stated in the table |
| LR-2 height | no value in the LR-2 rows; footnote 4 gives "three stories for projects of 7 to 16 units" but labels it the LR-1 subarea | 3 stories, stated in the table |
| Footnote 4 | present | deleted |
| Footnotes 1-3 | as below | same text |

In substance, the draft lowers the LR-1 maximum from 11 units and 2.15:1 FAR to 10 units and 2.0:1, and states the LR-2 height directly. Both match figures the adopted text already uses elsewhere: Table 12.22 A.38.(c)(3)(v) footnote 2 (one Moderate Income unit "for every 10 units" in LR-1) and the (g)(3)(vi) consolidation example (two LR-1 lots "up to 20 units ... a 2:1 FAR maximum"; LR-2 "a height maximum of 3 stories"). It reads as a conforming correction, but that is an inference for the reviewer to confirm.

**Effect on the Program Screen criteria: none found.** No Program Screen criterion reads density, FAR, parking, height, or unit counts. The draft does not amend any provision the twelve Low-Rise atomic criteria rest on: the Sec. 5 definitions, (c)(4)-(10), (g)(1) and Table 12.22 A.38.(g)(1)(i), (g)(1)(iii), (j)(7), or (j)(16). No criterion basis or proposal excerpt comes from the amended table, and the draft's incentive-table changes are not pulled into any Low-Rise criterion. `la_low_rise.overlay-review` and the SB 79 and SHRA criteria are unaffected.

**Re-review triggers.**

- Now: the captured draft raises the designed `draft_change_warning` for `ordinance-188967`, flagging the twelve Low-Rise atomic criteria for human re-review. On the content above, the re-review is a confirmation that no cited provision changed.
- If the draft (or any other amendment of LAMC 12.22 A.38) is adopted: capture the adopted instrument as a new `adopted_ordinance` source, confirm no Low-Rise citation points at Table 12.22 A.38(g)(3)(i), and re-review the Low-Rise components against it before any rule changes.
- Outside the draft, any of these would also trigger re-review: a new or updated Director's Low-Rise or SB 79 exemption map; SCAG's final TOD map; HCD action on Ordinance 188968; adoption of the seventh Housing Element revision; a Director determination under Ordinance 188967 Sec. 14 (LAMC 12.22 A.38(m)); or a replacement SHRA memo, including the promised Chapter 1A memo.

## The verification gate

A criterion listed in `humanVerificationRequiredCriterionIds` (`app/src/shared/program-screen/types.ts`; now the 46 atomic criteria) runs a rule only when all of the following hold:

1. It is `verification: "human_verified"`. Relabeling it `repo_sourced` fails pack validation.
2. It carries a `human_verification` record:
   - `reviewer`: `{ kind: "human", name, role }`. An AI pass cannot be the reviewer.
   - `verified_at` and `next_review_at`.
   - `source_title`, `source_url` (HTTPS), and `pinpoint`. These must match the criterion `citation` field for field, dates included.
   - `instrument`: the ordinance, statute, or memo identifier.
   - `supporting_excerpt`.
   - `source_capture`: `{ repo_path, retrieved_at, capture_method, sha256, is_ai_generated: false, source_type, operative_status }`. `source_type` must be `adopted_ordinance` or `official_memo`, and `operative_status` must be `operative`.
3. `repo_path` is `app/fixtures/program-screen/official-sources/<source-id>/extracted.txt`. The excerpt must appear in it (only whitespace is normalized). The record's SHA-256, URL, retrieval time, source type, and operative status must match the capture's `metadata.json` (`humanRecordCaptureIssues`).
4. The criterion has a behavior case in `app/tests/program-screen-verification.test.ts`. The shared runner checks the positive case, the blocking case, missing fact → `unknown`, conflicting sources → `conflict`, unreviewed evidence → `unreviewed`, stale citation → release blocked, rule does not run without the record, and excerpt present in the capture.

If any of these fail, the evaluator treats the criterion as pending: status `unreviewed` with reason `criterion_pending_human`, a `pending_human_criterion` release blocker, and a `verify_criterion_rule` review task. This holds even for callers that skip pack validation.

A verified rule is still bounded by its criterion's `permitted_outcomes` and `exception_paths`, and it may read only controlled-value facts. A retired broad criterion ID can never be shipped again.

## Proposed verification records

`app/fixtures/program-screen/proposed-verifications/<retired-criterion-id>.json` holds one proposal per retired broad criterion (`schema_version` `program-screen-proposal-v2`). A proposal prepares a human review; it is not one.

- `reviewer` and `reviewed_at` are always `null`; the schema rejects any other value, human or AI.
- The production schema rejects a proposal as a human-verification record. A criterion carrying one stays pending.
- No production module imports `proposed-verification.ts` or reads the proposals directory; a test enforces this.
- `retired_criterion_id` names the broad criterion the source review split. `question_for_human_reviewer` asks whether the reviewer accepts the split as a whole.
- `awaiting_human_review` (all nine): needs `source_sha256` (the capture's `sha256_extracted`), `candidate_page`, `candidate_pinpoint`, `candidate_excerpt`, and at least one component. The headline candidate must be the first component's first excerpt. Every excerpt must appear on its stated page of the capture (`proposalCaptureIssues`), and the source must be an operative, non-draft capture.
- Each component has an ID, label, pinpoint, page-checked excerpts, a disposition, the facts it reads, the facts it removed, the facts still missing, a controlled-value encoding, a proposed rule (required for a deterministic disposition and forbidden otherwise), the ambiguities or reasons for judgment, and its own `reviewer_question`.
- A shipped component's ID is an atomic criterion ID. The tests require its label, pinpoint, facts, and excerpts to equal that criterion's, and its disposition to match the criterion's kind and ceiling. Every atomic criterion appears in exactly one component. Dispositions:
  - `deterministic_candidate`: rule not encoded; both consistent and blocking are permitted once verified.
  - `partially_deterministic`: rule not encoded; exactly one of consistent or blocking is permitted.
  - `interpretation_unresolved`: rule not encoded; only judgment is permitted until the reading is resolved.
  - `professional_judgment`: a professional-judgment criterion.
  - `no_rule_in_source` (not shipped): the source states no such rule; `removed_fact_keys` records what was removed.
  - `outside_screen` (not shipped): the source states a project or application condition the parcel screen does not evaluate.

Only a later branch, after a named human reviewer approves a component, may convert its atomic criterion to `human_verified`.

### Human review rounds

A review round narrows the pending criteria to a few a reviewer can check in one sitting. Round 1 (eight criteria) is `docs/PROGRAM_SCREEN_HUMAN_REVIEW_ROUND_1.md`, with its manifest at `app/fixtures/program-screen/human-review-rounds/round-1.json` (`humanReviewRoundSchema` in `proposed-verification.ts`). A round, like a proposal, is preparation only: it has no field for a reviewer, a decision, or a verification status; each candidate rule must stay inside its criterion's shipped ceiling; and no production module imports it. `app/tests/program-screen-human-review-round-1.test.ts` enforces all of this.

Round 1 was decided on 2026-09-27 by Sergio Mata (Project Owner / Human Reviewer). Six criteria were decided APPROVE WITH REVISION (a, b, c, d, f, g) and two KEEP PENDING (e, h). **None was promoted.** All eight stay `pending_human`: a, b, c, d, f, and g are gated until the conditions in their decisions can be enforced in code or fail closed, and e and h wait for an official record to be captured. The decisions are recorded verbatim in `docs/PROGRAM_SCREEN_HUMAN_REVIEW_ROUND_1_DECISIONS.md` and `app/fixtures/program-screen/human-review-rounds/round-1-decisions.json` (`humanReviewDecisionsSchema`). A decisions record, like the manifest, is never read by a production module and can never promote a criterion.

### Converting a criterion (human reviewer checklist)

1. Read the proposal's excerpts against the original PDF's page images (both ordinances are OCR scans).
2. Decide: A (encode), B (keep pending), or C (remove or narrow). Stop at B if the text does not clearly support a deterministic predicate.
3. For A:
   - Add any fact the component still needs to `programFactKeys` as a `controlled_value` with its controlled values.
   - Write the predicate. It returns `consistent_with_source`, `disqualifying_per_source`, or `requires_judgment`, only outcomes in the criterion's `permitted_outcomes`, and uses no other logic. Widening `permitted_outcomes` or modeling an exception fact is a separate, deliberate decision.
   - Point the criterion `citation` at the operative source and pinpoint.
   - Set `human_verified` and fill in the record, naming yourself as the reviewer.
   - Set `basis.repo_path` to the capture's `extracted.txt` and `basis.excerpts` to the excerpt.
4. Add a `verifiedCases` entry and update the pins:
   - the human-verified list;
   - the executable-predicate list;
   - the pending lists and the ceiling pins in `program-screen-core.test.ts`, `program-screen-atomic.test.ts`, and `program-screen-source-capture.test.ts`;
   - the public-demo `pending_human_criterion` count.
5. Update the fictional fixture only if the verified rule changes its expected result.

## Per-criterion ledger (proposed verification targets)

Every atomic criterion's decision is still **B: keep `pending_human`** until a human reviewer decides. Each entry below is generated from its proposal file, and a test keeps every question identical in both places. "Deterministic" and "judgment" below are the preparer's proposals, not findings. "Shipped as" is the atomic criterion's predicate kind and outcome ceiling.

### SHRA (as amended by SB 684 / SB 1123; the City memo also covers AB 130)

#### `la_shra.lot-area-and-zoning` (retired)

- **Proposal file:** `app/fixtures/program-screen/proposed-verifications/la_shra.lot-area-and-zoning.json` (status `awaiting_human_review`)
- **Official source:** `shra-2025-10-28`: the City's October 28, 2025 SHRA implementation memorandum (City Planning, LADBS, Bureau of Engineering); `source_sha256` `f44574084091c51419d0475d4b8501d9a2c3577b3a16830fc6ecb2a88b20f6e2`
- **Other sources the reviewer may need:** GCS 66499.41, to define multifamily-zoned lots and the qualified-urban-uses test. Chaptered text of the statute on leginfo.legislature.ca.gov. It cannot be captured as evidence until a statute source type exists; do not capture it as an adopted_ordinance. The ZIMAS SHRA Eligibility Criteria Checklist the memo points to (page 2), as an observation only.
- **Where it is:** Located in shra-2025-10-28 (20 pages, born-digital text). Part I, page 2, states the lot-size limits and the qualified-urban-uses test. FAQ Q.1, page 12, lists the single-family zones and defines vacant. Page 1 limits the memo to Chapter 1 and describes it as a summary of the SHRA.
- **Headline candidate (page 2):** Memo Part I (property criteria), page 2 (lot-size paragraph): “To qualify, multifamily-zoned lots must be less than 5 acres, and single-family zoned lots must be under 1.5 acres and "vacant." (See FAQ Section, Q.1.)”
- **Question for the reviewer (the split):** The memo (page 2) limits multifamily-zoned lots to less than 5 acres and single-family-zoned lots to under 1.5 acres and vacant, and FAQ Q.1 (page 12) lists the single-family zones but no multifamily zones. Do you agree with splitting the retired lot-area-and-zoning criterion into a zone-category criterion, one lot-area criterion per path, and a vacancy-condition criterion, with the multifamily path unable to block until an official source classifies multifamily zones?
- **Facts before the split:** `lot-area`, `zoning`
- **Controlled values now:** shra-zone-category (single_family_listed_zone | zone_not_on_single_family_list), recorded by a person, never parsed from the zoning string. lot-area stays a number in sq ft. Limits: 217,800 sq ft (5 acres) and 65,340 sq ft (1.5 acres).
- **What was split or removed:** Split on 2026-09-27 into la_shra.multifamily-lot-area-threshold, la_shra.single-family-lot-area-threshold, la_shra.zone-category, and la_shra.single-family-vacancy-condition, all pending human verification. The free-text zoning fact no longer feeds any SHRA criterion. The qualified-urban-uses test is recorded as outside the screen.
- **Ceiling after review:** Only the single-family area limit may block after review. The zone category, the multifamily limit, and the vacancy condition can only be consistent or route to judgment.
- **Must remain unknown or professional when:**
  - lot area is missing, unreviewed, or conflicting between sources
  - the recorded lot area may not be the pre-subdivision lot area
  - the zone category is not a human-recorded controlled value
  - the zone is not on the memo's single-family list and no official source classifies it as multifamily-zoned
  - the parcel is Chapter 1A, which la_shra.implementation-memo-scope leaves to Planning
- **ZIMAS conflict risk:** Medium. The memo tells users to consult the SHRA Eligibility Criteria Checklist in ZIMAS and says City Planning will confirm eligibility (page 2). That checklist is not captured; zimas-shra-program-field stays observation-only and can only raise a divergence blocker. Lot area from ZIMAS and survey records can differ; a difference stays a conflict.
- **Components:**

  | Component | Disposition | Shipped as | Pages | Pinpoint | Proposed rule |
  | --- | --- | --- | --- | --- | --- |
  | `la_shra.multifamily-lot-area-threshold` | `partially_deterministic` | `not_encoded`; may return consistent, judgment | p. 2 | Memo Part I (property criteria), page 2 (lot-size paragraph) | shra-zone-category single_family_listed_zone -> consistent_with_source (this limit does not apply). zone_not_on_single_family_list and lot-area < 217,800 sq ft -> consistent_with_source (below the limit whatever the path). zone_not_on_single_family_list and lot-area >= 217,800 sq ft -> requires_judgment (blocks only if the lot is multifamily-zoned, which no captured source can show). |
  | `la_shra.single-family-lot-area-threshold` | `deterministic_candidate` | `not_encoded`; may return consistent, blocking, judgment | p. 2 | Memo Part I (property criteria), page 2 (lot-size paragraph) | shra-zone-category single_family_listed_zone and lot-area < 65,340 sq ft -> consistent_with_source for the area limit only. single_family_listed_zone and lot-area >= 65,340 sq ft -> disqualifying_per_source. zone_not_on_single_family_list -> consistent_with_source (this limit does not apply). Missing or conflicting lot area -> unknown or conflict. |
  | `la_shra.zone-category` | `partially_deterministic` | `not_encoded`; may return consistent, judgment | pp. 2, 12 | Memo FAQ Q.1, page 12 (zones for single-family residential development); Part I, page 2 (lot-size paragraph) | single_family_listed_zone -> consistent_with_source (the memo's single-family path applies). zone_not_on_single_family_list -> requires_judgment (whether the lot is multifamily-zoned is unresolved by the captured memo). Never disqualifying_per_source. |
  | `la_shra.single-family-vacancy-condition` | `partially_deterministic` | `not_encoded`; may return consistent, judgment | pp. 2, 12 | Memo Part I, page 2 (lot-size paragraph); FAQ Q.1, page 12 (definition of vacant) | zone_not_on_single_family_list -> consistent_with_source (the memo attaches vacancy to single-family-zoned lots only). single_family_listed_zone -> requires_judgment (vacant is a legal definition). Never disqualifying_per_source, and never decided from a structure count. |
  | `la_shra.urban-uses-surround` | `outside_screen` | not shipped | p. 2 | Memo Part I (property criteria), page 2 | none (The memo defers to GCS 66499.41(a)(2)(B), which is not captured) |

- **Reviewer question for each component:**
  - `la_shra.multifamily-lot-area-threshold`: Do you agree the 5-acre limit is a strict less-than on the pre-subdivision lot area, and that it must stay non-blocking until an official source defines which zones are multifamily-zoned?
  - `la_shra.single-family-lot-area-threshold`: Do you agree that a lot on the FAQ Q.1 single-family list with a recorded pre-subdivision area of 65,340 sq ft or more is barred by the memo's 1.5-acre limit, regardless of vacancy?
  - `la_shra.zone-category`: Do you agree that the FAQ Q.1 list (A1, A2, RA, RE, RS, R1, RU, RZ, RW1) is exhaustive for the single-family path, and which official source, if any, should classify a zone off that list as multifamily-zoned?
  - `la_shra.single-family-vacancy-condition`: Do you agree that the memo's vacancy condition attaches only to lots zoned for single-family residential development, so that a zone off the FAQ Q.1 list is consistent with this condition?
  - `la_shra.urban-uses-surround`: Should the qualified-urban-uses test become its own professional-judgment criterion, and which record would a reviewer use?

#### `la_shra.existing-structures-and-occupancy` (retired)

- **Proposal file:** `app/fixtures/program-screen/proposed-verifications/la_shra.existing-structures-and-occupancy.json` (status `awaiting_human_review`)
- **Official source:** `shra-2025-10-28`: the City's October 28, 2025 SHRA implementation memorandum (City Planning, LADBS, Bureau of Engineering); `source_sha256` `f44574084091c51419d0475d4b8501d9a2c3577b3a16830fc6ecb2a88b20f6e2`
- **Other sources the reviewer may need:** GCS 66499.41(a)(8), for the exact demolition-protection test. Chaptered text of the statute on leginfo.legislature.ca.gov. It cannot be captured as evidence until a statute source type exists; do not capture it as an adopted_ordinance. Los Angeles Housing Department records for RSO status, covenants, and Ellis Act withdrawals. LADBS permit records for the five-year look-back.
- **Where it is:** Located in shra-2025-10-28: Part I, Demolition Protections, pages 3-4 (GCS 66499.41(a)(8), the SB 1123 no-separation rule, and the Ellis Act bar); FAQ Q.14, page 17 (demolition and alteration). Vacancy is FAQ Q.1, page 12, and stays in la_shra.vacant-site-definition.
- **Headline candidate (page 3):** Memo Part I, Demolition Protections, page 3 (GCS 66499.41(a)(8)); FAQ Q.14, page 17: “Specifically, a project may not be approved if it would require the demolition or alteration of any of the following types of housing:”
- **Question for the reviewer (the split):** The memo (pages 3-4) bars a project that would demolish or alter covenant-restricted, rent- or price-controlled, or recently tenant-occupied housing, and bars sites with an Ellis Act withdrawal within 15 years of the application. Do you agree with splitting the retired criterion into one criterion per protected category, a separate demolition-or-alteration judgment, and an Ellis Act criterion, with no category able to block from parcel facts alone?
- **Facts before the split:** `existing-structures`, `occupancy-history`
- **Controlled values now:** affordability-restricted-housing and price-controlled-housing (yes/no, controlled), ellis-act-withdrawal-recorded (yes/no, controlled). occupancy-history stays free text as professional input; existing-structures is professional input only.
- **What was split or removed:** Split on 2026-09-27 into la_shra.protected-housing-demolition-or-alteration, la_shra.protected-housing-affordability-covenant, la_shra.protected-housing-price-control, la_shra.protected-housing-tenant-occupancy, and la_shra.ellis-act-withdrawal, all pending human verification. No SHRA demolition criterion reads the structure count, so a structure is never a blocker. The SB 1123 no-separation rule is recorded as outside the screen.
- **Ceiling after review:** No component may block after review from parcel facts: each protected category and the Ellis Act record can only be consistent (absent) or route to judgment; tenant occupancy and demolition-or-alteration stay professional judgment.
- **Must remain unknown or professional when:**
  - occupancy history exists only as free text
  - a look-back period cannot be measured because no application date is recorded
  - protected housing is present and the project's demolition or alteration is unknown
  - structure, occupancy, RSO, covenant, or Ellis Act records conflict
- **ZIMAS conflict risk:** Low to medium. The memo points to the ZIMAS eligibility checklist for the Ellis Act bar (page 4); ZIMAS stays observation-only unless the reviewer designates the LAHD record. A parcel display alone does not show occupancy history.
- **Components:**

  | Component | Disposition | Shipped as | Pages | Pinpoint | Proposed rule |
  | --- | --- | --- | --- | --- | --- |
  | `la_shra.protected-housing-demolition-or-alteration` | `professional_judgment` | `professional_judgment`; may return judgment | pp. 3, 17 | Memo Part I, Demolition Protections, page 3 (GCS 66499.41(a)(8)); FAQ Q.14, page 17 | none (FAQ Q.14 defines demolition and alteration; additions that change the existing structure count as alterations) |
  | `la_shra.protected-housing-affordability-covenant` | `partially_deterministic` | `not_encoded`; may return consistent, judgment | p. 3 | Memo Part I, Demolition Protections, page 3 (GCS 66499.41(a)(8), category 1) | false -> consistent_with_source (this protected category is absent). true -> requires_judgment (the bar applies only if the project would demolish or alter it; see la_shra.protected-housing-demolition-or-alteration). Never disqualifying_per_source from parcel facts. |
  | `la_shra.protected-housing-price-control` | `partially_deterministic` | `not_encoded`; may return consistent, judgment | p. 3 | Memo Part I, Demolition Protections, page 3 (GCS 66499.41(a)(8), category 2) | false -> consistent_with_source (this protected category is absent). true -> requires_judgment (the bar applies only if the project would demolish or alter it). Never disqualifying_per_source from parcel facts. |
  | `la_shra.protected-housing-tenant-occupancy` | `professional_judgment` | `professional_judgment`; may return judgment | p. 3 | Memo Part I, Demolition Protections, page 3 (GCS 66499.41(a)(8), category 3) | none (The five-year look-back runs from the application date, which a parcel screen does not have) |
  | `la_shra.ellis-act-withdrawal` | `partially_deterministic` | `not_encoded`; may return consistent, judgment | p. 4 | Memo Part I, Demolition Protections, page 4 | false (complete reviewed LAHD record shows no withdrawal ever) -> consistent_with_source. true -> requires_judgment (the 15-year look-back runs from the application date, which the screen does not hold). Never disqualifying_per_source until a withdrawal date and an application date (or evaluation date) are modeled. |
  | `la_shra.existing-units-not-separated` | `outside_screen` | not shipped | p. 4 | Memo Part I, Demolition Protections, page 4 (SB 1123) | none (Existing units do not by themselves bar the site (see also FAQ Q.22 and Q.23)) |

- **Reviewer question for each component:**
  - `la_shra.protected-housing-demolition-or-alteration`: Do you agree that the demolition-or-alteration condition can never be decided from parcel records alone, so this criterion stays professional judgment even when every protected category is recorded absent?
  - `la_shra.protected-housing-affordability-covenant`: Do you agree that a complete record showing no covenant-, ordinance-, or law-restricted lower-income housing is consistent with this category, and that its presence can only route to the demolition-or-alteration judgment?
  - `la_shra.protected-housing-price-control`: Do you agree that a record showing no housing under any local rent or sales-price control is consistent with this category, and which record should establish that absence beyond the RSO?
  - `la_shra.protected-housing-tenant-occupancy`: Should tenant occupancy in the five years before the application stay a Planning judgment, or can a dated, controlled occupancy record be designed once an application date is available?
  - `la_shra.ellis-act-withdrawal`: Do you agree that a complete LAHD record showing no Ellis Act withdrawal is consistent with this bar, and that a recorded withdrawal must stay a judgment until both its date and the application date are recorded?
  - `la_shra.existing-units-not-separated`: Do you agree the SB 1123 no-separation rule is a subdivision-design condition that the parcel screen should not evaluate?

#### `la_shra.prior-subdivisions` (retired)

- **Proposal file:** `app/fixtures/program-screen/proposed-verifications/la_shra.prior-subdivisions.json` (status `awaiting_human_review`)
- **Official source:** `shra-2025-10-28`: the City's October 28, 2025 SHRA implementation memorandum (City Planning, LADBS, Bureau of Engineering); `source_sha256` `f44574084091c51419d0475d4b8501d9a2c3577b3a16830fc6ecb2a88b20f6e2`
- **Other sources the reviewer may need:** GCS 66499.41, for the exact prior-map restriction. Chaptered text of the statute on leginfo.legislature.ca.gov. It cannot be captured as evidence until a statute source type exists; do not capture it as an adopted_ordinance. The recorded parcel and tract maps for the lot.
- **Where it is:** Located in shra-2025-10-28: Part I, page 2 (lots previously recorded under the SHRA or SB 9). FAQ Q.5, page 14 (after a discretionary map) and FAQ Q.26, page 20 (adjacent parcels).
- **Headline candidate (page 2):** Memo Part I (property criteria), page 2 (prior SHRA or SB 9 lots): “Lots previously recorded pursuant to the SHRA or SB 9 (2021) are ineligible. However, this particular eligibility restriction does not apply if the tentative map has not been recorded.”
- **Question for the reviewer (the split):** The memo (page 2) restricts lots previously recorded under the SHRA or SB 9 (2021), unless the tentative map has not been recorded, and (FAQ Q.5, Q.26) allows SHRA after a recorded discretionary map and on adjacent parcels. Do you agree with replacing the retired yes/no prior-subdivisions fact by a controlled record of whether an SHRA or SB 9 map was recorded, with an incomplete map history staying unknown and adjacency removed?
- **Facts before the split:** `prior-subdivisions`
- **Controlled values now:** prior-shra-or-sb9-map: shra_map_recorded | sb9_map_recorded | shra_or_sb9_tentative_map_not_recorded | other_basis_map_recorded | no_map_recorded. Unknown statute or incomplete history is unknown, never a value.
- **What was split or removed:** Split on 2026-09-27 into la_shra.prior-shra-or-sb9-map, pending human verification. prior-subdivisions (yes/no) is retired and its fixture record dropped, not converted. Adjacency is recorded as having no rule in the source; FAQ Q.5 is recorded as outside the screen.
- **Ceiling after review:** A recorded SHRA or SB 9 map may block after review; every other recorded history is consistent; an incomplete history stays unknown.
- **Must remain unknown or professional when:**
  - the lot's map history is incomplete or comes from a single display
  - the statute a prior map was recorded under is unknown
  - an SB 9 two-unit project without a lot split is recorded and the reviewer has not decided whether it counts
- **ZIMAS conflict risk:** Medium. A parcel display that shows no subdivision history does not prove none exists (PROJECT_LAWS law 4). The recorded map itself is the record.
- **Components:**

  | Component | Disposition | Shipped as | Pages | Pinpoint | Proposed rule |
  | --- | --- | --- | --- | --- | --- |
  | `la_shra.prior-shra-or-sb9-map` | `deterministic_candidate` | `not_encoded`; may return consistent, blocking, judgment | p. 2 | Memo Part I (property criteria), page 2 (prior SHRA or SB 9 lots) | shra_map_recorded or sb9_map_recorded -> disqualifying_per_source. shra_or_sb9_tentative_map_not_recorded, other_basis_map_recorded, or no_map_recorded -> consistent_with_source. Unknown or incomplete history -> unknown. |
  | `la_shra.discretionary-map-recorded-first` | `outside_screen` | not shipped | p. 14 | Memo FAQ Q.5, page 14 | none (FAQ Q.5 is City guidance on sequencing, not a site bar) |
  | `la_shra.adjacent-parcels` | `no_rule_in_source` | not shipped | p. 20 | Memo FAQ Q.26, page 20 | none (Each parcel needs its own application within the 10-unit limit, and the combined perimeter must be substantially surrounded by qualified urban uses (FAQ Q.26). Confirm GCS 66499.41 adds no adjacency limit) |

- **Reviewer question for each component:**
  - `la_shra.prior-shra-or-sb9-map`: Do you agree that only a recorded SHRA or SB 9 (2021) map bars the lot, that an unrecorded SHRA or SB 9 tentative map and maps under any other statute do not, and does 'recorded pursuant to SB 9' include SB 9 two-unit projects without a lot split?
  - `la_shra.discretionary-map-recorded-first`: Do you agree FAQ Q.5 is an application-timing condition the parcel screen should not evaluate, and that an ordinary recorded map does not restrict the lot?
  - `la_shra.adjacent-parcels`: Do you agree the memo sets no adjacency or common-ownership limit, so adjacency must not be screened?

#### `la_shra.housing-element-site-status` (retired)

- **Proposal file:** `app/fixtures/program-screen/proposed-verifications/la_shra.housing-element-site-status.json` (status `awaiting_human_review`)
- **Official source:** `shra-2025-10-28`: the City's October 28, 2025 SHRA implementation memorandum (City Planning, LADBS, Bureau of Engineering); `source_sha256` `f44574084091c51419d0475d4b8501d9a2c3577b3a16830fc6ecb2a88b20f6e2`
- **Other sources the reviewer may need:** The 2021-2029 Housing Element, Chapter 4, Appendices 4.1-4.3 (sites, projected units, lower-income units). GCS 66499.41(a)(5). Chaptered text of the statute on leginfo.legislature.ca.gov. It cannot be captured as evidence until a statute source type exists; do not capture it as an adopted_ordinance.
- **Where it is:** Located in shra-2025-10-28: Part I, Minimum Density and Affordability Requirements for Housing Element Sites, pages 2-3, and FAQ Q.9, pages 15-16. Minimum density for other sites is page 3.
- **Headline candidate (page 2):** Memo Part I, Minimum Density and Affordability Requirements for Housing Element Sites, pages 2-3; FAQ Q.9, page 15: “Pursuant to GCS 66499.41(a)(5), all SHRA development projects proposed on sites identified in the City’s 2021-2029 Housing Element must result in at least the number of units projected for that parcel.”
- **Question for the reviewer (the split):** The memo (pages 2-3, FAQ Q.9) treats Housing Element site status as a unit-count condition: projects on Appendix 4.1-4.3 sites must reach the projected units and any assigned lower-income units. Do you agree with replacing the retired free-text status by a controlled appendix listing, split into a projected-unit criterion and a lower-income-unit criterion, neither able to block without a proposed unit count the screen does not hold?
- **Facts before the split:** `housing-element-site-status`
- **Controlled values now:** housing-element-site-listing: appendix_4_1 | appendix_4_2 | appendix_4_3 | not_listed. Projected and lower-income unit counts, and the project's proposed units, are not modeled.
- **What was split or removed:** Split on 2026-09-27 into la_shra.housing-element-projected-units and la_shra.housing-element-lower-income-units, both pending human verification. housing-element-site-status (free text) is retired and its fixture record dropped, not converted.
- **Ceiling after review:** A listing can only route to judgment; not_listed is consistent. Neither component may ever block from the listing alone.
- **Must remain unknown or professional when:**
  - the listing is not a human-recorded controlled value
  - the parcel is listed and the project's proposed unit count is unknown
  - the appendices and ZIMAS ZI-2512 disagree
- **ZIMAS conflict risk:** Medium. The memo says Housing Element sites are noted in ZIMAS by ZI-2512 with projected units in the Housing tab (FAQ Q.9, page 15). The appendices are the underlying record; a difference stays a conflict.
- **Components:**

  | Component | Disposition | Shipped as | Pages | Pinpoint | Proposed rule |
  | --- | --- | --- | --- | --- | --- |
  | `la_shra.housing-element-projected-units` | `partially_deterministic` | `not_encoded`; may return consistent, judgment | pp. 2, 3, 15 | Memo Part I, Minimum Density and Affordability Requirements for Housing Element Sites, pages 2-3; FAQ Q.9, page 15 | not_listed -> consistent_with_source (no Housing Element projected-unit minimum). appendix_4_1, appendix_4_2, or appendix_4_3 -> requires_judgment (the project must reach the projected units). Never disqualifying_per_source without a proposed unit count. |
  | `la_shra.housing-element-lower-income-units` | `partially_deterministic` | `not_encoded`; may return consistent, judgment | pp. 3, 16 | Memo Part I, page 3; FAQ Q.9, page 16 | not_listed -> consistent_with_source (no lower-income unit minimum). appendix_4_1, appendix_4_2, or appendix_4_3 -> requires_judgment (whether lower-income units are assigned and the project includes them). Never disqualifying_per_source. |
  | `la_shra.non-housing-element-minimum-density` | `outside_screen` | not shipped | p. 3 | Memo Part I, Minimum Density Requirements for Non-Housing Element Sites, page 3 | none (A condition on the project's density, not a site bar) |

- **Reviewer question for each component:**
  - `la_shra.housing-element-projected-units`: Do you agree that a Housing Element listing is a condition and never a blocker by itself, and should the appendices or ZIMAS ZI-2512 be the record for the listing?
  - `la_shra.housing-element-lower-income-units`: Do you agree that the lower-income unit minimum is a project condition that a listing alone can never turn into a blocker?
  - `la_shra.non-housing-element-minimum-density`: Do you agree the non-Housing-Element minimum density is a project condition the parcel screen should not evaluate?

#### `la_shra.environmental-constraints` (retired)

- **Proposal file:** `app/fixtures/program-screen/proposed-verifications/la_shra.environmental-constraints.json` (status `awaiting_human_review`)
- **Official source:** `shra-2025-10-28`: the City's October 28, 2025 SHRA implementation memorandum (City Planning, LADBS, Bureau of Engineering); `source_sha256` `f44574084091c51419d0475d4b8501d9a2c3577b3a16830fc6ecb2a88b20f6e2`
- **Other sources the reviewer may need:** GCS 66499.41(a)(9), for the conditions on restricted categories. Chaptered text of the statute on leginfo.legislature.ca.gov. It cannot be captured as evidence until a statute source type exists; do not capture it as an adopted_ordinance. The defining map for each designation: CAL FIRE Fire Hazard Severity Zones (state and local responsibility areas), the FEMA Flood Insurance Rate Map, and the Alquist-Priolo Earthquake Fault Zone map. The LADBS Flood Hazard Management Ordinance Bulletin and Information Bulletins P/BC 2023-129 and P/BC 2023-044.
- **Where it is:** Located in shra-2025-10-28: Part I, Environmental Criteria, page 4 (six prohibited and three restricted categories, footnote 1), continued on page 5 (GCS 66499.41(a)(9)). Hillside appears only on page 10 (a report requirement) and FAQ Q.16, page 17 (habitat pre-screen).
- **Headline candidate (page 4):** Memo Part I, Environmental Criteria, page 4, prohibited category 3 and footnote 1: “3) High or very high fire hazard severity zones, as referenced in GCS 51178 and Public Resources Code Section 42021.”
- **Question for the reviewer (the split):** The memo (page 4) bars six site categories, including High and Very High Fire Hazard Severity Zones, and lets three restricted categories (hazardous waste sites, special flood hazard areas and floodways, earthquake fault zones) proceed if conditions are met. Do you agree with splitting the retired criterion into one criterion per named designation, with High and Very High fire as separate facts, the restricted categories unable to block, and hillside and landslide removed?
- **Facts before the split:** `very-high-fire-hazard-severity-zone`, `hillside-area`, `fault-zone`, `landslide-area`, `flood-zone`
- **Controlled values now:** One yes/no fact per named designation. High and Very High fire are separate facts. special-flood-hazard-area, regulatory-floodway, and earthquake-fault-zone replace the retired flood-zone and fault-zone, which are not converted.
- **What was split or removed:** Split on 2026-09-27 into eleven atomic criteria, all pending human verification. hillside-area no longer feeds SHRA; landslide-area, flood-zone, and fault-zone are retired and their fixture records dropped, not converted.
- **Ceiling after review:** Prohibited categories may block after review (wetlands only in the presence direction; habitat stays judgment). Restricted categories can only be consistent (absent) or route to judgment.
- **Must remain unknown or professional when:**
  - the defining map conflicts with another source (the fictional fixture's fire-hazard conflict stays contested)
  - a restricted category applies and its GCS 66499.41(a)(9) conditions depend on project facts
  - the designation comes only from a display that is not its defining map
  - only the Very High fire record exists: it says nothing about a High zone
- **ZIMAS conflict risk:** High. The memo tells users to consult the SHRA Eligibility Checklist in ZIMAS (page 4). ZIMAS hazard displays and the defining maps can disagree, as the fictional fixture's fire-hazard conflict models; a disagreement stays a conflict and the pathway stays contested.
- **Components:**

  | Component | Disposition | Shipped as | Pages | Pinpoint | Proposed rule |
  | --- | --- | --- | --- | --- | --- |
  | `la_shra.very-high-fire-hazard-severity-zone` | `deterministic_candidate` | `not_encoded`; may return consistent, blocking, judgment | p. 4 | Memo Part I, Environmental Criteria, page 4, prohibited category 3 and footnote 1 | true -> disqualifying_per_source. false -> consistent_with_source for the Very High designation only; High is la_shra.high-fire-hazard-severity-zone. |
  | `la_shra.high-fire-hazard-severity-zone` | `deterministic_candidate` | `not_encoded`; may return consistent, blocking, judgment | p. 4 | Memo Part I, Environmental Criteria, page 4, prohibited category 3 and footnote 1 | true -> disqualifying_per_source. false -> consistent_with_source for the High designation only. |
  | `la_shra.prime-or-statewide-farmland` | `deterministic_candidate` | `not_encoded`; may return consistent, blocking, judgment | p. 4 | Memo Part I, Environmental Criteria, page 4, prohibited category 1 | true -> disqualifying_per_source. false from the designated defining map -> consistent_with_source. |
  | `la_shra.wetlands` | `partially_deterministic` | `not_encoded`; may return blocking, judgment | p. 4 | Memo Part I, Environmental Criteria, page 4, prohibited category 2 | true (reviewed) -> disqualifying_per_source. false -> requires_judgment (a record showing no mapped wetland cannot show there is none). Never consistent_with_source until a defining record is designated. |
  | `la_shra.natural-community-conservation-plan-land` | `deterministic_candidate` | `not_encoded`; may return consistent, blocking, judgment | p. 4 | Memo Part I, Environmental Criteria, page 4, prohibited category 4 | true -> disqualifying_per_source. false from the adopted plan maps -> consistent_with_source. |
  | `la_shra.protected-species-habitat` | `professional_judgment` | `professional_judgment`; may return judgment | pp. 4, 17 | Memo Part I, Environmental Criteria, page 4, prohibited category 5; FAQ Q.16, page 17 | none (FAQ Q.16: the City pre-screens Hillside Area and Coastal Zone parcels and flags some for further analysis in the ZIMAS checklist) |
  | `la_shra.conservation-easement` | `deterministic_candidate` | `not_encoded`; may return consistent, blocking, judgment | p. 4 | Memo Part I, Environmental Criteria, page 4, prohibited category 6 | true -> disqualifying_per_source. false from a complete title search -> consistent_with_source. |
  | `la_shra.hazardous-waste-site` | `partially_deterministic` | `not_encoded`; may return consistent, judgment | pp. 4, 5 | Memo Part I, Environmental Criteria, page 4, restricted category 1; page 5 | false -> consistent_with_source. true -> requires_judgment (the GCS 66499.41(a)(9) conditions may be met). Never disqualifying_per_source from the flag alone. |
  | `la_shra.special-flood-hazard-area` | `partially_deterministic` | `not_encoded`; may return consistent, judgment | pp. 4, 5 | Memo Part I, Environmental Criteria, page 4, restricted category 2; page 5 | false from the FIRM -> consistent_with_source. true -> requires_judgment (the GCS 66499.41(a)(9) conditions may be met). Never disqualifying_per_source from the flag alone. |
  | `la_shra.regulatory-floodway` | `partially_deterministic` | `not_encoded`; may return consistent, judgment | pp. 4, 5 | Memo Part I, Environmental Criteria, page 4, restricted category 2; page 5 | false from the FIRM -> consistent_with_source. true -> requires_judgment. Never disqualifying_per_source from the flag alone. |
  | `la_shra.earthquake-fault-zone` | `partially_deterministic` | `not_encoded`; may return consistent, judgment | pp. 4, 5 | Memo Part I, Environmental Criteria, page 4, restricted category 3; page 5 | false from the designated map -> consistent_with_source. true -> requires_judgment. Never disqualifying_per_source from the flag alone. |
  | `la_shra.hillside-area` | `no_rule_in_source` | not shipped | pp. 4, 10, 17 | Memo Part I, Environmental Criteria, page 4; Part III, page 10; FAQ Q.16, page 17 | none (Hillside Areas appear only as a report requirement (page 10) and a habitat pre-screen (FAQ Q.16), neither of which is a site bar) |
  | `la_shra.landslide-area` | `no_rule_in_source` | not shipped | p. 4 | Memo Part I, Environmental Criteria, page 4 | none (Neither list on page 4 names landslide areas, and the memo never uses the term) |

- **Reviewer question for each component:**
  - `la_shra.very-high-fire-hazard-severity-zone`: Do you agree that a parcel mapped in a Very High Fire Hazard Severity Zone on the CAL FIRE maps (state or local responsibility area) is barred, and that a Very High record of no must never be read as no High zone?
  - `la_shra.high-fire-hazard-severity-zone`: Do you agree that a parcel mapped in a High Fire Hazard Severity Zone (state or local responsibility area) is barred on the same terms as Very High, and which CAL FIRE map edition should be the record?
  - `la_shra.prime-or-statewide-farmland`: Which official map should define prime farmland and farmland of statewide importance for this category, and do you agree that a mapped parcel is barred?
  - `la_shra.wetlands`: Is there an official wetland record whose absence can show that no wetland exists on a parcel, or should a no-wetland finding stay a judgment?
  - `la_shra.natural-community-conservation-plan-land`: Which adopted natural community conservation plans cover City parcels, and do you agree their conservation-land maps can both establish and rule out this category?
  - `la_shra.protected-species-habitat`: Should habitat for protected species stay a Planning judgment for every parcel, or can the City's pre-screen ever rule it out deterministically?
  - `la_shra.conservation-easement`: Do you agree that a recorded conservation easement bars the parcel, and that a complete title search can rule the category out?
  - `la_shra.hazardous-waste-site`: Do you agree that a recorded hazardous waste site is a condition to check and never a blocker by itself, and which record should define the category?
  - `la_shra.special-flood-hazard-area`: Do you agree that a special flood hazard area is a condition and never a blocker by itself, and that the FIRM is the defining record?
  - `la_shra.regulatory-floodway`: Do you agree that a regulatory floodway should be screened separately from a special flood hazard area, as a condition and never a blocker by itself?
  - `la_shra.earthquake-fault-zone`: Which map defines an earthquake fault zone for this category, and do you agree the zone is a condition and never a blocker by itself?
  - `la_shra.hillside-area`: Do you agree the memo sets no hillside-area site limit, so hillside-area must not feed any SHRA criterion?
  - `la_shra.landslide-area`: Do you agree the memo sets no landslide-area site limit, so the fact can be retired?

### SB 79 / Phased Implementation (Ordinance 188968)

#### `la_sb79.permanent-exclusion` (retired)

- **Proposal file:** `app/fixtures/program-screen/proposed-verifications/la_sb79.permanent-exclusion.json` (status `awaiting_human_review`)
- **Official source:** `ordinance-188968`: Ordinance No. 188968 (SB 79 Phased Implementation Ordinance); `source_sha256` `91ea56cfb5db7b1d0f42bba4afef52179fd9052ef726d7a337fe35091410a588`
- **Other sources the reviewer may need:** The Director of Planning's exemption maps issued under Sec. 3, with their publication dates. The SCAG TOD stop and zone maps (GCS 65912.160(f)); the ordinance recites that the final map is not yet produced. SB 79 (GCS 65912.155-65912.162). Chaptered text of the statute on leginfo.legislature.ca.gov. It cannot be captured as evidence until a statute source type exists; do not capture it as an adopted_ordinance.
- **Where it is:** Located in ordinance-188968 (8 pages, City OCR text layer): Section 1 and its criteria A and B, page 4; Sec. 3 (maps), page 5; Sec. 6 (ZIMAS), page 6; recitals on the SCAG final map, page 3.
- **Headline candidate (page 4):** Ordinance 188968, Section 1, page 4; Sec. 3, page 5; recital, page 3: “Section 1. Pursuant to California Government Code Section 65912.160(e), the City Council adopts this ordinance on eligible sites meeting one of the criteria referenced below, making the sites permanently exempt from Senate Bill 79, codified at Government Code, Title 7, Division 1, Chapter 4.1.5 (Senate Bill 79):”
- **Question for the reviewer (the split):** Ordinance 188968 Section 1 makes sites meeting either criterion (no walking path under one mile to the TOD stop, or an industrial employment hub) permanently exempt from SB 79, and Section 3 delegates the exemption maps to the Director. Do you agree with renaming exclusion to exemption and splitting the retired criterion into an affirmative-showing criterion that can never read a parcel not shown as not exempt, plus one professional-judgment criterion per Section 1 criterion?
- **Facts before the split:** `sb79-permanent-exclusion`
- **Controlled values now:** sb79-permanent-exemption-shown: yes/no, an affirmative showing on the adopted record (renamed from sb79-permanent-exclusion; same record and value). Criteria A and B have no parcel fact.
- **What was split or removed:** Split on 2026-09-27 into la_sb79.permanent-exemption-shown, la_sb79.permanent-exemption-walking-path, and la_sb79.permanent-exemption-industrial-hub, all pending human verification. The fixture's exclusion record was renamed with its value unchanged.
- **Ceiling after review:** An affirmative showing may block after review; a parcel not shown can only route to judgment, never to consistent. Criteria A and B stay professional judgment.
- **Must remain unknown or professional when:**
  - the Director's exemption map was not retrieved or is undated
  - the map shows no exemption while the SCAG final TOD map is not produced
  - the ZIMAS display and the Director's map disagree
- **ZIMAS conflict risk:** High. Sec. 6 directs the Director to show in ZIMAS which sites are and are not covered by SB 79, so ZIMAS may carry the most current display, but it is neither the ordinance nor the Director's map. zimas-sb79-exemption does not distinguish permanent from temporary exemption and stays observation-only; any divergence raises program_flag_divergence.
- **Components:**

  | Component | Disposition | Shipped as | Pages | Pinpoint | Proposed rule |
  | --- | --- | --- | --- | --- | --- |
  | `la_sb79.permanent-exemption-shown` | `partially_deterministic` | `not_encoded`; may return blocking, judgment | pp. 3, 4, 5 | Ordinance 188968, Section 1, page 4; Sec. 3, page 5; recital, page 3 | true -> disqualifying_per_source for the SB 79 pathway. false -> requires_judgment (the maps await SCAG's final TOD map, and a site may meet Section 1.A or 1.B without being shown). Never consistent_with_source. |
  | `la_sb79.permanent-exemption-walking-path` | `professional_judgment` | `professional_judgment`; may return judgment | p. 4 | Ordinance 188968, Section 1.A, page 4 | none (SCAG's TOD stop map is not final) |
  | `la_sb79.permanent-exemption-industrial-hub` | `professional_judgment` | `professional_judgment`; may return judgment | p. 4 | Ordinance 188968, Section 1.B, page 4 | none (The City must have at least 15 TOD stops; housing must not be a permitted use on the sites) |

- **Reviewer question for each component:**
  - `la_sb79.permanent-exemption-shown`: Do you agree that an affirmative permanent-exemption showing on the Director's map blocks the SB 79 pathway, and that a parcel not shown must never be treated as not exempt while the SCAG final map is pending?
  - `la_sb79.permanent-exemption-walking-path`: Should the walking-path criterion stay a Planning determination until SCAG's final TOD map exists, with the Director's map as the only record PermitPulse reads?
  - `la_sb79.permanent-exemption-industrial-hub`: Should the industrial-employment-hub criterion stay a Planning determination, with the Director's map as the only record PermitPulse reads?

#### `la_sb79.temporary-exemption` (retired)

- **Proposal file:** `app/fixtures/program-screen/proposed-verifications/la_sb79.temporary-exemption.json` (status `awaiting_human_review`)
- **Official source:** `ordinance-188968`: Ordinance No. 188968 (SB 79 Phased Implementation Ordinance); `source_sha256` `91ea56cfb5db7b1d0f42bba4afef52179fd9052ef726d7a337fe35091410a588`
- **Other sources the reviewer may need:** The City's record of adoption of the seventh Housing Element revision, once it exists. Ordinance 188967 (captured as ordinance-188967), which refers to sites 'not exempt' under this ordinance. HCD's review of the ordinance (Sec. 6 directs transmittal within 60 days).
- **Where it is:** Located in ordinance-188968: Sec. 2 (duration and criteria A-H), pages 4-5; Sec. 4 (all parcels), page 6; recitals on the draft citywide map and on expiry, pages 3-4. Criterion H is in the site-and-overlay source review.
- **Headline candidate (page 6):** Ordinance 188968, Sec. 4, page 6; Sec. 2, page 4; recital, page 3: “Sec. 4. Pursuant to the City’s local housing incentive programs, including, without limitation, LAMC Section 12.22 A.38, all parcels within the City’s jurisdiction are subject to temporarily exempt status under Government Code Section 65912.161(b).”
- **Question for the reviewer (the split):** Ordinance 188968 Sec. 2 temporarily exempts parcels meeting any of its criteria until one year after the City adopts the seventh revision of its Housing Element, and Sec. 4 says all parcels within the City are subject to temporarily exempt status. Do you agree with splitting the retired criterion into the Sec. 4 statement, the period, the affirmative map showing, and one criterion per Sec. 2 criterion, none of which may block the SB 79 pathway until the Sec. 4 reading is verified?
- **Facts before the split:** `sb79-temporary-exemption`
- **Controlled values now:** seventh-housing-element-revision-adopted (yes/no; its date not modeled), sb79-temporary-exemption-shown (renamed from sb79-temporary-exemption; same record and value), tod-alternative-plan-area, state-responsibility-area, sb79-sea-level-rise-vulnerability (yes/no each). Criteria A-D have no parcel fact.
- **What was split or removed:** Split on 2026-09-27 into seven atomic criteria here plus la_sb79.temporary-exemption-historic-resource (criterion H), all pending human verification. HIGHEST RISK: no temporary-exemption criterion may become a production disqualifier from this split; each one's permitted outcomes exclude a blocker.
- **Ceiling after review:** No component may block. The Sec. 4 statement and the map showing are judgment only; the period and criteria E-G can only be consistent (the criterion does not apply or the period has ended) or route to judgment.
- **Must remain unknown or professional when:**
  - the reviewer has not verified whether Sec. 4 exempts every parcel or only makes every parcel mappable
  - the seventh Housing Element revision's adoption is not recorded, or its date and the evaluation date are not available to the rule
  - the Director determines under Ordinance 188967 Sec. 14 that the City's approach is inconsistent with GCS 65912.161(b)
  - state review changes the ordinance's effect
- **ZIMAS conflict risk:** High. zimas-sb79-exemption records one display for exemption or exclusion, so it cannot tell temporary from permanent; it stays observation-only.
- **Components:**

  | Component | Disposition | Shipped as | Pages | Pinpoint | Proposed rule |
  | --- | --- | --- | --- | --- | --- |
  | `la_sb79.temporary-exemption-all-parcels` | `interpretation_unresolved` | `not_encoded`; may return judgment | pp. 3, 4, 6 | Ordinance 188968, Sec. 4, page 6; Sec. 2, page 4; recital, page 3 | none ('Subject to temporarily exempt status' may mean every parcel is exempt now, or only that every parcel may be mapped as exempt under Sec. 2, which adopts the exemption 'on eligible sites meeting any one of the criteria') |
  | `la_sb79.temporary-exemption-period` | `partially_deterministic` | `not_encoded`; may return consistent, judgment | p. 4 | Ordinance 188968, Sec. 2, page 4, with the recital on page 4 | Adopted, and the evaluation date is on or after the adoption date plus one year -> consistent_with_source (the temporary exemption has ended). Otherwise -> requires_judgment. Never disqualifying_per_source in this branch. Needs the adoption date and the evaluation date in the predicate. |
  | `la_sb79.temporary-exemption-shown` | `interpretation_unresolved` | `not_encoded`; may return judgment | pp. 4, 5 | Ordinance 188968, Sec. 2, page 4; Sec. 3, page 5 | none (Sec. 4 may reach every parcel whether or not the map shows it) |
  | `la_sb79.temporary-exemption-capacity-criteria` | `professional_judgment` | `professional_judgment`; may return judgment | pp. 4, 5 | Ordinance 188968, Sec. 2.A-D, pages 4-5 | none (Criteria B and C run across pages 4 and 5; the text layer breaks 'transit-oriented' across a line in C) |
  | `la_sb79.temporary-exemption-tod-alternative-plan` | `partially_deterministic` | `not_encoded`; may return consistent, judgment | p. 5 | Ordinance 188968, Sec. 2.E, page 5 | false -> consistent_with_source for criterion E only. true -> requires_judgment (temporarily exempt, but no temporary-exemption criterion may block in this branch). |
  | `la_sb79.temporary-exemption-fire-or-state-responsibility-area` | `partially_deterministic` | `not_encoded`; may return consistent, judgment | p. 5 | Ordinance 188968, Sec. 2.F, page 5 | Both false -> consistent_with_source for criterion F only. Either true -> requires_judgment (temporarily exempt, but no temporary-exemption criterion may block in this branch). |
  | `la_sb79.temporary-exemption-sea-level-rise` | `partially_deterministic` | `not_encoded`; may return consistent, judgment | p. 5 | Ordinance 188968, Sec. 2.G, page 5 | false -> consistent_with_source for criterion G only. true -> requires_judgment. Never disqualifying_per_source in this branch. |

- **Reviewer question for each component:**
  - `la_sb79.temporary-exemption-all-parcels`: Does Ordinance 188968 Sec. 4 exempt every parcel in the City from SB 79 now, or only make every parcel eligible to be mapped as exempt under Sec. 2, and how do you reconcile either reading with Ordinance 188967's references to sites not exempt under the Phased Implementation Ordinance?
  - `la_sb79.temporary-exemption-period`: Which act starts the one-year period (Council adoption or HCD certification of the seventh Housing Element revision), and on which day does the temporary exemption end?
  - `la_sb79.temporary-exemption-shown`: Once the Sec. 4 reading is settled, should a parcel the Director's map shows as temporarily exempt be treated as blocked for the SB 79 pathway during the exemption period, and what does a parcel not shown mean?
  - `la_sb79.temporary-exemption-capacity-criteria`: Should Sec. 2.A-D stay a Planning determination, reflected only through the Director's temporary-exemption map?
  - `la_sb79.temporary-exemption-tod-alternative-plan`: Has the City adopted any local TOD alternative plan, and do you agree criterion E is consistent for every parcel outside one?
  - `la_sb79.temporary-exemption-fire-or-state-responsibility-area`: Do you agree that criterion F uses the CAL FIRE Very High zone and the state responsibility area only, and that a High zone does not satisfy it?
  - `la_sb79.temporary-exemption-sea-level-rise`: Which assessment should govern criterion G when the named assessments disagree, and do you agree it is distinct from the Municipal Code's Sea Level Rise Area?

#### `la_sb79.site-and-overlay-standards` (retired)

- **Proposal file:** `app/fixtures/program-screen/proposed-verifications/la_sb79.site-and-overlay-standards.json` (status `awaiting_human_review`)
- **Official source:** `ordinance-188968`: Ordinance No. 188968 (SB 79 Phased Implementation Ordinance); `source_sha256` `91ea56cfb5db7b1d0f42bba4afef52179fd9052ef726d7a337fe35091410a588`
- **Other sources the reviewer may need:** SB 79 (GCS 65912.155-65912.162), for any zoning, overlay, or existing-housing standard. Chaptered text of the statute on leginfo.legislature.ca.gov. It cannot be captured as evidence until a statute source type exists; do not capture it as an adopted_ordinance. The City's HCM list and HPOZ records with designation dates.
- **Where it is:** Located in ordinance-188968: Sec. 2.A, E, and H, pages 4-5; recital on HCMs and HPOZs, page 3. The ordinance states no zoning, Specific Plan, or existing-housing standard; its site criteria are exemption criteria.
- **Headline candidate (page 5):** Ordinance 188968, Sec. 2.H, page 5, with the recital on page 3: “H. A site with a historic resource designated as of January 1,2025, on a local register (Gov. Code Sec. 65912.161(b)(1)(F)).”
- **Question for the reviewer (the split):** Ordinance 188968 sets no zoning, Specific Plan, overlay, or existing-housing standard of its own; its site criteria are exemption criteria, including historic resources designated by January 1, 2025 (Sec. 2.H). Do you agree with dissolving the retired site-and-overlay criterion, moving the historic-resource test to the temporary-exemption provision with a dated designation fact, and removing zoning, specific-plan-area, and existing-dwelling-units from SB 79?
- **Facts before the split:** `zoning`, `specific-plan-area`, `hpoz`, `existing-dwelling-units`
- **Controlled values now:** hcm-or-hpoz-designated-by-2025-01-01: yes/no with the designation date. The undated hpoz fact no longer feeds SB 79.
- **What was split or removed:** Dissolved on 2026-09-27. The historic-resource test is la_sb79.temporary-exemption-historic-resource (pending human verification). zoning no longer feeds SB 79; specific-plan-area and existing-dwelling-units are retired and their fixture records dropped.
- **Ceiling after review:** Criterion H can only be consistent or route to judgment (no temporary-exemption criterion may block). No other component produces a result.
- **Must remain unknown or professional when:**
  - a standard depends on SB 79's statute text, which is not captured
  - the HPOZ or HCM designation date is unknown
  - transit-stop proximity or tier matters (not encodable)
- **ZIMAS conflict risk:** High. zimas-sb79-category and zimas-sb79-tier stay observation-only and must never substitute for a standard read from the text.
- **Components:**

  | Component | Disposition | Shipped as | Pages | Pinpoint | Proposed rule |
  | --- | --- | --- | --- | --- | --- |
  | `la_sb79.temporary-exemption-historic-resource` | `partially_deterministic` | `not_encoded`; may return consistent, judgment | pp. 3, 5 | Ordinance 188968, Sec. 2.H, page 5, with the recital on page 3 | false -> consistent_with_source for criterion H only. true -> requires_judgment (temporarily exempt, but no temporary-exemption criterion may block in this branch). |
  | `la_sb79.zoning-standard` | `no_rule_in_source` | not shipped | p. 4 | Ordinance 188968, Sec. 2.A, page 4 | none (The ordinance sets no zoning-designation standard. Its only zoning-related test compares permitted capacity with SB 79's standards, which are in state law (not captured)) |
  | `la_sb79.specific-plan-and-tod-plan` | `no_rule_in_source` | not shipped | p. 5 | Ordinance 188968, Sec. 2.E, page 5 | none (The ordinance does not mention Specific Plans. Sec. 4 also says a later TOD alternative plan will not affect the ordinance) |
  | `la_sb79.existing-housing` | `no_rule_in_source` | not shipped | p. 4 | Ordinance 188968, Secs. 1-2, pages 4-5 | none (No criterion in Sec. 1 or Sec. 2 refers to existing housing. Any existing-housing or demolition standard comes from SB 79 itself, which is not captured and has no statute source type yet) |

- **Reviewer question for each component:**
  - `la_sb79.temporary-exemption-historic-resource`: Do you agree that criterion H covers HCMs and HPOZs designated on or before January 1, 2025, and does it also cover any other local-register resource?
  - `la_sb79.zoning-standard`: Do you agree Ordinance 188968 states no zoning-designation standard, so the zoning string must not feed any SB 79 criterion?
  - `la_sb79.specific-plan-and-tod-plan`: Do you agree Ordinance 188968 states no Specific Plan test, so specific-plan-area can be retired?
  - `la_sb79.existing-housing`: Do you agree Ordinance 188968 states no existing-housing test, so existing-dwelling-units can be retired unless SB 79's own text is captured?

### Low-Rise (Ordinance 188967)

#### `la_low_rise.geographic-criteria` (retired)

- **Proposal file:** `app/fixtures/program-screen/proposed-verifications/la_low_rise.geographic-criteria.json` (status `awaiting_human_review`)
- **Official source:** `ordinance-188967`: Ordinance No. 188967 (Low-Rise Ordinance); `source_sha256` `279b3724eb25b8e9bee0efeedd1eb500089b993a5dd7af6925c05019db605e25`
- **Related draft (re-review trigger only):** `low-rise-draft-2026-09-24`
- **Other sources the reviewer may need:** The Director's Low-Rise eligibility map (LAMC 12.22 A.38(j)(7)) with its publication date. LAMC Section 12.03 definitions (Very High Fire Hazard Severity Zone, Hillside Area, Sea Level Rise Area) and the LAMC zone hierarchy for 'RW1 and more restrictive'. Ordinance 188968 (captured as ordinance-188968), for the (c)(10) exemption cross-reference.
- **Where it is:** Located in ordinance-188967 (21 pages, City OCR text layer in content-stream order): Sec. 5 definitions, page 4; Sec. 8, LAMC 12.22 A.38(c)(4)-(10), pages 5-7; Sec. 9, (g)(1) and Table 12.22 A.38.(g)(1)(i), pages 7-8; Sec. 11, (j)(7), page 18; Sec. 13, (j)(16), page 19. The table's cells are scattered in the text layer; read it from the page image.
- **Headline candidate (page 4):** Ordinance 188967, Sec. 5 (Low-Rise Incentive Area Project), page 4; Sec. 11, LAMC 12.22 A.38(j)(7)(i), page 18: “Low-Rise Incentive Area Project. A project on a site located, in whole or in part, within a Low-Rise Incentive Area as set forth in the eligibility map pursuant to Section 12.22.A.38(i)(7) of this this Code, or determined to be eligible pursuant to Section 12.22 A.38(c)(10) of this Code, that involves the construction of, addition to, or remodeling of any building or buildings that result in the creation of five or more residential units.”
- **Question for the reviewer (the split):** Ordinance 188967 defines Low-Rise geography through the Director's map (Sec. 5, LAMC 12.22 A.38(j)(7)), distance bands, zones, and location tests in Table 12.22 A.38.(g)(1)(i), and site exclusions in (c)(4), (5), (6), and (9), all subject to the (c)(10) path. It never uses General Plan land use. Do you agree with splitting the retired criterion into the twelve atomic criteria shown, with every exclusion unable to block while its exceptions are unmodeled, and with general-plan-land-use removed? Separately, does the September 24, 2026 draft in Council File 25-1083-S3 propose changes to these provisions? A draft change only triggers a re-review; it cannot change a rule.
- **Facts before the split:** `zoning`, `general-plan-land-use`, `specific-plan-area`
- **Controlled values now:** low-rise-incentive-area-map-subarea (lr_1 | lr_2 | not_mapped), low-rise-transportation-row, low-rise-zone-class, low-rise-manufacturing-zone-lot, low-rise-single-family-zone-lot, sea-level-rise-area, low-rise-excluded-plan-area, historic-cultural-monument. The zoning string is never parsed.
- **What was split or removed:** Split on 2026-09-27 into twelve atomic criteria, all pending human verification. general-plan-land-use and specific-plan-area are retired and their fixture records dropped; zoning (free text) no longer feeds Low-Rise. Overlaps la_low_rise.overlay-review (repo-sourced judgment on coastal, fire, hillside, and historic) for a reviewer to reconcile.
- **Ceiling after review:** No component may block while its exceptions are unmodeled: the map and zone criteria and every exclusion can only be consistent or route to judgment; distance, location, (c)(10), and the TOD-stop historic limit stay professional judgment.
- **Must remain unknown or professional when:**
  - zoning exists only as free text
  - the Director's Low-Rise Incentive Area map was not retrieved, or the SCAG final TOD map is still pending
  - an exclusion is triggered and the (c)(10) path has not been ruled out
  - a Fire Restriction Area or Coastal Zone site depends on neighboring properties
  - the September 24, 2026 draft, or any other amendment of 12.22 A.38, is adopted: capture the adopted instrument and re-review before any rule changes
- **ZIMAS conflict risk:** Medium to high. zimas-low-rise-category stays observation-only; the ordinance makes the Director's eligibility map the record, and ZIMAS may only display it. ZIMAS zoning strings must never be parsed into zone classes.
- **Components:**

  | Component | Disposition | Shipped as | Pages | Pinpoint | Proposed rule |
  | --- | --- | --- | --- | --- | --- |
  | `la_low_rise.incentive-area-map-subarea` | `partially_deterministic` | `not_encoded`; may return consistent, judgment | pp. 4, 18 | Ordinance 188967, Sec. 5 (Low-Rise Incentive Area Project), page 4; Sec. 11, LAMC 12.22 A.38(j)(7)(i), page 18 | lr_1 or lr_2 -> consistent_with_source for the mapping requirement (exclusions still apply). not_mapped -> requires_judgment ((c)(10) may apply, and the map is provisional). Never disqualifying_per_source. |
  | `la_low_rise.subarea-distance-bands` | `professional_judgment` | `professional_judgment`; may return judgment | p. 7 | Ordinance 188967, Sec. 9, Table 12.22 A.38.(g)(1)(i) and LAMC 12.22 A.38(g)(1)(ii), pages 7-8 | none (The page image shows: Opportunity Corridor, LR-1 250-750 feet, LR-2 < 250 feet; Tier 2 TOD Stop, LR-1 1/4-1/2 mile, LR-2 < 1/4 mile; Tier 1 TOD Stop, LR-2 < 1/2 mile. The text layer scatters these cells) |
  | `la_low_rise.subarea-geographic-criteria` | `professional_judgment` | `professional_judgment`; may return judgment | pp. 4, 7 | Ordinance 188967, Table 12.22 A.38.(g)(1)(i), page 7; Sec. 5 (Opportunity Station Area), page 4 | none (Opportunity Station Area land-area calculations include land outside the City and exclude 'Insufficient Data' land ((j)(7)(ii), page 18)) |
  | `la_low_rise.underlying-zone` | `partially_deterministic` | `not_encoded`; may return consistent, judgment | pp. 7, 19 | Ordinance 188967, Table 12.22 A.38.(g)(1)(i), page 7; Sec. 13, LAMC 12.22 A.38(j)(16), page 19 | opportunity_corridor and rd_or_r2 -> consistent_with_source. tier_1_tod_stop or tier_2_tod_stop and (rd_or_r2 or other_listed_residential_zone) -> consistent_with_source. Any other combination -> requires_judgment ((j)(16) is not exhaustive, and (g)(1)(iii)b reaches some SB 79 sites regardless of zoning). Never disqualifying_per_source while (g)(1)(iii)b is unmodeled. |
  | `la_low_rise.manufacturing-zone-exclusion` | `partially_deterministic` | `not_encoded`; may return consistent, judgment | pp. 5, 6 | Ordinance 188967, Sec. 8, LAMC 12.22 A.38(c)(4), pages 5-6 | no_m_mr_or_cm_lot -> consistent_with_source. m1_m2_m3_mr1_or_mr2_lot -> requires_judgment ((c)(10) may apply). cm_lot -> requires_judgment (overlay, Q, and D record, and (c)(10)). Never disqualifying_per_source while (c)(10) is unmodeled. |
  | `la_low_rise.single-family-zone-exclusion` | `partially_deterministic` | `not_encoded`; may return consistent, judgment | p. 6 | Ordinance 188967, Sec. 8, LAMC 12.22 A.38(c)(5), page 6 | false -> consistent_with_source. true -> requires_judgment (the Opportunity Station Area exception and (c)(10) may apply). Never disqualifying_per_source while either exception is unmodeled. |
  | `la_low_rise.fire-restriction-area-exclusion` | `partially_deterministic` | `not_encoded`; may return consistent, judgment | pp. 4, 6 | Ordinance 188967, Sec. 8, LAMC 12.22 A.38(c)(6), page 6; Sec. 5 (Fire Restriction Area), page 4 | Either false -> consistent_with_source. Both true -> requires_judgment (the neighboring-properties exception and (c)(10) may apply, and two parcel-level records cannot show the zones overlap). Never disqualifying_per_source while either exception is unmodeled. |
  | `la_low_rise.coastal-zone-exclusion` | `partially_deterministic` | `not_encoded`; may return consistent, judgment | p. 6 | Ordinance 188967, Sec. 8, LAMC 12.22 A.38(c)(6), page 6 | false -> consistent_with_source. true -> requires_judgment (neighboring properties and (c)(10)). Never disqualifying_per_source while either exception is unmodeled. |
  | `la_low_rise.sea-level-rise-area-exclusion` | `partially_deterministic` | `not_encoded`; may return consistent, judgment | p. 6 | Ordinance 188967, Sec. 8, LAMC 12.22 A.38(c)(6), page 6 | false -> consistent_with_source. true -> requires_judgment ((c)(10) may apply). Never disqualifying_per_source while (c)(10) is unmodeled. |
  | `la_low_rise.excluded-plan-area` | `partially_deterministic` | `not_encoded`; may return consistent, judgment | pp. 6, 7 | Ordinance 188967, Sec. 8, LAMC 12.22 A.38(c)(9), pages 6-7 | none_of_these -> consistent_with_source. Any listed area -> requires_judgment ((c)(10) may apply). Never disqualifying_per_source while (c)(10) is unmodeled. |
  | `la_low_rise.c10-exception-path` | `professional_judgment` | `professional_judgment`; may return judgment | pp. 7, 8 | Ordinance 188967, Sec. 8, LAMC 12.22 A.38(c)(10), page 7; LAMC 12.22 A.38(g)(1)(iii)b, page 8 | none (The adopted text leaves the Phased Implementation Ordinance's number blank in (c)(10) and (g)(1)(iii)b) |
  | `la_low_rise.tod-subarea-historic-limit` | `professional_judgment` | `professional_judgment`; may return judgment | p. 8 | Ordinance 188967, Sec. 9, LAMC 12.22 A.38(g)(1)(iii)a, page 8 | none (The unless-clause repeats itself ('Opportunity Corridor Transition eligibility subarea based on distance from an Opportunity Corridor'), apparently a drafting error) |
  | `la_low_rise.historic-resource-lr1-limit` | `outside_screen` | not shipped | p. 8 | Ordinance 188967, Sec. 9, LAMC 12.22 A.38(g)(1)(iii)a, page 8 | none (Designated Historic Resource and Non-Contributor status need historic records) |
  | `la_low_rise.general-plan-land-use` | `no_rule_in_source` | not shipped | p. 7 | Ordinance 188967, Table 12.22 A.38.(g)(1)(i), page 7 | none (The ordinance's geographic criteria are TCAC opportunity areas and Opportunity Station Areas; no eligibility provision uses a General Plan land-use designation, and the phrase 'General Plan' does not appear in the captured text) |

- **Reviewer question for each component:**
  - `la_low_rise.incentive-area-map-subarea`: Do you agree that the Director's Low-Rise Incentive Area map is the record for LR-1 and LR-2, and that a site not mapped must stay a judgment because of the (c)(10) path?
  - `la_low_rise.subarea-distance-bands`: Should Low-Rise distance bands stay a mapping determination read only from the Director's map, never computed by PermitPulse?
  - `la_low_rise.subarea-geographic-criteria`: Should the Higher Opportunity Area and Opportunity Station Area tests stay a mapping determination read only from the Director's maps?
  - `la_low_rise.underlying-zone`: Do you agree that RD and R2 satisfy the corridor row, that the (j)(16) list satisfies the TOD-stop rows, and that a zone outside either list stays a judgment because (j)(16) is not exhaustive and (g)(1)(iii)b may apply?
  - `la_low_rise.manufacturing-zone-exclusion`: Do you agree that an M1, M2, M3, MR1, or MR2 lot, or a CM lot whose residential use is restricted, excludes the site unless (c)(10) applies, and what fact should record the (c)(10) determination before this exclusion may block?
  - `la_low_rise.single-family-zone-exclusion`: Do you agree that a lot in RW1 or a more restrictive zone excludes the site only outside an Opportunity Station Area and absent (c)(10), and should both exceptions be recorded as facts before this exclusion may block?
  - `la_low_rise.fire-restriction-area-exclusion`: Do you agree that a Fire Restriction Area needs the Very High zone and the Hillside Area on the same land, and what records should establish the neighboring-properties exception before this exclusion may block?
  - `la_low_rise.coastal-zone-exclusion`: Do you agree that a Coastal Zone lot excludes the site only when the neighboring-properties exception and (c)(10) do not apply, and what records should establish them?
  - `la_low_rise.sea-level-rise-area-exclusion`: Which record defines a Sea Level Rise Area for (c)(6), and do you agree the neighboring-properties exception does not reach it?
  - `la_low_rise.excluded-plan-area`: Do you agree the (c)(9) list is exhaustive (three Community Plan areas and one Specific Plan), and what fact should record the (c)(10) determination before this exclusion may block?
  - `la_low_rise.c10-exception-path`: Can any site currently take the (c)(10) path given Ordinance 188968 Sec. 4, and what controlled determination should record it so the Low-Rise exclusions can account for it?
  - `la_low_rise.tod-subarea-historic-limit`: How should the repeated unless-clause in LAMC 12.22 A.38(g)(1)(iii)a be read, and should the TOD-stop historic limit stay a Planning judgment until it is clarified?
  - `la_low_rise.historic-resource-lr1-limit`: Do you agree the LR-1 limit for a Designated Historic Resource or Non-Contributor is an incentive-tier condition the parcel screen should not evaluate?
  - `la_low_rise.general-plan-land-use`: Do you agree Ordinance 188967 uses no General Plan land-use designation for Low-Rise geography, so the fact can be retired?

## Not in scope, but flagged

- **Repo-sourced criteria can now be checked against captured text.** `la_shra.implementation-memo-scope` (memo page 1, "This memo pertains to Chapter 1 of the Zoning Code"), `la_shra.vacant-site-definition` (memo FAQ Q.1, page 12), and `la_low_rise.overlay-review` (Ordinance 188967 (c)(6) and (g)(1)(iii)) still rest on PermitPulse's guide prose. A human should re-verify them against the captures. `la_low_rise.overlay-review` now overlaps the atomic (c)(6) exclusions and the TOD-stop historic limit, and `la_shra.vacant-site-definition` overlaps `la_shra.single-family-vacancy-condition`; a reviewer should decide which criterion owns each.
- **Date-relative rules need the evaluation date.** The Ellis Act look-back, the tenant-occupancy look-back, and the end of the SB 79 temporary exemption all run from a date. The predicate signature receives fact values only, so none of them can be encoded until a reviewed design passes the evaluation date (and, where needed, an application date) to the rule.
- **Source conditions the screen does not evaluate.** Recorded as `outside_screen` components: the SHRA qualified-urban-uses test, the SB 1123 no-separation rule, the FAQ Q.5 map-recording sequence, the non-Housing-Element minimum density, and the Low-Rise LR-1 limit for a Designated Historic Resource. No pathway result covers them.
- **ZIMAS may become the City's designated display.** Ordinance 188968 Sec. 6 directs the Director to show in ZIMAS which sites are and are not covered by SB 79, and the SHRA memo sends users to the ZIMAS SHRA Eligibility Checklist. The ZIMAS program fields stay observation-only; making any of them a criterion input would be a design change for a separate review.
- **Drafting issues in the adopted text.** Ordinance 188967 leaves the Phased Implementation Ordinance's number blank in (c)(10) and (g)(1)(iii)b; cites the eligibility map "pursuant to Section 12.22.A.38(i)(7) of this this Code" where the mapping authority it amends is (j)(7); prints "M2,-M3"; and repeats a clause in (g)(1)(iii)a. The memo repeats "including, including" (page 3).
- **Fire-hazard conflict.** In the fixture, the fire-hazard conflict (CAL FIRE yes, ZIMAS no) now makes three atomic criteria contested: `la_shra.very-high-fire-hazard-severity-zone`, `la_sb79.temporary-exemption-fire-or-state-responsibility-area`, and `la_low_rise.fire-restriction-area-exclusion` (plus the repo-sourced overlay review). Each rests on the captured text; none is verified.
- **State statute text now has a source type (Phase 2b), but nothing is captured yet.** Several components defer to GCS 66499.41 or to SB 79 (GCS 65912.155-65912.162). Phase 2b added the `statute` source type (metadata v2; see `docs/PROGRAM_SCREEN_SOURCE_CAPTURE_2B.md`), so the "cannot be captured as evidence until a statute source type exists" notes above, which quote the proposal records, describe the state before Phase 2b. Capturing a statute is still its own reviewed step. A statute capture can never support a criterion rule, and it is never recorded as an `adopted_ordinance`.
- **`clkrep.lacity.org` is allowed as a City Clerk host.** Council File attachments are often served from it. Remove it from `officialSourceHosts` if you do not want it treated as official.
- **Image-only pages.** The draft's substantive pages have no text layer. A future draft or ordinance whose operative text is image-only needs an official text-layer version or a separately designed human transcription path before it can support anything.

## Retrieval log

| Date | Method | Hosts | Result |
| --- | --- | --- | --- |
| 2026-09-27 | HTTPS through the environment proxy (curl) | cityclerk.lacity.org, planning.lacity.gov, leginfo.legislature.ca.gov, lacity.gov, clkrep.lacity.org, www.hcd.ca.gov | CONNECT rejected by the environment egress policy (403). Re-probed later the same day: still rejected. |
| 2026-09-27 | Web fetch tool | cityclerk.lacity.org, planning.lacity.gov, leginfo.legislature.ca.gov | EGRESS_BLOCKED |
| 2026-09-27 (tooling pass) | HTTPS through the environment proxy (curl), direct PDF URLs for Ordinances 188967 and 188968 and the SHRA memo, plus both host roots | cityclerk.lacity.org, planning.lacity.gov | CONNECT rejected by the egress policy (403, `connect_rejected`) |
| 2026-09-27 (tooling pass) | Web fetch tool, Ordinance 188967 PDF URL | cityclerk.lacity.org | EGRESS_BLOCKED. This tool returns processed text, not file bytes, so it could not have produced a capture in any case. |
| 2026-09-27 (tooling pass) | Search of the session filesystem for attached official PDFs | n/a | None found |
| 2026-09-27 (this branch) | HTTPS through the environment proxy (curl), Ordinance 188967 PDF URL and planning.lacity.gov root | cityclerk.lacity.org, planning.lacity.gov | CONNECT rejected (403). The supplied files could not be compared with the served files. |
| 2026-09-27 (this branch) | Four PDFs supplied by the repository owner as session uploads | n/a | Captured with `npm run program-screen:capture`; SHA-256 values in the table above |
