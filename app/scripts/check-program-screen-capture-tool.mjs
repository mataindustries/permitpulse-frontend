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

function sameAsFixture(directory) {
  return ["original.pdf", "extracted.txt", "metadata.json"].every((file) =>
    readFileSync(join(directory, file)).equals(readFileSync(join(fixture, file))),
  );
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

  result = run(["--verify"]);
  check("verifies an intact capture", result.status === 0 && result.output.includes("ok"), result.output);

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
