import {
  packetSectionDefinitions,
  packetSectionOrder,
  packetDraftNotice,
  packetPresentationVersion,
  type PacketActionKit,
  type PacketAgencyDependency,
  type PacketDocumentStatus,
  type PacketEvidenceSummary,
  type PacketFact,
  type PacketPresentationModel,
  type PacketSectionId,
  type PacketSupportingSource,
  type PacketTimelineSummary,
} from "./types";
import {
  packetDashboard,
  packetEvidenceMissingDetails,
  packetTimelineChronology,
  packetTimelineReviewLabel,
  type PacketDashboard,
} from "./presentation-summary";

export interface PacketPresentationEditorialItem {
  citation_references: string[];
  id: string;
  text: string;
}

export interface PacketPresentationTimelineItem extends PacketTimelineSummary {
  review_label: ReturnType<typeof packetTimelineReviewLabel>;
}

export interface PacketPresentationEvidenceItem extends PacketEvidenceSummary {
  missing_details: string[];
  source_href: string | null;
}

export interface PacketPresentationSourceItem extends PacketSupportingSource {
  date_display: string;
  label_display: string;
  source_href: string | null;
}

export type PacketPresentationBlock =
  | {
      kind: "cover";
      client_name: string;
      draft_notice: string;
      generated_at_label: string;
      jurisdiction: string;
      lifecycle_status: string;
      location: string;
      packet_status: string;
      packet_version: number;
      permit_identifier: string;
      project_name: string;
      title: string;
    }
  | {
      kind: "executive_summary";
      decision_lines: { label: string; value: string }[];
      key_risks: string[];
      key_strengths: string[];
      summary: string;
    }
  | {
      kind: "case_snapshot";
      facts: PacketFact[];
      investigation_state: string;
      packet_readiness: string;
      record_updated_at: string;
      resolution_notice: string;
      workflow_status: string;
    }
  | {
      kind: "editorial_list";
      empty_message: string;
      item_label: "Finding" | "Question" | "Action";
      items: PacketPresentationEditorialItem[];
    }
  | {
      kind: "dependency_map";
      empty_message: string;
      items: PacketAgencyDependency[];
    }
  | {
      kind: "action_kit";
      empty_message: string;
      kit: PacketActionKit | null;
    }
  | {
      kind: "timeline";
      empty_message: string;
      items: PacketPresentationTimelineItem[];
    }
  | {
      kind: "evidence";
      empty_message: string;
      items: PacketPresentationEvidenceItem[];
    }
  | {
      kind: "sources";
      empty_message: string;
      items: PacketPresentationSourceItem[];
    }
  | {
      kind: "readiness";
      conclusion: string;
      dashboard: PacketDashboard;
      disclaimer: string;
      methodology: string;
      metadata: { label: string; value: string }[];
      warnings: string[];
    }
  | {
      kind: "disclosure";
      applies: boolean;
      text: string;
    };

export interface PacketPresentationSection {
  blocks: PacketPresentationBlock[];
  id: PacketSectionId;
  intro: string | null;
  number: string;
  title: string;
}

export interface CanonicalPacketPresentation {
  footer: string;
  generated_at: string;
  packet_version: number;
  presentation_version: typeof packetPresentationVersion;
  sections: PacketPresentationSection[];
  title: string;
}

const requiredPacketSectionOrder = packetSectionOrder.filter(
  (id) => id !== "fictional_demonstration_disclosure",
);

function invariant(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(`Invalid canonical packet presentation: ${message}`);
  }
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

function assertPacketBlock(block: PacketPresentationBlock): void {
  invariant(typeof block === "object" && block !== null, "section block must be an object");
  invariant(typeof block.kind === "string", "section block kind is missing");

  switch (block.kind) {
    case "cover":
      invariant(
        [block.client_name, block.draft_notice, block.generated_at_label, block.jurisdiction,
          block.lifecycle_status, block.location, block.packet_status, block.permit_identifier,
          block.project_name, block.title].every((value) => typeof value === "string") &&
          Number.isInteger(block.packet_version),
        "cover block is malformed",
      );
      return;
    case "executive_summary":
      invariant(
        typeof block.summary === "string" && isStringArray(block.key_risks) &&
          isStringArray(block.key_strengths) && Array.isArray(block.decision_lines) &&
          block.decision_lines.every(
            (item) => typeof item?.label === "string" && typeof item.value === "string",
          ),
        "executive summary block is malformed",
      );
      return;
    case "case_snapshot":
      invariant(
        [block.investigation_state, block.packet_readiness, block.record_updated_at,
          block.resolution_notice, block.workflow_status].every((value) => typeof value === "string") &&
          Array.isArray(block.facts) && block.facts.every(
            (item) => typeof item?.id === "string" && typeof item.label === "string" &&
              typeof item.value === "string" && typeof item.information_class === "string",
          ),
        "case snapshot block is malformed",
      );
      return;
    case "editorial_list":
      invariant(
        typeof block.empty_message === "string" && typeof block.item_label === "string" &&
          Array.isArray(block.items) && block.items.every(
            (item) => typeof item?.id === "string" && typeof item.text === "string" &&
              isStringArray(item.citation_references),
          ),
        "editorial block is malformed",
      );
      return;
    case "dependency_map":
      invariant(
        typeof block.empty_message === "string" && Array.isArray(block.items) &&
          block.items.every(
            (item) => [item?.id, item.discipline, item.blocking_issue, item.dependent_review,
              item.recommended_next_step].every((value) => typeof value === "string") &&
              isStringArray(item.citation_references),
          ),
        "dependency map block is malformed",
      );
      return;
    case "action_kit": {
      invariant(typeof block.empty_message === "string", "Action Kit empty message is malformed");
      if (!block.kit) return;
      const kit = block.kit;
      invariant(
        [kit.current_position, kit.confirmed_record, kit.unconfirmed_record, kit.primary_blocker,
          kit.why_appropriate, kit.evidence_readiness, kit.review_readiness, kit.email_subject,
          kit.recipient_role, kit.message_body, kit.escalation_trigger].every(
          (value) => typeof value === "string",
        ) && isStringArray(kit.call_checklist) && isStringArray(kit.requested_confirmations) &&
          isStringArray(kit.documents_ready) && isStringArray(kit.citation_references) &&
          (kit.follow_up_date === null || typeof kit.follow_up_date === "string"),
        "Action Kit block is malformed",
      );
      return;
    }
    case "timeline":
      invariant(
        typeof block.empty_message === "string" && Array.isArray(block.items) &&
          block.items.every(
            (item) => [item?.id, item.occurred_on, item.occurred_on_label, item.timeline_type_label,
              item.title, item.details, item.source_label, item.review_label].every(
              (value) => typeof value === "string",
            ) && Array.isArray(item.linked_evidence) && item.linked_evidence.every(
              (source) => [source?.source_id, source.title, source.verification_label].every(
                (value) => typeof value === "string",
              ),
            ),
          ),
        "timeline block is malformed",
      );
      return;
    case "evidence":
      invariant(
        typeof block.empty_message === "string" && Array.isArray(block.items) &&
          block.items.every(
            (item) => [item?.id, item.reference, item.title, item.summary, item.evidence_type_label,
              item.verification_label, item.verification_note].every(
              (value) => typeof value === "string",
            ) && isStringArray(item.missing_details) &&
              (item.source_href === null || typeof item.source_href === "string") &&
              typeof item.source === "object" && item.source !== null,
          ),
        "evidence block is malformed",
      );
      return;
    case "sources":
      invariant(
        typeof block.empty_message === "string" && Array.isArray(block.items) &&
          block.items.every(
            (item) => [item?.id, item.title, item.label_display, item.date_display,
              item.verification_label].every((value) => typeof value === "string") &&
              (item.source_href === null || typeof item.source_href === "string"),
          ),
        "sources block is malformed",
      );
      return;
    case "readiness": {
      const dashboard = block.dashboard;
      invariant(
        [block.conclusion, block.disclaimer, block.methodology].every(
          (value) => typeof value === "string",
        ) && isStringArray(block.warnings) && Array.isArray(block.metadata) &&
          block.metadata.every(
            (item) => typeof item?.label === "string" && typeof item.value === "string",
          ) && typeof dashboard === "object" && dashboard !== null &&
          [dashboard.integrity, dashboard.lifecycle_status, dashboard.permit_status,
            dashboard.reviewer_status].every((value) => typeof value === "string") &&
          [dashboard.mission_health, dashboard.readiness].every(
            (metric) => typeof metric?.label === "string" &&
              typeof metric.explanation === "string" && Number.isFinite(metric.score) &&
              Number.isFinite(metric.completed) && Number.isFinite(metric.total),
          ) && Array.isArray(dashboard.blockers) && dashboard.blockers.every(
            (item) => [item?.id, item.title, item.resolution].every(
              (value) => typeof value === "string",
            ),
          ) && typeof dashboard.recommended_action?.title === "string" &&
          typeof dashboard.recommended_action.detail === "string" &&
          typeof dashboard.evidence?.text === "string" && Array.isArray(dashboard.factors) &&
          dashboard.factors.every(
            (item) => typeof item?.id === "string" && typeof item.label === "string" &&
              typeof item.detail === "string" && typeof item.passed === "boolean",
          ),
        "readiness block is malformed",
      );
      return;
    }
    case "disclosure":
      invariant(
        block.applies === true && typeof block.text === "string" && block.text.trim().length > 0,
        "disclosure block must describe an applicable demonstration",
      );
  }
}

function assertPacketSectionDefinitions(): void {
  const ids = packetSectionDefinitions.map(({ id }) => id);
  invariant(new Set(ids).size === ids.length, "packet section definitions contain a duplicate ID");
  invariant(
    ids.join("|") === packetSectionOrder.join("|"),
    "packet section order differs from its definitions",
  );
}

export function assertCanonicalPacketPresentation(
  presentation: CanonicalPacketPresentation,
): void {
  assertPacketSectionDefinitions();
  invariant(
    presentation.presentation_version === packetPresentationVersion,
    `presentation version must be ${packetPresentationVersion}`,
  );
  invariant(typeof presentation.title === "string", "presentation title is malformed");
  invariant(typeof presentation.footer === "string", "presentation footer is malformed");
  invariant(typeof presentation.generated_at === "string", "generation date is malformed");
  invariant(Number.isInteger(presentation.packet_version), "packet version is malformed");
  invariant(Array.isArray(presentation.sections), "sections must be an array");

  const ids = presentation.sections.map(({ id }) => id);
  invariant(new Set(ids).size === ids.length, "presentation contains a duplicate section ID");
  const expectedIds = ids.includes("fictional_demonstration_disclosure")
    ? packetSectionOrder
    : requiredPacketSectionOrder;
  invariant(
    ids.join("|") === expectedIds.join("|"),
    "presentation contains a missing, unknown, or out-of-order section",
  );

  presentation.sections.forEach((section, index) => {
    const definition = packetSectionDefinitions.find(({ id }) => id === section.id);
    invariant(Boolean(definition), `unknown section ID ${String(section.id)}`);
    invariant(section.title === definition?.title, `section ${section.id} has a stale title`);
    invariant(section.intro === definition?.intro, `section ${section.id} has a stale introduction`);
    invariant(section.number === String(index + 1).padStart(2, "0"), `section ${section.id} has a numbering gap`);
    invariant(section.blocks.length === 1, `section ${section.id} must have exactly one block`);
    const block = section.blocks[0];
    invariant(Boolean(block), `section ${section.id} is unreachable`);
    invariant(
      block?.kind === definition?.block_kind,
      `section ${section.id} has unsupported block kind ${String(block?.kind)}`,
    );
    assertPacketBlock(block);
  });
}

export function packetSectionTitle(section: PacketSectionId): string {
  const definition = packetSectionDefinitions.find(({ id }) => id === section);

  if (!definition) {
    throw new Error(`Unknown packet section: ${section}`);
  }

  return definition.title;
}

export function packetSectionNumber(
  section: PacketSectionId,
  order: readonly PacketSectionId[] = packetSectionOrder,
): string {
  const index = order.indexOf(section);

  if (index < 0) {
    throw new Error(`Unknown packet section number: ${section}`);
  }

  return String(index + 1).padStart(2, "0");
}

export function safePacketHref(value: string | null): string | null {
  if (!value) return null;

  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:"
      ? url.toString()
      : null;
  } catch {
    return null;
  }
}

function editorialItems(
  items: readonly {
    citation_references?: readonly string[];
    id: string;
    text: string;
  }[],
): PacketPresentationEditorialItem[] {
  return items.map((item) => ({
    citation_references: [...(item.citation_references ?? [])],
    id: item.id,
    text: item.text,
  }));
}

function executiveDecisionLines(model: PacketPresentationModel) {
  const kit = model.action_kit;
  if (!kit) return [];

  return [
    { label: "Record confirms", value: kit.confirmed_record },
    { label: "Record does not confirm", value: kit.unconfirmed_record },
    { label: "Primary unresolved issue", value: kit.primary_blocker },
    { label: "Why this next step", value: kit.why_appropriate },
    { label: "Packet evidence readiness", value: kit.evidence_readiness },
    { label: "Jurisdiction position", value: kit.review_readiness },
  ];
}

function readinessConclusion(
  model: PacketPresentationModel,
  dashboard: PacketDashboard,
): string {
  const complete = dashboard.readiness.completed === dashboard.readiness.total;
  const unresolvedAgencyQuestions =
    model.open_questions.items.length > 0 ||
    (model.agency_dependencies?.length ?? 0) > 0 ||
    model.executive_summary.key_risks.length > 0;

  if (complete && unresolvedAgencyQuestions) {
    return "This packet is complete. The permit case still contains unresolved agency questions.";
  }

  if (complete) {
    return "This packet is complete and professionally deliverable. Jurisdiction resolution remains a separate agency determination.";
  }

  if (unresolvedAgencyQuestions) {
    return "This packet is not yet complete for professional delivery. The permit case still contains unresolved agency questions.";
  }

  return "This packet is not yet complete for professional delivery. Packet readiness does not establish jurisdiction resolution.";
}

function sectionBlocks(
  id: PacketSectionId,
  model: PacketPresentationModel,
  dashboard: PacketDashboard,
): PacketPresentationBlock[] {
  switch (id) {
    case "cover":
      return [{
        kind: "cover",
        client_name: model.case_summary.client_name,
        draft_notice: model.draft_notice,
        generated_at_label: model.generated_at_label,
        jurisdiction: model.jurisdiction,
        lifecycle_status: dashboard.lifecycle_status,
        location: [model.case_summary.address, model.case_summary.city]
          .filter(Boolean)
          .join(", "),
        packet_status: model.document_status_label,
        packet_version: model.packet_version,
        permit_identifier: model.permit_number?.trim() || "Pending record entry",
        project_name: model.case_summary.project_name,
        title: model.title,
      }];
    case "executive_summary":
      return [{
        kind: "executive_summary",
        decision_lines: executiveDecisionLines(model),
        key_risks: [...model.executive_summary.key_risks],
        key_strengths: [...model.executive_summary.key_strengths],
        summary: model.action_kit?.current_position ?? model.executive_summary.text,
      }];
    case "case_snapshot":
      return [{
        kind: "case_snapshot",
        facts: model.case_overview,
        investigation_state: dashboard.permit_status,
        packet_readiness: `${dashboard.readiness.completed} of ${dashboard.readiness.total} checks complete`,
        record_updated_at: model.case_summary.updated_at_label,
        resolution_notice:
          "Jurisdiction resolution is not established by Packet Readiness.",
        workflow_status: model.current_status.label,
      }];
    case "findings":
      return [{
        kind: "editorial_list",
        empty_message: model.findings.empty_message,
        item_label: "Finding",
        items: editorialItems(model.findings.items),
      }];
    case "agency_dependency_map":
      return [{
        kind: "dependency_map",
        empty_message:
          "No evidence-grounded agency dependencies are included in this packet edition.",
        items: [...(model.agency_dependencies ?? [])],
      }];
    case "open_questions":
      return [{
        kind: "editorial_list",
        empty_message: model.open_questions.empty_message,
        item_label: "Question",
        items: editorialItems(model.open_questions.items),
      }];
    case "recommended_next_actions":
      return [{
        kind: "editorial_list",
        empty_message: model.recommended_next_actions.empty_message,
        item_label: "Action",
        items: editorialItems(model.recommended_next_actions.items),
      }];
    case "agency_follow_up_kit":
      return [{
        kind: "action_kit",
        empty_message:
          "No reviewer-approved findings support an Agency Follow-Up Kit for this edition.",
        kit: model.action_kit,
      }];
    case "timeline":
      return [{
        kind: "timeline",
        empty_message:
          "Permit history not yet assembled. No timeline events are included in this packet.",
        items: packetTimelineChronology(model).map((item) => ({
          ...item,
          review_label: packetTimelineReviewLabel(item),
        })),
      }];
    case "supporting_evidence":
      return [{
        kind: "evidence",
        empty_message:
          "Supporting evidence is not yet assembled. No evidence records are included in this packet.",
        items: model.evidence_summaries.map((item) => ({
          ...item,
          missing_details: packetEvidenceMissingDetails(item),
          source_href: safePacketHref(item.source.url),
        })),
      }];
    case "supporting_sources":
      return [{
        kind: "sources",
        empty_message:
          "Source log is empty. No supporting sources are included in this packet edition.",
        items: model.supporting_sources.map((item) => ({
          ...item,
          date_display:
            item.date_label === "Not provided" ? "Source date pending" : item.date_label,
          label_display:
            item.label === "Source label not provided" ? "Source label pending" : item.label,
          source_href: safePacketHref(item.url),
        })),
      }];
    case "methodology_readiness":
      return [{
        kind: "readiness",
        conclusion: readinessConclusion(model, dashboard),
        dashboard,
        disclaimer: model.disclaimer,
        methodology:
          "Investigation Health measures the condition of the underlying investigation. Packet Readiness means the packet is complete and professionally deliverable. It does not mean the jurisdiction has resolved the permit.",
        metadata: [
          { label: "Packet version", value: String(model.packet_version) },
          { label: "Generation date", value: model.generated_at_label },
          { label: "Lifecycle status", value: dashboard.lifecycle_status },
          { label: "Reviewer status", value: dashboard.reviewer_status },
          {
            label: "Packet integrity / version",
            value: `${dashboard.integrity} · deterministic render`,
          },
        ],
        warnings: model.warnings.map((item) => item.text),
      }];
    case "fictional_demonstration_disclosure":
      return [{
        kind: "disclosure",
        applies: true,
        text: model.demonstration_notice ?? "",
      }];
  }
}

export function buildPacketPresentation(
  model: PacketPresentationModel,
): CanonicalPacketPresentation {
  const dashboard = packetDashboard(model);
  const definitions = packetSectionDefinitions.filter(
    ({ id }) =>
      id !== "fictional_demonstration_disclosure" ||
      Boolean(model.demonstration_notice?.trim()),
  );
  const emittedOrder = definitions.map(({ id }) => id);

  const presentation: CanonicalPacketPresentation = {
    footer: `${dashboard.integrity} · deterministic render`,
    generated_at: model.generated_at,
    packet_version: model.packet_version,
    presentation_version: packetPresentationVersion,
    sections: definitions.map((definition) => ({
      blocks: sectionBlocks(definition.id, model, dashboard),
      id: definition.id,
      intro: definition.intro,
      number: packetSectionNumber(definition.id, emittedOrder),
      title: definition.title,
    })),
    title: model.title,
  };

  assertCanonicalPacketPresentation(presentation);
  return presentation;
}

export function packetPresentationSectionIds(
  presentation: CanonicalPacketPresentation,
): PacketSectionId[] {
  return presentation.sections.map(({ id }) => id);
}

export function formatPacketDateTime(value: Date | string): {
  raw: string;
  label: string;
} {
  const date = value instanceof Date ? value : new Date(value);

  if (Number.isNaN(date.getTime())) {
    return { raw: "", label: "Date not available" };
  }

  return {
    raw: date.toISOString(),
    label: new Intl.DateTimeFormat("en-US", {
      dateStyle: "long",
      timeStyle: "short",
      timeZone: "UTC",
    }).format(date),
  };
}

export function formatPacketDateOnly(value: string | null): string {
  if (!value) {
    return "Not provided";
  }

  const date = new Date(`${value}T00:00:00.000Z`);

  if (Number.isNaN(date.getTime())) {
    return "Date not available";
  }

  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "long",
    timeZone: "UTC",
  }).format(date);
}

export function packetStatusLabel(
  status: PacketDocumentStatus,
): PacketPresentationModel["document_status_label"] {
  if (status === "approved") {
    return "APPROVED";
  }

  if (status === "delivered") {
    return "DELIVERED";
  }

  return "DRAFT";
}

export function packetStatusNotice(status: PacketDocumentStatus): string {
  if (status === "approved") {
    return "This packet is complete and professionally deliverable following reviewer quality checks. This does not indicate permit approval or jurisdiction resolution.";
  }

  if (status === "delivered") {
    return "Packet delivery is recorded. Jurisdiction disposition must be confirmed separately.";
  }

  return packetDraftNotice;
}

export function packetDocumentStatusForDeliveryState(
  state:
    | "draft"
    | "packet_generated"
    | "under_review"
    | "changes_required"
    | "approved_for_delivery"
    | "delivered"
    | "delivery_confirmed",
): PacketDocumentStatus {
  if (state === "delivered" || state === "delivery_confirmed") {
    return "delivered";
  }

  if (state === "approved_for_delivery") {
    return "approved";
  }

  return "draft";
}

export function withPacketDocumentStatus(
  model: PacketPresentationModel,
  status: PacketDocumentStatus,
): PacketPresentationModel {
  return {
    ...model,
    agency_dependencies: model.agency_dependencies ?? [],
    demonstration_notice: model.demonstration_notice ?? null,
    document_status: status,
    document_status_label: packetStatusLabel(status),
    draft_notice: packetStatusNotice(status),
  };
}

export function isPacketPresentationModel(
  value: unknown,
): value is PacketPresentationModel {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const candidate = value as Partial<PacketPresentationModel>;

  if (
    candidate.presentation_version !== packetPresentationVersion ||
    !Array.isArray(candidate.section_order) ||
    candidate.section_order.join("|") !== packetSectionOrder.join("|")
  ) {
    return false;
  }

  try {
    buildPacketPresentation(candidate as PacketPresentationModel);
    return true;
  } catch {
    return false;
  }
}

function collectPresentationStrings(value: unknown, output: string[]): void {
  if (typeof value === "string") {
    output.push(value);
    return;
  }

  if (Array.isArray(value)) {
    value.forEach((item) => collectPresentationStrings(item, output));
    return;
  }

  if (typeof value === "object" && value !== null) {
    Object.values(value).forEach((item) => collectPresentationStrings(item, output));
  }
}

export function packetPresentationVisibleText(
  presentation: CanonicalPacketPresentation,
): string[] {
  assertCanonicalPacketPresentation(presentation);
  const output: string[] = [];

  collectPresentationStrings(
    {
      footer: presentation.footer,
      sections: presentation.sections,
      title: presentation.title,
    },
    output,
  );
  return output;
}

export function packetVisibleText(model: PacketPresentationModel): string[] {
  return packetPresentationVisibleText(buildPacketPresentation(model));
}
