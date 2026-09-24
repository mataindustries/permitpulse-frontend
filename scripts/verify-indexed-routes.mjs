// Run against `wrangler pages dev` or a deployed Pages preview, not a generic
// static server. Optional second origin compares unrelated routes to a baseline.
// node scripts/verify-indexed-routes.mjs http://127.0.0.1:8792 http://127.0.0.1:8791
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const origin = process.argv[2];
const baseline = process.argv[3];
assert(origin, "Supply the Pages preview origin");
const dist = new URL("../dist/", import.meta.url);
const retro = "/retroactive-permits-unpermitted-work-los-angeles";
const adu = "/resources/check-adu-permit-history-los-angeles";
const articles = [
  { canonical: retro, file: retro.slice(1) + ".html", variants: [retro, retro + "/", retro + ".html"] },
  { canonical: adu + "/", file: adu.slice(1) + "/index.html", variants: [adu + "/", adu, adu + ".html", adu + "/index.html"] },
  ...[
    "/free-tools/site-check",
    "/resources/does-sb79-low-rise-apply-los-angeles-property",
    "/resources/los-angeles-housing-programs-chip-sb79-sb684-sb1123"
  ].map((route) => ({ canonical: route + "/", file: route.slice(1) + "/index.html", variants: [route + "/", route, route + "/index.html"] }))
];

async function request(base, pathname) {
  return fetch(new URL(pathname, base), { redirect: "manual", signal: AbortSignal.timeout(15000) });
}

for (const variant of ["/free-tools/la-housing-program-check", "/free-tools/la-housing-program-check/"]) {
  const response = await request(origin, variant + "?intent=sb1123");
  assert.equal(response.status, 301, variant + ": old tool route must redirect");
  const location = new URL(response.headers.get("location"), origin);
  assert.equal(location.pathname, "/free-tools/site-check/", variant + ": old tool route reaches the new tool");
  assert.equal(location.search, "?intent=sb1123", variant + ": old tool route keeps intent");
  console.log(`PASS ${variant}: 301 → ${location.pathname}${location.search}`);
}

for (const { canonical, file, variants } of articles) {
  const expected = await readFile(new URL(file, dist), "utf8");
  for (const variant of variants) {
    for (const query of ["", "?routing_check=1"]) {
      let url = new URL(variant + query, origin);
      let response = await request(origin, url);
      const initialStatus = response.status;
      let redirects = 0;
      if (response.status >= 300 && response.status < 400) {
        assert(response.headers.has("location"), `${variant}: missing redirect location`);
        url = new URL(response.headers.get("location"), url);
        assert.equal(url.origin, new URL(origin).origin, `${variant}: unexpected origin`);
        response = await request(origin, url);
        redirects++;
      }
      assert.equal(response.status, 200, `${variant}: must reach 200 within one redirect`);
      assert.equal(url.pathname, canonical, `${variant}: final path must be canonical`);
      assert.equal(url.search, query, `${variant}: preserve query string`);
      assert.equal(redirects, variant === canonical ? 0 : 1, `${variant}: redirect count`);
      assert.equal(await response.text(), expected, `${variant}: must serve the dedicated article bytes`);
      console.log(`PASS ${variant}${query}: ${initialStatus}${redirects ? " → 200" : ""}; ${redirects} redirects`);
    }
  }
}

if (baseline) {
  const redirects = await readFile(new URL("_redirects", dist), "utf8");
  const routes = new Set([
    "/", "/about/", "/legal/", "/sample-report/", "/case-integrity/",
    "/resources/how-to-check-permit-history-los-angeles/",
    "/resources/permit-drops/los-angeles-building-records-online-first/",
    "/resources/permit-nightmares/nine-departments-one-paper-trail/",
    "/california/jurisdictions/pasadena/", "/assets/permitpulse-resources.css"
  ]);
  for (const line of redirects.split(/\r?\n/)) {
    const source = line.trim().split(/\s+/)[0];
    if (source && !source.startsWith("#") && !source.includes("*") && !source.startsWith(retro) && !source.startsWith(adu) && !source.startsWith("/free-tools/la-housing-program-check")) routes.add(source);
  }
  for (const route of routes) {
    const [before, after] = await Promise.all([request(baseline, route), request(origin, route)]);
    assert.equal(after.status, before.status, route + ": unrelated status changed");
    assert.equal(after.headers.get("location"), before.headers.get("location"), route + ": unrelated redirect changed");
    assert.equal(await after.text(), await before.text(), route + ": unrelated content changed");
  }
  console.log(`PASS ${routes.size} unrelated routes: identical status, Location, and response body to baseline`);
}
