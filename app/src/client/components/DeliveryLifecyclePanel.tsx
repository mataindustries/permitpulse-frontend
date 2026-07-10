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
const consequential = new Set<DeliveryEventType>(["approved_for_delivery", "delivery_recorded", "delivery_confirmed"]);

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
      if (active) { setLifecycle(value); setSelected(value.next_events[0] ?? ""); }
    }).catch(() => { if (active) setError("Delivery lifecycle could not be loaded."); });
    return () => { active = false; };
  }, [caseId]);

  async function submit() {
    if (!selected || submitting) return;
    if (consequential.has(selected) && !globalThis.confirm(`${eventLabels[selected]}? This creates an immutable audit event.`)) return;
    setSubmitting(true); setError("");
    try {
      const value = await transitionDeliveryLifecycle(caseId, selected, note.trim() || null);
      setLifecycle(value); setSelected(value.next_events[0] ?? ""); setNote("");
      await onChanged();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The lifecycle could not be updated.");
    } finally { setSubmitting(false); }
  }

  const latest = lifecycle?.latest_event;
  const snapshotDiffers = Boolean(lifecycle?.live_preview_differs || (latest?.case_version && latest.case_version !== caseVersion));
  return (
    <section className="delivery-lifecycle-panel" aria-labelledby="delivery-lifecycle-title">
      <div className="delivery-lifecycle-panel__heading">
        <div><p className="eyebrow">Delivery lifecycle</p><h3 id="delivery-lifecycle-title">{lifecycle ? stateLabels[lifecycle.current_state] : "Loading lifecycle"}</h3></div>
        <strong>{lifecycle?.events.length ?? 0} completed</strong>
      </div>
      {latest ? <p>Latest: {eventLabels[latest.event_type]} by {latest.actor?.name ?? "System"} · {formatDateTime(latest.created_at)}</p> : <p>No packet generation or delivery event has been recorded.</p>}
      {snapshotDiffers && <p className="delivery-lifecycle-panel__warning" role="note">The live preview uses case version {caseVersion}; the latest persisted packet snapshot uses case version {latest?.case_version}. Generate a new packet after review changes.</p>}
      {lifecycle?.current_state === "delivery_confirmed" && <p>Delivery confirmation is recorded. Phase 4 does not support reversal.</p>}
      {error && <p className="error" role="alert">{error}</p>}
      {role === "admin" && selected && (
        <div className="delivery-lifecycle-panel__action">
          {lifecycle && lifecycle.next_events.length > 1 && <label>Next transition<select value={selected} onChange={(event) => setSelected(event.target.value as DeliveryEventType)}>{lifecycle.next_events.map((event) => <option key={event} value={event}>{eventLabels[event]}</option>)}</select></label>}
          <label>Optional audit note<input maxLength={1000} value={note} onChange={(event) => setNote(event.target.value)} /></label>
          <button disabled={submitting} type="button" onClick={() => void submit()}>{submitting ? "Recording…" : eventLabels[selected]}</button>
        </div>
      )}
      {role !== "admin" && <p>Delivery lifecycle changes require an administrator.</p>}
    </section>
  );
}
