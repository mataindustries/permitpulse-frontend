# Conflicts and Unknowns — 9854 W Vidor Drive

Case ID: `PP-CASE-2026-09-VIDOR`
**Revision 2 — post-ZIMAS. 2026-09-21.**

Per `PROJECT_LAWS.md` Law 5, contradictory sources remain contradictory until
explicitly resolved; per Law 6, one source never silently overwrites another.

---

## Part A — Conflicts

### C-01 · APN candidates — **RESOLVED**

Verified APN: **4330005041**.

All three candidates surfaced by search in Revision 1 — `8025-001-015`,
`5542-025-002`, `4330-005-092` — were **wrong**. The first two were unrelated
parcels returned by search-engine inference against official assessor URLs; the
third belonged to a neighbouring property (9800 Vidor Dr).

**The Revision 1 decision to reject all three and record `unknown` was
correct.** Adopting the top search result would have mis-keyed every
downstream record pull in this case. Recorded as a validated near-miss.

### C-02 · SB 684 / SB 1123 effective dates — **STILL UNRESOLVED, now moot**

SB 684 reported as both 2024-07-01 (LA City Planning) and 2024-01-01
(commentary). Unresolved. Immaterial: SB 684 is now `NOT SUPPORTED` on
substantive grounds.

### C-03 · Beverlywood HOA — **RESOLVED AS NOT APPLICABLE**

ZIMAS reports no CDO, no CPIO, no HPOZ, no specific-plan subarea, and no
special land use for this parcel. The parcel sits in **TR 11106, Lot 85**,
which is not the Beverlywood Homes Association tract pattern of single-family
homes. *Recorded CC&Rs were still not searched (County Recorder) — a private
covenant would not appear in ZIMAS.* So: not an HOA-governed lot on the City
record; private restrictions remain `unknown`.

### C-04 · Zoning by adjacency — **RESOLVED, and the method is vindicated as unsafe**

Verified zoning is **`[Q]R3-1-O`**. The adjacency guess got "R3" right and
**missed the `[Q]` entirely** — which is potentially the single most
consequential field on the parcel. The heuristic produced a half-right answer
that would have overstated capacity by roughly 2× (7 units vs ≈3).

### C-05 · Fire hazard cross-check — **RESOLVED**

ZIMAS: `Very High Fire Hazard Severity Zone: No`. No CAL FIRE cross-check was
run, so the known ZIMAS/CAL FIRE disagreement pattern
(`app/fixtures/case-integrity/fire-hazard-official-source-conflict.json`) is
untested here. Given a flat inland urban parcel, residual risk is low.

### C-06 · Vidor Drive zoning mix — **SUPERSEDED**

Irrelevant now that the subject parcel's own zoning is an `official` fact.
Retained only as the evidentiary lesson recorded at `PAIN_LOG.md` §P-14.

### C-07 · HCD guidance vs. statutory text on "vacant" — **MOOT HERE**

Unresolved in kind, but no longer bears on this parcel: SB 1123 fails on
zoning, which is now confirmed.

### C-08 · SB 79 statewide effect vs. LA deferral — **MOOT HERE**

The parcel is outside the half-mile major-transit-stop radius, so neither SB 79
nor the Low-Rise Ordinance reaches it regardless of LA's deferral.

### C-09 · **NEW — RSO = No on a 1947 four-unit building**

The official record reports, for the same APN:

- `Rent Stabilization Ordinance (RSO): **No** [APN: 4330005041]`
- `Ellis Act Property: **Yes** — Date Filed on 2017-05-15`
- `Just Cause For Eviction Ordinance (JCO): **Yes**` — Year Built 1947,
  Use Code 0400 (four units)
- `Housing Use within Prior 5 Years: **Yes**`

A 1947 four-unit City of Los Angeles building sits inside the ordinary RSO
coverage test. The City reports it as not RSO. **The report states the fact and
not the reason.**

**Status: the fact is `confirmed`. The reason is `UNKNOWN`
(`insufficient_evidence`).** Six candidate explanations are recorded at
`PROPERTY_EVIDENCE.md` §E-11i, none adopted. The Ellis withdrawal is the most
economical reading, but the record asserts no causal link and this file will
not invent one.

**Resolution route: LAHD.** Ask for RSO registration history, the withdrawal
record, and the definition of the ZIMAS RSO field (coverage vs. registration).

### C-10 · **NEW — two transit fields that read as contradictory**

`AB 2097: within ½ mile of a Major Transit Stop: **No**` alongside
`High Quality Transit Corridor (within ½ mile): **Yes**`.

**Not an actual conflict — two different statutory tests** (stop vs. corridor;
see `PROPERTY_EVIDENCE.md` §E-18l). Recorded because it is a high-probability
misreading: a reader who sees "High Quality Transit: Yes" will assume transit
incentives apply. Four other rows (`TOC: Not Eligible` and three MIIP
`Not Eligible`) confirm they do not.

### C-11 · **NEW — the `[Q]` condition and case CPC-1988-341-ZC**

ZIMAS reports zoning `[Q]R3-1-O` and, separately, case **CPC-1988-341-ZC**:
*"ZONE CHANGE TO LIMIT THE LAND SO DESIGNATED TO THE RD1.5 DENSITY FOR
PROPERTY IN THE VICINITY OF PICO BOULEVARD AND BEVERWIL DRIVE."*

**ZIMAS does not state that this case produced this parcel's `[Q]`.** The
association is inference. If correct, permitted density ≈ 3 units against 4
existing (legal nonconforming, zero residual). If incorrect and unqualified R3
governs, the ceiling is 7 and SB 684 would need re-opening.

**Status after Revision 3: STILL UNRESOLVED, and now known to be
UNRESOLVABLE ONLINE.** Per LADBS Information Bulletin P/GI 2020-025, City
ordinances below **170,000** exist only at the **City Archives**; ORD-165986 is
below that line. Two candidates were **eliminated** — ORD-171492 (WLA TIMP
Specific Plan, 1997-03-08) and ORD-183497 (2015 mansionization ICO, Beverlywood
among 15 areas). None confirmed.

**Demoted from "highest-value open item."** Revision 3 established that a
`[Q]` density cap would **not** block ADUs (state preemption) or a 100%
affordable project (AB 2334 unlimited density). It gates only market-rate
redevelopment and subdivision, both already `NOT SUPPORTED`. The item remains
open; it is no longer the binding constraint on advice.

### C-12 · **NEW — `[Q]` vs `(Q)`: two search summaries, two incompatible glosses**

Two independent searches of LAMC 12.32 G produced contradictory readings:

| Gloss | Claim |
| --- | --- |
| A | *"the permanent `[Q]` Qualified classification"* — brackets are removed once conditions are fulfilled; no time limit on removal |
| B | `(Q)` in parentheses is temporary; once a Certificate of Occupancy issues the parentheses are dropped and `Q` is permanent; *"temporary conditions shown with brackets have the same status as those that have become permanent"* |

Gloss A's own quoted text calls `[Q]` **permanent**, while A's summary sentence
calls it temporary — internally inconsistent. Gloss B treats brackets as
equivalent in effect to permanent.

**Neither adopted. The LAMC text was not retrieved.** What both agree on, and
what is sufficient here: **the condition is live on the parcel's current zone
string as of 2026-09-20.** Its enforceability today is not in doubt; only its
formal classification is.

### C-13 · **NEW — naming collision: "ED 1" vs "EO 1"**

Searching LA "EO 1" returns **Executive Order 1 implementation guidelines for
wildfire rebuild** (Palisades recovery). ZIMAS's field is **ED 1** —
**Executive Directive 1**, the 100% affordable housing streamlining directive.
Different instruments, near-identical shorthand, both live in 2026, both with
"Implementation Guidelines" PDFs on City domains.

**Recorded so no later pass conflates them.** The parcel's `ED 1 Eligibility:
Eligible Site` refers to affordable-housing streamlining.

---

## Part B — Unknowns that still block client advice

| # | Unknown | What it blocks | Source |
| --- | --- | --- | --- |
| **U-01** | **`[Q]` condition text / permitted density** | **Market-rate** yield only. **Not** ADUs, **not** 100%-affordable (AB 2334) | **City Archives**, 555 Ramirez St Rm 320, (213) 473-8440 — **not online** |
| U-02 | Reason RSO = No | How the Ellis history and any re-rental are read | LAHD |
| U-03 | Ellis Act current status; 10-year look-back confirmation; re-rental restrictions; former-tenant rights | Timing strategy, and whether the ≈2027-05-15 date is real | LAHD |
| U-04 | ZIMAS interactive `SHRA / SB 684 Eligibility` flag | Final confirmation of the SB 684 verdict — **not printed in the Parcel Profile Report** | ZIMAS interactive |
| U-05 | LADBS permit history, certificate of occupancy, legality of all 4 units | ADU cap (computed on *legal* units); unpermitted-work exposure | LADBS |
| U-06 | Building footprint, lot coverage, setbacks, parking, open space | **Real ADU capacity** — the statutory cap of 4+1 is not achievable on 5,974.5 sf | Measured survey |
| U-07 | Current occupancy of the four units | SHRA tenant-occupancy limb; JCO exposure | Owner |
| U-08 | Recorded CC&Rs, easements | Private restrictions — invisible to ZIMAS | County Recorder |
| U-09 | WLA TIMP trip-fee exposure | Cost of any new unit | City Planning / DOT |
| U-10 | Methane mitigation and BOE grading scope | Cost of any new structure | LADBS / BOE |
| U-11 | ED 1 current operative terms | Whether the AHIP pathway is real today | City Planning / Mayor's Office |
| U-12 | "Universal Planning Review Service: Needs Review" | Unclear procedural flag | City Planning |
| U-13 | Westside Community Plans Update draft zoning for this parcel (CPC-2018-7546-CPU) | Future zoning — Re:Code LA remapping | City Planning |

---

## Part C — What we must not say to Harper

**Do not say:**

- any **market-rate** unit yield — **`[Q]` is unread** (U-01). *(We may now say
  the `[Q]` does not block ADUs or a 100% affordable project — state ADU
  preemption and AB 2334 respectively.)*
- that ORD-165986 is the `[Q]` ordinance — **unverified**; two other candidates
  were eliminated but none confirmed;
- that the property "is not rent controlled, so you're free" — **JCO applies,
  RPO and HE replacement apply, and the Ellis units are likely Protected Units
  until ≈2027**;
- *why* RSO reads No — **unknown**, and the tidy Ellis explanation is exactly
  the kind of inference this file exists to refuse;
- that she can add 4 detached ADUs — that is the statutory ceiling, and the
  lot is 5,974.5 sf with a 4,092 sf building on it;
- that the Ellis ten-year window closes on a specific date — **the look-back
  is from a secondary summary, not retrieved ordinance text** (U-03);
- that SB 684 is absolutely foreclosed — high confidence, but the interactive
  SHRA flag is unchecked (U-04) and `[Q]` could change the density picture;
- that no permits exist or all four units are legal — **LADBS not retrieved**.

**We can now say, with `official` backing:**

- the full verified parcel baseline — APN, zoning, lot area, units, year built,
  community plan, council district, overlays, hazards;
- that **SB 1123 and SB 9 do not apply** — confirmed on verified zoning;
- that **CHIP's MIIP is not available** — three `Not Eligible` rows;
- that **SB 79 and the Low-Rise Ordinance do not reach this parcel** — no major
  transit stop within ½ mile;
- that the parcel is **not** hillside, coastal, VHFHSZ, HPOZ, liquefaction or
  flood — but **is** in a Methane Zone and a Special Grading Area;
- that **every housing flag penalises removing units and none penalises adding
  them**, which is a genuine strategic conclusion;
- that the parcel is an **ED 1 Eligible Site** in the **Highest** TCAC
  Opportunity Area and a **Very Low VMT Area** — a real, if narrow, affordable
  pathway she did not know about.
