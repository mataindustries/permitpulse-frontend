import { evidenceFileExtension } from "./classifier";
import type {
  EvidenceClassification,
  EvidenceExtraction,
  EvidenceExtractor,
  EvidenceFileMetadata,
} from "./types";

const jurisdictionRules: ReadonlyArray<[RegExp, string]> = [
  [/\b(?:ladbs|los[ _-]?angeles)\b/i, "Los Angeles Department of Building and Safety"],
  [/\bpasadena\b/i, "City of Pasadena"],
  [/\bsanta[ _-]?monica\b/i, "City of Santa Monica"],
  [/\bsan[ _-]?diego\b/i, "City of San Diego"],
  [/\bsan[ _-]?francisco\b/i, "City and County of San Francisco"],
];

const disciplineRules: ReadonlyArray<[RegExp, string]> = [
  [/\bstruct(?:ural|ure)?\b/i, "Structural"],
  [/\benergy\b|\btitle[ _-]?24\b|\bcf1r\b/i, "Energy"],
  [/\belectrical\b/i, "Electrical"],
  [/\bmechanical\b/i, "Mechanical"],
  [/\bplumbing\b/i, "Plumbing"],
  [/\bfire\b/i, "Fire"],
  [/\bplanning\b|\bzoning\b/i, "Planning"],
];

function normalizedStem(filename: string): string {
  return filename
    .replace(/\.[^.]+$/, "")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function matchValue(
  value: string,
  rules: ReadonlyArray<[RegExp, string]>,
): string | null {
  return rules.find(([pattern]) => pattern.test(value))?.[1] ?? null;
}

function permitNumberFromFilename(value: string): string | null {
  const explicit = value.match(
    /(?:permit|application|app)[ _-]?(?:no|number|#)?[ _-]*([a-z]{1,5}[ _-]?\d{2,6}(?:[ _-]\d{1,5})?)/i,
  );
  return explicit?.[1]?.replace(/[ _]+/g, "-").toUpperCase() ?? null;
}

function addressFromFilename(value: string): string | null {
  const match = value.match(
    /\b(\d{1,6}\s+[a-z][a-z0-9]*(?:\s+[a-z0-9]+){0,4}\s+(?:street|st|avenue|ave|road|rd|boulevard|blvd|drive|dr|lane|ln|court|ct|way))\b/i,
  );
  return match?.[1] ?? null;
}

function isoDateFromTimestamp(timestamp: number | null): string | null {
  if (timestamp === null || !Number.isFinite(timestamp) || timestamp <= 0) {
    return null;
  }
  return new Date(timestamp).toISOString().slice(0, 10);
}

export class PlaceholderEvidenceExtractor implements EvidenceExtractor {
  extract(
    metadata: EvidenceFileMetadata,
    classification: EvidenceClassification,
  ): EvidenceExtraction {
    const stem = normalizedStem(metadata.filename);
    const extension = evidenceFileExtension(metadata.filename);
    const permitNumber = permitNumberFromFilename(stem);
    const jurisdiction = matchValue(stem, jurisdictionRules);
    const address = addressFromFilename(stem);
    const discipline = matchValue(stem, disciplineRules);
    const documentDate = isoDateFromTimestamp(metadata.lastModified);
    const limited = extension === "eml" || extension === "heic";
    const detectedCount = [
      permitNumber,
      jurisdiction,
      address,
      documentDate,
      discipline,
    ].filter(Boolean).length;
    const confidence = Math.min(72, 28 + detectedCount * 8);
    const detectedIssues = [
      "OCR/AI content extraction has not run.",
      ...(!permitNumber ? ["Permit number needs review."] : []),
      ...(!jurisdiction ? ["Jurisdiction needs review."] : []),
      ...(!address ? ["Project address needs review."] : []),
      ...(limited
        ? [`${classification.detectedType} parsing is placeholder-only.`]
        : []),
    ];

    return {
      permitNumber,
      jurisdiction,
      address,
      documentDate,
      reviewer: null,
      discipline,
      confidence,
      detectedIssues,
      status: limited ? "placeholder_limited" : "placeholder_complete",
    };
  }
}

export const placeholderEvidenceExtractor = new PlaceholderEvidenceExtractor();
