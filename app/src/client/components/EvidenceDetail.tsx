import type { UserRole } from "../types/cases";
import type { EvidenceItemDto } from "../types/evidence-timeline";
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

interface EvidenceDetailProps {
  currentUserId: string;
  evidence: EvidenceItemDto;
  role: UserRole;
  onEdit: () => void;
}

export function EvidenceDetail({
  currentUserId,
  evidence,
  role,
  onEdit,
}: EvidenceDetailProps) {
  const href = safeExternalHref(evidence.source_url);
  const canEdit = role === "admin" || evidence.contributor?.id === currentUserId;

  return (
    <article className="record-detail" aria-labelledby={`evidence-${evidence.id}`}>
      <div className="section-heading">
        <div>
          <p className="eyebrow">Selected evidence</p>
          <h3 id={`evidence-${evidence.id}`}>{evidence.title}</h3>
        </div>
        <span
          className={`verification-badge verification-badge--${evidence.verification_status}`}
        >
          {verificationStatusLabels[evidence.verification_status]}
        </span>
      </div>
      <dl className="detail-grid">
        <div>
          <dt>Type</dt>
          <dd>{evidenceTypeLabels[evidence.evidence_type]}</dd>
        </div>
        <div>
          <dt>Contributor</dt>
          <dd>{contributorName(evidence.contributor)}</dd>
        </div>
        <div>
          <dt>Source date</dt>
          <dd>{formatDateOnly(evidence.source_date)}</dd>
        </div>
        <div>
          <dt>Version</dt>
          <dd>{evidence.version}</dd>
        </div>
        <div>
          <dt>Updated</dt>
          <dd>{formatDateTime(evidence.updated_at)}</dd>
        </div>
        <div>
          <dt>Source</dt>
          <dd>
            {href ? (
              <a href={href} rel="noreferrer noopener" target="_blank">
                {evidence.source_label || href}
              </a>
            ) : (
              evidence.source_label || "Not provided"
            )}
          </dd>
        </div>
      </dl>
      <p>{evidence.summary}</p>
      {evidence.verification_status === "unverified" && (
        <p className="field-note">
          Source review is pending. Complete provenance before relying on this record.
        </p>
      )}
      {canEdit && (
        <button className="secondary-button" type="button" onClick={onEdit}>
          Edit evidence
        </button>
      )}
    </article>
  );
}
