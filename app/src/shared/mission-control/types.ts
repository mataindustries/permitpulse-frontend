import type { MissionIntelligence } from "../mission-intelligence/types";

export type MissionControlCaseStatus =
  | "intake"
  | "researching"
  | "needs_information"
  | "ready_for_review";

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
    linked: number;
    latest_occurred_on: string | null;
  };
  intelligence: MissionIntelligence;
}

export interface MissionControlListResponse {
  missions: MissionControlItem[];
  pagination: {
    limit: number;
    offset: number;
  };
  order: "mission_intelligence_priority_asc";
}
