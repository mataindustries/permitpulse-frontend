import { renderToStaticMarkup } from "react-dom/server";
import {
  decodePDFRawStream,
  PDFArray,
  PDFDocument,
  PDFRawStream,
  StandardFonts,
  type PDFPage,
} from "pdf-lib";
import { describe, expect, it } from "vitest";
import { buildPacketModel } from "../src/shared/packet/build-packet-model";
import {
  renderPacketHtml,
  renderPacketHtmlPresentation,
} from "../src/shared/packet/render-packet-html";
import {
  assertCanonicalPacketPresentation,
  buildPacketPresentation,
  packetPresentationSectionIds,
} from "../src/shared/packet/presentation";
import {
  packetDashboard,
  packetRendererVersion,
} from "../src/shared/packet/presentation-summary";
import {
  renderPacketPdf,
  renderPacketPdfPresentation,
  packetPdfParagraphLineTake,
  packetPdfSectionStartReservation,
  packetPdfSubgroupStartReservation,
  packetSectionHeadingMetrics,
  safePacketPdfFilename,
  wrapPacketPdfText,
} from "../src/shared/packet/render-packet-pdf";
import {
  renderPacketText,
  renderPacketTextPresentation,
} from "../src/shared/packet/render-packet-text";
import type {
  BuildPacketModelInput,
  PacketActivityDto,
  PacketCaseDto,
  PacketEvidenceDto,
  PacketTimelineDto,
} from "../src/shared/packet/types";
import {
  packetSectionDefinitions,
  packetSectionOrder,
} from "../src/shared/packet/types";
import {
  arroyoVistaDemoPermitNumber,
  arroyoVistaDemoReviewerLabel,
} from "../src/shared/demo/arroyo-vista-demo";
import { PacketDocument } from "../src/shared/packet/PacketDocument";
import {
  PacketPreview,
} from "../src/client/components/PacketPreview";
import type { CaseDto } from "../src/client/types/cases";

const caseRecord: PacketCaseDto = {
  project_name: "Fictional Oak Street ADU",
  client_name: "Fictional Client",
  address: "42 Oak Street",
  city: "Exampleville",
  jurisdiction: "Exampleville Building",
  permit_number: "EX-2026-001",
  current_status: "researching",
  version: 3,
  created_at: "2026-01-01T00:00:00.000Z",
  updated_at: "2026-01-02T00:00:00.000Z",
};

const evidenceBase: PacketEvidenceDto = {
  id: "evidence-1",
  evidence_type: "document",
  title: "Fictional plan check notice",
  summary: "Fictional notice from the permit portal.",
  source_url: "https://example.test/notices/plan-check",
  source_label: "Example portal",
  source_date: "2026-01-15",
  verification_status: "unverified",
  created_at: "2026-01-15T00:00:00.000Z",
  updated_at: "2026-01-16T00:00:00.000Z",
};

const timelineBase: PacketTimelineDto = {
  id: "timeline-1",
  occurred_on: "2026-01-20",
  timeline_type: "submission",
  title: "Fictional application submitted",
  details: "The fictional application was submitted for review.",
  is_canonical: true,
  evidence_ids: [evidenceBase.id],
  created_at: "2026-01-20T00:00:00.000Z",
  updated_at: "2026-01-21T00:00:00.000Z",
};

const activityBase: PacketActivityDto = {
  id: "activity-1",
  action: "case_status_changed",
  changed_fields: ["current_status", "actor_user_id"],
  from_status: "intake",
  to_status: "researching",
  actor: { name: "Avery Example" },
  created_at: "2026-01-22T00:00:00.000Z",
};

const previewCaseRecord: CaseDto = {
  id: "case-1",
  ...caseRecord,
};

function completeInput(
  overrides: Partial<BuildPacketModelInput> = {},
): BuildPacketModelInput {
  return {
    activityResponse: { activity: [activityBase] },
    caseRecord,
    evidence: [evidenceBase],
    generatedAt: "2026-02-03T04:05:06.000Z",
    timeline: [timelineBase],
    ...overrides,
  };
}

function approvedActionKit(
  overrides: Partial<
    NonNullable<
      NonNullable<BuildPacketModelInput["editorialContent"]>["actionKit"]
    >
  > = {},
): NonNullable<
  NonNullable<BuildPacketModelInput["editorialContent"]>["actionKit"]
> {
  return {
    current_position: "The record confirms receipt; agency routing remains open.",
    confirmed_record: "The portal confirms application receipt.",
    unconfirmed_record: "The structural reviewer assignment is not confirmed.",
    primary_blocker: "Structural reviewer assignment",
    why_appropriate: "A direct agency status request is the next supported step.",
    evidence_readiness: "All cited evidence has complete provenance.",
    review_readiness: "The packet is complete; agency resolution remains open.",
    email_subject: "Permit routing follow-up",
    recipient_role: "Agency plan review contact",
    message_body: "Please confirm the current structural review assignment.",
    call_checklist: ["Identify the permit record."],
    requested_confirmations: ["Current structural review assignment"],
    documents_ready: ["Plan check notice"],
    escalation_trigger: "Escalate after conflicting agency direction.",
    follow_up_date: null,
    evidence_ids: [evidenceBase.id],
    timeline_ids: [timelineBase.id],
    approved: true,
    ...overrides,
  };
}

function decodedPageOperators(page: PDFPage): string {
  const contents = page.node.Contents();
  const resolved = page.node.context.lookup(contents);
  const entries = resolved instanceof PDFArray ? resolved.asArray() : [contents];

  return entries.map((entry) => {
    const stream = page.node.context.lookup(entry) as PDFRawStream;
    return new TextDecoder().decode(decodePDFRawStream(stream).decode());
  }).join("\n");
}

function pdfHex(value: string): string {
  return Buffer.from(value, "latin1").toString("hex").toUpperCase();
}

async function sha256(value: string | Uint8Array): Promise<string> {
  const bytes = typeof value === "string"
    ? new TextEncoder().encode(value)
    : Uint8Array.from(value);
  const digest = await globalThis.crypto.subtle.digest("SHA-256", bytes);
  return Buffer.from(digest).toString("hex");
}

function decodedPdfText(page: PDFPage): string[] {
  return [...decodedPageOperators(page).matchAll(/<([0-9A-F]+)> Tj/g)].map(
    (match) => Buffer.from(match[1] ?? "", "hex").toString("latin1"),
  );
}

function pdfTextYCoordinates(page: PDFPage): number[] {
  return [
    ...decodedPageOperators(page).matchAll(
      /1 0 0 1 -?\d+(?:\.\d+)? (-?\d+(?:\.\d+)?) Tm/g,
    ),
  ].map((match) => Number(match[1]));
}

function pdfTextPlacements(page: PDFPage): { text: string; y: number }[] {
  return [
    ...decodedPageOperators(page).matchAll(
      /1 0 0 1 -?\d+(?:\.\d+)? (-?\d+(?:\.\d+)?) Tm\s*<([0-9A-F]+)> Tj/g,
    ),
  ].map((match) => ({
    text: Buffer.from(match[2] ?? "", "hex").toString("latin1"),
    y: Number(match[1]),
  }));
}

function isPacketPdfChromeText(value: string, canonicalFooter: string): boolean {
  return value === "PERMITPULSE" ||
    value === "PERMIT INTELLIGENCE" ||
    value === "PermitPulse / Confirm source records before reliance" ||
    value === canonicalFooter ||
    /^Page \d+ of \d+$/.test(value);
}

function markupSectionIds(value: string): string[] {
  return [...value.matchAll(/data-packet-section="([^"]+)"/g)].map(
    (match) => match[1] ?? "",
  );
}

describe("canonical packet presentation architecture", () => {
  it("pins deterministic HTML and PDF adapter output to a versioned golden", async () => {
    const model = buildPacketModel(completeInput());
    const [htmlHash, pdfHash] = await Promise.all([
      sha256(renderPacketHtml(model)),
      renderPacketPdf(model).then(sha256),
    ]);

    expect({
      html_sha256: htmlHash,
      pdf_sha256: pdfHash,
      presentation_version: model.presentation_version,
      renderer_version: packetRendererVersion,
    }).toMatchInlineSnapshot(`
      {
        "html_sha256": "e7b3bae389dc95f062a7d01d82b5fb90c4b2d54cb981024982fa56ab3077c346",
        "pdf_sha256": "75b5f3e5871863afd82c3dc5c853cf27856a577fff429f0690ee3bb3e57332e1",
        "presentation_version": 3,
        "renderer_version": 4,
      }
    `);
  });

  it("defines every section once in the required order with no duplicates or unreachable nodes", () => {
    const presentation = buildPacketPresentation(
      buildPacketModel(completeInput()),
    );
    const ids = packetPresentationSectionIds(presentation);

    expect(ids).toEqual(packetSectionOrder);
    expect(ids).toEqual(packetSectionDefinitions.map(({ id }) => id));
    expect(new Set(ids).size).toBe(ids.length);
    expect(presentation.sections.every((section) => section.blocks.length > 0)).toBe(true);
    expect(ids).toMatchInlineSnapshot(`
      [
        "cover",
        "executive_summary",
        "case_snapshot",
        "findings",
        "agency_dependency_map",
        "open_questions",
        "recommended_next_actions",
        "agency_follow_up_kit",
        "timeline",
        "supporting_evidence",
        "supporting_sources",
        "methodology_readiness",
        "fictional_demonstration_disclosure",
      ]
    `);
  });

  it("renders the identical canonical section sequence in Preview and HTML", () => {
    const presentation = buildPacketPresentation(
      buildPacketModel(completeInput()),
    );
    const preview = renderToStaticMarkup(
      <PacketDocument presentation={presentation} />,
    );
    const html = renderPacketHtmlPresentation(presentation);

    expect(markupSectionIds(preview)).toEqual(packetSectionOrder);
    expect(markupSectionIds(html)).toEqual(markupSectionIds(preview));
    expect(markupSectionIds(html)).toMatchInlineSnapshot(`
      [
        "cover",
        "executive_summary",
        "case_snapshot",
        "findings",
        "agency_dependency_map",
        "open_questions",
        "recommended_next_actions",
        "agency_follow_up_kit",
        "timeline",
        "supporting_evidence",
        "supporting_sources",
        "methodology_readiness",
        "fictional_demonstration_disclosure",
      ]
    `);
  });

  it("renders every Preview section in the PDF in the same order from the canonical presentation", async () => {
    const presentation = buildPacketPresentation(
      buildPacketModel(completeInput()),
    );
    const pdf = await PDFDocument.load(
      await renderPacketPdfPresentation(presentation),
    );
    const operators = pdf.getPages().map(decodedPageOperators).join("\n");
    const positions = packetSectionDefinitions.map(({ id, title }) => ({
      id,
      position: operators.indexOf(pdfHex(id === "cover" ? "COVER" : title)),
    }));

    expect(positions.every(({ position }) => position >= 0)).toBe(true);
    expect(positions.every((item, index) => index === 0 || item.position > (positions[index - 1]?.position ?? -1))).toBe(true);
    expect(positions.map(({ id }) => id)).toEqual(packetSectionOrder);
    expect(positions.map(({ id }) => id)).toMatchInlineSnapshot(`
      [
        "cover",
        "executive_summary",
        "case_snapshot",
        "findings",
        "agency_dependency_map",
        "open_questions",
        "recommended_next_actions",
        "agency_follow_up_kit",
        "timeline",
        "supporting_evidence",
        "supporting_sources",
        "methodology_readiness",
        "fictional_demonstration_disclosure",
      ]
    `);
  });

  it("keeps all adapters on the canonical graph and emits no legacy section paths", () => {
    const presentation = buildPacketPresentation(
      buildPacketModel(completeInput()),
    );
    const html = renderPacketHtmlPresentation(presentation);
    const text = renderPacketTextPresentation(presentation);

    for (const staleId of [
      "case_overview",
      "evidence_matrix",
      "permit_timeline",
      "evidence_register",
      "disclaimer",
    ]) {
      expect(html).not.toContain(`data-packet-section="${staleId}"`);
    }
    expect(text).not.toMatch(/^(Case Overview|Evidence Matrix|Permit Timeline|Evidence Register|Disclaimer)$/m);
  });

  it("renders the text adapter in the same canonical section order", () => {
    const presentation = buildPacketPresentation(
      buildPacketModel(completeInput()),
    );
    const text = renderPacketTextPresentation(presentation);
    const positions = presentation.sections.map((section) =>
      text.indexOf(`${section.title}\n${"-".repeat(section.title.length)}`),
    );

    expect(positions.every((position) => position >= 0)).toBe(true);
    expect(
      positions.every(
        (position, index) => index === 0 || position > (positions[index - 1] ?? -1),
      ),
    ).toBe(true);
  });

  it("renders the canonical footer visibly in Preview, HTML, text, and PDF", async () => {
    const presentation = buildPacketPresentation(
      buildPacketModel(completeInput()),
    );
    const preview = renderToStaticMarkup(
      <PacketDocument presentation={presentation} />,
    );
    const html = renderPacketHtmlPresentation(presentation);
    const text = renderPacketTextPresentation(presentation);
    const pdf = await PDFDocument.load(
      await renderPacketPdfPresentation(presentation),
    );
    const pdfOperators = pdf.getPages().map(decodedPageOperators).join("\n");

    expect(preview).toContain(presentation.footer);
    expect(html).toContain(presentation.footer);
    expect(text).toContain(presentation.footer);
    expect(pdfOperators).toContain(pdfHex(presentation.footer));
  });

  it("fails deterministically for duplicate, omitted, or unsupported graph nodes", async () => {
    const presentation = buildPacketPresentation(
      buildPacketModel(completeInput()),
    );
    const duplicate = structuredClone(presentation);
    duplicate.sections.push(structuredClone(duplicate.sections[0]!));
    const omitted = structuredClone(presentation);
    omitted.sections.splice(4, 1);
    const unsupported = structuredClone(presentation);
    unsupported.sections[0]!.blocks[0] = {
      kind: "legacy_packet_block",
    } as never;

    expect(() => assertCanonicalPacketPresentation(duplicate)).toThrow(
      /duplicate section ID/,
    );
    expect(() => renderPacketHtmlPresentation(omitted)).toThrow(
      /missing, unknown, or out-of-order section/,
    );
    expect(() => renderPacketTextPresentation(unsupported)).toThrow(
      /unsupported block kind/,
    );
    await expect(renderPacketPdfPresentation(omitted)).rejects.toThrow(
      /missing, unknown, or out-of-order section/,
    );
  });

  it("omits the fictional disclosure for real cases without numbering gaps", async () => {
    const realCase = {
      ...caseRecord,
      project_name: "Oak Street ADU",
      client_name: "Morgan Lee",
      permit_number: "AV-2026-001",
    };
    const realEvidence = {
      ...evidenceBase,
      title: "Plan check notice",
      summary: "The permit portal records a plan check notice.",
      source_url: "https://permits.example.gov/notices/plan-check",
      source_label: "Permit portal",
    };
    const realTimeline = {
      ...timelineBase,
      title: "Application submitted",
      details: "The application was submitted for review.",
      evidence_ids: [realEvidence.id],
    };
    const model = buildPacketModel(completeInput({
      caseRecord: realCase,
      evidence: [realEvidence],
      timeline: [realTimeline],
    }));
    const presentation = buildPacketPresentation(model);
    const expectedIds = packetSectionOrder.filter(
      (id) => id !== "fictional_demonstration_disclosure",
    );
    const html = renderPacketHtmlPresentation(presentation);
    const text = renderPacketTextPresentation(presentation);
    const pdf = await PDFDocument.load(
      await renderPacketPdfPresentation(presentation),
    );
    const pdfOperators = pdf.getPages().map(decodedPageOperators).join("\n");

    expect(packetPresentationSectionIds(presentation)).toEqual(expectedIds);
    expect(presentation.sections.map(({ number }) => number)).toEqual(
      expectedIds.map((_, index) => String(index + 1).padStart(2, "0")),
    );
    expect(html).not.toContain("Fictional Demonstration Disclosure");
    expect(text).not.toContain("Fictional Demonstration Disclosure");
    expect(pdfOperators).not.toContain(pdfHex("Fictional Demonstration Disclosure"));
  });

  it("does not infer a demo from ordinary demo-like words in a real case", () => {
    const model = buildPacketModel(completeInput({
      caseRecord: {
        ...caseRecord,
        project_name: "Civic Demo Garden at Fictional Lane",
        client_name: "Morgan Lee",
        permit_number: "DEMOLITION-2026-41",
      },
      evidence: [{
        ...evidenceBase,
        title: "Demolition permit record",
        summary: "The city record identifies the demolition work scope.",
        source_url: "https://permits.example.gov/records/DEMOLITION-2026-41",
        source_label: "City permit portal",
      }],
      timeline: [{
        ...timelineBase,
        title: "Permit application submitted",
        details: "The application was submitted for city review.",
      }],
    }));

    expect(model.demonstration_notice).toBeNull();
    expect(packetPresentationSectionIds(buildPacketPresentation(model))).not.toContain(
      "fictional_demonstration_disclosure",
    );
  });

  it("requires corroboration for a lone DEMO permit or project marker and preserves labels", () => {
    const realEvidence = {
      ...evidenceBase,
      title: "Correction notice",
      summary: "The city record identifies the current correction cycle.",
      source_url: "https://permits.example.gov/records/correction-notice",
      source_label: "City permit portal",
    };
    const realTimeline = {
      ...timelineBase,
      title: "Status update",
      details: "The application remains in city review.",
      evidence_ids: [realEvidence.id],
    };
    const permitMarkerOnly = buildPacketModel(completeInput({
      caseRecord: {
        ...caseRecord,
        project_name: "Oak Street ADU",
        client_name: "Morgan Lee",
        permit_number: "DEMO-123",
      },
      evidence: [realEvidence],
      timeline: [realTimeline],
    }));
    const projectMarkerOnly = buildPacketModel(completeInput({
      caseRecord: {
        ...caseRecord,
        project_name: "DEMO — Oak Street ADU",
        client_name: "Morgan Lee",
        permit_number: "AV-123",
      },
      evidence: [{ ...realEvidence, title: "Correction notice" }],
      timeline: [{ ...realTimeline, title: "Status update" }],
    }));
    const freeFormLabelOnly = buildPacketModel(completeInput({
      caseRecord: {
        ...caseRecord,
        project_name: "Oak Street ADU",
        client_name: "Morgan Lee",
        permit_number: "AV-123",
      },
      evidence: [{
        ...realEvidence,
        title: "DEMO — Correction notice",
      }],
      timeline: [realTimeline],
    }));

    expect(permitMarkerOnly.demonstration_notice).toBeNull();
    expect(permitMarkerOnly.case_summary.project_name).toBe("Oak Street ADU");
    expect(permitMarkerOnly.evidence_summaries[0]?.title).toBe("Correction notice");
    expect(permitMarkerOnly.timeline_summaries[0]?.title).toBe("Status update");
    expect(projectMarkerOnly.demonstration_notice).toBeNull();
    expect(projectMarkerOnly.case_summary.project_name).toBe(
      "DEMO — Oak Street ADU",
    );
    expect(freeFormLabelOnly.demonstration_notice).toBeNull();
    expect(freeFormLabelOnly.evidence_summaries[0]?.title).toBe(
      "DEMO — Correction notice",
    );
    for (const packet of [permitMarkerOnly, projectMarkerOnly, freeFormLabelOnly]) {
      expect(packetPresentationSectionIds(buildPacketPresentation(packet))).not.toContain(
        "fictional_demonstration_disclosure",
      );
    }
  });

  it("treats the canonical FICTIONAL permit token as an explicit demo marker", () => {
    const model = buildPacketModel(completeInput({
      caseRecord: {
        ...caseRecord,
        project_name: "Arroyo Vista ADU Resubmittal",
        client_name: "Northline Residential Studio",
        permit_number: "LADBS-FICTIONAL-2026-1842",
      },
      evidence: [{
        ...evidenceBase,
        title: "Permit portal status capture",
        summary: "The portal records the current correction status.",
        source_url: "https://workspace.getpermitpulse.com/records/permits/arroyo-vista",
        source_label: "LADBS permit portal record",
      }],
      timeline: [{
        ...timelineBase,
        title: "Initial plans submitted",
        details: "The application entered agency review.",
      }],
    }));

    expect(model.demonstration_notice).toBe(
      "Fictional case disclosure — all names, records, dates, and agency activity in this packet are illustrative.",
    );
    expect(packetPresentationSectionIds(buildPacketPresentation(model))).toContain(
      "fictional_demonstration_disclosure",
    );
  });
});

describe("packet model builder", () => {
  it("uses role-based reviewer attribution only for the canonical Arroyo Vista demo", async () => {
    const canonicalDemo = buildPacketModel(completeInput({
      caseRecord: {
        ...caseRecord,
        project_name: "Arroyo Vista ADU Resubmittal",
        permit_number: arroyoVistaDemoPermitNumber,
      },
      editorialContent: {
        findings: [{
          id: "routing-risk",
          text: "Routing remains unconfirmed in the cited record.",
          title: "Routing confirmation",
          finding_type: "risk",
          recommended_resolution: "Confirm the assigned review queue.",
          supporting_source_ids: [evidenceBase.id],
          grounded: true,
          reviewer_approved: true,
        }],
      },
      evidence: [{
        ...evidenceBase,
        contributor: { id: "demo-contributor", name: "Sergio Mata" },
        source_label: "LADBS permit portal record",
      }],
    }));
    const presentation = buildPacketPresentation(canonicalDemo);
    const preview = renderToStaticMarkup(
      <PacketDocument presentation={presentation} />,
    );
    const html = renderPacketHtmlPresentation(presentation);
    const text = renderPacketTextPresentation(presentation);
    const pdf = await PDFDocument.load(
      await renderPacketPdfPresentation(presentation),
    );
    const operators = pdf.getPages().map(decodedPageOperators).join("\n");

    expect(JSON.stringify(canonicalDemo)).not.toContain("Sergio Mata");
    expect(canonicalDemo.evidence_summaries[0]).toMatchObject({
      contributor_label: arroyoVistaDemoReviewerLabel,
      source: { label: "LADBS permit portal record" },
    });
    for (const output of [preview, html, text]) {
      expect(output).toContain(arroyoVistaDemoReviewerLabel);
      expect(output).toContain("Reviewed by");
      expect(output).toContain("LADBS permit portal record");
      expect(output).not.toContain("Sergio Mata");
      expect(output).not.toContain("DOWN /");
    }
    expect(operators).toContain(pdfHex(arroyoVistaDemoReviewerLabel));
    expect(operators).toContain(pdfHex("Reviewed by"));
    expect(operators).toContain(pdfHex("LADBS permit portal record"));
    expect(operators).not.toContain(pdfHex("Sergio Mata"));
    expect(operators).not.toContain(pdfHex("DOWN /"));

    const dependencyLabels = [
      "Blocking issue",
      "Dependent review",
      "Recommended next step",
      "Supported by",
    ];
    for (const label of dependencyLabels) {
      expect(preview).toContain(label);
      expect(html).toContain(label);
      expect(text).toContain(label);
      expect(operators).toContain(pdfHex(label.toUpperCase()));
    }
    expect(markupSectionIds(preview)).toEqual(packetSectionOrder);
    expect(markupSectionIds(html)).toEqual(packetSectionOrder);
    for (const { title } of packetSectionDefinitions) {
      expect(text).toContain(title);
      expect(operators).toContain(pdfHex(title === "Cover" ? "COVER" : title));
    }

    const realCase = buildPacketModel(completeInput({
      caseRecord: {
        ...caseRecord,
        project_name: "Oak Street ADU",
        permit_number: "REAL-2026-001",
      },
      evidence: [{
        ...evidenceBase,
        contributor: { id: "real-contributor", name: "Case Contributor" },
      }],
    }));
    const realText = renderPacketText(realCase);
    expect(realCase.evidence_summaries[0]?.contributor_label).toBe("Case Contributor");
    expect(realText).toContain("Contributor: Case Contributor");
    expect(realText).not.toContain(arroyoVistaDemoReviewerLabel);
    expect(realText).not.toContain("Reviewed by: Case Contributor");
  });

  it("keeps source-detail readiness wording and evidence counts identical across UI, HTML, text, and PDF", async () => {
    const evidence = Array.from({ length: 9 }, (_, index) => ({
      ...evidenceBase,
      id: `evidence-${index + 1}`,
      verification_status: "verified" as const,
      source_label: index < 6 ? "Example portal" : null,
      source_url: index < 6 ? `https://example.test/evidence/${index + 1}` : null,
      source_date: index < 6 ? "2026-01-15" : null,
    }));
    const model = buildPacketModel(completeInput({ evidence }));
    const dashboard = packetDashboard(model);
    const html = renderPacketHtml(model);
    const packetText = renderPacketText(model);
    const ui = renderToStaticMarkup(
      <PacketDocument presentation={buildPacketPresentation(model)} />,
    );
    const pdf = await PDFDocument.load(await renderPacketPdf(model));
    const pdfOperators = pdf.getPages().map(decodedPageOperators).join("\n");

    expect(dashboard).toMatchObject({
      permit_status: "Source details incomplete",
      blockers: [{ title: "3 verified evidence records need source details" }],
      recommended_action: { title: "Complete source details" },
      evidence: { total: 9, verified: 9, unverified: 0, provenance_issues: 3 },
    });
    for (const output of [ui, html, packetText]) {
      expect(output).toContain("Complete source details");
      expect(output).toContain("3 verified evidence records need source details");
      expect(output).not.toContain("Verify evidence");
    }
    expect(pdfOperators).toContain(pdfHex("Complete source details"));
    expect(pdfOperators).toContain(pdfHex("3 verified evidence records need source details"));
    expect(pdfOperators).not.toContain(pdfHex("Verify evidence"));
    expect(model.readiness?.counts.evidence).toMatchObject({
      total: dashboard.evidence.total,
      verified: dashboard.evidence.verified,
      unverified: dashboard.evidence.unverified,
      provenanceIssues: dashboard.evidence.provenance_issues,
    });
  });

  it("generates a deterministic model from complete safe DTO data", () => {
    const model = buildPacketModel(completeInput());

    expect(model).toMatchObject({
      presentation_version: 3,
      title: "Permit Review Packet",
      generated_at: "2026-02-03T04:05:06.000Z",
      generated_at_label: "February 3, 2026 at 4:05 AM",
      document_status_label: "DRAFT",
      jurisdiction: "Exampleville Building",
      permit_number: "EX-2026-001",
      current_status: { value: "researching", label: "Researching" },
      case_summary: {
        project_name: "Fictional Oak Street ADU",
        client_name: "Fictional Client",
        version: 3,
      },
    });
    expect(model.evidence_summaries).toHaveLength(1);
    expect(model.timeline_summaries).toHaveLength(1);
    expect(model.recent_activity_summaries).toHaveLength(1);
    expect(JSON.stringify(model)).not.toContain("actor_user_id");
  });

  it("handles missing evidence, timeline, and activity gracefully", () => {
    const model = buildPacketModel(
      completeInput({
        activityResponse: null,
        evidence: [],
        timeline: [],
      }),
    );

    expect(model.evidence_summaries).toEqual([]);
    expect(model.timeline_summaries).toEqual([]);
    expect(model.recent_activity_summaries).toEqual([]);
    expect(renderPacketText(model)).toContain(
      "No evidence records are included in this packet.",
    );
    expect(renderPacketText(model)).toContain(
      "No timeline events are included in this packet.",
    );
    expect(renderPacketText(model)).not.toContain("Recent case activity");
  });

  it("labels unverified, verified, and disputed evidence", () => {
    const model = buildPacketModel(
      completeInput({
        evidence: [
          evidenceBase,
          {
            ...evidenceBase,
            id: "evidence-2",
            verification_status: "verified",
            source_date: "2026-01-16",
          },
          {
            ...evidenceBase,
            id: "evidence-3",
            verification_status: "disputed",
            source_date: "2026-01-17",
          },
        ],
      }),
    );

    expect(model.evidence_summaries.map((item) => item.verification_label)).toEqual([
      "Disputed",
      "Verified",
      "Unverified",
    ]);
    expect(model.evidence_summaries.map((item) => item.verification_note)).toEqual([
      "This information is disputed and is not presented as confirmed.",
      "Source review is recorded; the evidence supports only the statement summarized above.",
      "Source review is pending; this record is not presented as confirmed.",
    ]);
  });

  it("labels canonical and contributed timeline entries", () => {
    const model = buildPacketModel(
      completeInput({
        timeline: [
          timelineBase,
          {
            ...timelineBase,
            id: "timeline-2",
            occurred_on: "2026-01-21",
            is_canonical: false,
          },
        ],
      }),
    );

    expect(model.timeline_summaries.map((entry) => entry.source_label)).toEqual([
      "Contributed",
      "Canonical",
    ]);
  });

  it("derives the executive dashboard from existing packet facts only", () => {
    const model = buildPacketModel(completeInput());
    const dashboard = packetDashboard(model);

    expect(dashboard).toMatchObject({
      permit_status: "Needs Verification",
      mission_health: { score: 67, label: "Needs attention" },
      readiness: { score: 80 },
      reviewer_status: "Packet review blocked — 1 open condition",
    });
    expect(dashboard.blockers).toContainEqual(
      expect.objectContaining({ id: "unready-evidence" }),
    );
    expect(dashboard.evidence).toMatchObject({
      total: 1,
      verified: 0,
      unverified: 1,
      disputed: 0,
      linked_timeline: 1,
      provenance_issues: 0,
    });
    expect(dashboard.factors).toHaveLength(5);
    expect(dashboard.factors.find((factor) => factor.id === "evidence-ready")).toMatchObject({ passed: false, blocking: true });
    expect(model.readiness?.counts.evidence).toMatchObject({
      total: dashboard.evidence.total,
      verified: dashboard.evidence.verified,
      unverified: dashboard.evidence.unverified,
      disputed: dashboard.evidence.disputed,
      provenanceIssues: dashboard.evidence.provenance_issues,
    });
  });

  it("keeps packet readiness separate from unresolved jurisdiction risks", () => {
    const model = buildPacketModel(completeInput({
      caseRecord: { ...caseRecord, current_status: "ready_for_review" },
      evidence: [{ ...evidenceBase, verification_status: "verified" }],
      editorialContent: {
        findings: [{
          id: "risk-1",
          text: "Reviewer assignment remains unconfirmed.",
          title: "Reviewer assignment",
          finding_type: "risk",
          supporting_source_ids: [evidenceBase.id],
          grounded: true,
          reviewer_approved: true,
        }],
      },
    }));
    const dashboard = packetDashboard(model);
    const text = renderPacketText(model);

    expect(dashboard.readiness).toMatchObject({ score: 100, completed: 5, total: 5 });
    expect(dashboard.blockers).toEqual([]);
    expect(dashboard.reviewer_status).toBe("Packet ready; jurisdiction risks remain open");
    expect(model.executive_summary.key_risks).toEqual(["Reviewer assignment"]);
    expect(text).toContain("No packet-readiness conditions remain");
    expect(text).toContain("Jurisdiction resolution is not established by Packet Readiness.");
    expect(text).toContain("This packet is complete. The permit case still contains unresolved agency questions.");
    expect(text).not.toContain("No primary blockers");
  });

  it("builds the follow-up kit and dependency map only from approved grounded findings", () => {
    const model = buildPacketModel(completeInput({
      editorialContent: {
        findings: [{
          id: "finding-1",
          text: "Structural review routing is not confirmed in the cited notice.",
          title: "Structural routing",
          severity: "high",
          finding_type: "risk",
          confidence: "high",
          recommended_resolution: "Ask the agency to confirm the structural review queue.",
          supporting_source_ids: [evidenceBase.id],
          grounded: true,
          reviewer_approved: true,
        }],
      },
    }));

    expect(model.action_kit).toMatchObject({
      primary_blocker: "Structural routing",
      documents_ready: ["Fictional plan check notice"],
      citation_references: ["E01"],
    });
    expect(model.agency_dependencies).toEqual([expect.objectContaining({
      discipline: "Structural routing",
      blocking_issue: "Structural review routing is not confirmed in the cited notice.",
      recommended_next_step: "Ask the agency to confirm the structural review queue.",
      citation_references: ["E01"],
    })]);
    expect(renderPacketHtml(model)).toContain("Agency Dependency Map");
    expect(renderPacketText(model)).toContain("Recommended next contact");
  });

  it("consolidates demo labeling into one professional disclosure in every renderer", async () => {
    const model = buildPacketModel(completeInput({
      caseRecord: { ...caseRecord, project_name: "DEMO — Arroyo Vista", permit_number: "DEMO-123" },
      evidence: [{ ...evidenceBase, title: "DEMO — Portal record", source_url: "https://records.example/demo" }],
    }));

    expect(model.demonstration_notice).toBe("Fictional case disclosure — all names, records, dates, and agency activity in this packet are illustrative.");
    expect(model.case_summary.project_name).toBe("Arroyo Vista");
    expect(model.evidence_summaries[0]?.title).toBe("Portal record");
    const html = renderPacketHtml(model);
    const text = renderPacketText(model);
    const pdf = await PDFDocument.load(await renderPacketPdf(model));
    const pdfOperators = pdf.getPages().map(decodedPageOperators).join("\n");

    expect(text.match(/Fictional case disclosure/g)).toHaveLength(1);
    expect(html.match(/Fictional case disclosure/g)).toHaveLength(1);
    expect(
      pdfOperators.match(new RegExp(pdfHex("Fictional Demonstration Disclosure"), "g")),
    ).toHaveLength(1);
  });

  it("keeps both Action Kit readiness semantics in every presentation adapter", async () => {
    const model = buildPacketModel(completeInput({
      editorialContent: { actionKit: approvedActionKit() },
    }));
    const presentation = buildPacketPresentation(model);
    const executiveBlock = presentation.sections
      .find(({ id }) => id === "executive_summary")
      ?.blocks[0];
    const html = renderPacketHtmlPresentation(presentation);
    const text = renderPacketTextPresentation(presentation);
    const pdf = await PDFDocument.load(
      await renderPacketPdfPresentation(presentation),
    );
    const pdfOperators = pdf.getPages().map(decodedPageOperators).join("\n");

    expect(executiveBlock?.kind).toBe("executive_summary");
    if (executiveBlock?.kind !== "executive_summary") {
      throw new Error("Executive Summary block was not emitted");
    }
    expect(executiveBlock.decision_lines).toEqual(
      expect.arrayContaining([
        {
          label: "Packet evidence readiness",
          value: "All cited evidence has complete provenance.",
        },
        {
          label: "Jurisdiction position",
          value: "The packet is complete; agency resolution remains open.",
        },
      ]),
    );
    for (const output of [html, text]) {
      expect(output).toContain("Packet evidence readiness");
      expect(output).toContain("All cited evidence has complete provenance.");
      expect(output).toContain("Jurisdiction position");
      expect(output).toContain(
        "The packet is complete; agency resolution remains open.",
      );
    }
    expect(pdfOperators).toContain(pdfHex("PACKET EVIDENCE READINESS"));
    expect(pdfOperators).toContain(pdfHex("JURISDICTION POSITION"));
  });

  it("sorts evidence, timeline, and activity deterministically", () => {
    const model = buildPacketModel(
      completeInput({
        activityResponse: {
          activity: [
            { ...activityBase, id: "activity-a", created_at: "2026-01-22T00:00:00.000Z" },
            { ...activityBase, id: "activity-z", created_at: "2026-01-22T00:00:00.000Z" },
          ],
        },
        evidence: [
          { ...evidenceBase, id: "evidence-a", title: "Older evidence", source_date: "2026-01-14" },
          { ...evidenceBase, id: "evidence-z", title: "Newest evidence", source_date: "2026-01-16" },
        ],
        timeline: [
          { ...timelineBase, id: "timeline-a", title: "Older timeline", occurred_on: "2026-01-19" },
          { ...timelineBase, id: "timeline-z", title: "Newest timeline", occurred_on: "2026-01-21" },
        ],
      }),
    );

    expect(model.evidence_summaries.map((item) => item.title)).toEqual([
      "Newest evidence",
      "Older evidence",
    ]);
    expect(model.timeline_summaries.map((entry) => entry.title)).toEqual([
      "Newest timeline",
      "Older timeline",
    ]);
    expect(model.recent_activity_summaries).toHaveLength(2);
  });
});

describe("packet text renderer", () => {
  it("includes required sections and required packet safety notes", () => {
    const text = renderPacketText(buildPacketModel(completeInput()));

    for (const section of [
      "Cover",
      "Executive Summary",
      "Case Snapshot",
      "Findings",
      "Agency Dependency Map",
      "Open Questions",
      "Recommended Next Actions",
      "Agency Follow-Up Kit",
      "Timeline",
      "Supporting Evidence",
      "Supporting Sources",
      "Methodology / Readiness",
      "Fictional Demonstration Disclosure",
    ]) {
      expect(text.toLowerCase()).toContain(section.toLowerCase());
    }

    expect(text).toContain("Prepared for client review");
    expect(text).toContain("Investigation Health");
    expect(text).toContain("Packet Readiness: 4 of 5 checks complete");
    expect(text).toContain("Packet integrity / version");
    expect(text).toContain("Generated: February 3, 2026 at 4:05 AM");
    expect(text).not.toContain("2026-02-03T04:05:06.000Z");
    expect(text).toContain("Classification: Unverified");
    expect(text).toContain("Record classification: Canonical");
    expect(text).toContain("Provenance: https://example.test/notices/plan-check");
    expect(text).not.toContain("This placeholder is not AI-generated yet");
    expect(text).not.toContain("Recent case activity");
  });

  it("preserves literal stored text without interpreting it as markup", () => {
    const text = renderPacketText(
      buildPacketModel(
        completeInput({
          caseRecord: {
            ...caseRecord,
            project_name: "<script>alert(1)</script>",
          },
          evidence: [
            {
              ...evidenceBase,
              title: "<b>Unsafe evidence</b>",
              summary: "<img src=x onerror=alert(1)>",
            },
          ],
        }),
      ),
    );

    expect(text).toContain("<script>alert(1)</script>");
    expect(text).toContain("<b>Unsafe evidence</b>");
    expect(text).toContain("<img src=x onerror=alert(1)>");
    expect(text).not.toContain("&lt;script&gt;");
  });

  it("does not render auth, account, token, or internal fields", () => {
    const text = renderPacketText(
      buildPacketModel(
        completeInput({
          activityResponse: {
            activity: [
              {
                ...activityBase,
                changed_fields: [
                  "current_status",
                  "session_token",
                  "account_id",
                  "internal_note",
                ],
              },
            ],
          },
          caseRecord: {
            ...caseRecord,
            session_token: "not-allowed",
            account_id: "not-allowed",
          } as PacketCaseDto & Record<string, unknown>,
        }),
      ),
    ).toLowerCase();

    for (const forbidden of [
      "session_token",
      "account_id",
      "internal_note",
      "authorization",
      "password",
    ]) {
      expect(text).not.toContain(forbidden);
    }
  });
});

describe("packet HTML renderer", () => {
  it("escapes XSS-like strings and emits no script tags or inline handlers", () => {
    const html = renderPacketHtml(
      buildPacketModel(
        completeInput({
          caseRecord: {
            ...caseRecord,
            project_name: "<script>alert(1)</script>",
          },
          evidence: [
            {
              ...evidenceBase,
              title: "<b>Unsafe evidence</b>",
              summary: "<img src=x onerror=alert(1)>",
              source_url: "javascript:alert(1)",
            },
          ],
          timeline: [
            {
              ...timelineBase,
              title: "<script>timeline</script>",
              details: "<img src=x onload=alert(1)>",
            },
          ],
        }),
      ),
    );

    expect(html).toContain("&lt;script&gt;alert(1)&lt;/script&gt;");
    expect(html).toContain("&lt;img src=x onerror=alert(1)&gt;");
    expect(html).not.toMatch(/<script/i);
    expect(html).not.toMatch(/<[a-z][^>]*\son[a-z]+\s*=/i);
    expect(html).not.toContain('href="javascript:alert(1)"');
  });

  it("includes required semantic sections", () => {
    const html = renderPacketHtml(buildPacketModel(completeInput()));

    expect(html).toContain("<!doctype html>");
    expect(html).toContain("packet-canonical-document");
    for (const section of [
      "Cover",
      "Executive Summary",
      "Case Snapshot",
      "Findings",
      "Agency Dependency Map",
      "Open Questions",
      "Recommended Next Actions",
      "Agency Follow-Up Kit",
      "Timeline",
      "Supporting Evidence",
      "Supporting Sources",
      "Methodology / Readiness",
      "Fictional Demonstration Disclosure",
    ]) {
      expect(html).toContain(section);
    }
    expect(html).toContain("--packet-jade: #1c744d");
    expect(html).toContain("--packet-paper: #fbfaf7");
    expect(html).toContain("Investigation Health");
    expect(html).toContain("Packet integrity / version");
    expect(html).toContain("packet-client-records");
    expect(html).toContain("Reviewer note");
    expect(html).toContain("Review pending");
    expect(html).toContain("break-after: page");
    expect(html).toContain("break-inside: avoid");
    expect(html).not.toContain("Internal working draft");
  });
});

describe("packet PDF helpers", () => {
  it("avoids creating one-line paragraph fragments across pages", () => {
    expect(packetPdfParagraphLineTake(3, 2)).toBe(0);
    expect(packetPdfParagraphLineTake(4, 3)).toBe(2);
    expect(packetPdfParagraphLineTake(5, 4)).toBe(3);
    expect(packetPdfParagraphLineTake(1, 1)).toBe(1);
  });

  it("reserves meaningful content space after every section heading", () => {
    expect(packetPdfSectionStartReservation(58, 24)).toBe(172);
    expect(packetPdfSectionStartReservation(58, 0) - 58).toBeGreaterThanOrEqual(
      90,
    );
  });

  it("reserves the first row with a PDF subgroup heading", () => {
    expect(packetPdfSubgroupStartReservation(14, 47)).toBe(61);
    expect(packetPdfSubgroupStartReservation(13, 0)).toBe(13);
  });

  it("reserves explicit eyebrow spacing for one-line and wrapped section titles", async () => {
    const document = await PDFDocument.create();
    const serif = await document.embedFont(StandardFonts.TimesRomanBold);
    const oneLine = packetSectionHeadingMetrics("Evidence Register", serif);
    const wrapped = packetSectionHeadingMetrics("Recommended Next Actions for Agency Follow-Up", serif, 140);

    expect(oneLine).toMatchObject({ eyebrowHeight: 9, eyebrowTitleSpacing: 6, titleLines: 1, titleHeight: 21 });
    expect(wrapped.titleLines).toBeGreaterThan(1);
    expect(wrapped.titleHeight).toBe(wrapped.titleLines * 21);
    expect(wrapped.totalHeight - wrapped.titleHeight).toBe(oneLine.totalHeight - oneLine.titleHeight);
  });

  it("generates deterministic safe PDF filenames from packet and case data", () => {
    const model = buildPacketModel(
      completeInput({
        caseRecord: {
          ...caseRecord,
          project_name: "../Fictional Oak Street ADU <script>",
        },
      }),
    );

    expect(
      safePacketPdfFilename(model, "00000000-0000-4000-8000-000000000001"),
    ).toBe("permitpulse-fictional-oak-street-adu-script-packet-v3.pdf");
  });

  it("wraps long content and produces a branded multi-page Letter PDF", async () => {
    const longSummary = "Long source-backed evidence content ".repeat(80);
    const model = buildPacketModel(
      completeInput({
        evidence: Array.from({ length: 12 }, (_, index) => ({
          ...evidenceBase,
          id: `evidence-${index}`,
          title: `Long evidence record ${index + 1}`,
          summary: longSummary,
          source_url: index === 0
            ? `https://example.test/provenance/${"a".repeat(1_900)}`
            : `https://example.test/provenance/${index}`,
          source_date: `2026-01-${String(index + 1).padStart(2, "0")}`,
        })),
      }),
    );
    const bytes = await renderPacketPdf(model);
    const pdf = await PDFDocument.load(bytes);

    expect(pdf.getPageCount()).toBeGreaterThan(2);
    expect(pdf.getPages().every((page) => {
      const { width, height } = page.getSize();
      return width === 612 && height === 792;
    })).toBe(true);
    expect(pdf.getTitle()).toContain("Permit Review Packet");
    expect(pdf.getAuthor()).toBe("PermitPulse");
    const allPages = pdf.getPages().map(decodedPageOperators).join("\n");
    for (const label of [
      "COVER",
      "Executive Summary",
      "Case Snapshot",
      "Supporting Evidence",
      "Methodology / Readiness",
      "Investigation Health",
      "Packet Readiness",
      "PACKET-READINESS CONDITIONS",
      "RECOMMENDED NEXT ACTION",
      "EVIDENCE SUMMARY",
    ]) {
      expect(allPages).toContain(pdfHex(label));
    }
    expect(new TextDecoder("latin1").decode(bytes)).not.toContain(
      "2026-02-03T04:05:06.000Z",
    );
    const canonicalFooter = buildPacketPresentation(model).footer;
    expect(
      pdf.getPages().every((page) =>
        decodedPdfText(page).some(
          (value) => value && !isPacketPdfChromeText(value, canonicalFooter),
        ),
      ),
    ).toBe(true);
    expect(
      pdf.getPages().flatMap(pdfTextYCoordinates).every((y) => y >= 18 && y <= 759),
    ).toBe(true);
    const pageText = pdf.getPages().map((page) => decodedPdfText(page).join(" "));
    expect(
      pageText.find((value) => value.includes("PACKET READINESS CHECKS")),
    ).toContain("Permit identifier recorded");
    expect(pageText.find((value) => value.includes("PACKET METADATA"))).toContain(
      "Packet version: 3",
    );
  });

  it("keeps ordinary evidence, timeline, and follow-up blocks together", async () => {
    const model = buildPacketModel(completeInput({
      editorialContent: {
        findings: [{
          id: "risk-keep-together",
          text: "Structural routing remains unconfirmed.",
          title: "Structural routing",
          finding_type: "risk",
          recommended_resolution: "Ask the agency to confirm structural routing.",
          supporting_source_ids: [evidenceBase.id],
          grounded: true,
          reviewer_approved: true,
        }],
      },
    }));
    const pdf = await PDFDocument.load(await renderPacketPdf(model));
    const pageText = pdf.getPages().map((page) => decodedPdfText(page).join(" "));

    const evidencePage = pageText.find((value) => value.includes("EVIDENCE 01"));
    const timelinePage = pageText.find((value) => value.includes("EVENT 01"));
    const followUpPage = pageText.find((value) => value.includes("Permit record follow-up"));

    expect(evidencePage).toContain("REVIEWER NOTE");
    expect(timelinePage).toContain("SUPPORTING EVIDENCE");
    expect(followUpPage).toContain("Recommended contact");
  });

  it("keeps a 20-link timeline card clear of the following card", async () => {
    const evidence = Array.from({ length: 20 }, (_, index) => ({
      ...evidenceBase,
      id: `timeline-support-${String(index + 1).padStart(2, "0")}`,
      title: `Timeline support ${String(index + 1).padStart(2, "0")}`,
    }));
    const model = buildPacketModel(completeInput({
      evidence,
      timeline: [
        {
          ...timelineBase,
          id: "timeline-many-links",
          evidence_ids: evidence.map(({ id }) => id),
        },
        {
          ...timelineBase,
          id: "timeline-following-card",
          occurred_on: "2026-01-21",
          title: "Following timeline card",
          evidence_ids: [evidence[0]!.id],
        },
      ],
    }));
    const pdf = await PDFDocument.load(await renderPacketPdf(model));
    const placements = pdf.getPages().map(pdfTextPlacements);
    const firstPage = placements.findIndex((page) =>
      page.some(({ text }) => text.startsWith("EVENT 01 /")),
    );
    const followingPage = placements.findIndex((page) =>
      page.some(({ text }) => text.startsWith("EVENT 02 /")),
    );

    expect(firstPage).toBeGreaterThanOrEqual(0);
    expect(followingPage).toBe(firstPage);
    const page = placements[firstPage]!;
    const lastSupport = page.find(({ text }) =>
      text === "- Unverified / Timeline support 20",
    );
    const followingHeading = page.find(({ text }) => text.startsWith("EVENT 02 /"));

    expect(lastSupport).toBeDefined();
    expect(followingHeading).toBeDefined();
    expect(followingHeading!.y).toBeLessThanOrEqual(lastSupport!.y - 20);
  });

  it("keeps oversized dependency labels with their first field", async () => {
    const oversizedText = "W".repeat(3_300);
    const model = buildPacketModel(completeInput({
      editorialContent: {
        findings: [1, 2].map((number) => ({
          id: `oversized-dependency-${number}`,
          text: oversizedText,
          title: `Oversized dependency ${number}`,
          finding_type: "risk" as const,
          recommended_resolution: oversizedText,
          supporting_source_ids: [evidenceBase.id],
          grounded: true,
          reviewer_approved: true,
        })),
      },
    }));
    const pdf = await PDFDocument.load(await renderPacketPdf(model));
    const pages = pdf.getPages().map(pdfTextPlacements);

    for (const number of [1, 2]) {
      const heading = `DEPENDENCY ${String(number).padStart(2, "0")}`;
      const pageIndex = pages.findIndex((page) =>
        page.some(({ text }) => text === heading),
      );
      expect(pageIndex).toBeGreaterThanOrEqual(0);

      const page = pages[pageIndex]!;
      const headingIndex = page.findIndex(({ text }) => text === heading);
      const disciplineIndex = page.findIndex(
        ({ text }, index) => index > headingIndex && text === "DISCIPLINE",
      );
      const titleIndex = page.findIndex(
        ({ text }, index) =>
          index > disciplineIndex && text === `Oversized dependency ${number}`,
      );

      expect(disciplineIndex).toBeGreaterThan(headingIndex);
      expect(titleIndex).toBeGreaterThan(disciplineIndex);
      expect(page[disciplineIndex]!.y).toBeLessThan(page[headingIndex]!.y);
      expect(page[titleIndex]!.y).toBeLessThan(page[disciplineIndex]!.y);
    }
  });

  it("paginates an oversized executive decision card without escaping page bounds", async () => {
    const model = buildPacketModel(completeInput({
      editorialContent: {
        actionKit: approvedActionKit({
          confirmed_record: `The source record confirms ${"documented intake details ".repeat(350)}`,
        }),
      },
    }));
    const pdf = await PDFDocument.load(await renderPacketPdf(model));

    expect(pdf.getPageCount()).toBeGreaterThan(2);
    expect(
      pdf.getPages().flatMap(pdfTextYCoordinates).every((y) => y >= 18 && y <= 759),
    ).toBe(true);
    expect(
      pdf.getPages().every((page) => decodedPdfText(page).some((value) => value.trim())),
    ).toBe(true);
  });

  it("breaks uninterrupted words without exceeding the requested width", async () => {
    const document = await PDFDocument.create();
    const font = await document.embedFont(StandardFonts.Helvetica);
    const width = 120;
    const lines = wrapPacketPdfText("A".repeat(500), font, 10, width);

    expect(lines.length).toBeGreaterThan(1);
    expect(lines.every((line) => font.widthOfTextAtSize(line, 10) <= width)).toBe(true);
  });

  it("collapses newline floods without creating content-empty pages", async () => {
    const document = await PDFDocument.create();
    const font = await document.embedFont(StandardFonts.Helvetica);
    expect(
      wrapPacketPdfText(`\n\nFirst paragraph\n\n\n\nSecond paragraph\n\n`, font, 10, 300),
    ).toEqual(["First paragraph", "", "Second paragraph"]);

    const model = buildPacketModel(completeInput({
      timeline: [{
        ...timelineBase,
        details: `The application was recorded.${"\n".repeat(3_500)}Agency routing remains unresolved.`,
      }],
    }));
    const pdf = await PDFDocument.load(await renderPacketPdf(model));
    const canonicalFooter = buildPacketPresentation(model).footer;

    expect(pdf.getPageCount()).toBeLessThan(15);
    expect(
      pdf.getPages().every((page) =>
        decodedPdfText(page).some(
          (value) => value && !isPacketPdfChromeText(value, canonicalFooter),
        ),
      ),
    ).toBe(true);
  });

  it("produces deterministic bytes for the same persisted presentation", async () => {
    const packet = buildPacketModel(completeInput());
    const first = await renderPacketPdf(packet);
    const second = await renderPacketPdf(packet);

    expect(first).toEqual(second);
  });
});

describe("PacketPreview packet text integration", () => {
  it("does not fail open to a partial local packet while the authoritative packet loads", () => {
    const markup = renderToStaticMarkup(
      <PacketPreview caseRecord={previewCaseRecord} />,
    );

    expect(markup).toContain("Loading the authoritative packet");
    expect(markup).not.toContain("Prepared for client review");
    expect(markup).not.toContain("packet-canonical-document");
    expect(markup).not.toContain("Copy packet text");
    expect(markup).not.toContain("Download PDF");
  });

  it("withholds all deliverable actions until the authoritative model is loaded", () => {
    const markup = renderToStaticMarkup(
      <PacketPreview caseRecord={previewCaseRecord} />,
    );

    expect(markup).not.toContain("Copy packet text");
    expect(markup).not.toContain("Download PDF");
    expect(markup).not.toContain("Open print preview");
  });
});
