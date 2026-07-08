import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { buildPacketModel } from "../src/shared/packet/build-packet-model";
import { renderPacketHtml } from "../src/shared/packet/render-packet-html";
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

describe("packet model builder", () => {
  it("generates a deterministic model from complete safe DTO data", () => {
    const model = buildPacketModel(completeInput());

    expect(model).toMatchObject({
      title: "PermitPulse packet preview",
      generated_at: "2026-02-03T04:05:06.000Z",
      draft_notice: "Draft packet preview — verify before sending",
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
      "No evidence records are available in this case.",
    );
    expect(renderPacketText(model)).toContain(
      "No permit timeline records are available in this case.",
    );
    expect(renderPacketText(model)).toContain(
      "No recent case activity records are available in this case.",
    );
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
      "Disputed evidence. Do not treat as confirmed.",
      "Marked verified.",
      "Unverified evidence. Do not treat as confirmed.",
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
      "Packet header",
      "Project summary",
      "Current permit status",
      "Key evidence",
      "Permit timeline",
      "Recent case activity",
      "Open questions / missing information",
      "Recommended next actions",
      "Disclaimer / internal-review note",
    ]) {
      expect(text).toContain(section);
    }

    expect(text).toContain("Draft packet preview — verify before sending");
    expect(text).toContain("Generated: 2026-02-03T04:05:06.000Z");
    expect(text).toContain("Verification: Unverified");
    expect(text).toContain("Entry source: Canonical");
    expect(text).toContain("Source URL: https://example.test/notices/plan-check");
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
    expect(html).toContain("Project summary");
    expect(html).toContain("Current permit status");
    expect(html).toContain("Key evidence");
    expect(html).toContain("Permit timeline");
    expect(html).toContain("Recent case activity");
    expect(html).toContain("Disclaimer / internal-review note");
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

    expect(markup).toContain("Draft packet preview — verify before sending");
    expect(markup).toContain("Fictional plan check notice");
    expect(markup).not.toContain('href="javascript:alert(1)"');
  });
});
