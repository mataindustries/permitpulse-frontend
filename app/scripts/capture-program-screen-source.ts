import { mkdir, readdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { parseArgs } from "node:util";
import { buildHttpCapture } from "../src/shared/program-screen/http-capture";
import {
  FILEGDB_EXTRACTOR,
  FILEGDB_VERSION,
  extractFileGdbPages,
  isFileGdbArchive,
} from "../src/shared/program-screen/filegdb-capture";
import { getDocument, version as pdfjsVersion } from "pdfjs-dist/legacy/build/pdf.mjs";
import {
  CAPTURE_TOOL_PATH,
  captureContextIssues,
  captureDirectoryFor,
  captureFileNames,
  captureHostBasis,
  captureOriginals,
  declaredOriginalFile,
  decodeUtf8Strict,
  EXTRACTED_TEXT_NORMALIZATION,
  extractHtmlPages,
  undatedSourceTypes,
  HTML_TEXT_EXTRACTOR,
  HTML_TEXT_EXTRACTOR_VERSION,
  htmlCaptureIssue,
  isPdf,
  joinExtractedPages,
  OFFICIAL_SOURCE_CAPTURE_DIR,
  OFFICIAL_SOURCE_METADATA_V2_VERSION,
  OFFICIAL_SOURCE_METADATA_VERSION,
  officialSourceCaptureIssues,
  parseOfficialSourceMetadata,
  sha256Hex,
  sha256HexBytes,
  splitExtractedPages,
  TEST_ONLY_SOURCE_CAPTURE_DIR,
  v1SourceTypes,
  v2SourceTypes,
  type OfficialSourceMetadata,
} from "../src/shared/program-screen/source-capture";
import {
  DatasetArchiveError,
  extractDatasetArchivePages,
  isZip,
  ZIP_MANIFEST_EXTRACTOR,
  ZIP_MANIFEST_EXTRACTOR_VERSION,
} from "../src/shared/program-screen/dataset-archive";

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
 * Agency maps and statutes (metadata v2, Phase 2b) also take --context, a
 * JSON file with the `agency_map` or `statute` context block: excerpts the
 * capturer located, each checked against its page before anything is
 * written. A statute may be the exact HTML the official host served
 * (downloaded with curl, never a browser "Save page", print-to-PDF,
 * screenshot, reader-mode export, or reconstruction) or an official PDF:
 *
 *   npm run program-screen:capture -- \
 *     --file <downloaded file> --source-id <source-id> --title "<title>" \
 *     --url <official URL> --type statute --operative-status operative \
 *     --document-date <YYYY-MM-DD> --retrieved-at <ISO time> \
 *     --context <statute-context.json> --notes "<who downloaded it, how>"
 *
 * An adopted regulation's text (--type regulation) is its official PDF. A GIS
 * data archive (--type dataset_archive) is the exact ZIP the official host
 * served; it is stored byte for byte as original.zip, never extracted to disk
 * or re-zipped, and its extracted.txt is the deterministic
 * program-screen-zip-manifest text. A document that prints no date of its own
 * takes --document-date none (regulations and data archives only).
 *
 * A capture never registers an issuer or authority source, and never
 * supports a criterion rule. Registration is a separate reviewed change.
 *
 * Output is deterministic for the same input bytes, flags, and extractor
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
  let metadata: unknown = null;
  try {
    metadata = metadataBytes === null ? null : JSON.parse(metadataBytes.toString("utf8"));
  } catch {
    return ["metadata.json is not valid JSON."];
  }
  const originalFile = declaredOriginalFile(metadata);
  const original = await readIfPresent(resolve(absolute, originalFile));
  const extracted = await readIfPresent(resolve(absolute, captureFileNames.extracted));
  const issues = await officialSourceCaptureIssues({
    directory,
    metadata,
    original: original === null ? null : new Uint8Array(original),
    extracted: extracted === null ? null : extracted.toString("utf8"),
  });
  const expected = new Set<string>([captureFileNames.metadata, captureFileNames.extracted, originalFile]);
  const unexpected = (await readdir(absolute)).filter((name) => !expected.has(name));
  if (unexpected.length > 0) issues.push(`unexpected files ${unexpected.sort().join(", ")}.`);
  if (issues.length > 0 || original === null || extracted === null) return issues;

  // Served HTML and data archives were already re-extracted by officialSourceCaptureIssues.
  const mediaType = (metadata as OfficialSourceMetadata).original.media_type;
  if (mediaType === captureOriginals.html.media_type || mediaType === captureOriginals.zip.media_type) return issues;

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

const sourceTypes: readonly string[] = [...v1SourceTypes, ...v2SourceTypes];
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

  const v2 = (v2SourceTypes as readonly string[]).includes(text("type"));
  if (v2 && typeof values.context !== "string") {
    fail(`--context is required for --type ${v2SourceTypes.join(", --type ")}.`);
  }
  if (!v2 && values.context !== undefined) fail(`--context applies only to --type ${v2SourceTypes.join(", --type ")}.`);
  if (!v2 && (values.headers !== undefined || values["final-url"] !== undefined))
    fail("--headers and --final-url apply only to metadata v2.");
  if (values["final-url"] !== undefined && values.headers === undefined) fail("--final-url requires --headers.");
  const undated = text("document-date") === "none";
  if (undated && !(undatedSourceTypes as readonly string[]).includes(text("type"))) {
    fail(`--document-date none applies only to --type ${undatedSourceTypes.join(", --type ")}.`);
  }

  const inputPath = resolve(process.cwd(), text("file"));
  const input = await readFile(inputPath).catch(() => fail(`cannot read ${inputPath}.`));
  const bytes = new Uint8Array(input);
  let served: "pdf" | "html" | "zip" = "pdf";
  if (text("type") === "dataset_archive") {
    if (!isZip(bytes)) fail("the input is not a ZIP. Capture the exact archive the official host served.");
    served = "zip";
  } else if (!isPdf(bytes)) {
    if (isZip(bytes)) fail("the input is a ZIP; only --type dataset_archive captures an archive.");
    if (text("type") !== "statute") fail("the input is not a PDF. Capture the official PDF itself.");
    const htmlIssue = htmlCaptureIssue(bytes);
    if (htmlIssue !== null) {
      fail(`the input is not a PDF, and it ${htmlIssue}. Capture the official PDF, or the exact HTML the official host served.`);
    }
    served = "html";
  }

  let pages: string[];
  if (served === "zip") {
    try {
      pages = await (isFileGdbArchive(bytes) ? extractFileGdbPages(bytes) : extractDatasetArchivePages(bytes));
    } catch (error) {
      if (!(error instanceof DatasetArchiveError)) throw error;
      fail(`the archive cannot be read: ${error.message}.`);
    }
  } else {
    pages = served === "pdf" ? await extractPages(bytes) : extractHtmlPages(decodeUtf8Strict(bytes) as string);
  }
  const extracted = joinExtractedPages(pages);
  const normalizedPages = splitExtractedPages(extracted);
  const pagesWithoutText = normalizedPages.flatMap((page, index) => (page === "" ? [index + 1] : []));

  let context: unknown = null;
  if (v2) {
    const contextPath = resolve(process.cwd(), values.context as string);
    const contextBytes = await readFile(contextPath).catch(() => fail(`cannot read ${contextPath}.`));
    try {
      context = JSON.parse(contextBytes.toString("utf8"));
    } catch {
      fail("--context is not valid JSON.");
    }
  }

  const testOnly = text("source-id").startsWith("test-only-");
  const common = {
    source_id: text("source-id"),
    title: text("title"),
    official_url: text("url"),
    source_type: text("type"),
    document_date: undated ? null : text("document-date"),
    retrieved_at: text("retrieved-at"),
    sha256_original: await sha256HexBytes(bytes),
    sha256_extracted: await sha256Hex(extracted),
    operative_status: text("operative-status"),
    notes: typeof values.notes === "string" ? values.notes : "",
    may_change_source_ids: (values["may-change"] as string[] | undefined) ?? [],
  };
  const extraction = {
    file: captureFileNames.extracted,
    extractor: served === "pdf" ? "pdfjs-dist" : served === "zip" ? isFileGdbArchive(bytes)
            ? FILEGDB_EXTRACTOR
            : ZIP_MANIFEST_EXTRACTOR : HTML_TEXT_EXTRACTOR,
    extractor_version: served === "pdf" ? pdfjsVersion : served === "zip" ? isFileGdbArchive(bytes)
            ? FILEGDB_VERSION
            : ZIP_MANIFEST_EXTRACTOR_VERSION : HTML_TEXT_EXTRACTOR_VERSION,
    normalization: EXTRACTED_TEXT_NORMALIZATION,
    page_separator: "form_feed",
    page_count: normalizedPages.length,
    pages_without_text: pagesWithoutText,
  };
  const provenance = { capture_tool: CAPTURE_TOOL_PATH, is_ai_generated: false, test_only: testOnly };
  const http = typeof values.headers === "string"
    ? await buildHttpCapture(common.official_url, new Uint8Array(await readFile(resolve(values.headers))), values["final-url"] as string | undefined)
    : undefined;

  // Built in a fixed key order and validated before anything is written.
  let metadata: OfficialSourceMetadata;
  try {
    metadata = parseOfficialSourceMetadata(
      v2
        ? {
            schema_version: OFFICIAL_SOURCE_METADATA_V2_VERSION,
            ...common,
            original: { ...captureOriginals[served], bytes: bytes.byteLength },
            extraction,
            host_basis:
              captureHostBasis(common.official_url, {
                source_id: common.source_id,
                source_type: common.source_type as (typeof v2SourceTypes)[number],
                test_only: testOnly,
              }).basis ?? "global_allowlist",
            agency_map: common.source_type === "agency_map" ? context : null,
            statute: common.source_type === "statute" ? context : null,
            // Phase 3D blocks are written only when used, so earlier captures stay byte-identical on recapture.
            ...(common.source_type === "regulation" ? { regulation: context, dataset_archive: null } : {}),
            ...(common.source_type === "dataset_archive" ? { regulation: null, dataset_archive: context } : {}),
            ...(http === undefined ? {} : { http_capture: http }),
            ...provenance,
          }
        : {
            schema_version: OFFICIAL_SOURCE_METADATA_VERSION,
            ...common,
            original: { ...captureOriginals.pdf, bytes: bytes.byteLength },
            extraction,
            ...provenance,
          },
    );
  } catch (error) {
    fail((error as Error).message);
  }
  // Every context excerpt must be on its page before anything is written.
  const contextIssues = captureContextIssues(metadata, extracted);
  if (contextIssues.length > 0) fail(`the --context does not match the extracted text:\n  - ${contextIssues.join("\n  - ")}`);

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
    const known = new Set<string>([...Object.values(captureFileNames), captureOriginals.html.file, captureOriginals.zip.file]);
    const unknown = (await readdir(absolute)).filter((name) => !known.has(name));
    if (unknown.length > 0) fail(`refusing to replace ${directory}: unexpected files ${unknown.join(", ")}.`);
    await rm(absolute, { recursive: true });
  }

  await mkdir(absolute, { recursive: true });
  // Write the bytes that were hashed, not a second read of the input path.
  await writeFile(resolve(absolute, metadata.original.file), bytes);
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
  if (metadata.source_type === "agency_map") {
    console.log(
      "  NOTE: agency map capture only. It registers no issuer or authority source and establishes no fact;\n" +
        "        registration is a separate, human-reviewed change.",
    );
    if (metadata.operative_status === "proposed_not_operative") {
      console.log("  NOTE: recorded as a recommended or proposed map. It can never be registered or establish a fact.");
    }
  }
  if (metadata.source_type === "statute") {
    console.log(
      "  NOTE: statute capture only. It cannot support a criterion rule; it can prompt the human re-review\n" +
        "        its Round 1 trigger names.",
    );
  }
  if (metadata.source_type === "regulation" || metadata.source_type === "dataset_archive") {
    console.log(
      `  NOTE: ${metadata.source_type} capture only. It registers no issuer or authority source and establishes no fact;\n` +
        "        only a reviewed authority package that pins it can be registered.",
    );
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
    context: { type: "string" },
    headers: { type: "string" },
    "final-url": { type: "string" },
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
