/**
 * The nine clue handlers (SPECS §5.3, §5.4).
 *
 * Each handler is a plain object composed of small functions — `describe`,
 * `encode`, and an optional `validate`. There is deliberately no `Clue` base
 * class and no inheritance: a clue's behaviour is looked up by its `type` tag
 * in the registry (`registry.ts`). Adding behaviour (say, an SMT exporter)
 * means adding a field to this object shape, not editing a class tree.
 */
import type { BinaryClue, Cell, Clue, PositionalClue } from '../types';
import type { Clause, EncodeContext } from './context';
import type { PuzzleIndex, ValidationError } from '../puzzle-index';
import { fixedPositionOf } from '../puzzle-index';

export interface ClueHandler {
  readonly type: Clue['type'];
  readonly name: string;
  /** Structured-form English (§5.3), used by the editor and citations. */
  describe(clue: Clue): string;
  /** CNF clauses for this clue (§5.4). Tautological clauses are dropped. */
  encode(clue: Clue, ctx: EncodeContext): Clause[];
  /** Optional type-specific validation beyond the shared checks. */
  validate?(clue: Clue, index: PuzzleIndex): ValidationError[];
  /**
   * For binary clues: the allowed relationship between position(X) and
   * position(Y). The inference engine (§5.6) uses this for relation-based
   * constraint propagation — another behaviour composed per clue type rather
   * than branched on in the engine. Absent for the unary clues C3/C4.
   */
  relation?(positionX: number, positionY: number): boolean;
  /** Which inference rule label a propagation from this clue reports as (§5.6). */
  readonly inferenceRule?: 'R3' | 'R4' | 'R5';
}

// --- small shared helpers ---------------------------------------------------

const vx = (c: Clue): Cell => c.x;
const vy = (c: Clue): Cell => (c as BinaryClue).y;
const label = (cell: Cell): string => cell.value;

/** Collect non-null clauses produced by a per-position generator. */
function forEachPosition(
  n: number,
  gen: (p: number) => (Clause | null)[],
): Clause[] {
  const out: Clause[] = [];
  for (let p = 1; p <= n; p++) {
    for (const cl of gen(p)) if (cl !== null) out.push(cl);
  }
  return out;
}

// --- handlers ---------------------------------------------------------------

const C1: ClueHandler = {
  type: 'C1',
  name: 'Equality',
  inferenceRule: 'R4',
  relation: (px, py) => px === py,
  describe: (c) => `${label(vx(c))} is ${label(vy(c))}.`,
  // for each p: (¬X_p ∨ Y_p) and (X_p ∨ ¬Y_p)  — biconditional same position.
  encode: (c, ctx) =>
    forEachPosition(ctx.n, (p) => [
      ctx.clause([ctx.notAt(vx(c), p), ctx.at(vy(c), p)]),
      ctx.clause([ctx.at(vx(c), p), ctx.notAt(vy(c), p)]),
    ]),
};

const C2: ClueHandler = {
  type: 'C2',
  name: 'Inequality',
  inferenceRule: 'R4',
  relation: (px, py) => px !== py,
  describe: (c) => `${label(vx(c))} is not ${label(vy(c))}.`,
  // for each p: (¬X_p ∨ ¬Y_p)
  encode: (c, ctx) =>
    forEachPosition(ctx.n, (p) => [
      ctx.clause([ctx.notAt(vx(c), p), ctx.notAt(vy(c), p)]),
    ]),
};

const C3: ClueHandler = {
  type: 'C3',
  name: 'At position',
  describe: (c) => `${label(vx(c))} is at position ${(c as PositionalClue).k}.`,
  // unit clause X_k
  encode: (c, ctx) => {
    const cl = ctx.clause([ctx.at(vx(c), (c as PositionalClue).k)]);
    return cl === null ? [] : [cl];
  },
  // §5.4: a C3 on the position category is a tautology or contradiction,
  // resolved here at parse time.
  validate: (c, index) => {
    const k = (c as PositionalClue).k;
    const fixed = fixedPositionOf(index, c.x);
    if (fixed !== null && fixed !== k) {
      return [
        {
          code: 'CONTRADICTORY_POSITION',
          message: `Clue ${c.id}: ${label(c.x)} is the position value ${fixed}, so it cannot be at position ${k}.`,
          clueId: c.id,
        },
      ];
    }
    return [];
  },
};

const C4: ClueHandler = {
  type: 'C4',
  name: 'Not at position',
  describe: (c) =>
    `${label(vx(c))} is not at position ${(c as PositionalClue).k}.`,
  // unit clause ¬X_k
  encode: (c, ctx) => {
    const cl = ctx.clause([ctx.notAt(vx(c), (c as PositionalClue).k)]);
    return cl === null ? [] : [cl];
  },
  validate: (c, index) => {
    const k = (c as PositionalClue).k;
    const fixed = fixedPositionOf(index, c.x);
    if (fixed !== null && fixed === k) {
      return [
        {
          code: 'CONTRADICTORY_POSITION',
          message: `Clue ${c.id}: ${label(c.x)} is the position value ${fixed}, so it must be at position ${k}.`,
          clueId: c.id,
        },
      ];
    }
    return [];
  },
};

const C5: ClueHandler = {
  type: 'C5',
  name: 'Immediately left of',
  inferenceRule: 'R5',
  relation: (px, py) => px + 1 === py,
  describe: (c) => `${label(vx(c))} is immediately left of ${label(vy(c))}.`,
  // for p∈[1,n−1]: (¬X_p ∨ Y_{p+1}); plus ¬X_n.
  encode: (c, ctx) => {
    const out: Clause[] = [];
    for (let p = 1; p <= ctx.n - 1; p++) {
      const cl = ctx.clause([ctx.notAt(vx(c), p), ctx.at(vy(c), p + 1)]);
      if (cl !== null) out.push(cl);
    }
    const last = ctx.clause([ctx.notAt(vx(c), ctx.n)]);
    if (last !== null) out.push(last);
    return out;
  },
};

const C6: ClueHandler = {
  type: 'C6',
  name: 'Immediately right of',
  inferenceRule: 'R5',
  relation: (px, py) => px - 1 === py,
  describe: (c) => `${label(vx(c))} is immediately right of ${label(vy(c))}.`,
  // X imm right of Y ⇔ Y imm left of X. Mirror of C5 with roles swapped.
  encode: (c, ctx) => {
    const out: Clause[] = [];
    for (let p = 1; p <= ctx.n - 1; p++) {
      const cl = ctx.clause([ctx.notAt(vy(c), p), ctx.at(vx(c), p + 1)]);
      if (cl !== null) out.push(cl);
    }
    const last = ctx.clause([ctx.notAt(vy(c), ctx.n)]);
    if (last !== null) out.push(last);
    return out;
  },
};

const C7: ClueHandler = {
  type: 'C7',
  name: 'Next to',
  inferenceRule: 'R3',
  relation: (px, py) => Math.abs(px - py) === 1,
  describe: (c) => `${label(vx(c))} is next to ${label(vy(c))}.`,
  // for each p: (¬X_p ∨ Y_{p−1} ∨ Y_{p+1}); out-of-range literals omitted.
  encode: (c, ctx) =>
    forEachPosition(ctx.n, (p) => {
      const lits = [ctx.notAt(vx(c), p)];
      if (p - 1 >= 1) lits.push(ctx.at(vy(c), p - 1));
      if (p + 1 <= ctx.n) lits.push(ctx.at(vy(c), p + 1));
      return [ctx.clause(lits)];
    }),
};

const C8: ClueHandler = {
  type: 'C8',
  name: 'Somewhere left of',
  inferenceRule: 'R5',
  relation: (px, py) => px < py,
  describe: (c) => `${label(vx(c))} is somewhere left of ${label(vy(c))}.`,
  // for each p: (¬X_p ∨ Y_{p+1} ∨ ... ∨ Y_n); plus ¬X_n.
  encode: (c, ctx) => {
    const out = forEachPosition(ctx.n, (p) => {
      const lits = [ctx.notAt(vx(c), p)];
      for (let q = p + 1; q <= ctx.n; q++) lits.push(ctx.at(vy(c), q));
      return [ctx.clause(lits)];
    });
    const last = ctx.clause([ctx.notAt(vx(c), ctx.n)]);
    if (last !== null) out.push(last);
    return out;
  },
};

const C9: ClueHandler = {
  type: 'C9',
  name: 'Somewhere right of',
  inferenceRule: 'R5',
  relation: (px, py) => px > py,
  describe: (c) => `${label(vx(c))} is somewhere right of ${label(vy(c))}.`,
  // X right of Y ⇔ Y left of X. Mirror of C8.
  encode: (c, ctx) => {
    const out = forEachPosition(ctx.n, (p) => {
      const lits = [ctx.notAt(vy(c), p)];
      for (let q = p + 1; q <= ctx.n; q++) lits.push(ctx.at(vx(c), q));
      return [ctx.clause(lits)];
    });
    const last = ctx.clause([ctx.notAt(vy(c), ctx.n)]);
    if (last !== null) out.push(last);
    return out;
  },
};

export const ALL_HANDLERS: readonly ClueHandler[] = [
  C1,
  C2,
  C3,
  C4,
  C5,
  C6,
  C7,
  C8,
  C9,
];
