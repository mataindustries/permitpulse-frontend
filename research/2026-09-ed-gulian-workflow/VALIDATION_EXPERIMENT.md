# Validation Experiment — the single next ask

Prepared: 2026-09-21
Status: INTERNAL DRAFT — proposed, not yet sent

---

## 1. What we are actually testing

Not *"is permitting painful?"* — Ed answered that, unprompted, with a number and a
duration. Re-asking wastes the one circle-back we have.

The three things we genuinely do not know, in order of how much they matter:

**Q1 — Is the administrative slice real and large?**
Ed said 100+ hours on *"submittals,"* and mentioned the pestering in a separate
clause. We modeled 20–35 admin hours inside the 100 (TIME_SINK_ANALYSIS.md §2) but
his sentence is genuinely ambiguous about whether chasing was counted at all. If the
admin slice is 5 hours, there is no product here.

**Q2 — Will he give a system data it cannot observe?**
GAP-7: Long Beach has no feed. If Ed will not forward a correction letter or type
six dates, the only viable shape is done-for-you service, not software.

**Q3 — Does he already have this handled?**
A 33-year-old practice has habits. Maybe his assistant maintains a tickler file.
Maybe he has never lost a plan check to expiration and considers it a non-risk.

## 2. Candidate asks, scored

| Ask | Tests | Burden on Ed | Verdict |
|---|---|---|---|
| 15-min screen share | Q1 ✓ Q2 ✓ Q3 ✓ | **High** — calendar, prep, watching us | Best information, worst conversion. Ask for it **second**. |
| Give us one current project (live monitoring) | Q2 ✓✓ | High — implies ongoing commitment | Premature. We cannot monitor Long Beach (GAP-7). Would fail publicly. |
| Redacted project timeline | Q1 ✓ | Medium — he must *build* the timeline | **Self-defeating.** We'd be asking him to do the work we claim to save. |
| Let us monitor one permit | Q2 ✓ | Low | **Cannot deliver.** GAP-7. Would break PROJECT_LAWS #10 on first contact. |
| **One correction letter + key dates** | **Q1 ✓ Q2 ✓ Q3 ✓** | **Low — both artifacts already exist** | ✅ **Recommended** |
| Manually produce a status packet for him | Q3 ✓ | Zero | Needs the input from the ask above anyway. This is the *return*, not the ask. |

## 3. ✅ RECOMMENDED — the single best next ask

> **One correction letter from one live project, redacted however he likes, plus
> six dates — and we send back a one-page Action Sheet within two business days.**

### Why this one

1. **Zero new work for Ed.** The letter is already on his disk. The dates are in
   his email. He forwards one message. Every rejected alternative asks him to
   *produce* something.
2. **It is PermitPulse's existing offer, re-pointed.** The public promise is
   *"Give us the address. We follow the paper trail."* This is *"Give us the
   correction letter. We tell you where you stand."* Same delivery muscle, same
   packet pipeline, same 48-business-hour target as
   **Permit Deep Research** (README.md).
3. **It tests Q2 by doing, not by asking.** If he forwards the letter, he has
   demonstrated willingness to send us a private project document — the exact
   behavior the whole product depends on. If he will not, we have our answer for
   free and we stop.
4. **It separates the three value propositions so he can grade them.** We return
   three distinct artifacts and ask which one he'd have paid for. That is a far
   sharper signal than "would you use this?"
5. **The clock half needs nothing we cannot compute.** Even if the letter is heavily
   redacted, six dates produce the Clock Sheet.
6. **It is falsifiable in our favour or against us within 48 hours.**

### Risk, stated

The Action Sheet may tell Ed something he already knows. **That is a successful
experiment**, not a failure — it kills S2–S4 cheaply and leaves S1 standing on the
clock risk alone.

---

## 4. WHAT WE NEED FROM ED

One forwarded email. Nothing formatted, nothing prepared.

**(a) One correction letter** — most recent cycle, any live project. Redact the
client name, address, and anything else he likes. **We need the comment structure,
not the identity.** A photo of the pages is fine.

**(b) Six dates**, from memory or from the thread:
```
1. Original application / plan check submittal date
2. Date cycle-1 corrections were issued
3. Date he resubmitted
4. Date of the correction letter he's sending us
5. Last date anyone at the City actually responded
6. Whether the project is coastal / has an LCDP  (yes/no)
```

**(c) One question, answered in a sentence:**
> *"Of those 100+ hours — roughly how many were chasing status, writing follow-ups,
> and working out which comments were still open, versus drawing and detailing?"*

That single question resolves Q1, and it is the highest-value sentence we could
obtain from this entire engagement.

### What we explicitly do NOT ask for
No portal login. No email access. No client names. No fee data. No commitment. No
call scheduled before we deliver. No mention of price.

---

## 5. WHAT WE DO MANUALLY

All of it. **Nothing is automated for this experiment.** We are testing the value of
the output, not the cost of producing it.

| Step | Work | Time |
|---|---|---|
| 1 | Parse the letter into a comment register: number, discipline, owner, status | 45 min |
| 2 | Diff against the prior cycle if he sent two; otherwise flag carry-forward candidates | 20 min |
| 3 | Build the Clock Sheet from his six dates — every applicable clock from WORKFLOW_MAP.md §3, each with a citation | 40 min |
| 4 | **Re-verify LBMC 18.05.060 and the Form-002 lead time from the canonical sources** — currently `[S]` only, and this claim is going in front of a licensed architect | 30 min |
| 5 | Write the Silence Record: who owes what, since when, with basis | 30 min |
| 6 | Draft the follow-up email in `PacketActionKit` shape | 30 min |
| 7 | Internal review against PROJECT_LAWS — every claim traceable, every unknown marked `unknown`, no certainty beyond evidence | 30 min |
| | **Total** | **≈3.5 hours** |

Step 7 is not optional. The first artifact a licensed professional sees from us
must not contain a single unsourced assertion.

---

## 6. WHAT WE RETURN TO HIM

**One page. Three blocks. No login, no signup, no product.** A PDF attached to a
reply email.

```
┌─ [PROJECT] — where this stands, 23 September 2026 ────────────────────┐
│                                                                        │
│ ① THE CLOCKS                                                          │
│    Plan review application filed .............. 12 Nov 2025           │
│    ⚠ Expires ................................. 12 Nov 2026  (52 days) │
│    ⚠ Extension request due (Form-002) ........ 13 Oct 2026  (22 days) │
│      [LBMC 18.05.060 — expired plan review = new plan check, new fees] │
│    Days since your resubmittal ................ 126                   │
│      [City states ~20 days for resubmittal review]                    │
│                                                                        │
│ ② THE COMMENTS — 14 items, cycle 2                                    │
│    Open ....... 9    Structural 4 · Energy 2 · Planning 2 · Bldg 1     │
│    Yours ...... 6    Your engineer .. 2    Owner .. 1                  │
│    Carried forward from cycle 1 ............... 3  ← #4, #9, #11       │
│    ⚠ Newly raised in cycle 2 .................. 2  ← #12, #13          │
│      [Gov. Code §65943 limits new items on subsequent incompleteness   │
│       determinations for discretionary applications — applicability to │
│       your plan check is NOT established; flagged for your judgment]   │
│                                                                        │
│ ③ THE NEXT MOVE                                                       │
│    To: plan checker of record                                          │
│    Subject: [Project no.] — resubmittal 18 May, status request         │
│    [3-sentence draft citing your receipt date and the three            │
│     carried-forward items, asking for reviewer + discipline queue]     │
│                                                                        │
│ Sources: [8 citations]   Unknowns: [4, listed]   Not verified: [2]     │
└────────────────────────────────────────────────────────────────────────┘
```

Note block ② is written to **flag §65943 for his judgment, not to assert it
applies.** Telling an architect a statute protects him when we have not established
it does, is the fastest way to lose him permanently.

---

## 7. HOW LONG IT SHOULD TAKE US

| | |
|---|---|
| Send the ask | Same day |
| Ed responds | 1–7 days (or not — that is data) |
| We produce | **2 business days**, matching the stated Permit Deep Research target |
| Total cycle | **≤ 10 days** |

If he has not replied in 10 days: **one** short follow-up, then stop. A customer who
will not forward one existing PDF is telling us something about Q2, and we should
believe him.

---

## 8. WHAT SUCCESS LOOKS LIKE

**Tier 1 — Strong (build S1 immediately, plan S2–S4)**
- He replies with a number for the chasing hours, and it is ≥ 5 hrs per project.
- He reacts to a specific line — especially the expiration date — with surprise.
- He asks *"can you do this for my other projects?"* **unprompted.** That sentence
  is worth more than any survey.
- He corrects our workflow map. Correction = engagement.

**Tier 2 — Moderate (build S1 only; re-test)**
- He confirms it is accurate but says he already tracks most of it.
- Only the clock block lands.
- Polite reply, no follow-up question.

**Tier 3 — Negative (stop; do not build for this segment)**
- He does not send the letter. **The strongest possible signal and the cheapest.**
- He says the chasing is under 3 hours per project.
- He says the real problem is purely city staffing and nothing else matters.
- He is protective of client documents even redacted — a category objection we
  cannot engineer around.

**Explicit anti-success — do NOT count these as validation:**
- *"This is great, nice work"* with nothing specific. Politeness is not demand.
- Any interest that appears only after we mention a price.
- Our own conviction that the artifact is impressive.

---

## 9. WHAT QUESTION WE ASK AFTERWARD

**One question. Not a survey. Not a pitch.**

> **"Of those three — the clocks, the comment register, or the drafted follow-up —
> which one would you have paid someone to produce for you last month, and which one
> did you already have?"**

Why this question:
- It forces a **ranking**, not a rating. Rankings survive politeness; ratings don't.
- *"Which did you already have?"* gives him a costless way to tell us we're wrong —
  which is the answer we most need and least likely to get otherwise.
- It measures **retrospective** willingness to pay for a specific artifact, not
  hypothetical future interest in a product. Far harder to answer generously.
- It tells us which of S1/S2/S4 is the wedge, so the first build is aimed.
- It never asks *how much* he'd pay. Price discovery with n=1 produces a number that
  will mislead us for a year. **Ask price only after a second and third architect.**

### The question we must resist asking
*"Would you pay $X/month for this?"* He will say something kind. We will believe it.
It will be wrong. BUSINESS_CASE.md models what *would be* rational — deliberately
kept separate from any claim about Ed.

---

## 10. Draft message to Ed (for human review — do not send as-is)

> Ed —
>
> Thanks for the detail on the LCDP and plan check timing. The line that stuck with
> me was having to become a pest to get things finalized.
>
> I've been mapping how a Long Beach coastal project actually moves, and I found
> something I'd like to check against a real one: there are about sixteen separate
> deadlines running on a project like yours, and most of them aren't visible
> anywhere you'd normally look. A couple of them run against *you*, not the city.
>
> Would you forward me one correction letter from a live project — redact whatever
> you want, I only need the comment structure — plus roughly these dates: original
> submittal, when corrections came, when you resubmitted, and the last time anyone
> at the City actually responded?
>
> I'll send back a one-page sheet in two business days: every clock on that project
> with its source, your comments sorted by discipline and who owes each one, and a
> drafted follow-up you can send or bin. No signup, no charge, and I'm not selling
> you anything yet.
>
> One question either way, if you have a second: of those 100+ hours, roughly how
> many were chasing status and working out what was still open, versus actually
> drawing?
