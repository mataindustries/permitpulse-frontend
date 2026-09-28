# Program Screen human review, Round 1

Prepared 2026-09-28 on branch `feature/program-screen-human-review-round-1`. Machine-readable twin: `app/fixtures/program-screen/human-review-rounds/round-1.json`.

This packet asks one person, the named human reviewer, to check eight atomic Program Screen criteria against the captured official documents and decide each one. It is preparation only:

- **No criterion changes in this branch.** All eight stay `pending_human` with no encoded rule. `human_verified` stays at 0 of 46; `pending_human` stays at 46.
- **Nothing reads this packet or its manifest in production.** The evaluator never imports either one; a test follows the evaluator's imports to prove it.
- **Only the captured files count.** Every quotation below is copied from `app/fixtures/program-screen/official-sources/<source-id>/extracted.txt` and is checked by a test against that file and its SHA-256. Nothing here comes from memory, summaries, PermitPulse prose, or secondary sources.
- **The September 24, 2026 Low-Rise draft is not used.** It is `proposed_not_operative` and supports no rule here.
- **The SB 79 temporary exemption is not touched.** Its Sec. 4 reading stays unresolved and non-blocking.

The page-image comparisons below were made during AI-assisted preparation by rendering each `original.pdf` page. Repeat them yourself: that is the point of this round.

## How to read the rules

Each rule returns one of three criterion outcomes. `disqualifying_per_source` makes the pathway roll-up `documented_disqualifier`; `consistent_with_source` means this one criterion found nothing inconsistent with its source; `requires_judgment` sends the question to Los Angeles City Planning. No rule may return an outcome outside its criterion's outcome ceiling; the evaluator rejects it.

A rule only ever sees established, human-reviewed facts. Before any rule runs, the evaluator applies this order: a fact in conflict makes the criterion `conflict`; a missing or unknown fact makes it `unknown`; unreviewed evidence makes it `unreviewed`. So "missing" is never "no", and conflicting sources are never resolved by the rule.

## Sources

| Source ID | Document | Type | Status | Text layer | `sha256_extracted` |
| --- | --- | --- | --- | --- | --- |
| `shra-2025-10-28` | City SHRA implementation memorandum, October 28, 2025 | `official_memo` | `operative` | born-digital (Acrobat PDFMaker) | `f44574084091c51419d0475d4b8501d9a2c3577b3a16830fc6ecb2a88b20f6e2` |
| `ordinance-188968` | Ordinance 188968 (SB 79 Phased Implementation Ordinance) | `adopted_ordinance` | `operative` | City OCR over a scan (ABBYY FineReader Server) | `91ea56cfb5db7b1d0f42bba4afef52179fd9052ef726d7a337fe35091410a588` |

Page numbers are PDF pages. The memo prints matching numbers; the ordinance's scanned pages print none. To re-check: open each `original.pdf` at the page given, and compare it with the quotation here. `shasum -a 256 app/fixtures/program-screen/official-sources/*/extracted.txt` reproduces the hashes above.

## Round 1 at a glance

| # | Criterion | Class | Source, page, section | Fact | Proposed allowed outcomes | Preparer note |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | `la_shra.single-family-lot-area-threshold` | A | `shra-2025-10-28` p. 2, 12: Memo Part I (property criteria), page 2 (lot-size paragraph) | `shra-zone-category`, `lot-area` | `consistent_with_source`, `disqualifying_per_source`, `requires_judgment` | ready for your decision |
| 2 | `la_shra.prior-shra-or-sb9-map` | A | `shra-2025-10-28` p. 2: Memo Part I (property criteria), page 2 (prior SHRA or SB 9 lots) | `prior-shra-or-sb9-map` | `consistent_with_source`, `disqualifying_per_source`, `requires_judgment` | ready for your decision |
| 3 | `la_shra.very-high-fire-hazard-severity-zone` | A | `shra-2025-10-28` p. 4: Memo Part I, Environmental Criteria, page 4, prohibited category 3 and footnote 1 | `very-high-fire-hazard-severity-zone` | `consistent_with_source`, `disqualifying_per_source`, `requires_judgment` | ready for your decision |
| 4 | `la_shra.high-fire-hazard-severity-zone` | A | `shra-2025-10-28` p. 4: Memo Part I, Environmental Criteria, page 4, prohibited category 3 and footnote 1 | `high-fire-hazard-severity-zone` | `consistent_with_source`, `disqualifying_per_source`, `requires_judgment` | ready for your decision |
| 5 | `la_shra.prime-or-statewide-farmland` | B | `shra-2025-10-28` p. 4: Memo Part I, Environmental Criteria, page 4, prohibited category 1 | `prime-or-statewide-farmland` | `disqualifying_per_source`, `requires_judgment` | ready for your decision |
| 6 | `la_shra.natural-community-conservation-plan-land` | B | `shra-2025-10-28` p. 4: Memo Part I, Environmental Criteria, page 4, prohibited category 4 | `nccp-conservation-land` | `disqualifying_per_source`, `requires_judgment` | ready for your decision |
| 7 | `la_shra.conservation-easement` | B | `shra-2025-10-28` p. 4: Memo Part I, Environmental Criteria, page 4, prohibited category 6 | `conservation-easement` | `disqualifying_per_source`, `requires_judgment` | ready for your decision |
| 8 | `la_sb79.permanent-exemption-shown` | B | `ordinance-188968` p. 3, 4, 5: Ordinance 188968, Section 1, page 4; Sec. 3, page 5; recital, page 3 | `sb79-permanent-exemption-shown` | `disqualifying_per_source`, `requires_judgment` | decide only after the open questions below are answered |

Classes: A = BOTH_DIRECTIONS_SAFE, B = BLOCK_ONLY. No Round 1 candidate is C, D, or E.

## Text-layer discrepancies found

1. **Memo page 4, fire item 3 (affects candidates 3 and 4).** The text layer reads “Public Resources Code Section 42021”. The page image reads Public Resources Code Section 4202 with a superscript footnote marker 1; footnote 1 is the state-and-local responsibility area note. The born-digital text layer turned the superscript into a digit. The shipped criteria and this packet keep the captured text unchanged (the tests match excerpts to `extracted.txt`); read it as Section 4202 plus footnote 1.
2. **Ordinance 188968 page 5, Sec. 3 (affects context for candidate 8 only).** The OCR reads the citation list as `65912.160(e)(1 )-(2), 65912.161 (b)(1 )(A) - 65912.161 (b) 1 )(F), and 65912.161 (b)(2),`; the image reads `65912.160(e)(1)-(2), 65912.161(b)(1)(A) - 65912.161(b)(1)(F), and 65912.161(b)(2),`. The rule excerpt stops before this list.
3. **Ordinance 188968 pages 4 and 6: reading order.** The OCR text is in content-stream order. On page 4, Section 1.A and 1.B come after Sec. 2.A and 2.B in `extracted.txt`; on page 6, Secs. 4 to 6 come after Sec. 8. Each quoted sentence matches the image, but text next to it in `extracted.txt` is not always next to it on the page.

No other difference was found between the quoted text and the page images (memo pages 1, 2, 4, 5, 12, 14, 19, 20; ordinance pages 3 to 6).

## The SB 79 permanent-exemption question

**Question.** If the adopted City record affirmatively shows the parcel as permanently exempt under Ordinance 188968, is it safe for the Program Screen to return a documented disqualifier for the SB 79 pathway?

**Answer from the captured ordinance: yes for the rule, but only with a narrowed fact.**

- Section 1 (page 4) makes sites meeting its criteria “permanently exempt from Senate Bill 79”, and Sec. 3 (page 5) gives the Director of Planning the power and duty to issue and update maps of sites meeting the criteria. A parcel the Director's issued map shows as permanently exempt is outside SB 79, so `disqualifying_per_source` (roll-up `documented_disqualifier`) follows from the text.
- The condition is what counts as shown. The page 3 recital says the City released a draft map identifying all of the City as “eligible for permanent and temporary exemption”, and that SCAG's final map has not been produced. A record in that wording, a citywide layer, or a layer that does not separate permanent from temporary exemption is not a showing that a parcel is permanently exempt. Recording YES from one would block SB 79 for every parcel. The recording instruction in candidate 8 rules that out; nothing in code can.
- The Director's Sec. 3 map has not been captured or inspected in this branch. Preparer recommendation: accept the rule only together with the narrowed recording instruction, and keep the criterion pending if you cannot look at the issued map first.
- **The inverse is not proposed.** Not shown stays `requires_judgment`: Section 1 attaches the exemption to sites that meet its criteria, not to sites the map shows; the recitals say SCAG's final map is pending and the City's determinations are “based on currently available information and data”; and no captured text says the Director's map is complete or authoritative for concluding a parcel is not exempt. Section 1.A and 1.B stay professional-judgment criteria. The shipped ceiling already excludes `consistent_with_source`, and a test proves the evaluator rejects it.
- Sec. 4 and the temporary-exemption criteria are not read, changed, or relied on.

### 1. `la_shra.single-family-lot-area-threshold`: SHRA single-family lot-area threshold

**Source:** `shra-2025-10-28`, City SHRA implementation memorandum, October 28, 2025; official memo, `operative`, born-digital text layer; `sha256_extracted` `f44574084091c51419d0475d4b8501d9a2c3577b3a16830fc6ecb2a88b20f6e2`

**Page:** PDF pages 2, 12. The memo prints the same page numbers as the PDF at the foot of each page (page 1 carries no number).

**Section:** Part I (property criteria), third paragraph, first sentence, page 2; FAQ Q.1 answer, last paragraph (single-family zone list), page 12. Shipped pinpoint: Memo Part I (property criteria), page 2 (lot-size paragraph).

**Exact excerpt:**

Page 2:

> To qualify, multifamily-zoned lots must be less than 5 acres, and single-family zoned lots must be under 1.5 acres and "vacant." (See FAQ Section, Q.1.)

Page 12:

> Zoned for single-family residential development means sites in the following zones: A1, A2, RA, RE, RS, R1, RU, RZ, and RW1.

Excerpt note: Adds the FAQ Q.1 zone list (page 12). The shipped criterion quotes only the page 2 sentence, but its rule reads shra-zone-category, which the page 12 list defines. The shipped criterion is not changed.

**Classification:** A. BOTH_DIRECTIONS_SAFE. Both results come from one sentence and one definitional list, reading a number and a two-value zone category. The rule decides only for zones on the list; a zone recorded as off the list routes to judgment, so this criterion never has to classify a zone the memo does not list.

- Blocking direction (safe): Page 2 says “single-family zoned lots must be under 1.5 acres”. A lot on the page 12 list whose recorded area is 65,340 sq ft (1.5 x 43,560) or more is not under 1.5 acres.
- Clearing direction (safe): A lot on the page 12 list whose recorded area is less than 65,340 sq ft meets this limit. That result covers the area limit only, not vacancy or any other criterion.

**Text-layer check** (page images compared: 1, 2, 12, 14, 19): Born-digital text layer (Acrobat PDFMaker), not OCR. Each quoted sentence was compared with the rendered page image and reads the same, except where a discrepancy is listed.

**Neighboring text needed to understand the rule:**

`shra-2025-10-28` page 1: The zone list is written for Chapter 1 zones; a Chapter 1A parcel is outside the memo's stated scope.

> This memo pertains to Chapter 1 of the Zoning Code. A subsequent memo specific to Chapter 1A of the Zoning Code will follow.

`shra-2025-10-28` page 1: The memo is a summary of the statute, not the statute.

> This memo summarizes key SHRA provisions for reference and does not include all applicable planning, building, or other departmental/agency regulations.

`shra-2025-10-28` page 1: The memo summarizes the SHRA and sends readers to the statute for the full text (page 1). The statute is not captured, so nothing here relies on it.

> Please refer to California Government Code Sections (GCS) 65852.28, 65913.4.5, and 66499.41 for the full SHRA.

`shra-2025-10-28` page 14: A merger in the same application can change which lot area is tested; the screen reads one recorded parcel.

> Consistent with the City’s existing parcel and tract map processes, SHRA projects may propose the merger and re-subdivision of lots in the same application.

`shra-2025-10-28` page 19: The memo lists what a remainder parcel is left out of; the lot-area limit is not on that list.

> However, remainder parcels do not count towards the SHRA’s 10 parcel limitation or the law’s minimum density requirements for non-housing element sites.

`shra-2025-10-28` page 14: The memo names R1 Variation Zones separately from R1, and the page 12 list does not name them, so recording them needs a ruling.

> Maximum Lot Coverage: Projects in R1 Variation Zones are subject to a maximum lot coverage standard of 50 percent for lots up to 6,000 square feet.

**What PermitPulse wants to encode:** A lot whose base zone is on the memo's single-family zone list is documented as barred when its recorded area is 65,340 sq ft (1.5 acres) or more, and consistent with the area limit when it is smaller.

**Proposed rule:** If the parcel's base zone is recorded as on the memo's single-family zone list and its recorded lot area is 65,340 sq ft or more, the criterion returns disqualifying_per_source. If the zone is on the list and the area is less than 65,340 sq ft, it returns consistent_with_source for the area limit only. If the zone is recorded as not on the list, it returns requires_judgment.

```text
IF shra-zone-category == single_family_listed_zone AND lot-area >= 65340 sq ft
  THEN disqualifying_per_source   (pathway roll-up: documented_disqualifier)
IF shra-zone-category == single_family_listed_zone AND lot-area < 65340 sq ft
  THEN consistent_with_source   (1.5-acre limit only; says nothing about vacancy)
IF shra-zone-category == zone_not_on_single_family_list
  THEN requires_judgment
Missing, unreviewed, or conflicting evidence: the evaluator returns unknown, unreviewed, or conflict and the rule does not run.
```

**Allowed outcomes:** `consistent_with_source`, `disqualifying_per_source`, `requires_judgment`. Shipped ceiling today: `consistent_with_source`, `disqualifying_per_source`, `requires_judgment`.

**Fact required:**

- `shra-zone-category` (controlled_value; one of `single_family_listed_zone`, `zone_not_on_single_family_list`)
  - Recorded from: The parcel's base zone on the City zoning record, matched by a person against the nine zones on memo page 12. The zoning string is never parsed.
  - Recordable without interpreting free text: with recording instruction
  - Not found distinguishable from NO: distinct
  - Date: Screen date. The memo tests the lot at application; the application date is not modeled.
  - Narrowing required first: yes
  - Smallest correction: Recording instruction only, no new value: record single_family_listed_zone when the base zone is one of the nine listed zones on a Chapter 1 parcel. Record unknown (reason insufficient_evidence) when the base zone starts with a listed name but carries a variation or number (the memo names R1 Variation Zones separately, page 14), or when the parcel is under Chapter 1A, until the reviewer rules on those forms.
- `lot-area` (controlled_value; number in sq ft)
  - Recorded from: The recorded area of the whole legal lot that would be subdivided, from a named City or County record. A calculated parcel area on a property profile is not necessarily the legal lot area.
  - Recordable without interpreting free text: yes
  - Not found distinguishable from NO: distinct
  - Date: Screen date. The memo tests the lot at application; a merger or lot line change before then changes the answer.
  - Narrowing required first: yes
  - Smallest correction: Recording instruction only, no new fact: record lot-area only when the named record gives the area of the whole legal lot as recorded before any subdivision. Record unknown when the parcel record and the legal lot may differ (tied lots, a lot spread over several parcel numbers, a pending merger).

**Why this appears safe:**

- The limit is one number in an operative City memo, and 1.5 acres converts exactly to 65,340 sq ft.
- Both inputs are controlled values a person records; the zoning string is never parsed.
- A zone off the list never reaches a result from this criterion.
- The rule covers the area limit only; vacancy stays with its own criteria.

**What could make it wrong:**

- The recorded parcel area is not the legal lot area the memo tests (tied lots, a lot split across parcel numbers, or a calculated area close to 65,340 sq ft).
- GCS 66499.41, which the memo only summarizes, measures the lot differently, for example leaving out a designated remainder parcel (FAQ Q.23) or measuring after a merger in the same application (FAQ Q.5). No captured source says so, but the statute is not captured.
- A zone form with a variation or number is recorded as on the list without a ruling.
- The parcel is under Chapter 1A, for which the memo says a separate memo will follow.
- A later City memo replaces this one. The capture notes say the official host was unreachable, so whether that has happened was not checked.

**Cross-reference / exception:**

- Exception: None stated for the 1.5-acre limit in the captured memo.
- Exception: The same sentence adds a vacancy condition for single-family zoned lots. That is la_shra.single-family-vacancy-condition and la_shra.vacant-site-definition, not this rule.
- GCS 66499.41 (the SHRA subdivision statute) (not captured): How the statute measures the lot (for example with a designated remainder parcel, or lots merged in the same application) is not in any captured source.
- Memo FAQ Q.1, page 12 (captured): Defines which zones are single-family zoned for the memo.

**Change from the v2 proposal:** The v2 proposal returned consistent_with_source for a zone off the list (the limit does not apply). Round 1 returns requires_judgment instead, so this criterion can never clear a lot whose zone form the memo does not list. Under its own v2 proposal, la_shra.zone-category routes the same parcels to judgment, so the SHRA pathway result would be the same either way.

**Questions for you:**

1. Do you agree that a lot recorded on the page 12 single-family list with an area of 65,340 sq ft or more returns disqualifying_per_source, whatever its vacancy?
2. Should a lot area within a stated margin of 65,340 sq ft (for example a calculated parcel area) be recorded as unknown rather than as a number?
3. Does anything in the captured memo tell you that a designated remainder parcel (FAQ Q.23) or a merger in the same application (FAQ Q.5) changes which area is tested? If you are unsure, should the blocking direction wait for the statute?
4. How should an R1 Variation Zone, or a listed zone written with a number, be recorded: as single_family_listed_zone, or as unknown until you rule?
5. Do you accept that a zone recorded as off the list returns requires_judgment here, rather than consistent_with_source as the v2 proposal said?

**REVIEWER DECISION:**

- [ ] APPROVE EXACTLY AS WRITTEN
- [ ] APPROVE WITH EDIT
- [ ] KEEP PENDING
- [ ] REMOVE

**Reviewer note:**

____________________________

### 2. `la_shra.prior-shra-or-sb9-map`: SHRA prior recorded SHRA or SB 9 map

**Source:** `shra-2025-10-28`, City SHRA implementation memorandum, October 28, 2025; official memo, `operative`, born-digital text layer; `sha256_extracted` `f44574084091c51419d0475d4b8501d9a2c3577b3a16830fc6ecb2a88b20f6e2`

**Page:** PDF page 2. The memo prints the same page numbers as the PDF at the foot of each page (page 1 carries no number).

**Section:** Part I (property criteria), fourth paragraph, second and third sentences, page 2. Shipped pinpoint: Memo Part I (property criteria), page 2 (prior SHRA or SB 9 lots).

**Exact excerpt:**

Page 2:

> Lots previously recorded pursuant to the SHRA or SB 9 (2021) are ineligible. However, this particular eligibility restriction does not apply if the tentative map has not been recorded.

**Classification:** A. BOTH_DIRECTIONS_SAFE. The fact names the statute the lot's creating map was recorded under: a positive identification from recorded maps, not proof of a negative. Every allowed value maps to one result, and an unknown statute or an incomplete history has no value, so it stays unknown.

- Blocking direction (safe): The memo bars “Lots previously recorded pursuant to the SHRA or SB 9 (2021)”. A lot whose current boundaries were created by a recorded SHRA or SB 9 map is such a lot.
- Clearing direction (safe): A lot created by a map recorded under another statute, or without a recorded map, is outside that sentence, and an SHRA or SB 9 tentative map that was never recorded is expressly excepted.

**Text-layer check** (page images compared: 1, 2, 14, 20): Born-digital text layer (Acrobat PDFMaker), not OCR. Each quoted sentence was compared with the rendered page image and reads the same, except where a discrepancy is listed.

**Neighboring text needed to understand the rule:**

`shra-2025-10-28` page 14: A lot mapped under another process is not restricted once that map is recorded; the timing condition is outside the screen.

> Yes, as long as the final map for the discretionary entitlement is recorded prior to the SHRA application.

`shra-2025-10-28` page 20: The memo sets no adjacency limit, so no adjacency fact is read.

> Yes - the SHRA can be utilized on adjacent parcels at the same time by the same (or different) developers.

`shra-2025-10-28` page 1: The memo summarizes the SHRA and sends readers to the statute for the full text (page 1). The statute is not captured, so nothing here relies on it.

> Please refer to California Government Code Sections (GCS) 65852.28, 65913.4.5, and 66499.41 for the full SHRA.

**What PermitPulse wants to encode:** A lot created by a recorded SHRA or SB 9 (2021) map is documented as barred; a lot created by any other map, by no map, or with only an unrecorded SHRA or SB 9 tentative map is consistent with this restriction.

**Proposed rule:** If the map that created the lot was recorded under the SHRA or SB 9 (2021), the criterion returns disqualifying_per_source. If the only SHRA or SB 9 map is a tentative map that was never recorded, or the lot's map was recorded under another statute, or no map was recorded, it returns consistent_with_source.

```text
IF prior-shra-or-sb9-map IN {shra_map_recorded, sb9_map_recorded}
  THEN disqualifying_per_source   (pathway roll-up: documented_disqualifier)
IF prior-shra-or-sb9-map IN {shra_or_sb9_tentative_map_not_recorded, other_basis_map_recorded, no_map_recorded}
  THEN consistent_with_source
Missing, unreviewed, or conflicting evidence (including an incomplete history): the evaluator returns unknown, unreviewed, or conflict and the rule does not run.
```

**Allowed outcomes:** `consistent_with_source`, `disqualifying_per_source`, `requires_judgment`. Shipped ceiling today: `consistent_with_source`, `disqualifying_per_source`, `requires_judgment`.

**Fact required:**

- `prior-shra-or-sb9-map` (controlled_value; one of `shra_map_recorded`, `sb9_map_recorded`, `shra_or_sb9_tentative_map_not_recorded`, `other_basis_map_recorded`, `no_map_recorded`)
  - Recorded from: The recorded parcel or tract maps for the lot and the City case record for each map, which state the statute the map was filed under.
  - Recordable without interpreting free text: with recording instruction
  - Not found distinguishable from NO: distinct only with recording instruction
  - Date: Screen date. A map recorded after the screen date is not seen.
  - Narrowing required first: yes
  - Smallest correction: Recording instruction only, no new value: (1) record shra_map_recorded or sb9_map_recorded only when the map that created the lot's current boundaries was recorded under that statute; if an SHRA or SB 9 map appears only earlier in the lot's history, record unknown. (2) Record other_basis_map_recorded or no_map_recorded only after the lot's full recorded-map history has been read back past the dates the SHRA and SB 9 took effect (those dates are not in a captured source); a single display or a partial search is unknown.

**Why this appears safe:**

- The restriction and its one exception are two adjacent sentences with no other condition.
- Five controlled values cover every recorded history; an incomplete history has no value and stays unknown.
- The memo sets no adjacency limit (FAQ Q.26), so nothing else is read.

**What could make it wrong:**

- GCS 66499.41 (not captured) words the restriction differently, for example reaching a lot whose earlier history includes an SHRA or SB 9 map.
- Planning reads SB 9 (2021) as reaching a two-unit project that recorded no lot; the memo's words are “Lots previously recorded”, which point to recorded lots only.
- The memo's wording “the tentative map has not been recorded” may not fit every SB 9 map process; which unrecorded SB 9 maps the tentative-map value covers needs confirming.
- A person records no_map_recorded or other_basis_map_recorded from an incomplete search.
- A later City memo replaces this one. The capture notes say the official host was unreachable, so whether that has happened was not checked.

**Cross-reference / exception:**

- Exception: Stated in the same passage: “this particular eligibility restriction does not apply if the tentative map has not been recorded”. The value shra_or_sb9_tentative_map_not_recorded carries it.
- GCS 66499.41 (not captured): The statute's own wording of the restriction, and whether it reaches a lot whose earlier history includes an SHRA or SB 9 map.
- SB 9 (2021) (not captured): The memo names the bill without a code section, so which maps count as recorded pursuant to it is not stated in a captured source.

**Change from the v2 proposal:** Same outcomes as v2. Round 1 adds the recording instruction that ties the SHRA and SB 9 values to the map that created the current lot and requires a full history before a clearing value.

**Questions for you:**

1. Do you agree that a lot whose current boundaries were created by a recorded SHRA or SB 9 (2021) map returns disqualifying_per_source?
2. If an SHRA or SB 9 map appears only earlier in the lot's history (the lot was later re-created by another map), should the value stay unknown as proposed?
3. Does “Lots previously recorded pursuant to the SHRA or SB 9 (2021)” reach anything other than a map that created lots, such as an SB 9 two-unit project with no lot split?
4. What search must a person complete before recording no_map_recorded or other_basis_map_recorded?

**REVIEWER DECISION:**

- [ ] APPROVE EXACTLY AS WRITTEN
- [ ] APPROVE WITH EDIT
- [ ] KEEP PENDING
- [ ] REMOVE

**Reviewer note:**

____________________________

### 3. `la_shra.very-high-fire-hazard-severity-zone`: SHRA Very High Fire Hazard Severity Zone

**Source:** `shra-2025-10-28`, City SHRA implementation memorandum, October 28, 2025; official memo, `operative`, born-digital text layer; `sha256_extracted` `f44574084091c51419d0475d4b8501d9a2c3577b3a16830fc6ecb2a88b20f6e2`

**Page:** PDF page 4. The memo prints the same page numbers as the PDF at the foot of each page (page 1 carries no number).

**Section:** Part I, Environmental Criteria, first list (site categories where SHRA projects may not be located), item 3, with footnote 1; page 4. Shipped pinpoint: Memo Part I, Environmental Criteria, page 4, prohibited category 3 and footnote 1.

**Exact excerpt:**

Page 4:

> First, SHRA projects may not be located on the following site categories:

Page 4:

> 3) High or very high fire hazard severity zones, as referenced in GCS 51178 and Public Resources Code Section 42021.

Page 4:

> 1 Please note this includes both state and local responsibility areas.

**Classification:** A. BOTH_DIRECTIONS_SAFE. A map-based designation recorded as yes or no. A zone map either includes a location or does not, so a NO read from the current map is a finding, while a failed or partial lookup is recorded as unknown. A NO here says nothing about a High zone, which is la_shra.high-fire-hazard-severity-zone.

- Blocking direction (safe): SHRA projects “may not be located on” item 3, which names Very High zones, and footnote 1 covers “both state and local responsibility areas”. A parcel wholly in a Very High zone is in that category.
- Clearing direction (safe): A parcel that the current zone map places in no Very High zone is not in this category for the Very High designation. A NO here says nothing about a High zone, which is la_shra.high-fire-hazard-severity-zone.

**Text-layer check** (page images compared: 4, 5): Born-digital text layer (Acrobat PDFMaker), not OCR. The text layer turns the superscript footnote marker into an ordinary digit, so item 3 reads 42021. The excerpt is kept exactly as captured (the tests match it to extracted.txt); the statute the page cites is Public Resources Code Section 4202. The page also sets the word not in bold italics in the list's lead-in; formatting is not captured. Every other quoted sentence reads the same on the page image.
- Page 4: text layer `Public Resources Code Section 42021.`; page image: Public Resources Code Section 4202, then a superscript footnote marker 1, then the period. Footnote 1 attaches to item 3. (inside the rule excerpt).

**Neighboring text needed to understand the rule:**

`shra-2025-10-28` page 4: The memo keeps a separate list of categories that may proceed if conditions are met. This category is on the other list, which states no condition.

> The following site categories may only utilize SHRA streamlining if applicable conditions or standards have been met:

`shra-2025-10-28` page 5: This pointer follows both lists. If “these site limitations” includes the first list, the uncaptured statute may attach conditions to this category too; the memo does not say.

> Please see GCS 66499.41(a)(9) for more information about these site limitations as well as any specific conditions or standards needed to verify eligibility.

`shra-2025-10-28` page 4: The City's own pointer for finding the designation. In the Program Screen, ZIMAS displays are observation-only program flags and never feed a rule.

> Please consult the SHRA Eligibility Checklist in ZIMAS to determine if a site is located in any of the following prohibited and/or restricted areas.

`shra-2025-10-28` page 1: The memo summarizes the SHRA and sends readers to the statute for the full text (page 1). The statute is not captured, so nothing here relies on it.

> Please refer to California Government Code Sections (GCS) 65852.28, 65913.4.5, and 66499.41 for the full SHRA.

`ordinance-188968` page 5: Identifies the Department of Forestry and Fire Protection as the agency that determines Very High zones under GCS 51178. Quoted for that only.

> F. A site within a very high fire hazard severity zone, as determined by the Department of Forestry and Fire Protection pursuant to Government Code Section 51178, or within the state responsibility area, as defined in Public Resources Code Section 4102 (Gov. Code Sec. 65912.161(b)(1)(D)).

**What PermitPulse wants to encode:** A parcel wholly in a Very High Fire Hazard Severity Zone (state or local responsibility area) is documented as barred; a parcel in no Very High zone on the current map is consistent for the Very High designation only.

**Proposed rule:** If the parcel is recorded as mapped in a Very High Fire Hazard Severity Zone (state or local responsibility area), the criterion returns disqualifying_per_source. If it is recorded as not mapped in a Very High zone, it returns consistent_with_source for the Very High designation only.

```text
IF very-high-fire-hazard-severity-zone == true
  THEN disqualifying_per_source   (pathway roll-up: documented_disqualifier)
IF very-high-fire-hazard-severity-zone == false
  THEN consistent_with_source   (Very High only; A NO here says nothing about a High zone, which is la_shra.high-fire-hazard-severity-zone)
Missing, unreviewed, or conflicting evidence: the evaluator returns unknown, unreviewed, or conflict and the rule does not run.
```

**Allowed outcomes:** `consistent_with_source`, `disqualifying_per_source`, `requires_judgment`. Shipped ceiling today: `consistent_with_source`, `disqualifying_per_source`, `requires_judgment`.

**Fact required:**

- `very-high-fire-hazard-severity-zone` (controlled_value; yes/no)
  - Recorded from: The current fire hazard severity zone map covering the parcel, for state and local responsibility areas, or a City hazard display that reproduces it. The evidence names the map and its date.
  - Recordable without interpreting free text: yes
  - Not found distinguishable from NO: distinct
  - Date: The map edition in force on the screen date; zone maps are revised.
  - Narrowing required first: yes
  - Smallest correction: Recording instruction only, no new value: YES when the whole parcel is in a Very High zone in a state or a local responsibility area (footnote 1); NO when no part of the parcel is in a Very High zone on the current map; unknown (reason insufficient_evidence) when the zone covers only part of the parcel or the map edition is not stated. A later change should also make the fact's client label, now `the property's fire-hazard designation`, name Very High in state or local responsibility areas; that label change also touches the fictional fixture and is not made here.

**Why this appears safe:**

- The category is on the memo's first list, which states no condition, and not on the conditional list.
- Footnote 1 settles the state-versus-local responsibility area question.
- High and Very High are separate facts and separate criteria; one never stands in for the other (existing tests).
- The fictional fixture's Very High conflict (a CAL FIRE record of YES, a City display of NO) stays a conflict; the rule never runs on it.

**What could make it wrong:**

- The page 5 pointer to GCS 66499.41(a)(9) reaches the first list and the statute attaches a condition to this category. No captured text says so, but the statute is not captured.
- The map edition recorded is out of date.
- The zone covers part of the parcel and a person records YES or NO anyway.
- A reader relies on the text layer's “Public Resources Code Section 42021” and looks up a section the memo does not cite.
- A later City memo replaces this one. The capture notes say the official host was unreachable, so whether that has happened was not checked.

**Cross-reference / exception:**

- Exception: None stated on the page 4 list; the conditional categories and their conditions are a separate list.
- Exception: Unresolved: the page 5 pointer to GCS 66499.41(a)(9) may reach this list (see cross-references).
- GCS 66499.41(a)(9) (not captured): The memo's page 5 pointer names it for “these site limitations as well as any specific conditions or standards”. Whether it conditions any category on the first list is unknown until it is captured.
- Memo Part I, Environmental Criteria, second list (page 4) and page 5 (captured): The conditional categories; this category is not among them.
- GCS 51178 and Public Resources Code Section 4202 (not captured): The statutes the memo cites for the zones. Neither is captured.
- Ordinance 188968, Sec. 2.F, page 5 (captured): The only captured text that names who determines a Very High zone under GCS 51178: the Department of Forestry and Fire Protection. It is quoted here only to identify the mapping agency; the SB 79 temporary exemption is not part of this round.

**Change from the v2 proposal:** Same outcomes as v2. Round 1 adds the partial-parcel and map-edition recording instruction and records the 42021 text-layer discrepancy.

**Questions for you:**

1. Do you agree that a parcel wholly within a Very High Fire Hazard Severity Zone, in a state or local responsibility area, returns disqualifying_per_source, and that a parcel in no Very High zone on the current map returns consistent_with_source for Very High only?
2. Which map, and which edition, is the record for this fact?
3. Do you read the page 5 sentence (“Please see GCS 66499.41(a)(9) for more information about these site limitations”) as reaching the page 4 list of categories where projects may not be located? If so, should the blocking direction wait until the statute is captured?
4. Do you accept unknown for a parcel only partly inside the zone?

**REVIEWER DECISION:**

- [ ] APPROVE EXACTLY AS WRITTEN
- [ ] APPROVE WITH EDIT
- [ ] KEEP PENDING
- [ ] REMOVE

**Reviewer note:**

____________________________

### 4. `la_shra.high-fire-hazard-severity-zone`: SHRA High Fire Hazard Severity Zone

**Source:** `shra-2025-10-28`, City SHRA implementation memorandum, October 28, 2025; official memo, `operative`, born-digital text layer; `sha256_extracted` `f44574084091c51419d0475d4b8501d9a2c3577b3a16830fc6ecb2a88b20f6e2`

**Page:** PDF page 4. The memo prints the same page numbers as the PDF at the foot of each page (page 1 carries no number).

**Section:** Part I, Environmental Criteria, first list (site categories where SHRA projects may not be located), item 3, with footnote 1; page 4. Shipped pinpoint: Memo Part I, Environmental Criteria, page 4, prohibited category 3 and footnote 1.

**Exact excerpt:**

Page 4:

> First, SHRA projects may not be located on the following site categories:

Page 4:

> 3) High or very high fire hazard severity zones, as referenced in GCS 51178 and Public Resources Code Section 42021.

Page 4:

> 1 Please note this includes both state and local responsibility areas.

**Classification:** A. BOTH_DIRECTIONS_SAFE. A map-based designation recorded as yes or no. A zone map either includes a location or does not, so a NO read from the current map is a finding, while a failed or partial lookup is recorded as unknown. The Very High record never stands in for this fact.

- Blocking direction (safe): SHRA projects “may not be located on” item 3, which names High zones, and footnote 1 covers “both state and local responsibility areas”. A parcel wholly in a High zone is in that category.
- Clearing direction (safe): A parcel that the current zone map places in no High zone is not in this category for the High designation. The Very High record never stands in for this fact.

**Text-layer check** (page images compared: 4, 5): Born-digital text layer (Acrobat PDFMaker), not OCR. The text layer turns the superscript footnote marker into an ordinary digit, so item 3 reads 42021. The excerpt is kept exactly as captured (the tests match it to extracted.txt); the statute the page cites is Public Resources Code Section 4202. The page also sets the word not in bold italics in the list's lead-in; formatting is not captured. Every other quoted sentence reads the same on the page image.
- Page 4: text layer `Public Resources Code Section 42021.`; page image: Public Resources Code Section 4202, then a superscript footnote marker 1, then the period. Footnote 1 attaches to item 3. (inside the rule excerpt).

**Neighboring text needed to understand the rule:**

`shra-2025-10-28` page 4: The memo keeps a separate list of categories that may proceed if conditions are met. This category is on the other list, which states no condition.

> The following site categories may only utilize SHRA streamlining if applicable conditions or standards have been met:

`shra-2025-10-28` page 5: This pointer follows both lists. If “these site limitations” includes the first list, the uncaptured statute may attach conditions to this category too; the memo does not say.

> Please see GCS 66499.41(a)(9) for more information about these site limitations as well as any specific conditions or standards needed to verify eligibility.

`shra-2025-10-28` page 4: The City's own pointer for finding the designation. In the Program Screen, ZIMAS displays are observation-only program flags and never feed a rule.

> Please consult the SHRA Eligibility Checklist in ZIMAS to determine if a site is located in any of the following prohibited and/or restricted areas.

`shra-2025-10-28` page 1: The memo summarizes the SHRA and sends readers to the statute for the full text (page 1). The statute is not captured, so nothing here relies on it.

> Please refer to California Government Code Sections (GCS) 65852.28, 65913.4.5, and 66499.41 for the full SHRA.

`ordinance-188968` page 5: Identifies the Department of Forestry and Fire Protection as the agency that determines Very High zones under GCS 51178. Quoted for that only.

> F. A site within a very high fire hazard severity zone, as determined by the Department of Forestry and Fire Protection pursuant to Government Code Section 51178, or within the state responsibility area, as defined in Public Resources Code Section 4102 (Gov. Code Sec. 65912.161(b)(1)(D)).

**What PermitPulse wants to encode:** A parcel wholly in a High Fire Hazard Severity Zone (state or local responsibility area) is documented as barred; a parcel in no High zone on a map that assigns High classes is consistent for the High designation only.

**Proposed rule:** If the parcel is recorded as mapped in a High Fire Hazard Severity Zone (state or local responsibility area), the criterion returns disqualifying_per_source. If it is recorded as not mapped in a High zone, it returns consistent_with_source for the High designation only.

```text
IF high-fire-hazard-severity-zone == true
  THEN disqualifying_per_source   (pathway roll-up: documented_disqualifier)
IF high-fire-hazard-severity-zone == false
  THEN consistent_with_source   (High only; The Very High record never stands in for this fact)
Missing, unreviewed, or conflicting evidence: the evaluator returns unknown, unreviewed, or conflict and the rule does not run.
```

**Allowed outcomes:** `consistent_with_source`, `disqualifying_per_source`, `requires_judgment`. Shipped ceiling today: `consistent_with_source`, `disqualifying_per_source`, `requires_judgment`.

**Fact required:**

- `high-fire-hazard-severity-zone` (controlled_value; yes/no)
  - Recorded from: The current fire hazard severity zone map covering the parcel, for state and local responsibility areas, or a City hazard display that reproduces it. The evidence names the map and its date.
  - Recordable without interpreting free text: yes
  - Not found distinguishable from NO: distinct
  - Date: The map edition in force on the screen date; zone maps are revised.
  - Narrowing required first: yes
  - Smallest correction: Recording instruction only, no new value: YES when the whole parcel is in a High zone in a state or local responsibility area; NO only from a map edition that assigns a High class in the parcel's responsibility area and places no part of the parcel in it; unknown (reason insufficient_evidence) when the zone covers part of the parcel, or when the map consulted does not show whether it assigns a High class for that responsibility area. Never inferred from the Very High record.

**Why this appears safe:**

- The category is on the memo's first list, which states no condition, and not on the conditional list.
- Footnote 1 settles the state-versus-local responsibility area question.
- High and Very High are separate facts and separate criteria; one never stands in for the other (existing tests).
- The fictional fixture's Very High conflict (a CAL FIRE record of YES, a City display of NO) stays a conflict; the rule never runs on it.

**What could make it wrong:**

- The page 5 pointer to GCS 66499.41(a)(9) reaches the first list and the statute attaches a condition to this category. No captured text says so, but the statute is not captured.
- The map edition recorded is out of date.
- The zone covers part of the parcel and a person records YES or NO anyway.
- A reader relies on the text layer's “Public Resources Code Section 42021” and looks up a section the memo does not cite.
- The map consulted does not assign a High class in the parcel's responsibility area, so a NO read from it means nothing. The recording instruction records unknown in that case; nothing in code can check it.
- A later City memo replaces this one. The capture notes say the official host was unreachable, so whether that has happened was not checked.

**Cross-reference / exception:**

- Exception: None stated on the page 4 list; the conditional categories and their conditions are a separate list.
- Exception: Unresolved: the page 5 pointer to GCS 66499.41(a)(9) may reach this list (see cross-references).
- GCS 66499.41(a)(9) (not captured): The memo's page 5 pointer names it for “these site limitations as well as any specific conditions or standards”. Whether it conditions any category on the first list is unknown until it is captured.
- Memo Part I, Environmental Criteria, second list (page 4) and page 5 (captured): The conditional categories; this category is not among them.
- GCS 51178 and Public Resources Code Section 4202 (not captured): The statutes the memo cites for the zones. Neither is captured.
- Ordinance 188968, Sec. 2.F, page 5 (captured): The only captured text that names who determines a Very High zone under GCS 51178: the Department of Forestry and Fire Protection. It is quoted here only to identify the mapping agency; the SB 79 temporary exemption is not part of this round.

**Change from the v2 proposal:** Same outcomes as v2. Round 1 adds the partial-parcel and map-edition recording instruction and records the 42021 text-layer discrepancy.

**Questions for you:**

1. Do you agree that a parcel wholly within a High Fire Hazard Severity Zone, in a state or local responsibility area, returns disqualifying_per_source on the same terms as Very High, and that a NO read from a map that assigns High classes returns consistent_with_source for High only?
2. Which map edition is the record for a High zone in a local responsibility area, and which for a state responsibility area?
3. Do you read the page 5 sentence (“Please see GCS 66499.41(a)(9) for more information about these site limitations”) as reaching the page 4 list of categories where projects may not be located? If so, should the blocking direction wait until the statute is captured?
4. Do you accept unknown for a parcel only partly inside the zone?

**REVIEWER DECISION:**

- [ ] APPROVE EXACTLY AS WRITTEN
- [ ] APPROVE WITH EDIT
- [ ] KEEP PENDING
- [ ] REMOVE

**Reviewer note:**

____________________________

### 5. `la_shra.prime-or-statewide-farmland`: SHRA prime or statewide farmland

**Source:** `shra-2025-10-28`, City SHRA implementation memorandum, October 28, 2025; official memo, `operative`, born-digital text layer; `sha256_extracted` `f44574084091c51419d0475d4b8501d9a2c3577b3a16830fc6ecb2a88b20f6e2`

**Page:** PDF page 4. The memo prints the same page numbers as the PDF at the foot of each page (page 1 carries no number).

**Section:** Part I, Environmental Criteria, first list (site categories where SHRA projects may not be located), item 1; page 4. Shipped pinpoint: Memo Part I, Environmental Criteria, page 4, prohibited category 1.

**Exact excerpt:**

Page 4:

> First, SHRA projects may not be located on the following site categories:

Page 4:

> 1) Prime farmland or farmland of statewide importance;

**Classification:** B. BLOCK_ONLY. The blocking direction needs only an affirmative designation using the memo's words. The clearing direction needs a named, complete defining map, and no captured source names one.

- Blocking direction (safe): The memo bars item 1, “Prime farmland or farmland of statewide importance”. An official designation of the parcel with either term puts it in that category.
- Clearing direction (not safe): The memo names no defining map. A record showing no farmland designation cannot show that no official designation exists, because the captured sources do not say which record is complete.

**Text-layer check** (page images compared: 4, 5): Born-digital text layer (Acrobat PDFMaker), not OCR. The quoted item and lead-in read the same on the page image; the page sets the word not in bold italics in the lead-in, and formatting is not captured.

**Neighboring text needed to understand the rule:**

`shra-2025-10-28` page 4: The memo keeps a separate list of categories that may proceed if conditions are met. This category is on the other list, which states no condition.

> The following site categories may only utilize SHRA streamlining if applicable conditions or standards have been met:

`shra-2025-10-28` page 5: This pointer follows both lists. If “these site limitations” includes the first list, the uncaptured statute may attach conditions to this category too; the memo does not say.

> Please see GCS 66499.41(a)(9) for more information about these site limitations as well as any specific conditions or standards needed to verify eligibility.

`shra-2025-10-28` page 4: The City's own pointer for finding the designation. In the Program Screen, ZIMAS displays are observation-only program flags and never feed a rule.

> Please consult the SHRA Eligibility Checklist in ZIMAS to determine if a site is located in any of the following prohibited and/or restricted areas.

`shra-2025-10-28` page 1: The memo summarizes the SHRA and sends readers to the statute for the full text (page 1). The statute is not captured, so nothing here relies on it.

> Please refer to California Government Code Sections (GCS) 65852.28, 65913.4.5, and 66499.41 for the full SHRA.

**What PermitPulse wants to encode:** A parcel officially designated prime farmland or farmland of statewide importance is documented as barred; a parcel without that designation is left to judgment, never cleared.

**Proposed rule:** If an official record designates the parcel as prime farmland or farmland of statewide importance, the criterion returns disqualifying_per_source. If the fact is recorded as NO, it returns requires_judgment (never consistent_with_source: a NO cannot show the category is absent).

```text
IF prime-or-statewide-farmland == true
  THEN disqualifying_per_source   (pathway roll-up: documented_disqualifier)
IF prime-or-statewide-farmland == false
  THEN requires_judgment (never consistent_with_source: a NO cannot show the category is absent)
Missing, unreviewed, or conflicting evidence: the evaluator returns unknown, unreviewed, or conflict and the rule does not run.
```

**Allowed outcomes:** `disqualifying_per_source`, `requires_judgment`. Shipped ceiling today: `consistent_with_source`, `disqualifying_per_source`, `requires_judgment`.
 The proposed rule uses less than the shipped ceiling; the ceiling itself is not changed here.

**Fact required:**

- `prime-or-statewide-farmland` (controlled_value; yes/no)
  - Recorded from: Not named in the captured memo. A YES comes only from an official map or record that designates the parcel with one of the memo's two terms: prime farmland, or farmland of statewide importance.
  - Recordable without interpreting free text: with recording instruction
  - Not found distinguishable from NO: not distinct
  - Date: The designation or instrument in force on the screen date.
  - Narrowing required first: yes
  - Smallest correction: Recording instruction only, no new value: YES only from an official record that designates the whole parcel with one of the memo's two terms; a designation covering part of the parcel, or using different words, is unknown. A NO may be recorded but never clears (the rule routes it to judgment).

**Why this appears safe:**

- Only an affirmative record using the memo's own category can block.
- A NO never clears, so a missing, partial, or incomplete lookup cannot produce a false consistent result.
- The proposed ceiling is narrower than the shipped ceiling; nothing is widened.

**What could make it wrong:**

- The page 5 pointer to GCS 66499.41(a)(9) reaches the first list and the statute attaches a condition to this category. No captured text says so, but the statute is not captured.
- A map uses similar words for a different classification and a person records YES from it.
- The designation covers only part of the parcel.
- A later City memo replaces this one. The capture notes say the official host was unreachable, so whether that has happened was not checked.

**Cross-reference / exception:**

- Exception: None stated on the page 4 list.
- Exception: Unresolved: the page 5 pointer to GCS 66499.41(a)(9) may reach this list (see cross-references).
- GCS 66499.41(a)(9) (not captured): The memo's page 5 pointer names it for “these site limitations as well as any specific conditions or standards”. Whether it conditions any category on the first list is unknown until it is captured.
- Memo Part I, Environmental Criteria, second list (page 4) and page 5 (captured): The conditional categories; this category is not among them.
- The defining farmland map (not captured): No captured source names it. Until one is named from a captured source, a NO cannot clear.

**Change from the v2 proposal:** v2 proposed consistent_with_source for a NO read from a designated defining map. No captured source designates that map, so Round 1 drops the clearing direction. The shipped ceiling is unchanged; the proposed rule simply never uses consistent_with_source.

**Questions for you:**

1. Do you agree that an official designation of the whole parcel as prime farmland or farmland of statewide importance returns disqualifying_per_source?
2. Which official record should be the source of a YES?
3. Do you accept that a NO returns requires_judgment until a defining map is captured and named?
4. Do you read the page 5 sentence (“Please see GCS 66499.41(a)(9) for more information about these site limitations”) as reaching the page 4 list of categories where projects may not be located? If so, should the blocking direction wait until the statute is captured?

**REVIEWER DECISION:**

- [ ] APPROVE EXACTLY AS WRITTEN
- [ ] APPROVE WITH EDIT
- [ ] KEEP PENDING
- [ ] REMOVE

**Reviewer note:**

____________________________

### 6. `la_shra.natural-community-conservation-plan-land`: SHRA natural community conservation plan land

**Source:** `shra-2025-10-28`, City SHRA implementation memorandum, October 28, 2025; official memo, `operative`, born-digital text layer; `sha256_extracted` `f44574084091c51419d0475d4b8501d9a2c3577b3a16830fc6ecb2a88b20f6e2`

**Page:** PDF page 4. The memo prints the same page numbers as the PDF at the foot of each page (page 1 carries no number).

**Section:** Part I, Environmental Criteria, first list (site categories where SHRA projects may not be located), item 4; page 4. Shipped pinpoint: Memo Part I, Environmental Criteria, page 4, prohibited category 4.

**Exact excerpt:**

Page 4:

> First, SHRA projects may not be located on the following site categories:

Page 4:

> 4) Land identified for conservation in an adopted natural community conservation plan;

**Classification:** B. BLOCK_ONLY. Presence is a positive record in one adopted plan. Absence would need every adopted plan covering the parcel, and no captured source lists them.

- Blocking direction (safe): The memo bars item 4, “Land identified for conservation in an adopted natural community conservation plan”. The adopted plan's own identification of the parcel is that showing.
- Clearing direction (not safe): The memo names no plan. Showing that no adopted plan identifies the parcel needs a complete list of adopted plans covering City parcels, which no captured source gives.

**Text-layer check** (page images compared: 4, 5): Born-digital text layer (Acrobat PDFMaker), not OCR. The quoted item and lead-in read the same on the page image; the page sets the word not in bold italics in the lead-in, and formatting is not captured.

**Neighboring text needed to understand the rule:**

`shra-2025-10-28` page 4: The memo keeps a separate list of categories that may proceed if conditions are met. This category is on the other list, which states no condition.

> The following site categories may only utilize SHRA streamlining if applicable conditions or standards have been met:

`shra-2025-10-28` page 5: This pointer follows both lists. If “these site limitations” includes the first list, the uncaptured statute may attach conditions to this category too; the memo does not say.

> Please see GCS 66499.41(a)(9) for more information about these site limitations as well as any specific conditions or standards needed to verify eligibility.

`shra-2025-10-28` page 4: The City's own pointer for finding the designation. In the Program Screen, ZIMAS displays are observation-only program flags and never feed a rule.

> Please consult the SHRA Eligibility Checklist in ZIMAS to determine if a site is located in any of the following prohibited and/or restricted areas.

`shra-2025-10-28` page 1: The memo summarizes the SHRA and sends readers to the statute for the full text (page 1). The statute is not captured, so nothing here relies on it.

> Please refer to California Government Code Sections (GCS) 65852.28, 65913.4.5, and 66499.41 for the full SHRA.

**What PermitPulse wants to encode:** Land an adopted natural community conservation plan identifies for conservation is documented as barred; anything else is left to judgment, never cleared.

**Proposed rule:** If an adopted natural community conservation plan identifies the parcel for conservation, the criterion returns disqualifying_per_source. If the fact is recorded as NO, it returns requires_judgment (never consistent_with_source: a NO cannot show the category is absent).

```text
IF nccp-conservation-land == true
  THEN disqualifying_per_source   (pathway roll-up: documented_disqualifier)
IF nccp-conservation-land == false
  THEN requires_judgment (never consistent_with_source: a NO cannot show the category is absent)
Missing, unreviewed, or conflicting evidence: the evaluator returns unknown, unreviewed, or conflict and the rule does not run.
```

**Allowed outcomes:** `disqualifying_per_source`, `requires_judgment`. Shipped ceiling today: `consistent_with_source`, `disqualifying_per_source`, `requires_judgment`.
 The proposed rule uses less than the shipped ceiling; the ceiling itself is not changed here.

**Fact required:**

- `nccp-conservation-land` (controlled_value; yes/no)
  - Recorded from: An adopted natural community conservation plan's own map or text that identifies the parcel for conservation. The memo names no plan.
  - Recordable without interpreting free text: with recording instruction
  - Not found distinguishable from NO: not distinct
  - Date: The designation or instrument in force on the screen date.
  - Narrowing required first: yes
  - Smallest correction: Recording instruction only, no new value: YES only when an adopted plan's own map or text identifies the whole parcel for conservation; a draft or proposed plan is never a YES; identification of part of the parcel is unknown. A NO may be recorded but never clears.

**Why this appears safe:**

- Only an affirmative record using the memo's own category can block.
- A NO never clears, so a missing, partial, or incomplete lookup cannot produce a false consistent result.
- The proposed ceiling is narrower than the shipped ceiling; nothing is widened.

**What could make it wrong:**

- The page 5 pointer to GCS 66499.41(a)(9) reaches the first list and the statute attaches a condition to this category. No captured text says so, but the statute is not captured.
- The plan is not adopted, or identifies the land for something other than conservation.
- The plan's conservation designation covers only part of the parcel.
- A later City memo replaces this one. The capture notes say the official host was unreachable, so whether that has happened was not checked.

**Cross-reference / exception:**

- Exception: None stated on the page 4 list.
- Exception: Unresolved: the page 5 pointer to GCS 66499.41(a)(9) may reach this list (see cross-references).
- GCS 66499.41(a)(9) (not captured): The memo's page 5 pointer names it for “these site limitations as well as any specific conditions or standards”. Whether it conditions any category on the first list is unknown until it is captured.
- Memo Part I, Environmental Criteria, second list (page 4) and page 5 (captured): The conditional categories; this category is not among them.
- The adopted natural community conservation plans covering City parcels (not captured): No captured source lists them, so a NO cannot clear.

**Change from the v2 proposal:** v2 proposed consistent_with_source for a NO read from the adopted plan maps. No captured source lists those plans, so Round 1 drops the clearing direction. The shipped ceiling is unchanged; the proposed rule simply never uses consistent_with_source.

**Questions for you:**

1. Do you agree that land an adopted natural community conservation plan identifies for conservation returns disqualifying_per_source?
2. Do you accept that a NO returns requires_judgment, because no captured source lists the adopted plans covering City parcels?
3. Should land identified only in a plan that is not yet adopted be recorded as unknown?
4. Do you read the page 5 sentence (“Please see GCS 66499.41(a)(9) for more information about these site limitations”) as reaching the page 4 list of categories where projects may not be located? If so, should the blocking direction wait until the statute is captured?

**REVIEWER DECISION:**

- [ ] APPROVE EXACTLY AS WRITTEN
- [ ] APPROVE WITH EDIT
- [ ] KEEP PENDING
- [ ] REMOVE

**Reviewer note:**

____________________________

### 7. `la_shra.conservation-easement`: SHRA conservation easement

**Source:** `shra-2025-10-28`, City SHRA implementation memorandum, October 28, 2025; official memo, `operative`, born-digital text layer; `sha256_extracted` `f44574084091c51419d0475d4b8501d9a2c3577b3a16830fc6ecb2a88b20f6e2`

**Page:** PDF page 4. The memo prints the same page numbers as the PDF at the foot of each page (page 1 carries no number).

**Section:** Part I, Environmental Criteria, first list (site categories where SHRA projects may not be located), item 6; page 4. Shipped pinpoint: Memo Part I, Environmental Criteria, page 4, prohibited category 6.

**Exact excerpt:**

Page 4:

> First, SHRA projects may not be located on the following site categories:

Page 4:

> 6) Lands under a conservation easement.

**Classification:** B. BLOCK_ONLY. Presence is a recorded instrument. Absence is a negative across the whole title history, and the yes/no fact cannot show the search was complete.

- Blocking direction (safe): The memo bars item 6, “Lands under a conservation easement”. A recorded conservation easement over the parcel puts it in that category.
- Clearing direction (not safe): An easement is found by searching title. A search that finds none is a finding only if the search was complete, and the fact cannot record whether it was.

**Text-layer check** (page images compared: 4, 5): Born-digital text layer (Acrobat PDFMaker), not OCR. The quoted item and lead-in read the same on the page image; the page sets the word not in bold italics in the lead-in, and formatting is not captured.

**Neighboring text needed to understand the rule:**

`shra-2025-10-28` page 4: The memo keeps a separate list of categories that may proceed if conditions are met. This category is on the other list, which states no condition.

> The following site categories may only utilize SHRA streamlining if applicable conditions or standards have been met:

`shra-2025-10-28` page 5: This pointer follows both lists. If “these site limitations” includes the first list, the uncaptured statute may attach conditions to this category too; the memo does not say.

> Please see GCS 66499.41(a)(9) for more information about these site limitations as well as any specific conditions or standards needed to verify eligibility.

`shra-2025-10-28` page 4: The City's own pointer for finding the designation. In the Program Screen, ZIMAS displays are observation-only program flags and never feed a rule.

> Please consult the SHRA Eligibility Checklist in ZIMAS to determine if a site is located in any of the following prohibited and/or restricted areas.

`shra-2025-10-28` page 1: The memo summarizes the SHRA and sends readers to the statute for the full text (page 1). The statute is not captured, so nothing here relies on it.

> Please refer to California Government Code Sections (GCS) 65852.28, 65913.4.5, and 66499.41 for the full SHRA.

**What PermitPulse wants to encode:** A parcel under a recorded conservation easement is documented as barred; a parcel with no easement found is left to judgment, never cleared.

**Proposed rule:** If a recorded conservation easement covers the parcel, the criterion returns disqualifying_per_source. If the fact is recorded as NO, it returns requires_judgment (never consistent_with_source: a NO cannot show the category is absent).

```text
IF conservation-easement == true
  THEN disqualifying_per_source   (pathway roll-up: documented_disqualifier)
IF conservation-easement == false
  THEN requires_judgment (never consistent_with_source: a NO cannot show the category is absent)
Missing, unreviewed, or conflicting evidence: the evaluator returns unknown, unreviewed, or conflict and the rule does not run.
```

**Allowed outcomes:** `disqualifying_per_source`, `requires_judgment`. Shipped ceiling today: `consistent_with_source`, `disqualifying_per_source`, `requires_judgment`.
 The proposed rule uses less than the shipped ceiling; the ceiling itself is not changed here.

**Fact required:**

- `conservation-easement` (controlled_value; yes/no)
  - Recorded from: A recorded instrument that creates a conservation easement over the parcel, found in the parcel's title records.
  - Recordable without interpreting free text: with recording instruction
  - Not found distinguishable from NO: not distinct
  - Date: The designation or instrument in force on the screen date.
  - Narrowing required first: yes
  - Smallest correction: Recording instruction only, no new value: YES only from a recorded instrument that creates a conservation easement over the whole parcel; an easement over part of the parcel, an easement of another kind whose purpose must be interpreted, or a released easement is unknown. A NO may be recorded but never clears.

**Why this appears safe:**

- Only an affirmative record using the memo's own category can block.
- A NO never clears, so a missing, partial, or incomplete lookup cannot produce a false consistent result.
- The proposed ceiling is narrower than the shipped ceiling; nothing is widened.

**What could make it wrong:**

- The page 5 pointer to GCS 66499.41(a)(9) reaches the first list and the statute attaches a condition to this category. No captured text says so, but the statute is not captured.
- The easement covers only a strip of the parcel.
- The easement was released or extinguished and the release was not found.
- A later City memo replaces this one. The capture notes say the official host was unreachable, so whether that has happened was not checked.

**Cross-reference / exception:**

- Exception: None stated on the page 4 list.
- Exception: Unresolved: the page 5 pointer to GCS 66499.41(a)(9) may reach this list (see cross-references).
- GCS 66499.41(a)(9) (not captured): The memo's page 5 pointer names it for “these site limitations as well as any specific conditions or standards”. Whether it conditions any category on the first list is unknown until it is captured.
- Memo Part I, Environmental Criteria, second list (page 4) and page 5 (captured): The conditional categories; this category is not among them.
- The parcel's recorded title history (not captured): The only place a conservation easement is found; its completeness cannot be shown by the fact.

**Change from the v2 proposal:** v2 proposed consistent_with_source for a NO from a complete title search. The fact cannot record whether a search was complete, so Round 1 drops the clearing direction. The shipped ceiling is unchanged; the proposed rule simply never uses consistent_with_source.

**Questions for you:**

1. Do you agree that a recorded conservation easement over the whole parcel returns disqualifying_per_source?
2. Do you accept that a NO returns requires_judgment, since the fact cannot show a complete title search?
3. How should an easement over part of the parcel be handled: unknown, as proposed, or something else?
4. Do you read the page 5 sentence (“Please see GCS 66499.41(a)(9) for more information about these site limitations”) as reaching the page 4 list of categories where projects may not be located? If so, should the blocking direction wait until the statute is captured?

**REVIEWER DECISION:**

- [ ] APPROVE EXACTLY AS WRITTEN
- [ ] APPROVE WITH EDIT
- [ ] KEEP PENDING
- [ ] REMOVE

**Reviewer note:**

____________________________

### 8. `la_sb79.permanent-exemption-shown`: SB 79 permanent exemption shown (affirmative showing only)

**Source:** `ordinance-188968`, Ordinance 188968 (SB 79 Phased Implementation Ordinance); adopted ordinance, `operative`, City OCR text layer over a scan; `sha256_extracted` `91ea56cfb5db7b1d0f42bba4afef52179fd9052ef726d7a337fe35091410a588`

**Page:** PDF pages 3, 4, 5. The scanned pages carry no printed page numbers; every page number here is the PDF page.

**Section:** Section 1 lead-in and criteria A and B, page 4; Sec. 3 (Director's maps), page 5; recitals, page 3; Sec. 6(1), page 6. Shipped pinpoint: Ordinance 188968, Section 1, page 4; Sec. 3, page 5; recital, page 3.

**Exact excerpt:**

Page 4:

> Section 1. Pursuant to California Government Code Section 65912.160(e), the City Council adopts this ordinance on eligible sites meeting one of the criteria referenced below, making the sites permanently exempt from Senate Bill 79, codified at Government Code, Title 7, Division 1, Chapter 4.1.5 (Senate Bill 79):

Page 5:

> By enacting this ordinance, the City Council grants the Director of Planning with the power and duty, consistent with City Charter Section 553, to issue and update maps with eligible transit-oriented development sites meeting the criteria for permanent or temporarily exempt status

Page 3:

> WHEREAS, eligibility for the Phased Implementation Ordinance is contingent on the availability of a final map which has not yet been produced and approved by the Southern California Association of Governments

**Classification:** B. BLOCK_ONLY. An affirmative showing on the adopted record supports a documented disqualifier. The ordinance does not make the map exhaustive or authoritative for the opposite conclusion, so not shown can only route to judgment.

- Blocking direction (safe): Section 1 makes sites meeting its criteria “permanently exempt from Senate Bill 79”, and Sec. 3 gives the Director the duty to map them. A parcel that the Director's issued map shows as permanently exempt is exempt from SB 79.
- Clearing direction (not safe): Section 1 attaches the exemption to sites that meet its criteria, not to sites the map shows; the recital says SCAG's final map has not been produced; and no captured text says the Director's map is complete or that a parcel it omits is not exempt. Not shown is not a finding.

**Text-layer check** (page images compared: 3, 4, 5, 6): City OCR of a scan (ABBYY FineReader Server), reproduced in content-stream order. On page 4 the text layer runs Section 1's lead-in, then the end of the page 3 recital, then Sec. 2.A and 2.B, then Section 1.A and 1.B, then Sec. 2's lead-in; the page image reads the recital's end, Section 1's lead-in, 1.A, 1.B, Sec. 2's lead-in, 2.A, 2.B. On page 6 the text layer puts Secs. 4 to 6 after Sec. 8; the image starts with Sec. 4. Every quoted sentence reads the same on the image, but text next to an excerpt in extracted.txt is not always next to it on the page. The rule excerpt from Sec. 3 stops before the OCR-damaged citations.
- Page 5: text layer `65912.160(e)(1 )-(2), 65912.161 (b)(1 )(A) - 65912.161 (b) 1 )(F), and 65912.161 (b)(2),`; page image: 65912.160(e)(1)-(2), 65912.161(b)(1)(A) - 65912.161(b)(1)(F), and 65912.161(b)(2), (outside the rule excerpt).

**Neighboring text needed to understand the rule:**

`ordinance-188968` page 3: The full recital: until SCAG's final map exists, the City's determinations rest on currently available data, so a showing can change when that map is produced.

> WHEREAS, eligibility for the Phased Implementation Ordinance is contingent on the availability of a final map which has not yet been produced and approved by the Southern California Association of Governments, pursuant to California Government Code Section 65912.160(f), and in the absence of that map, eligibility has been determined based on currently available information and data;

`ordinance-188968` page 3: The recital's draft map identified the whole City as “eligible for permanent and temporary exemption”. A layer using that wording is not a showing that a parcel is permanently exempt; recording YES from it would block SB 79 citywide.

> WHEREAS, the City conducted an in-depth assessment of TOD Zones through mapping and modeling analyses, to evaluate sites within the City that are eligible for permanent and temporary exemption, and based on this information, the City released a draft map identifying all of the City as eligible for permanent and temporary exemption;

`ordinance-188968` page 3: Under the cited state law a permanent exemption rests on findings about the walking path or an industrial employment hub. Those are Section 1.A and 1.B, which stay professional-judgment criteria.

> WHEREAS, pursuant to California Government Code Section 65912.160(e), a local agency may declare that parcels in transit-oriented development zones are permanently exempt from SB 79’s provisions, if the local agency makes findings, supported by substantial evidence, that: (1) there exists no walking path of less than one mile between that parcel and the transit-oriented development stop; or (2) the parcel is part of an industrial employment hub, as defined in Government Code Section 65912.160(e)(2);

`ordinance-188968` page 4: The first ground for a permanent exemption.

> A. A site for which there exists no walking path of less than one mile from that location to the transit-oriented development stop (Gov. Code Sec. 65912.160(e)(1));

`ordinance-188968` page 4: The second ground, available only if the City has at least 15 TOD stops.

> B. A site designated as an industrial employment hub if the City has at least 15 transit-oriented development stops.

`ordinance-188968` page 4: Defines the industrial employment hub for 1.B.

> An industrial employment hub shall be a contiguous area of at least 250 acres designated in the City’s General Plan on or before January 1, 2025, as an employment lands area;

`ordinance-188968` page 5: The same map power covers temporary exemption, so a showing must say permanent. The citation list is damaged by OCR (see text_layer_check).

> meeting the criteria for permanent or temporarily exempt status pursuant to Government Code Sections 65912.160(e)(1 )-(2), 65912.161 (b)(1 )(A) - 65912.161 (b) 1 )(F), and 65912.161 (b)(2),

`ordinance-188968` page 5: The Director's maps are updated as SCAG and HCD maps change, so the map's date matters.

> to ensure consistency with the most current transit-oriented development zones map published by the Southern California Association of Governments or additional guidance from the California Department of Housing and Community Development.

`ordinance-188968` page 6: ZIMAS is directed to show which sites are and are not covered by SB 79. The Program Screen treats that display as observation only (zimas-sb79-exemption), and this fact accepts only an official document or a lookup attempt.

> (1) indicate on its public facing zoning map in the Zone Information and Map Access System (ZIMAS), which sites or transit-oriented development zones are and are not covered by Senate Bill 79’s provisions;

**What PermitPulse wants to encode:** A parcel the Director's issued map shows as permanently exempt under Ordinance 188968 Section 1 is documented as outside the SB 79 pathway; a parcel not shown is left to judgment, never cleared.

**Proposed rule:** If the Director's issued Phased Implementation map affirmatively shows the parcel as permanently exempt under Section 1 of Ordinance 188968, the criterion returns disqualifying_per_source for the SB 79 pathway. If the parcel is not shown that way, it returns requires_judgment. It never returns consistent_with_source.

```text
IF sb79-permanent-exemption-shown == true
  THEN disqualifying_per_source   (pathway roll-up: documented_disqualifier)
IF sb79-permanent-exemption-shown == false   (not shown)
  THEN requires_judgment   (never consistent_with_source)
Missing, unreviewed, or conflicting evidence: the evaluator returns unknown, unreviewed, or conflict and the rule does not run.
```

**Allowed outcomes:** `disqualifying_per_source`, `requires_judgment`. Shipped ceiling today: `disqualifying_per_source`, `requires_judgment`.

**Fact required:**

- `sb79-permanent-exemption-shown` (controlled_value; yes/no)
  - Recorded from: The Director of Planning's exemption map issued under Sec. 3, as issued, with its title and date named in the evidence. The fact accepts only an official document or a lookup attempt, so a ZIMAS display alone cannot be its source.
  - Recordable without interpreting free text: with recording instruction
  - Not found distinguishable from NO: not distinct
  - Date: The map version in force on the screen date; Sec. 3 maps are updated as SCAG and HCD maps change.
  - Narrowing required first: yes
  - Smallest correction: Recording instruction only, no new value: YES only when the Director's issued Sec. 3 map shows this parcel as permanently exempt under Section 1 (ground A or B). Record unknown, never YES, when the record describes the parcel only in words like the recital's draft map (“eligible for permanent and temporary exemption”) rather than as permanently exempt, shows an area or the whole City without a parcel-level permanent designation, does not separate permanent from temporary exemption, or is the draft map described in the page 3 recital. NO means only that the issued map does not show it.

**Why this appears safe:**

- Section 1 is direct: sites meeting its criteria are made “permanently exempt from Senate Bill 79”.
- The rule reads only an affirmative showing. The shipped ceiling already excludes consistent_with_source, and the evaluator rejects any other outcome.
- A ZIMAS display that disagrees makes the pathway contested (program-flag divergence), not settled.

**What could make it wrong:**

- The Director's map describes parcels in the draft map's words (“eligible for permanent and temporary exemption”) rather than as permanently exempt, or repeats the draft map that covered the whole City, and a person records YES from it. The recording instruction forbids that; nothing in code can check it.
- The map is replaced after SCAG's final map and the recorded showing is stale.
- The cited state law requires findings supported by substantial evidence (page 3 recital); whether the map rests on them is outside the screen.
- The Director's map has not been captured or inspected in this branch.

**Cross-reference / exception:**

- Exception: None for the permanent exemption itself. Section 1 has two alternative grounds: A, no walking path of less than one mile to the TOD stop; B, an industrial employment hub, if the City has at least 15 TOD stops.
- GCS 65912.160(e) and 65912.160(f) (not captured): The state authority for Section 1 and for SCAG's TOD maps. Neither is captured.
- The Director's exemption map issued under Sec. 3 (not captured): The record this fact is read from. It has not been captured or inspected, so what a showing looks like on it is not yet known.
- Ordinance 188968 Sec. 4 and the SB 79 temporary-exemption criteria (captured): Separately unresolved and not part of Round 1. This rule neither reads nor resolves them.

**Change from the v2 proposal:** Same outcomes as v2. Round 1 narrows what counts as shown: a parcel described only as “eligible for permanent and temporary exemption” is not shown as exempt, no area-wide or draft layer counts, and the showing must be of permanent exemption.

**Questions for you:**

1. If the Director's issued Sec. 3 map affirmatively shows a parcel as permanently exempt under Section 1, do you agree the SB 79 pathway should return documented_disqualifier?
2. Have you seen the Director's Sec. 3 map? Does it show parcel-level permanent exemptions, or only areas described like the recital's draft map (“eligible for permanent and temporary exemption”)?
3. Do you agree that a record describing a parcel only as “eligible for permanent and temporary exemption”, or the draft map in the page 3 recital, must be recorded as unknown rather than YES?
4. Do you agree that not shown must stay requires_judgment and never clear the pathway?

**REVIEWER DECISION:**

- [ ] APPROVE EXACTLY AS WRITTEN
- [ ] APPROVE WITH EDIT
- [ ] KEEP PENDING
- [ ] REMOVE

**Reviewer note:**

____________________________

## Fact-model corrections recommended first

None of these is made in this branch. Each is the smallest change that makes the rule safe, and each is a recording instruction (how a person fills in an existing fact), not a new fact or value:

- `lot-area`: the recorded area of the whole legal lot as recorded before any subdivision; unknown when the parcel record and the legal lot may differ.
- `shra-zone-category`: `single_family_listed_zone` only for the nine listed zones on a Chapter 1 parcel; unknown for a listed name carrying a variation or number (including R1 Variation Zones) and for Chapter 1A, until you rule.
- `prior-shra-or-sb9-map`: the SHRA and SB 9 values only for the map that created the lot's current boundaries; the clearing values only after the full recorded-map history has been read.
- `very-high-fire-hazard-severity-zone` and `high-fire-hazard-severity-zone`: whole parcel only; partial coverage or an unstated map edition is unknown; for High, a NO only from a map that assigns a High class in the parcel's responsibility area.
- `prime-or-statewide-farmland`, `nccp-conservation-land`, `conservation-easement`: YES only from an affirmative record covering the whole parcel in the memo's own terms (an adopted plan; a recorded conservation easement); a NO never clears.
- `sb79-permanent-exemption-shown`: YES only when the Director's issued Sec. 3 map shows the parcel as permanently exempt under Section 1; unknown for draft, citywide, or unseparated layers and for wording like the recital's draft map.

One label change is recommended for later: `very-high-fire-hazard-severity-zone` has the client label `the property's fire-hazard designation`, which names neither Very High nor the responsibility areas. Changing it changes the fictional fixture's evidence labels, so it belongs in its own reviewed change.

## Open questions that apply across candidates

1. **The SHRA statute is not captured.** The memo summarizes GCS 66499.41 and sends readers to it “for the full SHRA” (page 1). Its page 5 pointer to GCS 66499.41(a)(9) covers “these site limitations as well as any specific conditions or standards”. If that reaches the page 4 list of categories where projects may not be located, the blocking direction of candidates 3 to 7 could carry conditions no captured text shows. Decide whether you accept the memo's two-list structure as enough, or want the statute captured first.
2. **Is the memo still current?** The capture notes say the official host was unreachable, so whether a later City memo replaced it was not checked.
3. **The Director's Sec. 3 map is not captured.** Candidate 8 depends on what that map actually shows.
4. **Measurement near thresholds.** Whether a calculated lot area close to 65,340 sq ft should be a number or unknown.

## Not in this round

- `la_sb79.temporary-exemption-all-parcels` and the other seven SB 79 temporary-exemption criteria: the Sec. 4 reading is unresolved; every one keeps `disqualifying_per_source` out of its ceiling, and a test re-checks that here.
- The other 38 atomic criteria: unchanged and pending.
- `low-rise-draft-2026-09-24`: proposed, not operative; no Round 1 rule or quotation rests on it.

## After your decision

This branch changes no criterion. For each candidate you mark APPROVE EXACTLY AS WRITTEN or APPROVE WITH EDIT, a later branch follows "Converting a criterion" in `docs/PROGRAM_SCREEN_CRITERION_VERIFICATION.md`: it writes the predicate exactly as you accepted it, fills in the criterion's own human-verification record with your name and the date, adds the behavior case, and updates the pinned counts. KEEP PENDING and REMOVE leave the criterion as it is until a separate change.
