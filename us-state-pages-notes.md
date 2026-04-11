## US State Pages Notes

- Routes added:
  - `/permits/`
  - `/permits/[state]/`
  - `/permits/[state]/[city]`
  - `/permit-portal/[state]/[city]`
- Total state pages added: 24
- Total city pages added: 57
- Permit-portal alias routes added: 57
- Sitemap/meta changes:
  - Added `dist/sitemap-permits.xml` for the new permit directory routes
  - Updated `dist/sitemap.xml` to include the permits sitemap
  - Added page-level title, meta description, canonical tags, and matching open graph metadata for the new `/permits/...` pages
  - Added canonical plus `noindex,follow` metadata for `/permit-portal/...` alias routes
- Unresolved routing or SEO limitations:
  - Only enabled jurisdictions with a populated `state` value generate `/permits/...` pages
  - `/permit-portal/...` routes are aliases for internal linking and user navigation, not standalone index targets
  - Existing California launch pages under `/california/jurisdictions/...` are preserved as separate landing pages rather than being replaced by the new permit directory
  - Remote verification still reports probe warnings in this shell because outbound fetches are blocked
