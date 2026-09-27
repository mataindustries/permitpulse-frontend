# Program Screen criterion verification ledger

Scope: the nine City of Los Angeles Program Screen criteria that were `pending_human` when the core shipped (PR #15).

Passes:

- **2026-09-27, criterion-verification pass (PR #16).** Added the human-verification gate. Nothing verified.
- **2026-09-27, official-source capture pass (this branch).** Added capture tooling, capture integrity checks, the draft-versus-operative guard, and one proposed verification target per criterion. No official source captured. Nothing verified.

## Outcome

| Result | Criteria |
| --- | --- |
| A. `human_verified` and encoded | **None** |
| B. Still `pending_human` | **All nine** (listed below) |
| C. Removed or narrowed | **None.** Narrowing candidates are listed per criterion for a human reviewer. |
| Official sources captured | **None.** Both official hosts were blocked in the capture environment (see the retrieval log). |
| Proposed verification records | **Nine**, one per criterion, all `awaiting_source_capture`. None has a candidate pinpoint or excerpt yet. |

**Why nothing was captured or verified:** the capture environment's egress policy refused connections to `cityclerk.lacity.org` and `planning.lacity.gov`, and no official file was supplied to the session. No secondary website, search summary, or AI output was used as evidence (`PROJECT_LAWS.md`, laws 7 and 14), and no rule was taken from memory or from PermitPulse's own guide prose. Under law 4, a blocked retrieval says nothing about what the sources contain.

Every statement below is a **proposed verification target**. None of them reports what an official source says.

## Manual download list

Download each file yourself, from the official host, in a browser. Save the PDF exactly as served; do not print to PDF, re-save, or convert it. Then run the capture command below from `app/`.

| Source ID | Document | Download from | Type | Status to record |
| --- | --- | --- | --- | --- |
| `ordinance-188967` | Ordinance No. 188967, Low-Rise Ordinance | https://cityclerk.lacity.org/onlinedocs/2025/25-1083-S3_ord_188967_06-30-26.pdf | `adopted_ordinance` | `operative` once you have checked adoption and effect; otherwise `status_unconfirmed` |
| `ordinance-188968` | Ordinance No. 188968, SB 79 Phased Implementation Ordinance | https://cityclerk.lacity.org/onlinedocs/2025/25-1083-S4_ord_188968_06-30-26.pdf | `adopted_ordinance` | as above |
| `shra-2025-10-28` | Interdepartmental memorandum, "Implementation of Senate Bills 1123 (2024) and 684 (2023) and Assembly Bill 130 (2025) - Starter Home Revitalization Act", October 28, 2025 (City Planning, LADBS, Bureau of Engineering) | https://planning.lacity.gov/odocument/1b081b86-f735-43e8-bba6-c2d73a192db7/SB_684_1123_Memo_Update_ACP.pdf | `official_memo` | `operative` once you have checked it is the current memo |
| `low-rise-draft-2026-09-24` | Council File 25-1083-S3, September 24, 2026 draft Low-Rise Ordinance | The document listed on the Council File 25-1083-S3 record at https://cityclerk.lacity.org/lacityclerkconnect/index.cfm?fa=ccfi.viewrecord&cfnumber=25-1083-S3. Record the exact document URL you download. | `proposed_draft` | `proposed_not_operative` (the only status a draft can have) |

The three URLs in the "Download from" column are the ones the repository already cites. They were not reachable from the capture environment, so check each one at download. If a document is served from a different official URL, capture it with the URL actually used and update `expectedOfficialSources` in `app/src/shared/program-screen/proposed-verification.ts` in the same change.

Capture commands (fill in `--retrieved-at` with your actual download time, and add `--notes`):

```sh
cd app
npm run program-screen:capture -- --file <path>/25-1083-S3_ord_188967_06-30-26.pdf \
  --source-id ordinance-188967 --type adopted_ordinance --operative-status operative \
  --title "City of Los Angeles Ordinance No. 188967 (Low-Rise Ordinance)" \
  --url https://cityclerk.lacity.org/onlinedocs/2025/25-1083-S3_ord_188967_06-30-26.pdf \
  --document-date <date printed on the ordinance> --retrieved-at <ISO time with offset>

npm run program-screen:capture -- --file <path>/25-1083-S4_ord_188968_06-30-26.pdf \
  --source-id ordinance-188968 --type adopted_ordinance --operative-status operative \
  --title "City of Los Angeles Ordinance No. 188968 (SB 79 Phased Implementation Ordinance)" \
  --url https://cityclerk.lacity.org/onlinedocs/2025/25-1083-S4_ord_188968_06-30-26.pdf \
  --document-date <date printed on the ordinance> --retrieved-at <ISO time with offset>

npm run program-screen:capture -- --file <path>/SB_684_1123_Memo_Update_ACP.pdf \
  --source-id shra-2025-10-28 --type official_memo --operative-status operative \
  --title "Implementation of Senate Bills 1123 (2024) and 684 (2023) and Assembly Bill 130 (2025) - Starter Home Revitalization Act (interdepartmental memorandum, October 28, 2025)" \
  --url https://planning.lacity.gov/odocument/1b081b86-f735-43e8-bba6-c2d73a192db7/SB_684_1123_Memo_Update_ACP.pdf \
  --document-date 2025-10-28 --retrieved-at <ISO time with offset>

npm run program-screen:capture -- --file <path>/<draft file>.pdf \
  --source-id low-rise-draft-2026-09-24 --type proposed_draft --operative-status proposed_not_operative \
  --may-change ordinance-188967 \
  --title "Council File 25-1083-S3: September 24, 2026 draft Low-Rise Ordinance (proposed)" \
  --url <exact official document URL> --document-date 2026-09-24 --retrieved-at <ISO time with offset>
```

After capturing, `npm test` fails at "pins exactly which official sources have been captured" until that pin lists the new source IDs. This is deliberate: every capture is a reviewed change.

## Capture format and tool

Each source is one directory under `app/fixtures/program-screen/official-sources/<source-id>/`:

- `original.pdf`: the downloaded bytes, unchanged.
- `extracted.txt`: text extracted from exactly those bytes by `pdfjs-dist` (pinned in `app/package.json`) and normalized by `program-screen-text-v1` (`normalizeExtractedPage` in `app/src/shared/program-screen/source-capture.ts`). Only whitespace and unrenderable control characters change. Pages are separated by a form feed on its own line, so the page of an excerpt can be computed.
- `metadata.json`: `source_id`, `title`, `official_url`, `source_type`, `document_date`, `retrieved_at`, `sha256_original`, `sha256_extracted`, `operative_status`, `notes`, `may_change_source_ids`, the byte size, the page count, pages without text, the extractor and its version, the normalization version, and `is_ai_generated: false`.

`app/scripts/capture-program-screen-source.ts` (`npm run program-screen:capture`) writes all three. It:

- ingests a **local** file only and never downloads;
- accepts only a PDF (checked by its `%PDF-` header);
- accepts only HTTPS URLs on `cityclerk.lacity.org`, `clkrep.lacity.org`, `planning.lacity.gov`, or `leginfo.legislature.ca.gov`;
- refuses a draft recorded as anything but `proposed_not_operative`, and an ordinance or memo recorded as proposed;
- refuses an image-only PDF (no extractable text on any page), which would need a text layer or a human transcription;
- refuses to overwrite an existing capture unless `--replace` is passed;
- re-verifies what it wrote before reporting success.

`npm run program-screen:capture:verify` re-hashes every capture and re-extracts every PDF. It fails if any file changed, or if the installed `pdfjs-dist` would extract different text. `npm run program-screen:capture:selftest` runs the tool against the TEST-ONLY synthetic PDF in a temporary directory and checks every refusal above.

`app/tests/program-screen-source-capture.test.ts` re-hashes every capture on every test run, including the PDF bytes. It also requires every official capture to match its entry in `expectedOfficialSources`, and it rejects any other file in `official-sources/` (HTML, notes, or loose text).

## Operative law versus drafts

The September 24, 2026 draft in Council File 25-1083-S3 is captured, if at all, as its own source (`low-rise-draft-2026-09-24`, `proposed_draft`, `proposed_not_operative`). It never replaces Ordinance 188967.

| A draft may | Enforced by |
| --- | --- |
| appear in this ledger | the manual download list and `related_draft_source_ids` on the Low-Rise proposal |
| create a change warning and trigger a human re-review | `draftChangeWarnings` returns only `{ kind: "draft_change_warning", action: "human_re_review" }` |

| A draft may not | Enforced by |
| --- | --- |
| support a criterion rule, and so generate a disqualifier or a consistent finding | The production schema accepts a human-verification `source_capture` only with `source_type` `adopted_ordinance` or `official_memo` and `operative_status: "operative"`. Otherwise the criterion stays pending: status `unreviewed`, release blocked. `humanRecordCaptureIssues` also rejects a record that relabels a draft capture as operative. |
| replace the adopted source | `expectedSourceIssues` pins each source ID to one source type and URL; a draft filed as `ordinance-188967` fails the tests |
| make a pathway releasable | follows from the above: a criterion without a valid record always carries a `pending_human_criterion` release blocker |

If the draft is adopted, the adopted ordinance is captured as a new `adopted_ordinance` source with its own ID. The affected criteria are then re-reviewed against it by a human.

## The verification gate

A criterion listed in `humanVerificationRequiredCriterionIds` (`app/src/shared/program-screen/types.ts`) runs a rule only when all of the following hold:

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

## Proposed verification records

`app/fixtures/program-screen/proposed-verifications/<criterion-id>.json` holds one proposal per criterion. A proposal prepares a human review; it is not one.

- `reviewer` and `reviewed_at` are always `null`; the schema rejects any other value, human or AI.
- The production schema rejects a proposal as a human-verification record. A criterion carrying one stays pending.
- No production module imports `proposed-verification.ts` or reads the proposals directory; a test enforces this.
- `awaiting_source_capture`: no source hash, page, pinpoint, or excerpt. All nine proposals are in this state.
- `awaiting_human_review`: needs `source_sha256` (the capture's `sha256_extracted`), `candidate_page`, `candidate_pinpoint`, and `candidate_excerpt`. The excerpt must appear on that page of the capture (`proposalCaptureIssues`), and the source must be an operative, non-draft capture.

Only a later branch, after a named human reviewer approves a proposal, may convert its criterion to `human_verified`.

### Converting a criterion (human reviewer checklist)

1. Capture the official source with `npm run program-screen:capture` (see the manual download list).
2. Fill the proposal's candidate fields from `extracted.txt` and set it to `awaiting_human_review`. The tests check the excerpt, page, and hash.
3. Read the provision in the original PDF and decide: A (encode), B (keep pending), or C (remove or narrow). Stop at B if the text does not clearly support a deterministic predicate.
4. For A:
   - Narrow facts first where the proposal says narrowing is required.
   - Write the predicate. It returns `consistent_with_source`, `disqualifying_per_source`, or `requires_judgment`, and uses no other logic.
   - Point the criterion `citation` at the operative source and pinpoint.
   - Set `human_verified` and fill in the record, naming yourself as the reviewer.
   - Set `basis.repo_path` to the capture's `extracted.txt` and `basis.excerpts` to the excerpt.
5. Add a `verifiedCases` entry and update the pins:
   - the human-verified list;
   - the executable-predicate list;
   - the pending lists in `program-screen-core.test.ts`, `program-screen-fixture.test.ts`, and `program-screen-source-capture.test.ts`;
   - the public-demo `pending_human_criterion` count.
6. Update the fictional fixture only if the verified rule changes its expected result.

## Per-criterion ledger (proposed verification targets)

Every row's decision is **B: keep `pending_human`**, for the same reason: no official text has been captured or reviewed. Each entry is generated from its proposal file, and a test keeps each question identical in both places. The questions are for the reviewer to answer from the official text. They do not assert what that text says.

### SHRA (as amended by SB 684 / SB 1123; the City memo also covers AB 130)

#### `la_shra.lot-area-and-zoning`

- **Proposal file:** `app/fixtures/program-screen/proposed-verifications/la_shra.lot-area-and-zoning.json` (status `awaiting_source_capture`)
- **Official source required:** `shra-2025-10-28`: the City's October 28, 2025 SHRA implementation memorandum (City Planning, LADBS, Bureau of Engineering)
- **Multiple official sources:** possibly. Chaptered text of SB 684 (2023) and SB 1123 (2024) on leginfo.legislature.ca.gov, if the memo cross-references state requirements instead of restating them.
- **Section / page to review:** Not yet located: the October 28, 2025 SHRA implementation memo (shra-2025-10-28) has not been captured, so no page or section has been read. Look for the memo's discussion of lot size and eligible zones. The criterion currently cites the City SHRA page ("Filing checklists and implementation memo"), not a memo pinpoint; a converted record must cite the memo pinpoint instead.
- **Question for the reviewer:** Does the memo state a lot-area limit or a list of eligible zones for SHRA projects? If so, record: the exact numeric limit and unit; whether the comparison is inclusive or exclusive; whether it applies to the lot before subdivision; whether the vacant single-family-zoned path and the other path use different limits or zone lists; and whether each zone list is exhaustive.
- **Facts read now:** `lot-area`, `zoning`
- **Controlled values the evaluator needs:** lot-area is already a number in sq ft. zoning is free text; a rule needs a human-recorded zone-class value from a controlled list of the classes the memo names, plus a controlled value for which SHRA path the project uses.
- **Fact narrowing before encoding:** required. Split into a lot-area criterion (one per path if the paths differ) and a zone-class criterion. Never parse free-text zoning into a zone class.
- **Proposed predicate shape (only if the reviewer agrees):** If the reviewer finds limit L with comparator C for path P: lot-area C L -> consistent_with_source; otherwise -> disqualifying_per_source; path not recorded -> requires_judgment. If the reviewer finds an exhaustive zone list Z: zone class in Z -> consistent_with_source; not in Z -> disqualifying_per_source. A non-exhaustive list -> requires_judgment when the zone class is not in Z.
- **Must remain unknown or professional when:**
  - lot area is missing, unreviewed, or in conflict between sources
  - the recorded lot area may not be the pre-subdivision lot area
  - the zone class is not a value from the controlled list
  - the SHRA path is undetermined; vacancy stays professional under la_shra.vacant-site-definition
  - the parcel is Chapter 1A, which la_shra.implementation-memo-scope leaves to Planning
- **ZIMAS conflict risk:** Medium. Lot area from ZIMAS and from other records can differ; a difference stays a conflict. The ZIMAS SHRA program field stays observation-only and can only raise a divergence blocker.

#### `la_shra.existing-structures-and-occupancy`

- **Proposal file:** `app/fixtures/program-screen/proposed-verifications/la_shra.existing-structures-and-occupancy.json` (status `awaiting_source_capture`)
- **Official source required:** `shra-2025-10-28`: the City's October 28, 2025 SHRA implementation memorandum (City Planning, LADBS, Bureau of Engineering)
- **Multiple official sources:** possibly. Chaptered text of SB 684 (2023) and SB 1123 (2024) on leginfo.legislature.ca.gov, if the memo cross-references state requirements instead of restating them. Los Angeles Housing Department records, if the reviewer finds Rent Stabilization Ordinance status relevant (rso-status fact).
- **Section / page to review:** Not yet located: the October 28, 2025 SHRA implementation memo (shra-2025-10-28) has not been captured, so no page or section has been read. Look for provisions on existing housing, demolition, tenant occupancy, or protected units, and any look-back period. The criterion currently cites the City SHRA page ("Filing checklists and implementation memo"), not a memo pinpoint; a converted record must cite the memo pinpoint instead.
- **Question for the reviewer:** Which existing-structure or residential-occupancy conditions, if any, does the memo treat as barring or conditioning an SHRA project? For each, record the exact condition, any look-back period and how it is measured, and whether it is a bar or a condition the project can satisfy (for example, by replacement).
- **Facts read now:** `existing-structures`, `occupancy-history`
- **Controlled values the evaluator needs:** existing-structures is a count of structures and may not express the condition the text uses. occupancy-history is free text and cannot drive a rule. A rule needs a structured, human-recorded fact for exactly the condition the text names, such as a yes/no for that condition within the stated period.
- **Fact narrowing before encoding:** required. Replace or supplement the bundle with facts that mirror each condition the reviewer finds. Keep vacancy out of this criterion; it stays professional under la_shra.vacant-site-definition.
- **Proposed predicate shape (only if the reviewer agrees):** If the reviewer finds bar B: B recorded true -> disqualifying_per_source; B recorded false from a record the text makes authoritative -> consistent_with_source; otherwise -> requires_judgment. A condition the project can satisfy -> requires_judgment.
- **Must remain unknown or professional when:**
  - occupancy history exists only as free text
  - the look-back period cannot be established from the record
  - the condition has exceptions or can be satisfied by the project
  - structure or occupancy records conflict
- **ZIMAS conflict risk:** Low to medium. The reviewer should determine which record authoritatively shows occupancy history; a parcel display alone does not show it. Structure counts from different records can differ; a difference stays a conflict.

#### `la_shra.prior-subdivisions`

- **Proposal file:** `app/fixtures/program-screen/proposed-verifications/la_shra.prior-subdivisions.json` (status `awaiting_source_capture`)
- **Official source required:** `shra-2025-10-28`: the City's October 28, 2025 SHRA implementation memorandum (City Planning, LADBS, Bureau of Engineering)
- **Multiple official sources:** possibly. Chaptered text of SB 684 (2023) and SB 1123 (2024) on leginfo.legislature.ca.gov, if the memo cross-references state requirements instead of restating them.
- **Section / page to review:** Not yet located: the October 28, 2025 SHRA implementation memo (shra-2025-10-28) has not been captured, so no page or section has been read. Look for any restriction tied to prior subdivision of the parcel or of adjacent parcels. The criterion currently cites the City SHRA page ("Filing checklists and implementation memo"), not a memo pinpoint; a converted record must cite the memo pinpoint instead.
- **Question for the reviewer:** Does the memo restrict SHRA projects based on a prior subdivision of the parcel or of adjacent parcels? If so, record which kinds of prior subdivision (statute or map type), any date window, and whether adjacency or common ownership matters.
- **Facts read now:** `prior-subdivisions`
- **Controlled values the evaluator needs:** prior-subdivisions is a yes/no for any recorded prior subdivision. A rule needs the subdivision type from a controlled list the text names and its recording date, and possibly adjacency and ownership facts.
- **Fact narrowing before encoding:** required. Replace the yes/no with structured facts for exactly the subdivision types, dates, and relationships the text names.
- **Proposed predicate shape (only if the reviewer agrees):** If the reviewer finds a restriction on subdivision types T within window W: a recorded subdivision of type T within W -> disqualifying_per_source; a complete, reviewed subdivision history with none -> consistent_with_source; an incomplete history -> requires_judgment.
- **Must remain unknown or professional when:**
  - the subdivision history is incomplete or comes from a single display
  - the subdivision type or date is unknown
  - the text involves adjacency or ownership facts that are not recorded
- **ZIMAS conflict risk:** Medium. A parcel display that shows no subdivision history does not prove none exists (PROJECT_LAWS law 4). Map references need the recorded map itself.

#### `la_shra.housing-element-site-status`

- **Proposal file:** `app/fixtures/program-screen/proposed-verifications/la_shra.housing-element-site-status.json` (status `awaiting_source_capture`)
- **Official source required:** `shra-2025-10-28`: the City's October 28, 2025 SHRA implementation memorandum (City Planning, LADBS, Bureau of Engineering)
- **Multiple official sources:** possibly. The City's Housing Element sites inventory, if the memo names it as the record of site status.
- **Section / page to review:** Not yet located: the October 28, 2025 SHRA implementation memo (shra-2025-10-28) has not been captured, so no page or section has been read. Look for any reference to Housing Element inventory sites or rezoning-program sites. The criterion currently cites the City SHRA page ("Filing checklists and implementation memo"), not a memo pinpoint; a converted record must cite the memo pinpoint instead.
- **Question for the reviewer:** Does the memo make a parcel's Housing Element site status relevant to SHRA eligibility? If so, record which status values matter, their effect, and which record authoritatively shows the status. If the memo does not mention it, decide whether this criterion should be removed rather than encoded.
- **Facts read now:** `housing-element-site-status`
- **Controlled values the evaluator needs:** housing-element-site-status is free text. A rule needs a controlled list matching the status values the text and its named record use.
- **Fact narrowing before encoding:** required. Convert to a controlled status fact, or remove the criterion if the text does not use it.
- **Proposed predicate shape (only if the reviewer agrees):** If the reviewer finds that status S bars the project: status S -> disqualifying_per_source; a status outside S from the named record -> consistent_with_source; an unrecorded or uncontrolled status -> requires_judgment.
- **Must remain unknown or professional when:**
  - the status is free text or absent from the named record
  - the text sets conditions (for example, replacement or density requirements) instead of a bar
- **ZIMAS conflict risk:** Medium. A ZIMAS display of Housing Element status, if present, may differ from the inventory the text names; the named record governs and a difference stays a conflict.

#### `la_shra.environmental-constraints`

- **Proposal file:** `app/fixtures/program-screen/proposed-verifications/la_shra.environmental-constraints.json` (status `awaiting_source_capture`)
- **Official source required:** `shra-2025-10-28`: the City's October 28, 2025 SHRA implementation memorandum (City Planning, LADBS, Bureau of Engineering)
- **Multiple official sources:** possibly. Chaptered text of SB 684 (2023) and SB 1123 (2024) on leginfo.legislature.ca.gov, if the memo cross-references state requirements instead of restating them. The map or record that defines each designation the text names.
- **Section / page to review:** Not yet located: the October 28, 2025 SHRA implementation memo (shra-2025-10-28) has not been captured, so no page or section has been read. Look for any list of excluded or restricted site conditions (hazard, environmental, or resource designations) and their exceptions. The criterion currently cites the City SHRA page ("Filing checklists and implementation memo"), not a memo pinpoint; a converted record must cite the memo pinpoint instead.
- **Question for the reviewer:** Which environmental site designations, if any, does the memo list as barring or conditioning an SHRA project, and with what exceptions? For each of the five designations this criterion reads (Very High Fire Hazard Severity Zone, hillside area, fault zone, landslide area, flood zone), record whether the text names it, the exact term used, the map or record that defines it, and any exception.
- **Facts read now:** `very-high-fire-hazard-severity-zone`, `hillside-area`, `fault-zone`, `landslide-area`, `flood-zone`
- **Controlled values the evaluator needs:** Each fact is a yes/no designation. A rule needs each fact to mean exactly the designation the text names, such as one specific flood designation rather than any flood mapping.
- **Fact narrowing before encoding:** required. Split into one criterion per named designation. Drop any designation the text does not name. A designation with exceptions becomes a judgment criterion.
- **Proposed predicate shape (only if the reviewer agrees):** For each designation D the reviewer finds as a bar without exceptions: D recorded true -> disqualifying_per_source; D recorded false from its defining record -> consistent_with_source. D with exceptions -> requires_judgment when true.
- **Must remain unknown or professional when:**
  - the defining record conflicts with another source (the fictional fixture's fire-hazard conflict stays contested)
  - the exceptions depend on project facts
  - the designation comes only from a display that is not its defining record
- **ZIMAS conflict risk:** High. ZIMAS hazard displays and the defining hazard maps can disagree, as the fictional fixture's fire-hazard conflict models. A disagreement stays a conflict and the pathway stays contested.

### SB 79 / Phased Implementation (Ordinance 188968)

#### `la_sb79.permanent-exclusion`

- **Proposal file:** `app/fixtures/program-screen/proposed-verifications/la_sb79.permanent-exclusion.json` (status `awaiting_source_capture`)
- **Official source required:** `ordinance-188968`: Ordinance No. 188968 (SB 79 Phased Implementation Ordinance)
- **Multiple official sources:** possibly. Any adoption map or exhibit the ordinance incorporates, if exclusions are shown by map rather than by text. SB 79 (2025) chaptered text on leginfo.legislature.ca.gov, if the ordinance relies on state-defined exclusions.
- **Section / page to review:** Not yet located: Ordinance 188968 (ordinance-188968) has not been captured, so no page or section has been read. The repository's current citation pointer is "Sections 1-6: permanent exclusions and mapping provisions", taken from repository notes, not from the ordinance text.
- **Question for the reviewer:** Which categories of parcels does Ordinance 188968 permanently exclude, and what legal effect does an exclusion have on SB 79 applicability for the parcel? Which record (ordinance text, map, exhibit, or ZIMAS field) authoritatively shows whether a given parcel is excluded? Does absence from that record establish that a parcel is not excluded?
- **Facts read now:** `sb79-permanent-exclusion`
- **Controlled values the evaluator needs:** sb79-permanent-exclusion is a yes/no: the adopted record shows a permanent exclusion for the parcel. The reviewer should determine whether yes/no is enough, or whether the exclusion category must be recorded because categories have different effects.
- **Fact narrowing before encoding:** not expected; see controlled values.
- **Proposed predicate shape (only if the reviewer agrees):** If the reviewer finds that a permanent exclusion makes SB 79 inapplicable: shown -> disqualifying_per_source. Not shown -> consistent_with_source only if the reviewer determines the named record is exhaustive; otherwise -> requires_judgment.
- **Must remain unknown or professional when:**
  - the parcel's exclusion record is missing or was not retrieved; a failed lookup is not a no
  - the ordinance record and a ZIMAS display disagree
  - the exclusion's effect differs by category and the category is not recorded
- **ZIMAS conflict risk:** High. zimas-sb79-exemption stays observation-only; if it disagrees with the criterion result, the existing program_flag_divergence blocker applies. It never settles the criterion.

#### `la_sb79.temporary-exemption`

- **Proposal file:** `app/fixtures/program-screen/proposed-verifications/la_sb79.temporary-exemption.json` (status `awaiting_source_capture`)
- **Official source required:** `ordinance-188968`: Ordinance No. 188968 (SB 79 Phased Implementation Ordinance)
- **Multiple official sources:** possibly. The City's Housing Element adoption record, if the exemption ends on that event.
- **Section / page to review:** Not yet located: Ordinance 188968 (ordinance-188968) has not been captured, so no page or section has been read. The repository's current citation pointer is "Sections 1-6: temporary exemptions", taken from repository notes, not from the ordinance text.
- **Question for the reviewer:** Which parcels does Ordinance 188968 temporarily exempt, what is the effect during the exemption, and exactly when, or on what event, does the exemption end? Can the end condition be recorded as a dated fact?
- **Facts read now:** `sb79-temporary-exemption`
- **Controlled values the evaluator needs:** sb79-temporary-exemption is a yes/no. A time-bounded rule also needs a human-recorded end condition: a date, or a recorded event with its date.
- **Fact narrowing before encoding:** required. Add an end-condition fact (a date, or a dated event) and compare it with the screen's as_of date. A yes/no alone cannot express a time-bounded rule.
- **Proposed predicate shape (only if the reviewer agrees):** If the reviewer finds that an exemption makes SB 79 inapplicable until end condition E: exempt and E not reached as of as_of -> disqualifying_per_source; E reached per a dated record -> consistent_with_source; E not recorded -> requires_judgment.
- **Must remain unknown or professional when:**
  - the end condition is an event with no recorded date
  - the parcel's exemption record is missing or conflicting
  - the effect during the exemption is partial rather than a full bar
- **ZIMAS conflict risk:** High. zimas-sb79-exemption records one display for exemption or exclusion, so it cannot tell the two apart; it stays observation-only.

#### `la_sb79.site-and-overlay-standards`

- **Proposal file:** `app/fixtures/program-screen/proposed-verifications/la_sb79.site-and-overlay-standards.json` (status `awaiting_source_capture`)
- **Official source required:** `ordinance-188968`: Ordinance No. 188968 (SB 79 Phased Implementation Ordinance)
- **Multiple official sources:** possibly. SB 79 (2025) chaptered text on leginfo.legislature.ca.gov: the reviewer should determine which zoning, overlay, and existing-housing standards come from state law and which from the ordinance. The City SB 79 page and adoption maps (the current citation), if needed to apply the ordinance.
- **Section / page to review:** Not yet located: Ordinance 188968 (ordinance-188968) has not been captured, so no page or section has been read. The criterion currently cites the City SB 79 page ("Adoption status and current mapping links"); a converted record must cite the operative instrument instead.
- **Question for the reviewer:** Which zoning designations, overlays (Specific Plan areas, Historic Preservation Overlay Zones), and existing-housing conditions does Ordinance 188968, read with SB 79, treat as making a parcel ineligible or subject to different standards?
- **Facts read now:** `zoning`, `specific-plan-area`, `hpoz`, `existing-dwelling-units`
- **Controlled values the evaluator needs:** zoning is free text; specific-plan-area and hpoz are yes/no; existing-dwelling-units is a count. A rule needs a controlled zone class and, for existing housing, a fact matching the exact condition the text names.
- **Fact narrowing before encoding:** required. Split into zoning, overlay, and existing-housing criteria. Transit-stop proximity and tier are not encodable: no reviewed transit fact exists, and the ZIMAS tier and category fields stay observation-only.
- **Proposed predicate shape (only if the reviewer agrees):** For each standard the reviewer finds: a listed disqualifying zone class, overlay, or existing-housing condition recorded true -> disqualifying_per_source; a complete, reviewed record showing none -> consistent_with_source; a standard that depends on transit tier or project facts -> requires_judgment.
- **Must remain unknown or professional when:**
  - transit-stop proximity or tier matters (not encodable)
  - zoning exists only as free text
  - overlay treatment has exceptions
  - existing-housing records conflict
- **ZIMAS conflict risk:** High. zimas-sb79-category and zimas-sb79-tier stay observation-only and must never substitute for a standard read from the text.

### Low-Rise (Ordinance 188967)

#### `la_low_rise.geographic-criteria`

- **Proposal file:** `app/fixtures/program-screen/proposed-verifications/la_low_rise.geographic-criteria.json` (status `awaiting_source_capture`)
- **Official source required:** `ordinance-188967`: Ordinance No. 188967 (Low-Rise Ordinance)
- **Related draft (re-review trigger only):** `low-rise-draft-2026-09-24`
- **Multiple official sources:** possibly. Any map or exhibit Ordinance 188967 incorporates for geographic applicability.
- **Section / page to review:** Not yet located: Ordinance 188967 (ordinance-188967) has not been captured, so no page or section has been read. The repository's current citation pointer is "Sections 5-9: geographic criteria", taken from repository notes, not from the ordinance text.
- **Question for the reviewer:** Which zones, General Plan land-use designations, and geographies does Ordinance 188967 place within the Low-Rise program? How are Specific Plan areas treated? Does the ordinance distinguish Zoning Code Chapter 1 from Chapter 1A? What exclusions apply? Separately: does the September 24, 2026 draft in Council File 25-1083-S3 propose changes to these provisions? A draft change only triggers a re-review; it cannot change the rule.
- **Facts read now:** `zoning`, `general-plan-land-use`, `specific-plan-area`
- **Controlled values the evaluator needs:** zoning and general-plan-land-use are free text; specific-plan-area is yes/no. A rule needs controlled zone-class and General Plan values matching the ordinance's lists, and possibly zoning-code-chapter (already controlled: Chapter 1 or Chapter 1A).
- **Fact narrowing before encoding:** required. Replace free-text zoning and General Plan facts with controlled values from the ordinance's lists. Add zoning-code-chapter only if the ordinance distinguishes the chapters.
- **Proposed predicate shape (only if the reviewer agrees):** If the reviewer finds exhaustive lists: zone class and General Plan designation within the lists, and no exclusion recorded -> consistent_with_source; outside an exhaustive list, or an exclusion recorded -> disqualifying_per_source; a Specific Plan area with case-by-case treatment -> requires_judgment.
- **Must remain unknown or professional when:**
  - zoning or General Plan values are free text or conflicting
  - a Specific Plan applies and the ordinance defers to it
  - the September 24, 2026 draft is adopted: the adopted instrument must be captured and re-reviewed before any rule changes
- **ZIMAS conflict risk:** Medium. zimas-low-rise-category stays observation-only; a divergence raises the existing blocker. ZIMAS zoning strings must never be parsed into zone classes.

## Fact types that need narrowing before a deterministic rule is safe

From the proposals above:

| Fact | Current shape | Why it is not safe yet |
| --- | --- | --- |
| `zoning` | free text | A zone class must never be parsed from a string; it needs a controlled, human-recorded value (SHRA, SB 79, Low-Rise). |
| `general-plan-land-use` | free text | Same, for Low-Rise. |
| `occupancy-history` | free text | Cannot drive any rule; needs a structured fact for the exact condition the text names. |
| `housing-element-site-status` | free text | Needs a controlled status list, or removal if the text does not use it. |
| `prior-subdivisions` | yes/no | Too coarse if the text restricts only some subdivision types or dates. |
| `existing-structures` | count | May not express the protected-housing condition the text uses. |
| `sb79-temporary-exemption` | yes/no | A time-bounded rule needs a dated end condition. |
| hazard booleans (`very-high-fire-hazard-severity-zone`, `hillside-area`, `fault-zone`, `landslide-area`, `flood-zone`) | yes/no each | Each must mean exactly the designation the text names; the SHRA bundle should split per designation. |

`lot-area` (sq ft), `specific-plan-area`, `hpoz`, `sb79-permanent-exclusion`, and `zoning-code-chapter` are already controlled. They may still need companion facts, as noted per criterion.

## Additional official document (not opened)

A web search on 2026-09-27, during the earlier pass, surfaced a City Planning Commission report on these ordinances: https://planning.lacity.gov/odocument/2b757bb9-c175-4870-bbf0-42af19217060/CPC-2026-1798_DL.pdf. It was not opened (host blocked) and is not evidence.

## Not in scope, but flagged

- **Repo-sourced criteria rest on PermitPulse's own guide prose, not captured official text.** These are:
  - `la_shra.implementation-memo-scope`, which runs a predicate;
  - `la_shra.vacant-site-definition` and `la_low_rise.overlay-review` (judgment criteria);
  - the parcel-match and jurisdiction anchors.

  A human should re-verify them against captured text and convert them to `human_verified`.
- **Wording concern.** In the fixture, the fire-hazard conflict makes SHRA "contested" through the unverified environmental-constraints bundle. The pathway statement says sources disagree on "a fact this pathway depends on." That presumes fire hazard matters for SHRA before anyone has verified it.
- **ZIMAS program fields are unchanged.** They are observations only and are never criterion inputs.
- **State statute text has no source type yet.** The SHRA and SB 79 proposals may need chaptered state text from `leginfo.legislature.ca.gov`. The capture tool accepts that host, but `source_type` has no statute value. If the reviewer needs statute text, add one in a later branch; do not capture a statute as an `adopted_ordinance`.
- **`clkrep.lacity.org` is allowed as a City Clerk host.** Council File attachments are often served from it. Remove it from `officialSourceHosts` if you do not want it treated as official.
- **Image-only PDFs.** A scanned ordinance without a text layer yields no extractable text, and the tool refuses it. Such a source would need an official text-layer version or a separately designed, human transcription path.

## Retrieval log

| Date | Method | Hosts | Result |
| --- | --- | --- | --- |
| 2026-09-27 | HTTPS through the environment proxy (curl) | cityclerk.lacity.org, planning.lacity.gov, leginfo.legislature.ca.gov, lacity.gov, clkrep.lacity.org, www.hcd.ca.gov | CONNECT rejected by the environment egress policy (403). Re-probed later the same day: still rejected. |
| 2026-09-27 | Web fetch tool | cityclerk.lacity.org, planning.lacity.gov, leginfo.legislature.ca.gov | EGRESS_BLOCKED |
| 2026-09-27 (capture pass) | HTTPS through the environment proxy (curl), direct PDF URLs for Ordinances 188967 and 188968 and the SHRA memo, plus both host roots | cityclerk.lacity.org, planning.lacity.gov | CONNECT rejected by the egress policy (403, `connect_rejected`) |
| 2026-09-27 (capture pass) | Web fetch tool, Ordinance 188967 PDF URL | cityclerk.lacity.org | EGRESS_BLOCKED. This tool returns processed text, not file bytes, so it could not have produced a capture in any case. |
| 2026-09-27 (capture pass) | Search of the session filesystem for attached official PDFs | n/a | None found |
