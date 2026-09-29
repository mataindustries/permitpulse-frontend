import { describe, expect, inject, it } from "vitest";
import reviewDoc from "../../docs/PROGRAM_SCREEN_PHASE_3A_GCS_66499_41_A_9_REVIEW.md?raw";
import fixtureJson from "../fixtures/program-screen/fictional-la-parcel.json";
import decisionsJson from "../fixtures/program-screen/human-review-rounds/round-1-decisions.json";
import roundJson from "../fixtures/program-screen/human-review-rounds/round-1.json";
import statuteExtracted from "../fixtures/program-screen/official-sources/gcs-66499-41/extracted.txt?raw";
import statuteMetadataJson from "../fixtures/program-screen/official-sources/gcs-66499-41/metadata.json";
import statuteHtml from "../fixtures/program-screen/official-sources/gcs-66499-41/original.html?raw";
import {
  authorityPromotionBlockers,
  programAuthorityRegistries,
  promotionGuardedCriterionIds,
  type ReviewedAuthoritySource,
} from "../src/shared/program-screen/authority-policy";
import { evaluateProgramScreen, programScreenPathwayPacks } from "../src/shared/program-screen/evaluate";
import {
  expectedOfficialSources,
  expectedSourceIssues,
  humanReviewDecisionsSchema,
  statuteRereviewWarnings,
} from "../src/shared/program-screen/proposed-verification";
import { buildProgramScreenPublicDemoPayload } from "../src/shared/program-screen/public-demo";
import {
  authoritySourceCaptureIssues,
  canSupportCriterionRule,
  captureContextIssues,
  extractHtmlPages,
  htmlCaptureIssue,
  joinExtractedPages,
  normalizeSourceText,
  OFFICIAL_SOURCE_METADATA_V2_VERSION,
  parseOfficialSourceMetadata,
  sha256Hex,
  sha256HexBytes,
  sourceHostExceptions,
  splitExtractedPages,
  type OfficialSourceMetadata,
} from "../src/shared/program-screen/source-capture";

/**
 * Phase 3A: the first real statute capture, GOV 66499.41 as served by
 * leginfo.legislature.ca.gov, and the Round 1 re-review it triggers.
 * A capture only: it registers no authority and promotes nothing.
 * Review memo: docs/PROGRAM_SCREEN_PHASE_3A_GCS_66499_41_A_9_REVIEW.md.
 */

const DIRECTORY = "app/fixtures/program-screen/official-sources/gcs-66499-41";
const OFFICIAL_URL = "https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?lawCode=GOV&sectionNum=66499.41.";
const SHA256_ORIGINAL = "3521eb92f68d966461eb0c7b60ebffad8371b487eff2f014417cd74fc077ec72";
const SHA256_EXTRACTED = "48815c8e2a892ca8e3aa523c6d3237d9c014fc556b3e332e31f0894f5bcf0759";
const BYTES = 186734;
const HISTORY_NOTE =
  "(Amended (as amended by Stats. 2024, Ch. 294, Sec. 3) by Stats. 2025, Ch. 22, Sec. 28. (AB 130) Effective June 30, 2025.)";

/** GOV 66499.41(a)(9) as captured: each paragraph of extracted.txt, whitespace-normalized, in order. */
const A9_PARAGRAPHS = [
  "(9) The lot proposed to be subdivided is not located on a site that is any of the following:",
  "(A) Either prime farmland or farmland of statewide importance, as defined pursuant to United States Department of Agriculture land inventory and monitoring criteria, as modified for California, and designated on the maps prepared by the Farmland Mapping and Monitoring Program of the Department of Conservation, or land zoned or designated for agricultural protection or preservation by a local ballot measure that was approved by the voters of that jurisdiction.",
  "(B) Wetlands, as defined in the United States Fish and Wildlife Service Manual, Part 660 FW 2 (June 21, 1993).",
  "(C) Within a very high fire hazard severity zone, as determined by the Department of Forestry and Fire Protection pursuant to Section 51178, or within a high or very high fire hazard severity zone as indicated on maps adopted by the Department of Forestry and Fire Protection pursuant to Section 4202 of the Public Resources Code.",
  "(D) A hazardous waste site that is listed pursuant to Section 65962.5 or a hazardous waste site designated by the Department of Toxic Substances Control pursuant to former Section 25356 of the Health and Safety Code, unless either of the following applies:",
  "(i) The site is an underground storage tank site that received a uniform closure letter issued pursuant to subdivision (g) of Section 25296.10 of the Health and Safety Code based on closure criteria established by the State Water Resources Control Board for residential use or residential mixed uses. This section does not alter or change the conditions to remove a site from the list of hazardous waste sites listed pursuant to Section 65962.5.",
  "(ii) The State Department of Public Health, State Water Resources Control Board, Department of Toxic Substances Control, or a local agency making a determination pursuant to subdivision (c) of Section 25296.10 of the Health and Safety Code, has otherwise determined that the site is suitable for residential use or residential mixed uses.",
  "(E) Within a delineated earthquake fault zone as determined by the State Geologist in any official maps published by the State Geologist, unless the housing development project complies with applicable seismic protection building code standards adopted by the California Building Standards Commission under the California Building Standards Law (Part 2.5 (commencing with Section 18901) of Division 13 of the Health and Safety Code), and by any local building department under Chapter 12.2 (commencing with Section 8875) of Division 1 of Title 2.",
  "(F) Within a special flood hazard area subject to inundation by the 1-percent annual chance flood (100-year flood) as determined by the Federal Emergency Management Agency in any official maps published by the Federal Emergency Management Agency. If a development proponent is able to satisfy all applicable federal qualifying criteria in order to provide that the site satisfies this paragraph and is otherwise eligible for streamlined approval under this section, a local government shall not deny the application on the basis that the development proponent did not comply with any additional permit requirement, standard, or action adopted by that local government that is applicable to that site. A housing development project may be located on a site described in this subparagraph if either of the following is met:",
  "(i) The site has been subject to a Letter of Map Revision prepared by the Federal Emergency Management Agency and issued to the local jurisdiction.",
  "(ii) The site meets Federal Emergency Management Agency requirements necessary to meet minimum flood plain management criteria of the National Flood Insurance Program pursuant to Part 59 (commencing with Section 59.1) and Part 60 (commencing with Section 60.1) of Subchapter B of Chapter I of Title 44 of the Code of Federal Regulations.",
  "(G) Within a regulatory floodway as determined by the Federal Emergency Management Agency in any official maps published by the Federal Emergency Management Agency, unless the housing development project has received a no-rise certification in accordance with Section 60.3(d)(3) of Title 44 of the Code of Federal Regulations. If a development proponent is able to satisfy all applicable federal qualifying criteria in order to provide that the site satisfies this subparagraph and is otherwise eligible for streamlined approval under this section, a local government shall not deny the application on the basis that the development proponent did not comply with any additional permit requirement, standard, or action adopted by that local government that is applicable to that site.",
  "(H) Land identified for conservation in an adopted natural community conservation plan pursuant to the Natural Community Conservation Planning Act (Chapter 10 (commencing with Section 2800) of Division 3 of the Fish and Game Code), habitat conservation plan pursuant to the federal Endangered Species Act of 1973 (16 U.S.C. Sec. 1531 et seq.), or another adopted natural resource protection plan.",
  "(I) Habitat for protected species identified as candidate, sensitive, or species of special status by state or federal agencies, fully protected species, or species protected by the federal Endangered Species Act of 1973 (16 U.S.C. Sec. 1531 et seq.), the California Endangered Species Act (Chapter 1.5 (commencing with Section 2050) of Division 3 of the Fish and Game Code), or the Native Plant Protection Act (Chapter 10 (commencing with Section 1900) of Division 2 of the Fish and Game Code).",
  "(J) Land under conservation easement.",
] as const;

const C_TO_G = [
  "la_shra.very-high-fire-hazard-severity-zone",
  "la_shra.high-fire-hazard-severity-zone",
  "la_shra.prime-or-statewide-farmland",
  "la_shra.natural-community-conservation-plan-land",
  "la_shra.conservation-easement",
];

const metadata = parseOfficialSourceMetadata(statuteMetadataJson);
const decisions = humanReviewDecisionsSchema.parse(decisionsJson);
const officialByteChecks = inject("programScreenOfficialCaptureByteChecks");
const officialMetadata = Object.values(
  import.meta.glob("../fixtures/program-screen/official-sources/*/metadata.json", { import: "default", eager: true }) as Record<
    string,
    unknown
  >,
).map((value) => parseOfficialSourceMetadata(value));
const shippedCriteria = programScreenPathwayPacks.flatMap((pack) => pack.criteria);

/** The whitespace-normalized paragraphs of the captured page. */
const paragraphs = statuteExtracted.split(/\n\n+/).map(normalizeSourceText);

/* ======================================================================== */

describe("1. The capture holds the exact bytes leginfo served", () => {
  it("passes the Node-side byte check on the committed files", () => {
    expect(officialByteChecks[DIRECTORY]).toEqual({
      files: ["extracted.txt", "metadata.json", "original.html"],
      sha256_original: SHA256_ORIGINAL,
      bytes: BYTES,
      is_pdf: false,
      issues: [],
    });
  });

  it("re-extracts the served HTML to the committed text with the pinned extractor", async () => {
    const bytes = new TextEncoder().encode(statuteHtml);
    // The raw import is the exact file: its UTF-8 encoding hashes to the pin.
    expect(await sha256HexBytes(bytes)).toBe(SHA256_ORIGINAL);
    expect(bytes.byteLength).toBe(BYTES);
    expect(htmlCaptureIssue(bytes)).toBeNull();
    expect(joinExtractedPages(extractHtmlPages(statuteHtml))).toBe(statuteExtracted);
    expect(await sha256Hex(statuteExtracted)).toBe(SHA256_EXTRACTED);
    expect(splitExtractedPages(statuteExtracted)).toHaveLength(1);
  });

  it("records v2 statute metadata pinned to the requested section", () => {
    expect(metadata).toMatchObject({
      schema_version: OFFICIAL_SOURCE_METADATA_V2_VERSION,
      source_id: "gcs-66499-41",
      official_url: OFFICIAL_URL,
      source_type: "statute",
      document_date: "2025-06-30",
      retrieved_at: "2026-09-28T21:46:59Z",
      sha256_original: SHA256_ORIGINAL,
      sha256_extracted: SHA256_EXTRACTED,
      operative_status: "operative",
      may_change_source_ids: [],
      original: { file: "original.html", media_type: "text/html", bytes: BYTES },
      extraction: { extractor: "program-screen-html-text", extractor_version: "1.0.0", page_count: 1, pages_without_text: [] },
      host_basis: "global_allowlist",
      agency_map: null,
      is_ai_generated: false,
      test_only: false,
    });
    if (metadata.schema_version !== OFFICIAL_SOURCE_METADATA_V2_VERSION) throw new Error("Expected v2 metadata.");
    expect(metadata.statute).toEqual({
      jurisdiction: "CA",
      code: "GOV",
      section: "66499.41",
      form: "code_section_page",
      section_heading: { page: 1, text: "66499.41." },
      pinpoints: [
        {
          pinpoint: "(a)",
          excerpt: {
            page: 1,
            text: "(a) A local agency shall ministerially consider, without discretionary review or a hearing, a parcel map or a tentative and final map for a housing development project that meets all of the following requirements:",
          },
        },
        { pinpoint: "(a)(9)", excerpt: { page: 1, text: A9_PARAGRAPHS[0] } },
      ],
      status_as_published: { page: 1, text: HISTORY_NOTE },
    });
    expect(captureContextIssues(metadata, statuteExtracted)).toEqual([]);
  });

  it("is registered as an expected official source, as a statute capture only", () => {
    expect(expectedSourceIssues(metadata)).toEqual([]);
    expect(expectedOfficialSources.find((source) => source.source_id === "gcs-66499-41")).toMatchObject({
      official_url: OFFICIAL_URL,
      source_type: "statute",
      may_change_source_ids: [],
    });
  });
});

/* ======================================================================== */

describe("2. The captured (a)(9) text", () => {
  it("pins every paragraph of (a)(9), in order, after the section heading and before (10)", () => {
    const heading = paragraphs.indexOf("66499.41.");
    expect(heading).toBeGreaterThanOrEqual(0);
    expect(paragraphs.filter((paragraph) => paragraph === "66499.41.")).toHaveLength(1);
    const start = paragraphs.indexOf(A9_PARAGRAPHS[0]);
    expect(start).toBeGreaterThan(heading);
    const end = paragraphs.findIndex((paragraph, index) => index > start && paragraph.startsWith("(10) "));
    expect(paragraphs.slice(start, end)).toEqual([...A9_PARAGRAPHS]);
  });

  it("states (a)(9) itself rather than cross-referencing another section for its categories", () => {
    const lettered = A9_PARAGRAPHS.filter((paragraph) => /^\([A-J]\) /.test(paragraph)).map((paragraph) => paragraph.slice(0, 3));
    expect(lettered).toEqual(["(A)", "(B)", "(C)", "(D)", "(E)", "(F)", "(G)", "(H)", "(I)", "(J)"]);
  });

  it("puts a condition on (D)-(G) only; (A), (B), (C), (H), (I), and (J) carry none", () => {
    const subparagraph = (letter: string) => {
      const index = A9_PARAGRAPHS.findIndex((paragraph) => paragraph.startsWith(`(${letter}) `));
      const next = A9_PARAGRAPHS.findIndex((paragraph, at) => at > index && /^\([A-J]\) /.test(paragraph));
      return A9_PARAGRAPHS.slice(index, next < 0 ? undefined : next).join(" ");
    };
    for (const letter of ["A", "B", "C", "H", "I", "J"]) {
      expect(subparagraph(letter), letter).not.toMatch(/\bunless\b|may be located/);
    }
    for (const letter of ["D", "E", "G"]) expect(subparagraph(letter), letter).toMatch(/\bunless\b/);
    expect(subparagraph("F")).toContain("may be located on a site described in this subparagraph if either of the following is met:");
  });

  it("reaches a High zone only through maps adopted pursuant to PRC Section 4202 (criterion d)", () => {
    const fire = A9_PARAGRAPHS[3];
    const [section51178Route, section4202Route] = fire.split(", or within ");
    expect(section51178Route).toBe(
      "(C) Within a very high fire hazard severity zone, as determined by the Department of Forestry and Fire Protection pursuant to Section 51178",
    );
    expect(section51178Route).not.toMatch(/\bhigh or\b/);
    expect(section4202Route).toBe(
      "a high or very high fire hazard severity zone as indicated on maps adopted by the Department of Forestry and Fire Protection pursuant to Section 4202 of the Public Resources Code.",
    );
    expect(fire).not.toMatch(/responsibility area/);
  });

  it("prints the history note the operative status rests on, and no other status", () => {
    expect(paragraphs.at(-1)?.endsWith(HISTORY_NOTE)).toBe(true);
    expect(statuteExtracted.match(/Effective /g)).toHaveLength(1);
  });
});

/* ======================================================================== */

describe("3. A capture, not an authority", () => {
  it("can never support a criterion rule", () => {
    expect(canSupportCriterionRule(metadata)).toBe(false);
  });

  it("can never back an authority source", async () => {
    const registration: Pick<ReviewedAuthoritySource, "record_kind" | "edition" | "capture" | "fact_keys"> = {
      record_kind: "agency_hazard_map",
      edition: { label: "Hypothetical registration of the statute capture", date: "2025-06-30", date_kind: "effective" },
      capture: { source_id: metadata.source_id, sha256_extracted: metadata.sha256_extracted },
      fact_keys: ["very-high-fire-hazard-severity-zone"],
    };
    expect(await authoritySourceCaptureIssues(registration, { metadata, extracted: statuteExtracted })).toEqual([
      "A statute capture cannot back an authority source.",
    ]);
  });

  // Updated in Phase 3D, which registered only the CAL FIRE SRA package: the statute is still no authority.
  it("registers no issuer, authority source, fact-policy entry, or host exception for the statute", () => {
    expect(programAuthorityRegistries.issuers.map((issuer) => issuer.issuer_id)).toEqual(["calfire-osfm"]);
    expect(programAuthorityRegistries.sources.map((source) => source.authority_source_id)).toEqual(["calfire-sra-fhsz-2023-09-29"]);
    for (const [key, policy] of Object.entries(programAuthorityRegistries.fact_policies)) {
      const phase3d = key === "very-high-fire-hazard-severity-zone" || key === "high-fire-hazard-severity-zone";
      expect(policy?.establishing.length, key).toBe(phase3d ? 1 : 0);
    }
    expect(sourceHostExceptions.map((exception) => exception.source_id)).not.toContain("gcs-66499-41");
    expect(JSON.stringify(programAuthorityRegistries)).not.toContain("gcs-66499-41");
  });

  it("is cited by no criterion, verification record, proposal, or Round 1 record", () => {
    expect(JSON.stringify(shippedCriteria)).not.toContain("gcs-66499-41");
    // Updated in Phase 3E: d's human record rests on the SHRA memo capture, never on the statute.
    const records = shippedCriteria.filter((criterion) => criterion.human_verification !== null);
    expect(records.map((criterion) => criterion.id)).toEqual(["la_shra.high-fire-hazard-severity-zone"]);
    expect(records[0].human_verification?.source_capture.repo_path).toBe("app/fixtures/program-screen/official-sources/shra-2025-10-28/extracted.txt");
    const proposals = import.meta.glob("../fixtures/program-screen/proposed-verifications/*.json", { import: "default", eager: true });
    expect(JSON.stringify(proposals)).not.toContain("gcs-66499-41");
    expect(JSON.stringify(decisionsJson)).not.toContain("gcs-66499-41");
    expect(JSON.stringify(roundJson)).not.toContain("gcs-66499-41");
  });
});

/* ======================================================================== */

describe("4. The Round 1 re-review trigger fires for c-g only", () => {
  it("flags exactly c, d, e, f, and g over the shipped captures", () => {
    expect(statuteRereviewWarnings(officialMetadata as OfficialSourceMetadata[], [decisions])).toEqual([
      {
        kind: "statute_rereview_warning",
        trigger: "gcs_66499_41_a_9_captured",
        statute_source_id: "gcs-66499-41",
        operative_status: "operative",
        criterion_ids: C_TO_G,
        action: "human_re_review",
      },
    ]);
  });

  it("does not add the restricted-category or other (a)(9) criteria (B8)", () => {
    const [warning] = statuteRereviewWarnings([metadata], [decisions]);
    for (const id of [
      "la_shra.hazardous-waste-site",
      "la_shra.special-flood-hazard-area",
      "la_shra.regulatory-floodway",
      "la_shra.earthquake-fault-zone",
      "la_shra.wetlands",
      "la_shra.protected-species-habitat",
    ]) {
      expect(shippedCriteria.some((criterion) => criterion.id === id), id).toBe(true);
      expect(warning.criterion_ids, id).not.toContain(id);
    }
  });
});

/* ======================================================================== */

describe("5. Invariants: nothing promoted, output unchanged", () => {
  // The same pins as the Round 1, Phase 2, and Phase 2b tests.
  // Phase 3C moved these pins for the three reviewed client-label changes only
  // (c, d, g; docs/PROGRAM_SCREEN_PHASE_3C_PROMOTION_GATES.md). Every status,
  // roll-up, and release decision is unchanged.
  // Updated in Phase 3E: the reviewed promotion of d moved them.
  const EVALUATOR_OUTPUT_SHA256 = "156dd1f41964ab5beebcf3882e0a0d653cc5d778939033bf2b752dba1e86afbc";
  const PUBLIC_DEMO_OUTPUT_SHA256 = "4dd2735bab875ad40b123fec72020e16442737bc6b5052eb55c5fba374b9a8a5";

  // Updated in Phase 3E: d alone is human-verified.
  it("keeps human_verified at 1 (d) and pending_human at 45", () => {
    expect(shippedCriteria.filter((criterion) => criterion.verification === "human_verified").map((criterion) => criterion.id)).toEqual(["la_shra.high-fire-hazard-severity-zone"]);
    expect(shippedCriteria.filter((criterion) => criterion.verification === "pending_human")).toHaveLength(45);
  });

  // Updated in Phase 3E: every guarded criterion but d.
  it("leaves every guarded criterion but d blocked from promotion", () => {
    const guarded = shippedCriteria.filter((criterion) => promotionGuardedCriterionIds.has(criterion.id));
    expect(guarded).toHaveLength(46);
    for (const criterion of guarded.filter((candidate) => candidate.id !== "la_shra.high-fire-hazard-severity-zone")) {
      expect(authorityPromotionBlockers(criterion, programAuthorityRegistries, false).length, criterion.id).toBeGreaterThan(0);
    }
  });

  it("keeps the evaluator and public-demo output byte-identical", async () => {
    const result = evaluateProgramScreen({ evidence_records: fixtureJson.evidence_records, as_of: fixtureJson.as_of });
    const demo = buildProgramScreenPublicDemoPayload(fixtureJson, { as_of: fixtureJson.as_of });
    expect(await sha256Hex(JSON.stringify(result))).toBe(EVALUATOR_OUTPUT_SHA256);
    expect(await sha256Hex(JSON.stringify(demo))).toBe(PUBLIC_DEMO_OUTPUT_SHA256);
  });
});

/* ======================================================================== */

describe("6. Re-review memo", () => {
  it("records the capture pins and the c-g verdicts", () => {
    for (const text of [OFFICIAL_URL, SHA256_ORIGINAL, SHA256_EXTRACTED, "2026-09-28T21:46:59Z", HISTORY_NOTE]) {
      expect(reviewDoc).toContain(text);
    }
    for (const row of [
      "| c | `la_shra.very-high-fire-hazard-severity-zone` | approve_with_revision | ROUND 1 REVISION NEEDED |",
      "| d | `la_shra.high-fire-hazard-severity-zone` | approve_with_revision | ROUND 1 REVISION NEEDED |",
      "| e | `la_shra.prime-or-statewide-farmland` | keep_pending | INSUFFICIENT / OTHER SOURCE STILL NEEDED |",
      "| f | `la_shra.natural-community-conservation-plan-land` | approve_with_revision | CLARIFIED |",
      "| g | `la_shra.conservation-easement` | approve_with_revision | UNCHANGED |",
    ]) {
      expect(reviewDoc).toContain(row);
    }
  });

  it("quotes (a)(9) exactly as captured", () => {
    for (const paragraph of A9_PARAGRAPHS) expect(reviewDoc).toContain(paragraph);
  });
});
