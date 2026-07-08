import { useMemo, useState } from "react";
import {
  caseStatusLabels,
  type CaseActivityEntry,
  type CaseActivityResponse,
  type CaseDto,
} from "../types/cases";
import {
  evidenceTypeLabels,
  timelineTypeLabels,
  verificationStatusLabels,
  type EvidenceItemDto,
  type TimelineEntryDto,
} from "../types/evidence-timeline";
import {
  contributorName,
  formatDateOnly,
  formatDateTime,
  safeExternalHref,
} from "./evidenceTimelineUtils";

interface PacketPreviewProps {
  activityResponse: CaseActivityResponse | null;
  caseRecord: CaseDto;
  evidence: EvidenceItemDto[];
  initialCopyStatus?: "idle" | "success" | "error";
  timeline: TimelineEntryDto[];
}

interface PacketTextInput extends PacketPreviewProps {
  generatedAt: Date;
}

const draftNote = "Draft packet preview - verify before sending.";
const notAiGeneratedNote = "This placeholder is not AI-generated yet.";

const activityActionLabels: Record<CaseActivityEntry["action"], string> = {
  case_created: "Case created",
  case_updated: "Case details updated",
  case_status_changed: "Status changed",
};

const activityFieldLabels: Record<string, string> = {
  project_name: "Project name",
  client_name: "Client name",
  address: "Address",
  city: "City",
  jurisdiction: "Jurisdiction",
  permit_number: "Permit number",
  current_status: "Current status",
};

function textDateTime(value: string): string {
  const date = new Date(value);

  return Number.isNaN(date.getTime()) ? "Unknown" : date.toISOString();
}

function textDateOnly(value: string | null): string {
  return value ?? "Not provided";
}

function addSection(lines: string[], title: string, body: string[]) {
  lines.push("", title, "-".repeat(title.length), ...body);
}

function activityFieldSummary(entry: CaseActivityEntry): string {
  return entry.changed_fields
    .filter((field) => field in activityFieldLabels)
    .map((field) => activityFieldLabels[field])
    .join(", ");
}

function verificationNote(item: EvidenceItemDto): string {
  if (item.verification_status === "verified") {
    return "Marked verified.";
  }

  if (item.verification_status === "disputed") {
    return "Disputed evidence. Do not treat as confirmed.";
  }

  return "Unverified evidence. Do not treat as confirmed.";
}

export function compilePacketText({
  activityResponse,
  caseRecord,
  evidence,
  generatedAt,
  timeline,
}: PacketTextInput): string {
  const lines = [
    "PermitPulse packet preview",
    draftNote,
    `Generated: ${generatedAt.toISOString()}`,
  ];
  const evidenceById = new Map(evidence.map((item) => [item.id, item]));

  addSection(lines, "Packet header", [
    `Project: ${caseRecord.project_name}`,
    `Client: ${caseRecord.client_name}`,
    `Jurisdiction: ${caseRecord.jurisdiction}`,
    `Permit number: ${caseRecord.permit_number ?? "Not provided"}`,
    `Case version: ${caseRecord.version}`,
  ]);

  addSection(lines, "Project summary", [
    `Address: ${caseRecord.address}`,
    `City: ${caseRecord.city}`,
    `Created: ${textDateTime(caseRecord.created_at)}`,
    `Updated: ${textDateTime(caseRecord.updated_at)}`,
  ]);

  addSection(lines, "Current permit status", [
    `Current status: ${caseStatusLabels[caseRecord.current_status]}`,
  ]);

  addSection(
    lines,
    "Key evidence",
    evidence.length > 0
      ? evidence.flatMap((item, index) => [
          `${index + 1}. ${item.title}`,
          `   Type: ${evidenceTypeLabels[item.evidence_type]}`,
          `   Verification: ${verificationStatusLabels[item.verification_status]} - ${verificationNote(item)}`,
          `   Source label: ${item.source_label ?? "Not provided"}`,
          `   Source URL: ${item.source_url ?? "Not provided"}`,
          `   Source date: ${textDateOnly(item.source_date)}`,
          `   Summary: ${item.summary}`,
        ])
      : ["No evidence records are available in this case."],
  );

  addSection(
    lines,
    "Permit timeline",
    timeline.length > 0
      ? timeline.flatMap((entry, index) => {
          const linkedEvidence =
            entry.evidence_ids.length > 0
              ? entry.evidence_ids
                  .map((id) => evidenceById.get(id)?.title ?? `Missing evidence reference ${id}`)
                  .join("; ")
              : "No linked evidence.";

          return [
            `${index + 1}. ${entry.occurred_on} - ${entry.title}`,
            `   Type: ${timelineTypeLabels[entry.timeline_type]}`,
            `   Entry source: ${entry.is_canonical ? "Canonical" : "Contributed"}`,
            `   Linked evidence: ${linkedEvidence}`,
            `   Details: ${entry.details}`,
          ];
        })
      : ["No permit timeline records are available in this case."],
  );

  addSection(
    lines,
    "Recent case activity",
    activityResponse && activityResponse.activity.length > 0
      ? activityResponse.activity.flatMap((entry, index) => {
          const fields = activityFieldSummary(entry);
          const statusLine =
            entry.action === "case_status_changed" &&
            entry.from_status &&
            entry.to_status
              ? `   Status: ${caseStatusLabels[entry.from_status]} to ${caseStatusLabels[entry.to_status]}`
              : null;

          return [
            `${index + 1}. ${activityActionLabels[entry.action]} at ${textDateTime(entry.created_at)}`,
            `   Actor: ${entry.actor?.name?.trim() || "System"}`,
            ...(fields ? [`   Changed fields: ${fields}`] : []),
            ...(statusLine ? [statusLine] : []),
          ];
        })
      : ["No recent case activity records are available in this case."],
  );

  addSection(lines, "Open questions / missing information", [
    `${notAiGeneratedNote} Add reviewer-verified open questions manually before sending.`,
  ]);
  addSection(lines, "Recommended next actions", [
    `${notAiGeneratedNote} Add reviewer-approved next actions manually before sending.`,
  ]);
  addSection(lines, "Disclaimer / internal-review note", [
    "Internal review draft only. Verify all source records, statuses, dates, and jurisdiction requirements before sending or relying on this packet.",
  ]);

  return lines.join("\n");
}

export async function copyPacketText(
  text: string,
  clipboard: Pick<Clipboard, "writeText"> | undefined = globalThis.navigator
    ?.clipboard,
): Promise<boolean> {
  if (!clipboard?.writeText) {
    return false;
  }

  try {
    await clipboard.writeText(text);

    return true;
  } catch {
    return false;
  }
}

export function PacketPreview({
  activityResponse,
  caseRecord,
  evidence,
  initialCopyStatus = "idle",
  timeline,
}: PacketPreviewProps) {
  const [generatedAt, setGeneratedAt] = useState(() => new Date());
  const [copyStatus, setCopyStatus] = useState<"idle" | "success" | "error">(
    initialCopyStatus,
  );
  const packetText = useMemo(
    () =>
      compilePacketText({
        activityResponse,
        caseRecord,
        evidence,
        generatedAt,
        timeline,
      }),
    [activityResponse, caseRecord, evidence, generatedAt, timeline],
  );
  const evidenceById = new Map(evidence.map((item) => [item.id, item]));
  const activity = activityResponse?.activity ?? [];

  async function handleCopy() {
    setCopyStatus("idle");
    const copied = await copyPacketText(packetText);

    setCopyStatus(copied ? "success" : "error");
  }

  function handlePrint() {
    setGeneratedAt(new Date());
    if (typeof globalThis.window?.print === "function") {
      globalThis.window.print();
    }
  }

  return (
    <section className="packet-preview" aria-labelledby="packet-preview-title">
      <div className="packet-toolbar print-hidden">
        <div>
          <p className="eyebrow">Packet preview</p>
          <h3 id="packet-preview-title">Draft permit packet</h3>
        </div>
        <div className="packet-actions">
          <button type="button" onClick={() => void handleCopy()}>
            Copy packet text
          </button>
          <button className="secondary-button" type="button" onClick={handlePrint}>
            Print preview
          </button>
        </div>
      </div>

      {copyStatus === "success" && (
        <p className="success packet-feedback" role="status">
          Packet text copied. Verify before sending.
        </p>
      )}
      {copyStatus === "error" && (
        <p className="error packet-feedback" role="alert">
          Packet text could not be copied. Use browser selection or print preview.
        </p>
      )}

      <article className="packet-document">
        <header className="packet-section packet-section--header">
          <p className="eyebrow">Packet header</p>
          <h3>PermitPulse packet preview</h3>
          <p>{draftNote}</p>
          <dl className="detail-grid">
            <div>
              <dt>Project</dt>
              <dd>{caseRecord.project_name}</dd>
            </div>
            <div>
              <dt>Generated</dt>
              <dd>
                <time dateTime={generatedAt.toISOString()}>
                  {formatDateTime(generatedAt.toISOString())}
                </time>
              </dd>
            </div>
            <div>
              <dt>Jurisdiction</dt>
              <dd>{caseRecord.jurisdiction}</dd>
            </div>
            <div>
              <dt>Permit number</dt>
              <dd>{caseRecord.permit_number ?? "Not provided"}</dd>
            </div>
            <div>
              <dt>Case version</dt>
              <dd>{caseRecord.version}</dd>
            </div>
          </dl>
        </header>

        <section className="packet-section" aria-labelledby="packet-summary-title">
          <h3 id="packet-summary-title">Project summary</h3>
          <dl className="detail-grid">
            <div>
              <dt>Client</dt>
              <dd>{caseRecord.client_name}</dd>
            </div>
            <div>
              <dt>Address</dt>
              <dd>{caseRecord.address}</dd>
            </div>
            <div>
              <dt>City</dt>
              <dd>{caseRecord.city}</dd>
            </div>
            <div>
              <dt>Updated</dt>
              <dd>{formatDateTime(caseRecord.updated_at)}</dd>
            </div>
          </dl>
        </section>

        <section className="packet-section" aria-labelledby="packet-status-title">
          <h3 id="packet-status-title">Current permit status</h3>
          <p>{caseStatusLabels[caseRecord.current_status]}</p>
        </section>

        <section className="packet-section" aria-labelledby="packet-evidence-title">
          <h3 id="packet-evidence-title">Key evidence</h3>
          {evidence.length === 0 ? (
            <p>No evidence records are available in this case.</p>
          ) : (
            <ol className="packet-list">
              {evidence.map((item) => {
                const href = safeExternalHref(item.source_url);

                return (
                  <li key={item.id}>
                    <div className="packet-item-heading">
                      <strong>{item.title}</strong>
                      <span
                        className={`verification-badge verification-badge--${item.verification_status}`}
                      >
                        {verificationStatusLabels[item.verification_status]}
                      </span>
                    </div>
                    <p>{item.summary}</p>
                    <dl className="record-meta">
                      <div>
                        <dt>Type</dt>
                        <dd>{evidenceTypeLabels[item.evidence_type]}</dd>
                      </div>
                      <div>
                        <dt>Source label</dt>
                        <dd>{item.source_label ?? "Not provided"}</dd>
                      </div>
                      <div>
                        <dt>Source URL</dt>
                        <dd>
                          {href ? (
                            <a href={href} rel="noreferrer noopener" target="_blank">
                              {href}
                            </a>
                          ) : (
                            item.source_url ?? "Not provided"
                          )}
                        </dd>
                      </div>
                      <div>
                        <dt>Source date</dt>
                        <dd>{formatDateOnly(item.source_date)}</dd>
                      </div>
                    </dl>
                    <p className="field-note">{verificationNote(item)}</p>
                  </li>
                );
              })}
            </ol>
          )}
        </section>

        <section className="packet-section" aria-labelledby="packet-timeline-title">
          <h3 id="packet-timeline-title">Permit timeline</h3>
          {timeline.length === 0 ? (
            <p>No permit timeline records are available in this case.</p>
          ) : (
            <ol className="packet-list">
              {timeline.map((entry) => {
                const linkedEvidence = entry.evidence_ids
                  .map((id) => evidenceById.get(id))
                  .filter((item): item is EvidenceItemDto => Boolean(item));
                const missingEvidenceCount =
                  entry.evidence_ids.length - linkedEvidence.length;

                return (
                  <li key={entry.id}>
                    <div className="packet-item-heading">
                      <strong>{entry.title}</strong>
                      <span
                        className={
                          entry.is_canonical
                            ? "record-pill record-pill--canonical"
                            : "record-pill"
                        }
                      >
                        {entry.is_canonical ? "Canonical" : "Contributed"}
                      </span>
                    </div>
                    <p>
                      <time dateTime={entry.occurred_on}>
                        {formatDateOnly(entry.occurred_on)}
                      </time>{" "}
                      · {timelineTypeLabels[entry.timeline_type]}
                    </p>
                    <p>{entry.details}</p>
                    <div className="linked-evidence">
                      <h4>Linked evidence references</h4>
                      {linkedEvidence.length === 0 && missingEvidenceCount === 0 ? (
                        <p className="field-note">No supporting evidence linked.</p>
                      ) : (
                        <ul className="packet-reference-list">
                          {linkedEvidence.map((item) => (
                            <li key={item.id}>
                              {item.title} (
                              {verificationStatusLabels[item.verification_status]})
                            </li>
                          ))}
                          {missingEvidenceCount > 0 && (
                            <li>
                              {missingEvidenceCount} linked evidence reference
                              {missingEvidenceCount === 1 ? "" : "s"} not loaded.
                            </li>
                          )}
                        </ul>
                      )}
                    </div>
                  </li>
                );
              })}
            </ol>
          )}
        </section>

        <section className="packet-section" aria-labelledby="packet-activity-title">
          <h3 id="packet-activity-title">Recent case activity</h3>
          {activity.length === 0 ? (
            <p>No recent case activity records are available in this case.</p>
          ) : (
            <ol className="packet-list">
              {activity.map((entry) => {
                const fields = activityFieldSummary(entry);

                return (
                  <li key={entry.id}>
                    <div className="packet-item-heading">
                      <strong>{activityActionLabels[entry.action]}</strong>
                      <time dateTime={entry.created_at}>
                        {formatDateTime(entry.created_at)}
                      </time>
                    </div>
                    <p>Actor: {entry.actor?.name?.trim() || "System"}</p>
                    {fields && <p>Changed fields: {fields}</p>}
                    {entry.action === "case_status_changed" &&
                      entry.from_status &&
                      entry.to_status && (
                        <p>
                          Status: {caseStatusLabels[entry.from_status]} to{" "}
                          {caseStatusLabels[entry.to_status]}
                        </p>
                      )}
                  </li>
                );
              })}
            </ol>
          )}
        </section>

        <section className="packet-section" aria-labelledby="packet-questions-title">
          <h3 id="packet-questions-title">Open questions / missing information</h3>
          <p>{notAiGeneratedNote}</p>
          <p>Add reviewer-verified open questions manually before sending.</p>
        </section>

        <section className="packet-section" aria-labelledby="packet-actions-title">
          <h3 id="packet-actions-title">Recommended next actions</h3>
          <p>{notAiGeneratedNote}</p>
          <p>Add reviewer-approved next actions manually before sending.</p>
        </section>

        <section className="packet-section" aria-labelledby="packet-disclaimer-title">
          <h3 id="packet-disclaimer-title">Disclaimer / internal-review note</h3>
          <p>
            Internal review draft only. Verify all source records, statuses,
            dates, and jurisdiction requirements before sending or relying on
            this packet.
          </p>
        </section>
      </article>
    </section>
  );
}
