import { StatusBadge } from "./StatusBadge";
import type { CaseDto, CaseListPagination } from "../types/cases";

interface CaseListProps {
  cases: CaseDto[];
  error: string;
  loading: boolean;
  pagination: CaseListPagination | null;
  onCreate: () => void;
  onNextPage: () => void;
  onOpenCase: (caseId: string) => void;
  onPreviousPage: () => void;
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

export function CaseList({
  cases,
  error,
  loading,
  pagination,
  onCreate,
  onNextPage,
  onOpenCase,
  onPreviousPage,
  onRetry,
}: CaseListProps) {
  const canGoPrevious = Boolean(pagination && pagination.offset > 0);
  const canGoNext = Boolean(
    pagination && cases.length === pagination.limit && cases.length > 0,
  );
  const showPagination = canGoPrevious || canGoNext;

  return (
    <section aria-labelledby="cases-title" className="workspace-panel">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">Cases</p>
          <h2 id="cases-title">Case list</h2>
        </div>
        <button className="secondary-button" type="button" onClick={onRetry}>
          Refresh
        </button>
      </div>

      {loading && (
        <div className="case-list-loading" role="status">
          <span>Loading cases...</span>
          <span />
          <span />
        </div>
      )}

      {!loading && error && (
        <div className="state-box state-box--error" role="alert">
          <h3>Cases could not be loaded</h3>
          <p>{error}</p>
          <button type="button" onClick={onRetry}>
            Retry
          </button>
        </div>
      )}

      {!loading && !error && cases.length === 0 && (
        <div className="state-box">
          <h3>No cases yet</h3>
          <p>
            Create a fictional local case to verify the authenticated workspace
            flow. New admin-created cases are unassigned in this milestone.
          </p>
          <button type="button" onClick={onCreate}>
            New case
          </button>
        </div>
      )}

      {!loading && !error && cases.length > 0 && (
        <>
          <ul className="case-list">
            {cases.map((caseRecord) => (
              <li className="case-list-item" key={caseRecord.id}>
                <div className="case-list-item__main">
                  <div>
                    <h3>{caseRecord.project_name}</h3>
                    <p>
                      {caseRecord.client_name} · {caseRecord.city}
                    </p>
                  </div>
                  <StatusBadge status={caseRecord.current_status} />
                </div>
                <dl className="case-meta-grid">
                  <div>
                    <dt>Jurisdiction</dt>
                    <dd>{caseRecord.jurisdiction}</dd>
                  </div>
                  <div>
                    <dt>Permit</dt>
                    <dd>{caseRecord.permit_number ?? "Not provided"}</dd>
                  </div>
                  <div>
                    <dt>Last updated</dt>
                    <dd>{formatDate(caseRecord.updated_at)}</dd>
                  </div>
                </dl>
                <button
                  className="link-button"
                  type="button"
                  onClick={() => onOpenCase(caseRecord.id)}
                >
                  Open details
                </button>
              </li>
            ))}
          </ul>

          {showPagination && (
            <nav className="pagination" aria-label="Case pages">
              <button
                className="secondary-button"
                disabled={!canGoPrevious}
                type="button"
                onClick={onPreviousPage}
              >
                Previous
              </button>
              <span>
                Offset {pagination?.offset ?? 0}
              </span>
              <button
                className="secondary-button"
                disabled={!canGoNext}
                type="button"
                onClick={onNextPage}
              >
                Next
              </button>
            </nav>
          )}
        </>
      )}
    </section>
  );
}
