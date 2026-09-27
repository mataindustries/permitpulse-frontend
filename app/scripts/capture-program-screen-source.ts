import { mkdir, readdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { parseArgs } from "node:util";
import { getDocument, version as pdfjsVersion } from "pdfjs-dist/legacy/build/pdf.mjs";
import {
  CAPTURE_TOOL_PATH,
  captureDirectoryFor,
  captureFileNames,
  EXTRACTED_TEXT_NORMALIZATION,
  isPdf,
  joinExtractedPages,
  OFFICIAL_SOURCE_CAPTURE_DIR,
  OFFICIAL_SOURCE_METADATA_VERSION,
  officialSourceCaptureIssues,
  parseOfficialSourceMetadata,
  sha256Hex,
  sha256HexBytes,
  splitExtractedPages,
  TEST_ONLY_SOURCE_CAPTURE_DIR,
  type OfficialSourceMetadata,
} from "../src/shared/program-screen/source-capture";

/**
 * Ingests a LOCAL copy of an official source document into
 * app/fixtures/program-screen/official-sources/<source-id>/. It never
 * downloads anything: download the file from the official URL yourself, then
 * pass its path here with the URL it came from.
 *
 *   npm run program-screen:capture -- \
 *     --file ~/Downloads/25-1083-S4_ord_188968_06-30-26.pdf \
 *     --source-id ordinance-188968 \
 *     --title "City of Los Angeles Ordinance No. 188968 (SB 79 Phased Implementation Ordinance)" \
 *     --url https://cityclerk.lacity.org/onlinedocs/2025/25-1083-S4_ord_188968_06-30-26.pdf \
 *     --type adopted_ordinance --operative-status operative \
 *     --document-date 2026-06-30 --retrieved-at 2026-09-28T09:15:00-07:00 \
 *     --notes "Downloaded from the City Clerk by <name>."
 *
 *   npm run program-screen:capture -- --verify
 *     Re-hashes and re-extracts every capture; fails on any difference.
 *
 * Output is deterministic for the same input bytes, flags, and pdfjs-dist
 * version. An existing capture is never overwritten without --replace.
 */

const repoRoot = resolve(process.cwd(), "..");
const fromRepo = (path: string) => resolve(repoRoot, path);

function fail(message: string): never {
  console.error(`capture-program-screen-source: ${message}`);
  process.exit(1);
}

async function assertAppRoot(): Promise<void> {
  const manifest = await readFile(resolve(process.cwd(), "package.json"), "utf8").catch(() => "{}");
  if ((JSON.parse(manifest) as { name?: string }).name !== "permitpulse-case-workspace") {
    fail("run this from the app/ directory (npm run program-screen:capture).");
  }
}

/** Page text in content-stream order; `hasEOL` marks line ends. */
async function extractPages(bytes: Uint8Array): Promise<string[]> {
  const task = getDocument({
    // pdfjs may detach the buffer it is given; hand it a copy.
    data: bytes.slice(),
    verbosity: 0,
    disableFontFace: true,
    useSystemFonts: false,
    stopAtErrors: true,
  });
  try {
    const document = await task.promise;
    const pages: string[] = [];
    for (let number = 1; number <= document.numPages; number += 1) {
      const page = await document.getPage(number);
      const content = await page.getTextContent();
      let text = "";
      for (const item of content.items) {
        if (!("str" in item)) continue;
        text += item.str;
        if (item.hasEOL) text += "\n";
      }
      pages.push(text);
    }
    return pages;
  } finally {
    await task.destroy();
  }
}

async function readIfPresent(path: string): Promise<Buffer | null> {
  return readFile(path).catch((error: NodeJS.ErrnoException) => {
    if (error.code === "ENOENT") return null;
    throw error;
  });
}

async function verifyDirectory(directory: string): Promise<string[]> {
  const absolute = fromRepo(directory);
  const metadataBytes = await readIfPresent(resolve(absolute, captureFileNames.metadata));
  const original = await readIfPresent(resolve(absolute, captureFileNames.original));
  const extracted = await readIfPresent(resolve(absolute, captureFileNames.extracted));
  let metadata: unknown = null;
  try {
    metadata = metadataBytes === null ? null : JSON.parse(metadataBytes.toString("utf8"));
  } catch {
    return ["metadata.json is not valid JSON."];
  }
  const issues = await officialSourceCaptureIssues({
    directory,
    metadata,
    original: original === null ? null : new Uint8Array(original),
    extracted: extracted === null ? null : extracted.toString("utf8"),
  });
  if (issues.length > 0 || original === null || extracted === null) return issues;

  // Re-extract: a different pdfjs-dist version or rule change must not pass silently.
  const reextracted = joinExtractedPages(await extractPages(new Uint8Array(original)));
  if (reextracted !== extracted.toString("utf8")) {
    issues.push(
      `re-extraction with pdfjs-dist ${pdfjsVersion} differs from extracted.txt; recapture with --replace and re-review.`,
    );
  }
  const recorded = (metadata as OfficialSourceMetadata).extraction.extractor_version;
  if (recorded !== pdfjsVersion) {
    issues.push(`extracted with pdfjs-dist ${recorded}, but ${pdfjsVersion} is installed.`);
  }
  return issues;
}

async function captureDirectories(): Promise<string[]> {
  const directories: string[] = [];
  for (const root of [OFFICIAL_SOURCE_CAPTURE_DIR, TEST_ONLY_SOURCE_CAPTURE_DIR]) {
    const entries = await readdir(fromRepo(root), { withFileTypes: true }).catch(() => []);
    for (const entry of entries) {
      if (entry.isDirectory()) directories.push(`${root}${entry.name}`);
    }
  }
  return directories.sort();
}

async function verifyAll(): Promise<void> {
  const directories = await captureDirectories();
  let failures = 0;
  for (const directory of directories) {
    const issues = await verifyDirectory(directory);
    if (issues.length === 0) {
      console.log(`ok       ${directory}`);
    } else {
      failures += 1;
      console.error(`FAILED   ${directory}\n  - ${issues.join("\n  - ")}`);
    }
  }
  if (directories.length === 0) console.log("No captures found.");
  if (failures > 0) fail(`${failures} capture(s) failed verification.`);
}

const sourceTypes = ["adopted_ordinance", "official_memo", "proposed_draft"];
const statuses = ["operative", "proposed_not_operative", "status_unconfirmed", "superseded"];

async function capture(values: Record<string, string | boolean | string[] | undefined>): Promise<void> {
  const required = [
    "file",
    "source-id",
    "title",
    "url",
    "type",
    "document-date",
    "operative-status",
    "retrieved-at",
  ] as const;
  const missing = required.filter((name) => typeof values[name] !== "string");
  if (missing.length > 0) fail(`missing --${missing.join(", --")}.`);
  const text = (name: (typeof required)[number]) => values[name] as string;
  if (!sourceTypes.includes(text("type"))) fail(`--type must be one of ${sourceTypes.join(", ")}.`);
  if (!statuses.includes(text("operative-status"))) {
    fail(`--operative-status must be one of ${statuses.join(", ")}.`);
  }

  const inputPath = resolve(process.cwd(), text("file"));
  const input = await readFile(inputPath).catch(() => fail(`cannot read ${inputPath}.`));
  const bytes = new Uint8Array(input);
  if (!isPdf(bytes)) fail("the input is not a PDF. Capture the official PDF itself.");

  const pages = await extractPages(bytes);
  const extracted = joinExtractedPages(pages);
  const normalizedPages = splitExtractedPages(extracted);
  const pagesWithoutText = normalizedPages.flatMap((page, index) => (page === "" ? [index + 1] : []));

  // Built in a fixed key order and validated before anything is written.
  let metadata: OfficialSourceMetadata;
  try {
    metadata = parseOfficialSourceMetadata({
      schema_version: OFFICIAL_SOURCE_METADATA_VERSION,
      source_id: text("source-id"),
      title: text("title"),
      official_url: text("url"),
      source_type: text("type"),
      document_date: text("document-date"),
      retrieved_at: text("retrieved-at"),
      sha256_original: await sha256HexBytes(bytes),
      sha256_extracted: await sha256Hex(extracted),
      operative_status: text("operative-status"),
      notes: typeof values.notes === "string" ? values.notes : "",
      may_change_source_ids: (values["may-change"] as string[] | undefined) ?? [],
      original: {
        file: captureFileNames.original,
        media_type: "application/pdf",
        bytes: bytes.byteLength,
      },
      extraction: {
        file: captureFileNames.extracted,
        extractor: "pdfjs-dist",
        extractor_version: pdfjsVersion,
        normalization: EXTRACTED_TEXT_NORMALIZATION,
        page_separator: "form_feed",
        page_count: normalizedPages.length,
        pages_without_text: pagesWithoutText,
      },
      capture_tool: CAPTURE_TOOL_PATH,
      is_ai_generated: false,
      test_only: text("source-id").startsWith("test-only-"),
    });
  } catch (error) {
    fail((error as Error).message);
  }

  const directory = captureDirectoryFor(metadata);
  const absolute = fromRepo(directory);
  const exists = await stat(absolute).then(
    () => true,
    () => false,
  );
  if (exists) {
    if (values.replace !== true) {
      fail(`${directory} already exists. Captures are immutable; pass --replace to recapture.`);
    }
    const known = new Set<string>(Object.values(captureFileNames));
    const unknown = (await readdir(absolute)).filter((name) => !known.has(name));
    if (unknown.length > 0) fail(`refusing to replace ${directory}: unexpected files ${unknown.join(", ")}.`);
    await rm(absolute, { recursive: true });
  }

  await mkdir(absolute, { recursive: true });
  // Write the bytes that were hashed, not a second read of the input path.
  await writeFile(resolve(absolute, captureFileNames.original), bytes);
  await writeFile(resolve(absolute, captureFileNames.extracted), extracted, "utf8");
  await writeFile(
    resolve(absolute, captureFileNames.metadata),
    `${JSON.stringify(metadata, null, 2)}\n`,
    "utf8",
  );

  const issues = await verifyDirectory(directory);
  if (issues.length > 0) fail(`capture failed verification:\n  - ${issues.join("\n  - ")}`);

  console.log(`Captured ${directory}`);
  console.log(`  sha256_original   ${metadata.sha256_original}`);
  console.log(`  sha256_extracted  ${metadata.sha256_extracted}`);
  console.log(`  pages             ${metadata.extraction.page_count}`);
  if (pagesWithoutText.length > 0) {
    console.log(`  WARNING: no extractable text on pages ${pagesWithoutText.join(", ")}.`);
  }
  if (metadata.source_type === "proposed_draft") {
    console.log("  NOTE: proposed draft. It can prompt a re-review; it can never support a rule.");
  }
}

await assertAppRoot();
const { values } = parseArgs({
  options: {
    file: { type: "string" },
    "source-id": { type: "string" },
    title: { type: "string" },
    url: { type: "string" },
    type: { type: "string" },
    "document-date": { type: "string" },
    "operative-status": { type: "string" },
    "retrieved-at": { type: "string" },
    notes: { type: "string" },
    "may-change": { type: "string", multiple: true },
    replace: { type: "boolean", default: false },
    verify: { type: "boolean", default: false },
  },
  strict: true,
});

if (values.verify) {
  await verifyAll();
} else {
  await capture(values);
}
