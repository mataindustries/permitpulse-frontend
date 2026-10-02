# Program Screen Phase 3H: the promotion of c

Phase 3H promotes c, `la_shra.very-high-fire-hazard-severity-zone`, and only c. Decided 2026-10-01 by **Sergio Mata, Project Owner / Human Reviewer**:

1. An earlier Phase 3H audit found one blocker: a relevant invalid SRA source polygon could establish c YES. It was fixed and merged in PR #30 ([the SRA topology safety fix](PROGRAM_SCREEN_PHASE_3H_SRA_TOPOLOGY_SAFETY_FIX.md)).
2. A fresh, independent promotion-readiness audit on main at `0cfbd67` (PR #30 merged) found no blocker and no rule-to-code mismatch.
3. **APPROVE C PROMOTION.** The reviewer approved the encoded c rule, rule summary, judgment question, and human-verification record exactly as audited, with `verified_at` 2026-10-01, `next_review_at` 2026-10-31, and `decision_ref` `{ phase: "3B", letter: "c" }`.

Result:

- **c and d are the only `human_verified` criteria**: `human_verified` = 2, `pending_human` = 44, 34 rules not encoded, 44 release blockers in the fictional fixture. e, f, and g stay `pending_human`. The G1 and G2 completeness blockers are unchanged and open.
- **d is unchanged**, including its rule, record, citation dates (2026-09-29 / 2026-10-29), and gates.
- **The outcome ceiling is unchanged**: consistent, disqualifying, or judgment.
- **Nothing else changes**: neither authority package (`calfire-lra-fhsz-2025-03-24-v1`, GOV §51178; `calfire-sra-fhsz-2023-09-29`, PRC §4202), neither overlay implementation or index pin, the reviewed-lot infrastructure, or production c ingestion (there is none; see below).
- **The Phase 3B record is unchanged.** It is history: its `status_after_review` still reads `pending_human`.

Tests: `app/tests/program-screen-c-reaudit-3h.test.ts` (the independent re-audit, kept as the post-promotion regression) and `app/tests/program-screen-c-promotion-audit-3h.test.ts`. TEST-ONLY helper: `app/tests/program-screen-c-pre-promotion.ts` rebuilds the pre-promotion c for before/after comparisons; its output reproduces the historical pre-promotion hashes exactly.

## The production gap: real parcels still return unknown on c

**No production path generates c evidence.** The stored-case evaluator (`evaluateStoredCaseProgramScreen`) strips every caller-supplied hazard authority block, computes only d's High record from the reviewed lot and the SRA package, and passes only SRA overlay inputs. The Route 1 loader (`loadCaseLraOverlay`) exists but its inputs are not used in evaluation. So c is now a human-verified, executable rule, but every real parcel's Very High fact stays unestablished through production, and c returns `unknown` for it. This is a safe operational gap, not a correctness defect.

## The promotion

The encoded rule reads only the Very High fact, which the evaluator assesses once per statutory route and combines (YES when any route is YES; NO only when every route is NO). Every source, route, whole-lot coverage, topology-validity, and legal-lot condition is enforced by the authority gate before the predicate runs.

```ts
predicate: (facts) =>
  booleanFact(facts, "very-high-fire-hazard-severity-zone") ? "disqualifying_per_source" : "consistent_with_source",
```

**Rule summary** (598 of 600 characters):

> Phase 3B decision c. Disqualifying per source when, on either separately assessed route, a reviewed CAL FIRE / OSFM record (GOV §51178 2025 LRA identification or PRC §4202 adopted SRA map), a deterministic overlay of the reviewed legal-lot geometry on that route's registered dataset, shows the whole lot proposed to be subdivided in Very High. Consistent with source only when both routes each show no part of the lot in Very High. Partial or mixed coverage, invalid source geometry, a one-route negative, an unclear legal lot, and any other source stay unknown; no threshold. High is criterion d.

**Judgment question:** How does Planning apply the SHRA Very High Fire Hazard Severity Zone site category (memo page 4, prohibited category 3) to the lot proposed to be subdivided?

**Human-verification record:** reviewer Sergio Mata (Project Owner / Human Reviewer); `verified_at` 2026-10-01; `next_review_at` 2026-10-31 (the memo citation's 30-day high-volatility cadence; d's dates are not reused); the SHRA memo (October 28, 2025), pinpoint "Memo Part I, Environmental Criteria, page 4, prohibited category 3 and footnote 1"; the exact captured excerpt "3) High or very high fire hazard severity zones, as referenced in GCS 51178 and Public Resources Code Section 42021."; capture `app/fixtures/program-screen/official-sources/shra-2025-10-28/extracted.txt`, SHA-256 `f44574084091c51419d0475d4b8501d9a2c3577b3a16830fc6ecb2a88b20f6e2`, retrieved 2026-09-27T16:19:20Z; `decision_ref` `{ phase: "3B", letter: "c" }`. c's citation carries the same dates.

**Promotion gates.** c lists exactly the seven Phase 3B gates. Phase 3G met `statutory_route_recorded` (GOV §51178 gained a record kind and a registered package); the record meets `reviewer_confirms_encoded_rule` and `human_verification_record`. No gate is unmet.

| Gate | Status |
| --- | --- |
| `evidence_provenance_enforced_or_fails_closed` | met |
| `map_identity_and_edition_recorded` | met |
| `statutory_route_recorded` | met (Phase 3G) |
| `statutory_routes_assessed_separately` | met |
| `legal_lot_identity_fails_closed` | met |
| `reviewer_confirms_encoded_rule` | met by the approved record |
| `human_verification_record` | met by the approved record |

**Evaluator and public-demo output.** Before changing any pin, the real outputs of the promoted code were computed and matched the audited projections exactly:

| `as_of` | Evaluator before → after | Public demo before → after |
| --- | --- | --- |
| 2026-09-27 (fixture) | `156dd1f4…afbc` → `1341fea59e307fed23ec1cd32fcdb2467d0fa3519bd07dd134fa9ddfee6deaad` | `4dd2735b…a8a5` → `23aaee06e51b42a4c1001d6253504f2f932d591315af468ada21345d888a5070` |
| 2026-10-01 | `1acccc97…6be7` → `be57c1bf0f9c4c615375eb0c02d48fe9dd37fcd2afda4eb67cb20f99c98544cb` | `06222298…3393` → `2a777f2da9b489f8731c933b04d83620230485df58c479a7b2bcb7981f9a369e` |

The only causes are c's own result fields (verification, rule kind, rule summary, citation dates), the removal of c's own `pending_human_criterion` blocker (45 → 44), and the removal of c's own `verify_criterion_rule` review task. The demo payload carries no rule summary, so only c's verification, citation dates, and the blocker count move it. Every status (c in the fictional fixture is still a Layer 1 `conflict`), fact, count, roll-up, planning question, and every other criterion is unchanged.

## The audit, in brief

- **The prior blocker fails closed.** FHSZSRA_23_3 record 10977 / GDAL FID 10976, Very High, GEOS "Ring Self-intersection at or near point 237657.61459999904 -405236.31659999955" (record content SHA-256 `a7fa01d2…`), re-derived natively with GDAL 3.10.3 / GEOS 3.13.1 from the original archive. Lots it is relevant to return `not_established`; c stays unknown for a route YES or NO, even with a qualifying Route 1 NO.
- **Statewide sweep with the unmodified production code and shipped pins.** 699 lots across all 233 invalid SRA features and 264 lots across all 147 invalid or unreadable LRA features: every one `not_established`, c unknown. Relevant invalid non-Very-High features never yield a both-route NO. Unrelated valid lots behave correctly. Real SRA/LRA dataset overlaps gave a real both-route NO and YES.
- **Rule-to-code matrix: no mismatch.** Every Phase 3B c point is EXACT or STRICTER_FAIL_CLOSED (partial coverage is always unknown, never requires_judgment; a conflict inside one route wins over a YES on the other; relevant invalid, unreadable, or missing source geometry is unknown).
- **Combined truth table** (shipped registries, one reviewed lot): YES on either route is disqualifying; NO on both routes is consistent; every other combination is unknown, including partial, mixed, invalid, unreadable, missing, and outside on either route.

## Known follow-up: cross-route lot identity (not a blocker)

**Before production c evidence generation is wired, harden the shared evaluator so Route 1 and Route 2 records must refer to the same reviewed legal-lot geometry and identity before two negatives can combine to clear c.**

Today the shared evaluator lets each route's record name its own reviewed lot geometry, and does not check that the two are the same. A Route 1 NO on lot A and a Route 2 NO on a different lot B therefore combine into `consistent_with_source` (reproduced in `program-screen-c-reaudit-3h.test.ts`). This needs a human-reviewed authority block that names the wrong lot, the same trust model d was approved under, and no shipped entry point can reach it: the stored-case evaluator supplies exactly one reviewed lot geometry and strips caller hazard blocks, and the evaluator has no HTTP route. It is production-wiring hardening, recorded here and not solved in this change.

## Other recorded observations (safe)

- Invalid features are relevant to every lot whose box meets their extent, so many real lots fail closed (in a statewide sample, about 80% of SRA and 57% of LRA interior lots). This is availability only; it also affects d.
- A real both-route NO is reachable only where the SRA and LRA datasets overlap, so c will rarely clear. That is exact to Phase 3B point 5.
- The SHRA memo capture's `retrieved_at` is the upload time and its bytes were not compared with the official host; d's record rests on the same capture.

## Verification

Order of work: only c was implemented first; the real evaluator and public-demo outputs were computed and matched the audited projections exactly; only then were the superseded pins updated. Superseded assertions in earlier tests (counts 1 / 45 → 2 / 44, release blockers 45 → 44, unencoded rules 35 → 34, c pending → human-verified, c `unreviewed` → `unknown` where no qualifying authority evidence exists, citation dates, and hash pins) are updated and marked "Updated in Phase 3H". Every behavioral route and geometry test is preserved. The shipped verification suite now exercises c's positive case (a qualifying NO on both routes for the same lot) and blocking case (a whole-lot Very High route).

Native tooling: the SRA and LRA global setups re-derive both datasets with the pinned GDAL 3.10.3 / GEOS 3.13.1 Python bindings (`PP_SRA_PYTHON` / `PP_LRA_PYTHON`).

- Focused Phase 3H tests (`program-screen-c-reaudit-3h`, `program-screen-c-promotion-audit-3h`): pass.
- Complete Program Screen suite: pass.
- Full app suite, capture verification, capture-tool self-test, typecheck, production build (existing chunk-size warning), and OS verification: pass.

**Mutation checks.** Each bypass was applied alone to a disposable copy of the code (never this checkout), the focused Phase 3H tests and the verification suite were run, and the copy was restored and re-verified green (301 / 301) before the next. A mutation counts as killed only by assertion failures. All 12 were killed:

| Mutation | Result |
| --- | --- |
| Remove the GOV §51178 (LRA) route registration for c | killed (123 failed) |
| Remove the PRC §4202 (SRA) route registration for c | killed (123 failed) |
| Bypass SRA validity in the overlay (ignore invalid candidates) | killed (14 failed) |
| Bypass SRA validity at the pin (re-accept the legacy 1.0.0 index) | killed (22 failed) |
| One-route NO clears c, Layer 1 combine | killed (1 failed) |
| One-route NO clears c, Layer 2 gate | killed (24 failed) |
| One-route NO clears c, both layers | killed (36 failed) |
| High establishes c | killed (5 failed) |
| Shipped c without its human-verification record | killed (27 failed) |
| Human-record completeness check bypassed | killed (36 failed) |
| Wrong Phase 3B decision reference (`{ phase: "3B", letter: "d" }`) | killed (15 failed) |
| Wrong decision reference (`{ round: 1, letter: "c" }`) | killed (15 failed) |

## Not in Phase 3H

- Production generation of c evidence (computed Route 1 and Route 2 records from the reviewed lot), and the cross-route lot-identity hardening that must precede it.
- e, f, g, the G1 and G2 completeness blockers, and every other pending criterion.
