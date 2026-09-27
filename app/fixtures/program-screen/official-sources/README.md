# Captured official-source text

A Program Screen criterion can leave `pending_human` only as `human_verified`.
Its human-verification record must point to a plain-text capture of the
official source in this directory. Tests re-check each record against its
capture.

One `.txt` file per source document, holding the source text only:

- **Official sources only.** Use City Clerk, City Planning, or California
  Legislative Information text. Never capture a secondary summary, search
  result, or AI output (`PROJECT_LAWS.md`, laws 7 and 14).
- **Exact text.** Extract text from the official PDF or HTML page, or
  transcribe it by hand. Record which method you used in `capture_method`.
  Whitespace may differ; every other character must match the source.
- **Pinned.** Put the file's SHA-256 in `source_capture.sha256`. Any later
  edit to the file fails the tests until a human re-verifies it.
- **File names.** Lowercase kebab-case, e.g. `ordinance-188968.txt`.

This directory holds no captures yet: no criterion has been human-verified.
See `docs/PROGRAM_SCREEN_CRITERION_VERIFICATION.md` for the per-criterion
verification ledger.
