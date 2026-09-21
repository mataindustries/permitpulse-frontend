# Time Sink Analysis — where do Ed's 100+ hours actually go?

Case: Ed Gulian, Gulian Design Architects, Inc.
Prepared: 2026-09-21
Status: INTERNAL DRAFT

---

## 1. Read the sentence precisely before modeling it

> *"I'm into this entitlement's submittals for over 100 hours, not counting the
> waiting."* `[E]`

Three constraints are encoded in that sentence, and getting any of them wrong
produces a fake product.

**(a) "this entitlement's" — singular.** This is **one project**, not his book of
business. It is not 100 hours/month and not 100 hours across 8–15 projects. Any
business case that annualizes 100 hours as a recurring monthly figure is inventing
a number Ed did not give. `[I]`

**(b) "submittals" — the work product.** The 100 hours is scoped to preparing and
responding to submittals. Drawing revisions. Response-to-comment letters.
Coordination with engineers. **This is overwhelmingly professional work.** `[I]`

**(c) "not counting the waiting."** Ed already excluded the queue time. So the 100
hours is *active* hours. But note what "waiting" means in his sentence: it is the
part he was *not* counting because it felt like nothing. The chasing embedded in
that waiting — *"bugging the plan checker… I have to become a pest"* `[E]` — is
described in a **separate clause**, which means it is ambiguous whether he counted
it inside the 100 or excluded it with the waiting.

**That ambiguity is the single most important unknown in this entire research pass,
and it is not resolvable from the quote.** It is the first thing to ask him.

---

## 2. The adversarial decomposition

Below is a structured estimate of where 100+ hours on one Long Beach coastal
entitlement could accumulate. **These hour figures are PermitPulse modeling, not
Ed's data.** `[I]` They exist to be falsified by him, not to be quoted back at him.

The columns that matter are the last two.

| # | Activity | Est. hrs | Class | Software-reducible? |
|---|---|---|---|---|
| 1 | Schematic + design development revisions driven by entitlement feedback | 20–30 | **A** | No |
| 2 | Construction documents / plan set production for submittal | 15–25 | **A** | No |
| 3 | Substantive response to correction comments (redesign, detailing, calcs) | 12–20 | **A** | No |
| 4 | Code research and interpretation (LCP, Title 21, Title 24, CBC) | 6–10 | **A** | No |
| 5 | Engineer / Title-24 consultant substantive coordination | 5–8 | **A** | Partly (scheduling only) |
| 6 | Client design decisions and expectation management | 4–8 | **A** | No |
| 7 | Hearing prep, exhibits, neighbor/staff conversations | 4–8 | **A** | No |
| — | **Subtotal A — professional work** | **66–109** | | |
| 8 | **Transcribing correction letters into a trackable comment list** | 2–4 | **B** | **Yes** |
| 9 | **Determining which comments remain unresolved across cycles** | 2–4 | **B** | **Yes** |
| 10 | **Diffing correction letter N against N-1 for new/repeat items** | 1–3 | **B** | **Yes** |
| 11 | **Status checking: portal, phone, email, per project** | 3–6 | **B** | **Yes** |
| 12 | **Composing and sending follow-ups ("becoming a pest")** | 3–6 | **B** | **Yes** |
| 13 | **Searching old email for "when did I send that?"** | 2–4 | **B** | **Yes** |
| 14 | **Reconstructing who owes the next action (Ed / engineer / owner / city)** | 2–4 | **B** | **Yes** |
| 15 | **Cross-agency reconciliation: Planning vs Building vs Fire state** | 2–4 | **B** | **Yes** |
| 16 | **Client status updates ("where are we?")** | 2–5 | **B** | **Yes** |
| 17 | **Document/version control across resubmittal rounds** | 2–4 | **B** | Partly |
| 18 | **Proving when something was submitted** | 1–2 | **B** | **Yes** |
| 19 | **Deadline tracking (appeal windows, expiration, extension lead time)** | 0–1 | **B** | **Yes** |
| — | **Subtotal B — administrative / information work** | **22–47** | | |

**Modeled split: roughly 70–80% professional (A), 20–30% administrative (B).**

**On a 100-hour entitlement, the software-addressable slice is therefore on the
order of 20–35 hours — not 100.** `[I]`

> Note line 19: **deadline tracking scores near zero hours.** Ed almost certainly
> is not spending time on it. That is not because it is unimportant — it is
> because **it is not being done at all.** `[I]` A near-zero time entry with a
> catastrophic failure mode is a different product shape than a high-hour entry:
> it sells on risk, not on savings. Hold that thought for BUSINESS_CASE.md.

---

## 3. Category A — professional work that must NOT be automated

Stated plainly so no one later mistakes it for scope:

1. **Design judgment.** What the building should be.
2. **Code interpretation.** Whether a condition is satisfied.
3. **Substantive correction responses.** *How* to resolve comment 14.
4. **Drawing production.** Sheets, details, revision clouds.
5. **Engineering coordination on substance.** What the structural response says.
6. **Client counsel.** Trade-offs, cost, risk.
7. **Advocacy with staff.** Persuading a planner or plan checker.
8. **Any representation that a project complies.**

PROJECT_LAWS #7 and #14 already forbid the system from resolving factual
uncertainty or treating AI output as evidence. Category A is the professional
extension of that rule: **PermitPulse may organize Ed's judgment. It may never
substitute for it.**

The commercial argument for this boundary is stronger than the ethical one: a tool
that stays strictly inside Category B **cannot generate liability for Ed**, which
is the first objection a licensed architect will raise. `[I]`

---

## 4. Category B — administrative work software could reduce

Reorganized by *why* the time is spent, because the mechanism determines the fix.

### B1. Reconstruction work — "what is the current state?" (est. 9–18 hrs)
Lines 9, 10, 14, 15, 18.

Ed is re-deriving state that *was* known at some point but was never recorded in a
form that survives. Correction letters arrive as PDFs; resubmittals go out as
emails; per-discipline state exists only in a plan checker's head. `[S]` Each time
Ed needs the current picture, he rebuilds it from scratch.

**Mechanism: state is never persisted, so it is re-derived on every query.**
**Fix: persist it once, structured, with provenance.** This is exactly what the
`evidence_items` / `timeline_entries` / `timeline_entry_evidence` schema already
does. See PERMITPULSE_CAPABILITY_AUDIT.md.

### B2. Polling work — "has anything changed?" (est. 3–6 hrs)
Line 11.

Ed checks because **nothing tells him.** There is no subscription, no webhook, no
email-on-change. The Long Beach Plan Review Status tool must be queried by project
number and gives *"basic information"* `[S]`; the CCC posts appealable permits
during the appeal period `[S]`; ZA notices publish as PDFs `[S]`. All pull, no push.

**Mechanism: polling substitutes for notification.**
**Fix: poll once, centrally, on a schedule; notify on change.**

⚠ **Adversarial check:** for Long Beach specifically this is the weakest link.
PermitPulse's own jurisdiction config currently marks Long Beach
`enabled: false — "former open-data endpoint retired; official search is
portal-only"`. There is no feed to poll. See PAIN_LOG.md L-01.

### B3. Composition work — "writing the same follow-up again" (est. 5–10 hrs)
Lines 12, 16.

Ed writes each follow-up and each client update from scratch, re-assembling the
same facts. Note that *"becoming a pest"* is not one email — it is a **repeated,
escalating sequence** against an unresponsive counterparty `[E]`, and each
iteration requires re-reading the file to avoid sounding uninformed.

**Mechanism: composition requires re-loading context that is not assembled anywhere.**
**Fix: generate the draft from the persisted record.** PermitPulse already has a
typed, rendered artifact for exactly this — `PacketActionKit`, with
`email_subject`, `recipient_role`, `message_body`, `call_checklist`,
`requested_confirmations`, `escalation_trigger`, `follow_up_date`.

### B4. Transcription work — "getting the PDF into a list" (est. 2–4 hrs)
Line 8.

Long Beach's own resubmittal guidance requires Ed to *"sort comments by discipline
and assign each item to the architect, engineer, contractor or owner; repeat each
comment, explain the change and identify the updated sheet, detail or
calculation"* `[S]`. **The city is mandating that Ed build a structured comment
register by hand, from an unstructured PDF, every cycle.**

**Mechanism: the agency emits unstructured, the process demands structured.**
**Fix: parse once into a comment register; carry it across cycles.**

⚠ PermitPulse's extractor today is **filename-only** and self-reports
`"OCR/AI content extraction has not run."` This capability is **specified but not
built.** See PAIN_LOG.md L-07.

### B5. Latent risk work — "the clock nobody is watching" (est. 0–1 hr today)
Line 19.

Sixteen clocks identified in WORKFLOW_MAP.md §3. Ed can see at most two. The two
that bind *him* — the 12-month plan review expiration (LBMC 18.05.060) and the
30-day-prior extension-request lead time — are currently tracked by nobody. `[S]`

**Mechanism: date arithmetic nobody is doing.**
**Fix: date arithmetic. This is the cheapest capability on this page and the only
one with an asymmetric downside.**

---

## 5. The hard part: does reducing B actually help Ed?

An honest challenge, stated as strongly as it deserves.

**Challenge 1 — B is a fraction of a fraction.**
Ed's calendar pain is ~6 months. Category B is ~20–35 hours on that project. Even
perfect elimination of B changes the schedule by **zero days**, because the binding
constraint is agency queue time, not Ed's throughput. `[I]`

*Response:* correct, and the product must never claim otherwise. The value is not
schedule compression. It is (a) hours returned to Ed, (b) restart risk removed,
(c) the ability to bill or not-bill knowingly. Any marketing claim of "get permits
faster" would be false under PROJECT_LAWS #10.

**Challenge 2 — "becoming a pest" is already an effective strategy.**
Ed's method works. He gets permits. A dashboard does not bring a plan checker back
from vacation. `[I]`

*Response:* also correct. The realistic claim is that the *same* pest pressure can
be applied at a fraction of the preparation cost, and can be aimed better — at the
discipline that is actually idle, on the date the clock actually justifies it. It
makes the pestering cheaper and better targeted. It does not replace it.

**Challenge 3 — 8–15 projects fits in a spreadsheet.**
A competent principal can track 15 rows. `[I]`

*Response:* the spreadsheet is not the failure point — **maintaining it is.** The
spreadsheet cannot tell you a status changed, cannot diff two correction letters,
cannot compute the 10-working-day appeal window, cannot prove when you submitted,
and will not survive a busy month. The honest framing is *"the spreadsheet you
would keep if you had time to keep it."* That is a real but modest product.

**Challenge 4 — the monitoring premise may not be deliverable in Long Beach.**
No open data feed; status keyed on an internal project number; correction letters
private; resubmittals by email. `[S]` If PermitPulse cannot observe the project
without Ed, then Ed must feed it — and a tool you must feed is a tool you abandon.
`[I]`

*Response:* **this is the strongest objection and it is not fully answered.** Two
partial answers: (i) the entitlement side *is* publicly observable — ZA notices,
CPCE weekly postings, NoFA, and the CCC's posting of appealable permits `[S]`;
(ii) the clock engine needs only dates Ed already has, entered once. But the plan
check side — where most of his time goes — is likely to require forwarded email.
**This must be tested before building. It is the core of VALIDATION_EXPERIMENT.md.**

---

## 6. Where this leaves us

| Claim | Confidence |
|---|---|
| Ed's 100 hours is mostly Category A professional work | **High** — his own word "submittals" `[E]` |
| A real Category B slice exists on that project (~20–35 hrs) | **Medium** — modeled, not measured `[I]` |
| The chasing is genuinely painful and repeated | **High** — *"I have to become a pest"* `[E]` |
| PermitPulse can remove most of Category B | **Low–Medium** — depends on data access `[I]` |
| PermitPulse can shorten Ed's 6 months | **Very low — treat as false** |
| Ed is exposed to unwatched clocks that could cost him a plan check | **Medium-High** — 16 clocks, ≤2 visible `[S]` |
| Ed knows he is exposed | **Unknown — this is the question to ask** |

**The honest one-line finding: the 100 hours is not the opportunity. The
opportunity is the 20–35 administrative hours inside it, plus a restart risk Ed may
not know he is carrying.** `[I]`

---

## Sources

As WORKFLOW_MAP.md §6. Direct retrieval of `longbeach.gov` was blocked by this
session's egress policy; all `[S]` claims are search-surfaced summaries of the
named official pages and require verbatim re-verification before use.

Additional: [Monograph — architecture utilization rate benchmarks](https://monograph.com/blog/unlocking-utilization-rates-benchmarks-for-architects-and-architecture-firms), [BQE — architect KPIs](https://www.bqe.com/blog/top-architect-kpis-formulas-examples-and-benchmarks-to-drive-performance), [AIA Firm Survey Report 2024](https://www.aia.org/resource-center/aia-firm-survey-report-2024), [Responding to a Plan Check Comment Letter — City of Alameda](https://www.alamedaca.gov/files/sharedassets/public/alameda/comm-services/formsandhandouts/building/responding_to_a_plan_check_comment_letter.pdf), [Response to Comment Letter Guideline — Town of Danville](https://www.danville.ca.gov/DocumentCenter/View/4352/Response-to-Comment-Letter-Guideline-PDF).
