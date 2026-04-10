# US Expansion Batch 1 QA

- total cities added: 20
- api_backed count: 2
- portal_only count: 18
- failed_review count: 0

## Audit checks

- Duplicate Batch 1 jurisdiction IDs: none
- Missing Batch 1 jurisdiction IDs: none
- Malformed Batch 1 portal URLs: none
- Verified api_backed entries:
  - San Jose: official portal `200`, public CKAN JSON probe `200`
  - San Francisco: official dataset page `200`, public Socrata JSON probe `200`
- Existing California jurisdiction spot-check: Los Angeles, LA County, Sacramento, Santa Monica, Culver City, Beverly Hills, San Diego County, San Jose, and San Francisco all still exist in the shared catalog
- Fallback behavior: all 18 portal-only Batch 1 entries remain provider-free, so they continue to use the existing portal fallback card path

## Unresolved items

- Indianapolis uses the official `maps.indy.gov` routing surface instead of a permit-native public search portal. It is official and reachable, but still a weaker permit entry point than the other portal-only cities.
