# Program Screen Phase 3D: the CAL FIRE / OSFM SRA Fire Hazard Severity Zone package (PRC §4202)

Phase 3D captures, validates, and registers the first real authority: the Office of the State Fire Marshal's State Responsibility Area (SRA) Fire Hazard Severity Zone map, adopted under PRC §4202, for SHRA criteria c (`la_shra.very-high-fire-hazard-severity-zone`, Route 2 only) and d (`la_shra.high-fire-hazard-severity-zone`).

Decided 2026-09-29 by **Sergio Mata, Project Owner / Human Reviewer** (decisions D1-D7 below).

- **Nothing is promoted.** `human_verified` = 0 and `pending_human` = 46. c and d stay `pending_human`, with no encoded rule and no human verification record.
- **GOV §51178 is not captured and not registered.** Its record kind stays undefined, so Route 1 fails closed and c can never clear.
- **LRA recommendations are not §4202 authority.** The package is the adopted SRA map only.
- **The evaluator and public-demo output hashes are unchanged** (see [Output](#evaluator-and-demo-output)).
- **The package never determines a lot.** A lot result needs a reviewed legal-lot geometry compared deterministically with the pinned dataset. Partial overlap stays unknown, and land with no SRA feature (FRA or LRA) is unknown, never a NO.

Tests: `app/tests/program-screen-calfire-sra-package-3d.test.ts`.

## Decisions (as approved)

| | Decision |
| --- | --- |
| Map URL | The current official statewide SRA map URL is the one the current CAL FIRE FHSZ page links to (`.../fire-hazard-severity-zones/fhsz_statewide_sra_e_2022_3.pdf?hash=0F0A...&rev=5f9d...`). The older `...maps-2022-files...` link is stale history and is not captured. |
| D1 | Approve three exact-path host exceptions on the CAL FIRE Azure CDN host: the statewide SRA map PDF, the final regulation text PDF, and the SRA GIS ZIP. Never trust the CDN hostname globally. No exception for the scanned Notice of Approval. |
| D2 | Implement only: the existing `agency_map` capture for the statewide PDF; a new `regulation` capture type for the final regulation text; a new `dataset_archive` capture type for the SRA GIS ZIP; and a narrowly scoped `authority_package` manifest tying the three together. Every assertion points to an exact captured member and hash, and the package fails closed if any member is missing or changed. No generic document framework. |
| D3 | Drop the scanned Notice of Approval as a required member. No transcription. The final regulation text establishes the adopted §2201 map identity and the PRC §4202 authority; the SRA dataset metadata establishes the adoption and effective dates. The notice is external corroboration and provenance history only. |
| D4 | The map is "dated" September 29, 2023. Add the neutral date kind `dated`; never relabel it as issued or adopted. Map date 2023-09-29, adoption date 2024-01-31, and effective date 2024-04-01 stay separate. |
| D5 | Approve issuer `calfire-osfm`: the Office of the State Fire Marshal as identified within the California Department of Forestry and Fire Protection in the captured §2201 text. |
| D6 | Commit the exact raw `fhszsra_23_3.zip` (SHA-256 `e744eb8eb7895157f4025109f29ff5312180a52fdb4648ff9fe9328edf4db3b2`, 36,001,656 bytes), outside public assets and build output, with deterministic derived text. Never extract and re-zip it. |
| D7 | No arbitrary currency window: current until superseded. The package is usable while it is the registered source, `superseded_by` is null, and every pinned member hash matches. |

Dataset rules (approved): dataset `FHSZSRA_23_3`, 18,423 SRA polygons, EPSG:3310 (California Albers), class field `FHSZ_Descr` with labels Very High, High, Moderate; numeric `FHSZ` codes are never semantic authority; FRA/LRA land has no SRA polygon and is never a negative result; the stale metadata fields are kept but marked non-authoritative; a lot result requires reviewed lot geometry and a deterministic spatial comparison; partial overlap is unknown.

## Retrieval provenance

- The official page, `https://www.fire.ca.gov/osfm/what-we-do/community-wildfire-preparedness-and-mitigation/fire-hazard-severity-zones`, answered every request with an Akamai `403 Access Denied` (curl default, curl with browser request headers, and wget; references `18.cea5dc17.1790655938.1b2f67ec` and `18.cfa5dc17.1790656050.e53c3db8`). The capture environment's egress proxy also refused the host and the CDN host.
- The repository owner approved browser-only link discovery on the official CAL FIRE / OSFM pages: the browser was used only to read the exact link addresses. Every document was downloaded with curl from its official URL as the exact bytes served, and hashed. No browser-saved content is evidence.
- The owner uploaded the originals unchanged (the ZIP in two byte-for-byte parts). Each SHA-256 and size matched the owner's values before any analysis.

## Package members

All three are served by CAL FIRE's CDN endpoint `34c031f8-c9fd-4018-8c5a-4159cdff6b0d-cdn-endpoint.azureedge.net` (HTTP/2 200, Microsoft `*.azureedge.net` certificate, no redirect).

| Role | Source ID | Type | Bytes | SHA-256 original | SHA-256 extracted | Status | Document date |
| --- | --- | --- | --- | --- | --- | --- | --- |
| adopted map | `calfire-sra-fhsz-map-2023-09-29` | `agency_map` | 16,306,456 | `6e54c1bb10672d2ca5f307c920f09b874b5f9be671b3fa001df6e9eb7b4729e4` | `11830e2c8c29f368e4087ae9ff270ee042673dfd7be6e354750c326579e5b1fe` | `operative` | 2023-09-29 (`dated`) |
| adopting regulation | `ccr-19-2201-fhsz-sra-final-text` | `regulation` | 67,366 | `977abe3a6fc0da2568cabe6bfb164bbb8965e2bc8ef2b01b9012dd8b5517d147` | `61aafec5e4a394ffb5724cb894dc570fc28e36e7c7174754016c5e64b8d78657` | `status_unconfirmed` | none printed |
| overlay dataset | `calfire-fhszsra-23-3-data` | `dataset_archive` | 36,001,656 | `e744eb8eb7895157f4025109f29ff5312180a52fdb4648ff9fe9328edf4db3b2` | `a85ff7eecf0f8ffa80d7dd8dcdc727a9dde42979fb3b7b8d5614b7a47a6b5a8a` | `operative` | none printed |

Official URLs (as recorded in each capture and in `expectedOfficialSources`):

- Map: `https://34c031f8-c9fd-4018-8c5a-4159cdff6b0d-cdn-endpoint.azureedge.net/-/media/osfm-website/what-we-do/community-wildfire-preparedness-and-mitigation/fire-hazard-severity-zones/fhsz_statewide_sra_e_2022_3.pdf?hash=0F0A6600B86610FC79BA8BF1D83D8812&rev=5f9d2c7e7a7e47f5946cb5bf6742d813`
- Regulation: `https://34c031f8-c9fd-4018-8c5a-4159cdff6b0d-cdn-endpoint.azureedge.net/-/media/osfm-website/what-we-do/code-development-and-analysis/title-19-development/fhsz-2024/final-text.pdf?hash=8AE9545C673F3BAB91EDC29A614097CC&rev=6d3a48124b7f4bbaa98a8fa5afd697ff`
- Dataset: `https://34c031f8-c9fd-4018-8c5a-4159cdff6b0d-cdn-endpoint.azureedge.net/-/media/osfm-website/what-we-do/community-wildfire-preparedness-and-mitigation/fire-hazard-severity-zones/fhszsra_23_3.zip?hash=87816F8F0635FFA1D7B99A723DE38A70&rev=f5118b1ba17044a8aa3cd2994f00d6d3`

Notes a reader needs:

- **The regulation text prints repealed text.** The page images show Title 14 §1280.01 struck through (repealed) and Title 19 §§2200-2201 underlined (added). Extracted text keeps neither, so the repealed section and its November 7, 2007 maps read as plain text on page 1. The capture pins §2201's heading, and every package quotation from the regulation must lie inside §2201 on the page it names. The identical authority note in §1280.01 (page 1) and §2200 (page 2) is refused.
- **The regulation prints no date and no statement of its own effect**, so its `document_date` is null and its status is `status_unconfirmed`. Adoption and effect come from the dataset member (D3).
- **The map's scale is 1:1,150,000 at 36 by 48 inches.** It is never used to place a lot. Its non-SRA legend entry ("Federal Responsibility Area (FRA) or Local Responsibility Area (LRA)") defines no class.
- **The dataset metadata has stale fields**, kept byte for byte and listed as `non_authoritative` in the capture: `pubDate` 2022-04-12, `resEd` 22_2, entity label `FHSZSRA_DRAFT22_1`, and two feature counts that read 0. Its purpose text repeats the OAL notice's slip "Section 1280.1" for 1280.01.

Excluded, by D3: the Office of Administrative Law Notice of Approval of Regulatory Action, OAL matter 2023-1215-03, dated January 31, 2024 (image-only scan: no text layer on any of its 6 pages; SHA-256 `d1bf674e255d7c7e285c40fe072a400bd65f8db67189095ea2b0f96524268d29`, 1,005,624 bytes). Read against its page images, it states that the action "becomes effective on 4/1/2024", which agrees with the dataset metadata. It is not captured and nothing relies on it.

## The authority package

Manifest: `app/fixtures/program-screen/authority-packages/calfire-sra-fhsz-2023-09-29.json`, SHA-256 `768930ea3bc874cf06436499219895dd2acb18d970c4ddbba6b5dd88e9d40832` (pinned in the registry). Schema and checks: `app/src/shared/program-screen/authority-package.ts`.

| Assertion | Value | Member | Quoted text (page) |
| --- | --- | --- | --- |
| issuer identity | `calfire-osfm` | regulation | "shall be designated by the State Fire Marshal and delineated on a map on file in the Sacramento Office of the Department of Forestry and Fire Protection, Office of the State Fire Marshal" (2) |
| | | map | "Daniel Berlant, State Fire Marshal (Appointed), California Department of Forestry and Fire Protection" (1) |
| PRC §4202 basis | `prc_4202` | regulation | "NOTE: Authority cited: Sections 4202, 4203 and 4204, Public Resources Code." (3, inside §2201) |
| adopted status | `adopted` | dataset | "/metadata/dataIdInfo/idAbs: Fire Hazard Severity Zone classes from the map dated September 29, 2023, as adopted on January 31, 2024 and implemented on April 1, 2024" (6) |
| map identity | "State Responsibility Area Fire Hazard Severity Zones" | regulation | "The map, approved by the Office of the State Fire Marshal, is hereby incorporated by reference and entitled “State Responsibility Area Fire Hazard Severity Zones,” dated September 29, 2023." (3) |
| | | map | "State Responsibility Area Fire Hazard Severity Zones STATE OF CALIFORNIA September 29, 2023" (1) |
| map date | 2023-09-29, `dated` | regulation, map | the same two quotations |
| adoption date | 2024-01-31 | dataset | the `idAbs` quotation |
| effective date | 2024-04-01 | dataset | "Effective April 1, 2024 this regulatory adoption repeals Section 1280.1 of Title 14 California Code of Regulations and adopts similar regulatory provisions in Section 2201 of Title 19 California Code of Regulations." (6) |
| legend classes | very_high, high, moderate | map | "Fire Hazard Severity Zones in State Responsibility Area (SRA)", "Very High 16,913,515 Acres", "High 10,137,597 Acres", "Moderate 3,944,882 Acres" (1) |
| lot-overlay dataset | `FHSZSRA_23_3`, `FHSZ_Descr`, EPSG 3310, 18,423 features, extent `SRA` | map | "CAL FIRE Fire Hazard Severity Zones (FHSZSRA_23_3)" (1) |
| | | dataset | the `resTitle` line, the `idAbs` line, `values FHSZ_Descr: "High" 5824; "Moderate" 4188; "Very High" 8411` (3), and `UNIT["Meter",1.0],AUTHORITY["EPSG",3310]]` (6) |
| unclassified areas | no feature is not a negative result | map | "Federal Responsibility Area (FRA) or Local Responsibility Area (LRA) Fire Protection Responsibility Areas (non-SRA)" (1) |
| | | dataset | `values SRA: "SRA" 18423` (3) |

The dataset's class acreages reproduce the map legend's printed totals exactly in US survey acres, so the dataset is the map's geography.

The package fails closed when a member is missing, changed, test-only, of the wrong type, or recorded as proposed or superseded; when a quotation is not on its page, not inside §2201, or drawn from a non-authoritative field; when the map and regulation disagree on the title or date; when the legend or the dataset's labels do not define both High and Very High; or when a dataset label maps to a class of another name (so a numeric code is never a class).

## Schema extension (D2)

**Captures** (`source-capture.ts`, metadata v2):

- `regulation`: an official PDF of adopted regulation text, pinned to one CCR section (`title`, `section`, a whole-line `section_heading`, a `title_heading`, the document's own label, and a `status_as_published` that an operative capture must quote). Quotations are read only inside the section (`regulationSectionPages`).
- `dataset_archive`: the exact ZIP served, stored as `original.zip`. Its `extracted.txt` is `program-screen-zip-manifest` 1.0.0 (`dataset-archive.ts`): page 1 is the sorted member manifest (name, size, CRC-32, and SHA-256 of each uncompressed member); then one page per described member in the same order: `.cpg` and `.prj` as text, `.xml` as element text (escaped rich text rendered once), `.dbf` as its schema and character-field value summary, `.shp` as its header, `.shx` as its record count. Numeric fields are never summarized. The extractor is pure code, so every check re-derives the text from the bytes (in Node, in the test setup and `--verify`) and compares it. The context records the layer name, title, publisher, EPSG code, geometry type and count, the class and extent fields with every value and count (checked against the summary), the status statement, and the non-authoritative fields.
- `document_date` may be null only for these two types, when the document prints no date.
- The map edition date kind `dated` (D4).
- Three exact-path `sourceHostExceptions` (D1), each for one source ID and type; the global allowlist is unchanged.

**Registry** (`authority-policy.ts`): a registered source may carry a `package` (manifest SHA-256, statutory basis, adoption record, `until_superseded` currency, the three member pins, and the overlay dataset's label-to-class map). A hazard fact can be established only through a registered source with a package on a route its class rests on, whose labels define the class; a package can rest only on a route with a record kind (never GOV §51178). An establishing entry's currency is a day window or `until_superseded`, which only a package may use.

**Evidence and gate** (`evidence-authority.ts`, `authority-gate.ts`): the `hazard_map` qualifier gains `lot_overlay` (method, the dataset capture compared with, the reviewed lot geometry in the case store, and the dataset's class labels of every feature the lot intersects). A hazard record establishes only when:

- the lot was compared by deterministic spatial overlay (`matched_by: spatial_overlay`) with a reviewed lot geometry, against the package's pinned dataset (`lot_overlay_not_established` otherwise);
- the overlay's labels, mapped by the package, support the value: a YES lies wholly in the fact's class, a NO intersects SRA features and none of the fact's class (`lot_overlay_classes_do_not_support_value` otherwise);
- its statutory basis is the package's, and the package records the map as adopted;
- every earlier check still holds: CAL FIRE named, map covers the lot, legend class defined (High), registered edition and issuer, legal-lot identity, human review.

No check compares free text: which lot the geometry draws is part of the block's human review.

## Registration

```ts
issuers: [{
  issuer_id: "calfire-osfm",
  name: "California Department of Forestry and Fire Protection, Office of the State Fire Marshal",
  basis_capture: { source_id: "ccr-19-2201-fhsz-sra-final-text", sha256_extracted: "61aafec5e4a394ffb5724cb894dc570fc28e36e7c7174754016c5e64b8d78657" },
  review: { reviewer: { kind: "human", name: "Sergio Mata", role: "Project Owner / Human Reviewer" }, reviewed_on: "2026-09-29", decision_ref: null },
}]
sources: [{
  authority_source_id: "calfire-sra-fhsz-2023-09-29",
  record_kind: "agency_hazard_map",
  issuer_id: "calfire-osfm",
  title: "State Responsibility Area Fire Hazard Severity Zones (CAL FIRE / OSFM, PRC §4202)",
  edition: { label: "State Responsibility Area Fire Hazard Severity Zones, dated September 29, 2023", date: "2023-09-29", date_kind: "dated" },
  capture: { source_id: "calfire-sra-fhsz-map-2023-09-29", sha256_extracted: "11830e2c8c29f368e4087ae9ff270ee042673dfd7be6e354750c326579e5b1fe" },
  fact_keys: ["very-high-fire-hazard-severity-zone", "high-fire-hazard-severity-zone"],
  superseded_by: null,
  package: {
    manifest_sha256: "768930ea3bc874cf06436499219895dd2acb18d970c4ddbba6b5dd88e9d40832",
    statutory_basis: "prc_4202",
    adoption: { status: "adopted", adoption_date: "2024-01-31", effective_date: "2024-04-01" },
    currency: "until_superseded",
    members: { adopted_map, adopting_regulation, overlay_dataset },   // the three pins above
    overlay: { dataset_name: "FHSZSRA_23_3", class_field: "FHSZ_Descr",
               class_labels: { "Very High": "very_high", High: "high", Moderate: "moderate" } },
  },
}]
// very-high-fire-hazard-severity-zone and high-fire-hazard-severity-zone, one entry each:
{ record_kind: "agency_hazard_map", identity: "registered_authority_source", issuer_ids: ["calfire-osfm"],
  authority_source_ids: ["calfire-sra-fhsz-2023-09-29"], values: ["true", "false"], currency_max_age_days: "until_superseded" }
```

Every other fact policy's `establishing` list stays empty.

## Behavior enabled

**c, Very High (Route 2 only).** A PRC §4202 record for a lot wholly inside Very High establishes Route 2's YES, and c is a YES candidate (a NO on Route 1 never cancels it). A Route 2 NO (the lot inside SRA features, none Very High) establishes that route's NO, but c stays unknown: a NO needs both routes, and every GOV §51178 record fails with `statutory_route_record_kind_undefined`.

**d, High.** YES when the whole legal lot lies in High. NO when SRA features cover the whole lot, the High class is defined there, and no part of the lot is High, so a lot wholly in Very High, Moderate, or both is a d-NO (other criteria handle their own classes). FRA or LRA land (no SRA feature), partial coverage by SRA, and partial overlap with High are unknown.

**Still impossible without GOV §51178:** c can never clear; a §51178 determination (including the LRA maps local agencies adopt from CAL FIRE's recommendations) never establishes c; c's `statutory_route_recorded` gate stays unmet, so c cannot be promoted.

## Promotion gates after Phase 3D

| | Unmet under the shipped registries (no human record) |
| --- | --- |
| c | `statutory_route_recorded`, `reviewer_confirms_encoded_rule`, `human_verification_record` |
| d | `reviewer_confirms_encoded_rule`, `human_verification_record` |
| e, f, g | unchanged: every non-reviewer gate still unmet |

The package meets every non-reviewer gate of d. d stays `pending_human`: it has no encoded rule and no human verification record, and promotion needs both, as an explicit later human step. The Phase 3B guard that fails on any c-g human record is unchanged.

## Large GIS artifacts

This first package commits the exact 36 MB ZIP so the source is reproducible offline (D6); it lives under `app/fixtures/`, outside public assets and build output. Future large GIS revisions should be evaluated for an immutable external artifact store, pinned by SHA-256, rather than assuming every revision belongs in Git history.

## Earlier tests updated

Assertions that described the pre-3D state (empty registries, no host exception, exactly five captures, the v2 type list, gates all unmet, promotion impossible for d with a complete record) are updated where Phase 3D supersedes them and marked in place. Their hazard helpers gain a TEST-ONLY package and lot overlay, so every earlier hazard test still asserts the same behavior. `authority-package.ts` joins `proposed-verification.ts` as a test-time module that production never imports.

## Evaluator and demo output

| | Before (main) | After |
| --- | --- | --- |
| Evaluator SHA-256 | `68341529825b41e7dcd3b25a5daec94385fe6641e07cc03d29003c94c256b45a` | `68341529825b41e7dcd3b25a5daec94385fe6641e07cc03d29003c94c256b45a` |
| Public-demo SHA-256 | `11081860902438dd881cb743c98de30f4b4c3c425675a6e0eb2b6d41474a84a1` | `11081860902438dd881cb743c98de30f4b4c3c425675a6e0eb2b6d41474a84a1` |

Unchanged: the fictional fixture has no authority sidecar and every c-g criterion is still pending, so the gate never runs on it.

## Not in Phase 3D

- GOV §51178, its record kind, and any LRA map.
- Promoting c or d, encoding their rules, or any human verification record.
- The case-scoped evidence store for lot geometry (D10), and any real lot result.
- Any criterion other than c and d, and G1 or G2.
