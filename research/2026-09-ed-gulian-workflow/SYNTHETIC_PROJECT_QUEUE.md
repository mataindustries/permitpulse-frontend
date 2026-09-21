# Synthetic Project Queue — before and after

Prepared: 2026-09-21 (a Monday)
Status: INTERNAL DRAFT

> ## ⚠ FICTIONAL COMPOSITE — REQUIRED LABEL
> Every firm, person, project, address, permit number, reviewer name and date below
> is **invented** for product design. Nothing here is Ed Gulian's, Gulian Design
> Architects', or any real party's data. No real project was consulted.
> Per `docs/PERMIT_NIGHTMARES_STANDARD.md` and PROJECT_LAWS #1, this file must
> never be presented as a record, and must carry this label if any part of it is
> reused.
>
> **Fictional firm: Tidewater Architecture Studio, Long Beach, CA.** Sole principal
> plus two staff; 10 active entitlement/permit projects, mostly coastal-zone
> residential with two commercial tenant improvements — the profile a boutique
> Long Beach practice would plausibly carry.

---

## Part 1 — BEFORE: what the principal actually has on Monday morning

### The inbox
- 1,847 unread. Four folders that matter, none of them consistently used.
- `RE: RE: FW: 5512 Toledo - plan check` — 9 messages deep. The correction letter
  is an attachment on message 3. The resubmittal is message 7. The response to
  message 7 is: nothing.
- A plan checker's out-of-office auto-reply from **June**, still the last message
  in that thread.
- An email from a structural engineer that says *"revised calcs attached"* — but
  which project? The subject line is `Re: drawings`.

### The PDFs
- `Corrections.pdf`, `Corrections(1).pdf`, `Corrections_FINAL.pdf`,
  `Corrections_FINAL_v2.pdf` in Downloads.
- Eleven pages. Fourteen numbered comments across four disciplines. Comment 9 says
  *"see comment 4."* Comment 4 was resolved in cycle 1 — or was it? Finding out
  means opening the cycle-1 letter and reading both.
- No copy of the cycle-1 letter in this folder. It is in email.

### The portal
- `permitslicenses.longbeach.gov` — needs the project number. The project number is
  on the intake receipt. The intake receipt is in email.
- Status reads **"In Review."** It has read "In Review" for eleven weeks. It read
  "In Review" before the resubmittal and it reads "In Review" after. The screen
  does not say which discipline, which reviewer, or when it last changed.
- One address returns nothing at all. *"Not all street addresses or permit statuses
  are currently available."* `[S]`

### The spreadsheet
`Projects_2026.xlsx`. Nine rows — the tenth project started in July and was never
added. Column F is `Status`. Every cell in column F says either `waiting` or
`submitted`. Column G, `Last updated`, was last updated in April.

### The calendar
Three reminders, all recurring, all snoozed:
`Call LB re: Toledo` · `Call LB re: Toledo` · `Call LB`.

### The phone
562.570.PMIT. Hold. Transfer. *"He's out this week."* *"I can leave a note."*
Nine minutes, two facts learned, neither written down anywhere permanent.

### The part that is only in his head
- That the Seaside Walk engineer owes structural calcs, not the city.
- That the Paoli Way job cleared Building in early September but Fire never
  responded, and that the portal cannot express this.
- That the Toledo job has been in plan check since last November.
- **That "since last November" is now a problem.**

### What he cannot know at all
The Toledo plan review application expires in **52 days**. The extension request
that would save it is due in **22 days**. No system he touches knows this, and
nothing will tell him.

---

## Part 2 — AFTER: the screen

### Data model

```
PROJECT
  id · name · address · jurisdiction · track (LCDP | ENTITLEMENT | PLAN_CHECK | CONCURRENT)
  application_number · application_date · current_stage · stage_since

CLOCK                                 CORRECTION_COMMENT
  project_id · clock_type               project_id · cycle · comment_no
  authority · source_citation           discipline · verbatim_text
  starts_on · length · basis            owner_party · status
  due_on · days_remaining               response_sheet_ref · carried_from_cycle
  binds (AGENCY|ARCHITECT|THIRD_PARTY)  source_evidence_id

WAIT                                  Every field above resolves to an
  project_id · waiting_on_party         evidence_item_id or is rendered
  since · days_waiting                  `unknown`. No field is populated
  expected_cycle_days                   by inference. (PROJECT_LAWS #2,#3,#7)
  basis_evidence_id · verified_how
```

### The queue — 10 rows, sorted by binding clock urgency

**Legend** — Source: `PORTAL` observed portal state · `EMAIL` forwarded correspondence ·
`PHONE` logged call · `DOC` document on file · `CALC` computed from dates on file ·
`PUBLIC` public agency posting. Verification: `✓` verified · `~` unverified · `!` disputed/conflicting.

| # | PROJECT | CURRENT STAGE | LAST VERIFIED CHANGE | WAITING ON | DAYS WAITING | BINDING CLOCK | NEXT ACTION | OWNER | SOURCE | FOLLOW-UP DUE |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | **Casa Toledo** 5512 The Toledo · PLAN_CHECK | Cycle 2 review | 2026-05-18 resubmittal emailed to J. Rivera | LB Building & Safety — *reviewer unconfirmed* | **126** (vs ~20-day cycle `[S]`) | 🔴 **Form-002 extension due 2026-10-13 — 22 days.** Plan review expires 2026-11-12 (52 d), LBMC 18.05.060 `[S]` | **File the extension request now.** Then routing inquiry citing the 18 May receipt | Ed | EMAIL ✓ receipt · PORTAL ! *"In Review" since 2026-07-01, predates nothing — no change in 82 d* · CALC ✓ | **Today** |
| 2 | **Ocean Bluff Residence** 1740 E Ocean Blvd · LCDP | ZA approved — awaiting NoFA transmittal | 2026-09-14 ZA approval | LB Planning — *transmittal to CCC unconfirmed* | **7** | 🔴 **14 CCR §13571: city must notify CCC within 7 cal. days → due TODAY** `[S]`. If transmitted 09-14, CCC 10-working-day appeal closes 2026-09-28 | Confirm NoFA transmitted **and conforming**. A deficient notice suspends the effective date `[S]` | Ed | PUBLIC ✓ ZA minutes · CCC posting **not found** ~ *(absence is not evidence of non-transmittal — PROJECT_LAWS #4)* | **Today** |
| 3 | **Bay Shore Duplex** 218 Bay Shore Ave · LCDP | Complete — not yet calendared | 2026-07-06 deemed complete | LB Planning — calendaring | **77** | 🟠 ~60-day hearing target passed **2026-09-04 (17 d ago)** `[S]` | Confirm placement on the **2026-09-28** ZA agenda (2nd & 4th Mon, 2pm `[S]`) — 7 days out | Ed | DOC ✓ completeness letter · PUBLIC ~ *not on published agenda as of 09-21* | **2026-09-22** |
| 4 | **Marine Stadium Grill TI** 5445 E Paoli Way · PLAN_CHECK | Cycle 1 — **Fire outstanding** | 2026-09-02 Building cleared | **LB Fire Prevention Bureau** | **83** (since 2026-06-30) | 🟠 No statutory clock. 83 d vs ~20-day cycle `[S]` | Targeted inquiry **to Fire only** — Building is clear, do not reopen it | Ed | PHONE ✓ 09-02 Building clearance · PORTAL ! *aggregate shows "In Review" — cannot express per-discipline state* | **2026-09-23** |
| 5 | **Anaheim St Mixed-Use** 2150 E Anaheim St · CONCURRENT | Planning SPR + Plan Check Cycle 2 | 2026-08-19 Cycle 2 corrections | Split: Planning ~ / Ed ✓ | **152** since submittal | 🟠 Plan review expires 2027-04-22 (213 d) `[S]` | Resolve the 3 comments where **Planning and Building conflict** before responding to either | Ed | DOC ✓ both letters · EMAIL ✓ | **2026-09-24** |
| 6 | **Peninsula Rebuild** 6402 E Seaside Walk · PLAN_CHECK | Cycle 1 response in progress | 2026-08-27 corrections received | **Structural engineer (Kestrel Eng.)** — *not the city* | **25** | 🟡 None active | Chase **the engineer**, not Long Beach. 4 of 14 comments blocked on their calcs | Ed → Kestrel | DOC ✓ letter · EMAIL ✓ 09-08 request, no reply | **2026-09-22** |
| 7 | **Pine Ave Retail TI** 410 Pine Ave · PLAN_CHECK | Health referral pending | 2026-07-29 referral issued | **Outside agency (county health)** — *"contacted separately"* `[S]` | **54** | 🟡 None active | Confirm the referral was **received** — separate-agency referrals have no city-side tracking | Ed | DOC ✓ referral · *no status source exists* ~ | **2026-09-25** |
| 8 | **Alamitos Dock Replacement** 55 Rivo Alto Canal · LCDP | Application under review | 2026-08-11 application filed | LB Planning / dock-harbor procedure | **41** | 🟡 PSA completeness 30 d `[S]` — **lapsed 2026-09-10 with no determination on file** → possible "deemed complete" `[S]` | Ask for the completeness determination **in writing**. Do not assert the deemed-complete rule — confirm it applies | Ed | DOC ✓ filing receipt · *no determination received* ~ | **2026-09-23** |
| 9 | **Bluff Park Addition** 2311 E Broadway · CPCE | CPCE filed | 2026-09-08 filed | LB Planning — CPCE issuance | **13** | 🟢 Within norm | Watch the **weekly CPCE posting** `[S]` — no contact needed yet | — (auto) | PUBLIC ✓ weekly CPCE list | — |
| 10 | **Naples Canal ADU** 170 Rivo Alto Canal · PLAN_CHECK | **Ready-to-issue** | 2026-09-14 plans approved | **Client** — fees unpaid | **7** | 🟠 Approved plans do not stop LBMC 18.05.060. Expires 2027-02-03 | **Tell the client.** Nothing is waiting on the city | Client | PORTAL ✓ ready-to-issue `[S]` | **Today** |

### What the top of the screen says

```
┌──────────────────────────────────────────────────────────────────────────────┐
│  MONDAY 21 SEPTEMBER 2026 · 10 active · 4 need you today                     │
│                                                                              │
│  🔴 2 HARD DEADLINES TODAY                                                   │
│     Casa Toledo — extension request due in 22 days. File it this week or     │
│                  the plan check dies and you pay for a new one. [LBMC 18.05.060]
│     Ocean Bluff — city's 7-day CCC notice window closes today. [14 CCR 13571]│
│                                                                              │
│  ⏳ 3 PROJECTS SILENT BEYOND NORM                                            │
│     Casa Toledo 126d · Marine Stadium 83d (Fire only) · Bay Shore 77d        │
│                                                                              │
│  👤 3 NOT WAITING ON THE CITY AT ALL                                         │
│     Peninsula → your engineer · Pine Ave → county · Naples Canal → your client│
│                                                                              │
│  ✅ 1 NEEDS NOTHING   Bluff Park — watching the weekly CPCE posting          │
└──────────────────────────────────────────────────────────────────────────────┘
```

---

## Part 3 — what this actually changed

| Before | After |
|---|---|
| "Which projects need attention?" → open email, guess | 4 named, ranked by consequence |
| "How long has Toledo been waiting?" → 20 min reconstructing | 126 days, with the receipt cited |
| "Is Fire or Building holding Paoli Way?" → phone call | Fire, 83 days, Building cleared 09-02 |
| "Did the city send the NoFA?" → **never asked** | Flagged; the 7-day window closes today |
| "When does Toledo expire?" → **unknown and unknowable** | 2026-11-12. Extension due in 22 days. |
| 3 of 10 wait on Ed's own consultants/client | Separated out, so Ed stops chasing the city for them |

### Three claims this screen deliberately does **not** make
1. It never says *"approved."* Row 2 says *ZA approved — transmittal unconfirmed,*
   because those are different facts.
2. It never treats an empty search as a negative finding. Row 2 marks the missing
   CCC posting `~` and states the limit explicitly (PROJECT_LAWS #4).
3. It never hides a contradiction. Rows 1 and 4 carry `!` where the portal
   disagrees with the documented record — surfaced, not silently resolved
   (PROJECT_LAWS #5, #6).

### The honest caveat
**Six of the ten `LAST VERIFIED CHANGE` values come from Ed, not from observation.**
`EMAIL`, `DOC` and `PHONE` sources all mean *the architect told us, or forwarded us
something.* Only `PUBLIC` (rows 3, 9, and partially 2) and `PORTAL` are independent,
and per GAP-7 Long Beach portal access is manual.

**The `CALC` column — the one carrying the two red deadlines — needs nothing from
anyone. It is arithmetic on dates already on file.** That asymmetry is the entire
argument for building S1 first.
