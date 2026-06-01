/**
 * MUS tests (SPECS §8.1, §5.8).
 *
 * ≥10 over-constrained puzzles with known minimal cores. For each we assert:
 *  - solvePuzzle returns 'unsat' with the expected (sorted) MUS clue ids;
 *  - removing any single clue of the MUS makes the puzzle satisfiable
 *    (status !== 'unsat'), confirming minimality.
 */
import { describe, it, expect } from 'vitest';
import type { Category, Clue, Puzzle } from '@/core/types';
import { solvePuzzle } from '@/core/pipeline';

const pos = (n: number): Category => ({
  name: 'Pos',
  values: Array.from({ length: n }, (_, i) => String(i + 1)),
  isPosition: true,
});
const PET3: Category = { name: 'Pet', values: ['Cat', 'Dog', 'Bird'] };
const COLOR3: Category = { name: 'Color', values: ['Red', 'Green', 'Blue'] };
const PET4: Category = { name: 'Pet', values: ['Cat', 'Dog', 'Bird', 'Fish'] };
const COLOR4: Category = { name: 'Color', values: ['Red', 'Green', 'Blue', 'Pink'] };

const C = (category: string, value: string) => ({ category, value });
const P = (cats: Category[], clues: Clue[]): Puzzle => ({
  version: 1,
  positionCategory: 'Pos',
  categories: cats,
  clues,
});

/** Assert UNSAT with the given MUS, and that the MUS is genuinely minimal. */
function expectMus(puzzle: Puzzle, expected: number[]) {
  const r = solvePuzzle(puzzle);
  expect(r.status).toBe('unsat');
  if (r.status !== 'unsat') return;
  expect([...r.mus].sort((a, b) => a - b)).toEqual(expected);

  // Minimality: removing any one MUS clue must restore satisfiability.
  for (const id of expected) {
    const reduced: Puzzle = {
      ...puzzle,
      clues: puzzle.clues.filter((c) => c.id !== id),
    };
    const rr = solvePuzzle(reduced);
    expect(rr.status).not.toBe('unsat');
  }
}

describe('MUS extraction §5.8', () => {
  it('C3 vs C4 on the same cell (irrelevant third clue excluded)', () => {
    expectMus(
      P(
        [pos(3), PET3, COLOR3],
        [
          { id: 1, type: 'C3', x: C('Pet', 'Cat'), k: 1 },
          { id: 2, type: 'C4', x: C('Pet', 'Cat'), k: 1 },
          { id: 3, type: 'C3', x: C('Pet', 'Dog'), k: 2 },
        ],
      ),
      [1, 2],
    );
  });

  it('two C3 forcing two values to the same position', () => {
    expectMus(
      P(
        [pos(3), PET3, COLOR3],
        [
          { id: 1, type: 'C3', x: C('Pet', 'Cat'), k: 1 },
          { id: 2, type: 'C3', x: C('Pet', 'Dog'), k: 1 },
          { id: 3, type: 'C3', x: C('Pet', 'Bird'), k: 3 },
        ],
      ),
      [1, 2],
    );
  });

  it('cyclic C8 ordering (3-cycle)', () => {
    expectMus(
      P(
        [pos(3), COLOR3, PET3],
        [
          { id: 1, type: 'C8', x: C('Color', 'Red'), y: C('Color', 'Green') },
          { id: 2, type: 'C8', x: C('Color', 'Green'), y: C('Color', 'Blue') },
          { id: 3, type: 'C8', x: C('Color', 'Blue'), y: C('Color', 'Red') },
        ],
      ),
      [1, 2, 3],
    );
  });

  it('C5 immediately-left incompatible with a last-position pin', () => {
    expectMus(
      P(
        [pos(3), COLOR3, PET3],
        [
          { id: 1, type: 'C5', x: C('Color', 'Red'), y: C('Color', 'Green') },
          { id: 2, type: 'C3', x: C('Color', 'Red'), k: 3 },
        ],
      ),
      [1, 2],
    );
  });

  it('mutually contradictory C8 pair', () => {
    expectMus(
      P(
        [pos(3), COLOR3, PET3],
        [
          { id: 1, type: 'C8', x: C('Color', 'Red'), y: C('Color', 'Green') },
          { id: 2, type: 'C8', x: C('Color', 'Green'), y: C('Color', 'Red') },
        ],
      ),
      [1, 2],
    );
  });

  it('C1 equality contradicting C2 inequality on the same pair', () => {
    expectMus(
      P(
        [pos(3), PET3, COLOR3],
        [
          { id: 1, type: 'C1', x: C('Pet', 'Cat'), y: C('Color', 'Red') },
          { id: 2, type: 'C2', x: C('Pet', 'Cat'), y: C('Color', 'Red') },
        ],
      ),
      [1, 2],
    );
  });

  it('C7 next-to violated by two non-adjacent pins', () => {
    expectMus(
      P(
        [pos(3), PET3, COLOR3],
        [
          { id: 1, type: 'C3', x: C('Pet', 'Cat'), k: 1 },
          { id: 2, type: 'C3', x: C('Pet', 'Dog'), k: 3 },
          { id: 3, type: 'C7', x: C('Pet', 'Cat'), y: C('Pet', 'Dog') },
        ],
      ),
      [1, 2, 3],
    );
  });

  it('C6 immediately-right incompatible with a last-position pin', () => {
    expectMus(
      P(
        [pos(3), COLOR3, PET3],
        [
          { id: 1, type: 'C6', x: C('Color', 'Green'), y: C('Color', 'Red') },
          { id: 2, type: 'C3', x: C('Color', 'Red'), k: 3 },
        ],
      ),
      [1, 2],
    );
  });

  it('cyclic C9 ordering (3-cycle)', () => {
    expectMus(
      P(
        [pos(3), COLOR3, PET3],
        [
          { id: 1, type: 'C9', x: C('Color', 'Red'), y: C('Color', 'Green') },
          { id: 2, type: 'C9', x: C('Color', 'Green'), y: C('Color', 'Blue') },
          { id: 3, type: 'C9', x: C('Color', 'Blue'), y: C('Color', 'Red') },
        ],
      ),
      [1, 2, 3],
    );
  });

  it('C1/C3 link contradicting a C4 on the linked color', () => {
    expectMus(
      P(
        [pos(3), PET3, COLOR3],
        [
          { id: 1, type: 'C1', x: C('Pet', 'Cat'), y: C('Color', 'Red') },
          { id: 2, type: 'C3', x: C('Pet', 'Cat'), k: 1 },
          { id: 3, type: 'C4', x: C('Color', 'Red'), k: 1 },
        ],
      ),
      [1, 2, 3],
    );
  });

  it('C8 somewhere-left incompatible with a last-position pin', () => {
    expectMus(
      P(
        [pos(3), COLOR3, PET3],
        [
          { id: 1, type: 'C3', x: C('Color', 'Red'), k: 3 },
          { id: 2, type: 'C8', x: C('Color', 'Red'), y: C('Color', 'Green') },
        ],
      ),
      [1, 2],
    );
  });

  it('n=4 over-long C5 chain (four-step chain cannot fit in 4 positions)', () => {
    // Cat<Dog<Bird<Fish each immediately-left forces positions 1,2,3,4 — fine;
    // adding Fish immediately-left-of Cat closes a cycle → UNSAT on all five.
    expectMus(
      P(
        [pos(4), PET4, COLOR4],
        [
          { id: 1, type: 'C5', x: C('Pet', 'Cat'), y: C('Pet', 'Dog') },
          { id: 2, type: 'C5', x: C('Pet', 'Dog'), y: C('Pet', 'Bird') },
          { id: 3, type: 'C5', x: C('Pet', 'Bird'), y: C('Pet', 'Fish') },
          { id: 4, type: 'C5', x: C('Pet', 'Fish'), y: C('Pet', 'Cat') },
        ],
      ),
      [1, 2, 3, 4],
    );
  });
});
