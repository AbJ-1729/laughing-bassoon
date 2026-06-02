/**
 * Inference engine and explanation generator (SPECS §5.6) — the central
 * component. Given a puzzle with a known-unique SAT solution (the oracle), it
 * derives the solution by sound constraint propagation and emits a step-by-step
 * deduction chain that mirrors human reasoning.
 *
 * Composition over inheritance, applied twice here:
 *  - The six inference rules R1–R6 are independent strategy objects in a
 *    priority-ordered list, not subclasses of a `Rule` base. The driver simply
 *    tries each until one fires, then restarts (§5.6 "apply highest first;
 *    restart from top after any rule fires").
 *  - The relation-based rules (R3/R4/R5) delegate per-clue semantics to the
 *    clue handler's `relation` predicate (registry), so the engine contains no
 *    `switch (clueType)`.
 *
 * Soundness: every elimination is logically implied by a clue plus the current
 * state, so the correct (oracle) position is never removed. The oracle only
 * picks branch order in R6, guaranteeing convergence with no visible
 * backtracking (§5.6).
 */
import type { Assignment, BinaryClue, Cell, Clue, Puzzle } from '../types';
import { cellKey, isBinaryClue } from '../types';
import { getClueHandler } from '../clues/registry';
import { KnowledgeState } from './state';
import type {
  DeductionStep,
  Explanation,
  Fact,
  PositionSnapshot,
  RuleId,
} from './types';

/** A step proposed by a rule, before the driver assigns its number. */
type ProposedStep = Omit<DeductionStep, 'stepNumber'>;

interface EngineContext {
  readonly puzzle: Puzzle;
  readonly clues: Clue[];
  readonly state: KnowledgeState;
  readonly oracle: Assignment;
  /** Step number that last modified a cell, for citations. */
  lastStepFor(cell: Cell): number | undefined;
  /** Step number that removed position `p` from `cell`, for precise citations. */
  elimStepFor(cell: Cell, p: number): number | undefined;
}

interface Rule {
  readonly id: RuleId;
  fire(ctx: EngineContext): ProposedStep | null;
}

// --- shared helpers ---------------------------------------------------------

const valuesOf = (puzzle: Puzzle, category: string): string[] =>
  puzzle.categories.find((c) => c.name === category)?.values ?? [];

/** Cells that became pinned during the step just applied → new facts. */
function newFactsFor(state: KnowledgeState, cells: Cell[]): Fact[] {
  const facts: Fact[] = [];
  for (const cell of cells) {
    const p = state.pinnedPosition(cell);
    if (p !== undefined) facts.push({ category: cell.category, value: cell.value, position: p });
  }
  return facts;
}

function joinPositions(positions: number[]): string {
  const sorted = [...positions].sort((a, b) => a - b);
  if (sorted.length === 1) return String(sorted[0]);
  return `${sorted.slice(0, -1).join(', ')} or ${sorted[sorted.length - 1]}`;
}

/**
 * Sentence fragment announcing any placements a step produces as a side effect,
 * so that every pinned fact is *stated* by the step that derives it (§5.6
 * "complete proof"). Without this, a bijection elimination could silently pin a
 * cell that a later step then cites as an established premise.
 */
function placementsSuffix(facts: Fact[]): string {
  if (facts.length === 0) return '';
  const parts = facts.map((f) => `${f.value} at position ${f.position}`);
  const joined =
    parts.length === 1
      ? parts[0]
      : `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}`;
  return `, which places ${joined}`;
}

// --- R1: direct assignment / elimination from a clue ------------------------

const R1: Rule = {
  id: 'R1',
  fire(ctx) {
    for (const clue of ctx.clues) {
      if (clue.type === 'C3' && !ctx.state.isPositionCell(clue.x)) {
        const cur = ctx.state.possible(clue.x);
        if (cur.has(clue.k) && cur.size > 1) {
          const removed = [...cur].filter((p) => p !== clue.k);
          for (const p of removed) ctx.state.eliminate(clue.x, p);
          return {
            rule: 'R1',
            englishSentence: `From clue ${clue.id}, ${clue.x.value} is at position ${clue.k}.`,
            citedClues: [clue.id],
            citedSteps: [],
            affectedCells: [clue.x],
            newFacts: newFactsFor(ctx.state, [clue.x]),
          };
        }
      }
      if (clue.type === 'C4' && !ctx.state.isPositionCell(clue.x)) {
        if (ctx.state.possible(clue.x).has(clue.k)) {
          ctx.state.eliminate(clue.x, clue.k);
          return {
            rule: 'R1',
            englishSentence: `From clue ${clue.id}, ${clue.x.value} is not at position ${clue.k}.`,
            citedClues: [clue.id],
            citedSteps: [],
            affectedCells: [clue.x],
            newFacts: newFactsFor(ctx.state, [clue.x]),
          };
        }
      }
    }
    return null;
  },
};

// --- R2: bijection elimination ----------------------------------------------

const R2: Rule = {
  id: 'R2',
  fire(ctx) {
    const { state, puzzle } = ctx;

    // (a) A pinned cell forbids its position to every other value of its category.
    for (const cell of state.cells) {
      const p = state.pinnedPosition(cell);
      if (p === undefined) continue;
      const siblings = valuesOf(puzzle, cell.category)
        .filter((v) => v !== cell.value)
        .map((v) => ({ category: cell.category, value: v }))
        .filter((s) => state.possible(s).has(p));
      if (siblings.length > 0) {
        for (const s of siblings) state.eliminate(s, p);
        const cited = ctx.lastStepFor(cell);
        const facts = newFactsFor(state, siblings);
        return {
          rule: 'R2',
          englishSentence: `Since ${cell.value} is at position ${p}, no other ${cell.category} can be at position ${p}${placementsSuffix(facts)}.`,
          citedClues: [],
          citedSteps: cited !== undefined ? [cited] : [],
          affectedCells: siblings,
          newFacts: facts,
        };
      }
    }

    // (b) A position with a single remaining candidate value forces that value.
    for (const cat of puzzle.categories) {
      if (cat.name === puzzle.positionCategory) continue;
      for (let p = 1; p <= state.n; p++) {
        const candidates = state.valuesAt(cat.name, p, cat.values);
        if (candidates.length !== 1) continue;
        const cell = { category: cat.name, value: candidates[0] };
        if (state.isPinned(cell)) continue; // already placed elsewhere-consistent
        const removed = [...state.possible(cell)].filter((q) => q !== p);
        for (const q of removed) state.eliminate(cell, q);
        // Cite the steps that removed each competing value from THIS position.
        const cited = new Set<number>();
        for (const v of cat.values) {
          if (v === cell.value) continue;
          const s = ctx.elimStepFor({ category: cat.name, value: v }, p);
          if (s !== undefined) cited.add(s);
        }
        return {
          rule: 'R2',
          englishSentence: `In ${cat.name}, only ${cell.value} can be at position ${p}, so ${cell.value} is at position ${p}.`,
          citedClues: [],
          citedSteps: [...cited].sort((a, b) => a - b),
          affectedCells: [cell],
          newFacts: newFactsFor(state, [cell]),
        };
      }
    }
    return null;
  },
};

// --- R3 / R4 / R5: relation-based constraint propagation --------------------

/**
 * Generic arc-consistency over a binary clue's `relation` predicate. Shared by
 * R3 (C7), R4 (C1/C2) and R5 (ordering) — they differ only in which clues they
 * scan and the rule label they report, so one implementation is parameterised
 * by the rule id.
 */
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

/**
 * Narrow `target`'s possible positions to those that have a supporting position
 * in `other` under `ok`. Returns a step if anything was eliminated.
 */
function tryNarrow(
  ctx: EngineContext,
  clue: BinaryClue,
  target: Cell,
  other: Cell,
  ok: (targetPos: number, otherPos: number) => boolean,
  ruleId: RuleId,
): ProposedStep | null {
  const { state } = ctx;
  if (state.isPositionCell(target)) return null; // constants can't be narrowed
  const targetPoss = [...state.possible(target)];
  const otherPoss = [...state.possible(other)];
  const lost = targetPoss.filter(
    (tp) => !otherPoss.some((op) => ok(tp, op)),
  );
  if (lost.length === 0) return null;

  for (const p of lost) state.eliminate(target, p);
  const cited = ctx.lastStepFor(other);
  const pinned = state.pinnedPosition(target);
  const sentence =
    pinned !== undefined
      ? `From clue ${clue.id} (${describe(clue)}), ${target.value} must be at position ${pinned}.`
      : `From clue ${clue.id} (${describe(clue)}), ${target.value} cannot be at position ${joinPositions(lost)}.`;
  return {
    rule: ruleId,
    englishSentence: sentence,
    citedClues: [clue.id],
    citedSteps: cited !== undefined ? [cited] : [],
    affectedCells: [target],
    newFacts: newFactsFor(state, [target]),
  };
}

function describe(clue: Clue): string {
  // Trim the trailing period from the structured form for inline use.
  return getClueHandler(clue.type).describe(clue).replace(/\.$/, '');
}

// --- R6: oracle-guided case analysis ----------------------------------------

const R6: Rule = {
  id: 'R6',
  fire(ctx) {
    const { state, oracle } = ctx;
    let best: Cell | undefined;
    let bestSize = Infinity;
    for (const cell of state.cells) {
      const size = state.possible(cell).size;
      if (size >= 2 && size < bestSize) {
        best = cell;
        bestSize = size;
      }
    }
    if (!best) return null;
    const correct = oracle[best.category][best.value];
    const removed = [...state.possible(best)].filter((p) => p !== correct);
    for (const p of removed) state.eliminate(best, p);
    return {
      rule: 'R6',
      englishSentence: `Try assuming ${best.value} is at position ${correct}.`,
      citedClues: [],
      citedSteps: [],
      affectedCells: [best],
      newFacts: newFactsFor(state, [best]),
    };
  },
};

const RULES: Rule[] = [
  R1,
  R2,
  makePropagationRule('R3'),
  makePropagationRule('R4'),
  makePropagationRule('R5'),
  R6,
];

// --- driver -----------------------------------------------------------------

function snapshot(state: KnowledgeState): PositionSnapshot {
  const snap: PositionSnapshot = {};
  for (const cell of state.cells) {
    snap[cellKey(cell)] = state.snapshotPossible(cell);
  }
  return snap;
}

/**
 * Generate the deduction chain for a uniquely-solvable puzzle.
 *
 * @param oracle the SAT solution (§5.5), used only to order R6 branches.
 */
export function explain(puzzle: Puzzle, oracle: Assignment): Explanation {
  const state = new KnowledgeState(puzzle);
  const lastStep = new Map<string, number>();
  const elimStep = new Map<string, number>(); // `${cellKey}#${pos}` → step
  const steps: DeductionStep[] = [];
  const snapshots: PositionSnapshot[] = [snapshot(state)];

  const ctx: EngineContext = {
    puzzle,
    clues: puzzle.clues,
    state,
    oracle,
    lastStepFor: (cell) => lastStep.get(cellKey(cell)),
    elimStepFor: (cell, p) => elimStep.get(`${cellKey(cell)}#${p}`),
  };

  // Safety bound: each step removes ≥1 candidate; total candidates ≤ n²·(k−1).
  const maxSteps = state.cells.length * state.n + 5;
  while (!state.isComplete() && steps.length < maxSteps) {
    let fired = false;
    for (const rule of RULES) {
      const proposed = rule.fire(ctx);
      if (proposed) {
        const stepNumber = steps.length + 1;
        for (const cell of proposed.affectedCells) {
          lastStep.set(cellKey(cell), stepNumber);
        }
        // Record which positions this step removed from each cell (provenance).
        const prev = snapshots[snapshots.length - 1];
        const snap = snapshot(state);
        for (const cell of state.cells) {
          const key = cellKey(cell);
          for (const pos of prev[key]) {
            if (!snap[key].includes(pos)) elimStep.set(`${key}#${pos}`, stepNumber);
          }
        }
        steps.push({ ...proposed, stepNumber });
        snapshots.push(snap);
        fired = true;
        break; // restart from highest priority (§5.6)
      }
    }
    if (!fired) break; // fixed point reached but incomplete — should not happen
  }

  return { steps, snapshots };
}
