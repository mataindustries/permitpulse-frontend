import { z } from "zod";
import type { PackageCapture } from "./authority-package";
import type { ReviewedAuthoritySource, ReviewedIssuingAuthority } from "./authority-policy";
import { LRA_LAYER, LRA_METADATA_SHA256 } from "./filegdb-capture";
import {
  locateExcerptPages,
  normalizeSourceText,
  officialSourceMetadataSchema,
  sha256Hex,
  datasetMetadataLine,
} from "./source-capture";

export const LRA_PACKAGE_ID = "calfire-lra-fhsz-2025-03-24-v1";
export const LRA_DATASET_ID = "calfire-fhszlra-25-1-all-data";
export const LRA_ARCHIVE_SHA256 = "736fa5231c70b844550784cd13c8d414c239cf9573c9cae6139554ef0bf464b6";
const digest = z.string().regex(/^[0-9a-f]{64}$/);
const evidence = z
  .object({
    source_id: z.string(),
    sha256_extracted: digest,
    page: z.number().int().positive(),
    text: z.string().min(1).max(2000),
  })
  .strict();
const assertion = <T extends z.ZodType>(value: T) =>
  z.object({ value, evidence: z.array(evidence).min(1).max(10) }).strict();
export const lraPackageManifestSchema = z
  .object({
    schema_version: z.literal("program-screen-gov-51178-package-v1"),
    package_id: z.literal(LRA_PACKAGE_ID),
    title: z.string().min(1),
    statutory_basis: z.literal("gov_51178"),
    status: z.literal("state_identification_recommendation"),
    currency: z.literal("until_superseded"),
    members: z
      .array(
        z
          .object({
            role: z.enum(["identification_statute", "local_designation_statute", "overlay_dataset"]),
            source_id: z.string(),
            source_type: z.enum(["statute", "dataset_archive"]),
            sha256_original: digest,
            sha256_extracted: digest,
          })
          .strict(),
      )
      .length(3),
    assertions: z
      .object({
        issuer_identity: assertion(z.literal("calfire-osfm")),
        statutory_basis: assertion(z.literal("gov_51178")),
        map_identity: assertion(z.string().min(1)),
        map_date: assertion(z.literal("2025-03-24")),
        state_identification_recommendation: assertion(z.literal(true)),
        local_adoption_is_separate: assertion(z.literal(true)),
      })
      .strict(),
    active_metadata: z
      .object({
        fid: z.literal(3),
        layer: z.literal(LRA_LAYER),
        xml_sha256: z.literal(LRA_METADATA_SHA256),
        definition_sha256: digest,
      })
      .strict(),
    overlay: z
      .object({
        dataset_name: z.literal(LRA_LAYER),
        class_field: z.literal("FHSZ_Description"),
        crs_epsg: z.literal(3310),
        feature_count: z.literal(9752),
        class_labels: z
          .object({
            "Very High": z.literal("very_high"),
            High: z.literal("high"),
            Moderate: z.literal("moderate"),
            NonWildland: z.literal("non_wildland"),
          })
          .strict(),
      })
      .strict(),
    non_authoritative: z.array(z.string()).min(4),
    notes: z.array(z.string()).min(1),
  })
  .strict();
export type LraAuthorityManifest = z.infer<typeof lraPackageManifestSchema>;

/** The three captured members prove one fixed identification package. City
 * adoption and the raster inputs are not operative members. */
export async function lraAuthorityPackageIssues(
  value: unknown,
  captures: ReadonlyMap<string, PackageCapture>,
): Promise<string[]> {
  const parsed = lraPackageManifestSchema.safeParse(value);
  if (!parsed.success) return parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`);
  const m = parsed.data,
    issues: string[] = [];
  const byRole = new Map<string, PackageCapture>(),
    roleById = new Map<string, string>();
  for (const member of m.members) {
    const type = member.role === "overlay_dataset" ? "dataset_archive" : "statute";
    if (byRole.has(member.role) || roleById.has(member.source_id)) issues.push("Duplicate package role/member.");
    roleById.set(member.source_id, member.role);
    const c = captures.get(member.source_id);
    if (!c) {
      issues.push(`Missing member ${member.role}.`);
      continue;
    }
    if (
      !officialSourceMetadataSchema.safeParse(c.metadata).success ||
      c.metadata.test_only ||
      c.metadata.source_type !== type ||
      member.source_type !== type ||
      c.metadata.operative_status !== "operative"
    )
      issues.push(`Invalid member ${member.role}.`);
    if (
      c.metadata.sha256_original !== member.sha256_original ||
      c.metadata.sha256_extracted !== member.sha256_extracted ||
      (await sha256Hex(c.extracted)) !== member.sha256_extracted
    )
      issues.push(`Changed member ${member.role}.`);
    byRole.set(member.role, c);
  }
  const stat = byRole.get("identification_statute"),
    local = byRole.get("local_designation_statute"),
    data = byRole.get("overlay_dataset");
  if (!stat || !local || !data) return [...issues, "Package lacks a required member."];
  for (const [capture, section] of [
    [stat, "51178"],
    [local, "51179"],
  ] as const) {
    if (
      capture.metadata.schema_version !== "program-screen-official-source-v2" ||
      capture.metadata.statute?.code !== "GOV" ||
      capture.metadata.statute.section !== section
    )
      issues.push(`Wrong statutory member ${section}.`);
  }
  if (data.metadata.schema_version !== "program-screen-official-source-v2")
    return [...issues, "Dataset context missing."];
  const ctx = data.metadata.dataset_archive;
  if (
    !ctx?.file_geodatabase ||
    data.metadata.sha256_original !== LRA_ARCHIVE_SHA256 ||
    data.metadata.original.bytes !== 9840158 ||
    ctx.dataset_name !== LRA_LAYER ||
    ctx.file_geodatabase.metadata_sha256 !== m.active_metadata.xml_sha256 ||
    ctx.file_geodatabase.definition_sha256 !== m.active_metadata.definition_sha256 ||
    ctx.file_geodatabase.metadata_fid !== m.active_metadata.fid ||
    ctx.crs.epsg !== 3310 ||
    ctx.class_field.field !== m.overlay.class_field ||
    ctx.geometry.feature_count !== 9752
  )
    issues.push("Archive/active metadata/layer association differs.");
  if (
    JSON.stringify((ctx?.non_authoritative ?? []).map((f) => f.path).sort()) !==
    JSON.stringify([...m.non_authoritative].sort())
  )
    issues.push("Non-authoritative metadata declarations differ.");
  for (const [name, a] of Object.entries(m.assertions))
    for (const q of a.evidence) {
      const c = captures.get(q.source_id);
      if (
        !roleById.has(q.source_id) ||
        !c ||
        q.sha256_extracted !== c.metadata.sha256_extracted ||
        !locateExcerptPages(q.text, c.extracted).includes(q.page)
      )
        issues.push(`${name}: unpinned or absent evidence.`);
      if (c === data && m.non_authoritative.some((p) => normalizeSourceText(q.text).includes(p)))
        issues.push(`${name}: non-authoritative metadata used.`);
    }
  const quoted = (a: { evidence: z.infer<typeof evidence>[] }, role: string, accept: (s: string) => boolean) =>
    a.evidence.some((q) => roleById.get(q.source_id) === role && accept(normalizeSourceText(q.text)));
  const a = m.assertions;
  if (!quoted(a.issuer_identity, "overlay_dataset", (s) => s.includes("Fire Hazard Severity Zone Team, CAL FIRE")))
    issues.push("Issuer must be named by active dataset metadata.");
  if (
    !quoted(a.statutory_basis, "identification_statute", (s) =>
      s.includes("The State Fire Marshal shall identify areas in the state"),
    ) ||
    !quoted(a.statutory_basis, "local_designation_statute", (s) =>
      s.includes("recommendations from the State Fire Marshal pursuant to Section 51178"),
    ) ||
    !quoted(
      a.statutory_basis,
      "overlay_dataset",
      (s) => s.includes("California Government Code 51175-51189") && s.includes("these data are developed"),
    )
  )
    issues.push("Statutory identification/recommendation link is incomplete.");
  if (
    !quoted(
      a.state_identification_recommendation,
      "overlay_dataset",
      (s) =>
        s.includes("The State Fire Marshal shall classify lands within Local Responsibility Areas") &&
        s.includes("transmitted as a recommendation") &&
        s.includes("all 4 phases combined"),
    )
  )
    issues.push("Exact combined dataset must state the classification/recommendation relationship.");
  if (
    !quoted(
      a.map_identity,
      "overlay_dataset",
      (s) => s.includes(a.map_identity.value) && s.startsWith("/metadata/dataIdInfo/idCitation/resTitle:"),
    )
  )
    issues.push("Active map identity differs.");
  if (
    !quoted(
      a.map_date,
      "overlay_dataset",
      (s) => s.includes("map dated March 24, 2025") && s.startsWith("/metadata/dataIdInfo/idAbs:"),
    )
  )
    issues.push("Map date not established.");
  if (
    !quoted(
      a.local_adoption_is_separate,
      "local_designation_statute",
      (s) => s.includes("A local agency shall designate, by ordinance") && s.includes("receiving recommendations"),
    )
  )
    issues.push("Separate local designation not established.");
  for (const p of m.non_authoritative)
    if (datasetMetadataLine(data.extracted, p) === null)
      issues.push(`Missing retained non-authoritative metadata ${p}.`);
  return issues;
}
export function lraAuthorityRegistrationIssues(
  source: ReviewedAuthoritySource,
  issuer: ReviewedIssuingAuthority | undefined,
  m: LraAuthorityManifest,
  manifestSha: string,
): string[] {
  const pack = source.package;
  if (pack?.statutory_basis !== "gov_51178") return ["Wrong route/package variant."];
  const issues: string[] = [];
  const member = (role: string) => m.members.find((f) => f.role === role);
  if (
    source.authority_source_id !== m.package_id ||
    pack.manifest_sha256 !== manifestSha ||
    source.record_kind !== "agency_hazard_map" ||
    source.issuer_id !== "calfire-osfm" ||
    issuer?.issuer_id !== source.issuer_id
  )
    issues.push("Source identity/issuer/manifest differs.");
  for (const role of ["identification_statute", "local_designation_statute", "overlay_dataset"] as const) {
    const p = member(role),
      ref = pack.members[role];
    if (p?.source_id !== ref.source_id || p.sha256_extracted !== ref.sha256_extracted)
      issues.push(`Changed ${role} pin.`);
  }
  const data = member("overlay_dataset");
  if (source.capture.source_id !== data?.source_id || source.capture.sha256_extracted !== data?.sha256_extracted)
    issues.push("Source is not this vector capture.");
  if (
    source.edition.date !== m.assertions.map_date.value ||
    source.edition.date_kind !== "dated" ||
    !source.edition.label.includes("Combined Phases") ||
    !source.edition.label.includes("Version 1") ||
    !source.title.includes(m.assertions.map_identity.value)
  )
    issues.push("Source edition/title differs.");
  if (
    pack.identification.status !== m.status ||
    pack.identification.map_date !== m.assertions.map_date.value ||
    pack.currency !== m.currency ||
    JSON.stringify(pack.active_metadata) !== JSON.stringify(m.active_metadata) ||
    JSON.stringify(pack.overlay) !==
      JSON.stringify({
        dataset_name: m.overlay.dataset_name,
        class_field: m.overlay.class_field,
        class_labels: m.overlay.class_labels,
      })
  )
    issues.push("Package status/metadata/overlay differs.");
  if (source.fact_keys.length !== 1 || source.fact_keys[0] !== "very-high-fire-hazard-severity-zone")
    issues.push("LRA package establishes only the Very High fact.");
  return issues;
}
