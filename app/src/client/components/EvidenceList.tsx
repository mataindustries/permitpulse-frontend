import type { EvidenceItemDto, EvidenceListResponse } from "../types/evidence-timeline";
import {
  evidenceTypeLabels,
  verificationStatusLabels,
} from "../types/evidence-timeline";
import {
  contributorName,
  formatDateOnly,
  formatDateTime,
  safeExternalHref,
} from "./evidenceTimelineUtils";

interface EvidenceListProps {
  error: string;
  highlightedEvidenceId: string | null;
  loading: boolean;
  response: EvidenceListResponse | null;
  selectedEvidenceId: string | null;
  onNextPage: () => void;
  onPreviousPage: () => void;
  onRetry: () => void;
  onSelectEvidence: (evidence: EvidenceItemDto) => void;
}

export function EvidenceList({
  error,
  highlightedEvidenceId,
  loading,
  response,
  selectedEvidenceId,
  onNextPage,
  onPreviousPage,
  onRetry,
  onSelectEvidence,
}: EvidenceListProps) {
  const evidence = response?.evidence ?? [];
  const pagination = response?.pagination ?? null;

  if (loading) {
    return <p role="status">Loading evidence...</p>;
  }

  if (error) {
    return (
      <div className="state-box state-box--error" role="alert">
        <h3>Evidence unavailable</h3>
        <p>{error}</p>
        <button type="button" onClick={onRetry}>
          Retry
        </button>
      </div>
    );
  }

  if (evidence.length === 0) {
    return (
      <div className="state-box state-box--empty">
        <p className="state-box__kicker">Source record register</p>
        <h3>No evidence yet</h3>
        <p>
          Evidence tracks source records, provenance, dates, and verification
          state. Add the first record when a permit notice, document, email, or
          field observation is available.
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="record-list" aria-label="Case evidence">
        {evidence.map((item) => {
          const href = safeExternalHref(item.source_url);
          const selected = selectedEvidenceId === item.id;
          const highlighted = highlightedEvidenceId === item.id;

          return (
            <article
              className={`record-card${selected ? " active" : ""}${
                highlighted ? " highlighted" : ""
              }`}
              key={item.id}
            >
              <div className="record-card-heading">
                <div>
                  <p className="eyebrow">{evidenceTypeLabels[item.evidence_type]}</p>
                  <h3>{item.title}</h3>
                </div>
                <span
                  className={`verification-badge verification-badge--${item.verification_status}`}
                >
                  {verificationStatusLabels[item.verification_status]}
                </span>
              </div>
              <p>{item.summary}</p>
              <dl className="record-meta">
                <div>
                  <dt>Source</dt>
                  <dd>
                    {href ? (
                      <a href={href} rel="noreferrer noopener" target="_blank">
                        {item.source_label || href}
                      </a>
                    ) : (
                      item.source_label || "Not provided"
                    )}
                  </dd>
                </div>
                <div>
                  <dt>Source date</dt>
                  <dd>{formatDateOnly(item.source_date)}</dd>
                </div>
                <div>
                  <dt>Contributor</dt>
                  <dd>{contributorName(item.contributor)}</dd>
                </div>
                <div>
                  <dt>Updated</dt>
                  <dd>{formatDateTime(item.updated_at)}</dd>
                </div>
              </dl>
              {item.verification_status === "unverified" && (
                <p className="field-note">
                  Source review is pending. Complete provenance before relying on this record.
                </p>
              )}
              <button
                className="secondary-button"
                type="button"
                onClick={() => onSelectEvidence(item)}
              >
                {selected ? "Selected" : "Open evidence"}
              </button>
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
            {pagination.offset + evidence.length}
          </span>
          <button
            className="secondary-button"
            disabled={evidence.length < pagination.limit}
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
