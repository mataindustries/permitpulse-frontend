import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server.browser";
import { PacketDocument } from "./PacketDocument";
import {
  assertCanonicalPacketPresentation,
  buildPacketPresentation,
  type CanonicalPacketPresentation,
} from "./presentation";
import type { PacketModel } from "./types";

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export function renderPacketHtmlPresentation(
  presentation: CanonicalPacketPresentation,
  documentTitle = presentation.title,
): string {
  assertCanonicalPacketPresentation(presentation);
  const documentMarkup = renderToStaticMarkup(
    createElement(PacketDocument, { presentation }),
  );
  const title = escapeHtml(documentTitle);

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="color-scheme" content="light">
  <title>${title}</title>
  <style>
    :root { color-scheme: light; background: #e9ece8; }
    * { box-sizing: border-box; }
    html, body { margin: 0; min-height: 100%; }
    body { background: #e9ece8; padding: 2rem 1rem; }
    @media print { html, body { background: #fff; padding: 0; } }
  </style>
</head>
<body>
  ${documentMarkup}
</body>
</html>`;
}

export function renderPacketHtml(model: PacketModel): string {
  return renderPacketHtmlPresentation(
    buildPacketPresentation(model),
    `${model.title} · ${model.case_summary.project_name}`,
  );
}
