import type { ReactNode } from "react";
import { packetDocumentCss } from "./packet-document.css";
import type {
  CanonicalPacketPresentation,
  PacketPresentationBlock,
  PacketPresentationSection,
} from "./presentation";
import { assertCanonicalPacketPresentation } from "./presentation";

function unsupportedPacketBlock(block: never): never {
  const kind = (block as { kind?: unknown }).kind;
  throw new Error(`Unsupported canonical packet block: ${String(kind)}`);
}

function EmptyState({ message }: { message: string }) {
  return (
    <p className="packet-empty">
      <strong>Section status</strong>
      <span>{message}</span>
    </p>
  );
}

function EditorialList({ block }: { block: Extract<PacketPresentationBlock, { kind: "editorial_list" }> }) {
  if (block.items.length === 0) return <EmptyState message={block.empty_message} />;

  return (
    <ol className="packet-editorial-list">
      {block.items.map((item, index) => (
        <li key={item.id}>
          <div className="packet-editorial-index">
            <span>{block.item_label}</span>
            <strong>{String(index + 1).padStart(2, "0")}</strong>
          </div>
          <div>
            <p>{item.text}</p>
            {item.citation_references.length > 0 && (
              <span className="packet-citations">
                Supported by {item.citation_references.join(", ")}
              </span>
            )}
          </div>
        </li>
      ))}
    </ol>
  );
}

function ActionKit({ block }: { block: Extract<PacketPresentationBlock, { kind: "action_kit" }> }) {
  const kit = block.kit;
  if (!kit) return <EmptyState message={block.empty_message} />;

  return (
    <div className="packet-follow-up-kit">
      <section className="packet-follow-up-group packet-follow-up-group--wide">
        <p className="packet-label">Agency follow-up email</p>
        <h3>{kit.email_subject}</h3>
        <p><strong>Recommended contact:</strong> {kit.recipient_role}</p>
        <p>{kit.message_body}</p>
        {kit.citation_references.length > 0 && (
          <span className="packet-citations">Supported by {kit.citation_references.join(", ")}</span>
        )}
      </section>
      <section className="packet-follow-up-group">
        <h4>Requested confirmations</h4>
        <ol>{kit.requested_confirmations.map((item) => <li key={item}>{item}</li>)}</ol>
      </section>
      <section className="packet-follow-up-group">
        <h4>Call script</h4>
        <ol>{kit.call_checklist.map((item) => <li key={item}>{item}</li>)}</ol>
      </section>
      <section className="packet-follow-up-group">
        <h4>Documents to have ready</h4>
        {kit.documents_ready.length > 0 ? (
          <ul>{kit.documents_ready.map((item) => <li key={item}>{item}</li>)}</ul>
        ) : (
          <p>Use only the cited packet sources listed above.</p>
        )}
      </section>
      <section className="packet-follow-up-group packet-follow-up-group--escalation">
        <h4>Escalation summary</h4>
        <p>{kit.escalation_trigger}</p>
        <h4>Recommended next contact</h4>
        <p>{kit.recipient_role}</p>
        {kit.follow_up_date && <p><strong>Review date:</strong> {kit.follow_up_date}</p>}
      </section>
    </div>
  );
}

function PacketBlock({ block }: { block: PacketPresentationBlock }): ReactNode {
  switch (block.kind) {
    case "cover":
      return (
        <>
          <div className="packet-brand-header">
            <strong>PERMITPULSE</strong>
            <span>Permit intelligence / Professional permit review</span>
          </div>
          <div className="packet-cover-body">
            <div>
              <p className="packet-cover-kicker">Client permit deliverable</p>
              <h1>{block.title}</h1>
              <p className="packet-cover-project">{block.project_name}</p>
              <p className="packet-cover-location">{block.location}</p>
            </div>
            <dl className="packet-cover-identity">
              <div><dt>Prepared for</dt><dd>{block.client_name}</dd></div>
              <div><dt>Jurisdiction</dt><dd>{block.jurisdiction}</dd></div>
              <div><dt>Permit identifier</dt><dd>{block.permit_identifier}</dd></div>
              <div><dt>Packet status</dt><dd>{block.lifecycle_status} / {block.packet_status}</dd></div>
              <div><dt>Packet version</dt><dd>{block.packet_version}</dd></div>
              <div><dt>Generated</dt><dd>{block.generated_at_label}</dd></div>
            </dl>
          </div>
          <p className="packet-cover-note">{block.draft_notice}</p>
        </>
      );
    case "executive_summary":
      return (
        <>
          <p className="packet-executive-summary">{block.summary}</p>
          {block.decision_lines.length > 0 && (
            <dl className="packet-decision-lines">
              {block.decision_lines.map((item) => <div key={item.label}><dt>{item.label}</dt><dd>{item.value}</dd></div>)}
            </dl>
          )}
          {(block.key_risks.length > 0 || block.key_strengths.length > 0) && (
            <div className="packet-risk-strength-grid">
              {block.key_risks.length > 0 && <div><p className="packet-label">Key risks</p><ul>{block.key_risks.map((item) => <li key={item}>{item}</li>)}</ul></div>}
              {block.key_strengths.length > 0 && <div><p className="packet-label">Key strengths</p><ul>{block.key_strengths.map((item) => <li key={item}>{item}</li>)}</ul></div>}
            </div>
          )}
        </>
      );
    case "case_snapshot":
      return (
        <>
          <dl className="packet-client-meta">
            {block.facts.map((item) => (
              <div key={item.id}><dt>{item.label}</dt><dd>{item.information_class === "missing_information" ? "Pending record entry" : item.value}</dd></div>
            ))}
          </dl>
          <div className="packet-current-status">
            <strong>Case workflow status: {block.workflow_status}</strong>
            <span>Investigation state: {block.investigation_state} · Packet Readiness: {block.packet_readiness}</span>
            <span>{block.resolution_notice}</span>
            <span>Case record updated {block.record_updated_at}</span>
          </div>
        </>
      );
    case "editorial_list":
      return <EditorialList block={block} />;
    case "dependency_map":
      return block.items.length > 0 ? (
        <div className="packet-dependency-map">
          {block.items.map((item) => (
            <article key={item.id}>
              <div><span>Discipline</span><strong>{item.discipline}</strong></div><i aria-hidden="true">→</i>
              <div><span>Blocking issue</span><strong>{item.blocking_issue}</strong></div><i aria-hidden="true">→</i>
              <div><span>Dependent review</span><strong>{item.dependent_review}</strong></div><i aria-hidden="true">→</i>
              <div><span>Recommended next step</span><strong>{item.recommended_next_step}</strong><small>{item.citation_references.join(", ")}</small></div>
            </article>
          ))}
        </div>
      ) : <EmptyState message={block.empty_message} />;
    case "action_kit":
      return <ActionKit block={block} />;
    case "timeline":
      return block.items.length > 0 ? (
        <ol className="packet-client-timeline">
          {block.items.map((entry, index) => (
            <li key={entry.id}>
              <div className="packet-timeline-rail"><span>{String(index + 1).padStart(2, "0")}</span></div>
              <div className="packet-timeline-date"><time dateTime={entry.occurred_on}>{entry.occurred_on_label}</time><span>{entry.timeline_type_label}</span></div>
              <article>
                <div className="packet-timeline-heading">
                  <h3>{entry.title}</h3>
                  <div><span className="packet-pill">{entry.source_label}</span><span className="packet-pill">{entry.review_label}</span></div>
                </div>
                <p>{entry.details}</p>
                <div className="packet-timeline-evidence">
                  <h4>Supporting evidence</h4>
                  {entry.linked_evidence.length > 0 ? (
                    <ul>{entry.linked_evidence.map((item) => <li key={item.source_id}>{item.verification_label} / {item.title}</li>)}</ul>
                  ) : <p className="packet-source-pending">No supporting evidence linked. Evidence linkage has not been recorded for this event.</p>}
                </div>
              </article>
            </li>
          ))}
        </ol>
      ) : <EmptyState message={block.empty_message} />;
    case "evidence":
      return block.items.length > 0 ? (
        <ol className="packet-client-records">
          {block.items.map((item, index) => (
            <li key={item.id}>
              <div className="packet-client-record-heading">
                <div><p>Evidence {String(index + 1).padStart(2, "0")} / {item.evidence_type_label}</p><h3>{item.title}</h3></div>
                <span className={`packet-verification-badge packet-verification-badge--${item.verification_status}`}>{item.verification_label}</span>
              </div>
              <p className="packet-evidence-summary">{item.summary}</p>
              <dl className="packet-client-meta">
                {item.source.label?.trim() && <div><dt>Source</dt><dd>{item.source.label}</dd></div>}
                <div><dt>Contributor</dt><dd>{item.contributor_label ?? "Contributor not recorded"}</dd></div>
                {item.source.date && <div><dt>Source date</dt><dd>{item.source.date_label}</dd></div>}
                {item.source_href && <div><dt>Provenance</dt><dd><a href={item.source_href} rel="noreferrer noopener" target="_blank">{item.source_href}</a></dd></div>}
              </dl>
              {item.missing_details.length > 0 && <p className="packet-source-pending">Source details pending: {item.missing_details.join(", ")}.</p>}
              <div className="packet-reviewer-note"><span>Reviewer note</span><p>{item.verification_note}</p></div>
            </li>
          ))}
        </ol>
      ) : <EmptyState message={block.empty_message} />;
    case "sources":
      return block.items.length > 0 ? (
        <div className="packet-source-list" role="table" aria-label="Supporting source log">
          <div className="packet-source-list__heading" role="row"><span>Source record</span><span>Provenance</span><span>Review</span></div>
          {block.items.map((source, index) => (
            <div className="packet-source-list__row" role="row" key={source.id}>
              <div><strong>{String(index + 1).padStart(2, "0")} / {source.title}</strong><small>{source.label_display} · {source.date_display} · {source.contributor_label ?? "Contributor not recorded"}</small></div>
              <div>{source.source_href ? <a href={source.source_href} rel="noreferrer noopener" target="_blank">{source.source_href}</a> : <span>Digital provenance not recorded</span>}</div>
              <div><span className="packet-pill">{source.verification_label}</span></div>
            </div>
          ))}
        </div>
      ) : <EmptyState message={block.empty_message} />;
    case "readiness": {
      const dashboard = block.dashboard;
      return (
        <>
          <p className="packet-readiness-conclusion">{block.conclusion}</p>
          <p className="packet-methodology">{block.methodology}</p>
          <div className="packet-dashboard-metrics">
            <div className="packet-dashboard-metric"><span>Investigation state</span><strong>{dashboard.permit_status}</strong><small>Current record condition; not a jurisdiction disposition</small></div>
            <div className="packet-dashboard-metric"><span>Investigation Health</span><strong>{dashboard.mission_health.label}</strong><small>{dashboard.mission_health.score}% · {dashboard.mission_health.explanation}</small></div>
            <div className="packet-dashboard-metric packet-dashboard-metric--score"><span>Packet Readiness</span><strong>{dashboard.readiness.completed}/{dashboard.readiness.total}</strong><small>{dashboard.readiness.explanation}</small></div>
          </div>
          <div className="packet-readiness-summary-grid">
            <section>
              <p className="packet-label">Packet-readiness conditions</p>
              {dashboard.blockers.length > 0 ? (
                <ol>{dashboard.blockers.map((item) => <li key={item.id}><strong>{item.title}</strong><span>{item.resolution}</span></li>)}</ol>
              ) : (
                <p><strong>No packet-readiness conditions remain.</strong> Open agency findings do not indicate jurisdiction resolution.</p>
              )}
            </section>
            <section className="packet-readiness-summary-grid__action">
              <p className="packet-label">Recommended next action</p>
              <strong>{dashboard.recommended_action.title}</strong>
              <p>{dashboard.recommended_action.detail}</p>
            </section>
          </div>
          <section className="packet-evidence-snapshot">
            <div><p className="packet-label">Evidence summary</p><p>{dashboard.evidence.text}</p></div>
            <dl><div><dt>Verified</dt><dd>{dashboard.evidence.verified}</dd></div><div><dt>Unverified</dt><dd>{dashboard.evidence.unverified}</dd></div><div><dt>Disputed</dt><dd>{dashboard.evidence.disputed}</dd></div><div><dt>Provenance issues</dt><dd>{dashboard.evidence.provenance_issues}</dd></div></dl>
          </section>
          <div className="packet-readiness-factors">
            <p className="packet-label">Packet Readiness checks</p>
            <ul>{dashboard.factors.map((factor) => <li className={factor.passed ? "is-passed" : "is-pending"} key={factor.id}><span>{factor.passed ? "Pass" : "Open"}</span><strong>{factor.label}</strong><small>{factor.detail}</small></li>)}</ul>
          </div>
          {block.warnings.length > 0 && <ul className="packet-readiness-notes">{block.warnings.map((warning) => <li key={warning}>{warning}</li>)}</ul>}
          <dl className="packet-readiness-metadata">{block.metadata.map((item) => <div key={item.label}><dt>{item.label}</dt><dd>{item.value}</dd></div>)}</dl>
          <p className="packet-disclaimer"><strong>Use limitation.</strong> {block.disclaimer}</p>
        </>
      );
    }
    case "disclosure":
      return <p className={`packet-disclosure${block.applies ? " packet-disclosure--applies" : ""}`}>{block.text}</p>;
    default:
      return unsupportedPacketBlock(block);
  }
}

function PacketSectionView({ section }: { section: PacketPresentationSection }) {
  const isCover = section.id === "cover";

  return (
    <section
      aria-labelledby={`packet-${section.id}-title`}
      className={`packet-section packet-section--${section.id.replaceAll("_", "-")}`}
      data-packet-section={section.id}
    >
      {isCover ? (
        <h2 id={`packet-${section.id}-title`} hidden>{section.title}</h2>
      ) : (
        <>
          <div className="packet-section-heading">
            <span>{section.number}</span>
            <div><p>Client deliverable</p><h2 id={`packet-${section.id}-title`}>{section.title}</h2></div>
          </div>
          {section.intro && <p className="packet-section-intro">{section.intro}</p>}
        </>
      )}
      {section.blocks.map((block, index) => <PacketBlock block={block} key={`${block.kind}-${index}`} />)}
    </section>
  );
}

export function PacketDocument({ presentation }: { presentation: CanonicalPacketPresentation }) {
  assertCanonicalPacketPresentation(presentation);

  return (
    <>
      <style data-packet-document-styles>{packetDocumentCss}</style>
      <article
        className="packet-document packet-document--client packet-canonical-document"
        data-packet-presentation-version={presentation.presentation_version}
      >
        {presentation.sections.map((section) => <PacketSectionView key={section.id} section={section} />)}
        <footer className="packet-client-footer"><span>PermitPulse · Permit intelligence</span><span>{presentation.footer}</span></footer>
      </article>
    </>
  );
}
