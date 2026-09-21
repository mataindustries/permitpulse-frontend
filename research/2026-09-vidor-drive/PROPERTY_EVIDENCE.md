# Property Evidence — 9854 Vidor Drive, Los Angeles, CA 90035

Case ID: `PP-CASE-2026-09-VIDOR`
Retrieval date for every row: **2026-09-21**
Evidence model: `app/src/shared/build-week-integrity/types.ts` → `CanonicalEvidenceRecord`

## Standing limitation on this entire file

No government source was retrieved this session (`RESEARCH_LEDGER.md` §0).
Every row below is therefore either `unknown` with
`reason: retrieval_failed`, or an observation from a **third-party
aggregator** whose own source and currency we could not inspect.

**Nothing in this file is a confirmed fact.** In the repo's vocabulary
(`PacketInformationClass`), no row qualifies as `confirmed_fact`; rows are
`unverified_evidence` or `missing_information`.

---

## §1. Baseline table

| # | Field | Value | Classification | Source | Authority | Confidence | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| E-01 | Street address | 9854 Vidor Dr, Los Angeles, CA 90035 | `client_provided_information` | Harper Halprin, direct written statement | `client` | High | Client-stated. Not independently geocoded against an official address point. |
| E-02 | Jurisdiction | City of Los Angeles (presumed) | `unverified_evidence` | Inference from ZIP 90035 + aggregator "Los Angeles" labeling + neighbor parcels carrying **LA**R3 (a City of LA zone string) | `derived` | Medium | **Not confirmed.** 90035 abuts Beverly Hills, Culver City, and LA County unincorporated pockets. A jurisdiction error invalidates the entire analysis. Resolve via ZIMAS or Assessor. |
| E-03 | APN | **UNKNOWN** | `missing_information` | — | — | — | `normalized_value: {kind:"unknown", reason:"retrieval_failed"}`. Three unrelated APNs surfaced in search noise; see `CONFLICTS_AND_UNKNOWNS.md` §C-01. **Do not use any of them.** |
| E-04 | Current zoning | **UNKNOWN for this parcel.** Even-numbered side reports `LAR3`; **the street is zoning-mixed.** | `unverified_evidence` | Redfin pages for 9836 #1B, 9800, 9880 Vidor Dr; LoopNet 9800 Vidor Dr | `third_party_aggregator` | **Low** (downgraded) | **9875 Vidor Dr reports as a single-family property.** The street contains both single-family and multifamily. Adjacency reasoning is therefore demonstrably unsafe *on this street*. See `ADVERSARIAL_REVIEW.md` §A-02. ZIMAS is the source of record. |
| E-05 | General Plan / Community Plan | **UNKNOWN.** Likely West Los Angeles Community Plan area. | `missing_information` | Westside Community Plans Update scope names the West LA CPA | `official_unretrieved` | Low | The CPA boundary was not verified for this address. |
| E-06 | Lot size | **UNKNOWN.** Neighboring lots 5,976 sf / ~6,534 sf / 12,340 sf. | `missing_information` | Redfin, LoopNet | `third_party_aggregator` | None for subject | Lot area is an input to nearly every program test below. Must come from the Assessor or ZIMAS. |
| E-07 | Existing use | Residential, multi-unit (reported) | `unverified_evidence` | Redfin / Spokeo / PropertyShark descriptions | `third_party_aggregator` | Medium | Consistent across three aggregators, which share upstream data and are not independent. |
| E-08 | Existing unit count | **4 units reported** ("Quadplex, 4 Units, Any Combination") | `unverified_evidence` | Redfin property id `6810133`; PropertyShark property id `16212216`; Spokeo | `third_party_aggregator` | Medium | **This is the single most consequential unverified fact in the case.** It drives the ADU cap, the RSO question, and the protected-housing bar. |
| E-09 | Building size | 4,092 sf reported; 8 bd / 4 ba | `unverified_evidence` | Redfin | `third_party_aggregator` | Medium | Consistent with 4 × ~1,000 sf 2-bedroom units. |
| E-10 | Year built | **1947 reported** | `unverified_evidence` | Redfin | `third_party_aggregator` | Medium | **Decisive if true** — see E-11. Year built ≠ certificate of occupancy date, which is the RSO trigger. |
| E-11 | RSO (rent stabilization) status | **UNKNOWN — presumptively applicable** | `warning` | LAHD: RSO covers City of LA buildings with a certificate of occupancy before **1978-10-01** containing **2+ units** | `official_unretrieved` | — | If E-02, E-08 and E-10 all hold, the parcel meets the test on its face. **Presumption, not a determination.** Known exemptions that could defeat it: detached single-family with one unit on the parcel (non-corporate owner); individually-owned condominiums (unless converted from a pre-1978 apartment building); pre-1978 Luxury Exemption Certificates; **a certificate of occupancy issued within the last 15 years**. Note **year built ≠ C-of-O date**, and the C-of-O is the trigger. Nearby 9800 and 9880 Vidor Dr report 1990 construction and *not* rent-controlled — so RSO is a property of the building, not the block. See `ADVERSARIAL_REVIEW.md` §A-03. |
| E-12 | Overlays | **UNKNOWN** | `missing_information` | — | — | — | Specific plan, CDO, CUGU, POD, RFA, sign district — none checked. |
| E-13 | Specific plan | **UNKNOWN** | `missing_information` | — | — | — | |
| E-14 | HPOZ / historic status | **UNKNOWN — no positive indication** | `missing_information` | LA has 35 HPOZs; partial list surfaced does not name Beverlywood or Castle Heights | `official_unretrieved` | Low | Absence from a partial list is **not** evidence of absence (Law 4). Also unchecked: HCM status, SurveyLA findings, California Register eligibility. A 1947 building can be a survey-identified resource. **Material: the Low-Rise Ordinance exempts HPOZs and HCMs.** |
| E-15 | Hillside status | **UNKNOWN — likely not** | `missing_information` | Area is described as flat urban fabric between Pico Blvd and the I-10 | `derived` | Low | ZIMAS carries the Hillside Area flag. Not checked. |
| E-16 | Fire hazard (VHFHSZ) | **UNKNOWN — likely not** | `missing_information` | Dense flat urban area, not a wildland interface | `derived` | Low | Not checked against ZIMAS **or** CAL FIRE. The repo already ships a fixture for exactly the case where these two disagree (`fire-hazard-official-source-conflict.json`) — so a single source would not have settled it anyway. |
| E-17 | Coastal zone | **NOT APPLICABLE** | `unverified_evidence` | Location ~6 miles inland | `derived` | High | The only baseline item this pass can answer with real confidence. |
| E-18 | Transit designations (TOC tier / CHIP incentive area / SB 79 tier / Low-Rise station area) | **UNKNOWN — all four** | `missing_information` | — | — | — | All four are published in ZIMAS; SB 79 tiers also in the SCAG map. **None checked.** This is the largest open upside in the case. |
| E-19 | Environmental constraints | **UNKNOWN** | `missing_information` | — | — | — | Methane zone, liquefaction, fault (Newport-Inglewood trends through the Westside), oil field. All ZIMAS layers. Unchecked. |
| E-20 | Permit history | **UNKNOWN — no record retrieved** | `missing_information` | LADBS routes identified but blocked | `official_unretrieved` | — | `reason: retrieval_failed`. Per `docs/content-packets/PP-2026-001`: this is "official route checked but not retrieved", **not** "no permits exist". |
| E-21 | Certificate of occupancy | **UNKNOWN** | `missing_information` | — | — | — | The RSO trigger. Highest-value single retrieval after ZIMAS. |
| E-22 | Recorded conditions (CC&Rs, easements, Ellis filings) | **UNKNOWN** | `missing_information` | — | — | — | Beverlywood Homes Association CC&Rs restrict member lots to single-family use. Whether Vidor Dr is a member tract is unresolved (§C-03). Note: state ADU law voids many private restrictions on ADUs, but that interaction is fact-specific. |
| E-23 | Prior planning cases | **UNKNOWN** | `missing_information` | — | — | — | ZIMAS lists case numbers (ZA/CPC/DIR/ENV/VTT). Unchecked. |

---

## §2. Derived observations (analysis, not evidence)

Recorded separately so they never read as facts (Law 8).

- **O-01 — The even-numbered side of the 9800 block of Vidor Drive presents
  as established low-rise multifamily; the street as a whole is mixed.**
  Basis: 9800, 9836 and 9880 carry `LAR3`; listings reference condominium unit
  numbers (`#103`, `#104`, `#301`, `#401`, `#402`, `1B`); building-to-lot
  ratios (11,859 sf on ~6,534 sf) indicate multi-story multifamily. **But
  9875 Vidor Dr reports as single-family**, so the street is not uniform and
  the subject's zone cannot be inferred from its neighbours. This matters
  because several of the programs Harper named turn on single-family zoning.
- **O-02 — The reported 1947 / 4-unit combination puts the property inside
  LA's rent-stabilization perimeter on its face.** Basis: E-02 + E-08 + E-10
  against the LAHD coverage test. This is the pivot of the whole case and is
  currently supported only by aggregator data.
- **O-03 — The property profile is "already-built small multifamily",
  not "underused land".** Most of the programs Harper named were written for
  vacant or single-family sites. This is the central mismatch in the case and
  the likely reason she found the programs hard to apply to her own property.

---

## §3. Evidence register in repo form

Modeled on `app/fixtures/case-integrity/*.json`. Illustrates how this case
would enter the Case Integrity Engine. **Not wired to any code; no production
file was modified.**

```json
{
  "id": "evidence-vidor-unit-count",
  "subject": { "case_id": "PP-CASE-2026-09-VIDOR", "property_id": null },
  "claim": {
    "key": "existing-dwelling-unit-count",
    "label": "Existing dwelling units on parcel",
    "client_label": "how many units the property currently has"
  },
  "source": {
    "agency": "Redfin / PropertyShark (third-party aggregators)",
    "title": "Listing profile for 9854 Vidor Dr",
    "description": "Aggregator description reporting a 4-unit quadplex built 1947.",
    "url": "https://www.redfin.com/CA/Los-Angeles/9854-Vidor-Dr-90035/home/6810133",
    "authority": "unofficial",
    "retrieved_at": "2026-09-21T03:30:00.000Z"
  },
  "raw_observed_value": { "kind": "text", "value": "Quadplex (4 Units, Any Combination)" },
  "normalized_value": { "kind": "unknown", "value": null, "reason": "insufficient_evidence" },
  "evidence_type": "third_party_listing",
  "classification": "source_observation",
  "confidence": 45,
  "conflicts_with": [],
  "review_status": "review_required",
  "notes": [
    "Page was not opened; content known only from a search-engine summary.",
    "Aggregators share upstream data and are not independent corroboration."
  ],
  "limitations": [
    "Not an official record.",
    "No Assessor or LADBS record was retrievable this session.",
    "Unit count drives the ADU cap, RSO status, and the SHRA protected-housing bar."
  ],
  "provenance": {
    "source_record_id": "redfin-6810133",
    "capture_method": "manual_research",
    "is_ai_generated": false
  }
}
```

Note that `normalized_value` is `unknown` even though `raw_observed_value`
carries text. That is deliberate: the aggregator's *statement* was observed;
the *fact* was not established.
