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

function redirectMatchers(source) {
  if (!source.includes("*")) return null;
  const escaped = source.split("*").map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join(".*");
  return new RegExp("^" + escaped + "$");
}

const requiredFiles = [
  "index.html",
  "sample-report/index.html",
  "resources/index.html",
  "resources/permit-drops/los-angeles-building-records-online-first/index.html",
  "resources/how-to-check-permit-history-los-angeles/index.html",
  "resources/permit-nightmares/nine-departments-one-paper-trail/index.html",
  "about/index.html",
  "legal/index.html",
  "assets/permitpulse-tracking.js",
  "assets/platform-home.js",
  "assets/platform-home.css",
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
const sample = htmlByRel.get("sample-report/index.html") || "";
const resources = htmlByRel.get("resources/index.html") || "";
const legal = htmlByRel.get("legal/index.html") || "";
const bostonPermitPage = htmlByRel.get("permits/massachusetts/boston/index.html") || "";
const tracking = await readFile(path.join(distRoot, "assets/permitpulse-tracking.js"), "utf8");
const formScript = await readFile(path.join(distRoot, "assets/platform-home.js"), "utf8");
const css = await readFile(path.join(distRoot, "assets/platform-home.css"), "utf8");
const redirectsText = await readFile(path.join(distRoot, "_redirects"), "utf8");
const sitemap = await readFile(path.join(distRoot, "sitemap-pages.xml"), "utf8");
const jurisdictionConfig = await readFile(path.join(repoRoot, "workers/pp-api/src/config/jurisdictions.js"), "utf8");

const homepageRequirements = [
  "Permit Deep Research",
  "Give us the address. We follow the paper trail.",
  "PermitPulse turns scattered California permit and property records into one source-backed brief",
  "California residential contractors and small builders",
  "three addresses for $299 total",
  "48 business hours per address",
  "Research an address",
  "See a redacted example",
  "Find → Verify → Brief → Reuse → Reverify",
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

const homeJson = jsonLdBlocks(home, "dist/index.html");
const service = homeJson.find((item) => item && item["@type"] === "Service");
check(Boolean(service), "Homepage has Service structured data");
check(service && service.name === "Permit Deep Research", "Structured service uses the chosen offer");
check(service && service.offers && String(service.offers.price) === "299", "Structured offer preserves $299 price");
check(service && service.areaServed && service.areaServed.name === "California", "Structured offer states California coverage");

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
const stalePatterns = [
  ["Stripe checkout link", /buy\.stripe\.com/i],
  ["old Permit Review Plus name", /Permit Review Plus/i],
  ["old $149 offer", /\$149\b/],
  ["old $249 offer", /\$249\b/],
  ["old Mission Control position", /Mission Control/i],
  ["old Instant Snapshot position", /Instant Snapshot/i],
  ["invented Red Tape fallback records", /fallback_demo|DEMO-(?:ADU|TI|MF|SOLAR|ADD)/i],
  ["old subscription price schema", /"price"\s*:\s*"(?:29|99|149|249|300)(?:\.00)?"/i]
];
for (const [label, pattern] of stalePatterns) {
  const hits = publicForStaleScan.filter(([, html]) => pattern.test(html)).map(([name]) => name);
  check(hits.length === 0, "No " + label, hits.slice(0, 8).join(", "));
}

check(bostonPermitPage.includes("founding offer currently serves California addresses only"), "Non-California directory states the California service boundary");
check(bostonPermitPage.includes("Research a California address"), "Non-California directory uses a scoped research CTA");
check(!bostonPermitPage.includes("Boston is available in PermitPulse"), "Non-California directory does not imply local service availability");
check(!jurisdictionConfig.includes('dataset: "y3ad-yhi1"'), "Retired Long Beach API dataset is not configured");
check(jurisdictionConfig.includes("building-permit-records"), "Long Beach uses the current official records route");

const addressIntakeFiles = publicForStaleScan.filter(([, html]) => {
  return /formspree\.io/i.test(html) && /name=["'](?:property_address|project_address|permit_number|address)["']/i.test(html);
}).map(([name]) => name);
check(addressIntakeFiles.length === 1 && addressIntakeFiles[0] === "index.html", "One address-research intake across public HTML", addressIntakeFiles.join(", "));

check(!redirectsText.includes("/sample-report             /assets/docs/"), "Sample redirect no longer bypasses disclosure");
check(redirectsText.includes("/sample-report/index.html"), "Sample route serves disclosure page");
check(redirectsText.includes("/permit-due-diligence-los-angeles /#research-intake"), "Legacy service route redirects to current intake");
check(redirectsText.includes("/snapshot                  /#research-intake"), "Legacy snapshot route redirects to current intake");

const sitemapRequirements = [
  "https://getpermitpulse.com/sample-report/",
  "https://getpermitpulse.com/about/",
  "https://getpermitpulse.com/legal/",
  "https://getpermitpulse.com/resources/permit-drops/los-angeles-building-records-online-first/",
  "https://getpermitpulse.com/resources/how-to-check-permit-history-los-angeles/",
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

const coreRelPaths = ["index.html", "sample-report/index.html", "resources/index.html", ...contentRoutes.map(([suffix]) => "resources/" + suffix), "about/index.html", "legal/index.html"];
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
