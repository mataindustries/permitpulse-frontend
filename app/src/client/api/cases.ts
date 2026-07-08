import type {
  CaseActivityResponse,
  CaseDto,
  CaseListResponse,
  CreateCaseInput,
  UpdateCaseMetadataInput,
  UpdateCaseStatusInput,
} from "../types/cases";

export type CaseApiErrorKind =
  | "unauthorized"
  | "forbidden"
  | "validation"
  | "not-found"
  | "conflict"
  | "server"
  | "network";

export class CaseApiError extends Error {
  readonly kind: CaseApiErrorKind;
  readonly status: number;
  readonly code?: string;

  constructor(
    kind: CaseApiErrorKind,
    message: string,
    status: number,
    code?: string,
  ) {
    super(message);
    this.name = "CaseApiError";
    this.kind = kind;
    this.status = status;
    this.code = code;
  }
}

interface ErrorEnvelope {
  error?: {
    code?: unknown;
    message?: unknown;
  };
}

interface OkEnvelope<T> {
  ok: true;
  data: T;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function classifyStatus(status: number): CaseApiErrorKind {
  if (status === 401) {
    return "unauthorized";
  }

  if (status === 403) {
    return "forbidden";
  }

  if (status === 404) {
    return "not-found";
  }

  if (status === 409) {
    return "conflict";
  }

  if (status === 400 || status === 415) {
    return "validation";
  }

  return "server";
}

function fallbackMessage(kind: CaseApiErrorKind): string {
  switch (kind) {
    case "unauthorized":
      return "Your session expired. Sign in again.";
    case "validation":
      return "The case data could not be accepted. Review the fields and try again.";
    case "forbidden":
      return "You do not have permission to perform this case action.";
    case "not-found":
      return "The case was not found or is no longer available.";
    case "conflict":
      return "Someone or another request updated this case. Reload the latest version before trying again.";
    case "network":
      return "The network request could not be completed.";
    case "server":
      return "The case request could not be completed. Try again.";
  }
}

async function parseError(response: Response): Promise<CaseApiError> {
  const kind = classifyStatus(response.status);
  let code: string | undefined;
  let message = fallbackMessage(kind);

  if (response.headers.get("content-type")?.includes("application/json")) {
    try {
      const body = (await response.json()) as ErrorEnvelope;
      const responseCode = body.error?.code;
      const responseMessage = body.error?.message;

      if (typeof responseCode === "string") {
        code = responseCode;
      }

      if (typeof responseMessage === "string" && response.status < 500) {
        message = responseMessage;
      }
    } catch {
      // Keep the safe fallback. Response bodies may contain operational detail.
    }
  }

  return new CaseApiError(kind, message, response.status, code);
}

async function requestJson<T>(
  path: string,
  init?: RequestInit,
): Promise<T> {
  let response: Response;

  try {
    response = await fetch(path, {
      ...init,
      credentials: "same-origin",
      headers: {
        accept: "application/json",
        ...init?.headers,
      },
    });
  } catch {
    throw new CaseApiError(
      "network",
      fallbackMessage("network"),
      0,
      "NETWORK_ERROR",
    );
  }

  if (!response.ok) {
    throw await parseError(response);
  }

  const body = (await response.json()) as unknown;

  if (!isRecord(body) || body.ok !== true || !("data" in body)) {
    throw new CaseApiError(
      "server",
      fallbackMessage("server"),
      response.status,
      "INVALID_RESPONSE",
    );
  }

  return (body as unknown as OkEnvelope<T>).data;
}

export async function listCases(options: {
  limit?: number;
  offset?: number;
} = {}): Promise<CaseListResponse> {
  const searchParams = new URLSearchParams();

  if (typeof options.limit === "number") {
    searchParams.set("limit", String(options.limit));
  }

  if (typeof options.offset === "number" && options.offset > 0) {
    searchParams.set("offset", String(options.offset));
  }

  const query = searchParams.toString();

  return requestJson<CaseListResponse>(
    `/api/v1/cases${query ? `?${query}` : ""}`,
  );
}

export async function createCase(input: CreateCaseInput): Promise<CaseDto> {
  const body: CreateCaseInput = {
    project_name: input.project_name,
    client_name: input.client_name,
    address: input.address,
    city: input.city,
    jurisdiction: input.jurisdiction,
    permit_number: input.permit_number,
    current_status: input.current_status,
  };

  return requestJson<CaseDto>("/api/v1/cases", {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  });
}

export async function getCase(caseId: string): Promise<CaseDto> {
  return requestJson<CaseDto>(`/api/v1/cases/${encodeURIComponent(caseId)}`);
}

export async function updateCaseMetadata(
  caseId: string,
  input: UpdateCaseMetadataInput,
): Promise<CaseDto> {
  const body: UpdateCaseMetadataInput = {
    expected_version: input.expected_version,
  };

  for (const field of [
    "project_name",
    "client_name",
    "address",
    "city",
    "jurisdiction",
  ] as const) {
    if (input[field] !== undefined) {
      body[field] = input[field];
    }
  }

  if (input.permit_number !== undefined) {
    body.permit_number = input.permit_number;
  }

  return requestJson<CaseDto>(`/api/v1/cases/${encodeURIComponent(caseId)}`, {
    method: "PATCH",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  });
}

export async function updateCaseStatus(
  caseId: string,
  input: UpdateCaseStatusInput,
): Promise<CaseDto> {
  const body: UpdateCaseStatusInput = {
    expected_version: input.expected_version,
    current_status: input.current_status,
  };

  return requestJson<CaseDto>(
    `/api/v1/cases/${encodeURIComponent(caseId)}/status`,
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify(body),
    },
  );
}

export async function listCaseActivity(
  caseId: string,
  options: {
    limit?: number;
    offset?: number;
  } = {},
): Promise<CaseActivityResponse> {
  const searchParams = new URLSearchParams();
  const limit =
    typeof options.limit === "number"
      ? Math.min(Math.max(Math.trunc(options.limit), 1), 50)
      : 20;
  const offset =
    typeof options.offset === "number"
      ? Math.min(Math.max(Math.trunc(options.offset), 0), 10_000)
      : 0;

  searchParams.set("limit", String(limit));
  searchParams.set("offset", String(offset));

  return requestJson<CaseActivityResponse>(
    `/api/v1/cases/${encodeURIComponent(caseId)}/activity?${searchParams.toString()}`,
  );
}
