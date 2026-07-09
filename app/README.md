# PermitPulse Case Workspace

This directory is an isolated Cloudflare Worker, React/Vite client, Hono API,
and D1 database. It does not share deployment configuration with the public
PermitPulse site in `../dist`, Pages Functions in `../functions`, or the
existing Worker in `../workers/pp-api`.

The current local frontend milestone provides email/password authentication,
database-backed sessions, sign-out, and a usable authenticated React workspace
for listing, creating, reading, editing, and reviewing case lifecycle activity
through the protected case API. Administrators also get role-aware status
transition controls. The browser workspace now also exposes local-only
structured evidence, provenance, verification state, canonical timeline
records, timeline-to-evidence links, a first local-only Packet Builder preview,
server-side Packet Preview endpoints, and a shared local-only Packet Renderer
foundation through protected APIs. The protected Packet Preview API can also
generate an on-demand local-only draft PDF from the existing server-side
`PacketModel`. The app now includes a protected, local-only PermitPulse AI
Review provider scaffold backed by deterministic baseline and mock-live
providers, a safe prompt contract, a structured-field safety scanner, and a
shared provider result gate, plus a case-detail AI review panel that
calls that endpoint only after a user selects `Generate review draft`. It does
not call a live AI model and does not expose production AI UI.
There is still no participant assignment, file upload, stored PDF history, live
AI integration, billing, email delivery, OAuth, user-management UI, or
production authentication.

## AI Review provider scaffold and evaluation foundation

The PermitPulse Packet Review Assistant is not a live-AI feature yet. The
current foundation lives under `src/shared/ai-review/` so deterministic output,
local model-shaped test output, and future reviewed model output can pass the
same prompt-input and result gates. The protected route is:

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

No other provider name or request field is accepted. In particular, callers
cannot submit freeform prompts, instructions, model names, API credentials, or
provider configuration. `mock-live-provider` is a deterministic local test
double for exercising a model-shaped provider boundary; despite its name it
makes no network call and always reports `live_ai=false` and
`external_calls=false`.

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
- A provider abstraction with only two registered implementations:
  `deterministic-baseline` and `mock-live-provider`. Both are local-only,
  deterministic, require no secrets or SDK, and make no external calls.
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
evaluation, or packet to D1, R2, local disk, or any other storage. It requires
no API key, provider secret, network call, provider SDK, or environment
variable. No live provider is registered, no live-AI feature flag exists, and
there is no production AI UI.

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

The future path to live model integration is to add one separately reviewed
server-side adapter behind an explicit disabled-by-default feature gate. It
would receive only the existing scanned prompt contract, use server-selected
configuration, and return an untrusted candidate through the same strict
schema, citation, evaluator, and safety gates. Provider terms, secrets,
timeouts, rate/cost controls, retention, observability redaction, preview
validation, and production enablement all remain future reviewed work. No API
keys or live model calls are part of this scaffold.

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

Do not run `db:migrate:preview`, deploy, or create Cloudflare resources for this
milestone.

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
- There is no deletion, participant assignment, file upload/R2, stored PDF
  history, live AI, stored AI reviews, email, billing, OAuth, or admin user
  management UI.
- Evidence records are structured metadata only; uploaded files are out of
  scope.
- Browser back-button support and deep-link case routing are intentionally out
  of scope for this milestone.
- The workspace does not fabricate cases, analytics, authorization filters,
  evidence provenance, timeline entries, or permit outcomes.

## Later preview admin bootstrap procedure

Do not perform these remote steps during local implementation or testing. When
preview auth is intentionally enabled in a later reviewed pass:

1. Generate a bootstrap token with a cryptographically secure tool, for example
   `openssl rand -base64 32`.
2. Store it only through Wrangler secret input:
   `npx wrangler secret put ADMIN_BOOTSTRAP_TOKEN --env preview`.
3. Set `ADMIN_BOOTSTRAP_ENABLED=true` temporarily for the preview environment.
4. Apply reviewed migration `0003_auth_roles_admin.sql` to preview D1 through
   the approved migration process.
5. Deploy the preview Worker.
6. Call `POST /api/internal/bootstrap-admin` exactly once with an
   `Authorization: Bearer <token>` header and JSON body containing only
   `email`, `name`, and `password`.
7. Verify the created user can sign in as an admin.
8. Immediately set `ADMIN_BOOTSTRAP_ENABLED=false`.
9. Redeploy preview.
10. Delete the bootstrap secret with Wrangler.
11. Verify `POST /api/internal/bootstrap-admin` is unavailable afterward.

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
- AI review is deterministic baseline output only; there is no live model or
  production AI UI.
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
npm run build:preview
npm run ai:eval:local
git diff --check
```

Tests use Cloudflare's Workers Vitest integration and an isolated D1 database.
They use fictional `.test` accounts and make no email or external API calls.

## Preview remains disabled

Preview auth and signup remain disabled until a later reviewed milestone.
Before enabling preview auth, review the configured preview origin, apply the
auth migration through the separate migration review process, and add a unique
preview secret interactively:

```bash
npx wrangler secret put BETTER_AUTH_SECRET --env preview
```

That command shape intentionally contains no secret value. Do not enable
preview auth or apply `0002` remotely as part of this milestone.

Preview builds can still be validated locally without deploying:

```bash
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
