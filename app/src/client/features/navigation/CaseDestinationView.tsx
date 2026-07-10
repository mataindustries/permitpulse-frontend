import type { CaseDto } from "../../types/cases";
import { caseStatusLabels } from "../../types/cases";
import {
  EmptyState,
  PrimaryAction,
  SectionHeader,
  SkeletonLoader,
  StatusBadge,
  SurfaceCard,
} from "../../design-system/primitives";

interface CaseDestinationViewProps {
  cases: CaseDto[];
  destination: "ai" | "packets";
  error: string;
  loading: boolean;
  onOpenCase: (caseId: string) => void;
  onRetry: () => void;
}

export function CaseDestinationView({
  cases,
  destination,
  error,
  loading,
  onOpenCase,
  onRetry,
}: CaseDestinationViewProps) {
  const isAi = destination === "ai";
  const title = isAi ? "AI review" : "Packet workspace";
  const actionLabel = isAi ? "Open AI review" : "Open packet preview";

  return (
    <section className="case-destination" aria-labelledby={`${destination}-destination-title`}>
      <SectionHeader
        description={
          isAi
            ? "Choose a case to open its existing protected review assistant."
            : "Choose a case to open its existing packet preview and PDF export."
        }
        eyebrow={isAi ? "Review queue" : "Deliverable queue"}
        title={title}
      />

      {loading && <SkeletonLoader cards={3} label={`Loading ${title.toLowerCase()}`} />}

      {!loading && error && (
        <EmptyState
          action={<PrimaryAction fullWidth onClick={onRetry}>Try again</PrimaryAction>}
          description={error}
          icon="warning"
          title="Cases could not be loaded"
        />
      )}

      {!loading && !error && cases.length === 0 && (
        <EmptyState
          description="Create a case before opening this workspace."
          icon={isAi ? "ai" : "packets"}
          title="No cases available"
        />
      )}

      {!loading && !error && cases.length > 0 && (
        <div className="case-destination__list">
          {cases.map((caseRecord) => (
            <SurfaceCard as="article" className="case-destination__card" key={caseRecord.id}>
              <div>
                <p>{caseRecord.address} · {caseRecord.city}</p>
                <h3>{caseRecord.project_name}</h3>
              </div>
              <StatusBadge>{caseStatusLabels[caseRecord.current_status]}</StatusBadge>
              <PrimaryAction
                aria-label={`${actionLabel} for ${caseRecord.project_name}`}
                icon="arrow-right"
                iconAfter
                onClick={() => onOpenCase(caseRecord.id)}
              >
                {actionLabel}
              </PrimaryAction>
            </SurfaceCard>
          ))}
        </div>
      )}
    </section>
  );
}
