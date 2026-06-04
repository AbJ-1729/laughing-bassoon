# CLAUDE.md — Logic-Grid Puzzle Solver

Reference file for Claude Code. Covers architecture, conventions, commands, and
current project state so context can be rebuilt quickly in future sessions.

---

## What this project is

A React + TypeScript SPA that lets users define **Einstein / zebra logic-grid
puzzles** and get a **step-by-step human-readable deduction chain** explaining
the solution. The novelty is the explanation, not the solving: a SAT solver
(MiniSat via the `logic-solver` npm package) finds the unique solution; a
separate forward-chaining inference engine generates the narrative proof.

Three outcomes are handled: **unique** (shows deduction chain), **multiple**
(under-constrained — shows two solutions + ambiguous cells), **unsat**
(over-constrained — shows a minimal unsatisfiable subset of clues with a verbal
explanation).

---

## Key commands

```bash
npm install          # first time — node_modules not committed
npm run dev          # Vite dev server on http://localhost:5173
npm run server:dev   # Express LLM proxy on :8787 (optional — NL clue path only)
npm test             # Vitest unit + integration + property tests (102 tests)
npm run test:coverage
npm run typecheck    # tsc -b --noEmit (must be clean before committing)
npm run e2e          # Playwright (needs: npx playwright install chromium first)
npm run build        # tsc + vite build → dist/
npm run start        # serve dist/ + /api on :8787 (production)
```

Always run `npm run typecheck && npm test` before committing.

---

## Architecture

```
src/core/          Pure TypeScript — no React, no browser APIs. Runs in Node
                   and the browser (and the Web Worker).
  types.ts           Domain model: Puzzle, Category, Cell, Clue (discriminated
                     union C1–C9), Assignment. §3/§5.1/§5.3/§7.
  validation.ts      validatePuzzle() — rejects ill-formed puzzles before any
                     encoding. Returns ValidationResult with specific errors. §5.1.
  clues/
    context.ts       EncodeContext interface — abstraction the encoder hands to
                     clue handlers (atoms, clause builder).
    handlers.ts      ALL_HANDLERS array: one ClueHandler per clue type. Each
                     handler has: type, describe, encode, validate?, relation?,
                     inferenceRule. Composition seam — no switch(clueType)
                     anywhere in the engine.
    registry.ts      getClueHandler(type) lookup. Single source of truth.
  encoder.ts         encodePuzzle() → Cnf. Builds VarMap (x[c,v,p] variables),
                     implicit bijection clauses (§5.2), one ClueClauseGroup per
                     user clue. All output canonicalised (sorted literals,
                     sorted clauses, deduped). §5.4.
  sat.ts             SatSolver interface + miniSatSolver impl (logic-solver).
  pipeline.ts        solvePuzzle() — validate→encode→solve→classify. §5.5.
  mus.ts             extractMus() — deletion-based MUS algorithm. §5.8.
  inference/
    types.ts         DeductionStep, Explanation, Fact, PositionSnapshot. §5.6.
    state.ts         KnowledgeState — possible-positions bitsets per cell.
    engine.ts        explain() — six rules R1–R6 as strategy objects in a
                     priority list; driver restarts from top after any fire.
                     Oracle (SAT assignment) guides R6 branching. §5.6.
    mus-explain.ts   explainConflict() — simplified propagation over MUS clues
                     to produce a verbal contradiction description. §5.8.
  report.ts          buildReport() — wraps pipeline + explain/explainConflict
                     into a serialisable SolveReport for the worker.
  assignment.ts      decodeAssignment(), ambiguousCells().
  puzzle-index.ts    buildIndex(), cellExists() — fast lookup helpers.

src/worker/
  protocol.ts        SolveRequest / SolveReport discriminated union (all
                     serialisable — crosses the Worker message boundary).
  solver.worker.ts   Web Worker entry: receives puzzle, calls buildReport(),
                     posts result.
  client.ts          solveInWorker() — spawns a fresh worker per solve,
                     enforces the 10 s wall-time timeout. §5.5.

src/store/
  store.ts           Zustand store — puzzle editing actions, solve(), playback
                     cursor (stepIndex), highlight state. Module-level _solveSeq
                     counter guards against stale concurrent solve results.

src/ui/
  TopBar.tsx         Examples menu, JSON import/export, Solve button + status.
                     Import validates via validatePuzzle() before loadPuzzle().
  SetupPane.tsx      Left pane (300 px): category/value editor, mode toggle
                     (structured / NL), clue list with edit/reorder/delete.
  ClueEditor.tsx     Structured clue entry form (all 9 types).
  NLClueEditor.tsx   Natural-language entry: calls /api/parse, shows parse
                     preview, requires Confirm before adding. LLM timeout shows
                     "Switch to structured input" button.
  GridPane.tsx       Centre pane: logic grid (table with scope attrs, no
                     role=grid), playback bar (tabIndex=0, arrow keys work),
                     status banners, side-by-side view for multiple solutions,
                     PNG export.
  DeductionPane.tsx  Right pane (400 px): scrollable step list with rule pills
                     and citation pills; Markdown export.
  export.ts          exportPuzzleJson, exportDeductionMarkdown, exportGridPng
                     (canvas.toBlob wrapped in a proper Promise, errors thrown).
  grid-model.ts      snapshotForStep(), markFor() — pure helpers for grid rendering.
  nl-client.ts       parseNaturalLanguage() — fetch /api/parse with 5 s timeout.

src/examples/
  index.ts           EXAMPLES array: zebra (5×5 hard), easy 3×3, medium 4×4,
                     ambiguous (multiple solutions demo), contradictory (MUS
                     demo). All 5 verified uniquely-solvable (or correctly
                     classified) by integration tests.

server/
  index.js           Express: POST /api/parse (OpenRouter LLM proxy), static
                     dist/ serving, /api/* JSON 404, SPA fallback for non-/api.

tests/
  core/
    encoder.test.ts      ≥3 cases per clue type for exact clause output. §8.1.
    solver.test.ts       ~20 puzzles with known unique/multiple/unsat outcomes.
    inference.test.ts    One puzzle per rule R1–R6; proof-shape invariants.
    mus.test.ts          ≥10 over-constrained puzzles, minimality verified.
    integration.test.ts  5 canned examples end-to-end; ≤30-step check (easy +
                         medium only — zebra ~60 steps, see ASSUMPTIONS §B7).
    property.test.ts     120 random puzzles (seeded), SAT/inference agreement
                         and MUS minimality. §8.4.
    validation.test.ts   Well-formedness edge cases.
    *.smoke.test.ts      Quick sanity passes.
  e2e/
    app.spec.ts          7 Playwright specs: solve+scrub, MUS, ambiguity,
                         ill-formed, clue editing, description field, NL path
                         (mocked). Last 2 need in-browser verification (todo).
```

---

## Design conventions

**Composition over inheritance** is the central architectural choice (see
`docs/COMPOSITION_OVER_INHERITANCE.md`). Concretely:

- Clue behaviour lives in `ClueHandler` objects registered in `registry.ts`,
  not in a `Clue` class hierarchy. The encoder, inference engine, and validator
  all ask the registry — zero `switch(clue.type)` in core logic.
- Inference rules R1–R6 are plain objects `{ id, fire }` in an ordered array
  in `engine.ts`. No base class.
- The SAT solver is an injected interface (`SatSolver`) — tests can swap it.

**Pure core**: `src/core/` has no React/DOM imports. It runs identically in
tests (Node), the Web Worker, and the browser.

**Clue IDs** are 1-indexed, assigned in input order, and reindexed (`reindex()`)
whenever clues are added/removed/reordered. The store manages this — never
mutate clue ids outside the store.

**Position category**: the category whose values are `"1".."n"`. It is implicit
in CNF encoding (no variables for it; `atomFor` returns a constant). Every other
category has exactly `n` values.

---

## Spec deviations and assumptions

All intentional deviations from SPECS.md are recorded in `ASSUMPTIONS.md`.
Key ones to know:

| # | What the spec says | What we do |
|---|-------------------|-----------|
| A1 | Deploy on Vercel | Express server on this machine |
| A3 | Anthropic Claude API (Sonnet) | OpenRouter (configurable model) |
| B3 | `X ≠ Y` means different categories | `X ≠ Y` means different cells (same-category clues needed for zebra) |
| B7 | ≤30 deduction steps for all 5 canned puzzles | Zebra ~60 steps; ≤30 asserted only for easy/medium |
| §8 | | `logic-solver` npm package used instead of `minisat.js` (same MiniSat core) |
| §9 | | R1 rule covers only C3/C4; C5/C6/C8/C9 forced consequences labelled R5 |
| §4 | Tailwind CSS + **shadcn/ui** | Hand-rolled Tailwind only (shadcn/ui not yet retrofitted) |

---

## Open items (from todo.md + spec audit)

### Remaining (not yet fixed)
- **shadcn/ui retrofit** (T1, high spec gap): `npx shadcn@latest init`, add
  Button/Select/Input/Textarea/Tabs/Slider/Card, refactor all 6 UI files.
  Large task — estimate 2-3× the work of everything else combined.
- **E2E verification** (S10): two Playwright tests (`clue editing`,
  `description field`) committed but not confirmed green on a running dev server.
  Run `npx playwright install chromium && npm run e2e` to verify.
- **≥80% test coverage** (§12): `npm run test:coverage` to check current
  baseline; no CI gate enforcing the 80% threshold yet.

### Already fixed (this session)
- H1: JSON import validated before loading; version===1 checked (TopBar.tsx)
- H2: setPositionCategory uses target's n, resizes all categories (store.ts)
- S2: Solve concurrency guard via _solveSeq (store.ts)
- S5: removeCategory/removeValue confirm before pruning clues (store.ts)
- S6: PlaybackBar tabIndex=0 + arrow key preventDefault (GridPane.tsx)
- S7/S8: scope="col"/"row" on headers; dropped role=grid/gridcell (GridPane.tsx)
- PNG export: canvas.toBlob properly awaited + errors surfaced (export.ts)
- S13: /api/* JSON 404; SPA fallback scoped to non-/api (server/index.js)
- S11/M-G: "Switch to structured input" shown on any NL error (NLClueEditor.tsx)
- H-A: renameValue blocks duplicate names within the same category (store.ts)
- H-B: addValue capped at n=8; blocks adding to position category (store.ts)
- H-C: ClueEditor resets local state when edit mode is cancelled (ClueEditor.tsx)
- H-D: LLM clue type validated against VALID_CLUE_TYPES before registry call (nl-client.ts)
- M-B: addCategory capped at 6 categories (store.ts)
- M-C: removeCategory blocked when total would drop below 3 (store.ts)
- M-E: isPosition flag cross-validated against positionCategory in validatePuzzle (validation.ts)
- M-F: CellPicker auto-corrects when referenced category/value is renamed or removed (ClueEditor.tsx)
- M-H: mode toggle now has role=tabpanel + aria-controls/aria-labelledby (SetupPane.tsx)
- M-J: Empty/whitespace-only category names rejected by validatePuzzle (validation.ts)
- dotenv: server reads .env automatically; .env.example committed

---

## Environment notes

- **Shell**: PowerShell on Windows 11. Use `npm run <script>` not bare `tsc`.
- **node_modules**: not committed — always `npm install` first in a fresh checkout.
- **LLM proxy**: set `OPENROUTER_API_KEY` env var before `npm run start` (or
  `npm run server:dev`). Without it, NL clue entry is disabled gracefully; all
  other features work offline.
- **Playwright**: needs `npx playwright install chromium` before first `npm run e2e`.
  Point `webServer` at prod build (port 8787) if the Vite dev server is unstable.
