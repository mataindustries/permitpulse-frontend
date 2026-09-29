import { describe, expect, inject, it } from "vitest";
import designDoc from "../../docs/PROGRAM_SCREEN_SOURCE_CAPTURE_2B.md?raw";
import fixtureJson from "../fixtures/program-screen/fictional-la-parcel.json";
import decisionsJson from "../fixtures/program-screen/human-review-rounds/round-1-decisions.json";
import roundJson from "../fixtures/program-screen/human-review-rounds/round-1.json";
import { IntegrityValidationError } from "../src/shared/build-week-integrity/validation";
import {
  parseProgramAuthorityRegistries,
  programAuthorityRegistries,
  type ProgramAuthorityRegistries,
  type ReviewedAuthoritySource,
} from "../src/shared/program-screen/authority-policy";
import { evaluateProgramScreen, programScreenPathwayPacks } from "../src/shared/program-screen/evaluate";
import {
  expectedOfficialSources,
  humanReviewCaptureIssues,
  humanReviewDecisionsSchema,
  humanReviewRoundSchema,
  statuteRereviewTriggers,
  statuteRereviewWarnings,
} from "../src/shared/program-screen/proposed-verification";
import { buildProgramScreenPublicDemoPayload } from "../src/shared/program-screen/public-demo";
import { programSourceCaptureSchema } from "../src/shared/program-screen/schema";
import {
  authoritySourceCaptureIssues,
  canSupportCriterionRule,
  captureContextIssues,
  captureHostBasis,
  extractHtmlPages,
  HTML_TEXT_EXTRACTOR,
  HTML_TEXT_EXTRACTOR_VERSION,
  htmlCaptureIssue,
  humanRecordCaptureIssues,
  joinExtractedPages,
  OFFICIAL_SOURCE_METADATA_V2_VERSION,
  OFFICIAL_SOURCE_METADATA_VERSION,
  officialSourceCaptureIssues,
  officialSourceHosts,
  officialSourceMetadataSchema,
  officialSourceMetadataSchemaWith,
  officialSourceMetadataV1Schema,
  officialSourceUrlIssue,
  parseSourceHostExceptions,
  sha256Hex,
  sha256HexBytes,
  sourceHostExceptions,
  statuteUrlIssue,
  v1SourceTypes,
  v2SourceTypes,
  type OfficialSourceMetadata,
  type OfficialSourceMetadataV2,
  type SourceHostException,
} from "../src/shared/program-screen/source-capture";
import {
  officialSourceTypes,
  operativeSourceTypes,
  type ProgramCriterionHumanVerification,
  type ProgramFactKey,
} from "../src/shared/program-screen/types";

/**
 * Phase 2b: agency-map and statute captures (metadata v2), source-specific
 * host exceptions, registration readiness, and the statute re-review
 * trigger. Design and decisions B1-B8: docs/PROGRAM_SCREEN_SOURCE_CAPTURE_2B.md.
 * Every capture here is TEST-ONLY and fictional.
 */

/* ------------------------------------------------------- capture loading */

const TEST_ONLY_DIR = "app/fixtures/program-screen/test-only-sources/";
const OFFICIAL_DIR = "app/fixtures/program-screen/official-sources/";

function byDirectory<T>(files: Record<string, T>): Record<string, T> {
  return Object.fromEntries(
    Object.entries(files).map(([path, value]) => [path.replace(/^\.\.\//, "app/").replace(/\/[^/]+$/, ""), value]),
  );
}

function dataUrlBytes(url: string): Uint8Array {
  return Uint8Array.from(atob(url.slice(url.indexOf(",") + 1)), (character) => character.charCodeAt(0));
}

const testOnlyMetadata = byDirectory(
  import.meta.glob("../fixtures/program-screen/test-only-sources/*/metadata.json", { import: "default", eager: true }) as Record<
    string,
    OfficialSourceMetadata
  >,
);
const testOnlyExtracted = byDirectory(
  import.meta.glob("../fixtures/program-screen/test-only-sources/*/extracted.txt", { query: "?raw", import: "default", eager: true }) as Record<
    string,
    string
  >,
);
const testOnlyPdfs = byDirectory(
  import.meta.glob("../fixtures/program-screen/test-only-sources/*/original.pdf", { query: "?inline", import: "default", eager: true }) as Record<
    string,
    string
  >,
);
const testOnlyHtml = byDirectory(
  import.meta.glob("../fixtures/program-screen/test-only-sources/*/original.html", { query: "?raw", import: "default", eager: true }) as Record<
    string,
    string
  >,
);

interface Capture {
  directory: string;
  metadata: OfficialSourceMetadataV2;
  original: Uint8Array;
  extracted: string;
}

function loadV2(id: string): Capture {
  const directory = `${TEST_ONLY_DIR}${id}`;
  const metadata = testOnlyMetadata[directory];
  if (metadata?.schema_version !== OFFICIAL_SOURCE_METADATA_V2_VERSION) throw new Error(`Not a v2 capture: ${directory}`);
  // Served HTML is loaded as text; its UTF-8 encoding is the exact file (the SHA-256 pin proves it).
  const original =
    metadata.original.file === "original.html"
      ? new TextEncoder().encode(testOnlyHtml[directory])
      : dataUrlBytes(testOnlyPdfs[directory]);
  return { directory, metadata, original, extracted: testOnlyExtracted[directory] };
}

const map = loadV2("test-only-agency-map-000001");
const statuteHtml = loadV2("test-only-statute-000001");
const statutePdf = loadV2("test-only-statute-pdf-000001");
const v2Captures = [map, statuteHtml, statutePdf];

const officialMetadata = byDirectory(
  import.meta.glob("../fixtures/program-screen/official-sources/*/metadata.json", { import: "default", eager: true }) as Record<
    string,
    OfficialSourceMetadata
  >,
);
const officialExtracted = byDirectory(
  import.meta.glob("../fixtures/program-screen/official-sources/*/extracted.txt", { query: "?raw", import: "default", eager: true }) as Record<
    string,
    string
  >,
);
const officialByteChecks = inject("programScreenOfficialCaptureByteChecks");

/** Production Program Screen modules, as source text. */
const productionSources = import.meta.glob("../src/shared/program-screen/**/*.ts", {
  query: "?raw",
  import: "default",
  eager: true,
}) as Record<string, string>;

const decisions = humanReviewDecisionsSchema.parse(decisionsJson);
const round = humanReviewRoundSchema.parse(roundJson);

/* ---------------------------------------------------------------- helpers */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Draft = Record<string, any>;

function edited(capture: Capture, change: (draft: Draft) => void): Draft {
  const draft = structuredClone(capture.metadata) as Draft;
  change(draft);
  return draft;
}

function expectCode(action: () => unknown, code: string): void {
  try {
    action();
    throw new Error("Expected validation to fail.");
  } catch (error) {
    expect(error).toBeInstanceOf(IntegrityValidationError);
    expect(error).toMatchObject({ code });
  }
}

/** A TEST-ONLY reviewed exception for a fictional official map on a non-allowlisted host. */
function testException(overrides: Partial<SourceHostException> = {}): SourceHostException {
  return {
    exception_id: "fictional-fire-map-host",
    source_id: "fictional-fire-map-000001",
    source_type: "agency_map",
    host: "hazard-maps.agency.example",
    path_prefix: "/published/maps/",
    operator: "TEST-ONLY Fictional Fire Agency 000001",
    reason: "TEST-ONLY: exercises the per-source host exception mechanism.",
    review: {
      reviewer: { kind: "human", name: "TEST-ONLY Fictional Reviewer", role: "Synthetic test fixture" },
      reviewed_on: "2026-09-28",
      decision_ref: null,
    },
    ...overrides,
  };
}
const EXCEPTIONS: readonly SourceHostException[] = [testException()];
const EXCEPTION_URL = "https://hazard-maps.agency.example/published/maps/fictional-fire-map-000001.pdf";

/** The TEST-ONLY map, relabeled in memory as an official capture the TEST-ONLY exception admits. */
function officialMap(change: (draft: Draft) => void = () => {}): OfficialSourceMetadata {
  return edited(map, (draft) => {
    draft.source_id = "fictional-fire-map-000001";
    draft.test_only = false;
    draft.official_url = EXCEPTION_URL;
    draft.host_basis = { exception_id: "fictional-fire-map-host" };
    change(draft);
  }) as OfficialSourceMetadata;
}

/**
 * The TEST-ONLY map's legend recorded for the map as a whole, as for a map
 * that states no responsibility area (Phase 3C).
 */
const MAP_WIDE_LEGEND = {
  classes: ["very_high", "high", "moderate"],
  excerpts: [{ page: 2, text: "Very High Fire Hazard Severity Zone High Fire Hazard Severity Zone Moderate Fire Hazard Severity Zone" }],
};

/** A TEST-ONLY registration of an agency map, as a reviewer would enter it in authority-policy.ts. */
function mapRegistration(overrides: Partial<ReviewedAuthoritySource> = {}): ReviewedAuthoritySource {
  return {
    authority_source_id: "fictional-fire-map-000001-edition-000001",
    record_kind: "agency_hazard_map",
    issuer_id: "fictional-fire-agency-000001",
    title: map.metadata.title,
    edition: { label: "Edition 000001", date: "2026-01-15", date_kind: "effective" },
    capture: { source_id: "fictional-fire-map-000001", sha256_extracted: map.metadata.sha256_extracted },
    fact_keys: ["very-high-fire-hazard-severity-zone", "high-fire-hazard-severity-zone"],
    superseded_by: null,
    review: {
      reviewer: { kind: "human", name: "TEST-ONLY Fictional Reviewer", role: "Synthetic test fixture" },
      reviewed_on: "2026-09-28",
      decision_ref: null,
    },
    ...overrides,
  };
}

/**
 * The registration-readiness check run over a registry (B6). With the shipped
 * registries it runs on every registered source; today there are none.
 */
async function registryReadinessIssues(
  registries: ProgramAuthorityRegistries,
  captures: ReadonlyArray<{ metadata: OfficialSourceMetadata; extracted: string }>,
  exceptions: readonly SourceHostException[] = sourceHostExceptions,
): Promise<Record<string, string[]>> {
  const result: Record<string, string[]> = {};
  for (const source of registries.sources) {
    const capture = captures.find((candidate) => candidate.metadata.source_id === source.capture.source_id);
    result[source.authority_source_id] =
      capture === undefined
        ? [`${source.capture.source_id} is not captured.`]
        : await authoritySourceCaptureIssues(source, capture, exceptions);
  }
  return result;
}

const officialCaptures = Object.keys(officialMetadata)
  .sort()
  .map((directory) => ({ metadata: officialMetadata[directory], extracted: officialExtracted[directory] }));

/* ======================================================================== */

describe("1. v1 metadata is frozen and the four existing captures are unchanged", () => {
  const PINS: Record<string, [string, string]> = {
    "low-rise-draft-2026-09-24": [
      "c451896908430f573206209c6c154c62c95b2c396ffdebe5a7e8505560a8d9a7",
      "3f31319db3820b36cd3755f7e5572ef414181c283fb7659c0eea13f61dd4ec65",
    ],
    "ordinance-188967": [
      "d03eda1a3b6d790d1e1331040118c5661b2d87f202e6389839982b9e5a2ed24f",
      "279b3724eb25b8e9bee0efeedd1eb500089b993a5dd7af6925c05019db605e25",
    ],
    "ordinance-188968": [
      "e355179f5e7dfb58626f596d2023549279a53b4a3431f691a599557b5f7519e3",
      "91ea56cfb5db7b1d0f42bba4afef52179fd9052ef726d7a337fe35091410a588",
    ],
    "shra-2025-10-28": [
      "c7063b881987dc855bb74a674f0d344233f7b7d2859544850c54176d347d8b5e",
      "f44574084091c51419d0475d4b8501d9a2c3577b3a16830fc6ecb2a88b20f6e2",
    ],
  };

  it("keeps exactly the four existing official captures on v1, byte-valid and pinned", async () => {
    // Phase 3A adds one v2 statute capture, gcs-66499-41, pinned in
    // program-screen-statute-capture-3a.test.ts; Phase 3D adds the three v2 members of the
    // CAL FIRE SRA package. The four v1 captures are unchanged.
    expect(Object.keys(officialMetadata).sort()).toEqual(
      [...Object.keys(PINS), "gcs-66499-41", "calfire-fhszsra-23-3-data", "calfire-sra-fhsz-map-2023-09-29", "ccr-19-2201-fhsz-sra-final-text"].sort().map((id) => `${OFFICIAL_DIR}${id}`),
    );
    const v1Captures = officialCaptures.filter((capture) => capture.metadata.schema_version === OFFICIAL_SOURCE_METADATA_VERSION);
    expect(v1Captures.map((capture) => capture.metadata.source_id)).toEqual(Object.keys(PINS));
    for (const capture of v1Captures) {
      const { metadata, extracted } = capture;
      const directory = `${OFFICIAL_DIR}${metadata.source_id}`;
      expect(metadata.schema_version, directory).toBe(OFFICIAL_SOURCE_METADATA_VERSION);
      expect(officialSourceMetadataV1Schema.safeParse(metadata).success, directory).toBe(true);
      expect([metadata.sha256_original, metadata.sha256_extracted], directory).toEqual(PINS[metadata.source_id]);
      expect(await sha256Hex(extracted), directory).toBe(metadata.sha256_extracted);
      expect(officialByteChecks[directory], directory).toMatchObject({ sha256_original: metadata.sha256_original, is_pdf: true, issues: [] });
    }
  });

  it("keeps both earlier TEST-ONLY captures on v1", () => {
    for (const id of ["test-only-adopted-ordinance-000001", "test-only-draft-amendment-000001"]) {
      const metadata = testOnlyMetadata[`${TEST_ONLY_DIR}${id}`];
      expect(metadata.schema_version, id).toBe(OFFICIAL_SOURCE_METADATA_VERSION);
      expect(officialSourceMetadataV1Schema.safeParse(metadata).success, id).toBe(true);
    }
  });

  it("never lets v1 metadata record a v2 type, context, host basis, or HTML original", () => {
    const v1 = testOnlyMetadata[`${TEST_ONLY_DIR}test-only-adopted-ordinance-000001`] as Draft;
    const variants: Array<[string, Draft]> = [
      ["an agency_map type", { ...v1, source_type: "agency_map" }],
      ["a statute type", { ...v1, source_type: "statute" }],
      ["a host basis", { ...v1, host_basis: "test_only_host" }],
      ["an agency map context", { ...v1, agency_map: null }],
      ["a statute context", { ...v1, statute: null }],
      ["an HTML original", { ...v1, original: { file: "original.html", media_type: "text/html", bytes: 1 } }],
      ["the HTML extractor", { ...v1, extraction: { ...v1.extraction, extractor: HTML_TEXT_EXTRACTOR } }],
    ];
    for (const [name, value] of variants) {
      expect(officialSourceMetadataSchema.safeParse(value).success, name).toBe(false);
    }
  });

  it("splits the source types between v1 and v2 and leaves the rule-supporting types unchanged (B4)", () => {
    expect([...v1SourceTypes, ...v2SourceTypes]).toEqual([...officialSourceTypes]);
    // Phase 3D adds regulations and data archives to v2; the rule-supporting types never change.
    expect(v2SourceTypes).toEqual(["agency_map", "statute", "regulation", "dataset_archive"]);
    expect(operativeSourceTypes).toEqual(["adopted_ordinance", "official_memo"]);
  });
});

/* ======================================================================== */

describe("2. The new capture types validate correctly", () => {
  it("accepts the TEST-ONLY agency-map, served-HTML statute, and PDF statute captures", async () => {
    for (const capture of v2Captures) {
      expect(await officialSourceCaptureIssues(capture), capture.directory).toEqual([]);
      expect(await sha256HexBytes(capture.original), capture.directory).toBe(capture.metadata.sha256_original);
      expect(capture.original.byteLength, capture.directory).toBe(capture.metadata.original.bytes);
      expect(capture.metadata).toMatchObject({ test_only: true, host_basis: "test_only_host", is_ai_generated: false });
      expect(new URL(capture.metadata.official_url).hostname.endsWith(".example.test"), capture.directory).toBe(true);
    }
    expect(v2Captures.map((capture) => [capture.metadata.source_type, capture.metadata.original.media_type])).toEqual([
      ["agency_map", "application/pdf"],
      ["statute", "text/html"],
      ["statute", "application/pdf"],
    ]);
  });

  it("pins each new TEST-ONLY capture by SHA-256", () => {
    expect(Object.fromEntries(v2Captures.map((capture) => [capture.metadata.source_id, [capture.metadata.sha256_original, capture.metadata.sha256_extracted]]))).toEqual({
      "test-only-agency-map-000001": [
        "45626fcec28e3ce7bb93705444e7852f6c971b5a9739ba0845681d4bab1536b9",
        "131c695d73202667caac9c43d1a42c99dac733363334649942de312ceadaa058",
      ],
      "test-only-statute-000001": [
        "ae6066bdb6d4ef3284024482010d8e20e07a5cee2a73288756ed9d6cc8c43717",
        "4b0814edf5af6843de90416e0cea9891bd912c7f99fa8106f4848f9fa27afd8b",
      ],
      "test-only-statute-pdf-000001": [
        "885c2b4040063d37af4572622c410a6b632e09cc98390cc9a025969501b3fed2",
        "f74586b7e3b5567a1968e5b271caa4d8d4eb8c19b6b4c5d6c0df864a876ba24a",
      ],
    });
  });

  it("re-extracts the served HTML to exactly the committed text, deterministically", () => {
    const html = new TextDecoder().decode(statuteHtml.original);
    const once = joinExtractedPages(extractHtmlPages(html));
    expect(once).toBe(statuteHtml.extracted);
    expect(joinExtractedPages(extractHtmlPages(html))).toBe(once);
    expect(statuteHtml.metadata.extraction).toMatchObject({
      extractor: HTML_TEXT_EXTRACTOR,
      extractor_version: HTML_TEXT_EXTRACTOR_VERSION,
      page_count: 1,
    });
  });

  it("detects an edited served page, edited extracted text, and a browser-saved copy", async () => {
    const html = new TextDecoder().decode(statuteHtml.original);
    const reworded = new TextEncoder().encode(html.replace("fictional parcel", "fictional lot"));
    expect(await officialSourceCaptureIssues({ ...statuteHtml, original: reworded })).toEqual(
      expect.arrayContaining([
        "original.html does not match sha256_original.",
        `extracted.txt differs from a re-extraction of original.html with ${HTML_TEXT_EXTRACTOR} ${HTML_TEXT_EXTRACTOR_VERSION}.`,
      ]),
    );
    const retyped = statuteHtml.extracted.replace("fictional parcel", "fictional lot");
    expect(await officialSourceCaptureIssues({ ...statuteHtml, extracted: retyped })).toEqual(
      expect.arrayContaining(["extracted.txt does not match sha256_extracted."]),
    );
    const saved = new TextEncoder().encode(html.replace("<html", "<!-- saved from url=(0040)https://leginfo.example.test/x -->\n<html"));
    expect((await officialSourceCaptureIssues({ ...statuteHtml, original: saved })).join("\n")).toContain("save-page marker");
    expect(await officialSourceCaptureIssues({ ...statuteHtml, original: map.original })).toContain(
      "original.html is not valid UTF-8.",
    );
    const text = new TextEncoder().encode("(9) A retyped paragraph, not the served page.\n");
    expect(await officialSourceCaptureIssues({ ...statuteHtml, original: text })).toContain(
      "original.html is not an HTML document.",
    );
    expect(await officialSourceCaptureIssues({ ...statuteHtml, original: null })).toContain("original.html is missing.");
  });
});

/* ======================================================================== */

describe("3. The served-HTML extractor is deterministic and literal", () => {
  const extract = (html: string) => joinExtractedPages(extractHtmlPages(html));

  it("keeps only rendered text: no comments, scripts, styles, templates, or tags", () => {
    const html =
      "﻿<!DOCTYPE html><html><head><title>T</title><script>var x = '<p>hidden</p>';</script><style>p{}</style></head>" +
      "<body><!-- note --><template><p>hidden</p></template><div title=\"a > b\">One <b>bold</b><span>joined</span></div>" +
      "<p>Two<br>Three</p></body></html>";
    expect(extract(html)).toBe("T\n\nOne boldjoined\n\nTwo\nThree\n");
  });

  it("decodes character references once, and leaves an unlisted name as written", () => {
    expect(extract("<p>&sect;&nbsp;1 &#167;&#x20;2 &amp;lt; &unlisted; &#0; &#xD800; &quot;x&quot;</p>")).toBe(
      "§ 1 § 2 &lt; &unlisted; \ufffd \ufffd \"x\"\n",
    );
  });

  it("decodes references after removing tags, so an escaped tag stays text", () => {
    expect(extract("<p>Write &lt;b&gt;bold&lt;/b&gt; as shown.</p>")).toBe("Write <b>bold</b> as shown.\n");
  });

  it("accepts only UTF-8 HTML documents without browser save-page markers", () => {
    const bytes = (text: string) => new TextEncoder().encode(text);
    expect(htmlCaptureIssue(bytes("<!DOCTYPE html><html><body>x</body></html>"))).toBeNull();
    expect(htmlCaptureIssue(bytes('<?xml version="1.0" encoding="UTF-8"?>\n<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN"><html>'))).toBeNull();
    expect(htmlCaptureIssue(Uint8Array.of(0x3c, 0x68, 0x74, 0x6d, 0x6c, 0x3e, 0xff))).toBe("is not valid UTF-8");
    expect(htmlCaptureIssue(bytes("plain text, not a page"))).toBe("is not an HTML document");
    expect(htmlCaptureIssue(map.original)).toBe("is not valid UTF-8");
    expect(htmlCaptureIssue(bytes("%PDF-1.7\n"))).toBe("is not an HTML document");
    expect(htmlCaptureIssue(bytes('<html><head><meta charset="iso-8859-1"></head></html>'))).toContain("only UTF-8");
    expect(htmlCaptureIssue(bytes('<!DOCTYPE html>\n<!-- saved from url=(0022)https://example.test/ -->\n<html>'))).toContain("save-page marker");
    expect(htmlCaptureIssue(bytes("<!DOCTYPE html>\n<!--\n Page saved with SingleFile \n-->\n<html>"))).toContain("SingleFile");
  });

  it("pins the extractor name and version", () => {
    expect([HTML_TEXT_EXTRACTOR, HTML_TEXT_EXTRACTOR_VERSION]).toEqual(["program-screen-html-text", "1.0.0"]);
  });
});

/* ======================================================================== */

describe("4. Host policy: unsupported hosts fail, and an exception is never global", () => {
  // Updated in Phase 3D: it shipped no exception until decision D1 approved three exact paths.
  it("keeps the global allowlist exactly as it was and ships only the three Phase 3D exceptions (B2, D1)", () => {
    expect(officialSourceHosts).toEqual([
      "cityclerk.lacity.org",
      "clkrep.lacity.org",
      "planning.lacity.gov",
      "leginfo.legislature.ca.gov",
    ]);
    expect(parseSourceHostExceptions(sourceHostExceptions)).toBe(sourceHostExceptions);
    expect(sourceHostExceptions.map((exception) => [exception.source_id, exception.source_type])).toEqual([
      ["calfire-sra-fhsz-map-2023-09-29", "agency_map"],
      ["ccr-19-2201-fhsz-sra-final-text", "regulation"],
      ["calfire-fhszsra-23-3-data", "dataset_archive"],
    ]);
    // One exact file path each, never a directory.
    for (const exception of sourceHostExceptions) expect(exception.path_prefix.endsWith("/"), exception.exception_id).toBe(false);
  });

  it.each([
    ["a secondary site", "https://www.example.com/fire-map.pdf"],
    ["a CDN host", "https://cdn-endpoint.azureedge.example/maps/fire-map.pdf"],
    ["a lookalike of an allowed host", "https://leginfo.legislature.ca.gov.example.com/x.pdf"],
    ["a subdomain of an allowed host", "https://www.leginfo.legislature.ca.gov/x.pdf"],
    ["the exception host without its exception", EXCEPTION_URL],
  ])("rejects an official agency map from %s", (_name, url) => {
    const metadata = officialMap((draft) => {
      draft.official_url = url;
      draft.host_basis = "global_allowlist";
    });
    const parsed = officialSourceMetadataSchema.safeParse(metadata);
    expect(parsed.success).toBe(false);
    expect(parsed.error?.issues[0].message).toContain("is not an official source host");
  });

  it.each([
    ["HTTP", "http://leginfo.legislature.ca.gov/x.pdf", "must use HTTPS"],
    ["a port", "https://leginfo.legislature.ca.gov:8443/x.pdf", "must use the default HTTPS port"],
    ["credentials", "https://user:pass@leginfo.legislature.ca.gov/x.pdf", "must not embed credentials"],
  ])("rejects an official v2 URL with %s", (_name, url, message) => {
    const metadata = officialMap((draft) => {
      draft.official_url = url;
      draft.host_basis = "global_allowlist";
    });
    expect(officialSourceMetadataSchema.safeParse(metadata).error?.issues[0].message).toContain(message);
  });

  it("admits a TEST-ONLY exception's own source, on its own host and path, and records it", () => {
    expect(officialSourceMetadataSchemaWith(EXCEPTIONS).safeParse(officialMap()).success).toBe(true);
    expect(
      captureHostBasis(EXCEPTION_URL, { source_id: "fictional-fire-map-000001", source_type: "agency_map", test_only: false }, EXCEPTIONS),
    ).toEqual({ basis: { exception_id: "fictional-fire-map-host" }, issue: null });
    // The recorded host basis must name the exception that admitted the host.
    const misrecorded = officialMap((draft) => (draft.host_basis = "global_allowlist"));
    expect(officialSourceMetadataSchemaWith(EXCEPTIONS).safeParse(misrecorded).error?.issues[0].message).toBe(
      "The host basis must be exception fictional-fire-map-host.",
    );
    // Removing the exception invalidates every capture that relied on it.
    expect(officialSourceMetadataSchema.safeParse(officialMap()).error?.issues[0].message).toContain(
      "no reviewed host exception covers source fictional-fire-map-000001",
    );
  });

  it("never lets a v1 source type use an exception, even when it names the excepted source", () => {
    for (const sourceType of v1SourceTypes) {
      expect(
        captureHostBasis(EXCEPTION_URL, { source_id: "fictional-fire-map-000001", source_type: sourceType, test_only: false }, EXCEPTIONS),
        sourceType,
      ).toEqual({
        basis: null,
        issue: `host hazard-maps.agency.example is not an official source host (${officialSourceHosts.join(", ")})`,
      });
    }
  });

  it("never lets an exception act as a global host", () => {
    // The global check ignores exceptions entirely.
    expect(officialSourceUrlIssue(EXCEPTION_URL)).toContain("is not an official source host");
    const refused: Array<[string, Draft]> = [
      ["another source on the same host", officialMap((draft) => (draft.source_id = "fictional-fire-map-000002"))],
      ["a statute on the same host and path", edited(statutePdf, (draft) => {
        draft.source_id = "fictional-fire-map-000001";
        draft.test_only = false;
        draft.official_url = EXCEPTION_URL;
        draft.host_basis = { exception_id: "fictional-fire-map-host" };
      })],
      ["a path outside the prefix", officialMap((draft) => (draft.official_url = "https://hazard-maps.agency.example/published/other/x.pdf"))],
      ["the prefix without its slash", officialMap((draft) => (draft.official_url = "https://hazard-maps.agency.example/published/maps"))],
      ["a traversal out of the prefix", officialMap((draft) => (draft.official_url = "https://hazard-maps.agency.example/published/maps/../secret.pdf"))],
      ["a subdomain of the host", officialMap((draft) => (draft.official_url = "https://www.hazard-maps.agency.example/published/maps/x.pdf"))],
      ["a lookalike host", officialMap((draft) => (draft.official_url = "https://hazard-maps.agency.example.evil.example/published/maps/x.pdf"))],
      ["HTTP", officialMap((draft) => (draft.official_url = "http://hazard-maps.agency.example/published/maps/x.pdf"))],
      ["a port", officialMap((draft) => (draft.official_url = "https://hazard-maps.agency.example:8443/published/maps/x.pdf"))],
      ["a v1 ordinance naming the excepted source", {
        ...(testOnlyMetadata[`${TEST_ONLY_DIR}test-only-adopted-ordinance-000001`] as Draft),
        source_id: "fictional-fire-map-000001",
        test_only: false,
        official_url: EXCEPTION_URL,
      }],
      ["a test-only capture on the excepted host", edited(map, (draft) => {
        draft.official_url = EXCEPTION_URL;
        draft.host_basis = { exception_id: "fictional-fire-map-host" };
      })],
    ];
    for (const [name, metadata] of refused) {
      expect(officialSourceMetadataSchemaWith(EXCEPTIONS).safeParse(metadata).success, name).toBe(false);
    }
  });

  it("rejects an exception that could widen into a global rule", () => {
    const invalid: Array<[string, unknown]> = [
      ["a wildcard host", [testException({ host: "*.agency.example" })]],
      ["an uppercase host", [testException({ host: "Hazard-Maps.agency.example" })]],
      ["a host with a port", [testException({ host: "hazard-maps.agency.example:8443" })]],
      ["an IP address", [testException({ host: "192.0.2.10" })]],
      ["a host already allowed globally", [testException({ host: "leginfo.legislature.ca.gov" })]],
      ["a test-only host", [testException({ host: "maps.example.test" })]],
      ["the whole host", [testException({ path_prefix: "/" })]],
      ["an empty path", [testException({ path_prefix: "" })]],
      ["a relative path", [testException({ path_prefix: "published/maps/" })]],
      ["an unnormalized path", [testException({ path_prefix: "/published/../maps/" })]],
      ["a scheme-relative path", [testException({ path_prefix: "//other.example/maps/" })]],
      ["a query", [testException({ path_prefix: "/published/maps/?all=1" })]],
      ["percent-encoding", [testException({ path_prefix: "/published%2fmaps/" })]],
      ["a test-only source", [testException({ source_id: "test-only-agency-map-000001" })]],
      ["a v1 source type", [{ ...testException(), source_type: "adopted_ordinance" }]],
      ["an AI reviewer", [{ ...testException(), review: { ...testException().review, reviewer: { kind: "ai", name: "Claude", role: "Preparer" } } }]],
      ["no review", [{ ...testException(), review: undefined }]],
      ["a global flag", [{ ...testException(), global: true }]],
      ["two exceptions for one source", [testException(), testException({ exception_id: "fictional-fire-map-host-2" })]],
      ["a reused exception ID", [testException(), testException({ source_id: "fictional-fire-map-000002" })]],
    ];
    for (const [name, value] of invalid) {
      expectCode(() => parseSourceHostExceptions(value as SourceHostException[]), "INVALID_SOURCE_HOST_EXCEPTION");
      expectCode(() => officialSourceMetadataSchemaWith(value as SourceHostException[]), "INVALID_SOURCE_HOST_EXCEPTION");
      expect(name).toBeTruthy();
    }
  });
});

/* ======================================================================== */

describe("5. Malformed agency-map metadata fails", () => {
  const variants: Array<[string, (draft: Draft) => void]> = [
    ["no map context", (draft) => (draft.agency_map = null)],
    ["a statute context on a map", (draft) => (draft.statute = statuteHtml.metadata.statute)],
    ["an edition date without its kind", (draft) => (draft.agency_map.edition.date_kind = null)],
    ["an edition kind without its date", (draft) => (draft.agency_map.edition.date = null)],
    ["an edition date without an excerpt", (draft) => (draft.agency_map.edition.excerpt = null)],
    ["an edition excerpt with nothing recorded", (draft) => Object.assign(draft.agency_map.edition, { label: null, date: null, date_kind: null })],
    ["an edition date that is not the document date", (draft) => (draft.agency_map.edition.date = "2026-01-16")],
    ["a recorded date kind", (draft) => (draft.agency_map.edition.date_kind = "recorded")],
    ["an invalid edition date", (draft) => (draft.agency_map.edition.date = "2026-02-30")],
    ["a repeated responsibility area", (draft) => draft.agency_map.responsibility_areas.push(structuredClone(draft.agency_map.responsibility_areas[0]))],
    ["an unknown responsibility area", (draft) => (draft.agency_map.responsibility_areas[0].area = "county")],
    ["an area with no legend classes", (draft) => (draft.agency_map.responsibility_areas[0].legend_classes = [])],
    ["a repeated legend class", (draft) => draft.agency_map.responsibility_areas[0].legend_classes.push("high")],
    ["an unknown legend class", (draft) => (draft.agency_map.responsibility_areas[0].legend_classes = ["extreme"])],
    ["an area with no excerpt", (draft) => (draft.agency_map.responsibility_areas[0].excerpts = [])],
    ["a map-wide legend with no classes", (draft) => (draft.agency_map.legend = { ...structuredClone(MAP_WIDE_LEGEND), classes: [] })],
    ["a repeated map-wide legend class", (draft) => (draft.agency_map.legend = { ...structuredClone(MAP_WIDE_LEGEND), classes: ["high", "high"] })],
    ["an unknown map-wide legend class", (draft) => (draft.agency_map.legend = { ...structuredClone(MAP_WIDE_LEGEND), classes: ["extreme"] })],
    ["a map-wide legend with no excerpt", (draft) => (draft.agency_map.legend = { ...structuredClone(MAP_WIDE_LEGEND), excerpts: [] })],
    ["a supersession statement without an excerpt", (draft) => (draft.agency_map.supersession.excerpt = null)],
    ["a supersession excerpt with no statement", (draft) => (draft.agency_map.supersession.statement = "not_stated")],
    ["a superseded map recorded as operative", (draft) => (draft.agency_map.supersession.statement = "stated_superseded")],
    ["an operative map without an edition", (draft) => (draft.agency_map.edition = { label: null, date: null, date_kind: null, excerpt: null })],
    ["an operative map with only an edition label", (draft) => Object.assign(draft.agency_map.edition, { date: null, date_kind: null })],
    ["an excerpt past the last page", (draft) => (draft.agency_map.issuing_agency.excerpt.page = 3)],
    ["an empty excerpt", (draft) => (draft.agency_map.issuing_agency.excerpt.text = "  ")],
    ["an HTML original", (draft) => (draft.original = { file: "original.html", media_type: "text/html", bytes: draft.original.bytes })],
    ["the HTML extractor on a PDF", (draft) => (draft.extraction.extractor = HTML_TEXT_EXTRACTOR)],
    ["sources it may change", (draft) => (draft.may_change_source_ids = ["test-only-adopted-ordinance-000001"])],
    ["an AI-generated capture", (draft) => (draft.is_ai_generated = true)],
    ["a wrong host basis", (draft) => (draft.host_basis = "global_allowlist")],
    ["an issuer ID", (draft) => (draft.issuer_id = "fictional-fire-agency-000001")],
    ["an authority source ID", (draft) => (draft.authority_source_id = "fictional-fire-map-000001")],
    ["fact keys", (draft) => (draft.fact_keys = ["very-high-fire-hazard-severity-zone"])],
    ["a record kind", (draft) => (draft.record_kind = "agency_hazard_map")],
    ["an authoritative flag", (draft) => (draft.authoritative = true)],
    ["an issuer ID inside the map context", (draft) => (draft.agency_map.issuing_agency.issuer_id = "fictional-fire-agency-000001")],
    ["a reviewer inside the map context", (draft) => (draft.agency_map.reviewed_by = "TEST-ONLY Fictional Reviewer")],
  ];

  it.each(variants)("rejects map metadata with %s", (_name, change) => {
    expect(officialSourceMetadataSchema.safeParse(edited(map, change)).success).toBe(false);
  });

  it("rejects a map whose excerpts are not on their stated pages of the capture", async () => {
    const legendMoved = edited(map, (draft) => (draft.agency_map.responsibility_areas[0].excerpts[0].page = 1));
    expect(await officialSourceCaptureIssues({ ...map, metadata: legendMoved })).toEqual([
      "agency_map.responsibility_areas.0: the excerpt is not on page 1 of extracted.txt.",
    ]);
    const invented = edited(map, (draft) => (draft.agency_map.edition.excerpt.text = "Edition 000002, effective January 15, 2026"));
    expect(await officialSourceCaptureIssues({ ...map, metadata: invented })).toEqual([
      "agency_map.edition: the excerpt is not on page 1 of extracted.txt.",
    ]);
    const wideLegendMoved = edited(map, (draft) => {
      draft.agency_map.legend = structuredClone(MAP_WIDE_LEGEND);
      draft.agency_map.legend.excerpts[0].page = 1;
    });
    expect(await officialSourceCaptureIssues({ ...map, metadata: wideLegendMoved })).toEqual([
      "agency_map.legend: the excerpt is not on page 1 of extracted.txt.",
    ]);
  });

  it("accepts a recommended or proposed map as proposed_not_operative (B7)", () => {
    const proposed = edited(map, (draft) => (draft.operative_status = "proposed_not_operative"));
    expect(officialSourceMetadataSchema.safeParse(proposed).success).toBe(true);
    const unconfirmed = edited(map, (draft) => {
      draft.operative_status = "status_unconfirmed";
      draft.agency_map.edition = { label: null, date: null, date_kind: null, excerpt: null };
    });
    expect(officialSourceMetadataSchema.safeParse(unconfirmed).success).toBe(true);
  });
});

/* ======================================================================== */

describe("6. A map capture cannot silently become authoritative", () => {
  const capture = (metadata: OfficialSourceMetadata = officialMap()) => ({ metadata, extracted: map.extracted });

  it("is ready for a separate, reviewed registration only when the capture itself shows everything", async () => {
    // Proves the check can pass, so every blocker below is real. Passing is
    // readiness, not registration: nothing is added to any registry.
    expect(await authoritySourceCaptureIssues(mapRegistration(), capture(), EXCEPTIONS)).toEqual([]);
    // Phase 3D: the only registered source is the CAL FIRE package, never this TEST-ONLY map.
    expect(programAuthorityRegistries.sources.map((source) => source.capture.source_id)).toEqual(["calfire-sra-fhsz-map-2023-09-29"]);
  });

  it("never lets a TEST-ONLY capture back an authority source", async () => {
    expect(
      await authoritySourceCaptureIssues(
        mapRegistration({ capture: { source_id: map.metadata.source_id, sha256_extracted: map.metadata.sha256_extracted } }),
        { metadata: map.metadata, extracted: map.extracted },
      ),
    ).toEqual(["A test-only capture can never back an authority source."]);
  });

  const blocked: Array<[string, ReviewedAuthoritySource, OfficialSourceMetadata, string]> = [
    [
      "a map without an edition date",
      mapRegistration(),
      officialMap((draft) => {
        draft.operative_status = "status_unconfirmed";
        draft.agency_map.edition = { label: null, date: null, date_kind: null, excerpt: null };
      }),
      "The capture does not establish the map's edition date.",
    ],
    ["a registration of another edition", mapRegistration({ edition: { label: "Edition 000002", date: "2026-06-01", date_kind: "effective" } }), officialMap(), "The registered edition date or kind differs from the captured edition."],
    ["a registration with another date kind", mapRegistration({ edition: { label: "Edition 000001", date: "2026-01-15", date_kind: "adopted" } }), officialMap(), "The registered edition date or kind differs from the captured edition."],
    ["an unprinted issuing agency", mapRegistration(), officialMap((draft) => (draft.agency_map.issuing_agency.excerpt = null)), "The capture does not show the issuing agency printed on the map."],
    [
      "a legend without a High class, registered for High",
      mapRegistration(),
      officialMap((draft) => (draft.agency_map.responsibility_areas[0].legend_classes = ["very_high", "moderate"])),
      "The captured legend defines no high class, so it cannot back high-fire-hazard-severity-zone.",
    ],
    [
      "a legend without a Very High class, registered for Very High",
      mapRegistration({ fact_keys: ["very-high-fire-hazard-severity-zone"] }),
      officialMap((draft) => (draft.agency_map.responsibility_areas[0].legend_classes = ["high"])),
      "The captured legend defines no very_high class, so it cannot back very-high-fire-hazard-severity-zone.",
    ],
    ["a fact a fire map cannot show", mapRegistration({ fact_keys: ["coastal-zone"] as ProgramFactKey[] }), officialMap(), "An agency map capture cannot back coastal-zone."],
    ["a recommended or proposed map (B7)", mapRegistration(), officialMap((draft) => (draft.operative_status = "proposed_not_operative")), "A map recorded as proposed_not_operative can never back an authority source."],
    ["an unconfirmed map", mapRegistration(), officialMap((draft) => (draft.operative_status = "status_unconfirmed")), "A map recorded as status_unconfirmed can never back an authority source."],
    [
      "a map stated to be superseded",
      mapRegistration(),
      officialMap((draft) => {
        draft.operative_status = "superseded";
        draft.agency_map.supersession.statement = "stated_superseded";
      }),
      "The map states that it is superseded.",
    ],
    ["another record kind", mapRegistration({ record_kind: "adopted_plan_document" }), officialMap(), "An agency map capture cannot back a adopted_plan_document authority source."],
    ["a registration that pins other text", mapRegistration({ capture: { source_id: "fictional-fire-map-000001", sha256_extracted: "0".repeat(64) } }), officialMap(), "The registration's SHA-256 does not pin the captured extracted text."],
    ["a registration that cites another capture", mapRegistration({ capture: { source_id: "fictional-fire-map-000002", sha256_extracted: map.metadata.sha256_extracted } }), officialMap(), "The registration cites capture fictional-fire-map-000002, not fictional-fire-map-000001."],
    ["a capture with an invented excerpt", mapRegistration(), officialMap((draft) => (draft.agency_map.issuing_agency.excerpt.text = "Issued by the Real Fire Agency")), "agency_map.issuing_agency: the excerpt is not on page 1 of extracted.txt."],
  ];

  it.each(blocked)("blocks registration of %s", async (_name, source, metadata, message) => {
    expect(await authoritySourceCaptureIssues(source, capture(metadata), EXCEPTIONS)).toContain(message);
  });

  describe("responsibility area is context, never a registration condition (Phase 3B d, Phase 3C)", () => {
    const statesNoArea = (legend?: typeof MAP_WIDE_LEGEND) =>
      officialMap((draft) => {
        draft.agency_map.responsibility_areas = [];
        if (legend !== undefined) draft.agency_map.legend = structuredClone(legend);
      });

    it("does not refuse a map that states no responsibility area when its legend is captured", async () => {
      const metadata = statesNoArea(MAP_WIDE_LEGEND);
      expect(officialSourceMetadataSchemaWith(EXCEPTIONS).safeParse(metadata).success).toBe(true);
      expect(await officialSourceCaptureIssues({ ...map, metadata: edited(map, (draft) => {
        draft.agency_map.responsibility_areas = [];
        draft.agency_map.legend = structuredClone(MAP_WIDE_LEGEND);
      }) as OfficialSourceMetadata })).toEqual([]);
      expect(await authoritySourceCaptureIssues(mapRegistration(), capture(metadata), EXCEPTIONS)).toEqual([]);
    });

    it("still refuses a map whose captured legend lacks the fact's class, with or without stated areas", async () => {
      expect(await authoritySourceCaptureIssues(mapRegistration(), capture(statesNoArea()), EXCEPTIONS)).toEqual([
        "The captured legend defines no very_high class, so it cannot back very-high-fire-hazard-severity-zone.",
        "The captured legend defines no high class, so it cannot back high-fire-hazard-severity-zone.",
      ]);
      const veryHighOnly = { ...MAP_WIDE_LEGEND, classes: ["very_high"] };
      expect(await authoritySourceCaptureIssues(mapRegistration(), capture(statesNoArea(veryHighOnly)), EXCEPTIONS)).toEqual([
        "The captured legend defines no high class, so it cannot back high-fire-hazard-severity-zone.",
      ]);
      for (const issues of [
        await authoritySourceCaptureIssues(mapRegistration(), capture(statesNoArea()), EXCEPTIONS),
        await authoritySourceCaptureIssues(mapRegistration(), capture(officialMap()), EXCEPTIONS),
      ]) {
        expect(issues.join(" ")).not.toMatch(/responsibility area/i);
      }
    });

    it("keeps responsibility-area context when the map states it, and reads its legend", async () => {
      const stated = officialMap();
      expect((stated as Draft).agency_map.responsibility_areas.map((area: Draft) => area.area)).toEqual(["local"]);
      expect((stated as Draft).agency_map.legend).toBeUndefined();
      expect(await authoritySourceCaptureIssues(mapRegistration(), capture(stated), EXCEPTIONS)).toEqual([]);
      const both = officialMap((draft) => (draft.agency_map.legend = structuredClone(MAP_WIDE_LEGEND)));
      expect(officialSourceMetadataSchemaWith(EXCEPTIONS).safeParse(both).success).toBe(true);
      expect((both as Draft).agency_map.responsibility_areas).toHaveLength(1);
      expect(await authoritySourceCaptureIssues(mapRegistration(), capture(both), EXCEPTIONS)).toEqual([]);
    });
  });

  it("never lets a statute, ordinance, memo, or draft capture back an authority source", async () => {
    const statuteCapture = { metadata: edited(statutePdf, (draft) => (draft.test_only = true)) as OfficialSourceMetadata, extracted: statutePdf.extracted };
    const statuteIssues = await authoritySourceCaptureIssues(
      mapRegistration({ capture: { source_id: statutePdf.metadata.source_id, sha256_extracted: statutePdf.metadata.sha256_extracted } }),
      statuteCapture,
    );
    expect(statuteIssues).toContain("A statute capture cannot back an authority source.");
    // Phase 3D: the CAL FIRE SRA map is an agency map, checked with its own registration below.
    for (const official of officialCaptures.filter((capture) => capture.metadata.source_type !== "agency_map")) {
      const issues = await authoritySourceCaptureIssues(
        mapRegistration({ capture: { source_id: official.metadata.source_id, sha256_extracted: official.metadata.sha256_extracted } }),
        official,
      );
      expect(issues, official.metadata.source_id).toEqual([`A ${official.metadata.source_type} capture cannot back an authority source.`]);
    }
  });

  // Updated in Phase 3D: the one shipped registration, the CAL FIRE SRA package, is ready.
  it("runs on every shipped registration and would flag a hypothetical one (B6)", async () => {
    const allCaptures = [...officialCaptures, ...v2Captures.map(({ metadata, extracted }) => ({ metadata, extracted }))];
    expect(await registryReadinessIssues(programAuthorityRegistries, allCaptures)).toEqual({ "calfire-sra-fhsz-2023-09-29": [] });

    // A registry that registered the TEST-ONLY map passes structural registry
    // validation, which cannot read captures; the readiness check refuses it.
    const hypothetical = parseProgramAuthorityRegistries({
      ...programAuthorityRegistries,
      issuers: [
        ...programAuthorityRegistries.issuers,
        {
          issuer_id: "fictional-fire-agency-000001",
          name: "TEST-ONLY Fictional Fire Agency 000001",
          basis_capture: { source_id: map.metadata.source_id, sha256_extracted: map.metadata.sha256_extracted },
          review: mapRegistration().review,
        },
      ],
      sources: [
        ...programAuthorityRegistries.sources,
        mapRegistration({ capture: { source_id: map.metadata.source_id, sha256_extracted: map.metadata.sha256_extracted } }),
      ],
    });
    expect(await registryReadinessIssues(hypothetical, allCaptures)).toEqual({
      "calfire-sra-fhsz-2023-09-29": [],
      "fictional-fire-map-000001-edition-000001": ["A test-only capture can never back an authority source."],
    });
    expect(await registryReadinessIssues(hypothetical, officialCaptures)).toEqual({
      "calfire-sra-fhsz-2023-09-29": [],
      "fictional-fire-map-000001-edition-000001": ["test-only-agency-map-000001 is not captured."],
    });
  });
});

/* ======================================================================== */

describe("7. A statute capture pins the exact requested section", () => {
  it.each([
    ["the section", "https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?lawCode=GOV&sectionNum=66499.41", null],
    ["the section with leginfo's final period", "https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?sectionNum=66499.41.&lawCode=GOV", null],
    ["a neighboring section", "https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?lawCode=GOV&sectionNum=66499.4", "sectionNum=66499.4, not GOV 66499.41"],
    ["a longer section number", "https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?lawCode=GOV&sectionNum=66499.410", "not GOV 66499.41"],
    ["a subsection-like number", "https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?lawCode=GOV&sectionNum=66499.41.5", "not GOV 66499.41"],
    ["another code", "https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?lawCode=PRC&sectionNum=66499.41", "lawCode=PRC"],
    ["two sections", "https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?lawCode=GOV&sectionNum=66499.41&sectionNum=66499.4", "exactly one lawCode and one sectionNum"],
    ["no section", "https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?lawCode=GOV", "exactly one lawCode and one sectionNum"],
    ["another page", "https://leginfo.legislature.ca.gov/faces/codes_displayText.xhtml?lawCode=GOV&sectionNum=66499.41", "/faces/codes_displaySection.xhtml"],
  ])("checks a code-section page URL naming %s", (_name, url, expected) => {
    const issue = statuteUrlIssue(url, { code: "GOV", section: "66499.41", form: "code_section_page" });
    if (expected === null) expect(issue).toBeNull();
    else expect(issue).toContain(expected);
  });

  it("checks any section a PDF URL names, and accepts one that names none", () => {
    const pdf = { code: "GOV", section: "66499.41", form: "official_pdf" } as const;
    expect(statuteUrlIssue("https://leginfo.legislature.ca.gov/faces/billPdf.xhtml?bill_id=x", pdf)).toBeNull();
    expect(statuteUrlIssue("https://leginfo.legislature.ca.gov/x.pdf?lawCode=GOV&sectionNum=66499.4", pdf)).toContain("not GOV 66499.41");
  });

  const variants: Array<[string, Capture, (draft: Draft) => void]> = [
    ["a URL for another section", statuteHtml, (draft) => (draft.official_url = draft.official_url.replace("sectionNum=1.1.", "sectionNum=1.10"))],
    ["a URL for another code", statuteHtml, (draft) => (draft.official_url = draft.official_url.replace("lawCode=TST", "lawCode=GOV"))],
    ["a heading for another section", statuteHtml, (draft) => (draft.statute.section_heading.text = "1.10.")],
    ["a heading for a longer section", statuteHtml, (draft) => (draft.statute.section_heading.text = "1.1.5.")],
    ["a heading that is not the section number", statuteHtml, (draft) => (draft.statute.section_heading.text = "Section 1.1 of the Fictional Code")],
    ["a malformed pinpoint", statuteHtml, (draft) => (draft.statute.pinpoints[0].pinpoint = "a9")],
    ["an unclosed pinpoint", statuteHtml, (draft) => (draft.statute.pinpoints[0].pinpoint = "(a)(9")],
    ["an excerpt for another paragraph", statuteHtml, (draft) => (draft.statute.pinpoints[0].pinpoint = "(a)(8)")],
    ["a repeated pinpoint", statuteHtml, (draft) => draft.statute.pinpoints.push(structuredClone(draft.statute.pinpoints[0]))],
    ["no pinpoint", statuteHtml, (draft) => (draft.statute.pinpoints = [])],
    ["an operative statute without its history note", statuteHtml, (draft) => (draft.statute.status_as_published = null)],
    ["a statute recorded as proposed", statuteHtml, (draft) => (draft.operative_status = "proposed_not_operative")],
    ["a PDF form on served HTML", statuteHtml, (draft) => (draft.statute.form = "official_pdf")],
    ["a code-section form on a PDF", statutePdf, (draft) => (draft.statute.form = "code_section_page")],
    ["a lowercase code", statuteHtml, (draft) => (draft.statute.code = "tst")],
    ["a lettered section", statuteHtml, (draft) => (draft.statute.section = "1.1a")],
    ["another jurisdiction", statuteHtml, (draft) => (draft.statute.jurisdiction = "NY")],
    ["no statute context", statuteHtml, (draft) => (draft.statute = null)],
    ["a map context on a statute", statuteHtml, (draft) => (draft.agency_map = map.metadata.agency_map)],
    ["a wrong extractor version", statuteHtml, (draft) => (draft.extraction.extractor_version = "1.0.1")],
    ["pdfjs on served HTML", statuteHtml, (draft) => (draft.extraction.extractor = "pdfjs-dist")],
    ["a second page of served HTML", statuteHtml, (draft) => (draft.extraction.page_count = 2)],
  ];

  it.each(variants)("rejects statute metadata with %s", (_name, capture, change) => {
    expect(officialSourceMetadataSchema.safeParse(edited(capture, change)).success).toBe(false);
  });

  it("requires the heading to be a whole line and each pinpoint to follow it", async () => {
    // "1.1" names the section, but no whole line reads "1.1": the page prints "1.1.".
    const partial = edited(statuteHtml, (draft) => (draft.statute.section_heading.text = "1.1"));
    expect(officialSourceMetadataSchema.safeParse(partial).success).toBe(true);
    expect(await officialSourceCaptureIssues({ ...statuteHtml, metadata: partial })).toEqual([
      "statute.section_heading: no whole line on page 1 reads 1.1.",
    ]);

    const metadata = edited(statuteHtml, (draft) => {
      draft.statute.section = "66499.41";
      draft.statute.section_heading.text = "66499.41.";
      draft.statute.pinpoints[0].excerpt.text = "(9) Early paragraph.";
      draft.statute.status_as_published = null;
    }) as OfficialSourceMetadata;
    // A pinpoint that appears only before the heading belongs to other text.
    expect(captureContextIssues(metadata, "(9) Early paragraph.\n66499.41.\n(a) Text.\n")).toEqual([
      "statute.pinpoints.0: the (a)(9) excerpt does not follow the section heading.",
    ]);
    // A longer section number on the page is not the requested section.
    expect(captureContextIssues(metadata, "66499.41.5.\n(9) Early paragraph.\n")).toEqual([
      "statute.section_heading: no whole line on page 1 reads 66499.41..",
    ]);
    expect(captureContextIssues(metadata, "66499.41.\n(a) Text.\n(9) Early paragraph.\n")).toEqual([]);
  });

  it("pins the fixture's section, pinpoint, and published status", () => {
    expect(statuteHtml.metadata.statute).toMatchObject({
      code: "TST",
      section: "1.1",
      form: "code_section_page",
      pinpoints: [{ pinpoint: "(a)(9)" }],
    });
    expect(statuteHtml.metadata.statute?.status_as_published?.text).toContain("Effective January 1, 2026");
    expect(statutePdf.metadata.statute).toMatchObject({ code: "TST", section: "2.1", form: "official_pdf" });
  });
});

/* ======================================================================== */

describe("8. The GCS 66499.41(a)(9) re-review trigger stays limited to decisions c-g (B8)", () => {
  const TRIGGER = "gcs_66499_41_a_9_captured";
  const asCaptured = (change: (draft: Draft) => void = () => {}) =>
    edited(statuteHtml, (draft) => {
      draft.source_id = "gcs-66499-41-fictional-relabel";
      draft.test_only = false;
      draft.statute.code = "GOV";
      draft.statute.section = "66499.41";
      change(draft);
    }) as OfficialSourceMetadata;

  it("maps the trigger to exactly GOV 66499.41 (a)(9)", () => {
    expect(statuteRereviewTriggers).toEqual({ [TRIGGER]: { code: "GOV", section: "66499.41", pinpoint: "(a)(9)" } });
  });

  it("keeps the Round 1 decision set and its triggers unchanged", () => {
    expect(decisions.decisions.map((entry) => [entry.letter, entry.criterion_id, entry.rereview_triggers])).toEqual([
      ["a", "la_shra.single-family-lot-area-threshold", []],
      ["b", "la_shra.prior-shra-or-sb9-map", ["controlling_statute_or_official_source_on_lot_lineage_captured"]],
      ["c", "la_shra.very-high-fire-hazard-severity-zone", [TRIGGER]],
      ["d", "la_shra.high-fire-hazard-severity-zone", [TRIGGER]],
      ["e", "la_shra.prime-or-statewide-farmland", [TRIGGER]],
      ["f", "la_shra.natural-community-conservation-plan-land", [TRIGGER]],
      ["g", "la_shra.conservation-easement", [TRIGGER]],
      ["h", "la_sb79.permanent-exemption-shown", ["directors_map_wording_not_permanently_exempt"]],
    ]);
  });

  it("fires once over the shipped captures, for the Phase 3A statute capture only", () => {
    // Before Phase 3A no statute was captured (B3) and this fired for nothing.
    expect(statuteRereviewWarnings(officialCaptures.map((capture) => capture.metadata), [decisions])).toEqual([
      {
        kind: "statute_rereview_warning",
        trigger: TRIGGER,
        statute_source_id: "gcs-66499-41",
        operative_status: "operative",
        criterion_ids: [
          "la_shra.very-high-fire-hazard-severity-zone",
          "la_shra.high-fire-hazard-severity-zone",
          "la_shra.prime-or-statewide-farmland",
          "la_shra.natural-community-conservation-plan-land",
          "la_shra.conservation-easement",
        ],
        action: "human_re_review",
      },
    ]);
    expect(statuteRereviewWarnings(v2Captures.map((capture) => capture.metadata), [decisions])).toEqual([]);
  });

  it("flags exactly c, d, e, f, and g once the section's (a)(9) is captured", () => {
    const warnings = statuteRereviewWarnings([asCaptured()], [decisions]);
    expect(warnings).toEqual([
      {
        kind: "statute_rereview_warning",
        trigger: TRIGGER,
        statute_source_id: "gcs-66499-41-fictional-relabel",
        operative_status: "operative",
        criterion_ids: [
          "la_shra.very-high-fire-hazard-severity-zone",
          "la_shra.high-fire-hazard-severity-zone",
          "la_shra.prime-or-statewide-farmland",
          "la_shra.natural-community-conservation-plan-land",
          "la_shra.conservation-easement",
        ],
        action: "human_re_review",
      },
    ]);
    // The four restricted-category criteria cite (a)(9) but were not in the
    // Round 1 decision set; they are never added automatically.
    const restricted = [
      "la_shra.hazardous-waste-site",
      "la_shra.special-flood-hazard-area",
      "la_shra.regulatory-floodway",
      "la_shra.earthquake-fault-zone",
    ];
    const shra = programScreenPathwayPacks.find((pack) => pack.pathway.id === "la_shra")?.criteria ?? [];
    for (const id of restricted) {
      const criterion = shra.find((candidate) => candidate.id === id);
      expect(criterion?.exception_paths.map((path) => path.label).join(" "), id).toContain("GCS 66499.41(a)(9)");
      expect(warnings[0].criterion_ids, id).not.toContain(id);
    }
  });

  it.each<[string, OfficialSourceMetadata]>([
    ["a TEST-ONLY capture", edited(statuteHtml, (draft) => {
      draft.statute.code = "GOV";
      draft.statute.section = "66499.41";
    }) as OfficialSourceMetadata],
    ["another section", asCaptured((draft) => (draft.statute.section = "66499.4"))],
    ["another code", asCaptured((draft) => (draft.statute.code = "PRC"))],
    ["another pinpoint", asCaptured((draft) => (draft.statute.pinpoints[0].pinpoint = "(a)(8)"))],
    ["an agency map", { ...(structuredClone(map.metadata) as Draft), test_only: false } as OfficialSourceMetadata],
  ])("does not fire for %s", (_name, metadata) => {
    expect(statuteRereviewWarnings([metadata], [decisions])).toEqual([]);
  });
});

/* ======================================================================== */

describe("9. A map or statute capture never becomes a rule source, review evidence, or a verification (B4)", () => {
  it("can never support a criterion rule, whatever its status", () => {
    for (const sourceType of v2SourceTypes) {
      for (const status of ["operative", "status_unconfirmed", "superseded", "proposed_not_operative"] as const) {
        expect(canSupportCriterionRule({ source_type: sourceType, operative_status: status }), `${sourceType}/${status}`).toBe(false);
      }
    }
  });

  it("cannot be cited by a human-verification record", () => {
    for (const capture of [map, statuteHtml]) {
      const declared = {
        repo_path: `${capture.directory}/extracted.txt`,
        retrieved_at: capture.metadata.retrieved_at,
        capture_method: capture.metadata.original.media_type === "text/html" ? "html_text_extraction" : "pdf_text_extraction",
        sha256: capture.metadata.sha256_extracted,
        is_ai_generated: false,
        source_type: capture.metadata.source_type,
        operative_status: capture.metadata.operative_status,
      };
      expect(programSourceCaptureSchema.safeParse(declared).success, capture.directory).toBe(false);
      const record = {
        reviewer: { kind: "human", name: "TEST-ONLY Fictional Reviewer", role: "Synthetic test fixture" },
        verified_at: "2026-09-29",
        next_review_at: "2026-10-29",
        source_title: capture.metadata.title,
        source_url: capture.metadata.official_url,
        instrument: "TEST-ONLY",
        pinpoint: "TEST-ONLY",
        supporting_excerpt: capture.extracted.split("\n")[0],
        source_capture: declared,
      } as unknown as ProgramCriterionHumanVerification;
      expect(humanRecordCaptureIssues(record, capture)[0], capture.directory).toMatch(/cannot support a rule/);
    }
  });

  it("cannot be quoted as review-round context", () => {
    const candidate = structuredClone(round.candidates.find((entry) => entry.criterion_id === "la_shra.very-high-fire-hazard-severity-zone"));
    if (candidate === undefined) throw new Error("Round 1 candidate c is missing.");
    candidate.context_excerpts = [
      { source_id: statuteHtml.metadata.source_id, page: 1, text: "(9) The fictional site", why: "TEST-ONLY" },
    ];
    const captures = Object.fromEntries(
      [...officialCaptures, statuteHtml].map((capture) => [capture.metadata.source_id, { metadata: capture.metadata, extracted: capture.extracted }]),
    );
    expect(humanReviewCaptureIssues(candidate, captures)).toContain(
      "test-only-statute-000001 cannot support a rule; it cannot be quoted as review context.",
    );
  });

  it("expects the Phase 3A statute and the three Phase 3D package members as official sources", () => {
    // Phase 2b captured nothing real (B3). Phase 3A adds GOV 66499.41 as a capture only;
    // Phase 3D adds the CAL FIRE SRA package members (updated in Phase 3D).
    expect(expectedOfficialSources.map((source) => [source.source_id, source.source_type])).toEqual([
      ["ordinance-188967", "adopted_ordinance"],
      ["ordinance-188968", "adopted_ordinance"],
      ["shra-2025-10-28", "official_memo"],
      ["low-rise-draft-2026-09-24", "proposed_draft"],
      ["gcs-66499-41", "statute"],
      ["calfire-sra-fhsz-map-2023-09-29", "agency_map"],
      ["ccr-19-2201-fhsz-sra-final-text", "regulation"],
      ["calfire-fhszsra-23-3-data", "dataset_archive"],
    ]);
  });
});

/* ======================================================================== */

describe("10. No capture populates the authority registries", () => {
  // Updated in Phase 3D: a capture still populates nothing; the one registration is the
  // separately reviewed CAL FIRE package, and every other policy stays deny-by-default.
  it("registers only the reviewed Phase 3D package, and every other policy stays deny-by-default", () => {
    expect(programAuthorityRegistries.issuers.map((issuer) => issuer.issuer_id)).toEqual(["calfire-osfm"]);
    expect(programAuthorityRegistries.sources.map((source) => source.authority_source_id)).toEqual(["calfire-sra-fhsz-2023-09-29"]);
    for (const [key, policy] of Object.entries(programAuthorityRegistries.fact_policies)) {
      const phase3d = key === "very-high-fire-hazard-severity-zone" || key === "high-fire-hazard-severity-zone";
      expect(policy?.establishing.length, key).toBe(phase3d ? 1 : 0);
    }
  });

  it("keeps the evaluator and registries independent of captures and fixtures", () => {
    // authority-package.ts (Phase 3D) validates manifests in tests, like proposed-verification.ts:
    // nothing in production imports either, and dataset-archive.ts is read only by source-capture.ts.
    for (const [path, text] of Object.entries(productionSources)) {
      if (!path.endsWith("/source-capture.ts")) expect(text, path).not.toMatch(/from "\.{1,2}\/(?:[^"]*\/)?dataset-archive"/);
      expect(text, path).not.toMatch(/from "\.{1,2}\/(?:[^"]*\/)?authority-package"/);
      if (path.endsWith("/source-capture.ts") || path.endsWith("/proposed-verification.ts") || path.endsWith("/authority-package.ts")) continue;
      expect(text, path).not.toMatch(/from "\.{1,2}\/(?:[^"]*\/)?source-capture"/);
      expect(text, path).not.toMatch(/from "\.{1,2}\/(?:[^"]*\/)?proposed-verification"/);
      // Criteria cite capture paths as strings; no module imports a fixture.
      expect(text, path).not.toMatch(/(?:from|import\()\s*"[^"]*fixtures\//);
    }
    // source-capture.ts reads the registry type only; nothing at runtime.
    const capture = Object.entries(productionSources).find(([path]) => path.endsWith("/source-capture.ts"))?.[1] ?? "";
    expect(capture.match(/from "\.\/authority-policy"/g)).toHaveLength(1);
    expect(capture).toContain('import type { ReviewedAuthoritySource } from "./authority-policy";');
  });
});

/* ======================================================================== */

describe("11. Invariants: nothing promoted, output unchanged", () => {
  // The same pins as the Round 1 and Phase 2 tests.
  // Phase 3C moved these pins for the three reviewed client-label changes only
  // (c, d, g; docs/PROGRAM_SCREEN_PHASE_3C_PROMOTION_GATES.md). Every status,
  // roll-up, and release decision is unchanged.
  const EVALUATOR_OUTPUT_SHA256 = "68341529825b41e7dcd3b25a5daec94385fe6641e07cc03d29003c94c256b45a";
  const PUBLIC_DEMO_OUTPUT_SHA256 = "11081860902438dd881cb743c98de30f4b4c3c425675a6e0eb2b6d41474a84a1";

  it("keeps human_verified at 0 and pending_human at 46", () => {
    const shipped = programScreenPathwayPacks.flatMap((pack) => pack.criteria);
    expect(shipped.filter((criterion) => criterion.verification === "human_verified")).toEqual([]);
    expect(shipped.filter((criterion) => criterion.verification === "pending_human")).toHaveLength(46);
  });

  it("keeps the evaluator and public-demo output byte-identical", async () => {
    const result = evaluateProgramScreen({ evidence_records: fixtureJson.evidence_records, as_of: fixtureJson.as_of });
    const demo = buildProgramScreenPublicDemoPayload(fixtureJson, { as_of: fixtureJson.as_of });
    expect(await sha256Hex(JSON.stringify(result))).toBe(EVALUATOR_OUTPUT_SHA256);
    expect(await sha256Hex(JSON.stringify(demo))).toBe(PUBLIC_DEMO_OUTPUT_SHA256);
  });
});

describe("12. Design record", () => {
  it("records the final B1-B8 decisions", () => {
    for (const decision of [
      "B1 — APPROVE HTML + PDF for statutes.",
      "B2 — DO NOT add a real host exception in this PR.",
      "B3 — NO real captures in this PR.",
      "B4 — APPROVE.",
      "B5 — APPROVE same-capture legend requirement for Phase 2b.",
      "B6 — APPROVE.",
      "B7 — APPROVE.",
      "B8 — KEEP THE RE-REVIEW TRIGGER LIMITED TO c, d, e, f, g FOR NOW.",
    ]) {
      expect(designDoc).toContain(decision);
    }
  });
});
