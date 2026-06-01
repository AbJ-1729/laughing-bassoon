/**
 * Solver tests (SPECS §8.2, §5.5).
 *
 * ~20 puzzles with known unique solutions assert `solvePuzzle` returns status
 * 'unique' with the exact assignment, across a mix of n = 3, 4, 5 and all clue
 * types. Plus under-constrained ('multiple') and over-constrained ('unsat')
 * cases with the expected MUS.
 */
import { describe, it, expect } from 'vitest';
import type { Assignment, Category, Clue, Puzzle } from '@/core/types';
import { solvePuzzle } from '@/core/pipeline';

/** A size-n filler category so puzzles always meet the 3-category minimum. */
function filler(n: number): Category {
  return { name: 'Filler', values: Array.from({ length: n }, (_, i) => `f${i + 1}`) };
}

/**
 * Build a puzzle, auto-padding to the 3-category minimum (§5.1) with a filler
 * category that is fully pinned by high-id C3 clues (ids ≥ 1000, so they never
 * collide with a test's clues nor appear in a MUS). Pinning keeps the filler
 * unique, so it never turns a uniquely-solvable puzzle into 'multiple'.
 */
function pz(cats: Category[], clues: Clue[], positionCategory = cats[0].name): Puzzle {
  const n = cats.find((c) => c.name === positionCategory)!.values.length;
  if (cats.length >= 3) return { version: 1, positionCategory, categories: cats, clues };
  const f = filler(n);
  const pinClues: Clue[] = f.values.map((v, i) => ({
    id: 1000 + i,
    type: 'C3',
    x: { category: f.name, value: v },
    k: i + 1,
  }));
  return {
    version: 1,
    positionCategory,
    categories: [...cats, f],
    clues: [...clues, ...pinClues],
  };
}

const pos = (n: number): Category => ({
  name: 'Pos',
  values: Array.from({ length: n }, (_, i) => String(i + 1)),
  isPosition: true,
});

// Reusable 3-value attribute categories.
const PET3: Category = { name: 'Pet', values: ['Cat', 'Dog', 'Bird'] };
const COLOR3: Category = { name: 'Color', values: ['Red', 'Green', 'Blue'] };
// 4-value
const PET4: Category = { name: 'Pet', values: ['Cat', 'Dog', 'Bird', 'Fish'] };
const COLOR4: Category = { name: 'Color', values: ['Red', 'Green', 'Blue', 'Pink'] };
// 5-value
const NAT5: Category = { name: 'Nat', values: ['A', 'B', 'C', 'D', 'E'] };
const COLOR5: Category = { name: 'Color', values: ['Red', 'Green', 'Blue', 'Pink', 'Gray'] };

const cell = (category: string, value: string) => ({ category, value });

/** Assert a unique solve and that the assignment matches every expected pin. */
function expectUnique(puzzle: Puzzle, expected: Assignment) {
  const r = solvePuzzle(puzzle);
  expect(r.status).toBe('unique');
  if (r.status !== 'unique') return;
  for (const catName of Object.keys(expected)) {
    for (const value of Object.keys(expected[catName])) {
      expect(r.assignment[catName][value]).toBe(expected[catName][value]);
    }
  }
}

describe('solver §8.2 — unique solutions', () => {
  // 1. n=3, two C3 + bijection pins the third.
  it('n=3 two C3 pins all pets', () => {
    expectUnique(
      pz(
        [pos(3), PET3],
        [
          { id: 1, type: 'C3', x: cell('Pet', 'Cat'), k: 1 },
          { id: 2, type: 'C3', x: cell('Pet', 'Dog'), k: 2 },
        ],
      ),
      { Pet: { Cat: 1, Dog: 2, Bird: 3 } },
    );
  });

  // 2. n=3, C1 + C3 ties two categories together.
  it('n=3 C1 equality with C3', () => {
    expectUnique(
      pz(
        [pos(3), PET3, COLOR3],
        [
          { id: 1, type: 'C3', x: cell('Pet', 'Cat'), k: 1 },
          { id: 2, type: 'C3', x: cell('Pet', 'Dog'), k: 2 },
          { id: 3, type: 'C1', x: cell('Pet', 'Cat'), y: cell('Color', 'Red') },
          { id: 4, type: 'C5', x: cell('Color', 'Green'), y: cell('Color', 'Blue') },
        ],
      ),
      {
        Pet: { Cat: 1, Dog: 2, Bird: 3 },
        Color: { Red: 1, Green: 2, Blue: 3 },
      },
    );
  });

  // 3. n=3, ordering chain via C5.
  it('n=3 C5 ordering chain', () => {
    expectUnique(
      pz(
        [pos(3), COLOR3],
        [
          { id: 1, type: 'C5', x: cell('Color', 'Red'), y: cell('Color', 'Green') },
          { id: 2, type: 'C5', x: cell('Color', 'Green'), y: cell('Color', 'Blue') },
        ],
      ),
      { Color: { Red: 1, Green: 2, Blue: 3 } },
    );
  });

  // 4. n=3, C9 (right of) + C3.
  it('n=3 C9 right-of with pin', () => {
    expectUnique(
      pz(
        [pos(3), PET3],
        [
          { id: 1, type: 'C3', x: cell('Pet', 'Bird'), k: 3 },
          { id: 2, type: 'C9', x: cell('Pet', 'Dog'), y: cell('Pet', 'Cat') },
          { id: 3, type: 'C3', x: cell('Pet', 'Cat'), k: 1 },
        ],
      ),
      { Pet: { Cat: 1, Dog: 2, Bird: 3 } },
    );
  });

  // 5. n=3, C7 next-to forcing.
  it('n=3 C7 next-to with endpoint pin', () => {
    expectUnique(
      pz(
        [pos(3), PET3, COLOR3],
        [
          { id: 1, type: 'C3', x: cell('Pet', 'Cat'), k: 1 },
          { id: 2, type: 'C7', x: cell('Color', 'Red'), y: cell('Pet', 'Cat') },
          { id: 3, type: 'C3', x: cell('Color', 'Red'), k: 2 },
          { id: 4, type: 'C3', x: cell('Color', 'Green'), k: 1 },
          { id: 5, type: 'C3', x: cell('Pet', 'Dog'), k: 2 },
        ],
      ),
      {
        Pet: { Cat: 1, Dog: 2, Bird: 3 },
        Color: { Green: 1, Red: 2, Blue: 3 },
      },
    );
  });

  // 6. n=3, C2 + C4 forcing by elimination.
  it('n=3 C2/C4 elimination', () => {
    expectUnique(
      pz(
        [pos(3), PET3, COLOR3],
        [
          { id: 1, type: 'C3', x: cell('Pet', 'Cat'), k: 1 },
          { id: 2, type: 'C3', x: cell('Pet', 'Dog'), k: 2 },
          { id: 3, type: 'C4', x: cell('Color', 'Red'), k: 2 },
          { id: 4, type: 'C4', x: cell('Color', 'Red'), k: 3 },
          { id: 5, type: 'C2', x: cell('Color', 'Green'), y: cell('Pet', 'Dog') },
          { id: 6, type: 'C4', x: cell('Color', 'Green'), k: 1 },
        ],
      ),
      {
        Pet: { Cat: 1, Dog: 2, Bird: 3 },
        Color: { Red: 1, Blue: 2, Green: 3 },
      },
    );
  });

  // 7. n=3, C6 immediately-right.
  it('n=3 C6 immediately right', () => {
    expectUnique(
      pz(
        [pos(3), COLOR3],
        [
          { id: 1, type: 'C3', x: cell('Color', 'Red'), k: 1 },
          { id: 2, type: 'C6', x: cell('Color', 'Green'), y: cell('Color', 'Red') },
          { id: 3, type: 'C6', x: cell('Color', 'Blue'), y: cell('Color', 'Green') },
        ],
      ),
      { Color: { Red: 1, Green: 2, Blue: 3 } },
    );
  });

  // 8. n=3, C8 somewhere-left fully ordered.
  it('n=3 C8 somewhere left fully ordered', () => {
    expectUnique(
      pz(
        [pos(3), COLOR3],
        [
          { id: 1, type: 'C8', x: cell('Color', 'Red'), y: cell('Color', 'Green') },
          { id: 2, type: 'C8', x: cell('Color', 'Green'), y: cell('Color', 'Blue') },
        ],
      ),
      { Color: { Red: 1, Green: 2, Blue: 3 } },
    );
  });

  // 9. n=4, two C3 + C5.
  it('n=4 C3 + C5 chain', () => {
    expectUnique(
      pz(
        [pos(4), PET4],
        [
          { id: 1, type: 'C3', x: cell('Pet', 'Cat'), k: 1 },
          { id: 2, type: 'C5', x: cell('Pet', 'Cat'), y: cell('Pet', 'Dog') },
          { id: 3, type: 'C5', x: cell('Pet', 'Dog'), y: cell('Pet', 'Bird') },
          { id: 4, type: 'C5', x: cell('Pet', 'Bird'), y: cell('Pet', 'Fish') },
        ],
      ),
      { Pet: { Cat: 1, Dog: 2, Bird: 3, Fish: 4 } },
    );
  });

  // 10. n=4, cross-category C1 + ordering.
  it('n=4 C1 cross-category with ordering', () => {
    expectUnique(
      pz(
        [pos(4), PET4, COLOR4],
        [
          { id: 1, type: 'C3', x: cell('Pet', 'Cat'), k: 1 },
          { id: 2, type: 'C3', x: cell('Pet', 'Dog'), k: 2 },
          { id: 3, type: 'C3', x: cell('Pet', 'Bird'), k: 3 },
          { id: 4, type: 'C1', x: cell('Pet', 'Cat'), y: cell('Color', 'Red') },
          { id: 5, type: 'C1', x: cell('Pet', 'Dog'), y: cell('Color', 'Green') },
          { id: 6, type: 'C5', x: cell('Color', 'Blue'), y: cell('Color', 'Pink') },
        ],
      ),
      {
        Pet: { Cat: 1, Dog: 2, Bird: 3, Fish: 4 },
        Color: { Red: 1, Green: 2, Blue: 3, Pink: 4 },
      },
    );
  });

  // 11. n=4, C9 + C8 sandwich.
  it('n=4 ordering sandwich', () => {
    expectUnique(
      pz(
        [pos(4), COLOR4],
        [
          { id: 1, type: 'C3', x: cell('Color', 'Red'), k: 1 },
          { id: 2, type: 'C3', x: cell('Color', 'Pink'), k: 4 },
          { id: 3, type: 'C8', x: cell('Color', 'Green'), y: cell('Color', 'Blue') },
          { id: 4, type: 'C4', x: cell('Color', 'Green'), k: 3 },
        ],
      ),
      { Color: { Red: 1, Green: 2, Blue: 3, Pink: 4 } },
    );
  });

  // 12. n=4, C7 next-to with three pins.
  it('n=4 C7 next-to', () => {
    expectUnique(
      pz(
        [pos(4), PET4, COLOR4],
        [
          { id: 1, type: 'C3', x: cell('Pet', 'Cat'), k: 2 },
          { id: 2, type: 'C7', x: cell('Color', 'Red'), y: cell('Pet', 'Cat') },
          { id: 3, type: 'C3', x: cell('Color', 'Red'), k: 1 },
          { id: 4, type: 'C3', x: cell('Pet', 'Dog'), k: 1 },
          { id: 5, type: 'C3', x: cell('Pet', 'Bird'), k: 3 },
          { id: 6, type: 'C3', x: cell('Color', 'Green'), k: 2 },
          { id: 7, type: 'C3', x: cell('Color', 'Blue'), k: 3 },
        ],
      ),
      {
        Pet: { Dog: 1, Cat: 2, Bird: 3, Fish: 4 },
        Color: { Red: 1, Green: 2, Blue: 3, Pink: 4 },
      },
    );
  });

  // 13. n=5, full positional pinning of one category.
  it('n=5 full positional pins', () => {
    expectUnique(
      pz(
        [pos(5), NAT5],
        [
          { id: 1, type: 'C3', x: cell('Nat', 'A'), k: 1 },
          { id: 2, type: 'C3', x: cell('Nat', 'B'), k: 2 },
          { id: 3, type: 'C3', x: cell('Nat', 'C'), k: 3 },
          { id: 4, type: 'C3', x: cell('Nat', 'D'), k: 4 },
        ],
      ),
      { Nat: { A: 1, B: 2, C: 3, D: 4, E: 5 } },
    );
  });

  // 14. n=5, ordering chain with C5.
  it('n=5 C5 ordering chain', () => {
    expectUnique(
      pz(
        [pos(5), NAT5],
        [
          { id: 1, type: 'C3', x: cell('Nat', 'A'), k: 1 },
          { id: 2, type: 'C5', x: cell('Nat', 'A'), y: cell('Nat', 'B') },
          { id: 3, type: 'C5', x: cell('Nat', 'B'), y: cell('Nat', 'C') },
          { id: 4, type: 'C5', x: cell('Nat', 'C'), y: cell('Nat', 'D') },
          { id: 5, type: 'C5', x: cell('Nat', 'D'), y: cell('Nat', 'E') },
        ],
      ),
      { Nat: { A: 1, B: 2, C: 3, D: 4, E: 5 } },
    );
  });

  // 15. n=5, two categories, cross C1 + ordering.
  it('n=5 cross-category equality', () => {
    expectUnique(
      pz(
        [pos(5), NAT5, COLOR5],
        [
          { id: 1, type: 'C3', x: cell('Nat', 'A'), k: 1 },
          { id: 2, type: 'C3', x: cell('Nat', 'B'), k: 2 },
          { id: 3, type: 'C3', x: cell('Nat', 'C'), k: 3 },
          { id: 4, type: 'C3', x: cell('Nat', 'D'), k: 4 },
          { id: 5, type: 'C1', x: cell('Nat', 'A'), y: cell('Color', 'Red') },
          { id: 6, type: 'C1', x: cell('Nat', 'B'), y: cell('Color', 'Green') },
          { id: 7, type: 'C1', x: cell('Nat', 'C'), y: cell('Color', 'Blue') },
          { id: 8, type: 'C1', x: cell('Nat', 'D'), y: cell('Color', 'Pink') },
        ],
      ),
      {
        Nat: { A: 1, B: 2, C: 3, D: 4, E: 5 },
        Color: { Red: 1, Green: 2, Blue: 3, Pink: 4, Gray: 5 },
      },
    );
  });

  // 16. n=3, mixed C2 forcing a unique layout.
  it('n=3 C2 mutual exclusion forcing', () => {
    expectUnique(
      pz(
        [pos(3), PET3, COLOR3],
        [
          { id: 1, type: 'C1', x: cell('Pet', 'Cat'), y: cell('Color', 'Red') },
          { id: 2, type: 'C3', x: cell('Color', 'Red'), k: 1 },
          { id: 3, type: 'C8', x: cell('Pet', 'Dog'), y: cell('Pet', 'Bird') },
          { id: 4, type: 'C4', x: cell('Pet', 'Dog'), k: 1 },
          { id: 5, type: 'C1', x: cell('Color', 'Green'), y: cell('Pet', 'Dog') },
        ],
      ),
      {
        Pet: { Cat: 1, Dog: 2, Bird: 3 },
        Color: { Red: 1, Green: 2, Blue: 3 },
      },
    );
  });

  // 17. n=4, C6 + C9.
  it('n=4 C6 and C9', () => {
    expectUnique(
      pz(
        [pos(4), COLOR4],
        [
          { id: 1, type: 'C3', x: cell('Color', 'Pink'), k: 4 },
          { id: 2, type: 'C6', x: cell('Color', 'Blue'), y: cell('Color', 'Green') },
          { id: 3, type: 'C3', x: cell('Color', 'Red'), k: 1 },
          { id: 4, type: 'C9', x: cell('Color', 'Blue'), y: cell('Color', 'Green') },
          { id: 5, type: 'C8', x: cell('Color', 'Green'), y: cell('Color', 'Blue') },
        ],
      ),
      { Color: { Red: 1, Green: 2, Blue: 3, Pink: 4 } },
    );
  });

  // 18. n=3, three categories tied together.
  it('n=3 three categories tied', () => {
    const DRINK3: Category = { name: 'Drink', values: ['Tea', 'Milk', 'Cola'] };
    expectUnique(
      pz(
        [pos(3), PET3, COLOR3, DRINK3],
        [
          { id: 1, type: 'C3', x: cell('Pet', 'Cat'), k: 1 },
          { id: 2, type: 'C5', x: cell('Pet', 'Cat'), y: cell('Pet', 'Dog') },
          { id: 3, type: 'C5', x: cell('Pet', 'Dog'), y: cell('Pet', 'Bird') },
          { id: 4, type: 'C1', x: cell('Pet', 'Cat'), y: cell('Color', 'Red') },
          { id: 5, type: 'C1', x: cell('Pet', 'Dog'), y: cell('Color', 'Green') },
          { id: 6, type: 'C1', x: cell('Color', 'Red'), y: cell('Drink', 'Tea') },
          { id: 7, type: 'C1', x: cell('Color', 'Blue'), y: cell('Drink', 'Cola') },
        ],
      ),
      {
        Pet: { Cat: 1, Dog: 2, Bird: 3 },
        Color: { Red: 1, Green: 2, Blue: 3 },
        Drink: { Tea: 1, Milk: 2, Cola: 3 },
      },
    );
  });

  // 19. n=4, next-to + ordering combined.
  it('n=4 next-to plus ordering', () => {
    expectUnique(
      pz(
        [pos(4), PET4],
        [
          { id: 1, type: 'C3', x: cell('Pet', 'Cat'), k: 1 },
          { id: 2, type: 'C7', x: cell('Pet', 'Dog'), y: cell('Pet', 'Cat') },
          { id: 3, type: 'C5', x: cell('Pet', 'Dog'), y: cell('Pet', 'Bird') },
          { id: 4, type: 'C8', x: cell('Pet', 'Bird'), y: cell('Pet', 'Fish') },
        ],
      ),
      { Pet: { Cat: 1, Dog: 2, Bird: 3, Fish: 4 } },
    );
  });

  // 20. n=5, ordering + pins.
  it('n=5 ordering plus pins', () => {
    expectUnique(
      pz(
        [pos(5), NAT5],
        [
          { id: 1, type: 'C3', x: cell('Nat', 'E'), k: 5 },
          { id: 2, type: 'C3', x: cell('Nat', 'A'), k: 1 },
          { id: 3, type: 'C8', x: cell('Nat', 'B'), y: cell('Nat', 'C') },
          { id: 4, type: 'C8', x: cell('Nat', 'C'), y: cell('Nat', 'D') },
          { id: 5, type: 'C4', x: cell('Nat', 'B'), k: 3 },
        ],
      ),
      { Nat: { A: 1, B: 2, C: 3, D: 4, E: 5 } },
    );
  });
});

describe('solver §5.7 — under-constrained', () => {
  it('reports multiple with ambiguous cells (n=3, one pin)', () => {
    const r = solvePuzzle(pz([pos(3), PET3], [
      { id: 1, type: 'C3', x: cell('Pet', 'Cat'), k: 1 },
    ]));
    expect(r.status).toBe('multiple');
    if (r.status === 'multiple') {
      expect(r.ambiguous.length).toBeGreaterThan(0);
      // The two assignments must actually differ on an ambiguous cell.
      const diff = r.ambiguous.some(
        (c) => r.assignmentA[c.category][c.value] !== r.assignmentB[c.category][c.value],
      );
      expect(diff).toBe(true);
    }
  });

  it('reports multiple for an empty clue set (n=4)', () => {
    const r = solvePuzzle(pz([pos(4), PET4], []));
    expect(r.status).toBe('multiple');
  });
});

describe('solver §5.8 — over-constrained (MUS)', () => {
  it('C3/C4 direct contradiction, ignoring irrelevant clue', () => {
    const r = solvePuzzle(pz([pos(3), PET3], [
      { id: 1, type: 'C3', x: cell('Pet', 'Cat'), k: 1 },
      { id: 2, type: 'C4', x: cell('Pet', 'Cat'), k: 1 },
      { id: 3, type: 'C3', x: cell('Pet', 'Dog'), k: 2 },
    ]));
    expect(r.status).toBe('unsat');
    if (r.status === 'unsat') expect(r.mus).toEqual([1, 2]);
  });

  it('two values forced to the same position (C3 collision)', () => {
    const r = solvePuzzle(pz([pos(3), PET3], [
      { id: 1, type: 'C3', x: cell('Pet', 'Cat'), k: 1 },
      { id: 2, type: 'C3', x: cell('Pet', 'Dog'), k: 1 },
    ]));
    expect(r.status).toBe('unsat');
    if (r.status === 'unsat') expect(r.mus).toEqual([1, 2]);
  });

  it('cyclic ordering is unsatisfiable', () => {
    const r = solvePuzzle(pz([pos(3), COLOR3], [
      { id: 1, type: 'C8', x: cell('Color', 'Red'), y: cell('Color', 'Green') },
      { id: 2, type: 'C8', x: cell('Color', 'Green'), y: cell('Color', 'Blue') },
      { id: 3, type: 'C8', x: cell('Color', 'Blue'), y: cell('Color', 'Red') },
    ]));
    expect(r.status).toBe('unsat');
    if (r.status === 'unsat') expect(r.mus).toEqual([1, 2, 3]);
  });
});
