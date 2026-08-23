# PermitPulse organic content system

The organic engine is a source-packet workflow, not a publishing platform. One properly researched subject should support one durable article, one 6–10 minute episode outline, three Shorts, one email/social summary, and one contextual Permit Deep Research CTA.

## Three public lanes

### Permit Drops

Short updates anchored to an official agency or jurisdiction source. Answer: what changed or what useful source behavior should the customer know now?

### Paper Trail Playbooks

Practical, repeatable research methods. Answer: how should a contractor or small builder investigate this recurring permit question without overreading the record?

### Permit Nightmares

Evidence-led narratives about confusing institutional or redacted permitting situations. The format is “true bureaucracy, useful lessons.” It follows the separate Permit Nightmares safety standard.

Do not publish an empty lane, unverified story, fake case, invented testimonial, or unsupported source summary. Keep an insufficiently verified subject as an internal draft packet.

## Source packet schema

Every packet records:

- packet ID and status: internal draft / editorial review / approved / published;
- content lane and working title;
- jurisdiction and customer question;
- last-verified date and next-review trigger;
- primary sources: owner, title, canonical URL, retrieval date, claim supported, access/reliability limits;
- verified facts;
- reasonable inference, including reasoning and disconfirming evidence;
- unknowns and confirmation routes;
- recurring failure pattern;
- useful takeaway;
- privacy basis: institutional record / redacted real case / composite;
- redaction and reidentification review;
- allegation and licensed-advice check;
- article draft or outline;
- 6–10 minute podcast/YouTube outline;
- three 30–60 second Short scripts;
- email/social summary;
- one relevant CTA to Permit Deep Research;
- derivative URLs and measurement IDs after publication.

The template is in **docs/content-packets/TEMPLATE.md**. Three completed starter packets sit beside it.

## One-operator production rhythm

- **Monday:** select one customer question, reverify primary sources, complete the source packet.
- **Tuesday:** publish/schedule Permit Drop 1 and one Short from the packet.
- **Wednesday:** draft and fact-check the deeper article and 6–10 minute outline.
- **Thursday:** publish/schedule Permit Drop 2 and a second Short.
- **Friday:** publish/schedule the Paper Trail Playbook or Permit Nightmare; prepare a third Short and email/social summary.
- **Before every release:** run source, privacy, allegation, CTA, link, and last-verified checks.
- **After release:** record aggregate content view, source click, sample view, and content-to-offer response; never copy form PII into the packet.

This plan describes production; this repository pass does not publish, post, email, or schedule anything.

## Four-week launch plan

| Week | Two Permit Drops | One deeper piece | Derived Shorts | Email/social |
|---|---|---|---|---|
| 1 — LA building records | “Start online; know when to request more” and “Which building-record types the City points to” | Paper Trail Playbook: “How to check permit history in Los Angeles without overreading the portal” | Online-first ≠ online-only; three evidence states; not-found is not no-record | Six-step LA paper-trail checklist |
| 2 — Multi-department review | “The directive calls for simultaneous electronic review” and “Online permits and virtual inspections are ordered work, not proof of completion” | Permit Nightmare: “Nine departments, one paper trail” | One project/many workflows; portal status limits; build a dependency ledger | True bureaucracy, useful lesson: map every owner |
| 3 — LA plan-review paths | “Express permits vs. Regular Plan Check” and “What Preliminary Plan Check is for,” both reverified before release | Paper Trail Playbook: “Which Los Angeles review path are you actually in?” | Express is not universal; name the review path; ask the path-specific next question | Review-path decision checklist |
| 4 — Missing records | “When plan-copy authorization may matter” and “What to record before contacting the Records Section,” both reverified before release | Paper Trail Playbook: “Not found online: the next retrieval sequence” | Evidence gap vs absence; record the query; route restricted documents | Missing-record request checklist |

Every derivative uses the same contextual CTA: **Research an address**. The email/social summary may also link to **See a redacted example** when the audience objection is trust rather than immediate intent.

## Content metadata and analytics

Published article pages must include canonical URL, title, description, content lane, stable content ID, publish/modified dates, last-verified date, primary-source links, a boundary statement, Article or HowTo structured data as appropriate, and the same Permit Deep Research CTA.

Required non-PII events:

- **pp_content_view**: content ID, lane, last-verified date, page path;
- **pp_outbound_official_source_click**: source name, sanitized destination, page path;
- **pp_content_to_offer_click**: CTA location, sanitized destination, page path;
- **pp_sample_view**: sample asset name and page path;
- **research_intake_start**: form type and page path;
- **research_intake_success**: form type and page path.

Never send names, emails, phone numbers, addresses, permit numbers, free text, submitted documents, or URL query strings to analytics.

