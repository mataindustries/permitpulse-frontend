import { useEffect, useState } from "react";
import { getDeliveryLifecycle, transitionDeliveryLifecycle } from "../api/delivery-lifecycle";
import type { UserRole } from "../types/cases";
import type { DeliveryEventType, DeliveryLifecycle, DeliveryState } from "../types/delivery-lifecycle";
import { formatDateTime } from "./evidenceTimelineUtils";

const stateLabels: Record<DeliveryState, string> = {
  draft: "Draft",
  packet_generated: "Packet generated",
  under_review: "Under review",
  changes_required: "Changes required",
  approved_for_delivery: "Approved for delivery",
  delivered: "Delivered",
  delivery_confirmed: "Delivery confirmed",
};
const eventLabels: Record<DeliveryEventType, string> = {
  packet_generated: "Generate packet",
  review_started: "Mark ready for review",
  changes_requested: "Request changes",
  approved_for_delivery: "Approve for delivery",
  delivery_recorded: "Record delivery",
  delivery_confirmed: "Confirm delivery",
};
const consequential = new Set<DeliveryEventType>([
  "approved_for_delivery",
  "delivery_recorded",
  "delivery_confirmed",
]);

export function packetNeedsRegeneration(lifecycle: DeliveryLifecycle): boolean {
  return Boolean(
    lifecycle.quality?.stale_snapshot ||
    lifecycle.live_preview_differs ||
    lifecycle.quality?.blockers.some(
      (issue) => issue.id === "presentation-version-current",
    ),
  );
}

function preferredEvent(lifecycle: DeliveryLifecycle): DeliveryEventType | "" {
  return lifecycle.next_events.find((event) => event !== "packet_generated")
    ?? lifecycle.next_events[0]
    ?? "";
}

export function DeliveryLifecyclePanel({ caseId, caseVersion, role, onChanged }: {
  caseId: string;
  caseVersion: number;
  role: UserRole;
  onChanged: () => Promise<void>;
}) {
  const [lifecycle, setLifecycle] = useState<DeliveryLifecycle | null>(null);
  const [selected, setSelected] = useState<DeliveryEventType | "">("");
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let active = true;
    setError("");
    void getDeliveryLifecycle(caseId).then((value) => {
      if (active) {
        setLifecycle(value);
        setSelected(preferredEvent(value));
      }
    }).catch(() => {
      if (active) setError("Delivery lifecycle could not be loaded.");
    });
    return () => { active = false; };
  }, [caseId]);

  async function submit(eventOverride?: DeliveryEventType) {
    const eventType = eventOverride ?? selected;
    if (!eventType || submitting) return;
    if (
      consequential.has(eventType) &&
      !globalThis.confirm(`${eventLabels[eventType]}? This creates an immutable audit event.`)
    ) return;

    setSubmitting(true);
    setError("");
    try {
      const value = await transitionDeliveryLifecycle(
        caseId,
        eventType,
        note.trim() || null,
      );
      setLifecycle(value);
      setSelected(preferredEvent(value));
      setNote("");
      globalThis.window?.dispatchEvent(new Event("permitpulse:packet-changed"));
      await onChanged();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The lifecycle could not be updated.");
    } finally {
      setSubmitting(false);
    }
  }

  const latest = lifecycle?.latest_event;
  const quality = lifecycle?.quality;
  const packetIsStale = Boolean(
    (lifecycle && packetNeedsRegeneration(lifecycle)) ||
    (latest?.case_version && latest.case_version !== caseVersion),
  );
  const selectedBlocked = Boolean(
    (selected === "approved_for_delivery" && !quality?.eligible_for_approval) ||
    (selected === "delivery_recorded" && !quality?.eligible_for_delivery),
  );
  const canRegenerate = Boolean(
    packetIsStale && lifecycle?.next_events.includes("packet_generated"),
  );

  return (
    <section className="delivery-lifecycle-panel" aria-labelledby="delivery-lifecycle-title">
      <div className="delivery-lifecycle-panel__heading">
        <div>
          <p className="eyebrow">Delivery lifecycle</p>
          <h3 id="delivery-lifecycle-title">
            {lifecycle ? stateLabels[lifecycle.current_state] : "Loading lifecycle"}
          </h3>
        </div>
        <strong>{lifecycle?.events.length ?? 0} completed</strong>
      </div>

      {latest ? (
        <p>Latest: {eventLabels[latest.event_type]} by {latest.actor?.name ?? "System"} · {formatDateTime(latest.created_at)}</p>
      ) : (
        <p>No packet generation or delivery event has been recorded.</p>
      )}

      {quality && (
        <div className="delivery-quality-gate" aria-label="Delivery quality gate">
          <div className="delivery-quality-gate__summary">
            <strong>
              {quality.blockers.length > 0
                ? `${quality.blockers.length} blocking quality check${quality.blockers.length === 1 ? "" : "s"}`
                : "No blocking quality issues"}
            </strong>
            <span>{quality.warnings.length} warning{quality.warnings.length === 1 ? "" : "s"}</span>
          </div>
          {quality.blockers.length > 0 && (
            <ol className="delivery-quality-gate__issues">
              {quality.blockers.map((issue) => (
                <li key={issue.id}>
                  <strong>{issue.id}: {issue.title}</strong>
                  <p>{issue.reason}</p>
                  <span>{issue.recommended_resolution}</span>
                </li>
              ))}
            </ol>
          )}
        </div>
      )}

      {packetIsStale && (
        <div className="delivery-lifecycle-panel__warning" role="note">
          <p>The persisted packet snapshot is stale. Approval and delivery remain blocked until a new snapshot is generated.</p>
          {role === "admin" && canRegenerate && (
            <button
              disabled={submitting}
              type="button"
              onClick={() => void submit("packet_generated")}
            >
              {submitting ? "Regenerating…" : "Regenerate packet"}
            </button>
          )}
        </div>
      )}

      {lifecycle?.current_state === "delivery_confirmed" && (
        <p>Delivery confirmation is recorded. Phase 4 does not support reversal.</p>
      )}
      {error && <p className="error" role="alert">{error}</p>}

      {role === "admin" && selected && (
        <div className="delivery-lifecycle-panel__action">
          {lifecycle && lifecycle.next_events.length > 1 && (
            <label>
              Next transition
              <select
                value={selected}
                onChange={(event) => setSelected(event.target.value as DeliveryEventType)}
              >
                {lifecycle.next_events.map((event) => (
                  <option key={event} value={event}>{eventLabels[event]}</option>
                ))}
              </select>
            </label>
          )}
          <label>
            Optional audit note
            <input maxLength={1000} value={note} onChange={(event) => setNote(event.target.value)} />
          </label>
          <button
            disabled={submitting || selectedBlocked}
            type="button"
            onClick={() => void submit()}
          >
            {submitting ? "Recording…" : eventLabels[selected]}
          </button>
          {selectedBlocked && quality && (
            <p className="delivery-lifecycle-panel__blocked-reason">
              {quality.recommended_resolution}
            </p>
          )}
        </div>
      )}
      {role !== "admin" && <p>Delivery lifecycle changes require an administrator.</p>}
    </section>
  );
}
