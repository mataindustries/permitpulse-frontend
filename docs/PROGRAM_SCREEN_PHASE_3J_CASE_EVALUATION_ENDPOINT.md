# PermitPulse Program Screen Phase 3J: case evaluation endpoint

Phase 3J adds one production entry point, `GET /api/v1/cases/:caseId/program-screen`. It is authenticated, administrator-only, read-only and computed on read. It evaluates a case that was already prepared through the private Phase 3F/3I writer, using the Phase 3I stored-case evaluator unchanged. It adds no ingestion, UI, client access, Worker binding, environment variable, authority source, capture, package, registry, index pin, validity profile, criterion rule or criterion promotion.

## Baseline and commits

The base is `43fef1ad3562318e0030e987dee270a569c22102`, the PR #32 merge, with Phase 3I commits `10878a263beab1fe8f5cd190f83f1088ad84a525` and `e3e8d8c73b71ca5587e5277dca05bf456d8caf2d` in its history. The clean base passed: focused Phase 3I 1 file / 337 tests; focused Phase 3H 3 files / 215; Program Screen 21 files / 1,590; full app 49 files / 2,014; 16 captures verified; capture self-test 61 checks; typecheck; production build; OS verification; repository-root public validation PASS 351 / FAIL 0. Native setups used GDAL 3.10.3 / GEOS 3.13.1 through `PP_SRA_PYTHON`, `PP_LRA_PYTHON`, `PROJ_DATA` and `GDAL_DATA`.

| Commit | Subject |
| --- | --- |
| A `4ec93a49dc2ca891dcf36c695892cbf8f83becdf` | `refactor(program-screen): server-only case evaluation entry without caller evidence` |
| B (this commit) | `feat(program-screen): admin-only case evaluation endpoint` |

Commit A was independently green before Commit B: Phase 3J 28 tests; Phase 3I 337; Phase 3H 3 files / 215; Program Screen 22 files / 1,618; full app 50 files / 2,042; 16 captures; 61 self-test checks; typecheck, build, OS and root validation (351 / 0).

## 1. Problem being solved

Phase 3I made the private stored-case evaluator compute c and d from one reviewed lot snapshot, but nothing in production could call it. Its only production-shaped entry, `evaluateCaseProgramScreen(bindings, actor, caseId, input)`, still took caller evidence records (and took the subject from the first one), so exposing it would have let a caller supply records, authority blocks or a subject. Phase 3J provides a callable, read-only evaluation that takes no caller evidence at all.

## 2. Admin-only design

| File | Change |
| --- | --- |
| `app/src/worker/program-screen/evaluate-case.ts` | The evaluation body moves into the private `evaluateStoredCaseForSubject(store, subject, input, registries)`. `evaluateStoredCaseProgramScreen` keeps its exact signature, guard order (registry override, subject-from-first-record/case binding, reserved `computed-calfire-` IDs) and output, and delegates. `evaluateCaseProgramScreen(bindings, actor, caseId, asOf)` replaces the caller-input form; it had no callers. |
| `app/src/worker/cases/authorization.ts` | `mayEvaluateProgramScreen(actor)` is `actor.role === "admin"`. Existing helpers are unchanged. |
| `app/src/worker/program-screen/case-evaluation-response.ts` (new) | `PROGRAM_SCREEN_CASE_EVALUATION_VERSION`, `programScreenAsOf(now)` and the allowlist DTO builder. |
| `app/src/worker/routes/program-screen.ts` (new) | The GET route, following `reviewer.ts` / `build-week-integrity.ts`: `sessionMiddleware` only on `/:caseId/program-screen`. It loads `evaluate-case` on demand inside the handler's error guard (see below). |
| `app/src/worker/app.ts` | `app.route("/api/v1/cases", programScreenCaseRoutes)` after `reviewerRoutes`. |

The service is a second admin boundary, not only the route:

```ts
evaluateCaseProgramScreen(bindings: Pick<Bindings, "DB" | "EVIDENCE_FILES">, actor: CaseActor, caseId: string, asOf: string)
```

1. `mayEvaluateProgramScreen(actor)` or throw `Program Screen evaluation permission denied.` (before any D1 or R2 access);
2. `asOf` must be an ISO calendar date, or throw before any storage access;
3. `openProgramScreenCaseStore(bindings, actor, caseId, "read")`, the existing case authorization;
4. a server-created `Object.freeze({ case_id: store.case_id, property_id: null })` subject;
5. `{ evidence_records: [], as_of: asOf }` with `programAuthorityRegistries` only.

There is no parameter for caller evidence, authority, subject, registries, packs, lot overlay or review revision. The test file enforces the signature with `@ts-expect-error` checks under `tsc --noEmit`.

The route imports `evaluate-case` with `await import(...)` inside its `try`, rather than statically. The Workers test pool instantiates the Worker entry's static import graph before a test file registers its `vi.mock` observers. With a static import, `app.ts` would reach `evaluate-case`, `case-evidence`, `overlay-dataset`, `reviewed-lot` and `evaluate` first, and the unmodified Phase 3I suite's observers would no longer attach: in a disposable copy it fell to 189 / 337 with the static import and was 337 / 337 with the registration removed. Loading on demand keeps every existing suite unmodified and green. Behaviour is unchanged: the same function runs with the same arguments, and a load failure lands in the generic 500. The production build already ships dynamically imported Worker chunks (`dist-*.js`, `adapter-*.js`); the evaluator becomes `assets/evaluate-case-*.js` beside them, uploaded through the generated `wrangler.json` (`no_bundle: true`, ESModule rule for `**/*.js`). `index.js` contains none of the evaluator's code, and the chunk carries the production-folded TEST-ONLY guard.

## 3. Why clients are prohibited

Every Program Screen result is still `client_releasable: false`: 44 criteria await human verification, G1/G2 are open and the release gate carries 44 `pending_human_criterion` blockers. Only c and d are human-verified, and both have near review dates. Showing a client a partial screen, or letting a client probe whether their case has hazard evidence, would express more certainty than the evidence allows (Project Laws 10 and 11). The endpoint is therefore an operator tool. A client, including the owner of the case, receives 403.

## 4. HTTP contract

`GET /api/v1/cases/:caseId/program-screen`

- No request body is read. POST, PUT, PATCH and DELETE fall through to the global 404.
- HEAD is Hono's own GET dispatch with the body discarded, so it passes the same checks; no separate handler exists.
- Zero query parameters. `z.object({}).strict()` is applied to `c.req.query()`; any named parameter (`as_of`, `revision`, `evidence`, `evidence_authority`, `registries`, `case_id`, a bare `?revision`, a repeated key, and so on) is 400. Hono's parser drops a nameless pair such as `?=x`; it carries no parameter, and the suite shows such a request yields data deep-equal to the plain GET.
- Existing global behaviour supplies `Cache-Control: no-store` and `x-request-id`. No CORS, ETag, caching, CSRF or rate-limit infrastructure is added.

Success, `200`:

```json
{
  "ok": true,
  "data": {
    "schema_version": "program-screen-case-evaluation-v1",
    "case_id": "<canonical case id>",
    "as_of": "YYYY-MM-DD",
    "as_of_basis": "server_utc_calendar_date",
    "reviewed_lot": null | { "review_id", "reviewed_on", "next_review_on", "legal_lot_identity" },
    "hazard_routes": [
      { "route": "gov_51178", "authority_source_id": "calfire-lra-fhsz-2025-03-24-v1", "overlay": "computed" | "unavailable" },
      { "route": "prc_4202", "authority_source_id": "calfire-sra-fhsz-2023-09-29", "overlay": "computed" | "unavailable" }
    ],
    "screen": { "<the eleven ProgramScreenResult fields>" }
  }
}
```

Errors use the existing envelope `{ ok: false, error: { code, message }, request_id }`:

| Status | Code | Message |
| --- | --- | --- |
| 401 | `UNAUTHENTICATED` | Authentication is required. |
| 403 | `FORBIDDEN` | Program Screen evaluation requires an administrator. |
| 400 | `INVALID_QUERY` | Program Screen evaluation accepts no query parameters. |
| 400 | `INVALID_CASE_ID` | The case ID is invalid. |
| 404 | `CASE_NOT_FOUND` | The case was not found. |
| 503 | `EVIDENCE_STORAGE_UNAVAILABLE` | Evidence file storage is not configured. |
| 500 | `PROGRAM_SCREEN_EVALUATION_FAILED` | The Program Screen evaluation could not be completed. |

## 5. Authentication and authorization order

1. No session user (including `AUTH_ENABLED=false`): 401.
2. Not an administrator: 403, before the query, the case ID or the case is examined.
3. Any query parameter: 400 `INVALID_QUERY`.
4. `caseIdSchema` (UUID): 400 `INVALID_CASE_ID`.
5. `getCaseForActor`: 404 `CASE_NOT_FOUND`.
6. `EVIDENCE_FILES` unbound: 503.
7. `const asOf = programScreenAsOf(new Date())`, once.
8. `evaluateCaseProgramScreen(c.env, actor, caseRecord.id, asOf)`, with the canonical D1 `caseRecord.id`, never the raw path value. The service re-checks the role and the case.
9. Any thrown error: `logDevelopmentError(c, "Program Screen evaluation failed.", error)` and the generic 500. The DTO builder runs inside the same guard.
10. `200 { ok: true, data: buildProgramScreenCaseEvaluationResponse(result, asOf) }`.

Steps 1–6 make no R2 call; the suite counts every bucket method through a Proxy.

## 6. No existence oracle

The role check precedes every case-specific step. An unrelated client asking about a real case and about a random UUID receives byte-identical 403 bodies (apart from `request_id`); a malformed case ID is also 403 for a client, and 400 only for an administrator. No R2 call is made for any of them.

## 7. Server-supplied `as_of`

`programScreenAsOf(now)` is exactly `now.toISOString().slice(0, 10)`, the UTC calendar date, computed once per request. At `2026-10-02T03:00:00Z` (still 1 October in Los Angeles) the date is `2026-10-02`. That is intentionally conservative: in California the UTC date is never earlier than the local date, so stale-criterion and reviewed-lot expiry checks take effect no later than they would on local time. Historical evaluation is unsupported; `?as_of=` is rejected, so a caller cannot move past a criterion's review date or a reviewed lot's `next_review_on`. The DTO builder throws if `screen.as_of` differs from the server date.

## 8. Server-supplied subject

The subject is `Object.freeze({ case_id: store.case_id, property_id: null })`, where `store.case_id` is the canonical case ID the route already authorized. All three computed records share that one frozen object, and the evaluator takes the screen's subject from them. The DTO builder throws if `screen.subject.property_id` is not `null`.

## 9. Evidence boundary

The service passes zero caller records. The evaluator sees exactly `computed-calfire-high-<review_id>`, `computed-calfire-very-high-gov_51178-<review_id>` and `computed-calfire-very-high-prc_4202-<review_id>`, with their server-computed authority blocks, the shipped registries and the reviewed snapshot's one geometry. Jurisdiction and parcel-match facts show `supplied: false` with no evidence. Caller hazard authority stripping, reserved-ID refusal and registry-override protection remain in the legacy entry. The review revision, dataset pins, the TEST-ONLY production guard, the single snapshot read, route-local failure isolation and the final revision check are the unchanged Phase 3I behaviour.

## 10. Response allowlist and privacy boundary

`buildProgramScreenCaseEvaluationResponse` builds every field explicitly; nothing internal is spread. `reviewed_lot` is the frozen four-field summary the service produces only when the verified snapshot survives evaluation. `screen` is an explicit copy of the eleven `ProgramScreenResult` fields (`schema_version`, `screen_id`, `screen_scope`, `subject`, `as_of`, `facts`, `pathways`, `planning_questions`, `review_tasks`, `release`, `counts`).

The response never contains the internal `overlay` or `route_overlays`, the reviewed-lot record, geometry, dataset views, candidate record numbers, overlay issues, R2 keys, store revision or ETag, file IDs, SHA values, byte counts, URLs of the private capture, APN, PIN, PIND, tract, lot, map book, reviewer name or reviewer user ID. A19 scans the serialized response for the prepared case's actual private values.

## 11. HTTP errors versus Program Screen `unknown`

HTTP errors are only for the request itself: who is asking, what was asked, which case, and whether storage exists. Evidence state is never an HTTP error. A case that was never prepared, an expired or invalidated review, a missing index or record, partial or outside coverage, invalid or unreadable relevant geometry, an unestablished legal lot, TEST-ONLY data in a production build, or one route's source failure is a 200 with the affected criteria `unknown`, `reviewed_lot: null` where no snapshot survived, routes `unavailable` where no overlay was computed, and `client_releasable: false`. An exception that escapes the evaluator is a generic 500; its message is logged and never returned.

## 12. Revision race

The evaluator reads the review once, computes both routes, and checks the revision once at the end. A18 invalidates the review through the real writer during the first candidate-record GET. The response is 200 with c and d `unknown`, `reviewed_lot: null`, both routes `unavailable`, no lot overlay passed to the evaluator, exactly one `current-review.json` GET and a final `head` as the last bucket call. No mixed-revision conclusion is possible.

## 13. Determinism

The response is computed on read and is a function of the case, its current review, its ingested datasets and the server day. Two GETs with the same inputs return deep-equal `data`. A new review changes `reviewed_lot.review_id` and `screen_id`; a new server day changes `as_of` and `screen_id`.

## 14. Acceptance results

All 30 acceptance cases cross the HTTP boundary through `app.request(...)` with real sign-up/session cookies (A29 crosses the service boundary directly). Cases are prepared only through `openProgramScreenCaseStore(..., "write")`, `putFile`, `ingestCalFire` and `ingestReviewedLot(lot, null, "2026-10-01")`. Native cases use the injected GDAL 3.10.3 / GEOS 3.13.1 datasets with the shipped pins. Synthetic cases share one TEST-ONLY dataset per route, selected by lot position; their pins are supplied through the test-mode `overlay-dataset` mock and also appended to the exported `overlayIndexPins`, because the real R2 adapter checks that list; both are removed after each test. The clock is `vi.useFakeTimers({ toFake: ["Date"] })`, default `2026-10-01T18:00:00Z`; workerd honours it, so no production code is mocked to control time.

The Phase 3I suite is not imported and does not import this file.

| # | Case | Result |
| --- | --- | --- |
| A1 | Admin, prepared case | 200; schema `program-screen-case-evaluation-v1`; `case_id`; `as_of` 2026-10-01; `subject.property_id` null; c/d consistent |
| A2 | Client owner of the case (who can read the case itself) | 403; no screen; zero R2 calls; evaluator not reached |
| A3 | Unrelated client, real and nonexistent case | identical 403 bodies; zero R2 calls. Admin on a nonexistent case: 404 `CASE_NOT_FOUND`, zero R2 calls |
| A4 | Case A whole Very High, case B qualifying NO/NO | each response carries its own `case_id`, subject, review and result (A c disqualifying, B c consistent); `?case_id=<B>` and `?caseId=<B>` are 400 with zero R2 calls |
| A5 | No session, forged cookie, `AUTH_ENABLED=false` with a valid admin cookie | 401 each; zero R2 calls |
| A6 | Native whole Very High (PRC §4202), LRA never ingested | c `disqualifying_per_source`; `gov_51178` unavailable; d computed from SRA (High NO) and `consistent_with_source` with established authority |
| A7 | Whole Very High on GOV §51178, SRA never ingested | c `disqualifying_per_source`; d `unknown`; `prc_4202` unavailable |
| A8 | LRA High / Moderate / NonWildland with SRA Moderate, same reviewed geometry | c `consistent_with_source`, authority established, no criterion failures, one lot geometry |
| A9 | One route NO; the other partial, outside, missing index, relevant invalid, relevant unreadable or relevant record missing (12 cases, both directions) | c `unknown`; the NO route still NO |
| A10 | Same prepared store via HTTP, the direct service and the legacy entry | HTTP `data` deep-equals the direct service DTO; d criterion JSON, d record (minus subject) and d authority block are byte-identical to the legacy entry |
| A11 | Native SRA invalid record 10977 witness lot (237650,−405245)–(237665,−405230) | record 10977 is `invalid`; PRC value unknown; c `unknown` |
| A12 | Whole Very High on both routes, `legal_lot_identity: not_established` | both routes computed but neither establishes; c `unknown`; `reviewed_lot.legal_lot_identity` `not_established` |
| A13 | `evidence_authority`, `registries`, `revision`, `evidence`, `as_of`, `packs`, `lot_overlay`, `subject`, `property_id`, bare, empty and repeated keys; POST/PUT/PATCH/DELETE with a JSON body | 400 `INVALID_QUERY` for every named parameter; 404 for every other method; zero R2 calls; nameless `?`, `?=x`, `?&` yield data deep-equal to the plain GET |
| A14 | Evidence reaching the evaluator | exactly the three `computed-calfire-*` records and their blocks; facts cite only them; jurisdiction and parcel-match `supplied: false` with no evidence |
| A15 | Clock 2026-10-29 | `as_of` 2026-10-29; d stale with a `stale_criterion` blocker; c not stale; review still current |
| A16 | Clock 2026-10-31 | c and d stale with blockers; review expired (`next_review_on` 2026-10-30), so `reviewed_lot` null, routes unavailable, c/d `unknown` |
| A17 | Clock 2026-11-15 with `?as_of=2026-10-01` | 400; the plain GET is 2026-11-15 with `reviewed_lot` null and c/d `unknown` |
| A18 | Review invalidated during the first candidate-record GET | 200; c/d `unknown`; `reviewed_lot` null; both routes unavailable; one review GET; final call is the revision `head` |
| A19 | Leak scan with the prepared case's real values | exact key sets at every level; none of APN, PIN, PIND, tract, lot, map book, reviewer name/role/user ID, every file ID, file/index/record SHA, profile/pipeline SHA, source URLs and agency, store revision/ETag, `program-screen/`, `current-review`, `blobs/`, `calfire/`, `reviews/`, `issues`, `lot_geometries`, `route_overlays`, `candidate_records`, `coordinates`, or overlay issue text |
| A20 | Repeated GETs, a new review, a new server day | deep-equal `data`; new review and new day each change `screen_id` |
| A21 | Case never prepared | 200; c/d `unknown`; `reviewed_lot` null; both routes unavailable; `client_releasable` false |
| A22 | TEST-ONLY lot under `MODE=production`, `PROD=true` | control is disqualifying with a review; production build gives 200, `reviewed_lot` null, routes unavailable, c/d `unknown` |
| A23 | LRA index GET throws | PRC c YES remains; LRA unavailable; d criterion, record and block bytes identical to the normal run and to a case with no LRA |
| A24 | `EVIDENCE_FILES` unbound | admin 503 `EVIDENCE_STORAGE_UNAVAILABLE`; client still 403 |
| A25 | Headers on 200, 401, 403, 400 (query and case ID), 404, 503, 500, and an OPTIONS preflight from a foreign origin | `Cache-Control: no-store`; no `Access-Control-Allow-Origin`, `Access-Control-Allow-Credentials` or `ETag` |
| A26 | Malformed IDs (`not-a-uuid`, short UUID, `%20`, trailing character, quoted SQL) | admin 400 `INVALID_CASE_ID`; client 403; zero R2 calls |
| A27 | Protected state in the response | human_verified exactly c and d; pending_human 44; `not_encoded` 34; 44 `pending_human_criterion` blockers; not releasable; G1/G2 open |
| A28 | Evaluator throws a message containing an R2 path, a SHA and a reviewer user ID | 500 `PROGRAM_SCREEN_EVALUATION_FAILED` with only the generic message; none of those values, `Error` or `stack` in the body; logged through `logDevelopmentError` |
| A29 | Direct service call as the client owner | rejects `Program Screen evaluation permission denied.`; zero R2 calls |
| A30 | Clock 2026-10-02T03:00:00Z | `as_of` 2026-10-02 |

Commit A's service tests (28) also pin nine pre-refactor fingerprints of `evaluateStoredCaseProgramScreen` (route overlays, records, computed issues, verified-view pins and the screen), captured on the unmodified base with fixed TEST-ONLY IDs and reproduced identically twice; check the legacy guards and their order; prove the signature, frozen subject and four-field summary; refuse clients, unknown cases and non-calendar dates before any storage call; check the DTO allowlist and its defensive refusals; and recompute the protected hashes and counts.

## 15. Mutation results

Every mutation was applied alone to a disposable copy of the final implementation tree under `/tmp`, with its own `node_modules` and native caches; the working checkout was never mutated. Each run used the real native global setups (GDAL 3.10.3 / GEOS 3.13.1) and the complete Phase 3J file. The unmutated copy passed 72 / 72 first. After every mutation the copy was restored from a pristine snapshot, checked identical with `diff -r` over `app/src` and `app/tests`, and re-run to 72 / 72 before the next one. All 49 runs loaded the full 72-test file; no syntax, transform or module-load error occurred.

A failure counts only when the assertion library raised it: `AssertionError`, or a vitest `.rejects` / `toThrow` expectation failure whose top frame is in `@vitest/expect` or chai. Errors raised by product code are listed as not counted: secondary `TypeError`s in A11 after the mutation had already made its overlay unavailable, and the DTO's own defensive `Error` refusing a caller-derived subject.

| Mutation | Changed boundary | Result | Assertion failures (tests) | Not counted | Restored |
| --- | --- | --- | --- | --- | --- |
| M1 | Remove the HTTP route's admin role check | killed | 5: A2, A3, A24, A25, A26 | 0 | 72/72 |
| M2 | Move the role check after the case lookup | killed | 4: A3, A24, A25, A26 | 0 | 72/72 |
| M3 | Remove the route's getCaseForActor authorization/existence check | killed | 2: A3, A25 | 0 | 72/72 |
| M4 | Service opens a cached (first-seen) case ID instead of the authorized one | killed | 34: A1, A4, A6, A7, A8, A9, A10, A12, A14, A18, A20, A21, A22, A23, 7 service tests | 1 (TypeError) | 72/72 |
| M5 | Remove the service's own admin re-check | killed | 3: A29, 2 service tests | 0 | 72/72 |
| M6 | Drop strict empty-query validation | killed | 4: A4, A13, A17, A25 | 0 | 72/72 |
| M7a | Caller-derived subject property_id | killed | 37: A1, A4, A6, A7, A8, A9, A10, A11, A12, A13, A14, A15, A16, A17, A18, A19, A20, A21, A22, A23, A25, A27, A30, 1 service test | 2 (Error) | 72/72 |
| M7b | Introduce a schema-valid caller/anchor jurisdiction record | killed | 3: A4, A14, 1 service test | 0 | 72/72 |
| M8 | Accept caller ?as_of | killed | 3: A13, A17, A25 | 0 | 72/72 |
| M9 | programScreenAsOf uses the Los Angeles calendar date | killed | 2: A30, 1 service test | 0 | 72/72 |
| M10 | Serialize the full internal evaluation result | killed | 36: A1, A4, A6, A7, A8, A9, A10, A11, A12, A13, A14, A15, A16, A17, A18, A19, A20, A21, A22, A23, A25, A27, A30 | 0 | 72/72 |
| M11a | Add the normalized geometry SHA to the DTO | killed | 37: A1, A4, A6, A7, A8, A9, A10, A11, A12, A13, A14, A15, A16, A17, A18, A19, A20, A21, A22, A23, A25, A27, A30, 1 service test | 0 | 72/72 |
| M11b | Add the lot file reference to a hazard route entry | killed | 2: A19, 1 service test | 0 | 72/72 |
| M12a | Missing preparation becomes 404 | killed | 5: A16, A17, A18, A21, A22 | 0 | 72/72 |
| M12b | Missing preparation becomes 409 | killed | 5: A16, A17, A18, A21, A22 | 0 | 72/72 |
| M12c | Unknown criteria reported as consistent | killed | 21: A7, A9, A11, A12, A16, A17, A18, A21, A22, 1 service test | 0 | 72/72 |
| M12d | Unknown criteria reported as disqualifying | killed | 21: A7, A9, A11, A12, A16, A17, A18, A21, A22, 1 service test | 0 | 72/72 |
| M13 | Remove the final review revision check | killed | 1: A18 | 0 | 72/72 |
| M14 | Remove the TEST-ONLY production guard | killed | 1: A22 | 0 | 72/72 |
| M15 | An LRA failure poisons d/SRA | killed | 5: A6, A9, A22, A23, 1 service test | 1 (TypeError) | 72/72 |
| M16 | Add a POST endpoint that accepts a request body | killed | 1: A13 | 0 | 72/72 |
| M17a | Drop no-store for the Program Screen endpoint | killed | 43: A1, A2, A3, A4, A5, A6, A7, A8, A9, A10, A11, A12, A13, A14, A15, A16, A17, A18, A19, A20, A21, A22, A23, A24, A25, A26, A27, A28, A30 | 0 | 72/72 |
| M17b | Override with a cacheable, validator-bearing response | killed | 36: A1, A4, A6, A7, A8, A9, A10, A11, A12, A13, A14, A15, A16, A17, A18, A19, A20, A21, A22, A23, A25, A27, A30 | 0 | 72/72 |
| M18 | Echo error.message from an internal failure | killed | 2: A25, A28 | 0 | 72/72 |

Every required boundary is killed by its named acceptance test: M1 by A2; M2 by A3 and A26; M3 by A3 (an administrator's nonexistent case must stay 404 rather than reach the service); M4 by A4; M5 by A29; M6 by A13; M7 by A1 and A14; M8 by A17; M9 by A30; M10 and M11 by A19; M12 by A21 and, for the status coercions, A9; M13 by A18; M14 by A22; M15 by A23; M16 by A13; M17 by A25; M18 by A28. No mutation survived.

M4 uses a cached first-seen case ID because the more obvious variant, passing the raw path value instead of `caseRecord.id`, is equivalent: `getCaseForActor` matches the ID exactly, so a found case always has `caseRecord.id` equal to the validated path value. The route still uses the canonical `caseRecord.id`.

An earlier complete battery ran on a pre-final tree whose route imported the evaluator statically; it also killed every mutation with the same tests. Its first caller-record variant was discarded because the injected record used non-canonical claim labels, so the evaluator rejected it and every failure followed from the resulting 500; the schema-valid record above replaced it. That tree was then changed to the on-demand import (section 2), and this table is the full battery re-run on the final code.

## 16. Final verification

All gates were run on the exact final Commit B tree with GDAL 3.10.3 / GEOS 3.13.1 native setups. No native validity test was skipped, disabled, weakened or replaced, and no existing test file was edited.

| Check | Result |
| --- | --- |
| Focused Phase 3J | 1 file / 72 tests (28 Commit A service tests, 44 HTTP acceptance tests) |
| Focused Phase 3I | 1 file / 337 tests, unchanged |
| Focused Phase 3H (c promotion audit, c re-audit, SRA validity) | 3 files / 215 tests, unchanged |
| Complete Program Screen | 22 files / 1,662 tests = 1,590 + N, N = 72 |
| Full app | 50 files / 2,086 tests = 2,014 + 72 |
| Capture verification | 16 captures verified |
| Capture tool self-test | 61 checks passed |
| Typecheck | `tsc --noEmit` passed (including the signature `@ts-expect-error` checks) |
| Production build | Worker and client builds passed |
| OS verification | Safe areas, responsive shell, reduced motion, visual constraints passed |
| Repository root verification | Syntax checks passed; public-site validation PASS 351 / FAIL 0 |
| d baseline | All 66 scenarios / 92 projections byte-identical (enforced by the unmodified Phase 3I suite) |
| Production import graph | An esbuild bundle of the route, following the on-demand import, reaches 35 repository modules under `src/worker` and `src/shared`; none comes from fixtures, tests, scripts, tools, offline builders, Python, GDAL, GEOS or PROJ |

The build retains the existing large-client-chunk advisory, and the local Worker tools retain their existing missing-secret warning while the test configuration supplies its test binding. No deployment was performed.

## 17. Protected hashes and counts

| As of | Evaluator SHA-256 | Public demo SHA-256 |
| --- | --- | --- |
| 2026-09-27 | `1341fea59e307fed23ec1cd32fcdb2467d0fa3519bd07dd134fa9ddfee6deaad` | `23aaee06e51b42a4c1001d6253504f2f932d591315af468ada21345d888a5070` |
| 2026-10-01 | `be57c1bf0f9c4c615375eb0c02d48fe9dd37fcd2afda4eb67cb20f99c98544cb` | `2a777f2da9b489f8731c933b04d83620230485df58c479a7b2bcb7981f9a369e` |

These were recomputed before editing and on the final tree, both inside the test suites and independently with an esbuild-bundled Node script outside vitest. Counts remain human_verified 2 (c and d only), pending_human 44, unencoded 34, release blockers 44; G1 and G2 remain open. c and d criterion objects, rule summaries, citations, permitted outcomes, statutory routes, human-verification records and review dates are unchanged (c 2026-10-01 / 2026-10-31; d 2026-09-29 / 2026-10-29). e/f/g, outcome ceilings, issuer and authority registries, fact policies, authority-source packages, captures, manifests, `overlayIndexPins`, the SRA validity profile, the LRA/SRA packages, the normalization profile, reviewed-lot and lot-overlay semantics, `evaluate.ts`, the authority gate, evidence authority, geometry thresholds and repair rules, runtime reprojection, Wrangler bindings, environment variables, auth configuration and the client UI are unchanged. `PROGRAM_SCREEN_CRITERION_VERIFICATION.md` is untouched because no verification status changes.

## 18. Remaining work

- No production ingestion route exists. Preparing a real case still requires the private writer (`openProgramScreenCaseStore(..., "write")`, `putFile`, `ingestCalFire`, `ingestReviewedLot`) from trusted code. Operator/admin ingestion tooling or another secure preparation mechanism belongs to Phase 3K.
- Production `AUTH_ENABLED` is currently `"false"`, so every production caller currently receives 401. Preview has authentication enabled; its cases are unprepared, so an administrator there sees only `unknown`, and TEST-ONLY evidence is refused in every production build.
- No UI and no client access were added. Client access remains prohibited while `client_releasable` is false.
- Historical `as_of` is unsupported.
- c and d must be re-verified on their existing schedules: d before 2026-10-29 and c before 2026-10-31. After those dates the endpoint reports them stale, as A15 and A16 show.
- `docs/PROGRAM_SCREEN_PHASE_3F_REVIEWED_CASE_EVIDENCE.md` still describes the Phase 3F `evaluateCaseProgramScreen(bindings, actor, caseId, input)` shape as a historical record; this document and `tools/program-screen/README.md` describe the current entry.

No PR is opened or merged in Phase 3J, and nothing is deployed.
