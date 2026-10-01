Program Screen Phase 3H: SRA topology safety fix

Date: 2026-10-01. Base main: `d80da9b53b19cda2b261190e51fcd5ddf4986950` (merged Phase 3G / PR #29).

This fixes the reproduced evidence-qualification defect only. Criterion c remains `pending_human` and `not_encoded`; d remains the sole `human_verified` criterion, with counts 1 / 45. G1/G2, outcome ceilings, authority registrations and original source captures are unchanged. No c production predicate or human-verification record is added.

**Root cause and exact reproduction.**

The legacy SRA shapefile index checked source identity, record structure, coordinates and hashes, but carried no topology verdict. The overlay skipped validity checking when the state was absent. An invalid feature could therefore establish positive or negative evidence.

Before any production edit, the original audit reproduced on main: FHSZSRA_23_3 record 10977 / GDAL FID 10976, Very High, with a ring self-intersection at `237657.61459999904 -405236.31659999955`. The unchanged record content SHA-256 is `a7fa01d2e6d9af7e5c21111c9edb4a8c3eedc1af0545e4aa4d6c1ea97312db13`. The TEST-ONLY EPSG:3310 square `(236688, -401049)`–`(236696, -401041)` has complete candidates 537, 10977 and 10984. It formerly computed whole-lot Very High and could establish c YES. It now returns `not_established`, no classes, and an unknown authority result.

**Fresh independent derivation.**

GDAL 3.10.3 / GEOS 3.13.1 `OGRGeometry.IsValid()` was run independently against the original shapefile inside the pinned ZIP. The invalid record set exactly matches the audit. No source feature is repaired, rewritten, transformed, simplified or linearized. Read-only native geometry bytes are checked before/after validity determination.

| Class | All features | Invalid | Valid |
| --- | ---: | ---: | ---: |
| Very High | 8411 | 139 | 8272 |
| High | 5824 | 70 | 5754 |
| Moderate | 4188 | 24 | 4164 |
| Total | 18423 | 233 | 18190 |

There are zero unreadable/missing source geometries. Two independent exports reproduce the full validity manifest byte for byte. Changed tool versions, archive bytes, FID associations or inventory stop derivation for review.

**Exact identities and derivative pins.**

| Artifact | SHA-256 |
| --- | --- |
| Original SRA ZIP, 36,001,656 bytes | `e744eb8eb7895157f4025109f29ff5312180a52fdb4648ff9fe9328edf4db3b2` |
| Original SRA extracted capture | `a85ff7eecf0f8ffa80d7dd8dcdc727a9dde42979fb3b7b8d5614b7a47a6b5a8a` |
| Full native validity manifest | `e9dbf7df79f10bbe632bf57cd6ea727821ac993cad217efeea298d3bfcbb4b3c` |
| New SRA topology index 1.1.0 | `224fafb7015bca3e93704e88ca212510f9f099bb50538bc211cc7494cfef7ada` |
| Historical SRA index 1.0.0, replaced | `caf01fa68e68b3c368538067f504e6f16ccdf7fdeb91f644114d7c86494589ff` |
| Unchanged Phase 3G LRA index 2.0.0 | `5167cbf7029ea3fc051331d2c2de4d1611feb88783e38a852f678b94b275a716` |

The manifest records exact tool/exporter versions, dataset identity, ZIP/member hashes, record number, GDAL FID, semantic label, SHA-256 of unchanged shapefile record content (including Z/M bytes), explicit validity state and deterministic native diagnosis when available. It contains every feature, rather than a blacklist or repair list. It has no retrieval or derivation timestamp that could change reproducible bytes.

The 3,001,436-byte index keeps the original record geometry digests, extents, lengths, ordering and labels. It adds archive/manifest/tool identity and each feature's state/diagnosis. Its existing content hash is the per-feature geometry hash verified against the native manifest offline. The final pinned index binds that digest to its verdict. The build tool checks all native-to-record associations and refuses automatic repinning. Original SRA package/capture identities remain unchanged; the package is PRC §4202 only, and LRA remains GOV §51178 only.

The native builder is under `app/scripts/lib/`; runtime imports only literal engineering pins and the strict index parser. Runtime imports no capture/review fixture, offline builder, Python or native library. Existing import-boundary tests remain enforced.

**Runtime behavior.**

Each relevant candidate must have established valid topology and its supplied bytes must match the pinned record hash. Invalid, unreadable or missing-validity candidates produce unknown; missing/mutated record bytes or a changed index are refused and the private evaluator returns unknown. Unknown extents cannot safely exclude an unreadable/unqualified source. Nonintersecting known extents exclude invalid features from that lot, so the 233 invalid features do not poison unrelated valid lots.

The coverage algorithm, binary64 geometry, exact class labels, whole-lot requirement, legal-lot identity, absence of percentage thresholds, provenance/issuer/package/statutory checks and refusal of manual coverage/classes remain intact. The old v1.0 format is readable for diagnostic/migration checks but cannot establish geometry validity; its old SRA pin is no longer accepted by private ingestion. Existing cases need the verified new derivative index re-ingested; until available they safely return unknown. No case data is changed by this code fix.

The existing `very-high-moderate` TEST-ONLY geometry fixture has relevant invalid record 10977. Its previous computed coverage and d negative become unavailable/unknown, which is the required safety correction. Valid High, Very High, Moderate, L-shaped and hole cases retain their behavior. The production criterion d and its human record remain byte-identical.

**Protected output hashes.**

For the unchanged fictional fixture at fixed `as_of: 2026-09-27`, before and after hashes remain:

- Evaluator: `156dd1f41964ab5beebcf3882e0a0d653cc5d778939033bf2b752dba1e86afbc`.
- Public demo: `4dd2735bab875ad40b123fec72020e16442737bc6b5052eb55c5fba374b9a8a5`.

That fixture does not exercise source geometry; its facts, criteria, rollups and outputs remain identical. The safety fix changes only actual overlay results that previously relied on invalid/unqualified source evidence. The Phase 3H audit's hypothetical c-only projections remain TEST-ONLY and do not imply a promotion.

**Verification.**

The preserved Phase 3H audit expected failure is now an ordinary passing requirement. Safety tests cover relevant invalid Very High and non-Very-High, actual c's both-route negative, unrelated invalid features, absent validity, unreadable/unknown extents, geometry/validity/index hash mutations, manual attestations, private-input refusal and valid native lots. The complete Phase 3G LRA suite remains applicable. Mutation tests edit only disposable copies and reject tool/transform failures as evidence of a killed mutation.

Validation on the final implementation:

- Focused Phase 3H audit/safety and Phase 3G LRA tests: 138 passed, zero expected failures.
- Complete Program Screen suite: 19 files, 1,132 passed, zero failed/pending.
- Full app suite: 47 files, 1,556 passed, zero failed/pending.
- Official capture verification and capture-tool self-test: passed.
- Typecheck, production build and OS foundation verification: passed. The production build retains its existing chunk-size warning.
- Offline SRA CLI: verified all 18,423 unchanged source records and the exact new index pin.
- Mutation runner: all eight deliberate bypasses killed by assertion failures; 19 synthetic tests pass before mutations and after restoration. Mutations target missing validity, invalid geometry, unreadable geometry, validity-to-record hash association, supplied geometry hash, index pin, unknown-extent exclusion and unrelated-lot poisoning. Tooling or arbitrary runtime errors do not count as killed mutations.

The native record 10977 witness now passes as an ordinary unknown regression, while the original Phase 3H audit and all promotion-blocking tests remain present. Repository review confirms no edits to criteria, authority packages/registries, original captures, Phase 3G LRA sources, outcome ceilings or the private case store. d is still the only verified criterion; counts remain 1 / 45, with 35 unencoded rules and 45 release blockers. No new human evidence judgment or verification is recorded.
