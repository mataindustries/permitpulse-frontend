import { env } from "cloudflare:workers";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  deterministicEvidenceClassifier,
  isAcceptedEvidenceFile,
} from "../src/shared/evidence-intake/classifier";
import { placeholderEvidenceExtractor } from "../src/shared/evidence-intake/extractor";
import { app } from "../src/worker/app";
import type { Bindings } from "../src/worker/types";
import { EvidenceInbox } from "../src/client/features/evidence-inbox/EvidenceInbox";
import {
  listEvidenceInbox,
  runEvidenceInboxBulkAction,
} from "../src/client/api/evidence-inbox";

const localOrigin = "http://localhost";
const testSecret = "test-only-auth-secret-not-for-any-deployment-123456";

function bindings(): Bindings {
  return {
    ADMIN_BOOTSTRAP_ENABLED: "false",
    APP_ENV: "local",
    ASSETS: env.ASSETS,
    AUTH_ALLOW_SIGNUP: "true",
    AUTH_ENABLED: "true",
    BETTER_AUTH_SECRET: testSecret,
    BETTER_AUTH_URL: localOrigin,
    DB: env.DB,
    EVIDENCE_FILES: env.EVIDENCE_FILES,
    ENABLE_DEV_CASE_API: "true",
  };
}

function request(path: string, init?: RequestInit) {
  return app.request(`${localOrigin}${path}`, init, bindings());
}

async function signUp() {
  const response = await request("/api/auth/sign-up/email", {
    method: "POST",
    headers: { "content-type": "application/json", origin: localOrigin },
    body: JSON.stringify({
      name: "Fictional Intake User",
      email: "intake.user@example.test",
      password: "Fictional-passphrase-42",
    }),
  });
  expect(response.status).toBe(200);
  return response.headers.get("set-cookie")!.split(";", 1)[0];
}

async function cleanDatabase() {
  await env.DB.batch([
    env.DB.prepare("DELETE FROM evidence_drafts"),
    env.DB.prepare("DELETE FROM timeline_entry_evidence"),
    env.DB.prepare("DELETE FROM timeline_entries"),
    env.DB.prepare("DELETE FROM evidence_items"),
    env.DB.prepare("DELETE FROM case_participants"),
    env.DB.prepare("DELETE FROM audit_events"),
    env.DB.prepare("DELETE FROM cases"),
    env.DB.prepare("DELETE FROM session"),
    env.DB.prepare("DELETE FROM account"),
    env.DB.prepare('DELETE FROM "user"'),
  ]);
}

beforeEach(async () => {
  vi.unstubAllGlobals();
  await cleanDatabase();
});

describe("deterministic evidence intake", () => {
  it("classifies from filename and supplies stable placeholder extraction", () => {
    const metadata = {
      filename: "LADBS_permit_PC-2026-42_123_Oak_Street_structural_response.pdf",
      mediaType: "application/pdf",
      size: 1024,
      lastModified: Date.parse("2026-07-11T12:00:00.000Z"),
    };
    const classification = deterministicEvidenceClassifier.classify(metadata);
    const extraction = placeholderEvidenceExtractor.extract(
      metadata,
      classification,
    );

    expect(classification.category).toBe("structural_response");
    expect(classification.detectedType).toBe("PDF document");
    expect(extraction).toMatchObject({
      permitNumber: "PC-2026-42",
      jurisdiction: "Los Angeles Department of Building and Safety",
      address: "123 Oak Street",
      documentDate: "2026-07-11",
      discipline: "Structural",
      status: "placeholder_complete",
    });
    expect(extraction.confidence).toBeGreaterThan(50);
    expect(isAcceptedEvidenceFile("mail.eml")).toBe(true);
    expect(isAcceptedEvidenceFile("archive.zip")).toBe(false);
  });

  it("uploads, lists, reviews, and moves a persisted file into case evidence", async () => {
    const cookie = await signUp();
    const createCaseResponse = await request("/api/v1/cases", {
      method: "POST",
      headers: { cookie, "content-type": "application/json", origin: localOrigin },
      body: JSON.stringify({
        project_name: "Fictional Intake Case",
        client_name: "Fictional Client",
        address: "123 Oak Street",
        city: "Los Angeles",
        jurisdiction: "Los Angeles Department of Building and Safety",
        permit_number: "PC-2026-42",
        current_status: "intake",
      }),
    });
    expect(createCaseResponse.status).toBe(201);
    const createdCase = await createCaseResponse.json<{ data: { id: string } }>();

    const formData = new FormData();
    formData.append(
      "file",
      new File(["fictional structural response"], "PC-2026-42_structural_response.txt", {
        type: "text/plain",
      }),
    );
    formData.append("last_modified", String(Date.parse("2026-07-11T00:00:00Z")));
    const uploadResponse = await request("/api/v1/evidence-inbox/upload", {
      method: "POST",
      headers: { cookie, origin: localOrigin },
      body: formData,
    });
    expect(uploadResponse.status).toBe(201);
    const upload = await uploadResponse.json<{
      data: { id: string; category: string; queue_state: string };
    }>();
    expect(upload.data).toMatchObject({
      category: "structural_response",
      queue_state: "ready_for_review",
    });

    const listResponse = await request("/api/v1/evidence-inbox", {
      headers: { cookie },
    });
    expect(listResponse.status).toBe(200);
    const list = await listResponse.json<{ data: { drafts: Array<{ id: string }> } }>();
    expect(list.data.drafts).toHaveLength(1);

    const reviewResponse = await request("/api/v1/evidence-inbox/bulk", {
      method: "PATCH",
      headers: { cookie, "content-type": "application/json", origin: localOrigin },
      body: JSON.stringify({
        action: "mark_reviewed",
        draft_ids: [upload.data.id],
      }),
    });
    expect(reviewResponse.status).toBe(200);
    const reviewed = await reviewResponse.json<{
      data: { drafts: Array<{ reviewed_at: string | null }> };
    }>();
    expect(reviewed.data.drafts[0].reviewed_at).toBeTruthy();

    const moveResponse = await request("/api/v1/evidence-inbox/bulk", {
      method: "PATCH",
      headers: { cookie, "content-type": "application/json", origin: localOrigin },
      body: JSON.stringify({
        action: "move_to_evidence",
        draft_ids: [upload.data.id],
        case_id: createdCase.data.id,
      }),
    });
    expect(moveResponse.status).toBe(200);
    const moved = await moveResponse.json<{ data: { drafts: unknown[] } }>();
    expect(moved.data.drafts).toHaveLength(0);

    const evidenceResponse = await request(
      `/api/v1/cases/${createdCase.data.id}/evidence`,
      { headers: { cookie } },
    );
    const evidence = await evidenceResponse.json<{
      data: { evidence: Array<{ title: string; source_url: string }> };
    }>();
    expect(evidence.data.evidence[0]).toMatchObject({
      title: "PC-2026-42_structural_response.txt",
      source_url: `/api/v1/evidence-inbox/${upload.data.id}/file`,
    });

    const fileResponse = await request(
      `/api/v1/evidence-inbox/${upload.data.id}/file`,
      { headers: { cookie } },
    );
    expect(fileResponse.status).toBe(200);
    expect(await fileResponse.text()).toBe("fictional structural response");
  });
});

describe("Evidence Inbox client and UI", () => {
  it("renders a mobile upload target and all bulk actions", () => {
    const markup = renderToStaticMarkup(
      <EvidenceInbox cases={[]} onSessionExpired={() => undefined} />,
    );
    expect(markup).toContain("Evidence Inbox");
    expect(markup).toContain("Drop permit evidence here");
    expect(markup).toContain("multiple");
    expect(markup).toContain("Mark Reviewed");
    expect(markup).toContain("Move to Evidence");
    expect(markup).toContain("Delete");
  });

  it("uses protected list and bulk API endpoints", async () => {
    const fetchMock = vi.fn(() =>
      Promise.resolve(
        new Response(
          JSON.stringify({ ok: true, data: { drafts: [], counts: {
            waiting: 0, processing: 0, ready_for_review: 0, needs_attention: 0,
          } } }),
          { headers: { "content-type": "application/json" } },
        ),
      ),
    );
    vi.stubGlobal("fetch", fetchMock);
    await listEvidenceInbox();
    await runEvidenceInboxBulkAction({
      action: "mark_reviewed",
      draft_ids: ["00000000-0000-4000-8000-000000000001"],
    });
    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      "/api/v1/evidence-inbox",
      expect.objectContaining({ credentials: "same-origin" }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "/api/v1/evidence-inbox/bulk",
      expect.objectContaining({ method: "PATCH", credentials: "same-origin" }),
    );
  });
});

