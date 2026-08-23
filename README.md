# PermitPulse

PermitPulse is ENM Ventures’ permit and property-record research brand. The public site is a static deployment in **dist/**; the separate **app/** directory is the Cloudflare-hosted internal case workspace.

## Current customer offer

**Permit Deep Research** is a manually reviewed, source-backed brief for California residential contractors and small builders evaluating an address before they bid, buy, or build.

- Promise: **Give us the address. We follow the paper trail.**
- Founding offer: **three California addresses for $299 total**
- Delivery target: **within 48 business hours per address**, after scope confirmation and receipt of required information
- Transaction path: request a scope review; payment is arranged only after a request is accepted
- Primary CTA: **Research an address**
- Secondary CTA: **See a redacted example**

PermitPulse does not guarantee approval, completeness, code compliance, entitlement, ownership, access, or project feasibility and does not replace an architect, attorney, engineer, contractor, surveyor, title professional, or agency.

## Core routes

- **/** — Permit Deep Research offer and the only address-research intake
- **/sample-report/** — anonymized reconstruction of actual completed research
- **/resources/** — Permit Drops, Paper Trail Playbooks, and Permit Nightmares
- **/about/** — ENM Ventures / PermitPulse / SGV Turf brand architecture and operator model
- **/legal/** — terms, privacy, reusable-learning rules, and editorial standards
- **/assets/docs/PermitPulse-Permit-Review-Packet-Sample.pdf** — fictional format sample, linked only with an explicit disclosure

Legacy offer, snapshot, and dashboard routes redirect to the current offer or source-backed field notes.

## Strategy and operations

- **docs/PERMIT_DEEP_RESEARCH_POSITIONING.md** — decision record and message house
- **docs/PAPER_TRAIL_LOOP.md** — privacy-safe learning and reverification loop
- **docs/ORGANIC_CONTENT_SYSTEM.md** — three-lane system and four-week plan
- **docs/PERMIT_NIGHTMARES_STANDARD.md** — editorial and legal-safety rules
- **docs/content-packets/** — reusable template and three starter source packets
- **docs/LAUNCH_READINESS.md** — exact remaining manual launch tasks

## Development

Preview the static site:

    python3 -m http.server --directory dist 8080

Run public-site validation:

    npm run check

Run the internal case-workspace checks:

    npm --prefix app run check

The public validator uses only Node built-ins. The internal app has its own lockfile and dependencies.

## Boundaries

Do not publish a source packet without current-source, privacy, inference, allegation, and link review. Do not place names, emails, phone numbers, addresses, permit numbers, free-text requests, private documents, or URL query strings in analytics or reusable playbooks.

The SGV Turf funnel is a separate brand and is not part of the PermitPulse offer or intake.

## Deployment

This repository pass does not deploy or publish. Use a hosting preview first, repeat the documented rendered and analytics checks, and approve production separately.
