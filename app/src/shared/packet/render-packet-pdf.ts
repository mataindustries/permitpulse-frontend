import {
  PDFDocument,
  StandardFonts,
  rgb,
  type PDFFont,
  type PDFPage,
} from "pdf-lib";
import { renderPacketText } from "./render-packet-text";
import type { PacketModel } from "./types";

const pageWidth = 612;
const pageHeight = 792;
const margin = 54;
const bodySize = 10;
const titleSize = 18;
const lineHeight = 14;
const titleLineHeight = 22;
const maxFilenameLength = 128;

interface PdfState {
  bodyFont: PDFFont;
  boldFont: PDFFont;
  document: PDFDocument;
  page: PDFPage;
  y: number;
}

function generatedDate(value: string): Date {
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

function breakLongWord(word: string, font: PDFFont, size: number, width: number) {
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

function wrapParagraph(
  paragraph: string,
  font: PDFFont,
  size: number,
  width: number,
): string[] {
  const words = paragraph.trim().split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = "";

  for (const word of words) {
    const safeWord = safePdfText(word, font);
    const candidates =
      widthOf(safeWord, font, size) > width
        ? breakLongWord(safeWord, font, size, width)
        : [safeWord];

    for (const candidateWord of candidates) {
      const candidate = line ? `${line} ${candidateWord}` : candidateWord;

      if (line && widthOf(candidate, font, size) > width) {
        lines.push(line);
        line = candidateWord;
      } else {
        line = candidate;
      }
    }
  }

  if (line) {
    lines.push(line);
  }

  return lines.length > 0 ? lines : [""];
}

function wrapText(
  value: string,
  font: PDFFont,
  size: number,
  width: number,
): string[] {
  return value
    .split(/\r?\n/)
    .flatMap((paragraph) =>
      paragraph.trim()
        ? wrapParagraph(paragraph, font, size, width)
        : [""],
    );
}

function addPage(state: PdfState) {
  state.page = state.document.addPage([pageWidth, pageHeight]);
  state.y = pageHeight - margin;
}

function ensureSpace(state: PdfState, neededHeight: number) {
  if (state.y - neededHeight < margin) {
    addPage(state);
  }
}

function drawTextLine(
  state: PdfState,
  text: string,
  options: {
    color?: ReturnType<typeof rgb>;
    font?: PDFFont;
    size?: number;
    step?: number;
  } = {},
) {
  const font = options.font ?? state.bodyFont;
  const size = options.size ?? bodySize;
  const step = options.step ?? lineHeight;

  ensureSpace(state, step);
  state.page.drawText(safePdfText(text, font), {
    x: margin,
    y: state.y,
    size,
    font,
    color: options.color ?? rgb(0.1, 0.14, 0.2),
  });
  state.y -= step;
}

function drawWrappedText(
  state: PdfState,
  text: string,
  options: {
    color?: ReturnType<typeof rgb>;
    font?: PDFFont;
    size?: number;
    step?: number;
  } = {},
) {
  const font = options.font ?? state.bodyFont;
  const size = options.size ?? bodySize;
  const step = options.step ?? lineHeight;
  const lines = wrapText(text, font, size, pageWidth - margin * 2);

  for (const line of lines) {
    drawTextLine(state, line, { ...options, font, size, step });
  }
}

function slugifyFilenamePart(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48)
    .replace(/-+$/g, "");
}

export function safePacketPdfFilename(model: PacketModel, caseId: string): string {
  const projectSlug = slugifyFilenamePart(model.case_summary.project_name);
  const fallbackSlug = slugifyFilenamePart(model.jurisdiction) || "case";
  const caseSlug = slugifyFilenamePart(caseId).slice(0, 36);
  const filename = `permitpulse-packet-${projectSlug || fallbackSlug}-${caseSlug}.pdf`;

  return filename.length <= maxFilenameLength
    ? filename
    : `${filename.slice(0, maxFilenameLength - 4).replace(/-+$/g, "")}.pdf`;
}

export async function renderPacketPdf(model: PacketModel): Promise<Uint8Array> {
  const document = await PDFDocument.create();
  const bodyFont = await document.embedFont(StandardFonts.Helvetica);
  const boldFont = await document.embedFont(StandardFonts.HelveticaBold);
  const metadataDate = generatedDate(model.generated_at);
  const state: PdfState = {
    bodyFont,
    boldFont,
    document,
    page: document.addPage([pageWidth, pageHeight]),
    y: pageHeight - margin,
  };

  document.setTitle(model.title);
  document.setSubject("Local-only PermitPulse packet PDF export");
  document.setCreator("PermitPulse Case Workspace");
  document.setProducer("PermitPulse local PDF export v1");
  document.setCreationDate(metadataDate);
  document.setModificationDate(metadataDate);

  drawWrappedText(state, model.title, {
    font: boldFont,
    size: titleSize,
    step: titleLineHeight,
  });
  drawWrappedText(state, model.draft_notice, {
    color: rgb(0.36, 0.27, 0.08),
    font: boldFont,
  });
  state.y -= 8;

  for (const line of renderPacketText(model).split("\n").slice(3)) {
    if (!line.trim()) {
      state.y -= 6;
      continue;
    }

    const isSectionUnderline = /^-+$/.test(line);

    if (isSectionUnderline) {
      continue;
    }

    const isSectionTitle =
      line.length > 0 &&
      !line.startsWith(" ") &&
      !line.includes(":") &&
      !/^\d+\./.test(line);

    if (isSectionTitle) {
      state.y -= 4;
      drawWrappedText(state, line, {
        color: rgb(0.08, 0.16, 0.29),
        font: boldFont,
        size: 12,
        step: 16,
      });
      continue;
    }

    drawWrappedText(state, line);
  }

  return document.save({
    addDefaultPage: false,
    useObjectStreams: false,
  });
}
