import { useState } from "react";
import type {
  PacketReviewDraft,
  PacketReviewDraftResponseData,
} from "../../shared/ai-review/types";
import { CaseApiError } from "../api/cases";
import { formatDateTime } from "./evidenceTimelineUtils";

type ReviewStatus = "idle" | "loading" | "success" | "error";
type CopyStatus = "idle" | "success" | "error";

interface AIReviewPanelProps {
  initialCopyStatus?: CopyStatus;
  initialData?: PacketReviewDraftResponseData | null;
  initialError?: string;
  initialStatus?: ReviewStatus;
  onGenerate: () => Promise<PacketReviewDraftResponseData>;
}

function addTextSection(lines: string[], heading: string, values: string[]) {
  lines.push("", heading, "-".repeat(heading.length));
  lines.push(...(values.length > 0 ? values.map((value) => `- ${value}`) : ["None returned."]));
}

export function compileAiReviewText(data: PacketReviewDraftResponseData): string {
  const { evaluation, metadata, review } = data;
  const lines = [
    "Draft review — verify before sending",
    `Reviewer: ${metadata.reviewer}`,
    `live_ai=${metadata.live_ai}`,
    `external_calls=${metadata.external_calls}`,
  ];

  if (review.model_metadata?.generated_at) {
    lines.push(`Generated: ${review.model_metadata.generated_at}`);
  }

  lines.push("", "Summary", "-------", review.summary);
  addTextSection(lines, "Missing information", review.missing_information);
  addTextSection(
    lines,
    "Recommended next actions",
    review.recommended_next_actions,
  );
  addTextSection(
    lines,
    "Evidence citations",
    review.evidence_citations.map(
      (citation) => `${citation.source_type}: ${citation.record_id}`,
    ),
  );
  addTextSection(lines, "Unsupported claims", review.unsupported_claims);
  addTextSection(lines, "Confidence notes", review.confidence_notes);
  lines.push(
    "",
    "Evaluation",
    "----------",
    `Score: ${evaluation.score}/100`,
    `Result: ${evaluation.passed ? "Pass" : "Needs review"}`,
    `Citation validity: ${evaluation.citation_validity.score}/100 (${evaluation.citation_validity.passed ? "pass" : "needs review"})`,
    `Safety: ${evaluation.safety.passed ? "Pass" : "Needs review"}`,
  );
  addTextSection(
    lines,
    "Safety warnings",
    [...new Set([...evaluation.warnings, ...evaluation.safety.warnings])],
  );
  lines.push(
    "",
    "This deterministic draft only uses packet data already in the workspace and may miss issues.",
    "Verify evidence, dates, status, and jurisdiction requirements before sending.",
  );

  return lines.join("\n");
}

export async function copyAiReviewText(
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

export function safeAiReviewError(error: unknown): string {
  if (error instanceof CaseApiError) {
    switch (error.kind) {
      case "unauthorized":
        return "Your session expired. Sign in again.";
      case "forbidden":
        return "You do not have permission to generate this case review.";
      case "not-found":
        return "The case was not found or is no longer available.";
      case "validation":
        return "The review request could not be validated.";
      case "network":
        return "The review request could not reach the local workspace. Try again.";
      case "conflict":
      case "server":
        return "The review draft could not be generated. Try again.";
    }
  }

  return "The review draft could not be generated. Try again.";
}

function ReviewList({
  empty,
  items,
}: {
  empty: string;
  items: string[];
}) {
  return items.length > 0 ? (
    <ul className="ai-review-list">
      {items.map((item, index) => (
        <li key={index}>{item}</li>
      ))}
    </ul>
  ) : (
    <p className="field-note">{empty}</p>
  );
}

function ReviewContent({ review }: { review: PacketReviewDraft }) {
  return (
    <div className="ai-review-sections">
      <section className="ai-review-card" aria-labelledby="ai-review-summary-title">
        <h4 id="ai-review-summary-title">Summary</h4>
        <p>{review.summary}</p>
      </section>

      <section className="ai-review-card" aria-labelledby="ai-review-missing-title">
        <h4 id="ai-review-missing-title">Missing information</h4>
        <ReviewList
          empty="No missing-information items were returned. Verify the packet manually."
          items={review.missing_information}
        />
      </section>

      <section className="ai-review-card" aria-labelledby="ai-review-actions-title">
        <h4 id="ai-review-actions-title">Recommended next actions</h4>
        <ReviewList
          empty="No next actions were returned. Ask a human reviewer what to do next."
          items={review.recommended_next_actions}
        />
      </section>

      <section className="ai-review-card" aria-labelledby="ai-review-citations-title">
        <h4 id="ai-review-citations-title">Evidence citations</h4>
        {review.evidence_citations.length > 0 ? (
          <ul className="ai-review-list ai-review-citations">
            {review.evidence_citations.map((citation, index) => (
              <li key={`${citation.source_type}-${citation.record_id}-${index}`}>
                <span>{citation.source_type} record</span>
                <code>{citation.record_id}</code>
              </li>
            ))}
          </ul>
        ) : (
          <p className="field-note">No packet record citations were returned.</p>
        )}
      </section>

      <section className="ai-review-card" aria-labelledby="ai-review-unsupported-title">
        <h4 id="ai-review-unsupported-title">Unsupported claims</h4>
        <ReviewList
          empty="No unsupported claims were reported by the evaluator. Human verification is still required."
          items={review.unsupported_claims}
        />
      </section>

      <section className="ai-review-card" aria-labelledby="ai-review-confidence-title">
        <h4 id="ai-review-confidence-title">Confidence notes</h4>
        <ReviewList
          empty="No confidence notes were returned. Treat the draft as unverified."
          items={review.confidence_notes}
        />
      </section>
    </div>
  );
}

function EvaluationReport({ data }: { data: PacketReviewDraftResponseData }) {
  const { evaluation } = data;
  const safetyWarnings = [
    ...new Set([...evaluation.warnings, ...evaluation.safety.warnings]),
  ];

  return (
    <section className="ai-review-evaluation" aria-labelledby="ai-review-evaluation-title">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Local evaluator</p>
          <h4 id="ai-review-evaluation-title">Evaluation report</h4>
        </div>
        <span
          className={evaluation.passed ? "review-result review-result--pass" : "review-result review-result--warning"}
        >
          {evaluation.passed ? "Pass" : "Needs review"}
        </span>
      </div>
      <dl className="detail-grid ai-review-score-grid">
        <div>
          <dt>Overall score</dt>
          <dd>{evaluation.score}/100</dd>
        </div>
        <div>
          <dt>Citation validity</dt>
          <dd>
            {evaluation.citation_validity.score}/100 · {evaluation.citation_validity.passed ? "Pass" : "Needs review"}
          </dd>
        </div>
        <div>
          <dt>Safety</dt>
          <dd>{evaluation.safety.passed ? "Pass" : "Needs review"}</dd>
        </div>
      </dl>
      <div>
        <h5>Safety warnings</h5>
        <ReviewList
          empty="No evaluator safety warnings were returned. Human verification is still required."
          items={safetyWarnings}
        />
      </div>
    </section>
  );
}

export function AIReviewPanel({
  initialCopyStatus = "idle",
  initialData = null,
  initialError = "",
  initialStatus = initialData ? "success" : "idle",
  onGenerate,
}: AIReviewPanelProps) {
  const [status, setStatus] = useState<ReviewStatus>(initialStatus);
  const [data, setData] = useState<PacketReviewDraftResponseData | null>(initialData);
  const [error, setError] = useState(initialError);
  const [copyStatus, setCopyStatus] = useState<CopyStatus>(initialCopyStatus);

  async function generate() {
    if (status === "loading") {
      return;
    }

    setStatus("loading");
    setError("");
    setCopyStatus("idle");

    try {
      const result = await onGenerate();
      setData(result);
      setStatus("success");
    } catch (generationError) {
      setError(safeAiReviewError(generationError));
      setStatus("error");
    }
  }

  async function copyReview() {
    if (!data) {
      return;
    }

    setCopyStatus("idle");
    const copied = await copyAiReviewText(compileAiReviewText(data));
    setCopyStatus(copied ? "success" : "error");
  }

  const responseMetadata = data?.metadata;
  const generatedAt = data?.review.model_metadata?.generated_at;

  return (
    <section
      aria-busy={status === "loading"}
      aria-labelledby="ai-review-panel-title"
      className="ai-review-panel"
    >
      <div className="ai-review-header">
        <div>
          <p className="eyebrow">AI review</p>
          <h3 id="ai-review-panel-title">Deterministic baseline review</h3>
          <p>Draft only — verify before sending.</p>
        </div>
        <div className="ai-review-actions">
          <button disabled={status === "loading"} type="button" onClick={() => void generate()}>
            {status === "loading"
              ? "Generating review..."
              : status === "error"
                ? "Retry review draft"
                : data
                  ? "Generate fresh draft"
                  : "Generate review draft"}
          </button>
          {data && (
            <button className="secondary-button" type="button" onClick={() => void copyReview()}>
              Copy review text
            </button>
          )}
        </div>
      </div>

      <div className="ai-review-metadata" aria-label="Review feature metadata">
        <div><span>Reviewer</span><strong>{responseMetadata?.reviewer ?? "deterministic-baseline"}</strong></div>
        <div><span>Live AI</span><strong>Off · live_ai={String(responseMetadata?.live_ai ?? false)}</strong></div>
        <div><span>External calls</span><strong>None · external_calls={String(responseMetadata?.external_calls ?? false)}</strong></div>
        <div><span>Use</span><strong>Draft only</strong></div>
      </div>

      <aside className="ai-review-safety-note" aria-labelledby="ai-review-safety-title">
        <h4 id="ai-review-safety-title">Verify this draft</h4>
        <p>
          This is a deterministic draft review, not live AI. It only uses packet
          data already in the workspace and may miss issues. Verify evidence,
          dates, status, and jurisdiction requirements before sending. It is not
          legal advice and does not predict permit approval.
        </p>
      </aside>

      {status === "idle" && !data && (
        <p className="state-box" role="status">
          No review draft has been generated. Use the button above when you are ready.
        </p>
      )}

      {status === "loading" && (
        <p className="state-box" role="status">
          Generating a deterministic review from the current server-side packet...
        </p>
      )}

      {status === "error" && (
        <div className="state-box state-box--error" role="alert">
          <h4>Review unavailable</h4>
          <p>{error || "The review draft could not be generated. Try again."}</p>
        </div>
      )}

      {copyStatus === "success" && (
        <p className="success" role="status">Review text copied. Verify before sending.</p>
      )}
      {copyStatus === "error" && (
        <p className="error" role="alert">
          Review text could not be copied. Use browser selection instead.
        </p>
      )}

      {data && status !== "loading" && (
        <article className="ai-review-document">
          <header className="ai-review-generated">
            <h4>Generated draft review</h4>
            {generatedAt ? (
              <p>
                Generated: <time dateTime={generatedAt}>{formatDateTime(generatedAt)}</time>
              </p>
            ) : (
              <p>Generated locally. No review was stored.</p>
            )}
          </header>
          <ReviewContent review={data.review} />
          <EvaluationReport data={data} />
        </article>
      )}
    </section>
  );
}
