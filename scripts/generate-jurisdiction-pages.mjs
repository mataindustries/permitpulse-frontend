import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { JURISDICTIONS } from '../workers/pp-api/src/config/jurisdictions.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, '..');
const DIST_DIR = path.join(ROOT_DIR, 'dist');
const HUB_DIR = path.join(DIST_DIR, 'california', 'jurisdictions');
const SITE_URL = 'https://getpermitpulse.com';
const STRIPE_URL = 'https://buy.stripe.com/3cI3cw1qT9aP6Jx2Fs1wY0e';
const LASTMOD = '2026-04-18';
const OG_IMAGE = `${SITE_URL}/img/permitpulse-og-los-angeles-permit-radar.webp`;

const JURISDICTION_SOURCE = new Map(
  JURISDICTIONS.map((entry) => [entry.id, entry]),
);

const LAUNCH_JURISDICTIONS = [
  {
    slug: 'los-angeles',
    jurisdictionId: 'la_city',
    name: 'Los Angeles',
    title: 'Los Angeles Permit History + Risk Report | PermitPulse',
    h1: 'Los Angeles permit history and risk report',
    description:
      'Check Los Angeles permit history, official LADBS records, and PermitPulse coverage for fast due diligence before a bid, purchase, or submission.',
    intro:
      'Los Angeles permit research usually starts in LADBS, but the useful details still end up scattered across status pages, permit reports, and raw record language. This page gives contractors, owners, and diligence teams a cleaner starting point before they escalate to a full Permit History + Risk Report.',
    summary:
      'City permit coverage for LADBS addresses, permit numbers, valuation, and high-signal scope language.',
    officialPortalUrl: 'https://www.ladbs.org/services/check-status/online-building-records',
    officialPortalLabel: 'Open LADBS building records',
    officialPortalNote:
      'Use the LADBS record tools for city permit lookups, then move to a report when the portal leaves open questions.',
    focusPoints: [
      'Match the city permit number, property address, and permit type before relying on the record.',
      'Spot recent issue activity, valuation, and work descriptions that can change a bid or diligence call.',
      'Escalate faster when scope language suggests additions, reroofs, solar, tenant improvements, or incomplete close-out.',
    ],
    coverageNotes: [
      'PermitPulse has live search coverage for Los Angeles permit records through the city public dataset.',
      'This lane is strongest for fast checks on permit number, address, issue date, permit type, and valuation.',
      'Use a Permit History + Risk Report when you need a clearer timeline, scope summary, or caveats documented in one place.',
    ],
    related: ['los-angeles-county', 'beverly-hills', 'pasadena'],
  },
  {
    slug: 'los-angeles-county',
    jurisdictionId: 'la_county',
    name: 'Los Angeles County',
    title: 'Los Angeles County Permit History + Risk Report | PermitPulse',
    h1: 'Los Angeles County permit history and risk report',
    description:
      'Use PermitPulse to route Los Angeles County permit searches correctly, review EPIC-LA case history, and request a permit history and risk report for county-served addresses.',
    intro:
      'County routing is where many Southern California permit searches go sideways. If the address is in unincorporated Los Angeles County or inside a county-served pocket, EPIC-LA is the lane that matters and city-only assumptions can waste real time.',
    summary:
      'County-served address routing, EPIC-LA case history, and support for mixed city-versus-county permit questions.',
    officialPortalUrl: 'https://epicla.lacounty.gov/',
    officialPortalLabel: 'Open EPIC-LA case history',
    officialPortalNote:
      'EPIC-LA is the official county portal for permit case lookup, routing, and status review.',
    focusPoints: [
      'Confirm whether the property is county served before your team starts working the wrong jurisdiction.',
      'Review case history, routing, and status inside EPIC-LA for unincorporated or county-managed areas.',
      'Escalate when a project appears to touch both city and county review paths or older records are incomplete.',
    ],
    coverageNotes: [
      'PermitPulse currently treats Los Angeles County as a portal-assisted jurisdiction rather than a live public feed.',
      'This page is designed for county-served addresses, mixed-routing questions, and cases where city assumptions are risky.',
      'Request a Permit History + Risk Report when county scope, status gaps, or historical records need manual interpretation.',
    ],
    related: ['los-angeles', 'glendale', 'long-beach'],
  },
  {
    slug: 'sacramento',
    jurisdictionId: 'sacramento',
    name: 'Sacramento',
    title: 'Sacramento Permit History + Risk Report | PermitPulse',
    h1: 'Sacramento permit history and risk report',
    description:
      'Review Sacramento permit history, public permit portal records, and PermitPulse coverage for issued permits, valuation, and scope signals before you move on a project.',
    intro:
      'Sacramento permit searches often need a fast answer on whether a job is already issued, still routing through review, or carrying enough value to deserve deeper diligence. PermitPulse turns the raw city record into a cleaner first read before you decide how much more work is warranted.',
    summary:
      'City of Sacramento permit coverage for issued records, valuation checks, and higher-value project triage.',
    officialPortalUrl: 'https://aca.accela.com/sacramento/Default.aspx',
    officialPortalLabel: 'Open Sacramento public permit portal',
    officialPortalNote:
      'The Sacramento public permit portal is the official intake and permit lookup lane for building submissions and plan review.',
    focusPoints: [
      'Check whether a Sacramento project is already issued, recently updated, or still better handled through direct portal review.',
      'Use valuation and work descriptions to separate routine repairs from projects that deserve deeper diligence.',
      'Catch missing context early when an address needs more than a one-screen permit lookup.',
    ],
    coverageNotes: [
      'PermitPulse has live search coverage for Sacramento issued permit records through the city dataset.',
      'This coverage is useful when you need status date, valuation, permit type, and work description quickly.',
      'Move to a Permit History + Risk Report when entitlement context, sequencing, or record caveats matter to the decision.',
    ],
    related: ['san-diego', 'long-beach', 'los-angeles'],
  },
  {
    slug: 'santa-monica',
    jurisdictionId: 'santa_monica',
    name: 'Santa Monica',
    title: 'Santa Monica Permit Activity + Demolition Watch | PermitPulse',
    h1: 'Live Santa Monica permit activity and demolition watch',
    description:
      'Track Santa Monica permit activity, address-level permit history context, and under-review demolition plan checks with PermitPulse and the city public datasets.',
    intro:
      'PermitPulse now supports Santa Monica through the city public permit activity feed and a separate demolition plan-check feed. Use this page to check recent permit activity, scan address-level history context, and watch demolition-related records that are still under review.',
    summary:
      'Official Santa Monica public-data coverage for live permit activity, address research, radar visibility, and demolition-watch signals.',
    officialPortalUrl: 'https://epermit.smgov.net/CitizenAccess/Default.aspx',
    officialPortalLabel: 'Open Santa Monica Citizen Access',
    officialPortalNote:
      'Citizen Access remains the official Santa Monica source for direct record review, applications, and status confirmation when a permit needs source verification.',
    focusPoints: [
      'Check recent permit activity, valuation, and address-level context before treating a project record as complete.',
      'Use demolition watch to spot under-review demolition filings early when teardown risk, neighborhood change, or site timing matters.',
      'Verify older demolition records directly with the city when status or record age matters because some pre-2017 applications may still appear active.',
    ],
    coverageNotes: [
      'PermitPulse has live support for Santa Monica permit activity through the official city dataset and can surface records in live, history, and radar workflows.',
      'PermitPulse also supports a Santa Monica demolition-watch feed for under-review demolition plan checks. Treat it as early-signal coverage, not final issued demolition permit data.',
      'Santa Monica field depth is useful for permit number, address, dates, valuation, and classification, but record completeness can still vary. Verify directly with the city when exact status or demolition record age matters.',
    ],
    related: ['culver-city', 'beverly-hills', 'los-angeles'],
  },
  {
    slug: 'culver-city',
    jurisdictionId: 'culver_city',
    name: 'Culver City',
    title: 'Culver City Permit History + Risk Report | PermitPulse',
    h1: 'Culver City permit history and risk report',
    description:
      'Review Culver City permit history, official permit portal records, and PermitPulse coverage for remodels, MEP work, and address-level permit diligence.',
    intro:
      'Culver City records can move quickly from a straightforward permit number to a more complicated story about status, trade scope, and whether the work is actually complete. PermitPulse gives you a better read on that record before you sink time into a manual file chase.',
    summary:
      'Culver City permit coverage for building and MEP records, status review, and permit-history triage.',
    officialPortalUrl: 'https://aca-prod.accela.com/CULVERCITY/Default.aspx',
    officialPortalLabel: 'Open Culver City permit portal',
    officialPortalNote:
      'Culver City uses an online permit portal for applications, permit status, inspection status, and permit history search.',
    focusPoints: [
      'Review building and MEP permit activity tied to the same address before scoping the next move.',
      'Check status wording and record timing for signs that a permit is active, recent, or likely incomplete.',
      'Escalate when the portal record is thin and the project still matters operationally or financially.',
    ],
    coverageNotes: [
      'PermitPulse has live search coverage for Culver City permit records through the city public data service.',
      'This coverage is especially useful for address lookups, record status, and work descriptions across multiple trades.',
      'Use a Permit History + Risk Report when a project involves multiple records, vague descriptions, or diligence-sensitive timing.',
    ],
    related: ['santa-monica', 'beverly-hills', 'los-angeles'],
  },
  {
    slug: 'beverly-hills',
    jurisdictionId: 'beverly_hills',
    name: 'Beverly Hills',
    title: 'Beverly Hills Permit History + Risk Report | PermitPulse',
    h1: 'Beverly Hills permit history and risk report',
    description:
      'Use PermitPulse to review Beverly Hills permit history, official permit application records, and risk signals before a high-touch remodel, reroof, or commercial job moves forward.',
    intro:
      'Beverly Hills projects often carry more design scrutiny, more visible frontage work, and less tolerance for permit ambiguity than a routine city job. This page helps you get from raw permit records to a tighter read on what deserves another look.',
    summary:
      'Beverly Hills permit coverage for issued permit records, valuation, and scope signals on higher-visibility projects.',
    officialPortalUrl: 'https://cs.beverlyhills.org/csforms/permitapps/',
    officialPortalLabel: 'Open Beverly Hills permit application portal',
    officialPortalNote:
      'Beverly Hills runs online plan review and permit application through the Community Development portal.',
    focusPoints: [
      'Check the permit description and valuation before assuming a visible project is low-risk or routine.',
      'Use address-level review to spot public-right-of-way, mechanical, or remodel work attached to the same property.',
      'Escalate when the project profile suggests more permitting history than the first record reveals.',
    ],
    coverageNotes: [
      'PermitPulse has live search coverage for Beverly Hills permit records through the city public dataset.',
      'The official city application portal is still the right first stop when you need to work directly from the jurisdiction source.',
      'Request a Permit History + Risk Report when the property or project visibility makes record ambiguity expensive.',
    ],
    related: ['los-angeles', 'santa-monica', 'culver-city'],
  },
  {
    slug: 'pasadena',
    jurisdictionId: 'pasadena',
    name: 'Pasadena',
    title: 'Pasadena Permit Activity + History | PermitPulse',
    h1: 'Pasadena live permit activity and permit history',
    description:
      'Track Pasadena permit activity, search address-level permit history, and use PermitPulse for radar and research workflows backed by the city public feed.',
    intro:
      'PermitPulse now supports Pasadena through the city public permit activity feed, so recent activity, address research, and permit history context are available without treating Pasadena like a placeholder. Field depth is still lighter than LADBS, which makes this lane strong for activity and research, not valuation-heavy or status-heavy claims.',
    summary:
      'Live Pasadena permit activity with address-level history context, radar visibility, and clear field-coverage limits.',
    officialPortalUrl: 'https://mypermits.cityofpasadena.net/',
    officialPortalLabel: 'Open Pasadena permit portal',
    officialPortalNote:
      'Use the city permit portal when you need the jurisdiction record view. PermitPulse also surfaces Pasadena public permit activity for live activity checks and address research.',
    focusPoints: [
      'Check recent Pasadena activity and address-level permit history before you assume a project is quiet.',
      'Use PermitPulse for live search, radar visibility, and property research when you need a faster read on recent city activity.',
      'Treat valuation, issued date, and permit status as limited Pasadena feed fields, and verify them directly with the city when they matter.',
    ],
    coverageNotes: [
      'PermitPulse now supports Pasadena through the city public permit activity feed.',
      'Pasadena is useful for live activity, radar visibility, and address-level permit history context.',
      'Coverage note: the public feed does not currently publish valuation, issued date, or a reliable permit status field, so Pasadena is not yet a parity match for LADBS.',
    ],
    related: ['glendale', 'los-angeles', 'los-angeles-county'],
  },
  {
    slug: 'glendale',
    jurisdictionId: null,
    name: 'Glendale',
    title: 'Glendale Permit History + Risk Report | PermitPulse',
    h1: 'Glendale permit history and risk report',
    description:
      'Use the Glendale permit portal, review PermitPulse coverage notes, and request a permit history and risk report for projects that need a cleaner jurisdiction read.',
    intro:
      'Glendale permit checks usually need a fast answer on record status, scope, and whether the visible work lines up with what the city actually has on file. This page keeps the workflow simple: start in the official portal, then move to a report when the project needs more than a raw lookup.',
    summary:
      'Portal-assisted Glendale coverage for permit routing, status checks, and report requests tied to a specific address.',
    officialPortalUrl: 'https://glendaleca-energovweb.tylerhost.net/apps/SelfService#/home',
    officialPortalLabel: 'Open Glendale self-service portal',
    officialPortalNote:
      'Glendale uses the city self-service portal for online permit access and customer-facing permit tasks.',
    focusPoints: [
      'Check permit status and project routing before your team assumes the file is straightforward.',
      'Use the official portal to anchor permit research for remodels, equipment work, and property-level diligence.',
      'Escalate when the visible scope looks bigger than the public-facing permit trail suggests.',
    ],
    coverageNotes: [
      'PermitPulse currently treats Glendale as a portal-assisted jurisdiction for launch.',
      'This page is built for teams that need the official portal link plus a direct route into a Permit History + Risk Report.',
      'Use a report when address-level permit questions need manual review, timeline cleanup, or risk framing.',
    ],
    related: ['pasadena', 'los-angeles', 'los-angeles-county'],
  },
  {
    slug: 'long-beach',
    jurisdictionId: 'long_beach',
    name: 'Long Beach',
    title: 'Long Beach Permit History + Risk Report | PermitPulse',
    h1: 'Long Beach permit history and risk report',
    description:
      'Review Long Beach permit portal access, PermitPulse coverage notes, and request a permit history and risk report for residential or commercial project due diligence.',
    intro:
      'Long Beach projects range from simple online reroof permits to bigger multifamily, coastal, and commercial files that need more context than one portal screen provides. This page gives you the official city system and a clean handoff into PermitPulse when the record matters.',
    summary:
      'Long Beach permit coverage for portal-first research, online permitting workflows, and report requests.',
    officialPortalUrl: 'https://permitslicenses.longbeach.gov/',
    officialPortalLabel: 'Open Long Beach permitting and licensing portal',
    officialPortalNote:
      'LB Services is the City of Long Beach online permit system for permit applications, search, and licensing workflows.',
    focusPoints: [
      'Use the official city system to anchor permit research before you trust secondhand project information.',
      'Separate simple online permit activity from larger projects that deserve a cleaner permit history read.',
      'Escalate when a coastal, multifamily, or commercial file has more risk than the portal summary reveals.',
    ],
    coverageNotes: [
      'PermitPulse has Long Beach jurisdiction wiring staged, but the public launch page currently routes through the official city portal first.',
      'This page is designed to capture address-level demand while keeping the user on an official Long Beach permit lane.',
      'Request a Permit History + Risk Report when the project is important enough that portal-only review is not enough.',
    ],
    related: ['san-diego', 'los-angeles-county', 'los-angeles'],
  },
  {
    slug: 'san-diego',
    jurisdictionId: null,
    name: 'San Diego',
    title: 'San Diego Permit History + Risk Report | PermitPulse',
    h1: 'San Diego permit history and risk report',
    description:
      'Use the City of San Diego permit portal, review PermitPulse coverage notes, and request a permit history and risk report when a San Diego address needs deeper review.',
    intro:
      'San Diego permit research can split across city systems depending on the record type, timing, and workflow. This page is built to keep the search practical: start with the official city approvals portal, then move to a report if the address still carries open permit risk.',
    summary:
      'Portal-assisted San Diego coverage for city permit lookup, record triage, and report requests.',
    officialPortalUrl: 'https://opendsd.sandiego.gov/web/approvals/',
    officialPortalLabel: 'Open San Diego OpenDSD approvals portal',
    officialPortalNote:
      'OpenDSD is the City of San Diego online approvals and permit lookup lane for city-served project records.',
    focusPoints: [
      'Start with the city approvals portal to confirm whether the project record is present and readable.',
      'Use PermitPulse when multiple record types or unclear scope make the city trail harder to interpret.',
      'Escalate when a purchase, underwriting, or bid decision depends on a cleaner permit-risk readout.',
    ],
    coverageNotes: [
      'PermitPulse currently treats San Diego city coverage as portal-assisted on the public launch pages.',
      'This page is intended for city-served project review, not county-only routing or non-city systems.',
      'Use a Permit History + Risk Report when the address matters and the official portal leaves too many open questions.',
    ],
    related: ['long-beach', 'sacramento', 'los-angeles'],
  },
];

const CSS = `
:root {
  --bg: #050505;
  --bg-soft: #09090a;
  --card-bg: #0f0f11;
  --card-border: #222;
  --text-main: #ededed;
  --text-muted: #8b8b92;
  --accent-orange: #ff4400;
  --accent-blue: #2952ff;
  --accent-green: #7dd3a5;
  --accent-yellow: #f2c14f;
  --font-sans: 'Inter', system-ui, -apple-system, sans-serif;
  --font-mono: 'JetBrains Mono', 'Courier New', monospace;
  --ease: cubic-bezier(0.23, 1, 0.32, 1);
}

* {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

html {
  scroll-behavior: smooth;
}

body {
  background:
    radial-gradient(circle at top right, rgba(41, 82, 255, 0.12), transparent 28%),
    radial-gradient(circle at left bottom, rgba(255, 68, 0, 0.1), transparent 26%),
    var(--bg);
  color: var(--text-main);
  font-family: var(--font-sans);
  line-height: 1.45;
  -webkit-font-smoothing: antialiased;
  overflow-x: hidden;
  padding-bottom: 86px;
}

a {
  color: inherit;
  text-decoration: none;
}

h1, h2, h3 {
  letter-spacing: -0.04em;
  font-weight: 600;
}

h1 {
  font-size: clamp(2.4rem, 8vw, 4.9rem);
  line-height: 0.94;
}

h2 {
  font-size: clamp(1.6rem, 4vw, 2.65rem);
  line-height: 1;
}

p, li {
  color: var(--text-main);
}

ul {
  padding-left: 20px;
}

li + li {
  margin-top: 10px;
}

.wrap {
  max-width: 1080px;
  margin: 0 auto;
  padding: 0 20px;
}

.section {
  padding: 80px 0;
  border-bottom: 1px solid #111;
}

.grid {
  display: grid;
  gap: 20px;
}

.grid-2 {
  grid-template-columns: minmax(0, 1.2fr) minmax(280px, 0.8fr);
}

.grid-3 {
  grid-template-columns: repeat(3, minmax(0, 1fr));
}

.grid-4 {
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.card {
  background: var(--card-bg);
  border: 1px solid var(--card-border);
  border-radius: 18px;
  padding: 24px;
}

.card.soft {
  background: linear-gradient(180deg, rgba(255,255,255,0.03), rgba(255,255,255,0.01));
}

.badge {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 6px 10px;
  border: 1px solid rgba(255, 68, 0, 0.45);
  border-radius: 999px;
  color: var(--accent-orange);
  font-size: 12px;
  text-transform: uppercase;
  letter-spacing: 0.12em;
  font-family: var(--font-mono);
}

.pill {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  border-radius: 999px;
  padding: 7px 12px;
  font-size: 12px;
  font-family: var(--font-mono);
  text-transform: uppercase;
  letter-spacing: 0.1em;
}

.pill.live {
  background: rgba(125, 211, 165, 0.12);
  border: 1px solid rgba(125, 211, 165, 0.28);
  color: var(--accent-green);
}

.pill.portal {
  background: rgba(242, 193, 79, 0.1);
  border: 1px solid rgba(242, 193, 79, 0.24);
  color: var(--accent-yellow);
}

.hero {
  padding-top: 165px;
  padding-bottom: 56px;
}

.hero-copy {
  display: grid;
  gap: 18px;
  max-width: 760px;
}

.lead {
  font-size: clamp(1rem, 2vw, 1.22rem);
  color: var(--text-muted);
  max-width: 740px;
}

.muted {
  color: var(--text-muted);
}

.mono {
  font-family: var(--font-mono);
}

.kicker {
  font-family: var(--font-mono);
  font-size: 12px;
  text-transform: uppercase;
  letter-spacing: 0.12em;
  color: var(--accent-blue);
}

.stats {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
  margin-top: 16px;
}

.stat {
  background: #09090a;
  border: 1px solid #1d1d20;
  border-radius: 14px;
  padding: 16px;
}

.stat strong {
  display: block;
  font-size: 1.55rem;
  margin-bottom: 5px;
}

.btn-row {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
  margin-top: 8px;
}

.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 15px 22px;
  border-radius: 10px;
  border: 1px solid transparent;
  font-weight: 600;
  transition: transform 0.2s var(--ease), border-color 0.2s var(--ease), background 0.2s var(--ease);
}

.btn:hover {
  transform: translateY(-1px);
}

.btn-primary {
  background: var(--accent-orange);
  color: #fff;
  border-color: rgba(255, 68, 0, 0.55);
}

.btn-secondary {
  background: rgba(255, 255, 255, 0.03);
  color: var(--text-main);
  border-color: #2a2a2f;
}

.eyebrow {
  display: flex;
  gap: 10px;
  align-items: center;
  flex-wrap: wrap;
}

.section-head {
  display: grid;
  gap: 10px;
  max-width: 760px;
  margin-bottom: 22px;
}

.link-line {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  text-decoration: underline;
  text-underline-offset: 3px;
}

.hub-grid,
.related-grid {
  display: grid;
  gap: 18px;
}

.hub-grid {
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.page-card {
  display: grid;
  gap: 16px;
  height: 100%;
}

.page-card p {
  color: var(--text-muted);
}

.page-card-actions {
  display: flex;
  gap: 14px;
  flex-wrap: wrap;
  margin-top: auto;
}

.checklist li,
.notes-list li {
  color: var(--text-muted);
}

.cta-panel {
  background:
    radial-gradient(circle at top right, rgba(255, 68, 0, 0.16), transparent 34%),
    radial-gradient(circle at bottom left, rgba(41, 82, 255, 0.16), transparent 32%),
    var(--card-bg);
}

.footer-links {
  display: flex;
  gap: 14px;
  flex-wrap: wrap;
  justify-content: flex-end;
}

header {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  z-index: 100;
  padding: 20px 0;
  backdrop-filter: blur(10px);
  background: rgba(5, 5, 5, 0.86);
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
}

.nav-inner {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 18px;
}

.nav-links {
  display: flex;
  gap: 18px;
  align-items: center;
  flex-wrap: wrap;
  justify-content: flex-end;
}

.logo {
  font-size: 18px;
  font-weight: 700;
  letter-spacing: -0.03em;
}

.sticky-cta {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 9999;
  display: flex;
  gap: 10px;
  padding: 10px;
  background: rgba(5, 5, 5, 0.92);
  backdrop-filter: blur(10px);
  border-top: 1px solid rgba(255, 255, 255, 0.08);
}

.sticky-cta a {
  flex: 1;
  padding: 14px 12px;
  border-radius: 10px;
  text-align: center;
  font-weight: 700;
  border: 1px solid #222;
}

.sticky-primary {
  background: var(--accent-orange);
  color: #fff;
  border-color: rgba(255, 68, 0, 0.55);
}

.sticky-ghost {
  background: rgba(255, 255, 255, 0.04);
  color: var(--text-main);
}

footer {
  padding: 80px 0;
  color: #666;
  font-size: 14px;
}

@media (max-width: 900px) {
  .grid-2,
  .grid-3,
  .grid-4,
  .hub-grid {
    grid-template-columns: 1fr;
  }

  .stats {
    grid-template-columns: 1fr;
  }

  .footer-links {
    justify-content: flex-start;
  }
}

@media (max-width: 680px) {
  .hero {
    padding-top: 142px;
  }

  .section {
    padding: 58px 0;
  }

  .nav-inner {
    align-items: flex-start;
    flex-direction: column;
  }

  .nav-links {
    justify-content: flex-start;
  }
}
`;

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function buildCanonical(pathname) {
  return `${SITE_URL}${pathname}`;
}

const STATE_NAMES = {
  AL: 'Alabama',
  AK: 'Alaska',
  AZ: 'Arizona',
  AR: 'Arkansas',
  CA: 'California',
  CO: 'Colorado',
  CT: 'Connecticut',
  DC: 'District of Columbia',
  DE: 'Delaware',
  FL: 'Florida',
  GA: 'Georgia',
  HI: 'Hawaii',
  IA: 'Iowa',
  ID: 'Idaho',
  IL: 'Illinois',
  IN: 'Indiana',
  KS: 'Kansas',
  KY: 'Kentucky',
  LA: 'Louisiana',
  MA: 'Massachusetts',
  MD: 'Maryland',
  ME: 'Maine',
  MI: 'Michigan',
  MN: 'Minnesota',
  MO: 'Missouri',
  MS: 'Mississippi',
  MT: 'Montana',
  NC: 'North Carolina',
  ND: 'North Dakota',
  NE: 'Nebraska',
  NH: 'New Hampshire',
  NJ: 'New Jersey',
  NM: 'New Mexico',
  NV: 'Nevada',
  NY: 'New York',
  OH: 'Ohio',
  OK: 'Oklahoma',
  OR: 'Oregon',
  PA: 'Pennsylvania',
  RI: 'Rhode Island',
  SC: 'South Carolina',
  SD: 'South Dakota',
  TN: 'Tennessee',
  TX: 'Texas',
  UT: 'Utah',
  VA: 'Virginia',
  VT: 'Vermont',
  WA: 'Washington',
  WI: 'Wisconsin',
  WV: 'West Virginia',
  WY: 'Wyoming',
};

function buildPagePath(slug) {
  return `/california/jurisdictions/${slug}/`;
}

function slugify(value) {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function buildPermitsHubPath() {
  return '/permits/';
}

function getJurisdictionSlug(entry) {
  const cleanedName = String(entry.name || '')
    .replace(/\s+\(.+?\)\s*$/g, '')
    .replace(/\+/g, ' and ');
  return slugify(cleanedName);
}

function getIndefiniteArticle(value) {
  return /^[aeiou]/i.test(String(value || '').trim()) ? 'an' : 'a';
}

function getStateName(stateCode) {
  return STATE_NAMES[stateCode] || stateCode;
}

function getStateSlug(stateCode) {
  return slugify(getStateName(stateCode));
}

function buildPermitsStatePath(stateCode) {
  return `/permits/${getStateSlug(stateCode)}/`;
}

function buildPermitsCityPath(entry) {
  return `${buildPermitsStatePath(entry.state)}${getJurisdictionSlug(entry)}/`;
}

function buildBuildingPermitsCityPath(entry) {
  return `/building-permits/${getStateSlug(entry.state)}/${getJurisdictionSlug(entry)}/`;
}

function buildPermitPortalAliasPath(entry) {
  return `/permit-portal/${getStateSlug(entry.state)}/${getJurisdictionSlug(entry)}/`;
}

function getEnabledUsJurisdictions() {
  return JURISDICTIONS
    .filter((entry) => entry.enabled !== false && entry.state)
    .sort((a, b) => {
      if (a.state !== b.state) return a.state.localeCompare(b.state);
      return a.name.localeCompare(b.name);
    });
}

function groupJurisdictionsByState(entries) {
  const map = new Map();

  for (const entry of entries) {
    if (!map.has(entry.state)) {
      map.set(entry.state, []);
    }
    map.get(entry.state).push(entry);
  }

  return [...map.entries()]
    .map(([stateCode, stateEntries]) => ({
      stateCode,
      stateName: getStateName(stateCode),
      stateSlug: getStateSlug(stateCode),
      entries: stateEntries.slice().sort((a, b) => a.name.localeCompare(b.name)),
    }))
    .sort((a, b) => a.stateName.localeCompare(b.stateName));
}

function mapJurisdictionsByState(states) {
  return new Map(states.map((state) => [state.stateCode, state.entries]));
}

function buildStatus(entry) {
  const source = entry.jurisdictionId ? JURISDICTION_SOURCE.get(entry.jurisdictionId) : null;
  if (source && source.provider && source.enabled !== false) {
    return { label: 'Live data', className: 'live' };
  }
  return { label: 'Portal-assisted', className: 'portal' };
}

function buildCoverage(entry) {
  if (entry.provider && entry.enabled !== false) {
    return {
      id: 'api_backed',
      label: 'API-backed',
      className: 'live',
      indicator: 'Public JSON feed available',
    };
  }

  return {
    id: 'portal_only',
    label: 'Portal-only',
    className: 'portal',
    indicator: 'Official portal fallback',
  };
}

function getCoverageCounts(entries) {
  const apiBacked = entries.filter((entry) => entry.provider).length;
  return {
    total: entries.length,
    apiBacked,
    portalOnly: entries.length - apiBacked,
  };
}

function getStatePlatformSummary(entries) {
  const counts = new Map();

  for (const entry of entries) {
    const key = String(entry.platform || 'Official permit portal').trim();
    counts.set(key, (counts.get(key) || 0) + 1);
  }

  return [...counts.entries()]
    .sort((a, b) => {
      if (b[1] !== a[1]) return b[1] - a[1];
      return a[0].localeCompare(b[0]);
    })
    .slice(0, 3)
    .map(([platform, count]) => `${platform} (${count})`)
    .join(', ');
}

function getTopStates(states, limit = 8) {
  return states
    .slice()
    .sort((a, b) => {
      if (b.entries.length !== a.entries.length) return b.entries.length - a.entries.length;
      return a.stateName.localeCompare(b.stateName);
    })
    .slice(0, limit);
}

function getFeaturedCityEntries(states, limit = 10) {
  return states
    .flatMap((state) => state.entries)
    .filter((entry) => entry.provider || entry.portalUrl)
    .sort((a, b) => {
      const aCoverage = a.provider ? 0 : 1;
      const bCoverage = b.provider ? 0 : 1;
      if (aCoverage !== bCoverage) return aCoverage - bCoverage;
      if (a.state !== b.state) return a.state.localeCompare(b.state);
      return a.name.localeCompare(b.name);
    })
    .slice(0, limit);
}

function getRelatedPermitEntries(entry, stateEntries, limit = 4) {
  return stateEntries
    .filter((candidate) => candidate.id !== entry.id)
    .sort((a, b) => {
      const aScore =
        Number(a.platform === entry.platform) * 2 +
        Number(Boolean(a.provider) === Boolean(entry.provider));
      const bScore =
        Number(b.platform === entry.platform) * 2 +
        Number(Boolean(b.provider) === Boolean(entry.provider));

      if (bScore !== aScore) return bScore - aScore;
      return a.name.localeCompare(b.name);
    })
    .slice(0, limit);
}

function buildStructuredData(entry) {
  const pathname = buildPagePath(entry.slug);
  return {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: entry.title.replace(' | PermitPulse', ''),
    url: buildCanonical(pathname),
    description: entry.description,
    isPartOf: {
      '@type': 'WebSite',
      name: 'PermitPulse',
      url: SITE_URL,
    },
    breadcrumb: {
      '@type': 'BreadcrumbList',
      itemListElement: [
        {
          '@type': 'ListItem',
          position: 1,
          name: 'Home',
          item: SITE_URL,
        },
        {
          '@type': 'ListItem',
          position: 2,
          name: 'California jurisdictions',
          item: `${SITE_URL}/california/jurisdictions/`,
        },
        {
          '@type': 'ListItem',
          position: 3,
          name: entry.name,
          item: buildCanonical(pathname),
        },
      ],
    },
  };
}

function buildPermitsStructuredData({ stateCode, stateName, statePath, entry = null }) {
  const items = [
    {
      '@type': 'ListItem',
      position: 1,
      name: 'Home',
      item: SITE_URL,
    },
    {
      '@type': 'ListItem',
      position: 2,
      name: 'Permit pages',
      item: `${SITE_URL}${buildPermitsHubPath()}`,
    },
    {
      '@type': 'ListItem',
      position: 3,
      name: stateName,
      item: `${SITE_URL}${statePath}`,
    },
  ];

  if (entry) {
    items.push({
      '@type': 'ListItem',
      position: 4,
      name: entry.name,
      item: buildCanonical(buildPermitsCityPath(entry)),
    });
  }

  return {
    '@context': 'https://schema.org',
    '@type': entry ? 'WebPage' : 'CollectionPage',
    name: entry
      ? `${entry.name}, ${stateName} Permit Coverage`
      : `${stateName} Permit Pages | PermitPulse`,
    url: entry ? buildCanonical(buildPermitsCityPath(entry)) : buildCanonical(statePath),
    description: entry
      ? `${entry.name}, ${stateName} permit coverage page with the official permit portal, platform details, and PermitPulse coverage notes.`
      : `${stateName} permit coverage pages for jurisdictions currently listed in the PermitPulse catalog.`,
    isPartOf: {
      '@type': 'WebSite',
      name: 'PermitPulse',
      url: SITE_URL,
    },
    breadcrumb: {
      '@type': 'BreadcrumbList',
      itemListElement: items,
    },
  };
}

function buildBuildingPermitsStructuredData(entry) {
  const stateName = getStateName(entry.state);
  const buildingPath = buildBuildingPermitsCityPath(entry);
  const permitsPath = buildPermitsCityPath(entry);

  return {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: `${entry.name}, ${stateName} Building Permits | PermitPulse`,
    url: buildCanonical(buildingPath),
    description: `${entry.name}, ${stateName} building permits page with the official permit portal, coverage tier, fallback notes, and links into the main permit directory.`,
    isPartOf: {
      '@type': 'WebSite',
      name: 'PermitPulse',
      url: SITE_URL,
    },
    breadcrumb: {
      '@type': 'BreadcrumbList',
      itemListElement: [
        {
          '@type': 'ListItem',
          position: 1,
          name: 'Home',
          item: SITE_URL,
        },
        {
          '@type': 'ListItem',
          position: 2,
          name: 'Permit pages',
          item: `${SITE_URL}${buildPermitsHubPath()}`,
        },
        {
          '@type': 'ListItem',
          position: 3,
          name: stateName,
          item: `${SITE_URL}${buildPermitsStatePath(entry.state)}`,
        },
        {
          '@type': 'ListItem',
          position: 4,
          name: `${entry.name} permits`,
          item: `${SITE_URL}${permitsPath}`,
        },
        {
          '@type': 'ListItem',
          position: 5,
          name: `${entry.name} building permits`,
          item: `${SITE_URL}${buildingPath}`,
        },
      ],
    },
  };
}

function buildPermitsHubStructuredData(states) {
  return {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: 'U.S. Permit Directory | PermitPulse',
    url: `${SITE_URL}${buildPermitsHubPath()}`,
    description: 'Browse PermitPulse permit coverage pages by state and city from the shared jurisdiction catalog.',
    isPartOf: {
      '@type': 'WebSite',
      name: 'PermitPulse',
      url: SITE_URL,
    },
    breadcrumb: {
      '@type': 'BreadcrumbList',
      itemListElement: [
        {
          '@type': 'ListItem',
          position: 1,
          name: 'Home',
          item: SITE_URL,
        },
        {
          '@type': 'ListItem',
          position: 2,
          name: 'Permit directory',
          item: `${SITE_URL}${buildPermitsHubPath()}`,
        },
      ],
    },
    about: {
      '@type': 'Thing',
      name: `${states.length} state permit pages`,
    },
  };
}

function renderHead({
  title,
  description,
  canonicalPath,
  structuredData,
  pageType = 'website',
  robots = 'index,follow',
  extraHead = '',
}) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(title)}</title>
  <meta name="description" content="${escapeHtml(description)}" />
  <meta name="robots" content="${escapeHtml(robots)}" />
  <meta property="og:type" content="${escapeHtml(pageType)}" />
  <meta property="og:url" content="${buildCanonical(canonicalPath)}" />
  <meta property="og:title" content="${escapeHtml(title.replace(' | PermitPulse', ''))}" />
  <meta property="og:description" content="${escapeHtml(description)}" />
  <meta property="og:image" content="${OG_IMAGE}" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${escapeHtml(title.replace(' | PermitPulse', ''))}" />
  <meta name="twitter:description" content="${escapeHtml(description)}" />
  <meta name="twitter:image" content="${OG_IMAGE}" />
  <link rel="canonical" href="${buildCanonical(canonicalPath)}" />
  <link rel="stylesheet" href="/assets/jurisdictions.css" />
  <script async src="https://www.googletagmanager.com/gtag/js?id=G-0S8S6156CV"></script>
  <script>
    window.dataLayer = window.dataLayer || [];
    function gtag(){dataLayer.push(arguments);}
    gtag('js', new Date());
    gtag('config', 'G-0S8S6156CV');
  </script>
  <script defer src="https://static.cloudflareinsights.com/beacon.min.js" data-cf-beacon='{"token":"7046e03c84424a49988d1930fda247b6"}'></script>
  ${extraHead}
  <script type="application/ld+json">${JSON.stringify(structuredData)}</script>
</head>`;
}

function renderHeader() {
  return `<header>
  <div class="wrap nav-inner">
    <a href="/" class="logo">PermitPulse <span style="color:var(--accent-orange);">/</span> Beta</a>
    <nav class="nav-links mono" style="font-size:13px;">
      <a href="/permits/">Permit directory</a>
      <a href="/california/jurisdictions/">California hub</a>
      <a href="/california-permit-history/">California search</a>
      <a href="/mission-control/">Mission Control</a>
      <a href="/guides/">Guides</a>
      <a href="/free-tools/">Free tools</a>
    </nav>
  </div>
</header>`;
}

function renderFooter() {
  return `<footer class="wrap">
  <div class="grid grid-2">
    <div>
      <span class="logo">PermitPulse</span>
      <p style="margin-top:10px; max-width:340px;" class="muted">
        Designed in Los Angeles. Built for trades, diligence teams, and owners who need permit clarity before they commit.
      </p>
    </div>
    <div>
      <div class="footer-links">
        <a href="/permits/" class="link-line">Permit directory</a>
        <a href="/california/jurisdictions/" class="link-line">California hub</a>
        <a href="/california-permit-history/" class="link-line">California search</a>
        <a href="/mission-control/" class="link-line">Mission Control</a>
        <a href="/guides/" class="link-line">Guides</a>
        <a href="/free-tools/" class="link-line">Free tools</a>
      </div>
      <div style="margin-top:18px; text-align:right;">
        <a href="mailto:hello@getpermitpulse.com" class="link-line">hello@getpermitpulse.com</a>
        <div class="muted mono" style="margin-top:18px;">© 2026 PermitPulse Inc.</div>
      </div>
    </div>
  </div>
</footer>`;
}

function renderStickyCta() {
  return `<div class="sticky-cta" role="navigation" aria-label="Start PermitPulse">
  <a class="sticky-primary" href="${STRIPE_URL}" target="_blank" rel="noopener">Request Permit History + Risk Report</a>
  <a class="sticky-ghost" href="/permits/">Browse permit directory</a>
</div>`;
}

function renderRelatedCards(entry, entryMap) {
  return entry.related
    .map((slug) => entryMap.get(slug))
    .filter(Boolean)
    .map((relatedEntry) => {
      const status = buildStatus(relatedEntry);
      return `<a class="card soft page-card" href="${buildPagePath(relatedEntry.slug)}">
  <div class="eyebrow">
    <span class="pill ${status.className}">${escapeHtml(status.label)}</span>
  </div>
  <div>
    <h3 style="margin-bottom:8px;">${escapeHtml(relatedEntry.name)}</h3>
    <p>${escapeHtml(relatedEntry.summary)}</p>
  </div>
</a>`;
    })
    .join('\n');
}

function renderJurisdictionPage(entry, entryMap) {
  const status = buildStatus(entry);
  const pathname = buildPagePath(entry.slug);
  const relatedCards = renderRelatedCards(entry, entryMap);
  const structuredData = buildStructuredData(entry);

  return `${renderHead({
    title: entry.title,
    description: entry.description,
    canonicalPath: pathname,
    structuredData,
  })}
<body>
${renderHeader()}
<main>
  <section class="wrap hero">
    <div class="hero-copy">
      <div class="eyebrow">
        <span class="badge">California jurisdiction coverage</span>
        <span class="pill ${status.className}">${escapeHtml(status.label)}</span>
      </div>
      <h1>${escapeHtml(entry.h1)}</h1>
      <p class="lead">${escapeHtml(entry.intro)}</p>
      <div class="btn-row">
        <a class="btn btn-primary" href="${STRIPE_URL}" target="_blank" rel="noopener">Request Permit History + Risk Report</a>
        <a class="btn btn-secondary" href="${escapeHtml(entry.officialPortalUrl)}" target="_blank" rel="noopener">${escapeHtml(entry.officialPortalLabel)}</a>
      </div>
      <p class="mono muted" style="font-size:12px;">Need statewide search instead? Start at <a href="/california-permit-history/" class="link-line">/california-permit-history/</a>.</p>
    </div>
  </section>

  <section class="section">
    <div class="wrap grid grid-2">
      <article class="card">
        <div class="kicker">What this page helps confirm</div>
        <h2 style="margin:8px 0 14px;">Use ${escapeHtml(entry.name)} records without over-reading them</h2>
        <ul class="checklist">
          ${entry.focusPoints.map((item) => `<li>${escapeHtml(item)}</li>`).join('\n          ')}
        </ul>
      </article>
      <aside class="card soft">
        <div class="kicker">Official portal</div>
        <h2 style="margin:8px 0 14px;">Start with the jurisdiction source</h2>
        <p class="muted">${escapeHtml(entry.officialPortalNote)}</p>
        <div class="btn-row">
          <a class="btn btn-secondary" href="${escapeHtml(entry.officialPortalUrl)}" target="_blank" rel="noopener">${escapeHtml(entry.officialPortalLabel)}</a>
        </div>
        <p class="mono muted" style="font-size:12px; margin-top:10px;">Canonical launch URL: ${escapeHtml(buildCanonical(pathname))}</p>
      </aside>
    </div>
  </section>

  <section class="section">
    <div class="wrap">
      <div class="section-head">
        <div class="kicker">Coverage notes</div>
        <h2>How PermitPulse approaches ${escapeHtml(entry.name)}</h2>
        <p class="lead">${escapeHtml(entry.summary)}</p>
      </div>
      <div class="card">
        <ul class="notes-list">
          ${entry.coverageNotes.map((item) => `<li>${escapeHtml(item)}</li>`).join('\n          ')}
        </ul>
      </div>
    </div>
  </section>

  <section class="section">
    <div class="wrap">
      <div class="card cta-panel">
        <div class="section-head" style="margin-bottom:0;">
          <div class="kicker">Next step</div>
          <h2>Need more than a portal screenshot?</h2>
          <p class="lead">For a specific ${escapeHtml(entry.name)} address, PermitPulse can package permit history, timeline context, risk flags, and scope notes into a decision-ready report.</p>
        </div>
        <div class="btn-row">
          <a class="btn btn-primary" href="${STRIPE_URL}" target="_blank" rel="noopener">Request Permit History + Risk Report</a>
          <a class="btn btn-secondary" href="/permit-history-report-los-angeles/">See how the report workflow works</a>
        </div>
      </div>
    </div>
  </section>

  <section class="section">
    <div class="wrap">
      <div class="section-head">
        <div class="kicker">Related coverage</div>
        <h2>Browse nearby California jurisdictions</h2>
        <p class="lead">These internal links keep the launch cluster connected for users and crawlers while staying focused on real permit research intent.</p>
      </div>
      <div class="related-grid grid-3">
        ${relatedCards}
      </div>
    </div>
  </section>
</main>
${renderFooter()}
${renderStickyCta()}
</body>
</html>
`;
}

function renderHubPage(entries) {
  const liveCount = entries.filter((entry) => buildStatus(entry).className === 'live').length;
  const portalCount = entries.length - liveCount;
  const cards = entries
    .map((entry) => {
      const status = buildStatus(entry);
      return `<article class="card page-card">
  <div class="eyebrow">
    <span class="pill ${status.className}">${escapeHtml(status.label)}</span>
  </div>
  <div>
    <h3 style="margin-bottom:8px;">${escapeHtml(entry.name)}</h3>
    <p>${escapeHtml(entry.summary)}</p>
  </div>
  <div class="page-card-actions mono" style="font-size:12px;">
    <a class="link-line" href="${buildPagePath(entry.slug)}">Open page</a>
    <a class="link-line" href="${escapeHtml(entry.officialPortalUrl)}" target="_blank" rel="noopener">Official portal</a>
  </div>
</article>`;
    })
    .join('\n');

  const structuredData = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: 'California Jurisdictions | PermitPulse',
    url: `${SITE_URL}/california/jurisdictions/`,
    description:
      'California jurisdiction coverage hub for PermitPulse public launch pages, including Los Angeles, Sacramento, Santa Monica, Culver City, Beverly Hills, Pasadena, Glendale, Long Beach, and San Diego.',
    isPartOf: {
      '@type': 'WebSite',
      name: 'PermitPulse',
      url: SITE_URL,
    },
  };

  return `${renderHead({
    title: 'California Jurisdictions | PermitPulse',
    description:
      'Browse PermitPulse California jurisdiction coverage pages for Los Angeles, Los Angeles County, Sacramento, Santa Monica, Culver City, Beverly Hills, Pasadena, Glendale, Long Beach, and San Diego.',
    canonicalPath: '/california/jurisdictions/',
    structuredData,
  })}
<body>
${renderHeader()}
<main>
  <section class="wrap hero">
    <div class="hero-copy">
      <span class="badge">California launch hub</span>
      <h1>Covered California jurisdictions</h1>
      <p class="lead">This hub gives search traffic a clear, crawlable path into PermitPulse jurisdiction coverage pages. Each link is an indexable public page built for real permit research, not thin doorway copy.</p>
      <div class="btn-row">
        <a class="btn btn-primary" href="${STRIPE_URL}" target="_blank" rel="noopener">Request Permit History + Risk Report</a>
        <a class="btn btn-secondary" href="/california-permit-history/">Open California permit search</a>
        <a class="btn btn-secondary" href="/permits/">Open U.S. permit directory</a>
      </div>
      <div class="stats">
        <div class="stat">
          <strong>${entries.length}</strong>
          <span class="muted">Launch jurisdiction pages</span>
        </div>
        <div class="stat">
          <strong>${liveCount}</strong>
          <span class="muted">Live data pages</span>
        </div>
        <div class="stat">
          <strong>${portalCount}</strong>
          <span class="muted">Portal-assisted launch pages</span>
        </div>
      </div>
    </div>
  </section>

  <section class="section">
    <div class="wrap">
      <div class="section-head">
        <div class="kicker">Jurisdiction pages</div>
        <h2>Crawlable launch coverage for California search intent</h2>
        <p class="lead">Every card below links to a public PermitPulse jurisdiction page with a canonical URL, an official portal link, coverage notes, and a direct CTA for Permit History + Risk Report requests.</p>
      </div>
      <div class="hub-grid">
        ${cards}
      </div>
    </div>
  </section>

  <section class="section">
    <div class="wrap">
      <div class="card cta-panel">
        <div class="section-head" style="margin-bottom:0;">
          <div class="kicker">Internal linking</div>
          <h2>Need statewide search instead of a single jurisdiction page?</h2>
          <p class="lead">Use the California permit history search to scan supported public datasets, then come back to the jurisdiction pages when you need a more local landing page or a report request path.</p>
        </div>
        <div class="btn-row">
          <a class="btn btn-secondary" href="/california-permit-history/">Open California permit search</a>
          <a class="btn btn-secondary" href="/permits/">Open U.S. permit directory</a>
          <a class="btn btn-secondary" href="/">Return to homepage</a>
        </div>
      </div>
    </div>
  </section>
</main>
${renderFooter()}
${renderStickyCta()}
</body>
</html>
`;
}

function renderPermitsHubPage(states) {
  const totalCities = states.reduce((sum, state) => sum + state.entries.length, 0);
  const apiBacked = states.reduce((sum, state) => sum + state.entries.filter((entry) => entry.provider).length, 0);
  const topStates = getTopStates(states);
  const featuredCities = getFeaturedCityEntries(states);
  const cards = states
    .map((state) => {
      const apiCount = state.entries.filter((entry) => entry.provider).length;
      const portalCount = state.entries.length - apiCount;

      return `<article class="card page-card">
  <div class="eyebrow">
    <span class="pill ${apiCount ? 'live' : 'portal'}">${apiCount ? `${apiCount} API-backed` : 'Portal-only'}</span>
  </div>
  <div>
    <h3 style="margin-bottom:8px;">${escapeHtml(state.stateName)}</h3>
    <p>${escapeHtml(`${state.entries.length} covered jurisdictions. ${apiCount} API-backed and ${portalCount} portal-only based on the live PermitPulse catalog.`)}</p>
  </div>
  <div class="page-card-actions mono" style="font-size:12px;">
    <a class="link-line" href="${buildPermitsStatePath(state.stateCode)}">Open state page</a>
  </div>
</article>`;
    })
    .join('\n');

  return `${renderHead({
    title: 'U.S. Permit Directory by State and City | PermitPulse',
    description: `Browse ${states.length} state permit directory pages and ${totalCities} city permit pages from the current PermitPulse jurisdiction catalog.`,
    canonicalPath: buildPermitsHubPath(),
    structuredData: buildPermitsHubStructuredData(states),
  })}
<body>
${renderHeader()}
<main>
  <section class="wrap hero">
    <div class="hero-copy">
      <span class="badge">U.S. permit directory</span>
      <h1>Permit pages organized by state and jurisdiction.</h1>
      <p class="lead">PermitPulse generates this directory from the current shared jurisdiction catalog. Use it to find covered state pages, city permit portals, coverage tiers, and the right path into Mission Control.</p>
      <div class="btn-row">
        <a class="btn btn-primary" href="/mission-control/">Open Mission Control</a>
        <a class="btn btn-secondary" href="/california-permit-history/">Open California permit search</a>
      </div>
      <div class="stats">
        <div class="stat">
          <strong>${states.length}</strong>
          <span class="muted">State pages</span>
        </div>
        <div class="stat">
          <strong>${totalCities}</strong>
          <span class="muted">Covered jurisdictions</span>
        </div>
        <div class="stat">
          <strong>${apiBacked}</strong>
          <span class="muted">API-backed jurisdictions</span>
        </div>
      </div>
    </div>
  </section>

  <section class="section">
    <div class="wrap">
      <div class="section-head">
        <div class="kicker">Top covered states</div>
        <h2>Start with the states that have the most coverage</h2>
        <p class="lead">These states currently have the largest number of covered jurisdictions in the PermitPulse catalog.</p>
      </div>
      <div class="hub-grid">
        ${topStates
          .map(
            (state) => `<article class="card page-card">
  <div>
    <h3 style="margin-bottom:8px;">${escapeHtml(state.stateName)}</h3>
    <p>${escapeHtml(`${state.entries.length} covered jurisdictions.`)}</p>
  </div>
  <div class="page-card-actions mono" style="font-size:12px;">
    <a class="link-line" href="${buildPermitsStatePath(state.stateCode)}">Open ${escapeHtml(state.stateName)}</a>
  </div>
</article>`,
          )
          .join('\n')}
      </div>
    </div>
  </section>

  <section class="section">
    <div class="wrap">
      <div class="section-head">
        <div class="kicker">State pages</div>
        <h2>Browse coverage by state</h2>
        <p class="lead">Every state page lists the covered jurisdictions currently available in the shared PermitPulse catalog, with links into each city or county permit page.</p>
      </div>
      <div class="hub-grid">
        ${cards}
      </div>
    </div>
  </section>

  <section class="section">
    <div class="wrap">
      <div class="section-head">
        <div class="kicker">Featured city pages</div>
        <h2>Jump directly into covered city permit pages</h2>
        <p class="lead">These links come directly from current catalog coverage and give crawlers a shorter path into the city layer.</p>
      </div>
      <div class="card">
        <div class="page-card-actions" style="font-size:14px;">
          ${featuredCities
            .map(
              (entry) =>
                `<a class="link-line" href="${buildPermitsCityPath(entry)}">${escapeHtml(entry.name)}, ${escapeHtml(getStateName(entry.state))}</a>`,
            )
            .join('\n          ')}
        </div>
      </div>
    </div>
  </section>
</main>
${renderFooter()}
${renderStickyCta()}
</body>
</html>
`;
}

function renderPermitsStatePage(state) {
  const coverageCounts = getCoverageCounts(state.entries);
  const apiEntries = state.entries.filter((entry) => entry.provider);
  const portalEntries = state.entries.filter((entry) => !entry.provider);
  const platformSummary = getStatePlatformSummary(state.entries);
  const cards = state.entries
    .map((entry) => {
      const coverage = buildCoverage(entry);
      return `<article class="card page-card">
  <div class="eyebrow">
    <span class="pill ${coverage.className}">${escapeHtml(coverage.label)}</span>
  </div>
  <div>
    <h3 style="margin-bottom:8px;">${escapeHtml(entry.name)}</h3>
    <p>${escapeHtml(`${entry.platform || 'Official permit portal'} · ${coverage.indicator}.`)}</p>
    <p class="muted" style="margin-top:10px;">${escapeHtml(entry.portalNotes || 'Official permit portal route available from the shared PermitPulse catalog.')}</p>
  </div>
  <div class="page-card-actions mono" style="font-size:12px;">
    <a class="link-line" href="${buildPermitsCityPath(entry)}">Open permit page</a>
    ${entry.portalUrl ? `<a class="link-line" href="${escapeHtml(entry.portalUrl)}" target="_blank" rel="noopener">Official portal</a>` : ''}
  </div>
</article>`;
    })
    .join('\n');

  const pathname = buildPermitsStatePath(state.stateCode);
  return `${renderHead({
    title: `${state.stateName} Permit Directory | ${coverageCounts.total} Covered Jurisdictions | PermitPulse`,
    description: `${state.stateName} permit directory for ${coverageCounts.total} covered jurisdictions with official portal links and catalog-based coverage tiers.`,
    canonicalPath: pathname,
    structuredData: buildPermitsStructuredData({
      stateCode: state.stateCode,
      stateName: state.stateName,
      statePath: pathname,
    }),
  })}
<body>
${renderHeader()}
<main>
  <section class="wrap hero">
    <div class="hero-copy">
      <div class="eyebrow">
        <span class="badge">State permit page</span>
        <span class="pill ${coverageCounts.apiBacked ? 'live' : 'portal'}">${coverageCounts.apiBacked ? `${coverageCounts.apiBacked} API-backed` : 'Portal-first coverage'}</span>
      </div>
      <h1>${escapeHtml(state.stateName)} permit pages</h1>
      <p class="lead">${escapeHtml(`${state.stateName} currently has ${coverageCounts.total} covered jurisdictions in the PermitPulse catalog. ${coverageCounts.apiBacked} are API-backed, ${coverageCounts.portalOnly} are portal-only, and the current platform mix includes ${platformSummary}.`)}</p>
      <div class="btn-row">
        <a class="btn btn-primary" href="/mission-control/">Open Mission Control</a>
        <a class="btn btn-secondary" href="/permits/">Browse all states</a>
      </div>
      <div class="stats">
        <div class="stat">
          <strong>${coverageCounts.total}</strong>
          <span class="muted">Covered jurisdictions</span>
        </div>
        <div class="stat">
          <strong>${coverageCounts.apiBacked}</strong>
          <span class="muted">API-backed</span>
        </div>
        <div class="stat">
          <strong>${coverageCounts.portalOnly}</strong>
          <span class="muted">Portal-only</span>
        </div>
      </div>
    </div>
  </section>

  <section class="section">
    <div class="wrap">
      <div class="section-head">
        <div class="kicker">Covered jurisdictions</div>
        <h2>${escapeHtml(state.stateName)} city and county permit pages</h2>
        <p class="lead">These pages are generated directly from current jurisdiction metadata. Each one includes the official permit portal, platform label, coverage tier, and Mission Control path.</p>
      </div>
      <div class="hub-grid">
        ${cards}
      </div>
    </div>
  </section>

  <section class="section">
    <div class="wrap grid grid-2">
      <article class="card">
        <div class="kicker">All covered cities</div>
        <h2 style="margin:8px 0 14px;">Browse every covered ${escapeHtml(state.stateName)} page</h2>
        <div class="page-card-actions" style="font-size:14px;">
          ${state.entries
            .map(
              (entry) =>
                `<a class="link-line" href="${buildPermitsCityPath(entry)}">${escapeHtml(entry.name)}</a>`,
            )
            .join('\n          ')}
        </div>
      </article>
      <aside class="card soft">
        <div class="kicker">Coverage grouping</div>
        <h2 style="margin:8px 0 14px;">Current catalog split</h2>
        <p class="muted">${escapeHtml(`This state page is generated from current catalog metadata only. Use the grouped links below to move between API-backed and portal-only coverage without leaving the canonical directory layer.`)}</p>
        ${apiEntries.length ? `<p class="mono muted" style="font-size:12px; margin-top:14px;">API-backed: ${escapeHtml(apiEntries.map((entry) => entry.name).join(', '))}</p>` : ''}
        ${portalEntries.length ? `<p class="mono muted" style="font-size:12px; margin-top:14px;">Portal-only: ${escapeHtml(portalEntries.map((entry) => entry.name).join(', '))}</p>` : ''}
      </aside>
    </div>
  </section>
</main>
${renderFooter()}
${renderStickyCta()}
</body>
</html>
`;
}

function renderPermitsCityPage(entry, stateEntries) {
  const stateName = getStateName(entry.state);
  const pathname = buildPermitsCityPath(entry);
  const coverage = buildCoverage(entry);
  const apiIndicator = entry.provider ? 'Yes' : 'No';
  const tierPhrase = coverage.id === 'api_backed' ? 'API-backed' : 'portal-only';
  const tierArticle = getIndefiniteArticle(tierPhrase);
  const fallbackNote = entry.provider
    ? `${entry.name} has a public data source in the current catalog, but the official ${entry.platform || 'permit'} portal remains the authoritative jurisdiction source.`
    : `${entry.name} is currently cataloged as portal-only coverage, so the official ${entry.platform || 'permit'} portal is the primary lookup path.`;
  const relatedEntries = getRelatedPermitEntries(entry, stateEntries);

  return `${renderHead({
    title: `${entry.name}, ${stateName} Permit Portal + Coverage | PermitPulse`,
    description: `${entry.name}, ${stateName} permit page with the official ${entry.platform || 'permit'} portal, ${tierPhrase} coverage, and Mission Control access.`,
    canonicalPath: pathname,
    structuredData: buildPermitsStructuredData({
      stateCode: entry.state,
      stateName,
      statePath: buildPermitsStatePath(entry.state),
      entry,
    }),
  })}
<body>
${renderHeader()}
<main>
  <section class="wrap hero">
    <div class="hero-copy">
      <div class="eyebrow">
        <span class="badge">${escapeHtml(stateName)} permit page</span>
        <span class="pill ${coverage.className}">${escapeHtml(coverage.label)}</span>
      </div>
      <h1>${escapeHtml(entry.name)} permit portal and PermitPulse coverage</h1>
      <p class="lead">${escapeHtml(`${entry.name} is listed in the current PermitPulse jurisdiction catalog as ${tierArticle} ${tierPhrase} jurisdiction in ${stateName}. Start with the official ${entry.platform || 'permit'} portal, review the current coverage notes below, and use Mission Control when the permit record needs more context.`)}</p>
      <div class="btn-row">
        ${entry.portalUrl ? `<a class="btn btn-primary" href="${escapeHtml(entry.portalUrl)}" target="_blank" rel="noopener">Open official permit portal</a>` : ''}
        <a class="btn btn-secondary" href="${buildBuildingPermitsCityPath(entry)}">Open building permits page</a>
        <a class="btn btn-secondary" href="/mission-control/">Open Mission Control</a>
        <a class="btn btn-secondary" href="${buildPermitsStatePath(entry.state)}">Back to ${escapeHtml(stateName)}</a>
      </div>
    </div>
  </section>

  <section class="section">
    <div class="wrap grid grid-2">
      <article class="card">
        <div class="kicker">Catalog snapshot</div>
        <h2 style="margin:8px 0 14px;">Current jurisdiction metadata</h2>
        <ul class="notes-list">
          <li><strong>Catalog ID:</strong> <span class="mono">${escapeHtml(entry.id)}</span></li>
          <li><strong>City:</strong> ${escapeHtml(entry.name)}</li>
          <li><strong>State:</strong> ${escapeHtml(stateName)} (${escapeHtml(entry.state)})</li>
          <li><strong>Platform:</strong> ${escapeHtml(entry.platform || 'Not set')}</li>
          <li><strong>Coverage tier:</strong> ${escapeHtml(coverage.label)}</li>
          <li><strong>API-backed:</strong> ${escapeHtml(apiIndicator)}</li>
          <li><strong>Route slug:</strong> <span class="mono">${escapeHtml(getJurisdictionSlug(entry))}</span></li>
        </ul>
      </article>
      <aside class="card soft">
        <div class="kicker">Official route</div>
        <h2 style="margin:8px 0 14px;">Use the jurisdiction source first</h2>
        <p class="muted">${escapeHtml(entry.portalNotes || 'Official permit portal route available from the shared PermitPulse catalog.')}</p>
        <p class="muted" style="margin-top:10px;">${escapeHtml(fallbackNote)}</p>
        <div class="btn-row">
          ${entry.portalUrl ? `<a class="btn btn-secondary" href="${escapeHtml(entry.portalUrl)}" target="_blank" rel="noopener">Open official permit portal</a>` : ''}
          <a class="btn btn-secondary" href="${buildPermitsStatePath(entry.state)}">Back to ${escapeHtml(stateName)}</a>
        </div>
      </aside>
    </div>
  </section>

  <section class="section">
    <div class="wrap">
      <div class="card cta-panel">
        <div class="section-head" style="margin-bottom:0;">
          <div class="kicker">Mission Control</div>
          <h2>Need more than the permit portal?</h2>
          <p class="lead">${escapeHtml(`${entry.name} is available in PermitPulse with ${tierPhrase} coverage. Mission Control keeps the current portal-first behavior intact while giving operators a cleaner route into the next action.`)}</p>
        </div>
        <div class="btn-row">
          <a class="btn btn-primary" href="/mission-control/">Open Mission Control</a>
          <a class="btn btn-secondary" href="${buildPermitsStatePath(entry.state)}">Browse ${escapeHtml(stateName)} permit pages</a>
        </div>
      </div>
    </div>
  </section>

  <section class="section">
    <div class="wrap">
      <div class="section-head">
        <div class="kicker">Related links</div>
        <h2>More ${escapeHtml(stateName)} permit pages</h2>
        <p class="lead">These related links are generated from the same state catalog so users can move across nearby permit pages without dropping out of the directory.</p>
      </div>
      <div class="card">
        <div class="page-card-actions" style="font-size:14px;">
          <a class="link-line" href="${buildBuildingPermitsCityPath(entry)}">${escapeHtml(entry.name)} building permits</a>
          <a class="link-line" href="${buildPermitsStatePath(entry.state)}">${escapeHtml(stateName)} permit directory</a>
          <a class="link-line" href="/mission-control/">Mission Control</a>
          ${relatedEntries
            .map(
              (relatedEntry) =>
                `<a class="link-line" href="${buildPermitsCityPath(relatedEntry)}">${escapeHtml(relatedEntry.name)}, ${escapeHtml(stateName)}</a>`,
            )
            .join('\n          ')}
        </div>
      </div>
    </div>
  </section>
</main>
${renderFooter()}
${renderStickyCta()}
</body>
</html>
`;
}

function renderBuildingPermitsCityPage(entry, stateEntries) {
  const stateName = getStateName(entry.state);
  const coverage = buildCoverage(entry);
  const tierPhrase = coverage.id === 'api_backed' ? 'API-backed' : 'portal-only';
  const fallbackNote = entry.provider
    ? `${entry.name} has catalog-backed public data coverage, but the official ${entry.platform || 'permit'} portal remains the primary source for building permit lookup and record confirmation.`
    : `${entry.name} is currently routed as portal-only coverage, so building permit lookup should start in the official ${entry.platform || 'permit'} portal before moving into Mission Control.`;
  const relatedEntries = getRelatedPermitEntries(entry, stateEntries);
  const pathname = buildBuildingPermitsCityPath(entry);

  return `${renderHead({
    title: `${entry.name}, ${stateName} Building Permits | PermitPulse`,
    description: `Find ${entry.name}, ${stateName} building permits with the official ${entry.platform || 'permit'} portal, ${tierPhrase} coverage notes, and links to the main PermitPulse permit page.`,
    canonicalPath: pathname,
    structuredData: buildBuildingPermitsStructuredData(entry),
  })}
<body>
${renderHeader()}
<main>
  <section class="wrap hero">
    <div class="hero-copy">
      <div class="eyebrow">
        <span class="badge">${escapeHtml(stateName)} building permits</span>
        <span class="pill ${coverage.className}">${escapeHtml(coverage.label)}</span>
      </div>
      <h1>${escapeHtml(`${entry.name} building permits`)}</h1>
      <p class="lead">${escapeHtml(`Find building permits in ${entry.name}, ${stateName} using the current jurisdiction catalog and the official ${entry.platform || 'permit'} portal. This page is framed for building-permit lookup first, with direct links into the broader PermitPulse permit page and Mission Control when the record needs a wider review.`)}</p>
      <div class="btn-row">
        ${entry.portalUrl ? `<a class="btn btn-primary" href="${escapeHtml(entry.portalUrl)}" target="_blank" rel="noopener">Find building permits in official portal</a>` : ''}
        <a class="btn btn-secondary" href="${buildPermitsCityPath(entry)}">Open main permit page</a>
        <a class="btn btn-secondary" href="/mission-control/">Open Mission Control</a>
      </div>
    </div>
  </section>

  <section class="section">
    <div class="wrap grid grid-2">
      <article class="card">
        <div class="kicker">Building permits snapshot</div>
        <h2 style="margin:8px 0 14px;">Current catalog facts for ${escapeHtml(entry.name)}</h2>
        <ul class="notes-list">
          <li><strong>City:</strong> ${escapeHtml(entry.name)}</li>
          <li><strong>State:</strong> ${escapeHtml(stateName)} (${escapeHtml(entry.state)})</li>
          <li><strong>Platform:</strong> ${escapeHtml(entry.platform || 'Not set')}</li>
          <li><strong>Coverage tier:</strong> ${escapeHtml(coverage.label)}</li>
          <li><strong>Route:</strong> <span class="mono">${escapeHtml(pathname)}</span></li>
          <li><strong>Main permit page:</strong> <span class="mono">${escapeHtml(buildPermitsCityPath(entry))}</span></li>
        </ul>
      </article>
      <aside class="card soft">
        <div class="kicker">Fallback notes</div>
        <h2 style="margin:8px 0 14px;">Portal-first building permit lookup</h2>
        <p class="muted">${escapeHtml(entry.portalNotes || 'Official permit portal route available from the shared PermitPulse catalog.')}</p>
        <p class="muted" style="margin-top:10px;">${escapeHtml(fallbackNote)}</p>
        <div class="btn-row">
          ${entry.portalUrl ? `<a class="btn btn-secondary" href="${escapeHtml(entry.portalUrl)}" target="_blank" rel="noopener">Open official permit portal</a>` : ''}
          <a class="btn btn-secondary" href="${buildPermitsStatePath(entry.state)}">Back to ${escapeHtml(stateName)}</a>
        </div>
      </aside>
    </div>
  </section>

  <section class="section">
    <div class="wrap">
      <div class="card cta-panel">
        <div class="section-head" style="margin-bottom:0;">
          <div class="kicker">PermitPulse paths</div>
          <h2>Need the broader permit view?</h2>
          <p class="lead">${escapeHtml(`Use the official portal first for ${entry.name} building permits, then move to the main PermitPulse permit page for the full jurisdiction view or Mission Control when the next step is unclear.`)}</p>
        </div>
        <div class="btn-row">
          <a class="btn btn-primary" href="${buildPermitsCityPath(entry)}">Open main permit page</a>
          <a class="btn btn-secondary" href="/mission-control/">Open Mission Control</a>
          <a class="btn btn-secondary" href="${buildPermitsStatePath(entry.state)}">Browse ${escapeHtml(stateName)}</a>
        </div>
      </div>
    </div>
  </section>

  <section class="section">
    <div class="wrap">
      <div class="section-head">
        <div class="kicker">Related links</div>
        <h2>More ways to navigate ${escapeHtml(entry.name)} permit coverage</h2>
        <p class="lead">These links keep the building-permits route connected to the main permit directory without adding non-catalog content.</p>
      </div>
      <div class="card">
        <div class="page-card-actions" style="font-size:14px;">
          <a class="link-line" href="${buildPermitsCityPath(entry)}">${escapeHtml(entry.name)} permit page</a>
          <a class="link-line" href="${buildPermitsStatePath(entry.state)}">${escapeHtml(stateName)} permit directory</a>
          <a class="link-line" href="/mission-control/">Mission Control</a>
          ${relatedEntries
            .map(
              (relatedEntry) =>
                `<a class="link-line" href="${buildPermitsCityPath(relatedEntry)}">${escapeHtml(relatedEntry.name)}, ${escapeHtml(stateName)}</a>`,
            )
            .join('\n          ')}
        </div>
      </div>
    </div>
  </section>
</main>
${renderFooter()}
${renderStickyCta()}
</body>
</html>
`;
}

function renderPermitPortalAliasPage(entry) {
  const canonicalPath = buildPermitsCityPath(entry);
  const stateName = getStateName(entry.state);
  return `${renderHead({
    title: `${entry.name}, ${stateName} Permit Portal Alias | PermitPulse`,
    description: `${entry.name}, ${stateName} alias route pointing to the canonical PermitPulse permit page.`,
    canonicalPath,
    structuredData: buildPermitsStructuredData({
      stateCode: entry.state,
      stateName,
      statePath: buildPermitsStatePath(entry.state),
      entry,
    }),
    robots: 'noindex,follow',
    extraHead: `<meta http-equiv="refresh" content="0; url=${canonicalPath}" />`,
  })}
<body>
${renderHeader()}
<main>
  <section class="wrap hero">
    <div class="hero-copy">
      <span class="badge">Permit portal alias</span>
      <h1>${escapeHtml(entry.name)} permit page</h1>
      <p class="lead">This alias route resolves to the canonical PermitPulse permit page for ${escapeHtml(entry.name)}.</p>
      <div class="btn-row">
        <a class="btn btn-primary" href="${canonicalPath}">Open canonical permit page</a>
        ${entry.portalUrl ? `<a class="btn btn-secondary" href="${escapeHtml(entry.portalUrl)}" target="_blank" rel="noopener">Open official permit portal</a>` : ''}
      </div>
    </div>
  </section>
</main>
${renderFooter()}
</body>
</html>
`;
}

async function writeTextFile(filePath, contents) {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, contents, 'utf8');
}

async function loadBaseSitemap() {
  const pagesSitemapPath = path.join(DIST_DIR, 'sitemap-pages.xml');
  const rootSitemapPath = path.join(DIST_DIR, 'sitemap.xml');

  try {
    return await readFile(pagesSitemapPath, 'utf8');
  } catch {}

  const currentSitemap = await readFile(rootSitemapPath, 'utf8');
  if (!currentSitemap.includes('<urlset')) {
    throw new Error('Expected the existing sitemap to be a urlset before splitting it into an index.');
  }
  return currentSitemap;
}

function renderJurisdictionSitemap(entries) {
  const urls = [
    '/california/jurisdictions/',
    ...entries.map((entry) => buildPagePath(entry.slug)),
  ];

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls
  .map(
    (pathname) => `  <url>
    <loc>${buildCanonical(pathname)}</loc>
    <lastmod>${LASTMOD}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>${pathname === '/california/jurisdictions/' ? '0.8' : '0.7'}</priority>
  </url>`,
  )
  .join('\n')}
</urlset>
`;
}

function renderPermitsSitemap(states) {
  const urls = [
    buildPermitsHubPath(),
    ...states.map((state) => buildPermitsStatePath(state.stateCode)),
    ...states.flatMap((state) => state.entries.map((entry) => buildPermitsCityPath(entry))),
  ];

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls
  .map(
    (pathname) => `  <url>
    <loc>${buildCanonical(pathname)}</loc>
    <lastmod>${LASTMOD}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>${pathname === buildPermitsHubPath() ? '0.8' : pathname.split('/').length === 4 ? '0.7' : '0.6'}</priority>
  </url>`,
  )
  .join('\n')}
</urlset>
`;
}

function renderBuildingPermitsSitemap(entries) {
  const urls = entries.map((entry) => buildBuildingPermitsCityPath(entry));

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls
  .map(
    (pathname) => `  <url>
    <loc>${buildCanonical(pathname)}</loc>
    <lastmod>${LASTMOD}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.6</priority>
  </url>`,
  )
  .join('\n')}
</urlset>
`;
}

function renderSitemapIndex() {
  return `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <sitemap>
    <loc>${SITE_URL}/sitemap-pages.xml</loc>
    <lastmod>${LASTMOD}</lastmod>
  </sitemap>
  <sitemap>
    <loc>${SITE_URL}/sitemap-jurisdictions.xml</loc>
    <lastmod>${LASTMOD}</lastmod>
  </sitemap>
  <sitemap>
    <loc>${SITE_URL}/sitemap-permits.xml</loc>
    <lastmod>${LASTMOD}</lastmod>
  </sitemap>
  <sitemap>
    <loc>${SITE_URL}/sitemap-building-permits.xml</loc>
    <lastmod>${LASTMOD}</lastmod>
  </sitemap>
</sitemapindex>
`;
}

async function main() {
  const entryMap = new Map(LAUNCH_JURISDICTIONS.map((entry) => [entry.slug, entry]));
  const permitsHubDir = path.join(DIST_DIR, 'permits');
  const buildingPermitsDir = path.join(DIST_DIR, 'building-permits');
  const permitPortalDir = path.join(DIST_DIR, 'permit-portal');
  const usJurisdictions = getEnabledUsJurisdictions();
  const stateGroups = groupJurisdictionsByState(usJurisdictions);
  const stateEntriesByCode = mapJurisdictionsByState(stateGroups);

  await rm(permitsHubDir, { recursive: true, force: true });
  await rm(buildingPermitsDir, { recursive: true, force: true });
  await rm(permitPortalDir, { recursive: true, force: true });
  await writeTextFile(path.join(DIST_DIR, 'assets', 'jurisdictions.css'), CSS.trimStart());
  await writeTextFile(path.join(HUB_DIR, 'index.html'), renderHubPage(LAUNCH_JURISDICTIONS));
  await writeTextFile(path.join(permitsHubDir, 'index.html'), renderPermitsHubPage(stateGroups));

  for (const entry of LAUNCH_JURISDICTIONS) {
    const outputPath = path.join(HUB_DIR, entry.slug, 'index.html');
    await writeTextFile(outputPath, renderJurisdictionPage(entry, entryMap));
  }

  for (const state of stateGroups) {
    await writeTextFile(
      path.join(permitsHubDir, state.stateSlug, 'index.html'),
      renderPermitsStatePage(state),
    );

    for (const entry of state.entries) {
      await writeTextFile(
        path.join(permitsHubDir, state.stateSlug, getJurisdictionSlug(entry), 'index.html'),
        renderPermitsCityPage(entry, stateEntriesByCode.get(state.stateCode) || []),
      );
      await writeTextFile(
        path.join(buildingPermitsDir, state.stateSlug, getJurisdictionSlug(entry), 'index.html'),
        renderBuildingPermitsCityPage(entry, stateEntriesByCode.get(state.stateCode) || []),
      );
      await writeTextFile(
        path.join(permitPortalDir, state.stateSlug, getJurisdictionSlug(entry), 'index.html'),
        renderPermitPortalAliasPage(entry),
      );
    }
  }

  const baseSitemap = await loadBaseSitemap();
  await writeTextFile(path.join(DIST_DIR, 'sitemap-pages.xml'), baseSitemap);
  await writeTextFile(
    path.join(DIST_DIR, 'sitemap-jurisdictions.xml'),
    renderJurisdictionSitemap(LAUNCH_JURISDICTIONS),
  );
  await writeTextFile(
    path.join(DIST_DIR, 'sitemap-permits.xml'),
    renderPermitsSitemap(stateGroups),
  );
  await writeTextFile(
    path.join(DIST_DIR, 'sitemap-building-permits.xml'),
    renderBuildingPermitsSitemap(usJurisdictions),
  );
  await writeTextFile(path.join(DIST_DIR, 'sitemap.xml'), renderSitemapIndex());
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
