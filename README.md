# PermitPulse

PermitPulse is ENM Ventures’ permit and property-record research brand. The public site is a static deployment in **dist/**; the separate **app/** directory is the Cloudflare-hosted internal case workspace.

## Current customer offer

The homepage runs the **Never Guess** campaign, the continuation of the film *The Maps Disagree*. See **docs/NEVER_GUESS_CAMPAIGN_LAUNCH.md**.

- Promise: **Every finding labeled. Every label cited.** (SUPPORTED / CONFLICT / UNKNOWN)
- Available now: **Parcel Research Brief**, $149 per property introductory or three for $299, City of Los Angeles first; elsewhere by scope confirmation
- Delivery target: **within 48 business hours** after scope and payment are confirmed
- Scoped conversations, no payment or address required: Permit & Clearance Triage, Plan-Set & Workflow Diagnostics
- Primary CTA: **Have a property? Send it.** Secondary: **Just Ask** (workflow inquiry, optional 15-minute discovery call request)

PermitPulse does not guarantee approval, completeness, code compliance, entitlement, ownership, access, or project feasibility and does not replace an architect, attorney, engineer, contractor, surveyor, title professional, or agency.

## Core routes

- **/** — Never Guess campaign homepage: the only address-research intake plus the no-address workflow inquiry
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

Run the homepage browser checks (needs Playwright with Chromium):

    npm run test:homepage

Place the locked film on the homepage (needs ffmpeg):

    npm run film:prepare -- /path/to/locked-master.mp4 --poster-at 14.2

Run the internal case-workspace checks:

    npm --prefix app run check

The public validator uses only Node built-ins. The internal app has its own lockfile and dependencies.

## Boundaries

Do not publish a source packet without current-source, privacy, inference, allegation, and link review. Do not place names, emails, phone numbers, addresses, permit numbers, free-text requests, private documents, or URL query strings in analytics or reusable playbooks.

The SGV Turf funnel is a separate brand and is not part of the PermitPulse offer or intake.

## Deployment

This repository pass does not deploy or publish. Use a hosting preview first, repeat the documented rendered and analytics checks, and approve production separately.
