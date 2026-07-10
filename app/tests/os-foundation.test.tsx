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
    latest_occurred_on: "2026-07-07",
  },
  warnings: {
    count: 2,
    labels: ["Case needs information", "2 evidence records incomplete"],
  },
  next_action: {
    label: "Resolve missing information",
    section: "evidence",
  },
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
              order: "attention_status_updated_at_asc",
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
    expect(markup).toContain("50%");
    expect(markup).toContain("2/4");
    expect(markup).toContain("Resolve missing information");
    expect(markup).not.toContain("AI confidence");
    expect(markup).toContain('role="progressbar"');
  });

  it("renders AI confidence only when the API supplies it", () => {
    const markup = renderToStaticMarkup(
      <MissionControlHome
        displayName="Avery Example"
        error=""
        loading={false}
        missions={[{ ...mission, ai_confidence: 91 }]}
        onCreateCase={() => undefined}
        onOpenMission={() => undefined}
        onRetry={() => undefined}
        onViewCases={() => undefined}
      />,
    );

    expect(markup).toContain("AI confidence");
    expect(markup).toContain("91%");
  });
});

describe("PermitPulse OS primitives and shell", () => {
  it("renders the five thumb-friendly destinations without a menu or sidebar", () => {
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

    for (const label of ["Mission", "Cases", "AI", "Packets", "Founder"]) {
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
