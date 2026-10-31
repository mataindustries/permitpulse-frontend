# Never Guess campaign launch

Prepared: 2026-10-31. Updated with the released film the same day. Branch: `feat/never-guess-campaign-launch`.

The homepage is now the continuation of the picture-locked 28-second film **THE MAPS DISAGREE**: a film-led hero, the cited-research promise, proof, three inquiry paths, and two working intake forms. This is a conversion and branding pass. The research product, sample report, Case Integrity demo, legal pages, routes, and redirects are unchanged.

## What changed

| Area | Change |
| --- | --- |
| `dist/index.html` | New film-led homepage: hero, why it matters, how it works, proof, services, intake with two tabs, mobile CTA dock, film theater dialog. |
| `dist/assets/never-guess.css` | Homepage-only visual system sampled from the film (see *Film match*). Replaces the 64 KB shared stylesheet on the homepage only. |
| `dist/assets/never-guess.js` | Film theater, inquiry tabs, mobile dock. No network requests of its own. |
| `dist/assets/home-motion.css` | Existing brief-card animation recolored to the film palette. Timing and fallbacks unchanged. |
| `dist/assets/platform-home.js` | Success events also carry `inquiry_path` and `call_requested` (fixed values only). |
| `dist/assets/fonts/` | Self-hosted Inter variable subset (26 KB, OFL license included). |
| Logo, favicon, OG image | The film's lockup as one inline SVG symbol (header and footer); matching favicon; 1200×630 `permitpulse-og-the-maps-disagree.png` with the 8.5 s film frame. |
| `dist/assets/film/` | The released film, remuxed stream-for-stream, and its 8.5 s poster frame. |
| `dist/thank-you/` | No-JS return page now covers both research requests and workflow inquiries. |
| `dist/_headers` | Long cache for fonts; one-week cache for film files. |
| `scripts/prepare-film.mjs` | Places the locked film and poster frame; switches the hero to the film. |
| `scripts/e2e-homepage.mjs` | Browser checks for both forms, analytics privacy, tabs, dock, fallbacks, and the film player. |
| `scripts/validate-public-site.mjs` | New guardrails for messaging, service honesty, legal boundaries, forms, film, and performance budgets. |

## Message map

- Brand statement: **NEVER GUESS.** (H1, with "Cited parcel research for Los Angeles properties." in the same heading for search).
- Narrative: **THE MAPS DISAGREE.** (hero kicker, film title card, section 01).
- Promise: **Every finding labeled. Every label cited.**
- Evidence labels: **SUPPORTED / CONFLICT / UNKNOWN** with one line style each (solid copper, split terracotta with ≠, dashed and stopped short). CONFLICT chips are filled terracotta, as in the film.
- Primary CTA: **HAVE A PROPERTY? SEND IT.**
- Geography, verbatim in the hero and the intake: **City of Los Angeles first. / Anywhere else? Just Ask.** The offer card adds that properties outside the City are scope-confirmed by email before anything is agreed or paid.

## Film match

Sampled from the released master (BT.709 frames) and applied as tokens, without changing the layout:

| Element | Film | Site |
| --- | --- | --- |
| Logo | Dark hexagon, jade ring and top/bottom chevrons; "Permit" white, "Pulse" jade, Open Sans Bold, slightly tight | Same lockup redrawn as SVG paths from Open Sans Bold at −0.02em (ink width within 1 px of the film at 1080 px); no raster, no background box |
| Jade | `#35c58c`, identity only | `--brand-accent`, identity only |
| Grounds | Opening black `#000101`; end card slate `#0f1c22` | Page `#020303`; alternate sections, including the intake, in end-card slate |
| Headline type | Inter Bold/ExtraBold, normal width, mint-white `#f2fdf7` | Inter (self-hosted), weight 800, −0.035em, `#f2fdf7` |
| Labels | Monospace uppercase ("ILLUSTRATIVE EXAMPLE · FICTIONAL PARCEL") | Kickers and metadata in the system monospace stack |
| Amber | Rule under NEVER GUESS and brief border `#b37326`; lit parcel lines `#e09858` | Rules, borders, and evidence lines `#b37326`; amber text and the primary button `#e09858` (the darker tone is under 4.5:1 for small text on slate) |
| Conflict | Filled chip `#9c4b39` | Filled chips `#9c4b39`; conflict lines `#c0604a` for visibility on dark |
| End card | NEVER GUESS. with copper rule; HAVE A PROPERTY? SEND IT. | Hero H1 carries the same copper rule; the intake section repeats the end card on slate |

The visually hidden description on the film lists its on-screen text for screen readers.

## Services and honesty boundaries

1. **Parcel Evidence Research**: the only service marked *Available now*. $149 per property introductory, three for $299, unchanged.
2. **Permit & Clearance Triage**: *Scoped consultation*. No price, no product claims; "can't speed up agency review or promise an approval."
3. **Plan-Set & Workflow Diagnostics**: *Pilot inquiry*. "Custom work, scoped by conversation. Not an off-the-shelf product."

The page states independence from any agency or professional association, disclaims approvals, faster processing, and licensed professional services, and contains no roundtable anecdotes, AIA/LADBS attribution, or endorsement language. The validator fails the build if that changes.

## Lead paths

Both forms post to the established Formspree form `mbdwdklj` and are told apart by `lead_type` and subject:

| Form | `lead_type` | Subject | Required | Payment |
| --- | --- | --- | --- | --- |
| Parcel research (`#research-intake`) | `permit_deep_research` | PermitPulse Permit Deep Research Request | address, purpose, count, name, email | Confirmed by email after scope |
| Workflow inquiry (`#inquire`) | `workflow_inquiry` | PermitPulse Workflow Inquiry (no payment) | path, description, name, email | None |

Both include an optional **15-minute discovery call** request checkbox. It is a request answered by email; there is no booking calendar. Service-card CTAs open the workflow tab with the path preselected. Without JavaScript, both forms render stacked and submit normally to Formspree, which returns visitors to `/thank-you/`.

## Analytics (GA4 `G-0S8S6156CV`)

No event contains names, emails, addresses, or free text. The browser test fills every field with marker strings and fails if any appear in `dataLayer`.

| Event | When | Parameters |
| --- | --- | --- |
| `pp_research_cta_click` | Any "Send a property" CTA | `cta_location`, `destination` |
| `pp_workflow_cta_click` | Any workflow / Just Ask CTA | `cta_location`, `destination` |
| `research_intake_start` / `workflow_inquiry_start` | First interaction with a form | `form_type` |
| `research_intake_success` | Formspree returned OK | `form_type`, `offer` (one/three), `call_requested` (yes/no) |
| `workflow_inquiry_success` | Formspree returned OK | `form_type`, `inquiry_path`, `call_requested` |
| `generate_lead` | Any successful Formspree post | `form_name`, `lead_type` |
| `pp_inquiry_tab` | Visitor switches intake tab | `tab` |
| `pp_film_open` / `pp_film_play` | Theater opened / playback started | `film_source` (hero_poster / hero_button) |
| `pp_film_progress` | 25, 50, 75 percent, once each | `percent` |
| `pp_film_complete` | Film ended | none |
| `pp_film_close` | Theater closed | `percent_watched` (0/25/50/75/100) |
| `pp_film_error` | Film failed to load | none |

In GA4, mark `research_intake_success` and `workflow_inquiry_success` as key events, and register `cta_location`, `inquiry_path`, `call_requested`, `offer`, `film_source`, `percent`, and `percent_watched` as event-scoped custom dimensions.

## The film

Placed from the GitHub release `never-guess-film-master` (asset `PermitPulse_TheMapsDisagree_28s_1080x1920_60fps.mp4`, SHA-256 `9650f262c7c24677d5bf61d75f9aa13d77ad3e3a6767473c1a8d177ef0fdcfee`, verified on download):

```bash
npm run film:prepare -- PermitPulse_TheMapsDisagree_28s_1080x1920_60fps.mp4 --poster-at 8.5
```

- Master: H.264 High 5.0, 1080×1920, 60 fps, AAC-LC 48 kHz stereo, 28.000 s, 20.1 MiB, index already at the front.
- Result: remuxed with no re-encode. Video and audio packet MD5s are identical to the master (`4982a47e…` / `2843f469…`). 20.1 MiB, under the 25 MiB Pages limit.
- Poster: the 8.5 s frame (THE MAPS DISAGREE. over the model), matching the YouTube thumbnail; 720 px WebP, 49 KB.

To replace it later, run the same command with the new master. How the script behaves:

- An H.264/AAC master up to 24 MiB is **remuxed stream-for-stream**: no re-encode, only the index moves to the front for fast start.
- Anything else is encoded to H.264 High/AAC at the **same 1080×1920 frame size and 60 fps**, stepping quality down only until it fits under Cloudflare Pages' 25 MiB file limit. Nothing is cut, scaled, graded, or remixed.
- The script verifies frame size, frame rate, duration, and audio against the master, writes a 720 px WebP poster from `--poster-at` (pick the frame that should sell the click), and only then sets `data-film-ready="true"`.
- `npm run film:prepare -- --disable` returns to the title card without deleting files.
- If a future cut adds narration, add a WebVTT captions track.

Playback is poster-first: nothing from the MP4 loads until the visitor presses play. The film then opens in a full-screen theater with sound, and ends on a card offering "Send a property" and "Project stuck? Just Ask". Save-Data visitors skip the poster image.

## QA results (this branch)

With the released film placed:

- `npm run check`: 523 checks pass, 0 fail.
- `npm run test:homepage`: 13/13 pass, including poster-first loading (no MP4 bytes before play), playback, progress events, the full 28 s at 1080×1920 with the soundtrack decoding, the end card into the intake, and Escape with focus return.
- No horizontal scroll at 320, 360, 412, 768, 1024, 1280, and 1920 px.
- Lighthouse, local static server: mobile Performance 97 (FCP 1.4 s, LCP 2.3 s, TBT 100 ms, CLS 0.005), desktop 100; Accessibility 100; Best Practices 100; SEO 100. Remaining flags (compression, cache TTLs) come from the local server and are handled by Cloudflare.
- Homepage weight on load: 213 KiB including the 49 KB poster and 26 KB font; the 20 MiB film loads only on play.

## Deploy

The site is static; Cloudflare Pages serves `dist/` with no build step (`_headers` and `_redirects` live there).

1. Run `npm run check` and `npm run test:homepage` (the film is already placed on this branch).
2. **Preview**: push the branch. If the Pages project is connected to GitHub with preview deployments on, Cloudflare publishes a preview at `https://<branch-alias>.<project>.pages.dev`. Without Git integration:
   ```bash
   npx wrangler pages deploy dist --project-name <pages-project> --branch feat-never-guess-campaign-launch
   ```
3. **On the preview**, on a real Android phone: play the film with sound, submit one clearly labeled test through each form and confirm both arrive in the Formspree inbox with the right subject, and confirm the events above in GA4 DebugView with no personal data.
4. **Production**: merge the pull request into the production branch (or `npx wrangler pages deploy dist --project-name <pages-project> --branch main`).
5. **Rollback**: Cloudflare dashboard, Pages project, Deployments, pick the previous production deployment, Rollback.

## Before production

- [x] Released film placed with `npm run film:prepare` (remux, poster at 8.5 s).
- [x] Logo, grounds, type, and accents matched to the film; wordmark accent is the film's jade.
- [ ] Live Formspree test for both forms, received and replied to. This sandbox could not reach Formspree, so delivery is verified with an intercepted endpoint only.
- [ ] GA4 key events and custom dimensions registered.
- [ ] Preview reviewed on Android Chrome and iOS Safari.
