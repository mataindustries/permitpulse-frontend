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
import {
  packetDashboard,
  packetEvidenceMissingDetails,
  packetRendererVersion,
  packetTimelineChronology,
  packetTimelineReviewLabel,
  type PacketDashboardTone,
} from "./presentation-summary";
import type {
  PacketEvidenceSummary,
  PacketFinding,
  PacketModel,
  PacketOpenQuestion,
  PacketRecommendedAction,
  PacketSectionId,
  PacketTimelineSummary,
} from "./types";

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
  jadeSoft: rgb(0.91, 0.95, 0.925),
  navy: rgb(0.043, 0.114, 0.173),
  navySoft: rgb(0.075, 0.157, 0.224),
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
  state.page.drawRectangle({
    x: 0,
    y: 742,
    width: pageWidth,
    height: 50,
    color: colors.navy,
  });
  state.page.drawRectangle({
    x: 0,
    y: 789,
    width: 178,
    height: 3,
    color: colors.orange,
  });
  state.page.drawRectangle({
    x: 178,
    y: 789,
    width: pageWidth - 178,
    height: 3,
    color: colors.jade,
  });
  state.page.drawText("PERMITPULSE", {
    x: marginX,
    y: 759,
    font: state.boldFont,
    size: 10,
    color: colors.white,
  });
  state.page.drawText("PERMIT INTELLIGENCE", {
    x: pageWidth - marginX - 112,
    y: 759,
    font: state.boldFont,
    size: 7,
    color: colors.jadeSoft,
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

function drawWrappedAt(
  state: PdfState,
  value: string,
  options: {
    color?: RGB;
    font?: PDFFont;
    lineHeight?: number;
    size?: number;
    width: number;
    x: number;
    y: number;
  },
): number {
  const font = options.font ?? state.bodyFont;
  const size = options.size ?? bodySize;
  const lineHeight = options.lineHeight ?? bodyLineHeight;
  const lines = wrapPacketPdfText(value, font, size, options.width);

  lines.forEach((line, index) => {
    state.page.drawText(line, {
      x: options.x,
      y: options.y - index * lineHeight,
      font,
      size,
      color: options.color ?? colors.ink,
    });
  });

  return options.y - lines.length * lineHeight;
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

function toneColor(tone: PacketDashboardTone): RGB {
  if (tone === "strong") return colors.jade;
  if (tone === "attention") return colors.warning;
  return colors.danger;
}

function drawDashboardMetric(
  state: PdfState,
  input: {
    detail: string;
    label: string;
    tone?: PacketDashboardTone;
    value: string;
    x: number;
    y: number;
    width: number;
  },
): void {
  const height = 64;
  const dark = input.label === "Readiness score";
  const accent = input.tone ? toneColor(input.tone) : dark ? colors.orange : colors.jade;

  state.page.drawRectangle({
    x: input.x,
    y: input.y - height,
    width: input.width,
    height,
    borderColor: dark ? colors.navy : colors.rule,
    borderWidth: 0.7,
    color: dark ? colors.navy : colors.white,
  });
  state.page.drawRectangle({
    x: input.x,
    y: input.y - height,
    width: 3,
    height,
    color: accent,
  });
  state.page.drawText(safePdfText(input.label.toUpperCase(), state.boldFont), {
    x: input.x + 11,
    y: input.y - 15,
    font: state.boldFont,
    size: 6.5,
    color: dark ? colors.jadeSoft : colors.muted,
  });
  drawWrappedAt(state, input.value, {
    x: input.x + 11,
    y: input.y - 33,
    width: input.width - 22,
    font: state.boldFont,
    size: 13,
    lineHeight: 14,
    color: dark ? colors.white : colors.ink,
  });
  drawWrappedAt(state, input.detail, {
    x: input.x + 11,
    y: input.y - 51,
    width: input.width - 22,
    font: state.bodyFont,
    size: 6.2,
    lineHeight: 7.5,
    color: dark ? colors.jadeSoft : colors.muted,
  });
}

function drawExecutiveDashboard(state: PdfState): void {
  const dashboard = packetDashboard(state.model);
  const top = state.y;
  const identityWidth = 164;
  const identityX = pageWidth - marginX - identityWidth;
  const leftWidth = identityX - marginX - 24;

  state.page.drawText("CLIENT PERMIT DELIVERABLE", {
    x: marginX,
    y: top,
    font: state.boldFont,
    size: 7,
    color: colors.jade,
  });
  let leftY = drawWrappedAt(state, state.model.title, {
    x: marginX,
    y: top - 24,
    width: leftWidth,
    font: state.serifBoldFont,
    size: 27,
    lineHeight: 29,
    color: colors.navy,
  });
  leftY -= 4;
  leftY = drawWrappedAt(state, state.model.case_summary.project_name, {
    x: marginX,
    y: leftY,
    width: leftWidth,
    font: state.boldFont,
    size: 12,
    lineHeight: 14,
    color: colors.jadeDark,
  });
  leftY = drawWrappedAt(
    state,
    [state.model.case_summary.address, state.model.case_summary.city]
      .filter(Boolean)
      .join(", "),
    {
      x: marginX,
      y: leftY - 3,
      width: leftWidth,
      font: state.bodyFont,
      size: 7.5,
      lineHeight: 9,
      color: colors.muted,
    },
  );

  const identityRows = [
    ["Prepared for", state.model.case_summary.client_name],
    ["Jurisdiction", state.model.jurisdiction],
    ["Permit identifier", state.model.permit_number?.trim() || "Pending record entry"],
    ["Packet status", dashboard.lifecycle_status],
  ] as const;
  const identityContentWidth = identityWidth - 22;
  const identityHeight = 18 + identityRows.reduce(
    (height, [, value]) =>
      height + 11 + wrappedHeight(value, state.boldFont, 7.2, identityContentWidth, 8.5),
    0,
  );

  state.page.drawRectangle({
    x: identityX,
    y: top + 8 - identityHeight,
    width: identityWidth,
    height: identityHeight,
    color: colors.soft,
    borderColor: colors.rule,
    borderWidth: 0.7,
  });
  let identityY = top - 10;
  identityRows.forEach(([label, value]) => {
    state.page.drawText(label.toUpperCase(), {
      x: identityX + 11,
      y: identityY,
      font: state.boldFont,
      size: 6,
      color: colors.jade,
    });
    identityY = drawWrappedAt(state, value, {
      x: identityX + 11,
      y: identityY - 10,
      width: identityContentWidth,
      font: state.boldFont,
      size: 7.2,
      lineHeight: 8.5,
      color: colors.ink,
    }) - 3;
  });

  state.y = Math.min(leftY, top + 8 - identityHeight) - 14;
  state.page.drawText("01 / DECISION SNAPSHOT / EXECUTIVE SUMMARY", {
    x: marginX,
    y: state.y,
    font: state.boldFont,
    size: 7,
    color: colors.jade,
  });
  state.y -= 20;
  state.page.drawText("Executive Dashboard", {
    x: marginX,
    y: state.y,
    font: state.serifBoldFont,
    size: 19,
    color: colors.navy,
  });
  const statusLabel = safePdfText(state.model.document_status_label, state.boldFont);
  const statusWidth = widthOf(statusLabel, state.boldFont, 7) + 18;
  state.page.drawRectangle({
    x: pageWidth - marginX - statusWidth,
    y: state.y - 3,
    width: statusWidth,
    height: 18,
    color: colors.jadeDark,
  });
  state.page.drawText(statusLabel, {
    x: pageWidth - marginX - statusWidth + 9,
    y: state.y + 3,
    font: state.boldFont,
    size: 7,
    color: colors.white,
  });
  state.y -= 20;
  state.y = drawWrappedAt(state, state.model.action_kit?.current_position ?? state.model.executive_summary.text, {
    x: marginX,
    y: state.y,
    width: contentWidth,
    font: state.serifFont,
    size: 9.5,
    lineHeight: 12.5,
    color: colors.ink,
  }) - 9;
  for (const item of state.model.executive_summary.key_risks) {
    state.y = drawWrappedAt(state, `Key Risk: ${item}`, { x: marginX, y: state.y, width: contentWidth, font: state.boldFont, size: 8, lineHeight: 10, color: colors.ink }) - 3;
  }
  for (const item of state.model.executive_summary.key_strengths) {
    state.y = drawWrappedAt(state, `Key Strength: ${item}`, { x: marginX, y: state.y, width: contentWidth, font: state.boldFont, size: 8, lineHeight: 10, color: colors.jadeDark }) - 3;
  }

  const metricGap = 8;
  const metricWidth = (contentWidth - metricGap * 2) / 3;
  drawDashboardMetric(state, {
    x: marginX,
    y: state.y,
    width: metricWidth,
    label: "Readiness state",
    value: dashboard.permit_status,
    detail: "Derived from all readiness factors",
  });
  drawDashboardMetric(state, {
    x: marginX + metricWidth + metricGap,
    y: state.y,
    width: metricWidth,
    label: "Overall Mission Health",
    value: dashboard.mission_health.label,
    detail: `${dashboard.mission_health.score}% / ${dashboard.mission_health.completed} of ${dashboard.mission_health.total} checks`,
    tone: dashboard.mission_health.tone,
  });
  drawDashboardMetric(state, {
    x: marginX + (metricWidth + metricGap) * 2,
    y: state.y,
    width: metricWidth,
    label: "Readiness score",
    value: `${dashboard.readiness.score}%`,
    detail: `${dashboard.readiness.completed} of ${dashboard.readiness.total} packet checks`,
  });
  state.y -= 73;

  const blockerWidth = 302;
  const actionX = marginX + blockerWidth + 8;
  const actionWidth = contentWidth - blockerWidth - 8;
  const panelHeight = 95;
  state.page.drawRectangle({
    x: marginX,
    y: state.y - panelHeight,
    width: blockerWidth,
    height: panelHeight,
    color: colors.soft,
    borderColor: colors.rule,
    borderWidth: 0.7,
  });
  state.page.drawText("PRIMARY BLOCKERS", {
    x: marginX + 12,
    y: state.y - 15,
    font: state.boldFont,
    size: 6.5,
    color: colors.jade,
  });
  if (dashboard.blockers.length === 0) {
    state.page.drawText("No primary blockers identified.", {
      x: marginX + 12,
      y: state.y - 35,
      font: state.boldFont,
      size: 9,
      color: colors.jadeDark,
    });
    drawWrappedAt(state, "The current packet record contains no deterministic blocking condition.", {
      x: marginX + 12,
      y: state.y - 49,
      width: blockerWidth - 24,
      font: state.bodyFont,
      size: 7,
      lineHeight: 9,
      color: colors.muted,
    });
  } else {
    let blockerY = state.y - 33;
    dashboard.blockers.slice(0, 3).forEach((item) => {
      state.page.drawCircle({
        x: marginX + 15,
        y: blockerY + 2,
        size: 2.7,
        color: colors.orange,
      });
      blockerY = drawWrappedAt(state, item.title, {
        x: marginX + 24,
        y: blockerY,
        width: blockerWidth - 36,
        font: state.boldFont,
        size: 7.5,
        lineHeight: 9,
        color: colors.ink,
      }) - 5;
    });
    if (dashboard.blockers.length > 3) {
      state.page.drawText(`+ ${dashboard.blockers.length - 3} additional documented condition${dashboard.blockers.length - 3 === 1 ? "" : "s"}`, {
        x: marginX + 24,
        y: state.y - panelHeight + 9,
        font: state.bodyFont,
        size: 6.5,
        color: colors.muted,
      });
    }
  }

  state.page.drawRectangle({
    x: actionX,
    y: state.y - panelHeight,
    width: actionWidth,
    height: panelHeight,
    color: colors.jadeDark,
  });
  state.page.drawText("RECOMMENDED NEXT ACTION", {
    x: actionX + 12,
    y: state.y - 15,
    font: state.boldFont,
    size: 6.5,
    color: colors.jadeSoft,
  });
  const actionTitleY = drawWrappedAt(state, dashboard.recommended_action.title, {
    x: actionX + 12,
    y: state.y - 34,
    width: actionWidth - 24,
    font: state.boldFont,
    size: 9,
    lineHeight: 11,
    color: colors.white,
  });
  drawWrappedAt(state, dashboard.recommended_action.detail, {
    x: actionX + 12,
    y: actionTitleY - 5,
    width: actionWidth - 24,
    font: state.bodyFont,
    size: 6.5,
    lineHeight: 8,
    color: colors.jadeSoft,
  });
  state.y -= panelHeight + 8;

  const evidenceHeight = 58;
  state.page.drawRectangle({
    x: marginX,
    y: state.y - evidenceHeight,
    width: contentWidth,
    height: evidenceHeight,
    color: colors.white,
    borderColor: colors.rule,
    borderWidth: 0.7,
  });
  state.page.drawText("EVIDENCE SUMMARY", {
    x: marginX + 12,
    y: state.y - 15,
    font: state.boldFont,
    size: 6.5,
    color: colors.jade,
  });
  drawWrappedAt(state, dashboard.evidence.text, {
    x: marginX + 12,
    y: state.y - 31,
    width: 350,
    font: state.bodyFont,
    size: 7,
    lineHeight: 9,
    color: colors.muted,
  });
  const countStart = marginX + 385;
  const countWidth = (contentWidth - 397) / 4;
  ([
    ["Verified", dashboard.evidence.verified],
    ["Unverified", dashboard.evidence.unverified],
    ["Disputed", dashboard.evidence.disputed],
    ["Provenance", dashboard.evidence.provenance_issues],
  ] as const).forEach(([label, count], index) => {
    const x = countStart + countWidth * index;
    state.page.drawText(label.toUpperCase(), {
      x,
      y: state.y - 18,
      font: state.boldFont,
      size: 5.6,
      color: colors.muted,
    });
    state.page.drawText(String(count), {
      x,
      y: state.y - 39,
      font: state.boldFont,
      size: 15,
      color: colors.ink,
    });
  });
  state.y -= evidenceHeight + 8;

  const metadataRows = [
    ["Packet version", String(state.model.packet_version)],
    ["Generation date", state.model.generated_at_label],
    ["Lifecycle status", dashboard.lifecycle_status],
    ["Reviewer status", dashboard.reviewer_status],
  ] as const;
  const metadataHeight = 67;
  const metadataCellWidth = contentWidth / 4;
  state.page.drawRectangle({
    x: marginX,
    y: state.y - metadataHeight,
    width: contentWidth,
    height: metadataHeight,
    color: colors.soft,
    borderColor: colors.rule,
    borderWidth: 0.7,
  });
  metadataRows.forEach(([label, value], index) => {
    const x = marginX + metadataCellWidth * index;
    if (index > 0) {
      state.page.drawLine({
        start: { x, y: state.y },
        end: { x, y: state.y - 38 },
        thickness: 0.5,
        color: colors.rule,
      });
    }
    state.page.drawText(label.toUpperCase(), {
      x: x + 9,
      y: state.y - 13,
      font: state.boldFont,
      size: 5.5,
      color: colors.muted,
    });
    drawWrappedAt(state, value, {
      x: x + 9,
      y: state.y - 25,
      width: metadataCellWidth - 18,
      font: state.boldFont,
      size: 6.5,
      lineHeight: 7.5,
      color: colors.ink,
    });
  });
  state.page.drawLine({
    start: { x: marginX, y: state.y - 38 },
    end: { x: pageWidth - marginX, y: state.y - 38 },
    thickness: 0.5,
    color: colors.rule,
  });
  state.page.drawText("PACKET INTEGRITY / VERSION", {
    x: marginX + 9,
    y: state.y - 51,
    font: state.boldFont,
    size: 5.5,
    color: colors.muted,
  });
  state.page.drawText(safePdfText(`${dashboard.integrity} / deterministic render`, state.boldFont), {
    x: marginX + 135,
    y: state.y - 51,
    font: state.boldFont,
    size: 6.3,
    color: colors.ink,
  });
  state.y -= metadataHeight + 6;

  const noticeHeight = wrappedHeight(
    state.model.draft_notice,
    state.bodyFont,
    6.7,
    contentWidth - 24,
    8.3,
  ) + 14;
  ensureSpace(state, noticeHeight);
  state.page.drawRectangle({
    x: marginX,
    y: state.y - noticeHeight,
    width: contentWidth,
    height: noticeHeight,
    color: colors.jadeSoft,
  });
  state.page.drawRectangle({
    x: marginX,
    y: state.y - noticeHeight,
    width: 3,
    height: noticeHeight,
    color: colors.jade,
  });
  drawWrappedAt(state, state.model.draft_notice, {
    x: marginX + 12,
    y: state.y - 11,
    width: contentWidth - 24,
    font: state.bodyFont,
    size: 6.7,
    lineHeight: 8.3,
    color: colors.jadeDark,
  });
  state.y -= noticeHeight + 5;

  if (state.model.warnings.length > 0) {
    const warningText = state.model.warnings.map((item) => item.text).join(" ");
    const warningHeight = wrappedHeight(warningText, state.bodyFont, 6.5, contentWidth - 24, 8) + 16;
    ensureSpace(state, warningHeight);
    state.page.drawRectangle({
      x: marginX,
      y: state.y - warningHeight,
      width: contentWidth,
      height: warningHeight,
      color: rgb(0.985, 0.955, 0.91),
    });
    state.page.drawRectangle({
      x: marginX,
      y: state.y - warningHeight,
      width: 3,
      height: warningHeight,
      color: colors.warning,
    });
    drawWrappedAt(state, warningText, {
      x: marginX + 12,
      y: state.y - 12,
      width: contentWidth - 24,
      font: state.bodyFont,
      size: 6.5,
      lineHeight: 8,
      color: colors.muted,
    });
    state.y -= warningHeight + 4;
  }
}

export function packetSectionHeadingMetrics(
  title: string,
  font: PDFFont,
  width = contentWidth - 34,
): { eyebrowHeight: number; eyebrowTitleSpacing: number; titleHeight: number; titleLines: number; totalHeight: number } {
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

function drawSectionHeading(state: PdfState, sectionId: PacketSectionId): void {
  const title = packetSectionTitle(sectionId);
  const heading = packetSectionHeadingMetrics(title, state.serifBoldFont);
  ensureSpace(state, heading.totalHeight);
  state.y -= 8;
  drawLine(state, packetSectionNumber(sectionId), {
    color: colors.orange,
    font: state.boldFont,
    size: 8,
    lineHeight: 12,
  });
  drawLine(state, "CLIENT DELIVERABLE", {
    color: colors.jade,
    font: state.boldFont,
    size: 6,
    lineHeight: 9,
    indent: 34,
  });
  state.y -= heading.eyebrowTitleSpacing;
  drawParagraph(state, title, {
    color: colors.navy,
    font: state.serifBoldFont,
    size: 17,
    lineHeight: 21,
    indent: 34,
    width: contentWidth - 34,
  });
  state.page.drawLine({
    start: { x: marginX + 34, y: state.y + 4 },
    end: { x: pageWidth - marginX, y: state.y + 4 },
    thickness: 0.7,
    color: colors.rule,
  });
  state.y -= 9;
}

function drawSectionIntro(state: PdfState, value: string): void {
  drawParagraph(state, value, {
    color: colors.muted,
    indent: 34,
    width: contentWidth - 34,
    size: 8,
    lineHeight: 11,
  });
  state.y -= 8;
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

function drawCaseOverview(state: PdfState): void {
  drawSectionHeading(state, "case_overview");
  drawSectionIntro(
    state,
    "Core project identity and jurisdiction information carried forward from the case record.",
  );

  for (let index = 0; index < state.model.case_overview.length; index += 2) {
    const left = state.model.case_overview[index];
    const right = state.model.case_overview[index + 1];
    const leftValue = left.information_class === "missing_information"
      ? "Pending record entry"
      : left.value;
    const rightValue = right?.information_class === "missing_information"
      ? "Pending record entry"
      : right?.value;
    const columnWidth = (contentWidth - 24) / 2;
    const leftLines = wrapPacketPdfText(
      leftValue,
      state.boldFont,
      9,
      columnWidth,
    );
    const rightLines = right
      ? wrapPacketPdfText(rightValue ?? "", state.boldFont, 9, columnWidth)
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
  drawSectionHeading(state, "case_overview");
  drawSectionIntro(
    state,
    "Recorded case status at the time this packet edition was generated.",
  );
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

function evidenceBadgeColors(item: PacketEvidenceSummary): {
  background: RGB;
  foreground: RGB;
} {
  if (item.verification_status === "verified") {
    return { background: colors.jadeSoft, foreground: colors.jadeDark };
  }
  if (item.verification_status === "disputed") {
    return { background: rgb(1, 0.94, 0.925), foreground: colors.danger };
  }
  return { background: rgb(1, 0.97, 0.91), foreground: colors.warning };
}

function evidenceCardMeasurement(
  state: PdfState,
  item: PacketEvidenceSummary,
): {
  height: number;
  missing: string[];
  noteHeight: number;
  summaryLines: string[];
  titleLines: string[];
} {
  const innerWidth = contentWidth - 32;
  const titleLines = wrapPacketPdfText(
    item.title,
    state.serifBoldFont,
    12,
    innerWidth - 112,
  );
  const summaryLines = wrapPacketPdfText(item.summary, state.bodyFont, 8.8, innerWidth);
  const missing = packetEvidenceMissingDetails(item);
  const metadataValues = [
    item.source.label?.trim() || null,
    item.source.date ? item.source.date_label : null,
    item.source.url,
  ].filter((value): value is string => Boolean(value));
  const metadataHeight = metadataValues.reduce(
    (height, value) =>
      height + 8 + wrappedHeight(value, state.boldFont, 7.5, innerWidth, 9) + 5,
    0,
  );
  const missingHeight = missing.length > 0
    ? wrappedHeight(
        `Source details pending: ${missing.join(", ")}.`,
        state.bodyFont,
        7,
        innerWidth,
        9,
      ) + 7
    : 0;
  const noteHeight = 19 + wrappedHeight(
    item.verification_note,
    state.bodyFont,
    7.3,
    innerWidth,
    9,
  ) + 10;
  const height = 17 + 9 + titleLines.length * 14 + 10 +
    summaryLines.length * 12 + 13 + metadataHeight + missingHeight + noteHeight;

  return { height, missing, noteHeight, summaryLines, titleLines };
}

function drawEvidenceCard(
  state: PdfState,
  item: PacketEvidenceSummary,
  index: number,
): void {
  const measurement = evidenceCardMeasurement(state, item);
  const maxCardHeight = contentTop - contentBottom - 20;

  if (measurement.height > maxCardHeight) {
    ensureSpace(state, 110);
    state.page.drawRectangle({
      x: marginX,
      y: state.y - 4,
      width: 3,
      height: 28,
      color: colors.jade,
    });
    drawRecordHeading(
      state,
      `Evidence ${String(index + 1).padStart(2, "0")} / ${item.evidence_type_label}`,
      item.title,
      item.verification_label,
    );
    state.y -= 4;
    drawParagraph(state, item.summary, { size: 8.8, lineHeight: 12 });
    state.y -= 6;
    if (item.source.label?.trim()) drawLabelValue(state, "Source", item.source.label);
    if (item.source.date) drawLabelValue(state, "Source date", item.source.date_label);
    if (item.source.url) drawLabelValue(state, "Provenance", item.source.url);
    if (measurement.missing.length > 0) {
      drawParagraph(state, `Source details pending: ${measurement.missing.join(", ")}.`, {
        color: colors.warning,
        size: 7,
        lineHeight: 9,
      });
    }
    drawParagraph(state, "REVIEWER NOTE", {
      color: colors.jade,
      font: state.boldFont,
      size: 6.5,
      lineHeight: 9,
    });
    drawParagraph(state, item.verification_note, {
      color: colors.muted,
      size: 7.3,
      lineHeight: 9,
    });
    state.y -= 12;
    return;
  }

  ensureSpace(state, measurement.height + 14);
  const top = state.y;
  const bottom = top - measurement.height;
  const innerX = marginX + 16;
  const innerWidth = contentWidth - 32;
  const badgeColors = evidenceBadgeColors(item);
  const badgeLabel = safePdfText(item.verification_label.toUpperCase(), state.boldFont);
  const badgeWidth = widthOf(badgeLabel, state.boldFont, 6.5) + 16;

  state.page.drawRectangle({
    x: marginX,
    y: bottom,
    width: contentWidth,
    height: measurement.height,
    borderColor: colors.rule,
    borderWidth: 0.7,
    color: colors.white,
  });
  state.page.drawRectangle({
    x: marginX,
    y: bottom,
    width: 3,
    height: measurement.height,
    color: colors.jade,
  });
  state.page.drawRectangle({
    x: marginX,
    y: bottom,
    width: contentWidth,
    height: measurement.noteHeight,
    color: colors.soft,
  });

  let cursor = top - 15;
  state.page.drawText(
    `EVIDENCE ${String(index + 1).padStart(2, "0")} / ${safePdfText(item.evidence_type_label.toUpperCase(), state.boldFont)}`,
    {
      x: innerX,
      y: cursor,
      font: state.boldFont,
      size: 6.5,
      color: colors.jade,
    },
  );
  cursor -= 15;
  measurement.titleLines.forEach((line, lineIndex) => {
    state.page.drawText(line, {
      x: innerX,
      y: cursor - lineIndex * 14,
      font: state.serifBoldFont,
      size: 12,
      color: colors.navy,
    });
  });
  state.page.drawRectangle({
    x: pageWidth - marginX - badgeWidth - 14,
    y: top - 35,
    width: badgeWidth,
    height: 17,
    borderColor: badgeColors.foreground,
    borderWidth: 0.7,
    color: badgeColors.background,
  });
  state.page.drawText(badgeLabel, {
    x: pageWidth - marginX - badgeWidth - 6,
    y: top - 29.5,
    font: state.boldFont,
    size: 6.5,
    color: badgeColors.foreground,
  });
  cursor -= measurement.titleLines.length * 14 + 8;
  measurement.summaryLines.forEach((line, lineIndex) => {
    state.page.drawText(line, {
      x: innerX,
      y: cursor - lineIndex * 12,
      font: state.bodyFont,
      size: 8.8,
      color: colors.ink,
    });
  });
  cursor -= measurement.summaryLines.length * 12 + 7;
  state.page.drawLine({
    start: { x: innerX, y: cursor },
    end: { x: pageWidth - marginX - 16, y: cursor },
    thickness: 0.5,
    color: colors.rule,
  });
  cursor -= 13;

  const metadata = [
    item.source.label?.trim() ? ["Source", item.source.label] : null,
    item.source.date ? ["Source date", item.source.date_label] : null,
    item.source.url ? ["Provenance", item.source.url] : null,
  ].filter((entry): entry is [string, string] => Boolean(entry));
  metadata.forEach(([label, value]) => {
    state.page.drawText(label.toUpperCase(), {
      x: innerX,
      y: cursor,
      font: state.boldFont,
      size: 6,
      color: colors.muted,
    });
    cursor -= 9;
    const valueLines = wrapPacketPdfText(value, state.boldFont, 7.5, innerWidth);
    valueLines.forEach((line, lineIndex) => {
      state.page.drawText(line, {
        x: innerX,
        y: cursor - lineIndex * 9,
        font: state.boldFont,
        size: 7.5,
        color: label === "Provenance" ? colors.jadeDark : colors.ink,
      });
    });
    cursor -= valueLines.length * 9 + 5;
  });

  if (measurement.missing.length > 0) {
    cursor = drawWrappedAt(
      state,
      `Source details pending: ${measurement.missing.join(", ")}.`,
      {
        x: innerX,
        y: cursor,
        width: innerWidth,
        font: state.bodyFont,
        size: 7,
        lineHeight: 9,
        color: colors.warning,
      },
    ) - 7;
  }

  const noteTop = bottom + measurement.noteHeight - 11;
  state.page.drawText("REVIEWER NOTE", {
    x: innerX,
    y: noteTop,
    font: state.boldFont,
    size: 6,
    color: colors.jade,
  });
  drawWrappedAt(state, item.verification_note, {
    x: innerX,
    y: noteTop - 11,
    width: innerWidth,
    font: state.bodyFont,
    size: 7.3,
    lineHeight: 9,
    color: colors.muted,
  });
  state.y = bottom - 14;
}

function drawEvidence(state: PdfState): void {
  drawSectionHeading(state, "evidence_register");
  drawSectionIntro(
    state,
    "Source records are organized as review cards. Verification labels describe the recorded review state and do not expand the underlying evidence.",
  );

  if (state.model.evidence_summaries.length === 0) {
    drawParagraph(
      state,
      "Evidence register not yet assembled. No evidence records are included in this packet.",
      { color: colors.muted, size: 8.5, lineHeight: 12 },
    );
    return;
  }

  state.model.evidence_summaries.forEach((item, index) => {
    drawEvidenceCard(state, item, index);
  });
}

function timelineEventHeight(
  state: PdfState,
  entry: PacketTimelineSummary,
  cardWidth: number,
): number {
  const innerWidth = cardWidth - 28;
  const titleHeight = wrappedHeight(
    entry.title,
    state.serifBoldFont,
    11,
    innerWidth,
    13,
  );
  const detailsHeight = wrappedHeight(
    entry.details,
    state.bodyFont,
    8.3,
    innerWidth,
    11,
  );
  const linkedHeight = entry.linked_evidence.length === 0
    ? 11
    : entry.linked_evidence.reduce(
        (height, item) =>
          height + wrappedHeight(
            `${item.verification_label} / ${item.title}`,
            state.bodyFont,
            7.2,
            innerWidth - 8,
            9,
          ) + 3,
        0,
      );

  return 18 + titleHeight + 23 + detailsHeight + 18 + linkedHeight + 14;
}

function drawTimelineEvent(
  state: PdfState,
  entry: PacketTimelineSummary,
  index: number,
): void {
  const dateWidth = 118;
  const railX = marginX + 20;
  const cardX = marginX + dateWidth + 24;
  const cardWidth = pageWidth - marginX - cardX;
  const height = timelineEventHeight(state, entry, cardWidth);
  const reviewLabel = packetTimelineReviewLabel(entry);
  const maxEventHeight = contentTop - contentBottom - 20;

  if (height > maxEventHeight) {
    ensureSpace(state, 110);
    drawRecordHeading(
      state,
      `${entry.occurred_on_label} / ${entry.timeline_type_label}`,
      entry.title,
      reviewLabel,
    );
    drawParagraph(
      state,
      `${entry.source_label} record / ${reviewLabel}`,
      { color: colors.muted, size: 7, lineHeight: 9 },
    );
    state.y -= 3;
    drawParagraph(state, entry.details, { size: 8.3, lineHeight: 11 });
    state.y -= 6;
    drawParagraph(state, "SUPPORTING EVIDENCE", {
      color: colors.muted,
      font: state.boldFont,
      size: 6,
      lineHeight: 9,
    });
    if (entry.linked_evidence.length === 0) {
      drawParagraph(
        state,
        "No supporting evidence linked. Evidence linkage has not been recorded for this event.",
        { color: colors.warning, size: 7.2, lineHeight: 9 },
      );
    } else {
      entry.linked_evidence.forEach((item) => {
        drawParagraph(
          state,
          `- ${item.verification_label} / ${item.title}`,
          { indent: 7, width: contentWidth - 7, size: 7.2, lineHeight: 9 },
        );
      });
    }
    state.y -= 14;
    return;
  }

  ensureSpace(state, height + 16);
  const top = state.y;
  const bottom = top - height;

  state.page.drawLine({
    start: { x: railX, y: top + 6 },
    end: { x: railX, y: Math.max(bottom - 14, contentBottom) },
    thickness: 0.7,
    color: colors.rule,
  });
  state.page.drawCircle({
    x: railX,
    y: top - 9,
    size: 5,
    borderColor: colors.paper,
    borderWidth: 1.8,
    color: colors.orange,
  });
  state.page.drawText(String(index + 1).padStart(2, "0"), {
    x: marginX,
    y: top - 2,
    font: state.boldFont,
    size: 6,
    color: colors.muted,
  });
  drawWrappedAt(state, entry.occurred_on_label, {
    x: marginX + 34,
    y: top - 4,
    width: dateWidth - 38,
    font: state.boldFont,
    size: 8,
    lineHeight: 9.5,
    color: colors.navy,
  });
  drawWrappedAt(state, entry.timeline_type_label.toUpperCase(), {
    x: marginX + 34,
    y: top - 31,
    width: dateWidth - 38,
    font: state.boldFont,
    size: 6,
    lineHeight: 8,
    color: colors.jade,
  });

  state.page.drawRectangle({
    x: cardX,
    y: bottom,
    width: cardWidth,
    height,
    borderColor: colors.rule,
    borderWidth: 0.7,
    color: colors.white,
  });
  const innerX = cardX + 14;
  const innerWidth = cardWidth - 28;
  let cursor = top - 17;
  cursor = drawWrappedAt(state, entry.title, {
    x: innerX,
    y: cursor,
    width: innerWidth,
    font: state.serifBoldFont,
    size: 11,
    lineHeight: 13,
    color: colors.navy,
  }) - 8;

  const sourceLabel = safePdfText(entry.source_label.toUpperCase(), state.boldFont);
  const reviewText = safePdfText(`REVIEW / ${reviewLabel.toUpperCase()}`, state.boldFont);
  const sourceWidth = widthOf(sourceLabel, state.boldFont, 5.8) + 14;
  const reviewWidth = widthOf(reviewText, state.boldFont, 5.8) + 14;
  state.page.drawRectangle({
    x: innerX,
    y: cursor - 3,
    width: sourceWidth,
    height: 15,
    borderColor: colors.muted,
    borderWidth: 0.6,
    color: colors.white,
  });
  state.page.drawText(sourceLabel, {
    x: innerX + 7,
    y: cursor + 2,
    font: state.boldFont,
    size: 5.8,
    color: colors.muted,
  });
  const confirmed = entry.information_class === "confirmed_fact";
  state.page.drawRectangle({
    x: innerX + sourceWidth + 6,
    y: cursor - 3,
    width: reviewWidth,
    height: 15,
    borderColor: confirmed ? colors.jadeDark : colors.warning,
    borderWidth: 0.6,
    color: confirmed ? colors.jadeSoft : rgb(1, 0.97, 0.91),
  });
  state.page.drawText(reviewText, {
    x: innerX + sourceWidth + 13,
    y: cursor + 2,
    font: state.boldFont,
    size: 5.8,
    color: confirmed ? colors.jadeDark : colors.warning,
  });
  cursor -= 21;
  cursor = drawWrappedAt(state, entry.details, {
    x: innerX,
    y: cursor,
    width: innerWidth,
    font: state.bodyFont,
    size: 8.3,
    lineHeight: 11,
    color: colors.ink,
  }) - 9;
  state.page.drawLine({
    start: { x: innerX, y: cursor },
    end: { x: cardX + cardWidth - 14, y: cursor },
    thickness: 0.5,
    color: colors.rule,
  });
  cursor -= 13;
  state.page.drawText("SUPPORTING EVIDENCE", {
    x: innerX,
    y: cursor,
    font: state.boldFont,
    size: 6,
    color: colors.muted,
  });
  cursor -= 12;
  if (entry.linked_evidence.length === 0) {
    drawWrappedAt(state, "No supporting evidence linked. Evidence linkage has not been recorded for this event.", {
      x: innerX,
      y: cursor,
      width: innerWidth,
      font: state.bodyFont,
      size: 7.2,
      lineHeight: 9,
      color: colors.warning,
    });
  } else {
    entry.linked_evidence.forEach((item) => {
      state.page.drawCircle({
        x: innerX + 2,
        y: cursor + 2,
        size: 1.8,
        color: colors.jade,
      });
      cursor = drawWrappedAt(
        state,
        `${item.verification_label} / ${item.title}`,
        {
          x: innerX + 8,
          y: cursor,
          width: innerWidth - 8,
          font: state.bodyFont,
          size: 7.2,
          lineHeight: 9,
          color: colors.muted,
        },
      ) - 3;
    });
  }
  state.y = bottom - 16;
}

function drawTimeline(state: PdfState): void {
  drawSectionHeading(state, "permit_timeline");
  drawSectionIntro(
    state,
    "Chronological permit history, earliest to latest. Each event retains its recorded type, source classification, evidence linkage, and review status.",
  );

  const timeline = packetTimelineChronology(state.model);
  if (timeline.length === 0) {
    drawParagraph(
      state,
      "Permit history not yet assembled. No permit timeline events are included in this packet.",
      { color: colors.muted, size: 8.5, lineHeight: 12 },
    );
    return;
  }

  timeline.forEach((entry, index) => drawTimelineEvent(state, entry, index));
}

function drawEditorialSection(
  state: PdfState,
  sectionId: "findings" | "open_questions" | "recommended_next_actions",
  items: readonly (
    | PacketFinding
    | PacketOpenQuestion
    | PacketRecommendedAction
  )[],
  emptyMessage: string,
): void {
  drawSectionHeading(state, sectionId);
  const intro = sectionId === "findings"
    ? "Reviewer-authored conclusions included in this packet edition. No finding is generated by the presentation layer."
    : sectionId === "open_questions"
      ? "Unresolved items that remain explicitly open in the reviewed packet record."
      : "Recorded follow-up actions, presented in client-ready order without adding new recommendations.";
  const itemLabel = sectionId === "findings"
    ? "Finding"
    : sectionId === "open_questions"
      ? "Question"
      : "Action";
  drawSectionIntro(state, intro);

  if (items.length === 0) {
    const emptyLines = wrapPacketPdfText(emptyMessage, state.bodyFont, 8.5, contentWidth - 158);
    const emptyHeight = Math.max(36, emptyLines.length * 11 + 16);
    ensureSpace(state, emptyHeight);
    const top = state.y;
    state.page.drawLine({
      start: { x: marginX, y: top },
      end: { x: pageWidth - marginX, y: top },
      thickness: 0.6,
      color: colors.rule,
    });
    state.page.drawLine({
      start: { x: marginX, y: top - emptyHeight },
      end: { x: pageWidth - marginX, y: top - emptyHeight },
      thickness: 0.6,
      color: colors.rule,
    });
    state.page.drawText("EDITORIAL STATUS", {
      x: marginX,
      y: top - 16,
      font: state.boldFont,
      size: 6.5,
      color: colors.jade,
    });
    emptyLines.forEach((line, lineIndex) => {
      state.page.drawText(line, {
        x: marginX + 146,
        y: top - 16 - lineIndex * 11,
        font: state.bodyFont,
        size: 8.5,
        color: colors.muted,
      });
    });
    state.y -= emptyHeight + 12;
    return;
  }

  items.forEach((item, index) => {
    const supportIds = "supporting_source_ids" in item
      ? item.supporting_source_ids
      : [];
    const textWidth = contentWidth - 94;
    const textLines = wrapPacketPdfText(item.text, state.serifFont, 10.5, textWidth);
    const metadataHeight = supportIds.length > 0 ? 14 : 0;
    const height = Math.max(46, textLines.length * 14 + 18 + metadataHeight);
    ensureSpace(state, height + 8);
    const top = state.y;

    state.page.drawRectangle({
      x: marginX,
      y: top - height,
      width: 66,
      height,
      color: colors.soft,
    });
    state.page.drawRectangle({
      x: marginX,
      y: top - height,
      width: 3,
      height,
      color: colors.orange,
    });
    state.page.drawLine({
      start: { x: marginX + 74, y: top },
      end: { x: pageWidth - marginX, y: top },
      thickness: 0.6,
      color: colors.rule,
    });
    state.page.drawText(itemLabel.toUpperCase(), {
      x: marginX + 11,
      y: top - 16,
      font: state.boldFont,
      size: 5.8,
      color: colors.jade,
    });
    state.page.drawText(String(index + 1).padStart(2, "0"), {
      x: marginX + 11,
      y: top - 35,
      font: state.boldFont,
      size: 13,
      color: colors.orange,
    });
    textLines.forEach((line, lineIndex) => {
      state.page.drawText(line, {
        x: marginX + 84,
        y: top - 18 - lineIndex * 14,
        font: state.serifFont,
        size: 10.5,
        color: colors.ink,
      });
    });
    if (supportIds.length > 0) {
      state.page.drawText(
        `${supportIds.length} LINKED SOURCE${supportIds.length === 1 ? "" : "S"}`,
        {
          x: marginX + 84,
          y: top - height + 8,
          font: state.boldFont,
          size: 6,
          color: colors.muted,
        },
      );
    }
    state.y -= height + 8;
  });
}

function drawSources(state: PdfState): void {
  drawSectionHeading(state, "supporting_sources");
  drawSectionIntro(
    state,
    "Compact source log for the evidence cited throughout the packet.",
  );

  if (state.model.supporting_sources.length === 0) {
    drawParagraph(
      state,
      "Source log is empty. No supporting sources are included in this packet edition.",
      { color: colors.muted, size: 8.5, lineHeight: 12 },
    );
    return;
  }

  const sourceColumnWidth = 238;
  const provenanceColumnWidth = 178;
  const reviewColumnWidth = contentWidth - sourceColumnWidth - provenanceColumnWidth;
  const drawTableHeader = () => {
    ensureSpace(state, 26);
    state.page.drawRectangle({
      x: marginX,
      y: state.y - 22,
      width: contentWidth,
      height: 22,
      color: colors.navy,
    });
    ([
      ["SOURCE RECORD", marginX + 10],
      ["PROVENANCE", marginX + sourceColumnWidth + 10],
      ["REVIEW", marginX + sourceColumnWidth + provenanceColumnWidth + 10],
    ] as const).forEach(([label, x]) => {
      state.page.drawText(label, {
        x,
        y: state.y - 14,
        font: state.boldFont,
        size: 6.5,
        color: colors.white,
      });
    });
    state.y -= 22;
  };

  drawTableHeader();
  state.model.supporting_sources.forEach((source, index) => {
    const label = source.label === "Source label not provided"
      ? "Source label pending"
      : source.label;
    const date = source.date_label === "Not provided"
      ? "Source date pending"
      : source.date_label;
    const sourceDetail = `${label} / ${date}`;
    const provenance = source.url ?? "Digital provenance not recorded";
    const titleLines = wrapPacketPdfText(
      `${String(index + 1).padStart(2, "0")}  ${source.title}`,
      state.boldFont,
      8,
      sourceColumnWidth - 20,
    );
    const detailLines = wrapPacketPdfText(
      sourceDetail,
      state.bodyFont,
      6.8,
      sourceColumnWidth - 20,
    );
    const provenanceLines = wrapPacketPdfText(
      provenance,
      state.bodyFont,
      6.8,
      provenanceColumnWidth - 20,
    );
    const rowHeight = Math.max(
      43,
      titleLines.length * 10 + detailLines.length * 8 + 14,
      provenanceLines.length * 8 + 18,
    );

    if (state.y - rowHeight < contentBottom) {
      addPage(state);
      drawTableHeader();
    }
    const top = state.y;
    const background = index % 2 === 0 ? colors.white : colors.soft;
    state.page.drawRectangle({
      x: marginX,
      y: top - rowHeight,
      width: contentWidth,
      height: rowHeight,
      color: background,
      borderColor: colors.rule,
      borderWidth: 0.4,
    });
    state.page.drawLine({
      start: { x: marginX + sourceColumnWidth, y: top },
      end: { x: marginX + sourceColumnWidth, y: top - rowHeight },
      thickness: 0.4,
      color: colors.rule,
    });
    state.page.drawLine({
      start: { x: marginX + sourceColumnWidth + provenanceColumnWidth, y: top },
      end: { x: marginX + sourceColumnWidth + provenanceColumnWidth, y: top - rowHeight },
      thickness: 0.4,
      color: colors.rule,
    });
    titleLines.forEach((line, lineIndex) => {
      state.page.drawText(line, {
        x: marginX + 10,
        y: top - 14 - lineIndex * 10,
        font: state.boldFont,
        size: 8,
        color: colors.ink,
      });
    });
    detailLines.forEach((line, lineIndex) => {
      state.page.drawText(line, {
        x: marginX + 10,
        y: top - 14 - titleLines.length * 10 - lineIndex * 8,
        font: state.bodyFont,
        size: 6.8,
        color: colors.muted,
      });
    });
    provenanceLines.forEach((line, lineIndex) => {
      state.page.drawText(line, {
        x: marginX + sourceColumnWidth + 10,
        y: top - 14 - lineIndex * 8,
        font: state.bodyFont,
        size: 6.8,
        color: source.url ? colors.jadeDark : colors.muted,
      });
    });
    const reviewLabel = safePdfText(source.verification_label.toUpperCase(), state.boldFont);
    const reviewWidth = Math.min(
      reviewColumnWidth - 16,
      widthOf(reviewLabel, state.boldFont, 5.8) + 14,
    );
    state.page.drawRectangle({
      x: marginX + sourceColumnWidth + provenanceColumnWidth + 8,
      y: top - 25,
      width: reviewWidth,
      height: 15,
      borderColor: colors.muted,
      borderWidth: 0.6,
      color: colors.white,
    });
    state.page.drawText(reviewLabel, {
      x: marginX + sourceColumnWidth + provenanceColumnWidth + 15,
      y: top - 20,
      font: state.boldFont,
      size: 5.8,
      color: colors.ink,
    });
    state.y -= rowHeight;
  });
  state.y -= 10;
}

function drawDisclaimer(state: PdfState): void {
  drawSectionHeading(state, "disclaimer");
  drawParagraph(state, state.model.disclaimer, {
    color: colors.muted,
    size: 8.5,
    lineHeight: 12,
  });
}

function drawActionKit(state:PdfState):void {
  drawSectionHeading(state,"agency_follow_up_kit"); const kit=state.model.action_kit;
  if(!kit){drawParagraph(state,"No reviewer-approved findings support an Agency Follow-Up Kit for this edition.");return;}
  for(const value of ["CONCISE FOLLOW-UP EMAIL",`Subject: ${kit.email_subject}`,`Recipient / agency role: ${kit.recipient_role}`,kit.message_body,`Supported by ${kit.citation_references.join(", ")}`,"REQUESTED CONFIRMATIONS",...kit.requested_confirmations.map(x=>`- ${x}`),"CALL SCRIPT",...kit.call_checklist.map(x=>`- ${x}`),"DOCUMENTS TO HAVE READY",...(kit.documents_ready.length ? kit.documents_ready.map(x=>`- ${x}`) : ["- Use only the cited packet sources listed above."]),`ESCALATION SUMMARY: ${kit.escalation_trigger}`,`NEXT CONTACT RECOMMENDATION: ${kit.recipient_role}`,...(kit.follow_up_date?[`Follow-up / review date: ${kit.follow_up_date}`]:[])]) drawParagraph(state,value);
}

function drawReadinessFactors(state: PdfState): void {
  const dashboard = packetDashboard(state.model);
  ensureSpace(state, 90);
  drawParagraph(state, "HOW READINESS IS CALCULATED", { font: state.boldFont, color: colors.jade, size: 7, lineHeight: 12 });
  drawParagraph(state, `${dashboard.readiness.completed} of ${dashboard.readiness.total} packet factors pass.`, { color: colors.muted, size: 8, lineHeight: 12 });
  dashboard.factors.forEach((factor) => {
    drawParagraph(state, `${factor.passed ? "PASS" : "OPEN"} / ${factor.label} / ${factor.detail}`, {
      indent: 8,
      width: contentWidth - 8,
      font: factor.passed ? state.bodyFont : state.boldFont,
      color: factor.passed ? colors.jadeDark : colors.warning,
      size: 7.5,
      lineHeight: 10,
    });
    state.y -= 2;
  });
  state.y -= 8;
}

function drawAgencyDependencies(state: PdfState): void {
  const dependencies = state.model.agency_dependencies ?? [];
  if (!dependencies.length) return;
  ensureSpace(state, 50);
  drawParagraph(state, "AGENCY DEPENDENCY MAP", { font: state.boldFont, color: colors.jade, size: 7, lineHeight: 13 });
  dependencies.forEach((item) => {
    ensureSpace(state, 76);
    drawParagraph(state, `DISCIPLINE / ${item.discipline}`, { font: state.boldFont, size: 8, lineHeight: 11 });
    drawParagraph(state, `  DOWN  Blocking issue / ${item.blocking_issue}`, { indent: 8, width: contentWidth - 8, size: 7.5, lineHeight: 10 });
    drawParagraph(state, `  DOWN  Dependent review / ${item.dependent_review}`, { indent: 8, width: contentWidth - 8, size: 7.5, lineHeight: 10 });
    drawParagraph(state, `  DOWN  Recommended next step / ${item.recommended_next_step} / ${item.citation_references.join(", ")}`, { indent: 8, width: contentWidth - 8, font: state.boldFont, color: colors.jadeDark, size: 7.5, lineHeight: 10 });
    state.y -= 8;
  });
}

function drawDemonstrationBanner(state: PdfState): void {
  if (!state.model.demonstration_notice) return;
  state.page.drawRectangle({ x: marginX, y: state.y - 20, width: contentWidth, height: 20, color: colors.jadeDark });
  state.page.drawText(safePdfText(state.model.demonstration_notice, state.boldFont), { x: marginX + 12, y: state.y - 13, font: state.boldFont, size: 6.8, color: colors.white });
  state.y -= 34;
}

function drawEvidenceMatrix(state:PdfState):void {
  drawSectionHeading(state,"evidence_matrix");
  for(const item of state.model.evidence_summaries) drawParagraph(state,`${item.reference} | ${item.title} | ${item.evidence_type_label} | ${item.source.date_label} | ${item.verification_label} | ${item.source.label??"Source label pending"}`);
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
  document.setProducer(`PermitPulse pdf-lib packet renderer v${packetRendererVersion}`);
  document.setKeywords(["PermitPulse", "permit", "evidence", "timeline"]);
  document.setCreationDate(date);
  document.setModificationDate(date);

  drawPageChrome(state);
  drawDemonstrationBanner(state);
  drawExecutiveDashboard(state);

  addPage(state);
  drawReadinessFactors(state);
  drawEditorialSection(state,"recommended_next_actions",model.recommended_next_actions.items,model.recommended_next_actions.empty_message);
  drawActionKit(state);

  addPage(state);
  drawCaseOverview(state);
  drawEditorialSection(state,"findings",model.findings.items,model.findings.empty_message);
  drawAgencyDependencies(state);
  drawEditorialSection(state,"open_questions",model.open_questions.items,model.open_questions.empty_message);

  addPage(state);
  drawEvidenceMatrix(state);

  addPage(state);
  drawTimeline(state);

  addPage(state);
  drawEvidence(state);

  addPage(state);
  drawSources(state);
  drawDisclaimer(state);
  drawFooters(state);

  return document.save({
    addDefaultPage: false,
    useObjectStreams: false,
  });
}
