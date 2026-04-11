# US Expansion Verification Status

- Batch 1 count: 20
- Batch 2 count: 20
- Batch 3 count: 20
- total US expansion count so far: 58 unique jurisdictions

## Known verifier limitations

- Remote probes depend on outbound network access. In restricted environments, blocked fetches are reported as `probe_warnings` rather than hard verification failures.
- Schema and catalog checks still run locally even when remote probes cannot complete.
- Batch counts are batch-specific. Sacramento appears in both batch definitions for Batch 1 and Batch 2, and Riverside appears in both Batch 1 and Batch 3, so the combined unique total is lower than `20 + 20 + 20`.

## Unresolved catalog issues

- `long_beach` remains present in Batch 1 but is currently `enabled: false` with `reason: "source not wired yet"`.
- Several older California-era entries still omit `state` metadata (`la_city`, `la_county`, `beverly_hills`, `culver_city`, `san_francisco`, `long_beach`, `santa_monica`). This verifier pass did not change jurisdiction content outside real inconsistencies already fixed for Sacramento.
