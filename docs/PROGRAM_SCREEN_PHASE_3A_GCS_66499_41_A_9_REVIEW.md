# Program Screen Phase 3A: GCS 66499.41(a)(9) capture and re-review preparation

Phase 3A captures the official text of California Government Code § 66499.41 and compares its paragraph (a)(9) with the Round 1 decisions c, d, e, f, and g. It prepares a human re-review. It decides nothing.

- **Nothing is promoted.** `human_verified` = 0 and `pending_human` = 46. No criterion, Round 1 decision, proposal, or outcome ceiling changes.
- **The capture is not an authority.** No issuer, authority source, host exception, fact-policy entry, or verification record is added. A statute capture never supports a criterion rule (Phase 2b, B4).
- **Output is unchanged.** The evaluator and public-demo output hashes are unchanged, and so are the four earlier captures.
- **The trigger fires.** `gcs_66499_41_a_9_captured` now flags exactly c, d, e, f, and g for human re-review (Phase 2b, B8). Nothing else is flagged automatically.

The verdicts below are preparation for the reviewer, not decisions. Tests: `app/tests/program-screen-statute-capture-3a.test.ts`.

## The capture

| Field | Value |
| --- | --- |
| Source ID | `gcs-66499-41` (registered in `expectedOfficialSources` as a capture only) |
| Official URL | `https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?lawCode=GOV&sectionNum=66499.41.` |
| Form | `code_section_page`: the exact HTML the official host served (B1) |
| Response | `HTTP/2 200`, `content-type: text/html; charset=UTF-8`, `date: Mon, 28 Sep 2026 21:46:59 GMT` |
| `retrieved_at` | `2026-09-28T21:46:59Z` (the response `Date` header) |
| `original.html` | 186,734 bytes, SHA-256 `3521eb92f68d966461eb0c7b60ebffad8371b487eff2f014417cd74fc077ec72` |
| `extracted.txt` | SHA-256 `48815c8e2a892ca8e3aa523c6d3237d9c014fc556b3e332e31f0894f5bcf0759` (`program-screen-html-text` 1.0.0, `program-screen-text-v1`, one page) |
| Host basis | `global_allowlist` (`leginfo.legislature.ca.gov`); no host exception |
| Pinned section | heading `66499.41.` (a whole line); pinpoints `(a)` and `(a)(9)` |
| Status | `operative`, resting only on the page's own history note: "(Amended (as amended by Stats. 2024, Ch. 294, Sec. 3) by Stats. 2025, Ch. 22, Sec. 28. (AB 130) Effective June 30, 2025.)" The page prints no "current through" statement. `document_date` is `2025-06-30`, the effective date that note states. |

**Provenance.** The capture environment's network policy refused `leginfo.legislature.ca.gov` (HTTP 403 at the proxy). The capture session did not fall back to any other source. The repository owner downloaded the page with curl from the URL above and uploaded the response body and headers. Before capture, the upload was checked against the owner's pre-upload values: SHA-256 `3521eb92…ec72` and 186,734 bytes. The committed `original.html` is byte-identical to the upload. The page does not echo its own URL, so the URL rests on the download instructions.

**Currency.** The section's history note says AB 130 amended it effective June 30, 2025. The SHRA memo (`shra-2025-10-28`, dated October 28, 2025) names AB 130 (2025) in its title, so the memo and this version of the statute line up in time.

## What § 66499.41(a)(9) says

(a)(9) is not a bare cross-reference. It is the operative list, and its categories and conditions are stated in the section itself. It is one of the requirements a project must meet under the lead-in to (a). Quoted from `extracted.txt`, whitespace-normalized:

```text
(a) A local agency shall ministerially consider, without discretionary review or a hearing, a parcel map or a tentative and final map for a housing development project that meets all of the following requirements:

(9) The lot proposed to be subdivided is not located on a site that is any of the following:

(A) Either prime farmland or farmland of statewide importance, as defined pursuant to United States Department of Agriculture land inventory and monitoring criteria, as modified for California, and designated on the maps prepared by the Farmland Mapping and Monitoring Program of the Department of Conservation, or land zoned or designated for agricultural protection or preservation by a local ballot measure that was approved by the voters of that jurisdiction.

(B) Wetlands, as defined in the United States Fish and Wildlife Service Manual, Part 660 FW 2 (June 21, 1993).

(C) Within a very high fire hazard severity zone, as determined by the Department of Forestry and Fire Protection pursuant to Section 51178, or within a high or very high fire hazard severity zone as indicated on maps adopted by the Department of Forestry and Fire Protection pursuant to Section 4202 of the Public Resources Code.

(D) A hazardous waste site that is listed pursuant to Section 65962.5 or a hazardous waste site designated by the Department of Toxic Substances Control pursuant to former Section 25356 of the Health and Safety Code, unless either of the following applies:

(i) The site is an underground storage tank site that received a uniform closure letter issued pursuant to subdivision (g) of Section 25296.10 of the Health and Safety Code based on closure criteria established by the State Water Resources Control Board for residential use or residential mixed uses. This section does not alter or change the conditions to remove a site from the list of hazardous waste sites listed pursuant to Section 65962.5.

(ii) The State Department of Public Health, State Water Resources Control Board, Department of Toxic Substances Control, or a local agency making a determination pursuant to subdivision (c) of Section 25296.10 of the Health and Safety Code, has otherwise determined that the site is suitable for residential use or residential mixed uses.

(E) Within a delineated earthquake fault zone as determined by the State Geologist in any official maps published by the State Geologist, unless the housing development project complies with applicable seismic protection building code standards adopted by the California Building Standards Commission under the California Building Standards Law (Part 2.5 (commencing with Section 18901) of Division 13 of the Health and Safety Code), and by any local building department under Chapter 12.2 (commencing with Section 8875) of Division 1 of Title 2.

(F) Within a special flood hazard area subject to inundation by the 1-percent annual chance flood (100-year flood) as determined by the Federal Emergency Management Agency in any official maps published by the Federal Emergency Management Agency. If a development proponent is able to satisfy all applicable federal qualifying criteria in order to provide that the site satisfies this paragraph and is otherwise eligible for streamlined approval under this section, a local government shall not deny the application on the basis that the development proponent did not comply with any additional permit requirement, standard, or action adopted by that local government that is applicable to that site. A housing development project may be located on a site described in this subparagraph if either of the following is met:

(i) The site has been subject to a Letter of Map Revision prepared by the Federal Emergency Management Agency and issued to the local jurisdiction.

(ii) The site meets Federal Emergency Management Agency requirements necessary to meet minimum flood plain management criteria of the National Flood Insurance Program pursuant to Part 59 (commencing with Section 59.1) and Part 60 (commencing with Section 60.1) of Subchapter B of Chapter I of Title 44 of the Code of Federal Regulations.

(G) Within a regulatory floodway as determined by the Federal Emergency Management Agency in any official maps published by the Federal Emergency Management Agency, unless the housing development project has received a no-rise certification in accordance with Section 60.3(d)(3) of Title 44 of the Code of Federal Regulations. If a development proponent is able to satisfy all applicable federal qualifying criteria in order to provide that the site satisfies this subparagraph and is otherwise eligible for streamlined approval under this section, a local government shall not deny the application on the basis that the development proponent did not comply with any additional permit requirement, standard, or action adopted by that local government that is applicable to that site.

(H) Land identified for conservation in an adopted natural community conservation plan pursuant to the Natural Community Conservation Planning Act (Chapter 10 (commencing with Section 2800) of Division 3 of the Fish and Game Code), habitat conservation plan pursuant to the federal Endangered Species Act of 1973 (16 U.S.C. Sec. 1531 et seq.), or another adopted natural resource protection plan.

(I) Habitat for protected species identified as candidate, sensitive, or species of special status by state or federal agencies, fully protected species, or species protected by the federal Endangered Species Act of 1973 (16 U.S.C. Sec. 1531 et seq.), the California Endangered Species Act (Chapter 1.5 (commencing with Section 2050) of Division 3 of the Fish and Game Code), or the Native Plant Protection Act (Chapter 10 (commencing with Section 1900) of Division 2 of the Fish and Game Code).

(J) Land under conservation easement.
```

## Findings that apply to every criterion

- **X1. The unit is the lot, not the project.** The statute reads "The lot proposed to be subdivided is not located on a site that is any of the following". The memo reads "SHRA projects may not be located on the following site categories". The Round 1 decisions for c, d, f, and g return unknown for partial coverage "because the memo speaks about where the project is located" and the project footprint is not modeled. The statute's unit is the lot, which is closer to the parcel the screen models. It states no partial-coverage rule, though, so partial coverage stays unknown / requires judgment. No outcome changes. The reason should be restated in the re-review, and no overlap threshold should be invented.
- **X2. The consequence matches the ceilings.** A lot on a listed site fails a requirement of (a), so the map is not entitled to ministerial consideration under (a). That matches `disqualifying_per_source` for the prohibited categories. No outcome ceiling changes.
- **X3. Which categories carry conditions.** (A), (B), (C), (H), (I), and (J) carry no condition. (D), (E), and (G) each carry an "unless" clause, and (F) states when a project "may be located" on the site. This matches the memo's split between its "may not be located" list and its "only ... if applicable conditions or standards have been met" list.
- **X4. The statute names no map edition, date, or dataset for any category.** It names agencies, programs, and statutes. A parcel-level record is still a separate capture and registration step (Phase 2b, B5 and B6).

## Criterion-by-criterion re-review

| | Criterion | Round 1 | Phase 3A verdict |
| --- | --- | --- | --- |
| c | `la_shra.very-high-fire-hazard-severity-zone` | approve_with_revision | ROUND 1 REVISION NEEDED |
| d | `la_shra.high-fire-hazard-severity-zone` | approve_with_revision | ROUND 1 REVISION NEEDED |
| e | `la_shra.prime-or-statewide-farmland` | keep_pending | INSUFFICIENT / OTHER SOURCE STILL NEEDED |
| f | `la_shra.natural-community-conservation-plan-land` | approve_with_revision | CLARIFIED |
| g | `la_shra.conservation-easement` | approve_with_revision | UNCHANGED |

The verdicts mean:

- **UNCHANGED:** the statute neither alters nor sharpens the approved decision.
- **CLARIFIED:** the statute confirms the approved rule and sharpens its basis. No outcome changes.
- **ROUND 1 REVISION NEEDED:** part of the approved decision text must be restated before any promotion.
- **INSUFFICIENT / OTHER SOURCE STILL NEEDED:** the statute does not supply what the decision is waiting for.

None of them changes a status. Every criterion stays `pending_human` with its outcome ceiling.

### c. Very High Fire Hazard Severity Zone: ROUND 1 REVISION NEEDED

The revision is to the evidence standard only. The statute confirms the category and the ceiling.

- **Memo:** "3) High or very high fire hazard severity zones, as referenced in GCS 51178 and Public Resources Code Section 42021." and footnote "1 Please note this includes both state and local responsibility areas."
- **Approved in Round 1:**
  - YES only when "the reviewed authoritative record clearly establishes that the relevant project site is within a Very High Fire Hazard Severity Zone". The whole parcel may block, and partial coverage is unknown.
  - NO only when "the authoritative current map establishes that no part of the parcel is in a Very High zone".
  - "Prefer the current official fire-hazard map/designation from the responsible agency."
  - Footnote 1 is accepted, so the criterion covers both state and local responsibility areas.
- **Statute:** (a)(9)(C), quoted above.

The review questions, answered from the statute:

1. **Unconditional?** Yes. (C) has no "unless" clause or other condition (X3). Very High is reached two ways: "a very high fire hazard severity zone, as determined by the Department of Forestry and Fire Protection pursuant to Section 51178", or "a high or very high fire hazard severity zone as indicated on maps adopted by the Department of Forestry and Fire Protection pursuant to Section 4202 of the Public Resources Code".
2. **A condition, exception, or mitigation Round 1 missed?** None. There is a qualification Round 1 did not have: both routes are tied to the Department of Forestry and Fire Protection and to a named section. The statute's "Section 4202 of the Public Resources Code" confirms the Round 1 page-image reading of the memo's "42021" as § 4202 plus footnote marker 1.
3. **Responsibility areas?** Not addressed. The words "state responsibility area" and "local responsibility area" do not appear in (a)(9). The memo's footnote 1 is neither confirmed nor contradicted by (C)'s words. Tying § 51178 or PRC § 4202 to a responsibility area would need those sections captured.
4. **Partial coverage?** The unit is the lot (X1), and no partial-coverage rule is stated. Partial coverage stays unknown / requires judgment.
5. **Is an authoritative fire map still needed for the parcel fact?** Yes. The statute names the agency and the two statutory bases, but no map, edition, date, or parcel record. The § 51178 route says "as determined", not "as indicated on maps". The captured text does not say what form that determination takes, and this memo does not infer one.

Why a revision is needed:

- **(i) Name the qualifying records.** The phrases "the responsible agency" and "the authoritative current map" should be restated as the statute's two record types: a Department of Forestry and Fire Protection determination under GOV § 51178, and a map adopted by that Department under PRC § 4202. A record that is neither cannot establish YES or NO. That includes a City/ZIMAS display, which Round 1 already limited to corroboration.
- **(ii) NO must clear both routes.** Very High has two statutory routes. A clearing NO needs evidence that the lot is in a Very High zone under neither, or a reviewed, source-backed reason that only one route can apply to the lot. The approved NO names a single map.
- **(iii) Wording.** The YES wording "the relevant project site" should read "the lot proposed to be subdivided" (X1).

### d. High Fire Hazard Severity Zone: ROUND 1 REVISION NEEDED

The revision concerns the scope of the High category.

- **Memo:** the same item 3 and footnote 1.
- **Approved in Round 1:**
  - High only, and never inferred from Very High.
  - Use "the responsible agency’s current official fire-hazard map/designation".
  - YES only when the whole parcel is inside a High zone. Partial coverage is unknown.
  - NO "only if the authoritative map actually uses a High classification for that parcel’s applicable responsibility area".
  - Footnote 1 read as the memo intending "both state and local responsibility areas".
  - The combined-coverage fact is deferred.
- **Statute:** (a)(9)(C).

The review questions, answered from the statute:

1. **Unconditional?** Yes, for High where (C) reaches it (X3).
2. **A qualification Round 1 missed?** Yes. The word "high" appears only in the PRC § 4202 route. The § 51178 route names only "a very high fire hazard severity zone". By its words, (C) reaches a High zone only "as indicated on maps adopted by the Department of Forestry and Fire Protection pursuant to Section 4202 of the Public Resources Code". The memo's summary, "High or very high fire hazard severity zones, as referenced in GCS 51178 and Public Resources Code Section 42021." (§ 4202 plus footnote marker 1), together with footnote 1, reads broader than that for High.
3. **Responsibility areas?** Not addressed (see c). Whether footnote 1 carries High beyond PRC § 4202 maps, and which areas those maps cover, cannot be answered from (a)(9).
4. **Partial coverage?** Same as c. The PRC § 4202 route is worded as one combined class, "a high or very high fire hazard severity zone". That confirms the combined-coverage issue Round 1 deferred. Keep it deferred.
5. **Is an authoritative fire map still needed?** Yes. For High, the statute points only to Department of Forestry and Fire Protection maps adopted under PRC § 4202.

Why a revision is needed:

- **(i) YES comes only from a PRC § 4202 map.** YES must come from a map adopted by the Department of Forestry and Fire Protection under PRC § 4202. By the statute's words, a High class on any other record is not (a)(9)(C) High.
- **(ii) The reviewer decides how the memo's broader reading relates to the statute.** The memo reads High "as referenced in GCS 51178" and footnote 1 carries it to local responsibility areas. The reviewer decides how that relates to the statute's narrower wording. Do not widen the rule on the memo alone, and do not narrow it to a clearing result on the statute alone.
- **(iii) Restate the NO test in the statute's terms.** The approved "applicable responsibility area" test should be restated as whether a PRC § 4202 map covers the lot and assigns it a class. Where none does, the approved rule returns unknown. Keep that until the reviewer decides.

### e. Prime farmland or farmland of statewide importance: INSUFFICIENT / OTHER SOURCE STILL NEEDED

The criterion stays KEEP PENDING. The statute clarifies it but does not supply what the decision is waiting for.

- **Memo:** "1) Prime farmland or farmland of statewide importance;"
- **Round 1:** keep pending. The memo identifies no defining agency, map, dataset, edition, or statutory definition.
- **Statute:** (a)(9)(A).

The review questions, answered from the statute:

- **Does it define the terms?** Only by reference: "as defined pursuant to United States Department of Agriculture land inventory and monitoring criteria, as modified for California". Those criteria are not in the section and are not captured.
- **Does it identify the defining agency, map, or record?** Only at program level: "and designated on the maps prepared by the Farmland Mapping and Monitoring Program of the Department of Conservation". The definition and the designation are joined by "and", so the category is land designated on those maps. The statute names no edition, date, or parcel-level dataset. That supports Round 1's refusal of a ZIMAS field or generic GIS layer.
- **Exceptions or conditions?** None for farmland. The subparagraph also reaches a second category that the memo list omits: "land zoned or designated for agricultural protection or preservation by a local ballot measure that was approved by the voters of that jurisdiction". No criterion models it (gap G1 below).
- **Enough to leave KEEP PENDING?** No. Round 1 set four conditions:
  1. Define the terms: partly met, by reference.
  2. Identify the authoritative parcel-level record: the program is named (Farmland Mapping and Monitoring Program maps), but no parcel-level record is identified.
  3. Say which map edition or date to use: not met.
  4. Say how overlap is treated: not met.
- **Next source:** the Department of Conservation's Farmland Mapping and Monitoring Program map covering the parcel, as an `agency_map` capture with its edition and legend. That is its own reviewed step, not part of Phase 3A.

### f. Natural community conservation plan land: CLARIFIED

- **Memo:** "4) Land identified for conservation in an adopted natural community conservation plan;"
- **Approved in Round 1:**
  - The authoritative record is the adopted plan itself, including its official adopted maps, exhibits, or text.
  - YES only with adoption established, the plan's own identification of the land for conservation, and the whole parcel covered.
  - Interpretation, a draft or expired plan, or unknown status returns unknown.
  - NO never clears.
- **Statute:** (a)(9)(H).

The review questions, answered from the statute:

- **Defines "natural community conservation plan"?** By reference: "an adopted natural community conservation plan pursuant to the Natural Community Conservation Planning Act (Chapter 10 (commencing with Section 2800) of Division 3 of the Fish and Game Code)". This sharpens "adopted natural community conservation plan": it is a plan adopted under that Act.
- **Clarifies "identified for conservation"?** No. The statute uses the memo's words and does not define them. Round 1's rule that interpretation returns unknown stands.
- **Adoption or current-status requirements?** Adoption is required ("adopted"), which matches Round 1. Current status (expiry, amendment, supersession) is not addressed, so Round 1's evidence standard stands.
- **Changes the block-only design?** No. (H) carries no condition. A NO is even less able to clear, because (H) also reaches "habitat conservation plan pursuant to the federal Endangered Species Act of 1973" and "another adopted natural resource protection plan". The memo list omits both, and no criterion models them (gap G2 below). A NO on the NCCP fact says nothing about them.

### g. Conservation easement: UNCHANGED

- **Memo:** "6) Lands under a conservation easement."
- **Approved in Round 1:**
  - Keep the proposition as "lands under a conservation easement", without "recorded".
  - A recorded instrument is a conservative evidence standard for YES.
  - YES requires an in-force easement covering the whole parcel. Release or extinguishment, interpretation, or partial coverage returns unknown.
  - NO never clears.
- **Statute:** (a)(9)(J): "Land under conservation easement."

The review questions, answered from the statute:

- **Defines the easement?** No.
- **Requires recording?** No. The word does not appear, which confirms Round 1's instruction not to rewrite the source rule as "recorded".
- **Partial coverage?** Not addressed. The unit is the lot (X1).
- **Release or extinguishment?** Not addressed.
- **Changes the one-directional, YES-only blocker?** No.

The Round 1 deferred change `conservation_easement_client_label` still applies. The shipped designation reads "land under a recorded conservation easement".

## Other criteria that cite or depend on (a)(9) (Step 5)

Phase 2b limited the trigger to c-g (B8), and these criteria are not modified. As of this capture, the repository ties the following to (a)(9):

| Criterion | Tie today | What (a)(9) now shows | Suggest for a later human-review round? |
| --- | --- | --- | --- |
| `la_shra.hazardous-waste-site` | Exception path "Conditions or standards in GCS 66499.41(a)(9) met (statute not captured)"; memo p. 5 excerpt | (D): the defining lists are "listed pursuant to Section 65962.5" or "designated by the Department of Toxic Substances Control pursuant to former Section 25356" (the memo names LAFD CUPA only as a reference). There are two site-level exceptions: a uniform closure letter for an underground storage tank site, and an agency determination that the site "is suitable for residential use". | Yes |
| `la_shra.special-flood-hazard-area` | Same exception path; memo p. 5 excerpt | (F): FEMA official maps. The project may be located there if the site has a Letter of Map Revision issued to the local jurisdiction, or meets NFIP minimum floodplain management criteria (44 CFR Parts 59-60). The local government may not deny for failing an additional local requirement once the federal criteria are met, which bears on the memo's pointer to the LADBS bulletin. | Yes |
| `la_shra.regulatory-floodway` | Same exception path; memo p. 5 excerpt | (G): FEMA official maps, "unless the housing development project has received a no-rise certification" under 44 CFR 60.3(d)(3), with the same no-additional-local-requirement clause. This condition differs from (F), which answers the proposal's open ambiguity. The certification is a project fact. | Yes |
| `la_shra.earthquake-fault-zone` | Same exception path; memo p. 5 excerpt | (E): "as determined by the State Geologist in any official maps published by the State Geologist" (the proposal presumed Alquist-Priolo; the statute does not use that name). The exception is project-level compliance with seismic building standards, so a mapped zone stays requires_judgment. | Yes |

The same sweep found more ties that nothing cites today:

- **`la_shra.wetlands` ((B)).** The statute defines wetlands "as defined in the United States Fish and Wildlife Service Manual, Part 660 FW 2 (June 21, 1993)". The memo points to the California Department of Fish and Wildlife. Suggest adding it to the same review.
- **`la_shra.protected-species-habitat` ((I)).** The statute lists which species designations count. It stays a professional-judgment criterion. Suggest adding it to the same review.
- **`la_shra.hillside-area` and `la_shra.landslide-area` (removed as `no_rule_in_source`).** (a)(9) lists neither, which is consistent with their removal.
- **G1.** (a)(9)(A)'s ballot-measure agricultural land has no criterion.
- **G2.** (a)(9)(H)'s habitat conservation plans and "another adopted natural resource protection plan" have no criterion.
- **`la_shra.environmental-constraints.json`.** The proposal names (a)(9) in `additional_sources_needed` and in its four restricted components.
- **Round 1 records.** `round-1.json` records (a)(9) as `captured: false`, which is a historical record of the round. Neither file is edited.

The restricted-category exception label still reads "(statute not captured)". Changing it is a criterion change for the next reviewed round.

## Sources (a)(9) names that are not captured

None of these are captured in Phase 3A. Each would be its own reviewed step:

- GOV § 51178 and PRC § 4202 (c, d).
- The Department of Forestry and Fire Protection's map or determination for the parcel (c, d).
- The Department of Conservation's Farmland Mapping and Monitoring Program map and the USDA land inventory and monitoring criteria as modified for California (e).
- The Natural Community Conservation Planning Act, Fish and Game Code § 2800 et seq. (f).
- For the restricted categories:
  - GOV § 65962.5;
  - Health and Safety Code § 25296.10 and former § 25356;
  - the State Geologist's official maps;
  - FEMA's official maps and 44 CFR Parts 59-60 and § 60.3(d)(3).

The chapter heading on the page also lists § 66499.40, which is not captured. Whether it defines any term (a)(9) uses is unknown.

## Invariants (tested)

- `human_verified` = 0 and `pending_human` = 46. Every guarded criterion still has promotion blockers.
- `programAuthorityRegistries.issuers` and `.sources` are empty, every fact policy's `establishing` list is empty, and `sourceHostExceptions` is empty.
- `canSupportCriterionRule` is false for the capture, and `authoritySourceCaptureIssues` refuses it as an authority source.
- No criterion, proposal, or Round 1 record cites `gcs-66499-41`.
- The evaluator output SHA-256 is `2b0c6ea651dfc55191090ab0c6129a8c22692a28bfdce3f046425437e1acecca`, and the public-demo output SHA-256 is `d00a74d195a2749da877775c0204a3435820fd13189f2ae05880b744ab45f57f`. Both are unchanged.
- The four earlier captures are unchanged byte for byte and are still v1.

## Not in Phase 3A

- Any edit to a criterion, Round 1 decision, proposal, or outcome ceiling.
- Any promotion, issuer, authority source, fact-policy entry, or host exception.
- Capturing any other statute, map, or source named above.
- Extending the re-review trigger beyond c-g. Whether the criteria in the Step 5 table join the next round is a separate human decision.
