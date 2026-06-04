# Logic-Grid Puzzle Solver

A web application that lets you define logic-grid puzzles (a.k.a. Einstein /
zebra puzzles) by declaring entity categories and clues, then **solves the
puzzle and explains the solution as a step-by-step, human-readable deduction
chain** — each step citing the clues and prior deductions that justify it.

The novelty is not solving (that's mechanical) but **generating explanations
that mirror how a human reasons**. A SAT solver finds and verifies the unique
solution; a separate forward-chaining inference engine, guided by the SAT
answer as an oracle, produces the narrative.

![Einstein's zebra puzzle solved](docs/screenshot-zebra-solved.png)

## Features

- Define puzzles: 3–6 categories, one mandatory position category, `n ∈ [3,8]`.
- Two clue-entry modes: **structured** templates and **natural language**
  (LLM-parsed, with explicit user confirmation of every parse).
- Exactly the **9 supported clue types** (equality, inequality, at/not-at
  position, immediately/somewhere left/right of, next to).
- Three outcomes detected: **unique**, **under-constrained** (shows two
  solutions + ambiguous cells), **over-constrained** (shows a **minimal
  unsatisfiable subset** of clues with a verbal explanation).
- **Step playback**: scrub the deduction chain forwards/backwards with
  synchronized grid highlighting (mouse, slider, or arrow keys).
- Export: puzzle as JSON, deduction chain as Markdown, grid as PNG.
- 5 built-in examples including Einstein's classic zebra puzzle.
- Fully **offline-capable** — only the optional natural-language path needs a
  network/LLM.

## Architecture

```
src/core/        Pure, UI-free solving core (runs in Node and the browser)
  types.ts            Domain model (puzzles, clues as a discriminated union)
  validation.ts       Well-formedness checks (§5.1)
  clues/              Clue handler registry — composition seam (§5.3/§5.4/§5.6)
  encoder.ts          CNF encoding with canonical ordering (§5.4)
  sat.ts              SatSolver interface + MiniSat (logic-solver) impl (§5.5)
  pipeline.ts         validate → encode → solve → classify (§5.5)
  mus.ts              Deletion-based MUS extraction (§5.8)
  inference/          Knowledge state + rules R1–R6 + explanation (§5.6)
  report.ts           Pure pipeline → serialisable report
src/worker/      Web Worker transport + 10s timeout (§5.5)
src/store/       Zustand app state
src/ui/          React components (three-pane layout, §6)
src/examples/    Canned puzzles (§6.2)
server/          Express LLM proxy + static serving (§5.9, deploy)
tests/           Vitest unit/integration/property + Playwright e2e (§8)
docs/            COMPOSITION_OVER_INHERITANCE.md (presentation notes) + assets
```

The codebase deliberately favours **composition over inheritance** throughout
(clue behaviours as composed handler objects in a registry; inference rules as
strategy objects; the SAT solver behind an injected interface). See
[`docs/COMPOSITION_OVER_INHERITANCE.md`](docs/COMPOSITION_OVER_INHERITANCE.md).

## Tech stack

React + TypeScript + Vite · Tailwind CSS · Zustand · `logic-solver`
(Emscripten-compiled MiniSat) in a Web Worker · Express LLM proxy · Vitest +
Playwright.

## Running locally

### Prerequisites

- **Node.js 18+** and **npm** (check: `node -v && npm -v`)
- Run once after cloning: `npm install`

---

### Mode 1 — Development (hot reload, two terminals)

Use this when actively changing code. Vite serves the frontend with instant
hot-module replacement; the Express proxy is only needed if you want the
natural-language clue input.

**Terminal 1 — frontend (required)**

```bash
npm run dev
# → http://localhost:5173
```

**Terminal 2 — LLM proxy (optional)**

Only needed for the "Natural language" clue-entry mode. Without it the app
works fully; the NL button is simply disabled.

1. Copy `.env.example` to `.env` and paste your key (get one free at
   [openrouter.ai/keys](https://openrouter.ai/keys)):

```bash
# .env  (gitignored — never commit this file)
OPENROUTER_API_KEY=sk-or-v1-...
OPENROUTER_MODEL=anthropic/claude-sonnet-4.6   # default (per SPECS §4); use anthropic/claude-3.5-haiku to cut cost
```

2. Start the proxy — it picks up `.env` automatically:

```bash
npm run server:dev
# → proxy listening on http://localhost:8787/api/parse
# Vite (port 5173) proxies /api/* to :8787 automatically via vite.config.ts
```

---

### Mode 2 — Production build (single server, one terminal)

Use this to run the app exactly as it is deployed: the Express server serves
the compiled static bundle **and** hosts the `/api/parse` endpoint on one port.

```bash
npm run build   # compiles TypeScript + Vite → dist/
npm run start   # reads .env automatically → http://localhost:8787
```

For a long-lived deployment wrap with a process manager:

```bash
# pm2
pm2 start "npm run start" --name logic-grid

# nohup
nohup npm run start &

# systemd — create a unit file pointing to `npm run start`
```

---

### Quick-reference: all commands

| Command | What it does | URL |
|---------|-------------|-----|
| `npm run dev` | Vite dev server with HMR | http://localhost:5173 |
| `npm run server:dev` | Express LLM proxy (watch mode) | http://localhost:8787 |
| `npm run build` | TypeScript + Vite production build → `dist/` | — |
| `npm run start` | Express serves `dist/` + `/api` | http://localhost:8787 |
| `npm test` | Vitest unit + integration + property tests | — |
| `npm run test:coverage` | Same + coverage report | — |
| `npm run typecheck` | TypeScript type check (no emit) | — |
| `npm run e2e` | Playwright end-to-end (see below) | — |

---

## Test

```bash
npm test                        # Vitest: 102 unit/integration/property tests
npm run test:coverage           # same + coverage report in coverage/
npm run typecheck               # must be clean — run before committing

# Playwright e2e (needs Chromium installed once):
npx playwright install chromium
npm run e2e                     # runs against the dev server (see playwright.config.ts)
```

## Data format

Puzzles import/export as versioned JSON; see §7 of `SPECS.md` and the examples
in `src/examples/`.
