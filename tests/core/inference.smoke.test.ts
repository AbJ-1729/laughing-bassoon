import { describe, it, expect } from 'vitest';
import type { Assignment, Puzzle } from '@/core/types';
import { cellKey } from '@/core/types';
import { solvePuzzle } from '@/core/pipeline';
import { explain } from '@/core/inference/engine';

function basePuzzle(clues: Puzzle['clues']): Puzzle {
  return {
    version: 1,
    positionCategory: 'Pos',
    categories: [
      { name: 'Pos', values: ['1', '2', '3'], isPosition: true },
      { name: 'Pet', values: ['Cat', 'Dog', 'Bird'] },
      { name: 'Color', values: ['Red', 'Green', 'Blue'] },
    ],
    clues,
  };
}

/** Replays the chain's final snapshot and asserts it equals the oracle. */
function assertConvergesToOracle(puzzle: Puzzle, oracle: Assignment) {
  const { steps, snapshots } = explain(puzzle, oracle);
  const finalSnapshot = snapshots[snapshots.length - 1];
  for (const cat of puzzle.categories) {
    if (cat.name === puzzle.positionCategory) continue;
    for (const value of cat.values) {
      const positions = finalSnapshot[cellKey({ category: cat.name, value })];
      expect(positions).toEqual([oracle[cat.name][value]]); // singleton == oracle
    }
  }
  // Every citation resolves to an existing clue / earlier step (§8.2).
  const clueIds = new Set(puzzle.clues.map((c) => c.id));
  for (const step of steps) {
    for (const c of step.citedClues) expect(clueIds.has(c)).toBe(true);
    for (const s of step.citedSteps) expect(s).toBeLessThan(step.stepNumber);
  }
  // snapshots has initial + one per step.
  expect(snapshots.length).toBe(steps.length + 1);
}

describe('inference engine', () => {
  it('produces a complete proof converging to the oracle', () => {
    const puzzle = basePuzzle([
      { id: 1, type: 'C3', x: { category: 'Pet', value: 'Cat' }, k: 1 },
      { id: 2, type: 'C3', x: { category: 'Pet', value: 'Dog' }, k: 2 },
      { id: 3, type: 'C1', x: { category: 'Pet', value: 'Cat' }, y: { category: 'Color', value: 'Red' } },
      { id: 4, type: 'C5', x: { category: 'Color', value: 'Green' }, y: { category: 'Pet', value: 'Bird' } },
    ]);
    const result = solvePuzzle(puzzle);
    expect(result.status).toBe('unique');
    if (result.status === 'unique') {
      assertConvergesToOracle(puzzle, result.assignment);
    }
  });

  it('converges on a puzzle solved through ordering propagation', () => {
    const puzzle = basePuzzle([
      { id: 1, type: 'C1', x: { category: 'Pet', value: 'Cat' }, y: { category: 'Color', value: 'Red' } },
      { id: 2, type: 'C3', x: { category: 'Color', value: 'Red' }, k: 1 },
      { id: 3, type: 'C5', x: { category: 'Color', value: 'Red' }, y: { category: 'Pet', value: 'Dog' } },
      { id: 4, type: 'C5', x: { category: 'Color', value: 'Green' }, y: { category: 'Pet', value: 'Bird' } },
    ]);
    const result = solvePuzzle(puzzle);
    expect(result.status).toBe('unique');
    if (result.status === 'unique') {
      assertConvergesToOracle(puzzle, result.assignment);
    }
  });
});
