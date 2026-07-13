import { env } from "cloudflare:workers";
import { PDFDocument } from "pdf-lib";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  deterministicEvidenceClassifier,
  isAcceptedEvidenceFile,
} from "../src/shared/evidence-intake/classifier";
import { placeholderEvidenceExtractor } from "../src/shared/evidence-intake/extractor";
import {
  isSafeEvidenceFilename,
  validateEvidenceFile,
} from "../src/shared/evidence-intake/file-validation";
import { app } from "../src/worker/app";
import type { Bindings } from "../src/worker/types";
import {
  evidenceContentDisposition,
  evidenceStorageKey,
  evidenceStorageKeyPrefix,
} from "../src/worker/evidence-intake/file-store";
import { validateEvidenceFileStructure } from "../src/worker/evidence-intake/structural-validation";
import {
  createPendingUpload,
  EvidenceInbox,
  EvidenceUploadList,
  submitPendingUpload,
} from "../src/client/features/evidence-inbox/EvidenceInbox";
import {
  evidenceDraftFileUrl,
  listEvidenceInbox,
  runEvidenceInboxBulkAction,
} from "../src/client/api/evidence-inbox";

const localOrigin = "http://localhost";
const testSecret = "test-only-auth-secret-not-for-any-deployment-123456";
const validJpegBase64 = "/9j/2wBDAAYEBQYFBAYGBQYHBwYIChAKCgkJChQODwwQFxQYGBcUFhYaHSUfGhsjHBYWICwgIyYnKSopGR8tMC0oMCUoKSj/2wBDAQcHBwoIChMKChMoGhYaKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCj/wAARCAACAAIDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAj/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFAEBAAAAAAAAAAAAAAAAAAAAAP/EABQRAQAAAAAAAAAAAAAAAAAAAAD/2gAMAwEAAhEDEQA/AKpAB//Z";
const validPngBase64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=";
// 64x64 HEVC image from libheif's public test corpus (colors-no-alpha.heic).
const validHeicBase64 = "AAAAGGZ0eXBoZWljAAAAAG1pZjFoZWljAAABLm1ldGEAAAAAAAAAIWhkbHIAAAAAAAAAAHBpY3QAAAAAAAAAAAAAAAAAAAAADnBpdG0AAAAAAAEAAAAiaWxvYwAAAABEQAABAAEAAAAAAU4AAQAAAAAAAAClAAAAI2lpbmYAAAAAAAEAAAAVaW5mZQIAAAAAAQAAaHZjMQAAAACuaXBycAAAAJFpcGNvAAAAdWh2Y0MBA3AAAAAAAAAAAAAe8AD8/fj4AAAPAyAAAQAYQAEMAf//A3AAAAMAkAAAAwAAAwAeugJAIQABAChCAQEDcAAAAwCQAAADAAADAB6gIIEFlupJKa5sCAAAAwAIAAADAAhAIgABAAdEAcFysCJAAAAAFGlzcGUAAAAAAAAAQAAAAEAAAAAVaXBtYQAAAAAAAAABAAECgQIAAACtbWRhdAAAAKEmAa8TgIGSEXXAGM2sfMMD8HKXsBNBYjkEW6//QKl1HfLCc/SN/bWOG2ARaa8rk4JsxRuKJFz/vIlnrSBv0Pk7pYMv503LniUfVt0RGOMyTBZVcbnDhlXs0nsTVObq7679Fh7MfXPARYndCrwpKWSNTQcCjNVYWPVOenDxU81lLBnE070xnN107IoLiTNywdiNWzedf/q6zzV3iwZflrO94A==";

function bytesFromBase64(value: string): Uint8Array {
  return Uint8Array.from(atob(value), (character) => character.charCodeAt(0));
}

async function validPdfBytes(): Promise<Uint8Array> {
  const document = await PDFDocument.create();
  document.addPage([72, 72]);
  return document.save({ useObjectStreams: false });
}

const markerWrappedJpeg = Uint8Array.of(
  0xff, 0xd8, 0xff, 0xe0, 0x00, 0x02, 0xff, 0xd9,
);
const markerWrappedPng = Uint8Array.of(
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
  0x49, 0x45, 0x4e, 0x44, 0xae, 0x42, 0x60, 0x82,
);
const markerWrappedHeic = Uint8Array.of(
  0x00, 0x00, 0x00, 0x18, 0x66, 0x74, 0x79, 0x70,
  0x68, 0x65, 0x69, 0x63, 0x00, 0x00, 0x00, 0x00,
  0x68, 0x65, 0x69, 0x63,
);

function testCrc32(bytes: readonly number[]): number {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc & 1) === 1
        ? 0xedb88320 ^ (crc >>> 1)
        : crc >>> 1;
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function testPngChunk(type: string, data: readonly number[]): number[] {
  const typeBytes = [...type].map((character) => character.charCodeAt(0));
  const crc = testCrc32([...typeBytes, ...data]);
  return [
    (data.length >>> 24) & 0xff,
    (data.length >>> 16) & 0xff,
    (data.length >>> 8) & 0xff,
    data.length & 0xff,
    ...typeBytes,
    ...data,
    (crc >>> 24) & 0xff,
    (crc >>> 16) & 0xff,
    (crc >>> 8) & 0xff,
    crc & 0xff,
  ];
}

const invalidDeflatePng = Uint8Array.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
  ...testPngChunk("IHDR", [
    0, 0, 0, 1,
    0, 0, 0, 1,
    8, 6, 0, 0, 0,
  ]),
  ...testPngChunk("IDAT", [1, 2, 3]),
  ...testPngChunk("IEND", []),
]);

const oversizedDecodedPng = Uint8Array.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
  ...testPngChunk("IHDR", [
    0, 0, 0x10, 0,
    0, 0, 0x10, 0,
    8, 6, 0, 0, 0,
  ]),
  ...testPngChunk("IDAT", [1, 2, 3]),
  ...testPngChunk("IEND", []),
]);

const oversubscribedHuffmanJpeg = Uint8Array.from([
  0xff, 0xd8,
  0xff, 0xdb, 0x00, 0x43, 0x00, ...Array(64).fill(1),
  0xff, 0xc4, 0x01, 0x12, 0x00, 0xff, ...Array(15).fill(0),
  ...Array(255).fill(0),
  0xff, 0xc0, 0x00, 0x0b, 0x08, 0x00, 0x01, 0x00, 0x01,
  0x01, 0x01, 0x11, 0x00,
  0xff, 0xda, 0x00, 0x08, 0x01, 0x01, 0x00, 0x00, 0x3f, 0x00,
  0xff, 0xd9,
]);

function bindings(overrides: Partial<Bindings> = {}): Bindings {
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
    ...overrides,
  };
}

function request(path: string, init?: RequestInit, overrides?: Partial<Bindings>) {
  return app.request(`${localOrigin}${path}`, init, bindings(overrides));
}

async function signUpUser(
  email = "intake.user@example.test",
  name = "Fictional Intake User",
) {
  const response = await request("/api/auth/sign-up/email", {
    method: "POST",
    headers: { "content-type": "application/json", origin: localOrigin },
    body: JSON.stringify({
      name,
      email,
      password: "Fictional-passphrase-42",
    }),
  });
  expect(response.status).toBe(200);
  const body = await response.json<{ user: { id: string } }>();
  return {
    cookie: response.headers.get("set-cookie")!.split(";", 1)[0],
    userId: body.user.id,
  };
}

async function signUp() {
  return (await signUpUser()).cookie;
}

async function signUpAdmin() {
  const admin = await signUpUser(
    "intake.admin@example.test",
    "Fictional Intake Admin",
  );
  await env.DB.prepare('UPDATE "user" SET role = ? WHERE id = ?')
    .bind("admin", admin.userId)
    .run();
  return admin;
}

async function createCase(cookie: string, projectName = "Fictional Intake Case") {
  const response = await request("/api/v1/cases", {
    method: "POST",
    headers: { cookie, "content-type": "application/json", origin: localOrigin },
    body: JSON.stringify({
      project_name: projectName,
      client_name: "Fictional Client",
      address: "123 Oak Street",
      city: "Los Angeles",
      jurisdiction: "Los Angeles Department of Building and Safety",
      permit_number: "PC-2026-42",
      current_status: "intake",
    }),
  });
  expect(response.status).toBe(201);
  return (await response.json<{ data: { id: string } }>()).data;
}

function upload(
  cookie: string,
  input: {
    body: BlobPart;
    filename: string;
    idempotencyKey?: string;
    mediaType: string;
    origin?: string;
  },
  overrides?: Partial<Bindings>,
) {
  const formData = new FormData();
  formData.append(
    "file",
    new File([input.body], input.filename, { type: input.mediaType }),
  );
  return request(
    "/api/v1/evidence-inbox/upload",
    {
      method: "POST",
      headers: {
        cookie,
        origin: input.origin ?? localOrigin,
        ...(input.idempotencyKey
          ? { "idempotency-key": input.idempotencyKey }
          : {}),
      },
      body: formData,
    },
    overrides,
  );
}

async function cleanEvidenceBucket() {
  let cursor: string | undefined;
  do {
    const listed = await env.EVIDENCE_FILES.list({ cursor });
    if (listed.objects.length > 0) {
      await env.EVIDENCE_FILES.delete(listed.objects.map(({ key }) => key));
    }
    cursor = listed.truncated ? listed.cursor : undefined;
  } while (cursor);
}

async function evidenceObjectCount() {
  let count = 0;
  let cursor: string | undefined;
  do {
    const listed = await env.EVIDENCE_FILES.list({ cursor });
    count += listed.objects.length;
    cursor = listed.truncated ? listed.cursor : undefined;
  } while (cursor);
  return count;
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
  await cleanEvidenceBucket();
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
      documentDate: null,
      discipline: "Structural",
      status: "placeholder_complete",
    });
    expect(extraction.confidence).toBeGreaterThan(50);
    expect(isAcceptedEvidenceFile("mail.eml")).toBe(true);
    expect(isAcceptedEvidenceFile("archive.zip")).toBe(false);
  });

  it("validates canonical media types and real file structures deterministically", async () => {
    const encoder = new TextEncoder();
    const validFiles = [
      {
        filename: "record.pdf",
        mediaType: "application/pdf",
        bytes: await validPdfBytes(),
        canonical: "application/pdf",
      },
      {
        filename: "photo.jpg",
        mediaType: "image/jpeg",
        bytes: bytesFromBase64(validJpegBase64),
        canonical: "image/jpeg",
      },
      {
        filename: "capture.png",
        mediaType: "image/png",
        bytes: bytesFromBase64(validPngBase64),
        canonical: "image/png",
      },
      {
        filename: "phone.heic",
        mediaType: "image/heic",
        bytes: bytesFromBase64(validHeicBase64),
        canonical: "image/heic",
      },
      {
        filename: "notes.txt",
        mediaType: "text/plain; charset=utf-8",
        bytes: encoder.encode("Fictional permit notes\nSecond line"),
        canonical: "text/plain",
      },
      {
        filename: "agency.eml",
        mediaType: "message/rfc822",
        bytes: encoder.encode(
          "From: reviewer@example.test\r\nSubject: Permit update\r\n\r\nFictional body",
        ),
        canonical: "message/rfc822",
      },
    ];

    for (const file of validFiles) {
      expect(
        validateEvidenceFile({
          bytes: file.bytes,
          declaredMediaType: file.mediaType,
          filename: file.filename,
        }),
        file.filename,
      ).toEqual({ ok: true, mediaType: file.canonical });
      await expect(
        validateEvidenceFileStructure({
          bytes: file.bytes,
          filename: file.filename,
        }),
        file.filename,
      ).resolves.toBe(true);
    }

    expect(
      validateEvidenceFile({
        bytes: encoder.encode("%PDF-1.7\n%%EOF"),
        declaredMediaType: "text/html",
        filename: "spoofed.pdf",
      }),
    ).toEqual({ ok: false, reason: "invalid_media_type" });
    expect(
      validateEvidenceFile({
        bytes: encoder.encode("not a PDF"),
        declaredMediaType: "application/pdf",
        filename: "malformed.pdf",
      }),
    ).toEqual({ ok: false, reason: "invalid_content" });
    expect(
      validateEvidenceFile({
        bytes: Uint8Array.of(0x00, 0x01, 0x02),
        declaredMediaType: "text/plain",
        filename: "binary.txt",
      }),
    ).toEqual({ ok: false, reason: "invalid_content" });
  });

  it("rejects marker-wrapped and decoder-invalid payloads that pass shallow signature checks", async () => {
    const encoder = new TextEncoder();
    const malformedFiles = [
      {
        bytes: encoder.encode("%PDF-1.7\narbitrary bytes\n%%EOF"),
        filename: "marker-only.pdf",
        mediaType: "application/pdf",
      },
      {
        bytes: markerWrappedJpeg,
        filename: "marker-only.jpg",
        mediaType: "image/jpeg",
      },
      {
        bytes: markerWrappedPng,
        filename: "marker-only.png",
        mediaType: "image/png",
      },
      {
        bytes: markerWrappedHeic,
        filename: "marker-only.heic",
        mediaType: "image/heic",
      },
      {
        bytes: invalidDeflatePng,
        filename: "invalid-deflate.png",
        mediaType: "image/png",
      },
      {
        bytes: oversubscribedHuffmanJpeg,
        filename: "invalid-huffman.jpg",
        mediaType: "image/jpeg",
      },
    ];

    for (const file of malformedFiles) {
      expect(
        validateEvidenceFile({
          bytes: file.bytes,
          declaredMediaType: file.mediaType,
          filename: file.filename,
        }),
        file.filename,
      ).toEqual({ ok: true, mediaType: file.mediaType });
      await expect(
        validateEvidenceFileStructure({
          bytes: file.bytes,
          filename: file.filename,
        }),
        file.filename,
      ).resolves.toBe(false);
    }
  });

  it("rejects PNGs whose decoded scanlines exceed the pilot memory budget before inflation", async () => {
    const decompression = vi.fn(() => {
      throw new Error("Decompression must not start for an oversized image.");
    });
    vi.stubGlobal("DecompressionStream", decompression);

    await expect(
      validateEvidenceFileStructure({
        bytes: oversizedDecodedPng,
        filename: "oversized-decoded.png",
      }),
    ).resolves.toBe(false);
    expect(decompression).not.toHaveBeenCalled();
  });

  it("keeps Unicode filenames while rejecting key/header separators and controls", () => {
    expect(isSafeEvidenceFilename("résumé-😀.pdf")).toBe(true);
    expect(isSafeEvidenceFilename("../permit.pdf")).toBe(false);
    expect(isSafeEvidenceFilename("folder\\permit.pdf")).toBe(false);
    expect(isSafeEvidenceFilename("permit\u0000.pdf")).toBe(false);

    const disposition = evidenceContentDisposition('résumé-😀-"quote".pdf');
    expect(disposition).toMatch(/^attachment; filename="[\x20-\x7e]+";/);
    expect(disposition).toContain("filename*=UTF-8''");
    expect(disposition).toContain("%F0%9F%98%80");
    expect(disposition).not.toContain("😀");
    expect(disposition).not.toContain('"quote"');

    const storageKey = evidenceStorageKey(
      "owner-id",
      "draft-id",
      'résumé-😀-"quote".pdf',
      "a".repeat(64),
    );
    expect(storageKey).toMatch(
      new RegExp(`^owner-id/draft-id/${"a".repeat(64)}-[a-zA-Z0-9._-]+$`),
    );
    expect(storageKey).not.toContain("😀");
    expect(storageKey).not.toContain('"');

    const attemptA = evidenceStorageKey(
      "owner-id",
      "draft-id",
      "permit.pdf",
      "b".repeat(64),
      "attempt-a",
    );
    const attemptB = evidenceStorageKey(
      "owner-id",
      "draft-id",
      "permit.pdf",
      "b".repeat(64),
      "attempt-b",
    );
    const prefix = evidenceStorageKeyPrefix(
      "owner-id",
      "draft-id",
      "b".repeat(64),
    );
    expect(attemptA).not.toBe(attemptB);
    expect(attemptA.startsWith(prefix)).toBe(true);
    expect(attemptB.startsWith(prefix)).toBe(true);
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
      source_url: `${localOrigin}/api/v1/evidence-inbox/${upload.data.id}/file`,
      source_date: null,
    });

    const fileResponse = await request(
      `/api/v1/evidence-inbox/${upload.data.id}/file`,
      { headers: { cookie } },
    );
    expect(fileResponse.status).toBe(200);
    expect(await fileResponse.text()).toBe("fictional structural response");
    expect(fileResponse.headers.get("content-type")).toBe("text/plain");
  });

  it("returns safe authentication and ownership responses for every intake boundary", async () => {
    const draftId = "00000000-0000-4000-8000-000000000001";
    const unauthenticatedUpload = await upload("", {
      body: "Fictional evidence",
      filename: "record.txt",
      mediaType: "text/plain",
    });
    const unauthenticated = await Promise.all([
      request("/api/v1/evidence-inbox"),
      request(`/api/v1/evidence-inbox/${draftId}/file`),
      request("/api/v1/evidence-inbox/bulk", {
        method: "PATCH",
        headers: { "content-type": "application/json", origin: localOrigin },
        body: JSON.stringify({ action: "mark_reviewed", draft_ids: [draftId] }),
      }),
    ]);
    expect(unauthenticatedUpload.status).toBe(401);
    expect(unauthenticated.map(({ status }) => status)).toEqual([401, 401, 401]);

    const owner = await signUpUser();
    const other = await signUpUser("other.intake@example.test", "Other Intake User");
    const admin = await signUpAdmin();
    const ownerCase = await createCase(owner.cookie);
    const uploaded = await upload(owner.cookie, {
      body: "Owner-only fictional evidence",
      filename: "owner-record.txt",
      mediaType: "text/plain",
    });
    const uploadedBody = await uploaded.json<{ data: { id: string } }>();

    const otherList = await request("/api/v1/evidence-inbox", {
      headers: { cookie: other.cookie },
    });
    const otherFileBeforeMove = await request(
      `/api/v1/evidence-inbox/${uploadedBody.data.id}/file`,
      { headers: { cookie: other.cookie } },
    );
    const otherBulk = await request("/api/v1/evidence-inbox/bulk", {
      method: "PATCH",
      headers: {
        cookie: other.cookie,
        "content-type": "application/json",
        origin: localOrigin,
      },
      body: JSON.stringify({
        action: "mark_reviewed",
        draft_ids: [uploadedBody.data.id],
      }),
    });
    expect((await otherList.json<{ data: { drafts: unknown[] } }>()).data.drafts).toEqual([]);
    expect(otherFileBeforeMove.status).toBe(404);
    expect(otherBulk.status).toBe(404);

    const moved = await request("/api/v1/evidence-inbox/bulk", {
      method: "PATCH",
      headers: {
        cookie: owner.cookie,
        "content-type": "application/json",
        origin: localOrigin,
      },
      body: JSON.stringify({
        action: "move_to_evidence",
        draft_ids: [uploadedBody.data.id],
        case_id: ownerCase.id,
      }),
    });
    expect(moved.status).toBe(200);
    expect(
      (
        await request(`/api/v1/evidence-inbox/${uploadedBody.data.id}/file`, {
          headers: { cookie: admin.cookie },
        })
      ).status,
    ).toBe(200);
    expect(
      (
        await request(`/api/v1/evidence-inbox/${uploadedBody.data.id}/file`, {
          headers: { cookie: other.cookie },
        })
      ).status,
    ).toBe(404);
  });

  it("rejects spoofed, marker-wrapped, and untrusted-origin uploads before persistence", async () => {
    const cookie = await signUp();
    const responses = await Promise.all([
      upload(cookie, {
        body: "%PDF-1.7\n%%EOF",
        filename: "spoofed.pdf",
        mediaType: "text/html",
      }),
      upload(cookie, {
        body: "%PDF-1.7\narbitrary bytes\n%%EOF",
        filename: "marker-only.pdf",
        mediaType: "application/pdf",
      }),
      upload(cookie, {
        body: markerWrappedJpeg,
        filename: "marker-only.jpg",
        mediaType: "image/jpeg",
      }),
      upload(cookie, {
        body: markerWrappedPng,
        filename: "marker-only.png",
        mediaType: "image/png",
      }),
      upload(cookie, {
        body: markerWrappedHeic,
        filename: "marker-only.heic",
        mediaType: "image/heic",
      }),
      upload(cookie, {
        body: invalidDeflatePng,
        filename: "invalid-deflate.png",
        mediaType: "image/png",
      }),
      upload(cookie, {
        body: oversubscribedHuffmanJpeg,
        filename: "invalid-huffman.jpg",
        mediaType: "image/jpeg",
      }),
      upload(cookie, {
        body: "archive",
        filename: "unsupported.zip",
        mediaType: "application/zip",
      }),
      upload(cookie, {
        body: "Cross-origin fictional evidence",
        filename: "cross-origin.txt",
        mediaType: "text/plain",
        origin: "https://untrusted.example.test",
      }),
    ]);

    expect(responses.map(({ status }) => status)).toEqual([
      400, 400, 400, 400, 400, 400, 400, 400, 403,
    ]);
    await expect(responses[8].json()).resolves.toMatchObject({
      error: { code: "INVALID_ORIGIN" },
    });
    const row = await env.DB.prepare(
      "SELECT COUNT(*) AS count FROM evidence_drafts",
    ).first<{ count: number }>();
    expect(row?.count).toBe(0);
    expect(await evidenceObjectCount()).toBe(0);
  });

  it("derives canonical media type and checksum metadata on the server", async () => {
    const cookie = await signUp();
    const response = await upload(cookie, {
      body: (await validPdfBytes()).slice().buffer as ArrayBuffer,
      filename: "generic-upload.pdf",
      mediaType: "application/octet-stream",
    });
    expect(response.status).toBe(201);
    const body = await response.json<{ data: { id: string; media_type: string } }>();
    expect(body.data.media_type).toBe("application/pdf");
    const row = await env.DB.prepare(
      "SELECT storage_key FROM evidence_drafts WHERE id = ?",
    ).bind(body.data.id).first<{ storage_key: string }>();
    const object = await env.EVIDENCE_FILES.head(row!.storage_key);
    expect(object?.httpMetadata?.contentType).toBe("application/pdf");
    expect(object?.customMetadata?.contentSha256).toMatch(/^[a-f0-9]{64}$/);
  });

  it("keeps optional upload idempotency replay- and conflict-safe", async () => {
    const cookie = await signUp();
    const input = {
      body: "Idempotent fictional evidence",
      filename: "idempotent.txt",
      idempotencyKey: "upload-attempt-1",
      mediaType: "text/plain",
    };
    const first = await upload(cookie, input);
    const replay = await upload(cookie, input);
    const conflicting = await upload(cookie, {
      ...input,
      body: "Different fictional evidence",
    });
    const [firstBody, replayBody] = await Promise.all([
      first.json<{ data: { id: string } }>(),
      replay.json<{ data: { id: string } }>(),
    ]);

    expect(first.status).toBe(201);
    expect(replay.status).toBe(200);
    expect(firstBody.data.id).toBe(replayBody.data.id);
    expect(conflicting.status).toBe(409);
    expect(
      await env.DB.prepare("SELECT COUNT(*) AS count FROM evidence_drafts")
        .first<{ count: number }>(),
    ).toEqual({ count: 1 });
    expect(await evidenceObjectCount()).toBe(1);
  });

  it("makes concurrent identical upload POSTs converge on one draft and object", async () => {
    const cookie = await signUp();
    const input = {
      body: "Concurrent fictional evidence",
      filename: "concurrent.txt",
      idempotencyKey: "concurrent-upload-attempt",
      mediaType: "text/plain",
    };
    const responses = await Promise.all([
      upload(cookie, input),
      upload(cookie, input),
    ]);
    const bodies = await Promise.all(
      responses.map((response) => response.json<{ data: { id: string } }>()),
    );

    expect(responses.map(({ status }) => status).sort()).toEqual([200, 201]);
    expect(new Set(bodies.map(({ data }) => data.id)).size).toBe(1);
    expect(
      await env.DB.prepare("SELECT COUNT(*) AS count FROM evidence_drafts")
        .first<{ count: number }>(),
    ).toEqual({ count: 1 });
    expect(await evidenceObjectCount()).toBe(1);
  });

  it("fails closed when an idempotent replay finds a missing stored object", async () => {
    const cookie = await signUp();
    const input = {
      body: "Persisted replay evidence",
      filename: "persisted-replay.txt",
      idempotencyKey: "persisted-replay-attempt",
      mediaType: "text/plain",
    };
    const first = await upload(cookie, input);
    const body = await first.json<{ data: { id: string } }>();
    const row = await env.DB.prepare(
      "SELECT storage_key FROM evidence_drafts WHERE id = ?",
    ).bind(body.data.id).first<{ storage_key: string }>();
    await env.EVIDENCE_FILES.delete(row!.storage_key);

    const replay = await upload(cookie, input);

    expect(first.status).toBe(201);
    expect(replay.status).toBe(409);
    await expect(replay.json()).resolves.toMatchObject({
      error: { code: "EVIDENCE_UPLOAD_INCOMPLETE" },
    });
    expect(await evidenceObjectCount()).toBe(0);
    expect(
      await env.DB.prepare("SELECT COUNT(*) AS count FROM evidence_drafts")
        .first<{ count: number }>(),
    ).toEqual({ count: 1 });
  });

  it("rejects oversized uploads before D1 or R2 persistence", async () => {
    const cookie = await signUp();
    const oversized = new Uint8Array(20 * 1024 * 1024 + 1);
    oversized.fill(0x61);
    const response = await upload(cookie, {
      body: oversized.buffer,
      filename: "oversized.txt",
      mediaType: "text/plain",
    });

    expect(response.status).toBe(413);
    expect(
      await env.DB.prepare("SELECT COUNT(*) AS count FROM evidence_drafts")
        .first<{ count: number }>(),
    ).toEqual({ count: 0 });
    expect(await evidenceObjectCount()).toBe(0);
  });

  it("does not leave D1 state when R2 put fails or an R2 object when D1 insert fails", async () => {
    const cookie = await signUp();
    const failingBucket = {
      put: () => Promise.reject(new Error("Injected R2 put failure")),
      get: env.EVIDENCE_FILES.get.bind(env.EVIDENCE_FILES),
      delete: env.EVIDENCE_FILES.delete.bind(env.EVIDENCE_FILES),
    } as unknown as R2Bucket;
    const r2Failure = await upload(
      cookie,
      {
        body: "R2 failure evidence",
        filename: "r2-failure.txt",
        mediaType: "text/plain",
      },
      { EVIDENCE_FILES: failingBucket },
    );
    expect(r2Failure.status).toBe(500);
    expect(
      await env.DB.prepare("SELECT COUNT(*) AS count FROM evidence_drafts")
        .first<{ count: number }>(),
    ).toEqual({ count: 0 });

    const failingDatabase = {
      prepare(query: string) {
        if (query.includes("INSERT INTO evidence_drafts")) {
          return {
            bind() {
              return {
                first: () => Promise.reject(new Error("Injected D1 insert failure")),
              };
            },
          };
        }
        return env.DB.prepare(query);
      },
      batch: env.DB.batch.bind(env.DB),
      exec: env.DB.exec.bind(env.DB),
      dump: env.DB.dump.bind(env.DB),
      withSession: env.DB.withSession.bind(env.DB),
    } as unknown as D1Database;
    const d1Failure = await upload(
      cookie,
      {
        body: "D1 failure evidence",
        filename: "d1-failure.txt",
        mediaType: "text/plain",
      },
      { DB: failingDatabase },
    );
    expect(d1Failure.status).toBe(500);
    expect(await evidenceObjectCount()).toBe(0);
    expect(
      await env.DB.prepare("SELECT COUNT(*) AS count FROM evidence_drafts")
        .first<{ count: number }>(),
    ).toEqual({ count: 0 });
  });

  it("rejects cross-case and deleted-draft promotion", async () => {
    const owner = await signUpUser();
    const other = await signUpUser("case.owner@example.test", "Other Case Owner");
    const ownerCase = await createCase(owner.cookie, "Owner Fictional Case");
    const otherCase = await createCase(other.cookie, "Other Fictional Case");
    const uploaded = await upload(owner.cookie, {
      body: "Cross-case fictional evidence",
      filename: "cross-case.txt",
      mediaType: "text/plain",
    });
    const draft = await uploaded.json<{ data: { id: string } }>();
    const crossCase = await request("/api/v1/evidence-inbox/bulk", {
      method: "PATCH",
      headers: { cookie: owner.cookie, "content-type": "application/json", origin: localOrigin },
      body: JSON.stringify({
        action: "move_to_evidence",
        draft_ids: [draft.data.id],
        case_id: otherCase.id,
      }),
    });
    expect(crossCase.status).toBe(404);

    const deleted = await request("/api/v1/evidence-inbox/bulk", {
      method: "PATCH",
      headers: { cookie: owner.cookie, "content-type": "application/json", origin: localOrigin },
      body: JSON.stringify({ action: "delete", draft_ids: [draft.data.id] }),
    });
    const promoteDeleted = await request("/api/v1/evidence-inbox/bulk", {
      method: "PATCH",
      headers: { cookie: owner.cookie, "content-type": "application/json", origin: localOrigin },
      body: JSON.stringify({
        action: "move_to_evidence",
        draft_ids: [draft.data.id],
        case_id: ownerCase.id,
      }),
    });
    expect(deleted.status).toBe(200);
    expect(promoteDeleted.status).toBe(404);
    expect(await evidenceObjectCount()).toBe(0);
  });

  it("serializes concurrent move requests without duplicating evidence", async () => {
    const owner = await signUpUser();
    const ownerCase = await createCase(owner.cookie);
    const uploaded = await upload(owner.cookie, {
      body: "Move-race fictional evidence",
      filename: "move-race.txt",
      mediaType: "text/plain",
    });
    const draft = await uploaded.json<{ data: { id: string } }>();
    const move = () => request("/api/v1/evidence-inbox/bulk", {
      method: "PATCH",
      headers: { cookie: owner.cookie, "content-type": "application/json", origin: localOrigin },
      body: JSON.stringify({
        action: "move_to_evidence",
        draft_ids: [draft.data.id],
        case_id: ownerCase.id,
      }),
    });
    const responses = await Promise.all([move(), move()]);

    expect(responses.filter(({ status }) => status === 200)).toHaveLength(1);
    expect(responses.some(({ status }) => status === 404 || status === 409)).toBe(true);
    expect(
      await env.DB.prepare("SELECT COUNT(*) AS count FROM evidence_items")
        .first<{ count: number }>(),
    ).toEqual({ count: 1 });
    expect(await evidenceObjectCount()).toBe(1);
  });

  it("keeps delete-versus-move races in one consistent terminal state", async () => {
    const owner = await signUpUser();
    const ownerCase = await createCase(owner.cookie);
    const uploaded = await upload(owner.cookie, {
      body: "Delete-move race evidence",
      filename: "delete-move-race.txt",
      mediaType: "text/plain",
    });
    const draft = await uploaded.json<{ data: { id: string } }>();
    const bulk = (body: unknown) => request("/api/v1/evidence-inbox/bulk", {
      method: "PATCH",
      headers: { cookie: owner.cookie, "content-type": "application/json", origin: localOrigin },
      body: JSON.stringify(body),
    });
    const responses = await Promise.all([
      bulk({ action: "delete", draft_ids: [draft.data.id] }),
      bulk({
        action: "move_to_evidence",
        draft_ids: [draft.data.id],
        case_id: ownerCase.id,
      }),
    ]);
    expect(responses.filter(({ status }) => status === 200)).toHaveLength(1);

    const state = await env.DB.prepare(
      `SELECT
        (SELECT COUNT(*) FROM evidence_drafts WHERE id = ?) AS drafts,
        (SELECT COUNT(*) FROM evidence_drafts WHERE id = ? AND moved_to_evidence_id IS NOT NULL) AS moved,
        (SELECT COUNT(*) FROM evidence_items WHERE case_id = ?) AS evidence`,
    ).bind(draft.data.id, draft.data.id, ownerCase.id).first<{
      drafts: number;
      moved: number;
      evidence: number;
    }>();
    const objectCount = await evidenceObjectCount();
    expect(
      state?.drafts === 0 && state.evidence === 0 && objectCount === 0 ||
      state?.drafts === 1 && state.moved === 1 && state.evidence === 1 && objectCount === 1,
    ).toBe(true);
  });

  it("serves Unicode filenames through ASCII-safe and UTF-8 disposition parameters", async () => {
    const cookie = await signUp();
    const response = await upload(cookie, {
      body: "Unicode filename evidence",
      filename: "revisión-😀.txt",
      mediaType: "text/plain",
    });
    const draft = await response.json<{ data: { id: string } }>();
    const file = await request(`/api/v1/evidence-inbox/${draft.data.id}/file`, {
      headers: { cookie },
    });
    const disposition = file.headers.get("content-disposition") ?? "";

    expect(file.status).toBe(200);
    expect(disposition).toContain("filename*=UTF-8''");
    expect(disposition).toContain("%F0%9F%98%80");
    expect(disposition).not.toContain("😀");
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
    expect(
      evidenceDraftFileUrl("00000000-0000-4000-8000-000000000001"),
    ).toBe(
      "/api/v1/evidence-inbox/00000000-0000-4000-8000-000000000001/file",
    );
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

  it("retains the file and idempotency key when a failed upload is retried", async () => {
    const file = new File(["Retry evidence"], "retry.txt", {
      type: "text/plain",
    });
    const pending = createPendingUpload(
      file,
      "00000000-0000-4000-8000-000000000099",
    );
    const uploader = vi.fn()
      .mockRejectedValueOnce(new Error("Ambiguous network failure"))
      .mockResolvedValueOnce({ id: "persisted-draft" });

    await expect(
      submitPendingUpload(pending, () => undefined, uploader),
    ).rejects.toThrow("Ambiguous network failure");
    await expect(
      submitPendingUpload(pending, () => undefined, uploader),
    ).resolves.toEqual({ id: "persisted-draft" });

    expect(uploader.mock.calls.map((call) => call[0])).toEqual([file, file]);
    expect(uploader.mock.calls.map((call) => call[2])).toEqual([
      pending.id,
      pending.id,
    ]);

    const markup = renderToStaticMarkup(
      <EvidenceUploadList
        uploads={[{
          ...pending,
          error: "The response was lost.",
          state: "failed",
        }]}
        onRetry={() => undefined}
      />,
    );
    expect(markup).toContain("The response was lost.");
    expect(markup).toContain("Retry");
  });
});
