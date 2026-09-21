# Workflow Map — Long Beach coastal entitlement + plan check

Case: Ed Gulian, Gulian Design Architects, Inc., Long Beach, CA
Prepared: 2026-09-21
Status: INTERNAL DRAFT — not client-ready, not publishable
Owner: PermitPulse product research

---

## 0. Research integrity notice (read first)

This session's network egress policy **blocked direct retrieval of `longbeach.gov`,
`source.www.longbeach.gov`, `documents.coastal.ca.gov`, `coastal.ca.gov`,
`library.municode.com`, and `permitplace.com`.** WebFetch returned
`EGRESS_BLOCKED` for every one.

Everything below was obtained through **search-engine summaries of those official
pages**, not by retrieving the pages. Under PROJECT_LAWS #2, #3, #4 and #9 that
means:

- Claims are labeled `[S]` = search-surfaced summary of a named official source
  (weaker than retrieval — the URL is real and named, the wording is the search
  engine's paraphrase, not verified verbatim text).
- Claims labeled `[E]` = Ed's own first-person statement.
- Claims labeled `[I]` = PermitPulse inference. Inference is never evidence.
- Nothing here is `verified` in the evidence-model sense. **Every `[S]` claim must
  be re-retrieved from the canonical URL before it enters a client-facing artifact
  or a product spec that depends on it being exactly right.**
- Failure to retrieve does not mean the record is absent (PROJECT_LAWS #4). Several
  gaps below are *retrieval* gaps, not *evidence of absence*, and are marked so.

**Highest-consequence claim requiring verbatim re-verification: LBMC 18.05.060
(12-month plan review expiration).** The entire product thesis leans on it. It is
currently `[S]` only.

---

## 1. Correcting the assumed lifecycle

The brief proposed:

```
SUBMIT → ASSIGNED → REVIEW → COMMENTS → ARCHITECT RESPONSE → RESUBMIT
→ WAIT → FOLLOW UP → ADDITIONAL COMMENTS → APPROVAL / CLEARANCE
```

The evidence says this is **wrong in four structural ways**:

**(a) It is not one pipeline. It is two-to-four concurrent pipelines with a
cross-dependency.** Ed states it directly: *"If there is no LCDP, Planning would go
at the same time as the Building Dept. submittal."* `[E]` So Planning and Building
run **in parallel** — except when an LCDP exists, in which case Planning becomes a
**3–4 month serial prefix** `[E]` and Building starts after. The presence or
absence of an LCDP inverts the topology of the whole project. That single boolean is
the most consequential fact about any Long Beach coastal job.

**(b) There is no distinct `ASSIGNED` state visible to the architect.** Long Beach's
Plan Review Status tool is queried by *"the project number assigned when the
application was screened and routed for review"* `[S]` and gives *"basic information
regarding the status of a project that has been submitted to the Building and Safety
Bureau for plan check"* `[S]`. Reviewer identity, discipline queue, and routing date
are not published. `[I]` This is why Ed's follow-up is phone/email: the state he
needs does not exist in any system he can read.

**(c) `APPROVAL` is not terminal on a coastal job.** Local approval starts an
appeal cascade that Ed does not control and may not be able to see:
local appeal window → transmission of the Notice of Final Action / Final Local
Action Notice to the Coastal Commission → Commission appeal window. `[S]` A project
can be "approved" and still not be effective for weeks.

**(d) The pipeline has a hard expiry.** Plan review applications are stated to be
valid 12 months from the date of application per LBMC 18.05.060; on expiry *"no
permit will be issued, and a new plan check for the project along with new plan
check fees will be required"* `[S]`. **The waiting Ed describes is consuming a
budget that can run out.** This does not appear anywhere in the assumed lifecycle.

### Corrected lifecycle

```
                     ┌─ IS THE PARCEL IN THE COASTAL ZONE? ─┐
                     │                                      │
                    YES                                     NO
                     │                                      │
        ┌────────────┴───────────┐                          │
   Discretionary?           Not discretionary?               │
        │                        │                           │
   LCDP TRACK              CPCE TRACK                        │
   (3–4 mo) [E]          (categorical exclusion) [S]         │
        │                        │                           │
        └────────────┬───────────┘                           │
                     ↓                                       ↓
              PLANNING ENTITLEMENT  ←── runs CONCURRENT with ──→ BUILDING PLAN CHECK
              (LCDP/CUP/AUP/SPR)          when no LCDP  [E]       (≈20-day cycles) [S]
                     │                                            │
                     │                                     ┌──────┴──────┐
                     │                              Building  Fire  PW/Health
                     │                              (+ E/P/M contacted
                     │                               separately) [S]
                     ↓                                            ↓
         ZA HEARING (2nd & 4th Mon, 2pm) [S]        CORRECTION CYCLE 1..N
         ~60 days from complete app [S]             (2–3 typical) [S]
                     ↓                                            ↓
         DECISION → Notice of Final Action [S]       ALL DISCIPLINES CLEAR
                     ↓                                            ↓
         LOCAL APPEAL: 10 calendar days [S]          READY-TO-ISSUE
                     ↓                                            ↓
         FLAN/NOFA → Coastal Commission                     PERMIT ISSUED
         (7 cal. days to notify) [S]
                     ↓
         CCC APPEAL: 10 WORKING days,
         starts only on a CONFORMING notice [S]
                     ↓
              PERMIT EFFECTIVE

         ⏳ OVERARCHING: plan review application expires 12 months
            from application date (LBMC 18.05.060). Extension request
            due ≥30 days before expiry. [S]
```

---

## 2. Stage-by-stage map

Columns per the brief. `⚠` marks a state that can **sit silently with nobody
acting**; `☎` marks a state whose truth is only obtainable by phone/email.

### Stage 1 — Coastal determination (is an LCDP required?)

| Field | Finding |
|---|---|
| System/portal | Long Beach "Coastal Permitting Process Flow Chart", which begins with *"Is the Project in the Coastal Zone?"* and addresses *"Original Permit Jurisdiction"* `[S]` |
| Public info | Coastal zone boundary; appealable-area boundary; CPCE eligibility rules under LBMC Title 21 Ch. 21.25 Div. IX `[S]` |
| Private-only | Whether staff agrees the project is non-discretionary and CPCE-eligible ☎ |
| Responsible | Planning Bureau, Coastal Planning |
| Artifact | CPCE application, or determination that an LCDP is required |
| Status info | CPCE filings are *"posted on a weekly basis"* `[S]` — **a public, recurring, monitorable feed** |
| Triggers architect | Pre-application contact with Planning |
| Triggers agency | Receipt of application |
| ⚠ Can sit silently | Yes — pre-application questions have no clock |
| Manual follow-up | Yes |

> **Product-relevant:** this one determination sets whether the project is a
> 6-week job or a 6-month job. `[I]` It is also the only stage where a wrong
> assumption is cheap to fix and expensive to discover late.

### Stage 2 — Planning entitlement application + completeness

| Field | Finding |
|---|---|
| System/portal | New Planning Application Submittal; LB Services (permitslicenses.longbeach.gov) accepts *some* planning entitlements — *"site plan review, creative sign permits, and sign programs"* `[S]`. **LCDP is not named as an online-submittable type.** `[S]` |
| Public info | Filing requirements, fee schedule |
| Private-only | The completeness letter itself; which specific items are outstanding ☎ |
| Responsible | Assigned project planner |
| Artifact | **Completeness determination letter** (complete / incomplete + exhaustive item list) |
| Status info | *"Incomplete submittals will not be processed until all required documentation is received"* `[S]` |
| Triggers architect | Receipt of incompleteness letter |
| Triggers agency | Resubmittal — **and a new 30-day completeness period begins on each resubmittal** `[S]` |
| ⚠ Can sit silently | **No — this is clocked.** Permit Streamlining Act: determination due within **30 calendar days**; if not made, the application is **deemed complete** `[S]` |
| Manual follow-up | Only if the 30 days lapse silently |

> **The sharpest under-used rule in the whole map:** *"In any subsequent review of
> the application determined to be incomplete, the local agency shall not request
> the applicant to provide any new information that was not stated in the initial
> list of items that were not complete."* `[S]` — Gov. Code §65943.
> This is the statutory answer to *"they added new comments on round 2."* `[I]`
> Enforcing it requires only a diff of letter 1 against letter 2. That is a pure
> software operation.

### Stage 3 — Environmental (CEQA) pathway

| Field | Finding |
|---|---|
| System/portal | None applicant-facing |
| Public info | *"Negative Declarations are prepared by the City and are available for review 21 days prior to public hearings"* `[S]`; CEQAnet postings `[S]` |
| Private-only | Which pathway staff selected, and when ☎ |
| Responsible | Project planner ("Determine Environmental Pathway" step) `[S]` |
| Artifact | Exemption determination / Negative Declaration |
| ⚠ Can sit silently | **Yes — this is the classic invisible stall.** `[I]` No applicant-visible clock and no portal state. |
| Manual follow-up | Yes |

### Stage 4 — Zoning Administrator hearing (LCDP)

| Field | Finding |
|---|---|
| System/portal | ZA Notice of Public Hearings page; individual notices published as PDFs at stable paths, e.g. `.../za-public-hearings/2026/za-nph-2604-18-5331-e--ocean-blvd` `[S]` |
| Public info | **Hearing calendar (2nd & 4th Monday, 2:00 PM)**, agendas, notices, minutes `[S]` — all public and monitorable |
| Private-only | Whether the item actually got calendared for a given date ☎ |
| Responsible | Zoning Administrator |
| Artifact | Public hearing notice; ZA minutes; decision |
| Status info | Hearing *"typically held within 60 days of the submittal of a complete application"* `[S]` |
| Triggers architect | Notice publication |
| Triggers agency | Completeness |
| ⚠ Can sit silently | Yes — between "complete" and "calendared" |
| Manual follow-up | Yes, but **largely replaceable by watching the notice feed** `[I]` |

> **Highest-value automatable signal in the entitlement track.** `[I]` The moment
> a project address appears in a ZA notice PDF, the hearing date, case number, and
> LCDP number are all knowable without asking anyone.

### Stage 5 — Decision, Notice of Final Action, appeal windows

| Field | Finding |
|---|---|
| System/portal | City publishes the Notice of Final Action (NoFA); CCC publishes received notices and pending appealable permits `[S]` |
| Public info | Local appeal window: **10 calendar days** after decision `[S]`. CCC appeal window: **10 working days** `[S]`. CCC posts all appealable local permits *"during the applicable appeal period"* `[S]` |
| Private-only | Whether the city actually transmitted a conforming notice ☎ |
| Responsible | Planning Bureau (transmit); CCC (receive, post) |
| Artifact | NoFA / FLAN |
| Status info | 14 CCR §13571: local government must notify the Commission **within 7 calendar days** of completing its review `[S]` |
| ⚠ Can sit silently | **Yes, and this is the worst one.** *"Until the Commission receives a FLAN/NOFA meeting the requirements of Section 13571 … the appeal period with the Commission cannot start."* `[S]` A **deficient** notice suspends the effective date, with CCC notifying city and applicant within 5 calendar days `[S]`. So an architect can believe a project is approved while the clock has never started. |
| Manual follow-up | Yes — currently the only way to know |

> **This is the single best fit for PermitPulse's existing change-detection
> instinct.** `[I]` The state Ed cannot see locally is **published by a different
> agency** (CCC) on a public page. Watching the CCC side reveals the Long Beach
> side. That is exactly the "follow the paper trail" capability the brand already
> claims.

### Stage 6 — Building plan check submittal

| Field | Finding |
|---|---|
| System/portal | Permit Center, 411 W. Ocean Blvd, 2nd Floor `[S]`; LB Services online for a **narrow list** (renewable energy, reroof, panel changeout, water heater, certain commercial) `[S]`; consolidated Development Permit Application for multi-scope work `[S]` |
| Public info | Checklists (PRC-002 Multifamily, Group A-TI, Group M-TI, NFPA 13 sprinkler, etc.) `[S]`; fee schedule; $115 processing fee + 6% technology + 6% general plan surcharges `[S]` |
| Private-only | The assigned project number (needed to query status at all) ☎ |
| Responsible | Permit Center intake |
| Artifact | **Project number** — the key to every subsequent status query `[S]` |
| ⚠ Can sit silently | Yes — screening/routing has no published clock |
| Manual follow-up | Yes |

> **Note the access asymmetry:** the status tool is keyed on a number that is only
> issued *after* intake screening. Before that number exists, the project is
> invisible to every public system. `[I]`

### Stage 7 — Multi-discipline review

| Field | Finding |
|---|---|
| System/portal | Plan Review Status (per project number) `[S]` |
| Public info | ≈20 days for the initial review cycle; further submissions reviewed within another ≈20 days `[S]` |
| Private-only | Per-discipline state; reviewer identity; reviewer availability ☎ |
| Responsible | Building & Safety; **Fire Prevention Bureau** (fire/life safety, egress, alarm, suppression) `[S]`; *"electrical, plumbing, mechanical and/or health plan reviews require contacting those agencies, departments and/or non-city entities separately"* `[S]` |
| Artifact | Correction letter per discipline |
| Status info | A single aggregate status per project — **not per discipline** `[I]` |
| ⚠ Can sit silently | **Yes.** A project can be "in review" while one discipline has been idle for weeks and the aggregate status never moves. |
| Manual follow-up | Yes — this is Ed's "pest" work |

> **The structural defect:** the number of review queues exceeds the number of
> status values. `[I]` One aggregate status cannot express "Building cleared, Fire
> idle 34 days, Health not contacted." Ed reconstructs that by phone, every time.

### Stage 8 — Corrections issued

| Field | Finding |
|---|---|
| System/portal | Delivered as PDF/email; resubmittal is *"via email directly to the plan checker that sent the corrections"* `[S]` |
| Public info | None — **the correction letter is not public** `[I]` |
| Private-only | The entire substance ☎ |
| Responsible | Individual plan checker |
| Artifact | **Correction letter (PDF), numbered comments, per discipline** |
| Status info | Status may flip to "corrections issued" |
| Triggers architect | Receipt of the letter |
| ⚠ Can sit silently | Yes — if the email lands badly, nothing chases it |
| Manual follow-up | Yes |

### Stage 9 — Architect response + resubmittal

| Field | Finding |
|---|---|
| System/portal | **Email to the individual plan checker** `[S]` — not a portal transaction |
| Public info | None |
| Responsible | Architect (Ed), engineers, Title-24 consultant, owner |
| Artifact | Response-to-comments letter + revised sheets |
| Required form | *"sort comments by discipline and assign each item to the architect, engineer, contractor or owner; repeat each comment, explain the change and identify the updated sheet, detail or calculation; and update sheet dates, revision clouds, indexes, calculations and supporting reports together"* `[S]` |
| ⚠ Can sit silently | Yes — **an emailed resubmittal has no receipt** `[I]` |
| Manual follow-up | Yes — confirming the email was received *is itself a follow-up* |

> **This is the deepest structural flaw in the whole workflow** `[I]`: the
> resubmittal — the single most important event in the project, the one that
> restarts the review clock — is transmitted by **email to one person**, generating
> **no system record, no timestamp, no receipt, and no status change**. Every
> downstream ambiguity Ed suffers traces back to this.

### Stage 10 — Wait / follow up / additional comments

| Field | Finding |
|---|---|
| System/portal | Plan Review Status (may be stale); phone 562.570.PMIT / 562.570.LBCD `[S]` |
| Private-only | Everything that matters ☎ |
| ⚠ Can sit silently | **Yes — this is where the 100 hours live** `[E]` |
| Ed's stated mechanism | *"Plus bugging the plan checker to respond, while they are on vacation, city PTO days, plan checkers too busy on other projects. So, I have to become a pest to get things finalized."* `[E]` |

### Stage 11 — Clearance and issuance

| Field | Finding |
|---|---|
| System/portal | Ready-To-Issue Permits for Approved Plans `[S]` |
| Artifact | Issued permit |
| ⚠ Expiry | **Plan review application valid 12 months (LBMC 18.05.060); expired ⇒ no permit, new plan check, new fees. Extension request due ≥30 days before expiry (Form-002).** `[S]` |

---

## 3. The clock inventory

The most decisive output of this map. Every clock that governs a Long Beach coastal
job, who it binds, and whether Ed can currently see it.

| # | Clock | Length | Binds | Starts on | Visible to Ed today? | Consequence of missing |
|---|---|---|---|---|---|---|
| C1 | PSA completeness (§65943) | 30 calendar days | Agency | Application receipt / each resubmittal | ✗ | Application **deemed complete** `[S]` |
| C2 | PSA "no new items" (§65943) | n/a — a rule, not a clock | Agency | 2nd+ incompleteness letter | ✗ | Agency may not add items not in list 1 `[S]` |
| C3 | ZA hearing target | ~60 days from complete app | Agency (soft) | Completeness | ✗ | Slip is invisible |
| C4 | CEQA doc public review | 21 days pre-hearing | Agency | Neg Dec publication | Partially | — |
| C5 | Local appeal | 10 **calendar** days | Third parties | Decision | ✗ | Project not final |
| C6 | City → CCC notice (14 CCR §13571) | 7 calendar days | City | Completion of review | ✗ | Appeal period never starts `[S]` |
| C7 | CCC appeal | 10 **working** days | Third parties | Conforming notice received | Partially (CCC posts) | Permit not effective |
| C8 | Deficient-notice suspension | 5 calendar days | CCC | Notice of deficiency | ✗ | Effective date suspended `[S]` |
| C9 | Building first review | ≈20 days | Agency (soft) | Routing | ✗ | Invisible slip |
| C10 | Building resubmittal review | ≈20 days | Agency (soft) | Resubmittal email | ✗ | Invisible slip |
| C11 | **Plan review expiration (LBMC 18.05.060)** | **12 months** | **Ed** | **Application date** | **✗** | **New plan check + new fees** `[S]` |
| C12 | **Extension request lead time (Form-002)** | **≥30 days before C11** | **Ed** | — | **✗** | **Extension unavailable** `[S]` |
| C13 | AB 2234 completeness | 15 days | Agency | Application | ✗ | HAA violation `[S]` — **coverage uncertain, see below** |
| C14 | AB 2234 review, ≤25 units | 30 **business** days | Agency | Completeness | ✗ | HAA violation `[S]` |
| C15 | AB 2234 review, ≥26 units | 60 **business** days | Agency | Completeness | ✗ | HAA violation `[S]` |
| C16 | PSA approve/disapprove (§65950) | 60–180 days per pathway | Agency | CEQA determination | ✗ | **Deemed approval**, if notice occurred `[S]` |

**Finding: 16 clocks. Ed can currently see, at best, 2.** `[I]`

**Two of the clocks bind Ed, not the agency — C11 and C12 — and those are the only
two where missing the deadline destroys work product.** Everything else costs time.
C11 costs the plan check.

### ⚠ Open question on AB 2234 coverage — do not assert

AB 2234 applies to *"housing development projects."* Gulian Design's work is
described publicly as *"custom residential homes, offices, retail & restaurants."*
`[S]` Whether a single custom home is a "housing development project" under Gov.
Code §65589.5(h)(2), and whether a coastal SFR is in scope at all, is **unresolved
here and must not be asserted to Ed.** `[I]` If it does not apply, C13–C15 drop out
and the statutory leverage narrows to the PSA clocks (C1, C2, C16) — which apply to
*discretionary* approvals, i.e. the LCDP track, not plan check.

**Honest consequence: the statutory-clock story is strongest on the entitlement
side and weakest exactly where Ed spends the most time (plan check).** On plan
check, the only hard clock is C11 — and it runs *against* Ed.

---

## 4. What can silently sit, ranked

1. **Resubmittal emailed to a plan checker who is out.** No receipt, no queue entry,
   no status change, no escalation path. `[S]+[E]`
2. **NoFA/FLAN not transmitted to CCC.** Appeal clock never starts; project appears
   approved but is not effective. `[S]`
3. **One discipline idle while aggregate status shows "in review."** `[I]`
4. **CEQA pathway determination.** No clock, no portal state. `[I]`
5. **Complete → calendared gap before a ZA hearing.** `[S]`
6. **Plan review application ageing toward the 12-month wall.** Nothing warns. `[S]`

## 5. What requires manual follow-up (irreducible today)

- Reviewer identity and current discipline queue ☎
- Confirmation that an emailed resubmittal was received and re-queued ☎
- Per-discipline state ☎
- Whether a fee/form/clearance is blocking routing ☎
- Whether the NoFA was transmitted and conforming ☎

**All five are "who owes the next action" questions. None are design questions.**
`[I]` That is the boundary the product must respect.

---

## 6. Sources

Retrieved 2026-09-21 via search-engine summary; **direct retrieval blocked** as noted in §0.

- [Entitlement Process — City of Long Beach](https://longbeach.gov/lbcd/planning/current/entitlement-process/)
- [Plan Review Service — City of Long Beach](https://www.longbeach.gov/lbcd/building/plan-review-service/)
- [Project Status Search Tools — City of Long Beach](https://www.longbeach.gov/lbcd/building/building-permit-status-search-tools/)
- [Permit Status Inquiry — City of Long Beach](https://www.longbeach.gov/lbcd/building/permit-center/status-inquiry/)
- [Permit Status / Records — City of Long Beach](https://longbeach.gov/lbcd/building/permit-center/building-permit-records/)
- [Permit Center — City of Long Beach](https://www.longbeach.gov/lbcd/building/permit-center/)
- [Online Permitting — City of Long Beach](https://www.longbeach.gov/lbcd/building/permit-center/online/)
- [LB Services – Permitting and Licensing](https://permitslicenses.longbeach.gov/)
- [Ready-To-Issue Permits for Approved Plans](https://www.longbeach.gov/lbcd/building/ready-to-issue-permits/)
- [Coastal Permitting Process Flow Chart](https://www.longbeach.gov/globalassets/lbcd/media-library/documents/planning/coastal-planning/coastal-permitting-process-flow-chart)
- [Coastal Permit Categorical Exclusions (CPCE) – Status](https://www.longbeach.gov/lbcd/planning/current/coastal-planning/cpce-status/)
- [Zoning Administrator — City of Long Beach](https://www.longbeach.gov/lbcd/planning/current/zoning/administrator/)
- [ZA Notice of Public Hearings](http://www.longbeach.gov/lbds/planning/current/zoning/administrator/public-hearings/)
- [Appeals Procedure — City of Long Beach](https://www.longbeach.gov/lbcd/planning/current/appeals/)
- [Environmental Planning — City of Long Beach](https://www.longbeach.gov/lbcd/planning/environmental/)
- [Fire Prevention Bureau — City of Long Beach](https://www.longbeach.gov/fire/fire-prevention/)
- [Plan Review Extension Request (Form-002)](https://www.longbeach.gov/globalassets/lbcd/media-library/documents/formsapplications/form/form-002)
- [LBMC Ch. 18.05 Submittal Documents / 18.05.060 Expiration](https://library.municode.com/ca/long_beach/codes/municipal_code?nodeId=TIT18LOBEBUSTCO_CH18.05SUDO_18.05.060EXPLEX)
- [Final Local Action Notices — California Coastal Commission](https://www.coastal.ca.gov/lcp/final-local-action-notices/)
- [14 CCR §13571 Final Local Government Action—Notice](https://www.law.cornell.edu/regulations/california/14-CCR-13571)
- [Coastal Development Permit Application and Appeal Forms — CCC](https://coastal.ca.gov/cdp/cdp-forms.html)
- [Gov. Code §65943 (completeness) — FindLaw](https://codes.findlaw.com/ca/government-code/gov-sect-65943/)
- [Portions of the Permit Streamlining Act — HCD](https://www.hcd.ca.gov/sites/default/files/docs/planning-and-community/permit-streamlining-act.pdf)
- [Gov. Code §§65950–65957.5 — Justia](https://law.justia.com/codes/california/2005/gov/65950-65957.5.html)
- [AB 2234 — Mandatory Timeframes for Post-Entitlement Permits (Allen Matkins)](https://www.allenmatkins.com/real-ideas/ab2234--mandatory-timeframes-for-issuance-of-post-entitlement-permits.html)
- [AB 2234 — Post-Entitlement Phase Permits (Burke Williams & Sorensen)](https://www.bwslaw.com/news/ab-2234-post-entitlement-phase-permits/)
- [Permitting Timelines AB 2234 — CALBO](https://www.calbo.org/post/permitting-timelines)
- [Long Beach, CA Building Permits: Review Times and Process — Permit Place](https://permitplace.com/city/long-beach-ca-building-permits/)
- [Gulian Design Architects, Inc.](https://guliandesign.com/)
