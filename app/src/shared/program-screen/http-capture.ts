import { z } from "zod";

/** Optional transport provenance. Raw owner-supplied header bytes are kept
 * inside metadata so the existing three-file capture layout stays intact. */
export const httpCaptureSchema = z.object({
  requested_url: z.string().url().max(2048),
  final_url: z.string().url().max(2048),
  final_url_basis: z.enum(["inferred_no_redirect_from_supplied_headers", "capturer_supplied_effective_url"]),
  response_statuses: z.array(z.number().int().min(100).max(599)).min(1),
  response_headers: z.object({
    raw_utf8: z.string().min(1).max(65536),
    bytes: z.number().int().positive(),
    sha256: z.string().regex(/^[0-9a-f]{64}$/),
  }).strict(),
}).strict();
export type HttpCapture = z.infer<typeof httpCaptureSchema>;

function summary(raw: string) {
  // Interpret the attached literal CRLF notation without changing stored bytes.
  const interpreted = raw.replace(/\\r\\n/g, "\n").replace(/\r\n/g, "\n");
  return {
    statuses: [...interpreted.matchAll(/^HTTP\/\S+[ \t]+(\d{3})(?:[ \t].*)?$/gm)].map((m) => Number(m[1])),
    location: /^location:/im.test(interpreted),
  };
}
async function digest(bytes: Uint8Array): Promise<string> {
  return [...new Uint8Array(await crypto.subtle.digest("SHA-256", bytes as Uint8Array<ArrayBuffer>))]
    .map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function buildHttpCapture(requestedUrl: string, raw: Uint8Array, effectiveUrl?: string): Promise<HttpCapture> {
  const text = new TextDecoder("utf-8", { fatal: true }).decode(raw);
  const headers = summary(text);
  if (headers.statuses.at(-1) !== 200) throw new Error("Original headers must end in HTTP 200.");
  if (effectiveUrl === undefined && (headers.statuses.length !== 1 || headers.location))
    throw new Error("A redirect trace requires the capturer's original effective URL.");
  return httpCaptureSchema.parse({
    requested_url: requestedUrl,
    final_url: effectiveUrl ?? requestedUrl,
    final_url_basis: effectiveUrl === undefined ? "inferred_no_redirect_from_supplied_headers" : "capturer_supplied_effective_url",
    response_statuses: headers.statuses,
    response_headers: { raw_utf8: text, bytes: raw.length, sha256: await digest(raw) },
  });
}

export async function httpCaptureIssues(capture: HttpCapture): Promise<string[]> {
  const bytes = new TextEncoder().encode(capture.response_headers.raw_utf8),
    headers = summary(capture.response_headers.raw_utf8),
    issues: string[] = [];
  if (bytes.length !== capture.response_headers.bytes || await digest(bytes) !== capture.response_headers.sha256)
    issues.push("Original response header bytes differ from their length/SHA-256 pin.");
  if (JSON.stringify(headers.statuses) !== JSON.stringify(capture.response_statuses) || headers.statuses.at(-1) !== 200)
    issues.push("Original response status trace differs.");
  if (capture.final_url_basis === "inferred_no_redirect_from_supplied_headers" &&
      (headers.statuses.length !== 1 || headers.location || capture.final_url !== capture.requested_url))
    issues.push("Final URL cannot be inferred from these original headers.");
  return issues;
}
