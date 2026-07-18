# PermitPulse Case Workspace

> **Current controlled-pilot baseline (July 2026):** this application now
> includes Evidence Inbox uploads backed by R2/D1, reviewer editorial records,
> an immutable packet/delivery lifecycle, and canonical Preview, HTML, text,
> and PDF rendering. Some later sections below retain historical milestone
> notes for implementation context. Production authentication intentionally
> remains disabled in `wrangler.jsonc` until the production D1/R2 bindings,
> migrations, secrets, first administrator, custom domain, and operational
> controls have been verified through the release checklist.

This directory is an isolated Cloudflare Worker, React/Vite client, Hono API,
and D1 database. It does not share deployment configuration with the public
PermitPulse site in `../dist`, Pages Functions in `../functions`, or the
existing Worker in `../workers/pp-api`.

The current application provides email/password authentication, D1-backed
sessions and case isolation, case/evidence/timeline/reviewer workspaces, an
R2/D1-backed Evidence Inbox, immutable packet snapshots and delivery events,
and one canonical packet presentation graph shared by Preview, HTML, text, and
PDF adapters. The legacy optional AI Review surface remains a deterministic
local scaffold: it makes no live model call and stores no generated review.
The separately gated OpenAI Build Week 2026 Case Integrity Engine is documented
in the repository root README and uses its own schema, routes, and controls.

There is no participant-assignment UI, stored PDF artifact, generally enabled
live AI in production, billing, email delivery, OAuth, client sharing portal,
or production user-management UI.
Production authentication remains intentionally disabled until the deployment
prerequisites below are completed.

## Controlled-pilot deployment prerequisites

The code and a deployed environment are separate release gates. Before any
pilot user is invited:

1. Use the reviewed `preview` environment for the controlled pilot. Do not
   enable the production environment as a shortcut.
2. Create the dedicated preview D1 database and private preview R2 bucket
   manually. Resolve the D1 ID into the ignored `.wrangler.preview.jsonc`
   file; no account-specific resource ID belongs in the tracked config.
3. Apply all migrations through `0011_build_week_case_integrity.sql` to that
   exact D1 database, then verify Wrangler reports no pending migration.
4. Store a unique, high-entropy `BETTER_AUTH_SECRET` with Wrangler secret input;
   never place its value in source, shell history, or `vars`.
5. Confirm `BETTER_AUTH_URL` exactly matches the HTTPS Worker/custom-domain
   origin that users will open. Verify cookies are `Secure`, `HttpOnly`, and
   same-site in that environment.
6. Keep the R2 bucket private: no `r2.dev` public URL and no public custom
   domain. Verify uploaded objects are reachable only through the authenticated
   evidence-file route.
7. Bootstrap exactly one preview administrator with the one-shot procedure
   below, immediately disable bootstrap, delete its secret, and verify the
   endpoint returns `404` afterward.
8. Keep public signup, development case APIs, live AI, and external AI calls
   disabled. Pilot access must use explicitly provisioned accounts.
9. Configure a Worker custom domain or reviewed `workers.dev` route, TLS, WAF
   rate limits for auth and upload endpoints, log retention/redaction, alerting,
   and an R2/D1 orphan-reconciliation runbook.
10. Run the complete release validation matrix and the Android smoke checklist
    against the deployed origin using only fictional data before inviting a
    controlled operator cohort.

## Controlled-pilot preview deployment runbook

This is a manual preview release. It does not enable production, create live-AI
or external-delivery capabilities, or authorize Wrangler to provision missing
resources. Run remote commands only during an approved release window. The
tracked top-level configuration remains production-auth-disabled; the named
`preview` environment uses a separate Worker, D1 database, and R2 bucket.

### 1. Create the preview resources manually

Authenticate to the intended Cloudflare account and confirm the account before
creating anything:

```bash
npx wrangler whoami
npx wrangler d1 create permitpulse-case-workspace-preview --location wnam
npx wrangler r2 bucket create permitpulse-evidence-files-preview --location wnam
```

Choose a different reviewed location only when the pilot's data residency
requires it. Record the D1 UUID returned by Cloudflare. Do not commit it. In the
R2 dashboard, open `permitpulse-evidence-files-preview` and verify both Public
Development URL (`r2.dev`) and Custom Domains are disabled. R2 objects are
served only through the authenticated Worker route; the application has no
public bucket URL setting.

Set the non-secret deployment inputs in the release shell. The origin must be
the exact HTTPS origin the browser will use:

```bash
export PERMITPULSE_PREVIEW_D1_DATABASE_ID='<D1 UUID returned above>'
export PERMITPULSE_PREVIEW_ORIGIN='https://permitpulse-case-workspace-preview.<account-subdomain>.workers.dev'
```

Generate the ignored, mode-`0600` resolved config and validate it. The command
does not print the resource ID or any secret value:

```bash
npm run preview:config
npm run preflight:preview:resolved
```

`.wrangler.preview.jsonc` is ignored by Git. `npm run deploy:preview` disables
Wrangler automatic provisioning and automatic reconfiguration, so a missing or
incorrect resource fails the release instead of creating an accidental blank
database or bucket.

### 2. Apply and verify migrations through 0011

Inspect the pending list, apply it to the resolved preview binding, then require
an empty pending list:

```bash
npm run db:migrate:preview:list
npm run db:migrate:preview
npm run db:migrate:preview:list
```

Verify the migration ledger and the final Evidence Inbox table explicitly:

```bash
npx wrangler d1 execute DB \
  --env preview \
  --remote \
  --config .wrangler.preview.jsonc \
  --no-x-provision \
  --command "SELECT id, name, applied_at FROM d1_migrations ORDER BY id; SELECT name FROM sqlite_master WHERE type = 'table' AND name IN ('evidence_drafts', 'build_week_integrity_runs') ORDER BY name;"
```

The ledger must list exactly `0001_create_cases.sql` through
`0011_build_week_case_integrity.sql`, and the second query must return both
`build_week_integrity_runs` and `evidence_drafts`. Do not deploy if either
check differs.

Before applying migrations to an existing pilot database, capture a D1 export:

```bash
npx wrangler d1 export DB \
  --env preview \
  --remote \
  --config .wrangler.preview.jsonc \
  --output /tmp/permitpulse-preview-before-migration.sql
```

### 3. Prepare the required authentication secret

For the first deployment, upload the required secret atomically with the
reviewed Vite build. This avoids `wrangler secret put` creating an earlier
Worker version from the source configuration. Create a temporary mode-`0600`
dotenv file containing exactly one line,
`BETTER_AUTH_SECRET=<unique high-entropy value>`:

```bash
umask 077
${EDITOR:-vi} /tmp/permitpulse-preview-secrets.env
npm run preflight:preview:secret-file
```

Generate the value with a cryptographically secure secret manager or
`openssl rand -base64 48`. Do not reuse a local or production credential, or
paste the value into source, `vars`, shell arguments, tickets, or logs. The
preflight checks the filename, permissions, only allowed key, and minimum
length without printing the value. The runtime independently rejects secrets
shorter than 32 bytes. Preview authentication also fails closed unless
`BETTER_AUTH_URL` is a path-free HTTPS origin. Public signup and development
APIs remain disabled.

### 4. Deploy preview

With the two `PERMITPULSE_PREVIEW_*` shell inputs still set, make the first
deployment with the permission-checked secret file:

```bash
npm run deploy:preview:first
rm /tmp/permitpulse-preview-secrets.env
npx wrangler secret list \
  --env preview \
  --config .wrangler.preview.jsonc
```

This command prepares the ignored config, builds specifically with
`CLOUDFLARE_ENV=preview`, reruns the resolved preflight, and deploys the Vite
build output with `--secrets-file`, `--no-x-provision`, `--no-autoconfig`, and
`--strict`. Confirm the secret list includes `BETTER_AUTH_SECRET`. Subsequent
preview code deployments use `npm run deploy:preview`; Wrangler preserves the
already-configured encrypted secret. Do not replace either command with a bare
`wrangler deploy`, which could target the disabled top-level environment.

After deployment, verify `/api/health`, the configured HTTPS origin, secure
cookie attributes, R2 privacy, Workers Logs, and the Android checklist below
before admitting a pilot user.

### 5. Create the first administrator and permanently close bootstrap

The only first-admin path is `POST /api/internal/bootstrap-admin`. It is
preview-only, requires an empty user table, a one-time D1 claim, a temporary
secret, and an explicit build-time switch. The tracked/default switch is
`false`.

Generate and store a separate temporary token interactively:

```bash
openssl rand -base64 48
npx wrangler secret put ADMIN_BOOTSTRAP_TOKEN \
  --env preview \
  --config .wrangler.preview.jsonc
export PERMITPULSE_PREVIEW_BOOTSTRAP_ENABLED=true
npm run deploy:preview
```

Call the endpoint exactly once with a password of at least 12 characters. Keep
the token and password in temporary, non-history shell variables or a reviewed
secret manager; the request body accepts only `email`, `name`, and `password`:

```bash
read -r -s -p 'Bootstrap token: ' PERMITPULSE_BOOTSTRAP_TOKEN
export PERMITPULSE_BOOTSTRAP_TOKEN
umask 077
${EDITOR:-vi} /tmp/permitpulse-bootstrap-admin.json
curl --fail-with-body \
  -H 'content-type: application/json' \
  -H "authorization: Bearer ${PERMITPULSE_BOOTSTRAP_TOKEN}" \
  --data-binary @/tmp/permitpulse-bootstrap-admin.json \
  "${PERMITPULSE_PREVIEW_ORIGIN}/api/internal/bootstrap-admin"
rm /tmp/permitpulse-bootstrap-admin.json
unset PERMITPULSE_BOOTSTRAP_TOKEN
```

The temporary JSON file must contain one fictional-pilot administrator object,
for example `{"email":"...","name":"...","password":"..."}`. Never commit
or retain that file.

Sign in as the administrator and confirm the role before closing bootstrap.
Then remove the enablement variable, redeploy the default disabled config,
delete the temporary secret, and require a `404` from the endpoint:

```bash
unset PERMITPULSE_PREVIEW_BOOTSTRAP_ENABLED
npm run deploy:preview
npx wrangler secret delete ADMIN_BOOTSTRAP_TOKEN \
  --env preview \
  --config .wrangler.preview.jsonc
curl --output /dev/null --silent --write-out '%{http_code}\n' \
  -X POST "${PERMITPULSE_PREVIEW_ORIGIN}/api/internal/bootstrap-admin"
```

The final command must print `404`. Leave bootstrap disabled permanently. A
failed create after the D1 claim is intentionally fail-closed; investigate the
database and release logs rather than deleting the claim and retrying casually.

### 6. R2/D1 reconciliation and cleanup

Normal failed uploads remove the just-written R2 object with bounded retries.
Draft deletion first claims the D1 rows, deletes the private R2 objects, and
then deletes the claimed rows; a stale claim becomes retryable after five
minutes. A prolonged R2 outage can still require manual reconciliation, and a
D1 failure after successful R2 deletion can leave a draft row that references
a missing object.

For reconciliation, pause uploads and bulk deletion, export the D1 inventory,
and compare exact `storage_key` values with the private bucket object inventory
in the Cloudflare dashboard:

```bash
npx wrangler d1 execute DB \
  --env preview \
  --remote \
  --config .wrangler.preview.jsonc \
  --no-x-provision \
  --command "SELECT id, owner_user_id, storage_key, queue_state, moved_to_evidence_id, updated_at FROM evidence_drafts ORDER BY storage_key;"
```

- If D1 references a missing object, preserve the row and investigate the
  request ID/logs. A stale delete claim may be retried through the authenticated
  UI; do not fabricate or replace private evidence.
- If an R2 object has no matching D1 row, wait for in-flight requests to finish,
  repeat both inventories, record the key and decision in the incident log,
  then delete only that confirmed orphan through the R2 dashboard or
  `npx wrangler r2 object delete 'permitpulse-evidence-files-preview/<exact-key>'`.
- Never log object contents, signed/private URLs, cookies, filenames containing
  private data, or secret values. Do not enable `r2.dev` for reconciliation.

### 7. Rollback

Pause pilot access and list recent preview Worker versions:

```bash
npx wrangler versions list --name permitpulse-case-workspace-preview
npx wrangler rollback '<KNOWN_GOOD_VERSION_ID>' \
  --name permitpulse-case-workspace-preview \
  --message 'Controlled-pilot rollback'
```

Verify health, authentication, and the affected workflow after rollback. D1
migrations are forward-only: do not run down migrations, delete migration-ledger
rows, or restore an older D1 snapshot merely to match rolled-back code. If a
schema/data incident is suspected, stop writes, preserve the pre-migration
export and R2 inventory, and conduct a separate reviewed recovery. Secrets are
not removed by an ordinary code rollback; bootstrap must still remain disabled.

### 8. Android controlled-pilot smoke checklist

Use Chrome on a supported Android phone against the deployed HTTPS preview
origin with fictional data only:

1. Confirm the TLS page loads with no certificate or mixed-content warning.
2. Confirm public signup is unavailable and an unauthenticated workspace/API
   request returns `401` or the safe sign-in surface.
3. Sign in with the controlled account; inspect the session cookie and confirm
   `Secure`, `HttpOnly`, `SameSite=Lax`, and the `permitpulse` prefix.
4. Rotate the phone and verify no page-wide horizontal overflow; only intended
   tab strips/tables may scroll. Confirm touch targets and keyboard focus remain
   usable at narrow width.
5. Create/open a fictional case and confirm another controlled account cannot
   discover it by URL or identifier.
6. Upload one small fictional PDF or image from Android Files. Confirm the
   private preview opens only while authenticated and downloads as an
   attachment with `nosniff`.
7. Try an unsupported or malformed file and confirm the safe validation error;
   confirm no draft/object appears.
8. Move evidence into an authorized case, exercise timeline/reviewer state,
   and confirm stale-version conflicts require reload rather than overwrite.
9. Generate Packet Preview and download the PDF; confirm canonical section
   order, page readability, and no clipped identifiers or controls.
10. Exercise the delivery lifecycle only through allowed transitions and
    confirm confirmation prompts remain usable on touch.
11. Open AI Review and verify `live_ai=false` and `external_calls=false`; do not
    enter sensitive data into the deterministic draft surface.
12. Trigger one safe validation error and confirm its response includes a
    request ID that can be found in Workers Logs without secret, cookie, upload
    content, or private URL disclosure.
13. Sign out, use Back, refresh, and directly revisit a private file/API URL;
    confirm the authenticated workspace and evidence are no longer available.
14. Confirm the bootstrap endpoint returns `404`, the R2 bucket remains private,
    and no development/demo route is reachable from the deployed hostname.

### Known controlled-pilot limitations

- No participant-assignment UI or general user-management UI; administrator
  provisioning and support remain controlled operations.
- No account/case deletion workflow and no automatic cross-store orphan job.
- Evidence parsing is deterministic validation/classification only; there is no
  OCR and no live or external AI.
- PDFs are generated on demand and are not stored as immutable R2 artifacts.
- No email delivery, billing, client-sharing portal, OAuth, or automated
  notification path.
- Case detail has no deep-link router, and Android behavior still requires the
  deployed-origin smoke pass above.
- Logs and request IDs aid diagnosis but do not replace an approved retention,
  redaction, alerting, incident-response, and access-control policy.

## Canonical fictional demo case

With local migrations applied and the development server running, seed the
fictional Arroyo Vista ADU case through the authenticated, loopback-only demo
endpoint:

```bash
PERMITPULSE_DEMO_ADMIN_EMAIL='local-admin@example.test' \
PERMITPULSE_DEMO_ADMIN_PASSWORD='local-admin-password' \
npm run demo:seed:local
```

Set `PERMITPULSE_LOCAL_URL` only when the local app is not available at the
trusted default `http://localhost:5173`. The account must already have the local `admin` role.
The seed requires `APP_ENV=local` and `ENABLE_DEV_CASE_API=true`, is idempotent,
does not delete other cases, and leaves `LADBS-FICTIONAL-2026-1842` in
`packet_generated` for manual review, approval, and PDF-export testing. The
endpoint is unavailable in preview and production.

### One-time canonical demo seed for preview

The deployed preview has a separate internal seed endpoint at
`POST /api/internal/seed-arroyo-vista`. It returns `404` unless
`APP_ENV=preview` and the temporary `PREVIEW_DEMO_SEED_ENABLED` switch is
exactly `true`. An enabled request must also have a valid preview administrator
session, the exact confirmation body, the trusted application origin, and a
temporary high-entropy `PREVIEW_DEMO_SEED_TOKEN` Wrangler secret. This does not
enable `/api/dev/*`, public signup, or any unauthenticated demo route.

From an Android-connected Codespace terminal, keep the existing
`PERMITPULSE_PREVIEW_D1_DATABASE_ID` and `PERMITPULSE_PREVIEW_ORIGIN` exports
used for preview deployments, then run the following sequence. These are
operator commands: no repository script deploys or changes remote D1 by
itself.

```bash
cd /workspaces/permitpulse-frontend/app
export PERMITPULSE_PREVIEW_BOOTSTRAP_ENABLED=false
export PERMITPULSE_PREVIEW_DEMO_SEED_ENABLED=false
npm run preview:config

umask 077
openssl rand -base64 48 > /tmp/permitpulse-preview-seed-token
npx wrangler secret put PREVIEW_DEMO_SEED_TOKEN \
  --env preview \
  --config .wrangler.preview.jsonc \
  < /tmp/permitpulse-preview-seed-token

export PERMITPULSE_PREVIEW_DEMO_SEED_ENABLED=true
npm run deploy:preview

read -r -p 'Preview administrator email: ' PERMITPULSE_DEMO_ADMIN_EMAIL
read -r -s -p 'Preview administrator password: ' PERMITPULSE_DEMO_ADMIN_PASSWORD
printf '\n'
export PERMITPULSE_DEMO_ADMIN_EMAIL PERMITPULSE_DEMO_ADMIN_PASSWORD
export PERMITPULSE_PREVIEW_SEED_TOKEN_FILE=/tmp/permitpulse-preview-seed-token
npm run demo:seed:preview
npm run demo:seed:preview
```

The first seed prints `outcome: "created"` when the case is absent, or
`"reconciled"` when canonical records were repaired. The immediate replay must
print `outcome: "already_current"`, with no additional case, evidence,
timeline, reviewer, or lifecycle rows. The response and remote smoke check also
report 9 evidence records, 8 timeline events, 4 approved findings, 5 open
questions, 5 stored approved actions, 3 Agency Dependency Map entries, a ready
Action Kit, `packet_generated`, presentation v3, renderer v4, a current
persisted snapshot, zero packet blockers, more than three PDF pages, and these
populated PDF sections:

```text
Findings
Agency Dependency Map
Open Questions
Recommended Next Actions
Agency Follow-Up Kit
Timeline
Supporting Evidence
```

Run this read-only verification query against preview. It does not expose user
credentials or alter remote data:

```bash
npx wrangler d1 execute DB \
  --env preview \
  --remote \
  --config .wrangler.preview.jsonc \
  --no-x-provision \
  --command "WITH target AS (
    SELECT id FROM cases WHERE permit_number='LADBS-FICTIONAL-2026-1842'
  ), latest AS (
    SELECT * FROM delivery_lifecycle_events
    WHERE case_id=(SELECT id FROM target)
    ORDER BY sequence DESC LIMIT 1
  )
  SELECT
    (SELECT COUNT(*) FROM target) AS case_count,
    (SELECT COUNT(*) FROM evidence_items WHERE case_id=(SELECT id FROM target) AND deleted_at IS NULL) AS evidence_count,
    (SELECT COUNT(*) FROM timeline_entries WHERE case_id=(SELECT id FROM target) AND deleted_at IS NULL) AS timeline_count,
    (SELECT COUNT(*) FROM reviewer_findings WHERE case_id=(SELECT id FROM target) AND approved=1) AS approved_findings,
    (SELECT COUNT(*) FROM reviewer_questions WHERE case_id=(SELECT id FROM target) AND publishable=1 AND status IN ('open','waiting')) AS open_questions,
    (SELECT COUNT(*) FROM reviewer_actions WHERE case_id=(SELECT id FROM target) AND approved=1) AS approved_actions,
    (SELECT COUNT(*) FROM reviewer_action_kits WHERE case_id=(SELECT id FROM target) AND approved=1) AS approved_action_kit,
    (SELECT resulting_state FROM latest) AS lifecycle_state,
    (SELECT json_extract(snapshot_json,'$.presentation_version') FROM packet_generations WHERE id=(SELECT packet_generation_id FROM latest)) AS presentation_version,
    (SELECT json_array_length(json_extract(snapshot_json,'$.agency_dependencies')) FROM packet_generations WHERE id=(SELECT packet_generation_id FROM latest)) AS agency_dependencies;
  "
```

Expected values are `1, 9, 8, 4, 5, 5, 1, packet_generated, 3, 3` in the
selected column order. Existing administrator and unrelated case rows remain
untouched.

Immediately after the seed and verification, disable the gate before deleting
its secret. If any seed or verification step fails, run this shutdown block
before investigating:

```bash
export PERMITPULSE_PREVIEW_DEMO_SEED_ENABLED=false
npm run deploy:preview
npx wrangler secret delete PREVIEW_DEMO_SEED_TOKEN \
  --env preview \
  --config .wrangler.preview.jsonc
rm -f /tmp/permitpulse-preview-seed-token
unset PERMITPULSE_PREVIEW_SEED_TOKEN_FILE
unset PERMITPULSE_DEMO_ADMIN_PASSWORD PERMITPULSE_DEMO_ADMIN_EMAIL
curl --output /dev/null --silent --write-out '%{http_code}\n' \
  -X POST "${PERMITPULSE_PREVIEW_ORIGIN}/api/internal/seed-arroyo-vista"
curl --output /dev/null --silent --write-out '%{http_code}\n' \
  -X POST "${PERMITPULSE_PREVIEW_ORIGIN}/api/dev/cases/demo/arroyo-vista"
```

Both final commands must print `404`. Confirm `npx wrangler secret list --env
preview --config .wrangler.preview.jsonc` no longer lists
`PREVIEW_DEMO_SEED_TOKEN`.

For the Android smoke pass, open the preview HTTPS origin in Chrome, sign in as
the administrator, and open `Arroyo Vista ADU Resubmittal`. Confirm nine
evidence cards and eight canonical timeline events, then open Packet Preview
and verify Findings, Agency Dependency Map, Open Questions, Recommended Next
Actions, Agency Follow-Up Kit, Timeline, Supporting Evidence, and Supporting
Sources are populated. Download and open the PDF, rotate the phone, zoom each
page, and confirm those sections, the fictional disclosure, source labels, and
the `Presentation v3 · renderer v4` integrity line are readable without
clipping. Sign out, use Back, refresh, and confirm the case and PDF are no
longer accessible. Finally confirm the two shutdown probes above still return
`404` and ordinary authenticated case isolation remains unchanged.

## AI Review provider scaffold and evaluation foundation

The PermitPulse Packet Review Assistant remains disabled for real live-AI use.
The foundation under `src/shared/ai-review/` now includes deterministic output,
a local model-shaped test provider, and a Worker-compatible live-provider
adapter scaffold. Every candidate passes the same prompt-input and result
gates. The protected route is:

```text
POST /api/v1/cases/:caseId/ai-review/draft
```

For an authorized case, the Worker assembles the same bounded server-side
`PacketModel` used by the packet routes. The provider runner scans that packet,
builds an allowlisted prompt contract, scans the contract again, invokes one
registered local provider, validates the candidate against the strict
`PacketReviewDraft` schema, rejects citations outside that exact packet
snapshot, and requires the evaluator/safety checker to pass before returning:

```json
{
  "ok": true,
  "data": {
    "review": {},
    "evaluation": {
      "score": 100,
      "passed": true,
      "warnings": [],
      "citation_validity": {
        "score": 100,
        "passed": true,
        "invalid_citations": []
      },
      "safety": {
        "passed": true,
        "warnings": []
      }
    },
    "metadata": {
      "provider": "deterministic-baseline",
      "reviewer": "deterministic-baseline",
      "live_ai": false,
      "external_calls": false,
      "evaluation_passed": true,
      "safety_blocked": false,
      "warnings_count": 0
    }
  }
}
```

The browser sends an empty JSON object for default generation, and the route
selects `deterministic-baseline`:

```json
{}
```

For compatibility, the route also treats a truly empty request body as `{}`.
It accepts either of these strict provider-selection JSON bodies:

```json
{ "provider": "deterministic-baseline" }
```

```json
{ "provider": "mock-live-provider" }
```

No other request field is accepted. In particular, callers cannot submit
freeform prompts, instructions, model names, API credentials, endpoints, or
provider configuration. `mock-live-provider` is a deterministic local test
double for exercising a model-shaped provider boundary; despite its name it
makes no network call and always reports `live_ai=false` and
`external_calls=false`. `live-model-provider` is recognized by the strict
request schema but is rejected unless the server-side local-only configuration
described below is fully enabled. With no body or `{}`, the route always keeps
`deterministic-baseline` as its default.

Authorization exactly matches packet reads: administrators may generate a
draft for any case, participating clients may generate one for their case,
unrelated clients receive the same safe `404 CASE_NOT_FOUND` as a missing
case, unauthenticated requests receive `401 UNAUTHENTICATED`, and malformed
case UUIDs receive `400 INVALID_CASE_ID`.

The foundation includes:

- A strict `PacketReviewDraft` schema for `summary`, `missing_information`,
  `recommended_next_actions`, `evidence_citations`, `unsupported_claims`,
  `confidence_notes`, and optional local-only `model_metadata`.
- Twenty fictional packet review fixtures covering empty or weak evidence,
  unverified and disputed evidence, verified evidence, missing permit numbers,
  missing source URLs, stalled reviews, correction cycles, inspection issues,
  timeline/evidence mismatches, missing timeline/activity records, conflicting
  evidence, canonical and contributed timeline entries, outdated source dates,
  jurisdiction mismatch, incomplete addresses, and high-risk unsupported action
  temptations.
- A deterministic baseline reviewer that uses only fields already present in a
  `PacketModel`. It summarizes safe enumerated status and packet counts,
  identifies obvious missing fields, recommends generic human review steps,
  cites only existing evidence/timeline/activity IDs, warns about unconfirmed
  or disputed evidence, and avoids echoing arbitrary stored strings that could
  look like approval predictions, legal guarantees, agency outcomes, reviewer
  names, dates, or code sections.
- A provider abstraction with `deterministic-baseline`,
  `mock-live-provider`, and a disabled `live-model-provider` adapter.
  The first two are local-only, deterministic, require no secrets or SDK, and
  make no external calls.
- A narrow live adapter boundary that accepts only the scanned prompt contract,
  prepares a bounded model request, reads at most 64 KiB from a provider
  response, parses strict model-shaped JSON, replaces untrusted model metadata,
  and sends the draft through the existing schema, exact-citation, evaluator,
  and safety gates. It uses no provider SDK or browser automation.
- An allowlisted prompt contract that copies safe packet fields and explicit
  evidence/timeline/activity citation IDs. Its rules prohibit invented
  agencies, reviewer names, code sections, dates, outcomes, approval
  predictions, legal guarantees, and treating unverified evidence as verified;
  it requires strict `PacketReviewDraft` JSON.
- A structured-field scanner that checks packet input before prompt assembly
  and checks the assembled prompt before provider invocation. It detects
  password, token, cookie, session, authorization, account, API-key, secret,
  hash, and request-ID keys (including obvious compound key forms), reports
  paths and severity, and blocks provider execution. It checks keys rather than
  arbitrary prose, so normal explanatory text containing those words does not
  produce a false block.
- A provider result gate that fails closed unless output passes the strict
  schema, exact-snapshot citation validation, evaluator score threshold, and
  safety checks. Failed candidates are not returned and no review is stored.
- An evaluator that scores schema validity, groundedness, citation validity,
  missing-information coverage, unsupported-claim penalties, safety warnings,
  and pass/fail status.

Run the local evaluation harness from `app/`:

```bash
npm run ai:eval:local
```

The script runs all fixtures against the deterministic baseline, prints fixture
count, average score, pass/fail counts, and a per-fixture summary. It requires
no secrets, makes no external calls, applies no migrations, and does not touch
Cloudflare resources.

The endpoint is stateless. It does not write an AI review, prompt, run,
evaluation, or packet to D1, R2, local disk, or any other storage. Default
behavior requires no API key, provider secret, network call, provider SDK, or
AI environment variable. There is no production AI UI.

### Disabled live-provider configuration

Production and preview explicitly keep these non-secret settings disabled:

```dotenv
AI_REVIEW_PROVIDER=deterministic-baseline
AI_REVIEW_LIVE_ENABLED=false
AI_REVIEW_EXTERNAL_CALLS_ENABLED=false
AI_REVIEW_LOCAL_TEST_ENABLED=false
```

Missing flags also resolve to disabled. Invalid boolean values or an invalid
configured provider fail closed. The only network-capable path additionally
requires all of the following at the same time:

- `APP_ENV=local`
- `AI_REVIEW_PROVIDER=live-model-provider`
- all three flags above set to `true`
- `AI_REVIEW_API_KEY` present only in untracked local configuration and
  beginning with `fake-` or `test-`
- an optional `AI_REVIEW_MODEL_ENDPOINT` that resolves to loopback
  (`localhost`, `127.0.0.1`, or `::1`); the default is a loopback fake-provider
  endpoint

`AI_REVIEW_MODEL_NAME` is optional and server-selected. None of these variables
is required for normal tests, builds, the evaluation script, deterministic
review generation, or mock-provider generation. No API key or usable secret is
tracked, printed, returned, or copied into a client bundle. The test suite uses
an injected in-memory transport for adapter coverage and never calls the
loopback endpoint or an external AI service.

The route fails closed before returning any unsafe candidate when live use is
disabled, external calls are disabled, the test-only key is absent, provider
configuration is invalid, the request contains unknown fields or freeform
instructions, structured redaction blocks the packet/prompt, provider JSON is
invalid, a citation is not in the exact packet snapshot, approval/legal claims
trigger safety evaluation, or the evaluator score is below threshold. Provider
prompts, raw requests, raw responses, keys, auth data, database rows, and
operational identifiers are never included in successful review metadata.

Future preview enablement requires a separate reviewed milestone: select an
approved provider and data-processing terms; replace the local fake-key and
loopback-only restrictions with a reviewed secret/binding design; add timeout,
rate, concurrency, cost, retention, and redacted observability controls; run a
fixed-cost preview smoke test with fictional data; confirm citation/evaluator
failure handling; verify the kill switch; and explicitly change preview flags.
Until every item is approved, preview and production remain disabled.

### Local AI Review UI behavior

Authenticated users who can view a case see an `AI review` case-detail tab.
The tab does not generate anything on load. Selecting `Generate review draft`
sends one same-origin JSON `POST` with body `{}` to the protected draft
endpoint and validates the returned data again in the browser with the shared
strict response schema.
`401` responses use the existing session-expired flow; forbidden, missing,
validation, server, and network failures render concise retry-safe messages
without logging or displaying response bodies or operational details.

The panel labels the result as a deterministic baseline review, `live_ai=false`,
`external_calls=false`, draft only, and verify before sending. It renders the
summary, missing information, recommended next actions, packet-record citation
references, unsupported claims, confidence notes, overall evaluator score,
citation validity, pass/fail state, and safety warnings as React text only.
It does not render raw HTML or Markdown and does not describe the result as
agency confirmation, legal advice, or an approval prediction.

The persistent safety notice states that the deterministic draft uses only
packet data already in the workspace, may miss issues, and requires evidence,
date, status, and jurisdiction verification before sending. Reviews exist only
in component memory and are discarded when the panel unmounts or the page is
reloaded; the UI does not save them to D1, R2, local storage, or packet history.

`Copy review text` writes a plain-text review and evaluation summary to the
browser clipboard. The copy starts with `Draft review — verify before sending`,
includes `live_ai=false` and `external_calls=false`, and uses citation record
references rather than HTML. Clipboard success and failure both produce safe
visible feedback without exposing browser error details.

The live-model adapter shape now exists behind the explicit local-test-only
gate. Provider terms, production-capable secret handling, timeouts, rate/cost
controls, retention, observability redaction, preview validation, and any
production enablement all remain future reviewed work. No API key is tracked
and no live model call occurs in normal operation, tests, builds, or evaluation.

## Requirements and bindings

- Node.js 22 or newer
- D1 binding `DB`
- `APP_ENV`: `local`, `preview`, or `production`
- `ENABLE_DEV_CASE_API`: `true` only for loopback local development
- `AUTH_ENABLED`: `true` only when authentication should be reachable
- `AUTH_ALLOW_SIGNUP`: `true` only for local signup
- `BETTER_AUTH_URL`: one explicit same-origin application origin
- `BETTER_AUTH_SECRET`: a high-entropy secret of at least 32 characters
- `ADMIN_BOOTSTRAP_ENABLED`: `false` by default; temporary preview-only first
  admin bootstrap switch
- `ADMIN_BOOTSTRAP_TOKEN`: preview-only one-time bootstrap credential stored as
  a Wrangler secret; at least 32 high-entropy bytes
- `PREVIEW_DEMO_SEED_ENABLED`: `false` by default; temporary preview-only
  canonical Arroyo Vista seed switch
- `PREVIEW_DEMO_SEED_TOKEN`: temporary preview-only high-entropy authorization
  stored as a Wrangler secret and deleted immediately after the seed
- `AI_REVIEW_PROVIDER`: defaults to `deterministic-baseline`; live selection is
  local-test-only in this milestone
- `AI_REVIEW_LIVE_ENABLED`, `AI_REVIEW_EXTERNAL_CALLS_ENABLED`, and
  `AI_REVIEW_LOCAL_TEST_ENABLED`: safe booleans, all disabled by default
- `AI_REVIEW_API_KEY`: optional untracked local test-only value; never required
  for normal operation or tests

Production configuration keeps `AUTH_ENABLED=false`. Preview and production
configuration keep `AUTH_ALLOW_SIGNUP=false`. Admin bootstrap is disabled by
default and is never available in production. Authentication and bootstrap fail
closed if enabled without valid secrets. `.dev.vars` is ignored by Git.

## Install and configure local authentication

From the repository root:

```bash
cd app
npm ci
cp .dev.vars.example .dev.vars
```

Generate a local secret with a cryptographically secure tool:

```bash
openssl rand -base64 32
```

Replace the `BETTER_AUTH_SECRET` placeholder in `.dev.vars` with that output.
Do not commit `.dev.vars`, paste its secret into commands, or reuse the local
secret in preview or production. The example already enables local auth and
local signup:

```dotenv
APP_ENV=local
AUTH_ENABLED=true
AUTH_ALLOW_SIGNUP=true
BETTER_AUTH_URL=http://localhost:5173
ENABLE_DEV_CASE_API=true
```

The example file contains a placeholder for `BETTER_AUTH_SECRET`; it is not a
usable secret.

## Apply local migrations and run

Migrations `0001_create_cases.sql`, `0002_auth_foundation.sql`,
`0003_auth_roles_admin.sql`, `0004_case_participants.sql`, and
`0005_case_lifecycle_audit.sql` are immutable. Migration
`0005_case_lifecycle_audit.sql` adds optimistic case versioning, a private
mutation nonce, and immutable lifecycle audit events without fabricating history
for existing local cases. Migration `0006_evidence_timeline.sql` adds
case-scoped evidence records, permit timeline entries, and explicit evidence
links for timeline entries:

```bash
npm run db:migrate:local
npm run dev
```

Wrangler keeps the persistent local database under `app/.wrangler/`. Restarting
the server without deleting that directory verifies session persistence.

Do not run `db:migrate:preview`, deploy, or create Cloudflare resources as part
of local setup. Those commands belong only to the approved release procedure.

## Workspace UI behavior

The signed-in React application is a small state-based workspace. It does not
use React Router yet and does not provide browser deep links for individual
cases. The shell includes:

- PermitPulse Case Workspace identity and a concise operations description.
- Signed-in user name or email.
- Sign-out control backed by Better Auth.
- Primary `New case` action.
- Case navigation separated from the active content panel.
- Responsive mobile-first layout suitable for narrow Android viewports.

### Demo-ready permit command center UI

The local workspace presentation is designed for product walkthroughs and
operational review without changing any API or persistence behavior. Case
detail now uses a compact case masthead, an operational capability/status
strip, stronger selected-tab treatment, quieter navy surfaces, consistent
section borders, and explicit empty states. The capability strip identifies
the available case workspace, evidence, permit timeline, packet preview,
on-demand PDF export, and AI review draft functions. It also keeps
`live_ai=false` and `external_calls=false` visible as runtime safety state, not
as marketing claims.

Evidence empty states explain the source-record and provenance purpose of the
register. Permit timeline empty states distinguish external permit events from
immutable internal case activity. Packet Preview uses deliverable-style section
numbering, distinct evidence/timeline/activity treatments, packet snapshot
counts, and a prominent internal-review warning. Stored strings continue to
render as React text nodes, and unsafe source URL schemes remain non-clickable.

The tabs remain state-based and keyboard accessible. Arrow Left/Right, Home,
and End move focus and selection across the case-detail tabs. The layout keeps
touch-sized controls, wrapping actions, contained long identifiers, and
horizontally scrollable tabs for narrow Android screens. Reduced-motion and
print styles remain supported.

### AI Review UI and provider status

The AI Review tab opens in a pre-generation state and does not make a request
until the user selects `Generate review draft`. Before generation, the panel
explains that the local deterministic baseline will check missing information,
evidence grounding, conservative next actions, unsupported-claim warnings, and
citation validity against the current packet snapshot.

The Provider status card shows the active provider, `live_ai`,
`external_calls`, evaluation pass state, warnings count, and the reviewed packet
sources (`case / evidence / timeline / activity`). The UI notes that the
provider boundary is prepared for a future separately reviewed live-model
provider, but it does not imply that a live model is running. Generated output
is organized into Summary, Missing information, Recommended next actions,
Evidence citations, Unsupported claims / safety warnings, Confidence notes,
and Evaluation report sections. `Compare with Packet preview` switches directly
to the existing Packet preview tab without adding routes or React Router.

Current AI Review limitations remain explicit:

- Live AI remains disabled (`live_ai=false`).
- External provider calls remain disabled (`external_calls=false`).
- AI reviews are held only in component memory and are not stored.
- Generated drafts require human verification and are not legal advice,
  approval predictions, or agency confirmation.

The authentication lifecycle remains explicit:

- checking authentication configuration
- checking session
- authentication disabled
- signed out
- signed in
- session expired
- sign-out in progress

When any workspace case API call returns `401`, the UI clears the signed-in
workspace state, returns to the sign-in form, and shows `Your session expired.
Sign in again.` It does not retry the unauthorized request.

The browser confirms the Better Auth session first, then fetches
`GET /api/workspace` for the protected workspace identity. The safe user DTO
contains only `id`, `email`, optional `name`, and `role` (`client` or `admin`).
The client uses that server-sourced role for UI controls and does not trust
local storage, URL parameters, form fields, hardcoded roles, or hidden Better
Auth user fields.

## Create, list, detail, and edit flow

The case workspace uses only the existing protected `/api/v1/cases` routes:

1. `GET /api/v1/cases` loads the visible case list using the server's default
   bounded pagination.
2. `POST /api/v1/cases` creates a case with only the permitted fields:
   `project_name`, `client_name`, `address`, `city`, `jurisdiction`,
   `permit_number`, and `current_status`.
3. `GET /api/v1/cases/:caseId` opens a case detail panel.
4. `PATCH /api/v1/cases/:caseId` edits case metadata with
   `expected_version`.
5. `POST /api/v1/cases/:caseId/status` changes status for administrators only.
6. `GET /api/v1/cases/:caseId/activity?limit=10&offset=0` loads immutable
   activity for the detail screen.

The create form trims values client-side for usability, keeps the server as the
source of truth, disables duplicate submission, preserves entered data after
recoverable server validation failures, refreshes the list after success, and
opens the newly created case detail. Optional permit numbers are sent as `null`
when blank. The UI never sends `user_id`, `owner_user_id`,
`participant_role`, `role`, `created_by`, or arbitrary fields.

Case list rows show project name, client name, city, jurisdiction, optional
permit number, current status, last updated time, and an `Open details` action.
The empty state offers a local fictional-case creation path. Pagination controls
appear only when the current server response makes them useful.

The detail view is split into Overview, Edit details, administrator-only Status
management, and Activity sections. The detail DTO includes safe case fields
only: project name, status, client name, address, city, jurisdiction, optional
permit number, version, created time, and updated time.

The edit form prepopulates from the latest `CaseDto`, trims entered values,
requires meaningful required fields, sends only changed editable metadata
fields, and submits blank permit numbers as `null`. It never sends
`current_status`, ownership, participant, role, actor, timestamp, or internal
fields through metadata PATCH. A successful edit updates the detail view,
replaces the matching in-memory list item without reloading an unbounded list,
shows a concise success message, reloads activity, and uses the returned
incremented version for future mutations. Server validation errors leave the
entered form values in place.

Administrators see only valid next status transitions:

| From | Allowed to |
| --- | --- |
| `intake` | `researching`, `needs_information` |
| `researching` | `needs_information`, `ready_for_review` |
| `needs_information` | `researching`, `ready_for_review` |
| `ready_for_review` | `researching` |

Clients do not see disabled or fake administrator controls. This is only a UX
boundary; the backend remains authoritative and continues to reject client
status transitions.

Activity is loaded when a detail opens and after successful edits or status
changes. It is newest-first, bounded by `limit` and `offset`, and displays only
public action labels, safe actor names when available, event times, changed
public fields, and status from/to values. The UI includes loading, empty, retry,
and pagination states and does not fabricate missing audit history.

Metadata edits and status changes use optimistic concurrency. If the server
returns `409 STALE_VERSION`, the UI shows:

```text
Someone or another request updated this case. Reload the latest version before trying again.
```

The conflict state offers `Reload latest case` and `Cancel`. It does not
automatically overwrite or resubmit user input, and it creates no client-side
audit event. Reload fetches the latest detail DTO and activity; the next
mutation uses the refreshed `version`.

## Evidence, permit timeline, packet-preview, and AI-review workflows

The case detail workspace uses lightweight tabs for Overview, Evidence, Permit
timeline, Activity, Packet preview, and AI review. Switching tabs keeps the
loaded case in memory and does not reload an unbounded case list.

Evidence tab behavior:

1. `GET /api/v1/cases/:caseId/evidence?limit=10&offset=0` loads a bounded,
   deterministic evidence page when case detail opens.
2. `POST /api/v1/cases/:caseId/evidence` adds structured evidence with only
   `evidence_type`, `title`, `summary`, optional `source_url`, optional
   `source_label`, and optional `source_date`.
3. `PATCH /api/v1/cases/:caseId/evidence/:evidenceId` edits only changed
   permitted fields with `expected_version`.
4. Admins may also update `verification_status` to `unverified`, `verified`, or
   `disputed`. Clients do not see verification controls.

Evidence source links render only when the URL is an absolute `http` or
`https` URL. Malformed URLs and `javascript:`, `data:`, or `file:` values are
shown as text only. New evidence is displayed as `Unverified`; the UI does not
claim a source is confirmed unless an administrator marks the evidence verified.

Permit timeline tab behavior:

1. `GET /api/v1/cases/:caseId/timeline?limit=10&offset=0` loads a bounded,
   deterministic timeline page newest occurred date first.
2. `POST /api/v1/cases/:caseId/timeline` adds one timeline entry with
   `occurred_on`, `timeline_type`, `title`, `details`, optional admin-only
   `is_canonical`, and optional bounded unique `evidence_ids`.
3. `PATCH /api/v1/cases/:caseId/timeline/:timelineId` edits only timeline
   fields with `expected_version`; evidence links are never changed through
   PATCH.
4. Admins may create or edit canonical entries. Clients can create only
   non-canonical entries and can edit only their own non-canonical entries when
   safe DTO ownership proves that relationship.

Timeline entries display canonical versus contributed state, contributor,
occurred date, updated date, details, and supporting evidence. Timeline records
and immutable case Activity are separate concepts; the UI does not fabricate
timeline events from lifecycle audit activity.

Packet preview behavior:

1. The Packet preview tab builds a shared deterministic `PacketModel` from the
   currently loaded safe DTOs: case overview, current status, jurisdiction,
   permit number, case version, evidence page, permit timeline page, and recent
   activity page.
2. The preview renders Packet header, Project summary, Current permit status,
   Key evidence, Permit timeline, Recent case activity, Open questions /
   missing information, Recommended next actions, and Disclaimer / internal
   review sections.
3. Evidence is shown only from existing evidence records. Verification labels
   distinguish `Unverified`, `Verified`, and `Disputed`; unverified and
   disputed records are not described as confirmed. Source label, safe
   `http`/`https` URL, and source date are shown when present.
4. Permit timeline records remain separate from immutable case activity.
   Timeline entries show canonical versus contributed state and linked
   evidence references without fabricating permit events.
5. Placeholder Open questions and Recommended next actions sections clearly
   state that they are not AI-generated yet.
6. Stored case, evidence, timeline, and activity strings are rendered as React
   text, never as HTML.

Server-side Packet Preview API behavior:

1. `GET /api/v1/cases/:caseId/packet` builds a deterministic server-side
   `PacketModel` from database-backed safe DTOs and returns:

   ```json
   {
     "ok": true,
     "data": {
       "packet": {}
     }
   }
   ```

2. `GET /api/v1/cases/:caseId/packet.txt` returns the same packet through
   `renderPacketText` with `content-type: text/plain; charset=utf-8`.
3. `GET /api/v1/cases/:caseId/packet.html` returns the same packet through
   `renderPacketHtml` with `content-type: text/html; charset=utf-8`.
4. `GET /api/v1/cases/:caseId/packet.pdf` returns the same packet as an
   on-demand PDF generated inside the Worker with `content-type:
   application/pdf`.
5. Text and HTML packet responses use `Content-Disposition: inline` with a
   deterministic filename so a browser can preview them directly during local
   development.
6. PDF packet responses use `Content-Disposition: attachment` with a sanitized
   deterministic filename based on safe case/project data and the case UUID.
   The PDF is downloaded by the browser and is never stored by the app.
7. The browser Packet preview tab includes a `Download PDF` action for the
   protected PDF route and still preserves the current copy and print-preview
   behavior.

Packet Renderer foundation:

- Shared packet code lives under `src/shared/packet/` so it can later be reused
  outside the React Packet preview.
- `buildPacketModel` copies only whitelisted fields from existing safe DTOs. It
  does not copy raw auth/session/account/token fields, hidden database
  internals, contributor IDs, or arbitrary extra properties.
- Evidence, timeline, and recent activity records are sorted deterministically
  before rendering. Missing evidence, timeline, and activity sections render
  explicit empty-state text instead of invented records.
- `renderPacketText` emits clean plain text with generated timestamp, section
  headings, verification labels, timeline canonical/contributed labels, source
  label/URL/date when present, placeholders, and the internal-review disclaimer.
- `renderPacketHtml` emits a deterministic print-friendly HTML document string.
  It escapes stored text, never renders stored text as raw
  HTML, uses no script tags, uses no external scripts, and only turns
  `http`/`https` source URLs into links.
- `renderPacketPdf` emits a simple local-only PDF directly from the
  `PacketModel` text output using a pure JavaScript PDF writer. It does not run
  browser automation, call external services, use Cloudflare Browser Rendering,
  load external assets, execute scripts, upload to R2, or store generated PDFs.
- Current limitation: there are no stored packet versions yet. The JSON, text,
  HTML, and PDF packet routes generate local preview output on demand only.
- Current limitation: Packet preview does not inject AI review output. Its Open
  questions and Recommended next actions remain reviewer-written placeholders;
  deterministic review output is displayed separately in the AI review tab.
- Current limitation: there is no approval workflow yet. Packet output is a
  draft preview and is not a reviewed or published packet.

Copy-to-clipboard behavior:

- `Copy packet text` generates a plain-text draft with a generated timestamp
  and the note `Draft packet preview — verify before sending`
- The copied text contains no HTML and omits auth/session/account/token fields.
- Clipboard success and failure both produce visible feedback. If browser
  clipboard access is unavailable or denied, the UI shows a safe fallback
  message instead of exposing operational detail.

Print-preview behavior:

- `Print preview` calls browser print only. It does not generate, upload, or
  store a PDF.
- Print CSS hides navigation and action controls, uses a light background, and
  preserves readable spacing and section headings for browser printing.

Current Packet Builder v1 limitations:

- PDF export is a simple local-only draft generated on demand; PDFs are not
  stored, versioned, emailed, uploaded to R2, or generated through browser
  rendering.
- No AI-generated packet content yet. The separate AI review panel displays
  deterministic baseline output only.
- No approval workflow yet.
- No client publication controls yet.

Link and unlink behavior:

- Link controls use
  `POST /api/v1/cases/:caseId/timeline/:timelineId/evidence`.
- Unlink controls require confirmation and use
  `DELETE /api/v1/cases/:caseId/timeline/:timelineId/evidence/:evidenceId`.
- Already-linked evidence is omitted from link choices.
- Removing a link deletes only the relationship; it does not delete the
  evidence item or timeline entry.
- Duplicate-link, authorization, and missing-record errors are displayed as
  safe server messages.

Evidence and timeline record edits use optimistic concurrency. If the server
returns `409 STALE_VERSION`, the UI shows:

```text
Someone or another request updated this record. Reload the latest version before trying again.
```

The conflict state offers `Reload latest` and `Cancel`. It does not overwrite,
resubmit, fabricate history, or discard the user's unsaved values until the user
chooses an action. Reload fetches the latest DTO for that evidence item or
timeline entry; the next mutation uses the refreshed `version`.

## Current UI limitations

- Administrator-created cases are unassigned and admin-only under the current
  backend design.
- Evidence Inbox files are private R2 objects with D1 metadata. Case deletion,
  account deletion, and automatic cross-store orphan reconciliation remain out
  of scope; administrator user deletion is disabled accordingly.
- There is no participant assignment, stored PDF artifact, live AI, stored AI
  review, email, billing, OAuth, or admin user-management UI.
- Browser back-button support and deep-link case routing are intentionally out
  of scope for this milestone.
- The workspace does not fabricate cases, analytics, authorization filters,
  evidence provenance, timeline entries, or permit outcomes.

## Preview admin bootstrap procedure

Use only the first-administrator sequence in the controlled-pilot preview
deployment runbook above. The tracked switch is disabled; the ignored resolved
config enables it only while `PERMITPULSE_PREVIEW_BOOTSTRAP_ENABLED=true` is
explicitly present in the release shell, and the preflight requires the
temporary token secret only for that build.

The endpoint is preview-only, requires a valid Better Auth configuration,
requires an empty `user` table, creates no session, and returns only `id`,
`email`, `name`, and `role`. It is not a general signup endpoint.

## Test the local authentication lifecycle

With the development server on `http://localhost:5173`, use an isolated
fictional account and a temporary cookie jar:

```bash
curl --fail-with-body \
  -c /tmp/permitpulse-auth.cookies \
  -H 'content-type: application/json' \
  -H 'origin: http://localhost:5173' \
  --data '{"name":"Avery Example","email":"avery@example.test","password":"Fictional-passphrase-42"}' \
  http://localhost:5173/api/auth/sign-up/email

curl --fail-with-body \
  -b /tmp/permitpulse-auth.cookies \
  http://localhost:5173/api/auth/get-session

curl --fail-with-body \
  -b /tmp/permitpulse-auth.cookies \
  http://localhost:5173/api/workspace

curl --fail-with-body \
  -b /tmp/permitpulse-auth.cookies \
  -c /tmp/permitpulse-auth.cookies \
  -H 'origin: http://localhost:5173' \
  -X POST \
  http://localhost:5173/api/auth/sign-out
```

After sign-out, `GET /api/workspace` returns the standard JSON `401` response.
To test sign-in separately, post the same email/password JSON to
`/api/auth/sign-in/email`. A browser refresh preserves a valid session because
the opaque session cookie maps to the D1 `session` record.

The local-only development case persistence proof remains available under
`/api/dev/cases` when its existing flags and loopback checks pass. It is not
connected to authenticated users.

## Authenticated case API

Application case routes live under `/api/v1/cases` and require an authenticated
Better Auth session:

| Method | Route | Behavior |
| --- | --- | --- |
| `POST` | `/api/v1/cases` | Create one validated case. |
| `GET` | `/api/v1/cases` | List cases visible to the current actor. |
| `GET` | `/api/v1/cases/:caseId` | Read one visible case by UUID. |
| `PATCH` | `/api/v1/cases/:caseId` | Edit validated case metadata with optimistic concurrency. |
| `POST` | `/api/v1/cases/:caseId/status` | Apply one admin-only status transition. |
| `GET` | `/api/v1/cases/:caseId/activity` | Read immutable case lifecycle activity. |
| `GET` | `/api/v1/cases/:caseId/packet` | Build a server-side JSON packet preview. |
| `GET` | `/api/v1/cases/:caseId/packet.txt` | Build a server-side plain-text packet preview. |
| `GET` | `/api/v1/cases/:caseId/packet.html` | Build a server-side safe HTML packet preview. |
| `GET` | `/api/v1/cases/:caseId/packet.pdf` | Build a local-only draft PDF packet preview. |
| `POST` | `/api/v1/cases/:caseId/ai-review/draft` | Build and evaluate a deterministic, local-only review draft without storing it. |

Creation accepts only these JSON fields:

```json
{
  "project_name": "Fictional Oak Street ADU",
  "client_name": "Fictional Client",
  "address": "42 Oak Street",
  "city": "Exampleville",
  "jurisdiction": "Exampleville Building",
  "permit_number": "EX-2026-001",
  "current_status": "intake"
}
```

Unknown or privilege-bearing fields such as `owner_user_id`, `user_id`,
`participant_role`, `role`, and `created_by` are rejected. Responses return an
explicit safe case DTO only: case fields, `version`, and timestamps, with no
session token, password data, auth account rows, participant internals, or
private mutation nonce.

### Metadata edit contract

`PATCH /api/v1/cases/:caseId` accepts JSON with `expected_version` and at least
one editable metadata field:

```json
{
  "expected_version": 1,
  "project_name": "Fictional Oak Street ADU Revision",
  "client_name": "Fictional Client",
  "address": "42 Oak Street",
  "city": "Exampleville",
  "jurisdiction": "Exampleville Building",
  "permit_number": "EX-2026-002"
}
```

Only those fields are accepted. The endpoint rejects `current_status`,
`version`, ownership/participant fields, role fields, timestamps, internal
mutation fields, and unknown keys. Supplied fields that equal the current value
are ignored for audit purposes; if no actual value changes, the request returns
`400 NO_CHANGES` and creates no audit event.

Successful edits increment `version` by exactly one, update `updated_at`, and
append one `case_updated` audit event whose `changed_fields` array contains only
the public fields that actually changed.

### Status transition contract

`POST /api/v1/cases/:caseId/status` accepts:

```json
{
  "expected_version": 2,
  "current_status": "researching"
}
```

The explicit state machine is:

| From | Allowed to |
| --- | --- |
| `intake` | `researching`, `needs_information` |
| `researching` | `needs_information`, `ready_for_review` |
| `needs_information` | `researching`, `ready_for_review` |
| `ready_for_review` | `researching` |

Only administrators may transition status in this milestone. Clients receive
`403` for their own cases and safe `404` for unrelated cases. Invalid
transitions return `400 INVALID_TRANSITION`. A same-status request returns
`400 SAME_STATUS` and creates no audit event.

Successful transitions increment `version` by exactly one, update `updated_at`,
and append one `case_status_changed` audit event with `from_status`,
`to_status`, and `changed_fields: ["current_status"]`.

### Optimistic concurrency

Every metadata edit and status transition must include `expected_version`.
The mutation succeeds only when it matches the current case `version`.
Stale versions return:

```json
{
  "ok": false,
  "error": {
    "code": "STALE_VERSION",
    "message": "The case version is stale."
  },
  "request_id": "..."
}
```

Stale mutations return HTTP `409`, change no case data, and create no audit
event. The repository uses a guarded D1 `UPDATE ... WHERE version = ?
RETURNING` and a private per-mutation nonce; the audit insert in the same D1
batch can only select the row updated by that mutation.

### Activity contract

`GET /api/v1/cases/:caseId/activity?limit=20&offset=0` returns immutable audit
entries ordered deterministically by newest first:

```json
{
  "ok": true,
  "data": {
    "activity": [
      {
        "id": "00000000-0000-4000-8000-000000000000",
        "action": "case_updated",
        "changed_fields": ["project_name"],
        "from_status": null,
        "to_status": null,
        "actor": {
          "id": "fictional-user-id",
          "name": "Avery Client"
        },
        "created_at": "2026-01-01T00:00:00.000Z"
      }
    ],
    "pagination": { "limit": 20, "offset": 0 },
    "order": "created_at_desc"
  }
}
```

The default limit is `20`, the maximum limit is `50`, and the maximum offset is
`10000`. Activity responses omit auth account rows, passwords, cookies,
sessions, tokens, participant rows, and private audit storage internals.

## Role and ownership behavior

Case access is controlled by server-side capabilities and the
`case_participants` table:

- Clients may create cases. A client-created case atomically creates an `owner`
  participant row and one `case_created` audit event for that authenticated
  client.
- Clients may list and read only cases where they have a participant row.
- Clients may edit metadata only for cases where they have an `owner`
  participant row.
- Clients may read activity only for participating cases.
- Clients may not transition status in this milestone.
- Unrelated clients receive `404` for another client's case, matching the
  response for a missing case.
- Existing unowned legacy cases remain in `cases` but are invisible to clients.
- Administrators may create, list, and read every case, but still use the same
  strict validation.
- Administrators may edit metadata, transition status, and read activity for
  every case.
- Administrator-created cases atomically create one unassigned case and one
  `case_created` audit event. They have no client participant by design and are
  visible to administrators only until a later controlled participant-assignment
  milestone.

Deletion and participant assignment are not implemented yet.

## Evidence and permit timeline API

The structured evidence and timeline backend is available under the same
authenticated `/api/v1/cases/:caseId` route tree. The current React workspace
uses these routes for structured evidence and permit timeline controls. There
are no uploads, stored PDFs, stored AI reviews, deletion controls, or file
storage.

Evidence records live in `evidence_items` and contain only structured metadata:
`evidence_type`, `title`, `summary`, optional `source_url`, optional
`source_label`, optional `source_date`, server-owned `verification_status`,
server-owned `version`, contributor, and timestamps. The reviewed evidence
types are `document`, `portal`, `email`, `phone_call`, `meeting`, `inspection`,
`code_reference`, `photo`, and `other`. Verification status is one of
`unverified`, `verified`, or `disputed`; creation always starts as
`unverified`.

Timeline records live in `timeline_entries` and contain `occurred_on`,
`timeline_type`, `title`, `details`, `is_canonical`, server-owned `version`,
contributor, timestamps, and linked evidence IDs. The reviewed timeline types
are `submission`, `resubmission`, `correction`, `reviewer_contact`,
`applicant_contact`, `inspection`, `approval`, `rejection`, `status_update`,
`deadline`, and `other`. `occurred_on` is a reviewed ISO date string. Canonical
entries are admin-controlled.

Evidence may be linked to timeline entries through `timeline_entry_evidence`.
The link table stores only the timeline entry ID, evidence item ID, and link
creation time. Duplicate links are rejected. Removing a link deletes only the
link row; it does not delete either evidence or timeline records. Evidence and
timeline records are soft-deletable at the schema layer but deletion endpoints
are intentionally not implemented in this pass. Soft-deleted records are
excluded from reads and cannot be newly linked.

| Method | Route | Behavior |
| --- | --- | --- |
| `POST` | `/api/v1/cases/:caseId/evidence` | Create evidence for a visible case. |
| `GET` | `/api/v1/cases/:caseId/evidence` | List visible case evidence. |
| `GET` | `/api/v1/cases/:caseId/evidence/:evidenceId` | Read one evidence item. |
| `PATCH` | `/api/v1/cases/:caseId/evidence/:evidenceId` | Update evidence with `expected_version`. |
| `POST` | `/api/v1/cases/:caseId/timeline` | Create a timeline entry and optional evidence links atomically. |
| `GET` | `/api/v1/cases/:caseId/timeline` | List visible case timeline entries. |
| `GET` | `/api/v1/cases/:caseId/timeline/:timelineId` | Read one timeline entry. |
| `PATCH` | `/api/v1/cases/:caseId/timeline/:timelineId` | Update a timeline entry with `expected_version`. |
| `POST` | `/api/v1/cases/:caseId/timeline/:timelineId/evidence` | Link one evidence item. |
| `DELETE` | `/api/v1/cases/:caseId/timeline/:timelineId/evidence/:evidenceId` | Remove one link only. |

Evidence creation accepts only:

```json
{
  "evidence_type": "document",
  "title": "Fictional plan check notice",
  "summary": "Fictional notice from the permit portal.",
  "source_url": "https://example.test/notices/plan-check",
  "source_label": "Example portal",
  "source_date": "2026-01-15"
}
```

Evidence updates require `expected_version` and may change `evidence_type`,
`title`, `summary`, `source_url`, `source_label`, and `source_date`. Omitted
fields are preserved. Explicit `null` clears nullable source fields when
allowed. Admins may also set `verification_status`. Successful updates
increment `version` once. Stale updates return `409 STALE_VERSION`, change no
data, and do not retry automatically. Empty or no-change updates are rejected
safely.

Timeline creation accepts only:

```json
{
  "occurred_on": "2026-01-20",
  "timeline_type": "submission",
  "title": "Fictional application submitted",
  "details": "The fictional application was submitted for review.",
  "is_canonical": false,
  "evidence_ids": ["00000000-0000-4000-8000-000000000000"]
}
```

Clients must omit `is_canonical` or set it to `false`. Admins may create
canonical or non-canonical entries. `evidence_ids` is optional, bounded, unique,
and must reference non-deleted evidence in the same case. Creation and link
insertion happen in one D1 batch after same-case checks; invalid or cross-case
evidence IDs create no timeline row.

Timeline updates require `expected_version` and may change `occurred_on`,
`timeline_type`, `title`, and `details`. Admins may also change `is_canonical`.
Evidence links are changed only through the dedicated link routes, not through
timeline `PATCH`.

Evidence list ordering is deterministic:

```text
source_date DESC with null source_date after dated records,
then created_at DESC,
then id DESC
```

Timeline list ordering is deterministic:

```text
occurred_on DESC,
then created_at DESC,
then id DESC
```

Both lists use bounded pagination with default limit `20`, maximum limit `50`,
and maximum offset `10000`.

| Capability | Participating client | Admin |
| --- | --- | --- |
| Create evidence | Own case | Any case |
| List/read evidence | Own case | Any case |
| Update evidence | Own case and personally created evidence only | Any case |
| Mark evidence verified/disputed | No | Yes |
| Create timeline entry | Own case, non-canonical only | Any case |
| List/read timeline | Own case | Any case |
| Update timeline | Own non-canonical entries personally created | Any case |
| Create/update canonical timeline | No | Yes |
| Link evidence to timeline | Own case, personally created evidence, personally created non-canonical timeline entry | Any same-case records |

Unrelated clients receive safe `404` responses that do not confirm another
case, evidence item, or timeline entry exists. Unauthenticated requests return
`401`. Request bodies cannot supply user IDs, roles, case IDs, timestamps,
versions, verification state on create, authorization fields, deleted state, or
unknown fields.

DTOs return only safe fields. Evidence responses include evidence metadata,
safe contributor `{ id, name }`, version, and timestamps. Timeline responses
include timeline metadata, canonical state, safe contributor `{ id, name }`,
linked evidence IDs, version, and timestamps. Responses never include password
data, account rows, session data, cookies, tokens, authorization headers,
request IDs, deleted records, raw database rows, or private mutation data.

## Packet Preview API

Server-side packet preview routes live under the authenticated case route tree:

| Method | Route | Behavior |
| --- | --- | --- |
| `GET` | `/api/v1/cases/:caseId/packet` | Return `{ ok: true, data: { packet } }` where `packet` is a `PacketModel`. |
| `GET` | `/api/v1/cases/:caseId/packet.txt` | Return clean plain text from `renderPacketText`. |
| `GET` | `/api/v1/cases/:caseId/packet.html` | Return safe deterministic HTML from `renderPacketHtml`. |
| `GET` | `/api/v1/cases/:caseId/packet.pdf` | Return a simple on-demand PDF from `renderPacketPdf`. |

Authorization matches the existing case read behavior. Admins may preview
packets for any case. Participating clients may preview packets for their own
cases. Unrelated clients receive the same safe `404 CASE_NOT_FOUND` response as
a missing case, so the API does not confirm another client's case exists.
Unauthenticated requests return `401 UNAUTHENTICATED`. Invalid case IDs return
`400 INVALID_CASE_ID`.

Packet assembly is local-only and database-backed. The Worker first loads the
authorized case detail DTO, then bounded source lists:

- up to 50 non-deleted evidence records
- up to 50 non-deleted timeline records
- up to 25 recent activity records

Evidence is ordered by source date descending with undated records last, then
created time descending, then ID descending. Timeline is ordered by occurred
date descending, then created time descending, then ID descending. Activity is
ordered by created time descending, then ID descending. The shared packet model
builder also sorts defensively before rendering, so equal database timestamps
still produce stable output.

Packet JSON, text, HTML, and PDF are built only from whitelisted safe DTO
fields: case detail, evidence metadata, timeline metadata and evidence links,
and public activity labels. They do not include auth/session/account rows,
cookies, tokens, passwords, request IDs, participant rows, deleted records,
private mutation fields, raw database rows, stored HTML, AI output, or invented
claims. The HTML renderer escapes stored text, emits no scripts, uses no
external scripts, and only converts absolute `http`/`https` source URLs into
links. The PDF renderer writes plain text from the shared packet text renderer
into a PDF document; it does not interpret HTML, execute scripts, or load
external assets.

PDF responses use:

```text
Content-Type: application/pdf
Content-Disposition: attachment; filename="permitpulse-packet-<safe-project>-<case-id>.pdf"
```

The filename is deterministic, lower-case, and restricted to letters, numbers,
hyphens, and `.pdf`. PDF output is generated per request and is not saved to
D1, R2, local disk, email, or any packet history table.

Current Packet Preview API limitations:

- No stored packet versions yet.
- AI review defaults to deterministic baseline output; the live-model adapter
  remains local-test-only and disabled, with no production AI UI.
- No approval workflow yet.

## Pagination contract

`GET /api/v1/cases` supports bounded offset pagination:

```text
GET /api/v1/cases?limit=20&offset=0
```

The default limit is `20`, the maximum limit is `50`, and the maximum offset is
`10000`. Results are ordered deterministically by `updated_at DESC, id DESC`.
The response includes:

```json
{
  "ok": true,
  "data": {
    "cases": [],
    "pagination": { "limit": 20, "offset": 0 }
  }
}
```

## Test authenticated case routes locally

Use only fictional `.test` users and a temporary cookie jar. Local signup is
enabled by `.dev.vars.example`; preview and production signup remain blocked.

```bash
curl --fail-with-body \
  -c /tmp/permitpulse-client-a.cookies \
  -H 'content-type: application/json' \
  -H 'origin: http://localhost:5173' \
  --data '{"name":"Avery Client","email":"avery.client@example.test","password":"Fictional-passphrase-42"}' \
  http://localhost:5173/api/auth/sign-up/email

curl --fail-with-body \
  -b /tmp/permitpulse-client-a.cookies \
  -H 'content-type: application/json' \
  -H 'origin: http://localhost:5173' \
  --data '{"project_name":"Fictional Oak Street ADU","client_name":"Fictional Client","address":"42 Oak Street","city":"Exampleville","jurisdiction":"Exampleville Building","permit_number":"EX-2026-001","current_status":"intake"}' \
  http://localhost:5173/api/v1/cases

curl --fail-with-body \
  -b /tmp/permitpulse-client-a.cookies \
  'http://localhost:5173/api/v1/cases?limit=20&offset=0'
```

Local evidence and timeline API calls use the same cookie jar and fictional case
IDs:

```bash
curl --fail-with-body \
  -b /tmp/permitpulse-client-a.cookies \
  -H 'content-type: application/json' \
  -H 'origin: http://localhost:5173' \
  --data '{"evidence_type":"document","title":"Fictional plan check notice","summary":"Fictional notice from the permit portal.","source_url":"https://example.test/notices/plan-check","source_label":"Example portal","source_date":"2026-01-15"}' \
  http://localhost:5173/api/v1/cases/00000000-0000-4000-8000-000000000000/evidence

curl --fail-with-body \
  -b /tmp/permitpulse-client-a.cookies \
  -H 'content-type: application/json' \
  -H 'origin: http://localhost:5173' \
  --data '{"occurred_on":"2026-01-20","timeline_type":"submission","title":"Fictional application submitted","details":"The fictional application was submitted for review.","is_canonical":false,"evidence_ids":[]}' \
  http://localhost:5173/api/v1/cases/00000000-0000-4000-8000-000000000000/timeline
```

After creating or opening a fictional case, test the local-only packet PDF
route with the same authenticated cookie. Replace the UUID with a visible local
case ID:

```bash
curl --fail-with-body \
  -b /tmp/permitpulse-client-a.cookies \
  -o /tmp/permitpulse-packet.pdf \
  http://localhost:5173/api/v1/cases/00000000-0000-4000-8000-000000000000/packet.pdf

head -c 5 /tmp/permitpulse-packet.pdf
```

The header check should print `%PDF-`. This call must not create a stored
packet row, upload to R2, send email, call AI, or use browser rendering.

Administrators are created only through the documented preview bootstrap
procedure or direct local test fixtures. There is no public signup or request
body field that can promote a user to admin.

## Manual local workspace test

Use fictional local data only. Do not apply preview migrations, deploy, or
modify Cloudflare resources for this check.

```bash
npm run dev
```

Then open the local URL shown by Vite, usually `http://localhost:5173`:

1. Sign in with an existing fictional local account, or create a local account
   only when `AUTH_ALLOW_SIGNUP=true` in `.dev.vars`.
2. Confirm the case list loads or shows the empty state.
3. Create a fictional case such as `Fictional Oak Street ADU`.
4. Confirm the success message appears, the list refreshes, and the case detail
   opens.
5. Open Edit details, change one metadata field, save, and confirm the detail,
   list row, version, and Activity section update.
6. Clear the optional permit number and confirm it displays as `Not provided`.
7. With a local admin fixture, confirm Status management shows only valid next
   statuses and requires confirmation before changing status.
8. Open Evidence, add a fictional evidence item, and confirm it appears as
   `Unverified`.
9. Edit the evidence item, clear optional source values, and confirm the
   returned version replaces the old version. With a local admin fixture,
   confirm verification choices appear and that marking `Disputed` requires
   confirmation.
10. Open Permit timeline, add a fictional timeline entry, select supporting
   evidence, and confirm the linked evidence appears on the entry.
11. With a local admin fixture, confirm the canonical checkbox is available.
   With a client account, confirm canonical controls are absent and canonical
   entries cannot be edited.
12. Select a timeline entry, link another eligible evidence item, then unlink it
   and confirm only the relationship is removed.
13. Open Packet preview, confirm `Copy packet text` still copies the draft
   packet, `Print preview` still opens browser print, and `Download PDF`
   downloads or opens the protected `/packet.pdf` route for the current case.
14. Open AI review and confirm no review is generated until `Generate review
    draft` is selected. Confirm the deterministic/live-AI/external-call labels,
    review sections, evaluation score, safety warning, and packet record
    citations appear. Confirm `Copy review text` reports success or a safe
    clipboard fallback and that refreshing the page does not restore the draft.
15. To verify stale-version behavior locally, open the same case in two browser
   tabs, edit or transition it in the first tab, then submit from the second tab
   and confirm the case conflict message and `Reload latest case` behavior. Do
   the same for one evidence or timeline record and confirm the record conflict
   message and `Reload latest` behavior.
16. Refresh the browser and confirm the valid session still opens the workspace.
17. Sign out and confirm the protected workspace no longer appears.

Preview deployment, preview D1 migration, preview auth enablement, and preview
administrator bootstrap remain separate reviewed steps.

## Checks

```bash
npm run auth:schema:verify
npm run test:auth
npm run typecheck
npm test
npm run build
npm run preflight:preview
npm run ai:eval:local
git diff --check
```

Tests use Cloudflare's Workers Vitest integration and an isolated D1 database.
They use fictional `.test` accounts and make no email or external API calls.

## Preview remains deployment-gated

The preview environment declares `AUTH_ENABLED=true` and keeps signup disabled.
It must not receive pilot traffic until the configured preview origin is
reviewed, every migration is applied to the intended preview D1 database, the
private R2 binding is verified, and a unique preview secret is added
interactively:

```bash
npm run preflight:preview:secret-file
npm run deploy:preview:first
```

The permission-checked temporary secret-file procedure intentionally prints no
secret value. Authentication fails closed when the secret or origin is invalid.
First-administrator bootstrap must use the temporary, one-shot procedure above
and be disabled immediately after the account is created.

After the manual D1 resource has been created, preview builds can be validated
without deploying by setting the two non-secret release inputs first:

```bash
export PERMITPULSE_PREVIEW_D1_DATABASE_ID='<D1 UUID>'
export PERMITPULSE_PREVIEW_ORIGIN='https://<reviewed-preview-origin>'
npm run build:preview
```

## Migration and rollback policy

D1 migrations are forward-only. Reapplying through Wrangler should report no
pending migrations. Never edit `0001_create_cases.sql` or an applied migration.
After remote data exists, correct schema problems with a new reviewed forward
migration rather than deleting tables or reverting SQL.

For a disposable local reset only, remove the local Wrangler state and reapply
the migrations. This deletes local development data and must never be used as a
remote rollback procedure.
