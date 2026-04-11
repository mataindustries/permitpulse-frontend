# US SEO Polish Notes

## Metadata changes made

- Tightened `/permits/` title to `U.S. Permit Directory by State and City | PermitPulse`.
- Tightened `/permits/` meta description to use live catalog counts for state and city pages.
- Tightened `/permits/[state]/` titles to `${State} Permit Directory | ${count} Covered Cities | PermitPulse`.
- Tightened `/permits/[state]/` meta descriptions to use the covered jurisdiction count plus official-portal and coverage-tier framing.
- Tightened `/permits/[state]/[city]/` titles to `${City}, ${State} Permit Portal + Coverage | PermitPulse`.
- Tightened `/permits/[state]/[city]/` meta descriptions to use actual platform label plus actual coverage tier.
- Tightened `/permit-portal/[state]/[city]/` alias titles and descriptions so they clearly describe the route as an alias, not a primary landing page.
- Added breadcrumb structured data to the `/permits/` hub and preserved breadcrumb/page-identity structured data on state and city pages.

## Canonical / noindex behavior

- `/permits/[state]/[city]/` remains the canonical city route.
- `/permit-portal/[state]/[city]/` points canonical to the matching `/permits/[state]/[city]/` route.
- `/permit-portal/[state]/[city]/` keeps `noindex,follow`.
- Alias pages still include the fast refresh to the canonical `/permits/` page.

## Internal linking improvements

- Expanded `/permits/` with:
  - concise intro copy
  - top covered states based on current catalog counts
  - featured city links pulled from current catalog entries
  - the existing full state directory grid
- Expanded state pages with:
  - stronger intro copy using actual counts and current platform mix
  - an all-covered-cities link section
  - a simple API-backed vs portal-only grouping summary from current metadata
- Expanded city pages with:
  - stronger factual intro copy
  - official portal CTA above the fold
  - platform label and coverage tier in the metadata snapshot
  - fallback notes that distinguish API-backed vs portal-only handling
  - links back to the state page and Mission Control
  - a related-links section generated from same-state catalog entries

## Sitemap changes

- Regenerated `dist/sitemap-permits.xml` with updated `lastmod` values set to `2026-04-11`.
- Sitemap continues to include canonical `/permits/`, `/permits/[state]/`, and `/permits/[state]/[city]/` routes only.
- Alias `/permit-portal/...` routes are not included in the permits sitemap.
- Sitemap priority remains biased toward canonical hub and state routes over city routes.

## Unresolved SEO limitations

- The directory is still limited to jurisdictions that are enabled and have a populated `state` value in the current shared catalog.
- There is no catalog field for recency or editorial importance, so the hub uses catalog-derived featured links rather than true "recently added" cities.
- City-page related links are inferred from same-state metadata and simple similarity rules; there is no geographic-neighbor or market-priority field in the catalog.
- Structured data remains lightweight and limited to breadcrumbs plus page identity.
