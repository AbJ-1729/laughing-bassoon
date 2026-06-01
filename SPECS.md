A web application that lets users define logic-grid puzzles (also known as Einstein puzzles or zebra puzzles) by declaring entity categories and a list of clues, then solves the puzzle and presents a **step-by-step human-readable deduction chain** explaining how the solution is derived. Clues can be entered in a structured form or in free-form English, with an LLM-based parser handling natural-language input under user confirmation. The underlying solver translates the puzzle to CNF and uses a SAT solver to obtain and verify the solution; a separate forward-chaining inference engine, guided by the SAT solver's answer, produces the explanation.

The novelty of the project lies not in solving such puzzles (which is mechanical) but in **generating explanations that mirror how a human would reason**, with each step citing the clues and prior deductions that justify it.

---

## 2. Goals and Non-Goals

### 2.1 Goals

1. Let a user define a logic-grid puzzle: declare categories, values per category, and a list of clues.
2. Support clue entry in two modes: (a) **structured** via templates, (b) **natural language** with LLM parsing and explicit user confirmation of the parse.
3. Encode the puzzle into CNF and solve it via a SAT solver.
4. Detect three outcomes: **unique solution**, **multiple solutions** (under-constrained), **no solution** (over-constrained).
5. For uniquely-solvable puzzles, produce a deduction chain in plain English where each step:
    - States a newly derived fact;
    - Cites the clue numbers and prior step numbers it depends on;
    - Highlights the affected cells in the grid view.
6. Allow the user to step forward and backward through the deduction chain with synchronized grid highlighting.
7. For over-constrained puzzles, return a **minimal unsatisfiable subset (MUS)** of clues — the smallest subset that is still contradictory — and explain it.
8. For under-constrained puzzles, report which cells are not uniquely determined and show at least two distinct satisfying assignments.

### 2.2 Non-Goals

1. Solving non-bijective puzzles (where categories have different cardinalities). The system assumes all categories have exactly the same number of values, paired bijectively.
2. Supporting clue types beyond the fixed list defined in §5.3.
3. Multilingual input. English only.
4. Real-time collaboration. The app is single-user, single-session.
5. Persistent user accounts. Puzzles can be saved/loaded as JSON files, but no server-side user database.
6. Mobile-first UI. Desktop is primary; the layout must be usable on tablet (≥768px) but is not optimized for phones.
7. Generating new puzzles algorithmically. Out of scope; only solving and explaining.

---

## 3. Terminology

- **Category**: an axis of the puzzle (e.g., `Nationality`, `Color`, `Position`).
- **Value**: an element of a category's domain (e.g., `Norwegian`, `red`, `1`).
- **Position category** (mandatory): the category whose values are integers `1..n`, used for ordering and adjacency clues. Every puzzle must declare exactly one position category.
- **Cell**: a (category, value) pair, e.g., (Nationality, Norwegian).
- **Assignment**: a mapping from each (category, value) to a position. The puzzle is solved when this mapping is determined.
- **Clue**: a constraint over assignments, drawn from the supported clue types in §5.3.
- **Deduction step**: a single English sentence in the explanation chain, with structured metadata indicating its rule type, supporting clue/step references, and affected cells.

---

## 4. Tech Stack

| Layer | Choice | Rationale |
| --- | --- | --- |
| Frontend | React + TypeScript + Vite | Standard SPA setup; strong types catch encoding bugs. |
| UI styling | Tailwind CSS + shadcn/ui | Fast to build, looks professional out of the box. |
| State management | Zustand | Lightweight; sufficient for single-user app. |
| SAT solver | `minisat.js` (Emscripten-compiled MiniSat) running in a Web Worker | Real industrial solver, no server dependency, off-main-thread. |
| MUS extraction | Custom implementation of the deletion-based MUS algorithm on top of MiniSat | Standard and well-understood; ~80 lines. |
| Inference engine | Custom TypeScript, runs in main thread | Tight integration with explanation generator. |
| NL clue parser | Anthropic Claude API (Sonnet) via lightweight Node proxy | Robust for varied phrasings; user always confirms the parse. |
| Backend | Single Node/Express endpoint, proxy for LLM only | No DB, no auth. |
| Deployment | Vercel (frontend + serverless function for LLM proxy) | Fast, free tier. |
| Testing | Vitest for unit tests, Playwright for end-to-end | Industry standard for this stack. |

The system **must function fully offline** when natural-language input is not used. Structured input, encoding, solving, MUS extraction, and explanation generation all run client-side.

---

## 5. Functional Specification

### 5.1 Puzzle Schema

A puzzle is defined by:

1. **Categories.** A list of 3 to 6 categories. Exactly one must be designated the **position category** with integer values `1..n`. All other categories must have exactly `n` values (string labels, case-sensitive, unique within a category).
2. **Clues.** An ordered list of 0 to 50 clues, each one of the types in §5.3.
3. **Metadata.** Puzzle title (optional, ≤100 chars) and description (optional, ≤500 chars).

A puzzle is **well-formed** iff:

- It has a position category.
- All non-position categories have exactly `n` values.
- `n ∈ [3, 8]`.
- All clue arguments reference declared (category, value) pairs.

The app must reject ill-formed puzzles at the schema-validation layer before any solving is attempted, with an error message identifying the specific violation.

### 5.2 Implicit Constraints (Always Present)

For each non-position category `c`:

- Every value in `c` is assigned to **exactly one** position.
- Every position has **exactly one** value from `c`.

These are encoded automatically and do not need to be stated as clues.

### 5.3 Supported Clue Types

The system supports **exactly** the following 9 clue types. No others. The structured clue editor exposes these; the LLM parser must map natural language onto exactly these types and reject anything outside the list.

| ID | Name | Structured form | Semantics |
| --- | --- | --- | --- |
| C1 | Equality | `X is Y` | The entity with attribute X also has attribute Y. (Same position.) |
| C2 | Inequality | `X is not Y` | The entity with X does not have Y. |
| C3 | At position | `X is at position k` | X is at the specified integer position. |
| C4 | Not at position | `X is not at position k` | X is not at the specified position. |
| C5 | Immediately left of | `X is immediately left of Y` | position(X) + 1 = position(Y). |
| C6 | Immediately right of | `X is immediately right of Y` | position(X) − 1 = position(Y). |
| C7 | Next to | `X is next to Y` | |position(X) − position(Y)| = 1. |
| C8 | Somewhere left of | `X is somewhere left of Y` | position(X) < position(Y). |
| C9 | Somewhere right of | `X is somewhere right of Y` | position(X) > position(Y). |

Where `X` and `Y` are each (category, value) references, and `X ≠ Y` (different categories — comparing a value to itself is rejected at validation).

Each clue carries a stable integer `id` (1-indexed, assigned in input order) used in explanation citations.

### 5.4 CNF Encoding

**Variables.** For each (category `c`, value `v`, position `p`), introduce a boolean variable `x[c,v,p]` meaning "the entity at position `p` has value `v` for category `c`." Total: `n × (k−1) × n` variables where `k` is the number of categories (the position category itself is implicit since position = position).

**Implicit constraints (per non-position category `c`):**

For each value `v` in `c`:

- **At least one position:** clause `(x[c,v,1] ∨ x[c,v,2] ∨ ... ∨ x[c,v,n])`.
- **At most one position:** for each pair `p1 < p2`, clause `(¬x[c,v,p1] ∨ ¬x[c,v,p2])`.

For each position `p`:

- **At least one value:** clause `(x[c,v1,p] ∨ ... ∨ x[c,vn,p])`.
- **At most one value:** for each pair `v1 ≠ v2`, clause `(¬x[c,v1,p] ∨ ¬x[c,v2,p])`.

**Clue encoding** (let `X = (cX, vX)` and `Y = (cY, vY)`):

- **C1 (X is Y):** for each `p`, `(¬x[cX,vX,p] ∨ x[cY,vY,p])` and `(x[cX,vX,p] ∨ ¬x[cY,vY,p])`.
- **C2 (X is not Y):** for each `p`, `(¬x[cX,vX,p] ∨ ¬x[cY,vY,p])`.
- **C3 (X at position k):** unit clause `x[cX,vX,k]`. (If `cX` is the position category, this is a tautology or contradiction and resolved at parse time.)
- **C4 (X not at position k):** unit clause `¬x[cX,vX,k]`.
- **C5 (X immediately left of Y):** for each `p ∈ [1, n−1]`, `(¬x[cX,vX,p] ∨ x[cY,vY,p+1])`. Additionally `¬x[cX,vX,n]` (X cannot be at the last position).
- **C6:** symmetric to C5.
- **C7 (X next to Y):** for each `p`, `(¬x[cX,vX,p] ∨ x[cY,vY,p−1] ∨ x[cY,vY,p+1])` (with out-of-range literals omitted; if both omitted, clause becomes unit `¬x[cX,vX,p]`).
- **C8 (X somewhere left of Y):** for each `p`, `(¬x[cX,vX,p] ∨ x[cY,vY,p+1] ∨ ... ∨ x[cY,vY,n])`. Also `¬x[cX,vX,n]`.
- **C9:** symmetric to C8.

The encoder must emit clauses in a canonical order (sorted by variable indices within a clause, clauses sorted lexicographically) for reproducible output and easier testing.

### 5.5 Solving Pipeline

Given a well-formed puzzle:

1. Encode to CNF as specified in §5.4.
2. Run MiniSat to find a satisfying assignment. If UNSAT, go to step 5.
3. Add the negation of the found assignment as a blocking clause; re-solve.
    - If UNSAT, the puzzle has a **unique solution**. Proceed to explanation (§5.6).
    - If SAT, the puzzle is **under-constrained**. Save both assignments and report (§5.7).
4. (Reached only if unique solution found.) Pass the puzzle and the known solution to the inference engine to generate the deduction chain.
5. (UNSAT case.) Run MUS extraction over the clue-derived clauses (implicit constraints are never removed) to find a minimal unsatisfiable subset. Report (§5.8).

All solving must occur in a Web Worker. The UI must remain responsive and show a progress indicator. Solving must time out and report failure after **10 seconds** of wall time; in practice all puzzles within the spec's size limits solve in <100 ms.

### 5.6 Inference Engine and Explanation Generation

This is the central component. The engine maintains a **knowledge state**:

- For each cell `(c, v)`, a set of **possible positions** (initially `{1..n}`).
- For each `(category, position)` pair, a set of **possible values**.

The engine applies inference rules in priority order until a fixed point is reached, then branches if necessary. Every rule application produces a **deduction step** with structured metadata.

**Rule priority (apply highest first; restart from top after any rule fires):**

1. **R1 — Direct assignment from clue.** A C3 clue immediately places a value. A C5 clue with X at position 1 forces Y at position 2, etc.
2. **R2 — Bijection elimination.** When a cell's possible positions reduce to a singleton, eliminate that position from all other cells in the same category; symmetrically for positions with a single possible value.
3. **R3 — Constraint propagation.** For each unsatisfied clue, recompute the implication given current state. E.g., for C7 ("X next to Y"), intersect the set of positions of X with the neighborhood of Y's possible positions; if either side narrows, update.
4. **R4 — Pair elimination via C1/C2.** If `X is Y` (C1) and X's possible positions are `{1, 3}`, then Y's possible positions become `{1, 3}` intersected with its previous set.
5. **R5 — Ordering elimination (C5, C6, C8, C9).** A C8 ("X left of Y") implies X cannot be at position n, Y cannot be at position 1; tighter bounds propagate as positions are pinned down.
6. **R6 — Case analysis (branching).** When no other rule fires and the puzzle is not solved, pick the cell with the fewest possible positions (≥2), branch on each. Use the SAT solver's known solution as an oracle to **choose the correct branch first**, avoiding visible backtracking in the explanation.

**Termination guarantee:** because the puzzle has a unique solution (verified by SAT in §5.5), the engine is guaranteed to converge. The oracle ensures branching never produces dead ends in the output narrative.

**Each deduction step has the following structure:**

```tsx
type DeductionStep = {
  stepNumber: number;
  rule: 'R1' | 'R2' | 'R3' | 'R4' | 'R5' | 'R6';
  englishSentence: string;
  citedClues: number[];        // clue IDs this step depends on
  citedSteps: number[];        // prior step numbers this step depends on
  affectedCells: Cell[];       // cells whose possibilities changed
  newFacts: Fact[];            // e.g., "Nationality.Norwegian = position 1"
};
```

**English templates** (one per rule, parameterized; examples):

- R1: "From clue {clueId}, {valueA} is at position {p}."
- R2: "Since {valueA} is at position {p} (step {stepId}), no other {category} can be at position {p}."
- R3: "From clue {clueId} and step {stepId}, {valueA} must be at position {p}."
- R6: "Try assuming {valueA} is at position {p}." (Only fires when the SAT oracle confirms this branch is correct.)

The explanation must be a **complete proof**: applied in sequence, the deduction steps must take the empty knowledge state to the full solution, with every step justified.

### 5.7 Under-Constrained Puzzles

When two satisfying assignments exist, the system reports:

- Which cells differ between the two assignments (these are "ambiguous").
- Both assignments shown side-by-side in a grid.
- A suggestion: "Add a clue to disambiguate. Cells X and Y are ambiguous."

No deduction chain is generated for under-constrained puzzles.

### 5.8 Over-Constrained Puzzles (MUS)

When the SAT instance is UNSAT, run MUS extraction:

1. Start with the set of all user clues.
2. For each clue `c` in the set, try removing it and re-solving (with implicit constraints still in place).
3. If the reduced instance is still UNSAT, `c` is not needed for the contradiction — remove it permanently.
4. Otherwise, keep `c`. Move to the next clue.
5. The resulting set is a minimal unsatisfiable subset.

Display the MUS to the user with the message: "These clues together are contradictory: clue {ids}. Removing any one of them resolves the contradiction." A short paragraph attempts to verbally explain the conflict by walking the user through how the clues interact (using a simplified version of the inference engine that propagates the MUS clues and surfaces the contradiction).

### 5.9 Natural-Language Clue Input (LLM Path)

When the user types free-form English:

1. Frontend sends the text plus the puzzle's category/value schema to a Node serverless endpoint.
2. The endpoint calls Claude with a structured prompt instructing it to output a JSON object matching one of the 9 clue types in §5.3, or `{"error": "..."}` if unmappable.
3. The frontend **displays the parsed structured form** ("Interpreted as: *the Norwegian is at position 1*") and requires the user to confirm with a button before the clue is added.
4. The LLM never adds clues directly. The structured form is the source of truth; the NL text is stored only as a display label.
5. If the LLM returns an error or a malformed object, the UI tells the user "Couldn't parse this — try rephrasing or use structured input."

The LLM is a convenience layer. The system is fully usable without it.

---

## 6. User Interface

### 6.1 Layout

A three-pane desktop layout:

- **Left pane (300px):** Puzzle setup. Category editor (add/remove/rename categories, add/remove/rename values). Clue list with add/edit/delete/reorder. Solve button.
- **Center pane (flexible):** Grid view. Standard logic-grid representation: an `n × (k−1)n` matrix of cells, each showing ✓ (forced true), ✗ (forced false), or `?` (unknown). Pinned values shown bolder.
- **Right pane (400px):** Deduction chain. Scrollable list of steps with step number, English sentence, and small "from clue X" / "from step Y" pills. Clicking a step highlights its affected cells in the center pane.

### 6.2 Controls

- **Step playback bar** above the grid: ⏮ ◀ ▶ ⏭ buttons, plus a slider, to scrub through the deduction chain. Grid updates to show the knowledge state *as of* the selected step.
- **Mode toggle**: "Structured" / "Natural language" for clue entry.
- **Export**: download the puzzle as JSON, the deduction chain as Markdown, or the grid as PNG.
- **Examples menu**: load 5 canned puzzles (Einstein's classic zebra, plus 4 of varying difficulty).

### 6.3 Visual Feedback

- While solving: spinner with text "Solving…" (typically <100 ms, but UI must handle the 10-second timeout gracefully).
- Solved: green check on the solve button, deduction chain populates.
- Under-constrained: yellow warning, both solutions displayed.
- Over-constrained: red banner, MUS displayed.

### 6.4 Accessibility

- Full keyboard navigation: tab order covers all interactive elements.
- ARIA labels on grid cells indicating (category, value, state).
- Color is never the sole carrier of information (✓/✗/? symbols accompany color).
- Step playback works with arrow keys when focused.

---

## 7. Data Model (Persistent Format)

Puzzles are exportable/importable as JSON:

```json
{
  "version": 1,
  "title": "Einstein's Riddle",
  "description": "...",
  "positionCategory": "House",
  "categories": [
    { "name": "House", "values": ["1","2","3","4","5"], "isPosition": true },
    { "name": "Nationality", "values": ["Brit","Swede","Dane","Norwegian","German"] },
    ...
  ],
  "clues": [
    { "id": 1, "type": "C1", "x": {"category":"Nationality","value":"Brit"}, "y": {"category":"Color","value":"Red"}, "naturalLanguage": "The Brit lives in the red house." },
    ...
  ]
}
```

The schema is versioned to allow future format changes.

---

## 8. Testing Strategy

### 8.1 Unit Tests (Vitest)

- **Encoder tests:** for each of the 9 clue types, assert the exact clauses generated for a small example. ≥3 cases per clue type.
- **Solver tests:** 20 puzzles with known unique solutions, assert the solver returns the correct assignment.
- **Inference engine tests:** for each rule R1–R6, a minimal puzzle that exercises only that rule, asserting the expected step is produced.
- **MUS tests:** 10 over-constrained puzzles with known minimal cores.

### 8.2 Integration Tests (Vitest)

- 5 canned puzzles (including Einstein's classic) solved end-to-end, asserting the deduction chain has ≤30 steps and every step's `citedClues`/`citedSteps` references resolve correctly.

### 8.3 End-to-End Tests (Playwright)

- User flow: define a 4×4 puzzle, add clues, solve, scrub through deduction chain.
- LLM path: enter natural-language clue, confirm parse, verify it's added.
- Error paths: ill-formed puzzle rejected; over-constrained puzzle shows MUS.

### 8.4 Property-Based Tests

- Generate random small puzzles (n ∈ {3,4,5}) with random clue subsets, verify: if SAT says unique, the inference engine's final state equals the SAT assignment; if SAT says UNSAT, MUS is indeed unsatisfiable and removing any clue from MUS makes it SAT.

A test is considered passing only if assertions hold on all generated inputs (≥100 per test, fixed seed for reproducibility).

---

## 9. Performance Requirements

- Puzzles up to `n=6` with up to 50 clues must solve and explain in ≤500 ms on a modern laptop (Apple Silicon or equivalent).
- The UI must remain responsive (60 fps) during solving (enforced via Web Worker offloading).
- Memory usage must stay under 100 MB for any puzzle within spec limits.
- LLM clue parsing must return within 5 seconds; if not, show timeout error and offer structured fallback.

---

## 11. Risks and Mitigations

| Risk | Likelihood | Impact | Mitigation |
| --- | --- | --- | --- |
| Inference engine produces ugly or non-minimal explanations | Medium | High (core feature) | Oracle-guided branching + tunable rule priority; manually inspect output on 5 canonical puzzles and iterate. |
| LLM misinterprets ambiguous clues | High | Low | User must confirm every parse; structured form is source of truth. |
| MUS extraction slow on large UNSAT instances | Low | Medium | Spec limits puzzles to n≤8, 50 clues; deletion-based MUS is fast at this scale. |
| Browser SAT solver bundle size | Low | Low | MiniSat WASM is ~150 KB; acceptable. |
| Scope creep into puzzle generation | Medium | Medium | Explicit non-goal (§2.2); enforce at planning gate end of week 2. |

---

## 12. Deliverables

The project will produce:

1. A deployed web application at a public URL.
2. A public Git repository with full source, README, and contribution notes.
3. A 2-minute demo video walking through (a) Einstein's puzzle solved end-to-end, (b) under-constrained example, (c) over-constrained example with MUS, (d) natural-language input.
4. Test suite with ≥80% line coverage on encoder, solver wrapper, and inference engine.
