# Property Evidence — 9854 W Vidor Drive, Los Angeles, CA 90035

Case ID: `PP-CASE-2026-09-VIDOR`
**Status: VERIFIED against official City record — 2026-09-21**

## Source of record

| | |
| --- | --- |
| Document | **Parcel Profile Report**, City of Los Angeles Department of City Planning (ZIMAS) |
| Subject | 9854 W VIDOR DR · APN **4330005041** · PIN **132A165 351** |
| Report date | **2026-09-20** |
| Retrieved / extracted | 2026-09-21 |
| Authority | **`official`** |
| Local copy | `sources/ZIMAS-2026-09-20-parcel-profile-9854-W-Vidor-Dr.txt` |

This supersedes the aggregator-derived baseline of the prior pass. Fields the
report does not carry remain `unknown`; its silence is not a negative finding
(`PROJECT_LAWS.md` Law 4).

---

## §1. Identity and jurisdiction — CONFIRMED

| # | Field | Verified value | Class |
| --- | --- | --- | --- |
| E-01 | Address | 9854 W Vidor Dr. Parcel also carries **9856, 9856½ and 9858 W Vidor Dr** | `confirmed_fact` |
| E-02 | Jurisdiction | **City of Los Angeles** | `confirmed_fact` |
| E-03 | APN | **4330005041** (4330-005-041) | `confirmed_fact` |
| E-03a | PIN | 132A165 351 | `confirmed_fact` |
| E-03b | Legal | **TR 11106, Lot 85**, M B 203-19/22, Block None, Arb None | `confirmed_fact` |
| E-05 | Community Plan | **West Los Angeles** | `confirmed_fact` |
| E-05a | Area Planning Commission | West Los Angeles APC | `confirmed_fact` |
| E-05b | Neighborhood Council | **South Robertson NC** | `confirmed_fact` |
| E-05c | Council District | **CD 5 — Katy Young Yaroslavsky** | `confirmed_fact` |
| E-05d | LADBS District Office | West Los Angeles | `confirmed_fact` |
| E-05e | Census Tract | 2690.00 | `confirmed_fact` |

**Note on E-01:** four street addresses on one parcel independently corroborates
the four-unit count.

---

## §2. Zoning and land use — CONFIRMED, with one unresolved qualifier

| # | Field | Verified value | Class |
| --- | --- | --- | --- |
| E-04 | **Zoning** | **`[Q]R3-1-O`** | `confirmed_fact` |
| E-04a | General Plan Land Use | **Medium Residential** | `confirmed_fact` |
| E-04b | General Plan Note(s) | Yes | `confirmed_fact` |
| E-04c | **Minimum Density Requirement** | **Yes (Citywide)** | `confirmed_fact` |
| E-06 | **Lot / Parcel Area (ZIMAS calculated)** | **5,974.5 sq ft** | `confirmed_fact` |
| E-06a | APN Area (County Public Works) | 0.138 ac (≈6,011 sf) | `confirmed_fact` |
| E-12 | Specific Plan | **West Los Angeles Transportation Improvement and Mitigation** (ZI-2192). Subarea: None | `confirmed_fact` |
| E-12a | Zoning Information | ZI-2192 (WLA TIMP); **ZI-2512 Housing Element Sites** | `confirmed_fact` |
| E-12b | CDO / CPIO / CUGU / NSO / POD / RFA / RIO / Sign District | **All None or No** | `confirmed_fact` |
| E-23 | Case numbers | CPC-7571, **CPC-2018-7546-CPU**, CPC-2014-1457-SP, CPC-2009-1536-CPU, **CPC-1988-341-ZC**, ORD-186108, ORD-183497, ORD-171492, ORD-165986, ORD-129279, ORD-109734, ZA-1993-1046-SP, ZA-1960-15466, ZA-14423, ENV-2014-1458, ENV-2009-1537, ENV-2005-8253-ND, ND-89-255-ZC, MND-89-719-SUB | `confirmed_fact` |
| E-23a | Recent Activity | **None** | `confirmed_fact` |

### E-04d · The `[Q]` qualifier — the most consequential unresolved item

The zone string is `[Q]R3-1-O`, decomposing as: `[Q]` qualified condition ·
`R3` Multiple Dwelling · `-1` Height District 1 · `-O` Oil Drilling District.

**The `[Q]` condition's operative text is not in this report.** ZIMAS lists
case **CPC-1988-341-ZC**, described as *"ZONE CHANGE TO LIMIT THE LAND SO
DESIGNATED TO THE **RD1.5 DENSITY** FOR PROPERTY IN THE VICINITY OF PICO
BOULEVARD AND BEVERWIL DRIVE."*

If that case is the source of this parcel's `[Q]`, the density consequence is
severe:

| Density basis | Lot area ÷ factor | Permitted units |
| --- | --- | --- |
| R3 unqualified (1 per 800 sf) | 5,974.5 ÷ 800 | **7** |
| RD1.5 (1 per 1,500 sf) | 5,974.5 ÷ 1,500 | **3** |
| **Existing** | — | **4** |

Under an RD1.5 cap the existing four units would **exceed** permitted density
and stand as legal nonconforming — meaning **zero residual density**.

**Class: `unverified_evidence`.** ZIMAS reports the case and the zone string
but does **not** state that this case produced this parcel's `[Q]`, nor does it
reproduce the condition text. Attribution is inference. **Resolve by pulling
the ordinance (ORD-165986 is the likeliest candidate by era) or the `[Q]`
condition text from City Planning.** Until then, no unit yield may be quoted.

---

## §3. Building and assessor data — CONFIRMED

| # | Field | Verified value |
| --- | --- | --- |
| E-07 | Use Code | **0400 — Residential, Four Units (Any Combination), 4 Stories or Less** |
| E-08 | **Number of units** | **4** (Building 1; no data for Buildings 2–5) |
| E-09 | Building square footage | **4,092.0 sq ft** · 8 bedrooms · 4 bathrooms |
| E-10 | **Year built** | **1947** |
| E-10a | Assessed land value | $703,561 |
| E-10b | Assessed improvement value | $407,690 |
| E-10c | Last owner change | **2021-02-18** |
| E-10d | Last sale amount | **$560,000** |
| E-10e | Tax Rate Area | 67 |

**The prior pass's aggregator figures (4 units, 4,092 sf, 8bd/4ba, built 1947)
were correct in every particular.** They were nonetheless properly held at
`medium` confidence until an official source confirmed them — being right by
luck is not the same as being evidenced.

---

## §4. Housing status — the decisive section

| # | Field | Verified value | Class |
| --- | --- | --- | --- |
| E-11 | **Rent Stabilization Ordinance (RSO)** | **No** `[APN: 4330005041]` | `confirmed_fact` |
| E-11a | **Ellis Act Property** | **Yes — Date Filed on 2017-05-15**, 9854 W Vidor Dr, APN 4330005041 | `confirmed_fact` |
| E-11b | **Just Cause for Eviction Ordinance (JCO)** | **Yes.** Report note: *"The Just Cause Ordinance applies after the expiration of the initial lease or after 6 months of continuous occupancy, whichever comes first."* | `confirmed_fact` |
| E-11c | **HCA / Resident Protections Ordinance Replacement Review** | **Yes** | `confirmed_fact` |
| E-11d | **Housing Element Site** | Yes (ZI-2512). **HE Replacement Required: Yes.** SB 166 Units: Appendix 4.1 — **0.15** | `confirmed_fact` |
| E-11e | **Housing Use within Prior 5 Years** | **Yes** | `confirmed_fact` |
| E-11f | Inclusionary Housing | No | `confirmed_fact` |
| E-11g | Local Affordable Housing Incentive | No | `confirmed_fact` |
| E-11h | Affordable Housing Linkage Fee | Neighborhood **Pico-Robertson**; Residential Market Area **Medium/Low**; Commercial Market Area High | `confirmed_fact` |

### E-11i · Why does a 1947 four-unit property show RSO = No?

**The report states the fact. It does not state the reason. The reason is
`unknown`.** (`PROJECT_LAWS.md` Laws 1, 3 and 7 — AI may propose questions but
may not silently resolve factual uncertainty.)

What the record *does* establish is that **two housing fields on the same
official record sit in tension on their face**: a 1947 four-unit residential
building would ordinarily fall inside the RSO coverage test (City of Los
Angeles, certificate of occupancy before 1978-10-01, two or more units), yet
the City reports `RSO: No` **and** `Ellis Act Property: Yes (2017-05-15)`.

Candidate explanations, none adopted:

| # | Candidate | What would confirm it |
| --- | --- | --- |
| 1 | **Ellis Act withdrawal (2017-05-15) removed the units from the rental market**, and the RSO field reflects post-withdrawal status | LAHD withdrawal record and current RSO registration history |
| 2 | Permanent removal from rental use / change of use | LAHD + LADBS records |
| 3 | All four units owner-occupied, so none is a registered rental | LAHD registration record |
| 4 | An exemption certificate (e.g. luxury exemption) | LAHD certificate record |
| 5 | The field reports **registration status**, not **ordinance coverage** | LAHD definition of the ZIMAS RSO field |
| 6 | Data currency or layer lag | LAHD direct confirmation |

Candidate 1 is the most economical reading given that ZIMAS reports both
fields for the same APN — **but the report nowhere states a causal link, and
inferring one would be exactly the kind of tidy-sounding fabrication this
case file exists to prevent.**

**Verdict: `UNKNOWN`, reason `insufficient_evidence`. Requires LAHD.**

### E-11j · What RSO = No does *not* mean

A material misreading risk, stated plainly because it is the most likely way
this record gets misused:

- **It does not mean the property is unprotected.** `JCO: Yes` — just-cause
  eviction protections apply after the initial lease expires or six months of
  continuous occupancy.
- **It does not mean replacement obligations are avoided.**
  `HCA / RPO Replacement Review: Yes` and `HE Replacement Required: Yes`.
- **It does not erase the Ellis filing.** Ellis-withdrawn units are named in
  the RPO's Protected Units definition.
- **It does not mean "no housing here recently."**
  `Housing Use within Prior 5 Years: Yes`.

---

## §5. Transit and incentive designations — CONFIRMED, and mostly negative

| # | Field | Verified value |
| --- | --- | --- |
| E-18 | **Transit Oriented Communities (TOC)** | **Not Eligible** |
| E-18a | **MIIP — Transit Oriented Incentive Area** | **Not Eligible** |
| E-18b | **MIIP — Opportunity Corridors Incentive Area** | **Not Eligible** |
| E-18c | **MIIP — Corridor Transition Incentive Area** | **Not Eligible** |
| E-18d | **AB 2097 — within ½ mile of a Major Transit Stop** | **No** |
| E-18e | **High Quality Transit Corridor (within ½ mile)** | **Yes** |
| E-18f | **AB 2334 — Very Low Vehicle Travel Area** | **Yes** |
| E-18g | **TCAC Opportunity Area** | **Highest** |
| E-18h | **ED 1 Eligibility** | **Eligible Site** |
| E-18i | Adaptive Reuse | Citywide Adaptive Reuse Program |
| E-18j | Urban Agriculture Incentive Zone | **Yes** |
| E-18k | Redevelopment Project Area / Opportunity Zone / Enterprise Zone / JEDI / Hubzone / BID | **All None or No** |

### E-18l · The two transit fields that appear to contradict each other

`AB 2097: within ½ mile of a Major Transit Stop = **No**` while
`High Quality Transit Corridor within ½ mile = **Yes**`.

**These are not in conflict — they are different statutory tests**, and
conflating them is an easy and expensive error:

- A **major transit stop** is a rail/ferry station or the intersection of two
  or more bus routes at high peak frequency. It is the trigger for TOC, MIIP
  TOIA, AB 2097 parking elimination, and SB 79.
- A **High Quality Transit Corridor** is a *corridor* with bus service at
  ≤15-minute peak headways. Being near the corridor is not being near a stop
  that qualifies.

The parcel is near a frequent bus corridor but **not** near a qualifying stop.
That single distinction forecloses most transit-based programs here, and the
three `Not Eligible` MIIP rows and `TOC: Not Eligible` independently confirm
the City reached the same conclusion.

---

## §6. Physical, environmental and hazard constraints — CONFIRMED

| # | Field | Verified value | Effect |
| --- | --- | --- | --- |
| E-15 | Hillside Area (Zoning Code) | **No** | Hillside ordinance does not apply |
| E-15a | Hillside Construction Regulation | No | — |
| E-16 | **Very High Fire Hazard Severity Zone** | **No** | Chapter 7A / WUI does not apply |
| E-16a | Fire District No. 1 | No | — |
| E-17 | **Coastal Zone** | **None** | Coastal Act does not apply |
| E-19 | **Methane Hazard Site** | **Methane Zone** | **Methane mitigation required for new construction — real cost** |
| E-19a | **Special Grading Area** (BOE Basic Grid Map A-13372) | **Yes** | **BOE grading review — real cost** |
| E-19b | Liquefaction | No | — |
| E-19c | Landslide | No | — |
| E-19d | Alquist-Priolo Fault Zone | No | — |
| E-19e | Nearest fault | **Santa Monica Fault, 1.66 km**, Type B, slip 1.0 mm/yr, max magnitude 6.6 | Seismic design input |
| E-19f | Flood Zone | **Outside Flood Zone** | — |
| E-19g | Tsunami / Sea Level Rise / Watercourse / Streams | No | — |
| E-19h | High Wind Velocity Area | No | — |
| E-19i | Airport Hazard | None | — |
| E-19j | Wells / Oil Well Adjacency | None / No | Despite the `-O` Oil Drilling District suffix |
| E-19k | Biological / SEA / habitat / Santa Monica Mountains Zone | All No or None | — |
| E-19l | **Universal Planning Review Service Applicability** | **Needs Review** | Procedural flag — meaning unresolved |
| E-19m | 500 Ft School Zone / 500 Ft Park Zone / Building Line | None | — |

Every prior-pass guess in this section (not hillside, not coastal, not
VHFHSZ) proved correct — but **two constraints nobody anticipated are now
confirmed: the Methane Zone and the Special Grading Area.** Both add cost to
any new structure, including an ADU.

---

## §7. Fields the report does NOT carry — still `unknown`

| # | Unknown | Why it still matters | Source |
| --- | --- | --- | --- |
| E-20 | **Permit history / open permits** | Legal unit count, unpermitted work | LADBS |
| E-21 | **Certificate of occupancy date** | Independent RSO/JCO check | LADBS |
| E-24 | **`[Q]` condition operative text** | **Decides residual density — see §2** | ORD / City Planning |
| E-25 | **SHRA / SB 684 eligibility flag** | **Not printed in this report.** It is an interactive-only ZIMAS hyperlink | ZIMAS interactive |
| E-26 | **RSO = No, reason** | Governs how the Ellis history is read | LAHD |
| E-27 | Ellis Act current status and re-rental restrictions | Timing strategy — see `PROGRAM_MATRIX.md` | LAHD |
| E-28 | Existing building footprint, coverage, setbacks, parking | ADU site capacity | Survey |
| E-29 | Recorded CC&Rs / easements | Private restrictions | County Recorder |
| E-30 | Current occupancy of the four units | SHRA tenant test; JCO exposure | Owner |
| E-31 | SB 79 / Low-Rise eligibility layers | Confirmation of §5 reading | ZIMAS interactive / SCAG |

---

## §8. Scorecard — prior pass vs. official record

| Prior-pass position | Official record | Outcome |
| --- | --- | --- |
| Jurisdiction = City of LA (unverified) | Confirmed | ✅ |
| Zoning likely LAR3 | `[Q]R3-1-O` | ✅ **but the `[Q]` was missed entirely** |
| Community Plan likely West LA | Confirmed | ✅ |
| 4 units, 4,092 sf, 1947 (aggregator) | Confirmed exactly | ✅ |
| Lot size unknown | **5,974.5 sf** | ✅ resolved |
| APN unknown; 3 candidates rejected | **4330005041** — all 3 candidates were wrong | ✅ **rejection was correct** |
| Not hillside / not coastal / not VHFHSZ | Confirmed | ✅ |
| No positive HPOZ indication | HPOZ None, Historic Review No | ✅ |
| **RSO presumptively applicable** | **RSO: No** | ❌ **WRONG** |
| Transit designations unknown | TOC / all MIIP areas **Not Eligible**; no major transit stop | ✅ resolved — **negative** |
| Ellis Act history | Not considered at all | ❌ **MISSED** |
| Housing Element site / HE replacement | Not considered at all | ❌ **MISSED** |
| Methane Zone / Special Grading Area | Not considered at all | ❌ **MISSED** |
