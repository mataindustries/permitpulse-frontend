export type MissionState =
  | "Needs Information"
  | "Needs Evidence"
  | "Needs Verification"
  | "Needs Timeline"
  | "Needs Review"
  | "Ready For Packet"
  | "Ready To Deliver";

export type MissionHealthStatus = "at_risk" | "attention" | "strong";

export type MissionTargetTab =
  | "overview"
  | "evidence"
  | "timeline"
  | "findings"
  | "packet";

export type MissionEvidenceKind =
  | "case_field"
  | "case_status"
  | "evidence_record"
  | "timeline_record"
  | "aggregate";

export interface MissionSupportingEvidence {
  id: string;
  kind: MissionEvidenceKind;
  title: string;
  detail: string;
  recordId: string | null;
}

export interface MissionBlocker {
  id: string;
  title: string;
  severity: "critical" | "high" | "medium";
  reason: string;
  recommendedResolution: string;
  supportingEvidence: string[];
}

export interface MissionWarning {
  id: string;
  title: string;
  severity: "high" | "medium" | "low";
  reason: string;
  recommendedResolution: string;
  supportingEvidence: string[];
}

export interface MissionCompletedCheck {
  id: string;
  title: string;
  reason: string;
  supportingEvidence: string[];
}

export interface MissionAction {
  id: string;
  title: string;
  priority: number;
  reason: string;
  targetTab: MissionTargetTab;
  blocking: boolean;
  supportingEvidence: string[];
}

export interface MissionHealthMetric {
  score: number;
  status: MissionHealthStatus;
  completed: number;
  total: number;
  explanation: string;
}

export interface MissionIntelligence {
  missionHealth: MissionHealthMetric;
  missionState: MissionState;
  blockers: MissionBlocker[];
  warnings: MissionWarning[];
  completedChecks: MissionCompletedCheck[];
  recommendedAction: MissionAction;
  secondaryActions: MissionAction[];
  supportingEvidence: MissionSupportingEvidence[];
  explanation: string;
  lastEvaluated: string;
  packetReadiness: MissionHealthMetric;
  timelineHealth: MissionHealthMetric;
  evidenceHealth: MissionHealthMetric;
  reviewHealth: MissionHealthMetric;
}

