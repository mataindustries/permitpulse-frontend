# US SEO Polish QA

## Metadata coverage summary

- Checked `/permits/`
  - Title renders as `U.S. Permit Directory by State and City | PermitPulse`
  - Meta description renders cleanly with live catalog counts
  - Canonical points to `/permits/`
- Checked state pages:
  - `/permits/california/`
  - `/permits/texas/`
  - Titles and meta descriptions render cleanly
  - State title wording was corrected from `Covered Cities` to `Covered Jurisdictions` because some state pages include counties
- Checked city pages:
  - `/permits/california/los-angeles/`
  - `/permits/california/sacramento/`
  - `/permits/texas/el-paso/`
  - Titles, descriptions, and canonical tags render cleanly
  - Portal-only pages still surface factual fallback notes and official portal CTAs
- Checked alias pages:
  - `/permit-portal/california/los-angeles/`
  - `/permit-portal/texas/el-paso/`
  - Alias titles and descriptions clearly describe the route as an alias

## Canonical / noindex summary

- Canonical city routes remain under `/permits/[state]/[city]/`
- Alias routes under `/permit-portal/[state]/[city]/` point canonical to the matching `/permits/...` URL
- Alias routes keep `noindex,follow`
- Alias routes still use the immediate refresh to the canonical route
- Checked representative alias output and did not find any case where alias pages self-canonicalize or expose indexable robots directives

## Internal linking summary

- `/permits/` links into:
  - top covered states
  - full state directory cards
  - featured city pages
  - Mission Control
  - California search
- State pages link into:
  - all covered city or county permit pages
  - official external portals where present
  - Mission Control
  - the root `/permits/` hub
- City pages link into:
  - official portal CTA above the fold
  - state page
  - Mission Control
  - related same-state permit pages
- California launch pages still render and still link into their existing cluster plus `/permits/`

## Sitemap summary

- Checked `dist/sitemap.xml`
  - sitemap index still references `sitemap-pages.xml`, `sitemap-jurisdictions.xml`, and `sitemap-permits.xml`
- Checked `dist/sitemap-permits.xml`
  - includes `/permits/`, `/permits/[state]/`, and `/permits/[state]/[city]/`
  - does not include `/permit-portal/...` alias routes
  - priority remains biased toward canonical hub and state routes over city routes

## Minimal fixes made during QA

- Corrected state-page title wording from `Covered Cities` to `Covered Jurisdictions`
- Removed duplicated city-page state filtering by precomputing state entries once during generation

## Unresolved items

- Structured data labels for state pages still use `Permit Pages` language rather than `Permit Directory`; this is consistent and non-blocking, but not fully aligned with the visible title copy
- City page descriptions use the current `platform` field as the portal label, which is factual but can read a little awkwardly for platforms like `Open Data (ArcGIS)`
