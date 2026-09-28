import { describe, expect, inject, it, vi } from "vitest";
import verificationLedger from "../../docs/PROGRAM_SCREEN_CRITERION_VERIFICATION.md?raw";
import fixtureJson from "../fixtures/program-screen/fictional-la-parcel.json";
import type { CanonicalEvidenceRecord } from "../src/shared/build-week-integrity/types";
import { IntegrityValidationError } from "../src/shared/build-week-integrity/validation";
import {
  jurisdictionCriterion,
  parcelMatchCriterion,
} from "../src/shared/program-screen/criteria/common";
import {
  evaluateProgramCriterion,
  evaluateProgramScreen,
  programScreenPathwayPacks,
} from "../src/shared/program-screen/evaluate";
import { assessProgramFacts, programFactSpecs } from "../src/shared/program-screen/facts";
import {
  draftChangeWarnings,
  expectedOfficialSources,
  expectedSourceIssues,
  proposalCaptureIssues,
  proposedVerificationSchema,
  shippedComponentDispositions,
  type ProposedVerification,
} from "../src/shared/program-screen/proposed-verification";
import { buildProgramScreenPublicDemoPayload } from "../src/shared/program-screen/public-demo";
import {
  criterionAwaitsHumanVerification,
  hasCompleteHumanVerification,
  parseProgramScreenFixture,
  programCriterionHumanVerificationSchema,
  programCriterionSchema,
} from "../src/shared/program-screen/schema";
import {
  canSupportCriterionRule,
  excerptAppearsInCapture,
  humanRecordCaptureIssues,
  isNormalizedExtraction,
  joinExtractedPages,
  locateExcerptPages,
  normalizeExtractedPage,
  normalizeSourceText,
  officialSourceCaptureIssues,
  officialSourceMetadataSchema,
  officialSourceUrlIssue,
  sha256Hex,
  sha256HexBytes,
  splitExtractedPages,
  type OfficialSourceMetadata,
} from "../src/shared/program-screen/source-capture";
import {
  humanVerificationRequiredCriterionIds,
  retiredProgramCriterionIds,
  type ProgramCriterion,
  type ProgramCriterionHumanVerification,
  type ProgramFactKey,
  type ProgramPathwayPack,
} from "../src/shared/program-screen/types";

const AS_OF = "2026-09-27";

/* ------------------------------------------------------- capture loading */

interface LoadedCapture {
  directory: string;
  metadata: OfficialSourceMetadata;
  original: Uint8Array;
  extracted: string;
}

/** A capture directory as found on disk; a missing file is null. */
interface FoundCapture {
  directory: string;
  metadata: OfficialSourceMetadata | null;
  original: Uint8Array | null;
  extracted: string | null;
}

function complete(capture: FoundCapture | undefined): LoadedCapture {
  if (!capture?.metadata || !capture.original || capture.extracted === null) {
    throw new Error(`Incomplete capture fixture: ${capture?.directory}`);
  }
  return capture as LoadedCapture;
}

function byDirectory<T>(files: Record<string, T>, file: string): Record<string, T> {
  return Object.fromEntries(
    Object.entries(files).map(([path, value]) => [
      path.replace(/^\.\.\//, "app/").replace(new RegExp(`/${file.replace(".", "\\.")}$`), ""),
      value,
    ]),
  );
}

function dataUrlBytes(url: string): Uint8Array {
  return Uint8Array.from(atob(url.slice(url.indexOf(",") + 1)), (character) => character.charCodeAt(0));
}

function loadCaptures(
  metadata: Record<string, unknown>,
  originals: Record<string, string>,
  extracted: Record<string, string>,
): Record<string, FoundCapture> {
  const meta = byDirectory(metadata, "metadata.json");
  const pdfs = byDirectory(originals, "original.pdf");
  const texts = byDirectory(extracted, "extracted.txt");
  const directories = [...new Set([...Object.keys(meta), ...Object.keys(pdfs), ...Object.keys(texts)])];
  return Object.fromEntries(
    directories.sort().map((directory) => [
      directory,
      {
        directory,
        metadata: (meta[directory] as OfficialSourceMetadata | undefined) ?? null,
        original: pdfs[directory] === undefined ? null : dataUrlBytes(pdfs[directory]),
        extracted: texts[directory] ?? null,
      },
    ]),
  );
}

// `?inline` yields the exact file bytes as a base64 data URL; `?raw` the UTF-8 text.
const testOnlyCaptures = loadCaptures(
  import.meta.glob("../fixtures/program-screen/test-only-sources/*/metadata.json", {
    import: "default",
    eager: true,
  }),
  import.meta.glob("../fixtures/program-screen/test-only-sources/*/original.pdf", {
    query: "?inline",
    import: "default",
    eager: true,
  }) as Record<string, string>,
  import.meta.glob("../fixtures/program-screen/test-only-sources/*/extracted.txt", {
    query: "?raw",
    import: "default",
    eager: true,
  }) as Record<string, string>,
);

/** An official capture as loaded here: metadata and extracted text, not the PDF. */
interface OfficialCapture {
  directory: string;
  metadata: OfficialSourceMetadata | null;
  extracted: string | null;
}

/**
 * Official PDFs are not inlined: Ordinance 188967 alone exceeds the 32 MiB
 * module message limit between Vitest and workerd once base64-encoded.
 * `program-screen-capture-bytes.global-setup.ts` re-hashes every original.pdf
 * in Node on every run and provides the result as `officialByteChecks`.
 */
const officialCaptures: Record<string, OfficialCapture> = (() => {
  const meta = byDirectory(
    import.meta.glob("../fixtures/program-screen/official-sources/*/metadata.json", {
      import: "default",
      eager: true,
    }) as Record<string, OfficialSourceMetadata>,
    "metadata.json",
  );
  const texts = byDirectory(
    import.meta.glob("../fixtures/program-screen/official-sources/*/extracted.txt", {
      query: "?raw",
      import: "default",
      eager: true,
    }) as Record<string, string>,
    "extracted.txt",
  );
  const directories = [...new Set([...Object.keys(meta), ...Object.keys(texts)])].sort();
  return Object.fromEntries(
    directories.map((directory) => [
      directory,
      { directory, metadata: meta[directory] ?? null, extracted: texts[directory] ?? null },
    ]),
  );
})();

const officialByteChecks = inject("programScreenOfficialCaptureByteChecks");

function completeOfficial(capture: OfficialCapture | undefined): { metadata: OfficialSourceMetadata; extracted: string } {
  if (!capture?.metadata || capture.extracted === null) {
    throw new Error(`Incomplete official capture: ${capture?.directory}`);
  }
  return { metadata: capture.metadata, extracted: capture.extracted };
}

/** Every file under official-sources/, without loading any (keys only). */
const officialSourceFiles = Object.keys(
  import.meta.glob("../fixtures/program-screen/official-sources/**/*", { query: "?url" }),
).map((path) => path.replace("../fixtures/program-screen/official-sources/", ""));

const OFFICIAL_DIR = "app/fixtures/program-screen/official-sources/";
const CAPTURED_SOURCE_IDS = [
  "gcs-66499-41",
  "low-rise-draft-2026-09-24",
  "ordinance-188967",
  "ordinance-188968",
  "shra-2025-10-28",
];

const proposals = Object.fromEntries(
  Object.entries(
    import.meta.glob("../fixtures/program-screen/proposed-verifications/*.json", {
      import: "default",
      eager: true,
    }) as Record<string, unknown>,
  ).map(([path, value]) => [path.replace(/^.*\//, ""), value]),
);

/** Production Program Screen sources, other than the proposal module itself. */
const productionSources = Object.fromEntries(
  Object.entries(
    import.meta.glob("../src/shared/program-screen/**/*.ts", {
      query: "?raw",
      import: "default",
      eager: true,
    }) as Record<string, string>,
  ).filter(([path]) => !path.endsWith("/proposed-verification.ts")),
);

const ADOPTED_DIR = "app/fixtures/program-screen/test-only-sources/test-only-adopted-ordinance-000001";
const DRAFT_DIR = "app/fixtures/program-screen/test-only-sources/test-only-draft-amendment-000001";
const adopted = complete(testOnlyCaptures[ADOPTED_DIR]);
const draft = complete(testOnlyCaptures[DRAFT_DIR]);

/** Wording the TEST-ONLY adopted PDF prints across a line break on page 2. */
const ADOPTED_EXCERPT =
  "A parcel mapped within a synthetic flood zone is excluded from the Synthetic Test Pathway.";
/** Wording the TEST-ONLY draft PDF prints on page 1. */
const DRAFT_EXCERPT =
  "A parcel mapped within a synthetic flood zone is excluded from the Synthetic Test Pathway unless the synthetic flood zone is removed.";

/* ------------------------------------------------------ evaluation helpers */

const SUBJECT = {
  case_id: "case-fictional-program-screen-source-capture-test",
  property_id: "property-fictional-program-screen-source-capture-test",
};

function evidence(id: string, key: ProgramFactKey, value: boolean | string): CanonicalEvidenceRecord {
  const spec = programFactSpecs[key];
  return {
    id,
    subject: SUBJECT,
    claim: { key, label: spec.label, client_label: spec.client_label },
    source: {
      agency: "Fictional City source",
      title: `Fictional ${key} observation`,
      description: "FICTIONAL test record.",
      url: `https://records.example.test/program-screen-source-capture/${id}`,
      authority: "official",
      retrieved_at: "2026-09-18T12:00:00.000Z",
    },
    raw_observed_value: {
      kind: "text",
      value: typeof value === "boolean" ? (value ? "YES" : "NO") : value,
    },
    normalized_value:
      typeof value === "boolean" ? { kind: "boolean", value } : { kind: "text", value },
    evidence_type: "official_portal",
    classification: "source_observation",
    confidence: 99,
    conflicts_with: [],
    review_status: "reviewed",
    notes: [],
    limitations: [],
    provenance: {
      source_record_id: `test-${id}`,
      capture_method: "manual_research",
      is_ai_generated: false,
    },
  };
}

function anchorEvidence(): CanonicalEvidenceRecord[] {
  return [
    evidence("t-parcel", "parcel-match", true),
    evidence("t-jurisdiction", "jurisdiction", "City of Los Angeles"),
  ];
}

function packFor(criterion: ProgramCriterion): ProgramPathwayPack {
  return {
    pathway: {
      id: criterion.pathway,
      label: "Synthetic source-capture test pathway",
      confirmer: "Los Angeles City Planning",
    },
    criteria: [
      parcelMatchCriterion(criterion.pathway),
      jurisdictionCriterion(criterion.pathway),
      criterion,
    ],
  };
}

function expectValidationCode(action: () => unknown, code: string): void {
  try {
    action();
    throw new Error("Expected Program Screen validation to fail.");
  } catch (error) {
    expect(error).toBeInstanceOf(IntegrityValidationError);
    expect(error).toMatchObject({ code });
  }
}

/**
 * TEST-ONLY human-verified criterion resting on a TEST-ONLY capture in the
 * per-source layout. `capture` chooses which synthetic capture it cites.
 */
function syntheticCriterion(
  capture: LoadedCapture,
  excerpt: string,
  predicate: ProgramCriterion["predicate"] = (facts) =>
    facts["special-flood-hazard-area"]?.kind === "boolean" && facts["special-flood-hazard-area"].value
      ? "disqualifying_per_source"
      : "consistent_with_source",
  declared: Partial<ProgramCriterionHumanVerification["source_capture"]> = {},
): ProgramCriterion {
  const citation = {
    title: capture.metadata.title,
    url: capture.metadata.official_url,
    pinpoint: "Sec. 2(a)",
    verified_at: "2026-09-20",
    volatility: "high" as const,
    next_review_at: "2026-10-20",
  };
  const record = {
    reviewer: { kind: "human", name: "TEST-ONLY Fictional Reviewer", role: "Synthetic test fixture" },
    verified_at: citation.verified_at,
    next_review_at: citation.next_review_at,
    source_title: citation.title,
    source_url: citation.url,
    instrument: "Fictional Ordinance 000001",
    pinpoint: citation.pinpoint,
    supporting_excerpt: excerpt,
    source_capture: {
      repo_path: `${capture.directory}/extracted.txt`,
      retrieved_at: capture.metadata.retrieved_at,
      capture_method: "pdf_text_extraction",
      sha256: capture.metadata.sha256_extracted,
      is_ai_generated: false,
      source_type: capture.metadata.source_type,
      operative_status: capture.metadata.operative_status,
      ...declared,
    },
  } as ProgramCriterionHumanVerification;
  return {
    id: "la_shra.test-only-captured-flood",
    pathway: "la_shra",
    label: "TEST-ONLY synthetic criterion on a captured source",
    gating: false,
    fact_keys: ["special-flood-hazard-area"],
    predicate,
    permitted_outcomes: ["consistent_with_source", "disqualifying_per_source", "requires_judgment"],
    exception_paths: [],
    rule_summary: "TEST-ONLY synthetic rule: a mapped synthetic flood zone blocks the synthetic pathway.",
    citation,
    confirmer: "Los Angeles City Planning",
    question_if_unknown: "Which record shows the synthetic flood-zone mapping for the parcel?",
    question_if_conflict: "Which record governs the synthetic flood-zone mapping for the parcel?",
    question_if_judgment: "How does Planning apply the synthetic rule to the parcel?",
    verification: "human_verified",
    human_verification: record,
    basis: { repo_path: `${capture.directory}/extracted.txt`, excerpts: [excerpt] },
  };
}

function screen(criterion: ProgramCriterion, records: CanonicalEvidenceRecord[], asOf = AS_OF) {
  const result = evaluateProgramScreen({
    evidence_records: [...anchorEvidence(), ...records],
    as_of: asOf,
    packs: [packFor(criterion)],
  });
  return { result, pathway: result.pathways[0], criterion: result.pathways[0].criteria[2] };
}

function metadataWith(overrides: Record<string, unknown>) {
  return { ...structuredClone(adopted.metadata), ...overrides };
}

const officialMetadata = () =>
  metadataWith({
    source_id: "ordinance-188968",
    title: "City of Los Angeles Ordinance No. 188968 (SB 79 Phased Implementation Ordinance)",
    official_url: "https://cityclerk.lacity.org/onlinedocs/2025/25-1083-S4_ord_188968_06-30-26.pdf",
    test_only: false,
  });

/* ------------------------------------------------------------------ tests */

describe("Official source capture pins (TEST-ONLY synthetic captures)", () => {
  it("loads the synthetic captures from the per-source layout", () => {
    // The agency-map and statute captures (metadata v2, Phase 2b) are checked
    // in program-screen-source-capture-2b.test.ts.
    expect(Object.keys(testOnlyCaptures)).toEqual([
      ADOPTED_DIR,
      "app/fixtures/program-screen/test-only-sources/test-only-agency-map-000001",
      DRAFT_DIR,
      "app/fixtures/program-screen/test-only-sources/test-only-statute-000001",
      "app/fixtures/program-screen/test-only-sources/test-only-statute-pdf-000001",
    ]);
    expect(adopted.metadata).toMatchObject({ test_only: true, source_type: "adopted_ordinance" });
    expect(draft.metadata).toMatchObject({
      test_only: true,
      source_type: "proposed_draft",
      operative_status: "proposed_not_operative",
    });
  });

  it("pins the exact original bytes and extracted text by SHA-256", async () => {
    for (const capture of [adopted, draft]) {
      expect(await sha256HexBytes(capture.original)).toBe(capture.metadata.sha256_original);
      expect(capture.original.byteLength).toBe(capture.metadata.original.bytes);
      expect(await sha256Hex(capture.extracted)).toBe(capture.metadata.sha256_extracted);
      expect(await officialSourceCaptureIssues(capture), capture.directory).toEqual([]);
    }
    // Pinned here as well, so regenerating a fixture is a visible change.
    expect(adopted.metadata.sha256_original).toBe(
      "2e57f8f2ffdfbd25ed47d0fa2c336019d488ae15b5ce206b960ce600d4bc6d0f",
    );
    expect(adopted.metadata.sha256_extracted).toBe(
      "fa6aabb2b8648d63488280ecda66c6b0b432534a3fc3d085d00ad611050f942f",
    );
  });

  it("detects a tampered original.pdf", async () => {
    const flipped = adopted.original.slice();
    flipped[flipped.length - 20] ^= 0x01;
    expect(await officialSourceCaptureIssues({ ...adopted, original: flipped })).toEqual([
      "original.pdf does not match sha256_original.",
    ]);

    const truncated = adopted.original.slice(0, -1);
    expect(await officialSourceCaptureIssues({ ...adopted, original: truncated })).toEqual([
      "original.pdf size does not match metadata.json.",
      "original.pdf does not match sha256_original.",
    ]);

    const html = new TextEncoder().encode("<html>Ordinance 188967</html>");
    expect(await officialSourceCaptureIssues({ ...adopted, original: html })).toContain(
      "original.pdf is not a PDF file.",
    );
    expect(await officialSourceCaptureIssues({ ...adopted, original: null })).toContain(
      "original.pdf is missing.",
    );
  });

  it("detects tampered extracted text, even a whitespace-only edit", async () => {
    const reworded = adopted.extracted.replace("is excluded", "is not excluded");
    expect(reworded).not.toBe(adopted.extracted);
    expect(await officialSourceCaptureIssues({ ...adopted, extracted: reworded })).toEqual([
      "extracted.txt does not match sha256_extracted.",
    ]);

    const trailingSpace = adopted.extracted.replace("Pathway.\n", "Pathway. \n");
    expect(await officialSourceCaptureIssues({ ...adopted, extracted: trailingSpace })).toEqual([
      "extracted.txt does not match sha256_extracted.",
      "extracted.txt is not in program-screen-text-v1 form.",
    ]);

    const pageDropped = splitExtractedPages(adopted.extracted)[0] + "\n";
    expect(await officialSourceCaptureIssues({ ...adopted, extracted: pageDropped })).toEqual(
      expect.arrayContaining(["extracted.txt page count does not match metadata.json."]),
    );
    expect(await officialSourceCaptureIssues({ ...adopted, extracted: null })).toContain(
      "extracted.txt is missing.",
    );
  });

  it("detects edited metadata and a capture filed under the wrong directory", async () => {
    const otherHash = metadataWith({ sha256_extracted: draft.metadata.sha256_extracted });
    expect(await officialSourceCaptureIssues({ ...adopted, metadata: otherHash })).toEqual([
      "extracted.txt does not match sha256_extracted.",
    ]);
    expect(await officialSourceCaptureIssues({ ...adopted, directory: DRAFT_DIR })).toEqual([
      `metadata.json source_id test-only-adopted-ordinance-000001 does not match directory ${DRAFT_DIR}.`,
    ]);
    const aiGenerated = metadataWith({ is_ai_generated: true });
    expect((await officialSourceCaptureIssues({ ...adopted, metadata: aiGenerated }))[0]).toMatch(
      /^metadata\.json is_ai_generated/,
    );
  });
});

describe("Deterministic extracted-text normalization", () => {
  it("changes only whitespace and unrenderable control characters", () => {
    expect(normalizeExtractedPage("  Sec. 2.  Synthetic\t Rule.  \r\n\r\n\r\n(a) Text\u0000here \f\n\n")).toBe(
      "Sec. 2. Synthetic Rule.\n\n(a) Text�here",
    );
    expect(normalizeExtractedPage("\n\n")).toBe("");
  });

  it("joins and splits pages losslessly and is idempotent", () => {
    const joined = joinExtractedPages(["First page\n", "", "Third  page"]);
    expect(joined).toBe("First page\n\f\n\n\f\nThird page\n");
    expect(splitExtractedPages(joined)).toEqual(["First page", "", "Third page"]);
    expect(joinExtractedPages(splitExtractedPages(joined))).toBe(joined);
    expect(isNormalizedExtraction(joined)).toBe(true);
    expect(isNormalizedExtraction(joined.replace(/\n/g, "\r\n"))).toBe(false);
    expect(isNormalizedExtraction(joined.slice(0, -1))).toBe(false);
    expectValidationCode(() => joinExtractedPages([]), "EMPTY_SOURCE_EXTRACTION");
  });

  it("finds an exact excerpt on its page, across a wrapped line", () => {
    expect(adopted.extracted).toContain("synthetic flood\nzone is excluded");
    expect(excerptAppearsInCapture(ADOPTED_EXCERPT, adopted.extracted)).toBe(true);
    expect(locateExcerptPages(ADOPTED_EXCERPT, adopted.extracted)).toEqual([2]);
    expect(locateExcerptPages("Sec. 1. Synthetic Applicability.", adopted.extracted)).toEqual([1]);
    for (const altered of [
      ADOPTED_EXCERPT.replace("is excluded", "may be excluded"),
      ADOPTED_EXCERPT.replace("Pathway.", "Pathway,"),
      "   ",
    ]) {
      expect(excerptAppearsInCapture(altered, adopted.extracted), altered).toBe(false);
      expect(locateExcerptPages(altered, adopted.extracted)).toEqual([]);
    }
  });
});

describe("Official source URL and type validation", () => {
  it.each([
    "https://cityclerk.lacity.org/onlinedocs/2025/25-1083-S3_ord_188967_06-30-26.pdf",
    "https://clkrep.lacity.org/onlinedocs/2025/25-1083-S3_misc.pdf",
    "https://planning.lacity.gov/odocument/1b081b86-f735-43e8-bba6-c2d73a192db7/SB_684_1123_Memo_Update_ACP.pdf",
    "https://leginfo.legislature.ca.gov/faces/billTextClient.xhtml?bill_id=202320240SB684",
  ])("accepts the official source URL %s", (url) => {
    expect(officialSourceUrlIssue(url)).toBeNull();
  });

  it.each<[string, string]>([
    ["http://cityclerk.lacity.org/onlinedocs/x.pdf", "must use HTTPS"],
    ["https://www.example.com/ordinance-188967.pdf", "is not an official source host"],
    ["https://cityclerk.lacity.org.example.com/x.pdf", "is not an official source host"],
    ["https://lacity.gov/x.pdf", "is not an official source host"],
    ["https://zimas.lacity.org/", "is not an official source host"],
    ["https://user:pass@cityclerk.lacity.org/x.pdf", "must not embed credentials"],
    ["https://cityclerk.lacity.org:8443/x.pdf", "must use the default HTTPS port"],
    ["not a url", "is not a valid URL"],
  ])("rejects %s", (url, message) => {
    expect(officialSourceUrlIssue(url)).toContain(message);
  });

  it("accepts a well-formed official capture record", () => {
    expect(officialSourceMetadataSchema.safeParse(officialMetadata()).success).toBe(true);
  });

  it.each<[string, Record<string, unknown>]>([
    ["a secondary-site URL", { official_url: "https://www.example.com/ordinance-188968.pdf" }],
    ["a non-HTTPS URL", { official_url: "http://cityclerk.lacity.org/x.pdf" }],
    ["a test-only URL on an official record", { official_url: "https://records.example.test/x.pdf" }],
    ["a test-only prefix on an official record", { source_id: "test-only-ordinance-188968" }],
    ["an unknown source type", { source_type: "search_summary" }],
    ["a draft recorded as operative", { source_type: "proposed_draft", operative_status: "operative" }],
    ["a draft with unconfirmed status", { source_type: "proposed_draft", operative_status: "status_unconfirmed" }],
    ["an adopted ordinance recorded as proposed", { operative_status: "proposed_not_operative" }],
    ["a memo recorded as proposed", { source_type: "official_memo", operative_status: "proposed_not_operative" }],
    ["a document dated after retrieval", { document_date: "2026-12-01" }],
    ["an AI-generated capture", { is_ai_generated: true }],
    ["a malformed SHA-256", { sha256_original: "abc" }],
    ["a non-kebab source ID", { source_id: "Ordinance_188968" }],
    ["a source that changes itself", { may_change_source_ids: ["ordinance-188968"] }],
    ["an image-only PDF", { extraction: { ...adopted.metadata.extraction, pages_without_text: [1, 2] } }],
    ["an unpinned extractor", { extraction: { ...adopted.metadata.extraction, extractor_version: "latest" } }],
    ["an extra field", { confidence: "high" }],
  ])("rejects official source metadata with %s", (_name, overrides) => {
    expect(officialSourceMetadataSchema.safeParse({ ...officialMetadata(), ...overrides }).success).toBe(false);
  });

  it("lets only an operative adopted ordinance or official memo support a rule", () => {
    const cases: Array<[OfficialSourceMetadata["source_type"], OfficialSourceMetadata["operative_status"], boolean]> = [
      ["adopted_ordinance", "operative", true],
      ["official_memo", "operative", true],
      ["adopted_ordinance", "status_unconfirmed", false],
      ["adopted_ordinance", "superseded", false],
      ["official_memo", "superseded", false],
      ["proposed_draft", "proposed_not_operative", false],
      ["proposed_draft", "operative", false],
    ];
    for (const [sourceType, status, expected] of cases) {
      expect(
        canSupportCriterionRule({ source_type: sourceType, operative_status: status }),
        `${sourceType}/${status}`,
      ).toBe(expected);
    }
  });
});

describe("Captured official sources (official-sources/)", () => {
  it("pins exactly which official sources have been captured", () => {
    // Captured 2026-09-27 from PDFs the repository owner supplied locally; the
    // official hosts were still unreachable from the capture environment. See
    // docs/PROGRAM_SCREEN_CRITERION_VERIFICATION.md, "Captured official sources".
    const directories = CAPTURED_SOURCE_IDS.map((id) => `${OFFICIAL_DIR}${id}`);
    expect(Object.keys(officialCaptures)).toEqual(directories);
    // The Node-side byte check covered exactly the same directories.
    expect(Object.keys(officialByteChecks).sort()).toEqual(directories);
  });

  it("holds only complete captures: no HTML, notes, or stray files", () => {
    expect(officialSourceFiles).toContain("README.md");
    for (const path of officialSourceFiles) {
      expect(path, path).toMatch(
        /^(?:README\.md|[a-z0-9]+(?:-[a-z0-9]+)*\/(?:original\.pdf|original\.html|extracted\.txt|metadata\.json))$/,
      );
    }
    for (const capture of Object.values(officialCaptures)) {
      expect(capture.metadata, capture.directory).not.toBeNull();
      expect(capture.extracted, capture.directory).not.toBeNull();
      const id = capture.directory.slice(OFFICIAL_DIR.length);
      // original.pdf, or original.html for a served statute page (metadata v2).
      const original = capture.metadata?.original.file ?? "original.pdf";
      expect(officialSourceFiles, capture.directory).toContain(`${id}/${original}`);
      expect(officialByteChecks[capture.directory]?.files).toEqual(
        ["extracted.txt", "metadata.json", original].sort(),
      );
    }
  });

  it("keeps every capture pinned, official, and matched to its expected source", async () => {
    for (const found of Object.values(officialCaptures)) {
      const capture = completeOfficial(found);
      // Full check on the exact PDF bytes, run in Node (see the global setup).
      expect(officialByteChecks[found.directory], found.directory).toEqual({
        files: ["extracted.txt", "metadata.json", capture.metadata.original.file].sort(),
        sha256_original: capture.metadata.sha256_original,
        bytes: capture.metadata.original.bytes,
        is_pdf: capture.metadata.original.media_type === "application/pdf",
        issues: [],
      });
      // The text pins again here, on the text this worker loaded.
      expect(await sha256Hex(capture.extracted), found.directory).toBe(capture.metadata.sha256_extracted);
      expect(isNormalizedExtraction(capture.extracted), found.directory).toBe(true);
      expect(splitExtractedPages(capture.extracted)).toHaveLength(capture.metadata.extraction.page_count);
      expect(officialSourceMetadataSchema.safeParse(capture.metadata).success, found.directory).toBe(true);
      expect(capture.metadata.test_only, found.directory).toBe(false);
      expect(capture.metadata.is_ai_generated, found.directory).toBe(false);
      expect(expectedSourceIssues(capture.metadata), found.directory).toEqual([]);
    }
  });

  it("pins each official capture's bytes and text by SHA-256", () => {
    // Pinned here as well, so a recapture is a visible, reviewed change.
    const pins = Object.fromEntries(
      Object.values(officialCaptures).map((found) => {
        const { metadata } = completeOfficial(found);
        return [metadata.source_id, [metadata.sha256_original, metadata.sha256_extracted]];
      }),
    );
    expect(pins).toEqual({
      // Phase 3A: the served leginfo page for GOV 66499.41 (docs/PROGRAM_SCREEN_PHASE_3A_GCS_66499_41_A_9_REVIEW.md).
      "gcs-66499-41": [
        "3521eb92f68d966461eb0c7b60ebffad8371b487eff2f014417cd74fc077ec72",
        "48815c8e2a892ca8e3aa523c6d3237d9c014fc556b3e332e31f0894f5bcf0759",
      ],
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
    });
  });

  it("records the operative sources as operative, the draft as proposed only, and the statute as no rule source", () => {
    const summary = Object.values(officialCaptures).map((found) => {
      const { metadata } = completeOfficial(found);
      return {
        id: metadata.source_id,
        type: metadata.source_type,
        status: metadata.operative_status,
        may_change: metadata.may_change_source_ids,
        supports_rule: canSupportCriterionRule(metadata),
      };
    });
    expect(summary).toEqual([
      // A statute capture never supports a rule (Phase 2b B4), even when operative.
      { id: "gcs-66499-41", type: "statute", status: "operative", may_change: [], supports_rule: false },
      {
        id: "low-rise-draft-2026-09-24",
        type: "proposed_draft",
        status: "proposed_not_operative",
        may_change: ["ordinance-188967"],
        supports_rule: false,
      },
      { id: "ordinance-188967", type: "adopted_ordinance", status: "operative", may_change: [], supports_rule: true },
      { id: "ordinance-188968", type: "adopted_ordinance", status: "operative", may_change: [], supports_rule: true },
      { id: "shra-2025-10-28", type: "official_memo", status: "operative", may_change: [], supports_rule: true },
    ]);
  });

  it("keeps the draft's scanned pages out of its extracted text", () => {
    // Pages 1-2 of the draft (the amended table and severability clause) have
    // no text layer. The capture records that; nothing may fill the gap.
    const draftCapture = completeOfficial(officialCaptures[`${OFFICIAL_DIR}low-rise-draft-2026-09-24`]);
    expect(draftCapture.metadata.extraction.pages_without_text).toEqual([1, 2]);
    expect(splitExtractedPages(draftCapture.extracted).slice(0, 2)).toEqual(["", ""]);
    expect(draftCapture.extracted).not.toMatch(/Table 12\.22|LR-1|stories/);
  });

  it("flags only the Low-Rise atomic criteria for re-review from the captured draft", () => {
    const metadata = Object.values(officialCaptures).map((found) => completeOfficial(found).metadata);
    const parsed = Object.values(proposals).map((value) => proposedVerificationSchema.parse(value));
    expect(draftChangeWarnings(metadata, parsed)).toEqual([
      {
        kind: "draft_change_warning",
        draft_source_id: "low-rise-draft-2026-09-24",
        affects_source_id: "ordinance-188967",
        criterion_ids: [
        "la_low_rise.incentive-area-map-subarea",
        "la_low_rise.subarea-distance-bands",
        "la_low_rise.subarea-geographic-criteria",
        "la_low_rise.underlying-zone",
        "la_low_rise.manufacturing-zone-exclusion",
        "la_low_rise.single-family-zone-exclusion",
        "la_low_rise.fire-restriction-area-exclusion",
        "la_low_rise.coastal-zone-exclusion",
        "la_low_rise.sea-level-rise-area-exclusion",
        "la_low_rise.excluded-plan-area",
        "la_low_rise.c10-exception-path",
        "la_low_rise.tod-subarea-historic-limit",
        ],
        action: "human_re_review",
      },
    ]);
  });

  it("keeps the adopted ordinances and the draft distinguishable", () => {
    const ids = expectedOfficialSources.map((source) => source.source_id);
    expect(ids).toEqual([
      "ordinance-188967",
      "ordinance-188968",
      "shra-2025-10-28",
      "low-rise-draft-2026-09-24",
      "gcs-66499-41",
    ]);
    const drafts = expectedOfficialSources.filter((source) => source.source_type === "proposed_draft");
    expect(drafts.map((source) => source.source_id)).toEqual(["low-rise-draft-2026-09-24"]);
    expect(drafts[0].may_change_source_ids).toEqual(["ordinance-188967"]);
    const urls = expectedOfficialSources.flatMap((source) => (source.official_url ? [source.official_url] : []));
    expect(new Set(urls).size).toBe(urls.length);
    for (const url of urls) expect(officialSourceUrlIssue(url), url).toBeNull();

    // A draft can never be filed as, or replace, the adopted ordinance.
    const draftAsAdopted = parseLikeCapture({
      ...officialMetadata(),
      source_id: "ordinance-188967",
      official_url: "https://cityclerk.lacity.org/onlinedocs/2025/25-1083-S3_ord_188967_06-30-26.pdf",
      source_type: "proposed_draft",
      operative_status: "proposed_not_operative",
    });
    expect(expectedSourceIssues(draftAsAdopted)).toContain(
      "ordinance-188967 must be recorded as adopted_ordinance, not proposed_draft.",
    );
    const adoptedAsDraft = parseLikeCapture({
      ...officialMetadata(),
      source_id: "low-rise-draft-2026-09-24",
      official_url: "https://clkrep.lacity.org/onlinedocs/2025/25-1083-S3_draft.pdf",
      may_change_source_ids: ["ordinance-188967"],
    });
    expect(expectedSourceIssues(adoptedAsDraft)).toContain(
      "low-rise-draft-2026-09-24 must be recorded as proposed_draft, not adopted_ordinance.",
    );
    const unregistered = parseLikeCapture({ ...officialMetadata(), source_id: "ordinance-999999" });
    expect(expectedSourceIssues(unregistered)).toEqual([
      "ordinance-999999 is not an expected official source; register it first.",
    ]);
    const wrongUrl = parseLikeCapture({
      ...officialMetadata(),
      official_url: "https://cityclerk.lacity.org/onlinedocs/2025/other.pdf",
    });
    expect(expectedSourceIssues(wrongUrl)).toEqual([
      "ordinance-188968 must come from https://cityclerk.lacity.org/onlinedocs/2025/25-1083-S4_ord_188968_06-30-26.pdf.",
    ]);
  });
});

/** Metadata as a capture would carry it; schema validity is tested separately. */
function parseLikeCapture(value: Record<string, unknown>): OfficialSourceMetadata {
  return value as unknown as OfficialSourceMetadata;
}

describe("Draft sources never become operative law", () => {
  const disqualify = () => "disqualifying_per_source" as const;
  const consistent = () => "consistent_with_source" as const;

  it("accepts a TEST-ONLY human record on the adopted capture, so the gate itself works", () => {
    const criterion = syntheticCriterion(adopted, ADOPTED_EXCERPT);
    expect(programCriterionSchema.safeParse(criterion).success).toBe(true);
    expect(hasCompleteHumanVerification(criterion)).toBe(true);
    expect(
      humanRecordCaptureIssues(criterion.human_verification as ProgramCriterionHumanVerification, adopted),
    ).toEqual([]);
    expect(screen(criterion, [evidence("f", "special-flood-hazard-area", true)]).pathway.rollup).toBe(
      "documented_disqualifier",
    );
    const clear = screen(criterion, [evidence("f", "special-flood-hazard-area", false)]);
    expect(clear.pathway.rollup).toBe("no_disqualifier_found_in_reviewed_sources");
    expect(clear.result.release.client_releasable).toBe(true);
  });

  it.each([
    ["a disqualifier", disqualify],
    ["a consistent finding", consistent],
  ])("never lets a draft-based record produce %s", (_name, rule) => {
    const spy = vi.fn(rule);
    const criterion = syntheticCriterion(draft, DRAFT_EXCERPT, spy);
    // The excerpt really is in the draft capture; only its status disqualifies it.
    expect(excerptAppearsInCapture(DRAFT_EXCERPT, draft.extracted)).toBe(true);

    expect(programCriterionSchema.safeParse(criterion).success).toBe(false);
    expect(
      programCriterionHumanVerificationSchema.safeParse(criterion.human_verification).success,
    ).toBe(false);
    expect(hasCompleteHumanVerification(criterion)).toBe(false);
    expect(criterionAwaitsHumanVerification(criterion)).toBe(true);
    expectValidationCode(
      () => screen(criterion, [evidence("f", "special-flood-hazard-area", true)]),
      "INVALID_PROGRAM_CRITERION",
    );

    // A caller that skips pack validation still gets no result from the rule.
    for (const flooded of [true, false]) {
      const facts = new Map(
        assessProgramFacts([evidence("f", "special-flood-hazard-area", flooded)], ["special-flood-hazard-area"]).map((fact) => [
          fact.key,
          fact,
        ]),
      );
      const result = evaluateProgramCriterion(criterion, facts, AS_OF);
      expect(result).toMatchObject({
        status: "unreviewed",
        unreviewed_reasons: ["criterion_pending_human"],
      });
      expect(result.status).not.toBe("disqualifying_per_source");
      expect(result.status).not.toBe("consistent_with_source");
    }
    expect(spy).not.toHaveBeenCalled();
  });

  it("catches a draft relabeled as an operative ordinance in the record", () => {
    const relabeled = syntheticCriterion(draft, DRAFT_EXCERPT, disqualify, {
      source_type: "adopted_ordinance",
      operative_status: "operative",
    });
    // The record's self-declaration passes the schema...
    expect(programCriterionSchema.safeParse(relabeled).success).toBe(true);
    // ...but not the check against the capture's own metadata.
    expect(
      humanRecordCaptureIssues(relabeled.human_verification as ProgramCriterionHumanVerification, draft),
    ).toEqual([
      "The capture is a proposed_draft recorded as proposed_not_operative; it cannot support a rule.",
      "The record's source type or operative status differs from the capture metadata.",
    ]);
  });

  it("rejects a record whose hash does not pin the captured text", () => {
    const wrongHash = syntheticCriterion(adopted, ADOPTED_EXCERPT, disqualify, {
      sha256: draft.metadata.sha256_extracted,
    });
    expect(
      humanRecordCaptureIssues(wrongHash.human_verification as ProgramCriterionHumanVerification, adopted),
    ).toEqual(["The record's SHA-256 does not pin the captured extracted text."]);
    const wrongExcerpt = syntheticCriterion(adopted, DRAFT_EXCERPT);
    expect(
      humanRecordCaptureIssues(wrongExcerpt.human_verification as ProgramCriterionHumanVerification, adopted),
    ).toEqual(["The supporting excerpt does not appear in the captured text."]);
  });

  it("limits a draft to a human re-review warning", () => {
    const warnings = draftChangeWarnings([adopted.metadata, draft.metadata], []);
    expect(warnings).toEqual([
      {
        kind: "draft_change_warning",
        draft_source_id: "test-only-draft-amendment-000001",
        affects_source_id: "test-only-adopted-ordinance-000001",
        criterion_ids: [],
        action: "human_re_review",
      },
    ]);
    expect(draftChangeWarnings([adopted.metadata], [])).toEqual([]);

    // With the real proposals, the Low-Rise draft flags only the Low-Rise atomic criteria.
    const lowRiseDraft = parseLikeCapture({
      ...officialMetadata(),
      source_id: "low-rise-draft-2026-09-24",
      source_type: "proposed_draft",
      operative_status: "proposed_not_operative",
      may_change_source_ids: ["ordinance-188967"],
    });
    const parsed = Object.values(proposals).map((value) => proposedVerificationSchema.parse(value));
    expect(draftChangeWarnings([lowRiseDraft], parsed)).toEqual([
      {
        kind: "draft_change_warning",
        draft_source_id: "low-rise-draft-2026-09-24",
        affects_source_id: "ordinance-188967",
        criterion_ids: [
          "la_low_rise.incentive-area-map-subarea",
          "la_low_rise.subarea-distance-bands",
          "la_low_rise.subarea-geographic-criteria",
          "la_low_rise.underlying-zone",
          "la_low_rise.manufacturing-zone-exclusion",
          "la_low_rise.single-family-zone-exclusion",
          "la_low_rise.fire-restriction-area-exclusion",
          "la_low_rise.coastal-zone-exclusion",
          "la_low_rise.sea-level-rise-area-exclusion",
          "la_low_rise.excluded-plan-area",
          "la_low_rise.c10-exception-path",
          "la_low_rise.tod-subarea-historic-limit",
        ],
        action: "human_re_review",
      },
    ]);
  });
});

describe("Proposed verification records", () => {
  const shipped = new Map(
    programScreenPathwayPacks.flatMap((pack) => pack.criteria).map((criterion) => [criterion.id, criterion]),
  );
  const parsed = Object.fromEntries(
    Object.entries(proposals).map(([file, value]) => [file, proposedVerificationSchema.safeParse(value)]),
  );
  const components = () =>
    Object.values(parsed).flatMap((result) => (result.data as ProposedVerification).candidate_components);

  it("has exactly one proposal per retired broad criterion, named for it", () => {
    expect(Object.keys(proposals).sort()).toEqual(
      [...retiredProgramCriterionIds].map((id) => `${id}.json`).sort(),
    );
    for (const [file, result] of Object.entries(parsed)) {
      expect(result.success, `${file}: ${JSON.stringify(result.error?.issues)}`).toBe(true);
      expect(`${result.data?.retired_criterion_id}.json`).toBe(file);
      expect(result.data?.schema_version).toBe("program-screen-proposal-v2");
    }
  });

  it("records each retired criterion's facts before the split and rests on a non-draft source", () => {
    const before = Object.fromEntries(
      Object.values(parsed).map((result) => {
        const proposal = result.data as ProposedVerification;
        const source = expectedOfficialSources.find((candidate) => candidate.source_id === proposal.source_id);
        expect(source?.source_type, proposal.retired_criterion_id).not.toBe("proposed_draft");
        expect(proposal.question_for_human_reviewer).toMatch(/\?/);
        return [proposal.retired_criterion_id, proposal.proposed_controlled_interpretation.fact_keys_before_split];
      }),
    );
    // The broad criteria's facts as shipped in PR #15; several keys are now retired.
    expect(before).toEqual({
      "la_shra.lot-area-and-zoning": ["lot-area", "zoning"],
      "la_shra.existing-structures-and-occupancy": ["existing-structures", "occupancy-history"],
      "la_shra.prior-subdivisions": ["prior-subdivisions"],
      "la_shra.housing-element-site-status": ["housing-element-site-status"],
      "la_shra.environmental-constraints": [
        "very-high-fire-hazard-severity-zone",
        "hillside-area",
        "fault-zone",
        "landslide-area",
        "flood-zone",
      ],
      "la_sb79.permanent-exclusion": ["sb79-permanent-exclusion"],
      "la_sb79.temporary-exemption": ["sb79-temporary-exemption"],
      "la_sb79.site-and-overlay-standards": ["zoning", "specific-plan-area", "hpoz", "existing-dwelling-units"],
      "la_low_rise.geographic-criteria": ["zoning", "general-plan-land-use", "specific-plan-area"],
    });
  });

  it("matches every shipped component to exactly one atomic criterion, field for field", () => {
    const shippedComponents = components().filter((component) =>
      (shippedComponentDispositions as readonly string[]).includes(component.disposition),
    );
    expect(shippedComponents.map((component) => component.component_id).sort()).toEqual(
      [...humanVerificationRequiredCriterionIds].sort(),
    );
    for (const component of shippedComponents) {
      const criterion = shipped.get(component.component_id) as ProgramCriterion;
      expect(criterion, component.component_id).toBeDefined();
      expect(component.label).toBe(criterion.label);
      expect(component.pinpoint).toBe(criterion.citation.pinpoint);
      expect(component.reads_existing_fact_keys).toEqual([...criterion.fact_keys]);
      expect(component.excerpts.map((excerpt) => excerpt.text)).toEqual([...criterion.basis.excerpts]);
    }
    for (const component of components().filter((candidate) => !shippedComponents.includes(candidate))) {
      expect(shipped.has(component.component_id), component.component_id).toBe(false);
    }
  });

  it("stays awaiting capture while its source is uncaptured, and holds against it once captured", () => {
    for (const result of Object.values(parsed)) {
      const proposal = result.data as ProposedVerification;
      const found = Object.values(officialCaptures).find(
        (candidate) => candidate.metadata?.source_id === proposal.source_id,
      );
      if (found === undefined) {
        expect(proposal.status, proposal.retired_criterion_id).toBe("awaiting_source_capture");
        expect(proposal.candidate_excerpt).toBeNull();
      } else {
        expect(proposal.status, proposal.retired_criterion_id).toBe("awaiting_human_review");
        expect(proposalCaptureIssues(proposal, completeOfficial(found)), proposal.retired_criterion_id).toEqual([]);
      }
    }
  });

  it("pins each proposal's source and how it splits the retired criterion", () => {
    // Changing a disposition changes what a reviewer is asked to approve.
    const summary = Object.fromEntries(
      Object.values(parsed).map((result) => {
        const proposal = result.data as ProposedVerification;
        return [
          proposal.retired_criterion_id,
          [
            proposal.source_id,
            ...proposal.candidate_components.map((component) => `${component.component_id}:${component.disposition}`),
          ],
        ];
      }),
    );
    expect(summary).toEqual({
      "la_low_rise.geographic-criteria": [
        "ordinance-188967",
        "la_low_rise.incentive-area-map-subarea:partially_deterministic",
        "la_low_rise.subarea-distance-bands:professional_judgment",
        "la_low_rise.subarea-geographic-criteria:professional_judgment",
        "la_low_rise.underlying-zone:partially_deterministic",
        "la_low_rise.manufacturing-zone-exclusion:partially_deterministic",
        "la_low_rise.single-family-zone-exclusion:partially_deterministic",
        "la_low_rise.fire-restriction-area-exclusion:partially_deterministic",
        "la_low_rise.coastal-zone-exclusion:partially_deterministic",
        "la_low_rise.sea-level-rise-area-exclusion:partially_deterministic",
        "la_low_rise.excluded-plan-area:partially_deterministic",
        "la_low_rise.c10-exception-path:professional_judgment",
        "la_low_rise.tod-subarea-historic-limit:professional_judgment",
        "la_low_rise.historic-resource-lr1-limit:outside_screen",
        "la_low_rise.general-plan-land-use:no_rule_in_source",
      ],
      "la_sb79.permanent-exclusion": [
        "ordinance-188968",
        "la_sb79.permanent-exemption-shown:partially_deterministic",
        "la_sb79.permanent-exemption-walking-path:professional_judgment",
        "la_sb79.permanent-exemption-industrial-hub:professional_judgment",
      ],
      "la_sb79.site-and-overlay-standards": [
        "ordinance-188968",
        "la_sb79.temporary-exemption-historic-resource:partially_deterministic",
        "la_sb79.zoning-standard:no_rule_in_source",
        "la_sb79.specific-plan-and-tod-plan:no_rule_in_source",
        "la_sb79.existing-housing:no_rule_in_source",
      ],
      "la_sb79.temporary-exemption": [
        "ordinance-188968",
        "la_sb79.temporary-exemption-all-parcels:interpretation_unresolved",
        "la_sb79.temporary-exemption-period:partially_deterministic",
        "la_sb79.temporary-exemption-shown:interpretation_unresolved",
        "la_sb79.temporary-exemption-capacity-criteria:professional_judgment",
        "la_sb79.temporary-exemption-tod-alternative-plan:partially_deterministic",
        "la_sb79.temporary-exemption-fire-or-state-responsibility-area:partially_deterministic",
        "la_sb79.temporary-exemption-sea-level-rise:partially_deterministic",
      ],
      "la_shra.environmental-constraints": [
        "shra-2025-10-28",
        "la_shra.very-high-fire-hazard-severity-zone:deterministic_candidate",
        "la_shra.high-fire-hazard-severity-zone:deterministic_candidate",
        "la_shra.prime-or-statewide-farmland:deterministic_candidate",
        "la_shra.wetlands:partially_deterministic",
        "la_shra.natural-community-conservation-plan-land:deterministic_candidate",
        "la_shra.protected-species-habitat:professional_judgment",
        "la_shra.conservation-easement:deterministic_candidate",
        "la_shra.hazardous-waste-site:partially_deterministic",
        "la_shra.special-flood-hazard-area:partially_deterministic",
        "la_shra.regulatory-floodway:partially_deterministic",
        "la_shra.earthquake-fault-zone:partially_deterministic",
        "la_shra.hillside-area:no_rule_in_source",
        "la_shra.landslide-area:no_rule_in_source",
      ],
      "la_shra.existing-structures-and-occupancy": [
        "shra-2025-10-28",
        "la_shra.protected-housing-demolition-or-alteration:professional_judgment",
        "la_shra.protected-housing-affordability-covenant:partially_deterministic",
        "la_shra.protected-housing-price-control:partially_deterministic",
        "la_shra.protected-housing-tenant-occupancy:professional_judgment",
        "la_shra.ellis-act-withdrawal:partially_deterministic",
        "la_shra.existing-units-not-separated:outside_screen",
      ],
      "la_shra.housing-element-site-status": [
        "shra-2025-10-28",
        "la_shra.housing-element-projected-units:partially_deterministic",
        "la_shra.housing-element-lower-income-units:partially_deterministic",
        "la_shra.non-housing-element-minimum-density:outside_screen",
      ],
      "la_shra.lot-area-and-zoning": [
        "shra-2025-10-28",
        "la_shra.multifamily-lot-area-threshold:partially_deterministic",
        "la_shra.single-family-lot-area-threshold:deterministic_candidate",
        "la_shra.zone-category:partially_deterministic",
        "la_shra.single-family-vacancy-condition:partially_deterministic",
        "la_shra.urban-uses-surround:outside_screen",
      ],
      "la_shra.prior-subdivisions": [
        "shra-2025-10-28",
        "la_shra.prior-shra-or-sb9-map:deterministic_candidate",
        "la_shra.discretionary-map-recorded-first:outside_screen",
        "la_shra.adjacent-parcels:no_rule_in_source",
      ],
    });
  });

  it("matches each disposition to the atomic criterion's kind and outcome ceiling", () => {
    for (const component of components()) {
      const criterion = shipped.get(component.component_id);
      if (criterion === undefined) continue;
      const may = (outcome: string) => (criterion.permitted_outcomes as readonly string[]).includes(outcome);
      const directions = [may("consistent_with_source"), may("disqualifying_per_source")].filter(Boolean).length;
      const expected: Record<string, [ProgramCriterion["predicate"], number]> = {
        deterministic_candidate: ["not_encoded", 2],
        partially_deterministic: ["not_encoded", 1],
        interpretation_unresolved: ["not_encoded", 0],
        professional_judgment: ["professional_judgment", 0],
      };
      const [predicate, count] = expected[component.disposition];
      expect([criterion.predicate, directions], component.component_id).toEqual([predicate, count]);
    }
  });

  it("records removed facts only on no-rule components, and never a shipped criterion as removed", () => {
    const removed = components()
      .filter((component) => component.disposition === "no_rule_in_source")
      .flatMap((component) => component.removed_fact_keys)
      .sort();
    expect(removed).toEqual([
      "existing-dwelling-units",
      "general-plan-land-use",
      "hillside-area",
      "landslide-area",
      "specific-plan-area",
      "zoning",
    ]);
  });

  it("rejects a component excerpt that is off its page, invented, or taken from the draft", () => {
    const base = proposals["la_low_rise.geographic-criteria.json"] as ProposedVerification;
    const capture = completeOfficial(officialCaptures[`${OFFICIAL_DIR}ordinance-188967`]);
    expect(proposalCaptureIssues(base, capture)).toEqual([]);

    const [first, ...rest] = base.candidate_components;
    const withExcerpt = (page: number, text: string) => ({
      ...base,
      candidate_components: [{ ...first, excerpts: [first.excerpts[0], { page, text }] }, ...rest],
    });
    // (c)(9) starts on page 6; the same words are not on page 7.
    const cNine = rest.find((component) => component.component_id === "la_low_rise.excluded-plan-area");
    expect(cNine?.excerpts.map((excerpt) => excerpt.page)).toEqual([6, 7]);
    expect(proposalCaptureIssues(withExcerpt(7, cNine?.excerpts[0].text ?? ""), capture)).toEqual([
      "la_low_rise.incentive-area-map-subarea: an excerpt is not on page 7.",
    ]);
    expect(
      proposalCaptureIssues(withExcerpt(7, "A project in LR-1 may build 11 units."), capture),
    ).toEqual(["la_low_rise.incentive-area-map-subarea: an excerpt does not appear in the captured text."]);

    // Checked against the draft capture, the same proposal cannot support a rule.
    const draftCapture = completeOfficial(officialCaptures[`${OFFICIAL_DIR}low-rise-draft-2026-09-24`]);
    expect(proposalCaptureIssues(base, draftCapture)).toEqual(
      expect.arrayContaining([
        "The capture is low-rise-draft-2026-09-24, not ordinance-188967.",
        "A proposed_draft recorded as proposed_not_operative cannot support a rule.",
      ]),
    );
  });

  it("keeps components consistent with the headline candidate and the rule dispositions", () => {
    const base = proposals["la_shra.lot-area-and-zoning.json"] as ProposedVerification;
    expect(proposedVerificationSchema.safeParse(base).success).toBe(true);
    const [first, ...rest] = base.candidate_components;
    const unscreened = rest[3];
    expect(unscreened.disposition).toBe("outside_screen");
    const variants: Array<[string, unknown]> = [
      ["no components while awaiting review", { ...base, candidate_components: [] }],
      ["components while awaiting capture", {
        ...base,
        status: "awaiting_source_capture",
        source_sha256: null,
        candidate_page: null,
        candidate_pinpoint: null,
        candidate_excerpt: null,
      }],
      ["a headline excerpt that is not the first component's", { ...base, candidate_page: 12 }],
      ["duplicate component IDs", { ...base, candidate_components: [first, first, ...rest] }],
      ["a component in another pathway", {
        ...base,
        candidate_components: [first, { ...rest[0], component_id: "la_sb79.lot-area" }],
      }],
      ["a deterministic component without a rule", {
        ...base,
        candidate_components: [{ ...first, proposed_rule_if_reviewer_agrees: null }, ...rest],
      }],
      ["an unscreened component that proposes a rule", {
        ...base,
        candidate_components: [first, ...rest.slice(0, 3), { ...unscreened, proposed_rule_if_reviewer_agrees: "Always consistent." }],
      }],
      ["an unscreened component without a reason", {
        ...base,
        candidate_components: [first, ...rest.slice(0, 3), { ...unscreened, judgment_or_ambiguity: [] }],
      }],
      ["an unscreened component that reads a fact", {
        ...base,
        candidate_components: [first, ...rest.slice(0, 3), { ...unscreened, reads_existing_fact_keys: ["lot-area"] }],
      }],
      ["a shipped disposition on an ID that is not an atomic criterion", {
        ...base,
        candidate_components: [first, ...rest.slice(0, 3), { ...unscreened, disposition: "professional_judgment" }],
      }],
      ["an atomic criterion recorded as not shipped", {
        ...base,
        candidate_components: [{ ...first, disposition: "outside_screen", proposed_rule_if_reviewer_agrees: null, reads_existing_fact_keys: [] }, ...rest],
      }],
      ["removed facts on a shipped component", {
        ...base,
        candidate_components: [{ ...first, removed_fact_keys: ["zoning"] }, ...rest],
      }],
      ["a component without a reviewer question", {
        ...base,
        candidate_components: [{ ...first, reviewer_question: "Review this." }, ...rest],
      }],
      ["a retired criterion ID that is not one of the nine", { ...base, retired_criterion_id: "la_shra.zone-category" }],
      ["an unknown disposition", {
        ...base,
        candidate_components: [{ ...first, disposition: "human_verified" }, ...rest],
      }],
    ];
    for (const [name, value] of variants) {
      expect(proposedVerificationSchema.safeParse(value).success, name).toBe(false);
    }
  });

  it("never names a reviewer, human or AI, and is never marked reviewed", () => {
    const base = proposals["la_sb79.permanent-exclusion.json"] as ProposedVerification;
    for (const reviewer of [
      { kind: "human", name: "Any Person", role: "Reviewer" },
      { kind: "ai", name: "Claude", role: "AI assistant" },
      "Claude",
    ]) {
      expect(proposedVerificationSchema.safeParse({ ...base, reviewer }).success).toBe(false);
    }
    expect(proposedVerificationSchema.safeParse({ ...base, reviewed_at: "2026-09-27" }).success).toBe(false);
    expect(proposedVerificationSchema.safeParse({ ...base, status: "human_verified" }).success).toBe(false);
    for (const value of Object.values(proposals)) {
      expect(value).toMatchObject({ reviewer: null, reviewed_at: null });
    }
  });

  it("rejects a proposal that rests on the draft or carries a candidate without a capture", () => {
    const base = proposals["la_low_rise.geographic-criteria.json"] as ProposedVerification;
    expect(
      proposedVerificationSchema.safeParse({ ...base, source_id: "low-rise-draft-2026-09-24" }).success,
    ).toBe(false);
    expect(
      proposedVerificationSchema.safeParse({ ...base, related_draft_source_ids: ["ordinance-188968"] }).success,
    ).toBe(false);
    expect(
      proposedVerificationSchema.safeParse({ ...base, candidate_excerpt: "Invented ordinance wording." }).success,
    ).toBe(false);
    const uncaptured = {
      ...base,
      source_sha256: null,
      candidate_page: null,
      candidate_pinpoint: null,
      candidate_excerpt: null,
      candidate_components: [],
    };
    expect(proposedVerificationSchema.safeParse({ ...uncaptured, status: "awaiting_source_capture" }).success).toBe(
      true,
    );
    expect(proposedVerificationSchema.safeParse({ ...uncaptured, status: "awaiting_human_review" }).success).toBe(
      false,
    );
    expect(
      proposedVerificationSchema.safeParse({ ...base, status: "awaiting_source_capture" }).success,
    ).toBe(false);
  });

  it("cannot stand in for a human verification record", () => {
    for (const value of Object.values(proposals)) {
      const proposal = value as ProposedVerification;
      expect(programCriterionHumanVerificationSchema.safeParse(proposal).success).toBe(false);

      const spy = vi.fn(() => "disqualifying_per_source" as const);
      const [firstShipped] = proposal.candidate_components.filter((component) =>
        shipped.has(component.component_id),
      );
      const original = shipped.get(firstShipped.component_id) as ProgramCriterion;
      const promoted = {
        ...original,
        predicate: spy,
        question_if_judgment: "How does Planning apply this criterion?",
        verification: "human_verified" as const,
        human_verification: proposal as unknown as ProgramCriterionHumanVerification,
      };
      expect(programCriterionSchema.safeParse(promoted).success, original.id).toBe(false);
      expect(hasCompleteHumanVerification(promoted)).toBe(false);
      expect(criterionAwaitsHumanVerification(promoted)).toBe(true);
      const facts = new Map(assessProgramFacts([], promoted.fact_keys).map((fact) => [fact.key, fact]));
      expect(evaluateProgramCriterion(promoted, facts, AS_OF).status).not.toBe("disqualifying_per_source");
      expect(spy).not.toHaveBeenCalled();
    }
  });

  it("checks a candidate excerpt, page, and hash against the capture", () => {
    const candidate = {
      ...(proposals["la_shra.environmental-constraints.json"] as ProposedVerification),
      source_id: adopted.metadata.source_id,
      source_sha256: adopted.metadata.sha256_extracted,
      candidate_page: 2,
      candidate_pinpoint: "Sec. 2(a)",
      candidate_excerpt: ADOPTED_EXCERPT,
      candidate_components: [],
      status: "awaiting_human_review" as const,
    };
    expect(proposalCaptureIssues(candidate, adopted)).toEqual([]);
    expect(proposalCaptureIssues({ ...candidate, candidate_page: 1 }, adopted)).toEqual([
      "The candidate excerpt is not on the candidate page.",
    ]);
    expect(
      proposalCaptureIssues({ ...candidate, source_sha256: adopted.metadata.sha256_original }, adopted),
    ).toEqual(["source_sha256 does not pin the captured extracted text."]);
    expect(
      proposalCaptureIssues({ ...candidate, candidate_excerpt: "A parcel may be excluded." }, adopted),
    ).toEqual(["The candidate excerpt does not appear in the captured text."]);
    expect(
      proposalCaptureIssues(
        { ...candidate, source_id: draft.metadata.source_id, source_sha256: draft.metadata.sha256_extracted, candidate_page: 1, candidate_excerpt: DRAFT_EXCERPT },
        draft,
      ),
    ).toEqual(["A proposed_draft recorded as proposed_not_operative cannot support a rule."]);
    expect(proposalCaptureIssues(candidate, draft)[0]).toBe(
      "The capture is test-only-draft-amendment-000001, not test-only-adopted-ordinance-000001.",
    );
  });

  it("matches the verification ledger, question for question", () => {
    const ledger = normalizeSourceText(verificationLedger);
    for (const value of Object.values(proposals)) {
      const proposal = value as ProposedVerification;
      expect(ledger).toContain(`#### \`${proposal.retired_criterion_id}\` (retired)`);
      expect(ledger, proposal.retired_criterion_id).toContain(
        normalizeSourceText(proposal.question_for_human_reviewer),
      );
      expect(ledger).toContain(`(status \`${proposal.status}\`)`);
      for (const component of proposal.candidate_components) {
        expect(ledger, component.component_id).toContain(
          normalizeSourceText(`\`${component.component_id}\`: ${component.reviewer_question}`),
        );
      }
    }
  });

  it("is never read by the production evaluator", () => {
    expect(Object.keys(productionSources).length).toBeGreaterThan(5);
    for (const [path, source] of Object.entries(productionSources)) {
      expect(source, path).not.toMatch(/proposed-verification/);
    }
  });
});

describe("Fail-closed behavior after this capture pass", () => {
  const shipped = programScreenPathwayPacks.flatMap((pack) => pack.criteria);
  const fixture = parseProgramScreenFixture(fixtureJson);

  it("keeps all 46 atomic criteria pending_human, without a rule or a record", () => {
    expect(humanVerificationRequiredCriterionIds).toHaveLength(46);
    for (const id of humanVerificationRequiredCriterionIds) {
      const criterion = shipped.find((candidate) => candidate.id === id);
      expect(criterion, id).toMatchObject({ verification: "pending_human", human_verification: null });
      expect(typeof criterion?.predicate, id).not.toBe("function");
      expect(criterionAwaitsHumanVerification(criterion as ProgramCriterion)).toBe(true);
    }
    for (const id of retiredProgramCriterionIds) {
      expect(shipped.find((candidate) => candidate.id === id), id).toBeUndefined();
    }
    expect(shipped.filter((criterion) => criterion.verification === "human_verified")).toEqual([]);
  });

  it("still blocks a TEST-ONLY verified rule once its citation is due for review", () => {
    const criterion = syntheticCriterion(adopted, ADOPTED_EXCERPT);
    const due = screen(criterion, [evidence("f", "special-flood-hazard-area", false)], "2026-10-20");
    expect(due.criterion.stale).toBe(true);
    expect(due.result.release.client_releasable).toBe(false);
    expect(due.result.release.blockers).toContainEqual(
      expect.objectContaining({ code: "stale_criterion", ref: criterion.id }),
    );
    expect(screen(criterion, [evidence("f", "special-flood-hazard-area", false)], "2026-10-19").criterion.stale).toBe(false);
  });

  it("leaves the fictional fixture's results unchanged", () => {
    const result = evaluateProgramScreen({ evidence_records: fixture.evidence_records, as_of: fixture.as_of });
    const statuses = Object.fromEntries(
      result.pathways.flatMap((pathway) => pathway.criteria).map((criterion) => [criterion.criterion_id, criterion.status]),
    );
    expect(statuses).toEqual(fixture.expected.criterion_statuses);
    expect(Object.fromEntries(result.pathways.map((pathway) => [pathway.pathway, pathway.rollup]))).toEqual(
      fixture.expected.pathway_rollups,
    );
    expect(result.release.client_releasable).toBe(fixture.expected.client_releasable);
    expect(result.release.client_releasable).toBe(false);
  });

  it("keeps the public demo non-releasable with 46 pending criteria", () => {
    const payload = buildProgramScreenPublicDemoPayload(fixtureJson, { as_of: fixture.as_of });
    expect(payload.release.client_releasable).toBe(false);
    expect(payload.release.blocker_counts.pending_human_criterion).toBe(46);
  });
});
