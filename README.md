# PermitPulse (Beta)

PermitPulse is a lightweight, static front-end for LA-area permit due diligence and permit intel.
This repo ships the marketing site + service pages (Dossier, Radar) and conversion flows (Stripe + intake).

## What’s live in this version

- **Permit Due Diligence Dossier ($499)**: portal-based timeline/status/scope/risk summary for 1 address / 1 permit (when public).
- **Sample Dossier (redacted)**: example output format at `/sample-dossier/`.
- **Radar**: free tool entrypoint at `/radar/` (header “Free tools” should link here).
- **Help Guides**: LA permit help pages + internal links.
- **Sitemap**: `dist/sitemap.xml`

## Scope and limitations (important)

- Deliverables are based on **publicly available portal data** and **public records**.
- **Public-record lookup is conditional**: some documents may be restricted, require owner authorization, specific identifiers, appointments, or agency processing time.
- **Plan sets / blueprints require owner authorization** (not included without it).
- This is **research + document retrieval support**, not legal advice.

## Repo structure

- `dist/` – production site (HTML/CSS/JS) served by hosting
  - `dist/index.html` – homepage
    - `dist/permit-due-diligence-los-angeles/index.html` – Dossier landing page
      - `dist/sample-dossier/index.html` – redacted sample
        - `dist/sitemap.xml` – sitemap

        ## Key routes

        - `/` – Home
        - `/permit-due-diligence-los-angeles/` – Dossier
        - `/sample-dossier/` – Redacted sample dossier
        - `/radar/` – Free tools / radar
        - `/pricing/` – Pricing (if present)
        - `/book` or `/booking.html` – Booking / intake (if present)

        ## Payments and intake

        - Stripe Payment Links are hard-coded in the service pages.
        - Intake form uses Formspree (or equivalent) endpoint configured in the relevant page/script.
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
