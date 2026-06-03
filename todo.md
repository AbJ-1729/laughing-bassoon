# TODO

Remaining work from the code review + spec-conformance audit. Items are ordered
by priority. Everything else from the reviews is already fixed and pushed
(inference completeness §5.6, clue editing §6.1, description input §5.1,
OpenRouter proxy, principles docs).

---

## 1. Verify the two new e2e tests in-browser
The `clue editing` and `description field` Playwright tests are written and
committed but were last blocked by a Vite dev-server crash, so they're
unverified.
- [ ] Start the dev server (`npm run dev`) and confirm it stays up on :5173.
- [ ] `npx playwright test` — confirm all 7 specs pass (esp. the 2 new ones).
- [ ] If the dev server is flaky, point Playwright's `webServer` at the prod
      build (`npm run build && npm run start`, port 8787) instead.

## 2. Robustness fixes (from UI/server review — High)
- [ ] **H1 — Validate JSON import before loading.** `TopBar.tsx` `onImport`
      casts arbitrary JSON to `Puzzle` and `loadPuzzle` stores it verbatim; a
      malformed file white-screens the app (SetupPane/GridPane throw on
      `.categories`). Run `validatePuzzle` (or a structural guard for
      `version`/`categories`/`positionCategory`/`clues`) before `loadPuzzle`;
      on failure show a banner and keep current state. Defensively coalesce
      `puzzle.categories ?? []` in render paths.
- [ ] **H2 — Fix `setPositionCategory` cardinality desync.** `store.ts`
      computes `n` from the OLD position category; the demoted old axis keeps
      its `"1".."n"` labels and other categories aren't resized. Compute `n`
      from the target category and handle the demoted axis (or block/ warn).

## 3. Medium a11y / robustness (from reviews)
- [ ] **Playback arrow keys (§6.4).** The `onKeyDown` is on a non-focusable
      `div`; add `tabIndex={0}` to the playback group (or attach to the slider)
      and `preventDefault()` to avoid double-stepping the range input.
      (`GridPane.tsx`)
- [ ] **Solve concurrency guard.** `store.solve()` writes results
      unconditionally; a superseded solve can overwrite newer state. Add a
      request token / drop stale results. (`store.ts`)
- [ ] **Server `/api/*` 404.** `app.get('*')` returns `index.html` for unknown
      API routes; scope the SPA fallback to non-`/api` paths and add a JSON 404
      for unmatched `/api/*`. (`server/index.js`)
- [ ] **PNG export error handling.** `exportGridPng` swallows `toBlob`/taint
      failures; await `toBlob`, surface errors, and `.catch` at the call site.
      (`export.ts`, `GridPane.tsx`)
- [ ] **Grid ARIA semantics.** Either drop `role="grid"`/`role="gridcell"` (rely
      on the data table + per-cell `aria-label`s) or implement full grid
      keyboard nav; add `scope="col"`/`scope="row"` to headers. (`GridPane.tsx`)
- [ ] **Silent clue loss feedback.** `removeValue`/`removeCategory` prune
      dependent clues with no user notice; add a toast/confirm. (`store.ts`)

## 4. shadcn/ui retrofit (§4 — chosen: retrofit, not document)
The §4 stack lists "Tailwind CSS + shadcn/ui" but the UI is hand-rolled
Tailwind. Retrofit shadcn/ui:
- [ ] `npx shadcn@latest init` (configure for Vite: `components.json`, the `cn`
      util, CSS variables, Tailwind tokens; `@` alias already exists).
- [ ] Add primitives: Button, Select, Input, Textarea, Tabs, Slider, Card.
- [ ] Refactor `TopBar`, `SetupPane`, `ClueEditor`, `NLClueEditor`, `GridPane`,
      `DeductionPane` to use them. Keep ARIA roles/labels so Playwright
      selectors (getByRole/getByLabel) still resolve.
- [ ] Re-run `npx playwright test` and `npm run test` after the refactor.

## 5. Low-priority polish (optional)
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

## Notes / decisions on record (no action needed)
- Deploy is on this machine via Express (not Vercel) — ASSUMPTIONS A.1.
- LLM via OpenRouter, not Anthropic direct (budget) — ASSUMPTIONS A.3.
- `X ≠ Y` = different cells (Einstein zebra needs same-category clues) — B3.
- Solving core, encoder, MUS, inference soundness/termination/citations all
  verified correct by review (no High/Medium correctness bugs found).
