import { type FormEvent, useEffect, useMemo, useState } from "react";
import type { UserRole } from "../types/cases";
import type {
  CreateTimelineInput,
  EvidenceItemDto,
  TimelineEntryDto,
  TimelineType,
  UpdateTimelineInput,
} from "../types/evidence-timeline";
import { timelineTypeLabels, timelineTypes } from "../types/evidence-timeline";

type TimelineFormMode = "create" | "edit";

interface TimelineFormProps {
  currentUserId: string;
  error: string;
  evidence: EvidenceItemDto[];
  mode: TimelineFormMode;
  role: UserRole;
  submitting: boolean;
  timelineEntry?: TimelineEntryDto;
  onCancel: () => void;
  onSubmit: (
    input: CreateTimelineInput | UpdateTimelineInput,
  ) => Promise<void>;
}

interface TimelineFormValues {
  occurred_on: string;
  timeline_type: TimelineType;
  title: string;
  details: string;
  is_canonical: boolean;
  evidence_ids: string[];
}

function valuesFromTimeline(timelineEntry?: TimelineEntryDto): TimelineFormValues {
  return {
    occurred_on: timelineEntry?.occurred_on ?? "",
    timeline_type: timelineEntry?.timeline_type ?? "submission",
    title: timelineEntry?.title ?? "",
    details: timelineEntry?.details ?? "",
    is_canonical: timelineEntry?.is_canonical ?? false,
    evidence_ids: timelineEntry?.evidence_ids ?? [],
  };
}

function isIsoDate(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

export function TimelineForm({
  currentUserId,
  error,
  evidence,
  mode,
  role,
  submitting,
  timelineEntry,
  onCancel,
  onSubmit,
}: TimelineFormProps) {
  const [values, setValues] = useState<TimelineFormValues>(() =>
    valuesFromTimeline(timelineEntry),
  );
  const [clientError, setClientError] = useState("");
  const canEdit =
    mode === "create" ||
    role === "admin" ||
    (!!timelineEntry &&
      !timelineEntry.is_canonical &&
      timelineEntry.contributor?.id === currentUserId);

  const selectableEvidence = useMemo(() => {
    const seen = new Set<string>();

    return evidence.filter((item) => {
      if (seen.has(item.id)) {
        return false;
      }

      seen.add(item.id);

      return role === "admin" || item.contributor?.id === currentUserId;
    });
  }, [currentUserId, evidence, role]);

  useEffect(() => {
    setValues(valuesFromTimeline(timelineEntry));
    setClientError("");
  }, [timelineEntry?.id, timelineEntry?.version]);

  function updateValue<Field extends keyof TimelineFormValues>(
    field: Field,
    value: TimelineFormValues[Field],
  ) {
    setValues((current) => ({ ...current, [field]: value }));
  }

  function toggleEvidence(id: string, checked: boolean) {
    setValues((current) => {
      const next = new Set(current.evidence_ids);

      if (checked) {
        next.add(id);
      } else {
        next.delete(id);
      }

      return { ...current, evidence_ids: Array.from(next).slice(0, 20) };
    });
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (submitting || !canEdit) {
      return;
    }

    setClientError("");

    const trimmed = {
      occurred_on: values.occurred_on.trim(),
      timeline_type: values.timeline_type,
      title: values.title.trim(),
      details: values.details.trim(),
      is_canonical: role === "admin" ? values.is_canonical : false,
      evidence_ids: Array.from(new Set(values.evidence_ids)).slice(0, 20),
    };

    if (
      trimmed.occurred_on.length === 0 ||
      trimmed.title.length === 0 ||
      trimmed.details.length === 0
    ) {
      setClientError("Complete date, title, and details before saving.");
      return;
    }

    if (!isIsoDate(trimmed.occurred_on)) {
      setClientError("Use a valid ISO date.");
      return;
    }

    if (mode === "create") {
      const input: CreateTimelineInput = {
        occurred_on: trimmed.occurred_on,
        timeline_type: trimmed.timeline_type,
        title: trimmed.title,
        details: trimmed.details,
        evidence_ids: trimmed.evidence_ids,
      };

      if (role === "admin") {
        input.is_canonical = trimmed.is_canonical;
      }

      await onSubmit(input);
      return;
    }

    if (!timelineEntry) {
      return;
    }

    const input: UpdateTimelineInput = {
      expected_version: timelineEntry.version,
    };

    if (trimmed.occurred_on !== timelineEntry.occurred_on) {
      input.occurred_on = trimmed.occurred_on;
    }

    if (trimmed.timeline_type !== timelineEntry.timeline_type) {
      input.timeline_type = trimmed.timeline_type;
    }

    if (trimmed.title !== timelineEntry.title) {
      input.title = trimmed.title;
    }

    if (trimmed.details !== timelineEntry.details) {
      input.details = trimmed.details;
    }

    if (role === "admin" && trimmed.is_canonical !== timelineEntry.is_canonical) {
      input.is_canonical = trimmed.is_canonical;
    }

    if (Object.keys(input).length === 1) {
      setClientError("Change at least one timeline field before saving.");
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
          Occurred date
          <input
            name="occurred_on"
            required
            type="date"
            value={values.occurred_on}
            onChange={(event) => updateValue("occurred_on", event.target.value)}
          />
        </label>
        <label>
          Timeline type
          <select
            name="timeline_type"
            value={values.timeline_type}
            onChange={(event) =>
              updateValue("timeline_type", event.target.value as TimelineType)
            }
          >
            {timelineTypes.map((type) => (
              <option key={type} value={type}>
                {timelineTypeLabels[type]}
              </option>
            ))}
          </select>
        </label>
        <label className="full-width-field">
          Title
          <input
            name="title"
            required
            value={values.title}
            onChange={(event) => updateValue("title", event.target.value)}
          />
        </label>
        <label className="full-width-field">
          Details
          <textarea
            name="details"
            required
            rows={4}
            value={values.details}
            onChange={(event) => updateValue("details", event.target.value)}
          />
        </label>
        {role === "admin" && (
          <label className="checkbox-field">
            <input
              checked={values.is_canonical}
              name="is_canonical"
              type="checkbox"
              onChange={(event) =>
                updateValue("is_canonical", event.target.checked)
              }
            />
            Canonical timeline entry
          </label>
        )}
      </div>

      {mode === "create" && selectableEvidence.length > 0 && (
        <fieldset className="checkbox-group">
          <legend>Supporting evidence</legend>
          {selectableEvidence.map((item) => (
            <label className="checkbox-field" key={item.id}>
              <input
                checked={values.evidence_ids.includes(item.id)}
                name="evidence_ids"
                type="checkbox"
                value={item.id}
                onChange={(event) =>
                  toggleEvidence(item.id, event.target.checked)
                }
              />
              {item.title}
            </label>
          ))}
        </fieldset>
      )}

      {mode === "edit" && (
        <p className="field-note">
          Supporting evidence links are changed with the link controls.
        </p>
      )}

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
              ? "Add timeline entry"
              : "Save timeline entry"}
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
