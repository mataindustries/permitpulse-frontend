import { describe, expect, it } from "vitest";
import fixture from "../fixtures/program-screen/fictional-la-parcel.json";
import {
  source,
  sra,
  edit,
  overlay,
  routeResult,
  defaultFeatures,
  feature,
  record,
  block,
  screen,
  failures,
  registries,
  VH,
  HIGH,
  C,
  D,
  ring,
} from "./program-screen-lra-helpers";
import { computeLotOverlay } from "../src/shared/program-screen/lot-overlay";
import { authorityPromotionBlockers, programAuthorityRegistries } from "../src/shared/program-screen/authority-policy";
import { evaluateProgramScreen, programScreenPathwayPacks } from "../src/shared/program-screen/evaluate";
import { overlayIndexPinFor, loadOverlayDatasetView } from "../src/shared/program-screen/overlay-dataset";
import { sha256Hex } from "../src/shared/program-screen/source-capture";
import { buildProgramScreenPublicDemoPayload } from "../src/shared/program-screen/public-demo";
import { programPathwayCompletenessBlockers } from "../src/shared/program-screen/types";
import { realLotOverlay } from "./program-screen-overlay-helpers";
import { LRA_PACKAGE_ID } from "../src/shared/program-screen/lra-authority-package";
import { prePromotionC, prePromotionPacks } from "./program-screen-c-pre-promotion";

describe("Phase 3G Route 1 YES / NO / unknown", () => {
  it("rejects an index hash bypass", async () => {
    const o = await overlay(10, 90);
    await expect(loadOverlayDatasetView({ index_text: o.derived.index_text.replace("class_field FHSZ_Description", "class_field UNREVIEWED_LABEL"), records: [] }, [o.pin])).rejects.toThrow(/not the one pinned/);
  });
  it("rejects a record hash bypass with the same byte length and extent", async () => {
    const o = await overlay(10, 90), record = o.derived.records[0];
    const f = JSON.parse(new TextDecoder().decode(record.content));
    f.coordinates[0][0][1][0] = 1;
    const content = new TextEncoder().encode(JSON.stringify(f) + "\n");
    expect(content.length).toBe(record.content.length);
    await expect(loadOverlayDatasetView({ index_text: o.derived.index_text, records: [{ record_number: 1, content }] }, [o.pin])).rejects.toThrow(/does not match the index/);
  });
  it.each([
    [10, 90, true, "whole Very High"],
    [110, 190, false, "whole High"],
    [210, 290, false, "whole Moderate"],
    [310, 390, false, "whole NonWildland"],
    [110, 290, false, "mixed High / Moderate"],
    [210, 390, false, "mixed Moderate / NonWildland"],
  ] as const)("computes %s..%s %s (%s)", async (x0, x1, value, _name) => {
    const { result, combined } = await routeResult(x0, x1, value);
    expect(result.authority?.facts[0]?.established).toBe(true);
    expect(result.status).toBe(value ? "disqualifying_per_source" : "consistent_with_source");
    expect(combined.status).toBe(value ? "disqualifying_per_source" : "unknown");
  });
  it.each([
    [110, 190, true, "High trying to establish c"],
    [90, 110, true, "mixed Very High / High YES"],
    [90, 110, false, "mixed Very High / High NO"],
    [390, 410, false, "partial coverage"],
    [500, 510, false, "outside package coverage"],
  ] as const)("fails closed for %s..%s %s (%s)", async (x0, x1, value, _name) => {
    const { result } = await routeResult(x0, x1, value);
    expect(result.status).toBe("unknown");
    expect(result.authority?.facts.some((f) => f.established)).toBe(false);
  });
  it("fails closed for internal gaps", async () => {
    const { result } = await routeResult(10, 190, false, [feature(1, "High", 0, 90), feature(2, "Moderate", 100, 200)]);
    expect(result.status).toBe("unknown");
    expect(failures(result)).toContain("hazard_area_not_covered");
  });
  it("fails closed for missing candidate record", async () => {
    const { result } = await routeResult(10, 90, true, defaultFeatures(), () => {}, [1]);
    expect(result.status).toBe("unknown");
    expect(failures(result)).toContain("lot_overlay_not_established");
  });
  it("fails closed for relevant invalid geometry", async () => {
    const fs = defaultFeatures();
    fs[0].state = "invalid";
    fs[0].source_validity = "invalid";
    const { o, result } = await routeResult(10, 90, true, fs);
    expect(computeLotOverlay(o.view, o.lot).issues.join(" ")).toContain("Invalid or unreadable candidate");
    expect(result.status).toBe("unknown");
  });
  it("ignores invalid geometry elsewhere", async () => {
    const fs = defaultFeatures();
    fs.push(feature(5, "Moderate", 1000, 1100, "invalid"));
    const { result } = await routeResult(10, 90, true, fs);
    expect(result.status).toBe("disqualifying_per_source");
  });
  it("preserves multipart gaps and holes without repair", async () => {
    const f = feature(1, "Very High", 0, 100);
    f.coordinates = [[ring(0, 0, 40, 100)], [ring(60, 0, 100, 100)]];
    expect((await routeResult(10, 90, true, [f])).result.status).toBe("unknown");
    f.coordinates = [[ring(0, 0, 100, 100), ring(20, 10, 80, 90)]];
    const { o, result } = await routeResult(30, 70, false, [f]);
    expect(computeLotOverlay(o.view, o.lot).lot_within_features).toBe("none");
    expect(result.status).toBe("unknown");
  });
  it("fails closed for unreadable candidates and preserves curved WKB", async () => {
    const fs = defaultFeatures();
    fs[0].state = "unreadable";
    fs[0].coordinates = [];
    fs[0].native_wkb = "010c00000000000000";
    const { result, o } = await routeResult(10, 90, true, fs);
    expect(result.status).toBe("unknown");
    expect(JSON.parse(new TextDecoder().decode(o.derived.records[0].content)).native_wkb).toBe(fs[0].native_wkb);
  });
  it("fails closed for unknown semantic label, even a numeric Very High code", async () => {
    const fs = defaultFeatures();
    fs[0].label = "3";
    expect((await routeResult(10, 90, true, fs)).result.status).toBe("unknown");
  });
  it.each(["manual coverage", "manual class"])("refuses %s attestation overriding geometry", async (kind) => {
    const { result } = await routeResult(110, 190, true, defaultFeatures(), (b) => {
      b.coverage = "whole_parcel";
      b.qualifiers.map_covers_lot = "yes";
      b.qualifiers.legend_defines_class_for_lot = "yes";
      if (kind === "manual class") b.qualifiers.hazard_class = "very_high";
    });
    expect(result.status).toBe("unknown");
    expect(failures(result)).toContain("lot_overlay_classes_do_not_support_value");
  });
  it.each(["wrong route", "wrong issuer", "wrong edition", "unclear legal lot"])(
    "fails closed for %s evidence",
    async (kind) => {
      const { result } = await routeResult(10, 90, true, defaultFeatures(), (b) => {
        if (kind === "wrong route") b.qualifiers.statutory_basis = "prc_4202";
        if (kind === "wrong issuer") b.issuer.issuer_id = "other-agency";
        if (kind === "wrong edition") b.edition.date = "2022-04-12";
        if (kind === "unclear legal lot") b.parcel_relationship.legal_lot_identity = "not_established";
      });
      expect(result.status).toBe("unknown");
      expect(result.authority?.facts.some((f) => f.established)).toBe(false);
    },
  );
  it("rejects an SRA package masquerading as GOV 51178 evidence", async () => {
    const { o, e, b } = await routeResult(10, 90, true);
    const changed = edit(b, (b) => {
      b.source_identifier.value = sra.authority_source_id;
      b.capture = { store: "repo_official_source", ...sra.capture };
      b.edition = { ...b.edition, ...sra.edition };
    });
    const result = screen([e], [changed], o);
    expect(result.status).toBe("unknown");
    expect(failures(result)).toContain("statutory_route_not_accepted");
  });
  it("rejects an LRA package masquerading as PRC 4202 evidence", async () => {
    const { result } = await routeResult(10, 90, true, defaultFeatures(), (b) => {
      b.qualifiers.statutory_basis = "prc_4202";
      b.qualifiers.adoption_status = "adopted";
    });
    expect(result.status).toBe("unknown");
    expect(failures(result)).toContain("statutory_route_not_accepted");
  });
  it("rejects LRA evidence attempting to establish d", async () => {
    const o = await overlay(110, 190),
      e = record("test-only-lra-high", HIGH, true),
      b = block(e, o);
    const result = screen([e], [b], o, registries(), HIGH);
    expect(result.status).toBe("unknown");
    expect(failures(result)).toContain("statutory_route_not_accepted");
  });
  it("rejects a superseded LRA source", async () => {
    const { o, e, b } = await routeResult(10, 90, true),
      r = edit(registries(), (r) => {
        const next = structuredClone(r.sources[1]);
        next.authority_source_id += "-superseding";
        r.sources[1].superseded_by = next.authority_source_id;
        r.sources.push(next);
      });
    const result = screen([e], [b], o, r);
    expect(result.status).toBe("unknown");
    expect(failures(result)).toContain("authority_source_not_registered");
  });
  it("needs both independent NO routes to clear, and either qualified YES blocks", async () => {
    const real = await realLotOverlay();
    for (const [r1, r2, expected] of [
      [false, false, "unknown"], // Updated in Phase 3I: these routes name different verified geometries.
      [true, false, "disqualifying_per_source"],
      [false, true, "disqualifying_per_source"],
    ] as const) {
      const o = await overlay(r1 ? 10 : 110, r1 ? 90 : 190),
        e1 = record("test-only-r1", VH, r1),
        e2 = record("test-only-r2", VH, r2),
        b1 = block(e1, o),
        b2 = block(e2, o, "prc_4202");
      if (b2.qualifiers?.family !== "hazard_map") throw new Error("Wrong qualifier");
      b2.qualifiers.lot_overlay!.lot_geometry = real.lots[r2 ? "whole-very-high" : "whole-moderate"];
      o.inputs.datasets.push(real.view);
      o.inputs.lot_geometries.push(...Object.values(real.geometries));
      o.inputs.index_pins.push(overlayIndexPinFor(sra.package!.members.overlay_dataset)!);
      const result = screen([e1, e2], [b1, b2], o);
      expect(result.status).toBe(expected);
      if (!r1 && !r2) {
        expect(result.authority?.facts.every((fact) => fact.established)).toBe(true);
        expect(result.authority?.criterion_failures).toEqual([{ code: "statutory_routes_lot_geometry_not_shared", fact_key: VH }]);
      }
    }
  });
  it("has no City adoption gate", async () => {
    const { result } = await routeResult(10, 90, true, defaultFeatures(), (b) => {
      b.qualifiers.adoption_status = "not_adopted";
    });
    expect(result.status).toBe("disqualifying_per_source");
  });
});

describe("Phase 3G preserved review state and projections", () => {
  // Updated in Phase 3H: Phase 3G left c pending at 1 / 45; the later Phase 3H review promoted c (2 / 44).
  it("left c pending with only its reviewer gates after Phase 3G; c is now promoted (2 / 44)", () => {
    const criteria = programScreenPathwayPacks.flatMap((p) => p.criteria);
    expect(criteria.filter((c) => c.verification === "human_verified").map((c) => c.id)).toEqual([C, D]);
    expect(criteria.filter((c) => c.verification === "pending_human")).toHaveLength(44);
    expect(prePromotionC()).toMatchObject({
      verification: "pending_human",
      human_verification: null,
      predicate: "not_encoded",
    });
    expect(authorityPromotionBlockers(prePromotionC(), programAuthorityRegistries, false)).toEqual([
      "reviewer_confirms_encoded_rule",
      "human_verification_record",
    ]);
    expect(authorityPromotionBlockers(criteria.find((c) => c.id === C)!, programAuthorityRegistries, true)).toEqual([]);
    expect(programPathwayCompletenessBlockers.map((b) => [b.id, b.status])).toEqual([
      ["G1", "open"],
      ["G2", "open"],
    ]);
  });
  it("requires a registered current package for each route, not just matching kinds", () => {
    const c = programScreenPathwayPacks.flatMap((p) => p.criteria).find((c) => c.id === C)!;
    const onlySra = edit(programAuthorityRegistries, (r) => {
      r.sources = r.sources.filter((s: any) => s.authority_source_id !== LRA_PACKAGE_ID);
      r.fact_policies[VH].establishing = r.fact_policies[VH].establishing.filter(
        (e: any) => !e.authority_source_ids.includes(LRA_PACKAGE_ID),
      );
    });
    expect(authorityPromotionBlockers(c, onlySra, false)).toContain("statutory_route_recorded");
  });
  // Updated in Phase 3H: the Phase 3G pins hold for c in its pre-promotion form; the shipped output is the
  // approved Phase 3H projection.
  it("preserves evaluator and demo hashes before and after Phase 3G", async () => {
    expect(
      await sha256Hex(
        JSON.stringify(
          evaluateProgramScreen({
            evidence_records: fixture.evidence_records,
            as_of: fixture.as_of,
            packs: prePromotionPacks(),
          }),
        ),
      ),
    ).toBe("156dd1f41964ab5beebcf3882e0a0d653cc5d778939033bf2b752dba1e86afbc");
    expect(
      await sha256Hex(
        JSON.stringify(
          buildProgramScreenPublicDemoPayload(fixture, {
            as_of: fixture.as_of,
            packs: prePromotionPacks(),
          }),
        ),
      ),
    ).toBe("4dd2735bab875ad40b123fec72020e16442737bc6b5052eb55c5fba374b9a8a5");
    expect(
      await sha256Hex(JSON.stringify(evaluateProgramScreen({ evidence_records: fixture.evidence_records, as_of: fixture.as_of }))),
    ).toBe("1341fea59e307fed23ec1cd32fcdb2467d0fa3519bd07dd134fa9ddfee6deaad");
    expect(
      await sha256Hex(JSON.stringify(buildProgramScreenPublicDemoPayload(fixture, { as_of: fixture.as_of }))),
    ).toBe("23aaee06e51b42a4c1001d6253504f2f932d591315af468ada21345d888a5070");
  });
});
