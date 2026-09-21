# Adversarial Review — "What could make this report wrong?"

Case ID: `PP-CASE-2026-09-VIDOR` · 2026-09-21
Method: take each material conclusion and actively try to disprove it.
Two conclusions were materially weakened and have been corrected in the
other files. One was strengthened. Several structural risks remain unresolved.

---

## A-01 · ATTACK: "SB 1123 does not apply because the lot is not vacant."
### Result: **CONCLUSION MATERIALLY WEAKENED — corrected**

**What broke it.** California HCD issued guidance on **2025-10-07** stating
that a single-family-zoned lot **with an existing home** can still qualify as
"vacant" for SB 1123 purposes **if the subdivision designates a remainder
parcel for the portion of the lot holding the existing home**. In HCD's words
(as reported by Cox Castle & Nicholson), once a remainder parcel is designated
to retain an existing use, *"the site area outside of the remainder parcel may
be considered 'vacant' for purposes of eligibility."*

**Why this matters.** The SB 1123 verdict rested on two supposedly independent
failures: (1) multifamily zoning, and (2) not vacant. **HCD just removed
failure (2).** The verdict now rests **entirely on the zoning test — which is
itself unverified.**

**Correction applied.** SB 1123 moves from *NOT APPLICABLE (high confidence)*
to *NOT APPLICABLE **only if** the parcel is multifamily-zoned — and that is
unverified.* If ZIMAS returns any single-family zone, SB 1123 becomes live and
must be re-analyzed from scratch.

**Residual caution.** Cox Castle notes HCD guidance is **not binding law**;
courts typically defer to HCD on housing-reform statutes but interpretation
ultimately rests with the judiciary. A pathway built on HCD guidance carries
litigation risk that a pathway built on statutory text does not.

---

## A-02 · ATTACK: "The block is uniformly LAR3, so the parcel is multifamily."
### Result: **REASONING METHOD DISCREDITED — conclusion survives, confidence reduced**

**What broke it.** **9875 Vidor Dr is a single-family property** (sold
$2,195,000, 2018). The street is **not** uniformly multifamily. It appears
split: odd-numbered addresses reading single-family, even-numbered addresses
(9800, 9806, 9836, 9854, 9880) reading multifamily.

**Why this matters.** Zoning-by-adjacency was the only basis for treating this
parcel as multifamily. The street demonstrably contains both. The subject is
on the even side with the multifamily cluster, so the conclusion probably
holds — but the *method* used to reach it has just been shown to fail on this
very street. That is a warning, not a reassurance.

**Correction applied.** `PROPERTY_EVIDENCE.md` E-04 and
`CONFLICTS_AND_UNKNOWNS.md` §C-06 now record the street as zoning-mixed. No
program verdict may rest on adjacency alone.

---

## A-03 · ATTACK: "A 1947 four-unit building is rent-stabilized."
### Result: **PRESUMPTION SURVIVES — but more escape hatches exist than recorded**

**What I found against it.** LA's RSO carries exemptions beyond the
pre-1978 / 2-or-more-units test:

- detached single-family dwellings where only one unit exists on the parcel
  (and the owner is not a REIT, corporation or LLC);
- **individual condominiums are usually exempt** — though units in a building
  converted from a pre-1978 apartment building may remain covered;
- units holding a **Luxury Exemption Certificate** obtained before 1978;
- properties with a **certificate of occupancy issued within the last 15 years**.

**Direct evidence that this block contains non-RSO buildings:** 9800 Vidor Dr
("Vidor Place Apartments") is reported **built 1990 and expressly not subject
to rent control**. 9880 Vidor also reports 1990 construction. So the RSO
presumption is not a property of the street — it is a property of the *building
date*, and the subject's 1947 date is aggregator data only.

**Correction applied.** The RSO presumption stands but is now stated with its
exemptions, and with the explicit note that a substantially reconstructed
building carrying a recent certificate of occupancy would fall outside it.
**Year built ≠ certificate-of-occupancy date**, and the C-of-O is the trigger.

---

## A-04 · ATTACK: "The AB 130 remainder-parcel route for SB 684 is wishful reading."
### Result: **CONCLUSION STRENGTHENED — and it is the most valuable finding in the case**

**What I found for it.** Two independent supports emerged:

1. **HCD's 2025-10-07 guidance** (A-01) explicitly endorses the
   remainder-parcel mechanic as a way to isolate an existing structure and
   treat the balance of the site as developable. That is exactly the
   configuration proposed for this parcel.
2. LA County Planning's own staff memo language confirms an applicant *"may
   elect to designate a remainder parcel that retains existing land uses or
   structures … does not contain any new residential units, and is not
   exclusively dedicated to serving the housing development project,"* not
   counted against the 10-parcel maximum.

**What still cuts against it.** Three things, all recorded:

- The memo language reads *"including an existing single dwelling unit."*
  That phrasing suggests the drafters pictured **one house**, not a
  four-unit rent-stabilized building. Whether a fourplex qualifies as
  remainder-parcel content is **genuinely open**.
- The underlying prohibition is unchanged: an agency may not approve a project
  requiring **demolition of occupied or vacant protected units**, and **all
  Housing Crisis Act replacement requirements and review procedures still
  apply** to any SB 684 project demolishing one or more residential units.
  The remainder-parcel route only helps if **nothing is demolished or altered**.
- HCD guidance is not binding law (A-01).

**Net.** The route is real enough to investigate and far too uncertain to
design against. Stated that way in both the matrix and the brief.

---

## A-05 · ATTACK: "SB 79 may be the largest upside for this parcel."
### Result: **CONCLUSION MATERIALLY OVERSTATED — corrected**

**What broke it.** SB 79 contains **alternative compliance pathways** letting
a city delay implementation on certain properties, adopt a transit-oriented
development alternative plan preserving citywide net zoned capacity, or both.
**Los Angeles used them.** The City Council elected to **delay SB 79 citywide
to approximately 2030** and adopted the Low-Rise Ordinance as its substitute.
Cities cannot fully opt out, and may exclude only defined categories (very
high fire hazard severity zones, sea-level-rise-vulnerable sites, sites with a
local historic resource, "low resource" areas).

**Why this matters.** I framed SB 79 as potentially dominating every other
pathway. In Los Angeles, **as a direct entitlement route it is largely
deferred**. What is actually operative today is the **Low-Rise Ordinance**
(effective 2026-06-30), which is narrower: two-to-four stories, 50-plus
station areas, eight-foot rear setback, HPOZ and HCM exempted.

**Correction applied.** Both the matrix and the brief now lead with the
Low-Rise Ordinance as the live instrument and describe SB 79 as deferred in LA
pending phased implementation. Also recorded: **LA's delay is contested**, so
the position could shift.

---

## A-06 · ATTACK: "This is even the right property / the right city."
### Result: **UNRESOLVED — the largest single risk in the file**

Not disproved, but not established either. The address is client-stated and
was never geocoded against an official address point. ZIP 90035 abuts Beverly
Hills, Culver City and County territory. **No APN was confirmed** and three
unrelated parcel numbers surfaced in search results (§C-01). Every parcel
fact traces to listing aggregators sharing upstream data — so three
"corroborating" sources may be one source wearing three faces.

**If jurisdiction or parcel identity is wrong, the entire file is wrong.**
This is why the brief is gated.

---

## A-07 · ATTACK: "The ADU pathway is the safe recommendation."
### Result: **SURVIVES, with one unresolved economic risk**

The structural argument holds: the ADU route does not demolish or alter
existing units, so it avoids both the SHRA protected-housing bar and the CHIP
replacement obligation. Nothing found contradicts that.

**But** LAHD lists ADUs and JADUs among RSO-covered property types. If a new
ADU on a parcel whose certificate of occupancy predates 1978-10-01 is itself
pulled into rent stabilization, the pro forma changes materially. This was not
resolved and is flagged as requiring a **written** LAHD determination —
not a phone answer.

Separately, the statutory cap (4 detached + 1 conversion on a 4-unit property)
is a legal ceiling, not a site capacity. Lot area, existing footprint, open
space and setbacks are all unknown. **Quoting the cap as an outcome would be
the most likely way this brief misleads a client.**

---

## A-08 · Structural risk: source independence

Redfin, PropertyShark, Spokeo and the MLS-derived listing sites draw on
overlapping upstream data. Their agreement on "1947 / 4 units / 4,092 sf" is
**not** three-source corroboration. It is plausibly one record repeated.
Confidence was set at `medium`, not `high`, for this reason.

---

## A-09 · Structural risk: effective-date drift

Three dates in this file come from search summaries of agency pages rather
than chaptered text: SB 684 (2024-07-01 vs 2024-01-01), SB 1123 and AB 130
(2025-07-01), SB 79 (2026-07-01), LA's ordinances (2026-06-30). All are past,
so none currently changes eligibility — but any vesting or
timing argument built on them needs the statutory text.

---

## Summary of corrections applied

| ID | Conclusion | Change |
| --- | --- | --- |
| A-01 | SB 1123 not applicable | Weakened — now rests only on unverified zoning |
| A-02 | Parcel is multifamily | Confidence reduced — street is zoning-mixed |
| A-03 | Units are RSO | Presumption kept; exemptions added |
| A-04 | AB 130 remainder parcel may revive SB 684 | Strengthened; three counterarguments recorded |
| A-05 | SB 79 is the big upside | **Overstated — corrected.** Low-Rise Ordinance is the live instrument |
| A-06 | Property identity | Unresolved; gating reason for the brief |
| A-07 | ADU pathway is safest | Survives; RSO-on-new-ADU risk flagged |

**Conclusions that survived unchanged: none without qualification.**

---
---

# Revision 2 — adjudicated against the official ZIMAS record (2026-09-21)

Revision 1's adversarial pass was conducted without any authoritative source.
The ZIMAS Parcel Profile Report dated 2026-09-20 now settles most of it. This
section marks each Revision 1 attack as **upheld**, **overturned**, or
**moot**, and adds the attacks that only became possible with real data.

## Adjudication of Revision 1

| ID | Revision 1 position | Official record | Outcome |
| --- | --- | --- | --- |
| A-01 | SB 1123 fails only on zoning, which is unverified | Zoning `[Q]R3-1-O` — multifamily | **UPHELD, now confirmed.** SB 1123 definitively out |
| A-02 | Adjacency reasoning is unsafe | `[Q]R3-1-O` — "R3" right, `[Q]` missed | **UPHELD, and worse than stated.** Half-right answer overstated capacity ~2× |
| A-03 | RSO presumption survives with exemptions | **`RSO: No`** | **OVERTURNED.** See A-10 |
| A-04 | AB 130 remainder parcel might revive SB 684 | Lot 5,974.5 sf; building 4,092 sf; density possibly capped at ~3 | **OVERTURNED ON ARITHMETIC, not law.** The legal reading may still be right; there is no room to use it |
| A-05 | SB 79 framing overstated; Low-Rise is the live instrument | **No major transit stop within ½ mile** | **UPHELD AND EXTENDED.** Neither reaches this parcel |
| A-06 | Property identity unresolved — largest risk | APN 4330005041 confirmed; all three search-derived APNs wrong | **RESOLVED.** The refusal to adopt a search-derived APN was correct |
| A-07 | ADU pathway safest; RSO-on-new-ADU risk | `RSO: No` removes that risk; lot is 5,974.5 sf | **UPHELD on logic, halved on yield** |
| A-08 | Aggregator agreement is not corroboration | Aggregators were **exactly right** (1947, 4 units, 4,092 sf, 8bd/4ba) | **UPHELD AS METHOD.** Right answer, unearned confidence — holding at `medium` was still correct |
| A-09 | Effective-date drift unresolved | — | **MOOT** for this parcel |

## A-10 · The overturned conclusion, examined

**What broke.** Revision 1 held the property presumptively rent-stabilised on
the LAHD coverage test (City of LA, pre-1978-10-01, 2+ units). ZIMAS reports
**`RSO: No`**.

**Why the error deserves scrutiny rather than a shrug.** The inference was
defensible and the inputs were *verified correct* — 1947 and four units both
confirmed. The failure was not bad data or bad logic. It was **applying program
logic to a parcel before retrieving the parcel's authoritative flags.** There
is no reasoning path from building age to RSO status, because RSO status is an
administrative fact, not a physical property.

**The subtler danger.** The presumption was directionally useful while being
factually wrong: the property *is* heavily encumbered, just by different
instruments (Ellis, JCO, HCA/RPO, HE replacement). Anyone treating Revision 1
as "basically right" would draw precisely the wrong methodological lesson.
Recorded at `PAIN_LOG.md` §P-15 and proposed as a regression fixture.

## New attacks, only possible with real data

### A-11 · ATTACK: "RSO = No because of the 2017 Ellis filing."
**Result: REFUSED — not established.**

It is the most economical reading and it may well be right. But the report
asserts **no causal link** between the two fields, and the LAMC mechanism by
which an Ellis withdrawal affects the ZIMAS RSO field was not retrieved. Five
other candidates remain live (`PROPERTY_EVIDENCE.md` §E-11i), including the
possibility that the field reports *registration* rather than *coverage*.
**Marked `UNKNOWN`. This is the single place in the file where a satisfying
answer was available and deliberately not taken.**

### A-12 · ATTACK: "The `[Q]` is harmless boilerplate."
**Result: CANNOT DISMISS — elevated to the top open item.**

ZIMAS carries case CPC-1988-341-ZC: *"ZONE CHANGE TO LIMIT THE LAND SO
DESIGNATED TO THE RD1.5 DENSITY FOR PROPERTY IN THE VICINITY OF PICO BOULEVARD
AND BEVERWIL DRIVE."* The parcel is in that vicinity and carries a `[Q]`.
If linked, permitted density ≈ 3 against 4 existing — zero residual.

**Counter-argument preserved:** ZIMAS never states that this case produced this
parcel's `[Q]`. The attribution is inference, and this file has just been burned
by an inference. So it is recorded as unresolved and **no unit yield is quoted
anywhere in Revision 2.**

### A-13 · ATTACK: "SB 684 is now definitively dead."
**Result: HIGH CONFIDENCE, NOT ABSOLUTE.**

Three verified triggers support the `NOT SUPPORTED` verdict. But: (a) the
interactive `SHRA / SB 684 Eligibility` flag is **not in the printed report**
and remains unchecked; (b) `Housing Use within Prior 5 Years` is the City's HCA
flag, not a direct statement of *tenant* occupancy, which is the actual SHRA
test; (c) if `[Q]` turns out not to cap density, headroom exists. Stated as
`NOT SUPPORTED` with those three caveats visible.

### A-14 · ATTACK: "The Ellis ten-year window closes 2027-05-15, so advise waiting."
**Result: DO NOT SAY THIS YET.**

The ten-year Protected Unit look-back comes from an **LA Planning fact-sheet
summary retrieved via search in Revision 1 — not from ordinance text.** Ellis
also carries separate LAMC re-rental restrictions and former-tenant rights of
unknown current status. The date is the most decision-relevant figure in the
file **and the least well-evidenced.** Flagged for LAHD confirmation; excluded
from the brief as an actionable deadline.

### A-15 · ATTACK: "This whole analysis is just reading ZIMAS back to her."
**Result: PARTIALLY CONCEDED — see the closing answer to the user.**

The individual fields are ones Harper could pull herself in ten minutes. What
she could not readily do: recognise that `RSO: No` does **not** mean
unencumbered; spot that four `Not Eligible` rows jointly foreclose CHIP's main
path; know that `High Quality Transit Corridor: Yes` and
`Major Transit Stop: No` are different tests pointing the same way; decode
`[Q]R3-1-O` against a 1988 zone-change case; or see that `ED 1 Eligible` +
`TCAC Highest` + `AB 2334 Very Low VMT` compose into a coherent pathway.
**The fields are hers. The interactions are the work.** Conceded honestly
rather than defended.

## Summary of Revision 2 corrections

| Conclusion | Change |
| --- | --- |
| RSO presumptively applies | **OVERTURNED** — `RSO: No` |
| SB 1123 not applicable | **CONFIRMED** on verified zoning |
| SB 9 not applicable | **CONFIRMED** on verified zoning |
| CHIP MIIP geography unknown | **CONFIRMED NOT ELIGIBLE** ×3 |
| SB 79 / Low-Rise unknown, possibly large upside | **NOT SUPPORTED** — no qualifying stop within ½ mile |
| SB 684 likely unavailable / verify | **NOT SUPPORTED** — three verified triggers |
| ADU strongest pathway | **UPHELD**, yield revised sharply down on verified lot area |
| AHIP unlikely to matter | **UPGRADED** — ED 1 + TCAC Highest + AB 2334 stack favourably |
| Ellis Act, HE replacement, Methane Zone, Special Grading Area, `[Q]` | **ENTIRELY MISSED in Revision 1** |


---
---

# Revision 3 — adversarial check on the `[Q]` conclusion (2026-09-21)

## A-16 · ATTACK: "The `[Q]` is a density condition limiting the parcel to RD1.5."
### Result: **NOT ESTABLISHED — and the attack found a hole I had not seen**

**What I claimed.** Working hypothesis: the `[Q]` derives from CPC-1988-341-ZC
and caps density at RD1.5 (1,500 sf/unit), yielding 3 permitted units against
4 existing.

**What broke it.** A `[Q]` condition in Los Angeles **is not necessarily about
density at all.** Practitioner guidance describes `[Q]` conditions as
site-specific restrictions imposed by Council ordinance that *"may cap unit
counts, restrict uses, impose setbacks, or require affordability — beyond
anything the base zone says."*

So the possibility space for this parcel's `[Q]` is wider than assumed:

| If the `[Q]` is… | Effect on the ADU pathway |
| --- | --- |
| A **density cap** (the hypothesis) | **None** — state ADU law preempts local density limits |
| A **setback or yard condition** | **Possibly material** — depends on whether the ADU qualifies as a statewide-exemption ADU under Gov. Code § 66323 |
| A **use restriction** | Unknown |
| An **affordability requirement** | Unknown |

**Correction applied.** The Revision 3 statement *"the `[Q]` does not block
ADUs"* is **too strong as written.** The defensible statement is:

> **If** the `[Q]` is a density condition — which the CPC-1988-341-ZC
> description suggests but does not prove — it does not block ADUs, because
> state ADU law preempts local density limits. **If** it imposes something
> else, its effect on ADUs is **unknown**.

This matters because Revision 3 used the ADU finding to *demote* the `[Q]`
from the top of the queue. That demotion is still right on balance — density
is the most probable reading given the case description, and the two
pathways that survive are the two least exposed — **but it is a probabilistic
judgment, not a proof, and it is now labelled as one.**

## A-17 · ATTACK: "ZIMAS links each `[Q]` to its creating ordinance, so the chain should have been trivial."
### Result: **CONTRADICTED BY THE ARTIFACT ITSELF**

One practitioner source asserts ZIMAS *"links each condition to the City
Council ordinance that created it, so you can read the source document in one
click."* Another, in the same result set, states the opposite: *"`[Q]`
conditions are not always visible in ZIMAS… Many are buried in City Council
ordinances from decades ago."*

**The primary artifact settles it.** The official Parcel Profile Report for
this parcel (2026-09-20) contains:

- the zone string `[Q]R3-1-O`, with **no condition text**;
- a flat `CASE NUMBERS` list of 19 entries with **no stated relationship**
  between any ordinance and the `[Q]`.

**There is no link, one click or otherwise, in the document the City produces.**
Whether the interactive viewer exposes one is untested and now recorded as an
open item. Two secondary sources disagreed; the primary source decided it.

## A-18 · ATTACK: "ORD-165986 is obviously the ordinance."
### Result: **STILL REFUSED — and the refusal is now better grounded**

The prior pass named ORD-165986 a candidate; the user correctly instructed
that the association not be assumed. Revision 3 upholds that.

What changed: **two candidates were positively eliminated**, which narrows the
field without confirming anything.

- **ORD-171492** → identified as the **West LA Transportation Improvement and
  Mitigation Specific Plan**, adopted 1997-03-08. Explains ZIMAS's specific-plan
  flag. Not a `[Q]` source.
- **ORD-183497** → identified as the **2015 mansionization Interim Control
  Ordinance** covering 15 neighborhoods including Beverlywood. Single-family
  scope, expired. Not a `[Q]` source.

ORD-165986 remains the leading candidate on **era consistency alone** — which
is the same class of reasoning (plausible inference from indirect
characteristics) that produced the RSO error in Revision 1. **Recorded as
unverified.**

## A-19 · ATTACK: "A later ordinance or law already removed or overrode the `[Q]`."
### Result: **NO EVIDENCE OF REMOVAL — one future change identified**

Searched for later ordinances, Re:Code LA translation, and state preemption.

- **No ordinance was found removing or amending this parcel's `[Q]`.** It is
  present on the City's record as of **2026-09-20**, which is itself the best
  available evidence that it remains in force.
- **Re:Code LA / New Zoning Code (Chapter 1A):** Q conditions persist under
  Chapter 1 until a Community Plan area is remapped. This parcel's area is not
  yet remapped — the **Westside Community Plans Update (CPC-2018-7546-CPU)** is
  the vehicle, and it is in progress. **That is a real future change to watch,
  not a present override.**
- **State law:** ADU preemption and AB 2334 unlimited density **bypass** a
  density condition for specific project types; neither **removes** the `[Q]`.
  The distinction matters — the condition survives and continues to bind
  everything outside those statutory tracks.

## A-20 · ATTACK: "Demoting the `[Q]` was self-serving — it excused a failed retrieval."
### Result: **FAIR CHALLENGE, PARTIALLY CONCEDED**

We set out to retrieve the `[Q]`, failed, and then concluded it mattered less
than we had said. That sequence deserves suspicion.

**In defence:** the demotion rests on three findings established
*independently* of the failure — state ADU density preemption, AB 2334
unlimited density in a Very Low VMT Area (a ZIMAS-verified designation), and
LAMC 12.23's treatment of floor area vs. unit count. Any of those would have
demoted the `[Q]` regardless of whether the ordinance was obtained.

**Conceded:** the demotion is now hedged by A-16 — it holds cleanly only if the
`[Q]` is a density condition. And the honest lesson is not about the `[Q]` at
all but about **queue order** (`PAIN_LOG.md` §P-20): the item should have been
ranked by what its answer would change, and that test was never applied before
spending a pass on it.

## Summary of Revision 3 corrections

| Conclusion | Change |
| --- | --- |
| `[Q]` caps density at RD1.5 | **UNVERIFIED HYPOTHESIS** — a `[Q]` may instead restrict use, setbacks or affordability |
| `[Q]` does not block ADUs | **SOFTENED** — true if it is a density condition; unknown otherwise |
| ORD-165986 is the ordinance | **STILL UNVERIFIED** — two other candidates eliminated, none confirmed |
| `[Q]` is the highest-value unknown | **DEMOTED** — it gates only pathways already closed |
| A later law removed the `[Q]` | **NO EVIDENCE** — but the Westside CPU will eventually remap it |
| The ordinance is retrievable | **NO** — below the City's 170,000 online cutoff; City Archives only |
