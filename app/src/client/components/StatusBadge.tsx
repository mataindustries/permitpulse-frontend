import { caseStatusLabels, type CaseStatus } from "../types/cases";

interface StatusBadgeProps {
  status: CaseStatus;
}

export function StatusBadge({ status }: StatusBadgeProps) {
  return <span className={`status-badge status-${status}`}>{caseStatusLabels[status]}</span>;
}
