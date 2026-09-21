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
