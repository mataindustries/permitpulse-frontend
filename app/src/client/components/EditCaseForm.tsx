import { type FormEvent, useEffect, useState } from "react";
import type {
  CaseDto,
  UpdateCaseMetadataInput,
} from "../types/cases";

interface EditCaseFormProps {
  caseRecord: CaseDto;
  error: string;
  submitting: boolean;
  onCancel: () => void;
  onSubmit: (input: UpdateCaseMetadataInput) => Promise<void>;
}

type EditableField =
  | "project_name"
  | "client_name"
  | "address"
  | "city"
  | "jurisdiction"
  | "permit_number";

type FormValues = Record<EditableField, string>;

const editableFields = [
  "project_name",
  "client_name",
  "address",
  "city",
  "jurisdiction",
  "permit_number",
] as const satisfies readonly EditableField[];

const requiredFields = [
  "project_name",
  "client_name",
  "address",
  "city",
  "jurisdiction",
] as const satisfies readonly EditableField[];

function valuesFromCase(caseRecord: CaseDto): FormValues {
  return {
    project_name: caseRecord.project_name,
    client_name: caseRecord.client_name,
    address: caseRecord.address,
    city: caseRecord.city,
    jurisdiction: caseRecord.jurisdiction,
    permit_number: caseRecord.permit_number ?? "",
  };
}

function displayLabel(field: EditableField): string {
  switch (field) {
    case "project_name":
      return "Project name";
    case "client_name":
      return "Client name";
    case "address":
      return "Address";
    case "city":
      return "City";
    case "jurisdiction":
      return "Jurisdiction";
    case "permit_number":
      return "Permit number";
  }
}

export function EditCaseForm({
  caseRecord,
  error,
  submitting,
  onCancel,
  onSubmit,
}: EditCaseFormProps) {
  const [values, setValues] = useState<FormValues>(() =>
    valuesFromCase(caseRecord),
  );
  const [clientError, setClientError] = useState("");

  useEffect(() => {
    setValues(valuesFromCase(caseRecord));
    setClientError("");
  }, [caseRecord.id, caseRecord.version]);

  function updateValue(field: EditableField, value: string) {
    setValues((current) => ({ ...current, [field]: value }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (submitting) {
      return;
    }

    setClientError("");

    const trimmed: FormValues = {
      project_name: values.project_name.trim(),
      client_name: values.client_name.trim(),
      address: values.address.trim(),
      city: values.city.trim(),
      jurisdiction: values.jurisdiction.trim(),
      permit_number: values.permit_number.trim(),
    };

    if (requiredFields.some((field) => trimmed[field].length === 0)) {
      setClientError("Complete all required fields before saving.");
      return;
    }

    const input: UpdateCaseMetadataInput = {
      expected_version: caseRecord.version,
    };

    for (const field of requiredFields) {
      const nextValue =
        trimmed[field];
      const currentValue = caseRecord[field];

      if (nextValue !== currentValue) {
        input[field] = nextValue;
      }
    }

    const nextPermitNumber =
      trimmed.permit_number.length > 0 ? trimmed.permit_number : null;

    if (nextPermitNumber !== caseRecord.permit_number) {
      input.permit_number = nextPermitNumber;
    }

    if (Object.keys(input).length === 1) {
      setClientError("Change at least one case detail before saving.");
      return;
    }

    await onSubmit(input);
  }

  return (
    <form className="case-form" onSubmit={(event) => void handleSubmit(event)}>
      <div className="form-grid">
        {editableFields.map((field) => (
          <label key={field}>
            {displayLabel(field)}
            {field === "permit_number" && (
              <span className="field-note">optional</span>
            )}
            <input
              autoComplete={field === "address" ? "street-address" : "off"}
              name={field}
              required={(requiredFields as readonly string[]).includes(field)}
              value={values[field]}
              onChange={(event) => updateValue(field, event.target.value)}
            />
          </label>
        ))}
      </div>

      {(clientError || error) && (
        <p className="error" role="alert">
          {clientError || error}
        </p>
      )}

      <div className="form-actions">
        <button disabled={submitting} type="submit">
          {submitting ? "Saving..." : "Save details"}
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
