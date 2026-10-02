# PermitPulse Program Screen Phase 3I: c production evidence

Phase 3I connects the existing private stored-case evaluator to both of criterion c's statutory routes and requires one verified normalized lot geometry for combining their negatives. It adds no HTTP/admin entry point, UI, ingestion API, Worker binding, deployment configuration, authority source, capture, package, registry, index pin, or criterion promotion.

## Baseline and commits

The baseline is `3c161e39be4881a94c23ad6f499088b3cb4ab3ac`, the PR #31 merge, with c-promotion head `f1f988d` in its history. The clean baseline passed 20 Program Screen files / 1,253 tests with GDAL 3.10.3 and GEOS 3.13.1.

Commit A is `10878a263beab1fe8f5cd190f83f1088ad84a525` (`fix(program-screen): require shared lot geometry for route negatives`). Its complete gate and independently committed-tree rerun both passed 21 files / 1,261 tests. Part A also passed 3 focused files / 155 tests and typecheck. Commit B is `feat(program-screen): compute c evidence from one reviewed lot snapshot` on `program-screen-phase-3i-c-production-evidence`; its verification is recorded below.

The prior Phase 3G NO/NO row used different verified geometry SHAs. The owner explicitly authorized superseding that one row after independent adjudication. Its two YES rows and fixtures remain intact. The Phase 3H mismatched-lot finding is likewise retained with its Phase 3I expectation. The geometry shortfall now produces a complete review task even when every route's authority is independently established; it does not ask for authority that is already present.

## Why production c previously stayed unknown

Although c was promoted in Phase 3H, production supplied only the computed High record for d, from PRC §4202. The LRA loader existed separately, and caller hazard-map authority was stripped at the stored-case boundary. There were no server-computed Very High observations or authority blocks for c. Qualifying geometry alone could therefore not establish c through that boundary.

The stored-case evaluator now appends the existing High observation for PRC §4202, followed by Very High observations for GOV §51178 and PRC §4202. It uses the existing `very-high-fire-hazard-severity-zone` fact. Known booleans are source observations; unavailable or indeterminate values remain not observed / unknown. Caller observations continue participating in Layer 1, including legitimate conflicts. Every caller hazard-map authority block is stripped, and every caller ID starting `computed-calfire-` is refused.

## One reviewed-lot snapshot

`loadReviewedLotSnapshot` reads the current review once and calls the unchanged `verifyReviewedLotEvidence` once. The verified record, its nested metadata, and the snapshot are frozen; the normalized geometry retains its existing verified, frozen identity. A missing or unverifiable review yields an unavailable snapshot.

`computeRouteOverlay` receives that snapshot. It reads no review and performs no revision-current check. Each route independently preserves the existing checks for package identity, supersession, edition, index pins, raw index bytes, CRS, layer, semantic field and labels, candidate records, native validity/readability, and legal-lot identity. Dataset failures are contained to that route.

`loadCaseHazardOverlays` computes both routes and performs exactly one final `revisionIsCurrent(snapshot.revision)` check after both computations. If the review changed, both results become unavailable and c and d stay unknown. Each loaded result must reference the exact snapshot geometry object (`===`); a violation makes both overlays unavailable. Route-specific reads cannot produce cross-review evidence.

The shared evaluator receives the verified dataset views that loaded successfully and exactly one snapshot geometry. The geometry is retained even if both datasets fail; the overlay context is omitted only when the snapshot is unavailable. The compatible `overlay` return field remains the PRC §4202 result, and `route_overlays` exposes the GOV §51178 and PRC §4202 results. The existing standalone SRA/LRA loaders retain their signatures and result meaning, using snapshot → route computation → one revision check.

Registered source metadata supplies each computed authority block. PRC §4202 uses `calfire-sra-fhsz-2023-09-29`; GOV §51178 uses `calfire-lra-fhsz-2025-03-24-v1`. Each block names the registered dataset and the snapshot's normalized file ID/SHA. Very High qualifiers preserve the prescribed statutory basis, named agency, legend derivation, responsibility-area context, and adoption status. `map_covers_lot` remains `not_established`; the authority gate independently recomputes coverage.

There is no runtime reprojection. The normalization profile, reviewed-lot verification, case-evidence adapter, `computeLotOverlay`, whole-lot rules, no-threshold semantics, and native validity profiles are unchanged.

## Cross-route identity and class semantics

For each independently established negative route, the shared gate resolves the verified geometry named by each establishing record and collects its normalized content SHA-256. A combined NO requires a nonempty intersection across all required routes. With independently established routes but no shared SHA, c is unknown with exactly `statutory_routes_lot_geometry_not_shared` for the Very High fact.

Equality uses the SHA from the verified, frozen `ReviewedLotGeometry`, never an authority block's unsupported SHA assertion. A file ID is only used to resolve the named verified object; it is not cross-route identity. Different file IDs with identical verified bytes may combine. Identical file IDs with different verified bytes may not combine. APNs, parcel identifiers, legal-lot-reference text, coverage prose, and caller assertions do not establish cross-route equality.

Either independently qualifying YES remains sufficient, even when another route names a different geometry. The shared-geometry check applies only to the multi-route negative combination. Single-route d remains unaffected.

The worker returns Very High TRUE only for whole-lot coverage by exclusively Very High classes with `parcel_is_one_legal_lot`. It returns FALSE only when every covering class is recognized and none is Very High. High, Moderate, and LRA NonWildland are recognized non-Very-High values. NonWildland retains that meaning; it is not translated to Moderate or to absence of fire/wildfire hazard. Mixed Very High/other classes, partial or outside coverage, missing/invalid/unreadable relevant geometry, and unestablished legal identity yield null. The independent authority-gate parity tests cover both possible route values.

For production-computed observations without contradictory caller observations:

| Reviewed route inputs | Before Phase 3I: c | After Phase 3I: c |
| --- | --- | --- |
| PRC whole-lot Very High; GOV unknown | unknown | disqualifying_per_source |
| GOV whole-lot Very High; PRC unknown | unknown | disqualifying_per_source |
| Both complete recognized non-VH, same snapshot | unknown | consistent_with_source |
| One NO, other outside/partial/missing/invalid/unreadable | unknown | unknown |
| Mixed Very High/other classes, no independent YES | unknown | unknown |
| Legal-lot identity not_established | unknown | unknown |
| Review revision changes after computation | unknown | unknown; both routes unavailable |

Direct shared evaluation also keeps mismatched-geometry NO/NO unknown, while same-content NO/NO may combine. A source failure on either route does not cancel the other route's qualifying YES.

## d preservation and protected state

Before editing, the original 3F/3H stored-case scenarios were run against the untouched baseline with TEST-ONLY observation hooks. Their exact `JSON.stringify` bytes were saved, without canonical sorting: 66 scenarios, 92 projections, and 18 distinct snapshots. The Phase 3I test file re-runs those existing scenarios and compares the computed High record, raw High authority block, complete d criterion, status, and authority result to those bytes. The fixture is explicitly TEST-ONLY and includes its baseline commit and hashes. All comparisons pass. Additional tests prove that missing LRA indexes/records and thrown LRA source errors preserve d's bytes and do not cancel PRC's c YES.

c and d criterion objects, rule summaries, citations, permitted outcomes, statutory routes, and human-verification records remain unchanged. c retains verification/review dates 2026-10-01 / 2026-10-31 and decision reference `{ phase: "3B", letter: "c" }`; d retains dates 2026-09-29 / 2026-10-29. e/f/g, outcome ceilings, G1/G2, issuer/authority registries, fact policies, Phase 3D/3G authority packages, Phase 3H SRA validity profile, index pins, captures, and manifests remain byte-identical to the baseline. `PROGRAM_SCREEN_CRITERION_VERIFICATION.md` is untouched.

Counts remain human_verified **2**, pending_human **44**, unencoded rules **34**, and pending_human_criterion release blockers **44**. G1 and G2 remain open.

| as_of | Evaluator SHA-256 | Public-demo SHA-256 |
| --- | --- | --- |
| 2026-09-27 | `1341fea59e307fed23ec1cd32fcdb2467d0fa3519bd07dd134fa9ddfee6deaad` | `23aaee06e51b42a4c1001d6253504f2f932d591315af468ada21345d888a5070` |
| 2026-10-01 | `be57c1bf0f9c4c615375eb0c02d48fe9dd37fcd2afda4eb67cb20f99c98544cb` | `2a777f2da9b489f8731c933b04d83620230485df58c479a7b2bcb7981f9a369e` |

## Verification

All gates pass on the implementation tree with the corrected matrix of all 16 existing TEST-ONLY lot files on both routes. The native global setups use `PP_SRA_PYTHON` and `PP_LRA_PYTHON` from the GDAL 3.10.3 / GEOS 3.13.1 environment, with its `PROJ_DATA` / `GDAL_DATA`. No native validity test is skipped, disabled, weakened, or replaced.

| Gate | Exact result |
| --- | --- |
| Focused Phase 3I | 1 file / 337 tests passed (239 existing replayed tests plus 98 Phase 3I tests) |
| Focused Phase 3H c promotion, re-audit, SRA validity | 3 files / 215 tests passed |
| Complete Program Screen | 21 files / 1,590 tests passed |
| Full app | 49 files / 2,014 tests passed |
| Capture verification | 16 captures verified |
| Capture tool self-test | 61 checks passed |
| Typecheck | `tsc --noEmit` passed |
| Production build | Worker and client builds passed |
| OS verification | Safe areas, responsive shell, reduced motion, visual constraints passed |
| Repository root verification | Syntax checks passed; public-site validation PASS 351 / FAIL 0 |
| Baseline d bytes | All 66 scenarios / 92 projections passed |
| Criteria/human records, four fixture hashes, counts, protected files | Unchanged |

The build retains the existing large-client-chunk advisory; the local Worker tools retain their existing missing-secret warning while the test configuration supplies its test binding. Neither prevents successful verification. No deployment is performed.

## Required mutations

Every mutation is applied alone to a disposable `/tmp` repository copy. The implementation checkout is never mutated. The real native global setups run with GDAL 3.10.3 / GEOS 3.13.1; the warm watch runner retains their verified inputs across reruns. Synthetic indexes and validity verdicts use the existing TEST-ONLY pin path and never replace a native validity test. Each mutation is counted only for actual test assertion failures, followed by restoration to all 337 tests green before the next mutation. Syntax, transform, or tool errors are not counted.

| ID | Mutation | Failed tests | Assertion failures that kill it | Restored green |
| --- | --- | ---: | ---: | --- |
| M1 | Remove the shared-geometry check | 4 | 4 | 337 / 337 |
| M2 | Compare route geometry by file_id instead of verified SHA | 2 | 2 | 337 / 337 |
| M3 | Use route-SHA union instead of intersection | 4 | 4 | 337 / 337 |
| M4 | Read a second review snapshot for LRA | 53 | 41 | 337 / 337 |
| M5 | Remove the combined final revision-current check | 7 | 7 | 337 / 337 |
| M6 | Allow VH TRUE for mixed labels | 6 | 6 | 337 / 337 |
| M7 | Allow VH on part_of_lot | 7 | 7 | 337 / 337 |
| M8 | Allow VH without parcel_is_one_legal_lot | 5 | 5 | 337 / 337 |
| M9 | Stop stripping caller hazard-map authority | 13 | 13 | 337 / 337 |
| M10 | Swap computed statutory-route tags | 13 | 13 | 337 / 337 |
| M11 | Poison SRA/d on an LRA source failure | 19 | 17 | 337 / 337 |
| M12 | Append the LRA geometry as a second context entry | 2 | 2 | 337 / 337 |
| M13 | Treat NonWildland as unknown rather than recognized non-VH | 2 | 2 | 337 / 337 |
| M14 | Reuse the computed High value for the Very High observation | 40 | 40 | 337 / 337 |

M4 also produces 12 secondary TypeErrors after its geometry-object guard makes formerly available results unavailable. M11 also produces 2 secondary TypeErrors after an LRA failure removes the SRA result. These errors are not counted as mutation kills. Every listed mutation has actual AssertionError failures; there are no syntax, transform, or tool errors counted as kills.

### M1: exact failing tests

4 failed tests; 4 include test assertion failures. The restored run passes all 337 tests.

- **AssertionError**: `Re-audit 6: combined two-route truth table (shipped registries, ONE reviewed lot) Phase 3I invariant: the shared evaluator requires both routes' negative records to rest on the same verified lot geometry`
- **AssertionError**: `Phase 3I verified content identity across statutory-route negatives Route 1 NO lot A / Route 2 NO lot B stays unknown`
- **AssertionError**: `Phase 3I verified content identity across statutory-route negatives the same file_id with different verified bytes cannot combine`
- **AssertionError**: `Phase 3I verified content identity across statutory-route negatives names the shared-geometry shortfall in a complete review task without inventing missing route authority`

### M2: exact failing tests

2 failed tests; 2 include test assertion failures. The restored run passes all 337 tests.

- **AssertionError**: `Phase 3I verified content identity across statutory-route negatives the same file_id with different verified bytes cannot combine`
- **AssertionError**: `Phase 3I verified content identity across statutory-route negatives different file_ids with identical verified normalized bytes combine`

### M3: exact failing tests

4 failed tests; 4 include test assertion failures. The restored run passes all 337 tests.

- **AssertionError**: `Re-audit 6: combined two-route truth table (shipped registries, ONE reviewed lot) Phase 3I invariant: the shared evaluator requires both routes' negative records to rest on the same verified lot geometry`
- **AssertionError**: `Phase 3I verified content identity across statutory-route negatives Route 1 NO lot A / Route 2 NO lot B stays unknown`
- **AssertionError**: `Phase 3I verified content identity across statutory-route negatives the same file_id with different verified bytes cannot combine`
- **AssertionError**: `Phase 3I verified content identity across statutory-route negatives names the shared-geometry shortfall in a complete review task without inventing missing route authority`

### M4: exact failing tests

53 failed tests; 41 include test assertion failures. The restored run passes all 337 tests.

- **AssertionError**: `Re-audit 6: combined two-route truth table (shipped registries, ONE reviewed lot) Phase 3I invariant: the shared evaluator requires both routes' negative records to rest on the same verified lot geometry`
- **AssertionError**: `Re-audit 7: production-input path the same private reviewed EPSG:3310 lot feeds both route loaders; SRA is computed, LRA fails closed when candidates are unavailable`
- **AssertionError**: `Re-audit 7: production-input path production evaluation supplies reviewed-snapshot route evidence and strips caller hazard blocks while retaining conflicts`
- **AssertionError**: `Re-audit 7: production-input path a caller-supplied hazard block cannot fill the production gap (the worker strips it; shown on d, the only runnable hazard criterion)`
- **AssertionError**: `Phase 3H private production-input boundary loads each shipped dataset against the identical private reviewed EPSG:3310 lot`
- **AssertionError**: `Phase 3H private production-input boundary production evaluator computes both c routes; manual authority cannot establish c and observations retain conflicts`
- **AssertionError**: `Phase 3H private production-input boundary private SRA inputs yield unknown for missing-validity`
- **AssertionError**: `Phase 3H private production-input boundary private SRA inputs yield unknown for validity-hash-mismatch`
- **AssertionError**: `Phase 3H private production-input boundary private SRA inputs yield unknown for geometry-mutation`
- **AssertionError**: `Phase 3I production evidence from one reviewed snapshot whole-lot Very High on GOV §51178 independently establishes c while PRC is unknown`
- **AssertionError**: `Phase 3I production evidence from one reviewed snapshot complete non-VH coverage on both routes clears c with LRA High on the same snapshot`
- **AssertionError**: `Phase 3I production evidence from one reviewed snapshot complete non-VH coverage on both routes clears c with LRA Moderate on the same snapshot`
- **AssertionError**: `Phase 3I production evidence from one reviewed snapshot complete non-VH coverage on both routes clears c with LRA NonWildland on the same snapshot`
- **AssertionError**: `Phase 3I production evidence from one reviewed snapshot gov_51178 NO plus the other route's outside stays unknown`
- **AssertionError**: `Phase 3I production evidence from one reviewed snapshot gov_51178 NO plus the other route's partial stays unknown`
- **AssertionError**: `Phase 3I production evidence from one reviewed snapshot gov_51178 NO plus the other route's missing index stays unknown`
- **AssertionError**: `Phase 3I production evidence from one reviewed snapshot gov_51178 NO plus the other route's invalid relevant feature stays unknown`
- **AssertionError**: `Phase 3I production evidence from one reviewed snapshot gov_51178 NO plus the other route's unreadable relevant feature stays unknown`
- **AssertionError**: `Phase 3I production evidence from one reviewed snapshot gov_51178 NO plus the other route's missing relevant feature stays unknown`
- **AssertionError**: `Phase 3I production evidence from one reviewed snapshot prc_4202 NO plus the other route's outside stays unknown`
- **AssertionError**: `Phase 3I production evidence from one reviewed snapshot prc_4202 NO plus the other route's partial stays unknown`
- **AssertionError**: `Phase 3I production evidence from one reviewed snapshot prc_4202 NO plus the other route's invalid relevant feature stays unknown`
- **AssertionError**: `Phase 3I production evidence from one reviewed snapshot prc_4202 NO plus the other route's unreadable relevant feature stays unknown`
- **AssertionError**: `Phase 3I production evidence from one reviewed snapshot prc_4202 NO plus the other route's missing relevant feature stays unknown`
- **AssertionError**: `Phase 3I production evidence from one reviewed snapshot whole-lot VH on both routes cannot establish without reviewed one-legal-lot identity`
- **AssertionError**: `Phase 3I production evidence from one reviewed snapshot LRA missing index preserves every d byte and PRC's independent c YES`
- **AssertionError**: `Phase 3I production evidence from one reviewed snapshot LRA missing record preserves every d byte and PRC's independent c YES`
- **AssertionError**: `Phase 3I production evidence from one reviewed snapshot LRA source throws preserves every d byte and PRC's independent c YES`
- **AssertionError**: `Phase 3I production evidence from one reviewed snapshot reads and verifies once, checks revision once after both routes, and supplies exactly one geometry object to all blocks`
- **AssertionError**: `Phase 3I production evidence from one reviewed snapshot never reads review B from a store that would return A then B`
- **AssertionError**: `Phase 3I real private R2 adapter ingests pinned native SRA (and LRA=false), then establishes PRC Very High through openProgramScreenCaseStore`
- **AssertionError**: `Phase 3I real private R2 adapter ingests pinned native SRA (and LRA=true), then establishes PRC Very High through openProgramScreenCaseStore`
- **TypeError**: `Phase 3I caller authority and route boundaries strips caller gov_51178 VH=true authority with matching geometry=true`
- **TypeError**: `Phase 3I caller authority and route boundaries strips caller gov_51178 VH=true authority with matching geometry=false`
- **TypeError**: `Phase 3I caller authority and route boundaries strips caller gov_51178 VH=false authority with matching geometry=true`
- **TypeError**: `Phase 3I caller authority and route boundaries strips caller gov_51178 VH=false authority with matching geometry=false`
- **TypeError**: `Phase 3I caller authority and route boundaries strips caller prc_4202 VH=true authority with matching geometry=true`
- **TypeError**: `Phase 3I caller authority and route boundaries strips caller prc_4202 VH=true authority with matching geometry=false`
- **TypeError**: `Phase 3I caller authority and route boundaries strips caller prc_4202 VH=false authority with matching geometry=true`
- **TypeError**: `Phase 3I caller authority and route boundaries strips caller prc_4202 VH=false authority with matching geometry=false`
- **TypeError**: `Phase 3I caller authority and route boundaries retains a legitimate Layer 1 conflict from a caller YES on gov_51178 against computed non-VH`
- **TypeError**: `Phase 3I caller authority and route boundaries retains a legitimate Layer 1 conflict from a caller YES on prc_4202 against computed non-VH`
- **TypeError**: `Phase 3I caller authority and route boundaries computed authority uses only registered package metadata and the prescribed route qualifiers`
- **AssertionError**: `Phase 3I whole-lot class and worker/gate parity gov_51178 whole Very High has computed VH=[object Object] and matches the independent gate`
- **AssertionError**: `Phase 3I whole-lot class and worker/gate parity gov_51178 whole High has computed VH=[object Object] and matches the independent gate`
- **AssertionError**: `Phase 3I whole-lot class and worker/gate parity gov_51178 whole Moderate has computed VH=[object Object] and matches the independent gate`
- **AssertionError**: `Phase 3I whole-lot class and worker/gate parity gov_51178 mixed High/Moderate has computed VH=[object Object],[object Object] and matches the independent gate`
- **AssertionError**: `Phase 3I whole-lot class and worker/gate parity prc_4202 whole Very High has computed VH=[object Object] and matches the independent gate`
- **AssertionError**: `Phase 3I whole-lot class and worker/gate parity prc_4202 whole High has computed VH=[object Object] and matches the independent gate`
- **AssertionError**: `Phase 3I whole-lot class and worker/gate parity prc_4202 whole Moderate has computed VH=[object Object] and matches the independent gate`
- **AssertionError**: `Phase 3I whole-lot class and worker/gate parity prc_4202 mixed High/Moderate has computed VH=[object Object],[object Object] and matches the independent gate`
- **AssertionError**: `Phase 3I whole-lot class and worker/gate parity LRA NonWildland has only the recognized Very High meaning`
- **TypeError**: `Phase 3I whole-lot class and worker/gate parity native invalid SRA record 10977 leaves c unknown unless the other route gives YES=true`

### M5: exact failing tests

7 failed tests; 7 include test assertion failures. The restored run passes all 337 tests.

- **AssertionError**: `Phase 3F production case evidence ingestion and overlay refuses another case's manifest or a changed revision`
- **AssertionError**: `Re-audit 7: production-input path private inputs fail closed: changed-revision`
- **AssertionError**: `Phase 3H private production-input boundary private inputs fail closed for changed-review`
- **AssertionError**: `Phase 3I production evidence from one reviewed snapshot reads and verifies once, checks revision once after both routes, and supplies exactly one geometry object to all blocks`
- **AssertionError**: `Phase 3I production evidence from one reviewed snapshot a revision change after both route computations makes c and d unknown and both routes unavailable`
- **AssertionError**: `Phase 3I real private R2 adapter ingests pinned native SRA (and LRA=false), then establishes PRC Very High through openProgramScreenCaseStore`
- **AssertionError**: `Phase 3I real private R2 adapter ingests pinned native SRA (and LRA=true), then establishes PRC Very High through openProgramScreenCaseStore`

### M6: exact failing tests

6 failed tests; 6 include test assertion failures. The restored run passes all 337 tests.

- **AssertionError**: `Phase 3I whole-lot class and worker/gate parity gov_51178 mixed Very High/High has computed VH=[object Object],[object Object] and matches the independent gate`
- **AssertionError**: `Phase 3I whole-lot class and worker/gate parity gov_51178 mixed Very High/Moderate has computed VH=[object Object],[object Object] and matches the independent gate`
- **AssertionError**: `Phase 3I whole-lot class and worker/gate parity prc_4202 mixed Very High/High has computed VH=[object Object],[object Object] and matches the independent gate`
- **AssertionError**: `Phase 3I whole-lot class and worker/gate parity prc_4202 mixed Very High/Moderate has computed VH=[object Object],[object Object] and matches the independent gate`
- **AssertionError**: `Phase 3I whole-lot class and worker/gate parity LRA Very High/NonWildland has only the recognized Very High meaning`
- **AssertionError**: `Phase 3I whole-lot class and worker/gate parity every existing TEST-ONLY native lot high-very-high has worker/gate parity on both routes`

### M7: exact failing tests

7 failed tests; 7 include test assertion failures. The restored run passes all 337 tests.

- **AssertionError**: `Phase 3I production evidence from one reviewed snapshot gov_51178 NO plus the other route's partial stays unknown`
- **AssertionError**: `Phase 3I production evidence from one reviewed snapshot prc_4202 NO plus the other route's partial stays unknown`
- **AssertionError**: `Phase 3I whole-lot class and worker/gate parity gov_51178 partial Very High has computed VH=[object Object] and matches the independent gate`
- **AssertionError**: `Phase 3I whole-lot class and worker/gate parity prc_4202 partial Very High has computed VH=[object Object] and matches the independent gate`
- **AssertionError**: `Phase 3I whole-lot class and worker/gate parity every existing TEST-ONLY native lot part-high-outside-sra has worker/gate parity on both routes`
- **AssertionError**: `Phase 3I whole-lot class and worker/gate parity every existing TEST-ONLY native lot part-moderate-outside-sra has worker/gate parity on both routes`
- **AssertionError**: `Phase 3I whole-lot class and worker/gate parity every existing TEST-ONLY native lot phase-3f-normalized-partial has worker/gate parity on both routes`

### M8: exact failing tests

5 failed tests; 5 include test assertion failures. The restored run passes all 337 tests.

- **AssertionError**: `Phase 3I production evidence from one reviewed snapshot whole-lot VH on both routes cannot establish without reviewed one-legal-lot identity`
- **AssertionError**: `Phase 3I caller authority and route boundaries strips caller gov_51178 VH=false authority with matching geometry=true`
- **AssertionError**: `Phase 3I caller authority and route boundaries strips caller gov_51178 VH=false authority with matching geometry=false`
- **AssertionError**: `Phase 3I caller authority and route boundaries strips caller prc_4202 VH=false authority with matching geometry=true`
- **AssertionError**: `Phase 3I caller authority and route boundaries strips caller prc_4202 VH=false authority with matching geometry=false`

### M9: exact failing tests

13 failed tests; 13 include test assertion failures. The restored run passes all 337 tests.

- **AssertionError**: `Phase 3F production case evidence ingestion and overlay ignores caller hazard authority and map_covers_lot=yes when stored legal identity is not established`
- **AssertionError**: `Phase 3F production case evidence ingestion and overlay ignores caller hazard authority and map_covers_lot=no when stored legal identity is not established`
- **AssertionError**: `Re-audit 7: production-input path a caller-supplied hazard block cannot fill the production gap (the worker strips it; shown on d, the only runnable hazard criterion)`
- **AssertionError**: `Phase 3I caller authority and route boundaries strips caller gov_51178 VH=true authority with matching geometry=true`
- **AssertionError**: `Phase 3I caller authority and route boundaries strips caller gov_51178 VH=true authority with matching geometry=false`
- **AssertionError**: `Phase 3I caller authority and route boundaries strips caller gov_51178 VH=false authority with matching geometry=true`
- **AssertionError**: `Phase 3I caller authority and route boundaries strips caller gov_51178 VH=false authority with matching geometry=false`
- **AssertionError**: `Phase 3I caller authority and route boundaries strips caller prc_4202 VH=true authority with matching geometry=true`
- **AssertionError**: `Phase 3I caller authority and route boundaries strips caller prc_4202 VH=true authority with matching geometry=false`
- **AssertionError**: `Phase 3I caller authority and route boundaries strips caller prc_4202 VH=false authority with matching geometry=true`
- **AssertionError**: `Phase 3I caller authority and route boundaries strips caller prc_4202 VH=false authority with matching geometry=false`
- **AssertionError**: `Phase 3I caller authority and route boundaries retains a legitimate Layer 1 conflict from a caller YES on gov_51178 against computed non-VH`
- **AssertionError**: `Phase 3I caller authority and route boundaries retains a legitimate Layer 1 conflict from a caller YES on prc_4202 against computed non-VH`

### M10: exact failing tests

13 failed tests; 13 include test assertion failures. The restored run passes all 337 tests.

- **AssertionError**: `Phase 3I production evidence from one reviewed snapshot whole-lot Very High on PRC §4202 establishes c through the in-memory production store`
- **AssertionError**: `Phase 3I production evidence from one reviewed snapshot whole-lot Very High on GOV §51178 independently establishes c while PRC is unknown`
- **AssertionError**: `Phase 3I production evidence from one reviewed snapshot complete non-VH coverage on both routes clears c with LRA High on the same snapshot`
- **AssertionError**: `Phase 3I production evidence from one reviewed snapshot complete non-VH coverage on both routes clears c with LRA Moderate on the same snapshot`
- **AssertionError**: `Phase 3I production evidence from one reviewed snapshot complete non-VH coverage on both routes clears c with LRA NonWildland on the same snapshot`
- **AssertionError**: `Phase 3I production evidence from one reviewed snapshot LRA missing index preserves every d byte and PRC's independent c YES`
- **AssertionError**: `Phase 3I production evidence from one reviewed snapshot LRA missing record preserves every d byte and PRC's independent c YES`
- **AssertionError**: `Phase 3I production evidence from one reviewed snapshot LRA source throws preserves every d byte and PRC's independent c YES`
- **AssertionError**: `Phase 3I production evidence from one reviewed snapshot never reads review B from a store that would return A then B`
- **AssertionError**: `Phase 3I real private R2 adapter ingests pinned native SRA (and LRA=false), then establishes PRC Very High through openProgramScreenCaseStore`
- **AssertionError**: `Phase 3I real private R2 adapter ingests pinned native SRA (and LRA=true), then establishes PRC Very High through openProgramScreenCaseStore`
- **AssertionError**: `Phase 3I caller authority and route boundaries computed authority uses only registered package metadata and the prescribed route qualifiers`
- **AssertionError**: `Phase 3I whole-lot class and worker/gate parity native invalid SRA record 10977 leaves c unknown unless the other route gives YES=true`

### M11: exact failing tests

19 failed tests; 17 include test assertion failures. The restored run passes all 337 tests.

- **AssertionError**: `Phase 3F production case evidence ingestion and overlay keeps the Vidor-equivalent unknown even with real CAL FIRE whole-High coverage and valid offline-normalized geometry`
- **AssertionError**: `Phase 3F production case evidence ingestion and overlay accepts separately hashed receipts with different valid timestamps and identical normalized geometry`
- **AssertionError**: `Phase 3F production case evidence ingestion and overlay refuses changed CAL FIRE record bytes`
- **AssertionError**: `Phase 3F production case evidence ingestion and overlay refuses a changed raw CAL FIRE index even when a decoder would erase the byte change`
- **AssertionError**: `Phase 3F production case evidence ingestion and overlay fails closed on a missing candidate record instead of manufacturing NO`
- **AssertionError**: `Phase 3F production case evidence ingestion and overlay fails closed on partial SRA coverage`
- **AssertionError**: `Phase 3F production case evidence ingestion and overlay fails closed outside SRA with the normalized Los Angeles TEST-ONLY polygon`
- **AssertionError**: `Phase 3F production case evidence ingestion and overlay retains manual disagreements as Layer 1 conflicts`
- **AssertionError**: `Phase 3F production case evidence ingestion and overlay ignores caller hazard authority and map_covers_lot=yes when stored legal identity is not established`
- **AssertionError**: `Phase 3F production case evidence ingestion and overlay ignores caller hazard authority and map_covers_lot=no when stored legal identity is not established`
- **AssertionError**: `Phase 3F existing private R2 evidence boundary ingests verified files and CAL FIRE records, publishes with CAS, then evaluates through the production adapter`
- **AssertionError**: `Phase 3H private production-input boundary private inputs fail closed for missing-LRA-index`
- **AssertionError**: `Phase 3I production evidence from one reviewed snapshot whole-lot Very High on PRC §4202 establishes c through the in-memory production store`
- **AssertionError**: `Phase 3I production evidence from one reviewed snapshot prc_4202 NO plus the other route's missing index stays unknown`
- **AssertionError**: `Phase 3I production evidence from one reviewed snapshot LRA missing index preserves every d byte and PRC's independent c YES`
- **AssertionError**: `Phase 3I production evidence from one reviewed snapshot LRA source throws preserves every d byte and PRC's independent c YES`
- **TypeError**: `Phase 3I production evidence from one reviewed snapshot keeps the single verified geometry even when neither route index is available`
- **AssertionError**: `Phase 3I real private R2 adapter ingests pinned native SRA (and LRA=false), then establishes PRC Very High through openProgramScreenCaseStore`
- **TypeError**: `Phase 3I whole-lot class and worker/gate parity native invalid SRA record 10977 leaves c unknown unless the other route gives YES=false`

### M12: exact failing tests

2 failed tests; 2 include test assertion failures. The restored run passes all 337 tests.

- **AssertionError**: `Phase 3I production evidence from one reviewed snapshot reads and verifies once, checks revision once after both routes, and supplies exactly one geometry object to all blocks`
- **AssertionError**: `Phase 3I real private R2 adapter ingests pinned native SRA (and LRA=true), then establishes PRC Very High through openProgramScreenCaseStore`

### M13: exact failing tests

2 failed tests; 2 include test assertion failures. The restored run passes all 337 tests.

- **AssertionError**: `Phase 3I production evidence from one reviewed snapshot complete non-VH coverage on both routes clears c with LRA NonWildland on the same snapshot`
- **AssertionError**: `Phase 3I whole-lot class and worker/gate parity LRA NonWildland has only the recognized Very High meaning`

### M14: exact failing tests

40 failed tests; 40 include test assertion failures. The restored run passes all 337 tests.

- **AssertionError**: `Re-audit 7: production-input path production evaluation supplies reviewed-snapshot route evidence and strips caller hazard blocks while retaining conflicts`
- **AssertionError**: `Phase 3H private production-input boundary production evaluator computes both c routes; manual authority cannot establish c and observations retain conflicts`
- **AssertionError**: `Phase 3I production evidence from one reviewed snapshot whole-lot Very High on PRC §4202 establishes c through the in-memory production store`
- **AssertionError**: `Phase 3I production evidence from one reviewed snapshot whole-lot Very High on GOV §51178 independently establishes c while PRC is unknown`
- **AssertionError**: `Phase 3I production evidence from one reviewed snapshot complete non-VH coverage on both routes clears c with LRA High on the same snapshot`
- **AssertionError**: `Phase 3I production evidence from one reviewed snapshot gov_51178 NO plus the other route's outside stays unknown`
- **AssertionError**: `Phase 3I production evidence from one reviewed snapshot gov_51178 NO plus the other route's partial stays unknown`
- **AssertionError**: `Phase 3I production evidence from one reviewed snapshot gov_51178 NO plus the other route's missing index stays unknown`
- **AssertionError**: `Phase 3I production evidence from one reviewed snapshot gov_51178 NO plus the other route's invalid relevant feature stays unknown`
- **AssertionError**: `Phase 3I production evidence from one reviewed snapshot gov_51178 NO plus the other route's unreadable relevant feature stays unknown`
- **AssertionError**: `Phase 3I production evidence from one reviewed snapshot gov_51178 NO plus the other route's missing relevant feature stays unknown`
- **AssertionError**: `Phase 3I production evidence from one reviewed snapshot LRA missing index preserves every d byte and PRC's independent c YES`
- **AssertionError**: `Phase 3I production evidence from one reviewed snapshot LRA missing record preserves every d byte and PRC's independent c YES`
- **AssertionError**: `Phase 3I production evidence from one reviewed snapshot LRA source throws preserves every d byte and PRC's independent c YES`
- **AssertionError**: `Phase 3I production evidence from one reviewed snapshot never reads review B from a store that would return A then B`
- **AssertionError**: `Phase 3I real private R2 adapter ingests pinned native SRA (and LRA=false), then establishes PRC Very High through openProgramScreenCaseStore`
- **AssertionError**: `Phase 3I real private R2 adapter ingests pinned native SRA (and LRA=true), then establishes PRC Very High through openProgramScreenCaseStore`
- **AssertionError**: `Phase 3I whole-lot class and worker/gate parity gov_51178 whole Very High has computed VH=[object Object] and matches the independent gate`
- **AssertionError**: `Phase 3I whole-lot class and worker/gate parity gov_51178 whole High has computed VH=[object Object] and matches the independent gate`
- **AssertionError**: `Phase 3I whole-lot class and worker/gate parity gov_51178 mixed Very High/Moderate has computed VH=[object Object],[object Object] and matches the independent gate`
- **AssertionError**: `Phase 3I whole-lot class and worker/gate parity gov_51178 mixed High/Moderate has computed VH=[object Object],[object Object] and matches the independent gate`
- **AssertionError**: `Phase 3I whole-lot class and worker/gate parity prc_4202 whole Very High has computed VH=[object Object] and matches the independent gate`
- **AssertionError**: `Phase 3I whole-lot class and worker/gate parity prc_4202 whole High has computed VH=[object Object] and matches the independent gate`
- **AssertionError**: `Phase 3I whole-lot class and worker/gate parity prc_4202 whole Moderate has computed VH=[object Object] and matches the independent gate`
- **AssertionError**: `Phase 3I whole-lot class and worker/gate parity prc_4202 mixed Very High/High has computed VH=[object Object],[object Object] and matches the independent gate`
- **AssertionError**: `Phase 3I whole-lot class and worker/gate parity prc_4202 mixed Very High/Moderate has computed VH=[object Object],[object Object] and matches the independent gate`
- **AssertionError**: `Phase 3I whole-lot class and worker/gate parity prc_4202 mixed High/Moderate has computed VH=[object Object],[object Object] and matches the independent gate`
- **AssertionError**: `Phase 3I whole-lot class and worker/gate parity prc_4202 partial Very High has computed VH=[object Object] and matches the independent gate`
- **AssertionError**: `Phase 3I whole-lot class and worker/gate parity prc_4202 outside has computed VH=[object Object] and matches the independent gate`
- **AssertionError**: `Phase 3I whole-lot class and worker/gate parity prc_4202 invalid relevant has computed VH=[object Object] and matches the independent gate`
- **AssertionError**: `Phase 3I whole-lot class and worker/gate parity prc_4202 unreadable relevant has computed VH=[object Object] and matches the independent gate`
- **AssertionError**: `Phase 3I whole-lot class and worker/gate parity prc_4202 missing relevant has computed VH=[object Object] and matches the independent gate`
- **AssertionError**: `Phase 3I whole-lot class and worker/gate parity prc_4202 unrecognized semantic label has computed VH=[object Object] and matches the independent gate`
- **AssertionError**: `Phase 3I whole-lot class and worker/gate parity LRA Very High/NonWildland has only the recognized Very High meaning`
- **AssertionError**: `Phase 3I whole-lot class and worker/gate parity every existing TEST-ONLY native lot high-moderate has worker/gate parity on both routes`
- **AssertionError**: `Phase 3I whole-lot class and worker/gate parity every existing TEST-ONLY native lot phase-3f-normalized-sra has worker/gate parity on both routes`
- **AssertionError**: `Phase 3I whole-lot class and worker/gate parity every existing TEST-ONLY native lot whole-high-l-shape-with-hole has worker/gate parity on both routes`
- **AssertionError**: `Phase 3I whole-lot class and worker/gate parity every existing TEST-ONLY native lot whole-high has worker/gate parity on both routes`
- **AssertionError**: `Phase 3I whole-lot class and worker/gate parity every existing TEST-ONLY native lot whole-very-high has worker/gate parity on both routes`
- **AssertionError**: `Phase 3I whole-lot class and worker/gate parity native invalid SRA record 10977 leaves c unknown unless the other route gives YES=true`


## Remaining work

1. No HTTP/admin Program Screen entry point yet. That belongs to the next phase.
2. Vidor legal-lot identity remains `not_established` until Request 3F-3 / vesting-deed review is complete.
3. d re-verification is due before 2026-10-29.
4. c re-verification is due before 2026-10-31.

No PR is opened or merged in Phase 3I. The separate Sol 6.1 Ultra pre-PR review follows this branch's implementation and verification.
