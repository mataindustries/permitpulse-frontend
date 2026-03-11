import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { JURISDICTIONS } from '../workers/pp-api/src/config/jurisdictions.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, '..');
const DIST_DIR = path.join(ROOT_DIR, 'dist');
const HUB_DIR = path.join(DIST_DIR, 'california', 'jurisdictions');
const SITE_URL = 'https://getpermitpulse.com';
const STRIPE_URL = 'https://buy.stripe.com/3cI3cw1qT9aP6Jx2Fs1wY0e';
const LASTMOD = '2026-03-11';
const OG_IMAGE = `${SITE_URL}/img/permitpulse-og-los-angeles-permit-radar.webp`;
const GUIDE_LIBRARY = {
  losAngelesHistory: {
    href: '/guides/how-to-check-permit-history-los-angeles/',
    title: 'How to Check Permit History in Los Angeles',
    summary:
      'A practical LADBS-first workflow for permit history checks, routing, and escalation.',
  },
  laCityCounty: {
    href: '/guides/la-city-vs-county-permits/',
    title: 'Los Angeles City vs County Permits',
    summary:
      'A short routing guide for LADBS versus EPIC-LA addresses and mixed-jurisdiction confusion.',
  },
  sacramentoPortal: {
    href: '/guides/how-to-use-sacramento-permit-portal/',
    title: 'How to Use the Sacramento Permit Portal',
    summary:
      'What to search, what to save, and when portal review stops being enough.',
  },
  santaMonicaDiligence: {
    href: '/guides/property-due-diligence-santa-monica/',
    title: 'What to Verify Before Buying a Property in Santa Monica',
    summary:
      'A local permit-focused checklist for acquisition and property diligence.',
  },
  californiaAdu: {
    href: '/guides/adu-permit-due-diligence-checklist-california/',
    title: 'ADU Permit Due Diligence Checklist for California Owners',
    summary:
      'A statewide checklist for jurisdiction checks, permit history review, and ADU handoffs.',
  },
};

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
    guideLinks: [GUIDE_LIBRARY.losAngelesHistory, GUIDE_LIBRARY.laCityCounty],
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
    guideLinks: [GUIDE_LIBRARY.laCityCounty],
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
    guideLinks: [GUIDE_LIBRARY.sacramentoPortal, GUIDE_LIBRARY.californiaAdu],
  },
  {
    slug: 'santa-monica',
    jurisdictionId: 'santa_monica',
    name: 'Santa Monica',
    title: 'Santa Monica Permit History + Risk Report | PermitPulse',
    h1: 'Santa Monica permit history and risk report',
    description:
      'Search Santa Monica permit history, official Citizen Access records, and PermitPulse coverage for remodels, reroofs, and plan review due diligence.',
    intro:
      'Santa Monica runs a paperless permit stack that is efficient once you know the workflow and slower when you do not. This page gives you a concise starting point for current permit history, the official city portal, and the right moment to request a full report.',
    summary:
      'Santa Monica permit coverage for issued records, reroofs, remodels, and digital plan review workflows.',
    officialPortalUrl: 'https://epermit.smgov.net/CitizenAccess/Default.aspx',
    officialPortalLabel: 'Open Santa Monica Citizen Access',
    officialPortalNote:
      'Santa Monica routes permit application intake through Citizen Access and document workflow through Electronic Plan Review.',
    focusPoints: [
      'Check permit number, address, issue timing, and valuation before relying on a partial project narrative.',
      'Spot reroofs, remodels, and building activity that can affect pricing, diligence, or close-out assumptions.',
      'Escalate when a project likely spans Citizen Access and EPR tasks that are easier to read in one report.',
    ],
    coverageNotes: [
      'PermitPulse has live search coverage for Santa Monica permit records and can surface recent issued activity quickly.',
      'Citizen Access remains the official city portal for direct application and permit lookup tasks.',
      'Request a Permit History + Risk Report when project sequencing, corrections, or missing attachments matter to the decision.',
    ],
    related: ['culver-city', 'beverly-hills', 'los-angeles'],
    guideLinks: [GUIDE_LIBRARY.santaMonicaDiligence, GUIDE_LIBRARY.californiaAdu],
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
    jurisdictionId: null,
    name: 'Pasadena',
    title: 'Pasadena Permit History + Risk Report | PermitPulse',
    h1: 'Pasadena permit history and risk report',
    description:
      'Review Pasadena permit history, official permit portal access, and PermitPulse support for address-level permit diligence before design, bidding, or acquisition decisions.',
    intro:
      'Pasadena projects often turn on older housing stock, layered remodel history, and permit records that need context rather than a quick skim. This page gives you the official portal lane and a cleaner path to a report when the address matters.',
    summary:
      'Portal-assisted Pasadena permit coverage for address research, permit routing, and report requests.',
    officialPortalUrl: 'https://mypermits.cityofpasadena.net/',
    officialPortalLabel: 'Open Pasadena permit portal',
    officialPortalNote:
      'Pasadena routes online permit activity through the city permit portal and Permit Center online workflow.',
    focusPoints: [
      'Confirm the correct Pasadena permit lane before relying on a partial project memory or stale paperwork.',
      'Use the official portal to anchor address-level research and separate routine permit history from higher-risk questions.',
      'Escalate when older remodels, additions, or unclear permit close-out make the record harder to trust.',
    ],
    coverageNotes: [
      'PermitPulse currently treats Pasadena as a portal-assisted jurisdiction for public launch pages.',
      'This is the right fit when you need the official city portal plus a fast path to a manual Permit History + Risk Report.',
      'Use a report when permit history, scope changes, or unresolved status questions affect your next decision.',
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

.guide-grid {
  display: grid;
  gap: 18px;
  grid-template-columns: repeat(2, minmax(0, 1fr));
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
  .hub-grid,
  .guide-grid {
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

function buildPagePath(slug) {
  return `/california/jurisdictions/${slug}/`;
}

function buildStatus(entry) {
  const source = entry.jurisdictionId ? JURISDICTION_SOURCE.get(entry.jurisdictionId) : null;
  if (source && source.provider && source.enabled !== false) {
    return { label: 'Live search', className: 'live' };
  }
  return { label: 'Portal-assisted', className: 'portal' };
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

function renderHead({ title, description, canonicalPath, structuredData, pageType = 'website' }) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(title)}</title>
  <meta name="description" content="${escapeHtml(description)}" />
  <meta name="robots" content="index,follow" />
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
  <script type="application/ld+json">${JSON.stringify(structuredData)}</script>
</head>`;
}

function renderHeader() {
  return `<header>
  <div class="wrap nav-inner">
    <a href="/" class="logo">PermitPulse <span style="color:var(--accent-orange);">/</span> Beta</a>
    <nav class="nav-links mono" style="font-size:13px;">
      <a href="/california/jurisdictions/">California hub</a>
      <a href="/california-permit-history/">California search</a>
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
        <a href="/california/jurisdictions/" class="link-line">California hub</a>
        <a href="/california-permit-history/" class="link-line">California search</a>
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
  <a class="sticky-ghost" href="/california/jurisdictions/">Browse California hub</a>
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

function renderGuideCards(guideLinks = []) {
  return guideLinks
    .map(
      (guide) => `<a class="card soft page-card" href="${escapeHtml(guide.href)}">
  <div class="eyebrow">
    <span class="pill portal">Guide</span>
  </div>
  <div>
    <h3 style="margin-bottom:8px;">${escapeHtml(guide.title)}</h3>
    <p>${escapeHtml(guide.summary)}</p>
  </div>
</a>`,
    )
    .join('\n');
}

function renderJurisdictionPage(entry, entryMap) {
  const status = buildStatus(entry);
  const pathname = buildPagePath(entry.slug);
  const relatedCards = renderRelatedCards(entry, entryMap);
  const guideCards = renderGuideCards(entry.guideLinks ?? []);
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

  ${
    guideCards
      ? `<section class="section">
    <div class="wrap">
      <div class="section-head">
        <div class="kicker">Related guides</div>
        <h2>Need context before you request the report?</h2>
        <p class="lead">These guide pages help users route the question correctly before they escalate to property-level review.</p>
      </div>
      <div class="guide-grid">
        ${guideCards}
      </div>
    </div>
  </section>`
      : ''
  }

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
      </div>
      <div class="stats">
        <div class="stat">
          <strong>${entries.length}</strong>
          <span class="muted">Launch jurisdiction pages</span>
        </div>
        <div class="stat">
          <strong>${liveCount}</strong>
          <span class="muted">Pages tied to live public datasets</span>
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
          <h2>Need more than a single jurisdiction page?</h2>
          <p class="lead">Use the California permit history search for broader scanning, the guides hub for workflow context, and the launch page when you want the current rollout summarized in one place.</p>
        </div>
        <div class="btn-row">
          <a class="btn btn-secondary" href="/california-permit-history/">Open California permit search</a>
          <a class="btn btn-secondary" href="/guides/">Open guides hub</a>
          <a class="btn btn-secondary" href="/launch/permitpulse-california-launch/">Read launch page</a>
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

function renderSitemapIndex() {
  return `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <sitemap>
    <loc>${SITE_URL}/sitemap-pages.xml</loc>
    <lastmod>${LASTMOD}</lastmod>
  </sitemap>
  <sitemap>
    <loc>${SITE_URL}/sitemap-guides.xml</loc>
    <lastmod>${LASTMOD}</lastmod>
  </sitemap>
  <sitemap>
    <loc>${SITE_URL}/sitemap-jurisdictions.xml</loc>
    <lastmod>${LASTMOD}</lastmod>
  </sitemap>
</sitemapindex>
`;
}

async function main() {
  const entryMap = new Map(LAUNCH_JURISDICTIONS.map((entry) => [entry.slug, entry]));

  await writeTextFile(path.join(DIST_DIR, 'assets', 'jurisdictions.css'), CSS.trimStart());
  await writeTextFile(path.join(HUB_DIR, 'index.html'), renderHubPage(LAUNCH_JURISDICTIONS));

  for (const entry of LAUNCH_JURISDICTIONS) {
    const outputPath = path.join(HUB_DIR, entry.slug, 'index.html');
    await writeTextFile(outputPath, renderJurisdictionPage(entry, entryMap));
  }

  const baseSitemap = await loadBaseSitemap();
  await writeTextFile(path.join(DIST_DIR, 'sitemap-pages.xml'), baseSitemap);
  await writeTextFile(
    path.join(DIST_DIR, 'sitemap-jurisdictions.xml'),
    renderJurisdictionSitemap(LAUNCH_JURISDICTIONS),
  );
  await writeTextFile(path.join(DIST_DIR, 'sitemap.xml'), renderSitemapIndex());
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
