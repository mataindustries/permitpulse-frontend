# Pain Log — Long Beach coastal permitting

Prepared: 2026-09-21
Status: INTERNAL DRAFT — living document

Every entry follows: **SYSTEM · PROBLEM · WHAT ED CURRENTLY HAS TO DO · POTENTIAL
PERMITPULSE AUTOMATION**, plus the capability gap it maps to
(PERMITPULSE_CAPABILITY_AUDIT.md) and a build-effort estimate.

Legend: 🔴 blocks the product · 🟠 significant · 🟡 friction
`[S]` search-surfaced official source · `[E]` Ed's statement · `[I]` inference ·
`[P]` encountered by PermitPulse during this research pass

---

## Section A — Data access (the existential ones)

### 🔴 L-01 · Long Beach has no machine-readable permit feed
- **SYSTEM** — City of Long Beach permit data / PermitPulse `workers/pp-api/src/config/jurisdictions.js`
- **PROBLEM** — PermitPulse's own config carries `enabled: false`, `provider: null`,
  `reason: "former open-data endpoint retired; official search is portal-only"`.
  Of 59 configured jurisdictions, 8 have a live provider. **The customer's city is
  not one of them, and the entry records that the feed was withdrawn** — so this is
  a regression, not an omission. `[S][P]`
- **WHAT ED DOES** — Every status fact is obtained by hand: portal lookup, phone,
  or email.
- **AUTOMATION** — None available today. Realistic substitutes: (a) ingest what Ed
  forwards; (b) monitor the *adjacent public* surfaces that do exist — ZA notices,
  CPCE weekly postings, CCC appealable-permit listings; (c) compute silence from
  dates on file, which needs no feed at all. **(c) is the only one that works
  unconditionally.**
- **Gap** — GAP-7 · **Effort** — Large / possibly unsolvable

### 🔴 L-02 · Status lookup is keyed on an internal project number
- **SYSTEM** — Long Beach Plan Review Status tool
- **PROBLEM** — Requires *"the project number assigned when the application was
  screened and routed for review"* `[S]`. Before screening, the project is
  invisible to every public system. Address lookup is not the primary key.
- **WHAT ED DOES** — Digs the intake receipt out of email to find the number, then
  queries. Repeats per project.
- **AUTOMATION** — Store the project number once against the project, with the
  receipt as cited evidence. Turns a 5-minute retrieval into a field.
- **Gap** — GAP-4 · **Effort** — Trivial

### 🟠 L-03 · Public status coverage is incomplete and says so
- **SYSTEM** — Long Beach Permit Status Inquiry
- **PROBLEM** — *"Not all street addresses or permit statuses are currently
  available on the search webpage."* `[S]` A blank result is **ambiguous between
  "no record" and "not published"** — PROJECT_LAWS #4 exactly.
- **WHAT ED DOES** — Calls 562.570.PMIT to find out which it was.
- **AUTOMATION** — Record the empty result as an observation with `unknown`
  resolution, never as a negative finding. `verification_status` already supports
  this; most tools would silently render "not found."
- **Gap** — GAP-3 · **Effort** — Small

---

## Section B — Status fidelity

### 🔴 L-04 · One aggregate status cannot express multi-discipline state
- **SYSTEM** — Plan Review Status
- **PROBLEM** — Building, Fire, and separately-contacted E/P/M/Health all review a
  project, but the applicant sees a single value `[S][I]`. A project where Building
  cleared three weeks ago and Fire has not started reads identically to one where
  everything is moving.
- **WHAT ED DOES** — Phones to find out which discipline is actually holding it.
  This is the single most repeated call in his workflow. `[I]`
- **AUTOMATION** — Per-discipline state on the project, each with its own
  `waiting_on`, `since`, and cited basis. Renders as *"Fire idle 83 days; Building
  cleared 2 Sep (phone, logged)."* Surfaces the discipline-level truth the portal
  structurally cannot.
- **Gap** — GAP-4, GAP-5 · **Effort** — Small

### 🟠 L-05 · Reviewer identity and routing date are not published
- **SYSTEM** — All Long Beach status surfaces
- **PROBLEM** — Who has the file, and since when, is not disclosed. Long Beach's own
  resubmittal instruction is to email *"directly to the plan checker that sent the
  corrections"* `[S]` — so the correct recipient is knowable **only from the
  correction letter itself.**
- **WHAT ED DOES** — Keeps reviewer names in his head or digs through email.
- **AUTOMATION** — Extract the reviewer from the correction letter on intake; store
  as the project's contact of record with the letter as evidence. The `evidence_type`
  `phone_call` already allows logging *"confirmed by phone 2 Sep: J. Rivera, still
  assigned."*
- **Gap** — GAP-5, GAP-10 · **Effort** — Small

### 🟠 L-06 · Portal status can be stale relative to the documented record
- **SYSTEM** — Plan Review Status vs. resubmittal receipts
- **PROBLEM** — A portal showing "Corrections Issued" while the applicant holds a
  later resubmittal receipt is a **contradiction between two sources**, not a
  status. PermitPulse's own demo fixture already models this (`stale-portal`).
- **WHAT ED DOES** — Assumes the portal is behind, or calls to check. Either way he
  resolves it privately, with no record.
- **AUTOMATION** — **Do not resolve it.** Display both with dates and mark the
  conflict. PROJECT_LAWS #5 and #6 mandate this; it is also what makes the output
  usable as an exhibit.
- **Gap** — GAP-3 · **Effort** — Small

### 🟡 L-07 · Status changes are not notified
- **SYSTEM** — All Long Beach surfaces
- **PROBLEM** — Pull-only. No subscription, no email-on-change, no webhook. `[S][I]`
- **WHAT ED DOES** — Polls, on no schedule, driven by memory and anxiety.
- **AUTOMATION** — Poll once centrally on a cron, diff against the last observation,
  notify on change. **Requires GAP-1 + GAP-3, and is constrained by L-01.**
- **Gap** — GAP-1, GAP-3, GAP-9 · **Effort** — Medium

---

## Section C — Documents

### 🟠 L-08 · Correction letters are unstructured PDFs the city requires be restructured
- **SYSTEM** — Plan check correction letters
- **PROBLEM** — Delivered as PDF/email. Long Beach then instructs applicants to
  *"sort comments by discipline and assign each item to the architect, engineer,
  contractor or owner; repeat each comment, explain the change and identify the
  updated sheet, detail or calculation"* `[S]`. **The city mandates a structured
  register and supplies an unstructured document.**
- **WHAT ED DOES** — Rebuilds the register by hand, every cycle, every project.
- **AUTOMATION** — Parse once into `CORRECTION_COMMENT` rows; carry across cycles;
  diff cycle-over-cycle for open / new / repeated. **The city has written the schema
  for us.**
- **Gap** — GAP-10 · **Effort** — Medium
- ⚠ PermitPulse's extractor is filename-only and self-reports *"OCR/AI content
  extraction has not run."* Start human-in-the-loop.

### 🔴 L-09 · The resubmittal — the most important event — produces no record
- **SYSTEM** — Email resubmittal to the individual plan checker `[S]`
- **PROBLEM** — No portal transaction, no timestamp, no receipt, no queue entry, no
  status change. If the plan checker is on vacation `[E]`, the package may sit in
  an unread inbox with **no other system aware it exists.**
- **WHAT ED DOES** — Keeps his sent-mail as the only proof, then calls to confirm
  receipt — *"bugging the plan checker… I have to become a pest."* `[E]`
- **AUTOMATION** — Log the resubmittal as a `resubmission` timeline entry citing the
  sent email; start the review clock from it; alert when elapsed exceeds the stated
  ~20-day cycle `[S]`. **Cannot create a receipt the city never issued — but can
  make the absence visible and dated.**
- **Gap** — GAP-5, GAP-6, GAP-11 · **Effort** — Small (with forwarded email)
- **This is the root cause of most other entries in this log.** `[I]`

### 🟡 L-10 · Archived plans are counter-only
- **SYSTEM** — Laserfiche at the Permit Center Resource Center, 411 W. Ocean Blvd, 2nd Floor
- **PROBLEM** — *"Architecturally-drawn plans are not available online"* `[S]`. A
  physical trip is required.
- **WHAT ED DOES** — Drives downtown, or works without prior plans.
- **AUTOMATION** — None for retrieval. PermitPulse's existing document-retrieval
  service line is the human answer. **Note: this is an existing PermitPulse offer,
  not a new build.**
- **Gap** — n/a · **Effort** — Service, not software

---

## Section D — Fragmentation

### 🟠 L-11 · Disciplines outside Building must be contacted separately
- **SYSTEM** — Electrical, plumbing, mechanical, health reviews
- **PROBLEM** — These *"require contacting those agencies, departments and/or
  non-city entities separately"* `[S]` — including non-city bodies with no
  Long Beach tracking at all.
- **WHAT ED DOES** — Maintains separate threads per agency; reconciles by memory.
- **AUTOMATION** — One project, N review tracks, each with its own party, clock and
  evidence. A referral to an outside agency becomes a tracked wait instead of a
  forgotten one.
- **Gap** — GAP-5 · **Effort** — Small

### 🟡 L-12 · LCDP is not online-submittable
- **SYSTEM** — LB Services (`permitslicenses.longbeach.gov`)
- **PROBLEM** — The portal is described as covering renewable energy, reroof, panel
  changeout, water heater, certain commercial work, plus *"site plan review,
  creative sign permits, and sign programs"* `[S]`. **LCDP is not named.** So Ed's
  highest-stakes application type is the least digital.
- **WHAT ED DOES** — Paper/counter/email submittal; no portal trail.
- **AUTOMATION** — The evidence timeline becomes the only structured record of the
  entitlement. Increases the value of our record, decreases our ability to verify it
  independently.
- **Gap** — GAP-7 · **Effort** — n/a

### 🟡 L-13 · Two phone numbers, one question
- **SYSTEM** — 562.570.PMIT (7648) and 562.570.LBCD (5223) `[S]`
- **PROBLEM** — Different numbers surface for permit status vs. building permit
  status.
- **WHAT ED DOES** — Calls one, gets transferred.
- **AUTOMATION** — Cosmetic; include the right contact in the follow-up kit.
  `PacketActionKit.recipient_role` already exists.
- **Gap** — n/a · **Effort** — Trivial

---

## Section E — Invisible clocks (the highest-value cluster)

### 🔴 L-14 · The 12-month plan review expiration is watched by nobody
- **SYSTEM** — LBMC 18.05.060 / Plan Review Extension Request (Form-002)
- **PROBLEM** — Plan review applications are stated valid **12 months**; on expiry
  *"no permit will be issued, and a new plan check for the project along with new
  plan check fees will be required"* `[S]`. Extension requests are to be made **≥30
  days before expiration** `[S]`. **No portal, email, or calendar surfaces either
  date.** Ed's own ~6-month plan-check description `[E]` puts a coastal project
  within range of this wall on a normal schedule.
- **WHAT ED DOES** — Nothing. Not through negligence — **the date is not published
  anywhere he looks, and nothing computes it for him.** `[I]`
- **AUTOMATION** — `application_date + 12 months` and `− 30 days`. Alert at 90 / 60
  / 30 days. **This is the single highest value-to-effort item in the entire
  research pass: pure date arithmetic, needs no agency data, and is the only
  failure mode that destroys work product rather than costing time.**
- **Gap** — GAP-6, GAP-1, GAP-9 · **Effort** — Trivial
- ⚠ **Currently `[S]` only. Re-verify LBMC 18.05.060 verbatim before putting this
  in front of a licensed architect.**

### 🟠 L-15 · The PSA completeness clock is invisible
- **SYSTEM** — Gov. Code §65943
- **PROBLEM** — Agencies must determine completeness within **30 calendar days**;
  failing that, an application containing the required statement is **deemed
  complete** `[S]`. A new 30-day period begins on each resubmittal `[S]`.
- **WHAT ED DOES** — Waits. Almost certainly unaware the clock exists. `[I]`
- **AUTOMATION** — Start the clock on submittal; flag at day 30 if no determination
  is on file. **Surface it as a question to ask, never as a legal conclusion** —
  PROJECT_LAWS #7.
- **Gap** — GAP-6 · **Effort** — Small

### 🟠 L-16 · The "no new items" rule is unenforced because nobody diffs the letters
- **SYSTEM** — Gov. Code §65943
- **PROBLEM** — *"In any subsequent review of the application determined to be
  incomplete, the local agency shall not request the applicant to provide any new
  information that was not stated in the initial list"* `[S]`. This is the statutory
  answer to *"they added new comments on round 2"* — and it requires a
  letter-to-letter diff nobody performs.
- **WHAT ED DOES** — Absorbs new comments as a fact of life.
- **AUTOMATION** — Diff cycle N against cycle 1, flag newly-raised items. **Flag for
  his judgment; do not assert the statute applies** — its reach over plan check vs.
  discretionary entitlements is unresolved here.
- **Gap** — GAP-10 · **Effort** — Small (once L-08 exists)

### 🟠 L-17 · The NoFA/FLAN transmittal gap is completely invisible
- **SYSTEM** — City Planning → California Coastal Commission
- **PROBLEM** — The city must notify the Commission within **7 calendar days** of
  completing review (14 CCR §13571) `[S]`. *"Until the Commission receives a
  FLAN/NOFA meeting the requirements of Section 13571 … the appeal period with the
  Commission cannot start"* `[S]`. A deficient notice suspends the effective date,
  with notice to city and applicant within 5 calendar days `[S]`.
  **An architect can believe a project is approved while the clock never started.**
- **WHAT ED DOES** — Assumes approval is final; discovers otherwise only if
  something goes wrong.
- **AUTOMATION** — On a recorded local approval, start a 7-day watch; check the
  CCC's public posting of appealable permits `[S]`. **This is the one place the
  state agency publishes what the city does not — the "follow the paper trail"
  capability, literally.**
- **Gap** — GAP-1, GAP-3, GAP-6 · **Effort** — Medium

### 🟡 L-18 · Appeal windows use two different day-counting bases
- **SYSTEM** — Local appeal vs. Coastal Commission appeal
- **PROBLEM** — Local: **10 calendar days.** CCC: **10 working days**, closing at
  5pm on the tenth `[S]`. Mixing the two silently produces a wrong date.
- **WHAT ED DOES** — Counts by hand, or doesn't.
- **AUTOMATION** — `basis` field on every clock (`calendar` / `working` /
  `business`), computed correctly per type. Trivial, and exactly the kind of error
  a human makes under load.
- **Gap** — GAP-6 · **Effort** — Trivial

### 🟡 L-19 · AB 2234 applicability is ambiguous for custom coastal SFRs
- **SYSTEM** — AB 2234 post-entitlement permit deadlines
- **PROBLEM** — 15 days to completeness; 30 business days review (≤25 units); 60
  (≥26); failure is a Housing Accountability Act violation `[S]`. But it applies to
  *"housing development projects"*, and Gulian Design's public description is
  *"custom residential homes, offices, retail & restaurants"* `[S]`. **Whether a
  single custom coastal home qualifies is unresolved.**
- **WHAT ED DOES** — Almost certainly unaware of the statute either way. `[I]`
- **AUTOMATION** — Model it as a **conditional** clock, shown only when the project
  type qualifies, with the qualification question asked explicitly rather than
  assumed. **Never assert applicability** — PROJECT_LAWS #7, #10.
- **Gap** — GAP-6 · **Effort** — Small, but **needs legal review before shipping**

### 🟡 L-20 · Plan checker availability is unknowable
- **SYSTEM** — Human availability
- **PROBLEM** — *"bugging the plan checker to respond, while they are on vacation,
  city PTO days, plan checkers too busy on other projects"* `[E]`. None of it is
  published.
- **WHAT ED DOES** — Discovers it by calling and being told.
- **AUTOMATION** — **None. This is genuinely not a software problem.** The only
  honest mitigation is logging *"out until 6/24, per phone 6/10"* as `phone_call`
  evidence so the next follow-up is timed rather than wasted. Escalation path lives
  in `PacketActionKit.escalation_trigger`.
- **Gap** — n/a · **Effort** — n/a
- **Logged deliberately as a pain software cannot fix.**

---

## Section F — Research-process pains encountered by PermitPulse `[P]`

These are our own retrieval failures, logged because they bound the confidence of
every other deliverable in this folder.

### 🔴 R-01 · `longbeach.gov` is blocked by this session's egress policy
- **SYSTEM** — Agent network egress proxy
- **PROBLEM** — WebFetch returned `EGRESS_BLOCKED` for `longbeach.gov`,
  `www.longbeach.gov`, `source.www.longbeach.gov`, `permitslicenses.longbeach.gov`,
  `coastal.ca.gov`, `documents.coastal.ca.gov`, `library.municode.com` and
  `permitplace.com`. WebFetch was blocked for **every** domain tested, including
  `en.wikipedia.org`. Only WebSearch functioned.
- **CONSEQUENCE** — **Every official-source claim in this research folder is a
  search-engine summary, not a retrieved document.** Under PROJECT_LAWS #2 and #9
  none of it is `verified`.
- **AUTOMATION / REMEDY** — Re-run this pass from an environment with egress to
  `longbeach.gov`, `coastal.ca.gov` and `library.municode.com`. **Priority order for
  re-verification: (1) LBMC 18.05.060, (2) Form-002 lead time, (3) plan review
  turnaround days, (4) ZA hearing cadence.**

### 🟠 R-02 · Official content is published as untitled PDFs at opaque paths
- **SYSTEM** — `longbeach.gov/globalassets/lbcd/media-library/...`
- **PROBLEM** — Checklists, flow charts, hearing notices and forms live at long
  slug paths with no extension, no index, and no feed — e.g.
  `.../za-public-hearings/2026/za-nph-2604-18-5331-e--ocean-blvd`.
- **WHAT ED DOES** — Finds them by search, or is sent them.
- **AUTOMATION** — The slugs are **structured and contain the address**. A crawler
  over the ZA notices directory could match a project address to its hearing notice
  without any API. **This is a real, cheap monitoring surface hiding in plain
  sight.**
- **Gap** — GAP-1, GAP-3 · **Effort** — Medium

### 🟡 R-03 · Sources contradict each other on expedited review
- **SYSTEM** — Third-party permit guides vs. city pages
- **PROBLEM** — One source states expedited review is not offered; another
  references an "Express Permit Service." `[S]`
- **WHAT ED DOES** — Knows from experience.
- **AUTOMATION** — **Leave it contradictory.** PROJECT_LAWS #5: contradictory
  official sources remain contradictory until explicitly resolved. Logged here so
  nobody silently picks one.

### 🟡 R-04 · PermitPulse's own extractor does not know Long Beach
- **SYSTEM** — `app/src/shared/evidence-intake/extractor.ts`
- **PROBLEM** — `jurisdictionRules` covers LADBS, Pasadena, Santa Monica, San Diego
  and San Francisco. **Long Beach is absent**, so a forwarded Long Beach document
  would classify with an unknown jurisdiction. `[P]`
- **AUTOMATION** — One regex. Logged because it is the smallest possible concrete
  change in this folder, and it would be needed on day one of any experiment.
- **Gap** — GAP-10 · **Effort** — Trivial

---

## Summary — what the log says

| Cluster | Entries | Automatable? |
|---|---|---|
| **Invisible clocks (E)** | L-14…L-19 | ✅ **Yes — pure date arithmetic, needs no agency data** |
| **Status fidelity (B)** | L-04…L-07 | 🟡 Partly — needs Ed's input or public adjacents |
| **Documents (C)** | L-08, L-09 | 🟡 Yes, with forwarded email + extraction |
| **Fragmentation (D)** | L-11…L-13 | ✅ Yes — modeling, not integration |
| **Data access (A)** | L-01…L-03 | 🔴 **No — the feed is gone** |
| **Human availability** | L-20 | ❌ **No. Not a software problem.** |

**The log's verdict matches the audit's: the cluster PermitPulse can fix completely,
today, with no agency cooperation and no data feed, is the clocks. Everything else
is contingent on Ed handing us something.**
