import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from "react";
import type {
  IntegrityDecision,
  IntegrityDemoResetResult,
  IntegrityPacketImpact,
  IntegrityReviewConfig,
  IntegrityReviewItem,
  IntegrityReviewRun,
  IntegrityReviewStage,
  IntegritySeverity,
  IntegrityStageName,
} from "../../../shared/build-week-integrity/types";
import {
  integrityReviewClient,
  type IntegrityReviewClient,
} from "../../api/build-week-integrity";
import { Icon } from "../../design-system/icons";
import {
  MetricChip,
  PrimaryAction,
  SecondaryAction,
  SkeletonLoader,
  StatusBadge,
  SurfaceCard,
  type StatusTone,
} from "../../design-system/primitives";

const stageNames: IntegrityStageName[] = [
  "evidence_auditor",
  "chronology_analyst",
  "skeptical_reviewer",
  "synthesis",
];

const stageDetails: Record<
  IntegrityStageName,
  { label: string; shortLabel: string }
> = {
  chronology_analyst: {
    label: "GPT-5.6 Terra Chronology Analyst",
    shortLabel: "Chronology",
  },
  evidence_auditor: {
    label: "GPT-5.6 Terra Evidence Auditor",
    shortLabel: "Evidence",
  },
  skeptical_reviewer: {
    label: "GPT-5.6 Terra Skeptical Reviewer",
    shortLabel: "Skeptical review",
  },
  synthesis: {
    label: "GPT-5.6 Sol final synthesizer",
    shortLabel: "Synthesis",
  },
};

const categoryLabels: Record<IntegrityReviewItem["category"], string> = {
  evidence_contradiction: "Evidence contradiction",
  missing_record_or_confirmation: "Missing record or confirmation",
  next_best_action: "Next best action",
  timeline_gap_or_stale_status: "Timeline gap or stale status",
  unresolved_dependency: "Unresolved dependency",
  unsupported_finding: "Unsupported finding",
};

const impactLabels: Record<IntegrityPacketImpact, string> = {
  blocks_release: "Proposed: blocks release",
  monitor: "Proposed: monitor",
  needs_resolution: "Proposed: needs resolution",
  none: "Proposed: no readiness impact",
};

const impactTones: Record<IntegrityPacketImpact, StatusTone> = {
  blocks_release: "danger",
  monitor: "info",
  needs_resolution: "warning",
  none: "neutral",
};

const sourceLabels: Record<
  Exclude<IntegrityStageName, "synthesis">,
  string
> = {
  chronology_analyst: "Chronology Analyst",
  evidence_auditor: "Evidence Auditor",
  skeptical_reviewer: "Skeptical Reviewer",
};

interface IntegrityReviewPanelProps {
  caseId: string;
  client?: IntegrityReviewClient;
  onDemoReset?: (result: IntegrityDemoResetResult) => void;
  onOpenEvidence?: (evidenceId: string) => void;
}

interface StartAttempt {
  cancelled: boolean;
}

function friendlyError(error: unknown, fallback: string): string {
  return error instanceof Error && error.message.trim()
    ? error.message
    : fallback;
}

function formatDate(value: string | null): string {
  if (!value) return "Not yet recorded";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Time unavailable";
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function severityTone(severity: IntegritySeverity): StatusTone {
  if (severity === "critical") return "danger";
  if (severity === "high") return "warning";
  if (severity === "medium") return "info";
  return "neutral";
}

function decisionTone(decision: IntegrityDecision): StatusTone {
  if (decision === "accepted" || decision === "edited") return "success";
  if (decision === "rejected") return "neutral";
  return "warning";
}

function decisionLabel(decision: IntegrityDecision): string {
  if (decision === "accepted") return "Accepted · internal only";
  if (decision === "edited") return "Edited · internal only";
  if (decision === "rejected") return "Rejected";
  return "Pending human review";
}

function stageStatus(
  stage: IntegrityReviewStage | undefined,
): { label: string; tone: StatusTone } {
  if (!stage) return { label: "Not started", tone: "neutral" };
  if (stage.status === "completed") {
    return { label: "Completed", tone: "success" };
  }
  if (stage.status === "failed") return { label: "Failed", tone: "danger" };
  if (stage.status === "running") {
    return { label: "Running", tone: "info" };
  }
  return { label: "Queued", tone: "neutral" };
}

function StageProgress({
  config,
  run,
}: {
  config: IntegrityReviewConfig;
  run: IntegrityReviewRun | null;
}) {
  return (
    <section aria-labelledby="integrity-progress-title" className="integrity-progress">
      <div className="integrity-subheading">
        <div>
          <p className="integrity-subheading__eyebrow">Server-side pipeline</p>
          <h3 id="integrity-progress-title">Analyst progress</h3>
        </div>
        {run?.status === "running" && (
          <span aria-live="polite" className="integrity-live-state">
            <span aria-hidden="true" /> Reading persisted stage state
          </span>
        )}
      </div>

      <div className="integrity-stage-grid" role="list">
        {stageNames.map((name) => {
          const stage = run?.stages.find((candidate) => candidate.stage === name);
          const state = stageStatus(stage);
          const configuredModel =
            name === "synthesis"
              ? run?.synthesizer_model ?? config.synthesizer_model
              : run?.specialist_model ?? config.specialist_model;
          return (
            <article
              className={`integrity-stage integrity-stage--${stage?.status ?? "idle"}`}
              key={name}
              role="listitem"
            >
              <span className="integrity-stage__sequence" aria-hidden="true">
                {name === "synthesis" ? <Icon name="ai" size={18} /> : stageNames.indexOf(name) + 1}
              </span>
              <div>
                <span className="integrity-stage__short-label">
                  {stageDetails[name].shortLabel}
                </span>
                <strong>{stageDetails[name].label}</strong>
                <code>{stage?.model_id ?? configuredModel}</code>
              </div>
              <StatusBadge tone={state.tone}>{state.label}</StatusBadge>
            </article>
          );
        })}
      </div>
    </section>
  );
}

function ReviewSummary({ run }: { run: IntegrityReviewRun }) {
  const urgent = run.counts.critical + run.counts.high;
  const decided = run.counts.total - run.counts.pending;
  return (
    <section aria-labelledby="integrity-summary-title" className="integrity-summary">
      <div className="integrity-subheading">
        <div>
          <p className="integrity-subheading__eyebrow">Validated draft</p>
          <h3 id="integrity-summary-title">Review summary</h3>
        </div>
        <StatusBadge tone={run.status === "completed" ? "success" : "danger"}>
          {run.status === "completed" ? "Synthesis complete" : "Run failed"}
        </StatusBadge>
      </div>

      {run.summary && <p className="integrity-summary__copy">{run.summary}</p>}

      <div className="integrity-summary__metrics">
        <MetricChip icon="ai" label="Draft observations" tone="jade" value={run.counts.total} />
        <MetricChip
          icon="warning"
          label="Critical + high"
          tone={urgent > 0 ? "warning" : "success"}
          value={urgent}
        />
        <MetricChip
          icon="timeline"
          label="Awaiting decision"
          tone={run.counts.pending > 0 ? "warning" : "success"}
          value={run.counts.pending}
        />
        <MetricChip icon="check" label="Human decisions" tone="neutral" value={decided} />
      </div>

      <p className="integrity-summary__breakdown">
        Severity: {run.counts.critical} critical · {run.counts.high} high · {run.counts.medium} medium · {run.counts.low} low. Audit: {run.counts.accepted} accepted · {run.counts.edited} edited · {run.counts.rejected} rejected.
      </p>
    </section>
  );
}

function IntegrityItemCard({
  busy,
  editing,
  editText,
  item,
  onCancelEdit,
  onChangeEditText,
  onDecision,
  onEdit,
  onOpenEvidence,
}: {
  busy: boolean;
  editing: boolean;
  editText: string;
  item: IntegrityReviewItem;
  onCancelEdit: () => void;
  onChangeEditText: (value: string) => void;
  onDecision: (
    item: IntegrityReviewItem,
    decision: "accepted" | "edited" | "rejected",
    reviewerEditedText?: string,
  ) => void;
  onEdit: () => void;
  onOpenEvidence?: (evidenceId: string) => void;
}) {
  function submitEdit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onDecision(item, "edited", editText.trim());
  }

  return (
    <SurfaceCard
      as="article"
      className={`integrity-item integrity-item--${item.severity}${
        item.category === "next_best_action" ? " integrity-item--next-action" : ""
      }`}
      elevated
    >
      <header className="integrity-item__header">
        <div>
          <div className="integrity-item__badges">
            <StatusBadge tone={severityTone(item.severity)}>{item.severity}</StatusBadge>
            <span className="integrity-category">{categoryLabels[item.category]}</span>
          </div>
          <h3>{item.title}</h3>
        </div>
        <div className="integrity-confidence" aria-label={`${item.confidence}% confidence`}>
          <strong>{item.confidence}%</strong>
          <span>confidence</span>
        </div>
      </header>

      <div className="integrity-observation-grid">
        <div className="integrity-observation integrity-observation--fact">
          <span>Verified fact</span>
          <p>{item.verified_fact}</p>
        </div>
        <div className="integrity-observation">
          <span>Inference</span>
          <p>{item.inference ?? "No additional inference stated."}</p>
        </div>
        <div className="integrity-observation integrity-observation--unknown">
          <span>Unknown</span>
          <p>{item.unknown ?? "No additional unknown stated."}</p>
        </div>
      </div>

      <div className="integrity-item__section">
        <span className="integrity-item__label">Why it matters</span>
        <p>{item.rationale}</p>
      </div>

      <div className="integrity-item__section">
        <span className="integrity-item__label">Cited evidence records</span>
        <div className="integrity-evidence-list" role="list">
          {item.evidence.map((evidence) => {
            const content = (
              <>
                <span>{evidence.title}</span>
                <code>{evidence.id}</code>
                <small>{evidence.verification_status}</small>
              </>
            );
            return (
              <span className="integrity-evidence-list__item" key={evidence.id} role="listitem">
                {onOpenEvidence ? (
                  <button
                    aria-label={`Open evidence ${evidence.title}, record ${evidence.id}`}
                    className="integrity-evidence-chip"
                    onClick={() => onOpenEvidence(evidence.id)}
                    type="button"
                  >
                    {content}
                  </button>
                ) : (
                  <span className="integrity-evidence-chip">{content}</span>
                )}
              </span>
            );
          })}
        </div>
      </div>

      <div className="integrity-action-proposal">
        <div>
          <span className="integrity-item__label">Proposed corrective action</span>
          <p>{item.proposed_corrective_action}</p>
          {item.reviewer_edited_text && (
            <div className="integrity-reviewer-revision">
              <span>Reviewer revision</span>
              <p>{item.reviewer_edited_text}</p>
            </div>
          )}
        </div>
        <StatusBadge tone={impactTones[item.packet_readiness_impact]}>
          {impactLabels[item.packet_readiness_impact]}
        </StatusBadge>
      </div>

      <div className="integrity-item__provenance">
        <span>
          Source analysts: {item.source_analysts.map((source) => sourceLabels[source]).join(", ")}
        </span>
      </div>

      <footer className="integrity-audit">
        <div className="integrity-audit__state">
          <StatusBadge tone={decisionTone(item.decision_status)}>
            {decisionLabel(item.decision_status)}
          </StatusBadge>
          <span>
            {item.decided_at
              ? `Decision recorded ${formatDate(item.decided_at)}`
              : "No human decision recorded"}
          </span>
          <span>
            {item.packet_generation_id
              ? `Separately linked to packet revision ${item.packet_generation_id}`
              : "No packet revision affected"}
          </span>
        </div>

        {editing ? (
          <form className="integrity-edit-form" onSubmit={submitEdit}>
            <label htmlFor={`integrity-edit-${item.id}`}>
              Reviewer revision
              <textarea
                id={`integrity-edit-${item.id}`}
                maxLength={3000}
                onChange={(event) => onChangeEditText(event.target.value)}
                required
                rows={4}
                value={editText}
              />
            </label>
            <p>
              Saving records an edited internal draft. It does not update the client packet.
            </p>
            <div className="integrity-edit-form__actions">
              <button disabled={busy || !editText.trim()} type="submit">
                Save edit
              </button>
              <button disabled={busy} onClick={onCancelEdit} type="button">
                Cancel
              </button>
            </div>
          </form>
        ) : (
          <div className="integrity-decision-controls" aria-label={`Review decision for ${item.title}`}>
            <button
              className="integrity-decision-controls__accept"
              disabled={busy}
              onClick={() => onDecision(item, "accepted")}
              type="button"
            >
              Accept
            </button>
            <button disabled={busy} onClick={onEdit} type="button">
              Edit
            </button>
            <button
              className="integrity-decision-controls__reject"
              disabled={busy}
              onClick={() => onDecision(item, "rejected")}
              type="button"
            >
              Reject
            </button>
          </div>
        )}
      </footer>
    </SurfaceCard>
  );
}

export function IntegrityReviewPanel({
  caseId,
  client = integrityReviewClient,
  onDemoReset,
  onOpenEvidence,
}: IntegrityReviewPanelProps) {
  const [config, setConfig] = useState<IntegrityReviewConfig | null>(null);
  const [run, setRun] = useState<IntegrityReviewRun | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [starting, setStarting] = useState(false);
  const [decidingItemId, setDecidingItemId] = useState<string | null>(null);
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");
  const [confirmingReset, setConfirmingReset] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [reloadSequence, setReloadSequence] = useState(0);
  const startAttempt = useRef<StartAttempt | null>(null);

  useEffect(() => {
    if (startAttempt.current) startAttempt.current.cancelled = true;
    let active = true;
    setLoading(true);
    setError("");
    setNotice("");
    setRun(null);
    setEditingItemId(null);

    void (async () => {
      try {
        const nextConfig = await client.getConfig();
        if (!active) return;
        setConfig(nextConfig);
        if (nextConfig.enabled) {
          const latest = await client.getLatest(caseId);
          if (active) setRun(latest);
        }
      } catch (loadError) {
        if (active) {
          setError(
            friendlyError(
              loadError,
              "Integrity Review could not be loaded. Try again.",
            ),
          );
        }
      } finally {
        if (active) setLoading(false);
      }
    })();

    return () => {
      active = false;
      if (startAttempt.current) startAttempt.current.cancelled = true;
    };
  }, [caseId, client, reloadSequence]);

  useEffect(() => {
    if (!run || run.status !== "running" || starting) return;
    let active = true;
    const runId = run.id;

    void (async () => {
      while (active) {
        await new Promise((resolve) => setTimeout(resolve, 900));
        if (!active) return;
        try {
          const current = await client.getRun(caseId, runId);
          if (!active) return;
          setRun(current);
          if (current.status !== "running") return;
        } catch (pollError) {
          if (active) {
            setError(
              friendlyError(
                pollError,
                "Integrity Review progress could not be refreshed.",
              ),
            );
          }
          return;
        }
      }
    })();

    return () => {
      active = false;
    };
  }, [caseId, client, run, starting]);

  async function handleStart() {
    if (!config?.enabled || starting || run?.status === "running") return;
    if (startAttempt.current) startAttempt.current.cancelled = true;
    const attempt: StartAttempt = { cancelled: false };
    startAttempt.current = attempt;
    const baselineRunId = run?.id ?? null;
    let requestSettled = false;
    setStarting(true);
    setError("");
    setNotice("");
    setEditingItemId(null);

    void (async () => {
      while (!requestSettled && !attempt.cancelled) {
        await new Promise((resolve) => setTimeout(resolve, 700));
        if (requestSettled || attempt.cancelled) return;
        try {
          const latest = await client.getLatest(caseId);
          if (
            !attempt.cancelled &&
            latest &&
            (latest.id !== baselineRunId || latest.status === "running")
          ) {
            setRun(latest);
          }
        } catch {
          // The initiating request remains authoritative. A transient polling
          // failure must not make a real backend run look failed.
        }
      }
    })();

    try {
      const result = await client.startReview(caseId);
      if (attempt.cancelled) return;
      setRun(result.run);
      setNotice(
        result.outcome === "cached"
          ? "Cached completed review loaded for this exact case input. No new model call was made."
          : result.outcome === "failed"
            ? "The run stopped before a validated synthesis was produced."
            : "Integrity Review completed. Every item is awaiting a human audit decision.",
      );
    } catch (startError) {
      if (!attempt.cancelled) {
        setError(
          friendlyError(
            startError,
            "Integrity Review could not be started. No draft was added to the packet.",
          ),
        );
        try {
          const latest = await client.getLatest(caseId);
          if (!attempt.cancelled && latest?.status === "running") setRun(latest);
        } catch {
          // Keep the safe initiating-request error.
        }
      }
    } finally {
      requestSettled = true;
      if (!attempt.cancelled) setStarting(false);
    }
  }

  async function handleDecision(
    item: IntegrityReviewItem,
    decision: "accepted" | "edited" | "rejected",
    reviewerEditedText?: string,
  ) {
    if (!run || decidingItemId) return;
    setDecidingItemId(item.id);
    setError("");
    setNotice("");
    try {
      const updated = await client.decideItem(caseId, run.id, item.id, {
        decision,
        expected_version: item.version,
        ...(decision === "edited"
          ? { reviewer_edited_text: reviewerEditedText }
          : {}),
      });
      setRun(updated);
      setEditingItemId(null);
      setEditText("");
      setNotice(
        "Human audit decision recorded. The item remains outside the client packet.",
      );
    } catch (decisionError) {
      setError(
        friendlyError(
          decisionError,
          "The audit decision could not be recorded. Reload and try again.",
        ),
      );
    } finally {
      setDecidingItemId(null);
    }
  }

  async function handleReset() {
    if (resetting || run?.status === "running") return;
    setResetting(true);
    setError("");
    setNotice("");
    try {
      const result = await client.resetDemo();
      setRun(null);
      setEditingItemId(null);
      setConfirmingReset(false);
      setNotice(
        `Arroyo Vista restored to the deterministic demo baseline. ${result.archived_run_count} prior review run${result.archived_run_count === 1 ? " was" : "s were"} archived.`,
      );
      onDemoReset?.(result);
    } catch (resetError) {
      setError(
        friendlyError(
          resetError,
          "The fictional Arroyo Vista demo could not be reset.",
        ),
      );
    } finally {
      setResetting(false);
    }
  }

  const running = starting || run?.status === "running";

  return (
    <section aria-labelledby="integrity-review-title" className="integrity-review">
      <header className="integrity-review__header">
        <div>
          <p className="integrity-review__kicker">OpenAI Build Week 2026 extension</p>
          <h2 id="integrity-review-title">Integrity Review</h2>
          <p>
            Adversarially examine the canonical case, evidence, chronology, findings, and unresolved dependencies before packet release.
          </p>
        </div>
        <PrimaryAction
          disabled={loading || !config?.enabled || running}
          icon="ai"
          onClick={() => void handleStart()}
        >
          {running ? "Integrity Review running…" : "Run Integrity Review"}
        </PrimaryAction>
      </header>

      <SurfaceCard className="integrity-human-gate">
        <span className="integrity-human-gate__icon">
          <Icon name="warning" size={20} />
        </span>
        <div>
          <strong>Human approval is required</strong>
          <p>
            Every result is an AI-assisted draft. Accepting or editing records an internal audit decision only. No AI output enters the client packet automatically, and no result implies permit approval or legal certainty.
          </p>
        </div>
      </SurfaceCard>

      {error && (
        <div className="integrity-message integrity-message--error" role="alert">
          <Icon name="warning" size={18} />
          <span>{error}</span>
          <button onClick={() => setReloadSequence((value) => value + 1)} type="button">
            Refresh
          </button>
        </div>
      )}
      {notice && (
        <div aria-live="polite" className="integrity-message integrity-message--notice" role="status">
          <Icon name="check" size={18} />
          <span>{notice}</span>
        </div>
      )}

      {loading ? (
        <SkeletonLoader cards={2} label="Loading Integrity Review" />
      ) : !config ? null : !config.enabled ? (
        <SurfaceCard className="integrity-unavailable">
          <Icon name="ai" size={22} />
          <div>
            <h3>Build Week extension is not enabled</h3>
            <p>
              Enable the server-side Integrity Review feature flag to use this isolated workflow.
            </p>
          </div>
        </SurfaceCard>
      ) : (
        <>
          {!config.live_available && (
            <div className="integrity-message integrity-message--warning">
              <Icon name="warning" size={18} />
              <span>
                Live model access is not configured. Running the review can only reuse an identical validated cache; otherwise the server will decline the request without making an AI call.
              </span>
            </div>
          )}

          {run?.cache_hit && (
            <SurfaceCard className="integrity-cache-state">
              <Icon name="refresh" size={19} />
              <div>
                <strong>Validated cached review</strong>
                <p>
                  The case input hash, models, prompt, and schema match a completed run. No new model call was made.
                </p>
              </div>
            </SurfaceCard>
          )}

          <StageProgress config={config} run={run} />

          {!run ? (
            <SurfaceCard className="integrity-empty">
              <span className="integrity-empty__icon">
                <Icon name="ai" size={24} />
              </span>
              <div>
                <h3>No Integrity Review yet</h3>
                <p>
                  Start a review to run the three Terra analysts in parallel and send their validated drafts to the Sol synthesizer.
                </p>
              </div>
            </SurfaceCard>
          ) : (
            <>
              <div className="integrity-run-meta">
                <span>Run {run.id}</span>
                <span>Input {run.input_hash.slice(0, 12)}</span>
                <span>Case version {run.case_version}</span>
                <span>{formatDate(run.completed_at ?? run.created_at)}</span>
              </div>

              {run.status === "failed" && (
                <div className="integrity-run-failed" role="alert">
                  <Icon name="warning" size={20} />
                  <div>
                    <strong>No validated synthesis was released</strong>
                    <p>
                      The server stopped this run safely. Existing packet content and prior review decisions were not changed.
                    </p>
                    {run.failure_code && <code>Reference: {run.failure_code}</code>}
                  </div>
                </div>
              )}

              {run.status === "completed" && <ReviewSummary run={run} />}

              {run.items.length > 0 && (
                <section aria-labelledby="integrity-results-title" className="integrity-results">
                  <div className="integrity-subheading">
                    <div>
                      <p className="integrity-subheading__eyebrow">Human decision queue</p>
                      <h3 id="integrity-results-title">Draft review items</h3>
                    </div>
                    <span>{run.items.length} validated item{run.items.length === 1 ? "" : "s"}</span>
                  </div>
                  <div className="integrity-result-list">
                    {run.items.map((item) => (
                      <IntegrityItemCard
                        busy={decidingItemId === item.id}
                        editing={editingItemId === item.id}
                        editText={editingItemId === item.id ? editText : ""}
                        item={item}
                        key={item.id}
                        onCancelEdit={() => {
                          setEditingItemId(null);
                          setEditText("");
                        }}
                        onChangeEditText={setEditText}
                        onDecision={(target, decision, reviewerText) =>
                          void handleDecision(target, decision, reviewerText)
                        }
                        onEdit={() => {
                          setEditingItemId(item.id);
                          setEditText(
                            item.reviewer_edited_text ?? item.proposed_corrective_action,
                          );
                        }}
                        onOpenEvidence={onOpenEvidence}
                      />
                    ))}
                  </div>
                </section>
              )}
            </>
          )}

          {config.demo_mode && (
            <SurfaceCard className="integrity-demo-reset">
              <div>
                <p className="integrity-subheading__eyebrow">Fictional data only</p>
                <h3>Restore Arroyo Vista demo</h3>
                <p>
                  Reconcile the fictional case to its deterministic routing contradiction and unsupported draft statement. Prior review runs remain archived for audit.
                </p>
              </div>
              {confirmingReset ? (
                <div className="integrity-demo-reset__confirm">
                  <strong>Reset the fictional demo case?</strong>
                  <div>
                    <button
                      disabled={resetting || run?.status === "running"}
                      onClick={() => void handleReset()}
                      type="button"
                    >
                      {resetting ? "Resetting…" : "Confirm reset"}
                    </button>
                    <button
                      disabled={resetting}
                      onClick={() => setConfirmingReset(false)}
                      type="button"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <SecondaryAction
                  disabled={run?.status === "running"}
                  icon="refresh"
                  onClick={() => setConfirmingReset(true)}
                >
                  Reset Demo
                </SecondaryAction>
              )}
            </SurfaceCard>
          )}
        </>
      )}
    </section>
  );
}

export type { IntegrityReviewPanelProps };
