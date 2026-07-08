import { useState } from "react";
import {
  caseStatusLabels,
  type CaseDto,
  type CaseStatus,
  type UpdateCaseStatusInput,
} from "../types/cases";
import { StatusBadge } from "./StatusBadge";

interface StatusManagementProps {
  caseRecord: CaseDto;
  error: string;
  submitting: boolean;
  onSubmit: (input: UpdateCaseStatusInput) => Promise<void>;
}

const statusTransitions = {
  intake: ["researching", "needs_information"],
  researching: ["needs_information", "ready_for_review"],
  needs_information: ["researching", "ready_for_review"],
  ready_for_review: ["researching"],
} as const satisfies Record<CaseStatus, readonly CaseStatus[]>;

export function validNextStatuses(status: CaseStatus): readonly CaseStatus[] {
  return statusTransitions[status].filter((nextStatus) => nextStatus !== status);
}

export function StatusManagement({
  caseRecord,
  error,
  submitting,
  onSubmit,
}: StatusManagementProps) {
  const [targetStatus, setTargetStatus] = useState<CaseStatus | null>(null);
  const nextStatuses = validNextStatuses(caseRecord.current_status);

  async function confirmTransition() {
    if (!targetStatus || submitting) {
      return;
    }

    await onSubmit({
      expected_version: caseRecord.version,
      current_status: targetStatus,
    });
    setTargetStatus(null);
  }

  return (
    <section className="detail-section" aria-labelledby="status-management-title">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Status management</p>
          <h3 id="status-management-title">Administrator status controls</h3>
        </div>
        <StatusBadge status={caseRecord.current_status} />
      </div>

      {nextStatuses.length === 0 ? (
        <p>No status transitions are currently available.</p>
      ) : (
        <div className="status-options" aria-label="Available status transitions">
          {nextStatuses.map((status) => (
            <button
              className="secondary-button"
              disabled={submitting}
              key={status}
              type="button"
              onClick={() => setTargetStatus(status)}
            >
              {caseStatusLabels[status]}
            </button>
          ))}
        </div>
      )}

      {targetStatus && (
        <div className="state-box confirmation-box" role="alert">
          <h3>Confirm status change</h3>
          <p>
            Change status from{" "}
            <strong>{caseStatusLabels[caseRecord.current_status]}</strong> to{" "}
            <strong>{caseStatusLabels[targetStatus]}</strong>?
          </p>
          <div className="form-actions">
            <button
              disabled={submitting}
              type="button"
              onClick={() => void confirmTransition()}
            >
              {submitting ? "Updating..." : "Confirm change"}
            </button>
            <button
              className="secondary-button"
              disabled={submitting}
              type="button"
              onClick={() => setTargetStatus(null)}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
    </section>
  );
}
