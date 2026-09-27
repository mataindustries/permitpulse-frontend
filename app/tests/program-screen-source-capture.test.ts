import { describe, expect, it, vi } from "vitest";
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

const officialCaptures = loadCaptures(
  import.meta.glob("../fixtures/program-screen/official-sources/*/metadata.json", {
    import: "default",
    eager: true,
  }),
  import.meta.glob("../fixtures/program-screen/official-sources/*/original.pdf", {
    query: "?inline",
    import: "default",
    eager: true,
  }) as Record<string, string>,
  import.meta.glob("../fixtures/program-screen/official-sources/*/extracted.txt", {
    query: "?raw",
    import: "default",
    eager: true,
  }) as Record<string, string>,
);

/** Every file under official-sources/, without loading any (keys only). */
const officialSourceFiles = Object.keys(
  import.meta.glob("../fixtures/program-screen/official-sources/**/*", { query: "?url" }),
).map((path) => path.replace("../fixtures/program-screen/official-sources/", ""));

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
    facts["flood-zone"]?.kind === "boolean" && facts["flood-zone"].value
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
    fact_keys: ["flood-zone"],
    predicate,
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
  it("loads both synthetic captures from the per-source layout", () => {
    expect(Object.keys(testOnlyCaptures)).toEqual([ADOPTED_DIR, DRAFT_DIR]);
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
    // Empty: on 2026-09-27 the capture environment could not reach
    // cityclerk.lacity.org or planning.lacity.gov (egress policy 403), and no
    // official file was supplied locally. See
    // docs/PROGRAM_SCREEN_CRITERION_VERIFICATION.md, "Manual download list".
    expect(Object.keys(officialCaptures)).toEqual([]);
  });

  it("holds only complete captures: no HTML, notes, or stray files", () => {
    expect(officialSourceFiles).toContain("README.md");
    for (const path of officialSourceFiles) {
      expect(path, path).toMatch(/^(?:README\.md|[a-z0-9]+(?:-[a-z0-9]+)*\/(?:original\.pdf|extracted\.txt|metadata\.json))$/);
    }
    for (const capture of Object.values(officialCaptures)) {
      expect(capture.metadata, capture.directory).not.toBeNull();
      expect(capture.original, capture.directory).not.toBeNull();
      expect(capture.extracted, capture.directory).not.toBeNull();
    }
  });

  it("keeps every capture pinned, official, and matched to its expected source", async () => {
    for (const found of Object.values(officialCaptures)) {
      expect(await officialSourceCaptureIssues(found), found.directory).toEqual([]);
      const capture = complete(found);
      expect(capture.metadata.test_only, capture.directory).toBe(false);
      expect(expectedSourceIssues(capture.metadata), capture.directory).toEqual([]);
    }
  });

  it("keeps the adopted ordinances and the draft distinguishable", () => {
    const ids = expectedOfficialSources.map((source) => source.source_id);
    expect(ids).toEqual([
      "ordinance-188967",
      "ordinance-188968",
      "shra-2025-10-28",
      "low-rise-draft-2026-09-24",
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
    expect(screen(criterion, [evidence("f", "flood-zone", true)]).pathway.rollup).toBe(
      "documented_disqualifier",
    );
    const clear = screen(criterion, [evidence("f", "flood-zone", false)]);
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
      () => screen(criterion, [evidence("f", "flood-zone", true)]),
      "INVALID_PROGRAM_CRITERION",
    );

    // A caller that skips pack validation still gets no result from the rule.
    for (const flooded of [true, false]) {
      const facts = new Map(
        assessProgramFacts([evidence("f", "flood-zone", flooded)], ["flood-zone"]).map((fact) => [
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

    // With the real proposals, the Low-Rise draft flags only the Low-Rise criterion.
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
        criterion_ids: ["la_low_rise.geographic-criteria"],
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

  it("has exactly one proposal per pending criterion, named for it", () => {
    expect(Object.keys(proposals).sort()).toEqual(
      [...humanVerificationRequiredCriterionIds].map((id) => `${id}.json`).sort(),
    );
    for (const [file, result] of Object.entries(parsed)) {
      expect(result.success, `${file}: ${JSON.stringify(result.error?.issues)}`).toBe(true);
      expect(`${result.data?.criterion_id}.json`).toBe(file);
    }
  });

  it("reads exactly the shipped criterion's facts and rests on a non-draft source", () => {
    for (const result of Object.values(parsed)) {
      const proposal = result.data as ProposedVerification;
      const criterion = shipped.get(proposal.criterion_id) as ProgramCriterion;
      expect(proposal.proposed_controlled_interpretation.fact_keys).toEqual([...criterion.fact_keys]);
      const source = expectedOfficialSources.find((candidate) => candidate.source_id === proposal.source_id);
      expect(source?.source_type, proposal.criterion_id).not.toBe("proposed_draft");
      expect(proposal.question_for_human_reviewer).toMatch(/\?/);
    }
  });

  it("stays awaiting capture while its source is uncaptured, and holds against it once captured", () => {
    for (const result of Object.values(parsed)) {
      const proposal = result.data as ProposedVerification;
      const found = Object.values(officialCaptures).find(
        (candidate) => candidate.metadata?.source_id === proposal.source_id,
      );
      if (found === undefined) {
        expect(proposal.status, proposal.criterion_id).toBe("awaiting_source_capture");
        expect(proposal.candidate_excerpt).toBeNull();
      } else {
        expect(proposalCaptureIssues(proposal, complete(found)), proposal.criterion_id).toEqual([]);
      }
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
    expect(
      proposedVerificationSchema.safeParse({ ...base, status: "awaiting_human_review" }).success,
    ).toBe(false);
  });

  it("cannot stand in for a human verification record", () => {
    for (const value of Object.values(proposals)) {
      const proposal = value as ProposedVerification;
      expect(programCriterionHumanVerificationSchema.safeParse(proposal).success).toBe(false);

      const spy = vi.fn(() => "disqualifying_per_source" as const);
      const original = shipped.get(proposal.criterion_id) as ProgramCriterion;
      const promoted = {
        ...original,
        predicate: spy,
        question_if_judgment: "How does Planning apply this criterion?",
        verification: "human_verified" as const,
        human_verification: proposal as unknown as ProgramCriterionHumanVerification,
      };
      expect(programCriterionSchema.safeParse(promoted).success, proposal.criterion_id).toBe(false);
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
      expect(ledger).toContain(`#### \`${proposal.criterion_id}\``);
      expect(ledger, proposal.criterion_id).toContain(
        normalizeSourceText(proposal.question_for_human_reviewer),
      );
      expect(ledger).toContain(`(status \`${proposal.status}\`)`);
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

  it("keeps all nine criteria pending_human, unencoded, and without a record", () => {
    for (const id of humanVerificationRequiredCriterionIds) {
      const criterion = shipped.find((candidate) => candidate.id === id);
      expect(criterion, id).toMatchObject({
        verification: "pending_human",
        predicate: "not_encoded",
        human_verification: null,
      });
      expect(criterionAwaitsHumanVerification(criterion as ProgramCriterion)).toBe(true);
    }
    expect(shipped.filter((criterion) => criterion.verification === "human_verified")).toEqual([]);
  });

  it("still blocks a TEST-ONLY verified rule once its citation is due for review", () => {
    const criterion = syntheticCriterion(adopted, ADOPTED_EXCERPT);
    const due = screen(criterion, [evidence("f", "flood-zone", false)], "2026-10-20");
    expect(due.criterion.stale).toBe(true);
    expect(due.result.release.client_releasable).toBe(false);
    expect(due.result.release.blockers).toContainEqual(
      expect.objectContaining({ code: "stale_criterion", ref: criterion.id }),
    );
    expect(screen(criterion, [evidence("f", "flood-zone", false)], "2026-10-19").criterion.stale).toBe(false);
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

  it("keeps the public demo non-releasable with nine pending criteria", () => {
    const payload = buildProgramScreenPublicDemoPayload(fixtureJson, { as_of: fixture.as_of });
    expect(payload.release.client_releasable).toBe(false);
    expect(payload.release.blocker_counts.pending_human_criterion).toBe(9);
  });
});
