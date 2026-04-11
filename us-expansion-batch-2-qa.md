# US Expansion Batch 2 QA

- total cities added: 20
- api_backed count: 1
- portal_only count: 19
- failed_review count: 0

## Audit checks

- Duplicate IDs/slugs: none found in `JURISDICTIONS`.
- Batch 2 metadata: normalized for all 20 cities, including state abbreviations on every Batch 2 entry.
- Sacramento: kept as the only Batch 2 `api_backed` city, with `state: "CA"` restored in code and platform normalized to `Open Data (ArcGIS)`.
- Portal-only fallback: unchanged. The existing fallback card still triggers from `providerAvailable === false` in the Mission Control history UI.
- Notes parity: [us-expansion-batch-2-notes.md](/workspaces/permitpulse-frontend/us-expansion-batch-2-notes.md) matches the final catalog entries and Sacramento API metadata.

## Unresolved items

- Omaha remains `portal_only`. The connector was tightened to an official Omaha ONEBiz regulatory permitting page, but the city still does not expose a single clear public planning/building search portal comparable to the other Batch 2 cities.
- Live network verification could not be re-run from the local shell because outbound fetches are blocked in this environment. The catalog was tightened using official-site review, and Sacramento remains the only Batch 2 entry with a verified public JSON source in code.
- Batch 1 verifier mismatch is pre-existing: [verify-us-expansion-batch-1.mjs](/workspaces/permitpulse-frontend/scripts/verify-us-expansion-batch-1.mjs) still references many IDs that are not present in the current jurisdiction catalog snapshot. This audit did not expand or refactor Batch 1.
