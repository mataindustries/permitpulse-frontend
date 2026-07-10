import { Icon } from "../design-system/icons";

interface TopBarProps {
  displayName: string;
  onCreateCase?: () => void;
  title: string;
}

export function TopBar({ displayName, onCreateCase, title }: TopBarProps) {
  return (
    <header className="os-topbar">
      <div className="os-topbar__inner">
        <div className="os-topbar__brand" aria-label="PermitPulse Case Workspace">
          <span className="os-brand-mark">
            <Icon name="logo" size={26} />
          </span>
          <span className="os-topbar__context">
            <span className="os-topbar__product">
              PermitPulse <strong>OS</strong>
            </span>
            <span className="os-topbar__title">{title}</span>
          </span>
        </div>

        <span className="pp-visually-hidden">Signed in as {displayName}</span>

        {onCreateCase ? (
          <button
            aria-label="Create a new case"
            className="os-topbar__action"
            onClick={onCreateCase}
            type="button"
          >
            <Icon name="plus" size={20} />
          </button>
        ) : (
          <span aria-hidden="true" className="os-topbar__action-spacer" />
        )}
      </div>
    </header>
  );
}
