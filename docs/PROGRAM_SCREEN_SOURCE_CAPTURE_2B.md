# Program Screen source capture: agency maps and statutes (Phase 2b)

Phase 2b adds the capture capabilities that the first real authority registration work needs:

- the fire-hazard map and legend for `la_shra.very-high-fire-hazard-severity-zone` (c) and `la_shra.high-fire-hazard-severity-zone` (d);
- the statute behind the re-review trigger `gcs_66499_41_a_9_captured` (GCS 66499.41(a)(9)).

It is infrastructure only:

- **Nothing new is captured, registered, or promoted.** No real source is captured, and no real host exception is added. No issuer or authority source is registered. No criterion is promoted.
- **The invariants hold.** `human_verified` = 0 and `pending_human` = 46. No outcome ceiling changes, and no evaluator behavior changes.
- **Output is byte-identical.** The evaluator and public-demo output hashes are unchanged, and so are the four existing captures (`app/tests/program-screen-source-capture-2b.test.ts`, sections 1 and 11).
- **Every new fixture is TEST-ONLY.** Each is fictional, lives under `test-only-sources/`, and uses an `.example.test` host.

Capturing GCS 66499.41(a)(9) and the official fire-hazard map and legend are later steps, each reviewed on its own.

## Design review decisions (verbatim)

Decided in the Phase 2b design review, as given:

```text
B1 — APPROVE HTML + PDF for statutes.
For official statute pages:
capture the exact HTTP-served HTML bytes when the official source serves HTML;
use the new deterministic, versioned HTML extractor;
PDF remains supported when the official source itself supplies a PDF;
do not accept browser “Save page”, print-to-PDF, screenshots, reader-mode exports, or reconstructed HTML as an official capture.
Reword the README rule accordingly: prohibit browser-generated/modified copies, not exact bytes downloaded from the official host.
B2 — DO NOT add a real host exception in this PR.
Ship sourceHostExceptions empty.
We will add the actual fire-map host/path only after:
the exact official source is identified;
I review it;
its source ID/path/host are known;
I explicitly approve that exception.
Do not guess the CAL FIRE or other map URL.
B3 — NO real captures in this PR.
This is infrastructure only.
Keep all new fixtures explicitly TEST-ONLY under .example.test.
After Phase 2b merges, we will separately capture:
GCS 66499.41(a)(9)
the official fire-hazard map/legend needed for c/d
Those captures will be their own reviewed step.
B4 — APPROVE.
agency_map and statute remain outside operativeSourceTypes.
A map establishes parcel evidence only through the authority system after separate review/registration.
A statute/map capture does not automatically become:
a criterion-rule source;
Round 1 evidence;
a human verification;
an authoritative parcel fact.
Any future change to that separation requires another reviewed decision.
B5 — APPROVE same-capture legend requirement for Phase 2b.
Registration readiness requires the legend/context necessary to interpret High / Very High / responsibility area to be contained in the captured source.
If the publishing agency uses a separate official legend/document, Phase 2b should fail closed rather than invent cross-document linkage.
Supporting a reviewed multi-document map package can be designed later if the actual authoritative source requires it.
B6 — APPROVE.
Enforce capture-to-authority registration readiness in tests / registry validation, not in the evaluator.
The evaluator should remain independent of repo fixtures/capture files.
Do not change current evaluator behavior or hashes.
B7 — APPROVE.
Allow a recommended/proposed map to be captured as proposed_not_operative.
Such a capture can never satisfy authority-registration readiness or establish a parcel fact.
B8 — KEEP THE RE-REVIEW TRIGGER LIMITED TO c, d, e, f, g FOR NOW.
Do not automatically add:
hazardous-waste-site
special-flood-hazard-area
regulatory-floodway
earthquake-fault-zone
even though their existing material references GCS 66499.41(a)(9).
Those four were not part of the Round 1 human decision set. Capturing the statute may reveal information relevant to them, but expanding their review triggers should be a separate review after we actually read the captured statute.
Once GCS 66499.41(a)(9) is captured, report every criterion in the repo that cites or depends on it. We will then decide explicitly whether those four enter the next human-review round.
```

## Metadata v1 (frozen) and v2

`app/src/shared/program-screen/source-capture.ts` parses capture metadata by `schema_version`:

| Version | Source types | Original | Host |
| --- | --- | --- | --- |
| `program-screen-official-source-v1` (frozen) | `adopted_ordinance`, `official_memo`, `proposed_draft` | `original.pdf` | global allowlist only |
| `program-screen-official-source-v2` (new) | `agency_map`, `statute` | `original.pdf`, or `original.html` for a statute page | global allowlist, or one reviewed exception for that source |

The v1 schema is unchanged. It never accepts a v2 type, context, host basis, or HTML original, and the four existing captures and both earlier TEST-ONLY captures stay v1 byte for byte. The capture tool still writes v1 for the v1 types; its self-test reproduces the v1 TEST-ONLY capture byte for byte.

v2 keeps every v1 field and adds:

- `host_basis`: `global_allowlist`, `test_only_host`, or `{ "exception_id": ... }`. It must equal the rule that actually admitted the URL.
- `agency_map` or `statute`: the context block for the type, and exactly one of them.
- `may_change_source_ids` must be empty, because only a draft records sources it would change.

Every context excerpt is `{ page, text }`, and it must appear on that page of `extracted.txt`. A capture carries no authority fields at all. The schema is strict, so it rejects `issuer_id`, `authority_source_id`, `fact_keys`, `record_kind`, and any "authoritative" or reviewer field.

`agency_map` and `statute` are added to `officialSourceTypes` only. `operativeSourceTypes` is unchanged (B4):

- a map or statute capture can never support a criterion rule;
- it can never back a human-verification record;
- it can never be the source of a proposal or review-round candidate, or be quoted as review context.

## Agency map capture

```jsonc
"agency_map": {
  "issuing_agency": { "name": "...as printed", "excerpt": { "page": 1, "text": "..." } | null },
  "edition": { "label": "..." | null, "date": "YYYY-MM-DD" | null,
               "date_kind": "effective" | "adopted" | "published" | "issued" | null,
               "excerpt": { ... } | null },
  "responsibility_areas": [
    { "area": "state" | "local" | "federal",
      "legend_classes": ["very_high", "high", "moderate"],   // as this map's legend lists them for the area
      "excerpts": [ { ... } ] }
  ],
  "supersession": { "statement": "stated_current" | "stated_superseded" | "not_stated", "excerpt": { ... } | null }
}
```

Rules:

- The edition date and its kind are recorded together or not at all.
- A label or date is recorded exactly when an excerpt shows it, and the edition date is the `document_date`.
- Each responsibility area is recorded once, with at least one excerpt and unique legend classes. An empty list means the areas are not established.
- A supersession statement is recorded exactly when an excerpt shows it. A map that states it is superseded is recorded as `superseded`.
- An `operative` map has an established edition date and does not state that it is superseded.
- A recommended or proposed map may be captured as `proposed_not_operative` (B7). It can never be registered.
- An agency map is captured as a PDF, never as HTML.

The context records what the map prints, not a conclusion. The legend and context must be in the same capture (B5). A legend published as a separate document is not linked, so such a map is not ready for registration.

## Statute capture

```jsonc
"statute": {
  "jurisdiction": "CA", "code": "GOV", "section": "66499.41",
  "form": "code_section_page" | "official_pdf",
  "section_heading": { "page": 1, "text": "66499.41." },
  "pinpoints": [ { "pinpoint": "(a)(9)", "excerpt": { "page": 1, "text": "(9) ..." } } ],
  "status_as_published": { "page": 1, "text": "(Amended by ...)" } | null
}
```

The exact requested section is pinned three ways:

1. **URL.** A `code_section_page` is the leginfo page `/faces/codes_displaySection.xhtml` with exactly one `lawCode` and one `sectionNum`, and they must name this code and section. leginfo writes `sectionNum` with or without a final period, so `66499.41` and `66499.41.` are both accepted. `66499.4`, `66499.410`, `66499.41.5`, and another code are refused. Any `lawCode` or `sectionNum` on an `official_pdf` URL must match too.
2. **Heading.** The heading reads exactly the section number (optionally with `§` and a final period). It must be a whole line of its page, so a page headed `66499.41.5.` never passes as `66499.41`.
3. **Pinpoints.** Each pinpoint is written like `(a)(9)`. Its excerpt begins with the last component, `(9)`, and it must appear at or after the heading.

An `operative` statute capture quotes the source's own history or effective-date note (`status_as_published`). Without one, the capture is `status_unconfirmed`. A statute is never `proposed_not_operative`.

### Served HTML (B1)

A `code_section_page` is the exact bytes the official host served. Download it with curl (or an equivalent HTTP client), never through a browser. Browser "Save page" copies, print-to-PDF, screenshots, reader-mode exports, and reconstructed HTML are not official captures. As a tripwire, the capture refuses:

- HTML that is not strict UTF-8;
- HTML that declares another charset;
- a document that does not start as HTML;
- a copy carrying a known browser save-page marker (`<!-- saved from url=`, SingleFile).

`extracted.txt` comes from `program-screen-html-text` 1.0.0, which is pure code in `source-capture.ts`, then from the existing `program-screen-text-v1` normalization. It runs as one page:

1. Drop a leading byte-order mark.
2. Remove comments, and remove script, style, and template elements with their content. Also remove the doctype, other `<!...>` declarations, and processing instructions.
3. A block element's start or end tag becomes a line break. Every other tag is removed. Quoted attribute values may contain `>`.
4. Decode decimal and hexadecimal references, and a fixed list of named references, in one pass, so `&amp;lt;` becomes `&lt;`. An invalid code point becomes U+FFFD, and an unlisted name stays as written.

Because the extractor is pure code, every test run and every `--verify` re-extracts served HTML and compares the result with `extracted.txt`. Changing a rule means a new extractor version, a recapture, and a human re-review.

A statute the official source itself supplies as a PDF is captured through the existing pdfjs-dist path, as `form: official_pdf`.

## Source-specific host exceptions (D11, B2)

```ts
interface SourceHostException {
  exception_id: string;                    // kebab, unique
  source_id: string;                       // exactly one capture; one exception per source; never test-only
  source_type: "agency_map" | "statute";
  host: string;                            // one exact lowercase hostname
  path_prefix: string;                     // a single file, or a directory ending in "/"; never "/"
  operator: string; reason: string;
  review: { reviewer: { kind: "human", name, role }, reviewed_on, decision_ref | null };
}
export const sourceHostExceptions: readonly SourceHostException[] = [];   // shipped empty (B2)
```

- `officialSourceHosts` is unchanged. `officialSourceUrlIssue` still checks only the global allowlist and never consults exceptions.
- A v2 capture's URL passes if its host is on the global allowlist, or if the one exception for its own `source_id` matches its type, exact host, and path. A path matches when it equals the prefix, or when the prefix ends in `/` and the path starts with it (after URL normalization, so `..` cannot escape it). Another source, another type, a subdomain, a lookalike host, a port, HTTP, and every v1 capture are refused.
- The exception registry itself refuses anything that could act globally:
  - a wildcard, uppercase, port, or IP-address host;
  - a host already on the global list, or a test-only host;
  - a path prefix of `/`, or one that is relative, unnormalized, scheme-relative, or carries a query or percent-encoding;
  - a test-only source or a v1 type;
  - a missing or non-human review;
  - a second exception for one source, or any extra field.
- A capture records the exception that admitted it (`host_basis`). If the exception is removed, the capture fails validation.

Adding a real exception, such as the fire-map host and path, is a separate change. It happens only after the exact official source is identified and reviewed, and its source ID, host, and path are known. It also needs an explicit human approval of that exception (B2).

## Registration readiness (B5, B6, B7)

`authoritySourceCaptureIssues(source, capture)` says whether a capture could back a `ReviewedAuthoritySource`. An empty result means a registration may be proposed, not that one exists: registration stays a separate, human-reviewed change to `authority-policy.ts`.

In Phase 2b, only an `agency_hazard_map` registration backed by an official `agency_map` capture can pass. The capture must:

- be valid metadata that is not test-only;
- be pinned by the registration's `sha256_extracted`;
- be `operative`, not proposed (B7), unconfirmed, or superseded;
- have an edition date and kind that equal the registration's;
- show the issuing agency printed on the map;
- record at least one responsibility area, and not state that it is superseded;
- have a legend class for every fact it is registered for: `very_high` for the Very High fact, `high` (in some area) for the High fact;
- have every context excerpt on its page.

A statute, ordinance, memo, or draft capture never passes.

The check runs in tests over the shipped registries (B6). Today there are no registrations, and the tests prove that a hypothetical registry citing the TEST-ONLY map is refused. The evaluator never reads captures or fixtures, and its behavior and hashes are unchanged.

## The GCS 66499.41(a)(9) re-review trigger (B8)

`statuteRereviewTriggers` (in `proposed-verification.ts`, which production never imports) maps `gcs_66499_41_a_9_captured` to GOV 66499.41, pinpoint (a)(9).

`statuteRereviewWarnings(captures, decisions)` fires only for an official statute capture of that code, section, and pinpoint. It flags exactly the decisions that list the trigger: c, d, e, f, and g. A TEST-ONLY capture never fires it. Today it fires for nothing, because no statute is captured. Like a draft warning, it never changes a criterion result.

The four restricted-category criteria are not added:

- `la_shra.hazardous-waste-site`
- `la_shra.special-flood-hazard-area`
- `la_shra.regulatory-floodway`
- `la_shra.earthquake-fault-zone`

They cite (a)(9) through the exception path labelled "Conditions or standards in GCS 66499.41(a)(9) met (statute not captured)", and through the memo excerpt "Please see GCS 66499.41(a)(9) ...". When the statute is captured, report every criterion that cites or depends on it. As of this change, that is c-g (by trigger) and the four above (by exception path and basis excerpt). A reviewer then decides whether those four join the next review round.

## Capturing a real source later (its own reviewed step)

1. **Register the source.** Identify the exact official document and add it to `expectedOfficialSources` with its type and URL.
2. **Add a host exception only if needed.** If the host is not on the global allowlist, a named reviewer approves one `SourceHostException` for that source ID, host, and path.
3. **Download the exact bytes.** Get the PDF, or for a statute page the served HTML, with curl. Write the context JSON from the text the capture tool extracts.
4. **Run the capture tool.** Use `npm run program-screen:capture -- ... --context <file>`. It refuses anything that does not validate, and writes nothing until every excerpt is on its page.
5. **Review, don't register.** A person reviews the capture. Registering an issuer or authority source, populating a fact policy, and promoting a criterion remain separate, reviewed changes (Phase 3). They are not part of a capture.

## Not in Phase 2b

- Adopted plans, recorded instruments, Director-issued maps, and multi-document map packages (B5).
- The case-scoped private evidence store for parcel instruments and maps (D10).
- Any real capture, host exception, issuer, authority source, or promotion (B2, B3).
- Expanding the Round 1 decision set or the trigger's reach (B8).
