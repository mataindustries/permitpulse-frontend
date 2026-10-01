import { source, sra, edit, encode, overlay, HIGH, VH } from "./program-screen-lra-helpers";
import { describe, expect, inject, it } from "vitest";
import manifestRaw from "../fixtures/program-screen/authority-packages/calfire-lra-fhsz-2025-03-24-v1.json?raw";
import lraMetadataJson from "../fixtures/program-screen/official-sources/calfire-fhszlra-25-1-all-data/metadata.json";
import lraExtracted from "../fixtures/program-screen/official-sources/calfire-fhszlra-25-1-all-data/extracted.txt?raw";
import s78Json from "../fixtures/program-screen/official-sources/gcs-51178/metadata.json";
import s78Extracted from "../fixtures/program-screen/official-sources/gcs-51178/extracted.txt?raw";
import s79Json from "../fixtures/program-screen/official-sources/gcs-51179/metadata.json";
import s79Extracted from "../fixtures/program-screen/official-sources/gcs-51179/extracted.txt?raw";
import type { PackageCapture } from "../src/shared/program-screen/authority-package";
import {
  parseProgramAuthorityRegistries,
  programAuthorityRegistries,
} from "../src/shared/program-screen/authority-policy";
import { statutoryRouteRecordKinds } from "../src/shared/program-screen/evidence-authority";
import {
  lraAuthorityPackageIssues,
  lraAuthorityRegistrationIssues,
  lraPackageManifestSchema,
  LRA_PACKAGE_ID,
  LRA_DATASET_ID,
} from "../src/shared/program-screen/lra-authority-package";
import {
  loadOverlayDatasetView,
  overlayIndexPinFor,
  parseOverlayIndex,
} from "../src/shared/program-screen/overlay-dataset";
import {
  authoritySourceCaptureIssues,
  parseOfficialSourceMetadata,
  sha256Hex,
  splitExtractedPages,
  datasetMetadataLine,
} from "../src/shared/program-screen/source-capture";

const metadata = parseOfficialSourceMetadata(lraMetadataJson),
  s78 = parseOfficialSourceMetadata(s78Json),
  s79 = parseOfficialSourceMetadata(s79Json);
const manifest = lraPackageManifestSchema.parse(JSON.parse(manifestRaw));
const provided = inject("programScreenLraDataset"),
  byteChecks = inject("programScreenOfficialCaptureByteChecks");
const captures = () =>
  new Map<string, PackageCapture>([
    [LRA_DATASET_ID, { metadata, extracted: lraExtracted }],
    ["gcs-51178", { metadata: s78, extracted: s78Extracted }],
    ["gcs-51179", { metadata: s79, extracted: s79Extracted }],
  ]);

describe("Phase 3G exact authority package and native association", () => {
  it("pins captures, original times, archive bytes and active XML", async () => {
    expect(provided.error).toBeNull();
    expect(metadata).toMatchObject({
      sha256_original: "736fa5231c70b844550784cd13c8d414c239cf9573c9cae6139554ef0bf464b6",
      sha256_extracted: "5724d4a456ddbf7845a116d162d96fc51b4a295c4c05a92d91fb2049cd4f1dad",
      retrieved_at: "2026-09-30T16:39:28Z",
      original: { bytes: 9840158 },
      document_date: "2025-03-24",
    });
    expect(s78).toMatchObject({
      sha256_original: "d6c0bd92141a950ebf56651a9988679ef6498329daa8fc04144a80611d88b821",
      retrieved_at: "2026-09-30T16:39:05Z",
      original: { bytes: 162914 },
    });
    expect(s79).toMatchObject({
      sha256_original: "fe26edd20837ae19e072fbabcea128bc6a1cb2f4eefae7397e6b8a1d8660ab77",
      retrieved_at: "2026-09-30T16:39:17Z",
      original: { bytes: 166101 },
    });
    if (s79.schema_version !== "program-screen-official-source-v2") throw new Error("Expected metadata v2");
    expect(s79.http_capture?.response_headers).toMatchObject({
      bytes: 392,
      sha256: "e4cfb366807e0de2e426c86000b1027b9cba80681f13e7b6ce2dac8c3a70cb5e",
    });
    for (const m of manifest.members)
      expect(byteChecks[`app/fixtures/program-screen/official-sources/${m.source_id}`]).toMatchObject({
        sha256_original: m.sha256_original,
        issues: [],
      });
    expect(await sha256Hex(provided.active_xml)).toBe(manifest.active_metadata.xml_sha256);
    expect(provided.association).toMatchObject({
      fid: 3,
      name: "FHSALRA25_v1_All",
      physical_name: "FHSALRA25_V1_ALL",
      path: "\\FHSALRA25_v1_All",
      definition_sha256: manifest.active_metadata.definition_sha256,
    });
    expect(await lraAuthorityPackageIssues(manifest, captures())).toEqual([]);
    expect(
      lraAuthorityRegistrationIssues(
        source,
        programAuthorityRegistries.issuers[0],
        manifest,
        await sha256Hex(manifestRaw),
      ),
    ).toEqual([]);
    expect(
      await authoritySourceCaptureIssues(source, {
        metadata,
        extracted: lraExtracted,
      }),
    ).toEqual([]);
  });
  it("rejects archive hash mutation", async () => {
    expect(provided.error).toBeNull();
    expect(provided.native_mutations.archive_hash).toMatch(/sha256_original|original.*SHA-256/i);
    const c = captures();
    c.get(LRA_DATASET_ID)!.metadata = edit(metadata, (m) => (m.sha256_original = "0".repeat(64)));
    expect(await lraAuthorityPackageIssues(manifest, c)).toContain(
      "Archive/active metadata/layer association differs.",
    );
  });
  it.each(["metadata_xml", "metadata_to_layer"])(
    "rejects native %s mutation through correctly re-CRC'd archive",
    (kind) => {
      expect(provided.error).toBeNull();
      expect(provided.native_mutations[kind]).toMatch(
        kind === "metadata_xml" ? /active metadata XML differs/ : /metadata-to-layer identity differs/,
      );
    },
  );
  it.each(["fid", "layer", "xml_sha256", "definition_sha256"])("rejects active metadata %s mutation", async (key) => {
    const changed = edit(
      manifest,
      (m) => (m.active_metadata[key] = key === "fid" ? 4 : key === "layer" ? "FHSZSRA_23_3" : "0".repeat(64)),
    );
    expect((await lraAuthorityPackageIssues(changed, captures())).length).toBeGreaterThan(0);
  });
  it("keeps stale fields and the State/local relationship explicit", () => {
    expect(splitExtractedPages(lraExtracted)).toHaveLength(2);
    for (const [path, value] of [
      ["/metadata/dataIdInfo/idCitation/date/pubDate", "2022-04-12"],
      ["/metadata/dataIdInfo/idCitation/resEd", "22_2"],
      ["/metadata/eainfo/detailed/enttyp/enttypl", "FHSZSRA_DRAFT22_1"],
    ]) {
      expect(datasetMetadataLine(lraExtracted, path)).toContain(value);
      expect(manifest.non_authoritative).toContain(path);
    }
    expect(lraExtracted).toContain("State Responsibility Area");
    expect(manifest.members.map((m) => m.source_id)).toEqual(["gcs-51178", "gcs-51179", LRA_DATASET_ID]);
    expect(manifest.status).toBe("state_identification_recommendation");
    expect(source.package).not.toHaveProperty("adoption");
    expect(manifest.assertions.statutory_basis.evidence.map((e) => e.source_id)).toEqual([
      "gcs-51178",
      "gcs-51179",
      LRA_DATASET_ID,
    ]);
    expect(manifest.assertions.local_adoption_is_separate.value).toBe(true);
  });
  it.each(["wrong route", "wrong issuer", "wrong edition", "High fact"])("rejects %s registration", async (name) => {
    const changed = edit(source, (s) => {
      if (name === "wrong route") s.package.statutory_basis = "prc_4202";
      if (name === "wrong issuer") s.issuer_id = "city-la";
      if (name === "wrong edition") s.edition.date = "2022-04-12";
      if (name === "High fact") s.fact_keys.push(HIGH);
    });
    expect(
      lraAuthorityRegistrationIssues(
        changed,
        programAuthorityRegistries.issuers[0],
        manifest,
        await sha256Hex(manifestRaw),
      ).length,
    ).toBeGreaterThan(0);
    const r = edit(programAuthorityRegistries, (r) => (r.sources[1] = changed));
    expect(() => parseProgramAuthorityRegistries(r)).toThrow();
  });
  it("binds both route kinds while preserving independent packages", () => {
    expect(statutoryRouteRecordKinds).toEqual({
      gov_51178: "agency_hazard_map",
      prc_4202: "agency_hazard_map",
    });
    expect(() => parseProgramAuthorityRegistries(programAuthorityRegistries)).not.toThrow();
    expect(programAuthorityRegistries.fact_policies[HIGH]!.establishing.flatMap((e) => e.authority_source_ids)).toEqual(
      [sra.authority_source_id],
    );
    expect(programAuthorityRegistries.fact_policies[VH]!.establishing.flatMap((e) => e.authority_source_ids)).toEqual([
      sra.authority_source_id,
      LRA_PACKAGE_ID,
    ]);
  });
});

describe("Phase 3G pinned lossless index", () => {
  it("pins every FID and validity; preserves all four full labels", async () => {
    expect(provided.error).toBeNull();
    const index = provided.index_text!;
    expect(await sha256Hex(index)).toBe("5167cbf7029ea3fc051331d2c2de4d1611feb88783e38a852f678b94b275a716");
    expect(overlayIndexPinFor(source.package!.members.overlay_dataset)?.index_sha256).toBe(await sha256Hex(index));
    const parsed = parseOverlayIndex(index);
    expect(parsed.header).toMatchObject({
      layer: "FHSALRA25_v1_All",
      crs_epsg: 3310,
      class_field: "FHSZ_Description",
      records: 9752,
      format: "filegdb",
      members: {
        archive: metadata.sha256_original,
        metadata: manifest.active_metadata.xml_sha256,
        feature_table: "f253e6f0b68481d5d556ecaf1dfe42ac01e2445f5a060f15cfe4632ff41ae6e9",
      },
    });
    expect(provided.source_counts).toEqual({
      "Very High": 1008,
      High: 2049,
      Moderate: 4741,
      NonWildland: 1954,
    });
    expect(provided.invalid_counts).toEqual({
      "Very High": 11,
      High: 20,
      Moderate: 70,
      NonWildland: 18,
    });
    expect(parsed.entries.filter((e) => e.source_validity === "invalid")).toHaveLength(119);
    expect(parsed.entries.filter((e) => e.geometry_state === "unreadable")).toHaveLength(28);
    expect(provided.curve_count).toBe(30);
    expect(provided.multipart_count).toBeGreaterThan(0);
    expect(provided.hole_count).toBeGreaterThan(0);
    const view = await loadOverlayDatasetView({
      index_text: index,
      records: Object.entries(provided.records).map(([n, b]) => ({
        record_number: Number(n),
        content: Uint8Array.from(atob(b), (c) => c.charCodeAt(0)),
      })),
    });
    for (const [n, b] of Object.entries(provided.records)) {
      const f = JSON.parse(atob(b));
      if (f.state !== "valid") continue;
      expect(view.feature(Number(n))?.rings).toEqual(f.coordinates.flat().map((ring: number[][]) => ring.flat()));
      expect(view.feature(Number(n))?.label).toBe(f.label);
    }
  });
  it("rejects index validity mutation against shipped pin", async () => {
    expect(provided.error).toBeNull();
    await expect(
      loadOverlayDatasetView({
        index_text: provided.index_text!.replace(" invalid invalid ", " valid valid "),
        records: [],
      }),
    ).rejects.toThrow(/not the one pinned/);
  });
  it("rejects coordinate and semantic record mutations", async () => {
    const o = await overlay(10, 90);
    for (const field of ["coordinates", "label"]) {
      const r = o.derived.records[0],
        f = JSON.parse(new TextDecoder().decode(r.content));
      if (field === "label") f.label = "High";
      else f.coordinates[0][0][1][0] += 0.01;
      await expect(
        loadOverlayDatasetView(
          {
            index_text: o.derived.index_text,
            records: [{ record_number: 1, content: encode(f) }],
          },
          [o.pin],
        ),
      ).rejects.toThrow(/does not match the index/);
    }
  });
});
