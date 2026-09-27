# Program Screen criterion verification ledger

Scope: the nine City of Los Angeles Program Screen criteria that were `pending_human` when the core shipped (PR #15).

Passes:

- **2026-09-27, criterion-verification pass (PR #16).** Added the human-verification gate. Nothing verified.
- **2026-09-27, official-source capture tooling (PR #17).** Added capture tooling, capture integrity checks, the draft-versus-operative guard, and one proposed verification target per criterion. No official source captured. Nothing verified.
- **2026-09-27, official-source capture (this branch).** Captured the four official PDFs the repository owner supplied, with the existing capture tool. Filled all nine proposals with candidate pages, pinpoints, excerpts, and proposed splits, and moved them to `awaiting_human_review`. Nothing verified.

## Outcome

| Result | Criteria |
| --- | --- |
| A. `human_verified` and encoded | **None** |
| B. Still `pending_human` | **All nine** (listed below). No predicate is encoded and no shipped criterion changed. |
| C. Removed or narrowed | **None yet.** Each proposal says which parts should be split, narrowed, or removed; a human reviewer decides. |
| Official sources captured | **Four**: `ordinance-188967`, `ordinance-188968`, `shra-2025-10-28` (operative), and `low-rise-draft-2026-09-24` (proposed draft, not operative). |
| Proposed verification records | **Nine**, all `awaiting_human_review`, with 39 candidate components between them. No reviewer, no review date. |

Nothing in this ledger is a verification. The capture pins what the City's documents say; the proposals are one preparer's reading for a named human reviewer to accept, change, or reject. The fictional Program Screen fixture and the public demo stay non-releasable with nine `pending_human_criterion` blockers.

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

`npm run program-screen:capture:verify` reports `ok` for all four official captures and both TEST-ONLY captures, and `npm run program-screen:capture:selftest` passes all 18 checks. Each capture matches its `expectedOfficialSources` entry (URL, type, `may_change_source_ids`), and only the three operative sources satisfy `canSupportCriterionRule`.

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

`npm run program-screen:capture:verify` re-hashes every capture and re-extracts every PDF. It fails if any file changed, or if the installed `pdfjs-dist` would extract different text. `npm run program-screen:capture:selftest` runs the tool against the TEST-ONLY synthetic PDF in a temporary directory and checks every refusal above.

`app/tests/program-screen-source-capture.test.ts` re-checks every capture on every test run. The tests run inside workerd, which receives each module over a WebSocket capped at 32 MiB, and Ordinance 188967's PDF alone exceeds that once inlined as base64. So `app/tests/program-screen-capture-bytes.global-setup.ts` reads every official capture's exact bytes in Node, runs the same `officialSourceCaptureIssues` check, and provides the result; the test fails on any issue, on any capture directory the setup did not check, and on any hash that differs from the pins in the test. The extracted text is loaded and re-hashed inside the worker as well. The test also requires every official capture to match its entry in `expectedOfficialSources`, and it rejects any other file in `official-sources/` (HTML, notes, or loose text).

## Operative law versus drafts

The September 24, 2026 draft in Council File 25-1083-S3 is captured as its own source (`low-rise-draft-2026-09-24`, `proposed_draft`, `proposed_not_operative`). It never replaces Ordinance 188967.

| A draft may | Enforced by |
| --- | --- |
| appear in this ledger | the capture list above, the change report below, and `related_draft_source_ids` on the Low-Rise proposal |
| create a change warning and trigger a human re-review | `draftChangeWarnings` returns only `{ kind: "draft_change_warning", action: "human_re_review" }`; with the real captures it flags only `la_low_rise.geographic-criteria` (pinned in the test) |

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

**Effect on the Program Screen criteria: none found.** No Program Screen criterion reads density, FAR, parking, height, or unit counts. The draft does not amend any provision `la_low_rise.geographic-criteria` rests on: the Sec. 5 definitions, (c)(4)-(10), (g)(1) and Table 12.22 A.38.(g)(1)(i), (g)(1)(iii), (j)(7), or (j)(16). No proposal excerpt comes from the amended table. `la_low_rise.overlay-review` and the SB 79 and SHRA criteria are unaffected.

**Re-review triggers.**

- Now: the captured draft raises the designed `draft_change_warning` for `ordinance-188967`, flagging `la_low_rise.geographic-criteria` for human re-review. On the content above, the re-review is a confirmation that no cited provision changed.
- If the draft (or any other amendment of LAMC 12.22 A.38) is adopted: capture the adopted instrument as a new `adopted_ordinance` source, confirm no Low-Rise citation points at Table 12.22 A.38(g)(3)(i), and re-review the Low-Rise components against it before any rule changes.
- Outside the draft, any of these would also trigger re-review: a new or updated Director's Low-Rise or SB 79 exemption map; SCAG's final TOD map; HCD action on Ordinance 188968; adoption of the seventh Housing Element revision; a Director determination under Ordinance 188967 Sec. 14 (LAMC 12.22 A.38(m)); or a replacement SHRA memo, including the promised Chapter 1A memo.

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
- `awaiting_source_capture`: no source hash, page, pinpoint, excerpt, or components.
- `awaiting_human_review` (all nine now): needs `source_sha256` (the capture's `sha256_extracted`), `candidate_page`, `candidate_pinpoint`, `candidate_excerpt`, and at least one entry in `candidate_components`. The headline candidate must be the first component's first excerpt. Every excerpt must appear on its stated page of the capture (`proposalCaptureIssues`), and the source must be an operative, non-draft capture.
- `candidate_components` divides a criterion the way the source does. Each component has a proposed ID, pinpoint, one or more page-checked excerpts, a disposition, the existing facts it reads, new facts it needs, a controlled-value encoding, a proposed rule (required for a deterministic disposition and forbidden otherwise), and the ambiguities or reasons for judgment. Dispositions:
  - `deterministic_candidate`: both outcomes could be encoded once the named facts are controlled and human-recorded.
  - `partially_deterministic`: only one direction is safe; the other stays unknown or judgment.
  - `professional_judgment`: must stay a Planning judgment.
  - `no_rule_in_source`: the source states no such rule; remove the fact or find another official source.
- Component IDs are proposals. None is a shipped criterion, and nothing reads them.

Only a later branch, after a named human reviewer approves a proposal, may convert its criterion to `human_verified`.

### Converting a criterion (human reviewer checklist)

1. Read the proposal's excerpts against the original PDF's page images (both ordinances are OCR scans).
2. Decide: A (encode), B (keep pending), or C (remove or narrow). Stop at B if the text does not clearly support a deterministic predicate.
3. For A:
   - Narrow or split facts first where the proposal says so; add any new fact to `programFactKeys` with its controlled values.
   - Write the predicate. It returns `consistent_with_source`, `disqualifying_per_source`, or `requires_judgment`, and uses no other logic.
   - Point the criterion `citation` at the operative source and pinpoint.
   - Set `human_verified` and fill in the record, naming yourself as the reviewer.
   - Set `basis.repo_path` to the capture's `extracted.txt` and `basis.excerpts` to the excerpt.
4. Add a `verifiedCases` entry and update the pins:
   - the human-verified list;
   - the executable-predicate list;
   - the pending lists in `program-screen-core.test.ts`, `program-screen-fixture.test.ts`, and `program-screen-source-capture.test.ts`;
   - the public-demo `pending_human_criterion` count.
5. Update the fictional fixture only if the verified rule changes its expected result.

## Per-criterion ledger (proposed verification targets)

Every row's decision is still **B: keep `pending_human`** until a human reviewer decides. Each entry below is generated from its proposal file, and a test keeps each question identical in both places. "Deterministic" and "judgment" below are the preparer's proposals, not findings.

### SHRA (as amended by SB 684 / SB 1123; the City memo also covers AB 130)

#### `la_shra.lot-area-and-zoning`

- **Proposal file:** `app/fixtures/program-screen/proposed-verifications/la_shra.lot-area-and-zoning.json` (status `awaiting_human_review`)
- **Official source:** `shra-2025-10-28`: the City's October 28, 2025 SHRA implementation memorandum (City Planning, LADBS, Bureau of Engineering); `source_sha256` `f44574084091c51419d0475d4b8501d9a2c3577b3a16830fc6ecb2a88b20f6e2`
- **Other sources the reviewer may need:** GCS 66499.41, to define multifamily-zoned lots and the qualified-urban-uses test. Chaptered text of the statute on leginfo.legislature.ca.gov. It cannot be captured as evidence until a statute source type exists; do not capture it as an adopted_ordinance. The ZIMAS SHRA Eligibility Criteria Checklist the memo points to (page 2), as an observation only.
- **Where it is:** Located in shra-2025-10-28 (20 pages, born-digital text). Part I, SHRA Property Eligibility Criteria, page 2, states the lot-size limits and the qualified-urban-uses test. FAQ Q.1, page 12, defines the single-family zones. Page 1 limits the memo to Chapter 1 and describes it as a summary of the SHRA.
- **Headline candidate (page 2):** Memo Part I, SHRA Property Eligibility Criteria, page 2 (lot-size paragraph): “To qualify, multifamily-zoned lots must be less than 5 acres, and single-family zoned lots must be under 1.5 acres and "vacant." (See FAQ Section, Q.1.)”
- **Question for the reviewer:** The memo (page 2) states that multifamily-zoned lots must be less than 5 acres and single-family-zoned lots under 1.5 acres and vacant, and FAQ Q.1 (page 12) lists the single-family zones. Do you agree that each limit is a strict less-than on the pre-subdivision lot area, that the single-family zone list is exhaustive, and that this criterion should be split into a zone-category criterion and one lot-area criterion per path? Which official source defines multifamily-zoned lots, given that the memo does not list those zones?
- **Facts read now:** `lot-area`, `zoning`
- **Controlled values proposed:** lot-area is already sq ft. zoning is free text and cannot drive the rule; add a human-recorded shra-zone-category (single_family_listed | multifamily | neither | undetermined). Limits in sq ft: 217,800 (5 acres) and 65,340 (1.5 acres), at 43,560 sq ft per acre.
- **Split or narrowing:** Split into la_shra.zone-category, la_shra.lot-area-multifamily, and la_shra.lot-area-single-family (see candidate_components). Vacancy stays in la_shra.vacant-site-definition. The qualified-urban-uses test is a separate judgment the current facts do not cover.
- **Proposed predicate shape (only if the reviewer agrees):** Multifamily: lot-area < 217,800 sq ft -> consistent_with_source, otherwise disqualifying_per_source. Single-family (listed zones): lot-area < 65,340 sq ft -> consistent_with_source for the area limit, otherwise disqualifying_per_source; vacancy stays requires_judgment. Zone category undetermined -> requires_judgment.
- **Must remain unknown or professional when:**
  - lot area is missing, unreviewed, or conflicting between sources
  - the recorded lot area may not be the pre-subdivision lot area
  - the zone category is not a human-recorded controlled value
  - the zone is not on the memo's single-family list and no official source classifies it as multifamily-zoned
  - the parcel is Chapter 1A, which la_shra.implementation-memo-scope leaves to Planning
- **ZIMAS conflict risk:** Medium. The memo tells users to consult the SHRA Eligibility Criteria Checklist in ZIMAS and says City Planning will confirm eligibility (page 2). That checklist is not captured; zimas-shra-program-field stays observation-only and can only raise a divergence blocker. Lot area from ZIMAS and survey records can differ; a difference stays a conflict.
- **Candidate components:**

  | Component | Disposition | Pages | Pinpoint | Proposed rule |
  | --- | --- | --- | --- | --- |
  | `la_shra.lot-area-multifamily` | `deterministic_candidate` | p. 2 | Memo Part I, SHRA Property Eligibility Criteria, page 2 (lot-size paragraph) | If shra-zone-category is multifamily: lot-area < 217,800 sq ft -> consistent_with_source; lot-area >= 217,800 sq ft -> disqualifying_per_source. Missing or conflicting lot area -> unknown or conflict. Any other zone category: this component does not apply. |
  | `la_shra.lot-area-single-family` | `deterministic_candidate` | p. 2 | Memo Part I, SHRA Property Eligibility Criteria, page 2 (lot-size paragraph) | If shra-zone-category is single_family_listed: lot-area < 65,340 sq ft -> consistent_with_source for the area limit only; lot-area >= 65,340 sq ft -> disqualifying_per_source. The same sentence requires the lot to be vacant; that stays requires_judgment under la_shra.vacant-site-definition. |
  | `la_shra.zone-category` | `partially_deterministic` | p. 12 | Memo FAQ Q.1, page 12 (definition of zoned for single-family residential development) | single_family_listed -> the single-family path (1.5-acre limit plus the vacancy judgment). multifamily -> the multifamily path (5-acre limit). neither -> disqualifying_per_source only if the reviewer confirms the two categories are exhaustive. undetermined -> requires_judgment. |
  | `la_shra.urban-uses-surround` | `professional_judgment` | p. 2 | Memo Part I, SHRA Property Eligibility Criteria, page 2 | none (The memo defers to GCS 66499.41(a)(2)(B), which is not captured) |

#### `la_shra.existing-structures-and-occupancy`

- **Proposal file:** `app/fixtures/program-screen/proposed-verifications/la_shra.existing-structures-and-occupancy.json` (status `awaiting_human_review`)
- **Official source:** `shra-2025-10-28`: the City's October 28, 2025 SHRA implementation memorandum (City Planning, LADBS, Bureau of Engineering); `source_sha256` `f44574084091c51419d0475d4b8501d9a2c3577b3a16830fc6ecb2a88b20f6e2`
- **Other sources the reviewer may need:** GCS 66499.41(a)(8), for the exact demolition-protection test. Chaptered text of the statute on leginfo.legislature.ca.gov. It cannot be captured as evidence until a statute source type exists; do not capture it as an adopted_ordinance. Los Angeles Housing Department records for RSO status, covenants, and Ellis Act withdrawals. LADBS permit records for the five-year look-back.
- **Where it is:** Located in shra-2025-10-28: Part I, Demolition Protections, pages 3-4 (GCS 66499.41(a)(8), the SB 1123 no-separation rule, and the Ellis Act bar). Vacancy is FAQ Q.1, page 12, and stays in la_shra.vacant-site-definition.
- **Headline candidate (page 3):** Memo Part I, Demolition Protections, page 3 (GCS 66499.41(a)(8)): “Specifically, a project may not be approved if it would require the demolition or alteration of any of the following types of housing:”
- **Question for the reviewer:** The memo (pages 3-4) bars a project that would demolish or alter covenant-restricted, rent-controlled (including RSO), or recently tenant-occupied housing, and bars sites with an Ellis Act withdrawal within 15 years of the application. Do you agree that the Ellis Act bar can be encoded from a dated LAHD record, that the demolition protections must stay judgment whenever protected housing is present because they depend on the project, and that occupancy-history (free text) and existing-structures (a count) should be replaced by the structured facts proposed? How should look-back periods that run from the application date be measured in a screen that has no application?
- **Facts read now:** `existing-structures`, `occupancy-history`
- **Controlled values proposed:** occupancy-history is free text and cannot drive a rule. existing-structures counts any structure and cannot express protected housing. Proposed: residential-use-within-5-years (yes/no), affordability-covenant-recorded (yes/no), rso-status (existing), and ellis-act-withdrawal-date (a date or none), each human-recorded from the record named.
- **Split or narrowing:** Split into la_shra.protected-housing-demolition, la_shra.ellis-act-withdrawal, and la_shra.existing-units-not-separated (see candidate_components). Vacancy stays professional under la_shra.vacant-site-definition.
- **Proposed predicate shape (only if the reviewer agrees):** Ellis Act: a withdrawal within 15 years before the application -> disqualifying_per_source; none in a reviewed LAHD record -> consistent_with_source. Demolition protections: no housing within the look-back (reviewed) -> consistent_with_source; protected housing present -> requires_judgment. No-separation rule: project design, not screened.
- **Must remain unknown or professional when:**
  - occupancy history exists only as free text
  - the look-back period cannot be measured because no application date is recorded
  - protected housing is present and the project's demolition or alteration is unknown
  - structure, occupancy, RSO, or covenant records conflict
- **ZIMAS conflict risk:** Low to medium. The memo points to the ZIMAS eligibility checklist for the Ellis Act bar (page 4); ZIMAS stays observation-only unless the reviewer designates the LAHD record. A parcel display alone does not show occupancy history.
- **Candidate components:**

  | Component | Disposition | Pages | Pinpoint | Proposed rule |
  | --- | --- | --- | --- | --- |
  | `la_shra.protected-housing-demolition` | `partially_deterministic` | p. 3 | Memo Part I, Demolition Protections, page 3 (GCS 66499.41(a)(8)) | residential-use-within-5-years recorded false from a reviewed record and no covenant -> consistent_with_source. Any protected housing now or within five years -> requires_judgment, because the bar applies only if the project would demolish or alter it. Never disqualifying_per_source from parcel facts alone. |
  | `la_shra.ellis-act-withdrawal` | `deterministic_candidate` | p. 4 | Memo Part I, Demolition Protections, page 4 | Withdrawal within 15 years before the application date -> disqualifying_per_source; none in a reviewed LAHD record, or the latest withdrawal more than 15 years before -> consistent_with_source; not retrieved -> unknown. |
  | `la_shra.existing-units-not-separated` | `professional_judgment` | p. 4 | Memo Part I, Demolition Protections, page 4 (SB 1123) | none (A project-design condition, not a site bar: existing units do not by themselves make the site ineligible (see also FAQ Q.22 and Q.23)) |

#### `la_shra.prior-subdivisions`

- **Proposal file:** `app/fixtures/program-screen/proposed-verifications/la_shra.prior-subdivisions.json` (status `awaiting_human_review`)
- **Official source:** `shra-2025-10-28`: the City's October 28, 2025 SHRA implementation memorandum (City Planning, LADBS, Bureau of Engineering); `source_sha256` `f44574084091c51419d0475d4b8501d9a2c3577b3a16830fc6ecb2a88b20f6e2`
- **Other sources the reviewer may need:** GCS 66499.41, for the exact prior-map restriction. Chaptered text of the statute on leginfo.legislature.ca.gov. It cannot be captured as evidence until a statute source type exists; do not capture it as an adopted_ordinance. The recorded parcel and tract maps for the lot.
- **Where it is:** Located in shra-2025-10-28: Part I, page 2 (lots previously recorded under the SHRA or SB 9). FAQ Q.5, page 14 (after a discretionary map) and FAQ Q.26, page 20 (adjacent parcels).
- **Headline candidate (page 2):** Memo Part I, SHRA Property Eligibility Criteria, page 2: “Lots previously recorded pursuant to the SHRA or SB 9 (2021) are ineligible. However, this particular eligibility restriction does not apply if the tentative map has not been recorded.”
- **Question for the reviewer:** The memo (page 2) makes lots previously recorded under the SHRA or SB 9 (2021) ineligible, except where the tentative map has not been recorded, and (FAQ Q.5, Q.26) allows SHRA after a recorded discretionary map and on adjacent parcels. Do you agree that the yes/no prior-subdivisions fact should be replaced by a controlled record of which statute the lot's map was recorded under, and that ordinary subdivisions and adjacency are not bars? Does 'recorded pursuant to SB 9' include SB 9 two-unit projects without a lot split?
- **Facts read now:** `prior-subdivisions`
- **Controlled values proposed:** prior-subdivisions (yes/no for any prior subdivision) is too broad. Proposed: prior-shra-or-sb9-map, controlled recorded_shra | recorded_sb9 | tentative_only | none | incomplete_history, human-recorded from the recorded maps.
- **Split or narrowing:** Replace the yes/no with prior-shra-or-sb9-map. Drop adjacency and ownership facts; the memo imposes no such restriction.
- **Proposed predicate shape (only if the reviewer agrees):** recorded_shra or recorded_sb9 -> disqualifying_per_source; tentative_only or none (complete, reviewed history) -> consistent_with_source; incomplete_history -> unknown. A discretionary map approved but not recorded -> requires_judgment.
- **Must remain unknown or professional when:**
  - the lot's map history is incomplete or comes from a single display
  - the statute a prior map was recorded under is unknown
  - an SB 9 two-unit project without a lot split is recorded and the reviewer has not decided whether it counts
- **ZIMAS conflict risk:** Medium. A parcel display that shows no subdivision history does not prove none exists (PROJECT_LAWS law 4). The recorded map itself is the record.
- **Candidate components:**

  | Component | Disposition | Pages | Pinpoint | Proposed rule |
  | --- | --- | --- | --- | --- |
  | `la_shra.prior-shra-or-sb9-lot` | `deterministic_candidate` | p. 2 | Memo Part I, SHRA Property Eligibility Criteria, page 2 | recorded_shra or recorded_sb9 -> disqualifying_per_source; tentative_only or none -> consistent_with_source; incomplete_history -> unknown. |
  | `la_shra.prior-ordinary-subdivision` | `partially_deterministic` | p. 14 | Memo FAQ Q.5, page 14 | A recorded ordinary parcel or tract map -> consistent_with_source for this criterion. A discretionary map approved but not recorded -> requires_judgment. |
  | `la_shra.adjacent-parcels` | `no_rule_in_source` | p. 20 | Memo FAQ Q.26, page 20 | none (Each parcel needs its own application within the 10-unit limit, and the combined perimeter must be substantially surrounded by qualified urban uses (FAQ Q.26). Confirm GCS 66499.41 adds no adjacency limit) |

#### `la_shra.housing-element-site-status`

- **Proposal file:** `app/fixtures/program-screen/proposed-verifications/la_shra.housing-element-site-status.json` (status `awaiting_human_review`)
- **Official source:** `shra-2025-10-28`: the City's October 28, 2025 SHRA implementation memorandum (City Planning, LADBS, Bureau of Engineering); `source_sha256` `f44574084091c51419d0475d4b8501d9a2c3577b3a16830fc6ecb2a88b20f6e2`
- **Other sources the reviewer may need:** The 2021-2029 Housing Element, Chapter 4, Appendices 4.1-4.3 (sites, projected units, lower-income units). GCS 66499.41(a)(5). Chaptered text of the statute on leginfo.legislature.ca.gov. It cannot be captured as evidence until a statute source type exists; do not capture it as an adopted_ordinance.
- **Where it is:** Located in shra-2025-10-28: Part I, Minimum Density and Affordability Requirements for Housing Element Sites, pages 2-3, and FAQ Q.9, pages 15-16. Minimum density for other sites is page 3.
- **Headline candidate (page 2):** Memo Part I, Minimum Density and Affordability Requirements for Housing Element Sites, pages 2-3: “Pursuant to GCS 66499.41(a)(5), all SHRA development projects proposed on sites identified in the City’s 2021-2029 Housing Element must result in at least the number of units projected for that parcel.”
- **Question for the reviewer:** The memo (pages 2-3, FAQ Q.9) treats Housing Element site status as a minimum-unit condition, not a bar: projects on Appendix 4.1-4.3 sites must reach the projected units, and a site projected for more units than proposed is ineligible. Do you agree that this criterion should become a controlled appendix classification that returns requires_judgment for a listed site and consistent_with_source for a reviewed not-listed site, and never a disqualifier without a proposed unit count? Should the Housing Element appendices or ZIMAS ZI-2512 be the record?
- **Facts read now:** `housing-element-site-status`
- **Controlled values proposed:** housing-element-site-status becomes controlled: appendix_4_1 | appendix_4_2 | appendix_4_3 | not_listed, with projected units and lower-income units as numbers from the same record. A site only on the February 2025 rezoning list (CF 21-1230-S6) is not_listed for SHRA.
- **Split or narrowing:** Convert the free-text status into the controlled appendix classification. The unit comparison needs a project fact and stays judgment.
- **Proposed predicate shape (only if the reviewer agrees):** not_listed (reviewed) -> consistent_with_source; appendix_4_1, 4_2, or 4_3 -> requires_judgment (minimum units apply). Never disqualifying_per_source without a proposed unit count.
- **Must remain unknown or professional when:**
  - the status is free text, or absent from the appendices
  - the parcel is listed and the project's proposed unit count is unknown
  - the appendices and ZIMAS ZI-2512 disagree
- **ZIMAS conflict risk:** Medium. The memo says Housing Element sites are noted in ZIMAS by ZI-2512 with projected units in the Housing tab (FAQ Q.9, page 15). The appendices are the underlying record; a difference stays a conflict.
- **Candidate components:**

  | Component | Disposition | Pages | Pinpoint | Proposed rule |
  | --- | --- | --- | --- | --- |
  | `la_shra.housing-element-site-listing` | `deterministic_candidate` | pp. 2, 3 | Memo Part I, Minimum Density and Affordability Requirements for Housing Element Sites, pages 2-3 | not_listed -> consistent_with_source (no Housing Element minimum; the non-Housing-Element minimum density still applies to the project). appendix_4_1, 4_2, or 4_3 -> requires_judgment (the project must reach the projected units and any lower-income units). |
  | `la_shra.housing-element-minimum-units` | `professional_judgment` | p. 15 | Memo FAQ Q.9, page 15 | none (The bar compares the projection with the project's proposed units, so a parcel screen cannot decide it) |
  | `la_shra.non-housing-element-minimum-density` | `professional_judgment` | p. 3 | Memo Part I, Minimum Density Requirements for Non-Housing Element Sites, page 3 | none (A project density condition (66% of zoning density or 20 units per acre), not a site bar) |

#### `la_shra.environmental-constraints`

- **Proposal file:** `app/fixtures/program-screen/proposed-verifications/la_shra.environmental-constraints.json` (status `awaiting_human_review`)
- **Official source:** `shra-2025-10-28`: the City's October 28, 2025 SHRA implementation memorandum (City Planning, LADBS, Bureau of Engineering); `source_sha256` `f44574084091c51419d0475d4b8501d9a2c3577b3a16830fc6ecb2a88b20f6e2`
- **Other sources the reviewer may need:** GCS 66499.41(a)(9), for the conditions on restricted categories. Chaptered text of the statute on leginfo.legislature.ca.gov. It cannot be captured as evidence until a statute source type exists; do not capture it as an adopted_ordinance. The defining map for each designation: CAL FIRE Fire Hazard Severity Zones (state and local responsibility areas), the FEMA Flood Insurance Rate Map, and the Alquist-Priolo Earthquake Fault Zone map. The LADBS Flood Hazard Management Ordinance Bulletin and Information Bulletins P/BC 2023-129 and P/BC 2023-044.
- **Where it is:** Located in shra-2025-10-28: Part I, Environmental Criteria, page 4 (six prohibited and three restricted categories, footnote 1), continued on page 5 (GCS 66499.41(a)(9)). Hillside appears only on page 10 (a report requirement) and FAQ Q.16, page 17 (habitat pre-screen).
- **Headline candidate (page 4):** Memo Part I, Environmental Criteria, page 4, prohibited category 3 and footnote 1: “3) High or very high fire hazard severity zones, as referenced in GCS 51178 and Public Resources Code Section 42021.”
- **Question for the reviewer:** The memo (page 4) bars sites in High or Very High Fire Hazard Severity Zones (state and local responsibility areas) and lists special flood hazard areas, regulatory floodways, and earthquake fault zones as conditional, not barred. It names neither hillside nor landslide areas as site limits. Do you agree to split this criterion by designation: fire a one-way disqualifier until the fact records High as well as Very High, flood and fault requires_judgment when present, and hillside-area and landslide-area removed? Should the unlisted prohibited categories (farmland, wetlands, conservation land, habitat, easements) block a consistent SHRA result until they are checked?
- **Facts read now:** `very-high-fire-hazard-severity-zone`, `hillside-area`, `fault-zone`, `landslide-area`, `flood-zone`
- **Controlled values proposed:** Fire needs a controlled fire-hazard-severity-zone (very_high | high | moderate | none) because the memo bars High as well as Very High. flood-zone must mean FEMA special flood hazard area or regulatory floodway; fault-zone must mean an Alquist-Priolo Earthquake Fault Zone. hillside-area and landslide-area have no SHRA rule.
- **Split or narrowing:** Split into la_shra.fire-hazard-severity-zone, la_shra.special-flood-hazard-area, la_shra.earthquake-fault-zone, and a judgment for the other prohibited categories. Remove hillside-area and landslide-area from this criterion.
- **Proposed predicate shape (only if the reviewer agrees):** Fire: very_high or high -> disqualifying_per_source; moderate or none from the CAL FIRE map -> consistent_with_source (with today's Very-High-only fact, true -> disqualifying_per_source and false -> requires_judgment). Flood and fault: false from the defining map -> consistent_with_source; true -> requires_judgment.
- **Must remain unknown or professional when:**
  - the defining map conflicts with another source (the fictional fixture's fire-hazard conflict stays contested)
  - a restricted category applies and its GCS 66499.41(a)(9) conditions depend on project facts
  - the designation comes only from a display that is not its defining map
  - the other prohibited categories (farmland, wetlands, conservation land, habitat, easements) are unchecked
- **ZIMAS conflict risk:** High. The memo tells users to consult the SHRA Eligibility Checklist in ZIMAS (page 4). ZIMAS hazard displays and the defining maps can disagree, as the fictional fixture's fire-hazard conflict models; a disagreement stays a conflict and the pathway stays contested.
- **Candidate components:**

  | Component | Disposition | Pages | Pinpoint | Proposed rule |
  | --- | --- | --- | --- | --- |
  | `la_shra.fire-hazard-severity-zone` | `partially_deterministic` | p. 4 | Memo Part I, Environmental Criteria, page 4, prohibited category 3 and footnote 1 | With today's fact: very-high-fire-hazard-severity-zone true -> disqualifying_per_source; false -> requires_judgment (a High zone also bars). With the controlled fact: very_high or high -> disqualifying_per_source; moderate or none from the defining map -> consistent_with_source. |
  | `la_shra.special-flood-hazard-area` | `partially_deterministic` | p. 4 | Memo Part I, Environmental Criteria, page 4, restricted category 2 | false from the FIRM -> consistent_with_source; true -> requires_judgment (eligible only if the GCS 66499.41(a)(9) conditions are met). Never disqualifying_per_source from the flag alone. |
  | `la_shra.earthquake-fault-zone` | `partially_deterministic` | p. 4 | Memo Part I, Environmental Criteria, page 4, restricted category 3 | false from the zone map -> consistent_with_source; true -> requires_judgment. Never disqualifying_per_source from the flag alone. |
  | `la_shra.hillside-area` | `no_rule_in_source` | pp. 4, 10, 17 | Memo Part I, Environmental Criteria, page 4; Part III, page 10; FAQ Q.16, page 17 | none (Hillside Areas appear only as a report requirement (page 10) and a habitat pre-screen (FAQ Q.16), neither of which is a site bar) |
  | `la_shra.landslide-area` | `no_rule_in_source` | p. 4 | Memo Part I, Environmental Criteria, page 4 | none (Neither list on page 4 names landslide areas, and the memo never uses the term; only a geologic report requirement for Hillside, Seismic, or Liquefaction Areas appears (page 10)) |
  | `la_shra.other-prohibited-site-categories` | `professional_judgment` | p. 4 | Memo Part I, Environmental Criteria, page 4, prohibited categories 1, 2, 4-6 and restricted category 1 | none (These bars are in the memo but no Program Screen fact covers them; a consistent SHRA result must not be implied while they are unchecked) |

### SB 79 / Phased Implementation (Ordinance 188968)

#### `la_sb79.permanent-exclusion`

- **Proposal file:** `app/fixtures/program-screen/proposed-verifications/la_sb79.permanent-exclusion.json` (status `awaiting_human_review`)
- **Official source:** `ordinance-188968`: Ordinance No. 188968 (SB 79 Phased Implementation Ordinance); `source_sha256` `91ea56cfb5db7b1d0f42bba4afef52179fd9052ef726d7a337fe35091410a588`
- **Other sources the reviewer may need:** The Director of Planning's exemption maps issued under Sec. 3, with their publication dates. The SCAG TOD stop and zone maps (GCS 65912.160(f)); the ordinance recites that the final map is not yet produced. SB 79 (GCS 65912.155-65912.162). Chaptered text of the statute on leginfo.legislature.ca.gov. It cannot be captured as evidence until a statute source type exists; do not capture it as an adopted_ordinance.
- **Where it is:** Located in ordinance-188968 (8 pages, City OCR text layer): Section 1 and its criteria A and B, page 4; Sec. 3 (maps), page 5; Sec. 6 (ZIMAS), page 6; recitals on the SCAG final map, page 3.
- **Headline candidate (page 4):** Ordinance 188968, Section 1, page 4: “Section 1. Pursuant to California Government Code Section 65912.160(e), the City Council adopts this ordinance on eligible sites meeting one of the criteria referenced below, making the sites permanently exempt from Senate Bill 79, codified at Government Code, Title 7, Division 1, Chapter 4.1.5 (Senate Bill 79):”
- **Question for the reviewer:** Ordinance 188968 Section 1 makes sites meeting either criterion (no walking path under one mile to the TOD stop, or an industrial employment hub) permanently exempt from SB 79, and Section 3 delegates the exemption maps to the Director of Planning. Do you agree that a permanent exemption shown on the Director's map is a disqualifier for the SB 79 pathway, that 'none shown' must stay requires_judgment until the SCAG final map exists, and that the fact should be renamed from 'exclusion' to 'exemption' with its category? Should the ZIMAS display that Section 6 directs remain observation-only?
- **Facts read now:** `sb79-permanent-exclusion`
- **Controlled values proposed:** Rename sb79-permanent-exclusion to sb79-permanent-exemption with controlled values walking_path (Sec. 1.A) | industrial_employment_hub (Sec. 1.B) | none_shown | not_retrieved, human-recorded from the Director's exemption map with its publication date.
- **Split or narrowing:** Replace the yes/no with the category from the Director's map. The ordinance says 'permanently exempt'.
- **Proposed predicate shape (only if the reviewer agrees):** walking_path or industrial_employment_hub -> disqualifying_per_source; none_shown -> requires_judgment while the SCAG final map is pending; not_retrieved -> unknown.
- **Must remain unknown or professional when:**
  - the Director's exemption map was not retrieved or is undated
  - the map shows no exemption while the SCAG final TOD map is not produced
  - the ZIMAS display and the Director's map disagree
- **ZIMAS conflict risk:** High. Sec. 6 directs the Director to show in ZIMAS which sites are and are not covered by SB 79, so ZIMAS may carry the most current display, but it is neither the ordinance nor the Director's map. zimas-sb79-exemption does not distinguish permanent from temporary exemption and stays observation-only; any divergence raises program_flag_divergence.
- **Candidate components:**

  | Component | Disposition | Pages | Pinpoint | Proposed rule |
  | --- | --- | --- | --- | --- |
  | `la_sb79.permanent-exemption-effect` | `partially_deterministic` | p. 4 | Ordinance 188968, Section 1, page 4 | walking_path or industrial_employment_hub -> disqualifying_per_source for the SB 79 pathway. none_shown -> requires_judgment while the SCAG final map is pending. not_retrieved -> unknown. |
  | `la_sb79.permanent-exemption-walking-path` | `professional_judgment` | p. 4 | Ordinance 188968, Section 1.A, page 4 | none (Needs a walking-network analysis to SCAG-designated TOD stops, which are not final) |
  | `la_sb79.permanent-exemption-industrial-hub` | `professional_judgment` | p. 4 | Ordinance 188968, Section 1.B, page 4 | none (Needs the General Plan employment-lands designation made on or before January 1, 2025, a 250-acre contiguity test, and the industrial-use test of GCS 65912.121) |
  | `la_sb79.exemption-map-record` | `professional_judgment` | pp. 3, 5, 6 | Ordinance 188968, Sec. 3, page 5; Sec. 6, page 6; recital, page 3 | none (Sec. 6 directs the City to show SB 79 coverage in ZIMAS. Making ZIMAS the record would be a design change, not a verification) |

#### `la_sb79.temporary-exemption`

- **Proposal file:** `app/fixtures/program-screen/proposed-verifications/la_sb79.temporary-exemption.json` (status `awaiting_human_review`)
- **Official source:** `ordinance-188968`: Ordinance No. 188968 (SB 79 Phased Implementation Ordinance); `source_sha256` `91ea56cfb5db7b1d0f42bba4afef52179fd9052ef726d7a337fe35091410a588`
- **Other sources the reviewer may need:** The City's record of adoption of the seventh Housing Element revision, once it exists. Ordinance 188967 (captured as ordinance-188967), which refers to sites 'not exempt' under this ordinance. HCD's review of the ordinance (Sec. 6 directs transmittal within 60 days).
- **Where it is:** Located in ordinance-188968: Sec. 2 (duration and criteria A-H), pages 4-5; Sec. 4 (all parcels), page 6; recitals on the draft citywide map and on expiry, pages 3-4.
- **Headline candidate (page 6):** Ordinance 188968, Sec. 4, page 6: “Sec. 4. Pursuant to the City’s local housing incentive programs, including, without limitation, LAMC Section 12.22 A.38, all parcels within the City’s jurisdiction are subject to temporarily exempt status under Government Code Section 65912.161(b).”
- **Question for the reviewer:** Ordinance 188968 Section 2 temporarily exempts parcels from SB 79 until one year after the City adopts the seventh revision of its Housing Element, and Section 4 says all parcels within the City are subject to temporarily exempt status. Do you read Section 4 as exempting every parcel in the City now? If so, should the per-parcel yes/no be replaced by the jurisdiction anchor plus a dated end-condition fact? How do you reconcile it with Ordinance 188967's references to sites 'not exempt' under the Phased Implementation Ordinance?
- **Facts read now:** `sb79-temporary-exemption`
- **Controlled values proposed:** Add seventh-housing-element-revision-adopted-on (an ISO date, or not_adopted), human-recorded from the City's adoption record. If Sec. 4 applies citywide, the per-parcel yes/no is redundant; otherwise it must become a controlled value from the Director's map.
- **Split or narrowing:** Add the dated end-condition fact. Either retire the per-parcel yes/no (citywide reading of Sec. 4) or take it from the Director's map (criteria reading of Sec. 2).
- **Proposed predicate shape (only if the reviewer agrees):** Within the City and the exemption period not ended -> disqualifying_per_source for the SB 79 pathway. Period ended (as_of on or after the adoption date plus one year) -> consistent_with_source for this criterion. End condition not recorded -> unknown.
- **Must remain unknown or professional when:**
  - the reviewer reads Sec. 4 as eligibility for exemption rather than exemption
  - the seventh Housing Element revision's adoption is not recorded
  - the Director determines under Ordinance 188967 Sec. 14 that the City's approach is inconsistent with GCS 65912.161(b)
  - state review changes the ordinance's effect
- **ZIMAS conflict risk:** High. zimas-sb79-exemption records one display for exemption or exclusion, so it cannot tell temporary from permanent; it stays observation-only.
- **Candidate components:**

  | Component | Disposition | Pages | Pinpoint | Proposed rule |
  | --- | --- | --- | --- | --- |
  | `la_sb79.citywide-temporary-exemption` | `partially_deterministic` | p. 6 | Ordinance 188968, Sec. 4, page 6 | Parcel within the City of Los Angeles (jurisdiction anchor) and the exemption period not ended -> disqualifying_per_source for the SB 79 pathway. Period ended -> consistent_with_source for this criterion. |
  | `la_sb79.temporary-exemption-end` | `deterministic_candidate` | p. 4 | Ordinance 188968, Sec. 2, page 4 | not_adopted as of as_of, or as_of before (adopted_on + 1 year) -> exemption in effect; as_of on or after (adopted_on + 1 year) -> exemption ended. Not recorded -> unknown. |
  | `la_sb79.temporary-exemption-criteria` | `professional_judgment` | pp. 4, 5 | Ordinance 188968, Sec. 2.A-H, pages 4-5 | none (Criteria A-D need capacity analyses of whole TOD zones; E-H need map records (TOD alternative plans, fire zones or state responsibility areas, sea level rise, historic resources)) |

#### `la_sb79.site-and-overlay-standards`

- **Proposal file:** `app/fixtures/program-screen/proposed-verifications/la_sb79.site-and-overlay-standards.json` (status `awaiting_human_review`)
- **Official source:** `ordinance-188968`: Ordinance No. 188968 (SB 79 Phased Implementation Ordinance); `source_sha256` `91ea56cfb5db7b1d0f42bba4afef52179fd9052ef726d7a337fe35091410a588`
- **Other sources the reviewer may need:** SB 79 (GCS 65912.155-65912.162), for any zoning, overlay, or existing-housing standard. Chaptered text of the statute on leginfo.legislature.ca.gov. It cannot be captured as evidence until a statute source type exists; do not capture it as an adopted_ordinance. The City's HCM list and HPOZ records with designation dates.
- **Where it is:** Located in ordinance-188968: Sec. 2.A, E, and H, pages 4-5; recital on HCMs and HPOZs, page 3. The ordinance states no zoning, Specific Plan, or existing-housing standard; its site criteria are exemption criteria.
- **Headline candidate (page 5):** Ordinance 188968, Sec. 2.H, page 5, with the recital on page 3: “H. A site with a historic resource designated as of January 1,2025, on a local register (Gov. Code Sec. 65912.161(b)(1)(F)).”
- **Question for the reviewer:** Ordinance 188968 sets no zoning, Specific Plan, or existing-housing standard of its own. Its site criteria are exemption criteria, including historic resources designated by January 1, 2025 (Sec. 2.H, which a recital reads as including HCMs and HPOZs). Do you agree to dissolve this criterion: move the historic-resource test into la_sb79.temporary-exemption, and drop zoning, specific-plan-area, and existing-dwelling-units unless SB 79's statute text is captured as its own source type?
- **Facts read now:** `zoning`, `specific-plan-area`, `hpoz`, `existing-dwelling-units`
- **Controlled values proposed:** hpoz (yes/no) carries no designation date; Sec. 2.H needs designation on or before January 1, 2025. zoning, specific-plan-area, and existing-dwelling-units have no rule in this ordinance.
- **Split or narrowing:** Dissolve: move the historic-resource test into la_sb79.temporary-exemption with a dated hpoz-or-hcm-designated-by-2025-01-01 fact; drop the other facts unless SB 79's text is captured.
- **Proposed predicate shape (only if the reviewer agrees):** HCM or HPOZ designated on or before January 1, 2025 -> temporarily exempt -> disqualifying_per_source during the exemption period. No other component produces a result from this ordinance.
- **Must remain unknown or professional when:**
  - a standard depends on SB 79's statute text, which is not captured
  - the HPOZ or HCM designation date is unknown
  - transit-stop proximity or tier matters (not encodable)
- **ZIMAS conflict risk:** High. zimas-sb79-category and zimas-sb79-tier stay observation-only and must never substitute for a standard read from the text.
- **Candidate components:**

  | Component | Disposition | Pages | Pinpoint | Proposed rule |
  | --- | --- | --- | --- | --- |
  | `la_sb79.historic-resource-exemption` | `partially_deterministic` | pp. 3, 5 | Ordinance 188968, Sec. 2.H, page 5, with the recital on page 3 | HCM or HPOZ designated on or before January 1, 2025 -> temporarily exempt (Sec. 2.H) -> disqualifying_per_source during the exemption period. Otherwise no result from this component (Sec. 4 may exempt the parcel anyway). |
  | `la_sb79.zoning-capacity` | `professional_judgment` | p. 4 | Ordinance 188968, Sec. 2.A, page 4 | none (The ordinance sets no zoning-designation standard. Its only zoning-related test compares permitted capacity with SB 79's standards, which are in state law (not captured)) |
  | `la_sb79.specific-plan-and-tod-plan` | `no_rule_in_source` | p. 5 | Ordinance 188968, Sec. 2.E, page 5 | none (The ordinance does not mention Specific Plans. Sec. 4 also says a later TOD alternative plan will not affect the ordinance) |
  | `la_sb79.existing-housing` | `no_rule_in_source` | p. 4 | Ordinance 188968, Secs. 1-2, pages 4-5 | none (No criterion in Sec. 1 or Sec. 2 refers to existing housing. Any existing-housing or demolition standard comes from SB 79 itself, which is not captured and has no statute source type yet) |

### Low-Rise (Ordinance 188967)

#### `la_low_rise.geographic-criteria`

- **Proposal file:** `app/fixtures/program-screen/proposed-verifications/la_low_rise.geographic-criteria.json` (status `awaiting_human_review`)
- **Official source:** `ordinance-188967`: Ordinance No. 188967 (Low-Rise Ordinance); `source_sha256` `279b3724eb25b8e9bee0efeedd1eb500089b993a5dd7af6925c05019db605e25`
- **Related draft (re-review trigger only):** `low-rise-draft-2026-09-24`
- **Other sources the reviewer may need:** The Director's Low-Rise eligibility map (LAMC 12.22 A.38(j)(7)) with its publication date. LAMC Section 12.03 definitions (Very High Fire Hazard Severity Zone, Hillside Area, Sea Level Rise Area) and the LAMC zone hierarchy for 'RW1 and more restrictive'. Ordinance 188968 (captured as ordinance-188968), for the (c)(10) exemption cross-reference.
- **Where it is:** Located in ordinance-188967 (21 pages, City OCR text layer in content-stream order): Sec. 5 definitions, page 4; Sec. 8, LAMC 12.22 A.38(c)(4)-(10), pages 5-7; Sec. 9, (g)(1) and Table 12.22 A.38.(g)(1)(i), pages 7-8; Sec. 11, (j)(7), page 18; Sec. 13, (j)(16), page 19. The table's cells are scattered in the text layer; read it from the page image.
- **Headline candidate (page 4):** Ordinance 188967, Sec. 5 (Low-Rise Incentive Area Project), page 4; Sec. 11, LAMC 12.22 A.38(j)(7)(i), page 18: “Low-Rise Incentive Area Project. A project on a site located, in whole or in part, within a Low-Rise Incentive Area as set forth in the eligibility map pursuant to Section 12.22.A.38(i)(7) of this this Code, or determined to be eligible pursuant to Section 12.22 A.38(c)(10) of this Code, that involves the construction of, addition to, or remodeling of any building or buildings that result in the creation of five or more residential units.”
- **Question for the reviewer:** Ordinance 188967 defines Low-Rise geography through the Director's eligibility map (Sec. 5, LAMC 12.22 A.38(j)(7)), subarea distances and zones in Table 12.22 A.38.(g)(1)(i), and site exclusions in (c)(4), (5), (6), and (9), all subject to the (c)(10) exception. It never uses General Plan land use. Do you agree to split this criterion into the components proposed, to record the LR subarea from the Director's map rather than derive it, and to drop general-plan-land-use? Should every exclusion stay requires_judgment until a reviewed fact rules out the (c)(10) exception? Separately: does the September 24, 2026 draft in Council File 25-1083-S3 propose changes to these provisions? A draft change only triggers a re-review; it cannot change the rule.
- **Facts read now:** `zoning`, `general-plan-land-use`, `specific-plan-area`
- **Controlled values proposed:** zoning is free text: add a human-recorded zone-class from a controlled LAMC list. general-plan-land-use has no rule. specific-plan-area (yes/no) cannot name the one excluded plan; add community-plan-area and specific-plan-name. Add low-rise-eligibility-subarea (LR-1 | LR-2 | not_mapped | not_retrieved) from the Director's map, sb79-eligible-site for (c)(10), and sea-level-rise-area.
- **Split or narrowing:** Split into the nine components proposed (map, subarea criteria, eligible zones, four exclusions, historic limits, and General Plan). Drop general-plan-land-use. Decide with la_low_rise.overlay-review which criterion owns (c)(6) and the historic limits.
- **Proposed predicate shape (only if the reviewer agrees):** Mapped LR-1 or LR-2 with no exclusion triggered -> consistent_with_source. An exclusion triggered -> disqualifying_per_source only if sb79-eligible-site is recorded false; otherwise requires_judgment. Fire Restriction Area or Coastal Zone -> requires_judgment (neighboring-properties exception). Not mapped -> requires_judgment.
- **Must remain unknown or professional when:**
  - zoning exists only as free text
  - the Director's eligibility map was not retrieved, or the SCAG final TOD map is still pending
  - an exclusion is triggered and the (c)(10) exception has not been ruled out
  - a Fire Restriction Area or Coastal Zone site depends on neighboring properties
  - the September 24, 2026 draft, or any other amendment of 12.22 A.38, is adopted: capture the adopted instrument and re-review before any rule changes
- **ZIMAS conflict risk:** Medium to high. zimas-low-rise-category stays observation-only; the ordinance makes the Director's eligibility map the record, and ZIMAS may only display it. ZIMAS zoning strings must never be parsed into zone classes.
- **Candidate components:**

  | Component | Disposition | Pages | Pinpoint | Proposed rule |
  | --- | --- | --- | --- | --- |
  | `la_low_rise.incentive-area-map` | `partially_deterministic` | pp. 4, 18 | Ordinance 188967, Sec. 5 (Low-Rise Incentive Area Project), page 4; Sec. 11, LAMC 12.22 A.38(j)(7)(i), page 18 | LR-1 or LR-2 -> consistent_with_source for the mapping requirement (exclusions still apply). not_mapped -> requires_judgment ((c)(10) may still apply, and the map is provisional). not_retrieved -> unknown. |
  | `la_low_rise.subarea-criteria` | `professional_judgment` | p. 7 | Ordinance 188967, Sec. 9, LAMC 12.22 A.38(g)(1) and Table 12.22 A.38.(g)(1)(i), page 7 | none (The page image shows: Opportunity Corridor, LR-1 250-750 feet, LR-2 < 250 feet, zones RD and R2, Higher Opportunity Areas; Tier 2 TOD Stop, LR-1 1/4-1/2 mile, LR-2 < 1/4 mile; Tier 1 TOD Stop, LR-2 < 1/2 mile; TOD rows, Residential Zones and Opportunity Station Areas. The text layer scatters these cells, so only fragments can be quoted) |
  | `la_low_rise.eligible-underlying-zones` | `partially_deterministic` | pp. 7, 19 | Ordinance 188967, Table 12.22 A.38.(g)(1)(i), page 7; Sec. 13, LAMC 12.22 A.38(j)(16), page 19 | Opportunity Corridor subarea: zone class RD or R2 -> consistent_with_source; any other zone -> disqualifying_per_source for that subarea. TOD subareas: R5 or a more restrictive R or A zone, or R1P-R5P -> consistent_with_source; any other zone -> requires_judgment. |
  | `la_low_rise.manufacturing-zone-exclusion` | `partially_deterministic` | pp. 5, 6 | Ordinance 188967, Sec. 8, LAMC 12.22 A.38(c)(4), pages 5-6 | Any lot zoned M1, M2, M3, MR1, or MR2 -> disqualifying_per_source only if sb79-eligible-site is recorded false, otherwise requires_judgment. CM -> requires_judgment. No such lot (reviewed zone classes for every lot) -> consistent_with_source. |
  | `la_low_rise.single-family-zone-exclusion` | `partially_deterministic` | p. 6 | Ordinance 188967, Sec. 8, LAMC 12.22 A.38(c)(5), page 6 | Any lot in a single-family or more restrictive zone: within an Opportunity Station Area -> consistent_with_source for this component; outside -> disqualifying_per_source only if sb79-eligible-site is recorded false, otherwise requires_judgment. No such lot -> consistent_with_source. |
  | `la_low_rise.fire-coastal-sea-level-exclusion` | `partially_deterministic` | pp. 4, 6 | Ordinance 188967, Sec. 8, LAMC 12.22 A.38(c)(6), page 6; Sec. 5 (Fire Restriction Area), page 4 | All three recorded false from defining records -> consistent_with_source. Fire Restriction Area or Coastal Zone -> requires_judgment (the neighboring-properties exception needs facts about adjacent parcels). Sea Level Rise Area -> disqualifying_per_source only if sb79-eligible-site is recorded false, otherwise requires_judgment. |
  | `la_low_rise.excluded-plan-areas` | `partially_deterministic` | pp. 6, 7 | Ordinance 188967, Sec. 8, LAMC 12.22 A.38(c)(9), pages 6-7 | In the Boyle Heights, Harbor Gateway, or Wilmington-Harbor City Community Plan area, or the Cornfield Arroyo Seco Specific Plan -> disqualifying_per_source only if sb79-eligible-site is recorded false, otherwise requires_judgment. Any other plan area -> consistent_with_source for this component. |
  | `la_low_rise.historic-limits` | `professional_judgment` | p. 8 | Ordinance 188967, Sec. 9, LAMC 12.22 A.38(g)(1)(iii)a, page 8 | none (The unless-clause repeats itself ('Opportunity Corridor Transition eligibility subarea based on distance from an Opportunity Corridor'), apparently a drafting error) |
  | `la_low_rise.general-plan-land-use` | `no_rule_in_source` | p. 7 | Ordinance 188967, Table 12.22 A.38.(g)(1)(i), page 7 | none (The ordinance's geographic criteria are TCAC opportunity areas and Opportunity Station Areas; no eligibility provision uses a General Plan land-use designation, and the phrase 'General Plan' does not appear in the captured text) |

## Fact types that need narrowing before a deterministic rule is safe

From the proposals above:

| Fact | Current shape | What the captured text needs |
| --- | --- | --- |
| `zoning` | free text | A human-recorded `zone-class` from a controlled LAMC list (SHRA single-family list; Low-Rise RD/R2, Residential Zones, M/MR/CM, "RW1 and more restrictive"). Never parse a zoning string. |
| `general-plan-land-use` | free text | Nothing: Ordinance 188967 has no General Plan rule. Remove it from the Low-Rise criterion. |
| `specific-plan-area` | yes/no | Too coarse: Low-Rise excludes one named Specific Plan and three Community Plan areas; SB 79 has no Specific Plan rule. |
| `occupancy-history` | free text | Replace with `residential-use-within-5-years` (yes/no, from a dated record). |
| `existing-structures` | count | Cannot express protected housing; see the SHRA demolition component. |
| `housing-element-site-status` | free text | Controlled `appendix_4_1` / `appendix_4_2` / `appendix_4_3` / `not_listed`, plus projected and lower-income unit counts. |
| `prior-subdivisions` | yes/no | Replace with the statute a prior map was recorded under (SHRA, SB 9, other) and whether it was recorded. |
| `very-high-fire-hazard-severity-zone` | yes/no | For SHRA, a controlled `fire-hazard-severity-zone` that also records High (the memo bars High and Very High). For Low-Rise, combined with `hillside-area` as the Fire Restriction Area. |
| `flood-zone`, `fault-zone` | yes/no | Must mean the FEMA special flood hazard area or regulatory floodway, and the Alquist-Priolo zone. Both are conditional for SHRA, never a bar on their own. |
| `hillside-area`, `landslide-area` | yes/no | No SHRA rule; remove from the SHRA environmental criterion. |
| `sb79-permanent-exclusion` | yes/no | Rename to `sb79-permanent-exemption` with its category, from the Director's map. |
| `sb79-temporary-exemption` | yes/no | Add a dated `seventh-housing-element-revision-adopted-on`; the per-parcel yes/no may be redundant if Sec. 4 applies citywide. |
| `hpoz` | yes/no | For SB 79, needs the designation date (on or before January 1, 2025). |

New facts proposed, none added yet: `shra-zone-category`, `ellis-act-withdrawal-date`, `affordability-covenant-recorded`, `low-rise-eligibility-subarea`, `low-rise-transportation-qualifier`, `opportunity-station-area`, `sb79-eligible-site`, `sea-level-rise-area`, `community-plan-area`, `specific-plan-name`.

## Not in scope, but flagged

- **Repo-sourced criteria can now be checked against captured text.** `la_shra.implementation-memo-scope` (memo page 1, "This memo pertains to Chapter 1 of the Zoning Code"), `la_shra.vacant-site-definition` (memo FAQ Q.1, page 12), and `la_low_rise.overlay-review` (Ordinance 188967 (c)(6) and (g)(1)(iii)) still rest on PermitPulse's guide prose. A human should re-verify them against the captures.
- **ZIMAS may become the City's designated display.** Ordinance 188968 Sec. 6 directs the Director to show in ZIMAS which sites are and are not covered by SB 79, and the SHRA memo sends users to the ZIMAS SHRA Eligibility Checklist. The ZIMAS program fields stay observation-only; making any of them a criterion input would be a design change for a separate review.
- **Drafting issues in the adopted text.** Ordinance 188967 leaves the Phased Implementation Ordinance's number blank in (c)(10) and (g)(1)(iii)b; cites the eligibility map "pursuant to Section 12.22.A.38(i)(7) of this this Code" where the mapping authority it amends is (j)(7); prints "M2,-M3"; and repeats a clause in (g)(1)(iii)a. The memo repeats "including, including" (page 3).
- **Wording concern (unchanged).** In the fixture, the fire-hazard conflict makes SHRA "contested" through the unverified environmental-constraints bundle. The memo does bar High and Very High Fire Hazard Severity Zones (page 4), so fire hazard does matter for SHRA; the pathway statement is now consistent with the source, but it stays unverified until a human approves the fire component.
- **State statute text has no source type yet.** Several components defer to GCS 66499.41 or to SB 79 (GCS 65912.155-65912.162). The capture tool accepts `leginfo.legislature.ca.gov`, but `source_type` has no statute value. Add one in a later branch; do not capture a statute as an `adopted_ordinance`.
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
