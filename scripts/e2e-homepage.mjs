#!/usr/bin/env node
// Browser checks for the homepage: both inquiry paths, analytics privacy,
// tabs, mobile dock, fallbacks, and (when the film is placed) the player.
//
//   npm run test:homepage                    # dist/ as committed
//   npm run test:homepage -- --dist <dir>    # e.g. a copy with the film placed
//
// Needs Playwright with Chromium (npx playwright install chromium). Formspree
// is intercepted, so no lead is sent; third-party scripts are blocked.

import { createReadStream } from "node:fs";
import { readFile, stat } from "node:fs/promises";
import http from "node:http";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
let chromium;
try {
  ({ chromium } = require("playwright"));
} catch {
  console.error("test:homepage needs Playwright: npm i -D playwright && npx playwright install chromium");
  process.exit(1);
}

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const distArg = process.argv.indexOf("--dist");
const distRoot = path.resolve(repoRoot, distArg === -1 ? "dist" : process.argv[distArg + 1]);
const filmReady = /<figure class="ng-film"[^>]*data-film-ready="true"/.test(await readFile(path.join(distRoot, "index.html"), "utf8"));

const PII = {
  address: "1234 QA Test Street, Los Angeles",
  name: "Casey QA",
  email: "qa-test@example.com",
  details: "Third correction cycle QA note",
  context: "QA context free text"
};

const types = {
  ".html": "text/html; charset=utf-8", ".css": "text/css", ".js": "text/javascript", ".json": "application/json",
  ".svg": "image/svg+xml", ".png": "image/png", ".webp": "image/webp", ".woff2": "font/woff2", ".mp4": "video/mp4",
  ".txt": "text/plain", ".xml": "application/xml", ".pdf": "application/pdf"
};

function serve(root) {
  const server = http.createServer(async (request, response) => {
    const url = new URL(request.url, "http://localhost");
    let file = path.join(root, decodeURIComponent(url.pathname));
    if (!file.startsWith(root)) return response.writeHead(403).end();
    try {
      let info = await stat(file);
      if (info.isDirectory()) {
        file = path.join(file, "index.html");
        info = await stat(file);
      }
      const type = types[path.extname(file)] || "application/octet-stream";
      const range = request.headers.range && /bytes=(\d*)-(\d*)/.exec(request.headers.range);
      if (range) {
        const start = range[1] ? Number(range[1]) : 0;
        const end = range[2] ? Number(range[2]) : info.size - 1;
        response.writeHead(206, { "Content-Type": type, "Accept-Ranges": "bytes", "Content-Range": "bytes " + start + "-" + end + "/" + info.size, "Content-Length": end - start + 1 });
        return createReadStream(file, { start, end }).pipe(response);
      }
      response.writeHead(200, { "Content-Type": type, "Accept-Ranges": "bytes", "Content-Length": info.size });
      createReadStream(file).pipe(response);
    } catch {
      response.writeHead(404, { "Content-Type": "text/plain" }).end("not found");
    }
  });
  return new Promise((resolve) => server.listen(0, "127.0.0.1", () => resolve(server)));
}

const results = [];
async function test(name, fn) {
  try {
    await fn();
    results.push([true, name]);
  } catch (error) {
    results.push([false, name + ": " + error.message]);
  }
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const server = await serve(distRoot);
const base = "http://127.0.0.1:" + server.address().port + "/";
const browser = await chromium.launch();

async function open(options = {}) {
  const { width = 360, height = 800, mobile = true, formStatus = 200, reducedMotion = "no-preference", javaScriptEnabled = true, hash = "", query = "", init } = options;
  const context = await browser.newContext({ viewport: { width, height }, isMobile: mobile, hasTouch: mobile, reducedMotion, javaScriptEnabled });
  if (init) await context.addInitScript(init);
  const page = await context.newPage();
  const log = { submissions: [], requests: [], errors: [] };
  page.on("pageerror", (error) => log.errors.push(error.message));
  page.on("console", (message) => { if (message.type() === "error" && !/net::ERR_FAILED|Failed to load resource/.test(message.text())) log.errors.push(message.text()); });
  page.on("request", (request) => log.requests.push(request.url()));
  await page.route("**/*", async (route) => {
    const url = route.request().url();
    if (url.startsWith(base)) return route.continue();
    if (/formspree\.io/.test(url)) {
      const body = route.request().postDataBuffer() || Buffer.alloc(0);
      log.submissions.push({ url, body: body.toString("latin1"), contentType: route.request().headers()["content-type"] || "" });
      return route.fulfill({ status: formStatus, contentType: "application/json", body: formStatus === 200 ? '{"ok":true}' : '{"error":"QA"}' });
    }
    return route.abort();
  });
  await page.goto(base + query + hash, { waitUntil: "load" });
  return { page, context, log };
}

function fields(submission) {
  const out = {};
  const boundary = (/boundary=(.+)$/.exec(submission.contentType) || [])[1];
  if (!boundary) return out;
  for (const part of submission.body.split("--" + boundary)) {
    const match = /name="([^"]+)"\r\n\r\n([\s\S]*?)\r\n$/.exec(part);
    if (match) out[match[1]] = match[2];
  }
  return out;
}

async function events(page) {
  return page.evaluate(() => (window.dataLayer || []).filter((entry) => entry && entry[0] === "event").map((entry) => ({ name: entry[1], params: entry[2] || {} })));
}

function assertNoPii(list) {
  const serialized = JSON.stringify(list);
  for (const [label, value] of Object.entries(PII)) assert(!serialized.includes(value), "analytics leaked " + label);
}

await test("Android 360: loads cleanly, hero CTA above the fold, film off unless placed", async () => {
  const { page, context, log } = await open();
  await page.waitForTimeout(300);
  assert(log.errors.length === 0, "console errors: " + log.errors.join(" | "));
  const cta = await page.locator('[data-pp-location="homepage_hero_intake"]').boundingBox();
  assert(cta && cta.y + cta.height <= 800, "hero CTA below the fold at " + (cta && cta.y));
  assert((await page.locator("h1").innerText()).replace(/\s+/g, " ").startsWith("NEVER GUESS."), "H1 text");
  const buttons = await page.locator("[data-film-open]").evaluateAll((list) => list.map((button) => button.hidden));
  assert(buttons.every((hidden) => hidden === !filmReady), "film buttons visibility should match data-film-ready");
  assert(!log.requests.some((url) => url.includes("/assets/film/") && url.endsWith(".mp4")), "film requested before play");
  await context.close();
});

await test("No horizontal scroll from 320 to 1920 px", async () => {
  for (const [width, mobile] of [[320, true], [360, true], [412, true], [768, true], [1024, false], [1280, false], [1920, false]]) {
    const { page, context } = await open({ width, height: 900, mobile });
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    await context.close();
    assert(overflow <= 0, width + "px overflows by " + overflow);
  }
});

await test("Parcel brief: validates, submits to Formspree, shows receipt, analytics carry no PII", async () => {
  const { page, context, log } = await open();
  await page.click('[data-pp-location="homepage_hero_intake"]');
  assert(await page.locator("#tab-parcel").getAttribute("aria-selected") === "true", "parcel tab not selected");
  const form = page.locator("#permit-deep-research-form");
  await form.locator('button[type="submit"]').click();
  await page.waitForTimeout(200);
  assert(log.submissions.length === 0, "empty form was submitted");
  await form.locator('[name="property_address"]').fill(PII.address);
  await form.locator('[name="research_goal"]').selectOption("Buying or tying up a site");
  await form.locator('[name="research_context"]').fill(PII.context);
  await form.locator('[name="name"]').fill(PII.name);
  await form.locator('[name="email"]').fill(PII.email);
  await form.locator('button[type="submit"]').click();
  await page.locator("#research-form-success").waitFor({ state: "visible" });
  assert(log.submissions.length === 1 && log.submissions[0].url === "https://formspree.io/f/mbdwdklj", "one Formspree submission");
  const sent = fields(log.submissions[0]);
  assert(sent.property_address === PII.address && sent.email === PII.email && sent.lead_type === "permit_deep_research", "submission fields");
  assert(sent.properties_requested === "one" && sent._gotcha === "" && sent.landing_page && sent.page_path === "/", "offer, honeypot, attribution");
  const list = await events(page);
  const success = list.find((event) => event.name === "research_intake_success");
  assert(list.some((event) => event.name === "pp_research_cta_click" && event.params.cta_location === "homepage_hero_intake"), "research CTA click event");
  assert(list.some((event) => event.name === "research_intake_start"), "intake start event");
  assert(success && success.params.offer === "one" && success.params.call_requested === "no", "success event payload");
  assert(list.some((event) => event.name === "generate_lead"), "generate_lead event");
  assertNoPii(list);
  await context.close();
});

await test("Workflow inquiry: service card preselects path, no address or payment, call request tracked as yes/no", async () => {
  const { page, context, log } = await open();
  await page.click('[data-pp-location="homepage_services_triage"]');
  assert(await page.locator("#tab-workflow").getAttribute("aria-selected") === "true", "workflow tab not selected");
  assert(await page.locator("#inquire").isVisible() && !(await page.locator("#panel-parcel").isVisible()), "workflow panel not shown");
  const form = page.locator("#workflow-inquiry-form");
  assert(await form.locator('[name="inquiry_path"]').inputValue() === "permit_triage", "path not preselected");
  await form.locator('[name="inquiry_details"]').fill(PII.details);
  await form.locator('[name="name"]').fill(PII.name);
  await form.locator('[name="email"]').fill(PII.email);
  await form.locator('[name="discovery_call"]').check();
  await form.locator('button[type="submit"]').click();
  await page.locator("#workflow-form-success").waitFor({ state: "visible" });
  const sent = fields(log.submissions[0]);
  assert(sent.lead_type === "workflow_inquiry" && sent.inquiry_path === "permit_triage" && sent.discovery_call === "requested", "workflow fields");
  assert(!("property_address" in sent) && sent._subject.includes("no payment"), "no address field, no-payment subject");
  const list = await events(page);
  const success = list.find((event) => event.name === "workflow_inquiry_success");
  assert(success && success.params.inquiry_path === "permit_triage" && success.params.call_requested === "yes", "workflow success payload");
  assert(list.some((event) => event.name === "pp_workflow_cta_click" && event.params.cta_location === "homepage_services_triage"), "workflow CTA click event");
  assert(list.some((event) => event.name === "workflow_inquiry_start"), "workflow start event");
  assertNoPii(list);
  await context.close();
});

await test("Failed submission shows the error and email fallback, no success event", async () => {
  const { page, context } = await open({ formStatus: 500, hash: "#inquire" });
  const form = page.locator("#workflow-inquiry-form");
  await form.locator('[name="inquiry_path"]').selectOption("workflow_diagnostics");
  await form.locator('[name="inquiry_details"]').fill(PII.details);
  await form.locator('[name="name"]').fill(PII.name);
  await form.locator('[name="email"]').fill(PII.email);
  await form.locator('button[type="submit"]').click();
  await page.locator("#workflow-form-error").waitFor({ state: "visible" });
  assert(await form.locator('button[type="submit"]').isEnabled(), "submit stays disabled");
  assert(!(await events(page)).some((event) => event.name === "workflow_inquiry_success"), "success event on failure");
  await context.close();
});

await test("Deep link #inquire opens the workflow tab; arrow keys switch tabs", async () => {
  const { page, context } = await open({ hash: "#inquire" });
  assert(await page.locator("#tab-workflow").getAttribute("aria-selected") === "true", "deep link tab");
  await page.locator("#tab-workflow").focus();
  await page.keyboard.press("ArrowLeft");
  assert(await page.locator("#tab-parcel").getAttribute("aria-selected") === "true", "arrow key switch");
  assert(await page.evaluate(() => document.activeElement.id) === "tab-parcel", "focus follows tab");
  await context.close();
});

await test("Mobile dock appears after the hero and steps aside for the intake and typing", async () => {
  const { page, context } = await open();
  const shown = () => page.locator("[data-ng-dock]").evaluate((dock) => dock.classList.contains("is-shown"));
  assert(!(await shown()), "dock shown over the hero");
  await page.evaluate(() => document.getElementById("how").scrollIntoView({ behavior: "instant" }));
  await page.waitForTimeout(250);
  assert(await shown(), "dock hidden mid-page");
  await page.evaluate(() => document.getElementById("research-intake").scrollIntoView({ behavior: "instant" }));
  await page.waitForTimeout(250);
  assert(!(await shown()), "dock covers the intake");
  await context.close();
  const desktop = await open({ width: 1280, height: 800, mobile: false });
  await desktop.page.evaluate(() => document.getElementById("how").scrollIntoView({ behavior: "instant" }));
  await desktop.page.waitForTimeout(250);
  assert(!(await desktop.page.locator("[data-ng-dock]").isVisible()), "dock visible on desktop");
  await desktop.context.close();
});

await test("Without JavaScript both inquiry forms stay usable", async () => {
  const { page, context } = await open({ javaScriptEnabled: false });
  assert(await page.locator("#permit-deep-research-form").isVisible() && await page.locator("#workflow-inquiry-form").isVisible(), "forms hidden without JS");
  assert(!(await page.locator("[data-ng-tablist]").isVisible()), "tablist visible without JS");
  await context.close();
});

await test("Reduced motion: brief card holds its static frame, hero copy is fully visible", async () => {
  const { page, context } = await open({ reducedMotion: "reduce" });
  await page.waitForTimeout(200);
  assert(await page.locator("figure.pp-motion").getAttribute("data-pp-motion") === "static", "brief card animates");
  const opacity = await page.locator(".ng-geo").first().evaluate((element) => getComputedStyle(element).opacity);
  assert(opacity === "1", "hero copy opacity " + opacity);
  await context.close();
});

await test("Site Check handoff still pre-fills the parcel form", async () => {
  const { page, context } = await open({
    query: "?source=site-check",
    init: () => sessionStorage.setItem("pp_site_check_handoff_v1", JSON.stringify({ created_at: Date.now(), address: "1 Handoff Way, Los Angeles", intent_label: "ADU", intent: "adu", questions: ["Q1"] }))
  });
  assert(await page.locator('#permit-deep-research-form [name="property_address"]').inputValue() === "1 Handoff Way, Los Angeles", "handoff address");
  await context.close();
});

if (filmReady) {
  await test("Film: poster first, plays on click, reports progress, ends on the inquiry card", async () => {
    const { page, context, log } = await open({ width: 412, height: 915 });
    await page.waitForTimeout(300);
    assert(!log.requests.some((url) => url.endsWith(".mp4")), "film requested before play");
    assert(await page.locator(".ng-film__poster.is-loaded").count() === 1, "poster frame not shown");
    await page.click('.ng-film__play');
    assert(await page.locator("#film-theater").evaluate((dialog) => dialog.open), "theater not open");
    await page.waitForFunction(() => document.querySelector(".ng-theater__video").currentTime > 0.5, null, { timeout: 8000 });
    assert(log.requests.some((url) => url.endsWith(".mp4")), "film not requested");
    await page.evaluate(() => { const video = document.querySelector(".ng-theater__video"); video.currentTime = video.duration - 0.4; });
    await page.locator("[data-film-end]").waitFor({ state: "visible", timeout: 8000 });
    await page.click('[data-pp-location="homepage_film_end_intake"]');
    assert(!(await page.locator("#film-theater").evaluate((dialog) => dialog.open)), "theater stays open after CTA");
    assert(await page.evaluate(() => window.location.hash) === "#research-intake", "CTA did not reach the intake");
    const names = (await events(page)).map((event) => event.name);
    for (const name of ["pp_film_open", "pp_film_play", "pp_film_progress", "pp_film_complete", "pp_film_close"]) assert(names.includes(name), "missing " + name);
    const close = (await events(page)).find((event) => event.name === "pp_film_close");
    assert(close.params.percent_watched === 100, "percent_watched " + close.params.percent_watched);
    await context.close();
  });

  await test("Film: full 1080x1920 picture and soundtrack decode and play through to the end card", async () => {
    const { page, context } = await open({ width: 412, height: 915 });
    await page.click(".ng-film__play");
    await page.waitForFunction(() => document.querySelector(".ng-theater__video").currentTime > 0.2, null, { timeout: 8000 });
    await page.evaluate(() => { document.querySelector(".ng-theater__video").playbackRate = 4; });
    await page.locator("[data-film-end]").waitFor({ state: "visible", timeout: 20000 });
    const media = await page.locator(".ng-theater__video").evaluate((video) => ({
      width: video.videoWidth, height: video.videoHeight, duration: video.duration, muted: video.muted,
      audioBytes: video.webkitAudioDecodedByteCount, videoBytes: video.webkitVideoDecodedByteCount
    }));
    assert(media.width === 1080 && media.height === 1920, "frame size " + media.width + "x" + media.height);
    assert(Math.abs(media.duration - 28) < 0.1, "duration " + media.duration);
    assert(!media.muted, "film starts muted");
    assert(media.audioBytes === undefined || media.audioBytes > 0, "soundtrack did not decode");
    assert(media.videoBytes === undefined || media.videoBytes > 0, "picture did not decode");
    await context.close();
  });

  await test("Film: Escape closes the theater and returns focus", async () => {
    const { page, context } = await open({ width: 1280, height: 800, mobile: false });
    await page.click('[data-film-open="hero_button"]');
    await page.waitForTimeout(300);
    await page.keyboard.press("Escape");
    await page.waitForTimeout(150);
    assert(!(await page.locator("#film-theater").evaluate((dialog) => dialog.open)), "Escape did not close");
    assert(await page.evaluate(() => document.activeElement.getAttribute("data-film-open")) === "hero_button", "focus not returned");
    assert(!(await page.evaluate(() => document.documentElement.classList.contains("ng-film-open"))), "scroll lock left on");
    await context.close();
  });
}

await browser.close();
server.close();

console.log("PermitPulse homepage browser checks (" + path.relative(repoRoot, distRoot || ".") + (filmReady ? ", film placed" : ", film not placed") + ")");
for (const [ok, label] of results) console.log((ok ? "  ✓ " : "  ✗ ") + label);
const failed = results.filter(([ok]) => !ok).length;
console.log(failed ? "FAIL " + failed : "PASS " + results.length);
process.exitCode = failed ? 1 : 0;
