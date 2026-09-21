# Pain Log — product and workflow observations

Case ID: `PP-CASE-2026-09-VIDOR` · 2026-09-21
Context: Harper Halprin, AIA said *"We need something like this!"* This log is
the evidence for **what exactly** she needs.

Each entry: **SOURCE / SYSTEM · WHAT MADE IT DIFFICULT · WHAT A HUMAN
ARCHITECT WOULD HAVE TO DO · HOW PERMITPULSE COULD REDUCE THAT WORK.**

---

## P-00 · Research capability is not a given — and silence looks like an answer

**Source / system:** This research environment's egress policy.

**What made it difficult:** Every government host was blocked — ZIMAS, LADBS,
LA Planning, `leginfo`, HCD, the Assessor, `data.lacity.org`, LA City and
County ArcGIS. Only a web-search channel worked. Crucially, the failures were
*silent in character*: a blocked host returns the same nothing as a host with
no record. Without an explicit capability probe, this case could have been
written as "no permits found" and "no HPOZ" — both of which would have been
fabrications.

**What a human architect would have to do:** Nothing analogous — a human at a
browser would have noticed immediately. The analogue is subtler and more
common: a portal that is *up* but returns an empty result set, or a layer that
silently fails to draw.

**How PermitPulse could reduce that work:** Make **retrieval capability a
first-class, recorded case fact**. Before research begins, probe every source
in the jurisdiction's source hierarchy and record reachable / blocked /
degraded. Then every `unknown` carries its reason (`retrieval_failed` vs
`record_not_returned` vs `not_observed`) — a distinction the repo's
`evidenceUnknownReasons` enum **already models** but that nothing currently
populates automatically. Surface a per-case "source coverage" figure
("11 of 14 required sources retrieved") on the packet. This is the single
highest-integrity feature suggested by this case, and it is mostly plumbing.

---

## P-01 · A search engine handed back an official URL for the wrong property

**Source / system:** Web search → `portal.assessor.lacounty.gov`.

**What made it difficult:** Searching the exact address returned an
assessor-portal URL containing APN `8025-001-015` as the top result. A later
search for the same address returned a *different* assessor URL,
`5542025002`. A third source gave `4330-005-092` for a neighbor. The domain is
authoritative; the **address-to-APN association was search-engine inference**.
Nothing on the result page said "this is 9854 Vidor Dr."

**What a human architect would have to do:** Notice that three APNs appeared
for one address; realize that book `8025` and book `4330` cannot both be the
Westside; go back to the Assessor and search by address, not by clicking the
first result. Most people click the first result.

**How PermitPulse could reduce that work:** Never accept a parcel identifier
that did not come from an **address-keyed query against the authoritative
system**. Treat a search-derived APN as a *lead*, never a fact. Validate any
APN against the jurisdiction's book/page geography and flag an out-of-region
book immediately. Show the address→APN binding, with its source, on the
evidence card.

---

## P-02 · The decisive answer exists, as a per-parcel flag, buried three clicks into a map viewer

**Source / system:** ZIMAS → address → Planning and Zoning menu → scroll →
`SHRA / SB 684 Eligibility` hyperlink.

**What made it difficult:** LA City Planning **has already computed** SB 684
eligibility per parcel. It is not a document to interpret — it is a flag. But
it lives behind an address lookup, a pop-up, a left-hand menu, and a scroll,
in a viewer that does not expose a public API. The same viewer also holds the
SB 79 and Low-Rise eligibility maps, the CHIP incentive-area flags, and the
TOC tier. **Four programs, four flags, one viewer, zero machine access.**

**What a human architect would have to do:** Learn that the flag exists (it is
documented on a separate Planning page, not in ZIMAS itself), then repeat the
click path per parcel, per program, and screenshot the result because ZIMAS
has no shareable per-parcel permalink for these sub-layers.

**How PermitPulse could reduce that work:** This is the product. A single
address input that returns the full parcel profile **including every
program-eligibility flag the City has already published**, each with source,
retrieval timestamp, and the screenshot as evidence. The value is not analysis
— it is **retrieval and provenance of flags that already exist**.

---

## P-03 · The programs a client names are rarely the programs that govern

**Source / system:** Client framing versus the actual statutory landscape.

**What made it difficult:** Harper named SB 684, SB 1123 and CHIP. On the
reported facts, SB 1123 is inapplicable, SB 684 is probably blocked by a
constraint she did not mention, and CHIP's governing term is a **tenant
protection ordinance**, not an incentive tier. Meanwhile **SB 79** and LA's
**Low-Rise Ordinance** — both effective within the last three months — went
unmentioned and may matter more than all three combined. **SB 1211**, which
is the most likely to actually yield units here, also went unmentioned.

**What a human architect would have to do:** Track roughly a dozen state bills
and four local ordinances per year, each with its own effective date, and
re-screen every property against all of them. This is a full-time policy
job layered onto a design practice — which is exactly what Harper described
at the roundtable.

**How PermitPulse could reduce that work:** **Never answer only the question
asked.** Run the parcel against the full active program set and report three
buckets: *asked about and applicable*, *asked about and not applicable (with
the reason)*, and **crucially — *not asked about and applicable***. That third
bucket is where a client's perceived value is created.

---

## P-04 · The binding constraint sits in a different agency than the program

**Source / system:** LA City Planning (CHIP, SHRA) versus LAHD (RSO, RPO).

**What made it difficult:** Whether SB 684 or CHIP can work here is decided by
**rent stabilization status and certificate-of-occupancy date** — held by LAHD
and LADBS, not by Planning. Planning's program pages describe incentives;
they do not tell you that your fourplex is a protected-housing site. A
researcher looking only at Planning would produce a confident, optimistic,
**wrong** report.

**What a human architect would have to do:** Know in advance that
"pre-Oct-1978 + 2 or more units = presumptively RSO", then pull an LAHD
record and an LADBS C-of-O date, then re-read the state statute's
protected-housing bar, then request an RPO Replacement Unit Determination —
four systems to answer one question.

**How PermitPulse could reduce that work:** Encode **cross-agency
dependencies** as first-class rules: *"If jurisdiction = LA City AND units ≥ 2
AND C-of-O < 1978-10-01 → raise RSO_PRESUMPTION; block any 'SB 684 available'
or 'CHIP available' conclusion until LAHD status is retrieved."* The repo
already has the right home for this in
`app/src/shared/mission-intelligence/rules.ts` — deterministic rules
generating blockers, exactly as `PROJECT_LAWS.md` Law 13 prefers.

---

## P-05 · One statute, two "vacancy" tests, easy to conflate

**Source / system:** SB 684 / SB 1123 / AB 130 as amended.

**What made it difficult:** SHRA contains a **site-condition** test
("vacant" = no permanent structure unless abandoned and uninhabitable,
applicable to the single-family pathway) and, separately, a **protected-housing
demolition bar** (no demolition or alteration of deed-restricted, rent-controlled,
or recently tenant-occupied housing). These are independent. Several secondary
summaries blur them. Getting it backwards flips the answer for a multifamily
parcel with an existing building.

**What a human architect would have to do:** Read the statute, not the summaries.

**How PermitPulse could reduce that work:** Model eligibility as a **named,
individually-cited test list** rather than prose — each test with its own
source pin, pass/fail/unknown state, and the parcel fact it consumes. A
client then sees *which* test is unresolved, not just "it's complicated."
This is the structural difference between a report and a tool.

---

## P-06 · A 2025 budget trailer bill quietly reopened a door everyone assumes is shut

**Source / system:** AB 130 (2025) remainder-parcel provision.

**What made it difficult:** The intuitive conclusion — "occupied RSO fourplex,
therefore no SB 684" — is the one almost any analyst would reach. AB 130 then
authorized subdivisions to designate a **remainder parcel** retaining existing
structures, excluded from the 10-parcel maximum and from density calculations.
That may permit the existing building to stay untouched while new units go on
the balance of the lot. This provision arrived in a **CEQA-reform budget
trailer bill**, not in a housing bill anyone was watching for subdivision
mechanics.

**What a human architect would have to do:** Read budget trailer bills for
land-use amendments. Essentially nobody does.

**How PermitPulse could reduce that work:** Maintain a **program changelog
keyed to parcels, not to newsletters** — when an amendment changes a test, every
prior case whose verdict depended on that test gets flagged for re-screen.
`docs/PAPER_TRAIL_LOOP.md` already describes a reverification loop; this
extends it from *sources* to *rules*.

---

## P-07 · Effective dates conflict between the agency and the commentary

**Source / system:** LA City Planning SHRA page vs. law-firm alerts.

**What made it difficult:** SB 684's effective date appeared as both
**2024-07-01** (LA City Planning) and **2024-01-01** (commentary) — probably a
chaptered/operative distinction, but unresolved. Same shape for SB 1123
(chaptered 2024, reported effective 2025-07-01).

**What a human architect would have to do:** Reconcile against the chaptered
text, or just pick one and hope it never matters. It matters for anything
filed near the boundary, and for vesting arguments.

**How PermitPulse could reduce that work:** Store **both dates with both
sources** and surface the disagreement rather than averaging it — the exact
behavior the repo's conflict fixture already encodes for property facts.
Extend `classification: "conflict"` from parcel claims to **program metadata**.

---

## P-08 · Everything decision-grade is a PDF

**Source / system:** `SB_684_1123_Memo_Update_ACP.pdf`, `FD_CHIP_Fact_Sheet.pdf`,
`CHIP_ProceduresResources_Final.pdf`, `CP-4095` MIIP incentive-area maps,
`Exhibit_2A_Low-Rise_Ordinance.pdf`, `SmallLotDesignStandards.pdf`,
SCAG's `SB79-ApproachAndMethodology-Final.pdf`, the CEQAnet NOP.

**What made it difficult:** The operative rules — and the maps that decide
geographic eligibility — are in undated, unversioned, non-machine-readable
PDFs at opaque GUID URLs. Two different CHIP fact sheets carry two different
"Updated" stamps. There is no index, no changelog, no diff.

**What a human architect would have to do:** Bookmark GUID URLs, re-download
periodically, and manually diff to detect changes. Nothing notifies her.

**How PermitPulse could reduce that work:** Content-hash and archive every
governing PDF at retrieval, with the retrieval date attached to the finding
that cites it. Re-fetch on a schedule; alert when the hash changes; show
clients *"this conclusion rests on a document last verified <date>; the
document changed on <date>."* This is a direct, concrete extension of
`docs/PAPER_TRAIL_LOOP.md`.

---

## P-09 · PermitPulse's own LA integration cannot answer a zoning question

**Source / system:** This repository.

**What made it difficult:** `workers/pp-api/src/config/jurisdictions.js`
configures `la_city` as a **Socrata permit feed only** (`data.lacity.org`,
dataset `pi9x-tg5x`) — permit number, address, type, issue date, valuation,
work description. There is **no** parcel, zoning, overlay, or
program-eligibility source configured for the flagship jurisdiction. The
generic `arcgis.js` provider that could carry parcel and zoning layers already
exists and is used for Beverly Hills and Culver City — but not for LA City.
Meanwhile the prior property-research example
(`app/src/shared/demo/arroyo-vista-demo.ts`) is a **permit-expediting** case;
nothing in the repo demonstrates an **entitlement/eligibility** case at all.

**What a human architect would have to do:** Everything in this file, manually.

**How PermitPulse could reduce that work:** This is the product gap the Harper
case exposes. The evidence engine, conflict handling, unknown-reason taxonomy,
packet model and quality gate are **all already built and are genuinely
good** — they are simply not fed zoning data. Adding LA City parcel/zoning/
overlay sources behind the existing ArcGIS provider, plus an eligibility-flag
harvester for the ZIMAS program layers, would convert an existing engine into
the product Harper said she needs. **The hard part is already done.**

---

## P-10 · Terminology mismatch: "my property" versus every system's key

**Source / system:** Client language vs. ZIMAS / Assessor / LADBS / LAHD.

**What made it difficult:** Harper gave a street address. ZIMAS keys on
address *or* APN *or* PIN *or* legal description; the Assessor keys on AIN;
LADBS keys on address *and* permit number; LAHD keys on address *and* APN;
SCAG's SB 79 map keys on geography. Each system normalizes addresses
differently, and a unit-numbered address (common on this block) can fail
lookups that a base address succeeds at.

**What a human architect would have to do:** Maintain a personal crosswalk of
identifiers and re-key it into five systems.

**How PermitPulse could reduce that work:** Resolve the address **once** to a
canonical identifier set (address point, APN/AIN, PIN, tract/lot, council
district, community plan), pin it to the case, and drive every downstream
query from that set — showing the user the crosswalk so an error is visible
rather than silent.

---

## P-11 · Private restrictions sit outside every public system

**Source / system:** Beverlywood Homes Association CC&Rs; LA County Recorder.

**What made it difficult:** An HOA website states boundaries and a
single-family use restriction. That is not a recorded document. The actual
CC&Rs and tract map live at the Recorder, behind a separate paid search, keyed
by instrument number. Whether Vidor Dr is a member tract is unresolved — and
state ADU law voids some private restrictions but not all, which is a legal
question, not a records question.

**What a human architect would have to do:** Order a title search or a
Recorder pull, then have counsel read the CC&Rs against current ADU law.

**How PermitPulse could reduce that work:** Flag the *existence and
unresolved status* of private restrictions as a named case item rather than
omitting them because they are not in a public GIS layer. **Silence on private
restrictions reads as absence** — the same Law 4 failure as "no permits found."

---

## P-12 · The rules changed twice while this case was being researched

**Source / system:** LA's 2026 land-use calendar.

**What made it difficult:** Within roughly six months: SB 79 effective
**2026-07-01**; LA's Low-Rise and Phased Implementation Ordinances effective
**2026-06-30**; Council direction on phased SB 79 implementation
**2026-03-24**; SCAG methodology approved July 2026 with its verified map
posted **2026-07-01** and **further updates expected**; the Westside Community
Plans Update actively underway; the New Zoning Code adopted January 2025 and
being applied plan-by-plan. A brief written in May 2026 would already be
wrong. A brief written today has a known expiry.

**What a human architect would have to do:** Re-verify before every client
decision, with no notification when anything changes.

**How PermitPulse could reduce that work:** Put an explicit **"verified as of"
date and a re-verification trigger** on every program conclusion, and
re-screen stored cases when a program's governing document or map changes.
For a jurisdiction moving this fast, *freshness is the product* — arguably
more than the initial analysis. Harper's actual problem is not that this is
unknowable; it is that it **will not stay known**.

---

## P-13 · An agency guidance letter silently rewrote a statutory test

**Source / system:** California HCD guidance letter, **2025-10-07**, on SB 1123.

**What made it difficult:** The statute says a lot must be "vacant" — no
permanent structure unless abandoned and uninhabitable. Read plainly, a lot
with a house on it is out. HCD then issued guidance holding that the lot *can*
qualify once a remainder parcel is designated for the existing structure, so
that the balance of the site is treated as vacant. **The statutory text did not
change. The operative meaning did.** This surfaced only on an adversarial
search, after the case file had already recorded the opposite conclusion.

A guidance letter is not in the bill text, not in the municipal code, not on
the City's program page, and not in any map layer. It exists as a PDF
referenced in a law-firm client alert. And it is **not binding law** — courts
generally defer to HCD but interpretation rests with the judiciary — so it
cannot simply be adopted as settled either.

**What a human architect would have to do:** Monitor HCD guidance letters and
technical assistance memoranda in addition to bills, codes and ordinances, and
then form a view on how much weight non-binding guidance deserves.

**How PermitPulse could reduce that work:** Treat **agency guidance as a
distinct, tracked source type** sitting between statute and commentary, with
its own authority level and its own "binding / persuasive / contested" flag.
Where guidance contradicts the plain text, surface **both** and mark the claim
`conflict` rather than adopting the newer one — the behavior
`PROJECT_LAWS.md` Law 5 already requires for property facts, extended to
program rules. The lesson generalizes: **the most dangerous source is the one
that quietly supersedes a source you already trust.**

---

## P-14 · Neighborhood heuristics fail on the exact street where you use them

**Source / system:** Listing data across the 9800 block of Vidor Drive.

**What made it difficult:** Three neighboring parcels reported `LAR3`, which
made "this block is multifamily" feel safe. It is not: **9875 Vidor Dr reports
as a single-family property**, and 9800 and 9880 report **1990** construction
(one expressly not rent-controlled) against the subject's reported **1947**.
One short street contains both zoning categories and both sides of the
rent-stabilization cutoff. Every heuristic that would have been applied here —
zoning by adjacency, RSO status by neighborhood vintage — fails on this street.

**What a human architect would have to do:** Resist a reasonable-looking
inference and pull the parcel record anyway. The inference is *usually* right,
which is what makes it dangerous.

**How PermitPulse could reduce that work:** Never let a neighbor-derived value
populate a parcel field. If adjacency is used at all, store it as a separate
`derived` observation with its own confidence and an explicit
`not_a_substitute_for` pointer to the authoritative field — and **block any
client-facing conclusion that consumes it**. A product whose value is
source-traceability cannot ship neighborhood averages as parcel facts.
