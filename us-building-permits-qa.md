# US Building Permits QA

## Total building-permits pages
- 57 generated pages under `/building-permits/[state]/[city]`
- Count matches the current enabled jurisdiction catalog entries that already generate `/permits/[state]/[city]`

## Canonical and indexing summary
- All sampled `/building-permits/[state]/[city]` pages are self-canonical
- Generated building-permits pages render with `meta robots="index,follow"`
- Existing `/permit-portal/[state]/[city]` alias pages remain unchanged in behavior: `noindex,follow`, canonical to the matching `/permits/[state]/[city]` page
- Existing `/permits/[state]/[city]` pages remain self-canonical and indexable

## Sitemap summary
- `dist/sitemap-building-permits.xml` exists and contains 57 URLs
- `dist/sitemap.xml` includes `sitemap-building-permits.xml`
- Building-permits routes are included only in the dedicated building-permits sitemap
- Existing permit-directory sitemap behavior remains in `dist/sitemap-permits.xml`

## Duplication-risk summary
- Reviewed 3 route pairs directly:
  - `/building-permits/california/los-angeles/` vs `/permits/california/los-angeles/`
  - `/building-permits/arizona/mesa/` vs `/permits/arizona/mesa/`
  - `/building-permits/california/contra-costa-county/` vs `/permits/california/contra-costa-county/`
- The building-permits pages are materially distinct at the metadata and intent layer:
  - different route namespace
  - different title and H1
  - different meta description
  - different intro framing
  - different primary CTA wording
  - different primary internal-link target back to the matching `/permits` page
- The pages still use the same compact catalog facts and shared UI shell, so this is a controlled template variant rather than a deeply different editorial page type
- Current duplication risk looks acceptable for an indexable long-tail variant, but still moderate in the abstract because differentiation is metadata-driven rather than content-deep

## Route and link audit summary
- Slug generation is consistent with the existing `/permits/[state]/[city]` layer
- Generated route count matched expected catalog-derived route count exactly: 57 expected, 57 actual, with no missing or extra routes
- Automated checks across all generated building-permits pages confirmed presence of:
  - self canonical
  - `index,follow`
  - link to matching `/permits/[state]/[city]` page
  - link to matching state page under `/permits/[state]/`
  - link to `/mission-control/`
- Existing `/permits` pages now link to their matching building-permits variant and still retain Mission Control and state-directory links
- Existing `/permit-portal` alias pages still resolve to the canonical `/permits` layer and did not regress in sampled output

## Unresolved items
- The shared jurisdiction catalog does not distinguish cities from counties in a way the generator can safely use, so the new layer includes county-style routes such as `contra-costa-county` and `la-county`
- That is stable with the current generator rules and source-of-truth constraint, but it means the layer is broader than a strict city-only interpretation of “building permits”
- No additional code changes were required from this audit pass
