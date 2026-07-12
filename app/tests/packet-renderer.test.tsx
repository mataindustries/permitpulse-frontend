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
import { renderPacketHtml } from "../src/shared/packet/render-packet-html";
import { packetDashboard } from "../src/shared/packet/presentation-summary";
import {
  renderPacketPdf,
  packetSectionHeadingMetrics,
  safePacketPdfFilename,
  wrapPacketPdfText,
} from "../src/shared/packet/render-packet-pdf";
import { renderPacketText } from "../src/shared/packet/render-packet-text";
import type {
  BuildPacketModelInput,
  PacketActivityDto,
  PacketCaseDto,
  PacketEvidenceDto,
  PacketTimelineDto,
} from "../src/shared/packet/types";
import {
  compilePacketText,
  PacketPreview,
} from "../src/client/components/PacketPreview";
import type { CaseActivityResponse, CaseDto } from "../src/client/types/cases";
import type {
  EvidenceItemDto,
  TimelineEntryDto,
} from "../src/client/types/evidence-timeline";

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

const previewEvidence: EvidenceItemDto = {
  ...evidenceBase,
  contributor: null,
  version: 1,
};

const previewTimeline: TimelineEntryDto = {
  ...timelineBase,
  contributor: null,
  version: 1,
};

const previewActivityResponse: CaseActivityResponse = {
  activity: [
    {
      ...activityBase,
      actor: { id: "user-1", name: activityBase.actor?.name ?? null },
    },
  ],
  pagination: { limit: 10, offset: 0 },
  order: "created_at_desc",
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

describe("packet model builder", () => {
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
      <PacketPreview
        activityResponse={previewActivityResponse}
        caseRecord={previewCaseRecord}
        evidence={evidence.map((item) => ({ ...item, contributor: null, version: 1 }))}
        timeline={[previewTimeline]}
      />,
    );
    const pdf = await PDFDocument.load(await renderPacketPdf(model));
    const pdfOperators = decodedPageOperators(pdf.getPage(0));

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
      presentation_version: 2,
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
      "No permit timeline events are included in this packet.",
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
    expect(text).toContain("Jurisdiction resolution: Not established by packet readiness.");
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
    expect(renderPacketHtml(model)).toContain("Agency dependency map");
    expect(renderPacketText(model)).toContain("Recommended next contact");
  });

  it("consolidates demo labeling into one professional disclosure", () => {
    const model = buildPacketModel(completeInput({
      caseRecord: { ...caseRecord, project_name: "DEMO — Arroyo Vista", permit_number: "DEMO-123" },
      evidence: [{ ...evidenceBase, title: "DEMO — Portal record", source_url: "https://records.example/demo" }],
    }));

    expect(model.demonstration_notice).toBe("Fictional case disclosure — all names, records, dates, and agency activity in this packet are illustrative.");
    expect(model.case_summary.project_name).toBe("Arroyo Vista");
    expect(model.evidence_summaries[0]?.title).toBe("Portal record");
    expect(renderPacketText(model).match(/Fictional case disclosure/g)).toHaveLength(1);
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
      "Executive Summary",
      "Case Overview",
      "Current Status",
      "Evidence Register",
      "Permit timeline",
      "Findings",
      "Open Questions",
      "Recommended Next Actions",
      "Supporting Sources",
      "Disclaimer",
    ]) {
      expect(text.toLowerCase()).toContain(section.toLowerCase());
    }

    expect(text).toContain("Prepared for client review");
    expect(text).toContain("Executive Dashboard");
    expect(text).toContain("Investigation health");
    expect(text).toContain("Packet readiness: 4 of 5 checks complete");
    expect(text).toContain("Packet Metadata");
    expect(text).toContain("Packet integrity / version");
    expect(text).toContain("Generated: February 3, 2026 at 4:05 AM");
    expect(text).not.toContain("2026-02-03T04:05:06.000Z");
    expect(text).toContain("Classification: Unverified");
    expect(text).toContain("Record classification: Canonical");
    expect(text).toContain("Provenance: https://example.test/notices/plan-check");
    expect(text).not.toContain("This placeholder is not AI-generated yet");
    expect(text).not.toContain("Recent case activity");
  });

  it("contains no HTML tags even when stored text looks like markup", () => {
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

    expect(text).not.toMatch(/<[^>]+>/);
    expect(text).toContain("&lt;script&gt;alert(1)&lt;/script&gt;");
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
    expect(html).toContain("&lt;img src&#61;x onerror&#61;alert(1)&gt;");
    expect(html).not.toMatch(/<script/i);
    expect(html).not.toMatch(/\son[a-z]+\s*=/i);
    expect(html).not.toContain('href="javascript:alert(1)"');
  });

  it("includes required semantic sections", () => {
    const html = renderPacketHtml(buildPacketModel(completeInput()));

    expect(html).toContain("<!doctype html>");
    expect(html).toContain("<article class=\"pp-packet\">");
    for (const section of [
      "Executive Summary",
      "Case Overview",
      "Current Status",
      "Evidence Register",
      "Permit Timeline",
      "Findings",
      "Open Questions",
      "Recommended Next Actions",
      "Supporting Sources",
      "Disclaimer",
    ]) {
      expect(html).toContain(section);
    }
    expect(html).toContain("--jade: #1c744d");
    expect(html).toContain("--paper: #fbfaf7");
    expect(html).toContain("Executive Dashboard");
    expect(html).toContain("Investigation health");
    expect(html).toContain("Packet integrity / version");
    expect(html).toContain("pp-evidence-card");
    expect(html).toContain("Reviewer note");
    expect(html).toContain("Review status");
    expect(html).toContain("break-after: page");
    expect(html).toContain("break-inside: avoid");
    expect(html).not.toContain("Internal working draft");
  });
});

describe("packet PDF helpers", () => {
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
    const firstPage = decodedPageOperators(pdf.getPage(0));
    for (const label of [
      "Executive Dashboard",
      "INVESTIGATION STATE",
      "INVESTIGATION HEALTH",
      "PACKET READINESS",
      "PACKET-READINESS CONDITIONS",
      "RECOMMENDED NEXT ACTION",
      "EVIDENCE SUMMARY",
      "PACKET INTEGRITY / VERSION",
    ]) {
      expect(firstPage).toContain(pdfHex(label));
    }
    expect(new TextDecoder("latin1").decode(bytes)).not.toContain(
      "2026-02-03T04:05:06.000Z",
    );
  });

  it("breaks uninterrupted words without exceeding the requested width", async () => {
    const document = await PDFDocument.create();
    const font = await document.embedFont(StandardFonts.Helvetica);
    const width = 120;
    const lines = wrapPacketPdfText("A".repeat(500), font, 10, width);

    expect(lines.length).toBeGreaterThan(1);
    expect(lines.every((line) => font.widthOfTextAtSize(line, 10) <= width)).toBe(true);
  });

  it("produces deterministic bytes for the same persisted presentation", async () => {
    const packet = buildPacketModel(completeInput());
    const first = await renderPacketPdf(packet);
    const second = await renderPacketPdf(packet);

    expect(first).toEqual(second);
  });
});

describe("PacketPreview packet text integration", () => {
  it("uses the shared packet text output for its compile helper", () => {
    const input = completeInput();

    expect(
      compilePacketText({
        activityResponse: previewActivityResponse,
        caseRecord: previewCaseRecord,
        evidence: [previewEvidence],
        generatedAt: new Date(String(input.generatedAt)),
        timeline: [previewTimeline],
      }),
    ).toEqual(renderPacketText(buildPacketModel(input)));
  });

  it("renders from the shared packet model without exposing unsafe source links", () => {
    const markup = renderToStaticMarkup(
      <PacketPreview
        activityResponse={previewActivityResponse}
        caseRecord={previewCaseRecord}
        evidence={[{ ...previewEvidence, source_url: "javascript:alert(1)" }]}
        timeline={[previewTimeline]}
      />,
    );

    expect(markup).toContain("Prepared for client review");
    expect(markup).toContain("Executive Dashboard");
    expect(markup).toContain("Investigation health");
    expect(markup).toContain("Packet integrity / version");
    expect(markup).toContain("Reviewer note");
    expect(markup).toContain("Fictional plan check notice");
    expect(markup).not.toContain('href="javascript:alert(1)"');
    expect(markup).not.toContain("javascript:alert(1)");
  });

  it("renders a protected PDF download action without changing copy or print actions", () => {
    const markup = renderToStaticMarkup(
      <PacketPreview
        activityResponse={previewActivityResponse}
        caseRecord={previewCaseRecord}
        evidence={[previewEvidence]}
        timeline={[previewTimeline]}
      />,
    );

    expect(markup).toContain("Copy packet text");
    expect(markup).toContain("Download PDF");
    expect(markup).toContain("Print preview");
  });
});
