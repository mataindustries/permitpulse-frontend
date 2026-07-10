import type { ReactNode } from "react";
import { BottomNavigation } from "./BottomNavigation";
import type { OsDestination } from "./navigation";
import { TopBar } from "./TopBar";

interface MobileShellProps {
  activeDestination: OsDestination;
  children: ReactNode;
  displayName: string;
  onCreateCase?: () => void;
  onNavigate: (destination: OsDestination) => void;
  title: string;
}

export function MobileShell({
  activeDestination,
  children,
  displayName,
  onCreateCase,
  onNavigate,
  title,
}: MobileShellProps) {
  return (
    <div className="os-shell">
      <TopBar
        displayName={displayName}
        onCreateCase={onCreateCase}
        title={title}
      />
      <div className="os-shell__content">{children}</div>
      <BottomNavigation active={activeDestination} onNavigate={onNavigate} />
    </div>
  );
}
