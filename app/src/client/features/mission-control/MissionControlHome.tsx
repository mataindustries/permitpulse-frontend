import {
  EmptyState,
  MetricChip,
  PrimaryAction,
  SecondaryAction,
  SectionHeader,
  SkeletonLoader,
  StatusBadge,
  SurfaceCard,
  type StatusTone,
} from "../../design-system/primitives";
import { Icon } from "../../design-system/icons";
import { caseStatusLabels, type CaseStatus } from "../../types/cases";
import type { MissionControlItem } from "../../types/mission-control";

interface MissionControlHomeProps {
  displayName: string;
  error: string;
  loading: boolean;
  missions: MissionControlItem[];
  onCreateCase: () => void;
  onOpenMission: (mission: MissionControlItem) => void;
  onRetry: () => void;
  onViewCases: () => void;
}

const statusTones: Record<CaseStatus, StatusTone> = {
  intake: "neutral", researching: "info", needs_information: "warning", ready_for_review: "success",
};

function firstName(displayName: string): string {
  const candidate = displayName.includes("@")
    ? displayName.slice(0, displayName.indexOf("@"))
    : displayName.trim().split(/\s+/, 1)[0];

  return candidate || "there";
}

function formatUpdated(value: string): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Update time unavailable";
  }

  const days = Math.max(
    0,
    Math.floor((Date.now() - date.getTime()) / (24 * 60 * 60 * 1000)),
  );

  if (days === 0) {
    return "Updated today";
  }

  if (days === 1) {
    return "Updated yesterday";
  }

  if (days < 30) {
    return `Updated ${days} days ago`;
  }

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
  }).format(date);
}

function MissionCard({
  mission,
  onOpen,
}: {
  mission: MissionControlItem;
  onOpen: () => void;
}) {
  const findingCount =
    mission.intelligence.counts.blockers + mission.intelligence.counts.warnings;
  const warningSummary =
    mission.intelligence.blockers[0]?.title ?? mission.intelligence.warnings[0]?.title;
  const additionalWarnings = Math.max(0, findingCount - 1);

  return (
    <SurfaceCard
      aria-labelledby={`mission-${mission.id}`}
      as="article"
      className={
        mission.current_status === "needs_information"
          ? "mission-card mission-card--attention"
          : "mission-card"
      }
      elevated
    >
      <div className="mission-card__header">
        <div>
          <p className="mission-card__location">
            {mission.address} · {mission.city}
          </p>
          <h3 id={`mission-${mission.id}`}>{mission.project_name}</h3>
        </div>
        <StatusBadge tone={mission.intelligence.counts.blockers > 0 ? "warning" : statusTones[mission.current_status]}>
          {mission.intelligence.missionState}
        </StatusBadge>
      </div>

      <div className="mission-card__provenance">
        <span>{mission.jurisdiction}</span>
        <span>{mission.permit_number ?? "Permit number pending"}</span>
        <span>Case workflow: {caseStatusLabels[mission.current_status]}</span>
        <span>{formatUpdated(mission.updated_at)}</span>
      </div>

      <div className="mission-card__progress-block">
        <div className="mission-card__progress-label">
          <span>Packet readiness</span>
          <strong>{mission.intelligence.packetReadiness.completed}/{mission.intelligence.packetReadiness.total} checks</strong>
        </div>
        <div
          aria-label={`${mission.intelligence.packetReadiness.score}% packet readiness`}
          aria-valuemax={100}
          aria-valuemin={0}
          aria-valuenow={mission.intelligence.packetReadiness.score}
          className="mission-card__progress"
          role="progressbar"
        >
          <span style={{ width: `${mission.intelligence.packetReadiness.score}%` }} />
        </div>
      </div>

      <div className="mission-card__metrics">
        <MetricChip
          icon="evidence"
          label="Evidence ready"
          tone="jade"
          value={`${mission.intelligence.counts.evidence.deliveryReady}/${mission.intelligence.counts.evidence.total}`}
        />
        <MetricChip
          icon="warning"
          label="Open conditions"
          tone={findingCount > 0 ? "warning" : "success"}
          value={findingCount}
        />
        <MetricChip
          icon="timeline"
          label="Investigation health"
          tone="neutral"
          value={`${mission.intelligence.missionHealth.completed}/${mission.intelligence.missionHealth.total}`}
        />
      </div>

      {warningSummary && (
        <div className="mission-card__warning">
          <Icon name="warning" size={16} />
          <span>
            {warningSummary}
            {additionalWarnings > 0 ? ` +${additionalWarnings} more` : ""}
          </span>
        </div>
      )}

      <div className="mission-card__next-action">
        <div>
          <span>Next action</span>
          <strong>{mission.intelligence.recommendedAction.title}</strong>
        </div>
        <PrimaryAction
          aria-label={`${mission.intelligence.recommendedAction.title} for ${mission.project_name}`}
          icon="arrow-right"
          iconAfter
          onClick={onOpen}
        >
          Open
        </PrimaryAction>
      </div>
    </SurfaceCard>
  );
}

export function MissionControlHome({
  displayName,
  error,
  loading,
  missions,
  onCreateCase,
  onOpenMission,
  onRetry,
  onViewCases,
}: MissionControlHomeProps) {
  const attentionCount = missions.filter(
    (mission) =>
      mission.intelligence.counts.blockers + mission.intelligence.counts.warnings > 0,
  ).length;

  return (
    <section aria-labelledby="mission-control-title" className="mission-control">
      <header className="mission-control__hero">
        <p className="mission-control__kicker">Mission control</p>
        <h1 id="mission-control-title">Good to see you, {firstName(displayName)}.</h1>
        <p>
          {loading
            ? "Reading your protected workspace."
            : missions.length === 0
              ? "Your visible case queue is clear."
              : attentionCount === 0
                ? `${missions.length} visible case${missions.length === 1 ? "" : "s"}; no packet-readiness conditions are open.`
                : `${attentionCount} of ${missions.length} visible case${missions.length === 1 ? "" : "s"} need attention.`}
        </p>
      </header>

      <SectionHeader
        action={
          <SecondaryAction disabled={loading} icon="refresh" onClick={onRetry}>
            Refresh
          </SecondaryAction>
        }
        description="Packet readiness measures deliverability. Case workflow and jurisdiction outcomes remain separate."
        eyebrow="Attention queue"
        title="What deserves attention now"
      />

      {loading && <SkeletonLoader cards={3} label="Loading missions" />}

      {!loading && error && (
        <EmptyState
          action={
            <PrimaryAction fullWidth icon="refresh" onClick={onRetry}>
              Try again
            </PrimaryAction>
          }
          description={error}
          icon="warning"
          title="Mission control is unavailable"
        />
      )}

      {!loading && !error && missions.length === 0 && (
        <EmptyState
          action={
            <PrimaryAction fullWidth icon="plus" onClick={onCreateCase}>
              Create first case
            </PrimaryAction>
          }
          description="Create a case to begin tracking permit evidence, timeline events, reviews, and packet readiness."
          icon="cases"
          title="No visible cases yet"
        />
      )}

      {!loading && !error && missions.length > 0 && (
        <div className="mission-control__grid">
          {missions.map((mission) => (
            <MissionCard
              key={mission.id}
              mission={mission}
              onOpen={() => onOpenMission(mission)}
            />
          ))}
        </div>
      )}

      {!loading && !error && missions.length > 0 && (
        <SecondaryAction fullWidth icon="arrow-right" iconAfter onClick={onViewCases}>
          View all cases
        </SecondaryAction>
      )}
    </section>
  );
}
