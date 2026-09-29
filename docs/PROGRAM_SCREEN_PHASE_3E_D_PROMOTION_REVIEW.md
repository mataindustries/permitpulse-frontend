# Program Screen Phase 3E: the promotion of d, and the F1 lot-overlay fix

Phase 3E is the first production promotion of an atomic criterion: d, `la_shra.high-fire-hazard-severity-zone`, and only d. Decided 2026-09-29 by **Sergio Mata, Project Owner / Human Reviewer**, in two steps:

1. **KEEP D PENDING.** The promotion audit found F1 (below). The reviewer asked for F1 to be fixed and the audit re-run before any decision.
2. **APPROVE D PROMOTION**, on the completed post-F1 audit. The reviewer approved the encoded d rule, rule summary, judgment question, and human-verification record exactly as proposed, with `verified_at` 2026-09-29, `next_review_at` 2026-10-29, and `decision_ref` `{ phase: "3B", letter: "d" }`.

Result:

- **d alone is `human_verified`**: `human_verified` = 1 and `pending_human` = 45. c, e, f, and g stay `pending_human`; c is still blocked by `statutory_route_recorded` (GOV §51178 has no record kind). The G1 and G2 completeness blockers are unchanged and open.
- **The outcome ceiling is unchanged**: consistent, disqualifying, or judgment.
- **The CAL FIRE / OSFM package is unchanged**: its manifest, members, registration, and pins (`calfire-sra-fhsz-2023-09-29`, Phase 3D).
- **The Phase 3B record is unchanged.** It is history: its `status_after_review` still reads `pending_human`.

Tests: `app/tests/program-screen-d-promotion-review-3e.test.ts`.

## The production gap: real parcels still return unknown

**The production system has no store for reviewed lot geometry or for overlay inputs.** d is now a human-verified, executable rule, but it can return YES or NO only for a lot whose High fact is established by a reviewed authority block through the CAL FIRE / OSFM package, with the gate's own overlay of a reviewed legal-lot geometry on the pinned FHSZSRA_23_3 polygons. No production caller supplies those inputs: the case-scoped evidence store for lot geometry (D10) and a store for the overlay index and records do not exist. Until reviewed overlay inputs are supplied through a production ingestion path, every real parcel's High fact stays unestablished, and d returns `unknown` for it.

This gap is not permission to infer a parcel result. No parcel result may be inferred from a City or ZIMAS display, a map image, an address, a reviewer's reading of coverage, or anything else the gate does not compute. Closing the gap is a separate, reviewed change.

## The promotion

d's encoded rule reads only the High fact: `true` → `disqualifying_per_source`, `false` → `consistent_with_source`. Every source, whole-lot coverage, and legal-lot condition is enforced before it runs, by the authority gate. Changes, all in `app/src/shared/program-screen/criteria/shra.ts`, d only:

| Field | Before | After |
| --- | --- | --- |
| `predicate` | `not_encoded` | the rule above |
| `rule_summary` | "Rule not encoded. …" | the approved summary (Phase 3B decision d, as encoded) |
| `question_if_judgment` | none | "How does Planning apply the SHRA High Fire Hazard Severity Zone site category (memo page 4, prohibited category 3) to the lot proposed to be subdivided?" |
| `citation.verified_at` / `next_review_at` | 2026-09-17 / 2026-10-17 (the shared memo citation) | 2026-09-29 / 2026-10-29 (d only; the shared date predates the memo capture of 2026-09-27, which a record may not do) |
| `verification` | `pending_human` | `human_verified` |
| `human_verification` | none | reviewer Sergio Mata, the SHRA memo capture `shra-2025-10-28` (`f44574084091c51419d0475d4b8501d9a2c3577b3a16830fc6ecb2a88b20f6e2`), page 4 prohibited category 3 and footnote 1, `decision_ref` `{ phase: "3B", letter: "d" }` |

d becomes stale on 2026-10-29: from then on it is a `stale_criterion` release blocker until it is re-verified.

**Evaluator and public-demo output.** The F1 fix changed no output. The promotion moved both hashes to exactly the projections the reviewer approved:

| | Before | After |
| --- | --- | --- |
| Evaluator SHA-256 | `68341529825b41e7dcd3b25a5daec94385fe6641e07cc03d29003c94c256b45a` | `156dd1f41964ab5beebcf3882e0a0d653cc5d778939033bf2b752dba1e86afbc` |
| Public-demo SHA-256 | `11081860902438dd881cb743c98de30f4b4c3c425675a6e0eb2b6d41474a84a1` | `4dd2735bab875ad40b123fec72020e16442737bc6b5052eb55c5fba374b9a8a5` |

The only causes are d's own fields (verification, rule kind, rule summary, citation dates) and the removal of its own `pending_human_criterion` release blocker and review task (45 pending blockers instead of 46). The fixture holds no High record, so d is `unknown` before and after; every other criterion result, fact, count, roll-up, and the screen ID are identical, and the fixture stays non-releasable.

## F1: whole-lot SRA coverage was attested, not computed

Phase 3D recorded a lot overlay in the authority block: the class labels of the features the lot intersects (`classes_on_lot`), typed into the block, and whether the map covers the lot (`map_covers_lot`), a reviewer's reading. Neither was computed. For a lot partly in SRA Moderate and partly in LRA land, a block with `map_covers_lot: "yes"` gave d a clearing NO; for a lot partly in SRA High and partly in LRA land it gave a YES. The approved d rule requires the registered PRC §4202 dataset to cover the whole lot for either.

## The fix: the gate computes the overlay

The authority package proves what the SRA dataset is. The lot overlay proves how the reviewed legal lot intersects that dataset. The two stay separate.

| Piece | Module | What it does |
| --- | --- | --- |
| Overlay index | `overlay-dataset.ts` | `program-screen-overlay-index` 1.0.0, derived from the package's pinned `.shp`, `.shx`, and `.dbf` members: one line per record with its shape type, the exact extent of its points, its content length and SHA-256, and its `FHSZ_Descr` label. Pinned in `overlayIndexPins` by the dataset capture it is derived from. |
| Dataset view | `overlay-dataset.ts` | `loadOverlayDatasetView` checks the index against its pin and each supplied record against the index. Only it can create a view. |
| Lot geometry | `lot-overlay.ts` | `program-screen-lot-geometry-v1`: one Polygon in a stated EPSG CRS. `loadReviewedLotGeometry` hashes the file and checks it is a simple polygon with area (closed rings, no repeated position, no fold, no crossing or touching edges). Only it can create one; an invalid geometry is kept, marked invalid. |
| Overlay | `lot-overlay.ts` | `computeLotOverlay` gives `lot_within_features` (`whole_lot`, `part_of_lot`, `none`, `not_established`) and the labels of the features covering part of the lot with area. |
| Gate | `authority-gate.ts` | Computes the overlay itself for every hazard record, from the verified view of the package's pinned dataset and the verified lot geometry the block names. |

Pins:

| | Value |
| --- | --- |
| Dataset capture (package member) | `calfire-fhszsra-23-3-data`, `a85ff7eecf0f8ffa80d7dd8dcdc727a9dde42979fb3b7b8d5614b7a47a6b5a8a` |
| Overlay index SHA-256 | `caf01fa68e68b3c368538067f504e6f16ccdf7fdeb91f644114d7c86494589ff` (2,780,959 bytes, 18,423 records) |
| `.shp` / `.shx` / `.dbf` SHA-256 (as the capture's manifest lists them) | `3de6625a8fbb53f6f0fbcc4f261b5fd30efd1d7ba3299cee5550778249f024dc` / `95226d3e0ac4a59ac429345bcb3054e9a2430519fd751bf259e18a881f4dd0a8` / `95424b8357c6aab847ca96de3489b439d3fa90dc67615385aaa866b992ac867d` |

The index records each record's extent from its points: in FHSZSRA_23_3 the record header box misses the points of 11,089 records by up to about 4 nanometres, so it is never used.

**Exact computation.** Every coordinate is a double, and every double is a dyadic rational, so the lot and the candidate features are scaled to integers by one power of two and every test is exact BigInt arithmetic. The lot's x-range is cut into vertical slabs at every vertex and every edge crossing inside the lot's box; within a slab no two edges cross, so the line through the slab's middle meets every region of positive area, and even-odd counts tell whether each gap on it lies in the lot and in which features. No tolerance, overlap percentage, or sampling. A feature that only touches the lot along an edge or at a point never counts. The candidates are every index record whose extent meets the lot's box; if any is missing from the view the overlay is `not_established`, so an omitted record is never read as "no feature".

**Gate semantics** (hazard records; d uses High):

- YES only when `lot_within_features` is `whole_lot` and every class on the lot is the fact's class;
- NO only when `lot_within_features` is `whole_lot`, there is at least one class, none is the fact's class, and the package defines the fact's class;
- `part_of_lot` or `none`: `hazard_area_not_covered`;
- no overlay inputs, an unverified or unpinned dataset view, a lot geometry that is missing, differs from the block's SHA-256, is invalid, or is in another CRS, or a missing candidate record: `lot_overlay_not_established`;
- `whole_lot` whose classes do not support the value, or a label the package does not map (such as a numeric code): `lot_overlay_classes_do_not_support_value`.

Every earlier check still applies: CAL FIRE named, PRC §4202 basis, adopted map, the legend class (High), registered edition and issuer, legal-lot identity, and human review of the block.

## Fields retired or demoted

| Field | Before | After |
| --- | --- | --- |
| `lot_overlay.classes_on_lot` | typed classes, read by the gate | **retired**: the evidence schema refuses it, and any other recorded overlay result |
| `map_covers_lot` | read by the gate (`hazard_area_not_covered`) | **context only**, like `responsibility_area_as_stated`: no check reads it, and it can neither create nor remove coverage |
| `hazard_area_not_covered` | the attested field was not `yes` | the computed overlay is `part_of_lot` or `none` |
| `legend_defines_class_for_lot` | read for High | unchanged (fail-closed); the package must also define the class |
| `coverage` (`whole_parcel` / `none_of_parcel`) | the block's own shape rule | unchanged; it can only refuse a block, never establish coverage |

**c is affected in the same way, explicitly.** The lot overlay belongs to the package, and c's Route 2 establishes through the same package, so Route 2 now also needs the computed overlay. c stays `pending_human` and never runs its rule, so no shipped output changes, and c's promotion gates are unchanged (`statutory_route_recorded` stays unmet).

**Promotion gates are unchanged.** d still lists exactly the seven Phase 3B gates. After the F1 fix only the two reviewer gates were unmet; d's human verification record now meets both. The `prc_4202_map_coverage_and_legend_class_recorded` check rests on computed lot coverage.

## Tests and test data

- `app/tests/program-screen-overlay.global-setup.ts` re-derives the overlay index from the archive bytes in Node on every run (the tests run in workerd, which cannot load the 36 MB archive) and extracts every record whose extent meets a TEST-ONLY lot's box. The tests load both through `loadOverlayDatasetView`, so nothing provided is trusted as it is.
- `app/fixtures/program-screen/test-only-lot-geometries/`: fictional lots placed at real locations in FHSZSRA_23_3: wholly High, Very High, Moderate; Very High + Moderate; High + Moderate; High + Very High; part Moderate / part outside SRA; part High / part outside SRA; outside SRA (far away, and beside SRA features); an L-shaped lot with a hole; a self-crossing lot; and a lot stated in another CRS.
- `app/tests/program-screen-overlay-helpers.ts` loads them, and builds TEST-ONLY datasets for TEST-ONLY packages, pinned by TEST-ONLY index pins passed like registries.
- The Phase 2, 3C, and 3D tests now name TEST-ONLY lots instead of typed classes; their assertions about `map_covers_lot` are updated where Phase 3E supersedes them, and marked.

Earlier tests that pinned "nothing promoted" (0 human-verified, 46 pending, the old output hashes, d pending, d's rule not encoded) are updated where Phase 3E supersedes them, and marked. `program-screen-verification.test.ts` runs its verified-criterion checks on d, through the package and the computed overlay.

## Not in Phase 3E

- Promoting any criterion other than d.
- GOV §51178, and c's Route 1.
- The production ingestion path for reviewed lot geometry and overlay inputs: the case-scoped evidence store (D10) and a store for the overlay index and records. Until it exists, real parcels return `unknown` on d (see [the production gap](#the-production-gap-real-parcels-still-return-unknown)).
