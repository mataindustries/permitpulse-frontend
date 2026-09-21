# PermitPulse Capability Audit — measured against Ed's workflow

Repo: `mataindustries/permitpulse-frontend` @ `claude/focused-ritchie-613aj9`
Prepared: 2026-09-21
Status: INTERNAL DRAFT — read-only audit, no code modified

---

## Headline finding

**PermitPulse has already built roughly 70% of the data model this product needs,
and 0% of the loop that would make it a product.**

The existing system is a **one-shot, human-reviewed research packet about a case**,
terminating at `delivery_confirmed`. What Ed needs is a **recurring watch on a live
project** that never terminates until the permit issues. The nouns are right. The
verbs are missing.

Concretely: the schema already knows what a `correction`, a `resubmission`, a
`reviewer_contact` and a `deadline` are. There is no scheduler anywhere in the
repository to notice that one is overdue.

---

## 1. Already built, directly reusable

### 1.1 Evidence model — **strong fit**
`app/src/worker/db/schema.ts`

| Table | Relevance to Ed |
|---|---|
| `evidence_items` | Typed source records with `source_url`, `source_label`, `source_date`, `verification_status` (`unverified`/`verified`/`disputed`), soft delete, optimistic `version` |
| `timeline_entries` | Dated project events with `is_canonical` flag |
| `timeline_entry_evidence` | Many-to-many join — **every timeline event can cite its proof** |
| `audit_events` | Immutable `case_created`/`case_updated`/`case_status_changed` with actor + `request_id` |

`evidenceTypes` = `document, portal, email, phone_call, meeting, inspection,
code_reference, photo, other`.

**`phone_call` is already a first-class evidence type.** That is exactly right for a
workflow where the authoritative answer only exists on a phone call
(WORKFLOW_MAP.md §5). Most permit software cannot record this at all.

### 1.2 Timeline vocabulary — **near-perfect fit, unplanned**
`schema.ts` `timelineTypes`:

```
submission · resubmission · correction · reviewer_contact ·
applicant_contact · inspection · approval · rejection ·
status_update · deadline · other
```

This vocabulary was written for permit research. It happens to be **an exact
description of Ed's correction cycle.** `submission → correction → resubmission →
reviewer_contact → …` is his loop, already typed and already constrained by a SQL
CHECK. No schema change is needed to represent his project history.

### 1.3 Evidence intake queue — **right shape, hollow engine**
`schema.ts` `evidence_drafts`; `app/src/shared/evidence-intake/`

`evidenceDraftCategories` = `portal_screenshot, correction_notice,
resubmittal_receipt, structural_response, energy_documents, email,
permit_application, plan_sheets, other`.

Someone already anticipated correction notices and resubmittal receipts as the
primary intake artifacts. Queue states (`waiting → processing → ready_for_review →
needs_attention`), R2 storage, and promotion to `evidence_items` via
`moved_to_evidence_id` are all built.

⚠ **But the classifier and extractor are filename-only.**
`classifier.ts` matches substrings in the filename; `extractor.ts` derives permit
number, address and discipline from the filename stem and self-reports
`"OCR/AI content extraction has not run."` Confidence is capped at 72.

The pipeline that would turn a correction-letter PDF into a comment register — the
B4 time sink — **is specified but not implemented.**

### 1.4 Mission Intelligence — **the right idea, aimed at the wrong subject**
`app/src/shared/mission-intelligence/{types,facts,rules,evaluate}.ts`

A deterministic rule engine producing `MissionState`, `blockers[]`, `warnings[]`,
`recommendedAction`, and — critically — `supportingEvidence[]` on every finding, so
each conclusion carries its citation. Rules are priority-ordered and pure.

**This is precisely the architecture a "who owes the next action" engine needs.**

⚠ **But every rule evaluates PermitPulse's internal research readiness, not the
project's agency state.** `missing-permit-number`, `missing-evidence`,
`disputed-evidence` are about whether *PermitPulse's file* is complete. There is no
rule of the form *"Fire has been idle 34 days"* or *"the extension request is due in
11 days."* The engine is aimed inward.

### 1.5 Agency Follow-Up Kit — **the standout asset**
`app/src/shared/packet/types.ts` → `PacketActionKit`

```ts
current_position · confirmed_record · unconfirmed_record · primary_blocker
why_appropriate · evidence_readiness · review_readiness
email_subject · recipient_role · message_body
call_checklist[] · requested_confirmations[] · documents_ready[]
escalation_trigger · follow_up_date
evidence_ids[] · timeline_ids[] · approved
```

Rendered to HTML, PDF and text (`render-packet-{html,pdf,text}.ts`,
`PacketDocument.tsx`), gated by `quality-gate.ts`, carrying
`citation_references[]`.

**This is "become a pest, professionally" — already typed, already rendered,
already citation-bound.** `escalation_trigger` and `follow_up_date` mean someone
already thought about the *next* round of pestering. It is the closest thing in
the repository to Ed's actual stated pain.

### 1.6 Agency Dependency Map — **multi-agency sequencing, already modeled**
`types.ts` → `PacketAgencyDependency { discipline, blocking_issue,
dependent_review, recommended_next_step, citation_references[] }`

Section intro: *"Approved, evidence-grounded findings translated into the agency
review sequence they affect."* This is the Planning↔Building↔Fire coordination
structure from WORKFLOW_MAP.md §2, already a first-class packet block.

### 1.7 Provenance and conflict handling — **best-in-class, and the moat**
`PROJECT_LAWS.md` + `quality-gate.ts` + `verification_status` + `ai-review/redaction.ts`

Fourteen enforced laws: never invent a fact; missing evidence stays `unknown`;
failure to retrieve ≠ absence; contradictory sources stay contradictory; one source
never silently overwrites another; AI may not resolve factual uncertainty; AI output
is never evidence; client wording may not exceed evidence.

**For a licensed architect this is not a feature, it is the precondition for use.**
A tool that guesses a permit status and is wrong creates liability for Ed. A tool
that says *"portal shows Corrections Issued as of 2026-05-28, which predates your
2026-05-18 resubmittal receipt — the portal is stale, here is the conflict"* is
usable. The existing demo fixture (`arroyo-vista-demo.ts`, finding
`stale-portal`) already encodes exactly that reasoning pattern.

### 1.8 Reviewer workspace, delivery lifecycle, packet rendering
`reviewer_actions` with `priority/description/responsible_party/due_date/approved`;
seven-state delivery machine with idempotency keys, sequence numbers and request
fingerprints; deterministic PDF pipeline. All production-grade. All reusable.

### 1.9 Jurisdiction integration layer
`workers/pp-api/src/config/jurisdictions.js` — 59 jurisdictions, normalized field
maps across three provider types (`socrata`, `arcgis`, `ckan`), each with
`portalUrl`, `platform`, `portalNotes`, `enabled`.

Genuinely valuable: a normalization layer over heterogeneous municipal data, plus
honest per-jurisdiction capability notes.

---

## 2. Missing — and the gaps are structural, not cosmetic

### GAP-1 — **No scheduler. Anywhere.** 🔴 blocking
Neither `app/wrangler.jsonc` nor `workers/pp-api/wrangler.jsonc` declares
`triggers`/`crons`. Neither worker exports a `scheduled()` handler. `pp-api`'s
`export default` is `{ async fetch }` only.

Everything in PermitPulse happens because a human clicked. **Nothing in PermitPulse
has ever woken up on its own.** A product whose entire value proposition is
"we watched it so you didn't have to" cannot be built on this.

### GAP-2 — **`PERMITPULSE_WATCH` KV is bound but never read or written** 🟠
Declared in both `wrangler.jsonc` and `wrangler.prod.jsonc`; zero code references.
Someone intended a watch feature and stopped. Useful signal: the ambition already
existed. Also a warning: it was abandoned once.

### GAP-3 — **No change detection, no prior-state comparison** 🔴 blocking
No snapshot-and-diff anywhere. `packet_generations.content_sha256` hashes a
*packet*, not an *observed external state*. There is no table for "what the portal
said last Tuesday," therefore no way to say "this changed."

**"LAST VERIFIED CHANGE" — the column the brief asks for — is currently
uncomputable.**

### GAP-4 — **No agency-state field. The status enum is about PermitPulse.** 🔴 blocking
`caseStatuses` = `intake · researching · needs_information · ready_for_review`.

That is PermitPulse's *research* workflow. There is **no field anywhere** for the
project's position in the agency's process — no "Plan Check Cycle 2," no "LCDP
awaiting ZA hearing," no "awaiting NoFA transmittal."

The system cannot currently answer *"what stage is this project in?"* — the first
column of the requested screen.

### GAP-5 — **No `waiting_on` / no party model** 🔴 blocking
`reviewer_actions.responsible_party` is free text on an internal action. There is no
structured actor on the case — no {agency, discipline, reviewer, architect,
engineer, owner, client}. "WHO OWES THE NEXT ACTION" cannot be computed, only typed.

### GAP-6 — **No elapsed-time or clock arithmetic** 🔴 blocking
Repo-wide search for `daysSince|days_waiting|ageInDays|overdue|staleness` returns
nothing but `reviewer_actions.due_date` (a manually typed date) and
`quality_gate.stale_snapshot` (about packet freshness).

**None of the 16 clocks in WORKFLOW_MAP.md §3 exist in code.** Not the 12-month
LBMC 18.05.060 expiration, not the 30-day extension lead time, not the 10-calendar
/ 10-working-day appeal windows, not the PSA 30-day completeness period.

This is the **largest gap relative to value**: it is also by far the cheapest to
close. It is date arithmetic over dates Ed already knows.

### GAP-7 — **Long Beach is explicitly disabled** 🔴 blocking for this customer
```js
{ id: "long_beach", name: "Long Beach", state: "CA",
  enabled: false,
  reason: "former open-data endpoint retired; official search is portal-only",
  provider: null,
  platform: "Long Beach Permit Status / Records", … }
```
**PermitPulse's own configuration states that the customer's own city cannot be
monitored automatically.** Of 59 jurisdictions, 8 have a live provider; Long Beach
is not one of them, and its entry records *why* — the feed was retired.

This is the most important single line of code in this audit. Any pitch to Ed that
implies automatic monitoring of his Long Beach projects is, today, **unsupported by
the system** and would violate PROJECT_LAWS #10.

### GAP-8 — **Delivery lifecycle terminates; Ed's projects do not** 🟠
`draft → packet_generated → under_review → changes_required →
approved_for_delivery → delivered → delivery_confirmed`, with
`delivery_confirmed: {}` — terminal, no outbound transitions.

The model assumes the engagement ends. Ed's project runs 6 months through 2–3
correction cycles. A subscription product needs a **cyclical** machine
(`watching → change_detected → action_recommended → action_taken → watching`),
not a terminal one.

### GAP-9 — **No outbound notification** 🟠
One email path exists in the entire repo (`functions/api/pilot-intake.js`). There
is no transactional email, no digest, no "here's what changed" send. The product's
core verb — *tell Ed* — has no implementation.

### GAP-10 — **No document ingestion by content** 🟠
Covered in §1.3. Filename heuristics only; `jurisdictionRules` in `extractor.ts`
cover LADBS, Pasadena, Santa Monica, San Diego, San Francisco — **not Long Beach.**

### GAP-11 — **No inbound email ingestion** 🟠
For Long Beach, the correction letter and the resubmittal both travel by email
`[S]`. An email-forwarding inbox (`project-xyz@in.getpermitpulse.com`) is the most
plausible data-acquisition route, and nothing like it exists.

### GAP-12 — **No multi-project queue view across live projects** 🟡
`MissionControlListResponse` lists cases ordered by
`mission_intelligence_priority_asc` — close in spirit, but it ranks by *research
readiness*, not by *who is waiting on whom and for how long*.

---

## 3. Verdict table

| Capability the product needs | Status | Effort to close |
|---|---|---|
| Evidence model with provenance | ✅ Built | — |
| Correction/resubmittal timeline vocabulary | ✅ Built | — |
| Evidence↔timeline citation graph | ✅ Built | — |
| Conflict/staleness handling | ✅ Built | — |
| Follow-up kit generation | ✅ Built (`PacketActionKit`) | — |
| Agency dependency mapping | ✅ Built | — |
| Deterministic rule engine | ✅ Built, **wrong subject** | Small (new rules) |
| Document queue + R2 + promotion | ✅ Built, **hollow extractor** | Medium |
| Multi-project list view | 🟡 Partial | Small |
| **Agency stage field** | ❌ Missing | **Small** |
| **`waiting_on` party model** | ❌ Missing | **Small** |
| **Clock / deadline engine** | ❌ Missing | **Small — highest value/effort ratio** |
| **Scheduler (cron)** | ❌ Missing | **Small** |
| **Change detection + prior-state snapshots** | ❌ Missing | Medium |
| **Outbound notification** | ❌ Missing | Small |
| **Inbound email ingestion** | ❌ Missing | Medium |
| **PDF content extraction / OCR** | ❌ Missing | Medium–Large |
| **Long Beach data access** | ❌ **Disabled, feed retired** | **Large / possibly unsolvable** |

---

## 4. The uncomfortable conclusion

Do we need a new application? **No.** The case workspace is the right foundation and
should be extended, not replaced.

But the audit exposes an inversion worth stating plainly:

**Everything PermitPulse has built well is about establishing the truth of a record.
Everything Ed needs is about noticing that a record changed — or didn't.**

Those are different products built on the same data model. The bridge between them
is four small pieces (agency stage, waiting-on party, clock engine, cron) and one
hard one (observing Long Beach without Ed's help — **GAP-7, which may not be
solvable**).

The cheap four are worth building on evidence we already have. **The hard one should
not be attempted until Ed tells us whether he would forward us an email.**
