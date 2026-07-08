import type {
  EvidenceItemDto,
  TimelineEntryDto,
  TimelineListResponse,
} from "../types/evidence-timeline";
import type { UserRole } from "../types/cases";
import { timelineTypeLabels } from "../types/evidence-timeline";
import {
  contributorName,
  formatDateOnly,
  formatDateTime,
} from "./evidenceTimelineUtils";

interface TimelineListProps {
  currentUserId: string;
  error: string;
  evidence: EvidenceItemDto[];
  loading: boolean;
  role: UserRole;
  response: TimelineListResponse | null;
  selectedTimelineId: string | null;
  onEditTimeline: (timeline: TimelineEntryDto) => void;
  onNextPage: () => void;
  onOpenEvidence: (evidence: EvidenceItemDto) => void;
  onPreviousPage: () => void;
  onRetry: () => void;
  onSelectTimeline: (timeline: TimelineEntryDto) => void;
}

export function TimelineList({
  currentUserId,
  error,
  evidence,
  loading,
  role,
  response,
  selectedTimelineId,
  onEditTimeline,
  onNextPage,
  onOpenEvidence,
  onPreviousPage,
  onRetry,
  onSelectTimeline,
}: TimelineListProps) {
  const timeline = response?.timeline ?? [];
  const pagination = response?.pagination ?? null;
  const evidenceById = new Map(evidence.map((item) => [item.id, item]));

  if (loading) {
    return <p role="status">Loading permit timeline...</p>;
  }

  if (error) {
    return (
      <div className="state-box state-box--error" role="alert">
        <h3>Permit timeline unavailable</h3>
        <p>{error}</p>
        <button type="button" onClick={onRetry}>
          Retry
        </button>
      </div>
    );
  }

  if (timeline.length === 0) {
    return (
      <div className="state-box">
        <h3>No timeline entries yet</h3>
        <p>Add permit events when they are supported by case records.</p>
      </div>
    );
  }

  return (
    <>
      <div className="record-list" aria-label="Permit timeline entries">
        {timeline.map((entry) => {
          const selected = selectedTimelineId === entry.id;
          const canEdit =
            role === "admin" ||
            (!entry.is_canonical && entry.contributor?.id === currentUserId);
          const linkedEvidence = entry.evidence_ids
            .map((id) => evidenceById.get(id))
            .filter((item): item is EvidenceItemDto => Boolean(item));

          return (
            <article
              className={`record-card${selected ? " active" : ""}${
                entry.is_canonical ? " record-card--canonical" : ""
              }`}
              key={entry.id}
            >
              <div className="record-card-heading">
                <div>
                  <p className="eyebrow">
                    {formatDateOnly(entry.occurred_on)} ·{" "}
                    {timelineTypeLabels[entry.timeline_type]}
                  </p>
                  <h3>{entry.title}</h3>
                </div>
                <span
                  className={
                    entry.is_canonical
                      ? "record-pill record-pill--canonical"
                      : "record-pill"
                  }
                >
                  {entry.is_canonical ? "Canonical" : "Contributed"}
                </span>
              </div>
              <p>{entry.details}</p>
              <dl className="record-meta">
                <div>
                  <dt>Contributor</dt>
                  <dd>{contributorName(entry.contributor)}</dd>
                </div>
                <div>
                  <dt>Updated</dt>
                  <dd>{formatDateTime(entry.updated_at)}</dd>
                </div>
              </dl>
              <div className="linked-evidence">
                <h4>Supporting evidence</h4>
                {linkedEvidence.length > 0 ? (
                  <div className="inline-actions">
                    {linkedEvidence.map((item) => (
                      <button
                        className="link-chip"
                        key={item.id}
                        type="button"
                        onClick={() => onOpenEvidence(item)}
                      >
                        {item.title}
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className="field-note">No supporting evidence linked.</p>
                )}
              </div>
              <div className="form-actions">
                <button
                  className="secondary-button"
                  type="button"
                  onClick={() => onSelectTimeline(entry)}
                >
                  {selected ? "Selected" : "Select entry"}
                </button>
                {canEdit && (
                  <button
                    className="secondary-button"
                    type="button"
                    onClick={() => onEditTimeline(entry)}
                  >
                    Edit entry
                  </button>
                )}
              </div>
            </article>
          );
        })}
      </div>

      {pagination && (
        <div className="pagination">
          <button
            className="secondary-button"
            disabled={pagination.offset === 0}
            type="button"
            onClick={onPreviousPage}
          >
            Previous
          </button>
          <span>
            Showing {pagination.offset + 1}-
            {pagination.offset + timeline.length}
          </span>
          <button
            className="secondary-button"
            disabled={timeline.length < pagination.limit}
            type="button"
            onClick={onNextPage}
          >
            Next
          </button>
        </div>
      )}
    </>
  );
}
