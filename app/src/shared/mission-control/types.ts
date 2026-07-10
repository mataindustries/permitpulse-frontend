export type MissionControlCaseStatus =
  | "intake"
  | "researching"
  | "needs_information"
  | "ready_for_review";

export type MissionControlSection =
  | "overview"
  | "evidence"
  | "timeline"
  | "ai-review"
  | "packet";

export interface MissionControlItem {
  id: string;
  project_name: string;
  address: string;
  city: string;
  jurisdiction: string;
  permit_number: string | null;
  current_status: MissionControlCaseStatus;
  updated_at: string;
  evidence: {
    total: number;
    ready: number;
    verified: number;
    completeness: number;
  };
  timeline: {
    total: number;
    latest_occurred_on: string | null;
  };
  warnings: {
    count: number;
    labels: string[];
  };
  next_action: {
    label: string;
    section: MissionControlSection;
  };
  /** Present only when a persisted, supported confidence source is available. */
  ai_confidence?: number;
}

export interface MissionControlListResponse {
  missions: MissionControlItem[];
  pagination: {
    limit: number;
    offset: number;
  };
  order: "attention_status_updated_at_asc";
}
