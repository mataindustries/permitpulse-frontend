import { describe, expect, it } from "vitest";
import { samplePacketOutputPaths } from "../scripts/sample-packet-paths";

describe("standalone sample packet output paths", () => {
  it("derives distinct HTML and PDF paths from the default", () => {
    const paths = samplePacketOutputPaths();

    expect(paths).toEqual({
      htmlPath: "/tmp/permitpulse-professional-packet-sample.html",
      pdfPath: "/tmp/permitpulse-professional-packet-sample.pdf",
    });
    expect(paths.htmlPath).not.toBe(paths.pdfPath);
  });

  it("accepts a case-insensitive PDF extension and derives a distinct HTML path", () => {
    expect(samplePacketOutputPaths("/tmp/release-audit.PDF")).toEqual({
      htmlPath: "/tmp/release-audit.html",
      pdfPath: "/tmp/release-audit.PDF",
    });
  });

  it("rejects a path that could cause the HTML write to replace the PDF", () => {
    expect(() => samplePacketOutputPaths("/tmp/release-audit")).toThrow(
      "must end in .pdf",
    );
    expect(() => samplePacketOutputPaths("/tmp/release-audit.html")).toThrow(
      "must end in .pdf",
    );
  });
});
