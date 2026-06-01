# Composition over Inheritance — where we used it

> Speaker notes / slide content for the Friday presentation.
> Every claim below is grounded in the actual source, cited as `file:line`.

## TL;DR

**Composition over inheritance** means building behaviour by *assembling small, focused
parts* — plain data, standalone functions, strategy objects, injected dependencies,
lookup registries — instead of *extending base classes* and pushing variation down a
subclass tree. The payoff is that adding or changing a behaviour means adding a part
(a field, an object, an implementation of an interface) rather than editing a class
hierarchy that every caller is coupled to. This logic-grid solver leans on that
principle in four load-bearing places: the nine clue types, the CNF encoding seam, the
inference rule set, and the SAT-solver boundary.

---

## Slide 1: Clues are data + handler objects, not a `Clue` class tree

**The problem.** There are nine clue types (C1–C9): equality, inequality, at/not-at
position, immediately/somewhere left/right, next-to. Each needs an English rendering, a
CNF encoding, sometimes a validation check, and sometimes an inference relation. The
"obvious" OO move is one base class with nine subclasses.

**❌ The inheritance design we avoided:**

```ts
abstract class Clue {
  abstract describe(): string;
  abstract encode(ctx: EncodeContext): Clause[];
  validate(index: PuzzleIndex): ValidationError[] { return []; }
}
class EqualityClue extends Clue { /* C1 ... */ }
class InequalityClue extends Clue { /* C2 ... */ }
class AtPositionClue extends Clue { /* C3 ... */ }
// ...six more subclasses, behaviour entangled with the data
```

This welds data to behaviour: clues can no longer be plain serialisable JSON, and adding
a *new* behaviour (say an SMT exporter) means touching all nine subclasses.

**✅ What we did.** Clues are a plain discriminated union of data
(`src/core/types.ts:53-66`), and behaviour lives in standalone **handler objects** keyed
by the `type` tag. The handler shape is small and flat
(`src/core/clues/handlers.ts:15-33`):

```ts
export interface ClueHandler {
  readonly type: Clue['type'];
  readonly name: string;
  describe(clue: Clue): string;
  encode(clue: Clue, ctx: EncodeContext): Clause[];
  validate?(clue: Clue, index: PuzzleIndex): ValidationError[];
  relation?(positionX: number, positionY: number): boolean;
  readonly inferenceRule?: 'R3' | 'R4' | 'R5';
}
```

Each clue type is one object composed of those functions, e.g. equality
(`src/core/clues/handlers.ts:55-67`):

```ts
const C1: ClueHandler = {
  type: 'C1',
  name: 'Equality',
  inferenceRule: 'R4',
  relation: (px, py) => px === py,
  describe: (c) => `${label(vx(c))} is ${label(vy(c))}.`,
  encode: (c, ctx) =>
    forEachPosition(ctx.n, (p) => [
      ctx.clause([ctx.notAt(vx(c), p), ctx.at(vy(c), p)]),
      ctx.clause([ctx.at(vx(c), p), ctx.notAt(vy(c), p)]),
    ]),
};
```

The nine handlers are collected in one array (`src/core/clues/handlers.ts:227-237`).

**Payoff.** Adding a behaviour = add an *optional field* to one interface and fill it in
on nine objects, with the compiler listing every gap. Notice `relation`,
`inferenceRule`, and `validate` are optional — C3/C4 simply omit `relation`, C1/C2/C5–C9
omit `validate`. No base class forces a no-op override. And because clues stay plain
data, they serialise to JSON for free.

**Speaker notes:**
- "We have nine clue types. The textbook answer is a base class and nine subclasses. We
  deliberately didn't do that."
- "Instead a clue is just data — a tagged union — and its behaviour is a small object of
  functions we look up by tag."
- "Adding a new capability is adding one optional field, not editing nine subclasses.
  And the data stays serialisable, which matters for save/load."

---

## Slide 2: The registry — the composition seam that replaces the class tree

**The problem.** Four different callers — the validator, the encoder, the inference
engine, the UI — all need clue behaviour. With subclasses they'd each hold `Clue`
references and rely on virtual dispatch, scattering the coupling everywhere.

**❌ The inheritance design we avoided:** callers hold `Clue` base references and call
`clue.encode(...)`; every caller is transitively coupled to the whole subclass tree, and
a new clue type risks touching all of them.

**✅ What we did.** A single registry maps a clue's `type` tag to its handler
(`src/core/clues/registry.ts:13-24`):

```ts
const REGISTRY: ReadonlyMap<ClueType, ClueHandler> = new Map(
  ALL_HANDLERS.map((h) => [h.type as ClueType, h]),
);

export function getClueHandler(type: ClueType): ClueHandler {
  const handler = REGISTRY.get(type);
  if (!handler) throw new Error(`Unsupported clue type: ${type}`);
  return handler;
}
```

Callers ask the registry and invoke the one behaviour they need — the encoder calls
`getClueHandler(clue.type).encode(...)` (`src/core/encoder.ts:199-202`), and the engine
calls `getClueHandler(clue.type).describe(...)` / `.relation` (`engine.ts:184-186`,
`engine.ts:236-239`).

**Payoff.** The class hierarchy is replaced by one lookup table. A new clue type
registers in exactly one place (the `ALL_HANDLERS` array) and every caller picks it up
for free — no `switch`, no caller edits.

**Speaker notes:**
- "The registry is the seam. It's the thing that replaces inheritance's virtual
  dispatch."
- "Four subsystems use clue behaviour; none of them know about the concrete types. They
  ask the registry."
- "One array is the single source of truth for 'what clue types exist.'"

---

## Slide 3: The `EncodeContext` seam — handlers own *meaning*, the encoder owns *mechanism*

**The problem.** Encoding a clue to CNF needs two things a clue handler shouldn't care
about: variable numbering, and the fact that the position axis has no variables at all
("X at position p" is sometimes a boolean *constant*, not a variable). Baking that into
each handler would duplicate it nine times and couple clue semantics to the variable
layout.

**❌ The inheritance design we avoided:** a `Clue.encode()` that computes its own variable
indices and special-cases the position category inline — the same numbering logic copied
into every subclass.

**✅ What we did.** A narrow `EncodeContext` interface (`src/core/clues/context.ts:36-53`)
hides numbering and constant-resolution behind `at` / `notAt` / `clause`:

```ts
export interface EncodeContext {
  readonly n: number;
  at(cell: Cell, p: number): Signed;      // "cell is at position p"
  notAt(cell: Cell, p: number): Signed;
  clause(literals: Signed[]): Clause | null; // resolves constants, drops tautologies
}
```

Handlers express pure semantics against it (see C1 in Slide 1: just `at`/`notAt`/`clause`,
no integer indices anywhere). The encoder builds the concrete context — `atomFor` turns a
position-category reference into a `true`/`false` constant and everything else into a
numbered variable (`src/core/encoder.ts:84-90`), and `clause` resolves those constants
and drops tautologies (`src/core/encoder.ts:92-111`).

**Payoff.** Handlers contain zero index arithmetic and zero position-axis special-casing
— that lives once, in the encoder. As the file header puts it
(`src/core/clues/context.ts:15`): *"the encoder owns numbering/solving; handlers own
meaning."* You can read a handler as plain logic, and the tricky constant-folding is
written and tested in exactly one place.

**Speaker notes:**
- "This is dependency inversion. Handlers depend on a tiny interface, not on how
  variables are numbered."
- "The gnarly bit — the position axis has no variables, so some atoms are just true or
  false — is solved once in the context, not nine times in the handlers."
- "Read any handler and it's just the logic of the clue. That's the win."

---

## Slide 4: Inference rules R1–R6 are strategy objects in a priority array

**The problem.** The solver explains its reasoning with six rules of differing priority,
applied highest-first and restarted after any fires. With inheritance you'd reach for a
`Rule` base class and six subclasses, plus a `switch (clueType)` inside the
relation-based rules.

**❌ The inheritance design we avoided:** `abstract class Rule { abstract fire(...) }`
with six subclasses, and inside the propagation rules a `switch (clue.type)` to compute
each clue's allowed position relationship.

**✅ What we did, twice.** First, each rule is a plain object implementing a one-method
interface (`src/core/inference/engine.ts:45-48`), and the driver is just an ordered array
iterated top-down (`engine.ts:271-278`, driver loop `engine.ts:311-325`):

```ts
const RULES: Rule[] = [R1, R2,
  makePropagationRule('R3'),
  makePropagationRule('R4'),
  makePropagationRule('R5'),
  R6];
```

Second — and this is the key one for the theme — the relation-based rules don't switch on
clue type. They **delegate per-clue semantics to the handler's `relation` predicate**
pulled from the registry (`engine.ts:178-196`):

```ts
function makePropagationRule(id: RuleId): Rule {
  return {
    id,
    fire(ctx) {
      for (const clue of ctx.clues) {
        if (!isBinaryClue(clue)) continue;
        const handler = getClueHandler(clue.type);
        if (handler.inferenceRule !== id || !handler.relation) continue;
        const rel = handler.relation;
        const step =
          tryNarrow(ctx, clue, clue.x, clue.y, (px, py) => rel(px, py), id) ??
          tryNarrow(ctx, clue, clue.y, clue.x, (py, px) => rel(px, py), id);
        if (step) return step;
      }
      return null;
    },
  };
}
```

R3, R4, and R5 are *the same function* parameterised by id — the differences (which
clues, which label) come from the handler's `inferenceRule` tag and `relation` function,
not from branching in the engine. The header states the intent directly
(`engine.ts:8-14`).

**Payoff.** A new ordering clue needs only a `relation` and an `inferenceRule` tag on its
handler — the engine propagates it with no edit (no new `case`, no new subclass). Rule
priority is reordering one array. And each rule is a self-contained object you can call
`fire(ctx)` on in isolation in a test, no class instantiation ceremony.

**Speaker notes:**
- "Six rules, applied highest-priority first. They're objects in an array, not a class
  hierarchy. Reprioritising is reordering the list."
- "The important part: the constraint-propagation rules never ask 'what kind of clue is
  this?' They ask the clue's handler for its relation predicate."
- "So R3, R4, R5 are literally one function reused three times. The behaviour comes from
  the data, not from inheritance."

---

## Slide 5: The SAT-solver boundary — depend on an interface, inject the implementation

**The problem.** We solve via MiniSat (`logic-solver`, Emscripten-compiled). Hard-wiring
the concrete solver into the pipeline would make it impossible to swap for a native
build or a test double, and would couple every stage to one library.

**❌ The inheritance design we avoided:** pipeline code `new`-ing `MiniSatSolver()`
directly, or extending a solver base class — concrete dependency baked into the call site.

**✅ What we did.** The pipeline depends on a `SatSolver` *interface*
(`src/core/sat.ts:23-32`); MiniSat is one implementation exported as a value
(`src/core/sat.ts:80-84`):

```ts
export interface IncrementalSolver {
  solve(): SatOutcome;
  block(model: SatModel): void;
}
export interface SatSolver {
  create(numVars: number, clauses: readonly Clause[]): IncrementalSolver;
}
// ...
export const miniSatSolver: SatSolver = {
  create(numVars, clauses) { return new MiniSatIncremental(numVars, clauses); },
};
```

The solver is **injected** as a parameter with a default, both in the pipeline
(`src/core/pipeline.ts:51-54`) and the report builder (`src/core/report.ts:17-21`):

```ts
export function solvePuzzle(puzzle: Puzzle, solver: SatSolver = miniSatSolver): SolveResult {
```

MUS extraction takes the same injected solver (`src/core/pipeline.ts:64`), so the whole
pipeline runs against whatever solver you hand it.

**Payoff.** Swapping the SAT solver = implement one interface and pass it in; nothing in
the pipeline changes. Tests pass a deterministic double for free via the default
parameter. The concrete `MiniSatIncremental` class still exists
(`src/core/sat.ts:39`) — we're not anti-class — but callers depend on the *interface*,
not on it.

**Speaker notes:**
- "The pipeline never says `new MiniSat`. It takes a `SatSolver` and uses it."
- "Want a different solver? Implement the interface, pass it as an argument. The default
  is MiniSat so normal callers don't notice."
- "This is the same principle at the integration boundary: compose with an injected
  dependency instead of inheriting from or hard-coding a concrete type."

---

## Slide 6 (closing): Honest trade-offs

We used **classes where they earned their keep, by composition not inheritance.**
`KnowledgeState` (`src/core/inference/state.ts:16`) and `MiniSatIncremental`
(`src/core/sat.ts:39`) are classes — they own genuine mutable state and a lifecycle. The
point was never "no classes." The point is that *nobody inherits from them*:
`KnowledgeState` is constructed and *held* by the engine context
(`engine.ts:36-43`, `engine.ts:296`), used by composition.

**Where inheritance would have been fine.** With a truly fixed, closed set of clue types
and no cross-cutting behaviours to add, a nine-subclass tree would have worked and might
read more conventionally to an OO audience. Our bet was that *behaviours* (encode,
describe, validate, relation, future exporters) vary more often than the *type set* does
— and composition optimises for exactly that axis.

**Where composition costs us indirection.** To understand "how is C1 encoded?" you read
three files — the data (`types.ts`), the handler (`handlers.ts`), and the context it
encodes against (`context.ts`) — instead of one self-contained subclass. The registry
lookup is an extra hop versus a direct method call. We judged that indirection worth it
for the open/closed payoff, but it's a real cost for a newcomer reading the code.

**One-line summary:** *Clues, encoding, inference rules, and the SAT boundary are all
built by assembling small focused parts — data, handler objects, a narrow context
interface, strategy objects, and an injected solver — so behaviour grows by adding a
part, not by editing a class tree.*

**Speaker notes:**
- "We're not dogmatic. We use classes — for state and lifecycle — we just don't inherit
  from them."
- "If the clue set were truly frozen, subclasses would've been fine. We bet behaviours
  change more often than the type list, and optimised for that."
- "The cost is indirection: more files, an extra lookup. We think the flexibility is
  worth it. That's the honest trade."
