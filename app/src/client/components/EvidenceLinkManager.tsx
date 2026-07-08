import { useMemo, useState } from "react";
import type { UserRole } from "../types/cases";
import type {
  EvidenceItemDto,
  TimelineEntryDto,
} from "../types/evidence-timeline";

interface EvidenceLinkManagerProps {
  currentUserId: string;
  error: string;
  evidence: EvidenceItemDto[];
  role: UserRole;
  submitting: boolean;
  timelineEntry: TimelineEntryDto | null;
  onLink: (evidenceId: string) => Promise<void>;
  onUnlink: (evidenceId: string) => Promise<void>;
}

export function EvidenceLinkManager({
  currentUserId,
  error,
  evidence,
  role,
  submitting,
  timelineEntry,
  onLink,
  onUnlink,
}: EvidenceLinkManagerProps) {
  const [selectedEvidenceId, setSelectedEvidenceId] = useState("");
  const linkedIds = new Set(timelineEntry?.evidence_ids ?? []);
  const linkedEvidence = evidence.filter((item) => linkedIds.has(item.id));
  const canManageLinks =
    !!timelineEntry &&
    (role === "admin" ||
      (!timelineEntry.is_canonical &&
        timelineEntry.contributor?.id === currentUserId));

  const availableEvidence = useMemo(
    () =>
      evidence.filter(
        (item) =>
          !linkedIds.has(item.id) &&
          (role === "admin" || item.contributor?.id === currentUserId),
      ),
    [currentUserId, evidence, linkedIds, role],
  );

  async function linkSelected() {
    if (!selectedEvidenceId || submitting) {
      return;
    }

    await onLink(selectedEvidenceId);
    setSelectedEvidenceId("");
  }

  async function unlinkSelected(evidenceId: string) {
    if (
      submitting ||
      !window.confirm("Remove this supporting evidence link?")
    ) {
      return;
    }

    await onUnlink(evidenceId);
  }

  if (!timelineEntry) {
    return null;
  }

  return (
    <section className="detail-section compact-section" aria-labelledby="link-manager-title">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Timeline links</p>
          <h3 id="link-manager-title">Supporting evidence</h3>
        </div>
      </div>

      {linkedEvidence.length > 0 ? (
        <ul className="link-list">
          {linkedEvidence.map((item) => (
            <li key={item.id}>
              <span>{item.title}</span>
              {canManageLinks && (
                <button
                  className="danger-button"
                  disabled={submitting}
                  type="button"
                  onClick={() => void unlinkSelected(item.id)}
                >
                  Unlink
                </button>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <p className="field-note">No supporting evidence linked.</p>
      )}

      {canManageLinks && availableEvidence.length > 0 && (
        <div className="inline-form">
          <label>
            Evidence to link
            <select
              value={selectedEvidenceId}
              onChange={(event) => setSelectedEvidenceId(event.target.value)}
            >
              <option value="">Choose evidence</option>
              {availableEvidence.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.title}
                </option>
              ))}
            </select>
          </label>
          <button
            disabled={submitting || !selectedEvidenceId}
            type="button"
            onClick={() => void linkSelected()}
          >
            Link evidence
          </button>
        </div>
      )}

      {canManageLinks && availableEvidence.length === 0 && (
        <p className="field-note">
          No additional eligible evidence is available to link.
        </p>
      )}

      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
    </section>
  );
}
