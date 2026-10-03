# Offline reviewed-lot normalization

Real cases follow the [real-case operator runbook](#real-case-operator-runbook-phase-3m) at the end of this file.

Phase 3H adds the SRA topology safety derivative. It preserves the original
FHSZSRA_23_3 source geometry and package, using the same offline GDAL **3.10.3** /
GEOS **3.13.1** versions as Phase 3G. From the repository root:

```bash
/usr/bin/python3 tools/program-screen/export-sra-validity.py \
  app/fixtures/program-screen/official-sources/calfire-fhszsra-23-3-data/original.zip \
  /tmp/permitpulse-sra-validity.json
cd app
npm run program-screen:sra-overlay -- \
  --validity /tmp/permitpulse-sra-validity.json \
  --output /tmp/permitpulse-sra-overlay
```

The exporter checks the exact ZIP, decoder versions, record/FID association and
fresh validity inventory (233 invalid: 139 Very High, 70 High, 24 Moderate).
The builder independently matches every verdict to unchanged record hashes,
verifies the pinned manifest and final index, and writes source record bytes
only to `/tmp` or ignored `.private/`. Neither tool repairs source geometry or
automatically repins anything. The new index is 1.1.0; LRA stays 2.0.0.

Use `PP_SRA_PYTHON` (or the existing `PP_LRA_PYTHON`) to select the pinned Python
bindings during test setup. Runtime requires no native tools. Missing old-case
derivatives yield unknown until the verified new index is privately ingested.
For mutation verification, run
`python tools/program-screen/check-sra-validity-mutations.py --output /tmp/permitpulse-sra-mutations`
with a new temporary directory. See [the Phase 3H safety record](../../docs/PROGRAM_SCREEN_PHASE_3H_SRA_TOPOLOGY_SAFETY_FIX.md).

Phase 3G's LRA authority polygons have a separate offline decoder. It does not normalize a lot, reproject a source feature, or alter source geometry. With GDAL **3.10.3**, GEOS **3.13.1**, and the Python GDAL bindings installed, run from the repository root:

```bash
/usr/bin/python3 tools/program-screen/export-lra-filegdb.py \
  app/fixtures/program-screen/official-sources/calfire-fhszlra-25-1-all-data/original.zip \
  /tmp/permitpulse-lra-features.ndjson
cd app
npm run program-screen:lra-overlay -- \
  --features /tmp/permitpulse-lra-features.ndjson \
  --output /tmp/permitpulse-lra-overlay
```

The exporter refuses changed ZIP/XML bytes or decoder versions. The builder independently checks native active FIDs, full semantic labels, the metadata association, and the final reviewed index hash before writing. Use `PP_LRA_PYTHON` to select the installed Python executable for test setup; its linked GDAL/GEOS versions must match. The full test suite re-derives the index from the original archive. Neither GDAL nor GEOS is needed in production. All 119 invalid geometries remain in the index. Thirty native curved features retain their WKB; 28 valid curves are marked unreadable by the straight-edge evaluator, with two already among the 119 invalid features. Candidate validity is evaluated per lot, with no source repair. See [the Phase 3G package record](../../docs/PROGRAM_SCREEN_PHASE_3G_GOV_51178_PACKAGE.md).

The capture CLI can take `--headers <original header dump>` for metadata v2. It stores the exact UTF-8 header bytes, length and SHA-256 inside `metadata.json`, preserving the three-file capture layout. The requested URL is kept exactly, including query parameters. A single HTTP 200 response without Location permits the final URL to be recorded as the requested URL with the explicit basis `inferred_no_redirect_from_supplied_headers`. A redirect trace requires `--final-url <original effective URL>`; it is never guessed. Preserve the original `--retrieved-at` value and original source file. These transport records are provenance, not additional operative authority members.

This tooling is for offline ingestion/development. Program Screen runtime accepts only reviewed, hash-verified EPSG:3310 files. No PROJ runtime package is added to the Cloudflare app.

## Pinned audited installation

The audited installation is `/tmp/permitpulse-proj-review/install`, with LibTIFF in `/tmp/permitpulse-proj-review/tiff-install`. It is PROJ **9.9.0**, LibTIFF **4.7.2**, Python **3.12.1**, Linux x86_64. Normalizer **1.0.1** rejects native loader overrides and verifies the libraries actually mapped into the process before transforming. CMake was **3.28.3** and the compiler was Ubuntu GCC **13.3.0-6ubuntu2~24.04.1**. The exact database, pipeline, libraries and only grid are pinned in `app/src/shared/program-screen/normalization-profile.json`. The CLI verifies each resource file pin before loading PROJ.

Tooling sources used in this audit:

| Source | SHA-256 |
| --- | --- |
| [PROJ 9.9.0 archive](https://download.osgeo.org/proj/proj-9.9.0.tar.gz) | `791a0610547eeabb17006cfd49cdbd2034f3240f47ed5e88a1031811f4e2bcf3` |
| [LibTIFF 4.7.2 archive](https://download.osgeo.org/libtiff/tiff-4.7.2.tar.gz) | `672bd7d10aee4606171afb864f3570b83340f6a33e2c186dc0512f7145ffdf6a` |

The [GitHub release asset](https://github.com/OSGeo/PROJ/releases/download/9.9.0/proj-9.9.0.tar.gz) of PROJ 9.9.0 has the same SHA-256. The build recipe below consumes locally preserved archives; it does not download resources. Any rebuilt resource that differs from its approved hash is refused. Updating a binary/database/profile requires an explicit review and new pins; version numbers alone do not authorize a replacement. Keep the approved installation/archive as offline tooling evidence outside the public checkout.

From the repository root, with the verified archives already in the audit's `downloads/` directory:

```bash
set -euo pipefail
export PROJ_NETWORK=OFF
PP_PROJ_AUDIT=/tmp/permitpulse-proj-review
PP_PUBLIC_REPO="$PWD"
# proj.db generator: a SQLite 3.45.3 command-line program (see "Database generator" below), e.g.
# micromamba create -y -p /tmp/pp-sqlite-3.45.3 -c conda-forge --override-channels sqlite=3.45.3
PP_SQLITE3_GENERATOR=/tmp/pp-sqlite-3.45.3/bin/sqlite3
"$PP_SQLITE3_GENERATOR" --version | grep -q '^3\.45\.3 '

sha256sum --check <<'PINS'
791a0610547eeabb17006cfd49cdbd2034f3240f47ed5e88a1031811f4e2bcf3  /tmp/permitpulse-proj-review/downloads/proj-9.9.0.tar.gz
672bd7d10aee4606171afb864f3570b83340f6a33e2c186dc0512f7145ffdf6a  /tmp/permitpulse-proj-review/downloads/tiff-4.7.2.tar.gz
d54183c832e0366fc558147961bd8ae7d0dd3b5ae945069afd6a37a5a5c604c9  tools/program-screen/proj/resources/us_noaa_cshpgn.tif
PINS

mkdir -p "$PP_PROJ_AUDIT/source"
tar -xzf "$PP_PROJ_AUDIT/downloads/proj-9.9.0.tar.gz" -C "$PP_PROJ_AUDIT/source"
tar -xzf "$PP_PROJ_AUDIT/downloads/tiff-4.7.2.tar.gz" -C "$PP_PROJ_AUDIT/source"

cmake -S "$PP_PROJ_AUDIT/source/tiff-4.7.2" -B "$PP_PROJ_AUDIT/tiff-build" \
  -DCMAKE_BUILD_TYPE=Release -DCMAKE_INSTALL_PREFIX="$PP_PROJ_AUDIT/tiff-install" \
  -Dtiff-tools=OFF -Dtiff-tests=OFF -Dtiff-docs=OFF -Dtiff-contrib=OFF \
  -Djpeg=OFF -Djbig=OFF -Dzstd=OFF -Dwebp=OFF -Dlerc=OFF \
  -Dlzma=OFF -Dlibdeflate=OFF -Dzlib=ON
cmake --build "$PP_PROJ_AUDIT/tiff-build" --parallel 2
cmake --install "$PP_PROJ_AUDIT/tiff-build"

cmake -S "$PP_PROJ_AUDIT/source/proj-9.9.0" -B "$PP_PROJ_AUDIT/build" \
  -DCMAKE_BUILD_TYPE=Release -DCMAKE_INSTALL_PREFIX="$PP_PROJ_AUDIT/install" \
  -DENABLE_CURL=OFF -DENABLE_TIFF=ON -DNLOHMANN_JSON_ORIGIN=internal \
  -DBUILD_TESTING=OFF -DBUILD_EXAMPLES=OFF -DBUILD_PROJINFO=ON \
  -DBUILD_CCT=OFF -DBUILD_CS2CS=OFF -DBUILD_GEOD=OFF -DBUILD_GIE=OFF \
  -DBUILD_PROJ=OFF -DBUILD_PROJSYNC=OFF \
  -DEXE_SQLITE3="$PP_SQLITE3_GENERATOR" \
  -DTIFF_INCLUDE_DIR="$PP_PROJ_AUDIT/tiff-install/include" \
  -DTIFF_LIBRARY_RELEASE="$PP_PROJ_AUDIT/tiff-install/lib/libtiff.so" \
  -DCMAKE_INSTALL_RPATH="$PP_PROJ_AUDIT/tiff-install/lib"
cmake --build "$PP_PROJ_AUDIT/build" --parallel 2
cmake --install "$PP_PROJ_AUDIT/build"
echo "082d5e6acc6b125d64fe77788db27455103229b05c541bc0343db89a7aa90a9d  $PP_PROJ_AUDIT/install/share/proj/proj.db" | sha256sum --check

cp "$PP_PUBLIC_REPO/tools/program-screen/proj/resources/us_noaa_cshpgn.tif" \
  "$PP_PROJ_AUDIT/install/share/proj/us_noaa_cshpgn.tif"
```

### Database generator (proj.db)

The canonical `proj.db` (10,551,296 bytes, `082d5e6acc6b125d64fe77788db27455103229b05c541bc0343db89a7aa90a9d`) is reproducibly generated from the pinned PROJ 9.9.0 source when the database-generation step uses **SQLite 3.45.3**. That step is the `sqlite3` command-line program named by the CMake variable `EXE_SQLITE3`, which executes PROJ's SQL scripts into `proj.db` at build time. With SQLite **3.45.1** the same step generated `436d80f4a927969ec1b220783a32df68534ab8fdff06196537954f241462c988`. The difference was SQLite's last-writer version field: header bytes 96–99 hold the `SQLITE_VERSION_NUMBER` of the library that last wrote the file (3045003 versus 3045001), and that is the only differing byte. Phase 3M re-confirmed both digests from the archive above with conda-forge `sqlite` 3.45.3 and 3.45.1 programs.

- SQLite 3.45.3 is proven to reproduce the canonical `proj.db` bytes.
- The SQLite binary historically used to generate the canonical database is NOT proven. This is a reproducibility result, not proof of historical provenance.

The generator executable and the runtime library are separate requirements. The normalizer's runtime pin is the system `libsqlite3.so.0.8.6` (`eac351cf84d688d1f9235e6165bd57555b31a491cd2f65e0dca67daa69036370`), which it verifies as actually mapped into its process. The generator only writes `proj.db` during the build and is never loaded by the normalizer. Matching one does not satisfy the other: keep libproj linked against the pinned system library, and never put the generator's library directory on `LD_LIBRARY_PATH` (the normalizer refuses loader overrides).

The grid bytes, response headers, requested/final URL, retrieval UTC time, byte count and SHA are preserved in `proj/resources/`. The UTC receipt transparently uses the preserved curl download-file modification time. No other candidate grid was acquired. PROJ has no Curl support and all calls also set `PROJ_NETWORK=OFF`.

## Operation selection audit

`proj/operation-audit.json` records the exact LA AOI, enumeration arguments, all 11 non-ballpark/non-superseded candidates and grid availability, 3 locally usable routes, 2 excluded superseded routes, selected pipeline and all resource hashes. The same California South **1.05 m** route is selected and locally usable after the one approved grid acquisition. The other 1.05 m candidate needs an unavailable NADCON5 grid; it remains unavailable. The 2 m and 4 m available routes do not displace the approved route.

To reproduce the local enumeration in the isolated audited installation:

```bash
export PROJ_NETWORK=OFF
export PROJ_DATA=/tmp/permitpulse-proj-review/install/share/proj
export PROJ_USER_WRITABLE_DIRECTORY=/tmp/permitpulse-proj-review/user-data
export PROJ_SKIP_READ_USER_WRITABLE_DIRECTORY=YES
export PROJ_ONLY_BEST_DEFAULT=ON
mkdir -p "$PROJ_USER_WRITABLE_DIRECTORY"
cd "$PROJ_DATA"
/tmp/permitpulse-proj-review/install/bin/projinfo \
  --main-db-path "$PROJ_DATA/proj.db" \
  -s EPSG:3857 -t EPSG:3310 --bbox -118.50,33.90,-118.20,34.20 \
  --spatial-test contains --crs-extent-use intersection \
  --hide-ballpark --pivot-crs always --grid-check discard_missing -o PROJ,PROJJSON
```

For the metadata inventory use `--grid-check none`. `--show-superseded --summary` was used only as an audit diagnostic; superseded operations are excluded from the approved selection. The normalizer never enumerates or selects an operation: it instantiates only `proj/approved-pipeline.proj`, checks its hash and refuses failure. This prevents operation fallback after approval.

## Normalize a TEST-ONLY capture first

From the repository root with the pinned installation available:

```bash
python tools/program-screen/check-normalization.py \
  --proj-prefix /tmp/permitpulse-proj-review/install \
  --tiff-prefix /tmp/permitpulse-proj-review/tiff-install
```

This makes two independent normalization runs for each of three synthetic source files and compares exact normalized bytes to the committed pins. It checks independently variable receipt timestamps, source/metadata verification, wrong CRS, missing/altered grids, database/library/pipeline mutations, loader overrides, forced network-off behavior, directory shadowing and the private-output boundary. It fetches nothing. The 16 checks pass on the audited installation.

Example single-run CLI:

```bash
PROJ_NETWORK=OFF python tools/program-screen/normalize-reviewed-lot.py \
  --source app/fixtures/program-screen/phase-3f-test-only/test-only-source.json \
  --source-sha256 3ac32e9f67680951443984d1d4320cf3dcf3cf83f77ac35347041086a9b70ae4 \
  --metadata app/fixtures/program-screen/phase-3f-test-only/test-only-metadata.json \
  --metadata-sha256 c5fe73818a84f1da357130a3d54845cdab49e8a46c022cd07c30aa958dc5396b \
  --apn 0000000001 --pin-value TEST-ONLY-PIN-3F \
  --output-dir /tmp/permitpulse-test-only-normalized-lot \
  --proj-prefix /tmp/permitpulse-proj-review/install \
  --tiff-prefix /tmp/permitpulse-proj-review/tiff-install
```

`normalized.json` is fixed-key compact UTF-8 JSON with CPython 3.12.1 shortest round-trip binary64 numbers and a trailing LF. Rings and vertices preserve source order. Its own SHA differs from the source SHA. `normalization-receipt.json` links both hashes, captured CRS, metadata SHA, target bytes/serialization, profile, operation, implementation and resource pins, and preserves the source/metadata TEST-ONLY marker. Receipt timestamps record each run, so geometry determinism does not require receipts to have identical timestamps or receipt hashes. Production rejects TEST-ONLY evidence; the integration suite admits it only in non-production test mode.

## Production ingestion

Real source files, metadata and expected hashes are supplied from preserved private evidence. The caller selects exactly one captured feature by explicit APN/PIN attribute fields; there is no address matching. Source layer metadata must state EPSG:3857 (or an explicit 102100/102113 alias with `latestWkid: 3857`). Unsupported CRS, curves, Z/M, nonfinite coordinates or geometry outside the approved operation area are refused. Use output outside the checkout or under ignored `.private/`.

Phase 3K adds the operator workflow: authenticated, administrator-only HTTP endpoints under `/api/v1/program-screen/cases/:caseId/preparation`. They store the offline outputs byte for byte and check them; the Worker never normalizes, reprojects or fetches anything. Every body is raw bytes or JSON (no multipart, no content encoding), and every upload's SHA-256 must equal the digest in its path.

1. Normalize offline through the pinned CLI and review the source/normalized geometry and receipt. Keep the legal-identity decision explicit; normalization cannot make it.
2. `PUT .../blobs/<sha256>` (`application/octet-stream`, at most 8 MiB) for each source, metadata, normalized, receipt, provenance and legal-identity file. Legal-identity evidence must be a PDF, TIFF, PNG or JPEG document separate from every geometry input.
3. `PUT .../calfire/index/<sha256>` (`text/plain; charset=utf-8`, at most 4 MiB) for the unchanged shipped LRA and SRA indexes. Only the two shipped pins are accepted; the route and authority source come from the registries, never from the request.
4. `POST .../validate` with `{ "proposal": {...}, "expected_revision": null | "<revision>" }`. It writes nothing. It returns the server-completed review summary, diagnostics, and per route the candidate records the evaluator will read.
5. `PUT .../calfire/records/<sha256>` (`application/octet-stream`, at most 16 MiB), one record per request, for each listed candidate. A record is stored only where a stored pinned index lists its digest. Missing records are warnings: the evaluator keeps that route unknown.
6. `POST .../publish` with the same body once `valid` is true. The server supplies the review ID, case ID, reviewer (account name, the fixed role `Administrator (Program Screen reviewed-lot publication)` and user ID), `reviewed_on` (the server date), the EPSG:3310 CRS/serialization and every reprojection pin. `next_review_on` must fall 1 to 30 days after the server date. Publication repeats every check, records an audit row first and then uses the existing CAS publication; use `null` only for the first review.
7. `GET .../preparation` reports readiness; `POST .../invalidate` with `{ "expected_revision", "reason" }` marks the current review stale (audited, CAS-guarded).
8. Evaluate read-only with the unchanged Phase 3J `GET /api/v1/cases/:caseId/program-screen`. The server supplies the subject and the UTC calendar date; no caller evidence, authority, subject, registry, revision or date is accepted, and the response omits parcel, legal-lot, reviewer, file, hash and storage details.

The private writer (`openProgramScreenCaseStore(..., "write")`, `putFile`, `ingestCalFire`, `ingestReviewedLot`, `invalidateReview`) is the internal building block of these endpoints and is not exposed. The normalization receipt remains an authenticated administrator's attestation, not cryptographic proof. Production `AUTH_ENABLED` is `"false"`, so production callers currently receive 401. See `docs/PROGRAM_SCREEN_PHASE_3K_CASE_PREPARATION.md` for the contract, gate order, diagnostics and an operator `curl` runbook.

See `docs/PROGRAM_SCREEN_PHASE_3F_REVIEWED_CASE_EVIDENCE.md` for the exact contract, private keys, Vidor acceptance behavior and verification results.

## Real-case operator runbook (Phase 3M)

The first real Program Screen case passed end to end through the existing tools and the Phase 3K and 3J endpoints. This sequence preserves what that run taught and adds two local operator tools: `capture-la-landbase-parcel.py` (step 2) and `publication-readiness-guard.py` (step 16). Phase 3M changes no Worker, API, storage, evaluation, legal-lot rule, CAL FIRE route, normalization pin, criterion or verification record. Their offline checks use fictional data only and reach no external host: `python3 tools/program-screen/check-operator-tools.py` (CAP1–CAP8, READY1–READY14).

> **NEVER INFER LEGAL-LOT IDENTITY FROM** an APN, a PIN, an assessor parcel, a tract, a lot, a recorded map reference or GIS geometry. Capture, normalization, CAL FIRE hydration and the readiness guard cannot establish it; only a human review of separate legal evidence can. **If reviewed evidence does not establish legal-lot identity: `legal_lot_identity = not_established`.**

All case material lives in one owner-only directory outside the checkout. Nothing private is written beneath the repository and nothing real is committed. Public CAL FIRE derivatives use a separate, stable owner-only path under `/tmp`, as required by the unchanged builders. Keep the same neutral case slug and these paths throughout the run, including later shells. Run from the repository root:

```bash
set -euo pipefail
umask 077
export PP_CASE="$HOME/pp-private/<case>"   # a neutral slug, never an address or parcel number
export PP_CALFIRE="/tmp/pp-calfire-$UID/$(basename "$PP_CASE")"
```

### 1. Create the private case directory

```bash
install -d -m 700 "$HOME/pp-private" "$PP_CASE"
install -d -m 700 "$PP_CASE"/{capture,normalized,legal,api,wrangler-state}
install -d -m 700 "$PP_CALFIRE"
```

### 2. Capture the official parcel evidence

```bash
python3 tools/program-screen/capture-la-landbase-parcel.py \
  --layer-url 'https://maps.lacity.org/<service path>/MapServer/<layer id>' \
  --lookup-field '<attribute the layer is searched by>' --lookup-value '<parcel lookup value>' \
  --output-dir "$PP_CASE/capture"
```

The tool makes two HTTPS GET requests to the explicit official layer (host `maps.lacity.org`, path ending `MapServer/<id>` or `FeatureServer/<id>`): `?f=json` for the layer metadata, then `/query?where=<field> = '<value>'&outFields=*&returnGeometry=true&f=json` (add `--lookup-numeric` for an integer attribute). It sets no `outSR`, so the source CRS is preserved; it sends `Accept-Encoding: identity` and follows no redirect. The output directory must already exist, be empty, be yours with mode 700, and lie outside the checkout (or under ignored `.private/`); there is no default. It refuses, writing nothing, on any non-200 status, a redirect, a content encoding, a body that is not UTF-8 JSON, an ArcGIS `error` object, zero features, more than one feature, or a returned lookup attribute that differs from the request.

On success it writes, all mode 600: `layer-metadata.json` and `parcel-geometry.json` (the exact response bytes, never re-serialized); their `.headers.txt` (status line and headers in received order as parsed by Python `http.client`, in the dump format the capture CLI's `--headers` accepts); `capture-provenance.json` (requested and final URLs, HTTP status, retrieval start and end UTC, byte counts and digests); `capture-log.txt`; and `SHA256SUMS`. The log reports the feature count, the source CRS (layer extent, query response and feature), any returned true curves (`curveRings` are preserved byte for byte) and every returned attribute verbatim as a **source attribute**, never as a legal-lot conclusion. Record the layer URL and lookup field in your private case notes. If the log says `TRUE CURVES RETURNED`, stop: the pinned normalizer refuses curves, and a capture is never densified or edited.

### 3. Verify the capture checksums

```bash
python3 tools/program-screen/capture-la-landbase-parcel.py --verify "$PP_CASE/capture"
(cd "$PP_CASE/capture" && sha256sum --check --strict SHA256SUMS)
```

`--verify` also refuses a file that `SHA256SUMS` does not list.

### 4. Normalization environment gate: 16 / 16

With the [pinned audited installation](#pinned-audited-installation) and `python` on `PATH` being CPython 3.12.1:

```bash
python --version   # Python 3.12.1
env -u LD_LIBRARY_PATH -u LD_PRELOAD -u LD_AUDIT PROJ_NETWORK=OFF \
  python tools/program-screen/check-normalization.py \
    --proj-prefix /tmp/permitpulse-proj-review/install \
    --tiff-prefix /tmp/permitpulse-proj-review/tiff-install | tee "$PP_CASE/normalization-gate.txt"
grep -qx '16 offline checks passed; no network resources fetched.' "$PP_CASE/normalization-gate.txt"
```

Success is 16 `PASS:` lines followed by `16 offline checks passed; no network resources fetched.`

**If this gate fails: STOP.** Never alter a pin, substitute a dependency, hand-edit a receipt, or proceed with real parcel normalization. Rebuild the pinned installation from the recipe above and run the gate again.

### 5. Normalize

The expected digests come from the verified `SHA256SUMS`, never from re-hashing the files:

```bash
pinned() { awk -v f="$1" '$2 == f { print $1 }' "$PP_CASE/capture/SHA256SUMS"; }
env -u LD_LIBRARY_PATH -u LD_PRELOAD -u LD_AUDIT PROJ_NETWORK=OFF \
  python tools/program-screen/normalize-reviewed-lot.py \
    --source "$PP_CASE/capture/parcel-geometry.json" --source-sha256 "$(pinned parcel-geometry.json)" \
    --metadata "$PP_CASE/capture/layer-metadata.json" --metadata-sha256 "$(pinned layer-metadata.json)" \
    --apn '<APN attribute value>' --pin-value '<PIN attribute value>' \
    --apn-field '<APN attribute name>' --pin-field '<PIN attribute name>' \
    --output-dir "$PP_CASE/normalized" \
    --proj-prefix /tmp/permitpulse-proj-review/install --tiff-prefix /tmp/permitpulse-proj-review/tiff-install
```

Review the source geometry, `normalized.json` and `normalization-receipt.json`. Normalization identifies the captured GIS feature; it establishes nothing about the legal lot.

### 6. CAL FIRE derivation environment

The first real run derived the CAL FIRE indexes with GDAL **3.10.3** and GEOS **3.13.1**. One disposable environment, following the conda-forge convention of Phases 3G–3K:

```bash
micromamba create -y -p /tmp/pp-gdal-3.10.3 -c conda-forge --override-channels gdal=3.10.3 geos=3.13.1 python=3.12
gdalpy() { GDAL_DATA=/tmp/pp-gdal-3.10.3/share/gdal PROJ_DATA=/tmp/pp-gdal-3.10.3/share/proj /tmp/pp-gdal-3.10.3/bin/python "$@"; }
gdalpy -c 'from osgeo import gdal, ogr; print(gdal.__version__, ogr.GetGEOSVersionMajor(), ogr.GetGEOSVersionMinor(), ogr.GetGEOSVersionMicro())'
# 3.10.3 3 13 1
```

The same interpreter is `PP_SRA_PYTHON` / `PP_LRA_PYTHON` for the test suite. Its bundled PROJ serves only GDAL's CAL FIRE decoding; it is not the pinned normalization installation and is never passed to the normalizer or the gate.

### 7. Build and verify the pinned indexes

The existing exporters and builders run unchanged. The builders write only under `/tmp` or ignored `.private/`, and refuse to write when a derived index differs from its pin; never repin.

```bash
gdalpy tools/program-screen/export-sra-validity.py \
  app/fixtures/program-screen/official-sources/calfire-fhszsra-23-3-data/original.zip "$PP_CALFIRE/sra-validity.json"
gdalpy tools/program-screen/export-lra-filegdb.py \
  app/fixtures/program-screen/official-sources/calfire-fhszlra-25-1-all-data/original.zip "$PP_CALFIRE/lra-features.ndjson"
(cd app && npm run --silent program-screen:sra-overlay -- --validity "$PP_CALFIRE/sra-validity.json" --output "$PP_CALFIRE/sra")
(cd app && npm run --silent program-screen:lra-overlay -- --features "$PP_CALFIRE/lra-features.ndjson" --output "$PP_CALFIRE/lra")
PP_SRA_INDEX="$PP_CALFIRE/sra/index-224fafb7015bca3e93704e88ca212510f9f099bb50538bc211cc7494cfef7ada.txt"
PP_LRA_INDEX="$PP_CALFIRE/lra/index-5167cbf7029ea3fc051331d2c2de4d1611feb88783e38a852f678b94b275a716.txt"
sha256sum --check <<PINS
224fafb7015bca3e93704e88ca212510f9f099bb50538bc211cc7494cfef7ada  $PP_SRA_INDEX
5167cbf7029ea3fc051331d2c2de4d1611feb88783e38a852f678b94b275a716  $PP_LRA_INDEX
PINS
```

Phase 3M re-ran exactly this: 18,423 SRA and 9,752 LRA records, both index hashes exact. These are public CAL FIRE derivatives, not case evidence.

### 8. Start the local Worker with private Wrangler state

`npm run dev` and `npm run dev:build-week` keep local D1/R2 state in `app/.wrangler/state`, beneath the checkout. The three local migration scripts (`db:migrate:local`, `db:migrate:build-week-local`, `db:migrate:build-week-live-local`) apply D1 migrations with `--local` and no `--persist-to`, so their D1 state also stays there. `db:migrate:preview` applies migrations and `db:migrate:preview:list` lists them against remote preview D1 with `--env preview --remote --config .wrangler.preview.jsonc --no-x-provision`; they do not use local repository persistence. No production migration script is defined in `app/package.json`. A Wrangler D1 command with `--remote` targets the remote database selected by its configuration and environment, including production if configured, rather than local state.

The Vite plugin can move local persistence only through `persistState` in the tracked `vite.config.ts`, so a real case uses Wrangler's own `--persist-to` on the built Worker instead. `build-week-local` is the existing tracked local environment with authentication on (`APP_ENV=local`, `AUTH_ENABLED=true`, `AUTH_ALLOW_SIGNUP=true`, `BETTER_AUTH_URL=http://localhost:5173`) and a local-only bucket name.

```bash
printf 'BETTER_AUTH_SECRET=%s\n' "$(openssl rand -base64 32)" > "$PP_CASE/local.env"
cd app
CLOUDFLARE_ENV=build-week-local npx vite build
PP_WRANGLER=(--config dist/permitpulse_case_workspace/wrangler.json --local --persist-to "$PP_CASE/wrangler-state")
npx wrangler d1 migrations apply DB "${PP_WRANGLER[@]}"
npx wrangler dev "${PP_WRANGLER[@]}" --env-file "$PP_CASE/local.env" --ip 127.0.0.1 --port 5173
```

Leave the Worker running and continue in a second shell from `app/`. Re-export the same paths using the same case slug; reuse the indexes and record files already derived in step 7. Opening another shell requires no new directory or derivation:

```bash
set -euo pipefail
umask 077
export PP_CASE="$HOME/pp-private/<case>"   # the SAME neutral slug used above
export PP_CALFIRE="/tmp/pp-calfire-$UID/$(basename "$PP_CASE")"
export PP_SRA_INDEX="$PP_CALFIRE/sra/index-224fafb7015bca3e93704e88ca212510f9f099bb50538bc211cc7494cfef7ada.txt"
export PP_LRA_INDEX="$PP_CALFIRE/lra/index-5167cbf7029ea3fc051331d2c2de4d1611feb88783e38a852f678b94b275a716.txt"
test -r "$PP_SRA_INDEX" && test -r "$PP_LRA_INDEX"
PP_WRANGLER=(--config dist/permitpulse_case_workspace/wrangler.json --local --persist-to "$PP_CASE/wrangler-state")
```

Every Wrangler command for the case carries `--local --persist-to "$PP_CASE/wrangler-state"` and the built config: a local `wrangler d1` command without `--persist-to` uses `app/.wrangler/state`. Never use `--remote`, `--env preview`, a preview or production resource, or a deploy. `--env-file` supplies only the declared secret `BETTER_AUTH_SECRET`; it does not change configuration variables. State lands in `$PP_CASE/wrangler-state/v3/` (`d1`, `r2`, `cache`). Wrangler's own logs, which can contain command text, go under your home configuration directory (for example `~/.config/.wrangler/logs/`), outside the checkout. The only repository writes are the ignored build output `app/dist/` and its pointer `app/.wrangler/deploy/config.json`, code and configuration only; if `app/.dev.vars` exists, Vite also copies it into the ignored `app/dist/`, and it holds a local secret, never case evidence. This workflow never creates or changes `app/.wrangler/state`; one left by ordinary local development holds unrelated data and is never used for a real case.

### 9. Authenticate the local administrator

The stored reviewer name is the D1 user name, so sign up with the real reviewer's name. Signup is open only in this local environment; promotion is the same direct D1 update the test fixtures use.

```bash
O=http://localhost:5173 JAR="$PP_CASE/api/cookies.txt" PP_EMAIL='<local email>'
read -rs -p 'Local password: ' PP_PASSWORD; echo
jq -n --arg name '<reviewer full name>' --arg email "$PP_EMAIL" --arg password "$PP_PASSWORD" '{name: $name, email: $email, password: $password}' \
  | curl -sS --fail-with-body -c "$JAR" -H "origin: $O" -H 'content-type: application/json' --data-binary @- "$O/api/auth/sign-up/email" >/dev/null
npx wrangler d1 execute DB "${PP_WRANGLER[@]}" --command "UPDATE \"user\" SET role = 'admin' WHERE email = '$PP_EMAIL'"
jq -n --arg email "$PP_EMAIL" --arg password "$PP_PASSWORD" '{email: $email, password: $password}' \
  | curl -sS --fail-with-body -b "$JAR" -c "$JAR" -H "origin: $O" -H 'content-type: application/json' --data-binary @- "$O/api/auth/sign-in/email" >/dev/null
```

### 10. Create the case

```bash
CASE_ID=$(jq -n '{project_name: "<project>", client_name: "<client>", address: "<address>", city: "Los Angeles", jurisdiction: "City of Los Angeles"}' \
  | curl -sS --fail-with-body -b "$JAR" -H 'content-type: application/json' --data-binary @- "$O/api/v1/cases" | jq -er '.data.id')
BASE="$O/api/v1/program-screen/cases/$CASE_ID/preparation"
put() { curl -sS --fail-with-body -X PUT "$BASE/$1/$(sha256sum "$2" | cut -c1-64)" -b "$JAR" -H "content-type: $3" --data-binary @"$2"; echo; }
```

### 11. Upload the evidence blobs (each at most 8 MiB)

Legal-identity documents (PDF, TIFF, PNG or JPEG) go in `$PP_CASE/legal/` only when the human legal review relies on them.

```bash
for f in "$PP_CASE"/capture/{parcel-geometry.json,layer-metadata.json,parcel-geometry.headers.txt,layer-metadata.headers.txt,capture-provenance.json,capture-log.txt} \
         "$PP_CASE"/normalized/{normalized.json,normalization-receipt.json} "$PP_CASE"/legal/*; do
  if [ -f "$f" ]; then put blobs "$f" application/octet-stream; fi
done
```

### 12. Upload the pinned indexes (each at most 4 MiB)

```bash
put calfire/index "$PP_LRA_INDEX" 'text/plain; charset=utf-8'
put calfire/index "$PP_SRA_INDEX" 'text/plain; charset=utf-8'
```

### 13. Validate (writes nothing)

The body is the Phase 3K proposal (`docs/PROGRAM_SCREEN_PHASE_3K_CASE_PREPARATION.md`, section 6). This builder takes every file reference from the uploaded bytes and the provenance from the capture. File IDs are stored in the record, so keep them neutral; never use a parcel number. `legal_lot_reference` comes from reviewed recorded documents, and the identity and its evidence come only from the human legal review.

```bash
ref() { jq -n --arg id "$1" --arg sha "$(sha256sum "$2" | cut -c1-64)" --argjson bytes "$(stat -c %s "$2")" '{store: "case_evidence_file", file_id: $id, sha256: $sha, bytes: $bytes}'; }
C="$PP_CASE/capture" N="$PP_CASE/normalized"
jq -n --slurpfile capture "$C/capture-provenance.json" \
  --argjson source "$(ref source-geometry "$C/parcel-geometry.json")" --argjson metadata "$(ref source-metadata "$C/layer-metadata.json")" \
  --argjson normalized "$(ref normalized-geometry "$N/normalized.json")" --argjson receipt "$(ref normalization-receipt "$N/normalization-receipt.json")" \
  --argjson evidence "[$(ref geometry-headers "$C/parcel-geometry.headers.txt"),$(ref metadata-headers "$C/layer-metadata.headers.txt"),$(ref capture-provenance "$C/capture-provenance.json"),$(ref capture-log "$C/capture-log.txt")]" \
  --argjson parcel '{"apn": "<APN>", "pin": "<PIN>", "pind": null}' \
  --argjson reference '{"subdivision_type": "tract", "tract": "<tract>", "lot": "<lot>", "map_book": "<book>", "map_pages": {"first": 1, "last": 1}}' \
  --argjson fields '{"apn": "<APN attribute name>", "pin": "<PIN attribute name>"}' \
  --arg identity not_established --argjson legal '[]' --arg next '<YYYY-MM-DD, 1 to 30 days after the server UTC date>' \
  '($capture[0].requests[] | select(.role == "parcel_geometry")) as $g | $capture[0].source_crs.query_response as $crs
   | {proposal: {parcel: $parcel, legal_lot_reference: $reference, legal_lot_identity: $identity, legal_identity_evidence: $legal,
       source_geometry: {file: $source, metadata_file: $metadata, crs: {wkid: $crs.wkid, latest_wkid: $crs.latestWkid, epsg: 3857}, identity_fields: $fields},
       normalized_geometry: {file: $normalized}, receipt_file: $receipt,
       source_provenance: {agency: $capture[0].agency, requested_url: $g.requested_url, final_url: $g.final_url, retrieved_at_utc: $g.retrieval_ended_utc, evidence_files: $evidence},
       next_review_on: $next}, expected_revision: null}' > "$PP_CASE/api/proposal-body.json"
validate() { curl -sS --fail-with-body -X POST "$BASE/validate" -b "$JAR" -H 'content-type: application/json' --data-binary @"$PP_CASE/api/proposal-body.json" > "$PP_CASE/api/$1"; }
validate validate-1.json
jq '.data.valid, [.data.diagnostics[] | {code, severity}]' "$PP_CASE/api/validate-1.json"
```

Resolve every `error` diagnostic before going further. `"expected_revision"` is `null` only for the first review; afterwards it is the current revision.

### 14. Inspect the required CAL FIRE records

**Hazard:** Phase 3K `validate` can return `valid: true` while required CAL FIRE candidate records are still missing. CAL FIRE completeness is only a warning there, and the evaluator keeps that route unknown, so `valid: true` alone never means ready to publish.

```bash
jq '.data.hazard_routes[] | {route, index, required: [.required_records[]? | {record_number, present}]}' "$PP_CASE/api/validate-1.json"
python3 ../tools/program-screen/publication-readiness-guard.py "$PP_CASE/api/validate-1.json" || true   # lists what is missing
```

### 15. Hydrate the required records (one per request, at most 16 MiB)

Records are found by digest in either builder output; the server accepts a record only where a stored pinned index lists it.

```bash
for d in $(jq -r '.data.hazard_routes[] | .required_records[]? | select(.present != true) | .content_sha256' "$PP_CASE/api/validate-1.json"); do
  for f in "$PP_CALFIRE/lra/record-$d.bin" "$PP_CALFIRE/sra/record-$d.bin"; do
    if [ -f "$f" ]; then put calfire/records "$f" application/octet-stream; fi
  done
done
```

### 16. Run the readiness guard

```bash
validate validate-2.json
python3 ../tools/program-screen/publication-readiness-guard.py "$PP_CASE/api/validate-2.json"
```

The guard reads only the saved validate response (a file or standard input). It verifies the existing Phase 3K response structure before trusting readiness flags, including the review summary, route authority and index digest, required-record fields and diagnostic objects. It requires BOTH `data.valid === true` AND `present === true` for every required CAL FIRE record the API reported on every route. A complete route with `required_records: []` is accepted; an empty list cannot excuse missing or malformed route fields. A route whose required records were not reported (`null`, for example a missing index) is not complete. Exit 0 prints `READY`; exit 1 prints `NOT READY` with every blocker and each missing record as `record <number>  record-<sha256>.bin`; exit 2 is unreadable or malformed input, refused (fail closed). It never calls the API, derives candidates or evaluates a route. Publish only after exit 0.

### 17. Validate again when anything changes

After any upload, proposal edit, new server UTC date or change of administrator, validate again and re-run the guard on the new response. Publish exactly the body the guard approved, on the same UTC day, because the review ID is derived from it.

### 18. Publish

```bash
curl -sS --fail-with-body -X POST "$BASE/publish" -b "$JAR" -H 'content-type: application/json' --data-binary @"$PP_CASE/api/proposal-body.json" > "$PP_CASE/api/publish.json"
jq '.data | {review_id, revision, manifest_sha256, replayed, diagnostics}' "$PP_CASE/api/publish.json"
```

201, or 200 with `replayed: true` for an identical retry.

### 19. Preparation status

```bash
curl -sS --fail-with-body "$BASE" -b "$JAR" > "$PP_CASE/api/status.json"
jq -e '.data.readiness == "ready" and .data.current_review.verified == true' "$PP_CASE/api/status.json"
```

### 20. Phase 3J evaluation

```bash
curl -sS --fail-with-body "$O/api/v1/cases/$CASE_ID/program-screen" -b "$JAR" > "$PP_CASE/api/program-screen.json"
```

### 21. Audit check

```bash
npx wrangler d1 execute DB "${PP_WRANGLER[@]}" --json --command \
  "SELECT action, outcome, review_id, prior_revision, new_revision, new_manifest_sha256, created_at, completed_at FROM program_screen_review_events WHERE case_id = '$CASE_ID' ORDER BY created_at" \
  > "$PP_CASE/api/audit.json"
```

Expect one `publish` row with `outcome` `committed`, the publication's `review_id` and `manifest_sha256` as `new_manifest_sha256`, and the status revision as `new_revision`. A `pending` row is not proof either way (Phase 3K, section 9); never edit an audit row.

### 22. Archive the case artifacts

Stop the Worker, then:

```bash
rm -f "$JAR"   # a live local session token
(cd "$PP_CASE" && find . -type f ! -name ARCHIVE-SHA256SUMS -print0 | sort -z | xargs -0 sha256sum > ARCHIVE-SHA256SUMS)
tar -C "$(dirname "$PP_CASE")" -czf "$PP_CASE-$(date -u +%Y%m%dT%H%M%SZ).tar.gz" "$(basename "$PP_CASE")"
git -C .. status --short   # must print nothing: no case material in the repository
```

Keep the archive with the private run records, outside the repository.
