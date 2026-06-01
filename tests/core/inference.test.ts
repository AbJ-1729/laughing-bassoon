/**
 * Inference-engine tests (SPECS §8.1, §5.6).
 *
 * For each rule R1–R6 a puzzle is constructed whose deduction chain exercises
 * that rule, and we assert a step with the matching `rule` label is produced.
 * For every puzzle we also assert the structural invariants of a valid proof:
 *  - every step's citedClues reference existing clue ids;
 *  - every citedSteps entry is strictly less than that step's number;
 *  - snapshots = initial + one per step;
 *  - the final snapshot equals the SAT oracle (all singletons matching).
 */
import { describe, it, expect } from 'vitest';
import type { Assignment, Category, Clue, Puzzle } from '@/core/types';
import { cellKey } from '@/core/types';
import { solvePuzzle } from '@/core/pipeline';
import { explain } from '@/core/inference/engine';
import type { RuleId } from '@/core/inference/types';

const pos = (n: number): Category => ({
  name: 'Pos',
  values: Array.from({ length: n }, (_, i) => String(i + 1)),
  isPosition: true,
});
const PET3: Category = { name: 'Pet', values: ['Cat', 'Dog', 'Bird'] };
const COLOR3: Category = { name: 'Color', values: ['Red', 'Green', 'Blue'] };
const C = (category: string, value: string) => ({ category, value });

function puzzle(cats: Category[], clues: Clue[]): Puzzle {
  return { version: 1, positionCategory: 'Pos', categories: cats, clues };
}

/** Solve, then assert the proof invariants and return the steps' rule labels. */
function ruleLabelsAndInvariants(p: Puzzle): RuleId[] {
  const r = solvePuzzle(p);
  expect(r.status).toBe('unique');
  if (r.status !== 'unique') return [];
  const oracle: Assignment = r.assignment;
  const { steps, snapshots } = explain(p, oracle);

  // snapshots[0] initial + one per step.
  expect(snapshots.length).toBe(steps.length + 1);

  const clueIds = new Set(p.clues.map((c) => c.id));
  for (const step of steps) {
    expect(['R1', 'R2', 'R3', 'R4', 'R5', 'R6']).toContain(step.rule);
    for (const c of step.citedClues) expect(clueIds.has(c)).toBe(true);
    for (const s of step.citedSteps) expect(s).toBeLessThan(step.stepNumber);
  }

  // Final snapshot equals the SAT oracle (every cell a matching singleton).
  const finalSnap = snapshots[snapshots.length - 1];
  for (const cat of p.categories) {
    if (cat.name === p.positionCategory) continue;
    for (const value of cat.values) {
      expect(finalSnap[cellKey(C(cat.name, value))]).toEqual([oracle[cat.name][value]]);
    }
  }

  return steps.map((s) => s.rule);
}

describe('inference engine §5.6 — each rule fires', () => {
  it('R1 — direct assignment from a C3 clue', () => {
    const labels = ruleLabelsAndInvariants(
      puzzle(
        [pos(3), PET3, COLOR3],
        [
          { id: 1, type: 'C3', x: C('Pet', 'Cat'), k: 1 },
          { id: 2, type: 'C3', x: C('Pet', 'Dog'), k: 2 },
          { id: 3, type: 'C1', x: C('Pet', 'Cat'), y: C('Color', 'Red') },
          { id: 4, type: 'C5', x: C('Color', 'Green'), y: C('Color', 'Blue') },
        ],
      ),
    );
    expect(labels).toContain('R1');
  });

  it('R2 — bijection elimination', () => {
    // A pinned Pet forbids its position to the other pets → R2.
    const labels = ruleLabelsAndInvariants(
      puzzle(
        [pos(3), PET3, COLOR3],
        [
          { id: 1, type: 'C3', x: C('Pet', 'Cat'), k: 1 },
          { id: 2, type: 'C3', x: C('Pet', 'Dog'), k: 2 },
          { id: 3, type: 'C1', x: C('Pet', 'Cat'), y: C('Color', 'Red') },
          { id: 4, type: 'C5', x: C('Color', 'Green'), y: C('Color', 'Blue') },
        ],
      ),
    );
    expect(labels).toContain('R2');
  });

  it('R3 — C7 (next-to) constraint propagation', () => {
    // Blue pinned at 3, Cat next to Blue (not otherwise pinned) → R3 narrows Cat.
    const labels = ruleLabelsAndInvariants(
      puzzle(
        [pos(3), PET3, COLOR3],
        [
          { id: 1, type: 'C3', x: C('Color', 'Red'), k: 1 },
          { id: 2, type: 'C3', x: C('Color', 'Green'), k: 2 },
          { id: 3, type: 'C3', x: C('Color', 'Blue'), k: 3 },
          { id: 4, type: 'C7', x: C('Pet', 'Cat'), y: C('Color', 'Blue') },
          { id: 5, type: 'C3', x: C('Pet', 'Dog'), k: 1 },
        ],
      ),
    );
    expect(labels).toContain('R3');
  });

  it('R4 — C1/C2 pair elimination', () => {
    // Colors fully pinned; pets tied to colors by C1 → R4 propagates.
    const labels = ruleLabelsAndInvariants(
      puzzle(
        [pos(3), PET3, COLOR3],
        [
          { id: 1, type: 'C3', x: C('Color', 'Red'), k: 1 },
          { id: 2, type: 'C3', x: C('Color', 'Green'), k: 2 },
          { id: 3, type: 'C3', x: C('Color', 'Blue'), k: 3 },
          { id: 4, type: 'C1', x: C('Pet', 'Cat'), y: C('Color', 'Green') },
          { id: 5, type: 'C1', x: C('Pet', 'Dog'), y: C('Color', 'Red') },
        ],
      ),
    );
    expect(labels).toContain('R4');
  });

  it('R5 — ordering elimination (C8)', () => {
    const labels = ruleLabelsAndInvariants(
      puzzle(
        [pos(3), COLOR3, PET3],
        [
          { id: 1, type: 'C8', x: C('Color', 'Red'), y: C('Color', 'Green') },
          { id: 2, type: 'C8', x: C('Color', 'Green'), y: C('Color', 'Blue') },
          { id: 3, type: 'C3', x: C('Pet', 'Cat'), k: 1 },
          { id: 4, type: 'C3', x: C('Pet', 'Dog'), k: 2 },
        ],
      ),
    );
    expect(labels).toContain('R5');
  });

  it('R6 — oracle-guided case analysis (branching)', () => {
    // Local propagation stalls on this uniquely-solvable n=3 puzzle (no clue
    // pins anything directly), so the engine must branch via R6.
    const DRINK3: Category = { name: 'Drink', values: ['Tea', 'Milk', 'Cola'] };
    const labels = ruleLabelsAndInvariants(
      puzzle(
        [pos(3), PET3, COLOR3, DRINK3],
        [
          { id: 1, type: 'C7', x: C('Pet', 'Cat'), y: C('Color', 'Red') },
          { id: 2, type: 'C7', x: C('Color', 'Red'), y: C('Drink', 'Tea') },
          { id: 3, type: 'C1', x: C('Pet', 'Dog'), y: C('Color', 'Green') },
          { id: 4, type: 'C1', x: C('Color', 'Blue'), y: C('Drink', 'Cola') },
          { id: 5, type: 'C8', x: C('Pet', 'Cat'), y: C('Pet', 'Bird') },
        ],
      ),
    );
    expect(labels).toContain('R6');
  });
});

describe('inference engine §5.6 — proof shape', () => {
  it('initial snapshot has every cell at all n positions', () => {
    const p = puzzle(
      [pos(3), PET3, COLOR3],
      [{ id: 1, type: 'C3', x: C('Pet', 'Cat'), k: 1 }],
    );
    // This puzzle is under-constrained; explain still produces a valid initial
    // snapshot when given any assignment, so drive it with a solved sibling.
    const solved = puzzle(
      [pos(3), PET3, COLOR3],
      [
        { id: 1, type: 'C3', x: C('Pet', 'Cat'), k: 1 },
        { id: 2, type: 'C3', x: C('Pet', 'Dog'), k: 2 },
        { id: 3, type: 'C1', x: C('Pet', 'Cat'), y: C('Color', 'Red') },
        { id: 4, type: 'C5', x: C('Color', 'Green'), y: C('Color', 'Blue') },
      ],
    );
    const r = solvePuzzle(solved);
    expect(r.status).toBe('unique');
    if (r.status !== 'unique') return;
    const { snapshots } = explain(solved, r.assignment);
    for (const cat of p.categories) {
      if (cat.name === p.positionCategory) continue;
      for (const value of cat.values) {
        expect(snapshots[0][cellKey(C(cat.name, value))]).toEqual([1, 2, 3]);
      }
    }
  });
});
