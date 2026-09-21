# SpammerAegis

Local-first X archive forensics desk. No X login, no remote case store, no auto-block.

## Stack

TanStack Router / Grok Build app layout. Desk logic lives in `src/lib/altbreak/`. UI in `src/components/`. Zustand casefile in `src/store/casefile.ts`. Firefox field kit in `extension/`.

## Rules

- Keep storage in the browser (localStorage / file import).
- Alt scores are evidence, not proof.
- Action queue uses intent links only.
- BSD-2-Clause.
- Do not commit `share.json` or Grok sandbox credentials.
