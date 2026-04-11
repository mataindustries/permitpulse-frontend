# Instant Snapshot Notes

## Route added
- Added `https://getpermitpulse.com/instant-snapshot/`
- Added a direct pretty-route mapping in `dist/_redirects` to `dist/instant-snapshot/index.html`

## API endpoint added
- Added `POST /api/instant-snapshot`
- Added `OPTIONS /api/instant-snapshot` for CORS preflight support

## Fields collected
- property address
- city
- project description
- optional APN
- optional role
- optional voice transcript

## Output schema
- `project_summary`
- `likely_jurisdiction`
- `portal_url`
- `likely_permit_path[]`
- `missing_info[]`
- `risk_notes[]`
- `next_step`
- `confidence`
- `disclaimer`

## Known limitations
- Jurisdiction matching is catalog-driven and strongest when the city maps cleanly to an existing PermitPulse jurisdiction entry
- The first pass is still an intake brief, not a permit filing workflow or official jurisdiction advice
- Permit-path recommendations are heuristic unless an OpenAI API key is configured for optional structured refinement
- The current UI links to the matched `/permits/[state]/[city]/` page only when the jurisdiction match comes directly from the existing catalog

## Mocked or inferred behavior still to upgrade later
- `likely_permit_path`, `missing_info`, `risk_notes`, and `next_step` are currently heuristic PermitPulse inferences from the user input and matched jurisdiction metadata
- Optional LLM refinement is coded as an env-gated enhancement path and falls back to the deterministic heuristic brief when no OpenAI credentials are present
- Confidence scoring is inferred from match quality and project-detail completeness rather than live permit-history evidence
