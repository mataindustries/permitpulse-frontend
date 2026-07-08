import {
  caseStatusLabels,
  type CaseActivityEntry,
  type CaseActivityResponse,
} from "../types/cases";

interface CaseActivityProps {
  error: string;
  loading: boolean;
  response: CaseActivityResponse | null;
  onNextPage: () => void;
  onPreviousPage: () => void;
  onRetry: () => void;
}

const actionLabels: Record<CaseActivityEntry["action"], string> = {
  case_created: "Case created",
  case_updated: "Case details updated",
  case_status_changed: "Status changed",
};

const fieldLabels: Record<string, string> = {
  project_name: "Project name",
  client_name: "Client name",
  address: "Address",
  city: "City",
  jurisdiction: "Jurisdiction",
  permit_number: "Permit number",
  current_status: "Current status",
};

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

function changedFieldLabels(entry: CaseActivityEntry): string {
  return entry.changed_fields
    .filter((field) => field in fieldLabels)
    .map((field) => fieldLabels[field])
    .join(", ");
}

export function CaseActivity({
  error,
  loading,
  response,
  onNextPage,
  onPreviousPage,
  onRetry,
}: CaseActivityProps) {
  const activity = response?.activity ?? [];
  const pagination = response?.pagination ?? { limit: 20, offset: 0 };
  const canGoPrevious = pagination.offset > 0;
  const canGoNext = activity.length === pagination.limit && activity.length > 0;

  return (
    <section className="detail-section" aria-labelledby="case-activity-title">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Activity</p>
          <h3 id="case-activity-title">Immutable case activity</h3>
        </div>
        <button className="secondary-button" type="button" onClick={onRetry}>
          Refresh activity
        </button>
      </div>

      {loading && <p role="status">Loading case activity...</p>}

      {!loading && error && (
        <div className="state-box state-box--error" role="alert">
          <h3>Activity could not be loaded</h3>
          <p>{error}</p>
          <button type="button" onClick={onRetry}>
            Retry
          </button>
        </div>
      )}

      {!loading && !error && activity.length === 0 && (
        <div className="state-box">
          <h3>No activity yet</h3>
          <p>
            No immutable activity entries are available for this case. Cases
            created before audit history existed may not have prior events.
          </p>
        </div>
      )}

      {!loading && !error && activity.length > 0 && (
        <>
          <ol className="activity-list">
            {activity.map((entry) => {
              const fields = changedFieldLabels(entry);

              return (
                <li className="activity-item" key={entry.id}>
                  <div className="activity-item__header">
                    <strong>{actionLabels[entry.action]}</strong>
                    <time dateTime={entry.created_at}>
                      {formatDate(entry.created_at)}
                    </time>
                  </div>
                  <p>
                    Actor:{" "}
                    <strong>{entry.actor?.name?.trim() || "System"}</strong>
                  </p>
                  {fields && <p>Changed fields: {fields}</p>}
                  {entry.action === "case_status_changed" &&
                    entry.from_status &&
                    entry.to_status && (
                      <p>
                        Status: {caseStatusLabels[entry.from_status]} to{" "}
                        {caseStatusLabels[entry.to_status]}
                      </p>
                    )}
                </li>
              );
            })}
          </ol>

          {(canGoPrevious || canGoNext) && (
            <nav className="pagination" aria-label="Activity pages">
              <button
                className="secondary-button"
                disabled={!canGoPrevious}
                type="button"
                onClick={onPreviousPage}
              >
                Previous
              </button>
              <span>Offset {pagination.offset}</span>
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
