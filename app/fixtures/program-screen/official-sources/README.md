# Captured official sources

A Program Screen criterion can leave `pending_human` only as `human_verified`.
Its human-verification record must point to text captured from an official
source in this directory. The tests re-check every record against its capture
and every capture against its hashes.

One directory per source document, written only by the capture tool:

```
<source-id>/original.pdf     the downloaded official PDF, byte for byte
  (or original.html)         a statute page: the exact HTML the host served
<source-id>/extracted.txt    deterministic text extraction of that file
<source-id>/metadata.json    official URL, source type, operative status,
                             dates, and SHA-256 of both files
```

- **Official sources only.** Download from the City Clerk, City Planning, or
  California Legislative Information yourself, or from a host a reviewed,
  source-specific exception names (none today). Never capture a secondary
  site, a search result, or AI output (`PROJECT_LAWS.md`, laws 7 and 14).
- **Exact bytes from the official host, never a browser copy.** Capture the
  file exactly as the official host served it (for example, downloaded with
  curl). A browser "Save page" copy, print-to-PDF, screenshot, reader-mode
  export, or reconstructed or otherwise modified HTML is never an official
  capture. Served HTML is accepted only for a statute page, and only when the
  official source serves the statute as HTML.
- **Never edit these files.** Recapture with
  `npm run program-screen:capture -- ... --replace` instead. Any edit fails
  the tests until the source is recaptured and re-reviewed.
- **Drafts are not law.** A proposed draft is captured with
  `--type proposed_draft --operative-status proposed_not_operative`. It can
  prompt a re-review; it can never support a rule.
- **Maps and statutes are captures, not authorities.** An `agency_map` or
  `statute` capture (metadata v2, `--context`) never supports a criterion rule
  and never registers an issuer or authority source. Registration is a
  separate, reviewed change (`docs/PROGRAM_SCREEN_SOURCE_CAPTURE_2B.md`).
- **Register first.** Every source ID here must match an entry in
  `expectedOfficialSources` (`app/src/shared/program-screen/proposed-verification.ts`).

Captured 2026-09-27 from PDFs the repository owner supplied (the official
hosts were unreachable from the capture environment, so the bytes were not
compared with the served files):

| Source ID | Type | Status |
| --- | --- | --- |
| `ordinance-188967` | `adopted_ordinance` | `operative` |
| `ordinance-188968` | `adopted_ordinance` | `operative` |
| `shra-2025-10-28` | `official_memo` | `operative` |
| `low-rise-draft-2026-09-24` | `proposed_draft` | `proposed_not_operative` |

Both ordinances are scans with the City's OCR text layer, and the draft's
substantive pages have no text layer at all. Read every excerpt against the
page image. See `docs/PROGRAM_SCREEN_CRITERION_VERIFICATION.md` for the
hashes, the capture commands, the adopted-versus-draft change report, and the
per-criterion ledger.

Captured 2026-09-28 (Phase 3A) from the exact HTML leginfo served, which the
repository owner downloaded with curl (the official host was unreachable from
the capture environment; the upload matched the owner's SHA-256 and size):

| Source ID | Type | Status |
| --- | --- | --- |
| `gcs-66499-41` | `statute` (metadata v2, served HTML) | `operative` (per its history note) |

It is a capture only. It fires the Round 1 re-review trigger for c-g and
registers no authority. See
`docs/PROGRAM_SCREEN_PHASE_3A_GCS_66499_41_A_9_REVIEW.md`.
