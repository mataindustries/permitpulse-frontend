import {
  PDFDocument,
  StandardFonts,
  rgb,
  type PDFFont,
  type PDFPage,
  type RGB,
} from "pdf-lib";
import {
  assertCanonicalPacketPresentation,
  buildPacketPresentation,
  type CanonicalPacketPresentation,
  type PacketPresentationBlock,
  type PacketPresentationSection,
} from "./presentation";
import { packetRendererVersion } from "./presentation-summary";
import type { PacketModel } from "./types";

const pageWidth = 612;
const pageHeight = 792;
const marginX = 50;
const contentTop = 716;
const contentBottom = 58;
const contentWidth = pageWidth - marginX * 2;
const usableHeight = contentTop - contentBottom;
const minimumSectionContentStartHeight = 90;
const bodySize = 9.2;
const bodyLineHeight = 13.2;
const maxFilenameLength = 128;

const colors = {
  paper: rgb(0.988, 0.984, 0.969),
  ink: rgb(0.13, 0.16, 0.145),
  muted: rgb(0.38, 0.43, 0.4),
  jade: rgb(0.11, 0.45, 0.3),
  jadeDark: rgb(0.08, 0.3, 0.21),
  jadeSoft: rgb(0.91, 0.95, 0.925),
  navy: rgb(0.043, 0.114, 0.173),
  orange: rgb(0.9, 0.39, 0.23),
  warning: rgb(0.71, 0.42, 0.13),
  danger: rgb(0.64, 0.25, 0.23),
  rule: rgb(0.82, 0.84, 0.82),
  soft: rgb(0.94, 0.95, 0.93),
  white: rgb(1, 1, 1),
};

interface PdfState {
  bodyFont: PDFFont;
  boldFont: PDFFont;
  document: PDFDocument;
  page: PDFPage;
  presentation: CanonicalPacketPresentation;
  serifFont: PDFFont;
  serifBoldFont: PDFFont;
  y: number;
}

interface TextOptions {
  color?: RGB;
  font?: PDFFont;
  indent?: number;
  lineHeight?: number;
  paragraphGap?: number;
  size?: number;
  width?: number;
}

function metadataDate(value: string): Date {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? new Date("1970-01-01T00:00:00.000Z")
    : date;
}

function safePdfText(value: string, font: PDFFont): string {
  const withoutControls = value.replace(
    /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g,
    " ",
  );
  let safe = "";

  for (const character of withoutControls) {
    try {
      font.encodeText(character);
      safe += character;
    } catch {
      safe += "?";
    }
  }

  return safe;
}

function widthOf(value: string, font: PDFFont, size: number): number {
  return font.widthOfTextAtSize(value, size);
}

function breakLongWord(
  word: string,
  font: PDFFont,
  size: number,
  width: number,
): string[] {
  const chunks: string[] = [];
  let chunk = "";

  for (const character of word) {
    const candidate = `${chunk}${character}`;
    if (chunk && widthOf(candidate, font, size) > width) {
      chunks.push(chunk);
      chunk = character;
    } else {
      chunk = candidate;
    }
  }

  if (chunk) chunks.push(chunk);
  return chunks;
}

export function wrapPacketPdfText(
  value: string,
  font: PDFFont,
  size: number,
  width: number,
): string[] {
  const rawParagraphs = value.replace(/\r\n?/g, "\n").split("\n");
  while (rawParagraphs[0]?.trim() === "") rawParagraphs.shift();
  while (rawParagraphs.at(-1)?.trim() === "") rawParagraphs.pop();
  const paragraphs = rawParagraphs.reduce<string[]>((output, paragraph) => {
    if (paragraph.trim() !== "") {
      output.push(paragraph);
    } else if (output.length > 0 && output.at(-1) !== "") {
      output.push("");
    }
    return output;
  }, []);

  if (paragraphs.length === 0) return [""];

  return paragraphs.flatMap((paragraph) => {
    if (!paragraph) return [""];
    const words = paragraph.trim().split(/\s+/).filter(Boolean);
    const lines: string[] = [];
    let line = "";

    for (const word of words) {
      const safeWord = safePdfText(word, font);
      const pieces = widthOf(safeWord, font, size) > width
        ? breakLongWord(safeWord, font, size, width)
        : [safeWord];

      for (const piece of pieces) {
        const candidate = line ? `${line} ${piece}` : piece;
        if (line && widthOf(candidate, font, size) > width) {
          lines.push(line);
          line = piece;
        } else {
          line = candidate;
        }
      }
    }

    if (line) lines.push(line);
    return lines.length > 0 ? lines : [""];
  });
}

function wrappedHeight(
  value: string,
  font: PDFFont,
  size: number,
  width: number,
  lineHeight: number,
): number {
  return wrapPacketPdfText(value, font, size, width).length * lineHeight;
}

function drawPageChrome(state: PdfState): void {
  state.page.drawRectangle({ x: 0, y: 0, width: pageWidth, height: pageHeight, color: colors.paper });
  state.page.drawRectangle({ x: 0, y: 742, width: pageWidth, height: 50, color: colors.navy });
  state.page.drawRectangle({ x: 0, y: 789, width: 178, height: 3, color: colors.orange });
  state.page.drawRectangle({ x: 178, y: 789, width: pageWidth - 178, height: 3, color: colors.jade });
  state.page.drawText("PERMITPULSE", { x: marginX, y: 759, font: state.boldFont, size: 10, color: colors.white });
  state.page.drawText("PERMIT INTELLIGENCE", { x: pageWidth - marginX - 112, y: 759, font: state.boldFont, size: 7, color: colors.jadeSoft });
}

function addPage(state: PdfState): void {
  state.page = state.document.addPage([pageWidth, pageHeight]);
  state.y = contentTop;
  drawPageChrome(state);
}

function ensureSpace(state: PdfState, neededHeight: number): void {
  if (neededHeight <= usableHeight && state.y - neededHeight < contentBottom) {
    addPage(state);
  }
}

function drawRule(state: PdfState, y = state.y): void {
  state.page.drawLine({
    start: { x: marginX, y },
    end: { x: pageWidth - marginX, y },
    thickness: 0.6,
    color: colors.rule,
  });
}

function paragraphLines(
  state: PdfState,
  value: string,
  options: TextOptions = {},
): { font: PDFFont; indent: number; lineHeight: number; lines: string[]; size: number; width: number } {
  const font = options.font ?? state.bodyFont;
  const size = options.size ?? bodySize;
  const lineHeight = options.lineHeight ?? bodyLineHeight;
  const indent = options.indent ?? 0;
  const width = options.width ?? contentWidth - indent;
  return {
    font,
    indent,
    lineHeight,
    lines: wrapPacketPdfText(value, font, size, width),
    size,
    width,
  };
}

function drawParagraph(
  state: PdfState,
  value: string,
  options: TextOptions = {},
): void {
  const measured = paragraphLines(state, value, options);
  let index = 0;

  while (index < measured.lines.length) {
    const remaining = measured.lines.length - index;
    let available = Math.floor((state.y - contentBottom) / measured.lineHeight);
    const minimumStart = Math.min(2, remaining);

    if (available < minimumStart) {
      addPage(state);
      available = Math.floor((state.y - contentBottom) / measured.lineHeight);
    }

    const take = packetPdfParagraphLineTake(remaining, available);
    if (take <= 0) {
      addPage(state);
      continue;
    }

    for (let lineIndex = 0; lineIndex < take; lineIndex += 1) {
      state.page.drawText(measured.lines[index + lineIndex] ?? "", {
        x: marginX + measured.indent,
        y: state.y - lineIndex * measured.lineHeight,
        font: measured.font,
        size: measured.size,
        color: options.color ?? colors.ink,
      });
    }
    state.y -= take * measured.lineHeight;
    index += take;
  }

  state.y -= options.paragraphGap ?? 0;
}

export function packetPdfParagraphLineTake(
  remaining: number,
  available: number,
): number {
  if (remaining <= 0 || available <= 0) return 0;
  if (remaining > 1 && available < 2) return 0;

  let take = Math.min(available, remaining);
  if (remaining > take && remaining - take === 1) {
    if (take <= 2) return 0;
    take -= 1;
  }
  return take;
}

function drawTextAt(
  state: PdfState,
  value: string,
  input: {
    color?: RGB;
    font?: PDFFont;
    lineHeight: number;
    size: number;
    width: number;
    x: number;
    y: number;
  },
): number {
  const font = input.font ?? state.bodyFont;
  const lines = wrapPacketPdfText(value, font, input.size, input.width);
  lines.forEach((line, index) => {
    state.page.drawText(line, {
      x: input.x,
      y: input.y - index * input.lineHeight,
      font,
      size: input.size,
      color: input.color ?? colors.ink,
    });
  });
  return input.y - lines.length * input.lineHeight;
}

export function packetSectionHeadingMetrics(
  title: string,
  font: PDFFont,
  width = contentWidth - 34,
): {
  eyebrowHeight: number;
  eyebrowTitleSpacing: number;
  titleHeight: number;
  titleLines: number;
  totalHeight: number;
} {
  const titleLines = wrapPacketPdfText(title, font, 17, width).length;
  const eyebrowHeight = 9;
  const eyebrowTitleSpacing = 6;
  const titleHeight = titleLines * 21;
  return {
    eyebrowHeight,
    eyebrowTitleSpacing,
    titleHeight,
    titleLines,
    totalHeight: 8 + 12 + eyebrowHeight + eyebrowTitleSpacing + titleHeight + 9,
  };
}

export function packetPdfSectionStartReservation(
  headingHeight: number,
  introHeight: number,
): number {
  return headingHeight + introHeight + minimumSectionContentStartHeight;
}

export function packetPdfSubgroupStartReservation(
  headingHeight: number,
  firstBlockHeight: number,
): number {
  return Math.max(0, headingHeight) + Math.max(0, firstBlockHeight);
}

function drawSectionHeading(
  state: PdfState,
  section: PacketPresentationSection,
): void {
  const heading = packetSectionHeadingMetrics(section.title, state.serifBoldFont);
  const introHeight = section.intro
    ? wrappedHeight(section.intro, state.bodyFont, 8, contentWidth - 34, 11) + 8
    : 0;
  ensureSpace(
    state,
    packetPdfSectionStartReservation(heading.totalHeight, introHeight),
  );
  state.y -= 8;
  drawParagraph(state, section.number, { color: colors.orange, font: state.boldFont, size: 8, lineHeight: 12 });
  state.y += 12;
  drawParagraph(state, "CLIENT DELIVERABLE", { color: colors.jade, font: state.boldFont, size: 6, lineHeight: 9, indent: 34 });
  state.y -= heading.eyebrowTitleSpacing;
  drawParagraph(state, section.title, { color: colors.navy, font: state.serifBoldFont, size: 17, lineHeight: 21, indent: 34, width: contentWidth - 34 });
  state.page.drawLine({
    start: { x: marginX + 34, y: state.y + 4 },
    end: { x: pageWidth - marginX, y: state.y + 4 },
    thickness: 0.7,
    color: colors.rule,
  });
  state.y -= 9;
  if (section.intro) {
    drawParagraph(state, section.intro, { color: colors.muted, indent: 34, width: contentWidth - 34, size: 8, lineHeight: 11, paragraphGap: 8 });
  }
}

function drawEmptyState(state: PdfState, message: string): void {
  const height = Math.max(
    42,
    wrappedHeight(message, state.bodyFont, 8.5, contentWidth - 168, 11) + 20,
  );
  ensureSpace(state, height + 8);
  const top = state.y;
  drawRule(state, top);
  drawRule(state, top - height);
  state.page.drawText("SECTION STATUS", { x: marginX, y: top - 17, font: state.boldFont, size: 6.5, color: colors.jade });
  drawTextAt(state, message, { x: marginX + 150, y: top - 17, width: contentWidth - 150, font: state.bodyFont, size: 8.5, lineHeight: 11, color: colors.muted });
  state.y -= height + 10;
}

function drawCover(
  state: PdfState,
  block: Extract<PacketPresentationBlock, { kind: "cover" }>,
): void {
  state.page.drawText("01 / COVER / CLIENT DELIVERABLE", { x: marginX, y: state.y, font: state.boldFont, size: 7, color: colors.jade });
  state.y -= 30;
  drawParagraph(state, block.title, { font: state.serifBoldFont, color: colors.navy, size: 29, lineHeight: 32, width: 360, paragraphGap: 10 });
  drawParagraph(state, block.project_name, { font: state.boldFont, color: colors.jadeDark, size: 13, lineHeight: 16, width: 380, paragraphGap: 4 });
  drawParagraph(state, block.location, { color: colors.muted, size: 8.5, lineHeight: 11, width: 380, paragraphGap: 22 });

  const identity = [
    ["Prepared for", block.client_name],
    ["Jurisdiction", block.jurisdiction],
    ["Permit identifier", block.permit_identifier],
    ["Packet status", `${block.lifecycle_status} / ${block.packet_status}`],
    ["Packet version", String(block.packet_version)],
    ["Generated", block.generated_at_label],
  ] as const;
  const panelHeight = identity.reduce(
    (height, [, value]) => height + 13 + wrappedHeight(value, state.boldFont, 8.2, contentWidth - 32, 10),
    24,
  );
  ensureSpace(state, panelHeight + 20);
  const top = state.y;
  state.page.drawRectangle({ x: marginX, y: top - panelHeight, width: contentWidth, height: panelHeight, color: colors.soft, borderColor: colors.rule, borderWidth: 0.7 });
  let cursor = top - 17;
  identity.forEach(([label, value]) => {
    state.page.drawText(label.toUpperCase(), { x: marginX + 16, y: cursor, font: state.boldFont, size: 6, color: colors.jade });
    cursor = drawTextAt(state, value, { x: marginX + 150, y: cursor, width: contentWidth - 170, font: state.boldFont, size: 8.2, lineHeight: 10, color: colors.ink }) - 7;
  });
  state.y = top - panelHeight - 18;
  const noticeHeight = wrappedHeight(block.draft_notice, state.bodyFont, 7.5, contentWidth - 30, 10) + 22;
  ensureSpace(state, noticeHeight);
  state.page.drawRectangle({ x: marginX, y: state.y - noticeHeight, width: contentWidth, height: noticeHeight, color: colors.jadeSoft });
  state.page.drawRectangle({ x: marginX, y: state.y - noticeHeight, width: 4, height: noticeHeight, color: colors.jade });
  drawTextAt(state, block.draft_notice, { x: marginX + 15, y: state.y - 14, width: contentWidth - 30, font: state.bodyFont, size: 7.5, lineHeight: 10, color: colors.jadeDark });
  state.y -= noticeHeight + 10;
}

function drawExecutiveSummary(
  state: PdfState,
  block: Extract<PacketPresentationBlock, { kind: "executive_summary" }>,
): void {
  drawParagraph(state, block.summary, { font: state.serifFont, size: 11, lineHeight: 15.5, paragraphGap: 12 });
  for (const item of block.decision_lines) {
    const height = 18 + wrappedHeight(item.value, state.bodyFont, 8.5, contentWidth - 24, 11) + 10;
    if (height > usableHeight - 20) {
      drawKeepTogetherGroup(state, item.label, [item.value]);
      continue;
    }
    ensureSpace(state, height + 7);
    const top = state.y;
    state.page.drawRectangle({ x: marginX, y: top - height, width: contentWidth, height, color: colors.white, borderColor: colors.rule, borderWidth: 0.6 });
    state.page.drawText(item.label.toUpperCase(), { x: marginX + 12, y: top - 15, font: state.boldFont, size: 6.5, color: colors.jade });
    drawTextAt(state, item.value, { x: marginX + 12, y: top - 31, width: contentWidth - 24, font: state.bodyFont, size: 8.5, lineHeight: 11, color: colors.ink });
    state.y -= height + 7;
  }
  const groups = [
    ["Key risks", block.key_risks, colors.warning],
    ["Key strengths", block.key_strengths, colors.jadeDark],
  ] as const;
  for (const [label, items, color] of groups) {
    if (items.length === 0) continue;
    ensureSpace(state, 42);
    drawParagraph(state, label.toUpperCase(), { font: state.boldFont, size: 6.5, lineHeight: 10, color });
    for (const item of items) {
      drawParagraph(state, `- ${item}`, { indent: 8, width: contentWidth - 8, size: 8.5, lineHeight: 11, paragraphGap: 3 });
    }
    state.y -= 5;
  }
}

function drawCaseSnapshot(
  state: PdfState,
  block: Extract<PacketPresentationBlock, { kind: "case_snapshot" }>,
): void {
  for (const fact of block.facts) {
    const value = fact.information_class === "missing_information" ? "Pending record entry" : fact.value;
    const height = 16 + wrappedHeight(value, state.boldFont, 8.8, contentWidth - 24, 11) + 9;
    ensureSpace(state, height + 4);
    drawRule(state);
    state.page.drawText(fact.label.toUpperCase(), { x: marginX, y: state.y - 13, font: state.boldFont, size: 6.3, color: colors.muted });
    drawTextAt(state, value, { x: marginX + 145, y: state.y - 13, width: contentWidth - 145, font: state.boldFont, size: 8.8, lineHeight: 11, color: fact.information_class === "missing_information" ? colors.warning : colors.ink });
    state.y -= height;
  }
  state.y -= 8;
  const statusLines = [
    `Case workflow status: ${block.workflow_status}`,
    `Investigation state: ${block.investigation_state}`,
    `Packet Readiness: ${block.packet_readiness}`,
    block.resolution_notice,
    `Case record updated ${block.record_updated_at}`,
  ];
  const height = statusLines.reduce((total, line, index) => total + wrappedHeight(line, index === 0 ? state.boldFont : state.bodyFont, index === 0 ? 10 : 7.5, contentWidth - 34, index === 0 ? 13 : 10), 24);
  ensureSpace(state, height);
  const top = state.y;
  state.page.drawRectangle({ x: marginX, y: top - height, width: contentWidth, height, color: colors.jadeSoft });
  state.page.drawRectangle({ x: marginX, y: top - height, width: 4, height, color: colors.jade });
  let cursor = top - 17;
  statusLines.forEach((line, index) => {
    cursor = drawTextAt(state, line, { x: marginX + 17, y: cursor, width: contentWidth - 34, font: index === 0 ? state.boldFont : state.bodyFont, size: index === 0 ? 10 : 7.5, lineHeight: index === 0 ? 13 : 10, color: index === 3 ? colors.warning : index === 0 ? colors.jadeDark : colors.muted }) - 4;
  });
  state.y -= height + 8;
}

function drawEditorialList(
  state: PdfState,
  block: Extract<PacketPresentationBlock, { kind: "editorial_list" }>,
): void {
  if (block.items.length === 0) {
    drawEmptyState(state, block.empty_message);
    return;
  }

  block.items.forEach((item, index) => {
    const textWidth = contentWidth - 96;
    const citation = item.citation_references.length > 0
      ? `Supported by ${item.citation_references.join(", ")}`
      : "";
    const height = Math.max(
      48,
      20 + wrappedHeight(item.text, state.serifFont, 10.5, textWidth, 14) +
        (citation ? wrappedHeight(citation, state.boldFont, 6.2, textWidth, 8) + 8 : 0),
    );

    if (height > usableHeight - 20) {
      ensureSpace(state, 70);
      drawParagraph(state, `${block.item_label.toUpperCase()} ${String(index + 1).padStart(2, "0")}`, { font: state.boldFont, color: colors.jade, size: 7, lineHeight: 11 });
      drawParagraph(state, item.text, { font: state.serifFont, size: 10.5, lineHeight: 14, paragraphGap: 5 });
      if (citation) drawParagraph(state, citation, { font: state.boldFont, color: colors.jadeDark, size: 6.2, lineHeight: 8, paragraphGap: 8 });
      return;
    }

    ensureSpace(state, height + 8);
    const top = state.y;
    state.page.drawRectangle({ x: marginX, y: top - height, width: 70, height, color: colors.soft });
    state.page.drawRectangle({ x: marginX, y: top - height, width: 3, height, color: colors.orange });
    state.page.drawText(block.item_label.toUpperCase(), { x: marginX + 11, y: top - 17, font: state.boldFont, size: 5.8, color: colors.jade });
    state.page.drawText(String(index + 1).padStart(2, "0"), { x: marginX + 11, y: top - 37, font: state.boldFont, size: 13, color: colors.orange });
    let cursor = drawTextAt(state, item.text, { x: marginX + 84, y: top - 18, width: textWidth, font: state.serifFont, size: 10.5, lineHeight: 14, color: colors.ink });
    if (citation) {
      drawTextAt(state, citation, { x: marginX + 84, y: cursor - 4, width: textWidth, font: state.boldFont, size: 6.2, lineHeight: 8, color: colors.jadeDark });
    }
    state.y -= height + 8;
  });
}

function drawDependencyMap(
  state: PdfState,
  block: Extract<PacketPresentationBlock, { kind: "dependency_map" }>,
): void {
  if (block.items.length === 0) {
    drawEmptyState(state, block.empty_message);
    return;
  }

  block.items.forEach((item, index) => {
    const lines = [
      ["Discipline", item.discipline],
      ["Blocking issue", item.blocking_issue],
      ["Dependent review", item.dependent_review],
      ["Recommended next step", item.recommended_next_step],
      ["Supported by", item.citation_references.join(", ")],
    ] as const;
    const height = lines.reduce(
      (total, [, value]) => total + 13 + wrappedHeight(value, state.bodyFont, 8, contentWidth - 42, 10),
      20,
    );
    if (height <= usableHeight - 20) ensureSpace(state, height + 10);
    else ensureSpace(state, 70);
    const top = state.y;

    if (height <= usableHeight - 20) {
      state.page.drawRectangle({ x: marginX, y: top - height, width: contentWidth, height, color: colors.white, borderColor: colors.rule, borderWidth: 0.7 });
      state.page.drawRectangle({ x: marginX, y: top - height, width: 4, height, color: colors.jade });
    }
    drawParagraph(state, `DEPENDENCY ${String(index + 1).padStart(2, "0")}`, { indent: 14, width: contentWidth - 28, font: state.boldFont, color: colors.orange, size: 6.5, lineHeight: 12, paragraphGap: 2 });
    lines.forEach(([label, value], lineIndex) => {
      drawParagraph(state, `${lineIndex > 0 ? "DOWN / " : ""}${label.toUpperCase()}`, { indent: 14, width: contentWidth - 28, font: state.boldFont, color: colors.jade, size: 6.2, lineHeight: 10 });
      drawParagraph(state, value, { indent: 22, width: contentWidth - 44, font: lineIndex === 3 ? state.boldFont : state.bodyFont, color: lineIndex === 3 ? colors.jadeDark : colors.ink, size: 8, lineHeight: 10, paragraphGap: 3 });
    });
    if (height <= usableHeight - 20) state.y = top - height - 10;
  });
}

function drawKeepTogetherGroup(
  state: PdfState,
  title: string,
  paragraphs: string[],
  options: { accent?: RGB; background?: RGB } = {},
): void {
  const innerWidth = contentWidth - 28;
  const height = 26 + paragraphs.reduce(
    (total, value) => total + wrappedHeight(value, state.bodyFont, 8.3, innerWidth, 11) + 5,
    0,
  );
  const keepTogether = height <= usableHeight - 20;
  if (keepTogether) ensureSpace(state, height + 9);
  else ensureSpace(state, 70);
  const top = state.y;

  if (keepTogether) {
    state.page.drawRectangle({ x: marginX, y: top - height, width: contentWidth, height, color: options.background ?? colors.white, borderColor: colors.rule, borderWidth: 0.7 });
    state.page.drawRectangle({ x: marginX, y: top - height, width: 4, height, color: options.accent ?? colors.jade });
  }
  drawParagraph(state, title.toUpperCase(), { indent: 14, width: innerWidth, font: state.boldFont, color: options.accent ?? colors.jade, size: 6.5, lineHeight: 12, paragraphGap: 3 });
  paragraphs.forEach((value) => drawParagraph(state, value, { indent: 14, width: innerWidth, size: 8.3, lineHeight: 11, paragraphGap: 5 }));
  if (keepTogether) state.y = top - height - 9;
}

function drawActionKit(
  state: PdfState,
  block: Extract<PacketPresentationBlock, { kind: "action_kit" }>,
): void {
  const kit = block.kit;
  if (!kit) {
    drawEmptyState(state, block.empty_message);
    return;
  }
  drawKeepTogetherGroup(state, "Agency follow-up email", [
    `Subject: ${kit.email_subject}`,
    `Recommended contact: ${kit.recipient_role}`,
    kit.message_body,
    ...(kit.citation_references.length > 0
      ? [`Supported by ${kit.citation_references.join(", ")}`]
      : []),
  ]);
  drawKeepTogetherGroup(state, "Requested confirmations", kit.requested_confirmations.map((item, index) => `${index + 1}. ${item}`));
  drawKeepTogetherGroup(state, "Call script", kit.call_checklist.map((item, index) => `${index + 1}. ${item}`));
  drawKeepTogetherGroup(
    state,
    "Documents to have ready",
    kit.documents_ready.length > 0 ? kit.documents_ready.map((item) => `- ${item}`) : ["Use only the cited packet sources listed above."],
  );
  drawKeepTogetherGroup(state, "Escalation summary", [
    kit.escalation_trigger,
    `Recommended next contact: ${kit.recipient_role}`,
    ...(kit.follow_up_date ? [`Review date: ${kit.follow_up_date}`] : []),
  ], { accent: colors.orange, background: rgb(0.985, 0.956, 0.91) });
}

function cardHeight(
  state: PdfState,
  values: readonly { font?: PDFFont; lineHeight: number; size: number; value: string; width?: number }[],
  padding = 30,
): number {
  return values.reduce(
    (total, item) => total + wrappedHeight(item.value, item.font ?? state.bodyFont, item.size, item.width ?? contentWidth - 32, item.lineHeight),
    padding,
  );
}

function drawTimeline(
  state: PdfState,
  block: Extract<PacketPresentationBlock, { kind: "timeline" }>,
): void {
  if (block.items.length === 0) {
    drawEmptyState(state, block.empty_message);
    return;
  }

  block.items.forEach((entry, index) => {
    const support = entry.linked_evidence.length > 0
      ? entry.linked_evidence.map((item) => `${item.verification_label} / ${item.title}`)
      : ["No supporting evidence linked. Evidence linkage has not been recorded for this event."];
    const heading = `EVENT ${String(index + 1).padStart(2, "0")} / ${entry.occurred_on_label} / ${entry.timeline_type_label}`;
    const reviewStatus = `${entry.source_label} record / ${entry.review_label}`;
    const supportRows = support.map((value) => `- ${value}`);
    const height =
      wrappedHeight(heading, state.boldFont, 6.5, contentWidth - 30, 11) + 3 +
      wrappedHeight(entry.title, state.serifBoldFont, 11, contentWidth - 30, 14) + 5 +
      wrappedHeight(reviewStatus, state.bodyFont, 7, contentWidth - 30, 9) + 5 +
      wrappedHeight(entry.details, state.bodyFont, 8.3, contentWidth - 30, 11) + 7 +
      wrappedHeight("SUPPORTING EVIDENCE", state.boldFont, 6.2, contentWidth - 30, 9) + 2 +
      supportRows.reduce(
        (total, value) =>
          total + wrappedHeight(value, state.bodyFont, 7.3, contentWidth - 44, 9) + 3,
        0,
      ) +
      8;
    const keepTogether = height <= usableHeight - 20;
    if (keepTogether) ensureSpace(state, height + 12);
    else ensureSpace(state, 90);
    const top = state.y;
    if (keepTogether) {
      state.page.drawRectangle({ x: marginX, y: top - height, width: contentWidth, height, color: colors.white, borderColor: colors.rule, borderWidth: 0.7 });
      state.page.drawRectangle({ x: marginX, y: top - height, width: 4, height, color: colors.orange });
    }
    drawParagraph(state, heading, { indent: 15, width: contentWidth - 30, font: state.boldFont, color: colors.jade, size: 6.5, lineHeight: 11, paragraphGap: 3 });
    drawParagraph(state, entry.title, { indent: 15, width: contentWidth - 30, font: state.serifBoldFont, color: colors.navy, size: 11, lineHeight: 14, paragraphGap: 5 });
    drawParagraph(state, reviewStatus, { indent: 15, width: contentWidth - 30, color: colors.muted, size: 7, lineHeight: 9, paragraphGap: 5 });
    drawParagraph(state, entry.details, { indent: 15, width: contentWidth - 30, size: 8.3, lineHeight: 11, paragraphGap: 7 });
    drawParagraph(state, "SUPPORTING EVIDENCE", { indent: 15, width: contentWidth - 30, font: state.boldFont, color: colors.muted, size: 6.2, lineHeight: 9, paragraphGap: 2 });
    supportRows.forEach((value) => drawParagraph(state, value, { indent: 22, width: contentWidth - 44, color: entry.linked_evidence.length > 0 ? colors.muted : colors.warning, size: 7.3, lineHeight: 9, paragraphGap: 3 }));
    if (keepTogether) state.y = top - height - 12;
  });
}

function drawEvidence(
  state: PdfState,
  block: Extract<PacketPresentationBlock, { kind: "evidence" }>,
): void {
  if (block.items.length === 0) {
    drawEmptyState(state, block.empty_message);
    return;
  }

  block.items.forEach((item, index) => {
    const metadata = [
      ...(item.source.label?.trim() ? [`Source: ${item.source.label}`] : []),
      `Contributor: ${item.contributor_label ?? "Contributor not recorded"}`,
      ...(item.source.date ? [`Source date: ${item.source.date_label}`] : []),
      ...(item.source_href ? [`Provenance: ${item.source_href}`] : []),
      ...(item.missing_details.length > 0 ? [`Source details pending: ${item.missing_details.join(", ")}.`] : []),
    ];
    const values = [
      { value: item.title, font: state.serifBoldFont, size: 11.5, lineHeight: 14 },
      { value: item.summary, size: 8.5, lineHeight: 11 },
      ...metadata.map((value) => ({ value, size: 7.4, lineHeight: 10 })),
      { value: item.verification_note, size: 7.4, lineHeight: 10 },
    ];
    const height = cardHeight(state, values, 65);
    const keepTogether = height <= usableHeight - 20;
    if (keepTogether) ensureSpace(state, height + 12);
    else ensureSpace(state, 90);
    const top = state.y;
    if (keepTogether) {
      state.page.drawRectangle({ x: marginX, y: top - height, width: contentWidth, height, color: colors.white, borderColor: colors.rule, borderWidth: 0.7 });
      state.page.drawRectangle({ x: marginX, y: top - height, width: 4, height, color: colors.jade });
    }
    drawParagraph(state, `EVIDENCE ${String(index + 1).padStart(2, "0")} / ${item.evidence_type_label} / ${item.verification_label}`, { indent: 15, width: contentWidth - 30, font: state.boldFont, color: colors.jade, size: 6.5, lineHeight: 11, paragraphGap: 3 });
    drawParagraph(state, item.title, { indent: 15, width: contentWidth - 30, font: state.serifBoldFont, color: colors.navy, size: 11.5, lineHeight: 14, paragraphGap: 6 });
    drawParagraph(state, item.summary, { indent: 15, width: contentWidth - 30, size: 8.5, lineHeight: 11, paragraphGap: 7 });
    metadata.forEach((value) => drawParagraph(state, value, { indent: 15, width: contentWidth - 30, color: value.startsWith("Source details pending") ? colors.warning : colors.muted, size: 7.4, lineHeight: 10, paragraphGap: 3 }));
    drawParagraph(state, "REVIEWER NOTE", { indent: 15, width: contentWidth - 30, font: state.boldFont, color: colors.jade, size: 6.2, lineHeight: 9, paragraphGap: 2 });
    drawParagraph(state, item.verification_note, { indent: 15, width: contentWidth - 30, color: colors.muted, size: 7.4, lineHeight: 10, paragraphGap: 4 });
    if (keepTogether) state.y = top - height - 12;
  });
}

function drawSources(
  state: PdfState,
  block: Extract<PacketPresentationBlock, { kind: "sources" }>,
): void {
  if (block.items.length === 0) {
    drawEmptyState(state, block.empty_message);
    return;
  }

  block.items.forEach((source, index) => {
    const lines = [
      source.title,
      `${source.label_display} / ${source.date_display}`,
      `Contributor: ${source.contributor_label ?? "Contributor not recorded"}`,
      `Provenance: ${source.source_href ?? "Digital provenance not recorded"}`,
      `Review: ${source.verification_label}`,
    ];
    const height = 22 + lines.reduce((total, value, lineIndex) => total + wrappedHeight(value, lineIndex === 0 ? state.boldFont : state.bodyFont, lineIndex === 0 ? 8.8 : 7.2, contentWidth - 34, lineIndex === 0 ? 11 : 9) + 3, 0);
    ensureSpace(state, height + 8);
    const top = state.y;
    state.page.drawRectangle({ x: marginX, y: top - height, width: contentWidth, height, color: index % 2 === 0 ? colors.white : colors.soft, borderColor: colors.rule, borderWidth: 0.5 });
    drawParagraph(state, `SOURCE ${String(index + 1).padStart(2, "0")}`, { indent: 14, width: contentWidth - 28, font: state.boldFont, color: colors.orange, size: 6.2, lineHeight: 10, paragraphGap: 2 });
    lines.forEach((value, lineIndex) => drawParagraph(state, value, { indent: 14, width: contentWidth - 28, font: lineIndex === 0 ? state.boldFont : state.bodyFont, color: lineIndex === 3 && source.source_href ? colors.jadeDark : lineIndex === 0 ? colors.ink : colors.muted, size: lineIndex === 0 ? 8.8 : 7.2, lineHeight: lineIndex === 0 ? 11 : 9, paragraphGap: 3 }));
    state.y = top - height - 8;
  });
}

function drawMetric(
  state: PdfState,
  label: string,
  value: string,
  detail: string,
  dark = false,
): void {
  const height = 30 + wrappedHeight(value, state.boldFont, 10, contentWidth - 30, 13) + wrappedHeight(detail, state.bodyFont, 7.2, contentWidth - 30, 9) + 10;
  ensureSpace(state, height + 7);
  const top = state.y;
  state.page.drawRectangle({ x: marginX, y: top - height, width: contentWidth, height, color: dark ? colors.navy : colors.white, borderColor: dark ? colors.navy : colors.rule, borderWidth: 0.7 });
  state.page.drawRectangle({ x: marginX, y: top - height, width: 4, height, color: dark ? colors.orange : colors.jade });
  state.page.drawText(label.toUpperCase(), { x: marginX + 15, y: top - 16, font: state.boldFont, size: 6.2, color: dark ? colors.jadeSoft : colors.muted });
  let cursor = drawTextAt(state, value, { x: marginX + 15, y: top - 34, width: contentWidth - 30, font: state.boldFont, size: 10, lineHeight: 13, color: dark ? colors.white : colors.ink });
  drawTextAt(state, detail, { x: marginX + 15, y: cursor - 4, width: contentWidth - 30, font: state.bodyFont, size: 7.2, lineHeight: 9, color: dark ? colors.jadeSoft : colors.muted });
  state.y -= height + 7;
}

function drawReadiness(
  state: PdfState,
  block: Extract<PacketPresentationBlock, { kind: "readiness" }>,
): void {
  const conclusionHeight = wrappedHeight(block.conclusion, state.serifBoldFont, 11, contentWidth - 30, 15) + 24;
  ensureSpace(state, conclusionHeight + 8);
  state.page.drawRectangle({ x: marginX, y: state.y - conclusionHeight, width: contentWidth, height: conclusionHeight, color: colors.jadeSoft });
  state.page.drawRectangle({ x: marginX, y: state.y - conclusionHeight, width: 4, height: conclusionHeight, color: colors.jade });
  drawTextAt(state, block.conclusion, { x: marginX + 15, y: state.y - 17, width: contentWidth - 30, font: state.serifBoldFont, size: 11, lineHeight: 15, color: colors.jadeDark });
  state.y -= conclusionHeight + 10;
  drawParagraph(state, block.methodology, { size: 8.6, lineHeight: 12, paragraphGap: 10 });

  const dashboard = block.dashboard;
  drawMetric(state, "Investigation state", dashboard.permit_status, "Current record condition; not a jurisdiction disposition");
  drawMetric(state, "Investigation Health", dashboard.mission_health.label, `${dashboard.mission_health.score}% / ${dashboard.mission_health.explanation}`);
  drawMetric(state, "Packet Readiness", `${dashboard.readiness.completed} of ${dashboard.readiness.total} checks complete`, dashboard.readiness.explanation, true);

  drawKeepTogetherGroup(
    state,
    "Packet-readiness conditions",
    dashboard.blockers.length > 0
      ? dashboard.blockers.map((item) => `${item.title} / ${item.resolution}`)
      : ["No packet-readiness conditions remain. Open agency findings do not indicate jurisdiction resolution."],
  );
  drawKeepTogetherGroup(state, "Recommended next action", [
    dashboard.recommended_action.title,
    dashboard.recommended_action.detail,
  ], { accent: colors.jade, background: colors.jadeSoft });
  drawKeepTogetherGroup(state, "Evidence summary", [
    dashboard.evidence.text,
    `Verified ${dashboard.evidence.verified} / Unverified ${dashboard.evidence.unverified} / Disputed ${dashboard.evidence.disputed} / Provenance issues ${dashboard.evidence.provenance_issues}`,
  ]);

  const factorRows = dashboard.factors.map((factor) => {
    const value = `${factor.passed ? "PASS" : "OPEN"} / ${factor.label} / ${factor.detail}`;
    const height = wrappedHeight(value, factor.passed ? state.bodyFont : state.boldFont, 7.5, contentWidth - 24, 10) + 18;
    return { factor, height, value };
  });
  ensureSpace(
    state,
    packetPdfSubgroupStartReservation(
      14,
      factorRows[0] ? factorRows[0].height + 5 : 0,
    ),
  );
  drawParagraph(state, "PACKET READINESS CHECKS", { font: state.boldFont, color: colors.jade, size: 6.5, lineHeight: 11, paragraphGap: 3 });
  factorRows.forEach(({ factor, height, value }) => {
    ensureSpace(state, height + 5);
    const top = state.y;
    state.page.drawRectangle({ x: marginX, y: top - height, width: contentWidth, height, color: colors.soft });
    drawTextAt(state, value, { x: marginX + 12, y: top - 14, width: contentWidth - 24, font: factor.passed ? state.bodyFont : state.boldFont, size: 7.5, lineHeight: 10, color: factor.passed ? colors.jadeDark : colors.warning });
    state.y -= height + 5;
  });

  if (block.warnings.length > 0) {
    drawKeepTogetherGroup(state, "Packet notes", block.warnings, { accent: colors.warning, background: rgb(0.985, 0.956, 0.91) });
  }
  const metadataLines = block.metadata.map(
    (item) => `${item.label}: ${item.value}`,
  );
  const firstMetadataHeight = metadataLines[0]
    ? wrappedHeight(metadataLines[0], state.bodyFont, 7.6, contentWidth, 10) + 3
    : 0;
  ensureSpace(
    state,
    packetPdfSubgroupStartReservation(13, firstMetadataHeight),
  );
  drawParagraph(state, "PACKET METADATA", { font: state.boldFont, color: colors.jade, size: 6.5, lineHeight: 11, paragraphGap: 2 });
  metadataLines.forEach((value) => drawParagraph(state, value, { size: 7.6, lineHeight: 10, paragraphGap: 3 }));
  state.y -= 5;
  drawRule(state);
  state.y -= 12;
  drawParagraph(state, `USE LIMITATION / ${block.disclaimer}`, { color: colors.muted, size: 7.7, lineHeight: 10.5 });
}

function drawDisclosure(
  state: PdfState,
  block: Extract<PacketPresentationBlock, { kind: "disclosure" }>,
): void {
  const height = wrappedHeight(block.text, state.bodyFont, 9, contentWidth - 30, 13) + 28;
  ensureSpace(state, height);
  state.page.drawRectangle({ x: marginX, y: state.y - height, width: contentWidth, height, color: block.applies ? rgb(0.985, 0.956, 0.91) : colors.soft, borderColor: colors.rule, borderWidth: 0.7 });
  state.page.drawRectangle({ x: marginX, y: state.y - height, width: 4, height, color: block.applies ? colors.orange : colors.jade });
  drawTextAt(state, block.text, { x: marginX + 15, y: state.y - 18, width: contentWidth - 30, font: state.bodyFont, size: 9, lineHeight: 13, color: colors.ink });
  state.y -= height + 8;
}

function drawBlock(state: PdfState, block: PacketPresentationBlock): void {
  switch (block.kind) {
    case "cover":
      drawCover(state, block);
      return;
    case "executive_summary":
      drawExecutiveSummary(state, block);
      return;
    case "case_snapshot":
      drawCaseSnapshot(state, block);
      return;
    case "editorial_list":
      drawEditorialList(state, block);
      return;
    case "dependency_map":
      drawDependencyMap(state, block);
      return;
    case "action_kit":
      drawActionKit(state, block);
      return;
    case "timeline":
      drawTimeline(state, block);
      return;
    case "evidence":
      drawEvidence(state, block);
      return;
    case "sources":
      drawSources(state, block);
      return;
    case "readiness":
      drawReadiness(state, block);
      return;
    case "disclosure":
      drawDisclosure(state, block);
      return;
    default:
      unsupportedPacketBlock(block);
  }
}

function unsupportedPacketBlock(block: never): never {
  const kind = (block as { kind?: unknown }).kind;
  throw new Error(`Unsupported canonical packet block: ${String(kind)}`);
}

function drawFooters(state: PdfState): void {
  const pages = state.document.getPages();
  pages.forEach((page, index) => {
    page.drawLine({ start: { x: marginX, y: 42 }, end: { x: pageWidth - marginX, y: 42 }, thickness: 0.6, color: colors.rule });
    page.drawText(state.presentation.footer, {
      x: marginX,
      y: 30,
      font: state.bodyFont,
      size: 6.2,
      color: colors.ink,
    });
    page.drawText("PermitPulse / Confirm source records before reliance", {
      x: marginX,
      y: 18,
      font: state.bodyFont,
      size: 5.8,
      color: colors.muted,
    });
    const pageLabel = `Page ${index + 1} of ${pages.length}`;
    page.drawText(pageLabel, { x: pageWidth - marginX - widthOf(pageLabel, state.boldFont, 6), y: 18, font: state.boldFont, size: 6, color: colors.ink });
  });
}

function slugifyFilenamePart(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64)
    .replace(/-+$/g, "");
}

export function safePacketPdfFilename(
  model: PacketModel,
  _caseId?: string,
): string {
  const projectSlug = slugifyFilenamePart(model.case_summary.project_name);
  const fallbackSlug = slugifyFilenamePart(model.jurisdiction) || "case";
  const filename = `permitpulse-${projectSlug || fallbackSlug}-packet-v${model.packet_version}.pdf`;
  return filename.length <= maxFilenameLength
    ? filename
    : `${filename.slice(0, maxFilenameLength - 4).replace(/-+$/g, "")}.pdf`;
}

export async function renderPacketPdfPresentation(
  presentation: CanonicalPacketPresentation,
  documentTitle = presentation.title,
): Promise<Uint8Array> {
  assertCanonicalPacketPresentation(presentation);
  const document = await PDFDocument.create();
  const bodyFont = await document.embedFont(StandardFonts.Helvetica);
  const boldFont = await document.embedFont(StandardFonts.HelveticaBold);
  const serifFont = await document.embedFont(StandardFonts.TimesRoman);
  const serifBoldFont = await document.embedFont(StandardFonts.TimesRomanBold);
  const firstPage = document.addPage([pageWidth, pageHeight]);
  const state: PdfState = {
    bodyFont,
    boldFont,
    document,
    page: firstPage,
    presentation,
    serifFont,
    serifBoldFont,
    y: contentTop,
  };
  const date = metadataDate(presentation.generated_at);

  document.setTitle(documentTitle);
  document.setAuthor("PermitPulse");
  document.setSubject("Client-facing permit review packet");
  document.setCreator("PermitPulse Canonical Packet Renderer");
  document.setProducer(`PermitPulse canonical pdf adapter v${packetRendererVersion}`);
  document.setKeywords(["PermitPulse", "permit", "canonical packet", "evidence", "timeline"]);
  document.setCreationDate(date);
  document.setModificationDate(date);

  drawPageChrome(state);
  presentation.sections.forEach((section, index) => {
    if (section.id === "cover") {
      section.blocks.forEach((block) => drawBlock(state, block));
      if (index < presentation.sections.length - 1) addPage(state);
      return;
    }

    drawSectionHeading(state, section);
    section.blocks.forEach((block) => drawBlock(state, block));
  });
  drawFooters(state);

  return document.save({ addDefaultPage: false, useObjectStreams: false });
}

export async function renderPacketPdf(model: PacketModel): Promise<Uint8Array> {
  return renderPacketPdfPresentation(
    buildPacketPresentation(model),
    `${model.title} - ${model.case_summary.project_name}`,
  );
}
