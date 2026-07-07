# PermitPulse Case Workspace

This directory is an isolated Cloudflare Worker, React/Vite client, Hono API,
and D1 database. It does not share deployment configuration with the public
PermitPulse site in `../dist`, Pages Functions in `../functions`, or the
existing Worker in `../workers/pp-api`.

The current backend milestone provides local email/password authentication,
database-backed sessions, sign-out, a protected workspace proof, and
authenticated case creation/list/detail APIs. It does not provide a React case
dashboard, case editing, participant assignment, file uploads, evidence
records, timelines, PDF generation, AI, billing, email delivery, OAuth, or
production authentication.

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

Migrations `0001_create_cases.sql`, `0002_auth_foundation.sql`, and
`0003_auth_roles_admin.sql` are immutable. Migration
`0004_case_participants.sql` adds case ownership without assigning existing
fictional legacy cases to real users:

```bash
npm run db:migrate:local
npm run dev
```

Wrangler keeps the persistent local database under `app/.wrangler/`. Restarting
the server without deleting that directory verifies session persistence.

Do not run `db:migrate:preview`, deploy, or create Cloudflare resources for this
milestone.

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
explicit safe case DTO only: case fields and timestamps, with no session token,
password data, auth account rows, or participant internals.

## Role and ownership behavior

Case access is controlled by server-side capabilities and the
`case_participants` table:

- Clients may create cases. A client-created case atomically creates an `owner`
  participant row for that authenticated client.
- Clients may list and read only cases where they have a participant row.
- Unrelated clients receive `404` for another client's case, matching the
  response for a missing case.
- Existing unowned legacy cases remain in `cases` but are invisible to clients.
- Administrators may create, list, and read every case, but still use the same
  strict validation.
- Administrator-created cases have no client participant by design. They are
  visible to administrators only until a later controlled participant-assignment
  milestone.

Editing, deletion, status transitions, and participant assignment are not
implemented yet.

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
