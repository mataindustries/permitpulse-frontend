# Program Screen criterion verification ledger

Pass date: 2026-09-27
Scope: the nine City of Los Angeles Program Screen criteria that were `pending_human` when the core shipped (PR #15).

## Outcome of this pass

| Result | Criteria |
| --- | --- |
| A. Verified and encoded | **None** |
| B. Still `pending_human` | **All nine** (listed below) |
| C. Removed or narrowed | **None.** Candidates for narrowing are listed below for a human reviewer. |

**Why nothing was verified:** no official source text could be retrieved in the verification environment, and the repository holds none (see the retrieval log). The only reachable tool was a web search. It returns model-written summaries of mostly secondary pages, so it was not used as evidence (`PROJECT_LAWS.md`, laws 7 and 14). No rule was taken from memory or from PermitPulse's own guide prose. Under law 4, a blocked retrieval says nothing about what the sources contain.

## The verification gate added in this pass

A criterion listed in `humanVerificationRequiredCriterionIds` (`app/src/shared/program-screen/types.ts`) runs a rule only when all of the following hold:

1. It is `verification: "human_verified"`. Relabeling it `repo_sourced` fails pack validation.
2. It carries a `human_verification` record:
   - `reviewer`: `{ kind: "human", name, role }`. An AI pass cannot be the reviewer.
   - `verified_at` and `next_review_at`.
   - `source_title`, `source_url` (HTTPS), and `pinpoint`. These must match the criterion `citation` field for field, dates included.
   - `instrument`: the ordinance, statute, or memo identifier.
   - `supporting_excerpt`.
   - `source_capture`: `{ repo_path, retrieved_at, capture_method, sha256, is_ai_generated: false }`.
3. The capture is a plain-text file under `app/fixtures/program-screen/official-sources/`. The excerpt must appear in it (only whitespace is normalized), and the file's SHA-256 must match the record.
4. The criterion has a behavior case in `app/tests/program-screen-verification.test.ts`. The shared runner checks the positive case, the blocking case, missing fact → `unknown`, conflicting sources → `conflict`, unreviewed evidence → `unreviewed`, stale citation → release blocked, rule does not run without the record, and excerpt present in the capture.

If any of these fail, the evaluator treats the criterion as pending: status `unreviewed` with reason `criterion_pending_human`, a `pending_human_criterion` release blocker, and a `verify_criterion_rule` review task. This holds even for callers that skip pack validation.

### Converting a criterion (human reviewer checklist)

1. Download the official document, extract or transcribe its text into `official-sources/<kebab-name>.txt`, and run `sha256sum` on the file.
2. Read the provision and decide: A (encode), B (keep pending), or C (remove or narrow). Stop at B if the text does not clearly support a deterministic predicate.
3. For A:
   - Write the predicate. It returns `consistent_with_source`, `disqualifying_per_source`, or `requires_judgment`, and uses no other logic.
   - Set `human_verified` and fill in the record.
   - Set `basis.repo_path` to the capture path and `basis.excerpts` to the excerpt.
4. Add a `verifiedCases` entry and update the pins:
   - the human-verified list;
   - the executable-predicate list;
   - the pending lists in `program-screen-core.test.ts` and `program-screen-fixture.test.ts`;
   - the public-demo `pending_human_criterion` count.
5. Update the fictional fixture only if the verified rule changes its expected result.

## Per-criterion ledger

Every row's decision is **B: keep `pending_human`**. For every row, the reason is the same: the official text has not been captured or reviewed. The "must establish" column lists questions for the reviewer to answer from the official text. It does not assert what that text says.

### SHRA (as amended by SB 684 / SB 1123; the City memo also covers AB 130)

Official sources named in the repo notes:

- City SHRA page: https://planning.lacity.gov/project-review/shra-senate-bill-684-1123 (filing checklists)
- October 28, 2025 SHRA implementation memo: https://planning.lacity.gov/odocument/1b081b86-f735-43e8-bba6-c2d73a192db7/SB_684_1123_Memo_Update_ACP.pdf
- For the state text, the chaptered bills SB 684, SB 1123, and AB 130 on leginfo.legislature.ca.gov

| Criterion | Facts read | Reviewer must establish | Encoding notes / narrowing candidates |
| --- | --- | --- | --- |
| `la_shra.lot-area-and-zoning` | `lot-area`, `zoning` | Any lot-area threshold (units, inclusive or exclusive), what "pre-subdivision" lot area means, which zones are covered, and whether the vacant single-family path and the other path differ | `zoning` is free text. A zone rule needs a controlled, human-recorded zone-class fact, not string parsing. Likely split into separate lot-area and zoning criteria, per path. |
| `la_shra.existing-structures-and-occupancy` | `existing-structures`, `occupancy-history` | Which existing-structure or occupancy conditions the text treats as blocking, and any look-back period | `occupancy-history` is free text and cannot drive a deterministic rule; it would need a structured fact. Vacancy stays professional judgment (`la_shra.vacant-site-definition`). The `rso-status` fact exists; add it only if the text calls for it. |
| `la_shra.prior-subdivisions` | `prior-subdivisions` | Which prior-subdivision history (type, date, statute) is restricted | A plain yes/no "prior subdivision recorded" may be too coarse. The fact may need restructuring before encoding. |
| `la_shra.housing-element-site-status` | `housing-element-site-status` | Whether and how Housing Element inventory status matters, and which record shows it | Free text. Needs a controlled vocabulary matching the City's displayed status. |
| `la_shra.environmental-constraints` | fire hazard (VHFHSZ), hillside, fault, landslide, flood | Exactly which environmental site conditions the SHRA text lists, and with what exceptions | **Narrowing candidate.** The bundle mixes state-mapped hazards with the City's hillside and landslide designations. The repo notes say only "environmental constraints and access." Keep a designation only if the text names it; split the rest into per-designation criteria. Exceptions would make some of them judgment calls. |

### SB 79 / Phased Implementation (Ordinance 188968)

Official sources named in the repo notes:

- Ordinance 188968, Sections 1–6: https://cityclerk.lacity.org/onlinedocs/2025/25-1083-S4_ord_188968_06-30-26.pdf
- City SB 79 hub: https://planning.lacity.gov/resources/senate-bill-sb-79
- June 2026 adoption maps (linked from the SB 79 guide)
- For the state text, SB 79 (2025) on leginfo

| Criterion | Facts read | Reviewer must establish | Encoding notes |
| --- | --- | --- | --- |
| `la_sb79.permanent-exclusion` | `sb79-permanent-exclusion` | The excluded categories, the legal effect of an exclusion on this pathway, and which record authoritatively shows it for a parcel | Even if "shown" is verified as blocking, "not shown" must not become consistent unless the text and record make absence meaningful. Otherwise it is judgment. |
| `la_sb79.temporary-exemption` | `sb79-temporary-exemption` | Which parcels are exempt, the effect during the exemption period, and the exact end condition (the repo notes tie it to the next Housing Element revision) | The rule is time-bounded, so its end condition must be a verified, dated fact. A yes/no fact is not enough. |
| `la_sb79.site-and-overlay-standards` | `zoning`, `specific-plan-area`, `hpoz`, `existing-dwelling-units` | Zoning applicability, overlay treatment, and existing-housing restrictions | **Narrowing candidate:** split into zoning, overlay, and existing-housing criteria. Transit tiers are not encodable: there is no reviewed transit-stop fact, and ZIMAS tier and category fields stay observation-only. |

### Low-Rise / MIIP (Ordinance 188967)

Official source named in the repo notes: Ordinance 188967, Sections 3–9 (geographic, project, and affordability criteria in 5–9): https://cityclerk.lacity.org/onlinedocs/2025/25-1083-S3_ord_188967_06-30-26.pdf

| Criterion | Facts read | Reviewer must establish | Encoding notes |
| --- | --- | --- | --- |
| `la_low_rise.geographic-criteria` | `zoning`, `general-plan-land-use`, `specific-plan-area` | Geographic applicability, covered zones and General Plan designations, Specific Plan treatment, Chapter 1 vs Chapter 1A treatment, and any exclusions | Free-text zoning and land-use facts need controlled vocabularies. `zoning-code-chapter` is not read yet; add it only if the ordinance distinguishes chapters. |

### Additional official document (not opened)

A web search on 2026-09-27 surfaced a City Planning Commission report on these ordinances: https://planning.lacity.gov/odocument/2b757bb9-c175-4870-bbf0-42af19217060/CPC-2026-1798_DL.pdf. It was not opened (host blocked) and is not evidence.

## Not in scope, but flagged

- **Repo-sourced criteria rest on PermitPulse's own guide prose, not captured official text.** These are:
  - `la_shra.implementation-memo-scope`, which runs a predicate;
  - `la_shra.vacant-site-definition` and `la_low_rise.overlay-review` (judgment criteria);
  - the parcel-match and jurisdiction anchors.

  A human should re-verify them against captured text and convert them to `human_verified`.
- **Wording concern.** In the fixture, the fire-hazard conflict makes SHRA "contested" through the unverified environmental-constraints bundle. The pathway statement says sources disagree on "a fact this pathway depends on." That presumes fire hazard matters for SHRA before anyone has verified it.
- **ZIMAS program fields are unchanged.** They are observations only and are never criterion inputs.

## Retrieval log

| Date | Method | Hosts | Result |
| --- | --- | --- | --- |
| 2026-09-27 | HTTPS through the environment proxy (curl) | cityclerk.lacity.org, planning.lacity.gov, leginfo.legislature.ca.gov, lacity.gov, clkrep.lacity.org, www.hcd.ca.gov | CONNECT rejected by the environment egress policy (403). Re-probed later the same day: still rejected. |
| 2026-09-27 | Web fetch tool | cityclerk.lacity.org, planning.lacity.gov, leginfo.legislature.ca.gov | EGRESS_BLOCKED |
