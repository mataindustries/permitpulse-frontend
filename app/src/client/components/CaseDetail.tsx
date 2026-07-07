import { StatusBadge } from "./StatusBadge";
import type { CaseDto } from "../types/cases";

interface CaseDetailProps {
  caseRecord: CaseDto | null;
  error: string;
  loading: boolean;
  onBack: () => void;
  onRetry: () => void;
}

function formatDate(value: string): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Unknown";
  }

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

export function CaseDetail({
  caseRecord,
  error,
  loading,
  onBack,
  onRetry,
}: CaseDetailProps) {
  return (
    <section aria-labelledby="case-detail-title" className="workspace-panel">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">Case detail</p>
          <h2 id="case-detail-title">
            {caseRecord?.project_name ?? "Case details"}
          </h2>
        </div>
        <button className="secondary-button" type="button" onClick={onBack}>
          Back to list
        </button>
      </div>

      {loading && <p role="status">Loading case details...</p>}

      {!loading && error && (
        <div className="state-box state-box--error" role="alert">
          <h3>Case unavailable</h3>
          <p>{error}</p>
          <div className="form-actions">
            <button type="button" onClick={onRetry}>
              Retry
            </button>
            <button className="secondary-button" type="button" onClick={onBack}>
              Back to list
            </button>
          </div>
        </div>
      )}

      {!loading && !error && caseRecord && (
        <div className="case-detail">
          <div className="case-detail__summary">
            <StatusBadge status={caseRecord.current_status} />
            <p>
              Editing and evidence tools are not available in this local
              milestone.
            </p>
          </div>
          <dl className="detail-grid">
            <div>
              <dt>Client</dt>
              <dd>{caseRecord.client_name}</dd>
            </div>
            <div>
              <dt>Address</dt>
              <dd>{caseRecord.address}</dd>
            </div>
            <div>
              <dt>City</dt>
              <dd>{caseRecord.city}</dd>
            </div>
            <div>
              <dt>Jurisdiction</dt>
              <dd>{caseRecord.jurisdiction}</dd>
            </div>
            <div>
              <dt>Permit number</dt>
              <dd>{caseRecord.permit_number ?? "Not provided"}</dd>
            </div>
            <div>
              <dt>Created</dt>
              <dd>{formatDate(caseRecord.created_at)}</dd>
            </div>
            <div>
              <dt>Updated</dt>
              <dd>{formatDate(caseRecord.updated_at)}</dd>
            </div>
          </dl>
        </div>
      )}
    </section>
  );
}
