import {
  PDFDocument,
  StandardFonts,
  rgb,
  type PDFFont,
  type PDFPage,
  type RGB,
} from "pdf-lib";
import {
  packetSectionNumber,
  packetSectionTitle,
} from "./presentation";
import type { PacketModel, PacketSectionId } from "./types";

const pageWidth = 612;
const pageHeight = 792;
const marginX = 50;
const contentTop = 716;
const contentBottom = 58;
const contentWidth = pageWidth - marginX * 2;
const bodySize = 9.5;
const bodyLineHeight = 13.5;
const maxFilenameLength = 128;

const colors = {
  paper: rgb(0.988, 0.984, 0.969),
  ink: rgb(0.13, 0.16, 0.145),
  muted: rgb(0.38, 0.43, 0.4),
  jade: rgb(0.11, 0.45, 0.3),
  jadeDark: rgb(0.08, 0.3, 0.21),
  rule: rgb(0.82, 0.84, 0.82),
  soft: rgb(0.94, 0.95, 0.93),
  white: rgb(1, 1, 1),
};

interface PdfState {
  bodyFont: PDFFont;
  boldFont: PDFFont;
  document: PDFDocument;
  model: PacketModel;
  page: PDFPage;
  serifFont: PDFFont;
  serifBoldFont: PDFFont;
  y: number;
}

interface TextOptions {
  color?: RGB;
  font?: PDFFont;
  indent?: number;
  lineHeight?: number;
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

  if (chunk) {
    chunks.push(chunk);
  }

  return chunks;
}

export function wrapPacketPdfText(
  value: string,
  font: PDFFont,
  size: number,
  width: number,
): string[] {
  const paragraphs = value.split(/\r?\n/);

  return paragraphs.flatMap((paragraph) => {
    const words = paragraph.trim().split(/\s+/).filter(Boolean);
    const lines: string[] = [];
    let line = "";

    for (const word of words) {
      const safeWord = safePdfText(word, font);
      const pieces =
        widthOf(safeWord, font, size) > width
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

    if (line) {
      lines.push(line);
    }

    return lines.length > 0 ? lines : [""];
  });
}

function drawPageChrome(state: PdfState): void {
  state.page.drawRectangle({
    x: 0,
    y: 0,
    width: pageWidth,
    height: pageHeight,
    color: colors.paper,
  });
  state.page.drawText("PERMITPULSE", {
    x: marginX,
    y: 754,
    font: state.boldFont,
    size: 10,
    color: colors.jadeDark,
  });
  state.page.drawText("PERMIT INTELLIGENCE", {
    x: pageWidth - marginX - 112,
    y: 754,
    font: state.boldFont,
    size: 7,
    color: colors.muted,
  });
  state.page.drawLine({
    start: { x: marginX, y: 744 },
    end: { x: pageWidth - marginX, y: 744 },
    thickness: 2,
    color: colors.jade,
  });
}

function addPage(state: PdfState): void {
  state.page = state.document.addPage([pageWidth, pageHeight]);
  state.y = contentTop;
  drawPageChrome(state);
}

function ensureSpace(state: PdfState, neededHeight: number): void {
  if (state.y - neededHeight < contentBottom) {
    addPage(state);
  }
}

function drawLine(
  state: PdfState,
  value: string,
  options: TextOptions = {},
): void {
  const font = options.font ?? state.bodyFont;
  const size = options.size ?? bodySize;
  const lineHeight = options.lineHeight ?? bodyLineHeight;
  const indent = options.indent ?? 0;

  ensureSpace(state, lineHeight);
  state.page.drawText(safePdfText(value, font), {
    x: marginX + indent,
    y: state.y,
    font,
    size,
    color: options.color ?? colors.ink,
  });
  state.y -= lineHeight;
}

function drawParagraph(
  state: PdfState,
  value: string,
  options: TextOptions = {},
): void {
  const font = options.font ?? state.bodyFont;
  const size = options.size ?? bodySize;
  const indent = options.indent ?? 0;
  const width = options.width ?? contentWidth - indent;
  const lines = wrapPacketPdfText(value, font, size, width);

  for (const line of lines) {
    drawLine(state, line, { ...options, font, size, indent });
  }
}

function drawDivider(state: PdfState, spacing = 10): void {
  ensureSpace(state, spacing + 2);
  state.y -= spacing / 2;
  state.page.drawLine({
    start: { x: marginX, y: state.y },
    end: { x: pageWidth - marginX, y: state.y },
    thickness: 0.6,
    color: colors.rule,
  });
  state.y -= spacing / 2;
}

function drawBadge(
  state: PdfState,
  label: string,
  options: { x?: number; y?: number; font?: PDFFont; size?: number } = {},
): { width: number; height: number } {
  const font = options.font ?? state.boldFont;
  const size = options.size ?? 8;
  const safeLabel = safePdfText(label.toUpperCase(), font);
  const width = widthOf(safeLabel, font, size) + 18;
  const height = 20;
  const x = options.x ?? marginX;
  const y = options.y ?? state.y - 4;

  state.page.drawRectangle({
    x,
    y,
    width,
    height,
    borderColor: colors.jadeDark,
    borderWidth: 1.2,
    color: colors.white,
  });
  state.page.drawText(safeLabel, {
    x: x + 9,
    y: y + 6,
    font,
    size,
    color: colors.jadeDark,
  });

  return { width, height };
}

function drawSectionHeading(state: PdfState, sectionId: PacketSectionId): void {
  ensureSpace(state, 42);
  state.y -= 8;
  drawLine(state, packetSectionNumber(sectionId), {
    color: colors.jade,
    font: state.boldFont,
    size: 8,
    lineHeight: 12,
  });
  drawParagraph(state, packetSectionTitle(sectionId), {
    color: colors.ink,
    font: state.serifBoldFont,
    size: 17,
    lineHeight: 21,
  });
  state.page.drawLine({
    start: { x: marginX, y: state.y + 4 },
    end: { x: marginX + 48, y: state.y + 4 },
    thickness: 2,
    color: colors.jade,
  });
  state.y -= 9;
}

function drawLabelValue(
  state: PdfState,
  label: string,
  value: string,
  indent = 0,
): void {
  drawParagraph(state, label.toUpperCase(), {
    color: colors.muted,
    font: state.boldFont,
    size: 7,
    lineHeight: 10,
    indent,
  });
  drawParagraph(state, value, {
    font: state.boldFont,
    size: 9,
    lineHeight: 13,
    indent,
  });
  state.y -= 3;
}

function drawRecordHeading(
  state: PdfState,
  kicker: string,
  title: string,
  badge: string,
): void {
  ensureSpace(state, 48);
  drawParagraph(state, kicker.toUpperCase(), {
    color: colors.jade,
    font: state.boldFont,
    size: 7,
    lineHeight: 10,
  });
  const titleWidth = Math.max(210, contentWidth - 110);
  drawParagraph(state, title, {
    font: state.boldFont,
    size: 11,
    lineHeight: 15,
    width: titleWidth,
  });
  const badgeWidth = Math.min(
    100,
    widthOf(safePdfText(badge.toUpperCase(), state.boldFont), state.boldFont, 7) + 16,
  );
  const badgeY = Math.min(contentTop - 24, state.y + 18);

  state.page.drawRectangle({
    x: pageWidth - marginX - badgeWidth,
    y: badgeY,
    width: badgeWidth,
    height: 18,
    borderColor: colors.muted,
    borderWidth: 0.8,
    color: colors.white,
  });
  state.page.drawText(safePdfText(badge.toUpperCase(), state.boldFont), {
    x: pageWidth - marginX - badgeWidth + 8,
    y: badgeY + 5.5,
    font: state.boldFont,
    size: 7,
    color: colors.ink,
  });
}

function drawCover(state: PdfState): void {
  ensureSpace(state, 190);
  drawParagraph(state, state.model.title, {
    font: state.serifBoldFont,
    size: 29,
    lineHeight: 33,
    width: 400,
  });
  state.y -= 5;
  drawParagraph(state, state.model.case_summary.project_name, {
    color: colors.jadeDark,
    font: state.boldFont,
    size: 15,
    lineHeight: 19,
  });
  state.y -= 12;
  const badge = drawBadge(state, state.model.document_status_label);
  const metadataX = marginX + badge.width + 16;
  state.page.drawText(
    safePdfText(`Generated ${state.model.generated_at_label}`, state.bodyFont),
    {
      x: metadataX,
      y: state.y + 2,
      font: state.bodyFont,
      size: 8.5,
      color: colors.muted,
    },
  );
  state.page.drawText(
    safePdfText(`Packet version ${state.model.packet_version}`, state.bodyFont),
    {
      x: metadataX,
      y: state.y - 11,
      font: state.bodyFont,
      size: 8.5,
      color: colors.muted,
    },
  );
  state.y -= badge.height + 14;
  state.page.drawRectangle({
    x: marginX,
    y: state.y - 34,
    width: contentWidth,
    height: 44,
    color: colors.soft,
  });
  state.page.drawRectangle({
    x: marginX,
    y: state.y - 34,
    width: 3,
    height: 44,
    color: colors.jade,
  });
  const noticeLines = wrapPacketPdfText(
    state.model.draft_notice,
    state.bodyFont,
    8.5,
    contentWidth - 28,
  ).slice(0, 3);
  noticeLines.forEach((line, index) => {
    state.page.drawText(line, {
      x: marginX + 14,
      y: state.y - 8 - index * 11,
      font: state.bodyFont,
      size: 8.5,
      color: colors.muted,
    });
  });
  state.y -= 50;
}

function drawExecutiveSummary(state: PdfState): void {
  drawSectionHeading(state, "executive_summary");
  drawParagraph(state, state.model.executive_summary.text, {
    font: state.serifFont,
    size: 12,
    lineHeight: 17,
  });
  if (state.model.warnings.length > 0) {
    state.y -= 6;
    state.model.warnings.forEach((item) => {
      drawParagraph(state, `Packet note: ${item.text}`, {
        color: colors.muted,
        indent: 10,
        size: 8,
        lineHeight: 11.5,
        width: contentWidth - 10,
      });
    });
  }
  state.y -= 10;
}

function drawCaseOverview(state: PdfState): void {
  drawSectionHeading(state, "case_overview");

  for (let index = 0; index < state.model.case_overview.length; index += 2) {
    const left = state.model.case_overview[index];
    const right = state.model.case_overview[index + 1];
    const columnWidth = (contentWidth - 24) / 2;
    const leftLines = wrapPacketPdfText(
      left.value,
      state.boldFont,
      9,
      columnWidth,
    );
    const rightLines = right
      ? wrapPacketPdfText(right.value, state.boldFont, 9, columnWidth)
      : [];
    const rowHeight = 13 + Math.max(leftLines.length, rightLines.length, 1) * 13 + 11;

    ensureSpace(state, rowHeight);
    const top = state.y;
    state.page.drawLine({
      start: { x: marginX, y: top + 3 },
      end: { x: pageWidth - marginX, y: top + 3 },
      thickness: 0.5,
      color: colors.rule,
    });
    state.page.drawText(safePdfText(left.label.toUpperCase(), state.boldFont), {
      x: marginX,
      y: top - 9,
      font: state.boldFont,
      size: 7,
      color: colors.muted,
    });
    leftLines.forEach((line, lineIndex) => {
      state.page.drawText(line, {
        x: marginX,
        y: top - 23 - lineIndex * 13,
        font: state.boldFont,
        size: 9,
        color: colors.ink,
      });
    });

    if (right) {
      const x = marginX + columnWidth + 24;
      state.page.drawText(
        safePdfText(right.label.toUpperCase(), state.boldFont),
        { x, y: top - 9, font: state.boldFont, size: 7, color: colors.muted },
      );
      rightLines.forEach((line, lineIndex) => {
        state.page.drawText(line, {
          x,
          y: top - 23 - lineIndex * 13,
          font: state.boldFont,
          size: 9,
          color: colors.ink,
        });
      });
    }

    state.y -= rowHeight;
  }
  state.y -= 5;
}

function drawCurrentStatus(state: PdfState): void {
  drawSectionHeading(state, "current_status");
  ensureSpace(state, 55);
  state.page.drawRectangle({
    x: marginX,
    y: state.y - 33,
    width: contentWidth,
    height: 42,
    color: colors.soft,
  });
  state.page.drawRectangle({
    x: marginX,
    y: state.y - 33,
    width: 4,
    height: 42,
    color: colors.jade,
  });
  state.page.drawText(
    safePdfText(state.model.current_status.label, state.boldFont),
    {
      x: marginX + 16,
      y: state.y - 9,
      font: state.boldFont,
      size: 13,
      color: colors.jadeDark,
    },
  );
  state.page.drawText(
    safePdfText(
      `Case record updated ${state.model.case_summary.updated_at_label}`,
      state.bodyFont,
    ),
    {
      x: marginX + 16,
      y: state.y - 23,
      font: state.bodyFont,
      size: 7.5,
      color: colors.muted,
    },
  );
  state.y -= 52;
}

function drawEvidence(state: PdfState): void {
  drawSectionHeading(state, "evidence_register");

  if (state.model.evidence_summaries.length === 0) {
    drawParagraph(state, "No evidence records are included in this packet.", {
      color: colors.muted,
    });
    return;
  }

  state.model.evidence_summaries.forEach((item, index) => {
    if (index > 0) drawDivider(state, 14);
    drawRecordHeading(
      state,
      item.evidence_type_label,
      item.title,
      item.verification_label,
    );
    state.y -= 3;
    drawParagraph(state, item.summary);
    state.y -= 6;
    drawLabelValue(state, "Source", item.source.label ?? "Source label not provided");
    drawLabelValue(state, "Source date", item.source.date_label);
    drawLabelValue(state, "Provenance", item.source.url ?? "Source URL not provided");
    drawParagraph(state, item.verification_note, {
      color: colors.muted,
      size: 8,
      lineHeight: 11.5,
    });
  });
  state.y -= 8;
}

function drawTimeline(state: PdfState): void {
  drawSectionHeading(state, "permit_timeline");

  if (state.model.timeline_summaries.length === 0) {
    drawParagraph(state, "No permit timeline events are included in this packet.", {
      color: colors.muted,
    });
    return;
  }

  state.model.timeline_summaries.forEach((entry, index) => {
    if (index > 0) drawDivider(state, 14);
    drawRecordHeading(
      state,
      `${entry.occurred_on_label} / ${entry.timeline_type_label}`,
      entry.title,
      entry.source_label,
    );
    state.y -= 3;
    drawParagraph(state, entry.details);
    state.y -= 5;
    drawParagraph(state, "SUPPORTING EVIDENCE", {
      color: colors.muted,
      font: state.boldFont,
      size: 7,
      lineHeight: 10,
    });
    if (entry.linked_evidence.length === 0) {
      drawParagraph(state, "No supporting evidence linked.", {
        color: colors.muted,
        size: 8.5,
      });
    } else {
      entry.linked_evidence.forEach((item) => {
        drawParagraph(
          state,
          `- ${item.title} (${item.verification_label})`,
          { indent: 6, size: 8.5, lineHeight: 12 },
        );
      });
    }
  });
  state.y -= 8;
}

function drawEditorialSection(
  state: PdfState,
  sectionId: "findings" | "open_questions" | "recommended_next_actions",
  items: readonly { text: string }[],
  emptyMessage: string,
): void {
  drawSectionHeading(state, sectionId);

  if (items.length === 0) {
    ensureSpace(state, 34);
    state.page.drawRectangle({
      x: marginX,
      y: state.y - 24,
      width: contentWidth,
      height: 32,
      borderColor: colors.rule,
      borderWidth: 0.6,
      color: colors.soft,
    });
    drawParagraph(state, emptyMessage, {
      color: colors.muted,
      indent: 12,
      size: 8.5,
      lineHeight: 12,
      width: contentWidth - 24,
    });
    state.y -= 12;
    return;
  }

  items.forEach((item, index) => {
    ensureSpace(state, 25);
    state.page.drawRectangle({
      x: marginX,
      y: state.y - 2,
      width: 2,
      height: 16,
      color: colors.jade,
    });
    drawParagraph(state, `${index + 1}. ${item.text}`, {
      indent: 12,
      width: contentWidth - 12,
    });
    state.y -= 7;
  });
}

function drawSources(state: PdfState): void {
  drawSectionHeading(state, "supporting_sources");

  if (state.model.supporting_sources.length === 0) {
    drawParagraph(state, "No supporting sources are included in this packet.", {
      color: colors.muted,
    });
    return;
  }

  state.model.supporting_sources.forEach((source, index) => {
    if (index > 0) drawDivider(state, 12);
    drawParagraph(state, source.title, {
      font: state.boldFont,
      size: 10.5,
      lineHeight: 14,
    });
    drawParagraph(
      state,
      `${source.label} / ${source.date_label} / ${source.verification_label}`,
      { color: colors.muted, size: 8, lineHeight: 11.5 },
    );
    drawParagraph(state, source.url ?? "URL not provided", {
      color: colors.jadeDark,
      size: 8,
      lineHeight: 11.5,
    });
  });
  state.y -= 8;
}

function drawDisclaimer(state: PdfState): void {
  drawSectionHeading(state, "disclaimer");
  drawParagraph(state, state.model.disclaimer, {
    color: colors.muted,
    size: 8.5,
    lineHeight: 12,
  });
}

function drawFooters(state: PdfState): void {
  const pages = state.document.getPages();

  pages.forEach((page, index) => {
    page.drawLine({
      start: { x: marginX, y: 42 },
      end: { x: pageWidth - marginX, y: 42 },
      thickness: 0.6,
      color: colors.rule,
    });
    page.drawText("PermitPulse / Verify source records before reliance", {
      x: marginX,
      y: 27,
      font: state.bodyFont,
      size: 7,
      color: colors.muted,
    });
    const pageLabel = `Page ${index + 1} of ${pages.length}`;
    page.drawText(pageLabel, {
      x: pageWidth - marginX - widthOf(pageLabel, state.boldFont, 7),
      y: 27,
      font: state.boldFont,
      size: 7,
      color: colors.ink,
    });
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

export async function renderPacketPdf(model: PacketModel): Promise<Uint8Array> {
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
    model,
    page: firstPage,
    serifFont,
    serifBoldFont,
    y: contentTop,
  };
  const date = metadataDate(model.generated_at);

  document.setTitle(`${model.title} - ${model.case_summary.project_name}`);
  document.setAuthor("PermitPulse");
  document.setSubject("Client-facing permit review packet");
  document.setCreator("PermitPulse Branded Packet Renderer");
  document.setProducer("PermitPulse pdf-lib packet renderer v2");
  document.setKeywords(["PermitPulse", "permit", "evidence", "timeline"]);
  document.setCreationDate(date);
  document.setModificationDate(date);

  drawPageChrome(state);
  drawCover(state);
  drawExecutiveSummary(state);
  drawCaseOverview(state);
  drawCurrentStatus(state);
  drawEvidence(state);
  drawTimeline(state);
  drawEditorialSection(
    state,
    "findings",
    model.findings.items,
    model.findings.empty_message,
  );
  drawEditorialSection(
    state,
    "open_questions",
    model.open_questions.items,
    model.open_questions.empty_message,
  );
  drawEditorialSection(
    state,
    "recommended_next_actions",
    model.recommended_next_actions.items,
    model.recommended_next_actions.empty_message,
  );
  drawSources(state);
  drawDisclaimer(state);
  drawFooters(state);

  return document.save({
    addDefaultPage: false,
    useObjectStreams: false,
  });
}
