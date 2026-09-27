import { readdir, readFile } from "node:fs/promises";
import { resolve } from "node:path";
import type { TestProject } from "vitest/node";
import {
  captureFileNames,
  isPdf,
  OFFICIAL_SOURCE_CAPTURE_DIR,
  officialSourceCaptureIssues,
  sha256HexBytes,
} from "../src/shared/program-screen/source-capture";

/**
 * Byte-level pin check for every official source capture, run in Node on
 * every test run.
 *
 * The tests run in workerd, which receives each module over a WebSocket
 * capped at 32 MiB. An official PDF inlined as base64 can exceed that cap
 * (Ordinance 188967 is 16.7 MB), so program-screen-source-capture.test.ts
 * cannot load original.pdf itself. This setup reads the exact bytes of each
 * capture's files, runs the same `officialSourceCaptureIssues` check the
 * capture CLI uses, and provides the results; the test fails on any issue
 * and on any capture directory this setup did not check.
 */
export interface OfficialCaptureByteCheck {
  files: string[];
  sha256_original: string | null;
  bytes: number | null;
  is_pdf: boolean;
  issues: string[];
}

declare module "vitest" {
  export interface ProvidedContext {
    programScreenOfficialCaptureByteChecks: Record<string, OfficialCaptureByteCheck>;
  }
}

async function readIfPresent(path: string): Promise<Buffer | null> {
  return readFile(path).catch((error: NodeJS.ErrnoException) => {
    if (error.code === "ENOENT") return null;
    throw error;
  });
}

export default async function setup(project: TestProject): Promise<void> {
  const repoRoot = resolve(project.config.root, "..");
  const captureRoot = resolve(repoRoot, OFFICIAL_SOURCE_CAPTURE_DIR);
  const entries = await readdir(captureRoot, { withFileTypes: true });
  const checks: Record<string, OfficialCaptureByteCheck> = {};

  for (const entry of entries.filter((candidate) => candidate.isDirectory())) {
    const directory = `${OFFICIAL_SOURCE_CAPTURE_DIR}${entry.name}`;
    const absolute = resolve(repoRoot, directory);
    const original = await readIfPresent(resolve(absolute, captureFileNames.original));
    const extracted = await readIfPresent(resolve(absolute, captureFileNames.extracted));
    const metadataBytes = await readIfPresent(resolve(absolute, captureFileNames.metadata));
    let metadata: unknown = null;
    let parseIssue: string | null = null;
    try {
      metadata = metadataBytes === null ? null : JSON.parse(metadataBytes.toString("utf8"));
    } catch {
      parseIssue = "metadata.json is not valid JSON.";
    }
    const bytes = original === null ? null : new Uint8Array(original);
    checks[directory] = {
      files: (await readdir(absolute)).sort(),
      sha256_original: bytes === null ? null : await sha256HexBytes(bytes),
      bytes: bytes === null ? null : bytes.byteLength,
      is_pdf: bytes !== null && isPdf(bytes),
      issues:
        parseIssue !== null
          ? [parseIssue]
          : await officialSourceCaptureIssues({
              directory,
              metadata,
              original: bytes,
              extracted: extracted === null ? null : extracted.toString("utf8"),
            }),
    };
  }
  project.provide("programScreenOfficialCaptureByteChecks", checks);
}
