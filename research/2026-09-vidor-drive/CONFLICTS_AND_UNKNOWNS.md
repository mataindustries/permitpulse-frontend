# Conflicts and Unknowns — 9854 Vidor Drive

Case ID: `PP-CASE-2026-09-VIDOR` · 2026-09-21

Per `PROJECT_LAWS.md` Law 5, contradictory sources remain contradictory until
explicitly resolved, and per Law 6 one source never silently overwrites
another. Nothing below has been resolved by picking a winner.

---

## Part A — Conflicts

### C-01 · Three unrelated APNs surfaced for one address — **none adopted**

| Candidate APN | Where it came from | Assessment |
| --- | --- | --- |
| `8025-001-015` | Top result for the query *"9854 Vidor Dr Los Angeles APN assessor parcel number lot size"*, as `portal.assessor.lacounty.gov/parceldetail/8025-001-015` | **Rejected as unsupported.** No retrieved text ties this APN to the address. |
| `5542-025-002` | Surfaced as `portal.assessor.lacounty.gov/parceldetail/5542025002` in a later search for the same address | **Rejected as unsupported.** |
| `4330-005-092` | LoopNet listing for **9800** Vidor Dr — a *different* address on the same block | Plausibly the correct **book/page neighborhood** (`4330-005-xxx`) for the 9800 block, but **not this parcel**. |

**Status: UNRESOLVED. APN = `unknown`, reason `retrieval_failed`.**

**Why this matters beyond bookkeeping:** a search engine returning an
assessor-portal URL creates a strong false impression of authority. The URL
*is* an official domain. The *association* between that URL and the queried
address is search-engine inference. A researcher in a hurry adopts the first
APN, and every downstream record pull is then silently about a different
property. **This is the most dangerous failure mode encountered in this case.**

### C-02 · SB 684 effective date — two dates in circulation

| Source | Date |
| --- | --- |
| LA City Planning SHRA page (via search summary) | **2024-07-01** |
| Law-firm alert summary | **2024-01-01** |

Likely a chaptered-date versus operative-date distinction, but **not resolved**.
Prefer the LA City Planning date for LA filings. Same pattern for SB 1123:
reported as effective **2025-07-01** by LA City Planning alongside AB 130,
while the bill was chaptered in 2024.

**Status: UNRESOLVED.** Immaterial to eligibility today (all dates have
passed); material to any claim about an application filed in 2024–25.

### C-03 · Beverlywood HOA boundary versus the character of Vidor Drive

The Beverlywood Homes Association covers **1,354 single-family homes** under
binding CC&Rs restricting use to single-family dwellings, bounded by Monte Mar
Dr (N), Robertson Blvd (E), Hillcrest Country Club / Anchor Ave (W), and
Beverlywood St (S).

The 9800 block of Vidor Dr presents as `LAR3` multifamily with condominium
units — inconsistent with an HOA tract of single-family homes.

**Status: UNRESOLVED.** Not established whether Vidor Dr falls inside the
described boundary, and a stated boundary is not a recorded tract map.
Resolve via the recorded CC&Rs and tract map, not the HOA website.

### C-04 · Zoning by adjacency versus zoning of record

Three neighbors report `LAR3`. The subject parcel's zone was never retrieved.
LA zone boundaries can and do split block faces, and listing-site zoning
fields are frequently stale or mis-keyed.

**Status: UNRESOLVED.** Treated throughout as "likely `LAR3`, unverified".

### C-05 · Fire hazard — a conflict we could not even stage

Neither ZIMAS nor CAL FIRE was reachable. The repository already ships
`app/fixtures/case-integrity/fire-hazard-official-source-conflict.json`
precisely because these two official sources are known to disagree on this
flag. A single source would therefore not have settled it.

**Status: UNKNOWN, with a known conflict risk.** Check both.

### C-06 · Vidor Drive is zoning-mixed — adjacency reasoning fails here

Even-numbered addresses on the 9800 block (9800, 9806, 9836, 9880) report as
multifamily, several with `LAR3`. **9875 Vidor Dr reports as a single-family
property** (sold $2,195,000, 2018).

The subject is even-numbered and sits within the multifamily cluster, so the
working assumption probably holds — **but the method used to reach it has been
shown to fail on this very street.** No program verdict may rest on adjacency
alone.

Related: 9800 Vidor Dr ("Vidor Place Apartments") and 9880 Vidor Dr report
**1990** construction, and 9800 is reported **not subject to rent control**.
The block therefore contains both RSO-era and post-RSO buildings. The RSO
presumption for the subject rests entirely on its unverified 1947 date.

**Status: UNRESOLVED.** See `ADVERSARIAL_REVIEW.md` §A-02 and §A-03.

### C-07 · HCD guidance vs. statutory text on "vacant"

HCD guidance dated **2025-10-07** holds that a single-family lot with an
existing home can qualify as "vacant" under SB 1123 once a remainder parcel is
designated for the existing structure. The statutory definition on its face
reads "no permanent structure unless abandoned and uninhabitable."

These are reconcilable only through the AB 130 remainder-parcel mechanic. HCD
guidance is **not binding law**; courts generally defer but interpretation
rests with the judiciary.

**Status: UNRESOLVED IN KIND.** Both readings recorded; neither adopted as
settled. This materially changed the SB 1123 verdict (`ADVERSARIAL_REVIEW.md` §A-01).

### C-08 · SB 79's statewide effect vs. LA's deferral

SB 79 is effective statewide **2026-07-01**. Los Angeles used SB 79's
alternative-compliance provisions to defer citywide application to roughly
**2030**, substituting the Low-Rise Ordinance (effective 2026-06-30). Cities
cannot fully opt out. **LA's deferral is contested.**

**Status: UNRESOLVED.** Treat the Low-Rise Ordinance as the live instrument
and SB 79 as a contested backstop (`ADVERSARIAL_REVIEW.md` §A-05).

---

## Part B — Unknowns that block client advice

Ordered by how much they change the answer.

| # | Unknown | What it blocks | How to resolve |
| --- | --- | --- | --- |
| U-01 | **RSO status of the existing units** | SB 684 protected-housing bar; CHIP replacement obligation; the entire redevelopment pro forma | LAHD RSO lookup + LADBS certificate-of-occupancy date |
| U-02 | **Confirmed zoning** | SB 684 vs SB 1123 vs SB 9; base density; CHIP and Small Lot eligibility | ZIMAS |
| U-03 | **ZIMAS `SHRA / SB 684 Eligibility` flag** | The SB 684 answer, directly | ZIMAS → Planning and Zoning menu |
| U-04 | **SB 79 / Low-Rise eligibility** | Possibly the largest development envelope available | ZIMAS SB 79 + Low-Rise maps; SCAG SB 79 map |
| U-05 | **Confirmed lot area** | Every density and yield calculation in the file | Assessor + ZIMAS |
| U-06 | **Confirmed legal unit count** | ADU cap (detached = existing units; conversion = 25% of existing units); RSO exposure | LADBS records + Assessor |
| U-07 | **Whether new ADUs on a pre-1978 parcel become RSO-covered** | Whether the ADU pathway's economics hold | Written LAHD determination |
| U-08 | **CHIP / MIIP incentive-area designation** | Whether MIIP is even on the table | ZIMAS flag; `CP-4095` maps |
| U-09 | **AB 130 remainder-parcel treatment for an occupied RSO building** | Whether SB 684 revives on this parcel | Statute text + written City Planning position |
| U-10 | **Permit history and open permits** | Unpermitted-work exposure; whether all 4 units are legal | LADBS Property Activity Report |
| U-11 | **Historic status (HPOZ / HCM / SurveyLA)** | Low-Rise Ordinance exempts HPOZs and HCMs; affects demolition and alteration | ZIMAS + Office of Historic Resources |
| U-12 | **Recorded CC&Rs, easements, Ellis filings** | Private restrictions; RPO 10-year Ellis look-back | LA County Recorder |
| U-13 | **Environmental overlays** (methane, liquefaction, fault) | Cost and feasibility of new construction | ZIMAS |
| U-14 | **Westside Community Plans Update draft zoning** | What her zoning becomes, and when | LA City Planning / planningthewestside.org |
| U-15 | **Jurisdiction confirmation** | Everything — a 90035 address is not automatically City of LA | ZIMAS or Assessor |

---

## Part C — What we must not say to Harper

Stated plainly so no downstream draft drifts past the evidence (Law 10).

**Do not say:**

- that the property is zoned R3 — **we did not verify it**;
- that it has 4 units, 4,092 sf, or was built in 1947 — **aggregator data only**;
- that it is or is not rent-stabilized — **presumption, not determination**;
- that SB 684 is unavailable — **the AB 130 remainder-parcel route is live and unexamined**;
- that SB 1123 doesn't apply **because the lot isn't vacant** — HCD's
  2025-10-07 guidance removed that reason; the only surviving reason is zoning,
  **which we did not verify**;
- that SB 9 "doesn't apply" without the one-line caveat that this rests on
  unverified zoning;
- that SB 79 gives her anything in Los Angeles today — **the City deferred it
  to roughly 2030**;
- that she can build N ADUs — **the statutory cap is not a site capacity**;
- that the property is not in an HPOZ, fire zone, or hillside area — **we checked nothing**;
- that no permits exist — **we could not reach LADBS** (Law 4);
- **any** APN.

**We can say, and it is genuinely useful:**

- which programs are keyed to facts she can verify herself in one ZIMAS session;
- that the programs she named were largely written for vacant or
  single-family sites, and her property appears to be neither — which is a
  substantive explanation for why they felt inapplicable;
- that rent stabilization, not zoning, is likely the binding constraint;
- that **SB 79 and LA's Low-Rise Ordinance became effective 2026-06-30 /
  2026-07-01 and she did not mention them**;
- that the **Westside Community Plans Update** is actively in progress over
  her community plan area;
- the exact, ordered verification sequence.
