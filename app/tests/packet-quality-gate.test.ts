import { describe, expect, it } from "vitest";
import { buildPacketModel } from "../src/shared/packet/build-packet-model";
import { evaluatePacketQuality } from "../src/shared/packet/quality-gate";
import type {
  BuildPacketModelInput,
  PacketModel,
} from "../src/shared/packet/types";

const caseRecord: BuildPacketModelInput["caseRecord"] = {
  project_name: "Fictional Quality Gate Project",
  client_name: "Fictional Client",
  address: "100 Quality Way",
  city: "Exampleville",
  jurisdiction: "Exampleville Building Division",
  permit_number: "QG-2026-001",
  current_status: "ready_for_review",
  version: 4,
  created_at: "2026-07-01T12:00:00.000Z",
  updated_at: "2026-07-10T14:16:00.000Z",
};

const verifiedEvidence: BuildPacketModelInput["evidence"][number] = {
  id: "00000000-0000-4000-8000-000000000101",
  evidence_type: "portal",
  title: "Fictional jurisdiction portal record",
  summary: "The portal record is included for reviewer-confirmed provenance.",
  source_url: "https://example.test/permits/QG-2026-001",
  source_label: "Exampleville permit portal",
  source_date: "2026-07-09",
  verification_status: "verified",
  created_at: "2026-07-09T12:00:00.000Z",
  updated_at: "2026-07-10T12:00:00.000Z",
};

const timelineEntry: BuildPacketModelInput["timeline"][number] = {
  id: "00000000-0000-4000-8000-000000000201",
  occurred_on: "2026-07-09",
  timeline_type: "status_update",
  title: "Portal status recorded",
  details: "The recorded portal status was added to the permit timeline.",
  is_canonical: true,
  evidence_ids: [verifiedEvidence.id],
  created_at: "2026-07-09T12:00:00.000Z",
  updated_at: "2026-07-10T12:00:00.000Z",
};

function model(
  overrides: Partial<BuildPacketModelInput> = {},
): PacketModel {
  return buildPacketModel({
    activityResponse: { activity: [] },
    caseRecord,
    evidence: [verifiedEvidence],
    generatedAt: "2026-07-10T14:16:00.000Z",
    timeline: [timelineEntry],
    ...overrides,
  });
}

function evaluate(
  snapshot: PacketModel | null,
  options: {
    lifecycleState?: "draft" | "packet_generated" | "under_review" | "approved_for_delivery";
    snapshotPresent?: boolean;
    staleSnapshot?: boolean;
  } = {},
) {
  return evaluatePacketQuality({
    evaluatedAt: "2026-07-10T14:20:00.000Z",
    lifecycleState: options.lifecycleState ?? "under_review",
    snapshot,
    snapshotPresent: options.snapshotPresent,
    staleSnapshot: options.staleSnapshot ?? false,
  });
}

describe("deterministic packet delivery-quality gate", () => {
  it("blocks an empty case without fabricating content", () => {
    const snapshot = model({
      caseRecord: {
        ...caseRecord,
        project_name: "",
        address: "",
        jurisdiction: "",
        permit_number: null,
        current_status: "intake",
      },
      evidence: [],
      timeline: [],
    });
    const result = evaluate(snapshot);

    expect(result.eligible_for_approval).toBe(false);
    expect(result.blockers.map((item) => item.id)).toEqual(
      expect.arrayContaining([
        "project-identity-present",
        "address-present",
        "jurisdiction-present",
        "evidence-exists",
        "evidence-source-ready",
        "timeline-exists",
      ]),
    );
    expect(result.warnings.map((item) => item.id)).toContain("permit-number-present");
  });

  it("blocks a packet with no evidence", () => {
    const result = evaluate(model({ evidence: [] }));

    expect(result.blockers.map((item) => item.id)).toEqual(
      expect.arrayContaining(["evidence-exists", "evidence-source-ready"]),
    );
  });

  it("blocks unverified evidence when its provenance is incomplete", () => {
    const result = evaluate(model({
      evidence: [{
        ...verifiedEvidence,
        verification_status: "unverified",
        source_url: null,
        source_label: null,
        source_date: null,
      }],
    }));

    expect(result.blockers.map((item) => item.id)).toContain("evidence-source-ready");
  });

  it("blocks source-complete unverified evidence while retaining the verification advisory", () => {
    const result = evaluate(model({
      evidence: [{ ...verifiedEvidence, verification_status: "unverified" }],
    }));

    expect(result.blockers.map((item) => item.id)).toContain("evidence-source-ready");
    expect(result.warnings.map((item) => item.id)).toContain("evidence-verification-depth");
  });

  it("keeps disputed evidence disclosed and blocks readiness", () => {
    const result = evaluate(model({
      evidence: [{ ...verifiedEvidence, verification_status: "disputed" }],
    }));

    expect(result.blockers.map((item) => item.id)).toEqual(
      expect.arrayContaining(["readiness-disputed-evidence", "evidence-source-ready"]),
    );
    expect(result.warnings.map((item) => item.id)).toContain(
      "disputed-evidence-disclosed",
    );
  });

  it("blocks a missing timeline", () => {
    const result = evaluate(model({ timeline: [] }));

    expect(result.blockers.map((item) => item.id)).toContain("timeline-exists");
  });

  it("requires a permit number once the case has moved beyond intake", () => {
    const result = evaluate(model({
      caseRecord: { ...caseRecord, permit_number: null },
    }));

    expect(result.blockers.map((item) => item.id)).toContain("permit-number-present");
  });

  it("blocks a stale persisted snapshot and recommends regeneration", () => {
    const result = evaluate(model(), { staleSnapshot: true });

    expect(result.stale_snapshot).toBe(true);
    expect(result.blockers).toContainEqual(
      expect.objectContaining({
        id: "snapshot-current",
        target_cockpit_tab: "packet",
      }),
    );
    expect(result.recommended_resolution).toContain("Regenerate");
  });

  it("blocks unsupported or ungrounded findings", () => {
    const snapshot = model({
      editorialContent: {
        findings: [{
          id: "finding-1",
          text: "The permit outcome is certain.",
          grounded: false,
          reviewer_approved: true,
          supporting_source_ids: [],
        }],
        unsupportedClaims: ["The permit outcome is certain."],
      },
    });
    const result = evaluate(snapshot);

    expect(result.blockers.map((item) => item.id)).toEqual(
      expect.arrayContaining(["findings-grounded", "unsupported-claims-absent"]),
    );
  });

  it("blocks internal placeholder text", () => {
    const snapshot = {
      ...model(),
      draft_notice: "This placeholder is not AI-generated yet.",
    };
    const result = evaluate(snapshot);

    expect(result.blockers.map((item) => item.id)).toContain("customer-facing-language");
  });

  it("blocks an internal-draft marker", () => {
    const snapshot = {
      ...model(),
      is_internal_draft: true,
    } as unknown as PacketModel;
    const result = evaluate(snapshot);

    expect(result.blockers.map((item) => item.id)).toContain("not-internal-draft");
  });

  it("blocks unapproved questions and recommended actions", () => {
    const snapshot = model({
      editorialContent: {
        openQuestions: [{
          id: "question-1",
          text: "Has the jurisdiction confirmed the review date?",
          reviewer_approved: false,
        }],
        recommendedNextActions: [{
          id: "action-1",
          text: "Confirm the review date with the jurisdiction.",
          supporting_source_ids: [verifiedEvidence.id],
          reviewer_approved: false,
        }],
      },
    });
    const result = evaluate(snapshot);

    expect(result.blockers.map((item) => item.id)).toEqual(
      expect.arrayContaining([
        "open-questions-approved",
        "recommended-actions-approved",
      ]),
    );
  });

  it("blocks a missing disclaimer", () => {
    const result = evaluate({ ...model(), disclaimer: "" });

    expect(result.blockers.map((item) => item.id)).toContain("disclaimer-present");
  });

  it("treats empty approved editorial sections as warnings, not blockers", () => {
    const result = evaluate(model());

    expect(result.blockers).toEqual([]);
    expect(result.warnings.map((item) => item.id)).toEqual(
      expect.arrayContaining([
        "findings-content",
        "open-questions-content",
        "recommended-next-actions-content",
      ]),
    );
    expect(result.eligible_for_approval).toBe(true);
  });

  it("marks a valid reviewed draft eligible for approval", () => {
    const result = evaluate(model());

    expect(result.eligible_for_approval).toBe(true);
    expect(result.eligible_for_delivery).toBe(false);
    expect(result.blockers).toEqual([]);
    expect(result.passed_checks.map((item) => item.id)).toEqual(
      expect.arrayContaining([
        "project-identity-present",
        "evidence-source-ready",
        "timeline-exists",
        "disclaimer-present",
      ]),
    );
  });

  it("marks the same valid snapshot delivery-eligible only after approval", () => {
    const result = evaluate(model(), { lifecycleState: "approved_for_delivery" });

    expect(result.eligible_for_approval).toBe(false);
    expect(result.eligible_for_delivery).toBe(true);
  });

  it("requires regeneration for a legacy persisted snapshot", () => {
    const result = evaluate(null, { snapshotPresent: true });

    expect(result.blockers).toContainEqual(
      expect.objectContaining({ id: "presentation-version-current" }),
    );
  });

  it("warns when the persisted source lists were truncated", () => {
    const snapshot = model();
    snapshot.warnings.push({
      id: "evidence-register-truncated",
      text: "The Evidence Register shows the 50 most recent records.",
      information_class: "warning",
    });
    const result = evaluate(snapshot);

    expect(result.warnings).toContainEqual(
      expect.objectContaining({ id: "packet-source-scope-complete" }),
    );
  });
});
