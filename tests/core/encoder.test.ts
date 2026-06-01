/**
 * Encoder tests (SPECS §8.1, §5.4).
 *
 * For each of the 9 clue types we encode a puzzle containing ONLY that clue and
 * assert the exact canonical clauses of its clue group. Expected literals are
 * computed from `cnf.varMap.index(cell, p)` (never hard-coded numbers) and
 * canonicalised with the same ordering rule the encoder uses (literals sorted
 * by |var|, clauses sorted lexicographically) so the assertions are stable.
 */
import { describe, it, expect } from 'vitest';
import type { Cell, Clue, Puzzle } from '@/core/types';
import { encodePuzzle } from '@/core/encoder';
import type { Cnf } from '@/core/encoder';

// --- builders ---------------------------------------------------------------

/** A puzzle with one position category P and two attribute categories A, B. */
function puzzleWith(n: number, clue: Clue): Puzzle {
  const pos = Array.from({ length: n }, (_, i) => String(i + 1));
  const A = Array.from({ length: n }, (_, i) => `a${i + 1}`);
  const B = Array.from({ length: n }, (_, i) => `b${i + 1}`);
  return {
    version: 1,
    positionCategory: 'P',
    categories: [
      { name: 'P', values: pos, isPosition: true },
      { name: 'A', values: A },
      { name: 'B', values: B },
    ],
    clues: [clue],
  };
}

const a = (i: number): Cell => ({ category: 'A', value: `a${i}` });
const b = (i: number): Cell => ({ category: 'B', value: `b${i}` });

/** Canonicalise expected clauses the same way the encoder does (§5.4). */
function canon(clauses: number[][]): number[][] {
  const sorted = clauses.map((c) =>
    [...c].sort((x, y) => Math.abs(x) - Math.abs(y) || x - y),
  );
  const seen = new Set<string>();
  const uniq: number[][] = [];
  for (const c of sorted) {
    const key = c.join(',');
    if (seen.has(key)) continue;
    seen.add(key);
    uniq.push(c);
  }
  uniq.sort((x, y) => {
    const len = Math.min(x.length, y.length);
    for (let i = 0; i < len; i++) if (x[i] !== y[i]) return x[i] - y[i];
    return x.length - y.length;
  });
  return uniq;
}

/** The single clue group's clauses for a one-clue puzzle. */
function groupClauses(cnf: Cnf): number[][] {
  expect(cnf.clueGroups).toHaveLength(1);
  return cnf.clueGroups[0].clauses;
}

/** Literal builders relative to a concrete cnf's variable map. */
function lits(cnf: Cnf) {
  return {
    pos: (cell: Cell, p: number) => cnf.varMap.index(cell, p),
    neg: (cell: Cell, p: number) => -cnf.varMap.index(cell, p),
  };
}

describe('encoder §5.4', () => {
  // --- C1: Equality (biconditional same position) ---------------------------
  describe('C1 (X is Y)', () => {
    it.each([3, 4, 5])('biconditional clauses for n=%i', (n) => {
      const cnf = encodePuzzle(puzzleWith(n, { id: 1, type: 'C1', x: a(1), y: b(1) }));
      const L = lits(cnf);
      const expected: number[][] = [];
      for (let p = 1; p <= n; p++) {
        expected.push([L.neg(a(1), p), L.pos(b(1), p)]); // ¬X_p ∨ Y_p
        expected.push([L.pos(a(1), p), L.neg(b(1), p)]); // X_p ∨ ¬Y_p
      }
      expect(groupClauses(cnf)).toEqual(canon(expected));
    });
  });

  // --- C2: Inequality -------------------------------------------------------
  describe('C2 (X is not Y)', () => {
    it.each([3, 4, 5])('per-position ¬X_p ∨ ¬Y_p for n=%i', (n) => {
      const cnf = encodePuzzle(puzzleWith(n, { id: 1, type: 'C2', x: a(1), y: b(2) }));
      const L = lits(cnf);
      const expected: number[][] = [];
      for (let p = 1; p <= n; p++) expected.push([L.neg(a(1), p), L.neg(b(2), p)]);
      expect(groupClauses(cnf)).toEqual(canon(expected));
    });
  });

  // --- C3: At position ------------------------------------------------------
  describe('C3 (X at position k)', () => {
    it('unit clause on a non-position cell (n=3, k=2)', () => {
      const cnf = encodePuzzle(puzzleWith(3, { id: 1, type: 'C3', x: a(1), k: 2 }));
      const L = lits(cnf);
      expect(groupClauses(cnf)).toEqual([[L.pos(a(1), 2)]]);
    });
    it('unit clause for k=1 and k=n (n=4)', () => {
      const c1 = encodePuzzle(puzzleWith(4, { id: 1, type: 'C3', x: b(3), k: 1 }));
      expect(groupClauses(c1)).toEqual([[lits(c1).pos(b(3), 1)]]);
      const c2 = encodePuzzle(puzzleWith(4, { id: 1, type: 'C3', x: b(3), k: 4 }));
      expect(groupClauses(c2)).toEqual([[lits(c2).pos(b(3), 4)]]);
    });
    it('C3 on the position category collapses to a tautology (no clauses)', () => {
      // "(P,2) at position 2" is constant-true → clause dropped (§5.4).
      const cnf = encodePuzzle(
        puzzleWith(3, { id: 1, type: 'C3', x: { category: 'P', value: '2' }, k: 2 }),
      );
      expect(groupClauses(cnf)).toEqual([]);
    });
  });

  // --- C4: Not at position --------------------------------------------------
  describe('C4 (X not at position k)', () => {
    it('unit negative clause (n=3, k=2)', () => {
      const cnf = encodePuzzle(puzzleWith(3, { id: 1, type: 'C4', x: a(1), k: 2 }));
      expect(groupClauses(cnf)).toEqual([[lits(cnf).neg(a(1), 2)]]);
    });
    it('unit negative clause k=1 (n=4)', () => {
      const cnf = encodePuzzle(puzzleWith(4, { id: 1, type: 'C4', x: a(2), k: 1 }));
      expect(groupClauses(cnf)).toEqual([[lits(cnf).neg(a(2), 1)]]);
    });
    it('unit negative clause k=n (n=5)', () => {
      const cnf = encodePuzzle(puzzleWith(5, { id: 1, type: 'C4', x: b(1), k: 5 }));
      expect(groupClauses(cnf)).toEqual([[lits(cnf).neg(b(1), 5)]]);
    });
  });

  // --- C5: Immediately left of (pos(X)+1 = pos(Y)) --------------------------
  describe('C5 (X immediately left of Y)', () => {
    it.each([3, 4, 5])('per-position implication plus ¬X_n for n=%i', (n) => {
      const cnf = encodePuzzle(puzzleWith(n, { id: 1, type: 'C5', x: a(1), y: b(1) }));
      const L = lits(cnf);
      const expected: number[][] = [];
      for (let p = 1; p <= n - 1; p++) expected.push([L.neg(a(1), p), L.pos(b(1), p + 1)]);
      expected.push([L.neg(a(1), n)]); // X cannot be at last position
      expect(groupClauses(cnf)).toEqual(canon(expected));
    });
  });

  // --- C6: Immediately right of (pos(X)-1 = pos(Y), mirror of C5) -----------
  describe('C6 (X immediately right of Y)', () => {
    it.each([3, 4, 5])('per-position implication plus ¬Y_n for n=%i', (n) => {
      const cnf = encodePuzzle(puzzleWith(n, { id: 1, type: 'C6', x: a(1), y: b(1) }));
      const L = lits(cnf);
      const expected: number[][] = [];
      for (let p = 1; p <= n - 1; p++) expected.push([L.neg(b(1), p), L.pos(a(1), p + 1)]);
      expected.push([L.neg(b(1), n)]); // Y cannot be at last position
      expect(groupClauses(cnf)).toEqual(canon(expected));
    });
  });

  // --- C7: Next to (|pos(X)-pos(Y)|=1) --------------------------------------
  describe('C7 (X next to Y)', () => {
    it.each([3, 4, 5])('neighbourhood clauses with endpoint units for n=%i', (n) => {
      const cnf = encodePuzzle(puzzleWith(n, { id: 1, type: 'C7', x: a(1), y: b(1) }));
      const L = lits(cnf);
      const expected: number[][] = [];
      for (let p = 1; p <= n; p++) {
        const cl = [L.neg(a(1), p)];
        if (p - 1 >= 1) cl.push(L.pos(b(1), p - 1));
        if (p + 1 <= n) cl.push(L.pos(b(1), p + 1));
        expected.push(cl);
      }
      expect(groupClauses(cnf)).toEqual(canon(expected));
    });
    it('endpoints are unit clauses (n=3): p=1 → ¬X_1 ∨ Y_2, p=3 → ¬X_3 ∨ Y_2', () => {
      const cnf = encodePuzzle(puzzleWith(3, { id: 1, type: 'C7', x: a(1), y: b(1) }));
      const L = lits(cnf);
      // At p=1 only the right neighbour (Y_2) exists; at p=3 only the left (Y_2).
      expect(groupClauses(cnf)).toEqual(
        canon([
          [L.neg(a(1), 1), L.pos(b(1), 2)],
          [L.neg(a(1), 2), L.pos(b(1), 1), L.pos(b(1), 3)],
          [L.neg(a(1), 3), L.pos(b(1), 2)],
        ]),
      );
    });
  });

  // --- C8: Somewhere left of (pos(X) < pos(Y)) ------------------------------
  describe('C8 (X somewhere left of Y)', () => {
    it.each([3, 4, 5])('disjunction tail plus ¬X_n for n=%i', (n) => {
      const cnf = encodePuzzle(puzzleWith(n, { id: 1, type: 'C8', x: a(1), y: b(1) }));
      const L = lits(cnf);
      const expected: number[][] = [];
      for (let p = 1; p <= n; p++) {
        const cl = [L.neg(a(1), p)];
        for (let q = p + 1; q <= n; q++) cl.push(L.pos(b(1), q));
        expected.push(cl); // at p=n this is unit ¬X_n already
      }
      expect(groupClauses(cnf)).toEqual(canon(expected));
    });
  });

  // --- C9: Somewhere right of (pos(X) > pos(Y), mirror of C8) ---------------
  describe('C9 (X somewhere right of Y)', () => {
    it.each([3, 4, 5])('disjunction tail plus ¬Y_n for n=%i', (n) => {
      const cnf = encodePuzzle(puzzleWith(n, { id: 1, type: 'C9', x: a(1), y: b(1) }));
      const L = lits(cnf);
      const expected: number[][] = [];
      for (let p = 1; p <= n; p++) {
        const cl = [L.neg(b(1), p)];
        for (let q = p + 1; q <= n; q++) cl.push(L.pos(a(1), q));
        expected.push(cl);
      }
      expect(groupClauses(cnf)).toEqual(canon(expected));
    });
  });

  // --- structural sanity ----------------------------------------------------
  it('output is canonical: literals sorted by |var|, clauses sorted, deduped', () => {
    const cnf = encodePuzzle(puzzleWith(4, { id: 1, type: 'C1', x: a(1), y: b(1) }));
    for (const c of cnf.allClauses) {
      const byAbs = [...c].sort((x, y) => Math.abs(x) - Math.abs(y) || x - y);
      expect(c).toEqual(byAbs);
    }
    // clauses are lexicographically sorted and unique
    const keys = cnf.allClauses.map((c) => c.join(','));
    expect(new Set(keys).size).toBe(keys.length);
  });
});
