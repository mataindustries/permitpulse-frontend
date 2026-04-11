# Instant Snapshot QA

## Route added
- `/instant-snapshot/`
- Pretty-route mapping present in `dist/_redirects` as `/instant-snapshot          /instant-snapshot/index.html       200`

## API endpoint added
- `POST /api/instant-snapshot`
- `OPTIONS /api/instant-snapshot`

## Input fields supported
- `address`
- `city`
- `project_description`
- `apn`
- `role`
- `voice_transcript`

## Output fields returned
- `project_summary`
- `likely_jurisdiction`
- `portal_url`
- `likely_permit_path`
- `missing_info`
- `risk_notes`
- `next_step`
- `confidence`
- `disclaimer`

## Smoke test summary
- Page audit: reviewed `dist/instant-snapshot/index.html`, `dist/assets/instant-snapshot.css`, and `dist/assets/instant-snapshot.js`
- Mobile-first layout check: form stack, CTA stack, hero cards, and result cards collapse to single-column behavior under the mobile breakpoint in CSS
- Client-state audit: empty, loading, error, and result states are all wired and toggled through `setView(...)`
- Validation tightened: required browser attributes added for `address`, `city`, and `project_description`
- Client fallback tightened: frontend now handles non-JSON API responses safely and shows a clearer error message
- API smoke test: exact Los Angeles match returned `200` with stable structured JSON, permit directory path, and portal URL
- API smoke test: unmatched city returned `200` with sensible fallback snapshot, no portal URL, and directional next-step guidance
- API smoke test: missing required fields returned `400` with `error: "missing_required_fields"`
- Permit directory linking tightened: result card now links to the exact matching `/permits/[state]/[city]/` route when the jurisdiction match comes from the shared catalog
- Disclaimer check: concise informational disclaimer is present both above the submit CTA and in the rendered result state
- CTA check: both paid CTAs render correctly in the result sidebar

## Unresolved items
- I did not run a full visual browser/device test, so the mobile review is code-level rather than screenshot-level
- Optional OpenAI refinement remains env-gated and was not exercised in this QA pass
- The API still emits the standard Node warning about `workers/pp-api/src/config/jurisdictions.js` being reparsed as an ES module during local smoke tests; this does not block runtime behavior for the feature itself
