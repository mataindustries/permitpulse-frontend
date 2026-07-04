# PermitPulse Case Workspace Milestones

These milestones build the authenticated application without changing the existing homepage, pricing, conversion copy, styles, forms, analytics, Pages configuration, `pp-api` production behavior, or current public deployment.

Each milestone is intended to be independently reviewable, deployable to staging, and reversible. Production remains off until the final release milestone.

## Global delivery rules

- All new application code stays under `app/` except app-specific GitHub Actions files.
- Do not move or rebuild `dist/`.
- Do not modify `functions/`, `workers/pp-api/`, public routes, or Cloudflare Pages settings.
- Use a separate workspace hostname, Worker, D1 database, R2 bucket, and secrets.
- Pin dependency versions in `app/package-lock.json`.
- Keep staging and production resources separate.
- Treat D1 migrations as forward-only state changes; a code rollback is not a database rollback.
- No live AI calls in pull-request tests.
- No real customer data in tests, fixtures, screenshots, traces, or preview deployments.
- Every case-scoped API route ships with explicit authorization tests.

## Milestone 0 — Baseline and deployment isolation

### Scope

- Record current public-site checksums/routes needed to detect accidental changes.
- Decide and reserve the staging and production workspace hostnames.
- Define separate Cloudflare resource names and ownership.
- Document who can approve production deploys and database migrations.
- Make no runtime changes.

### Files likely to change

- `app/README.md` or `app/docs/OPERATIONS.md` (new)
- no existing production files

### Acceptance criteria

- Public Pages project and Case Workspace deploy roots are explicitly different.
- Staging/production D1 and R2 resource names are defined but not shared.
- Current public homepage and key conversion routes have baseline hashes or smoke-test expectations.
- Required unknowns are resolved: transactional email provider, sender domain, upload policy, AI provider/budget, and retention owner.

### Tests required

- read-only public-route smoke baseline
- repository assertion that app build output cannot target root `dist/`

### Rollback notes

Documentation/resource reservations can be removed. No traffic or persistent application data exists.

### Dependencies

- none

## Milestone 1 — Isolated React/Vite/TypeScript/Worker skeleton

### Scope

- Create the independent `app/` package.
- Add React, Vite, strict TypeScript, the Cloudflare Vite integration, a minimal Hono Worker, and generated binding types.
- Serve a placeholder authenticated-app shell and `/health/live` only in local/staging.
- Configure Worker Static Assets with API routes evaluated before SPA fallback.
- Do not implement auth or cases.

### Files likely to change

- `app/package.json`
- `app/package-lock.json`
- `app/tsconfig.json`
- `app/vite.config.ts`
- `app/wrangler.jsonc`
- `app/worker-configuration.d.ts`
- `app/index.html`
- `app/src/client/**`
- `app/src/worker/index.ts`
- `app/src/shared/**`
- `app/.gitignore`

### Acceptance criteria

- `npm ci`, typecheck, local dev, build, and Worker dry-run succeed from `app/`.
- Browser assets and `/api`/health routing work on the staging Worker.
- The app deploy cannot write to or publish root `dist/`.
- No current tracked public file changes.
- Error responses include a correlation ID and no stack trace.

### Tests required

- basic Vitest test for shared code
- Hono request test for liveness and not-found behavior
- staging smoke test for SPA deep-link fallback and API route precedence
- checksum/diff guard for public homepage and redirects

### Rollback notes

Delete the new staging Worker and `app/` directory. Existing Pages and `pp-api` are unaffected.

### Dependencies

- Milestone 0

## Milestone 2 — CI quality gates, no production deploy

### Scope

- Add GitHub Actions for app-only install, typecheck, build, Vitest, and an initial Playwright smoke test.
- Add path filtering so unrelated public-site commits do not invoke or deploy the app unnecessarily.
- Store no Cloudflare production credentials in the PR workflow.

### Files likely to change

- `.github/workflows/case-workspace-ci.yml`
- `app/vitest.config.ts`
- `app/playwright.config.ts`
- `app/tests/**`
- `app/e2e/**`
- `app/package.json`

### Acceptance criteria

- Pull requests touching `app/**` run all checks.
- A failing typecheck, unit test, Worker test, build, or E2E smoke test blocks merge.
- Playwright artifacts upload only on failure and use short retention.
- No deploy occurs from pull requests.

### Tests required

- deliberate local/branch proof that each gate fails when its fixture is broken
- Playwright loads the staging/local shell and confirms `/health/live`

### Rollback notes

Remove/disable the app-specific workflows. No application state changes.

### Dependencies

- Milestone 1

## Milestone 3 — D1 and Drizzle foundation

### Scope

- Provision local and staging D1 only.
- Add Drizzle schema and reviewed migrations for the first domain foundation: `cases`, `case_participants`, `audit_events`, and `idempotency_keys`.
- Add database client/repository boundaries and migration commands.
- Do not expose case APIs yet.

### Files likely to change

- `app/drizzle.config.ts`
- `app/wrangler.jsonc`
- `app/src/shared/db/schema.ts`
- `app/src/shared/db/client.ts`
- `app/src/worker/repositories/**`
- `app/migrations/**`
- `app/tests/integration/db/**`
- `app/package.json`

### Acceptance criteria

- Migrations apply from an empty local and staging database.
- Reapplying migrations is safe/no-op through the supported migration command.
- Foreign keys and required indexes exist.
- Repository queries use bounded pagination and parameterized Drizzle operations.
- Staging and production binding declarations cannot point at the same database identity.

### Tests required

- empty-database migration test
- schema constraint/index assertions
- case number uniqueness
- participant uniqueness
- transaction/batch behavior used by the repositories
- audit event insertion

### Rollback notes

Before production data exists, delete the staging database and remove the binding. After production data exists, never reverse by deleting tables; use a compensating migration.

### Dependencies

- Milestones 1-2

## Milestone 4 — Better Auth staging proof

### Scope

- Integrate Better Auth with Hono, Drizzle, and D1.
- Add auth-owned tables through a reviewed migration.
- Implement email/password signup, required verification, login, logout, session, and password reset hooks.
- Use a sandbox transactional email provider.
- Add database-backed rate limiting and trusted Cloudflare IP configuration.
- Add a server-owned `client`/`admin` system role with signup fixed to `client`.

### Files likely to change

- `app/src/worker/auth/**`
- `app/src/worker/routes/auth.ts`
- `app/src/worker/middleware/session.ts`
- `app/src/client/features/auth/**`
- `app/src/shared/db/schema.ts`
- `app/migrations/**`
- `app/wrangler.jsonc`
- `app/.dev.vars.example`
- `app/tests/api/auth/**`
- `app/e2e/auth.spec.ts`

### Acceptance criteria

- Unverified users cannot create a session.
- Verification and reset links are single-use and expire.
- Existing-email signup does not expose account existence.
- Session cookie is host-only, `HttpOnly`, `Secure` in staging/production, and has the reviewed `SameSite` policy.
- Production/staging trusted origins are explicit.
- Request bodies cannot assign or promote role.
- First admin is created/promoted through a documented out-of-band process.
- No auth secret or email credential appears in client bundles, logs, or repository files.

### Tests required

- signup/verification/login/logout/session-expiry/password-reset API tests
- invalid/expired/reused token tests
- rate-limit tests
- origin/CSRF tests for mutations
- role-injection test
- cookie attribute assertions
- Playwright auth lifecycle

### Rollback notes

Disable app traffic or remove the staging deployment. Preserve auth tables if any staging users matter; otherwise recreate staging D1. In production, rolling back code must retain compatibility with the deployed auth schema.

### Dependencies

- Milestone 3
- selected email provider and verified/sandbox sender

## Milestone 5 — Authorization kernel and case CRUD

### Scope

- Implement the capability matrix and case-scoped repository queries.
- Add `GET/POST /api/v1/cases`, case detail, validated edit, and controlled state-transition routes.
- Add client/admin case list and detail shells.
- Add optimistic concurrency/version checks.
- Audit every create, update, participant change, and transition.

### Files likely to change

- `app/src/shared/authorization/**`
- `app/src/shared/contracts/cases.ts`
- `app/src/worker/middleware/authorize.ts`
- `app/src/worker/routes/cases.ts`
- `app/src/worker/repositories/cases.ts`
- `app/src/worker/services/cases.ts`
- `app/src/client/features/cases/**`
- `app/tests/authorization/**`
- `app/tests/api/cases/**`
- `app/e2e/cases.spec.ts`

### Acceptance criteria

- Clients see only cases where they are participants.
- Admins can see all cases.
- A newly created client case automatically receives a participant row.
- Status transitions follow one tested state machine.
- Stale updates receive a conflict response rather than overwriting.
- IDs from another case never grant access.
- Responses use explicit DTOs and omit internal/auth fields.

### Tests required

- complete role/capability matrix
- unrelated-client isolation for list, get, patch, and transition
- invalid transition tests
- optimistic concurrency tests
- pagination and sorting tests
- audit event assertions
- Playwright client create/edit plus admin visibility

### Rollback notes

Hide/disable case routes and UI while preserving D1 rows. Schema remains backward compatible.

### Dependencies

- Milestone 4

## Milestone 6 — Evidence and timeline records

### Scope

- Add `evidence_items` and `timeline_entries` schema/migrations.
- Implement scoped CRUD and list APIs.
- Add provenance, verification state, source dates, and explicit links between evidence and timeline entries.
- Add client evidence contribution and admin canonical-timeline workflows according to the capability matrix.

### Files likely to change

- `app/src/shared/db/schema.ts`
- `app/migrations/**`
- `app/src/shared/contracts/evidence.ts`
- `app/src/worker/routes/evidence.ts`
- `app/src/worker/routes/timeline.ts`
- `app/src/worker/repositories/**`
- `app/src/worker/services/**`
- `app/src/client/features/evidence/**`
- `app/src/client/features/timeline/**`
- `app/tests/api/**`
- `app/tests/authorization/**`
- `app/e2e/evidence-timeline.spec.ts`

### Acceptance criteria

- Every evidence/timeline record belongs to exactly one case.
- Source URLs and text fields are validated and safely rendered.
- Cross-case evidence/timeline IDs are denied.
- Deletes are soft/audited where history must be retained.
- Clients cannot edit admin-only canonical history.
- Lists are ordered and paginated deterministically.

### Tests required

- validation and XSS-string rendering tests
- cross-client and cross-case authorization matrix
- evidence-to-timeline foreign-key tests
- soft-delete visibility tests
- audit event assertions
- Playwright evidence and timeline flows

### Rollback notes

Disable routes/UI; retain tables and data. Use a later cleanup migration only if the feature is permanently abandoned.

### Dependencies

- Milestone 5

## Milestone 7 — Private R2 file uploads

### Scope

- Provision local and staging private R2 buckets.
- Add `files` metadata schema.
- Implement small/capped uploads through the authorized Worker, authorized downloads, and idempotent deletion.
- Add opaque object keys, type/size policy, digest metadata, quarantine/lifecycle status, and orphan repair.

### Files likely to change

- `app/wrangler.jsonc`
- `app/src/shared/db/schema.ts`
- `app/migrations/**`
- `app/src/shared/contracts/files.ts`
- `app/src/worker/routes/files.ts`
- `app/src/worker/services/files.ts`
- `app/src/worker/repositories/files.ts`
- `app/src/client/features/files/**`
- `app/tests/integration/r2/**`
- `app/tests/authorization/files.test.ts`
- `app/e2e/files.spec.ts`

### Acceptance criteria

- Buckets have no public URL.
- Object keys contain no PII or original filename.
- Unsupported types and oversized files are rejected before durable availability.
- A user must be authorized for the file's case on every read/delete.
- Downloads are attachment-first and `nosniff`.
- Failed D1/R2 partial writes are detectable and repairable.
- Deleting one case's file cannot target another object's key.

### Tests required

- allowed/disallowed media type and size tests
- magic-byte mismatch test where supported
- client A versus client B object isolation
- cross-case ID test
- upload retry/idempotency test
- partial R2/D1 failure tests
- delete/orphan cleanup tests
- Playwright upload/download

### Rollback notes

Disable upload routes first. Keep authorized reads for existing files. Do not delete a bucket until metadata/object inventory is reconciled and retention requirements are met.

### Dependencies

- Milestone 6
- approved file type/size, malware, retention, and deletion policy

## Milestone 8 — Prompt registry and evidence-backed AI draft

### Scope

- Add `prompt_versions`, `ai_runs`, and `triage_drafts`.
- Implement a provider adapter with a deterministic stub for tests.
- Build bounded evidence snapshots and structured output requiring evidence IDs.
- Add citation validation, cost/rate/concurrency controls, timeout handling, and admin-only run initiation.
- AI creates drafts only; no approval or packet yet.

### Files likely to change

- `app/src/shared/db/schema.ts`
- `app/migrations/**`
- `app/src/shared/ai/**`
- `app/src/worker/services/ai/**`
- `app/src/worker/routes/ai-runs.ts`
- `app/src/worker/repositories/ai-runs.ts`
- `app/src/client/features/triage/**`
- `app/.dev.vars.example`
- `app/wrangler.jsonc`
- `app/tests/unit/ai/**`
- `app/tests/api/ai-runs/**`
- `app/tests/fixtures/ai/**`

### Acceptance criteria

- Every run records exact prompt version, server-selected model, normalized input/hash, status, usage, and output/error.
- Browser requests cannot select model, prompt, provider, budget, or arbitrary source records.
- Evidence instructions are treated as data and cannot change system behavior.
- Every substantive output item cites valid evidence from that exact case snapshot.
- Invalid/unknown citations prevent a ready draft.
- Clients cannot start runs or see internal drafts.
- No AI output mutates case facts/timeline automatically.

### Tests required

- prompt version immutability/hash tests
- bounded input and redaction tests
- prompt-injection evidence fixtures
- valid, missing, unknown, and cross-case citation tests
- timeout/provider-error/malformed-schema tests
- duplicate-run idempotency and rate-limit tests
- authorization matrix
- no-live-provider assertion in PR CI

### Rollback notes

Disable run creation while retaining run/draft history. Revoke the provider secret if needed. Existing canonical case/evidence data is unaffected.

### Dependencies

- Milestones 6-7
- approved AI provider, data-processing terms, model, budget, and retention policy

## Milestone 9 — Human revision and approval

### Scope

- Add `approvals`.
- Implement immutable human draft revisions, approve/reject actions, and approval invalidation after new edits.
- Add admin review UI with citations beside claims.
- Add explicit client publication visibility; do not expose internal drafts.

### Files likely to change

- `app/src/shared/db/schema.ts`
- `app/migrations/**`
- `app/src/shared/contracts/triage.ts`
- `app/src/worker/routes/triage-drafts.ts`
- `app/src/worker/services/approvals.ts`
- `app/src/client/features/triage-review/**`
- `app/tests/api/approvals/**`
- `app/tests/authorization/approvals.test.ts`
- `app/e2e/approval.spec.ts`

### Acceptance criteria

- Only admins approve or reject.
- Approval references one exact immutable revision.
- Editing approved content creates a revision and removes publish eligibility until reapproved.
- Reviewer identity, time, and comment are recorded.
- Client APIs return only explicitly published/approved material.
- Every approval action is in the audit trail.

### Tests required

- role and case-scope authorization
- approve/reject transition tests
- post-approval edit invalidation
- duplicate approval idempotency
- client draft-visibility denial
- audit assertions
- Playwright admin review/approval and client visibility

### Rollback notes

Disable approval endpoints/UI. Keep immutable revisions and decisions. Do not rewrite approval history.

### Dependencies

- Milestone 8

## Milestone 10 — Branded HTML/CSS PDF and packet history

### Scope

- Add `packet_versions`.
- Create a versioned, deterministic report HTML template.
- Add the Cloudflare Browser Rendering binding in staging.
- Generate PDFs only from approved revisions.
- Store HTML and PDF immutably in R2 and expose authorized version history/download.

### Files likely to change

- `app/wrangler.jsonc`
- `app/src/shared/db/schema.ts`
- `app/migrations/**`
- `app/src/shared/reporting/**`
- `app/src/worker/services/pdf/**`
- `app/src/worker/routes/packets.ts`
- `app/src/client/features/packets/**`
- `app/tests/unit/reporting/**`
- `app/tests/integration/pdf/**`
- `app/e2e/packets.spec.ts`

### Acceptance criteria

- Unapproved drafts cannot generate packets.
- Report HTML contains no raw user/model HTML or executable script.
- Input snapshot and template version are hashed and recorded.
- Re-generation creates a new version and never overwrites an old object.
- Clients can access only packet versions for their cases that are published to them.
- Failed rendering leaves no misleading `ready` record and can be retried idempotently.
- Staging PDF output renders required fonts, branding, citations, approval, page breaks, and metadata.

### Tests required

- report escaping and deterministic HTML tests
- template/input hash tests
- approved-only authorization tests
- packet monotonic version tests
- R2 immutability and cross-case isolation
- renderer timeout/failure/retry tests
- staging real-render smoke test
- PDF text extraction/required-section assertions
- small reviewed visual fixture set
- Playwright packet history/download

### Rollback notes

Disable new generation while preserving download of existing ready versions. Remove the Browser binding only after generation is disabled. Never delete prior packets as a code rollback.

### Dependencies

- Milestones 7 and 9
- Browser Rendering availability, quota, and cost accepted
- approved brand/report template

## Milestone 11 — Full product E2E and operational hardening

### Scope

- Complete client/admin navigation and empty/error/loading states.
- Add security headers, log redaction, health/readiness, metrics, and operational runbooks.
- Exercise account recovery, data export/deletion, orphan repair, and backup/restore.
- Run a staging threat review focused on IDOR, file handling, XSS, CSRF, and AI/PDF boundaries.

### Files likely to change

- `app/src/client/**`
- `app/src/worker/**`
- `app/wrangler.jsonc`
- `app/e2e/**`
- `app/tests/**`
- `app/docs/OPERATIONS.md`
- `app/docs/INCIDENT_RESPONSE.md`
- `.github/workflows/case-workspace-ci.yml`

### Acceptance criteria

- Complete client and admin happy paths pass.
- All authorization matrix tests remain release blockers.
- Strict CSP and other workspace security headers are active without weakening the public site's headers.
- Logs contain correlation IDs but no passwords, tokens, file contents, prompt bodies, or unnecessary PII.
- Backup/export and restore are demonstrated against staging.
- Data deletion and R2 orphan repair are demonstrated.
- Runbooks name owners and exact rollback/disable procedures.

### Tests required

- full Playwright client/admin suite
- session expiry/revocation and password-reset E2E
- OWASP-style IDOR route sweep
- stored/reflected XSS fixtures
- CSRF/origin tests
- upload abuse tests
- accessibility smoke tests for critical flows
- staging backup/restore exercise
- staging AI and PDF contract smoke tests with fixed cost caps

### Rollback notes

Feature flags can disable AI, uploads, or packet generation independently. Authentication and read-only case access should remain available unless the entire staging app is disabled.

### Dependencies

- Milestones 4-10

## Milestone 12 — Production infrastructure and controlled launch

### Scope

- Provision production D1, private R2, Browser binding, secrets, and workspace custom domain.
- Add a protected GitHub production environment and least-privilege Cloudflare deploy credential.
- Apply production migrations, deploy with no users or a small invited pilot, and run smoke tests.
- Keep the public marketing site unchanged; no homepage link is part of this milestone unless separately approved.

### Files likely to change

- `app/wrangler.jsonc`
- `.github/workflows/case-workspace-deploy.yml`
- `app/docs/OPERATIONS.md`
- no public `dist/` or Pages files

### Acceptance criteria

- Production resources are distinct from staging.
- Required secrets/bindings are validated before deploy.
- Production migration identifiers and recovery point are recorded.
- Admin bootstrap uses the documented secure process.
- Signup policy is explicit: open with verification or invite-only.
- Smoke tests cover auth, case isolation, private file access, admin review, and packet download.
- AI/PDF kill switches and budget alerts are in place.
- No current public-site checksum, route, form, analytics, or deployment setting changes.

### Tests required

- production-safe smoke tests using synthetic accounts/data
- client A/client B isolation check
- secure cookie/header check
- one controlled private upload/download/delete
- one controlled stubbed or budget-approved AI/PDF flow
- rollback/feature-disable drill

### Rollback notes

- remove/disable workspace hostname traffic or deploy the prior Worker version
- do not attempt to roll back D1 by reverting code
- leave D1/R2 intact for investigation and recovery
- revoke exposed credentials immediately if the rollback is security-related
- existing Pages marketing site remains operational throughout

### Dependencies

- Milestones 0-11
- production privacy/retention approval
- production email, AI, and Cloudflare budgets
- named operational owner

## Milestone 13 — Optional public-site integration

This is explicitly outside the initial application build and requires separate approval because it changes current production behavior.

### Scope

- Add a login/workspace link or intentional route from the public site.
- Preserve current conversion copy, forms, analytics, and styling unless separately requested.
- Prefer a direct link to `workspace.getpermitpulse.com`; do not proxy the SPA under `/app` without a dedicated routing project.

### Files likely to change

- selected `dist/` HTML/template source
- possibly `dist/_redirects` only if a path-based route is deliberately chosen
- analytics documentation/tests if a new cross-domain link event is added

### Acceptance criteria

- public homepage visual and conversion regression review is approved
- all current forms and analytics events still work
- no wildcard rewrite intercepts workspace routes
- auth cookie remains isolated from the marketing site
- rollback is a one-link/rewrite revert

### Tests required

- current public smoke suite
- mobile/desktop visual comparison
- form submission and analytics event verification
- cross-domain navigation and return-path test

### Rollback notes

Revert only the public link/routing change. Case Workspace remains independently deployable and reachable at its hostname.

### Dependencies

- Milestone 12
- explicit authorization to change the public-facing site
