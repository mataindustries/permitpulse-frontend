import { spawnSync } from "node:child_process";
import { cpSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

/**
 * End-to-end check of the Program Screen capture CLI against the TEST-ONLY
 * synthetic PDF, run in a throwaway copy of the fixture tree so the
 * repository is never written. Run with `npm run program-screen:capture:selftest`.
 */

const appRoot = process.cwd();
const tool = resolve(appRoot, "node_modules/.cache/permitpulse/capture-program-screen-source.mjs");
const fixture = resolve(appRoot, "fixtures/program-screen/test-only-sources/test-only-adopted-ordinance-000001");
const sourcePdf = join(fixture, "original.pdf");
const metadata = JSON.parse(readFileSync(join(fixture, "metadata.json"), "utf8"));

const temp = mkdtempSync(join(tmpdir(), "program-screen-capture-"));
const tempApp = join(temp, "app");
const captureRoot = join(tempApp, "fixtures/program-screen");
cpSync(resolve(appRoot, "package.json"), join(tempApp, "package.json"));
cpSync(resolve(appRoot, "fixtures/program-screen/official-sources"), join(captureRoot, "official-sources"), {
  recursive: true,
});

const testOnlyDir = join(captureRoot, "test-only-sources", metadata.source_id);
const failures = [];

function run(args) {
  const result = spawnSync(process.execPath, [tool, ...args], { cwd: tempApp, encoding: "utf8" });
  return { status: result.status, output: `${result.stdout}${result.stderr}` };
}

function captureArgs(overrides = {}) {
  const flags = {
    file: sourcePdf,
    "source-id": metadata.source_id,
    title: metadata.title,
    url: metadata.official_url,
    type: metadata.source_type,
    "document-date": metadata.document_date,
    "operative-status": metadata.operative_status,
    "retrieved-at": metadata.retrieved_at,
    notes: metadata.notes,
    ...overrides,
  };
  return Object.entries(flags).flatMap(([name, value]) => (value === null ? [] : [`--${name}`, value]));
}

function check(name, condition, detail = "") {
  console.log(`${condition ? "ok  " : "FAIL"}  ${name}`);
  if (!condition) failures.push(`${name}${detail ? `\n${detail}` : ""}`);
}

function expectRefusal(name, args, message, createdDir = null) {
  const result = run(args);
  check(
    name,
    result.status === 1 && result.output.includes(message) && (createdDir === null || !existsSync(createdDir)),
    result.output,
  );
}

function sameAsFixture(directory, source = fixture) {
  const original = JSON.parse(readFileSync(join(source, "metadata.json"), "utf8")).original.file;
  return [original, "extracted.txt", "metadata.json"].every((file) =>
    readFileSync(join(directory, file)).equals(readFileSync(join(source, file))),
  );
}

/* ----------------------------- metadata v2: agency map and statute (Phase 2b) */

const v2Fixtures = Object.fromEntries(
  ["test-only-agency-map-000001", "test-only-statute-000001", "test-only-statute-pdf-000001"].map((id) => {
    const directory = resolve(appRoot, "fixtures/program-screen/test-only-sources", id);
    const meta = JSON.parse(readFileSync(join(directory, "metadata.json"), "utf8"));
    return [id, { directory, meta, original: join(directory, meta.original.file) }];
  }),
);

/** Writes a --context file holding the fixture's context block, optionally edited. */
function contextFile(id, edit = (block) => block) {
  const { meta } = v2Fixtures[id];
  const block = structuredClone(meta.source_type === "agency_map" ? meta.agency_map : meta.statute);
  const path = join(temp, `${id}-${Math.random().toString(36).slice(2)}.context.json`);
  writeFileSync(path, JSON.stringify(edit(block)));
  return path;
}

function v2Args(id, overrides = {}) {
  const { meta, original } = v2Fixtures[id];
  const flags = {
    file: original,
    "source-id": meta.source_id,
    title: meta.title,
    url: meta.official_url,
    type: meta.source_type,
    "document-date": meta.document_date,
    "operative-status": meta.operative_status,
    "retrieved-at": meta.retrieved_at,
    notes: meta.notes,
    context: contextFile(id),
    ...overrides,
  };
  return Object.entries(flags).flatMap(([name, value]) => (value === null ? [] : [`--${name}`, value]));
}

try {
  let result = run(captureArgs());
  check("captures a local PDF", result.status === 0, result.output);
  check("reproduces the committed capture byte for byte", sameAsFixture(testOnlyDir));

  expectRefusal("refuses to overwrite without --replace", captureArgs(), "already exists");
  check("leaves the refused capture untouched", sameAsFixture(testOnlyDir));

  result = run([...captureArgs(), "--replace"]);
  check("recaptures with --replace, deterministically", result.status === 0 && sameAsFixture(testOnlyDir), result.output);

  result = run([...captureArgs({ file: join(testOnlyDir, "original.pdf") }), "--replace"]);
  check("recaptures from its own original.pdf", result.status === 0 && sameAsFixture(testOnlyDir), result.output);

  const officialDir = join(captureRoot, "official-sources", "ordinance-000000");
  const official = { "source-id": "ordinance-000000" };
  expectRefusal(
    "refuses a secondary-site URL for an official source",
    captureArgs({ ...official, url: "https://www.example.com/ordinance-000000.pdf" }),
    "is not an official source host",
    officialDir,
  );
  expectRefusal(
    "refuses a non-HTTPS official URL",
    captureArgs({ ...official, url: "http://cityclerk.lacity.org/onlinedocs/ordinance-000000.pdf" }),
    "must use HTTPS",
    officialDir,
  );
  expectRefusal(
    "refuses an official host for a test-only source",
    captureArgs({ "source-id": "test-only-host-check", url: "https://cityclerk.lacity.org/x.pdf" }),
    ".example.test host",
    join(captureRoot, "test-only-sources", "test-only-host-check"),
  );
  expectRefusal(
    "refuses a draft recorded as operative",
    captureArgs({ "source-id": "test-only-draft-check", type: "proposed_draft", "operative-status": "operative" }),
    "must be recorded as proposed_not_operative",
    join(captureRoot, "test-only-sources", "test-only-draft-check"),
  );
  expectRefusal(
    "refuses an adopted ordinance recorded as proposed",
    captureArgs({ "source-id": "test-only-status-check", "operative-status": "proposed_not_operative" }),
    "cannot be recorded as proposed_not_operative",
    join(captureRoot, "test-only-sources", "test-only-status-check"),
  );
  expectRefusal(
    "refuses a non-PDF file",
    captureArgs({ "source-id": "test-only-pdf-check", file: join(fixture, "extracted.txt") }),
    "not a PDF",
    join(captureRoot, "test-only-sources", "test-only-pdf-check"),
  );
  expectRefusal("refuses missing flags", captureArgs({ url: null }), "missing --url");
  expectRefusal(
    "refuses a document dated after retrieval",
    captureArgs({ "source-id": "test-only-date-check", "document-date": "2026-12-31" }),
    "cannot be dated after it was retrieved",
    join(captureRoot, "test-only-sources", "test-only-date-check"),
  );

  for (const id of Object.keys(v2Fixtures)) {
    result = run(v2Args(id));
    check(`captures ${id}`, result.status === 0, result.output);
    check(`reproduces ${id} byte for byte`, sameAsFixture(join(captureRoot, "test-only-sources", id), v2Fixtures[id].directory));
  }
  result = run(v2Args("test-only-agency-map-000001", { replace: null }));
  check("never overwrites a v2 capture without --replace", result.status === 1 && result.output.includes("already exists"), result.output);
  check(
    "notes that a map capture registers nothing",
    run([...v2Args("test-only-agency-map-000001"), "--replace"]).output.includes("registers no issuer or authority source"),
  );

  const mapId = "test-only-agency-map-000001";
  const htmlId = "test-only-statute-000001";
  const pdfStatuteId = "test-only-statute-pdf-000001";
  const testOnly = (name) => join(captureRoot, "test-only-sources", name);
  expectRefusal("refuses an agency map without --context", v2Args(mapId, { context: null }), "--context is required");
  expectRefusal(
    "refuses --context for an ordinance",
    [...captureArgs({ "source-id": "test-only-context-check" }), "--context", contextFile(mapId)],
    "--context applies only",
    testOnly("test-only-context-check"),
  );
  expectRefusal(
    "refuses an agency map on a host no reviewed exception covers",
    v2Args(mapId, { "source-id": "fire-map-000000", url: "https://hazard-maps.agency.example/maps/fire-map-000000.pdf" }),
    "no reviewed host exception covers source fire-map-000000",
    join(captureRoot, "official-sources", "fire-map-000000"),
  );
  expectRefusal(
    "refuses a statute on a host no reviewed exception covers",
    v2Args(pdfStatuteId, { "source-id": "statute-000000", url: "https://statutes.agency.example/tst-2-1.pdf" }),
    "is not an official source host",
    join(captureRoot, "official-sources", "statute-000000"),
  );
  expectRefusal(
    "refuses a statute page whose URL requests another section",
    v2Args(htmlId, {
      "source-id": "test-only-section-check",
      url: "https://leginfo.example.test/faces/codes_displaySection.xhtml?lawCode=TST&sectionNum=1.10",
    }),
    "sectionNum=1.10, not TST 1.1",
    testOnly("test-only-section-check"),
  );
  expectRefusal(
    "refuses a statute page whose URL requests another code",
    v2Args(htmlId, {
      "source-id": "test-only-code-check",
      url: "https://leginfo.example.test/faces/codes_displaySection.xhtml?lawCode=GOV&sectionNum=1.1",
    }),
    "lawCode=GOV",
    testOnly("test-only-code-check"),
  );
  expectRefusal(
    "refuses a pinpoint excerpt that is not in the statute",
    v2Args(htmlId, {
      "source-id": "test-only-pinpoint-check",
      context: contextFile(htmlId, (block) => {
        block.pinpoints[0].excerpt.text = "(9) An invented paragraph nine.";
        return block;
      }),
    }),
    "does not match the extracted text",
    testOnly("test-only-pinpoint-check"),
  );
  expectRefusal(
    "refuses a legend excerpt placed on the wrong page",
    v2Args(mapId, {
      "source-id": "test-only-legend-page-check",
      context: contextFile(mapId, (block) => {
        block.responsibility_areas[0].excerpts[0].page = 1;
        return block;
      }),
    }),
    "is not on page 1",
    testOnly("test-only-legend-page-check"),
  );
  expectRefusal(
    "refuses an operative map without an edition date",
    v2Args(mapId, {
      "source-id": "test-only-edition-check",
      context: contextFile(mapId, (block) => {
        block.edition = { label: null, date: null, date_kind: null, excerpt: null };
        return block;
      }),
    }),
    "An operative map has an established edition date",
    testOnly("test-only-edition-check"),
  );
  expectRefusal(
    "refuses an HTML file for an agency map",
    v2Args(mapId, { "source-id": "test-only-map-html-check", file: v2Fixtures[htmlId].original }),
    "not a PDF",
    testOnly("test-only-map-html-check"),
  );
  const browserCopy = join(temp, "browser-saved.html");
  writeFileSync(
    browserCopy,
    readFileSync(v2Fixtures[htmlId].original, "utf8").replace(
      "<html",
      "<!-- saved from url=(0080)https://leginfo.example.test/faces/codes_displaySection.xhtml -->\n<html",
    ),
  );
  expectRefusal(
    "refuses a browser-saved copy of a statute page",
    v2Args(htmlId, { "source-id": "test-only-browser-copy-check", file: browserCopy }),
    "save-page marker",
    testOnly("test-only-browser-copy-check"),
  );
  expectRefusal(
    "refuses a statute recorded as proposed",
    v2Args(htmlId, { "source-id": "test-only-proposed-statute-check", "operative-status": "proposed_not_operative" }),
    "cannot be recorded as proposed_not_operative",
    testOnly("test-only-proposed-statute-check"),
  );
  expectRefusal(
    "refuses an operative statute without its history note",
    v2Args(htmlId, {
      "source-id": "test-only-status-note-check",
      context: contextFile(htmlId, (block) => ({ ...block, status_as_published: null })),
    }),
    "history or effective-date note",
    testOnly("test-only-status-note-check"),
  );
  expectRefusal(
    "refuses an agency map that names sources it may change",
    v2Args(mapId, { "source-id": "test-only-may-change-check", "may-change": "test-only-adopted-ordinance-000001" }),
    "Only a proposed draft records sources it may change",
    testOnly("test-only-may-change-check"),
  );
  result = run(v2Args(mapId, { "source-id": "test-only-proposed-map-check", "operative-status": "proposed_not_operative" }));
  check(
    "captures a recommended map as proposed_not_operative, noting it can never be registered",
    result.status === 0 && result.output.includes("can never be registered or establish a fact"),
    result.output,
  );

  /* ------------------------- Phase 3D: an adopted regulation and a data archive */

  const phase3d = Object.fromEntries(
    ["ccr-19-2201-fhsz-sra-final-text", "calfire-fhszsra-23-3-data"].map((id) => {
      const directory = resolve(appRoot, "fixtures/program-screen/official-sources", id);
      const meta = JSON.parse(readFileSync(join(directory, "metadata.json"), "utf8"));
      return [id, { directory, meta, original: join(directory, meta.original.file) }];
    }),
  );
  const [regulationId, datasetId] = Object.keys(phase3d);
  function phase3dContext(id, edit = (block) => block) {
    const { meta } = phase3d[id];
    const block = structuredClone(meta.source_type === "regulation" ? meta.regulation : meta.dataset_archive);
    const path = join(temp, `${id}-${Math.random().toString(36).slice(2)}.context.json`);
    writeFileSync(path, JSON.stringify(edit(block)));
    return path;
  }
  function phase3dArgs(id, overrides = {}) {
    const { meta, original } = phase3d[id];
    const flags = {
      file: original,
      "source-id": meta.source_id,
      title: meta.title,
      url: meta.official_url,
      type: meta.source_type,
      "document-date": meta.document_date ?? "none",
      "operative-status": meta.operative_status,
      "retrieved-at": meta.retrieved_at,
      notes: meta.notes,
      context: phase3dContext(id),
      ...overrides,
    };
    return [...Object.entries(flags).flatMap(([name, value]) => (value === null ? [] : [`--${name}`, value])), "--replace"];
  }
  const officialCopy = (id) => join(captureRoot, "official-sources", id);
  for (const id of [regulationId, datasetId]) {
    result = run(phase3dArgs(id));
    check(`recaptures ${id}`, result.status === 0, result.output);
    check(`reproduces ${id} byte for byte`, sameAsFixture(officialCopy(id), phase3d[id].directory));
  }
  const refusedPhase3d = (name, id, overrides, message) => {
    const result = run(phase3dArgs(id, overrides));
    check(name, result.status === 1 && result.output.includes(message) && sameAsFixture(officialCopy(id), phase3d[id].directory), result.output);
  };
  refusedPhase3d("refuses a PDF as a data archive", datasetId, { file: phase3d[regulationId].original }, "the input is not a ZIP");
  refusedPhase3d(
    "refuses a ZIP as a regulation",
    regulationId,
    { file: phase3d[datasetId].original },
    "only --type dataset_archive captures an archive",
  );
  expectRefusal(
    "refuses an undated agency map",
    v2Args(mapId, { "source-id": "test-only-undated-map-check", "document-date": "none" }),
    "--document-date none applies only",
    testOnly("test-only-undated-map-check"),
  );
  refusedPhase3d(
    "refuses a regulation heading that does not open its section",
    regulationId,
    { context: phase3dContext(regulationId, (block) => ({ ...block, section: "2200" })) },
    "must open section 2200",
  );
  refusedPhase3d(
    "refuses a regulation section heading on the wrong page",
    regulationId,
    { context: phase3dContext(regulationId, (block) => ({ ...block, section_heading: { ...block.section_heading, page: 3 } })) },
    "does not match the extracted text",
  );
  refusedPhase3d(
    "refuses a data archive whose class counts differ from its table",
    datasetId,
    {
      context: phase3dContext(datasetId, (block) => {
        block.class_field.values[0].count += 1;
        block.class_field.values[1].count -= 1;
        return block;
      }),
    },
    "does not take exactly the recorded values",
  );
  refusedPhase3d(
    "refuses a data archive read by its numeric class code",
    datasetId,
    {
      context: phase3dContext(datasetId, (block) => {
        block.class_field.field = "FHSZ";
        return block;
      }),
    },
    "does not take exactly the recorded values",
  );

  result = run(["--verify"]);
  check("verifies an intact capture", result.status === 0 && result.output.includes("ok"), result.output);

  const htmlCapture = testOnly(htmlId);
  const servedPath = join(htmlCapture, "original.html");
  const served = readFileSync(servedPath);
  writeFileSync(servedPath, Buffer.from(served.toString("utf8").replace("fictional parcel", "fictional lot")));
  result = run(["--verify"]);
  check(
    "detects an edited original.html",
    result.status === 1 && result.output.includes("original.html does not match sha256_original"),
    result.output,
  );
  writeFileSync(servedPath, served);
  writeFileSync(join(htmlCapture, "original.pdf"), readFileSync(sourcePdf));
  result = run(["--verify"]);
  check("detects a stray file in a capture", result.status === 1 && result.output.includes("unexpected files original.pdf"), result.output);
  rmSync(join(htmlCapture, "original.pdf"));
  check("verifies v2 captures again once restored", run(["--verify"]).status === 0);

  const extractedPath = join(testOnlyDir, "extracted.txt");
  const extracted = readFileSync(extractedPath);
  writeFileSync(extractedPath, extracted.toString("utf8").replace("excluded", "not excluded"));
  result = run(["--verify"]);
  check(
    "detects an edited extracted.txt",
    result.status === 1 && result.output.includes("extracted.txt does not match sha256_extracted"),
    result.output,
  );
  writeFileSync(extractedPath, extracted);

  const originalPath = join(testOnlyDir, "original.pdf");
  const original = readFileSync(originalPath);
  const tampered = Buffer.from(original);
  tampered[tampered.length - 20] ^= 0x01;
  writeFileSync(originalPath, tampered);
  result = run(["--verify"]);
  check(
    "detects a modified original.pdf",
    result.status === 1 && result.output.includes("original.pdf does not match sha256_original"),
    result.output,
  );
  writeFileSync(originalPath, original);
  check("verifies again once restored", run(["--verify"]).status === 0);
} finally {
  rmSync(temp, { recursive: true, force: true });
}

if (failures.length > 0) {
  console.error(`\nCapture tool self-test failed:\n- ${failures.join("\n- ")}`);
  process.exitCode = 1;
} else {
  console.log("\nCapture tool self-test passed.");
}
