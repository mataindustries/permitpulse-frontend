# PermitPulse Program Screen Phase 3K: admin case preparation

Phase 3K adds the smallest safe operator path that can prepare a real Program Screen case: an administrator stores already-prepared, offline-produced reviewed-lot evidence and the pinned CAL FIRE SRA/LRA case data, validates a proposed reviewed-lot snapshot without writing it, publishes it through the existing CAS machinery with an audit record, and can invalidate it. The unchanged Phase 3J `GET /api/v1/cases/:caseId/program-screen` then evaluates the case. Phase 3K adds no UI, client access, production-auth change, Worker binding, environment variable, runtime reprojection, live fetching, capture, authority source, package, registry, index pin, criterion rule or criterion promotion.

## Baseline and commits

The base is `5fec9c4a52bd11556731dc51a14a53e47a73a243`, the PR #33 merge, with Phase 3J commits `4ec93a49dc2ca891dcf36c695892cbf8f83becdf` and `a7eb76b2aae9b8ae1c7fb6630e70f7c364754542` in its history. Native setups used GDAL 3.10.3 / GEOS 3.13.1 (conda-forge `gdal=3.10.3`, `geos=3.13.1`) through `PP_SRA_PYTHON`, `PP_LRA_PYTHON`, `PROJ_DATA` and `GDAL_DATA`; no native test was skipped, disabled or mocked away. The clean base passed: Phase 3J 1 file / 72; Phase 3I 1 file / 337; Phase 3H 3 files / 215; Program Screen 22 files / 1,662; full app 50 files / 2,086; 16 captures verified; capture self-test 61 checks; typecheck; production build; OS verification; repository-root public validation PASS 351 / FAIL 0; d baseline 66 scenarios / 92 projections. The four protected hashes and the 2 / 44 / 34 / 44 counts were recomputed before editing, in-suite and with an esbuild-bundled Node probe in production mode.

| Commit | Subject |
| --- | --- |
| A `4fbd971e4af072ee7db28ad0c589df8ac9ba583a` | `feat(program-screen): audited admin case preparation service` |
| B (this commit) | `feat(program-screen): admin-only case preparation endpoints` |

Commit A (migration 0012, the preview migration list, `mayPrepareProgramScreenCase`, the service, the audit module and 119 service-level tests) was independently green before Commit B began: Phase 3K 1 file / 119; Phase 3J 72; Phase 3I 337; Phase 3H 3 files / 215; Program Screen 23 files / 1,781; full app 51 files / 2,205; 16 captures; 61 self-test checks; typecheck, build, OS, root validation (351 / 0); protected hashes and counts unchanged in-suite and in the production-mode probe.

Measured pinned dataset sizes (from the native GDAL/GEOS derivation): LRA index 1,672,094 bytes (1.595 MiB), largest LRA record 3,403,239 bytes; SRA index 3,001,436 bytes (2.862 MiB), largest SRA record 5,815,400 bytes. Both indexes are under the 4 MiB index read cap and every record is under the 16 MiB record cap.

## 1. Problem

Phase 3J can evaluate a prepared case, but nothing deployed could prepare one: the private writer (`openProgramScreenCaseStore(..., "write")`, `putFile`, `ingestCalFire`, `ingestReviewedLot`, `invalidateReview`) was reachable only from trusted code. The lower-level verifier is also too permissive for an operator surface. It accepts a `parcel_is_one_legal_lot` identity whose only evidence is GIS JSON or a receipt, a ten-year review window, any reviewer display name, one file ID mapped to several digests, `http:` provenance, future review dates when the caller supplies a future date, and a hand-edited receipt binding an unrelated valid EPSG:3310 polygon. Phase 3K narrows all of these at the service boundary without changing the verifier.

## 2. Architecture: two-stage, stateless

| Stage | Effect |
| --- | --- |
| Stage 1: content | Evidence blobs, the two pinned CAL FIRE indexes and their records, each content-addressed inside the case's own prefix. Never touches `current-review.json`. Uploads are immutable and inert until a published review references them. |
| Validate | Builds the exact server-completed review, runs every check, computes the required CAL FIRE candidates and returns diagnostics. Writes nothing (no R2 put/delete, no audit row). |
| Publish | Repeats every check, inserts the audit intent, publishes through the existing `ingestReviewedLot` CAS, then completes the audit row. |
| Invalidate | The existing `invalidateReview("stale", ...)` CAS, audited. |

There is no draft table, draft ID or TTL. The R2 object graph under `<case_id>/program-screen/` is unchanged from Phase 3F/3I: `blobs/<sha256>`, `calfire/index-<sha256>.txt`, `calfire/record-<sha256>.bin`, `current-review.json` and the immutable archive `reviews/<review_id>-<manifest_sha256>.json`.

| File | Change |
| --- | --- |
| `app/migrations/0012_program_screen_review_events.sql` | The audit table, exactly as approved. |
| `app/scripts/preview-deployment.mjs` | Expected migrations 0001 through 0012, and that message. |
| `app/src/worker/cases/authorization.ts` | `mayPrepareProgramScreenCase(actor)`: `actor.role === "admin"`. |
| `app/src/worker/program-screen/case-preparation.ts` | The seven services, narrowing rules, diagnostics and candidate computation. |
| `app/src/worker/program-screen/case-preparation-audit.ts` | Audit intent insert and guarded completion. |
| `app/src/worker/routes/program-screen-preparation.ts` | The seven endpoints. Only `import type` from Program Screen modules; the service is loaded with `await import("../program-screen/case-preparation")` inside the guarded path. |
| `app/src/worker/app.ts` | `app.route("/api/v1/program-screen", programScreenPreparationRoutes)`. |

The routes live under `/api/v1/program-screen` because sub-apps mounted at `/api/v1/cases` register a wildcard `bodyLimit` of 16 KiB that, with Hono 4.12.27, caps every request under that prefix (S8 shows a 20 KiB request there is 413). Existing middleware is unchanged.

The on-demand import follows Phase 3J: the Workers test pool instantiates the Worker's static import graph before test-local `vi.mock` observers, so a static path from `app.ts` into Program Screen internals would break the unmodified Phase 3I suite (M27). The production build emits `assets/case-preparation-*.js` (containing only `case-preparation.ts` and `case-preparation-audit.ts`), loaded with `import()` from `index.js`. Compared with the base build, the eagerly loaded module set gains exactly one module, the route file; `case-evaluation-response.ts`, already eager through the Phase 3J route, is now emitted as its own small chunk because the lazy service shares it. No output module comes from fixtures, tests, scripts, tools, Python, GDAL, GEOS or PROJ, and the TEST-ONLY guard is folded away in the chunks.

## 3. Services

```ts
readCasePreparationStatus(bindings, actor, caseId, now)
storeCasePreparationBlob(bindings, actor, caseId, sha256, bytes)
hydrateCalFireIndex(bindings, actor, caseId, indexSha256, bytes)
hydrateCalFireRecord(bindings, actor, caseId, contentSha256, bytes)
validateReviewedLotProposal(bindings, actor, caseId, body, now)
publishReviewedLotProposal(bindings, actor, caseId, body, now, requestId)
invalidateCurrentReview(bindings, actor, caseId, body, now, requestId)
```

`bindings` is `Pick<Bindings, "DB" | "EVIDENCE_FILES">`. None accepts authority, registries, packs, pins, subject, `as_of`, reviewer identity, a body `case_id` or a route override; `@ts-expect-error` checks in the test file enforce the signatures under `tsc --noEmit`. Each service's first action is `if (!mayPrepareProgramScreenCase(actor)) throw new CasePreparationError("FORBIDDEN")`, before any D1 or R2 access (Z6 proxies both). The store is then opened through the existing case authorization (`"read"` for status and validate, `"write"` otherwise); `asOf` is `programScreenAsOf(now)`, computed once from the request's single `new Date()`.

## 4. HTTP contract

| Method and path (under `/api/v1/program-screen/cases/:caseId/preparation`) | Body | Limit | Success |
| --- | --- | --- | --- |
| `GET` (root) | none | none | 200 status |
| `PUT /blobs/:sha256` | `application/octet-stream` | 8 MiB | 200 `{ sha256, bytes }` |
| `PUT /calfire/index/:sha256` | `text/plain; charset=utf-8` | 4 MiB | 200 `{ route, authority_source_id, index_sha256 }` |
| `PUT /calfire/records/:sha256` | `application/octet-stream` | 16 MiB | 200 `{ content_sha256, content_bytes, matches: [{ route, record_number }] }` |
| `POST /validate` | `application/json` | 64 KiB | 200 validation |
| `POST /publish` | `application/json` | 64 KiB | 201 publication, or 200 `replayed: true` |
| `POST /invalidate` | `application/json` | 4 KiB | 200 invalidation |

Media types are compared exactly after lowercasing and normalizing the `;` separators (`application/json; charset=utf-8` is also accepted). No multipart, no content encoding. Successes are `{ ok: true, data }`; errors use the existing envelope `{ ok: false, error: { code, message, details? }, request_id }`. Other methods fall through to the global 404.

### Gate order

1. Route-scoped `sessionMiddleware`; no user (including `AUTH_ENABLED=false`) is 401 `UNAUTHENTICATED`.
2. Not an administrator: 403 `FORBIDDEN`, "Program Screen case preparation requires an administrator.", before the query, path parameters, headers, body, body limit or case are examined. A client owner with an oversized body still gets 403 (Z3).
3. Any query parameter: 400 `INVALID_QUERY` (`z.object({}).strict()`).
4. `caseIdSchema`: 400 `INVALID_CASE_ID`. Digest parameters must match `^[0-9a-f]{64}$`: 400 `INVALID_DIGEST`.
5. Any `Content-Encoding`: 415 `UNSUPPORTED_CONTENT_ENCODING`; wrong media type: 415 `UNSUPPORTED_MEDIA_TYPE`.
6. The route's body limit, checked against a declared `Content-Length` and while streaming: 413 `PAYLOAD_TOO_LARGE`.
7. `getEditableCaseForActor`: 404 `CASE_NOT_FOUND`.
8. No `EVIDENCE_FILES`: 503 `EVIDENCE_STORAGE_UNAVAILABLE`.
9. `const now = new Date()`; the service module is imported on demand; JSON bodies are parsed (400 `INVALID_JSON`); the service runs with the canonical `caseRecord.id`.
10. A `CasePreparationError` maps to its fixed status, code and public message (with `details` for `VALIDATION_ERROR` and `PREPARATION_INVALID`). Anything else is logged with `logDevelopmentError` and returned as 500 `PROGRAM_SCREEN_PREPARATION_FAILED` with a generic message; internal text is never echoed.

Global behaviour supplies `Cache-Control: no-store`, `x-request-id` and the `/api/v1/*` origin check (a foreign `Origin` on a write is 403 `INVALID_ORIGIN`). No CORS header is ever set.

| Code | Status | Code | Status |
| --- | --- | --- | --- |
| `FORBIDDEN` | 403 | `REVISION_CHANGED` | 409 |
| `DIGEST_MISMATCH` | 422 | `NO_CURRENT_REVIEW` | 409 |
| `EMPTY_BODY` | 422 | `REVIEW_NOT_CURRENT` | 409 |
| `UNPINNED_INDEX` | 422 | `CURRENT_REVIEW_UNREADABLE` | 409 |
| `CALFIRE_INDEX_INVALID` | 422 | `REVIEWER_NAME_UNAVAILABLE` | 422 |
| `CALFIRE_INDEX_REQUIRED` | 409 | `AUDIT_UNAVAILABLE` | 503 |
| `RECORD_NOT_IN_PINNED_INDEX` | 422 | `UNAUTHENTICATED` | 401 |
| `CALFIRE_RECORD_INVALID` | 422 | `INVALID_QUERY`, `INVALID_CASE_ID`, `INVALID_DIGEST` | 400 |
| `INVALID_JSON` | 400 | `UNSUPPORTED_CONTENT_ENCODING`, `UNSUPPORTED_MEDIA_TYPE` | 415 |
| `VALIDATION_ERROR` (zod `flatten()` details) | 422 | `PAYLOAD_TOO_LARGE` | 413 |
| `PREPARATION_INVALID` (`{ diagnostics }`) | 422 | `CASE_NOT_FOUND` / `EVIDENCE_STORAGE_UNAVAILABLE` | 404 / 503 |
| `PROGRAM_SCREEN_PREPARATION_FAILED` | 500 | | |

Path-traversal digests that reach the parameter (`..%2Fx`, `%2e%2e%2Fx`, 63 characters, uppercase hex) are 400. Literal dot segments (`../x`, `%2e%2e`) are removed by URL parsing before routing, so such a request never reaches a digest route and is the global 404; no R2 call is made either way (S3).

## 5. Stage 1 content

**Blobs.** The body must be 1 byte to 8 MiB and hash to the path digest. It is stored with `putFile({ store: "case_evidence_file", file_id: "sha256-" + sha.slice(0, 32), sha256, bytes })`. Uploads are idempotent and content-agnostic; a file's role and type are checked at validate/publish time.

**Indexes.** Each route resolves only from the shipped registries: route, registered source, package, overlay dataset, `overlayIndexPinFor(dataset)` (`gov_51178` → `calfire-lra-fhsz-2025-03-24-v1`, `prc_4202` → `calfire-sra-fhsz-2023-09-29`). A path digest that is not one of those pins is `UNPINNED_INDEX` with no R2 call. Raw bytes are hashed before any decoding (a BOM-prefixed copy is `DIGEST_MISMATCH`); then `TextDecoder("utf-8", { fatal: true, ignoreBOM: true })` and `writer.ingestCalFire(text, [])`. Any decode or ingest failure is `CALFIRE_INDEX_INVALID`, with nothing stored. The route and source are never taken from the request.

**Records.** One record per request, at most 16 MiB, hashed against the path. Each stored pinned index is re-read, its raw SHA re-checked, and it is parsed with the production `loadOverlayDatasetView`. With no stored index the record is `CALFIRE_INDEX_REQUIRED` (409); with no entry whose `content_sha256` is the digest, `RECORD_NOT_IN_PINNED_INDEX`. Every matching entry is ingested with `writer.ingestCalFire(indexText, [{ record_number, content }])`; any failure is `CALFIRE_RECORD_INVALID`. Record numbers never come from the caller.

## 6. The proposal and the server-completed review

```json
{
  "proposal": {
    "parcel": { "apn", "pin", "pind" },
    "legal_lot_reference": { "subdivision_type": "tract", "tract", "lot", "map_book", "map_pages": { "first", "last" } },
    "legal_lot_identity": "...",
    "legal_identity_evidence": [CaseFileRef],
    "source_geometry": { "file", "metadata_file", "crs": { "wkid", "latest_wkid", "epsg": 3857 }, "identity_fields": { "apn", "pin" } },
    "normalized_geometry": { "file" },
    "receipt_file": CaseFileRef,
    "source_provenance": { "agency", "requested_url", "final_url", "retrieved_at_utc", "evidence_files" },
    "next_review_on": "YYYY-MM-DD"
  },
  "expected_revision": null | "<1..128 characters>"
}
```

Every object is strict: unknown keys are rejected (422 `VALIDATION_ERROR`), never ignored, including `schema_version`, `review_id`, `case_id`, `review`, `reviewer`, `reviewer_user_id`, `reviewed_on`, `state`, `reprojection`, `as_of`, `registries`, `packs`, `pins`, `authority`, `normalized_geometry.crs` and `normalized_geometry.serialization`. Field validators are the shared reviewed-lot schema's own (`caseFileRefSchema`, `legalLotIdentities`, `isIsoCalendarDate`), reused only inside the lazily loaded service.

The server fills `schema_version`, `case_id` (the authorized case), `review_id`, the normalized CRS (`EPSG:3310`) and serialization, every `reprojection` value from the shipped normalization pins (profile ID and SHA of the shipped profile bytes, PROJ 9.9.0, normalizer 1.0.1, pipeline SHA, plus the proposal's receipt reference), the reviewer, `reviewed_on` (the server date) and `state: { status: "current", superseded_by: null }`. The reviewer is `{ kind: "human", name: <trimmed D1 user name, 1..300 characters>, role: "Administrator (Program Screen reviewed-lot publication)" }` with `reviewer_user_id` the session user's ID; a missing or blank name is `REVIEWER_NAME_UNAVAILABLE`.

`review_id` is deterministic: the first 16 bytes of SHA-256 over `"program-screen-review-id-v1\0" + case_id + "\0" + actor.id + "\0" + (expected_revision ?? "none") + "\0" + asOf + "\0" + canonicalJson(parsedProposal)` (keys sorted recursively), with `bytes[6] = (bytes[6] & 0x0f) | 0x50` and `bytes[8] = (bytes[8] & 0x3f) | 0x80`, formatted 8-4-4-4-12. The manifest is exactly `utf8(JSON.stringify(parsedRecord) + "\n")`, the bytes the private writer publishes and archives; P3 finds `reviews/<review_id>-<manifest_sha256>.json` and pins the derivation independently.

## 7. Narrowing rules

Every error-severity diagnostic blocks publication.

| Rule | Check | Code |
| --- | --- | --- |
| R1 | Strict schemas | `VALIDATION_ERROR` |
| R2 | `next_review_on` after the server date and at most 30 calendar days later | `REVIEW_TERM_OUT_OF_RANGE` |
| R3 | Reviewer only from the session and D1 | (no caller field exists) |
| R4 | One file ID names one (sha256, bytes); one sha256 has one file ID; no repeated digest within the legal-evidence or provenance list | `FILE_REF_CONFLICT`, `DUPLICATE_FILE_REF` |
| R5 | Every reference is present in this case's blobs with its exact length and digest (memoized, case-scoped reads) | `FILE_MISSING`, `FILE_HASH_MISMATCH` |
| R6 | Legal evidence is none of the source, metadata, normalized or receipt files, and starts with a PDF (`%PDF-`), TIFF (`II*\0`, `MM\0*`), PNG or JPEG signature; an established identity needs at least one | `LEGAL_EVIDENCE_OVERLAPS_GEOMETRY_INPUTS`, `LEGAL_EVIDENCE_TYPE_UNSUPPORTED`, `LEGAL_IDENTITY_EVIDENCE_REQUIRED` |
| R7 | `requested_url` and `final_url` use `https:` | `PROVENANCE_URL_NOT_HTTPS` |
| R8 | `retrieved_at_utc` and the receipt's `normalized_at_utc` are not after the server clock | `TIMESTAMP_IN_FUTURE` |
| R9 | The normalized polygon has the source feature's ring count and positions per ring; no coordinate is read or compared | `NORMALIZED_STRUCTURE_MISMATCH` |
| R10 | The unchanged `verifyReviewedLotEvidence(memoReader, completedRecord, asOf)` | mapped below |

R10's refusals are mapped explicitly by exact message: stale/superseded/future-dated → `REVIEW_NOT_CURRENT_ON_DATE`; TEST-ONLY → `TEST_ONLY_EVIDENCE`; unsupported geometry → `SOURCE_GEOMETRY_UNSUPPORTED`; CRS not EPSG:3857 → `SOURCE_CRS_UNSUPPORTED`; CRS differs from metadata → `SOURCE_CRS_MISMATCH`; identifiers differ → `SOURCE_IDENTIFIERS_MISMATCH`; receipt TEST-ONLY flag → `RECEIPT_TEST_ONLY_MISMATCH`; implementation/operation/resources → `NORMALIZATION_NOT_PINNED`; receipt not linked → `RECEIPT_NOT_LINKED`; chronology → `CHRONOLOGY_INCONSISTENT`; normalized geometry invalid or not EPSG:3310 → `NORMALIZED_GEOMETRY_INVALID`; `Missing case evidence file:` → `FILE_MISSING`; `Case evidence hash/length mismatch:` → `FILE_HASH_MISMATCH`; a `ZodError` → `CAPTURED_FILE_MALFORMED`; a `SyntaxError` or UTF-8 decode `TypeError` (workerd: "Failed to decode input.") → `CAPTURED_FILE_NOT_JSON`; anything else → `REVIEWED_LOT_VERIFICATION_FAILED` with the verifier message as admin-only `detail`. Every mapping is pinned by a test that triggers it with real inputs, so a verifier message change breaks Phase 3K.

Non-blocking diagnostics: `LEGAL_IDENTITY_NOT_ESTABLISHED` (info) for any identity other than `parcel_is_one_legal_lot` (c and d remain unknown); `LEGAL_REFERENCE_NOT_IN_SOURCE_ATTRIBUTES` (warning) when the claimed tract or lot is not among the selected source feature's attribute values (advisory; the claim is stored unchanged); `CALFIRE_INDEX_MISSING` (warning); `CALFIRE_RECORDS_MISSING` (warning, with route and record numbers); `CALFIRE_CANDIDATE_INVALID` (info) for a required candidate whose `geometry_state` is not valid. CAL FIRE completeness never blocks publication, because missing CAL FIRE data already fails closed to `unknown` in the evaluator.

Diagnostics are `{ code, severity, field?, file_id?, sha256?, route?, record_numbers?, detail? }` and never contain an APN, PIN, PIND, tract, lot, map string, reviewer name, URL, coordinate or file bytes (X3).

## 8. Required CAL FIRE records

Status, validate and publish compute required candidates exactly as the evaluator does, without importing it: route → registered source → package dataset → `overlayIndexPinFor` → stored index → raw SHA check before decoding → `loadOverlayDatasetView({ index_text, records: [] })` with the package's CRS, layer and class field → the lot box from `geometry.rings()` (even indices x, odd y) → `overlayCandidates(view.entries(), box)`. Each entry is reported as `{ record_number, content_sha256, content_bytes, geometry_state, present }` with `present` from `store.getOverlayRecord(content_sha256) !== null`. P2 shows, for five lots, that the list equals `route_overlays[route].computed.candidate_records` from the evaluator. Validate computes the list from the proposed normalized geometry (so records can be hydrated before the first publication); status computes it from the published, verified review.

## 9. Audit table

Migration 0012 is exactly the approved `program_screen_review_events` table and its `(case_id, created_at DESC, id DESC)` index. It holds identifiers and digests only: no APN, PIN, tract, lot, reviewer name, URL, coordinate or file content.

The intent row (`outcome = 'pending'`) is inserted before any R2 publication effect; if the insert fails the request is 503 `AUDIT_UNAVAILABLE` and no R2 write occurs (C9). The row then moves once, through `UPDATE ... SET outcome = ?, new_revision = ?, completed_at = ... WHERE id = ? AND outcome = 'pending'`, to `committed` (with the new revision), `conflict` or `failed`. If that completion update fails after a committed R2 publication, the publication is still returned and the failure is logged; the row stays `pending`. **Reconciliation rule:** a `pending` row whose `new_manifest_sha256` equals the current manifest's SHA-256 is a publication whose D1 completion was lost (C9 demonstrates one). Phase 3K does not repair it automatically.

## 10. CAS, replay and invalidation

Publish order: role; server date; strict body; writer store; D1 reviewer name; current review (an unreadable manifest is 409 `CURRENT_REVIEW_UNREADABLE`); deterministic record; revision comparison; R1–R10; diagnostics; `PREPARATION_INVALID` with no audit row and no pointer write if anything blocks; audit intent; `writer.ingestReviewedLot(record, expected_revision, asOf)`; completion. A lost R2 conditional write is `conflict` and 409 `REVISION_CHANGED` (C8: an orphan archive may remain and the winner stays current); another failure is `failed`.

When the current revision differs from `expected_revision` and the current review parses with the same derived `review_id` and manifest SHA, the request is an identical retry: 200 `replayed: true` with the committed revision and no new audit row (C3). Any other mismatch, including a `null` expectation when a review exists and garbage revisions, is 409 `REVISION_CHANGED`.

Invalidate takes `{ expected_revision, reason }` with reason `evidence_withdrawn`, `geometry_error`, `legal_identity_changed`, `source_superseded` or `other`. No current review is `NO_CURRENT_REVIEW`; a revision mismatch is `REVISION_CHANGED`; a review that is not current is `REVIEW_NOT_CURRENT`. The stale manifest SHA (the same record with only its state changed) is computed first and recorded with the audit intent, then `writer.invalidateReview("stale", expected_revision, null)` runs. The response is `{ schema_version: "program-screen-case-invalidation-v1", case_id, review_id, state: "stale", prior_revision, revision }`; supersession is not exposed.

## 11. Status

`GET` returns `{ schema_version: "program-screen-case-preparation-status-v1", case_id, as_of, as_of_basis: "server_utc_calendar_date", integrity, current_review, hazard_routes, readiness }`. `integrity` is `current_review_unreadable` when the manifest fails its integrity check, does not parse, or names another case; no foreign review value is then shown. `current_review` is `{ review_id, state, reviewed_on, next_review_on, legal_lot_identity, reviewer_user_id, revision, verified, diagnostics }`, where `verified` is the unchanged verifier on the server date. `readiness` is `no_review`, `review_unverified`, `calfire_incomplete` (an index or a required record is missing) or `ready`. Status makes no R2 put or delete and no audit write (P2).

## 12. Offline normalization and provenance boundary

Normalization stays offline in `tools/program-screen/normalize-reviewed-lot.py` (Python 3.12.1, ctypes, PROJ 9.9.0, LibTIFF 4.7.2, pinned native resources, Linux x86_64). The Worker performs no coordinate transformation; it stores the offline outputs byte for byte and verifies their hashes and the receipt's pins.

**The normalization receipt is an authenticated administrator's attestation, not cryptographic proof.** Phase 3K adds no receipt signing. R9 catches a hand-edited receipt that binds a polygon of a different ring structure, but an unrelated polygon with the same structure cannot be detected without reprojection (the V6 residual test documents this). CAL FIRE bytes are operator-supplied but must match the shipped pins. Provenance URLs must be HTTPS but are not checked against a host allowlist, and nothing is fetched live.

## 13. Legal-lot identity is a human decision

The identity is whatever the named administrator records; it is never inferred from APN, PIN, GIS attributes, a receipt or geometry, and an omitted identity is a request-shape error rather than a default (L6). `parcel_is_one_legal_lot` requires at least one separate legal-identity document in an accepted medium (L1, L3–L5). Every other identity publishes, and c and d stay `unknown` (L2, L8). A tract or lot that is absent from the source attributes is only a warning; the human's reference is stored unchanged (L7). Vidor Request 3F-3 (vesting-deed review) remains open, so Vidor's identity stays `not_established`.

## 14. Privacy and access

Only an administrator can reach any endpoint. Production `AUTH_ENABLED` remains `"false"`, so every production caller currently receives 401; **no production auth was enabled**. **No client access and no UI exist.** The Phase 3J route, DTO and service are byte-identical to base, and a 3K-prepared case's 3J response keeps its key sets and contains no APN, PIN, PIND, tract, lot, map book, reviewer name, role or user ID, file ID, file/index/record SHA, revision, manifest SHA, URL or storage path (X1, X2). Phase 3K responses carry review IDs, revisions, digests and file IDs for the operator, never parcel, legal-lot, reviewer-name, URL or coordinate values (X3). An internal failure is a generic 500 (X4). Every response is `no-store` without CORS headers (X5).

Residual: a byte-identical file can be uploaded into a second case and used there; it is then that case's own blob, and the audit row attributes the second case's publication to it (S2). Blobs uploaded but never referenced remain inert; orphan cleanup is future work.

## 15. Acceptance results

The suite `app/tests/program-screen-case-preparation-3k.test.ts` (helpers in `program-screen-case-preparation-3k-helpers.ts`) uses real D1, R2, the Hono app, sign-up cookies and D1 administrator promotion; the clock is `vi.useFakeTimers({ toFake: ["Date"] })` at `2026-10-01T18:00:00Z` unless a test moves it. Synthetic datasets reuse the Phase 3J TEST-ONLY world; their pins are supplied through the test-mode `overlay-dataset` mock and appended to `overlayIndexPins` only for the test, then removed. Native cases use the GDAL 3.10.3 / GEOS 3.13.1-derived shipped indexes. No other suite is imported and no existing test was edited.

The file has 145 tests: 119 service-level tests from Commit A and 26 HTTP tests from Commit B. All pass. Where an ID has both a service and an HTTP test, both are listed.

| ID | What is checked | Result |
| --- | --- | --- |
| P1 | HTTP: blobs → both pinned indexes → status (no review, indexes present) → validate (required records listed, `CALFIRE_RECORDS_MISSING`) → only the listed records → validate valid → publish 201 → status ready → Phase 3J GET | review_id matches; both routes `computed`; c/d `consistent_with_source`; exactly the listed records stored |
| P2 | Lots at x = 220, 20, 820, 1820, 2220 | `ready`; per route the required record numbers equal `route_overlays[route].computed.candidate_records`; status and validate make zero R2 writes and zero D1 writes |
| P3 | Revision and archive | publication revision = status revision = R2 ETag; `reviews/<review_id>-<manifest_sha256>.json` exists and equals the current bytes; manifest = `JSON.stringify(record) + "\n"`; review ID equals an independent recomputation of the derivation; one `committed` audit row with `prior_revision` null and no private value |
| P4 | Replacement with the current revision | succeeds; new review ID and revision; both archives kept; audit prior revisions `[null, first]` |
| Z1 | No session or a forged cookie, all 7 endpoints | 401; zero R2 calls; zero audit rows |
| Z2 | `AUTH_ENABLED=false` with a formerly valid admin cookie, all 7 | 401; zero R2 calls |
| Z3 | Client owner (who can read the case), all 7, with valid, oversized, multipart/gzip, empty, query-bearing and bad-digest requests | 403 every time, never 413/415/400; zero R2 calls; zero audit rows |
| Z4 | Unrelated client, real vs random case, all 7 | byte-identical 403 bodies apart from `request_id`; zero R2 calls |
| Z5 | Admin, random case / malformed IDs; client on malformed IDs; unbound storage | 404 `CASE_NOT_FOUND` / 400 `INVALID_CASE_ID` with zero R2 calls; client 403; admin 503, client 403 |
| Z6 | Every service with a client owner, an unrelated client and an unknown client, on a real and a random case | `FORBIDDEN` before any D1 or R2 call (both proxied); an admin's unknown or malformed case is `CASE_NOT_FOUND` with zero R2 calls |
| Z7 | Foreign `Origin` on every write | 403 `INVALID_ORIGIN`; zero R2 calls |
| Z8 | `?as_of`, `?case_id`, `?route`, `?reviewer`, `?registries`, bare and repeated keys, all 7 | 400 `INVALID_QUERY`; zero R2 calls |
| V1 | Blob body ≠ path digest; uppercase digest | `DIGEST_MISMATCH` (422 over HTTP), nothing stored; `INVALID_DIGEST`; a matching blob is stored idempotently |
| V2 | Empty blob; exactly 8 MiB; 8 MiB + 1; every route's limit + 1 over HTTP | `EMPTY_BODY`; accepted; `PAYLOAD_TOO_LARGE`; 413 on all six bodies with zero R2 calls |
| V3 | Reference byte count ≠ staged blob | `FILE_HASH_MISMATCH` with field, file ID and digest |
| V4 | Source blob missing | `FILE_MISSING`; publish 422; no review; no audit row |
| V5 | Receipt not linking the normalized SHA | `RECEIPT_NOT_LINKED` only |
| V6 | Hand-edited receipt binding a polygon with an extra position or an extra ring | `NORMALIZED_STRUCTURE_MISMATCH` as the only error (the verifier alone accepts it); no review, no audit. Residual: a same-structure unrelated polygon validates |
| V7 | Receipt implementation, operation or resources altered | `NORMALIZATION_NOT_PINNED` |
| V8 | Each of `proposal.{schema_version, review_id, case_id, review, reviewer, reviewer_user_id, reviewed_on, state, reprojection, as_of, registries, packs, pins, authority, normalized_geometry.crs, normalized_geometry.serialization}` and body-level `case_id`, `reviewer`, `reviewer_user_id`, `as_of`, `registries`, `authority`, `review_id` | 422 `VALIDATION_ERROR` ("Unrecognized key") for validate and publish; zero R2 calls |
| V9 | Stored reviewer | `{ kind: "human", name: <trimmed D1 name>, role: <fixed role> }`, `reviewer_user_id` = actor; a forged reviewer is refused and the stored reviewer is unchanged; blank or 301-character names and a missing user row are `REVIEWER_NAME_UNAVAILABLE` |
| V10 | TEST-ONLY evidence with `MODE=production`, `PROD=true` | `TEST_ONLY_EVIDENCE` only; publish 422; no review; no audit row |
| V11 | `http:` requested or final URL | `PROVENANCE_URL_NOT_HTTPS` |
| V12 | Retrieval 1 s in the future; receipt normalization in the future; exactly now | `TIMESTAMP_IN_FUTURE` (field-specific); exactly now accepted |
| V13 | File ID naming two digests; digest under two IDs; repeated legal or provenance reference | `FILE_REF_CONFLICT` (once) / `DUPLICATE_FILE_REF`; publish 422; no audit |
| V14 | `next_review_on` asOf+31, asOf, asOf−1; asOf+30 | `REVIEW_TERM_OUT_OF_RANGE` (no review summary for a term ending on asOf); +30 publishes |
| Verifier map | `SOURCE_GEOMETRY_UNSUPPORTED`, `SOURCE_CRS_UNSUPPORTED`, `SOURCE_CRS_MISMATCH`, `SOURCE_IDENTIFIERS_MISMATCH`, `RECEIPT_TEST_ONLY_MISMATCH`, `CHRONOLOGY_INCONSISTENT`, `NORMALIZED_GEOMETRY_INVALID` (bow tie; EPSG:3857), `CAPTURED_FILE_MALFORMED`, `CAPTURED_FILE_NOT_JSON` (not JSON; not UTF-8); and via status after storage changes `FILE_HASH_MISMATCH`, `REVIEWED_LOT_VERIFICATION_FAILED` (detail "Case evidence file exceeds its bound."), `FILE_MISSING` | each triggered with real inputs and mapped exactly (the others are pinned by V5, V7, V10, C7, E7) |
| Integrity | Manifest with a wrong integrity digest; another case's manifest | status `current_review_unreadable` without the foreign review; validate diagnostic; publish and invalidate 409 `CURRENT_REVIEW_UNREADABLE`; nothing overwritten |
| D1 | Synthetic and shipped (native) LRA/SRA indexes | correct route and source; idempotent; stored bytes equal |
| D2 | Unpinned index; pinned garbage, non-UTF-8 and wrong-layer indexes | `UNPINNED_INDEX` with zero R2 calls; `CALFIRE_INDEX_INVALID` with nothing stored |
| D3 | BOM-prefixed pinned index | `DIGEST_MISMATCH` (422 over HTTP), zero R2 calls |
| D4 | LRA pin path with the SRA body | `DIGEST_MISMATCH`; nothing stored |
| D5 | Record before any index | `CALFIRE_INDEX_REQUIRED` (409 over HTTP) |
| D6 | Record in no pinned index; a listed but unparseable record (TEST-ONLY tampered pinned index) | `RECORD_NOT_IN_PINNED_INDEX`; `CALFIRE_RECORD_INVALID`; nothing stored |
| D7 | Altered record | original digest `DIGEST_MISMATCH`; own digest `RECORD_NOT_IN_PINNED_INDEX`; the original is then accepted with its match |
| D8 | Required LRA record omitted | warning `CALFIRE_RECORDS_MISSING` (route, [2]); publication proceeds; `calfire_incomplete`; LRA value unknown, c unknown, d consistent; `ready` after hydrating it |
| D9 | Invalid records the lot cannot touch | not required; no `CALFIRE_CANDIDATE_INVALID`; both routes computed NO |
| D10 | Relevant invalid SRA candidate | `CALFIRE_CANDIDATE_INVALID` (prc_4202, [10]); SRA value unknown; c unknown |
| D11 | LRA index never stored | `CALFIRE_INDEX_MISSING`; LRA unavailable; SRA computed; d consistent |
| D12 | Record 16 MiB + 1 | `PAYLOAD_TOO_LARGE` (413 over HTTP) with zero R2 calls |
| C1 | Stale expected revision | 409; current unchanged; no new audit row |
| C2 | Second administrator publishes first | first administrator 409; one committed row (the second administrator's) |
| C3 | Identical retry (service and HTTP) | 200 `replayed: true`, same review and revision, one audit row; another administrator's or a post-invalidation retry is 409 |
| C4 | `null` expectation while a review exists | 409; current unchanged |
| C5 | Uploads and validation only | `no_review`; no manifest; no audit; 3J `reviewed_lot` null, c/d unknown |
| C6 | Truncated blob and record bodies | `DIGEST_MISMATCH`; nothing stored |
| C7 | Invalidation | stale revision 409; bad reason/missing field/extra key 422; correct revision 200 with exactly six keys; stale manifest archived and audited (`invalidate`, actor, reason, digest); status `REVIEW_NOT_CURRENT_ON_DATE`; 3J `reviewed_lot` null; re-invalidation `REVIEW_NOT_CURRENT`; unprepared `NO_CURRENT_REVIEW` |
| C8 | A rival publication inside the conditional `current-review.json` PUT | 409; audit `conflict` with no revision; rival committed and current; the loser's archive remains |
| C9 | Audit insert fails (service and HTTP); audit completion fails | 503 `AUDIT_UNAVAILABLE` with zero R2 writes for publish and invalidate; a lost completion still returns the publication, logs, and leaves a `pending` row whose digest equals the current manifest |
| C10 | Publication during an in-flight evaluation (service) | c/d unknown; `reviewed_lot` null; both routes unavailable |
| L1 | Established identity with PDF evidence | publishes; c/d computed (NO/NO consistent; whole Very High disqualifying) |
| L2 | `not_established`, no evidence | publishes; info diagnostic; identity preserved; c/d unknown |
| L3 | Source, metadata, normalized or receipt file as legal evidence | `LEGAL_EVIDENCE_OVERLAPS_GEOMETRY_INPUTS`; no review; no audit |
| L4 | Text, JSON, offset PDF signature; PDF, TIFF LE/BE, PNG, JPEG | `LEGAL_EVIDENCE_TYPE_UNSUPPORTED`; all five media accepted |
| L5 | Established identity without evidence | `LEGAL_IDENTITY_EVIDENCE_REQUIRED`; no review summary; no audit |
| L6 | Omitted identity | 422 `VALIDATION_ERROR`, never a default |
| L7 | Tract/lot not in source attributes; then matching attributes | two warnings only; stored reference unchanged; no warning when matching |
| L8 | `parcel_and_legal_lot_differ`, `tied_or_multiple_lots`, `merger_or_resubdivision_pending_or_proposed`, `not_established` | publish; identity preserved; c/d unknown |
| S1 | Blob only in case A, referenced by case B | `FILE_MISSING`; publish 422 |
| S2 | B references A's normalized file; then uploads the same bytes | `FILE_MISSING`; then publishes with the audit row attributed to B |
| S3 | `..%2Fx`, `%2e%2e%2Fx`, `..%5Cx`, 63/65 characters, uppercase, non-hex, spaces; literal `../x`, `%2e%2e`, `..` | 400 `INVALID_DIGEST`; literal dot segments are normalized away and reach no digest route (404); zero R2 calls |
| S4 | Garbage revisions (`*`, quoted, uppercase, text) with and without a review | 409, never 500; a 129-character revision is 422 |
| S5, S6 | `reviewer_user_id`, `reprojection`, `registries` in the proposal | 422 |
| S7 | `Content-Encoding` gzip/identity/br; multipart; wrong media per route | 415; zero R2 calls; case/spacing variants of accepted types work |
| S8 | Native SRA index (3,001,436 bytes) and a 9,440,064-byte TEST-ONLY record on the new prefix | 200 each; a 20 KiB request under `/api/v1/cases` is 413 |
| S9 | Case B status after case A publishes | `no_review`; none of A's case ID, review ID, revision or manifest |
| E1 | LRA whole Very High, SRA absent | c `disqualifying_per_source`; routes computed/unavailable |
| E2 | Native SRA whole Very High (shipped index via HTTP), LRA absent | c `disqualifying_per_source`; d `consistent_with_source`, authority established |
| E3 | NO on both routes, same reviewed geometry | c `consistent_with_source`; one lot geometry, two datasets |
| E4 | NO + relevant invalid candidate | c unknown |
| E5 | d (service and HTTP) vs the legacy direct evaluator on the same 3K-prepared store | d criterion JSON, d record minus subject and d authority block byte-identical |
| E6 | 3K HTTP publication during an in-flight 3J GET | c/d unknown; `reviewed_lot` null; the next GET shows the new review |
| E7 | Clock 2026-10-31 (after `next_review_on`) | status `review_unverified` with `REVIEW_NOT_CURRENT_ON_DATE`; 3J `reviewed_lot` null; c/d unknown |
| X1 | 3J response on a 3K-prepared case | none of APN, PIN, PIND, tract, lot, map book, reviewer name/role/user ID, file IDs, file/index/record SHAs, revision, manifest SHA, URLs, agency, coordinates, `program-screen/`, `blobs/`, `calfire/`, `reviews/`, `current-review` |
| X2 | 3J key sets | unchanged at every level |
| X3 | 3K status, validate, publication, replay, `PREPARATION_INVALID`, `VALIDATION_ERROR`, invalidation | no APN, PIN, PIND, tract, lot, map book, reviewer name, URL, agency or coordinate |
| X4 | R2 `put` throws a message with a path, digest and user ID | 500 `PROGRAM_SCREEN_PREPARATION_FAILED`, generic message only; logged through `logDevelopmentError` |
| X5 | 200, 200 replay, 401, 403, 400, 404, 409, 413, 415, 422, 503, OPTIONS from a foreign origin, unsupported method (and the 500 in X4) | `Cache-Control: no-store`; no `Access-Control-Allow-*` |
| G1 | Protected state | four hashes exact; 2 / 44 / 34 / 44; `client_releasable` false; G1/G2 open |
| G2 | Route and app sources | no static import from any Program Screen module (only `import type`); `await import("../program-screen/case-preparation")`; mounted at `/api/v1/program-screen` only |

The service signature test checks the seven exported service functions, their arities and the `@ts-expect-error` refusals.

## 16. Mutation results

Every mutation was applied alone to a disposable full copy of the final implementation tree under `/tmp` (three parallel lanes, each with its own `node_modules` and native GDAL 3.10.3 / GEOS 3.13.1 caches); the working checkout was never mutated. Each run used the real native global setups and the complete Phase 3K file. Each lane first ran the unmutated copy (145 / 145 in all three). After every mutation the copy was restored from a pristine snapshot, checked identical with `diff -r` over `app/src` and `app/tests`, and re-run to 145 / 145 before the next mutation. Each replacement had to match its target exactly once or the mutation was refused; all 30 applied, and no run had a syntax, transform or module-load error.

A failure counts only when the assertion library raised it (`AssertionError`, including the suite's `expectPreparationError`, `settled` and `published` checks). Across the 30 mutations there were **zero** non-assertion failures, so nothing was excluded.

| Mutation | Changed boundary | Result | Assertion failures | Killing tests | Required killer | Not counted | Restored |
| --- | --- | --- | --- | --- | --- | --- | --- |
| M1 | Remove the HTTP route's administrator check | killed | 4 | Z3, Z4, Z5, X5 | Z3 | 0 | 145/145 |
| M2 | Register per-route body limits before the role gate | killed | 1 | Z3 | Z3 (oversized client body) | 0 | 145/145 |
| M3 | mayPrepareProgramScreenCase also allows a client (case owner) | killed | 5 | Z6, Z3, Z4, Z5, X5 | Z3, Z6 | 0 | 145/145 |
| M4 | Remove the service-level administrator check | killed | 1 | Z6 | Z6 | 0 | 145/145 |
| M5 | Accept proposal.case_id and use it for the record | killed | 1 | V8 | V8 | 0 | 145/145 |
| M6 | Trust the path digest without hashing the body (blob and record) | killed | 5 | V1, D7, C6, V1/V2, X5 | V1, C6 | 0 | 145/145 |
| M7 | Skip the staged blob checks (R5) and the lower-level verifier (R10) | killed | 20 | V3, V4, V5, V7, V10, verifier mapping, S1, S2 | V4, V5 | 0 | 145/145 |
| M8 | Publish before R6/R9 run | killed | 56 | L3, V6, and 54 other tests (P2, P3, P4, V9, V14, verifier mapping, D8, D9, D10, D11, C1, C2, C3, C4, C7, C8, C9, manifest integrity, C10, L1, L2, L4, L7, L8, S2, S4, S9, E5, P1, Z4, C over HTTP, E1, E2, E3, E4, E6/C10, E7, X1/X2, X3, X5) | L3, V6 | 0 | 145/145 |
| M9 | Drop the expected-revision (CAS) comparison | killed | 7 | C1, C2, C3, C4, S4, C over HTTP, X5 | C1, C2 | 0 | 145/145 |
| M10 | Pass a null expected revision to the writer regardless of the current review | killed | 4 | P4, C1, C10, E6/C10 | P4 | 0 | 145/145 |
| M11 | Accept reviewer name/role from the proposal | killed | 2 | V8, V9 | V8, V9 | 0 | 145/145 |
| M12 | Default a missing legal_lot_identity to parcel_is_one_legal_lot | killed | 1 | L6 | L6 | 0 | 145/145 |
| M13 | Remove legal-evidence disjointness from geometry inputs | killed | 4 | L3 | L3 | 0 | 145/145 |
| M14 | Remove the legal-evidence media allowlist | killed | 3 | L4 | L4 | 0 | 145/145 |
| M15 | Bypass the TEST-ONLY guard (drop TEST_ONLY_EVIDENCE refusals) | killed | 1 | V10 | V10 | 0 | 145/145 |
| M16 | Swap the route-to-source mapping | killed | 125 | P2, D1, E1, E2, and 121 other tests (service unknown-case, P3, P4, V3, V5, V6, V7, V8, V9, V10, V11, V12, V13, V14, verifier mapping, D2, D3, D4, D6, D7, D8, D9, D10, D11, C1, C2, C3, C4, C5, C6, C7, C8, C9, manifest integrity, C10, L1, L2, L3, L4, L5, L6, L7, L8, S1, S2, S4, S5/S6, S9, E5, P1, Z4, D over HTTP, C over HTTP, S8, E3, E4, E6/C10, E7, X1/X2, X3, X5) | P2, D1, E1, E2 | 0 | 145/145 |
| M17 | Accept an unpinned index | killed | 2 | D2, D over HTTP | D2 | 0 | 145/145 |
| M18 | Decode (stripping a BOM) before the raw SHA check | killed | 3 | D2, D3, D over HTTP | D3 | 0 | 145/145 |
| M19 | Skip the ring/position structural correspondence (R9) | killed | 2 | V6 | V6 | 0 | 145/145 |
| M20 | Resolve blob references through a read cache shared across case prefixes | killed | 3 | V4, S1, S2 | S1, S2 | 0 | 145/145 |
| M21 | Random review_id | killed | 6 | P3, C3, C8, P1, C over HTTP, X5 | C3 | 0 | 145/145 |
| M22 | Accept a caller reviewed_on and drop the 30-day bound | killed | 3 | V8, V14, X3 | V8, V14 | 0 | 145/145 |
| M23 | Write the audit intent after the CAS and swallow its failure | killed | 3 | C8, C9, C over HTTP | C9, C8 | 0 | 145/145 |
| M24 | Swallow ingestCalFire failures (index and record) | killed | 2 | D2, D6 | D6, D2 | 0 | 145/145 |
| M25 | Invalidate without the revision check (CAS) or audit | killed | 3 | C7, C9, C over HTTP | C7 | 0 | 145/145 |
| M26 | Validate opens the writer and publishes (mutates storage) | killed | 21 | P2, C5, and 19 other tests (V10, D8, C8, P1, C over HTTP, E1, E2, E3, E4, E5, E6/C10, E7, X1/X2, X3, X5) | P2, C5 | 0 | 145/145 |
| M27 | Static service import in the route | killed | 124 (Phase 3K 21/145 pass; Phase 3I 337/337) | G2, and 123 other tests (service unknown-case, P2, P3, P4, V3, V5, V6, V7, V8, V9, V10, V11, V12, V13, V14, verifier mapping, D1, D2, D3, D4, D6, D7, D8, D9, D10, D11, C1, C2, C3, C4, C5, C6, C7, C8, C9, manifest integrity, C10, L1, L2, L3, L4, L5, L6, L7, L8, S1, S2, S4, S5/S6, S9, E5, P1, Z4, D over HTTP, C over HTTP, S8, E1, E3, E4, E6/C10, E7, X1/X2, X3, X5) | G2 | 0 | 145/145 |
| M28 | Mount the preparation routes under /api/v1/cases | killed | 25 | S8, and 24 other tests (P1, Z1, Z2, Z3, Z4, Z5, Z8, V1/V2, D over HTTP, C over HTTP, S3, S7, E1, E2, E3, E4, E5, E6/C10, E7, X1/X2, X3, X4, X5, G2) | S8 | 0 | 145/145 |
| M29 | Accept Content-Encoding and multipart | killed | 1 | S7 | S7 | 0 | 145/145 |
| M30 | Widen the Phase 3J DTO with preparation diagnostics and a revision | killed | 38 (1 in Phase 3K; 37 in the unmodified Phase 3J suite, 35/72 pass) | Phase 3K X1/X2; Phase 3J service DTO allowlist test and A1, A4, A6–A23, A25, A27, A30 | X1/X2 and the unmodified Phase 3J suite | 0 | 145/145 |

Every required killer named in the approved battery fails under its mutation, with these qualifications. M10 (null expectation passed to the writer) leaves C4 passing because the service compares revisions before the writer is reached; P4 and C1 kill it. M24 (swallowed `ingestCalFire` failure) is killed by D2 and D6 (a pinned garbage index and a listed but unparseable record); D7's refusals happen before ingestion. M27 (static service import in the route) is killed by G2 and by the Phase 3K suite itself: the static path from `app.ts` instantiates `overlay-dataset` before this file's TEST-ONLY observer, so 124 tests fail. The unmodified Phase 3I suite stays 337/337 under M27, because the static path reaches `case-preparation`, `case-evidence`, `overlay-dataset` and `reviewed-lot` but not `evaluate-case`, which is what Phase 3I observes; the on-demand import is still required to keep this suite's observers attached. M28 moves the mount, so every HTTP test, including S8, fails.

An earlier complete battery ran on a pre-final test file and also killed all 30 mutations. In it, a few required killers failed through a thrown service error rather than an assertion (for example C3 under M21, P4 under M10, D1 and P2 under M16). The setup helpers, D1, C3 and V9 were then changed to assert on outcomes (`settled`, `published`, and a forged-reviewer check in V9), and this table is the full battery re-run on the final tree.

## 17. Final verification

All gates were run on the exact final Commit B tree with the GDAL 3.10.3 / GEOS 3.13.1 native setups. No native test was skipped, disabled, weakened or replaced, and no existing test file was edited.

| Check | Result |
| --- | --- |
| Focused Phase 3K | 1 file / 145 tests (N = 145: 119 service-level, 26 HTTP) |
| Focused Phase 3J | 1 file / 72 tests, unchanged |
| Focused Phase 3I | 1 file / 337 tests, unchanged (d baseline: all 66 scenarios / 92 projections byte-identical, enforced by that suite) |
| Focused Phase 3H (c promotion audit, c re-audit, SRA validity) | 3 files / 215 tests, unchanged |
| Complete Program Screen | 23 files / 1,807 tests = 1,662 + 145 |
| Full app | 51 files / 2,231 tests = 2,086 + 145 |
| Capture verification | 16 captures verified |
| Capture tool self-test | 61 checks passed |
| Typecheck | `tsc --noEmit` passed (including the signature `@ts-expect-error` checks) |
| Production build | Worker and client builds passed; `assets/case-preparation-*.js` is a lazy chunk; `index.js` contains no Phase 3K service code |
| OS verification | passed |
| Repository root verification | syntax checks passed; public-site validation PASS 351 / FAIL 0 |
| Migration | 0012 applies in the test D1 (every audit test reads and writes the table); `node scripts/preview-deployment.mjs preflight` passes the template preflight, including the exact 0001–0012 migration set. The `--resolved` preflight needs the ignored preview config with real resource IDs and was not run; no remote migration or deployment was performed |
| Production import graph | eager modules = base + the route file only; the lazy chunk holds only `case-preparation.ts` and `case-preparation-audit.ts`; no module from fixtures, tests, scripts, tools, Python, GDAL, GEOS or PROJ; the TEST-ONLY guard is folded away |
| Allowed diff | exactly the 11 authorized files; every protected path is byte-identical to `5fec9c4` |

The build retains the existing large-client-chunk advisory, and the local Worker tools retain their missing-secret warning while the test configuration supplies its test binding.

## 18. Protected hashes and counts

| As of | Evaluator SHA-256 | Public demo SHA-256 |
| --- | --- | --- |
| 2026-09-27 | `1341fea59e307fed23ec1cd32fcdb2467d0fa3519bd07dd134fa9ddfee6deaad` | `23aaee06e51b42a4c1001d6253504f2f932d591315af468ada21345d888a5070` |
| 2026-10-01 | `be57c1bf0f9c4c615375eb0c02d48fe9dd37fcd2afda4eb67cb20f99c98544cb` | `2a777f2da9b489f8731c933b04d83620230485df58c479a7b2bcb7981f9a369e` |

Recomputed before editing, after Commit A and on the final tree, in-suite (G1, and the unchanged Phase 3J suite) and with an esbuild-bundled Node probe in production mode. human_verified is exactly `la_shra.very-high-fire-hazard-severity-zone` and `la_shra.high-fire-hazard-severity-zone`; pending_human 44; not_encoded 34; 44 `pending_human_criterion` release blockers; G1 and G2 open; `client_releasable` false. No criterion, verification record, registry, fact policy, package, capture, manifest, index pin, validity or normalization profile, reviewed-lot or lot-overlay semantics, evaluator, authority gate or evidence-authority code changed, and `PROGRAM_SCREEN_CRITERION_VERIFICATION.md` is untouched because no verification status changed. c and d re-verification deadlines are unchanged: d before 2026-10-29, c before 2026-10-31.

## 19. Operator runbook

Run from a trusted machine with an administrator session cookie for an environment where authentication is enabled (preview today; production auth is still disabled). Use output files outside the checkout.

```bash
BASE=https://<preview-host>/api/v1/program-screen/cases/$CASE_ID/preparation
COOKIE='better-auth.session_token=<admin session>'
put() { # put <path> <file> <content-type>
  curl -sS -X PUT "$BASE/$1/$(sha256sum "$2" | cut -c1-64)" -H "cookie: $COOKIE" \
    -H "content-type: $3" --data-binary @"$2"; echo; }

# 1. Offline outputs and evidence (each <= 8 MiB).
for f in source.json metadata.json normalized.json normalization-receipt.json deed.pdf; do put blobs "$f" application/octet-stream; done
# 2. The unchanged shipped CAL FIRE indexes.
put calfire/index lra-index.txt 'text/plain; charset=utf-8'
put calfire/index sra-index.txt 'text/plain; charset=utf-8'
# 3. Validate (writes nothing) and read the required candidate records per route.
curl -sS -X POST "$BASE/validate" -H "cookie: $COOKIE" -H 'content-type: application/json' --data-binary @proposal-body.json \
  | jq '.data.valid, .data.diagnostics, [.data.hazard_routes[] | {route, required: [.required_records[]? | select(.present | not) | .content_sha256]}]'
# 4. Upload each listed record (one per request, <= 16 MiB), named by its digest.
put calfire/records record-<sha256>.bin application/octet-stream
# 5. Publish (201; an identical retry returns 200 with "replayed": true), then check readiness.
curl -sS -X POST "$BASE/publish" -H "cookie: $COOKIE" -H 'content-type: application/json' --data-binary @proposal-body.json
curl -sS "$BASE" -H "cookie: $COOKIE" | jq '.data.readiness, .data.current_review.revision'
# 6. Evaluate with the unchanged Phase 3J endpoint.
curl -sS "https://<preview-host>/api/v1/cases/$CASE_ID/program-screen" -H "cookie: $COOKIE"
# Invalidate when evidence changes (CAS on the current revision):
curl -sS -X POST "$BASE/invalidate" -H "cookie: $COOKIE" -H 'content-type: application/json' \
  --data '{"expected_revision":"<revision>","reason":"evidence_withdrawn"}'
```

`proposal-body.json` is `{ "proposal": { ... }, "expected_revision": null }` for the first review and the current revision afterwards. Use the same body for validate and publish on the same day so the derived review ID matches.

## 20. Known limitations

- The receipt is an attestation; a same-structure unrelated polygon is not detectable without reprojection.
- CAL FIRE indexes and records are uploaded per case (one record per request); there is no shared or automatic pinned-dataset hydration.
- Unreferenced uploads and orphan archives from lost CAS races are not cleaned up.
- Provenance URLs are HTTPS-only but not restricted to a host allowlist.
- There is no audit viewer and no automatic repair of `pending` audit rows.
- Historical `as_of` is unsupported; the server UTC date is used.

## 21. Remaining work

- Production authentication enablement, as its own phase.
- An operator CLI over these endpoints.
- Automatic pinned-dataset hydration or a global CAL FIRE store.
- Receipt signing or other stronger provenance; a provenance host allowlist.
- A preparation UI and an audit viewer.
- Orphan cleanup for unreferenced blobs and conflict archives.
- d re-verification before 2026-10-29 and c re-verification before 2026-10-31.
- Vidor Request 3F-3 (vesting-deed review).
- G1 and G2.

No PR is opened or merged in Phase 3K, and nothing is deployed.
