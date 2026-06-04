import { describe, it, expect } from 'vitest';
import type { Puzzle } from '@/core/types';
import { solvePuzzle } from '@/core/pipeline';
import { clueTypes, getClueHandler } from '@/core/clues/registry';

/** A tiny 3×3 puzzle: Position × Pet × Color. */
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

describe('registry smoke', () => {
  it('clueTypes() returns all 9 supported types', () => {
    const types = clueTypes();
    expect(types).toHaveLength(9);
    expect(types).toContain('C1');
    expect(types).toContain('C9');
  });

  it('getClueHandler throws on an unknown clue type', () => {
    expect(() => getClueHandler('C99' as never)).toThrow('Unsupported clue type: C99');
  });
});

describe('pipeline smoke', () => {
  it('finds a unique solution for a fully-constrained puzzle', () => {
    const puzzle = basePuzzle([
      { id: 1, type: 'C3', x: { category: 'Pet', value: 'Cat' }, k: 1 },
      { id: 2, type: 'C3', x: { category: 'Pet', value: 'Dog' }, k: 2 },
      { id: 3, type: 'C1', x: { category: 'Pet', value: 'Cat' }, y: { category: 'Color', value: 'Red' } },
      { id: 4, type: 'C5', x: { category: 'Color', value: 'Green' }, y: { category: 'Pet', value: 'Bird' } },
    ]);
    const result = solvePuzzle(puzzle);
    expect(result.status).toBe('unique');
    if (result.status === 'unique') {
      expect(result.assignment.Pet.Cat).toBe(1);
      expect(result.assignment.Pet.Dog).toBe(2);
      expect(result.assignment.Pet.Bird).toBe(3);
      expect(result.assignment.Color.Red).toBe(1); // Cat is Red, Cat at 1
      // Green immediately left of Blue, Red at 1 → Green 2, Blue 3.
      expect(result.assignment.Color.Green).toBe(2);
      expect(result.assignment.Color.Blue).toBe(3);
    }
  });

  it('detects an under-constrained puzzle', () => {
    const puzzle = basePuzzle([
      { id: 1, type: 'C3', x: { category: 'Pet', value: 'Cat' }, k: 1 },
    ]);
    const result = solvePuzzle(puzzle);
    expect(result.status).toBe('multiple');
    if (result.status === 'multiple') {
      expect(result.ambiguous.length).toBeGreaterThan(0);
    }
  });

  it('detects an over-constrained puzzle and returns a MUS', () => {
    const puzzle = basePuzzle([
      { id: 1, type: 'C3', x: { category: 'Pet', value: 'Cat' }, k: 1 },
      { id: 2, type: 'C4', x: { category: 'Pet', value: 'Cat' }, k: 1 },
      { id: 3, type: 'C3', x: { category: 'Pet', value: 'Dog' }, k: 2 },
    ]);
    const result = solvePuzzle(puzzle);
    expect(result.status).toBe('unsat');
    if (result.status === 'unsat') {
      // Clues 1 and 2 directly contradict; clue 3 is irrelevant.
      expect(result.mus).toEqual([1, 2]);
    }
  });
});
