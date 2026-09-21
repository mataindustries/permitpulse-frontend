# Business Case — modeled economics, not observed demand

Prepared: 2026-09-21
Status: INTERNAL DRAFT

---

## ⚠ Read this before any number below

**We have zero evidence that Ed Gulian would pay anything.** He has not been asked.
He has not seen a product. He volunteered a complaint, which is not a purchase
intent.

Everything in §1–§4 is **arithmetic on hypothetical inputs** — it establishes what
*would be* rational for *an* architect at various time-and-rate assumptions. It
establishes nothing about Ed.

§5 is kept separate and states what we actually know about him: almost nothing.

Confusing these two sections is the single most common way a discovery process
talks itself into building the wrong thing.

---

## 1. Monthly labor cost of administrative status chasing

`hours/month × loaded hourly rate`

| Admin hrs/month | @ $75/hr | @ $125/hr | @ $200/hr |
|---|---|---|---|
| **5** | $375 | $625 | $1,000 |
| **10** | $750 | $1,250 | $2,000 |
| **20** | $1,500 | $2,500 | $4,000 |

**Annualized:** $4,500 · $7,500 · $12,000 / $9,000 · $15,000 · $24,000 /
$18,000 · $30,000 · $48,000.

### Which cell is plausible for a firm like Ed's?

Not a claim about Ed — a structural argument. `[I]`

- TIME_SINK_ANALYSIS.md models **20–35 admin hours per entitlement** spanning ~6
  months → **≈3–6 hrs/month per active project.**
- A boutique Long Beach practice carrying 8–15 projects would not have all of them
  in an active chasing phase simultaneously; call it 3–5 at any time.
- **3–5 active × 3–6 hrs = roughly 9–30 hrs/month**, concentrated in the principal.

So the **10 and 20 hour rows are the relevant ones**, and the $125–$200 rate column
applies because a sole principal has no one to delegate to. **That lands the
modeled cost at $1,250–$4,000/month.**

Every step of that chain is inference. The 100-hour figure is the only observed
number, and it describes **one project, not a month.**

---

## 2. What price is economically rational?

### 2a. Breakeven — hours that must be saved per month to equal the fee

| Price/mo | @ $75/hr | @ $125/hr | @ $200/hr |
|---|---|---|---|
| **$250** | 3.3 hrs | 2.0 hrs | 1.3 hrs |
| **$500** | 6.7 hrs | 4.0 hrs | 2.5 hrs |
| **$1,000** | 13.3 hrs | 8.0 hrs | 5.0 hrs |
| **$2,000** | 26.7 hrs | 16.0 hrs | 10.0 hrs |

### 2b. The 3× hurdle — what a small firm actually requires

Breakeven never closes a sale. An owner-operator adopting an unfamiliar tool needs
the saving to be **obvious**, because they are also paying in adoption effort,
switching risk, and the cost of being wrong. A 3× return is the conventional floor.

| Price/mo | @ $75/hr | @ $125/hr | @ $200/hr |
|---|---|---|---|
| **$250** | 10.0 hrs | **6.0 hrs** | **3.8 hrs** |
| **$500** | 20.0 hrs | **12.0 hrs** | **7.5 hrs** |
| **$1,000** | 40.0 hrs | 24.0 hrs | **15.0 hrs** |
| **$2,000** | 80.0 hrs | 48.0 hrs | 30.0 hrs |

### 2c. Applying a realistic capture rate

No tool removes all of Category B. S1–S4 attack reconstruction, polling,
composition and transcription but cannot remove the phone calls, the judgment, or
the coordination. **A 40–60% capture of admin time is optimistic-but-defensible.**

| Admin hrs/mo | Captured @ 50% | Value @ $125 | Value @ $200 | Rational price @ 3× |
|---|---|---|---|---|
| 5 | 2.5 | $313 | $500 | $104–$167 |
| 10 | 5.0 | $625 | $1,000 | **$208–$333** |
| 20 | 10.0 | $1,250 | $2,000 | **$417–$667** |
| 30 | 15.0 | $1,875 | $3,000 | $625–$1,000 |

### 2d. Verdict on the four price points

| Price | Verdict |
|---|---|
| **$250/mo** | ✅ **Defensible at ≥10 admin hrs/mo.** Clears 3× at $125–200/hr. The only price supportable on time savings alone with the evidence we have. |
| **$500/mo** | 🟡 **Requires ~20 admin hrs/mo at $125+/hr.** Plausible for a busy principal; unproven. Needs the risk value in §3 to feel comfortable. |
| **$1,000/mo** | 🟠 **Requires ~30 hrs/mo at $200/hr, or multi-seat, or the risk value carrying most of the weight.** Not supportable as a solo-principal time-savings pitch. |
| **$2,000/mo** | 🔴 **Not rational for a boutique firm on time savings.** Would require a different buyer — a developer with capital at risk on a schedule, or a 20+ person firm. **Different product, different customer.** |

**Modeled rational band for this segment: $250–$500/month.**

---

## 3. The second value stream: avoided restart

Time savings are recurring and modest. **The expiration risk is occasional and
severe**, and it is the only place a larger number could honestly come from.

### The mechanism
LBMC 18.05.060 `[S]`: plan review applications valid **12 months**; on expiry *"no
permit will be issued, and a new plan check for the project along with new plan
check fees will be required."* Extension requests (Form-002) must be made **≥30
days prior.**

Ed's own description — ~6 months of plan check back-and-forth, plus a 3–4 month
LCDP prefix — puts a coastal project **within range of that wall on a normal, not
pathological, schedule.** `[I]`

### Cost of one expiration — parametric, because we must not invent fees

```
  Cost = P  (new plan check fee)
       + F  ($115 processing + 6% technology + 6% general plan surcharge [S])
       + H  (hours to re-prepare and re-submit)  × R (loaded rate)
       + D  (schedule delay: full first-review cycle restarts)
       + C  (client relationship cost — real, unquantifiable)
```

**`P` is unknown and must be read from the Long Beach Community Development Fee
Schedule before this is ever quoted.** Do not estimate it. PROJECT_LAWS #1.

With `H` at 10–20 hrs and `R` at $125–200, **the labor component alone is
$1,250–$4,000 — before the fee, before the delay, before the client conversation.**

### Expected value

| Annual probability per firm | EV @ $3,000 cost | EV @ $6,000 cost |
|---|---|---|
| 2% | $60/yr | $120/yr |
| 5% | $150/yr | $300/yr |
| 10% | $300/yr | $600/yr |
| 25% | $750/yr | $1,500/yr |

**EV alone does not justify even $250/mo.** That is the honest reading.

### But EV is the wrong frame, and here is why

This is **insurance economics, not productivity economics.** People do not buy
insurance at expected value — they buy it because the downside is concentrated,
memorable, and humiliating to explain to a client.

**The commercial question is not "what is the EV?" It is "has this happened to Ed,
or to someone he knows?"** If yes, the clock feature sells itself and the price
ceiling moves. If no, it is an abstraction and prices at zero.

**That is a question, not a calculation, and it belongs in the second conversation
— not the first.** (VALIDATION_EXPERIMENT.md deliberately does not ask it; asking
"have you ever lost a plan check?" in a first contact reads as a scare tactic.)

---

## 4. The structural problem with this customer segment

An asymmetry that no pricing model fixes: `[I]`

> **Boutique architecture firms have a high value of time and a low budget for
> software.**

A sole principal's hour may be worth $200. That same principal's monthly
discretionary software spend is small, decided personally, and competes with
AutoCAD/Revit, Bluebeam, accounting, insurance, and licensure. **Willingness to pay
tracks the budget line, not the hourly rate.**

Additional frictions:
- **Seat math does not help.** One principal does the chasing. No seat expansion.
- **Seasonality.** Value concentrates in chasing phases; a quiet month feels like
  a wasted subscription. **Per-project pricing may fit better than per-month** —
  and it matches PermitPulse's existing per-address offer.
- **The n=1 city problem.** Long Beach is one city (GAP-7: no feed). Every new
  jurisdiction is bespoke work. The unit economics of *"we watch your city"* are
  poor until several architects in the same city are served.
- **The done-for-you trap.** If Ed will not enter data, the offer becomes a
  service. Services price on our hours, not his savings — a different business with
  a different margin.

---

## 5. What we actually know about Ed's willingness to pay

**Nothing.**

| | |
|---|---|
| Has Ed said he'd pay? | **No** |
| Has Ed seen a product? | **No** |
| Has Ed named a budget? | **No** |
| Has Ed compared us to an alternative? | **No** |
| Did Ed volunteer a pain? | **Yes** — unprompted, with a number and a duration `[E]` |
| Did Ed give us permission to return? | **Yes** |

**The only durable evidence is that he described the problem in unusual detail
without being asked to.** That is a strong qualitative signal and it is worth
exactly one well-designed experiment. It is not a price point.

### Signals that would move us
- Unprompted *"can you do this for my other projects?"* → willingness exists.
- He names a number for chasing hours → §1 becomes grounded instead of modeled.
- He has lost or nearly lost a plan check to expiration → §3 becomes the lead.
- He asks what it costs, **before we mention price** → intent.

### Signals that would kill this
- Chasing under 3 hrs per project → §1 collapses; no product.
- Won't send a redacted document → GAP-7 is unsolvable for this customer.
- "Nothing helps until the City hires more plan checkers" → he is describing a
  capacity problem, and he may simply be right.

---

## 6. Recommendation

1. **Do not quote a price to Ed in the next contact.** No pricing conversation until
   after the free Action Sheet and after his ranking answer.
2. **When pricing does arrive, anchor at $250–$500/month, or per-project.** §2 is
   the only band the evidence can support.
3. **Do not build toward $1,000–$2,000/month for this segment.** Those prices
   require a different buyer — one with capital at risk on a schedule. That may be a
   real market. It is not Ed's.
4. **Lead with time savings; hold the expiration risk for the second
   conversation.** Leading with "you could lose your plan check" reads as fear
   selling to a 33-year practitioner.
5. **Do not model revenue from Ed at all.** n=1. The purpose of this engagement is
   a decision about what to build, not a forecast.
6. **Verify the Long Beach plan check fee schedule before any restart-cost claim is
   made to anyone.** `P` in §3 is currently `unknown` and must stay `unknown` until
   read from source (PROJECT_LAWS #3).
