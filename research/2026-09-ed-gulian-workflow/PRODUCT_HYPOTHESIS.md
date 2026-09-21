# Product Hypothesis — the smallest valuable thing

Prepared: 2026-09-21
Status: INTERNAL DRAFT — hypothesis, not a commitment to build

---

## 1. Challenging the proposed framing

The brief offered:

> *"Which projects need my attention today, what changed, who owes the next action,
> and how long has it been waiting?"*

Three of those four are right. **One of them we cannot deliver.**

**"What changed" is not available to us in Long Beach.** PermitPulse's own
jurisdiction config disables Long Beach with the note *"former open-data endpoint
retired; official search is portal-only"* (PERMITPULSE_CAPABILITY_AUDIT.md GAP-7).
Correction letters are private PDFs; resubmittals are emails to one plan checker;
the status tool is keyed on an internal project number and *"not all street
addresses or permit statuses are currently available"* `[S]`. There is no feed to
watch. Any product that leads with "we'll tell you what changed" is writing a
cheque GAP-7 cannot cash, and would violate PROJECT_LAWS #10.

### The inversion that makes this buildable

> **Change requires observing the agency. Silence does not.**
>
> **Silence is computable from dates the architect already has.**

If Ed tells us once that he emailed the resubmittal on 18 May, then on 21 September
we can state — with no access to any city system — that **126 days have elapsed
against a stated ~20-day review cycle**, that **his plan review application expires
on a date certain under LBMC 18.05.060**, and that **his Form-002 extension request
is due 30 days before that.** `[S]`

That is not a weaker claim than change detection. For Ed's actual pain it is a
**stronger** one, because his problem was never "I didn't notice the status
changed." His problem is that **nothing changed for a long time and nobody told
him what that meant.**

### Corrected framing

> **"What has been silent too long, what clock is that silence running against, and
> what is the exact next move — with the record to back it up?"**

---

## 2. What NOT to build

| Rejected | Why |
|---|---|
| Generic project-management app | Ed has 8–15 projects and a working method. Asana with permit words is not a wedge; it adds data entry and removes nothing. |
| Real-time Long Beach permit status monitor | GAP-7. The feed is retired. We would be promising observation we cannot perform. |
| Anything that drafts substantive correction responses | Category A (TIME_SINK_ANALYSIS.md §3). Creates liability for a licensed architect. Violates PROJECT_LAWS #7. |
| "Get your permit faster" positioning | False. The binding constraint is agency queue capacity. We change zero days of it. |
| Document management / plan file storage | Solved, commoditized, and not the pain in the quote. |
| Full multi-agency workflow platform | Requires integrations that do not exist and a switching cost Ed will not pay. |
| Automated client status emails, as a v1 | Tempting and cheap, but it sends on Ed's behalf about facts we may have wrong. Needs the ledger to be trusted first. |

---

## 3. The proposal — **Correction Cycle Ledger + Clock Sheet**

Working name: **PermitPulse Standing** — *"where does this project actually stand,
and who has owed what, since when."*

It is **not** a project tracker. The unit of work is deliberately smaller.

### Three objects only

**1. PROJECT** — thin. Address, jurisdiction, project/application number, track
(LCDP / entitlement / plan check), application date, current agency stage.

**2. CORRECTION COMMENT** — *the real unit of work.*
One row per numbered comment on a correction letter:
`cycle · comment_no · discipline · verbatim_text · owner (Ed/engineer/owner/consultant)
· status (open/responded/accepted/disputed/carried-forward) · response_sheet_ref
· source_evidence_id`

Long Beach's own guidance already demands Ed build this by hand, every cycle:
*"sort comments by discipline and assign each item to the architect, engineer,
contractor or owner; repeat each comment, explain the change and identify the
updated sheet, detail or calculation"* `[S]`. **The city has written our schema for
us.** We persist it once and carry it across cycles instead of rebuilding it.

**3. CLOCK** — a typed deadline with a computed state.
`clock_type · authority · starts_on · length · basis (calendar/working/business)
· due_on · days_remaining · binds (agency|architect|third_party) · source_citation`

Seeded from WORKFLOW_MAP.md §3 (16 clocks). Two of them — **C11 plan review
expiration and C12 extension lead time — bind Ed and are currently watched by
nobody.**

### Four capabilities, in build order

**S1 — The Clock Sheet.** Enter ~6 dates per project; get every applicable clock
computed with days remaining and a citation. Escalating alerts at 90/60/30 days
before the LBMC 18.05.060 wall and before the Form-002 lead-time deadline.
*Needs: GAP-6 (date arithmetic) + GAP-1 (cron) + GAP-9 (email). All small.*

**S2 — The Comment Register.** Correction letters become structured comment rows.
Cycle-over-cycle diff answers three questions Ed currently answers by re-reading
PDFs: *what's still open · what's newly raised · what's a repeat.*
*Needs: GAP-10 (extraction). Start human-in-the-loop — we type them.*

**S3 — The Silence Record.** Per project: who owes the next action, since when,
against which clock, citing the evidence. Evidence-grade, not a guess.
*Needs: GAP-4, GAP-5 (stage + party fields). Both small.*

**S4 — The Follow-Up Kit.** Given S1–S3, emit the ready-to-send message.
**Already built** as `PacketActionKit` — `email_subject`, `recipient_role`,
`message_body`, `call_checklist[]`, `requested_confirmations[]`,
`escalation_trigger`, `follow_up_date` — rendered to HTML/PDF/text and
citation-bound. *Needs: wiring, not building.*

---

## 4. Why this exploits something PermitPulse does unusually well

Anyone can build a table with a days-waiting column. **Almost nobody can build one
whose every cell is defensible.**

PermitPulse's fourteen PROJECT_LAWS, its `verification_status`
(`unverified`/`verified`/`disputed`), its refusal to let one source silently
overwrite a contradictory one, its `timeline_entry_evidence` citation graph, and its
`phone_call` evidence type combine into a capability that is rare and, here,
exactly load-bearing:

> **PermitPulse can produce a statement about who owed what, since when, that
> survives being challenged.**

Ed's entire follow-up strategy is an argument with an agency. *"I submitted on the
18th"* is a claim. *"Resubmittal emailed 2026-05-18 at 14:22 to J. Rivera, intake
receipt attached, portal status last observed 2026-05-28 still showing Corrections
Issued — which predates the receipt"* is an **exhibit**.

The existing demo fixture already reasons this way: finding `stale-portal` —
*"The portal still displays a correction-stage status that predates the documented
resubmittal receipt"* — with a deliberate internal note: *"keep the outreach narrow;
do not imply the agency lost the plans."*

**That is the product. Not a dashboard — a position paper, regenerated weekly.**
The competitive moat is not the table. It is that a licensed professional can put
his name on what the table says.

---

## 5. Honest statement of what this does and does not do

| | |
|---|---|
| ✅ Removes | Reconstruction, polling, composition, transcription (TIME_SINK_ANALYSIS.md B1–B4) — modeled at **20–35 hrs on a 100-hr entitlement** |
| ✅ Removes | A restart risk Ed may not know he carries (C11/C12) |
| ✅ Adds | A defensible record for every follow-up |
| ❌ Does not | Shorten the 3–4 month LCDP or the ~20-day review cycles |
| ❌ Does not | Make a plan checker answer faster |
| ❌ Does not | Eliminate phone calls — it makes them shorter and better aimed |
| ❌ Does not | Touch the ~70% of his hours that are professional work |
| ⚠ Requires | Ed to supply data we cannot observe (GAP-7). **Unvalidated.** |

---

## 6. The one assumption that decides everything

Everything above stands or falls on:

> **Will Ed put his project dates and correction letters into a system that is not
> his email?**

If yes — S1–S4 are a real product with a real wedge.
If no — the only viable shape is **done-for-you** (he forwards, we do the work, we
send back a packet), which is a service business, not software, and prices
completely differently.

**We do not know the answer. It is the purpose of VALIDATION_EXPERIMENT.md.**

---

## 7. Conclusions (A–H)

### A. The exact problem we believe Ed has
Across 8–15 concurrent Long Beach projects — several coastal, each spanning 6+
months and 2–3 correction cycles across Planning, Building, and Fire — Ed is the
**sole persistent memory** of his projects' administrative state. That state lives
in PDFs, sent-mail, and his head. Reconstructing it is expensive and repeated; the
16 clocks governing it are almost entirely invisible to him; and two of those
clocks, if missed, cost him the plan check outright.

### B. The strongest evidence
1. **Ed's own words** `[E]`: *"I have to become a pest to get things finalized"* —
   an unprompted description of a repeated administrative burden, plus a concrete
   number (100+ hrs) and a concrete duration (~6 months).
2. **LBMC 18.05.060** `[S]`: 12-month plan review expiration; on expiry no permit
   issues and a **new plan check with new fees** is required; extension requests due
   ≥30 days prior. A structural risk Ed's own 6-month timeline is walking toward.
3. **The email-shaped hole** `[S]`: resubmittals go *"via email directly to the plan
   checker that sent the corrections"* — the most important event in the project
   produces no system record. Every downstream ambiguity follows.
4. **Long Beach's own resubmittal instructions** `[S]` are a hand-built comment
   register specification.
5. **PermitPulse's schema already speaks this language** — `correction`,
   `resubmission`, `reviewer_contact`, `deadline`, `correction_notice`,
   `resubmittal_receipt` — written before we met Ed.

### C. What we are still assuming
1. That Ed's 100 hours contains a meaningful admin slice — **modeled at 20–35, never
   measured.**
2. That the pestering hours are inside the 100 rather than excluded with "the
   waiting" — **his sentence is genuinely ambiguous.**
3. That he does not already have an adequate system.
4. That he would enter data, or forward email, to a tool that is not his inbox.
5. That his coastal work qualifies for the statutory clocks (**AB 2234 housing-project
   coverage for a custom SFR is unresolved — do not assert it to him**).
6. That 8–15 concurrent projects is right — **we inferred it from firm size; he never
   said it.**
7. That he is not already protected from C11 by a habit or an office practice.
8. That any of this generalizes past one architect in one city.

### D. The smallest thing worth building
**S1, the Clock Sheet, alone.** Six dates in; every applicable clock computed, cited,
and alerted, with the LBMC 18.05.060 expiration and the Form-002 lead time in red.
Closes GAP-1, GAP-6, GAP-9 — the three cheapest gaps in the audit — and is the only
component that delivers value **without solving GAP-7.** Days of work, not weeks.

### E. What NOT to build
Section 2 in full. Above all: **do not build change detection against Long Beach
portals.** The feed is retired, PermitPulse's own config says so, and promising
observation we cannot perform breaks PROJECT_LAWS #10 in front of the exact
customer whose trust we need.

### F. The single next question/request to send Ed
One project's most recent correction letter (redact freely) plus the handful of key
dates — and one question: *"Of the 100 hours, roughly how many were chasing rather
than drawing?"* Full design in VALIDATION_EXPERIMENT.md.

### G. A 60-second demo concept
Split screen. **Left:** what Ed has — an 11-page PDF, a sent-mail folder, a sticky
note. **Right:** one page.
*"Casa Naples — Plan Check Cycle 2. Resubmitted by email 18 May. 126 days of
silence against a stated ~20-day cycle. 9 of 14 comments open: 6 yours, 2 your
engineer's, 1 disputed. **Your plan review application expires 12 March — your
extension request is due 10 February, in 142 days.** Draft follow-up to J. Rivera
ready, citing your receipt."*
Close on the one line that sells it: **"You didn't tell us that. We computed it."**

### H. Is the evidence strong enough to build now?

**Partly. Build S1. Do not build S2–S4 yet.**

| | |
|---|---|
| Pain is real and volunteered | ✅ Strong `[E]` |
| The workflow has structural, software-shaped defects | ✅ Strong `[S]` |
| The clocks exist, are numerous, and are invisible | ✅ Strong `[S]` |
| PermitPulse has the data model | ✅ Verified in repo |
| The admin slice is large enough to pay for | 🟡 Modeled only |
| Ed would supply the data | ❌ **Unknown — decisive** |
| Ed would pay | ❌ **No evidence. Do not assume.** |
| This generalizes beyond Ed | ❌ n = 1 |

**Verdict:** S1 is justified on evidence we already have — it is small, it needs no
data we cannot get, and it addresses a risk (C11) whose downside is asymmetric.
Everything past S1 requires Ed's actual workflow first.

**Build the Clock Sheet. Run the experiment. Then decide.**
