interface WorkspaceHeaderProps {
  displayName: string;
  onNewCase: () => void;
  onSignOut: () => void;
  signOutDisabled: boolean;
  signingOut: boolean;
}

export function WorkspaceHeader({
  displayName,
  onNewCase,
  onSignOut,
  signOutDisabled,
  signingOut,
}: WorkspaceHeaderProps) {
  return (
    <header className="workspace-header">
      <div className="workspace-header__identity">
        <p className="eyebrow">PermitPulse</p>
        <h1>Case Workspace</h1>
        <p>
          A focused permit operations console for authenticated case intake,
          review, and verification.
        </p>
      </div>
      <div className="workspace-header__actions" aria-label="Workspace account">
        <p>
          Signed in as <strong>{displayName}</strong>
        </p>
        <div className="workspace-header__buttons">
          <button type="button" onClick={onNewCase}>
            New case
          </button>
          <button
            className="secondary-button"
            disabled={signOutDisabled}
            onClick={onSignOut}
            type="button"
          >
            {signingOut ? "Signing out..." : "Sign out"}
          </button>
        </div>
      </div>
    </header>
  );
}
