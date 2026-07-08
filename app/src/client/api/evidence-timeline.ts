import { requestJson } from "./cases";
import type {
  CreateEvidenceInput,
  CreateTimelineInput,
  EvidenceItemDto,
  EvidenceListResponse,
  TimelineEntryDto,
  TimelineListResponse,
  UpdateEvidenceInput,
  UpdateTimelineInput,
} from "../types/evidence-timeline";

interface PaginationOptions {
  limit?: number;
  offset?: number;
}

function boundedSearchParams(options: PaginationOptions = {}) {
  const limit =
    typeof options.limit === "number"
      ? Math.min(Math.max(Math.trunc(options.limit), 1), 50)
      : 20;
  const offset =
    typeof options.offset === "number"
      ? Math.min(Math.max(Math.trunc(options.offset), 0), 10_000)
      : 0;
  const searchParams = new URLSearchParams();

  searchParams.set("limit", String(limit));
  searchParams.set("offset", String(offset));

  return searchParams;
}

function caseBasePath(caseId: string) {
  return `/api/v1/cases/${encodeURIComponent(caseId)}`;
}

export async function createEvidence(
  caseId: string,
  input: CreateEvidenceInput,
): Promise<EvidenceItemDto> {
  const body: CreateEvidenceInput = {
    evidence_type: input.evidence_type,
    title: input.title,
    summary: input.summary,
  };

  if (input.source_url !== undefined) {
    body.source_url = input.source_url;
  }

  if (input.source_label !== undefined) {
    body.source_label = input.source_label;
  }

  if (input.source_date !== undefined) {
    body.source_date = input.source_date;
  }

  return requestJson<EvidenceItemDto>(`${caseBasePath(caseId)}/evidence`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  });
}

export async function listEvidence(
  caseId: string,
  options: PaginationOptions = {},
): Promise<EvidenceListResponse> {
  const searchParams = boundedSearchParams(options);

  return requestJson<EvidenceListResponse>(
    `${caseBasePath(caseId)}/evidence?${searchParams.toString()}`,
  );
}

export async function getEvidence(
  caseId: string,
  evidenceId: string,
): Promise<EvidenceItemDto> {
  return requestJson<EvidenceItemDto>(
    `${caseBasePath(caseId)}/evidence/${encodeURIComponent(evidenceId)}`,
  );
}

export async function updateEvidence(
  caseId: string,
  evidenceId: string,
  input: UpdateEvidenceInput,
): Promise<EvidenceItemDto> {
  const body: UpdateEvidenceInput = {
    expected_version: input.expected_version,
  };

  if (input.evidence_type !== undefined) {
    body.evidence_type = input.evidence_type;
  }

  if (input.title !== undefined) {
    body.title = input.title;
  }

  if (input.summary !== undefined) {
    body.summary = input.summary;
  }

  for (const field of ["source_url", "source_label", "source_date"] as const) {
    if (input[field] !== undefined) {
      body[field] = input[field];
    }
  }

  if (input.verification_status !== undefined) {
    body.verification_status = input.verification_status;
  }

  return requestJson<EvidenceItemDto>(
    `${caseBasePath(caseId)}/evidence/${encodeURIComponent(evidenceId)}`,
    {
      method: "PATCH",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify(body),
    },
  );
}

export async function createTimelineEntry(
  caseId: string,
  input: CreateTimelineInput,
): Promise<TimelineEntryDto> {
  const body: CreateTimelineInput = {
    occurred_on: input.occurred_on,
    timeline_type: input.timeline_type,
    title: input.title,
    details: input.details,
  };

  if (input.is_canonical !== undefined) {
    body.is_canonical = input.is_canonical;
  }

  if (input.evidence_ids !== undefined) {
    body.evidence_ids = Array.from(new Set(input.evidence_ids)).slice(0, 20);
  }

  return requestJson<TimelineEntryDto>(`${caseBasePath(caseId)}/timeline`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  });
}

export async function listTimelineEntries(
  caseId: string,
  options: PaginationOptions = {},
): Promise<TimelineListResponse> {
  const searchParams = boundedSearchParams(options);

  return requestJson<TimelineListResponse>(
    `${caseBasePath(caseId)}/timeline?${searchParams.toString()}`,
  );
}

export async function getTimelineEntry(
  caseId: string,
  timelineId: string,
): Promise<TimelineEntryDto> {
  return requestJson<TimelineEntryDto>(
    `${caseBasePath(caseId)}/timeline/${encodeURIComponent(timelineId)}`,
  );
}

export async function updateTimelineEntry(
  caseId: string,
  timelineId: string,
  input: UpdateTimelineInput,
): Promise<TimelineEntryDto> {
  const body: UpdateTimelineInput = {
    expected_version: input.expected_version,
  };

  if (input.occurred_on !== undefined) {
    body.occurred_on = input.occurred_on;
  }

  if (input.timeline_type !== undefined) {
    body.timeline_type = input.timeline_type;
  }

  if (input.title !== undefined) {
    body.title = input.title;
  }

  if (input.details !== undefined) {
    body.details = input.details;
  }

  if (input.is_canonical !== undefined) {
    body.is_canonical = input.is_canonical;
  }

  return requestJson<TimelineEntryDto>(
    `${caseBasePath(caseId)}/timeline/${encodeURIComponent(timelineId)}`,
    {
      method: "PATCH",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify(body),
    },
  );
}

export async function linkTimelineEvidence(
  caseId: string,
  timelineId: string,
  evidenceId: string,
): Promise<TimelineEntryDto> {
  return requestJson<TimelineEntryDto>(
    `${caseBasePath(caseId)}/timeline/${encodeURIComponent(timelineId)}/evidence`,
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({ evidence_id: evidenceId }),
    },
  );
}

export async function unlinkTimelineEvidence(
  caseId: string,
  timelineId: string,
  evidenceId: string,
): Promise<TimelineEntryDto> {
  return requestJson<TimelineEntryDto>(
    `${caseBasePath(caseId)}/timeline/${encodeURIComponent(timelineId)}/evidence/${encodeURIComponent(evidenceId)}`,
    {
      method: "DELETE",
    },
  );
}
