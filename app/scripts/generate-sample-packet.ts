import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { buildPacketModel } from "../src/shared/packet/build-packet-model";
import { renderPacketHtml } from "../src/shared/packet/render-packet-html";
import { renderPacketPdf } from "../src/shared/packet/render-packet-pdf";
import type { BuildPacketModelInput } from "../src/shared/packet/types";

const portalEvidenceId = "00000000-0000-4000-8000-000000000611";
const correctionEvidenceId = "00000000-0000-4000-8000-000000000612";
const contactEvidenceId = "00000000-0000-4000-8000-000000000613";

const input: BuildPacketModelInput = {
  activityResponse: { activity: [] },
  caseRecord: {
    project_name: "Fictional Spring Street Tenant Improvement",
    client_name: "Example Owner / Design Team (Fictional)",
    address: "726 North Spring Street",
    city: "Los Angeles, CA 90012",
    jurisdiction: "Fictional Los Angeles Building Division",
    permit_number: "DEMO-2026-0611",
    current_status: "ready_for_review",
    version: 6,
    created_at: "2026-05-02T16:00:00.000Z",
    updated_at: "2026-07-10T18:30:00.000Z",
  },
  documentStatus: "draft",
  editorialContent: {
    findings: [
      {
        id: "finding-1",
        text: "The assembled record documents a correction cycle followed by a supplemental response and a reviewer follow-up.",
        supporting_source_ids: [portalEvidenceId, correctionEvidenceId, contactEvidenceId],
        grounded: true,
        reviewer_approved: true,
      },
      {
        id: "finding-2",
        text: "The latest recorded portal status remains in review; no approval event is included in the current evidence set.",
        supporting_source_ids: [portalEvidenceId],
        grounded: true,
        reviewer_approved: true,
      },
    ],
    openQuestions: [
      {
        id: "question-1",
        text: "Has the jurisdiction confirmed whether the supplemental response is assigned to an active reviewer?",
        reviewer_approved: true,
      },
    ],
    recommendedNextActions: [
      {
        id: "action-1",
        text: "Confirm the current reviewer assignment and request written status for the recorded supplemental response.",
        supporting_source_ids: [portalEvidenceId, contactEvidenceId],
        reviewer_approved: true,
      },
      {
        id: "action-2",
        text: "Verify the reviewer-contact record before using it as confirmed support in client delivery.",
        supporting_source_ids: [contactEvidenceId],
        reviewer_approved: true,
      },
    ],
  },
  evidence: [
    {
      id: portalEvidenceId,
      evidence_type: "portal",
      title: "Fictional jurisdiction portal status record",
      summary: "The portal capture records the permit identifier, review status, and latest visible status date for the fictional case.",
      source_url: "https://example.test/permits/DEMO-2026-0611",
      source_label: "Example jurisdiction permit portal",
      source_date: "2026-07-09",
      verification_status: "verified",
      created_at: "2026-07-09T17:00:00.000Z",
      updated_at: "2026-07-10T18:00:00.000Z",
    },
    {
      id: correctionEvidenceId,
      evidence_type: "document",
      title: "Fictional plan-check correction notice",
      summary: "The correction notice lists the recorded review comments associated with the supplemental response cycle.",
      source_url: "https://example.test/notices/DEMO-2026-0611-corrections",
      source_label: "Example plan-check record",
      source_date: "2026-05-28",
      verification_status: "verified",
      created_at: "2026-05-28T19:00:00.000Z",
      updated_at: "2026-07-10T18:05:00.000Z",
    },
    {
      id: contactEvidenceId,
      evidence_type: "email",
      title: "Fictional reviewer follow-up correspondence",
      summary: "The correspondence records a follow-up request for assignment and status confirmation after the supplemental response.",
      source_url: "https://example.test/correspondence/DEMO-2026-0611-follow-up",
      source_label: "Example project correspondence log",
      source_date: "2026-06-24",
      verification_status: "unverified",
      created_at: "2026-06-24T16:30:00.000Z",
      updated_at: "2026-07-10T18:10:00.000Z",
    },
  ],
  generatedAt: "2026-07-11T05:00:00.000Z",
  timeline: [
    {
      id: "00000000-0000-4000-8000-000000000621",
      occurred_on: "2026-05-02",
      timeline_type: "submission",
      title: "Initial filing recorded",
      details: "The fictional tenant-improvement filing was recorded in the jurisdiction portal.",
      is_canonical: true,
      evidence_ids: [portalEvidenceId],
      created_at: "2026-05-02T16:00:00.000Z",
      updated_at: "2026-07-10T18:20:00.000Z",
    },
    {
      id: "00000000-0000-4000-8000-000000000622",
      occurred_on: "2026-05-28",
      timeline_type: "correction",
      title: "Correction notice issued",
      details: "The recorded plan-check notice opened a correction-response cycle for the fictional permit.",
      is_canonical: true,
      evidence_ids: [correctionEvidenceId],
      created_at: "2026-05-28T19:00:00.000Z",
      updated_at: "2026-07-10T18:21:00.000Z",
    },
    {
      id: "00000000-0000-4000-8000-000000000623",
      occurred_on: "2026-06-12",
      timeline_type: "resubmission",
      title: "Supplemental response recorded",
      details: "A supplemental response to the recorded correction notice was submitted for review.",
      is_canonical: true,
      evidence_ids: [portalEvidenceId, correctionEvidenceId],
      created_at: "2026-06-12T17:00:00.000Z",
      updated_at: "2026-07-10T18:22:00.000Z",
    },
    {
      id: "00000000-0000-4000-8000-000000000624",
      occurred_on: "2026-06-24",
      timeline_type: "reviewer_contact",
      title: "Reviewer follow-up sent",
      details: "The project correspondence log records a request for reviewer assignment and status confirmation.",
      is_canonical: false,
      evidence_ids: [contactEvidenceId],
      created_at: "2026-06-24T16:30:00.000Z",
      updated_at: "2026-07-10T18:23:00.000Z",
    },
    {
      id: "00000000-0000-4000-8000-000000000625",
      occurred_on: "2026-07-09",
      timeline_type: "status_update",
      title: "Portal status captured",
      details: "The latest captured portal record continues to show the fictional case in review.",
      is_canonical: true,
      evidence_ids: [portalEvidenceId],
      created_at: "2026-07-09T17:00:00.000Z",
      updated_at: "2026-07-10T18:24:00.000Z",
    },
  ],
};

const pdfPath = process.argv[2] ?? "/tmp/permitpulse-professional-packet-sample.pdf";
const htmlPath = pdfPath.replace(/\.pdf$/i, ".html");
const model = buildPacketModel(input);
const pdfBytes = await renderPacketPdf(model);

await mkdir(dirname(pdfPath), { recursive: true });
await writeFile(pdfPath, pdfBytes);
await writeFile(htmlPath, renderPacketHtml(model), "utf8");

console.log(`Generated ${pdfPath}`);
console.log(`Generated ${htmlPath}`);

