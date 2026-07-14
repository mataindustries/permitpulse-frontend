# PermitPulse Full-Stack Audit

Audit date: 2026-07-04

Repository state inspected: `main` at `032e0f9`

Scope: all 424 tracked files were inventoried; all executable source, configuration, routing, forms, deployment metadata, and documentation were inspected. Binary images and the three checked-in PDFs were inventoried as assets.

## Executive finding

PermitPulse is currently a static marketing and public-data site with several independent dynamic backends. It is not a React application and it has no authenticated application, relational database, private object storage, authorization model, application test suite, or repository-defined CI pipeline.

The public site is deployed from checked-in files under `dist/`. Cloudflare Pages Functions under `functions/` provide same-origin JSON, booking, Stripe, KV, and OpenAI handlers. A separate JavaScript Cloudflare Worker under `workers/pp-api/` serves public permit-data and AI-report routes at `api.getpermitpulse.com`. Several browser flows bypass both and call Formspree, Socrata, or untracked `workers.dev` services directly.

The lowest-risk placement for PermitPulse Case Workspace is an isolated full-stack project under `app/` in this repository, deployed on its own hostname (recommended: `workspace.getpermitpulse.com`). It should not initially be served from the public site's `/app` URL because the existing catch-all rewrite sends every otherwise unmatched path to the marketing homepage (`dist/_redirects:50-51`).

## 1. Current frontend framework and build system

### Public frontend

- There is no frontend framework. The site is hand-authored/generated HTML, CSS, and vanilla JavaScript under `dist/`.
- `README.md:22-28` identifies `dist/` as the production site, and `README.md:48-55` describes the deployment flow as editing `dist/`, committing to `main`, and allowing hosting to publish.
- There is no root `package.json`, Vite configuration, TypeScript configuration, framework configuration, or build script.
- The repository contains 304 production HTML files under `dist/`, five CSS files, and browser JavaScript assets such as:
  - global legacy bootstrap: `dist/assets/app.js`
  - global conversion tracking: `dist/assets/permitpulse-tracking.js`
  - Instant Snapshot: `dist/assets/instant-snapshot.js`
  - Mission Control: `dist/assets/mission-control.js`
  - legacy city UI: `dist/assets/pp.js`
  - SGV radar UI: `dist/assets/sgv-radar.js`
- Tailwind is loaded from its CDN by 40 HTML pages rather than compiled locally; for example, `dist/free-csv.html:7`.
- GA4 is embedded directly in all 304 production HTML files; the homepage example is `dist/index.html:26-31`.
- The shared tracking script is included broadly and patches `window.fetch` to observe successful Formspree submissions (`dist/assets/permitpulse-tracking.js:277-297`).

### Generation and verification

- `scripts/generate-jurisdiction-pages.mjs` is a Node ESM generator. It imports the Worker jurisdiction catalog (`scripts/generate-jurisdiction-pages.mjs:1-12`) and writes directly into `dist/`.
- The generator deletes and recreates the complete `dist/permits`, `dist/building-permits`, and `dist/permit-portal` trees (`scripts/generate-jurisdiction-pages.mjs:2159-2171`), then rewrites page families and sitemaps (`scripts/generate-jurisdiction-pages.mjs:2172-2216`).
- The three batch verifiers are live-network scripts. Their shared implementation validates the catalog locally and probes public portals/APIs (`scripts/verify-us-expansion-shared.mjs:72-151`, `scripts/verify-us-expansion-shared.mjs:157-213`).
- No root script declares how to invoke the generator or verifiers. Their use is documented only indirectly in point-in-time QA notes.

### Separate Worker build

- `workers/pp-api/package.json:1-12` is the only active package manifest.
- It uses Wrangler only; there are no runtime npm dependencies and no test, lint, build, or typecheck scripts.
- The lockfile pins the Worker toolchain independently (`workers/pp-api/package-lock.json:1-12`).
- The Worker entry point is ES-module JavaScript (`workers/pp-api/wrangler.jsonc:1-7`, `workers/pp-api/src/worker.js:1-14`).

## 2. Current directory structure

```text
/
├── dist/                         # checked-in production site; 371 files
│   ├── index.html                # public homepage
│   ├── assets/                   # JS, CSS, images, three static PDFs
│   ├── permits/                  # generated state/city directory
│   ├── building-permits/         # generated SEO variant
│   ├── permit-portal/            # generated noindex alias variant
│   ├── california/jurisdictions/ # earlier jurisdiction pages
│   ├── _headers                  # Cloudflare Pages headers
│   └── _redirects                # redirects, rewrites, catch-all
├── functions/                    # 10 Cloudflare Pages Functions
│   ├── api/
│   └── book/
├── workers/
│   └── pp-api/                   # standalone public-data Worker package
│       ├── src/
│       │   ├── config/
│       │   ├── mission-control/
│       │   └── providers/
│       ├── package.json
│       ├── wrangler.jsonc
│       └── wrangler.prod.jsonc
├── scripts/                      # generator and live verification scripts
├── docs/                         # existing marketing tracking note
├── drafts/                       # Mission Control static prototype
└── *.md                          # historical implementation and QA notes
```

Notable inventory details:

- `dist/` is approximately 40 MB of the 41 MB working tree and contains both source-of-truth hand edits and generated output.
- `workers/pp-api/src/config/jurisdictions.js:1` contains 59 jurisdiction records: 58 enabled, one disabled; nine have API providers and 50 are portal-only.
- `drafts/mission-control/frontend-v1.html` is a static prototype, not part of a build.
- `dist/assets/app.js.bak` is a checked-in backup with duplicated function definitions.
- The root file named `to dossier pages"` is accidentally captured `less` help output, not application content.
- `.codex` is an empty tracked file.

## 3. Current Cloudflare, API, form, PDF, email, analytics, and deployment code

### Cloudflare Pages

The repository has no tracked Pages project configuration. The inferred Pages setup is:

- static output directory: `dist/`, based on `README.md:22-28`
- Pages Functions directory: `functions/`
- routing metadata: `dist/_redirects`
- response header metadata: `dist/_headers`

`dist/_headers:20-27` applies baseline `nosniff`, frame denial, same-origin referrer policy, and wildcard API CORS headers. A CSP exists only for the SGV radar page (`dist/_headers:17-18`).

`dist/_redirects:1-48` defines legacy aliases and selected pretty-route rewrites. Its final rule rewrites all unmatched paths to `index.html` (`dist/_redirects:50-51`), masking ordinary static 404s and conflicting with a future same-site SPA prefix unless routing is changed deliberately.

### Cloudflare Pages Functions

| Effective route | Implementation | Current behavior and storage |
|---|---|---|
| `POST /api/checkout` | `functions/api/checkout.js:2-67` | Creates Stripe Checkout sessions through Stripe's REST API. Reads server-side price IDs and `STRIPE_SECRET_KEY`. No current page calls it. |
| `POST /api/instant-snapshot` | `functions/api/instant-snapshot.js:29-60` | Validates three fields, builds heuristic permit guidance, optionally calls OpenAI, and returns it without persistence. |
| `POST /api/loi` | `functions/api/loi.ts:12-40` | Stores arbitrary JSON plus IP/user agent in `PP_LOIS` KV for 180 days. Public `/loi` pages redirect to `/free-tools` (`dist/_redirects:1-3`). |
| `POST /api/pilot-intake` | `functions/api/pilot-intake.js:6-71` | Validates contact fields, attempts a 90-day `PILOT_KV` backup, optionally posts to MailChannels and Discord. |
| `* /api/top-permits` | `functions/api/top-permits.js:3-138` | Queries a hard-coded LADBS Socrata dataset and normalizes results. |
| `GET /book/health` | `functions/book/health.js:1-3` | Static health response. |
| `GET /book/slots` | `functions/book/slots.js:5-54` | Computes configured slots and checks `BOOKING_KV`. |
| `POST /book/book` | `functions/book/book.js:5-37` | Checks a KV slot, writes booking records, and returns Google Calendar/ICS URLs. |
| `GET /book/bookings` | `functions/book/bookings.js:1-14` | Lists booking PII after a bearer-token check. |
| `GET /book/ics/:id` | `functions/book/ics/[id].js:1-30` | Returns a public bearer-link calendar file containing booking name and email. |

No tracked file defines the Pages KV bindings or environment values. They must currently be dashboard configuration or absent.

### Standalone `pp-api` Worker

- Development/default config: `workers/pp-api/wrangler.jsonc`
- Production-route config: `workers/pp-api/wrangler.prod.jsonc`
- Custom production route: `api.getpermitpulse.com/*` (`workers/pp-api/wrangler.prod.jsonc:9-13`)
- Runtime route table: `workers/pp-api/src/worker.js:2470-2490`
- Dispatch and CORS wrapper: `workers/pp-api/src/worker.js:2493-2515`

The Worker exposes:

- health routes
- Pasadena, San Diego County, San Jose, Santa Monica, and Santa Monica demolition live feeds
- radar, top-permits, address-pulse, and jurisdiction/history APIs
- pilot intake
- Mission Control AI reports
- a declared zone-claim route

The permit connector layer supports Socrata (`workers/pp-api/src/providers/socrata.js`), ArcGIS (`workers/pp-api/src/providers/arcgis.js`), and CKAN logic embedded in `workers/pp-api/src/worker.js:499-619`. The catalog is centralized in `workers/pp-api/src/config/jurisdictions.js`.

The Mission Control route accepts browser-supplied property context and records, then optionally calls the OpenAI Responses API (`workers/pp-api/src/mission-control/report.js:118-141`, `workers/pp-api/src/mission-control/report.js:272-340`). It returns an AI result or a mock/fallback report and persists nothing (`workers/pp-api/src/mission-control/report.js:388-443`).

### KV

The standalone Worker declares five KV bindings in both Wrangler files:

- `PERMIT_KV`
- `PERMITPULSE_LEADS`
- `PERMITPULSE_RADAR`
- `PERMITPULSE_WATCH`
- `PILOT_KV`

The current Worker source uses only `PILOT_KV` (`workers/pp-api/src/worker.js:2331-2335`). The other four declared namespaces have no current source references.

Pages Functions separately expect:

- `PP_LOIS`
- `PILOT_KV`
- `BOOKING_KV`

Their bindings are not declared in this repository.

There is no D1, R2, Durable Object, Queue, Vectorize, or Browser Rendering binding in the current repository.

### External public-data APIs

- LADBS/Socrata calls appear in the Pages top-permits function (`functions/api/top-permits.js:47-68`), the standalone Worker (`workers/pp-api/src/worker.js:176-230`), and directly in public pages such as `dist/top-permits/index.html:441,594` and `dist/radar/index.html:521,667`.
- `dist/address-pulse.html:326-378`, `dist/roofing-rain-rush.html:388-449`, and `dist/zone-claim.html:352-410` call the custom API Worker.
- `dist/california-permit-history/index.html:560-595` calls the custom API domain with an untracked `workers.dev` fallback.
- `dist/sgv-ev-battery-radar.html` and `dist/assets/sgv-radar.js:1-38` depend on a separate SGV Worker that is not in this repository.
- `dist/free-csv.html:69-96` and `dist/es/free-csv.html:91-122` submit to a separate mailer Worker and open a CSV route whose implementation is not present here.
- Legacy city assets call `/api/permits` and `/api/csv` (`dist/assets/app.js:31-57`, `dist/assets/pp.js:135-142`), but neither route is implemented by the checked-in Pages Functions or `pp-api` route table.

### Forms and email

Six active HTML forms post directly to three Formspree endpoints:

- homepage packet intake: `dist/index.html:1759-1811`
- Permit Review checklist: `dist/permit-due-diligence-los-angeles/index.html:415-471`
- Permit Review intake: `dist/permit-due-diligence-los-angeles/index.html:637-692`
- free Snapshot lead: `dist/snapshot/index.html:170-202`
- Red Tape weekly signup: `dist/red-tape-index/index.html:949-961`
- Red Tape address checker: `dist/red-tape-index/index.html:1087-1127`

The repository does not control Formspree retention, notifications, spam filtering, or downstream processing.

The only checked-in outbound email implementation is the pilot Pages Function's MailChannels POST (`functions/api/pilot-intake.js:31-43`). Booking success copy says to check email/text (`dist/booking.html:251-254`), but `functions/book/book.js` contains no email or SMS delivery.

The standalone Worker's pilot handler treats `FORWARD_TO` as a URL and calls `fetch` on it (`workers/pp-api/src/worker.js:2337-2344`), while both Wrangler files configure that variable as an email address (`workers/pp-api/wrangler.jsonc:23-37`). The exception is swallowed, so that forwarding path cannot work as configured.

### Stripe

- Most public checkout buttons are hard-coded Stripe Payment Links; one example is `dist/instant-snapshot/index.html:227`.
- `functions/api/checkout.js` is an alternate server-created Checkout Session flow but has no active caller in checked-in frontend code.
- The checkout success and cancel URLs point to `/loi/` (`functions/api/checkout.js:33-39`), while `/loi/` permanently redirects to `/free-tools` (`dist/_redirects:1-3`).
- No Stripe webhook implementation is present, so the repository cannot confirm payment, provision access, or reconcile a case.

### PDFs (superseded audit note)

The outreach site now treats `dist/assets/docs/PermitPulse-Permit-Review-Packet-Sample.pdf` as its canonical fictional sample. Legacy sample routes redirect to that artifact. The authenticated case workspace now contains the canonical HTML, text, and PDF rendering pipeline; the older static Mission Control prototype described elsewhere in this audit is retired from public navigation.

### Analytics

- GA4 is hard-coded in all production HTML pages. The same public measurement ID is repeated rather than injected at build time.
- Cloudflare Web Analytics is hard-coded in 303 production HTML pages; for example, `dist/permitpulse-pilot-intake-en.html:24`.
- `dist/assets/permitpulse-tracking.js:101-137` injects UTM, landing-page, referrer, and page-path fields into Formspree forms.
- It emits CTA, SMS/hotline, checkout, sample-view, official-source, form-start, and lead events (`dist/assets/permitpulse-tracking.js:209-275`, `dist/assets/permitpulse-tracking.js:299-330`).
- Campaign conventions are documented in `docs/marketing-tracking-may-2026.md:1-73`.

### Deployment

- The README says the public site is intended for Cloudflare Pages or similar static hosting (`README.md:48-55`).
- No Pages project name, build command, output configuration, branch rules, or Cloudflare account configuration is tracked.
- `workers/pp-api/package.json:5-9` runs `wrangler deploy` without selecting `wrangler.prod.jsonc`. Therefore the documented `npm run deploy` uses the default config, which does not contain the custom `api.getpermitpulse.com` route.
- There is no `.github/workflows/` directory and no repository CI/CD configuration.

## 4. TypeScript versus JavaScript

Tracked executable source consists of:

- 21 `.js` files
- five `.mjs` files
- one `.ts` file

The only TypeScript file is `functions/api/loi.ts`. It uses ambient `PagesFunction` and `KVNamespace` types (`functions/api/loi.ts:2-12`), but there is no `tsconfig.json`, generated Worker binding type file, or declared Cloudflare type package. It is therefore not typechecked by a repository command.

All standalone Worker code, browser code, other Pages Functions, and generator code are JavaScript. `workers/pp-api/package.json` does not set `"type": "module"`, although its source uses ESM syntax. Direct Node imports work through syntax detection but emit a module-type warning.

## 5. Current environment variables and bindings

No secret values were read or reproduced in this audit. No `.env`, `.dev.vars`, or example environment file is tracked. The root `.gitignore:2-8` excludes Cloudflare credential files and local variable files; `workers/pp-api/.gitignore:161-167` excludes Worker variable files.

### Pages Functions: referenced configuration

| Name | Kind | Referenced by |
|---|---|---|
| `STRIPE_SECRET_KEY` | secret | `functions/api/checkout.js:52-58` |
| `PRICE_CORE`, `PRICE_EXTRA_SEAT`, `PRICE_EXTRA_REGION`, `PRICE_SMS`, `PRICE_GUARANTEE`, `PRICE_PRIORITY`, `PRICE_CUSTOM`, `PRICE_TOP_PERMITS` | server configuration | `functions/api/checkout.js:14-23` |
| `OPENAI_API_KEY` | secret | `functions/api/instant-snapshot.js:334-347` |
| `OPENAI_SNAPSHOT_MODEL` | server configuration | `functions/api/instant-snapshot.js:347` |
| `FORWARD_TO` | server configuration | `functions/api/pilot-intake.js:31-43` |
| `DISCORD_WEBHOOK` | secret URL | `functions/api/pilot-intake.js:45-52` |
| `ADMIN_TOKEN` | secret | `functions/book/bookings.js:1-6` |
| `SLOT_MINUTES`, `EVENT_TITLE`, `BASE_URL`, `BUSINESS_HOURS_JSON`, `EXCLUDE_DATES` | server configuration | `functions/book/book.js:21-31`, `functions/book/slots.js:37-47` |
| `PP_LOIS`, `PILOT_KV`, `BOOKING_KV` | KV bindings | corresponding Pages Functions above |

Whether these are configured in Cloudflare Pages cannot be determined from the repository.

### `pp-api` Worker: declared configuration

Both Wrangler files declare public permit-source variables for city/state labels, source field names, Socrata domain/dataset, and `FORWARD_TO` (`workers/pp-api/wrangler.jsonc:23-38`). Most field-name and city/state variables are no longer referenced by the Worker source; current source reads `SOC_DOMAIN`, `SOC_DATASET`, and `FORWARD_TO`.

The source additionally references:

- `SOC_APP_TOKEN` as an optional secret (`workers/pp-api/src/worker.js:183-188`)
- `OPENAI_API_KEY` as a secret (`workers/pp-api/src/mission-control/report.js:310-327`)

Those secret names are intentionally not declared with values in Wrangler.

## 6. Current intake and application-like data flows

### Main public packet intake

```text
Browser
  -> static form in dist/index.html
  -> global tracking script injects attribution fields
  -> direct Formspree POST
  -> Formspree-owned storage/notification/redirect behavior
```

There is no checked-in PermitPulse database record, case ID, file upload, staff assignment, audit record, or status lifecycle for this intake.

### Other Formspree leads

The Permit Review, Snapshot, and Red Tape forms follow the same direct-to-Formspree pattern. Some use AJAX and show local success state (`dist/snapshot/index.html:259-303`, `dist/red-tape-index/index.html:1761-1815`); others submit natively. The global fetch patch emits GA lead events after successful Formspree responses (`dist/assets/permitpulse-tracking.js:277-297`).

### Booking

```text
Browser /booking.html
  -> GET /book/slots
  -> BOOKING_KV availability reads
  -> POST /book/book
  -> BOOKING_KV slot and booking records
  -> browser receives Google Calendar and ICS links
```

The frontend endpoints are at `dist/booking.html:233-235,305-346`. The writes are at `functions/book/book.js:13-33`.

The returned ICS URL and the admin page are route-mismatched:

- booking handler returns `/api/ics/:id` (`functions/book/book.js:30`)
- admin page requests `/api/bookings` and links `/api/ics/:id` (`dist/admin.html:49-65`)
- checked-in Functions implement `/book/bookings` and `/book/ics/:id`

No rewrite bridges those routes.

### Instant Snapshot

```text
Browser /instant-snapshot/
  -> POST /api/instant-snapshot
  -> normalize and heuristic jurisdiction/scope analysis
  -> optional OpenAI enhancement
  -> response rendered in browser
  -> no persistence
```

The browser request is `dist/assets/instant-snapshot.js:177-239`; the handler is `functions/api/instant-snapshot.js:29-60`; the optional AI call is `functions/api/instant-snapshot.js:334-436`.

### Mission Control

```text
Browser /mission-control/
  -> POST api.getpermitpulse.com/api/mission-control/report
  -> browser-supplied records or built-in mock records
  -> optional OpenAI structured response
  -> fallback mock report on errors
  -> no persistence or approval
```

The endpoint and request are `dist/assets/mission-control.js:1-3,273-297`; backend selection/fallback is `workers/pp-api/src/mission-control/report.js:407-441`.

### Dormant/legacy intake

- The English and Spanish pilot-intake pages immediately redirect to `/` (`dist/permitpulse-pilot-intake-en.html:6-9`, `dist/es/permitpulse-piloto-intake-es.html:6-9`).
- Both a Pages Function and the standalone Worker implement pilot intake with different validation and forwarding behavior (`functions/api/pilot-intake.js`, `workers/pp-api/src/worker.js:2307-2348`).
- `POST /api/loi` still accepts and stores JSON even though public LOI routes redirect away.

## 7. Duplicated, obsolete, fragile, and security-sensitive code

### High priority

1. **No authentication or case authorization exists.** `dist/admin.html` is protected only by a manually entered static bearer token sent to a route that does not exist at that path (`dist/admin.html:38-56`). None of the current public AI, intake, or permit APIs can enforce client-versus-admin case access.

2. **Checkout input is over-trusted.** The public handler accepts client-provided `mode`, `trialDays`, metadata, and fallback `lineItems` (`functions/api/checkout.js:4-12,26-50`). A caller can bypass aliases and supply arbitrary Stripe price IDs, choose a mode, and choose a trial duration. There is no server-owned product definition, authentication, idempotency key, or webhook.

3. **Public AI endpoints lack cost and abuse controls.** Instant Snapshot has wildcard CORS, no authentication, no rate limit, and no input length cap (`functions/api/instant-snapshot.js:7-15,29-53,72-97`). Mission Control is also public and lets the caller select `openai_model` (`workers/pp-api/src/mission-control/report.js:118-127,272-307`). Both can spend provider credits without a user or case record.

4. **Case-like PII is stored or disclosed without an authorization model.**
   - LOI stores arbitrary bodies plus IP and user agent for 180 days (`functions/api/loi.ts:20-33`).
   - bookings store name, phone, email, notes, and language in KV with no expiration (`functions/book/book.js:18-29`).
   - ICS files are retrievable by UUID without a session and contain client name/email (`functions/book/ics/[id].js:1-16`).
   - no retention/deletion workflow is implemented.

5. **KV booking is race-prone.** Availability is a read followed by two independent puts (`functions/book/book.js:13-29`). KV does not make that sequence an atomic reservation, so concurrent requests can double-book.

6. **A production route calls an undefined function.** `/api/zone-claim` maps to `handleZoneClaim`, but no such function exists (`workers/pp-api/src/worker.js:2483-2485`). The matching page actively calls that endpoint (`dist/zone-claim.html:352-410`).

7. **Potential DOM XSS exists in legacy UIs.**
   - the booking admin page inserts booking fields into `innerHTML` and only partially escapes one field (`dist/admin.html:60-67`)
   - SGV radar inserts remote API fields and a URL directly into `innerHTML` (`dist/assets/sgv-radar.js:54-72`)
   - these patterns must not be copied into the authenticated app.

### Medium priority

1. **Duplicate implementations have drifted.**
   - top permits: `functions/api/top-permits.js` versus `workers/pp-api/src/worker.js:1237-1452`; the visible top-permits page calls Socrata directly instead (`dist/top-permits/index.html:441,594`)
   - pilot intake: `functions/api/pilot-intake.js` versus `workers/pp-api/src/worker.js:2307-2348`
   - public permit data: browser-direct Socrata, Pages Functions, the custom Worker, and multiple untracked fallback Workers

2. **The two Worker configs drift.** The default has detailed observability and disables preview URLs; the prod file adds a route but has different observability settings (`workers/pp-api/wrangler.jsonc:4-21`, `workers/pp-api/wrangler.prod.jsonc:9-13,53-61`). The package deploy script does not select prod.

3. **CORS policy is inconsistent.**
   - Pages `instant-snapshot`, LOI, booking, and top-permits responses allow `*`
   - the standalone Worker allowlists the two marketing origins (`workers/pp-api/src/config/permits.js:1-5`, `workers/pp-api/src/worker.js:48-69`)
   - the pilot Pages Function reflects its own request origin rather than a fixed trusted origin (`functions/api/pilot-intake.js:58-70`)
   - none of this is suitable as the authenticated app's credentialed CORS policy.

4. **Error and fallback behavior can hide failures.**
   - pilot KV/Discord/forwarding exceptions are swallowed
   - Mission Control returns HTTP 200 with a mock dossier when OpenAI fails and includes the internal failure reason (`workers/pp-api/src/mission-control/report.js:423-441`)
   - the frontend silently converts API failures into a plausible mock result (`dist/assets/mission-control.js:273-339`)

5. **Public and generated source are conflated.** Hand edits and generated files coexist in `dist`, while the generator recursively deletes three route trees. There is no generated-file manifest or CI drift check.

6. **The catch-all rewrite is broad.** `dist/_redirects:50-51` can make missing API/static routes look like successful homepage responses and prevents safe introduction of new path namespaces without explicit rules.

7. **The booking timezone model is ambiguous.** The UI says Pacific Time (`dist/booking.html:242-247`), while server output uses floating local calendar times with no timezone identifier (`functions/book/book.js:39-57`, `functions/book/ics/[id].js:22-29`).

8. **Health checks perform live upstream work.** The standalone health handler probes several external providers (`workers/pp-api/src/worker.js:1531-1568`), so a public health request is not a cheap process/readiness check.

### Obsolete or likely obsolete

- `dist/assets/app.js.bak`
- the accidental root `to dossier pages"` file
- the four declared-but-unused Worker KV bindings
- redirected pilot-intake pages and duplicate pilot handlers
- redirected LOI UI plus still-live storage handler
- `/api/checkout`, with no checked-in caller and redirect targets that no longer represent checkout state
- `dist/admin.html`, whose API paths do not match its handlers
- point-in-time root QA documents that are not enforced by scripts or CI

These are audit findings only; no cleanup is part of this documentation task.

## 8. Placement decision for the authenticated application

### Recommended: existing repository under `app/`

Use one isolated project rooted at `app/`, with its own manifest, lockfile, TypeScript configuration, Vite configuration, Wrangler configuration, migrations, and tests. Deploy its React assets and Hono Worker together on `workspace.getpermitpulse.com`.

Why this is lowest risk:

- it does not move, rebuild, or reconfigure `dist/`
- it does not require converting the legacy root into a package workspace
- it can use a separate Cloudflare Worker, D1 database, R2 bucket, secrets, and deploy pipeline
- same-origin frontend/API deployment avoids credentialed cross-origin auth
- application and API changes remain atomic in one pull request
- public-data integrations can be consumed through explicit adapters without importing fragile legacy browser code

The directory name `app/` does not imply the initial public URL should be `getpermitpulse.com/app`. A separate hostname isolates routing and cookies. A `/app` URL can be considered later only after intentional Cloudflare routing and regression testing of the existing Pages catch-all.

### Not recommended now: formal monorepo conversion

A root workspace with `apps/`, `packages/`, and `workers/` can become useful when multiple new deployables share stable contracts. Today it would introduce a root package manager, lockfile, coordinated scripts, and deployment discovery into a repository whose public site has no root build. That is unnecessary migration risk for one small application.

### Not recommended now: separate repository

A separate repository gives maximum source isolation but adds cross-repository coordination for shared permit connectors, contracts, review, and release history. The deployment isolation can be achieved with an `app/` subproject and a separate Cloudflare Worker/domain without paying that coordination cost.

## 9. Lowest-risk technology adoption path

| Technology | Lowest-risk introduction |
|---|---|
| React/Vite | Create only under `app/`; use a standalone Vite build and Cloudflare static assets. Do not make Vite build or copy the marketing `dist/`. |
| TypeScript | Use strict TypeScript from the first app commit for browser, Hono, schemas, and tests. Generate Worker binding types from the app's Wrangler config. Do not migrate legacy JavaScript as a prerequisite. |
| Cloudflare Worker API | Serve app assets and `/api/*` from one new Worker on the workspace hostname. Keep Pages Functions and `pp-api` deployed independently. |
| Hono | Use as the new Worker's router and middleware boundary only. Do not wrap or rewrite legacy APIs during the foundation milestone. |
| D1 | Provision separate local, staging, and production databases. Apply forward-only, reviewed migrations; do not import current KV data automatically. |
| Drizzle ORM | Define new app tables and checked-in SQL migrations. Pin versions and review generated SQL. Keep authorization filters visible in repository/service functions. |
| Better Auth | Prove Worker/D1/email/session behavior in staging before case features. Use same-origin host-only cookies, required email verification, database-backed rate limiting, and a server-owned default client role. |
| R2 | Use a new private bucket. Initially proxy capped uploads/downloads through the authorized Worker; avoid public buckets and long-lived bearer URLs. |
| HTML/CSS PDF | Build a deterministic, escaped report template and render approved immutable snapshots through a Browser Rendering binding. Store both input/template version and resulting PDF. |
| Vitest | Start with pure unit tests, then add the Cloudflare Workers Vitest pool for Hono/D1/R2 integration tests. |
| Playwright | Add after auth shell and first case flow exist. Use isolated local/staging test data and retain traces only on failure with sensitive-data controls. |
| GitHub Actions | Add PR checks before deployment automation. Add staging deployment next; keep production behind an environment approval and explicit migration step. |

## 10. Migration and deployment risks

1. **Public-site regression:** any root build, output-directory change, `dist/_redirects` edit, or Pages dashboard change can alter current production behavior. The app must have a separate deploy root and hostname.
2. **Route collision:** serving the SPA at the marketing hostname would collide with the current `/* -> /index.html` rewrite.
3. **Cookie/CORS failure:** splitting auth API and UI across unrelated origins increases Safari and SameSite failure modes. Use one workspace origin.
4. **Schema/code skew:** D1 migrations are state changes and are not rolled back by reverting Worker code. Use expand/contract migrations and backward-compatible deployments.
5. **Environment drift:** current Pages bindings are dashboard-only, and existing Worker default/prod configs already differ. New app bindings must be tracked by name and validated per environment.
6. **Accidental legacy deployment:** repository-level CI path filters must ensure app changes do not deploy Pages or `pp-api`, and legacy changes do not automatically deploy Case Workspace without passing its tests.
7. **Auth schema coupling:** Better Auth and Drizzle schema generation must be pinned and reviewed; upgrades can change required tables/fields.
8. **Email dependency:** secure signup, verification, and password reset cannot ship until a transactional email provider, sender domain, bounce handling, and support workflow are selected.
9. **Private-file lifecycle:** R2 object writes and D1 metadata writes are not one transaction. Upload/finalization and deletion need repairable states and idempotency.
10. **PDF environment differences:** Cloudflare browser rendering is an external runtime. Font/assets, timeouts, and local-versus-remote behavior require a staging integration test and deterministic fallbacks.
11. **AI cost and data handling:** evidence may contain personal or sensitive data. Provider terms, retention, redaction, rate limits, and explicit human approval must be set before production AI runs.
12. **External legacy dependencies:** several public routes rely on Workers and services not represented in this repository. They cannot be safely migrated or retired based only on this audit.

## 11. Information not determinable from this repository

- Cloudflare Pages project name, build/output settings, production branch, preview configuration, and dashboard-only bindings
- whether each referenced Pages environment variable or KV binding exists in preview/production
- the actual secrets or their rotation state
- DNS records, zone routing precedence, and which Wrangler config was last deployed
- source and behavior of the mailer, proxy, fallback API, SGV radar, and other referenced `workers.dev` services
- Formspree ownership, spam controls, retention, recipients, and export/deletion process
- Stripe account configuration, active Payment Link products, webhook configuration outside this repo, refunds, and fulfillment
- whether MailChannels delivery still operates for the configured domain
- actual production traffic, logs, error rates, analytics property access, and data-quality baselines
- current customer records and whether KV contains bookings, LOIs, or pilot leads requiring migration
- privacy policy/consent requirements, retention policy, data-processing agreements, and incident-response process
- transactional email provider and verified sender domain for future authentication
- expected upload file types/sizes, malware-scanning requirements, and retention/deletion policy
- AI provider approval, model policy, budget, and rules for sending customer evidence
- production backup/restore objectives and support/admin operating procedures

## 12. Existing non-destructive checks run

- JavaScript syntax: `node --check` passed for every `.js` and `.mjs` file under `functions/`, `workers/pp-api/src/`, `scripts/`, and `dist/assets/`.
- Expansion verifier batches 1, 2, and 3 all completed with zero local schema issues.
- All live portal/API probes reported `fetch failed` because outbound network access was blocked in the execution environment; the verifier intentionally reports those as warnings rather than failures (`scripts/verify-us-expansion-shared.mjs:140-149,191-197`).
- All verifier runs emitted the expected warning that `workers/pp-api/package.json` does not declare ESM module type.
- No repository test, lint, typecheck, or CI script exists to run.
