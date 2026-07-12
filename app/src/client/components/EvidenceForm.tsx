import { type FormEvent, useEffect, useState } from "react";
import type { UserRole } from "../types/cases";
import type {
  CreateEvidenceInput,
  EvidenceItemDto,
  EvidenceType,
  UpdateEvidenceInput,
  VerificationStatus,
} from "../types/evidence-timeline";
import {
  evidenceTypeLabels,
  evidenceTypes,
  verificationStatusLabels,
  verificationStatuses,
} from "../types/evidence-timeline";
import { validateHttpUrl } from "./evidenceTimelineUtils";

type EvidenceFormMode = "create" | "edit";

interface EvidenceFormProps {
  currentUserId: string;
  error: string;
  evidence?: EvidenceItemDto;
  mode: EvidenceFormMode;
  role: UserRole;
  submitting: boolean;
  onCancel: () => void;
  onSubmit: (
    input: CreateEvidenceInput | UpdateEvidenceInput,
  ) => Promise<void>;
}

interface EvidenceFormValues {
  evidence_type: EvidenceType;
  title: string;
  summary: string;
  source_url: string;
  source_label: string;
  source_date: string;
  verification_status: VerificationStatus;
}

function valuesFromEvidence(evidence?: EvidenceItemDto): EvidenceFormValues {
  return {
    evidence_type: evidence?.evidence_type ?? "document",
    title: evidence?.title ?? "",
    summary: evidence?.summary ?? "",
    source_url: evidence?.source_url ?? "",
    source_label: evidence?.source_label ?? "",
    source_date: evidence?.source_date ?? "",
    verification_status: evidence?.verification_status ?? "unverified",
  };
}

function optionalValue(value: string): string | null {
  const trimmed = value.trim();

  return trimmed.length > 0 ? trimmed : null;
}

export function EvidenceForm({
  currentUserId,
  error,
  evidence,
  mode,
  role,
  submitting,
  onCancel,
  onSubmit,
}: EvidenceFormProps) {
  const [values, setValues] = useState<EvidenceFormValues>(() =>
    valuesFromEvidence(evidence),
  );
  const [clientError, setClientError] = useState("");

  const canVerify = mode === "edit" && role === "admin";
  const canEdit =
    mode === "create" ||
    role === "admin" ||
    evidence?.contributor?.id === currentUserId;

  useEffect(() => {
    setValues(valuesFromEvidence(evidence));
    setClientError("");
  }, [evidence?.id, evidence?.version]);

  function updateValue<Field extends keyof EvidenceFormValues>(
    field: Field,
    value: EvidenceFormValues[Field],
  ) {
    setValues((current) => ({ ...current, [field]: value }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (submitting || !canEdit) {
      return;
    }

    setClientError("");

    const trimmed = {
      evidence_type: values.evidence_type,
      title: values.title.trim(),
      summary: values.summary.trim(),
      source_url: optionalValue(values.source_url),
      source_label: optionalValue(values.source_label),
      source_date: optionalValue(values.source_date),
      verification_status: values.verification_status,
    };

    if (trimmed.title.length === 0 || trimmed.summary.length === 0) {
      setClientError("Complete title and summary before saving evidence.");
      return;
    }

    if (trimmed.source_url && !validateHttpUrl(trimmed.source_url)) {
      setClientError("Use an absolute HTTP or HTTPS source URL.");
      return;
    }

    if (
      canVerify &&
      trimmed.verification_status === "verified" &&
      (!trimmed.source_url || !trimmed.source_label || !trimmed.source_date)
    ) {
      setClientError(
        "Complete the source label, source date, and direct record URL before marking this evidence reviewed.",
      );
      return;
    }

    if (
      mode === "edit" &&
      canVerify &&
      evidence &&
      values.verification_status === "disputed" &&
      evidence.verification_status !== "disputed" &&
      !window.confirm("Mark this evidence as disputed?")
    ) {
      return;
    }

    if (mode === "create") {
      await onSubmit({
        evidence_type: trimmed.evidence_type,
        title: trimmed.title,
        summary: trimmed.summary,
        source_url: trimmed.source_url,
        source_label: trimmed.source_label,
        source_date: trimmed.source_date,
      });
      return;
    }

    if (!evidence) {
      return;
    }

    const input: UpdateEvidenceInput = {
      expected_version: evidence.version,
    };

    if (trimmed.evidence_type !== evidence.evidence_type) {
      input.evidence_type = trimmed.evidence_type;
    }

    if (trimmed.title !== evidence.title) {
      input.title = trimmed.title;
    }

    if (trimmed.summary !== evidence.summary) {
      input.summary = trimmed.summary;
    }

    if (trimmed.source_url !== evidence.source_url) {
      input.source_url = trimmed.source_url;
    }

    if (trimmed.source_label !== evidence.source_label) {
      input.source_label = trimmed.source_label;
    }

    if (trimmed.source_date !== evidence.source_date) {
      input.source_date = trimmed.source_date;
    }

    if (canVerify && trimmed.verification_status !== evidence.verification_status) {
      input.verification_status = trimmed.verification_status;
    }

    if (Object.keys(input).length === 1) {
      setClientError("Change at least one evidence field before saving.");
      return;
    }

    await onSubmit(input);
  }

  if (!canEdit) {
    return null;
  }

  return (
    <form className="case-form" onSubmit={(event) => void handleSubmit(event)}>
      <div className="form-grid">
        <label>
          Evidence type
          <select
            name="evidence_type"
            value={values.evidence_type}
            onChange={(event) =>
              updateValue("evidence_type", event.target.value as EvidenceType)
            }
          >
            {evidenceTypes.map((type) => (
              <option key={type} value={type}>
                {evidenceTypeLabels[type]}
              </option>
            ))}
          </select>
        </label>
        <label>
          Title
          <input
            name="title"
            required
            value={values.title}
            onChange={(event) => updateValue("title", event.target.value)}
          />
        </label>
        <label className="full-width-field">
          Summary
          <textarea
            name="summary"
            required
            rows={4}
            value={values.summary}
            onChange={(event) => updateValue("summary", event.target.value)}
          />
        </label>
        <label>
          Source URL <span className="field-note">required for reviewed evidence</span>
          <input
            inputMode="url"
            name="source_url"
            placeholder="Paste the direct record URL"
            value={values.source_url}
            onChange={(event) => updateValue("source_url", event.target.value)}
          />
        </label>
        <label>
          Source label <span className="field-note">required for reviewed evidence</span>
          <input
            name="source_label"
            value={values.source_label}
            onChange={(event) => updateValue("source_label", event.target.value)}
          />
        </label>
        <label>
          Source date <span className="field-note">required for reviewed evidence</span>
          <input
            name="source_date"
            type="date"
            value={values.source_date}
            onChange={(event) => updateValue("source_date", event.target.value)}
          />
        </label>
        {canVerify && (
          <label>
            Verification status
            <select
              name="verification_status"
              value={values.verification_status}
              onChange={(event) =>
                updateValue(
                  "verification_status",
                  event.target.value as VerificationStatus,
                )
              }
            >
              {verificationStatuses.map((status) => (
                <option key={status} value={status}>
                  {verificationStatusLabels[status]}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>

      {(clientError || error) && (
        <p className="error" role="alert">
          {clientError || error}
        </p>
      )}

      <div className="form-actions">
        <button disabled={submitting} type="submit">
          {submitting
            ? "Saving..."
            : mode === "create"
              ? "Add evidence"
              : "Save evidence"}
        </button>
        <button
          className="secondary-button"
          disabled={submitting}
          type="button"
          onClick={onCancel}
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
