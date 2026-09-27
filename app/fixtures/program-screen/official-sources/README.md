# Captured official sources

A Program Screen criterion can leave `pending_human` only as `human_verified`.
Its human-verification record must point to text captured from an official
source in this directory. The tests re-check every record against its capture
and every capture against its hashes.

One directory per source document, written only by the capture tool:

```
<source-id>/original.pdf     the downloaded official PDF, byte for byte
<source-id>/extracted.txt    deterministic text extraction of that file
<source-id>/metadata.json    official URL, source type, operative status,
                             dates, and SHA-256 of both files
```

- **Official sources only.** Download from the City Clerk, City Planning, or
  California Legislative Information yourself. Never capture a secondary
  site, a search result, browser-generated HTML, or AI output
  (`PROJECT_LAWS.md`, laws 7 and 14).
- **Never edit these files.** Recapture with
  `npm run program-screen:capture -- ... --replace` instead. Any edit fails
  the tests until the source is recaptured and re-reviewed.
- **Drafts are not law.** A proposed draft is captured with
  `--type proposed_draft --operative-status proposed_not_operative`. It can
  prompt a re-review; it can never support a rule.
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
