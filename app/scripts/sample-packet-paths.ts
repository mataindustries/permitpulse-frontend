const defaultSamplePacketPath =
  "/tmp/permitpulse-professional-packet-sample.pdf";

export function samplePacketOutputPaths(requestedPath?: string): {
  htmlPath: string;
  pdfPath: string;
} {
  const pdfPath = requestedPath ?? defaultSamplePacketPath;

  if (!/\.pdf$/i.test(pdfPath)) {
    throw new Error("The sample packet output path must end in .pdf.");
  }

  return {
    htmlPath: `${pdfPath.slice(0, -4)}.html`,
    pdfPath,
  };
}
