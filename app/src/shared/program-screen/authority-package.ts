import { z } from "zod";
import type { ReviewedAuthoritySource, ReviewedIssuingAuthority } from "./authority-policy";
import { overlayHazardClasses, type OverlayHazardClass } from "./evidence-authority";
import {
  datasetMetadataLine,
  excerptInRegulationSection,
  locateExcerptPages,
  mapLegendClasses,
  normalizeSourceText,
  officialSourceMetadataSchemaWith,
  OFFICIAL_SOURCE_METADATA_V2_VERSION,
  sha256Hex,
  sourceHostExceptions,
  type OfficialSourceMetadata,
  type SourceHostException,
} from "./source-capture";
import { fireHazardStatutoryRoutes, type ProgramFactKey } from "./types";

/**
 * Authority packages (Phase 3D, docs/PROGRAM_SCREEN_PHASE_3D_CALFIRE_SRA_PACKAGE.md).
 *
 * One narrowly scoped kind of package: a fire-hazard map whose authority rests
 * on three captured members, each with one role. The manifest states, for
 * every property the approved evidence model needs, which exact member (by
 * source ID and SHA-256) establishes it and the text that does. It is not a
 * general document framework: the roles, assertions, and checks are fixed
 * here, and a package that lacks a member, cites a changed member, or quotes
 * text its member does not contain fails closed.
 *
 * Like capture readiness (B6), packages are checked in tests over the shipped
 * registries. The evaluator never reads a manifest or a capture: a registered
 * source carries the manifest's values and its SHA-256.
 */

export const AUTHORITY_PACKAGE_VERSION = "program-screen-authority-package-v1" as const;
export const AUTHORITY_PACKAGE_DIR = "app/fixtures/program-screen/authority-packages/";

/** Each member's role, and the one capture type that can fill it. */
export const authorityPackageMemberRoles = {
  adopted_map: "agency_map",
  adopting_regulation: "regulation",
  overlay_dataset: "dataset_archive",
} as const;
export type AuthorityPackageMemberRole = keyof typeof authorityPackageMemberRoles;

const kebabId = z.string().max(120).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
const hex64 = z.string().regex(/^[0-9a-f]{64}$/);
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const shortText = z.string().trim().min(1).max(300);

/** One quotation: exact text on one page of one member's extracted text. */
const evidenceSchema = z
  .object({ source_id: kebabId, sha256_extracted: hex64, page: z.number().int().positive(), text: z.string().trim().min(1).max(2000) })
  .strict();
type Evidence = z.infer<typeof evidenceSchema>;

const assertion = <T extends z.ZodType>(value: T) =>
  z.object({ value, evidence: z.array(evidenceSchema).min(1).max(10) }).strict();

export const authorityPackageManifestSchema = z
  .object({
    schema_version: z.literal(AUTHORITY_PACKAGE_VERSION),
    package_id: kebabId,
    title: shortText,
    members: z
      .array(
        z
          .object({
            role: z.enum(Object.keys(authorityPackageMemberRoles) as [AuthorityPackageMemberRole, ...AuthorityPackageMemberRole[]]),
            source_id: kebabId,
            source_type: z.enum(["agency_map", "regulation", "dataset_archive"]),
            sha256_original: hex64,
            sha256_extracted: hex64,
          })
          .strict(),
      )
      .length(3),
    assertions: z
      .object({
        issuer_identity: assertion(z.object({ issuer_id: kebabId, name: shortText }).strict()),
        statutory_basis: assertion(z.enum(fireHazardStatutoryRoutes)),
        adopted_status: assertion(z.literal("adopted")),
        map_identity: assertion(z.object({ title: shortText }).strict()),
        map_date: assertion(z.object({ date: isoDate, date_kind: z.literal("dated") }).strict()),
        adoption_date: assertion(isoDate),
        effective_date: assertion(isoDate),
        legend_classes: assertion(z.array(z.enum(mapLegendClasses)).min(1).max(mapLegendClasses.length)),
        lot_overlay_dataset: assertion(
          z
            .object({
              dataset_name: z.string().regex(/^[A-Za-z0-9_-]{1,64}$/),
              class_field: z.string().min(1).max(11),
              class_labels: z.record(z.string().min(1).max(60), z.enum(overlayHazardClasses)),
              extent: z.object({ field: z.string().min(1).max(11), value: z.string().min(1).max(60) }).strict(),
              feature_count: z.number().int().positive(),
              crs_epsg: z.number().int().positive(),
            })
            .strict(),
        ),
        /** Land the map leaves unclassified (no feature) is never a negative result. */
        unclassified_areas: assertion(z.literal("no_feature_is_not_a_negative_result")),
      })
      .strict(),
    currency: z.literal("until_superseded"),
    /** Documents deliberately left out, and why (for example, an image-only scan). */
    excluded_documents: z.array(z.object({ title: shortText, url: z.string().url(), reason: z.string().trim().min(1).max(1000) }).strict()).max(10),
    notes: z.array(z.string().trim().min(1).max(1000)).max(20),
  })
  .strict();

export type AuthorityPackageManifest = z.infer<typeof authorityPackageManifestSchema>;

export interface PackageCapture {
  metadata: OfficialSourceMetadata;
  extracted: string;
}

const MONTHS = [
  "January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December",
];

/** An ISO date as the sources print it: "September 29, 2023". */
export function printedDate(iso: string): string {
  const [year, month, day] = iso.split("-").map(Number);
  return `${MONTHS[month - 1]} ${day}, ${year}`;
}

/** The label a map legend or dataset prints for a class: very_high is "Very High". */
function classLabel(cls: OverlayHazardClass): string {
  return cls
    .split("_")
    .map((word) => `${word[0].toUpperCase()}${word.slice(1)}`)
    .join(" ");
}

function includesText(haystack: string, needle: string): boolean {
  return normalizeSourceText(haystack).includes(normalizeSourceText(needle));
}

/**
 * Every reason a manifest cannot back a registration. Empty means every
 * member is present, official, unchanged, and of its role's type, and every
 * assertion is quoted from the member that must establish it. `captures`
 * holds each member's parsed metadata and extracted text by source ID.
 */
export async function authorityPackageIssues(
  value: unknown,
  captures: ReadonlyMap<string, PackageCapture>,
  exceptions: readonly SourceHostException[] = sourceHostExceptions,
): Promise<string[]> {
  const parsed = authorityPackageManifestSchema.safeParse(value);
  if (!parsed.success) return parsed.error.issues.map((issue) => `manifest ${issue.path.join(".") || "(root)"}: ${issue.message}`);
  const manifest = parsed.data;
  const issues: string[] = [];
  const schema = officialSourceMetadataSchemaWith(exceptions);

  /* members */
  const byRole = new Map<AuthorityPackageMemberRole, PackageCapture>();
  const memberIds = new Map<string, AuthorityPackageMemberRole>();
  for (const member of manifest.members) {
    const where = `member ${member.role}`;
    if (byRole.has(member.role) || memberIds.has(member.source_id)) {
      issues.push(`${where}: each role and capture appears once.`);
      continue;
    }
    memberIds.set(member.source_id, member.role);
    if (member.source_type !== authorityPackageMemberRoles[member.role]) {
      issues.push(`${where}: a ${member.role} is a ${authorityPackageMemberRoles[member.role]} capture, not a ${member.source_type}.`);
    }
    const capture = captures.get(member.source_id);
    if (capture === undefined) {
      issues.push(`${where}: capture ${member.source_id} is missing.`);
      continue;
    }
    const { metadata, extracted } = capture;
    if (!schema.safeParse(metadata).success) issues.push(`${where}: the capture metadata is not valid.`);
    if (metadata.schema_version !== OFFICIAL_SOURCE_METADATA_V2_VERSION || metadata.source_type !== authorityPackageMemberRoles[member.role]) {
      issues.push(`${where}: ${member.source_id} is a ${metadata.source_type} capture, not a ${authorityPackageMemberRoles[member.role]}.`);
      continue;
    }
    if (metadata.test_only) issues.push(`${where}: a test-only capture can never be a package member.`);
    if (metadata.sha256_original !== member.sha256_original || metadata.sha256_extracted !== member.sha256_extracted) {
      issues.push(`${where}: the manifest does not pin ${member.source_id} as captured.`);
    }
    if ((await sha256Hex(extracted)) !== metadata.sha256_extracted) issues.push(`${where}: the extracted text does not match its pin.`);
    // A map or data archive that establishes a status must be recorded as
    // operative; the regulation's text is relied on only for what it prints.
    const allowed = member.role === "adopting_regulation" ? ["operative", "status_unconfirmed"] : ["operative"];
    if (!allowed.includes(metadata.operative_status)) {
      issues.push(`${where}: a ${member.role} recorded as ${metadata.operative_status} can never back a package.`);
    }
    byRole.set(member.role, capture);
  }
  const map = byRole.get("adopted_map");
  const regulation = byRole.get("adopting_regulation");
  const dataset = byRole.get("overlay_dataset");
  if (map === undefined || regulation === undefined || dataset === undefined) {
    return [...issues, "The package lacks a member; it fails closed."];
  }
  const mapContext = map.metadata.schema_version === OFFICIAL_SOURCE_METADATA_V2_VERSION ? map.metadata.agency_map : null;
  const regulationContext = regulation.metadata.schema_version === OFFICIAL_SOURCE_METADATA_V2_VERSION ? (regulation.metadata.regulation ?? null) : null;
  const datasetContext = dataset.metadata.schema_version === OFFICIAL_SOURCE_METADATA_V2_VERSION ? (dataset.metadata.dataset_archive ?? null) : null;
  if (mapContext === null || regulationContext === null || datasetContext === null) return [...issues, "A member has no context block."];

  /* every quotation: the right member, its pin, its page, and (for the regulation) its section */
  const roleOf = (evidence: Evidence) => memberIds.get(evidence.source_id);
  const nonAuthoritative = datasetContext.non_authoritative.flatMap((field) => {
    const line = datasetMetadataLine(dataset.extracted, field.path);
    return line === null ? [] : [{ path: field.path, line }];
  });
  for (const [name, entry] of Object.entries(manifest.assertions)) {
    for (const evidence of entry.evidence) {
      const where = `${name}: "${evidence.text.slice(0, 60)}"`;
      const role = roleOf(evidence);
      const capture = role === undefined ? undefined : byRole.get(role);
      if (role === undefined || capture === undefined) {
        issues.push(`${where} cites ${evidence.source_id}, which is not a package member.`);
        continue;
      }
      if (evidence.sha256_extracted !== capture.metadata.sha256_extracted) issues.push(`${where} cites a changed ${evidence.source_id}.`);
      if (!locateExcerptPages(evidence.text, capture.extracted).includes(evidence.page)) {
        issues.push(`${where} is not on page ${evidence.page} of ${evidence.source_id}.`);
      }
      if (role === "adopting_regulation" && !excerptInRegulationSection(evidence, capture.extracted, regulationContext)) {
        issues.push(`${where} is not inside section ${regulationContext.section} on page ${evidence.page}.`);
      }
      if (role === "overlay_dataset") {
        for (const field of nonAuthoritative) {
          if (includesText(field.line, evidence.text) || includesText(evidence.text, field.line)) {
            issues.push(`${where} quotes the non-authoritative field ${field.path}.`);
          }
        }
      }
    }
  }
  const quoted = (entry: { evidence: Evidence[] }, role: AuthorityPackageMemberRole, test: (text: string) => boolean) =>
    entry.evidence.some((evidence) => roleOf(evidence) === role && test(normalizeSourceText(evidence.text)));
  const a = manifest.assertions;

  /* issuer identity: the adopting regulation names the office within the Department */
  if (!quoted(a.issuer_identity, "adopting_regulation", (text) => text.includes("Office of the State Fire Marshal") && text.includes("Department of Forestry and Fire Protection"))) {
    issues.push("issuer_identity: the regulation's section text must name the Office of the State Fire Marshal of the Department of Forestry and Fire Protection.");
  }

  /* statutory basis: the section's own authority note */
  const section = a.statutory_basis.value === "prc_4202" ? "4202" : null;
  if (section === null || !quoted(a.statutory_basis, "adopting_regulation", (text) => new RegExp(`Authority cited: Sections? [^.]*\\b${section}\\b[^.]*Public Resources Code`).test(text))) {
    issues.push("statutory_basis: the section's authority note must cite Public Resources Code section 4202.");
  }

  /* map identity and date: the regulation incorporates a map by title and date, and the map prints both */
  const title = a.map_identity.value.title;
  if (!quoted(a.map_identity, "adopting_regulation", (text) => text.includes(title) && text.includes("incorporated by reference")) || !quoted(a.map_identity, "adopted_map", (text) => text.includes(title))) {
    issues.push("map_identity: the regulation must incorporate the map by its title, and the map must print it.");
  }
  const mapDate = printedDate(a.map_date.value.date);
  if (!quoted(a.map_date, "adopting_regulation", (text) => text.includes(`dated ${mapDate}`)) || !quoted(a.map_date, "adopted_map", (text) => text.includes(mapDate))) {
    issues.push("map_date: the regulation must give the map's date and the map must print it.");
  }
  if (mapContext.edition.date !== a.map_date.value.date || mapContext.edition.date_kind !== a.map_date.value.date_kind) {
    issues.push("map_date: the map capture's edition date and kind differ.");
  }
  if (mapContext.supersession.statement === "stated_superseded") issues.push("adopted_map: the map states it is superseded.");

  /* adoption and effect: the overlay dataset's own statement, tied to this map's date */
  if (!quoted(a.adopted_status, "overlay_dataset", (text) => /\badopted\b/.test(text) && text.includes(mapDate))) {
    issues.push("adopted_status: an operative member must state that the map of this date is adopted.");
  }
  if (!quoted(a.adoption_date, "overlay_dataset", (text) => text.includes(`adopted on ${printedDate(a.adoption_date.value)}`))) {
    issues.push("adoption_date: the evidence must state the adoption date.");
  }
  if (!quoted(a.effective_date, "overlay_dataset", (text) => /\beffective\b/i.test(text) && text.includes(printedDate(a.effective_date.value)))) {
    issues.push("effective_date: the evidence must state the effective date.");
  }
  if (a.effective_date.value < a.adoption_date.value || a.adoption_date.value < a.map_date.value.date) {
    issues.push("The map date, adoption date, and effective date are out of order.");
  }

  /* legend classes: the map's own legend, each class by its printed label */
  const mapClasses = new Set([...(mapContext.legend?.classes ?? []), ...mapContext.responsibility_areas.flatMap((area) => area.legend_classes)]);
  const legend = a.legend_classes.value;
  if (legend.length !== mapClasses.size || !legend.every((cls) => mapClasses.has(cls))) {
    issues.push("legend_classes: the classes differ from the map capture's legend.");
  }
  for (const cls of legend) {
    if (!quoted(a.legend_classes, "adopted_map", (text) => text.startsWith(`${classLabel(cls)} `))) {
      issues.push(`legend_classes: no quotation from the map begins with the ${classLabel(cls)} legend entry.`);
    }
  }

  /* the overlay dataset: the map names it, the dataset names the map's date, and its labels define the legend's classes */
  const overlay = a.lot_overlay_dataset.value;
  const labels = Object.entries(overlay.class_labels);
  const datasetLabels = datasetContext.class_field.values.map((entry) => entry.label);
  if (
    overlay.dataset_name !== datasetContext.dataset_name ||
    overlay.class_field !== datasetContext.class_field.field ||
    overlay.feature_count !== datasetContext.geometry.feature_count ||
    overlay.crs_epsg !== datasetContext.crs.epsg ||
    overlay.extent.field !== datasetContext.extent_field.field ||
    overlay.extent.value !== datasetContext.extent_field.values[0].label
  ) {
    issues.push("lot_overlay_dataset: the values differ from the dataset capture.");
  }
  if (labels.length !== datasetLabels.length || !labels.every(([label, cls]) => datasetLabels.includes(label) && classLabel(cls) === label)) {
    issues.push("lot_overlay_dataset: every dataset label maps to the class of the same name, and nothing else.");
  }
  if (new Set(labels.map(([, cls]) => cls)).size !== legend.length || !labels.every(([, cls]) => (legend as readonly string[]).includes(cls))) {
    issues.push("lot_overlay_dataset: the dataset's classes differ from the map legend's.");
  }
  if (!quoted(a.lot_overlay_dataset, "adopted_map", (text) => text.includes(`(${overlay.dataset_name})`))) {
    issues.push("lot_overlay_dataset: the map must name the dataset as its data source.");
  }
  if (!quoted(a.lot_overlay_dataset, "overlay_dataset", (text) => text.includes(`map dated ${mapDate}`))) {
    issues.push("lot_overlay_dataset: the dataset must name the map of this date.");
  }
  if (!quoted(a.lot_overlay_dataset, "overlay_dataset", (text) => text.startsWith(`values ${overlay.class_field}: `))) {
    issues.push("lot_overlay_dataset: the evidence must quote the class field's values.");
  }

  /* land with no feature: the map shows it as unclassified, and every feature lies in the mapped extent */
  if (!quoted(a.unclassified_areas, "adopted_map", (text) => text.includes("(non-SRA)"))) {
    issues.push("unclassified_areas: the map's legend must show the land it leaves unclassified.");
  }
  if (!quoted(a.unclassified_areas, "overlay_dataset", (text) => text.startsWith(`values ${overlay.extent.field}: `))) {
    issues.push("unclassified_areas: the evidence must quote the dataset's extent field.");
  }
  return issues;
}

/** The legend class each hazard fact needs from a package. */
const packageFactClasses: Readonly<Partial<Record<ProgramFactKey, OverlayHazardClass>>> = {
  "very-high-fire-hazard-severity-zone": "very_high",
  "high-fire-hazard-severity-zone": "high",
};

/**
 * Every way a registered source and its issuer differ from the manifest they
 * pin. Empty means the registry carries exactly the package's values.
 */
export function authorityPackageRegistrationIssues(
  source: ReviewedAuthoritySource,
  issuer: ReviewedIssuingAuthority | undefined,
  manifest: AuthorityPackageManifest,
  manifestSha256: string,
): string[] {
  const issues: string[] = [];
  const pack = source.package;
  if (pack === undefined) return ["The registered source carries no authority package."];
  if (pack.statutory_basis !== "prc_4202")
    return ["An identification package cannot masquerade as an adopted PRC 4202 package."];
  const member = (role: AuthorityPackageMemberRole) => manifest.members.find((candidate) => candidate.role === role);
  const same = (ref: { source_id: string; sha256_extracted: string }, role: AuthorityPackageMemberRole) =>
    ref.source_id === member(role)?.source_id && ref.sha256_extracted === member(role)?.sha256_extracted;
  const a = manifest.assertions;
  if (source.authority_source_id !== manifest.package_id) issues.push("The source ID is not the package ID.");
  if (pack.manifest_sha256 !== manifestSha256) issues.push("The registry does not pin this manifest.");
  if (source.record_kind !== "agency_hazard_map") issues.push("A package backs only an agency hazard map source.");
  if (!same(source.capture, "adopted_map") || !same(pack.members.adopted_map, "adopted_map")) issues.push("The adopted map pin differs.");
  if (!same(pack.members.adopting_regulation, "adopting_regulation")) issues.push("The regulation pin differs.");
  if (!same(pack.members.overlay_dataset, "overlay_dataset")) issues.push("The overlay dataset pin differs.");
  if (pack.statutory_basis !== a.statutory_basis.value) issues.push("The statutory basis differs.");
  if (
    pack.adoption.status !== a.adopted_status.value ||
    pack.adoption.adoption_date !== a.adoption_date.value ||
    pack.adoption.effective_date !== a.effective_date.value
  ) {
    issues.push("The adoption record differs.");
  }
  if (pack.currency !== manifest.currency) issues.push("The currency rule differs.");
  if (source.edition.date !== a.map_date.value.date || source.edition.date_kind !== a.map_date.value.date_kind) issues.push("The edition date differs.");
  if (!source.edition.label.includes(a.map_identity.value.title) || !source.title.includes(a.map_identity.value.title)) {
    issues.push("The source does not carry the map's title.");
  }
  const overlay = a.lot_overlay_dataset.value;
  if (
    pack.overlay.dataset_name !== overlay.dataset_name ||
    pack.overlay.class_field !== overlay.class_field ||
    JSON.stringify(Object.entries(pack.overlay.class_labels).sort()) !== JSON.stringify(Object.entries(overlay.class_labels).sort())
  ) {
    issues.push("The overlay dataset's labels differ.");
  }
  for (const key of source.fact_keys) {
    const cls = packageFactClasses[key];
    if (cls === undefined || !(a.legend_classes.value as readonly string[]).includes(cls)) issues.push(`The package defines no class for ${key}.`);
  }
  if (source.issuer_id !== a.issuer_identity.value.issuer_id) issues.push("The issuer differs.");
  if (issuer === undefined || issuer.issuer_id !== source.issuer_id) {
    issues.push("The issuer is not registered.");
  } else if (!same(issuer.basis_capture, "adopting_regulation")) {
    issues.push("The issuer's basis capture is not the package's regulation.");
  }
  return issues;
}
