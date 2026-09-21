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


---
---

# Revision 4 — final review before client delivery (2026-09-21)

## A-21 · ATTACK: "PermitPulse overstated the affordable-housing finding."
### Result: **UPHELD — overstatement confirmed and corrected**

Revision 3 told the case owner that Harper "is sitting on an **unlimited-density
entitlement**." **That was wrong in two ways.**

1. **"Entitlement" is false.** The parcel holds a *designation* — Very Low VMT
   Area — not an entitlement. No approval, vesting, or right attaches to the
   land. The benefit exists only for a project that qualifies.
2. **"Unlimited density" strips the conditions.** AB 2334's density provision
   is contingent on an affordability mix (at least 80% lower-income), project
   type, and other criteria none of which were verified for any actual project.

**Corrected framing, now used everywhere:** *a potential pathway subject to
affordability and other eligibility requirements.*

This is the third overstatement caught in four revisions (RSO presumption §A-10;
"`[Q]` does not block ADUs" §A-16; this one). The common mechanism: **a
verified flag gets narrated as a conclusion.** `Very Low VMT Area: Yes` is a
fact. "Unlimited density" is a conclusion that requires facts we do not have.

## A-22 · ATTACK: "The LAHD call resolved the RSO question."
### Result: **REJECTED — it resolved nothing, and must not be read as if it did**

LAHD staff stated that nothing has been filed or registered since 2019 and
that they **could not determine or confirm** current RSO or JCO status from
the records they were viewing.

Tempting but impermissible readings, all rejected:

| Tempting inference | Why rejected |
| --- | --- |
| "Nothing since 2019 ⇒ the Ellis withdrawal completed and RSO ended" | Staff explicitly did not say this. Absence of filings is not a status determination |
| "LAHD couldn't find it ⇒ it isn't RSO" | `PROJECT_LAWS.md` Law 4 — failure to retrieve is not proof of absence |
| "ZIMAS says No and LAHD didn't contradict it ⇒ No is confirmed" | Silence is not corroboration. Law 6 — no source silently overwrites another |

**The only supportable conclusion: current status is `UNRESOLVED` and requires
a written determination.** The phone channel has been tried and returned
"cannot determine," which changes the *next action*, not the answer.

## A-23 · ATTACK: "The brief is now just a longer ZIMAS printout."
### Result: **PARTIALLY CONCEDED — and the brief was cut accordingly**

Fair. Revision 3's brief restated many fields Harper can pull herself. The
Revision 4 client brief was rewritten to a hard length limit, and every field
that does not change a decision was removed. What survives is the interactions:
four existing units against replacement protections; the RSO/JCO/Ellis
unresolved block; HQTC vs. major transit stop; the `[Q]` uncertainty and its
limited reach; Housing Element replacement; ADU path vs. redevelopment path;
and the methane / special-grading cost items.

## Standing corrections carried into the client brief

| Must never say | Must say instead |
| --- | --- |
| "unlimited-density entitlement" | "a potential pathway subject to affordability and other eligibility requirements" |
| "the `[Q]` caps this parcel at RD1.5" | "a `[Q]` is live in the current zoning string; its text was not retrieved" |
| "the property is not rent-stabilised" | "ZIMAS reports RSO: No; current status is unresolved and LAHD could not confirm it" |
| "why RSO reads No" | nothing — the reason is unknown |
| "the Ellis window closes on [date]" | nothing — the look-back is unverified |


---
---

# Revision 5 — corrections from human review (2026-09-21)

Four issues were found **in human review, not by our own adversarial passes.**
That is itself the most important datum in this revision.

## A-24 · ED 1 presented as a live pathway
### Result: **WRONG — corrected**

Revisions 3 and 4 read `ED 1 Eligibility: Eligible Site` as evidence that an
ED 1 project could be initiated. The emergency declaration supporting ED 1
ended **2025-11-18**. The flag describes the parcel; it does not describe an
available process. Corrected in the matrix, §3, §4, the appendix and the
conclusions; recorded as a product finding at `PAIN_LOG.md` §P-22.

## A-25 · SB 684 leaned on the wrong evidence
### Result: **RESTRUCTURED — then OVERCORRECTED. Superseded by §A-29.**

The Revision 4 matrix attributed the SB 684 conclusion to a bundle — housing
use, Ellis, replacement flags — and labelled it conditional because the
RSO/JCO block is unresolved. **That understated it.** City Planning's SHRA
guidance independently bars demolition or alteration of housing occupied by
tenants in the previous five years, and the City's own record reports housing
use within the prior five years. For a project that would demolish or alter the
existing units, that criterion resolves the question **without waiting on
LAHD**. Stated at the time as confirmed as to such a project.

**That was itself an overstatement — see §A-29.** The correction swapped one
error for another: it removed a false dependency on RSO/JCO and replaced it
with false certainty about occupancy and Ellis facts the parcel flags never
established.

## A-26 · An absolute claim about the protection flags
### Result: **REMOVED**

*"Every protective flag on your property penalises removing or altering the
existing four units, and none of them penalises adding new ones."* — an
absolute over a set we did not exhaustively enumerate. Replaced with a claim
about the flags actually identified, plus an explicit statement that it is not
a guarantee nothing else constrains an addition.

## A-27 · An assertion about unread `[Q]` text
### Result: **REMOVED**

*"The `[Q]` matters less than it looks. It would constrain market-rate
redevelopment."* — we have not read the condition. Replaced with: it may matter
most for redevelopment or subdivision, its text is unresolved, and we would
retrieve it before evaluating that path.

## A-28 · Scan for unsupported certainty

Swept the client brief for `is` / `will` / `does` / `cannot` / `eligible` /
`entitlement` / `preempts` / `requires`. Additional softenings applied:

| Was | Now |
| --- | --- |
| methane and grading "both of which apply here" | "which the City's record flags for this parcel and which typically add cost" |
| RPO "requires a Replacement Unit Determination for any project" | "calls for a Replacement Unit Determination on projects" |
| "four others confirm they do not" | "four others record the parcel as not eligible for the transit-based programs" |
| `[Q]` "does not change the ADU answer" | "we would not expect it to change the ADU answer" |
| "state ADU law preempts local density limits" | "state ADU law limits how far local density rules reach" |

Remaining absolute language was reviewed and retained as sound: statements
about our own conduct ("we will not assert"), direct quotation of LAHD
("cannot determine"), and standard disclaimers.

## Pattern across five revisions

| Revision | Error | Caught by |
| --- | --- | --- |
| 1 | RSO presumed from age + unit count | Official ZIMAS record |
| 3 | "`[Q]` does not block ADUs" stated flatly | Own adversarial pass |
| 3 | "unlimited-density entitlement" | Human review |
| 4 | ED 1 read as a live pathway | **Human review** |
| 4 | Absolute claim over protection flags | **Human review** |
| 4 | Assertion about unread `[Q]` text | **Human review** |

**Three of six were caught only in human review.** The recurring mechanism is
constant: **a verified field gets narrated as an available outcome.** The flag
is evidence; the outcome is a conclusion requiring facts we often do not have.
`PROJECT_LAWS.md` Law 11 — human review may be required before a finding
becomes client-ready — is not a formality on this case. It is load-bearing.


---
---

# Revision 6 — the SB 684 evidentiary correction (2026-09-21)

## A-29 · ATTACK: "The SB 684 conclusion rests on facts the parcel flags never established."
### Result: **UPHELD — and this is the most instructive error in the case**

**The charge.** Revision 5 stated SB 684 was **CONFIRMED** closed for any
project altering or demolishing the existing units, on the strength of
`Housing Use within Prior 5 Years: Yes` plus the 2017 Ellis filing.

**Why it fails.** Neither flag establishes the predicate the rule turns on.

| SHRA rule | Flag relied on | The gap |
| --- | --- | --- |
| No demolition/alteration of units **occupied by tenants** in the prior 5 years | `Housing Use within Prior 5 Years: Yes` | Residential **use** ≠ **tenant occupancy**. An owner-occupied or vacant-but-maintained building registers use without tenancy |
| Restriction on parcels with a **qualifying Ellis withdrawal** in SHRA's look-back | `Ellis Act Property: Yes`, 2017-05-15 | Establishes a filing and a date. Not that it is a *qualifying* withdrawal, not its current status, not that it falls within **SHRA's** look-back (as distinct from RPO's ten-year Protected Unit look-back — a different regime) |

**The deeper error: framework conflation.** Revisions 2–5 progressively fused
five regimes — SHRA eligibility, Housing Crisis Act / Resident Protections
replacement, RSO, JCO, and Ellis — into a single "protected housing" bundle,
then reasoned from the bundle. **They have different tests and different
look-back periods.** The clearest symptom: the §1 evidence table cited the
**RPO ten-year** Protected Unit look-back as though it settled an **SHRA**
question. It does not.

**What makes this the most instructive error:** Revision 5 *was* a correction.
It fixed a real defect — an SB 684 conclusion improperly dependent on the
unresolved RSO/JCO determination — and in fixing it, overshot into certainty
the evidence never supported. **Correcting an understatement produced an
overstatement.** Each revision's fix became the next revision's defect.

**Correction applied.** SB 684 is now `POTENTIALLY BLOCKED for a project
altering or demolishing existing units — LIKELY / CONDITIONAL`, with the
verification step named: confirm the relevant occupancy history and the status
and effect of the Ellis record. Propagated to the client brief, the program
matrix (§1 verdict, evidence table, §7 interaction table, summary row, Small
Lot section, ADU section) and `PROPERTY_EVIDENCE.md`.

## A-30 · Error pattern across six revisions

| Rev | Error | Direction | Caught by |
| --- | --- | --- | --- |
| 1 | RSO presumed from age + unit count | Overstated | Official record |
| 3 | "`[Q]` does not block ADUs" | Overstated | Own adversarial pass |
| 3 | "unlimited-density entitlement" | Overstated | Human review |
| 4 | ED 1 read as a live pathway | Overstated | Human review |
| 4 | Absolute claim over protection flags | Overstated | Human review |
| 4 | Assertion about unread `[Q]` text | Overstated | Human review |
| 5 | SB 684 tied to unresolved RSO/JCO | **Understated** | Human review |
| 5 | SB 684 "CONFIRMED closed" | **Overstated** | **Human review** |

**Eight errors; seven overstatements; five caught only in human review.** The
mechanism is unchanged throughout: **a verified field narrated as a
conclusion.** Revision 6 adds a second mechanism worth naming —
**correction overshoot**: fixing an under-claim by installing an over-claim in
the same sentence.

`PROJECT_LAWS.md` Law 11 is not ceremony on this case. Five of eight errors
survived our own adversarial passes and were stopped only at human review.
