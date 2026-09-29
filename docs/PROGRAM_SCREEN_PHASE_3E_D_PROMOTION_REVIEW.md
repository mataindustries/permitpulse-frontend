# Program Screen Phase 3E: promotion review of d, and the F1 lot-overlay fix

Phase 3E reviews one criterion for the first production promotion: d, `la_shra.high-fire-hazard-severity-zone`. The reviewer's first answer was **KEEP D PENDING**: the audit found F1, and the reviewer asked for F1 to be fixed and the audit re-run before any promotion decision.

- **Nothing is promoted.** `human_verified` = 0 and `pending_human` = 46. d stays `pending_human`, with no encoded rule and no human verification record. c, e, f, and g are unchanged.
- **The CAL FIRE / OSFM package is unchanged**: its manifest, members, registration, and pins (`calfire-sra-fhsz-2023-09-29`, Phase 3D).
- **The evaluator and public-demo output hashes are unchanged**: `68341529825b41e7dcd3b25a5daec94385fe6641e07cc03d29003c94c256b45a` and `11081860902438dd881cb743c98de30f4b4c3c425675a6e0eb2b6d41474a84a1`. The fictional fixture has no authority sidecar and no lot overlay.

Tests: `app/tests/program-screen-d-promotion-review-3e.test.ts`.

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

**Promotion gates are unchanged.** d still lists exactly the seven Phase 3B gates; only the two reviewer gates are unmet. The `prc_4202_map_coverage_and_legend_class_recorded` check now rests on computed lot coverage.

## Tests and test data

- `app/tests/program-screen-overlay.global-setup.ts` re-derives the overlay index from the archive bytes in Node on every run (the tests run in workerd, which cannot load the 36 MB archive) and extracts every record whose extent meets a TEST-ONLY lot's box. The tests load both through `loadOverlayDatasetView`, so nothing provided is trusted as it is.
- `app/fixtures/program-screen/test-only-lot-geometries/`: fictional lots placed at real locations in FHSZSRA_23_3: wholly High, Very High, Moderate; Very High + Moderate; High + Moderate; High + Very High; part Moderate / part outside SRA; part High / part outside SRA; outside SRA (far away, and beside SRA features); an L-shaped lot with a hole; a self-crossing lot; and a lot stated in another CRS.
- `app/tests/program-screen-overlay-helpers.ts` loads them, and builds TEST-ONLY datasets for TEST-ONLY packages, pinned by TEST-ONLY index pins passed like registries.
- The Phase 2, 3C, and 3D tests now name TEST-ONLY lots instead of typed classes; their assertions about `map_covers_lot` are updated where Phase 3E supersedes them, and marked.

## Proposed promotion (not applied)

If the reviewer approves, d gains its encoded rule (`true` → `disqualifying_per_source`, `false` → `consistent_with_source`), a judgment question, a d-only citation dated on the approval day (the shared memo citation, 2026-09-17, predates the memo capture of 2026-09-27), and a human verification record citing the Phase 3B d decision and the SHRA memo capture. Expected then: `human_verified` = 1, `pending_human` = 45. The record is not written until the reviewer approves.

## Not in Phase 3E

- Promoting d, or any other criterion.
- GOV §51178, and c's Route 1.
- The case-scoped evidence store for lot geometry (D10) and an external store for the overlay index and records. Until they exist, no production caller supplies overlay inputs, so no real lot can establish either hazard fact.
