/**
 * OpenAI Build Week 2026-only adversarial fixture.
 *
 * This statement is intentionally unsupported. It stays reviewer-unapproved,
 * exists only in the fictional Arroyo Vista case, and is excluded from every
 * deterministic client packet by the canonical packet service.
 */
export const buildWeekUnsupportedReassignmentFinding = {
  key: "build-week-unsupported-reassignment",
  title: "Reviewer reassignment confirmed",
  finding_type: "risk",
  severity: "high",
  summary:
    "The May 18 intake receipt confirms that the resubmittal was reassigned to the original reviewer and plan check is underway.",
  evidence_keys: ["receipt", "reviewer-email", "portal"],
  timeline_keys: ["uploaded", "intake", "waiting"],
  confidence: "low",
  recommended_resolution:
    "Replace this draft statement with a request for the current reviewer, discipline queue, and routing date.",
  internal_notes:
    "OpenAI Build Week 2026 demo-only unsupported draft. Preserve as unapproved so the Integrity Engine can challenge it.",
  approved: false,
} as const;
