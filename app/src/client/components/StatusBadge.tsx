import { caseStatusLabels, type CaseStatus } from "../types/cases";
import {
  StatusBadge as OsStatusBadge,
  type StatusTone,
} from "../design-system/primitives";

interface StatusBadgeProps {
  status: CaseStatus;
}

const statusTones: Record<CaseStatus, StatusTone> = {
  intake: "neutral",
  researching: "info",
  needs_information: "warning",
  ready_for_review: "success",
};

export function StatusBadge({ status }: StatusBadgeProps) {
  return (
    <OsStatusBadge
      className={`status-badge status-${status}`}
      tone={statusTones[status]}
    >
      {caseStatusLabels[status]}
    </OsStatusBadge>
  );
}
