import { describe, expect, it } from "vitest";
import metadataJson from "../fixtures/program-screen/official-sources/calfire-fhszlra-25-1-all-data/metadata.json";
import { buildHttpCapture, httpCaptureIssues } from "../src/shared/program-screen/http-capture";
import { parseOfficialSourceMetadata } from "../src/shared/program-screen/source-capture";
import { expectedSourceIssues } from "../src/shared/program-screen/proposed-verification";

const url = "https://34c031f8-c9fd-4018-8c5a-4159cdff6b0d-cdn-endpoint.azureedge.net/-/media/osfm-website/what-we-do/community-wildfire-preparedness-and-mitigation/fire-hazard-severity-zones/fhszlra251allgdb.zip?hash=4FE6C7291E09FC36126F91318C6CCB88&rev=c273e91031b6401b99937894df5f1266";
const bytes = (s: string) => new TextEncoder().encode(s);
const metadata = parseOfficialSourceMetadata(metadataJson);
if (metadata.schema_version !== "program-screen-official-source-v2") throw new Error("Expected metadata v2");
const capture = metadata.http_capture!;

describe("Phase 3G original HTTP provenance", () => {
  it("preserves the exact requested/final URL, original UTC time and header bytes", async () => {
    expect(metadata.official_url).toBe(url);
    expect(metadata.retrieved_at).toBe("2026-09-30T16:39:28Z");
    expect(capture).toMatchObject({
      requested_url: url, final_url: url,
      final_url_basis: "inferred_no_redirect_from_supplied_headers",
      response_statuses: [200],
      response_headers: { bytes: 636, sha256: "e7b95196f0cfc5495e274110e917f8c0f5d70b0732e5f6553fe4a9a34e37c81f" },
    });
    expect(capture.response_headers.raw_utf8).toContain("Wed, 30 Sep 2026 16:39:28 GMT");
    expect(await httpCaptureIssues(capture)).toEqual([]);
    expect(await buildHttpCapture(url, bytes(capture.response_headers.raw_utf8))).toEqual(capture);
  });
  it("rejects query-parameter mutation without normalizing the original URL", () => {
    const changed = structuredClone(metadata);
    changed.official_url = url.replace("4FE6", "4FE7");
    changed.http_capture!.requested_url = changed.official_url;
    changed.http_capture!.final_url = changed.official_url;
    expect(expectedSourceIssues(changed)).not.toEqual([]);
  });
  it("rejects edited original header text against its pin", async () => {
    const changed = structuredClone(capture);
    changed.response_headers.raw_utf8 = changed.response_headers.raw_utf8.replace("TCP_MISS", "TCP_HITS");
    expect(await httpCaptureIssues(changed)).toContain("Original response header bytes differ from their length/SHA-256 pin.");
  });
  it("rejects an unsupported final URL inferred from one direct response", async () => {
    const changed = structuredClone(capture);
    changed.final_url += "&extra=1";
    expect(await httpCaptureIssues(changed)).toContain("Final URL cannot be inferred from these original headers.");
  });
  it("requires an explicit original effective URL when headers show a redirect", async () => {
    const trace = bytes("HTTP/2 302\r\nLocation: https://records.example.test/final\r\n\r\nHTTP/2 200\r\n\r\n");
    await expect(buildHttpCapture(url, trace)).rejects.toThrow("original effective URL");
    const redirected = await buildHttpCapture(url, trace, "https://records.example.test/final");
    expect(redirected.response_statuses).toEqual([302, 200]);
    expect(redirected.final_url_basis).toBe("capturer_supplied_effective_url");
    expect(await httpCaptureIssues(redirected)).toEqual([]);
  });
  it("rejects requested URL or final host substitution in metadata", () => {
    for (const field of ["requested_url", "final_url"] as const) {
      const changed = structuredClone(metadata);
      changed.http_capture![field] = "https://unofficial.example.test/other.zip";
      expect(() => parseOfficialSourceMetadata(changed)).toThrow();
    }
  });
});
