# Software Development Principles in this Codebase

This document maps the engineering principles the project was built on to the
**actual code** that embodies them, with `file:line`-style citations. It
complements [`COMPOSITION_OVER_INHERITANCE.md`](COMPOSITION_OVER_INHERITANCE.md),
which is the deep-dive (and presentation material) on the headline principle.

---

## 1. Composition over Inheritance (the headline principle)

Behaviour is assembled from small, focused parts rather than extended through
class hierarchies. There is **no `Clue` base class with nine subclasses** and
**no `Rule` base class** — instead:

| Seam | Where | What it replaces |
| --- | --- | --- |
| **Clue handler registry** | `src/core/clues/handlers.ts`, `registry.ts` | A `Clue` superclass with `encode()/validate()/describe()` overridden per subtype. Each clue type is a plain object of functions; callers look it up by tag. |
| **Inference rules as strategy objects** | `src/core/inference/engine.ts` (`RULES` array) | A `Rule` base class. R1–R6 are independent objects in a priority-ordered list; the driver tries each. R3/R4/R5 are *one* parameterised function delegating to `handler.relation` — no `switch (clueType)`. |
| **SAT solver behind an injected interface** | `src/core/sat.ts` (`SatSolver`), injected in `pipeline.ts`, `mus.ts`, `report.ts` | A solver subclass tree. The concrete MiniSat impl is passed in as a default parameter and is swappable. |
| **`EncodeContext` seam** | `src/core/clues/context.ts` | The encoder owns variable numbering and constant-folding; handlers own *meaning* and compose against the interface. |
| **Data + functions, not stateful objects** | `src/core/types.ts` (clues are a discriminated union) | Clues are serialisable plain data (§7 JSON), with behaviour kept separate. |

**Payoff:** adding a clue behaviour = add a field to a handler object; swapping
the solver = implement an interface; testing a rule = call a function. None of
these touch a class tree. See the companion doc for ❌/✅ code sketches.

> Honest scope: `KnowledgeState` (`inference/state.ts`) and `MiniSatIncremental`
> (`sat.ts`) *are* classes — but they are used **by composition** (held and
> called), never subclassed. Classes-as-containers are fine; it's inheritance
> for polymorphism we avoided.

---

## 2. Functional Core, Imperative Shell

`src/core/**` is **pure and I/O-free**: it runs identically in Node (tests) and
the browser (worker). All effects live at the edges:

- Pure core: `encoder.ts`, `pipeline.ts`, `mus.ts`, `inference/*`, `report.ts`.
- Imperative shell: `src/worker/*` (threading/timeout), `src/store/*` (mutable
  app state), `src/ui/*` (DOM), `server/index.js` (network).

This is why `buildReport()` (`core/report.ts`) can be unit-tested synchronously
and *also* reused verbatim inside the Web Worker (`solver.worker.ts`).

---

## 3. Dependency Inversion & Injection

High-level policy (`solvePuzzle`, `extractMus`, `buildReport`) depends on the
`SatSolver` **abstraction**, never on `logic-solver` directly
(`pipeline.ts:53`, `mus.ts:34`, `report.ts:19`; interface at `sat.ts:30`). The concrete solver is a
default argument, so production wiring is zero-ceremony while tests can inject a
double. The same inversion lets all solving move off-thread without the core
knowing a worker exists.

---

## 4. Single Responsibility & Acyclic Dependencies

Each module has one job (validation, encoding, solving, MUS, inference,
reporting). When the validator and the clue handlers both needed the cell index
and error type, that shared piece was **extracted into `puzzle-index.ts`** to
break a `validation → registry → handlers → validation` cycle — a deliberate
refactor toward acyclic, one-directional dependencies (see the header comment in
`puzzle-index.ts`).

---

## 5. Fail Fast, with Specific Errors

Ill-formed puzzles are rejected at the schema layer **before any solving**
(`validation.ts`), and every violation carries a stable `code` and a
human-readable `message` identifying the exact problem (§5.1). The UI surfaces
these directly (`DeductionPane` invalid branch).

---

## 6. Determinism & Reproducibility

- The CNF encoder emits clauses in a **canonical order** (literals sorted within
  a clause, clauses sorted lexicographically, duplicates removed) so output is
  byte-stable and testable (`encoder.ts` `canonicalize`).
- Property-based tests use a **seeded PRNG** (`tests/core/property.test.ts`,
  mulberry32) so 120 random puzzles reproduce identically each run.
- Tests run in a **single fork** (`vitest.config.ts`) because the MiniSat WASM
  module carries global state unsafe across parallel worker threads —
  determinism over raw speed.

---

## 7. Extreme Programming (XP) practices

- **Comprehensive automated testing, at every level (§8):** unit
  (`encoder/validation/solver/inference/mus`), integration (`integration.test.ts`,
  the 5 canned puzzles end-to-end), **property-based** (random puzzles checked
  against invariants), and **end-to-end** (Playwright, real browser). ~93.8%
  line coverage on the core (§12.4 target was 80%).
- **The SAT solver as a test oracle:** the property tests assert that the
  hand-written inference engine's final state equals the independent SAT
  solver's answer (§8.4) — two independent implementations cross-checking each
  other, a powerful correctness technique.
- **Small, frequent, reviewable commits:** the history is a sequence of focused,
  buildable commits (scaffold → core → inference → worker → examples → UI →
  tests → docs), each green — continuous-integration discipline and easy review,
  exactly as requested.
- **YAGNI / Simple Design:** exactly the **9** clue types are implemented and no
  more (§5.3); the explicit non-goals (puzzle generation, accounts, i18n) are
  respected rather than speculatively built.
- **Refactor mercilessly but safely:** e.g. the `puzzle-index.ts` extraction and
  the `buildReport` pure-function factoring were done with the test suite green
  at each step.
- **Readable, intention-revealing code:** module/function headers cite the spec
  section they implement, so a reader can trace code ↔ requirement.

---

## 8. Robust Boundaries & Graceful Degradation

- **Off-main-thread + hard timeout:** solving runs in a Web Worker with a
  10-second wall-time cap enforced by terminating the worker
  (`worker/client.ts`), keeping the UI responsive (§5.5, §9).
- **LLM is a convenience layer, never authoritative:** the natural-language path
  requires explicit user confirmation, validates the parse against the schema
  before offering it, and the **structured form is the source of truth**
  (`NLClueEditor.tsx`, §5.9). The app is fully usable offline; a missing API key
  degrades to a friendly message, not a crash (`server/index.js`, `nl-client.ts`).

---

## 9. Type Safety as Design

Strict TypeScript throughout. Clues are a **discriminated union**
(`BinaryClue | PositionalClue`) with type guards (`isBinaryClue`,
`isPositionalClue`), so the compiler enforces that positional clues carry `k`
and binary clues carry `y`. The `SolveResult`/`SolveReport` unions make every
outcome (unique / multiple / unsat / invalid / timeout / error) explicit and
exhaustively handled in the UI.

---

### Summary

The architecture is a **pure functional core** wrapped in a thin imperative
shell, with **composition** (registries, strategy objects, injected interfaces)
used wherever a class hierarchy would otherwise appear, and **XP-style testing
and small commits** keeping it correct and reviewable. The single most important
idea — composition over inheritance — is detailed with code sketches in
[`COMPOSITION_OVER_INHERITANCE.md`](COMPOSITION_OVER_INHERITANCE.md).
