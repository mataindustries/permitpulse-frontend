import type { IconName } from "../design-system/icons";

export type OsDestination = "mission" | "inbox" | "cases" | "ai" | "packets" | "founder";

export interface OsNavigationItem {
  icon: IconName;
  id: OsDestination;
  label: string;
}

export const osNavigationItems: readonly OsNavigationItem[] = [
  { id: "mission", label: "Mission", icon: "mission" },
  { id: "inbox", label: "Inbox", icon: "evidence" },
  { id: "cases", label: "Cases", icon: "cases" },
  { id: "ai", label: "AI", icon: "ai" },
  { id: "packets", label: "Packets", icon: "packets" },
  { id: "founder", label: "Founder", icon: "founder" },
];
