# Indexed article routing fix

## Source of truth

The public site is authored and tracked directly in `dist/`, as documented in
`README.md`. Repository searches found no generator, copy step, alternate
`_redirects`, or public-site build task that replaces `dist/_redirects`.
`scripts/align-legacy-offers.mjs` updates HTML only.
`scripts/generate-jurisdiction-pages.mjs` generates jurisdiction pages and related
sitemaps; it reads and preserves the existing `dist/sitemap-pages.xml`.
The separate `app/` build is for the internal workspace.

## Changes

- Remove the two retroactive-permit 200 rewrites to the same-name `.html` file.
  Keep that HTML file and its entire article body. Add the extensionless,
  slashless canonical and use it in the sitemap and resource-index link.
- Remove both ADU-to-`/resources/` redirects. The ADU file in HEAD was actually a
  `noindex` retired-guide placeholder, canonicalized to `/resources/`. Restore
  the dedicated article and original stylesheet/layout from `1ed866b^`
  (`1824fb9`), preserving its substantive guide sections and FAQ. Point commercial
  navigation/CTAs to the current intake and sample report rather than restoring
  retired pricing or Stripe checkout. Restore its self-referencing canonical,
  sitemap entry, and a resource-index link.
- Add only one explicit redirect: the ADU sibling `.html` alias goes directly to
  its slash canonical. There is no sibling HTML asset; this avoids a homepage
  fallback for that alternate URL.
- Add article-content, canonical, sitemap, native-route, and internal-link
  regression checks to the existing public validator, plus an HTTP verifier.

## Verified local Pages behavior

Paths below are relative to the site origin. R is
`/retroactive-permits-unpermitted-work-los-angeles`; A is
`/resources/check-adu-permit-history-los-angeles`.

| Request | Response | Destination | Redirects |
| --- | --- | --- | --- |
| R | 200, original retroactive-permit article | R | 0 |
| R/ | 308 → 200 | R | 1 |
| R.html | 308 → 200 | R | 1 |
| A/ | 200, restored ADU article | A/ | 0 |
| A | 308 → 200 | A/ | 1 |
| A.html | 301 → 200 | A/ | 1 |
| A/index.html | 308 → 200 | A/ | 1 |

Validation used Wrangler 4.107.0 Pages asset serving, with isolated before/after
copies of the static site and a temporary worker that only calls
`env.ASSETS.fetch(request)`. This prevented Wrangler's default shim from loading
the separate internal app configuration. No preview worker was added to the
repository or deployment. API/booking Functions were not exercised.

The baseline reproduced R returning a 308 to itself and A/ returning a 301 to
`/resources/`. The fixed preview passed all seven URL variants, both with and
without query strings (14 checks). Final responses were compared byte-for-byte
with the dedicated article files, not merely checked for status 200.
All 84 sampled unrelated static/legacy routes had identical status, Location,
and response bodies before and after. The resource index itself intentionally
gains two links. `npm run check` passes, including the new static regression checks.

Repeat against a Pages preview after deployment:

```sh
npm run check
node scripts/verify-indexed-routes.mjs https://YOUR-PREVIEW.pages.dev
```

An optional second origin compares unrelated routes against a baseline:

```sh
node scripts/verify-indexed-routes.mjs http://127.0.0.1:8792 http://127.0.0.1:8791
```

This change has not been deployed. Production status and any dashboard-level
redirects or caching still require verification on the deployed origin.
The native behavior follows Cloudflare's
[serving-pages documentation](https://developers.cloudflare.com/pages/configuration/serving-pages/).

## Additional suspect rules — unchanged

### Same-name HTML 200 rewrites

Both slash variants of each route below rewrite to their same-name `.html`
asset, matching the retroactive-permit failure pattern:

- `/ladbs-roofing-permits` → `/ladbs-roofing-permits.html` (200)
- `/es/ayuda-permisos-los-angeles` → `/es/ayuda-permisos-los-angeles.html` (200)

### Existing article paths redirected to a generic parent

These paths have corresponding HTML files but redirect to `/resources/`:

- `/resources/permit-history-report-vs-permit-expeditor` and its slash variant
- `/la-building-permit-help.html`
- `/la-city-vs-county-permits.html`
- `/los-angeles-adu-permit-help.html`

All four current files are retired-guide placeholders. Their historical content
and search value need review before deciding whether to restore them. Other
existing files redirected to the homepage/intake are explicitly retired offer,
snapshot, Mission Control, and booking pages; those remain unchanged as well.
The LADBS-status and permit-record-checklist rules redirect to a specific guide,
rather than a generic parent, and are unchanged.

### Existing parser warnings and redirect chains

Wrangler reports and ignores five existing index rewrites as potential loops:

- `/sample-report/` → `/sample-report/index.html` (200)
- `/case-integrity/` → `/case-integrity/index.html` (200)
- `/city/*` → `/city/index.html` (200)
- `/thank-you/` → `/thank-you/index.html` (200, with an inline comment)
- `/*` → `/index.html` (200)

In this tested Pages parser the catch-all is rejected, so it does not intercept
the repaired native routes. Do not treat that catch-all as a reliable fallback;
confirm deployed behavior with the HTTP verifier. No catch-all or unrelated
rewrite was modified in this fix.

Other existing chain candidates include `/sgv/ev-battery-radar` (and slash
variant) redirecting to a `.html` URL before native normalization, and
`/guides/permit-dossier` (and slash variant) redirecting through the checklist
URL, which itself redirects to the permit-history guide. These are reported
only and remain outside this change.
