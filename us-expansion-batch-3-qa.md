# US Expansion Batch 3 QA

- total cities added: 20
- api_backed count: 0
- portal_only count: 20
- failed_review count: 0

## Audit checks

- Duplicate IDs/slugs: none found in `JURISDICTIONS`.
- Batch 3 metadata: normalized across all 20 cities with state abbreviations present on every Batch 3 entry.
- Fallback behavior: unchanged. Portal-only rendering still depends on `providerAvailable === false` in the existing Mission Control history UI.
- Shared verifier pattern: preserved. Batch 3 remains wired through [verify-us-expansion-shared.mjs](/workspaces/permitpulse-frontend/scripts/verify-us-expansion-shared.mjs) and [verify-us-expansion-batch-3.mjs](/workspaces/permitpulse-frontend/scripts/verify-us-expansion-batch-3.mjs).
- Notes parity: [us-expansion-batch-3-notes.md](/workspaces/permitpulse-frontend/us-expansion-batch-3-notes.md) matches the final Batch 3 catalog metadata.
- Regression check: Batch 1 and Batch 2 still complete on the shared verifier with `schema_issues=0`.

## Unresolved items

- Batch 3 is intentionally all `portal_only`. No new `api_backed` source was added because no additional public JSON feed was verified strongly enough to wire safely without guessing field mappings.
- Stockton remains a broader official permit-center route rather than a direct search portal. It is still an official city connector and was kept as `portal_only` with explicit notes instead of a speculative deeper endpoint.
- Live remote probe verification could not complete in the local shell because outbound fetches are blocked in this environment. The shared verifier reports those as `probe_warnings` rather than hard failures.
