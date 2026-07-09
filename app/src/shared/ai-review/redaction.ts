export type PacketReviewSafetyWarningSeverity = "warning" | "block";

export interface PacketReviewSafetyWarning {
  path: string;
  key: string;
  matched_label: string;
  severity: PacketReviewSafetyWarningSeverity;
  message: string;
}

export interface PacketReviewSafetyScan {
  blocked: boolean;
  warnings: PacketReviewSafetyWarning[];
}

const forbiddenLabels = new Set([
  "password",
  "token",
  "cookie",
  "session",
  "authorization",
  "account",
  "api_key",
  "secret",
  "hash",
  "request_id",
]);

function normalizedKey(value: string): string {
  return value
    .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function matchedForbiddenLabels(key: string): string[] {
  const normalized = normalizedKey(key);

  if (forbiddenLabels.has(normalized)) {
    return [normalized];
  }

  const matches = new Set<string>();

  if (normalized.includes("api_key")) {
    matches.add("api_key");
  }

  if (normalized.includes("request_id")) {
    matches.add("request_id");
  }

  const segments = normalized.split("_");

  for (const label of forbiddenLabels) {
    if (!label.includes("_") && segments.includes(label)) {
      matches.add(label);
    }
  }

  return [...matches];
}

export function scanPacketReviewSafety(value: unknown): PacketReviewSafetyScan {
  const warnings: PacketReviewSafetyWarning[] = [];
  const visited = new WeakSet<object>();

  function scan(current: unknown, path: string): void {
    if (!current || typeof current !== "object") {
      return;
    }

    if (visited.has(current)) {
      return;
    }

    visited.add(current);

    if (Array.isArray(current)) {
      current.forEach((item, index) => scan(item, `${path}[${index}]`));
      return;
    }

    for (const [key, child] of Object.entries(current)) {
      const childPath = path ? `${path}.${key}` : key;
      const matchedLabels = matchedForbiddenLabels(key);

      for (const matchedLabel of matchedLabels) {
        warnings.push({
          path: childPath,
          key,
          matched_label: matchedLabel,
          severity: "block",
          message: `Forbidden structured field detected: ${matchedLabel}.`,
        });
      }

      scan(child, childPath);
    }
  }

  scan(value, "");

  return {
    blocked: warnings.some((warning) => warning.severity === "block"),
    warnings,
  };
}
