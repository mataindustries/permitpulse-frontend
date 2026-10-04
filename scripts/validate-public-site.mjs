import { readFile, readdir, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const distRoot = path.join(repoRoot, "dist");
const failures = [];
const passes = [];

function check(condition, label, detail = "") {
  if (condition) {
    passes.push(label);
    return;
  }
  failures.push(label + (detail ? ": " + detail : ""));
}

async function exists(file) {
  try {
    await stat(file);
    return true;
  } catch {
    return false;
  }
}

async function walk(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const results = await Promise.all(entries.map(async (entry) => {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) return walk(absolute);
    return [absolute];
  }));
  return results.flat();
}

function rel(file) {
  return path.relative(distRoot, file).split(path.sep).join("/");
}

function routeForFile(file) {
  const relative = rel(file);
  if (relative === "index.html") return "/";
  if (relative.endsWith("/index.html")) return "/" + relative.slice(0, -10);
  return "/" + relative;
}

function attribute(tag, name) {
  const match = tag.match(new RegExp("\\b" + name + "=[\"']([^\"']*)[\"']", "i"));
  return match ? match[1] : "";
}

function jsonLdBlocks(html, fileLabel) {
  const blocks = [];
  const pattern = /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let match;
  while ((match = pattern.exec(html))) {
    try {
      blocks.push(JSON.parse(match[1]));
    } catch (error) {
      failures.push("Valid JSON-LD in " + fileLabel + ": " + error.message);
    }
  }
  return blocks;
}

function duplicateIds(html) {
  const counts = new Map();
  for (const match of html.matchAll(/\bid=["']([^"']+)["']/gi)) {
    counts.set(match[1], (counts.get(match[1]) || 0) + 1);
  }
  return [...counts.entries()].filter(([, count]) => count > 1).map(([id]) => id);
}

// Opening tags still open at `index`; enough to check ancestry in hand-written static HTML.
function openElementsBefore(html, index) {
  const voidTags = new Set(["area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta", "source", "track", "wbr"]);
  const stack = [];
  for (const [tag, closing, rawName] of html.slice(0, index).matchAll(/<(\/?)([a-z][a-z0-9-]*)\b[^>]*>/gi)) {
    const name = rawName.toLowerCase();
    if (closing) {
      const at = stack.map((entry) => entry.name).lastIndexOf(name);
      if (at !== -1) stack.length = at;
    } else if (!voidTags.has(name) && !tag.endsWith("/>")) {
      stack.push({ name, tag });
    }
  }
  return stack.map((entry) => entry.tag);
}

function redirectMatchers(source) {
  if (!source.includes("*")) return null;
  const escaped = source.split("*").map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join(".*");
  return new RegExp("^" + escaped + "$");
}

const requiredFiles = [
  "index.html",
  "case-integrity/index.html",
  "sample-report/index.html",
  "resources/index.html",
  "resources/does-sb79-low-rise-apply-los-angeles-property/index.html",
  "resources/los-angeles-housing-programs-chip-sb79-sb684-sb1123/index.html",
  "free-tools/site-check/index.html",
  "resources/permit-drops/los-angeles-building-records-online-first/index.html",
  "resources/how-to-check-permit-history-los-angeles/index.html",
  "resources/permit-nightmares/nine-departments-one-paper-trail/index.html",
  "about/index.html",
  "legal/index.html",
  "assets/permitpulse-tracking.js",
  "assets/case-integrity-demo.js",
  "assets/case-integrity-demo.css",
  "assets/case-integrity-demo-data.json",
  "assets/platform-home.js",
  "assets/platform-home.css",
  "assets/home-motion.css",
  "assets/home-motion.js",
  "assets/site-check.js",
  "assets/site-check.css",
  "sitemap-pages.xml",
  "_redirects"
];

for (const required of requiredFiles) {
  check(await exists(path.join(distRoot, required)), "Required public file " + required);
}

const allFiles = await walk(distRoot);
const htmlFiles = allFiles.filter((file) => file.endsWith(".html"));
const htmlByRel = new Map();
for (const file of htmlFiles) htmlByRel.set(rel(file), await readFile(file, "utf8"));

const home = htmlByRel.get("index.html") || "";
const caseIntegrityDemo = htmlByRel.get("case-integrity/index.html") || "";
const sample = htmlByRel.get("sample-report/index.html") || "";
const resources = htmlByRel.get("resources/index.html") || "";
const siteCheck = htmlByRel.get("free-tools/site-check/index.html") || "";
const housingGuides = [
  "resources/does-sb79-low-rise-apply-los-angeles-property/index.html",
  "resources/los-angeles-housing-programs-chip-sb79-sb684-sb1123/index.html"
];
const legal = htmlByRel.get("legal/index.html") || "";
const bostonPermitPage = htmlByRel.get("permits/massachusetts/boston/index.html") || "";
const tracking = await readFile(path.join(distRoot, "assets/permitpulse-tracking.js"), "utf8");
const formScript = await readFile(path.join(distRoot, "assets/platform-home.js"), "utf8");
const siteCheckScript = await readFile(path.join(distRoot, "assets/site-check.js"), "utf8");
const caseIntegrityDemoScript = await readFile(path.join(distRoot, "assets/case-integrity-demo.js"), "utf8");
const caseIntegrityDemoCss = await readFile(path.join(distRoot, "assets/case-integrity-demo.css"), "utf8");
let caseIntegrityDemoData = {};
try {
  caseIntegrityDemoData = JSON.parse(await readFile(path.join(distRoot, "assets/case-integrity-demo-data.json"), "utf8"));
} catch (error) {
  failures.push("Valid public Case Integrity demo data: " + error.message);
}
const css = await readFile(path.join(distRoot, "assets/platform-home.css"), "utf8");
const homeMotionCssFile = path.join(distRoot, "assets/home-motion.css");
const homeMotionJsFile = path.join(distRoot, "assets/home-motion.js");
const homeMotionCss = (await exists(homeMotionCssFile)) ? await readFile(homeMotionCssFile, "utf8") : "";
const homeMotionScript = (await exists(homeMotionJsFile)) ? await readFile(homeMotionJsFile, "utf8") : "";
const redirectsText = await readFile(path.join(distRoot, "_redirects"), "utf8");
const sitemap = await readFile(path.join(distRoot, "sitemap-pages.xml"), "utf8");
const jurisdictionConfig = await readFile(path.join(repoRoot, "workers/pp-api/src/config/jurisdictions.js"), "utf8");
const belmontBuildingPermitsPage = htmlByRel.get("building-permits/california/belmont/index.html") || "";
const santaMonicaJurisdictionPage = htmlByRel.get("california/jurisdictions/santa-monica/index.html") || "";

const auxSitemapNames = ["sitemap-jurisdictions.xml", "sitemap-permits.xml", "sitemap-building-permits.xml"];
const auxSitemaps = [];
for (const name of auxSitemapNames) {
  const file = path.join(distRoot, name);
  if (await exists(file)) auxSitemaps.push([name, await readFile(file, "utf8")]);
}

const homepageRequirements = [
  "Know what the official record says before you bet on the site.",
  "Send a property",
  "Never guess.",
  "Parcel Research Brief",
  "$149 per property",
  "Three properties for $299 total.",
  "within 48 business hours after scope and payment are confirmed",
  "One round of follow-up questions within 14 days",
  "SUPPORTED",
  "CONFLICT",
  "UNKNOWN",
  "data-pp-form-type=\"permit_deep_research\"",
  "data-pp-start-event=\"research_intake_start\"",
  "data-pp-submit-event=\"research_intake_success\""
];
for (const required of homepageRequirements) check(home.includes(required), "Homepage includes " + required);
check((home.match(/<h1\b/gi) || []).length === 1, "Homepage has one H1");
check((home.match(/data-pp-form-type="permit_deep_research"/g) || []).length === 1, "Homepage has one Permit Deep Research form");
check(home.includes("This confirms receipt only; it does not confirm acceptance, payment, or a research conclusion."), "Homepage success state is receipt-only");
check(home.includes("formspree.io/f/mbdwdklj"), "Homepage retains established Formspree intake");
check(home.includes("Names, emails, addresses, and request contents are not sent in analytics events."), "Homepage states analytics PII boundary");
check(home.includes('href="/case-integrity/"'), "Homepage links to the Case Integrity demo");
check(!home.includes("\u2014"), "Homepage copy has no em dash");
const neverGuessSection = (home.match(/<section\b[^>]*\bid="never-guess"[^>]*>[\s\S]*?<\/section>/i) || [""])[0];
const legalLotCard = (neverGuessSection.match(/<article\b[^>]*>([\s\S]*?)<\/article>/i) || ["", ""])[1];
check(legalLotCard.replace(/\s+/g, " ").trim() === "<h3>A parcel line isn't proof of a legal lot.</h3> <p>City map parcels and assessor numbers don't establish legal-lot status. If that question matters, the brief flags it for review against recorded documents and the appropriate professional or agency.</p>", "Homepage legal-lot card flags professional or agency review without offering a determination");

const homeIntakeSection = (home.match(/<section\b[^>]*\bid="research-intake"[^>]*>[\s\S]*?<\/section>/i) || [""])[0];
const homeForm = (homeIntakeSection.match(/<form\b[^>]*>/i) || [""])[0];
check(Boolean(homeIntakeSection), "Homepage keeps the #research-intake section");
for (const [name, value] of [
  ["id", "permit-deep-research-form"],
  ["action", "https://formspree.io/f/mbdwdklj"],
  ["data-pp-form-type", "permit_deep_research"],
  ["data-pp-start-event", "research_intake_start"],
  ["data-pp-submit-event", "research_intake_success"],
  ["data-pp-success-target", "research-form-success"],
  ["data-pp-error-target", "research-form-error"]
]) {
  check(attribute(homeForm, name) === value, "Homepage intake form keeps " + name + "=\"" + value + "\"");
}
check(/\sdata-pp-async-form[\s>]/.test(homeForm), "Homepage intake form stays async");
for (const id of ["research-form-success", "research-form-error"]) {
  check(homeIntakeSection.includes('id="' + id + '"'), "Homepage intake keeps #" + id);
}
for (const name of ["_subject", "form_name", "lead_type", "lead_source", "page_url"]) {
  check(new RegExp('<input type="hidden" name="' + name + '"').test(homeIntakeSection), "Homepage intake keeps hidden " + name);
}
check(/name="_gotcha"[^>]*tabindex="-1"/.test(homeIntakeSection), "Homepage intake keeps the _gotcha honeypot");
for (const name of ["property_address", "research_goal", "research_context", "name", "email"]) {
  check(homeIntakeSection.includes('name="' + name + '"'), "Homepage intake keeps field " + name);
}
const researchGoalSelect = (homeIntakeSection.match(/<select name="research_goal"[\s\S]*?<\/select>/) || [""])[0];
check(/<option>Planning a build or remodel<\/option>/.test(researchGoalSelect), "Homepage research_goal keeps the Site Check handoff option");
const offerSelect = (homeIntakeSection.match(/<select name="properties_requested"[\s\S]*?<\/select>/) || [""])[0];
if (offerSelect) {
  check(/<option value="one"[^>]*>One \(\$149\)<\/option>/.test(offerSelect) && /<option value="three">Three \(\$299\)<\/option>/.test(offerSelect), "Homepage offer select uses only the one/three values");
  check(formScript.includes('offerField.value === "one" || offerField.value === "three"'), "Intake analytics sends only the fixed offer value");
}
for (const location of ["homepage_nav_intake", "homepage_hero_intake", "homepage_hero_sample", "homepage_proof_case_integrity", "homepage_proof_sample", "homepage_footer_intake", "homepage_motion_intake"]) {
  check((home.match(new RegExp('data-pp-location="' + location + '"', "g")) || []).length === 1, "Homepage keeps CTA location " + location);
}
// Pre-V2 links and bookmarks point at /#workflow; it now lands on the proof process ledger.
check((home.match(/\bid="workflow"/g) || []).length === 1, "Homepage keeps the legacy #workflow anchor");
const caseIntegrityProofLink = (home.match(/<a\b[^>]*data-pp-location="homepage_proof_case_integrity"[^>]*>/) || [""])[0];
check(attribute(caseIntegrityProofLink, "href") === "/case-integrity/" && attribute(caseIntegrityProofLink, "data-pp-event") === "pp_case_integrity_demo_open", "Homepage proof link opens the Case Integrity demo with its event");
check(home.includes('href="/assets/home-motion.css"'), "Homepage links its hero card stylesheet");
const heroCardIndex = home.indexOf('<figure class="pp-motion" data-pp-motion');
check(heroCardIndex !== -1 && openElementsBefore(home, heroCardIndex).every((tag) => !/\sdata-reveal[\s>=]/.test(tag)), "Homepage hero card sits outside data-reveal");
const homeOgImage = (home.match(/<meta property="og:image" content="https:\/\/getpermitpulse\.com\/([^"]+)"/) || [])[1] || "";
check(Boolean(homeOgImage) && await exists(path.join(distRoot, homeOgImage)), "Homepage og:image exists in dist", homeOgImage);
check(home.includes('<meta name="twitter:image" content="https://getpermitpulse.com/' + homeOgImage + '"'), "Homepage twitter:image matches og:image");
const homeVisibleText = home.replace(/<script\b[\s\S]*?<\/script>/gi, " ").replace(/<[^>]+>/g, " ");
const overclaimHits = ["verified", "accurate", "guaranteed", "AI-powered", "instant", "eligible", "buildable", "complete", "trusted by"]
  .filter((word) => new RegExp("\\b" + word + "\\b", "i").test(homeVisibleText));
check(overclaimHits.length === 0, "Homepage copy avoids overclaiming words", overclaimHits.join(", "));
const heroCardStylesheetElsewhere = [...htmlByRel.entries()].filter(([name, html]) => name !== "index.html" && html.includes("home-motion.css")).map(([name]) => name);
check(heroCardStylesheetElsewhere.length === 0, "Hero card stylesheet stays homepage-only", heroCardStylesheetElsewhere.join(", "));

// Hero card motion: an enhancement over the static final frame, never a dependency.
const heroCta = (home.match(/<a\b[^>]*data-pp-location="homepage_hero_intake"[^>]*>[\s\S]*?<\/a>/) || [""])[0];
check(attribute(heroCta, "href") === "#research-intake" && attribute(heroCta, "data-pp-cta") === "true" && heroCta.includes(">Send a property "), "Hero CTA still sends a property to #research-intake");
check(home.includes('<script defer src="/assets/home-motion.js"></script>'), "Homepage loads the hero card motion script with defer");
const heroMotionScriptElsewhere = [...htmlByRel.entries()].filter(([name, html]) => name !== "index.html" && html.includes("home-motion.js")).map(([name]) => name);
check(heroMotionScriptElsewhere.length === 0, "Hero card motion script stays homepage-only", heroMotionScriptElsewhere.join(", "));
const heroCard = (home.match(/<figure class="pp-motion" data-pp-motion>[\s\S]*?<\/figure>/) || [""])[0];
check(heroCard.includes('<figcaption class="sr-only">Illustration of a Parcel Research Brief for a fictional Los Angeles parcel. The parcel is shown as mapped by the City. Zoning designation: supported, cited to ZIMAS. Fire hazard zone mapping: conflict; CAL FIRE and ZIMAS disagree, and both are shown. Older permit records: unknown; not found online, which is not proof none exist. Every finding is cited and reviewed by a person. Never guess. Evidence first. Unknown when it isn\'t enough.</figcaption>'), "Hero card has an equivalent text summary for assistive technology");
check(heroCard.includes('<div class="pp-motion__art" aria-hidden="true">'), "Hero card animated illustration is aria-hidden");
for (const required of ["Fictional parcel", "PARCEL RESEARCH BRIEF", "SUPPORTED", "CONFLICT", "UNKNOWN", "EVERY FINDING CITED · REVIEWED BY A PERSON", "NEVER GUESS", "Evidence first. Unknown when it isn't enough."]) {
  check(heroCard.includes(required), "Hero card keeps " + required);
}
const motionCta = (heroCard.match(/<a\b[^>]*class="pp-motion__cta"[^>]*>/) || [""])[0];
check(attribute(motionCta, "href") === "#research-intake" && attribute(motionCta, "data-pp-cta") === "true" && attribute(motionCta, "data-pp-location") === "homepage_motion_intake", "Hero card CTA sends a property to #research-intake");
check(/<button class="pp-motion__control" type="button" hidden>Pause<\/button>/.test(heroCard), "Hero card motion control starts hidden as a Pause button");
check(!/<(a|button|input|select|textarea)\b/i.test((heroCard.match(/<div class="pp-motion__art"[\s\S]*?<div class="pp-motion__actions">/) || [""])[0]), "Hero card aria-hidden illustration has no focusable controls");
check(homeMotionCss.includes("@media (max-width: 560px)") && homeMotionScript.includes('matchMedia("(max-width: 560px)")'), "Hero card motion keys its fast cut to max-width: 560px");
check(homeMotionCss.includes("@media (prefers-reduced-motion: reduce)") && homeMotionScript.includes('matchMedia("(prefers-reduced-motion: reduce)")'), "Hero card motion respects prefers-reduced-motion");
check(homeMotionScript.includes("saveData === true") && homeMotionScript.includes('"IntersectionObserver" in window'), "Hero card motion falls back to the static card for Save-Data and missing IntersectionObserver");
check(homeMotionScript.includes('typeof window.ppTrack === "function"') && homeMotionScript.includes('window.ppTrack("pp_motion_complete", { cut: cut })') && (homeMotionScript.match(/ppTrack\(/g) || []).length === 1, "Hero card motion reports only pp_motion_complete with its cut");
const motionNetworkHits = ["fetch(", "XMLHttpRequest", "sendBeacon", "import("].filter((token) => homeMotionScript.includes(token));
check(motionNetworkHits.length === 0, "Hero card motion script makes no network requests", motionNetworkHits.join(", "));
check(!/infinite/i.test(homeMotionCss + homeMotionScript), "Hero card motion never loops");
check(!(homeMotionCss + homeMotionScript).includes("\u2014"), "Hero card motion has no em dash");
check(Buffer.byteLength(homeMotionCss) <= 10240 && Buffer.byteLength(homeMotionScript) <= 5120, "Hero card motion stays within 10KB CSS and 5KB JS", Buffer.byteLength(homeMotionCss) + " / " + Buffer.byteLength(homeMotionScript));

const caseIntegrityDemoRequirements = [
  "See what PermitPulse catches before you build.",
  "Two official sources disagree.",
  "Fictional sample property",
  "Run Case Integrity check",
  "Source conflict found",
  "PermitPulse won’t guess.",
  "Client-safe conclusion",
  "Next question",
  "Not returned does not mean “no.”",
  "Research my property",
  'href="/#research-intake"',
  "Fixture-powered demo analysis. No external agency system is contacted",
  "data-case-integrity-demo"
];
for (const required of caseIntegrityDemoRequirements) {
  check(caseIntegrityDemo.includes(required), "Case Integrity demo includes " + required);
}
check(caseIntegrityDemo.includes("readonly"), "Case Integrity sample address cannot imply a different property lookup");
check(!caseIntegrityDemo.includes("CAL FIRE") && !caseIntegrityDemo.includes(">YES<") && !caseIntegrityDemo.includes(">NO<"), "Case Integrity evidence is not duplicated in presentation HTML");
check(caseIntegrityDemoScript.includes('window.fetch("/assets/case-integrity-demo-data.json"'), "Case Integrity browser reads the generated static fixture payload");
check(!/https?:\/\//i.test(caseIntegrityDemoScript), "Case Integrity browser makes no external request");
check((caseIntegrityDemoScript.match(/window\.fetch\(/g) || []).length === 1, "Case Integrity browser makes only its static payload request");
check(caseIntegrityDemoScript.includes('conflict.classification !== "conflict"'), "Case Integrity presentation fails closed unless V2 reports conflict");
check(caseIntegrityDemoScript.includes('conflict.normalized_value.kind !== "unresolved"'), "Case Integrity presentation fails closed unless V2 remains unresolved");
check(!caseIntegrityDemoScript.includes("CAL FIRE") && !caseIntegrityDemoScript.includes("ZIMAS / City source"), "Case Integrity source identity comes from the V2 payload");
check(caseIntegrityDemoCss.includes("@media (max-width: 360px)"), "Case Integrity demo covers narrow Android widths");
check(caseIntegrityDemoCss.includes("@media (prefers-reduced-motion: reduce)"), "Case Integrity demo respects reduced motion");

const demoConflict = caseIntegrityDemoData.conflict || {};
const demoEvidence = Array.isArray(demoConflict.evidence) ? demoConflict.evidence : [];
const demoUnknown = caseIntegrityDemoData.unknown_example || {};
check(caseIntegrityDemoData.demo_kind === "fixture_powered", "Public Case Integrity data declares fixture-powered behavior");
check(caseIntegrityDemoData.sample_property?.fictional === true, "Public Case Integrity property is explicitly fictional");
check(caseIntegrityDemoData.integrity_boundary?.deterministic_validation === true, "Public Case Integrity data passed deterministic validation");
check(caseIntegrityDemoData.integrity_boundary?.ai_used === false, "Public Case Integrity demo uses no AI interpretation");
check(demoConflict.classification === "conflict", "Public Case Integrity data retains conflict classification");
check(demoConflict.normalized_value?.kind === "unresolved" && demoConflict.normalized_value?.value === null, "Public Case Integrity conflict has no YES or NO conclusion");
check(demoConflict.confidence?.classification === 100 && demoConflict.confidence?.conclusion === null, "Public Case Integrity separates conflict confidence from conclusion confidence");
check(demoConflict.human_review_required === true, "Public Case Integrity conflict retains human review");
check(demoConflict.ai_interpretation === null, "Public Case Integrity conflict contains no AI evidence");
check(demoConflict.statement === "Official sources conflict regarding the property's fire-hazard designation.", "Public Case Integrity data retains approved client-safe wording");
check(demoEvidence.length === 2, "Public Case Integrity data preserves both conflicting records");
check(demoEvidence.map((record) => record.observed_display_value).join("|") === "YES|NO", "Public Case Integrity data preserves both observed values without selecting one");
check(demoEvidence.map((record) => record.source?.source_agency).join("|") === "CAL FIRE|ZIMAS / City source", "Public Case Integrity data preserves both source identities");
check(demoEvidence.map((record) => record.source?.retrieved_at).join("|") === "2026-07-10T16:05:00.000Z|2026-07-10T16:12:00.000Z", "Public Case Integrity data preserves both retrieval timestamps");
check(demoEvidence.every((record) => record.source?.record_origin === "source_evidence" && record.provenance?.is_ai_generated === false), "Public Case Integrity evidence remains source evidence, never AI output");
check(demoUnknown.separate_sample === true, "Unknown example is not attributed to the conflict property");
check(demoUnknown.classification === "unknown" && demoUnknown.normalized_value?.kind === "unknown", "Public Case Integrity failed lookup remains unknown");
check(demoUnknown.confidence?.conclusion === null, "Public Case Integrity unknown has no conclusion confidence");

const homeJson = jsonLdBlocks(home, "dist/index.html");
const service = homeJson.find((item) => item && item["@type"] === "Service");
check(Boolean(service), "Homepage has Service structured data");
const serviceOffers = service && Array.isArray(service.offers) ? service.offers : [];
check(service && service.name === "Parcel Research Brief", "Structured service uses the chosen offer");
check(serviceOffers.map((offer) => String(offer.price) + " " + offer.priceCurrency).join("|") === "149 USD|299 USD", "Structured offers are $149 one property and $299 three properties");
check(serviceOffers.every((offer) => /no online checkout/.test(offer.description || "")), "Structured offers do not imply online checkout");
check(service && service.areaServed && service.areaServed.name === "City of Los Angeles", "Structured offer states City of Los Angeles coverage");

check(sample.includes("Actual completed research"), "Sample identifies actual completed research");
check(sample.includes("anonymized reconstruction"), "Sample labels the reconstruction");
check(sample.includes("not the original source packet or a complete customer brief"), "Sample states what is withheld");
check(sample.includes("data-pp-sample-page="), "Sample page has view analytics metadata");
check(sample.includes("fictional format sample"), "Fictional PDF is labeled format-only");
check(!sample.includes('http-equiv="refresh"'), "Sample does not auto-redirect to a fictional PDF");

const contentRoutes = [
  ["permit-drops/los-angeles-building-records-online-first/index.html", "permit_drop", "la_building_records_online_first"],
  ["how-to-check-permit-history-los-angeles/index.html", "paper_trail_playbook", "check_la_permit_history"],
  ["permit-nightmares/nine-departments-one-paper-trail/index.html", "permit_nightmare", "nine_departments_one_paper_trail"]
];

for (const [suffix, lane, id] of contentRoutes) {
  const key = "resources/" + suffix;
  const html = htmlByRel.get(key) || "";
  check(html.includes('data-pp-content-lane="' + lane + '"'), key + " has content lane");
  check(html.includes('data-pp-content-id="' + id + '"'), key + " has stable content ID");
  check(html.includes('data-pp-content-verified="2026-08-22"'), key + " has last-verified metadata");
  check(/data-pp-source-name=/.test(html), key + " has named primary-source link");
  check(/href="https:\/\//.test(html), key + " links a primary source");
  check(html.includes('data-pp-event="pp_content_to_offer_click"'), key + " has content-to-offer event");
  check(html.includes("Research an address"), key + " uses the primary CTA");
  check(/<link rel="canonical"/.test(html), key + " has canonical metadata");
  check(jsonLdBlocks(html, key).length > 0, key + " has valid structured data");
  check(/Last verified August 22, 2026/i.test(html), key + " displays last-verified date");
  check(/Verified fact/i.test(html) && /inference/i.test(html) && /Unknown/i.test(html), key + " separates fact, inference, and unknown");
}

const nightmare = htmlByRel.get("resources/permit-nightmares/nine-departments-one-paper-trail/index.html") || "";
check(nightmare.includes("True bureaucracy, useful lessons"), "Permit Nightmares uses the franchise frame");
check(nightmare.includes("No private case or address"), "Permit Nightmares protects private parties");
check(nightmare.includes("not a composite"), "Permit Nightmares states case basis");
check(nightmare.includes("does not claim that the directive’s reforms have or have not been completed"), "Permit Nightmares qualifies implementation status");
check(nightmare.includes("No criminal conduct, misconduct, or private-party fault is alleged"), "Permit Nightmares has allegation boundary");

check(resources.includes("Permit Drops") && resources.includes("Paper Trail Playbooks") && resources.includes("Permit Nightmares"), "Content index exposes exactly the three lanes");
check((resources.match(/class="lane-label"/g) || []).length === 3, "Content index has three populated lane cards");
check(/names, email addresses, property addresses, free-text descriptions, form contents/i.test(legal), "Legal page states analytics PII exclusion");
check(legal.includes("SGV Turf is a separate"), "Legal page states brand separation");
check(legal.includes("does not create an engagement, confirm acceptance, promise delivery, or process payment"), "Legal page states intake transaction boundary");

const expectedEvents = ["pp_content_view", "pp_outbound_official_source_click", "pp_sample_view", "research_intake_start", "research_intake_success", "pp_content_to_offer_click"];
for (const eventName of expectedEvents) {
  const present = tracking.includes(eventName) || home.includes(eventName) || resources.includes(eventName);
  check(present, "Analytics distinguishes " + eventName);
}
check(tracking.includes("analyticsDestination(href)"), "Analytics sanitizes clicked destinations");
check(!/target_url:\s*href\b/.test(tracking), "Analytics never sends raw href as target_url");
check(!/destination:\s*link\.getAttribute\([^\n]+\)\s*\|\|\s*href/.test(tracking), "Analytics never sends raw href as destination");
check(!/(property_address|research_context|permit_number|project_address)/.test(tracking), "Tracking script does not read form PII fields");
check(tracking.includes('referrer: attributionUrl(document.referrer || "")'), "Form attribution strips referrer query strings");
check(formScript.indexOf('if (!response.ok) throw new Error("form_submit_failed")') !== -1, "Async intake rejects non-OK responses");
check(formScript.indexOf('if (!response.ok) throw new Error("form_submit_failed")') < formScript.indexOf('window.ppTrack(eventName'), "Intake success event follows OK response");
check(formScript.includes(".catch(function ()"), "Async intake exposes intentional failure state");

const publicForStaleScan = [...htmlByRel.entries()].filter(([name]) => name !== "sgv-ev-battery-radar.html");
// $149 is the current homepage Parcel Research Brief price; it stays retired everywhere else.
const currentOfferPages = new Set(["index.html"]);
const stalePatterns = [
  ["Stripe checkout link", /buy\.stripe\.com/i],
  ["old Permit Review Plus name", /Permit Review Plus/i],
  ["old $149 offer", /\$149\b/, currentOfferPages],
  ["old $249 offer", /\$249\b/],
  ["old Mission Control position", /Mission Control/i],
  ["old Instant Snapshot position", /Instant Snapshot/i],
  ["invented Red Tape fallback records", /fallback_demo|DEMO-(?:ADU|TI|MF|SOLAR|ADD)/i],
  ["old subscription price schema", /"price"\s*:\s*"(?:29|99|249|300)(?:\.00)?"/i],
  ["old $149 price schema", /"price"\s*:\s*"149(?:\.00)?"/i, currentOfferPages],
  ["mislabeled city-dataset proxy content", /LADBS (?:CSV|dataset) filtered by (?:keyword|topic)/i]
];
for (const [label, pattern, allowedPages = new Set()] of stalePatterns) {
  const hits = publicForStaleScan.filter(([name, html]) => !allowedPages.has(name) && pattern.test(html)).map(([name]) => name);
  check(hits.length === 0, "No " + label, hits.slice(0, 8).join(", "));
}

check(bostonPermitPage.includes("founding offer currently serves California addresses only"), "Non-California directory states the California service boundary");
check(bostonPermitPage.includes("Research a California address"), "Non-California directory uses a scoped research CTA");
check(!bostonPermitPage.includes("Boston is available in PermitPulse"), "Non-California directory does not imply local service availability");

check(bostonPermitPage.includes('data-pp-event="pp_content_to_offer_click"'), "Permits directory jurisdiction pages instrument content-to-offer CTA");
check(belmontBuildingPermitsPage.includes('data-pp-event="pp_content_to_offer_click"'), "Building-permits jurisdiction pages instrument content-to-offer CTA");
check(santaMonicaJurisdictionPage.includes('data-pp-event="pp_content_to_offer_click"'), "California jurisdiction hub pages instrument content-to-offer CTA");

const jsonLdPlaceholderHits = [];
for (const [fileName, html] of htmlByRel) {
  for (const match of html.matchAll(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    if (/X{5,}|PLACEHOLDER_|REPLACE_ME|FIXME|"TODO"/i.test(match[1])) jsonLdPlaceholderHits.push(fileName);
  }
}
check(jsonLdPlaceholderHits.length === 0, "No placeholder values in production JSON-LD", jsonLdPlaceholderHits.slice(0, 10).join(", "));
check(!jurisdictionConfig.includes('dataset: "y3ad-yhi1"'), "Retired Long Beach API dataset is not configured");
check(jurisdictionConfig.includes("building-permit-records"), "Long Beach uses the current official records route");

check(siteCheck.includes('id="site-check-form"') && siteCheck.includes('name="property_address"'), "Site Check has an address form");
for (const intent of ["sb1123", "adu", "multifamily", "residential", "other"]) {
  check(siteCheck.includes('value="' + intent + '"'), "Site Check offers " + intent + " intent");
  check(siteCheckScript.includes(intent + ": {"), "Site Check explains " + intent + " pathway");
}
check(siteCheck.includes("Topography not yet verified") && siteCheck.includes("What still needs verification"), "Site Check exposes unverified site conditions");
check(["Address-specific evidence", "Pathway / reference sources", "Sources still needed", "0 official records retrieved", "Local agency source — needs jurisdiction verification"].every((label) => siteCheck.includes(label)), "Site Check separates evidence, references, and sources still needed");
check(!/zimas\.lacity\.org|planning\.lacity\.gov|City of Los Angeles|LA Planning|\/resources\/[^"\s]*los-angeles/i.test(siteCheck + siteCheckScript), "Unmatched Site Check does not offer LA-specific source links");
check(siteCheck.includes('data-pp-event="site_check_to_research_click"') && siteCheck.includes('data-site-check-handoff'), "Site Check instruments the research handoff");
check(siteCheckScript.includes('site_check_completed') && siteCheckScript.includes('site_check_result_verify'), "Site Check tracks completed verify results");
check(formScript.includes("pp_site_check_handoff_v1") && formScript.includes("preliminary-site-check"), "Existing research intake accepts Site Check handoff");
check(housingGuides.every((file) => (htmlByRel.get(file) || "").includes('data-pp-event="pp_content_to_offer_click"')), "Housing guides preserve content-to-offer tracking");
check(housingGuides.every((file) => (htmlByRel.get(file) || "").includes('href="/free-tools/site-check/?intent=')), "Housing guides link to the intent-aware Site Check");

const addressIntakeFiles = publicForStaleScan.filter(([, html]) => {
  return /formspree\.io/i.test(html) && /name=["'](?:property_address|project_address|permit_number|address)["']/i.test(html);
}).map(([name]) => name);
check(addressIntakeFiles.length === 1 && addressIntakeFiles[0] === "index.html", "One address-research intake across public HTML", addressIntakeFiles.join(", "));

check(!redirectsText.includes("/sample-report             /assets/docs/"), "Sample redirect no longer bypasses disclosure");
check(redirectsText.includes("/sample-report/index.html"), "Sample route serves disclosure page");
check(redirectsText.includes("/permit-due-diligence-los-angeles /#research-intake"), "Legacy service route redirects to current intake");
check(redirectsText.includes("/snapshot                  /#research-intake"), "Legacy snapshot route redirects to current intake");
check(redirectsText.includes("/austin-building-permits.html /resources/"), "Retired Austin dataset-proxy page redirects to field notes");
check(redirectsText.includes("/chicago-building-permits.html /resources/"), "Retired Chicago dataset-proxy page redirects to field notes");
check(redirectsText.includes("/free-tools/la-housing-program-check/ /free-tools/site-check/  301"), "Old housing tool route redirects to Site Check");

// A sitemap URL that always 301s is a contradiction: Google is told to index
// a page it will only ever see as a redirect (see the Pasadena case this
// check now guards against). Covers all four sitemap files, not just pages.
const permanentRedirectLines = redirectsText.split(/\r?\n/).map((line) => line.trim()).filter((line) => line && !line.startsWith("#"));
const permanentRedirectSources = permanentRedirectLines
  .map((line) => line.split(/\s+/))
  .filter(([, , status]) => status === "301" || status === "302")
  .map(([source]) => source);
const permanentRedirectExact = new Set(permanentRedirectSources.filter((source) => !source.includes("*")));
const permanentRedirectWildcards = permanentRedirectSources.map(redirectMatchers).filter(Boolean);
function pathIsPermanentlyRedirected(pathname) {
  const bare = pathname.replace(/\/$/, "");
  return permanentRedirectExact.has(pathname) || permanentRedirectExact.has(bare) || permanentRedirectExact.has(bare + "/") ||
    permanentRedirectWildcards.some((matcher) => matcher.test(pathname));
}
const redirectedSitemapUrls = [];
for (const [sitemapName, xml] of [["sitemap-pages.xml", sitemap], ...auxSitemaps]) {
  for (const match of xml.matchAll(/<loc>(.*?)<\/loc>/g)) {
    let pathname;
    try {
      pathname = new URL(match[1]).pathname;
    } catch {
      continue;
    }
    if (pathIsPermanentlyRedirected(pathname)) redirectedSitemapUrls.push(sitemapName + " -> " + match[1]);
  }
}
check(redirectedSitemapUrls.length === 0, "No sitemap URL points at a permanently redirected path", redirectedSitemapUrls.slice(0, 10).join("; "));

const sitemapRequirements = [
  "https://getpermitpulse.com/case-integrity/",
  "https://getpermitpulse.com/sample-report/",
  "https://getpermitpulse.com/about/",
  "https://getpermitpulse.com/legal/",
  "https://getpermitpulse.com/resources/permit-drops/los-angeles-building-records-online-first/",
  "https://getpermitpulse.com/resources/how-to-check-permit-history-los-angeles/",
  "https://getpermitpulse.com/resources/does-sb79-low-rise-apply-los-angeles-property/",
  "https://getpermitpulse.com/resources/los-angeles-housing-programs-chip-sb79-sb684-sb1123/",
  "https://getpermitpulse.com/free-tools/site-check/",
  "https://getpermitpulse.com/resources/permit-nightmares/nine-departments-one-paper-trail/"
];
for (const url of sitemapRequirements) check(sitemap.includes(url), "Sitemap includes " + url);
check(!sitemap.includes("/snapshot/"), "Sitemap excludes retired snapshot");
check(!sitemap.includes("/permit-due-diligence-los-angeles/"), "Sitemap excludes retired offer page");

const docs = [
  "PERMIT_DEEP_RESEARCH_POSITIONING.md",
  "PAPER_TRAIL_LOOP.md",
  "ORGANIC_CONTENT_SYSTEM.md",
  "PERMIT_NIGHTMARES_STANDARD.md",
  "LAUNCH_READINESS.md",
  "content-packets/TEMPLATE.md",
  "content-packets/PP-2026-001-LA-BUILDING-RECORDS.md",
  "content-packets/PP-2026-002-LA-PERMIT-HISTORY-PLAYBOOK.md",
  "content-packets/PP-2026-003-NINE-DEPARTMENTS-PAPER-TRAIL.md"
];
for (const doc of docs) check(await exists(path.join(repoRoot, "docs", doc)), "Required documentation " + doc);

for (const packetName of docs.filter((name) => name.startsWith("content-packets/PP-"))) {
  const packet = await readFile(path.join(repoRoot, "docs", packetName), "utf8");
  const fields = ["Working title:", "Jurisdiction:", "Customer question:", "Last verified:", "## Primary source", "### Verified facts", "### Reasonable inference", "### Unknowns", "Recurring failure pattern:", "Useful takeaway:", "Case basis:", "## Derivative 1", "## Derivative 2", "## Derivatives 3–5", "## Derivative 6", "CTA:"];
  for (const field of fields) check(packet.includes(field), packetName + " includes " + field);
  check((packet.match(/^### Short [123]/gm) || []).length === 3, packetName + " contains three Shorts");
}

const launchDoc = await readFile(path.join(repoRoot, "docs", "LAUNCH_READINESS.md"), "utf8");
check((launchDoc.match(/^\d+\. \*\*/gm) || []).length === 8, "Manual launch list is capped at eight");

const coreRelPaths = ["index.html", "case-integrity/index.html", "sample-report/index.html", "free-tools/index.html", "free-tools/site-check/index.html", "resources/index.html", ...contentRoutes.map(([suffix]) => "resources/" + suffix), ...housingGuides, "about/index.html", "legal/index.html"];
for (const fileName of coreRelPaths) {
  const html = htmlByRel.get(fileName) || "";
  check((html.match(/<h1\b/gi) || []).length === 1, fileName + " has one H1");
  check(duplicateIds(html).length === 0, fileName + " has no duplicate IDs", duplicateIds(html).join(", "));
  check(html.includes("skip-link"), fileName + " has a skip link");
  for (const tag of html.match(/<a\b[^>]*target=["']_blank["'][^>]*>/gi) || []) {
    check(/rel=["'][^"']*noopener/.test(tag), fileName + " external target protects opener", tag.slice(0, 100));
  }
  for (const img of html.match(/<img\b[^>]*>/gi) || []) {
    check(/\balt=["'][^"']*["']/.test(img), fileName + " images have alt text", img.slice(0, 100));
  }
}
check(css.includes(":focus-visible"), "CSS has visible keyboard focus");
check(css.includes("@media (prefers-reduced-motion: reduce)"), "CSS respects reduced motion");
check(css.includes("@media (max-width: 560px)"), "CSS includes narrow-mobile layout");

const redirectLines = redirectsText.split(/\r?\n/).map((line) => line.trim()).filter((line) => line && !line.startsWith("#"));
const redirectSources = redirectLines.map((line) => line.split(/\s+/)[0]);
const exactRedirects = new Set(redirectSources.filter((source) => !source.includes("*")));
const wildcardRedirects = redirectSources.map(redirectMatchers).filter(Boolean);

// These indexed articles must remain native Pages assets, not retired guides or
// rewrites back to .html (which Pages redirects to the extensionless URL).
const indexedArticles = [
  {
    route: "/retroactive-permits-unpermitted-work-los-angeles",
    file: "retroactive-permits-unpermitted-work-los-angeles.html",
    sections: ["What Is a Retroactive Permit?", "Common Types of Unpermitted Work"]
  },
  {
    route: "/resources/check-adu-permit-history-los-angeles/",
    file: "resources/check-adu-permit-history-los-angeles/index.html",
    sections: ["Match the ADU to the right address or unit", "ADU red-flag checklist", "Check inspections and final status"]
  },
  {
    route: "/free-tools/site-check/",
    file: "free-tools/site-check/index.html",
    sections: ["Topography not yet verified", "What still needs verification", "Sources / evidence"]
  },
  {
    route: "/resources/does-sb79-low-rise-apply-los-angeles-property/",
    file: housingGuides[0],
    sections: ["Check the current official SB 79 / Low-Rise map", "Questions worth bringing to Planning"]
  },
  {
    route: "/resources/los-angeles-housing-programs-chip-sb79-sb684-sb1123/",
    file: housingGuides[1],
    sections: ["CHIP: identify the pathway first", "Can more than one program matter?"]
  }
];
for (const { route, file, sections } of indexedArticles) {
  const html = htmlByRel.get(file) || "";
  const stem = route.replace(/\/$/, "");
  const canonical = "https://getpermitpulse.com" + route;
  const canonicalTags = (html.match(/<link\b[^>]*>/gi) || []).filter((tag) => attribute(tag, "rel") === "canonical");
  check(canonicalTags.length === 1 && attribute(canonicalTags[0], "href") === canonical, file + " has one self-referencing canonical");
  check(!/noindex|http-equiv=["']refresh/i.test(html), file + " remains indexable without a meta redirect");
  check(sections.every((section) => html.includes(section)), file + " retains dedicated article content");
  check(!exactRedirects.has(stem) && !exactRedirects.has(stem + "/"), route + " uses native Pages routing");
  const sitemapUrls = [...sitemap.matchAll(/<loc>(.*?)<\/loc>/g)].map((match) => match[1]);
  const variants = sitemapUrls.filter((url) => url.replace(/(?:\/index)?\.html$|\/$/g, "") === "https://getpermitpulse.com" + stem);
  check(variants.length === 1 && variants[0] === canonical, route + " has only its canonical URL in the sitemap");
  check(resources.includes('href="' + route + '"'), route + " is linked from resources using its canonical URL");
  const noncanonicalLinks = [];
  for (const [sourceFile, sourceHtml] of htmlByRel) {
    for (const tag of sourceHtml.match(/<a\b[^>]*href=["'][^"']+["'][^>]*>/gi) || []) {
      const url = new URL(attribute(tag, "href"), "https://getpermitpulse.com" + routeForFile(path.join(distRoot, sourceFile)));
      if (url.origin !== "https://getpermitpulse.com") continue;
      const normalized = url.pathname.replace(/(?:\/index)?\.html$|\/$/g, "");
      if (normalized === stem && url.pathname !== route) noncanonicalLinks.push(sourceFile + " -> " + url.pathname);
    }
  }
  check(noncanonicalLinks.length === 0, route + " internal links are canonical", noncanonicalLinks.join("; "));
}

async function routeExists(pathname) {
  let decoded;
  try {
    decoded = decodeURIComponent(pathname);
  } catch {
    return false;
  }
  if (!decoded.startsWith("/") || decoded.includes("\0")) return false;
  const relative = decoded.replace(/^\/+/, "");
  const direct = path.join(distRoot, relative);
  if (await exists(direct)) {
    const info = await stat(direct);
    if (info.isFile()) return true;
    if (info.isDirectory() && await exists(path.join(direct, "index.html"))) return true;
  }
  if (!path.extname(relative) && await exists(path.join(distRoot, relative + ".html"))) return true;
  if (exactRedirects.has(decoded) || wildcardRedirects.some((matcher) => matcher.test(decoded))) return true;
  return false;
}

const brokenLinks = new Set();
for (const [fileName, html] of htmlByRel) {
  const base = "https://getpermitpulse.com" + routeForFile(path.join(distRoot, fileName));
  const tags = html.match(/<a\b[^>]*href=["'][^"']+["'][^>]*>/gi) || [];
  for (const tag of tags) {
    const href = attribute(tag, "href");
    if (!href || href.startsWith("#") || /^(?:mailto:|tel:|sms:|javascript:|data:)/i.test(href)) continue;
    let url;
    try {
      url = new URL(href, base);
    } catch {
      brokenLinks.add(fileName + " -> invalid URL " + href);
      continue;
    }
    if (url.origin !== "https://getpermitpulse.com") continue;
    if (!(await routeExists(url.pathname))) brokenLinks.add(fileName + " -> " + url.pathname);
  }
}
check(brokenLinks.size === 0, "Internal links resolve to a file or explicit redirect", [...brokenLinks].slice(0, 20).join("; "));

console.log("PermitPulse public validation");
console.log("PASS " + passes.length);
for (const label of passes) console.log("  ✓ " + label);
if (failures.length) {
  console.error("FAIL " + failures.length);
  for (const failure of failures) console.error("  ✗ " + failure);
  process.exitCode = 1;
} else {
  console.log("FAIL 0");
}
