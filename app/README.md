# PermitPulse Case Workspace

This directory is an isolated Cloudflare Worker, React/Vite client, Hono API,
and D1 database. It does not share deployment configuration with the public
PermitPulse site in `../dist`, Pages Functions in `../functions`, or the
existing Worker in `../workers/pp-api`.

The current local frontend milestone provides email/password authentication,
database-backed sessions, sign-out, and a usable authenticated React workspace
for listing, creating, reading, editing, and reviewing case lifecycle activity
through the protected case API. Administrators also get role-aware status
transition controls. There is still no participant assignment, file upload,
evidence record, timeline notes, PDF generation, AI, billing, email delivery,
OAuth, user-management UI, or production authentication.

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
`0003_auth_roles_admin.sql`, and `0004_case_participants.sql` are immutable.
Migration `0005_case_lifecycle_audit.sql` adds optimistic case versioning, a
private mutation nonce, and immutable lifecycle audit events without fabricating
history for existing local cases:

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

## Current UI limitations

- Administrator-created cases are unassigned and admin-only under the current
  backend design.
- There is no deletion, participant assignment, evidence, timeline, upload,
  PDF, AI, email, billing, OAuth, or admin user management UI.
- Browser back-button support and deep-link case routing are intentionally out
  of scope for this milestone.
- The workspace does not fabricate cases, analytics, authorization filters, or
  permit outcomes.

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
8. To verify stale-version behavior locally, open the same case in two browser
   tabs, edit or transition it in the first tab, then submit from the second tab
   and confirm the conflict message and `Reload latest case` behavior.
9. Refresh the browser and confirm the valid session still opens the workspace.
10. Sign out and confirm the protected workspace no longer appears.

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
