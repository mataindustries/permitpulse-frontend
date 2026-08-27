import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { listMissionControl } from "../src/client/api/mission-control";
import {
  EmptyState,
  PrimaryAction,
  SkeletonLoader,
} from "../src/client/design-system/primitives";
import { MissionControlHome } from "../src/client/features/mission-control/MissionControlHome";
import { MobileShell } from "../src/client/os/MobileShell";
import type { MissionControlItem } from "../src/client/types/mission-control";
import { evaluateMissionIntelligence } from "../src/shared/mission-intelligence/evaluate";

const mission: MissionControlItem = {
  id: "00000000-0000-4000-8000-000000000001",
  project_name: "Fictional Jade ADU",
  address: "42 Jade Street",
  city: "Exampleville",
  jurisdiction: "Exampleville Building",
  permit_number: "EX-2026-JADE",
  current_status: "needs_information",
  updated_at: "2026-07-08T12:00:00.000Z",
  evidence: {
    total: 4,
    ready: 2,
    verified: 2,
    completeness: 50,
  },
  timeline: {
    total: 3,
    linked: 2,
    latest_occurred_on: "2026-07-07",
  },
  intelligence: evaluateMissionIntelligence({
    case: {
      id: "00000000-0000-4000-8000-000000000001",
      permitNumber: "EX-2026-JADE",
      currentStatus: "needs_information",
      updatedAt: "2026-07-08T12:00:00.000Z",
    },
    evidence: {
      total: 4,
      verified: 2,
      unverified: 2,
      disputed: 0,
      sourceComplete: 2,
      deliveryReady: 2,
      records: [],
    },
    timeline: {
      total: 3,
      linked: 2,
      canonicalApprovalLinkedToVerifiedEvidence: false,
      records: [],
    },
    evaluatedAt: "2026-07-10T00:00:00.000Z",
  }),
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("Mission Control client and UI", () => {
  it("requests the protected aggregate without an unbounded query", async () => {
    const fetchMock = vi.fn(() =>
      Promise.resolve(
        new Response(
          JSON.stringify({
            ok: true,
            data: {
              missions: [mission],
              pagination: { limit: 20, offset: 0 },
              order: "mission_intelligence_priority_asc",
            },
          }),
          { headers: { "content-type": "application/json" } },
        ),
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(listMissionControl({ limit: 20 })).resolves.toMatchObject({
      missions: [mission],
    });
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/v1/mission-control?limit=20",
      expect.objectContaining({ credentials: "same-origin" }),
    );
  });

  it("renders real mission metrics and omits unsupported AI confidence", () => {
    const markup = renderToStaticMarkup(
      <MissionControlHome
        displayName="Avery Example"
        error=""
        loading={false}
        missions={[mission]}
        onCreateCase={() => undefined}
        onOpenMission={() => undefined}
        onRetry={() => undefined}
        onViewCases={() => undefined}
      />,
    );

    expect(markup).toContain("What deserves attention now");
    expect(markup).toContain("Fictional Jade ADU");
    expect(markup).toContain("60% packet readiness");
    expect(markup).toContain("2/4");
    expect(markup).toContain("3/6");
    expect(markup).toContain("Resolve missing information");
    expect(markup).not.toContain("AI confidence");
    expect(markup).toContain('role="progressbar"');
  });

  it("renders the deterministic recommendation without an AI confidence value", () => {
    const markup = renderToStaticMarkup(
      <MissionControlHome
        displayName="Avery Example"
        error=""
        loading={false}
        missions={[mission]}
        onCreateCase={() => undefined}
        onOpenMission={() => undefined}
        onRetry={() => undefined}
        onViewCases={() => undefined}
      />,
    );

    expect(markup).toContain("Resolve missing information");
    expect(markup).not.toContain("AI confidence");
  });

  it("exposes the Build Week Integrity Review only for the fictional demo mission", () => {
    const demoMarkup = renderToStaticMarkup(
      <MissionControlHome
        displayName="Avery Example"
        error=""
        loading={false}
        missions={[{ ...mission, permit_number: "LADBS-FICTIONAL-2026-1842" }]}
        onCreateCase={() => undefined}
        onOpenIntegrity={() => undefined}
        onOpenMission={() => undefined}
        onRetry={() => undefined}
        onViewCases={() => undefined}
      />,
    );
    const ordinaryMarkup = renderToStaticMarkup(
      <MissionControlHome
        displayName="Avery Example"
        error=""
        loading={false}
        missions={[mission]}
        onCreateCase={() => undefined}
        onOpenIntegrity={() => undefined}
        onOpenMission={() => undefined}
        onRetry={() => undefined}
        onViewCases={() => undefined}
      />,
    );

    expect(demoMarkup).toContain("Open Integrity Review");
    expect(ordinaryMarkup).not.toContain("Open Integrity Review");
  });
});

describe("PermitPulse OS primitives and shell", () => {
  it("renders the six thumb-friendly destinations without a menu or sidebar", () => {
    const markup = renderToStaticMarkup(
      <MobileShell
        activeDestination="mission"
        displayName="Avery Example"
        onNavigate={() => undefined}
        title="Mission Control"
      >
        <p>Protected content</p>
      </MobileShell>,
    );

    for (const label of ["Mission", "Inbox", "Cases", "AI", "Packets", "Founder"]) {
      expect(markup).toContain(`aria-label="${label}"`);
    }
    expect(markup).toContain('aria-current="page"');
    expect(markup).not.toContain("hamburger");
    expect(markup).not.toContain("sidebar");
  });

  it("provides reusable skeleton and empty-state feedback", () => {
    const loading = renderToStaticMarkup(<SkeletonLoader label="Loading missions" />);
    const empty = renderToStaticMarkup(
      <EmptyState
        action={<PrimaryAction>Create case</PrimaryAction>}
        description="No visible cases."
        title="Nothing here yet"
      />,
    );

    expect(loading).toContain('role="status"');
    expect(loading).toContain("Loading missions");
    expect(empty).toContain("Nothing here yet");
    expect(empty).toContain("Create case");
  });

});
