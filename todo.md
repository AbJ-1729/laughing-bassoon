# TODO

Remaining work from the code review + spec-conformance audit. Items are ordered
by priority.

---

## 1. Verify the two new e2e tests in-browser
The `clue editing` and `description field` Playwright tests are written and
committed but were last blocked by a Vite dev-server crash, so they're
unverified.
- [ ] Start the dev server (`npm run dev`) and confirm it stays up on :5173.
- [ ] `npx playwright test` — confirm all 7 specs pass (esp. the 2 new ones).
- [ ] If the dev server is flaky, point Playwright's `webServer` at the prod
      build (`npm run build && npm run start`, port 8787) instead.

## 2. shadcn/ui retrofit (§4 — largest remaining spec gap)
The §4 stack lists "Tailwind CSS + shadcn/ui" but the UI is hand-rolled
Tailwind. Retrofit shadcn/ui:
- [ ] `npx shadcn@latest init` (configure for Vite: `components.json`, the `cn`
      util, CSS variables, Tailwind tokens; `@` alias already exists).
- [ ] Add primitives: Button, Select, Input, Textarea, Tabs, Slider, Card.
- [ ] Refactor `TopBar`, `SetupPane`, `ClueEditor`, `NLClueEditor`, `GridPane`,
      `DeductionPane` to use them. Keep ARIA roles/labels so Playwright
      selectors (getByRole/getByLabel) still resolve.
- [ ] Re-run `npx playwright test` and `npm run test` after the refactor.

## 3. Verify ≥80% test coverage (§12 deliverable)
- [ ] `npm run test:coverage` — check line coverage on `src/core/encoder.ts`,
      `src/worker/client.ts`, and `src/core/inference/`. Fix gaps if below 80%.

## 4. Low-priority polish (optional)
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

### Robustness / spec fixes (done this session)
- [x] **H1 — JSON import validation.** `TopBar.tsx` now runs a structural guard
      + `validatePuzzle` before `loadPuzzle`; shows a dismissable inline banner
      on failure and keeps current state. (`TopBar.tsx`)
- [x] **H2 — `setPositionCategory` cardinality desync.** Now uses target
      category's own value count as the new `n`; resizes all other categories
      (truncates or pads); prunes out-of-range C3/C4 clues; shows a confirm
      dialog if `n` changes. (`store.ts`)
- [x] **Solve concurrency guard.** Module-level `_solveSeq` counter; stale
      results are silently dropped. (`store.ts`)
- [x] **Silent clue loss feedback.** `removeCategory` and `removeValue` now
      call `window.confirm()` before pruning dependent clues. (`store.ts`)
- [x] **Playback arrow keys (§6.4).** `tabIndex={0}` on the playback group div;
      arrow keys call `preventDefault()` to avoid double-stepping the slider.
      (`GridPane.tsx`)
- [x] **Grid ARIA semantics.** Dropped `role="grid"`/`role="gridcell"`; added
      `scope="col"` to all column headers and `scope="row"` to row headers.
      (`GridPane.tsx`)
- [x] **PNG export error handling.** `canvas.toBlob` wrapped in a proper
      `Promise`; call site `await`s and surfaces errors via `alert`. (`export.ts`,
      `GridPane.tsx`)
- [x] **Server `/api/*` 404.** SPA catch-all scoped to non-`/api` paths; added
      a JSON 404 for unmatched `/api/*`. (`server/index.js`)
- [x] **LLM timeout fallback (§9).** NL clue editor now shows a "Switch to
      structured input" button when the proxy is unavailable or timed out.
      (`NLClueEditor.tsx`)
- [x] **Documented new assumptions.** R1 rule scope (narrower than spec text),
      ≤30-step test gap for zebra, and `logic-solver` vs `minisat.js` package
      name added to `ASSUMPTIONS.md`. (`ASSUMPTIONS.md`)

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
