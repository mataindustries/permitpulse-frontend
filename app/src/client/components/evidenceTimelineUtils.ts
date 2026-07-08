import { CaseApiError } from "../api/cases";

export function formatDateTime(value: string): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Unknown";
  }

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

export function formatDateOnly(value: string | null): string {
  if (!value) {
    return "Not provided";
  }

  const date = new Date(`${value}T00:00:00Z`);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeZone: "UTC",
  }).format(date);
}

export function contributorName(contributor: { name: string | null } | null) {
  return contributor?.name?.trim() || "Unknown contributor";
}

export function safeExternalHref(value: string | null): string | null {
  if (!value) {
    return null;
  }

  try {
    const url = new URL(value);

    if (url.protocol !== "http:" && url.protocol !== "https:") {
      return null;
    }

    return url.href;
  } catch {
    return null;
  }
}

export function safeRecordError(error: unknown): string {
  if (error instanceof CaseApiError) {
    if (error.kind === "conflict" && error.code === "STALE_VERSION") {
      return "Someone or another request updated this record. Reload the latest version before trying again.";
    }

    if (
      error.kind === "validation" ||
      error.kind === "forbidden" ||
      error.kind === "not-found" ||
      error.kind === "conflict"
    ) {
      return error.message;
    }
  }

  if (
    typeof error === "object" &&
    error !== null &&
    "message" in error &&
    typeof error.message === "string"
  ) {
    return error.message;
  }

  return "The record action could not be completed. Try again.";
}

export function isStaleRecordVersion(error: unknown): boolean {
  return (
    error instanceof CaseApiError &&
    error.kind === "conflict" &&
    error.code === "STALE_VERSION"
  );
}

export function validateHttpUrl(value: string): boolean {
  if (value.trim().length === 0) {
    return true;
  }

  return safeExternalHref(value.trim()) !== null;
}
