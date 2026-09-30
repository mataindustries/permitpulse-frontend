# Program Screen Phase 3F: reviewed case geometry and computed CAL FIRE inputs

## Evidence decision and Vidor acceptance state

For APN `4330005041`, PIN/PIND `132A165 351` / `132A165-351`, the recorded reference is Tract 11106, Lot 85, Map Book 203 pages 19–22. The BOE geometry has been captured privately. **`legal_lot_identity = not_established` remains the case decision.** The existing evidence does not establish that this assessor parcel presently consists of exactly one unchanged legal Lot 85. Geometry review and current legal-lot identity review are separate human decisions. The GIS polygon is not a survey.

Phase 3F exercises this decision through a production service and TEST-ONLY fixtures. No real Vidor geometry is normalized, uploaded, or included in this repository. A synthetic case with valid reviewed EPSG:3310 geometry, all verified CAL FIRE candidates, computed `whole_lot` coverage and `FHSZ_Descr = High` still gives **d = `unknown`** when its stored legal identity is `not_established`. The computed geometry/coverage can be shown as diagnostic evidence; it cannot establish current legal-lot identity.

**TODO — Request 3F-3:** obtain the latest recorded vesting deed and review the current legal description, its references, and relevant subsequent instruments. A later human review may upgrade Vidor's `legal_lot_identity` only if that evidence supports it. A deed alone does not prove the absence of later changes.

## Architecture

| Addition | Responsibility |
| --- | --- |
| `tools/program-screen/normalize-reviewed-lot.py` | Offline ingestion CLI. Verify exact source/metadata bytes first; use captured CRS and one pinned explicit PROJ pipeline; serialize and separately hash normalized geometry; emit a hash-linked receipt. |
| `app/src/shared/program-screen/normalization-profile.json` | Approved operation, implementation, database, native resources and serialization pins. Runtime reads metadata only. |
| `app/src/shared/program-screen/reviewed-lot.ts` | Strict case record contract; verify source, metadata, receipt, normalized geometry, identity/provenance references, dates and supersession. Accept only valid reviewed EPSG:3310 geometry. |
| `app/src/worker/program-screen/case-evidence.ts` | Adapter for the existing private `EVIDENCE_FILES` R2 binding; authenticated case access; hash-addressed files and CAL FIRE inputs; immutable review history and conditional publication of the current review. |
| `app/src/worker/program-screen/evaluate-case.ts` | Production entry `evaluateCaseProgramScreen(bindings, actor, caseId, input)`. Load verified reviewed geometry and candidate records, compute coverage/semantic labels, construct the computed High observation and authority block, then call the unchanged Program Screen evaluator. |
| `app/tests/program-screen-case-evidence-3f.test.ts` | Integration through the real R2 adapter, existing case authorization and the unchanged pinned CAL FIRE package, using synthetic case evidence. |

The production entry authorizes the case through the existing `getCaseForActor` boundary. Ingestion callers use `openProgramScreenCaseStore(..., "write")`, which applies the existing `getEditableCaseForActor` boundary. `ingestReviewedLot` also requires the named review's `reviewer_user_id` to equal the authenticated writer. These are internal service interfaces; this phase adds no public upload/download route or UI publication. The public evaluator/demo caller is unchanged.

The production entry uses the shipped authority registry and CAL FIRE package. It accepts canonical observations and existing non-hazard authority blocks. Caller-supplied hazard authority is discarded after schema validation; manual observations remain available for conflict detection. Only a server-computed record receives the hazard authority block. `classes_on_lot` cannot be supplied in the reviewed record. `map_covers_lot` remains `not_established` in the generated block; no gate treats it as authority. The legacy `coverage` compatibility field is derived from the computed fact and cannot establish coverage independently.

## Exact reviewed-lot record contract

Schema version: `program-screen-reviewed-lot-v1`. Every object is strict. All fields below are required; nullable fields must explicitly contain `null` when absent. See the executable schema and the complete `app/fixtures/program-screen/phase-3f-test-only/test-only-reviewed-lot.json` example.

```typescript
type CaseFileRef = {
  store: "case_evidence_file";
  file_id: string; // 1–120 ASCII letters/digits/dot/underscore/hyphen, first alphanumeric
  sha256: string; // 64 lowercase hexadecimal characters
  bytes: number; // positive integer, at most 8 MiB
};

type ReviewedLotRecord = {
  schema_version: "program-screen-reviewed-lot-v1";
  review_id: string; // UUID
  case_id: string; // UUID, must equal the authorized storage case
  parcel: { apn: string; pin: string; pind: string | null }; // APN: exactly 10 digits
  legal_lot_reference: {
    subdivision_type: "tract";
    tract: string;
    lot: string;
    map_book: string;
    map_pages: { first: number; last: number }; // positive integers, first <= last
  };
  legal_lot_identity:
    | "parcel_is_one_legal_lot"
    | "parcel_and_legal_lot_differ"
    | "tied_or_multiple_lots"
    | "merger_or_resubdivision_pending_or_proposed"
    | "not_established";
  legal_identity_evidence: CaseFileRef[]; // at most 20; nonempty for parcel_is_one_legal_lot
  source_geometry: {
    file: CaseFileRef;
    metadata_file: CaseFileRef;
    crs: { wkid: number; latest_wkid: number | null; epsg: 3857 };
    identity_fields: { apn: string; pin: string }; // exact captured attribute names
  };
  normalized_geometry: {
    file: CaseFileRef;
    crs: "EPSG:3310";
    serialization: typeof approvedProfile.serialization; // exact literal, below
  };
  reprojection: {
    profile_id: "boe-3857-ca-south-3310-proj-9-9-0-v1";
    profile_sha256: string;
    proj_version: "9.9.0";
    normalizer_version: "1.0.0";
    pipeline_sha256: "e78dcde94b61df7bdefc85b9e36b69312af28b17ea348ac2bae32ca49c4f6ab3";
    receipt_file: CaseFileRef;
  };
  source_provenance: {
    agency: string;
    requested_url: string;
    final_url: string;
    retrieved_at_utc: string; // ISO timestamp with offset
    evidence_files: CaseFileRef[]; // 1–20, e.g. original captures/headers/provenance
  };
  review: {
    reviewer: { kind: "human"; name: string; role: string };
    reviewer_user_id: string;
    reviewed_on: string; // valid YYYY-MM-DD
    next_review_on: string; // strictly after reviewed_on; exclusive expiry
  };
  state: {
    status: "current" | "stale" | "superseded" | "unreviewed";
    superseded_by: string | null; // review UUID
  };
};
```

Ordinary text fields are trimmed, nonempty and at most 256 characters; the reviewer uses the existing authority-reviewer schema (nonempty name and role, at most 300 characters each). URLs must parse as URLs. Source `wkid`/`latest_wkid` must match the captured layer metadata. EPSG:3857 is accepted directly; ESRI aliases 102100/102113 require captured `latestWkid: 3857`. Query and feature CRS declarations are also checked if present. No CRS or address match is inferred.

`parcel.apn` and `legal_lot_reference` have separate meanings. Matching APN/PIN identifies the captured assessor/GIS feature. The structured recorded reference identifies the historic mapped lot. An established current legal identity requires the human's private evidence references, which are also byte/hash verified. No schema check decides the legal sufficiency of a deed or map.

The normalization receipt has version `program-screen-normalization-receipt-v1`: profile ID/hash; implementation object; source SHA, metadata SHA and captured CRS; target EPSG, SHA, byte count and serialization; exact operation object; resource pins; `network_enabled: false`; normalization UTC time. Ingestion compares its implementation/operation/resources to the shipped profile and links it to the exact source/normalized files. Source retrieval must precede normalization, and normalization must precede review. The receipt is evidence for the authenticated human review, not an automatic legal-identity approval.

## Private evidence storage

Use the existing private R2 binding **`EVIDENCE_FILES`**, bucket **`permitpulse-evidence-files`**. No bucket configuration or public access setting changes.

```text
<case UUID>/program-screen/blobs/<SHA-256>
<case UUID>/program-screen/reviews/<review UUID>-<manifest SHA-256>.json
<case UUID>/program-screen/current-review.json
<case UUID>/program-screen/calfire/index-<pinned index SHA-256>.txt
<case UUID>/program-screen/calfire/record-<pinned record SHA-256>.bin
```

Original BOE response, captured metadata, normalization receipt, normalized geometry and legal-identity/provenance evidence all use private case-scoped file references. Files are hash addressed inside the case; an identical digest in another case cannot cross the case boundary. Every consumer recomputes hashes. The current review carries a manifest hash and R2 ETag. Publication requires the expected ETag (or initial nonexistence); a changed review during loading fails closed. Review history is retained, and `invalidateReview` can mark it stale or superseded. Missing storage cannot supply authoritative geometry.

Offline real-case working files belong outside the checkout or under the existing ignored `.private/` path. The CLI refuses unmarked real-case output in the public checkout. The committed fixtures all use synthetic identifiers and explicit TEST-ONLY source annotations. The committed grid is the approved public PROJ resource, not case evidence.

## Approved offline reprojection

Selection was re-audited before transforming any geometry with PROJ **9.9.0**, database layout **1.7**, **EPSG v13.102 (2026-08-27)**. LA AOI W/S/E/N: **`[-118.50, 33.90, -118.20, 34.20]`**. `--hide-ballpark`, default superseded exclusion, strict AOI containment and `--grid-check discard_missing` were used. The independent C API audit explicitly disabled ballpark and discarded superseded operations. All checks used `PROJ_NETWORK=OFF`; this PROJ build also has Curl disabled.

After acquiring only `us_noaa_cshpgn.tif`, PROJ recognizes that grid and the preferred route is locally instantiable. There are **11** applicable non-ballpark, non-superseded metadata candidates and **3** locally usable candidates:

| Datum operation component(s), following inverse EPSG:3856 and preceding EPSG:10420 | Stated accuracy | Required grids | Locally usable |
| --- | --- | --- | --- |
| inverse EPSG:1901 + inverse derived EPSG:1477 | **1.05 m** | `us_noaa_cshpgn.tif` | **yes, selected** |
| inverse EPSG:1901 + inverse derived EPSG:8556 | 1.05 m | `us_noaa_nadcon5_nad83_1986_nad83_harn_conus.tif` | no |
| inverse derived EPSG:1750 | 2 m | `us_noaa_cshpgn.tif` | yes |
| inverse EPSG:1580 + inverse derived EPSG:8556 | 2.05 m | `us_noaa_nadcon5_nad83_1986_nad83_harn_conus.tif` | no |
| inverse EPSG:1188 | 4 m | none | yes |
| inverse derived EPSG:15851 + derived EPSG:1241 | 5.15 m | `us_noaa_conus.tif` | no |
| inverse derived EPSG:15851 + derived EPSG:8555 | 5.15 m | `us_noaa_conus.tif`, `us_noaa_nadcon5_nad27_nad83_1986_conus.tif` | no |
| inverse EPSG:1175 + derived EPSG:8555 | 7.15 m | `us_noaa_nadcon5_nad27_nad83_1986_conus.tif` | no |
| inverse EPSG:1175 + derived EPSG:1241 | 7.15 m | `us_noaa_conus.tif` | no |
| inverse EPSG:1173 + derived EPSG:8555 | 10.15 m | `us_noaa_nadcon5_nad27_nad83_1986_conus.tif` | no |
| inverse EPSG:1173 + derived EPSG:1241 | 10.15 m | `us_noaa_conus.tif` | no |

A diagnostic enumeration including superseded operations has 13 candidates: the two extra routes use superseded EPSG:1900, replaced by EPSG:1901. Both remain excluded. No new equal-or-better locally usable route displaces the proposed California South 1.05 m route. This satisfies the user's conditional operation approval. Other grid names above are metadata only; none was downloaded.

Selected route: inverse Popular Visualisation Pseudo-Mercator → inverse NAD83(HARN) to WGS 84 (3) → inverse NAD83 to NAD83(HARN) (4) → California Albers. Area of use: **California south of 36.5°N**, bbox **`[-121.98, 32.53, -114.12, 36.50]`**. Stated operation accuracy is **1.05 m**; it does not describe survey accuracy or accuracy of the BOE source. EPSG:1901 includes registry approximation assumptions about WGS 84/ITRF96 and NAD83 realizations; no source epoch or realization is invented. This is the same reviewed datum choice.

Exact resolved pipeline, pinned as UTF-8 with LF terminator:

```text
+proj=pipeline
  +step +inv +proj=webmerc +lat_0=0 +lon_0=0 +x_0=0 +y_0=0 +ellps=WGS84
  +step +proj=push +v_3
  +step +proj=cart +ellps=WGS84
  +step +inv +proj=helmert +x=-0.991 +y=1.9072 +z=0.5129 +rx=-0.0257899075194932
        +ry=-0.0096500989602704 +rz=-0.0116599432323421 +s=0
        +convention=coordinate_frame
  +step +inv +proj=cart +ellps=GRS80
  +step +proj=pop +v_3
  +step +inv +proj=hgridshift +grids=us_noaa_cshpgn.tif
  +step +proj=aea +lat_0=0 +lon_0=-120 +lat_1=34 +lat_2=40.5 +x_0=0 +y_0=-4000000
        +ellps=GRS80
```

The full operation audit, exact query arguments, per-candidate grid availability/pipelines and resource hashes are in `tools/program-screen/proj/operation-audit.json`. The offline build recipe and CLI procedure are in `tools/program-screen/README.md`. Native tooling stays outside the application; Cloudflare evaluation only verifies stored EPSG:3310 bytes and computes the existing overlay. Runtime never loads PROJ, selects an operation or reprojects.

### Resource pins

| Resource | SHA-256 |
| --- | --- |
| PROJ 9.9.0 source archive | `791a0610547eeabb17006cfd49cdbd2034f3240f47ed5e88a1031811f4e2bcf3` |
| LibTIFF 4.7.2 source archive | `672bd7d10aee4606171afb864f3570b83340f6a33e2c186dc0512f7145ffdf6a` |
| `proj.db` (10,551,296 bytes) | `082d5e6acc6b125d64fe77788db27455103229b05c541bc0343db89a7aa90a9d` |
| `proj.ini` | `b95ebf0d007339244483d65d571cd887a51806e2bd2c1ab7f47b897d25320d65` |
| **Only grid: `us_noaa_cshpgn.tif` (6,834 bytes)** | `d54183c832e0366fc558147961bd8ae7d0dd3b5ae945069afd6a37a5a5c604c9` |
| Grid response headers | `6f04810aaa98aec7fe1ffbfce2b3c8504d9bbcd465134ab38e0100b9b905be09` |
| `libproj.so.25.9.9.0` | `ae6194010e96ec7d021c47d26bee0f3e2d1567fdc3481b704f802179ebd67806` |
| `libtiff.so.6.3.0` | `1d3ac3c6fab7fdfef9b694430402321e02489041d5a0f2c88f1c77c017d64633` |
| `libsqlite3.so.0.8.6` | `eac351cf84d688d1f9235e6165bd57555b31a491cd2f65e0dca67daa69036370` |
| `libz.so.1.3` | `9b64150b28505a33d6bc3ecf709c279f6de97a1c184dbda65d06ee4537f6d286` |
| `libm.so.6` | `1b87a1a50b496cfead2b0ad134c2ff536705c82608db240c7e8aa48d6c0e4217` |
| Exact pipeline (541 bytes) | `e78dcde94b61df7bdefc85b9e36b69312af28b17ea348ac2bae32ca49c4f6ab3` |
| Offline normalizer 1.0.0 | `1d01f43a5662a333f45335a2d4c1f8645a15a5280efc56e103774f58ab57940d` |
| Approved profile | `a72210c70aa3e143845385fc0f3b80cbf3a5653d3614ed6c3c724a5823c0c6c4` |

Requested and final grid URL: `https://cdn.proj.org/us_noaa_cshpgn.tif`; HTTP 200. Retrieval UTC: `2026-09-30T03:53:25.775416+00:00`, preserved curl download-file modification time; the receipt explicitly states this time basis. Exact bytes, unmodified response headers and provenance JSON are preserved in `tools/program-screen/proj/resources/`.

### Serialization and determinism

Exact serialization literal: `pp-lot-json-v1: UTF-8; fixed key order; compact JSON; CPython 3.12.1 shortest round-trip binary64 numbers; LF terminator; preserve ring and vertex order; no rounding or simplification`.

The output is `program-screen-lot-geometry-v1`, one Polygon with `crs: "EPSG:3310"`. Serialization does not round, simplify or reorder vertices. Separate CLI processes produce identical geometry bytes; normalization receipt timestamps intentionally record each run. All three committed synthetic normalized fixtures have been reproduced twice with the approved pipeline:

| TEST-ONLY geometry | SHA-256 |
| --- | --- |
| LA AOI square (305 bytes) | `e5edc2c7b145b7eb39fd480922c35a29109adcae697a714ffd18e45dd9fe9c10` |
| Full SRA High square (307 bytes) | `be25919869c1a0fdd1d856ebf18fdb16ca83ac7a758f7551704b5f3dd2ceffeb` |
| Partial SRA square (304 bytes) | `225d03173861146a651d6d3f8e2bf3afc4c0d6c4edc9c0368410d2a620dce9b7` |

The SRA fixtures are fictional locations in the selected operation's California South area, derived from the existing synthetic Phase 3E fixtures, then normalized through this pipeline. They model the Vidor evidence state, not Vidor's position or shape.

## Overlay path and fail-closed checks

The private store loads the unchanged pinned overlay index. Its hash is checked before selecting candidates by the reviewed lot's bbox. Each candidate's bytes are verified against the index. Missing candidates remain missing in the view; `computeLotOverlay` returns `not_established` instead of treating omission as absence. Both lot and dataset must be EPSG:3310. The semantic class field must be `FHSZ_Descr`, with labels mapped by the registered package.

The existing exact geometry machinery computes `whole_lot` / `part_of_lot` / `none` / `not_established`. A High boolean is generated only with current one-legal-lot identity and whole-lot SRA coverage. All High gives true; wholly other known classes gives false; a mix containing High gives unknown. Partial or outside-SRA coverage gives unknown. The unchanged authority gate independently checks the computed dataset/geometry result and the Phase 3E requirements before d runs.

Integration tests cover:

- unestablished legal identity despite valid normalized geometry and whole High coverage;
- missing geometry, source/normalized hash mismatch, wrong CRS and invalid geometry;
- stale, superseded, unreviewed, expired, foreign-case or changed reviewed manifests;
- unpinned normalization receipt;
- missing CAL FIRE candidate record/index, partial SRA coverage, outside SRA and superseded package;
- manual disagreement (conflict), typed overlay fields (refused), and caller hazard authority/coverage attestations that cannot replace the stored review;
- actual R2 ingestion/evaluation, conditional publication, supersession and existing case authorization.

The offline checks additionally prove source-byte verification precedes projection, captured wrong CRS is refused, missing/changed preferred grids cannot fall back, current-directory grids cannot shadow pinned resources, and unmarked real-case output cannot enter the public checkout.

## Preserved Phase 3E decisions and output pins

**d remains the sole `human_verified` criterion: 1 verified / 45 pending.** c remains pending; G1/G2 remain open. The CAL FIRE package, authority registry, Phase 3E rule and human-verification record are unchanged. No GOV §51178 route is added.

The Phase 3E regression suite reproduces these evaluator/demo output hashes before and after Phase 3F:

| Output | Before | After |
| --- | --- | --- |
| Evaluator | `156dd1f41964ab5beebcf3882e0a0d653cc5d778939033bf2b752dba1e86afbc` | `156dd1f41964ab5beebcf3882e0a0d653cc5d778939033bf2b752dba1e86afbc` |
| Public demo | `4dd2735bab875ad40b123fec72020e16442737bc6b5052eb55c5fba374b9a8a5` | `4dd2735bab875ad40b123fec72020e16442737bc6b5052eb55c5fba374b9a8a5` |

Verification: `npm run check` in `app/` passes typecheck, **1,369 tests across 42 files** (including **24 Phase 3F tests**), OS foundation verification and production build. The offline checker passes **9 checks**. Repository-root `npm run check` passes syntax checks and **351 public-site validations**. Phase 3F adds no runtime dependency or deployment change.
