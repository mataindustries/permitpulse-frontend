# PermitPulse

PermitPulse combines a static outreach site with a Cloudflare-hosted case workspace for evidence-backed permit intelligence and professional Permit Review Packet production.

## What’s live in this version

- **PermitPulse Stuck Project Desk (starting at $299)**: 48-hour public-record status packet for one stuck permit, utility, correction, or property-record issue.
- **Quick Address Screen ($49 pilot)**: lightweight first-pass address screen before deciding whether a full packet is needed.
- **Canonical Sample Permit Review Packet**: `dist/assets/docs/PermitPulse-Permit-Review-Packet-Sample.pdf`.
- **Mission Control**: the homepage introduces the current authenticated workspace and its end-to-end review flow.
- **Radar**: free tool entrypoint at `/radar/` (header “Free tools” should link here).
- **Help Guides**: LA permit help pages + internal links.
- **Sitemap**: `dist/sitemap.xml`

## Scope and limitations (important)

- Deliverables are based on **publicly available portal data** and **public records**.
- **Public-record lookup is conditional**: some documents may be restricted, require owner authorization, specific identifiers, appointments, or agency processing time.
- **Plan sets / blueprints require owner authorization** (not included without it).
- This is **research, organization, documentation, and next-step visibility support**, not legal, code, entitlement, architectural, engineering, insurance, filing, or agency advice.

## Repo structure

- `dist/` – production site (HTML/CSS/JS) served by hosting
  - `dist/index.html` – homepage
  - `dist/permit-due-diligence-los-angeles/index.html` – legacy Permit Review Plus page
  - `dist/assets/docs/PermitPulse-Permit-Review-Packet-Sample.pdf` – canonical fictional sample packet
  - `dist/sample-report/index.html` – compatibility redirect to the canonical packet
  - `dist/sitemap.xml` – sitemap

## Key routes

- `/` – Home
- `/permit-due-diligence-los-angeles/` – legacy Permit Review Plus page
- `/assets/docs/PermitPulse-Permit-Review-Packet-Sample.pdf` – Canonical sample packet
- `/sample-report/` – Legacy redirect to the canonical sample packet
- `/radar/` – Free tools / radar
- `/pricing/` – Pricing (if present)
- `/#contact` – Direct packet-walkthrough email CTA

## Payments and intake

- Stripe Payment Links may be hard-coded in legacy service pages.
- Intake forms use Formspree (or equivalent) endpoints configured in the relevant page/script.
- After changing Stripe links or endpoints, verify:
  - buttons open correct link
  - mobile layout is intact
  - GA/event tracking still fires (if enabled)

## Deploy

This site is intended to be deployed as static files (Cloudflare Pages or similar).

Typical flow:
1. Edit files in `dist/`
2. Commit to `main`
3. Hosting auto-builds / publishes

## Development

If you just edit static HTML/CSS in `dist/`, you can preview locally with any static server:

```bash
python3 -m http.server --directory dist 8080
```
