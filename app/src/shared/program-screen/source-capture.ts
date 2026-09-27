/**
 * Captured official-source text lives under this directory, one plain-text
 * file per source document. A human-verified criterion's supporting excerpt
 * must appear in its capture, and the capture's SHA-256 must match the
 * verification record, so a later edit to either one fails the tests.
 */
export const OFFICIAL_SOURCE_CAPTURE_DIR = "app/fixtures/program-screen/official-sources/";

/**
 * Text extracted from PDFs and HTML wraps lines unpredictably. Only runs of
 * whitespace are collapsed; every other character must match exactly.
 */
export function normalizeSourceText(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

export function excerptAppearsInCapture(excerpt: string, captureText: string): boolean {
  const needle = normalizeSourceText(excerpt);
  return needle.length > 0 && normalizeSourceText(captureText).includes(needle);
}

export async function sha256Hex(text: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}
