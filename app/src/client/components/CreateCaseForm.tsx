import { type FormEvent, useState } from "react";
import {
  caseStatusLabels,
  caseStatuses,
  type CaseStatus,
  type CreateCaseInput,
} from "../types/cases";

interface CreateCaseFormProps {
  error: string;
  submitting: boolean;
  onCancel: () => void;
  onSubmit: (input: CreateCaseInput) => Promise<void>;
}

type FormValues = Record<keyof CreateCaseInput, string>;

const initialValues: FormValues = {
  project_name: "",
  client_name: "",
  address: "",
  city: "",
  jurisdiction: "",
  permit_number: "",
  current_status: "intake",
};

const requiredFields: Array<keyof Omit<CreateCaseInput, "permit_number">> = [
  "project_name",
  "client_name",
  "address",
  "city",
  "jurisdiction",
  "current_status",
];

function isCaseStatus(value: string): value is CaseStatus {
  return caseStatuses.includes(value as CaseStatus);
}

export function CreateCaseForm({
  error,
  submitting,
  onCancel,
  onSubmit,
}: CreateCaseFormProps) {
  const [values, setValues] = useState<FormValues>(initialValues);
  const [clientError, setClientError] = useState("");

  function updateValue(field: keyof CreateCaseInput, value: string) {
    setValues((current) => ({ ...current, [field]: value }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setClientError("");

    const trimmed = {
      project_name: values.project_name.trim(),
      client_name: values.client_name.trim(),
      address: values.address.trim(),
      city: values.city.trim(),
      jurisdiction: values.jurisdiction.trim(),
      permit_number: values.permit_number.trim(),
      current_status: values.current_status.trim(),
    };

    const missingRequiredField = requiredFields.some(
      (field) => trimmed[field].length === 0,
    );

    if (missingRequiredField) {
      setClientError("Complete all required fields before creating the case.");
      return;
    }

    if (!isCaseStatus(trimmed.current_status)) {
      setClientError("Choose an allowed case status.");
      return;
    }

    await onSubmit({
      project_name: trimmed.project_name,
      client_name: trimmed.client_name,
      address: trimmed.address,
      city: trimmed.city,
      jurisdiction: trimmed.jurisdiction,
      permit_number:
        trimmed.permit_number.length > 0 ? trimmed.permit_number : null,
      current_status: trimmed.current_status,
    });
  }

  return (
    <section aria-labelledby="create-case-title" className="workspace-panel">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">New case</p>
          <h2 id="create-case-title">Create case</h2>
        </div>
        <button className="secondary-button" type="button" onClick={onCancel}>
          Back to list
        </button>
      </div>
      <p>
        Cases created by administrators are unassigned until participant tools
        are added in a later milestone.
      </p>

      <form className="case-form" onSubmit={(event) => void handleSubmit(event)}>
        <label>
          Project name
          <input
            autoComplete="off"
            name="project_name"
            required
            value={values.project_name}
            onChange={(event) => updateValue("project_name", event.target.value)}
          />
        </label>
        <label>
          Client name
          <input
            autoComplete="off"
            name="client_name"
            required
            value={values.client_name}
            onChange={(event) => updateValue("client_name", event.target.value)}
          />
        </label>
        <label>
          Address
          <input
            autoComplete="street-address"
            name="address"
            required
            value={values.address}
            onChange={(event) => updateValue("address", event.target.value)}
          />
        </label>
        <div className="form-grid">
          <label>
            City
            <input
              autoComplete="address-level2"
              name="city"
              required
              value={values.city}
              onChange={(event) => updateValue("city", event.target.value)}
            />
          </label>
          <label>
            Jurisdiction
            <input
              autoComplete="off"
              name="jurisdiction"
              required
              value={values.jurisdiction}
              onChange={(event) =>
                updateValue("jurisdiction", event.target.value)
              }
            />
          </label>
        </div>
        <div className="form-grid">
          <label>
            Permit number <span className="field-note">optional</span>
            <input
              autoComplete="off"
              name="permit_number"
              value={values.permit_number}
              onChange={(event) =>
                updateValue("permit_number", event.target.value)
              }
            />
          </label>
          <label>
            Current status
            <select
              name="current_status"
              required
              value={values.current_status}
              onChange={(event) =>
                updateValue("current_status", event.target.value)
              }
            >
              {caseStatuses.map((status) => (
                <option key={status} value={status}>
                  {caseStatusLabels[status]}
                </option>
              ))}
            </select>
          </label>
        </div>

        {(clientError || error) && (
          <p className="error" role="alert">
            {clientError || error}
          </p>
        )}

        <div className="form-actions">
          <button disabled={submitting} type="submit">
            {submitting ? "Creating..." : "Create case"}
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
    </section>
  );
}
