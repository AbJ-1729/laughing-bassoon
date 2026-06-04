/**
 * Property-based tests (SPECS §8.4).
 *
 * Generate random small puzzles (n ∈ {3,4,5}) with random clue subsets using a
 * fixed-seed PRNG (mulberry32) for reproducibility. For each puzzle, run the
 * full solve pipeline and check the spec invariants:
 *   - unique → the inference engine's final snapshot equals the SAT assignment
 *     (every cell a singleton matching the oracle);
 *   - unsat  → the MUS is genuinely unsatisfiable, and removing any one clue
 *     from the MUS restores satisfiability (status !== 'unsat').
 * Many random puzzles are 'multiple' (under-constrained); that is fine. We also
 * assert that at least one unique and one unsat puzzle were produced overall.
 */
import { describe, it, expect } from 'vitest';
import type { Category, Cell, Clue, ClueType, Puzzle } from '@/core/types';
import { cellKey } from '@/core/types';
import { solvePuzzle } from '@/core/pipeline';
import { explain } from '@/core/inference/engine';

// --- seeded PRNG (mulberry32) ----------------------------------------------

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const SEED = 0xC0FFEE;
const ITERATIONS = 120;

const CLUE_TYPES: ClueType[] = ['C1', 'C2', 'C3', 'C4', 'C5', 'C6', 'C7', 'C8', 'C9'];
const BINARY = new Set<ClueType>(['C1', 'C2', 'C5', 'C6', 'C7', 'C8', 'C9']);

// Attribute category value pools (sliced to n).
const POOL: Record<string, string[]> = {
  A: ['a1', 'a2', 'a3', 'a4', 'a5'],
  B: ['b1', 'b2', 'b3', 'b4', 'b5'],
  C: ['c1', 'c2', 'c3', 'c4', 'c5'],
};

function buildPuzzle(rnd: () => number): Puzzle {
  const n = 3 + Math.floor(rnd() * 3); // 3..5
  const attrNames = ['A', 'B', 'C'].slice(0, 2 + Math.floor(rnd() * 2)); // 2..3 attrs
  const categories: Category[] = [
    {
      name: 'Pos',
      values: Array.from({ length: n }, (_, i) => String(i + 1)),
      isPosition: true,
    },
    ...attrNames.map((name) => ({ name, values: POOL[name].slice(0, n) })),
  ];

  const pick = <T,>(arr: T[]): T => arr[Math.floor(rnd() * arr.length)];
  const attrCell = (): Cell => {
    const cat = pick(attrNames);
    return { category: cat, value: pick(POOL[cat].slice(0, n)) };
  };

  const numClues = Math.floor(rnd() * 6); // 0..5 clues
  const clues: Clue[] = [];
  for (let i = 0; i < numClues; i++) {
    const type = pick(CLUE_TYPES);
    const x = attrCell();
    if (BINARY.has(type)) {
      let y = attrCell();
      // Avoid an identical (category AND value) reference (§5.3 → SAME_CELL).
      let guard = 0;
      while (y.category === x.category && y.value === x.value && guard++ < 10) {
        y = attrCell();
      }
      if (y.category === x.category && y.value === x.value) continue;
      clues.push({ id: clues.length + 1, type, x, y } as Clue);
    } else {
      const k = 1 + Math.floor(rnd() * n); // valid 1..n
      clues.push({ id: clues.length + 1, type, x, k } as Clue);
    }
  }

  return { version: 1, positionCategory: 'Pos', categories, clues };
}

describe('property-based §8.4', () => {
  it(`holds over ${ITERATIONS} random puzzles (seed=${SEED})`, () => {
    const rnd = mulberry32(SEED);
    let nUnique = 0;
    let nUnsat = 0;
    let nMultiple = 0;
    let nInvalid = 0;

    for (let iter = 0; iter < ITERATIONS; iter++) {
      const puzzle = buildPuzzle(rnd);
      const result = solvePuzzle(puzzle);

      switch (result.status) {
        case 'unique': {
          nUnique++;
          const { steps, snapshots } = explain(puzzle, result.assignment);
          expect(snapshots.length).toBe(steps.length + 1);
          const finalSnap = snapshots[snapshots.length - 1];
          for (const cat of puzzle.categories) {
            if (cat.name === puzzle.positionCategory) continue;
            for (const value of cat.values) {
              expect(finalSnap[cellKey({ category: cat.name, value })]).toEqual([
                result.assignment[cat.name][value],
              ]);
            }
          }
          // Citations resolve.
          const clueIds = new Set(puzzle.clues.map((c) => c.id));
          for (const step of steps) {
            for (const c of step.citedClues) expect(clueIds.has(c)).toBe(true);
            for (const s of step.citedSteps) expect(s).toBeLessThan(step.stepNumber);
          }
          break;
        }
        case 'unsat': {
          nUnsat++;
          const musClues = puzzle.clues.filter((c) => result.mus.includes(c.id));
          // The reported MUS, on its own, must be unsatisfiable.
          const musOnly: Puzzle = { ...puzzle, clues: musClues };
          expect(solvePuzzle(musOnly).status).toBe('unsat');
          // Minimality: removing any one clue FROM THE MUS makes the MUS-only
          // instance satisfiable. (The full puzzle may stay UNSAT via a disjoint
          // conflict, so minimality is tested on the MUS subset itself.)
          for (const id of result.mus) {
            const reduced: Puzzle = {
              ...puzzle,
              clues: musClues.filter((c) => c.id !== id),
            };
            expect(solvePuzzle(reduced).status).not.toBe('unsat');
          }
          break;
        }
        case 'multiple': {
          nMultiple++;
          // §5.7: the two assignments must differ in at least one cell, and
          // every differing cell must be listed in `ambiguous`.
          expect(result.ambiguous.length).toBeGreaterThan(0);
          const anyDiff = result.ambiguous.some(
            (cell) =>
              result.assignmentA[cell.category]?.[cell.value] !==
              result.assignmentB[cell.category]?.[cell.value],
          );
          expect(anyDiff).toBe(true);
          break;
        }
        case 'invalid':
          nInvalid++;
          break;
      }
    }

    // Generation should be valid and exercise both interesting outcomes.
    expect(nInvalid).toBe(0);
    expect(nUnique).toBeGreaterThan(0);
    expect(nUnsat).toBeGreaterThan(0);
    expect(nUnique + nUnsat + nMultiple).toBe(ITERATIONS);
  });
});
