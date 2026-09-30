# Offline reviewed-lot normalization

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

The build recipe below consumes locally preserved archives; it does not download resources. Any rebuilt resource that differs from its approved hash is refused. Updating a binary/database/profile requires an explicit review and new pins; version numbers alone do not authorize a replacement. Keep the approved installation/archive as offline tooling evidence outside the public checkout.

From the repository root, with the verified archives already in the audit's `downloads/` directory:

```bash
set -euo pipefail
export PROJ_NETWORK=OFF
PP_PROJ_AUDIT=/tmp/permitpulse-proj-review
PP_PUBLIC_REPO="$PWD"

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
  -DTIFF_INCLUDE_DIR="$PP_PROJ_AUDIT/tiff-install/include" \
  -DTIFF_LIBRARY_RELEASE="$PP_PROJ_AUDIT/tiff-install/lib/libtiff.so" \
  -DCMAKE_INSTALL_RPATH="$PP_PROJ_AUDIT/tiff-install/lib"
cmake --build "$PP_PROJ_AUDIT/build" --parallel 2
cmake --install "$PP_PROJ_AUDIT/build"

cp "$PP_PUBLIC_REPO/tools/program-screen/proj/resources/us_noaa_cshpgn.tif" \
  "$PP_PROJ_AUDIT/install/share/proj/us_noaa_cshpgn.tif"
```

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

1. Normalize offline through the pinned CLI and review the source/normalized geometry and receipt. Keep the legal-identity decision explicit; normalization cannot make it.
2. Open the existing authorized case store using `openProgramScreenCaseStore(bindings, actor, caseId, "write")`. This requires existing admin evidence-verification permission as well as case edit permission. Case ownership alone is insufficient.
3. `putFile` each hash/byte-count-bound source, metadata, receipt, normalized and supporting evidence file into that private case.
4. `ingestCalFire` the unchanged pinned index and verified candidate record bytes. An incomplete record set can be stored, but it cannot manufacture negative coverage.
5. `ingestReviewedLot(record, expectedRevision, asOf)` validates everything and publishes conditionally. Use `null` only for the initial review; later publications require the current revision. The reviewer user ID must identify the authenticated writer.
6. Call `evaluateCaseProgramScreen(bindings, actor, caseId, input)`. It reads private reviewed inputs and computes the overlay before calling Program Screen. No coordinate transformation runs here.

See `docs/PROGRAM_SCREEN_PHASE_3F_REVIEWED_CASE_EVIDENCE.md` for the exact contract, private keys, Vidor acceptance behavior and verification results.
