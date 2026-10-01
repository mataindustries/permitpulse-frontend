# Phase 3G: GOV §51178 / 2025 LRA authority package

The owner accepted the Route 1 sufficiency judgment and authorized implementation on September 30, 2026. Work starts from main `e8f071173f2dccd94c0e877c713112c799009716` (merged PR #28), on `program-screen-phase-3g-gov-51178`. This phase supplies authority and overlay infrastructure; it does not promote criterion c.

The original 3G-1 captures, route-specific registration, and pinned deterministic overlay are complete. The capture self-tests, adversarial mutation checks, and complete verification suite pass. Criterion c remains pending; d remains the only human-verified criterion, with counts **1 / 45**. Phase 3G does not start Phase 3H or authorize a merge.

## Accepted authority sufficiency

The exact ZIP's active `GDB_Items` row supplies the missing official link. Its name, physical name, path and definition identify `FHSALRA25_v1_All`; its documentation describes this combined dataset's State Fire Marshal classification under Government Code 51175–51189, followed by recommendation transmittal and separate local ordinance finalization. The statutes identify the specific section governing that State action. Page-level browser findings and the intermediary model inputs are supporting review context, not the operative authority proof.

GOV §51178, captured page 1, states:

> The State Fire Marshal shall identify areas in the state as moderate, high, and very high fire hazard severity zones based on consistent statewide criteria and based on the severity of fire hazard that is expected to prevail in those areas. Moderate, high, and very high fire hazard severity zones shall be based on fuel loading, slope, fire weather, and other relevant factors including areas where winds have been identified by the Office of the State Fire Marshal as a major cause of wildfire spread.

History: SB 63, Stats. 2021, Ch. 382, Sec. 2.5; effective January 1, 2022.

GOV §51179(a), captured page 1, states:

> (a) A local agency shall designate, by ordinance, moderate, high, and very high fire hazard severity zones in its jurisdiction within 120 days of receiving recommendations from the State Fire Marshal pursuant to Section 51178.

Section 51179(g) states:

> (g) A local agency shall post a notice at the office of the county recorder, county assessor, and county planning agency identifying the location of the map provided by the State Fire Marshal pursuant to Section 51178. If the agency amends the map, pursuant to subdivision (b) or (c) of this section, the notice shall instead identify the location of the amended map.

History: AB 211, Stats. 2022, Ch. 574, Sec. 10; effective September 27, 2022. The preserved capture also retains (b)–(f), including the local ability to increase classifications and the prohibition on reducing the State-identified severity. Those local designation facts remain separate.

The active metadata's `/metadata/dataIdInfo/idPurp` reads:

> Under the purpose of fire safety and prevention, and by statutory authority, The State Fire Marshal shall classify lands within Local Responsibility Areas (LRA) into fire hazard severity zones. Each zone shall embrace relatively homogeneous lands and shall be based on fuel loading, slope, fire weather, and other relevant factors present, including areas where winds have been identified by the department as a major cause of wildfire spread.
>
> The California laws and regulations associated with Fire Hazard Severity Zones in LRA are found in California Government Code 51175-51189, and describe the objectives and and processes by which these data are developed, transmitted as a recommendation to local government agencies, and the subsequent required local ordinance adoption and documentation processes to see the zones finalized.
>
> Delivery of Recommended LRA FHSZ data and maps was phased by 4 regional areas of the state. This data set represents all 4 phases combined into one dataset

This establishes State identification under §51178 for the exact combined polygon layer. Recommendation/transmittal describes its delivery to local agencies; it does not turn State identification into local adoption. The accepted Phase 3B/3C c rule requires the State route. City of Los Angeles adoption is neither asserted nor made a gate. A future local adoption capture would establish a separate fact.

The owner reported direct CAL FIRE FHSZ-page and Board of Forestry LRA-adoption-page fetches blocked with HTTP 403. That provenance is retained in the manifest notes. No bypass, repeated discovery, or new source download was attempted.

## Captures and package pins

The original file bytes remain the owner-supplied 3G-1 bytes. Retrieval values preserve the attached UTC sidecars, without replacing them with upload or implementation time.

| Capture ID | Original bytes | Retrieval UTC | Original SHA-256 | Extracted SHA-256 |
| --- | ---: | --- | --- | --- |
| `gcs-51178` | 162914 | `2026-09-30T16:39:05Z` | `d6c0bd92141a950ebf56651a9988679ef6498329daa8fc04144a80611d88b821` | `3eac548aa2e63d82a08fd8996207550e7970715cd17984a7e2a7df4e8cc1fd63` |
| `gcs-51179` | 166101 | `2026-09-30T16:39:17Z` | `fe26edd20837ae19e072fbabcea128bc6a1cb2f4eefae7397e6b8a1d8660ab77` | `821621810e1ad3d87c1b693d85183c45e11c84077ce148c99f8012b56672ada4` |
| `calfire-fhszlra-25-1-all-data` | 9840158 | `2026-09-30T16:39:28Z` | `736fa5231c70b844550784cd13c8d414c239cf9573c9cae6139554ef0bf464b6` | `5724d4a456ddbf7845a116d162d96fc51b4a295c4c05a92d91fb2049cd4f1dad` |

The exact original requested URLs are:

```text
https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?lawCode=GOV&sectionNum=51178.
https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?lawCode=GOV&sectionNum=51179.
https://34c031f8-c9fd-4018-8c5a-4159cdff6b0d-cdn-endpoint.azureedge.net/-/media/osfm-website/what-we-do/community-wildfire-preparedness-and-mitigation/fire-hazard-severity-zones/fhszlra251allgdb.zip?hash=4FE6C7291E09FC36126F91318C6CCB88&rev=c273e91031b6401b99937894df5f1266
```

The supplied §51179 and ZIP response-header sidecars are preserved byte-for-byte as UTF-8 text inside `metadata.json`. Both contain one HTTP 200 block with no Location header. Their recorded final URLs equal their requested URLs, with the explicit basis `inferred_no_redirect_from_supplied_headers`. An original curl `url_effective` value was not supplied; these final URLs are not represented as independently measured redirect outcomes. No new fetch was used to fill that gap. No response-header sidecar was supplied for §51178, and none is invented.

| Header capture | Bytes | SHA-256 |
| --- | ---: | --- |
| `gcs-51179` | 392 | `e4cfb366807e0de2e426c86000b1027b9cba80681f13e7b6ce2dac8c3a70cb5e` |
| `calfire-fhszlra-25-1-all-data` | 636 | `e7b95196f0cfc5495e274110e917f8c0f5d70b0732e5f6553fe4a9a34e37c81f` |

The v2 capture schema checks requested/final URLs, the original header length/hash, response-status trace, and the final-URL inference basis. The exact CDN hostname and ZIP path receive a source-specific reviewed exception; no broad CDN host permission is added. A redirect trace requires an explicitly supplied original effective URL. Existing capture layouts and v1 captures remain unchanged.

Manifest: [calfire-lra-fhsz-2025-03-24-v1.json](../app/fixtures/program-screen/authority-packages/calfire-lra-fhsz-2025-03-24-v1.json), SHA-256 `f86e0a2157f3a44594da51fd2ffeb4e1a19c935ca2f00f0cc40e82df0bd86797`.

Its required members are `identification_statute` (§51178), `local_designation_statute` (§51179), and `overlay_dataset` (the exact vector archive and active metadata). It records `gov_51178`, `state_identification_recommendation`, and currency `until_superseded`. No City ordinance or intermediary raster package is a member. Assertions cite exact captured page text and extracted hashes.

Edition: **Combined Phases, Version 1, map dated 2025-03-24**. The active citation title names `FHSZLRA25_v1_All`; the actual active feature class is `FHSALRA25_v1_All`. Both spellings are preserved. Metadata creation/modification on March 27, 2025 is a technical metadata date. The supplied HTTP Last-Modified date in May 2025 is delivery provenance, not a map edition, local adoption or effective date.

Active metadata association:

| Item | Pin / value |
| --- | --- |
| GDB | `FHSZLRA25_1_All.gdb` |
| Active GDB_Items FID | `3` |
| Name | `FHSALRA25_v1_All` |
| PhysicalName | `FHSALRA25_V1_ALL` |
| Path | `\FHSALRA25_v1_All` |
| Definition DSID | `3` |
| Catalog slot / native feature table | `9` / `a00000009.gdbtable` |
| Metadata XML SHA-256 | `1bbf01d7df12ebaf60376c95a23305dcfc63d81d49e3661ac4395c17591bfbbb` |
| Definition SHA-256 | `05724568962346a1997adc3d17b538d32afc148795101cacf95f2a91a1aa925e` |
| GDB_Items table SHA-256 | `0a6e833aa0eecc975b3c123fad182fa1f31f2e1395ea9382aa07e25e5e76fa6e` |
| Feature table SHA-256 | `f253e6f0b68481d5d556ecaf1dfe42ac01e2445f5a060f15cfe4632ff41ae6e9` |
| Canonical association JSON SHA-256 | `1beaa8c4ffbd91a9ec2e741bd0bdf3194cf7cf480386b2f5144f22622cbd0eed` |

The FileGDB reader follows active `.gdbtablx` slots and the system catalog. Deleted metadata snapshots in the table are not selected by scanning for XML. The exact original XML remains inside the preserved ZIP; extraction includes its active row identity and digest. Re-extraction verifies the association. The metadata DSID must not be confused with the physical catalog/table slot.

Retained, non-authoritative inherited metadata:

- `/metadata/dataIdInfo/idCitation/date/pubDate`: `2022-04-12`.
- `/metadata/dataIdInfo/idCitation/resEd`: `22_2`.
- `/metadata/eainfo/detailed/enttyp/enttypl`: `FHSZSRA_DRAFT22_1`.
- Both theme and search keyword paths, including `State Responsibility Area` and `SRA`.

None supplies authority, edition, responsibility area or classification. None is deleted or rewritten.

## Registry and route separation

The issuer `calfire-osfm` is reused unchanged. The new source/package is `calfire-lra-fhsz-2025-03-24-v1`, with record kind `agency_hazard_map`. Source status is State identification/recommendation, distinct from the SRA package's PRC §4202 adoption.

Only `very-high-fire-hazard-severity-zone` gains an LRA establishing entry. Its original SRA entry remains unchanged. The High policy retains only SRA. Package variants, registry validation and the record gate bind issuer, edition, capture, package route and overlay independently, despite both routes using the same record kind. An SRA source cannot establish §51178 evidence; LRA cannot establish §4202 evidence or criterion d.

The c source gate now requires a registered package for each route, rather than relying on their shared record kind alone. Wiring remains present when a source is superseded; runtime source-currency checks make that lot result unknown. This preserves d's existing superseded-source behavior. Criterion requirements and decided gates are unchanged. Criterion c remains `pending_human`, `not_encoded`, with no human-verification record.

## Deterministic overlay

`program-screen-overlay-index` **2.0.0** reads the native FileGDB feature class. The existing SRA 1.0.0 index and pin are unchanged. LRA index SHA-256: **`5167cbf7029ea3fc051331d2c2de4d1611feb88783e38a852f678b94b275a716`**.

The index pins the archive, active XML, association, native feature table, decoder versions, all 9752 ordered active FIDs, full semantic labels, source validity, evaluator readability, bounding extents, and canonical per-feature byte lengths/hashes. Records retain polygon/ring grouping and all decoded double coordinates in EPSG:3310. Curved features retain native ISO WKB. Shortest round-trip JSON numbers preserve decoded coordinates; there is no coordinate transformation, snapping, tolerance, simplification, densification or repair.

| Authoritative label | Secondary code check | Features | Overlay class |
| --- | ---: | ---: | --- |
| Very High | 3 | 1008 | `very_high` |
| High | 2 | 2049 | `high` |
| Moderate | 1 | 4741 | `moderate` |
| NonWildland | -3 | 1954 | `non_wildland` |

All features carry `SRA=LRA`, a code and a full `FHSZ_Description`. The full label drives semantics; numeric codes are consistency checks only. NonWildland means explicit source coverage that is not Very High for c. It is never called Moderate or absence of wildfire hazard.

The data supports parcel-scale intersection once independently reviewed legal-lot geometry is verified in EPSG:3310. It does not establish legal-lot identity itself. The private case store accepts either pinned CAL FIRE index and verified candidate records. `loadCaseLraOverlay` is a separate Route 1 loader; the Phase 3F d evaluator continues to use its SRA loader. No c evidence is automatically promoted or added to the public demo.

GDAL **3.10.3** / GEOS **3.13.1** run only offline. The TypeScript builder checks native FIDs/attributes independently, and refuses a final index that differs from the reviewed pin. See [offline reproduction](../tools/program-screen/README.md). Runtime has no GDAL dependency. Derived records are private ingestion artifacts, outside public assets.

## Invalid and unreadable features

The 119 GEOS-invalid features remain indexed: **11 Very High, 20 High, 70 Moderate, 18 NonWildland**. No feature is automatically repaired and the dataset is not rejected for having them.

Native inspection additionally found 30 curved MultiSurface features. Two are already among the 119 invalid features. The other 28 are valid curves but unreadable to the exact straight-edge evaluator. Their WKB is preserved; they are not flattened. The index therefore has **9605 valid/evaluable, 119 invalid, 28 unreadable** states.

Closed bounding extents select every source feature that could intersect the lot. An invalid or unreadable candidate makes that route unknown, before its geometry is used. An unreadable feature without a trustworthy extent is conservatively an unbounded candidate. An invalid feature elsewhere in California does not block an unrelated lot. A missing candidate record is unknown, never treated as no feature. Verified index and record hashes prevent changing validity, labels, bounds or coordinates at evaluation.

## Route 1 matrix

The existing exact lot-overlay algorithm computes complete source coverage and classes. No percentage threshold is used.

| Reviewed lot / source evidence | Route 1 |
| --- | --- |
| Whole lot, recognized complete coverage, only Very High | YES |
| Whole lot, complete High coverage | NO |
| Whole lot, complete Moderate coverage | NO |
| Whole lot, complete NonWildland coverage | NO |
| Whole lot, complete mixed recognized classes with no Very High | NO |
| Mixed Very High with another class | unknown |
| Partial coverage, internal gap, outside package coverage | unknown |
| Missing candidate geometry / record | unknown |
| Invalid or unreadable candidate geometry | unknown |
| Unknown semantic label on the lot | unknown |
| Unclear legal-lot identity | unknown |
| Wrong route, issuer, edition, capture, or superseded source | unknown |
| Manual coverage / class attestation contradicting computed geometry | unknown |

A qualified YES on either statutory route supplies the approved positive result. Clearing needs independently qualifying NO on both routes. Route 1 NO alone never clears c. Shipped c still runs no predicate; its outcome ceiling is unchanged.

## Verification results

The complete app `npm run check` passes: type checking, **45 test files / 1451 tests**, OS foundation verification, and production build. This includes all 48 Phase 3E tests, all 48 Phase 3F tests, and **58 Phase 3G tests**: 35 runtime overlay tests, 17 package/native capture tests, and 6 HTTP provenance tests. Older inventory assertions account for the added official captures and independently reviewed LRA package; historical decision artifacts remain unchanged. The build reports the existing local secret and bundle-size warnings; no deployment was attempted.

The root public-site `npm run check` passes **351 validations / 0 failures**. `npm run program-screen:capture:selftest` passes, including deterministic byte-for-byte recapture of all three Phase 3G captures and their supplied transport provenance. `npm run program-screen:capture:verify` verifies **16 captures**: 11 official and 5 existing synthetic. Original HTML/ZIP and header text are also compared directly with the owner-supplied attachments; all original bytes, lengths, hashes and UTC retrieval times match.

The complete test suite reads the preserved original ZIP and independently re-derives the 9752-feature index through pinned GDAL/GEOS. Offline CLI reproduction also produces the exact reviewed index hash. Native XML and metadata-to-layer mutations are rejected through archives with correctly recalculated ZIP CRCs. A timestamp-only archive mutation is rejected by the original-byte hash pin, independently of XML or extracted text integrity.

Adversarial coverage includes archive/XML/association mutation, wrong issuer/edition/route, both package masquerades, High attempting c, LRA attempting d, all four whole-lot labels, mixed classes, partial/gapped/outside coverage, missing records, relevant/irrelevant invalid geometry, unreadable curves, unknown labels, manual attestations, supersession, legal identity and the two-route clearing rule. Package tests reach native metadata mutations through correctly recalculated ZIP CRCs. The archive-hash mutation changes only a ZIP timestamp so CRC or extracted-text rejection cannot mask the original-byte hash check.

All **12 executable code mutations** were killed by assertion failures, with every original source byte restored:

| Bypass mutation | Detecting test |
| --- | --- |
| Ignore invalid candidate state | relevant invalid geometry |
| Reject all parcels for invalid geometry elsewhere | irrelevant invalid geometry |
| Accept partial coverage | partial coverage |
| Accept any Very High overlap as whole-lot YES | mixed Very High / High |
| Trust the manual class instead of computed classes | manual class override |
| Remove statutory route/package checks | LRA used as PRC §4202 |
| Ignore index SHA-256 | changed semantic-field index |
| Ignore record SHA-256 | same-length, same-extent coordinate mutation |
| Ignore original archive SHA-256 | timestamp-only archive hash mutation |
| Ignore active metadata XML SHA-256 | native XML mutation with recalculated ZIP CRC |
| Ignore metadata-to-layer identity | native active-row association mutation with recalculated ZIP CRC |
| Ignore response-header SHA-256 | changed original header text |

Reproduce with `python3 tools/program-screen/check-lra-mutations.py --output /tmp/phase-3g-mutations`. It requires all **58 Phase 3G baseline tests** to pass and refuses a tool error as a killed mutation. Logs and JSON results remain outside the public checkout. Each mutation selects its detecting assertion; the final complete suite runs against the restored sources.

Preserved before/after canonical JSON SHA-256:

| Projection / registry component | Before Phase 3G = after Phase 3G |
| --- | --- |
| Evaluator fixture output | `156dd1f41964ab5beebcf3882e0a0d653cc5d778939033bf2b752dba1e86afbc` |
| Public demo output | `4dd2735bab875ad40b123fec72020e16442737bc6b5052eb55c5fba374b9a8a5` |
| Original SRA source registration | `ab5e1ed347a525c41c02f283006247c2162ff4683d9d4478daa404db19af8c9f` |
| Existing issuer | `d0195a3b0f6d6410d7608ead8a938086c1d90bf5e5e7e70d02f6fe42d79f350a` |
| High fact policy | `b23e7487f0a605a6e79a3d5c5278fb0721867391ca6fc8b1099d23320623a396` |
| Criterion authority requirements | `d564bb6184eeae2de8ce22ecbbd139809c52e2309e37e018649ea059ec36b4e6` |

Only d is `human_verified`; 45 remain `pending_human`, including c. G1/G2 remain open. The SRA manifest and all three SRA capture directories, criterion implementations, Phase 3E/3F decisions, reviewed-lot fixtures and normalization profile have no diff. The SRA overlay pin remains `caf01fa68e68b3c368538067f504e6f16ccdf7fdeb91f644114d7c86494589ff`.

GitHub API access is blocked in this environment. This affects PR creation, not Phase 3G implementation or the authorized branch push. If PR creation remains unavailable, the publication handoff includes the pushed branch, commit SHA, remote repository, exact title, and complete PR description. No automatic merge and no Phase 3H work are authorized.
