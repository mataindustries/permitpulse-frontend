# US Building Permits Notes

## Routes added
- Added programmatic leaf pages at `/building-permits/[state]/[city]`
- Pages are generated from the same enabled catalog entries that currently generate `/permits/[state]/[city]`
- No changes were made to existing `/permits/[state]/[city]` canonical paths or `/permit-portal/[state]/[city]` alias behavior

## Total building-permits pages generated
- 57 pages generated from the current enabled jurisdiction catalog on 2026-04-11

## Canonical and indexing decision
- The new `/building-permits/[state]/[city]` pages are self-canonical and indexable
- Decision basis: the route intent, title/H1, meta description, intro framing, primary CTA wording, and internal-link targets are materially different from the main `/permits/[state]/[city]` pages while still staying fully catalog-backed
- The existing `/permit-portal/[state]/[city]` alias pages remain `noindex,follow` and canonical to `/permits/[state]/[city]`

## Sitemap changes
- Added `dist/sitemap-building-permits.xml` for indexable building-permits pages only
- Added `sitemap-building-permits.xml` to `dist/sitemap.xml`
- Left `sitemap-permits.xml` in place for the existing permit directory routes

## Internal linking changes
- Added a direct link from each `/permits/[state]/[city]` page to its matching `/building-permits/[state]/[city]` page
- Added a direct link from each `/building-permits/[state]/[city]` page back to its matching `/permits/[state]/[city]` page
- Added natural links from each building-permits page to Mission Control and the matching state permit directory page

## Unresolved duplication or SEO limitations
- The new building-permits pages still rely on the same catalog facts as the main permit pages, so differentiation is structural and metadata-driven rather than editorial
- The current shared catalog does not expose a dedicated municipality-type field, so the generated set includes county-style leaf routes that already exist in the main permit directory layer
- If search performance later suggests tighter separation is needed, the safest next refinement would be a catalog-backed jurisdiction-type flag rather than heuristic filtering in the generator
