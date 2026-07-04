# PermitPulse Case Workspace foundation

This directory is an isolated Cloudflare Worker, React/Vite shell, and D1
foundation. It does not change or share deployment configuration with the
public PermitPulse site in `../dist`, the Pages Functions in `../functions`, or
the existing Worker in `../workers/pp-api`.

Only `GET /api/health` is intended to be reachable in deployed environments.
The case proof endpoints require both local-only configuration flags and a
loopback hostname, so they fail closed on preview and production hosts. There
is no authenticated case-management interface in this milestone.

## Requirements and bindings

- Node.js 22 or newer
- A Cloudflare account only for remote preview work
- D1 binding `DB`
- Plain-text variable `APP_ENV`: `local`, `preview`, or `production`
- Plain-text variable `ENABLE_DEV_CASE_API`: `true` only for local development

No secrets are required by this milestone. `.dev.vars` is ignored by Git.

## Install and configure local development

From the repository root:

```bash
cd app
npm ci
cp .dev.vars.example .dev.vars
npm run cf-typegen
```

Wrangler 4.45 and newer can provision the configured D1 binding automatically.
The committed configuration intentionally contains no account-specific
database ID.

Apply the reviewed migration to the persistent local D1 store:

```bash
npm run db:migrate:local
```

Start the Vite and Worker development server:

```bash
npm run dev
```

Wrangler stores local D1 state beneath `app/.wrangler/`. Stop and restart the
development server without deleting that directory to verify persistence.

## Exercise the local persistence proof

With the local server running on port 5173:

```bash
curl --fail-with-body http://localhost:5173/api/health

curl --fail-with-body \
  -H 'content-type: application/json' \
  --data @fixtures/fictional-case.json \
  http://localhost:5173/api/dev/cases

curl --fail-with-body http://localhost:5173/api/dev/cases

curl --fail-with-body \
  http://localhost:5173/api/dev/cases/REPLACE_WITH_CREATED_CASE_ID
```

The fixture is obviously fictional and contains no real client or contact
information. The development routes accept only the documented fields, cap
request bodies at 16 KiB, and use parameterized database operations.

## Checks

```bash
npm run typecheck
npm test
npm run build
```

Tests use Cloudflare's Workers Vitest integration and an isolated local D1
database. They do not use the persistent development database.

## Preview database and deployment

The `preview` Wrangler environment has an independent D1 binding and keeps the
development case endpoints disabled. Do not set `APP_ENV=local` or
`ENABLE_DEV_CASE_API=true` in a deployed environment.

Authenticate Wrangler, build the `preview` Cloudflare environment, and allow
the first preview deployment to provision its D1 resource:

```bash
cd app
npx wrangler login
npm ci
npm run check
npm run build:preview
npx wrangler deploy
```

Apply migrations to that remote preview database:

```bash
npm run db:migrate:preview
```

Cloudflare requires `wrangler deploy` for a Worker's first upload. The preview
configuration disables all case routes, and the initial migration does not
change any existing production resource.

For later preview releases, build with the preview environment selected, upload
without changing traffic, apply any new backward-compatible migration, and
then deploy the reviewed version ID:

```bash
npm run check
npm run build:preview
npx wrangler versions upload
npm run db:migrate:preview
npx wrangler versions deploy REPLACE_WITH_VERSION_ID
```

The Vite plugin selects Cloudflare environments at build time. Do not add
`--env preview` to the upload command: `npm run build:preview` writes a
flattened preview deployment configuration, and Wrangler automatically uses
that build output. `versions upload` creates no deployment; only the explicit
`versions deploy` command changes preview traffic.

If automatic provisioning is disabled for the Cloudflare account, create the
database manually:

```bash
npx wrangler d1 create permitpulse-case-workspace-preview
```

Then add the returned `database_name` and `database_id` to
`env.preview.d1_databases[0]` in `wrangler.jsonc` before applying migrations.
Account-specific IDs are not secrets, but should be reviewed as deployment
configuration before committing.

## Migration rollback

Migration `0001_create_cases.sql` is additive. Before a remote rollback, export
or otherwise back up any data that must be retained. To remove only this
foundation from a local checkout:

```bash
rm -rf app/.wrangler
```

To reverse the schema remotely, add and review a new forward migration that
drops the indexes and `cases` table. Do not delete or rewrite an already
applied migration. Roll back the Worker separately with Cloudflare Workers
version rollback controls.

Because this workspace has no references from the existing public site,
removing `app/` rolls back the repository change without changing the current
Pages or `pp-api` deployments.
