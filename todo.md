# TODO

Remaining work from the code review + spec-conformance audit. Items are ordered
by priority.

---

## 1. Verify ≥80% test coverage (§12 deliverable)
- [ ] `npm run test:coverage` — check line coverage on `src/core/encoder.ts`,
      `src/worker/client.ts`, and `src/core/inference/`. Fix gaps if below 80%.

## 2. Low-priority polish (optional)
- [ ] MUS verbal explanation: add C1-equality positive propagation so the
      classic `X is Y` + `X is not Y` conflict pinpoints an empty cell instead
      of the generic fallback. (`inference/mus-explain.ts`)
- [ ] Editing an NL-entered clue currently drops its `naturalLanguage` label;
      preserve it if desired. (`ClueEditor.tsx`)
- [ ] Trim/dedupe value inputs on entry rather than only at solve-time
      validation. (`store.ts` `addValue`/`renameValue`)
- [ ] Explanation verbosity: the zebra produces ~60 steps vs §8.2's ≤30 target
      (documented in ASSUMPTIONS B7). Optional tuning: fold bijection
      consequences more aggressively while keeping the proof complete.

---

## Completed

### shadcn/ui retrofit (§4) — done
- [x] shadcn/ui initialised; primitives in `src/components/ui/`
      (Button, Input, Textarea, Label, Select, Tabs, Slider, Card).
- [x] Configured for the project's **Tailwind v3** (HSL tokens, classic
      component source) since the current CLI targets Tailwind v4.
- [x] All panes refactored (`TopBar`, `SetupPane`, `ClueEditor`,
      `NLClueEditor`, `GridPane`, `DeductionPane`, `App`).
- [x] e2e selectors updated for Radix Select; **7/7 e2e + 126 unit pass**.

### Robustness / spec fixes (done this session)
- [x] **H1 — JSON import validation.** Structural guard + `validatePuzzle` + `version===1`
      check before `loadPuzzle`; dismissable inline banner on failure. (`TopBar.tsx`)
- [x] **H2 — `setPositionCategory` cardinality desync.** Uses target category's own
      value count; resizes all categories; prunes out-of-range clues; confirms if n changes. (`store.ts`)
- [x] **H-A — Duplicate value rename blocked.** `renameValue` now checks for existing
      name in the same category before updating. (`store.ts`)
- [x] **H-B — `addValue` upper bound.** Capped at n=8; blocks adding to position
      category. (`store.ts`)
- [x] **H-C — Stale ClueEditor on edit cancel.** Form resets to defaults when
      `editingClueId` becomes null (e.g. rename mid-edit). (`ClueEditor.tsx`)
- [x] **H-D — LLM unknown clue type crash.** `VALID_CLUE_TYPES` guard in
      `nl-client.ts` before cast reaches `getClueHandler`. (`nl-client.ts`)
- [x] **M-B — Category count cap.** `addCategory` blocked at 6. (`store.ts`)
- [x] **M-C — Category count floor.** `removeCategory` blocked when total ≤ 3. (`store.ts`)
- [x] **M-D — Import version check.** Rejects files with `version !== 1`. (`TopBar.tsx`)
- [x] **M-E — `isPosition` cross-validation.** `validatePuzzle` now errors if any
      category has `isPosition: true` but isn't the declared `positionCategory`. (`validation.ts`)
- [x] **M-F — Stale CellPicker.** Auto-corrects category and value when the referenced
      cell disappears due to a rename or remove. (`ClueEditor.tsx`)
- [x] **M-G — NL fallback button.** "Switch to structured input" shown on any NL
      error, not just timeout/unavailable. (`NLClueEditor.tsx`)
- [x] **M-H — ARIA tab pattern.** Mode toggle panel has `role="tabpanel"`,
      `aria-controls`, `aria-labelledby`. (`SetupPane.tsx`)
- [x] **M-J — Empty category name.** `validatePuzzle` rejects empty/whitespace names. (`validation.ts`)
- [x] **Solve concurrency guard.** Module-level `_solveSeq`; stale results dropped. (`store.ts`)
- [x] **Silent clue loss feedback.** `removeCategory`/`removeValue` confirm before
      pruning clues. (`store.ts`)
- [x] **Playback arrow keys.** `tabIndex={0}` + `preventDefault()`. (`GridPane.tsx`)
- [x] **Grid ARIA.** `scope="col"`/`"row"` on headers; dropped `role="grid"`. (`GridPane.tsx`)
- [x] **PNG export errors surfaced.** `canvas.toBlob` properly awaited. (`export.ts`)
- [x] **Server `/api/*` 404.** JSON 404 for unmatched API routes. (`server/index.js`)
- [x] **dotenv.** Server reads `.env` automatically; `.env.example` committed.

### Earlier work (pre-session)
- [x] Inference completeness §5.6 (R2–R5 side-effect placements, R2 citations)
- [x] Clue editing §6.1
- [x] Description input §5.1
- [x] OpenRouter proxy (budget constraint, replaces Anthropic direct)
- [x] Composition-over-inheritance principles docs

---

## Notes / decisions on record (no action needed)
- Deploy is on this machine via Express (not Vercel) — ASSUMPTIONS A.1.
- LLM via OpenRouter, not Anthropic direct (budget) — ASSUMPTIONS A.3.
- `X ≠ Y` = different cells (Einstein zebra needs same-category clues) — B3.
- R1 covers only C3/C4; C5/C6/C8/C9 forced consequences labelled R5 — ASSUMPTIONS §9.
- Zebra deduction chain ~60 steps (≤30 target not met for that puzzle) — ASSUMPTIONS B7.
- Solving core, encoder, MUS, inference soundness/termination/citations all
  verified correct by review (no High/Medium correctness bugs found).
