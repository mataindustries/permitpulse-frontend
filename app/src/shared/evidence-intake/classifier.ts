import type {
  EvidenceClassification,
  EvidenceClassifier,
  EvidenceDraftCategory,
  EvidenceFileMetadata,
} from "./types";

const categoryRules: ReadonlyArray<{
  category: EvidenceDraftCategory;
  terms: readonly string[];
}> = [
  {
    category: "correction_notice",
    terms: ["correction", "corrections", "plan check", "plan-check", "notice"],
  },
  {
    category: "resubmittal_receipt",
    terms: ["resubmittal", "resubmission", "receipt", "submitted"],
  },
  {
    category: "structural_response",
    terms: ["structural", "structure", "response letter", "response-letter"],
  },
  {
    category: "energy_documents",
    terms: ["energy", "title 24", "title-24", "cf1r", "calcerts"],
  },
  {
    category: "permit_application",
    terms: ["permit application", "permit-application", "application", "app form"],
  },
  {
    category: "plan_sheets",
    terms: ["plan set", "plan-set", "plans", "sheet", "drawing", "blueprint"],
  },
  {
    category: "portal_screenshot",
    terms: ["portal", "screenshot", "screen shot", "status capture"],
  },
];

const detectedTypes: Record<string, string> = {
  pdf: "PDF document",
  jpg: "JPEG image",
  jpeg: "JPEG image",
  png: "PNG image",
  heic: "HEIC image",
  txt: "Text document",
  eml: "Email message",
};

export const acceptedEvidenceExtensions = Object.freeze(
  Object.keys(detectedTypes),
);

export function evidenceFileExtension(filename: string): string {
  const dot = filename.lastIndexOf(".");
  return dot >= 0 ? filename.slice(dot + 1).toLowerCase() : "";
}

export function isAcceptedEvidenceFile(filename: string): boolean {
  return acceptedEvidenceExtensions.includes(evidenceFileExtension(filename));
}

export class DeterministicEvidenceClassifier implements EvidenceClassifier {
  classify(metadata: EvidenceFileMetadata): EvidenceClassification {
    const extension = evidenceFileExtension(metadata.filename);
    const normalizedName = metadata.filename
      .replace(/[_]+/g, " ")
      .toLowerCase();

    if (extension === "eml" || metadata.mediaType === "message/rfc822") {
      return {
        category: "email",
        detectedType: detectedTypes[extension] ?? "Email message",
        reasons: ["Email file extension or media type"],
      };
    }

    for (const rule of categoryRules) {
      const matchedTerm = rule.terms.find((term) => normalizedName.includes(term));
      if (matchedTerm) {
        return {
          category: rule.category,
          detectedType: detectedTypes[extension] ?? metadata.mediaType,
          reasons: [`Filename contains “${matchedTerm}”`, `.${extension} file`],
        };
      }
    }

    if (["jpg", "jpeg", "png", "heic"].includes(extension)) {
      return {
        category: "portal_screenshot",
        detectedType: detectedTypes[extension],
        reasons: ["Image files default to portal screenshot pending review"],
      };
    }

    return {
      category: "other",
      detectedType:
        detectedTypes[extension] ?? (metadata.mediaType || "Unknown file"),
      reasons: ["No deterministic filename rule matched"],
    };
  }
}

export const deterministicEvidenceClassifier =
  new DeterministicEvidenceClassifier();
