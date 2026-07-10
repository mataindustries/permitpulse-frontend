import {
  MetricChip,
  SecondaryAction,
  SectionHeader,
  SurfaceCard,
} from "../../design-system/primitives";

interface FounderViewProps {
  signingOut: boolean;
  user: {
    email: string;
    name?: string;
    role: "admin" | "client";
  };
  onSignOut: () => void;
}

export function FounderView({ signingOut, user, onSignOut }: FounderViewProps) {
  return (
    <section className="founder-view" aria-labelledby="founder-view-title">
      <SectionHeader
        description="Account and workspace access for this authenticated session."
        eyebrow="Founder"
        title="Operator profile"
      />

      <SurfaceCard className="founder-view__profile" elevated>
        <div className="founder-view__avatar" aria-hidden="true">
          {(user.name || user.email).slice(0, 1).toUpperCase()}
        </div>
        <div className="founder-view__identity">
          <h3 id="founder-view-title">{user.name || "PermitPulse operator"}</h3>
          <p>{user.email}</p>
        </div>
        <div className="founder-view__metrics">
          <MetricChip label="Workspace role" value={user.role === "admin" ? "Administrator" : "Client"} />
          <MetricChip icon="check" label="Session" tone="success" value="Protected" />
        </div>
        <SecondaryAction disabled={signingOut} fullWidth onClick={onSignOut}>
          {signingOut ? "Signing out..." : "Sign out"}
        </SecondaryAction>
      </SurfaceCard>
    </section>
  );
}
