/**
 * Validation tests (SPECS §5.1, §5.3). A well-formed puzzle passes; each
 * violation class is rejected with the documented error code.
 */
import { describe, it, expect } from 'vitest';
import type { Category, Clue, Puzzle } from '@/core/types';
import { validatePuzzle } from '@/core/validation';

function puzzle(over: Partial<Puzzle> = {}): Puzzle {
  const categories: Category[] = over.categories ?? [
    { name: 'Pos', values: ['1', '2', '3'], isPosition: true },
    { name: 'Pet', values: ['Cat', 'Dog', 'Bird'] },
    { name: 'Color', values: ['Red', 'Green', 'Blue'] },
  ];
  return {
    version: 1,
    positionCategory: 'Pos',
    categories,
    clues: [],
    ...over,
  };
}

/** Collect the error codes from a validation result (empty if ok). */
function codes(p: Puzzle): string[] {
  const r = validatePuzzle(p);
  return r.ok ? [] : r.errors.map((e) => e.code);
}

describe('validatePuzzle §5.1/§5.3', () => {
  it('accepts a well-formed puzzle and reports n', () => {
    const r = validatePuzzle(
      puzzle({
        clues: [
          { id: 1, type: 'C3', x: { category: 'Pet', value: 'Cat' }, k: 1 },
          { id: 2, type: 'C1', x: { category: 'Pet', value: 'Dog' }, y: { category: 'Color', value: 'Red' } },
        ],
      }),
    );
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.n).toBe(3);
  });

  it('accepts a well-formed n=5 puzzle', () => {
    const r = validatePuzzle(
      puzzle({
        positionCategory: 'House',
        categories: [
          { name: 'House', values: ['1', '2', '3', '4', '5'], isPosition: true },
          { name: 'Nat', values: ['A', 'B', 'C', 'D', 'E'] },
          { name: 'Color', values: ['v', 'w', 'x', 'y', 'z'] },
        ],
      }),
    );
    expect(r.ok).toBe(true);
  });

  it('rejects a missing position category (NO_POSITION_CATEGORY)', () => {
    const p = puzzle({ positionCategory: 'Nope' });
    expect(codes(p)).toContain('NO_POSITION_CATEGORY');
  });

  it('rejects n out of range — too small (N_OUT_OF_RANGE)', () => {
    const p = puzzle({
      positionCategory: 'Pos',
      categories: [
        { name: 'Pos', values: ['1', '2'], isPosition: true },
        { name: 'Pet', values: ['Cat', 'Dog'] },
        { name: 'Color', values: ['Red', 'Green'] },
      ],
    });
    expect(codes(p)).toContain('N_OUT_OF_RANGE');
  });

  it('rejects n out of range — too large (N_OUT_OF_RANGE)', () => {
    const vals = Array.from({ length: 9 }, (_, i) => String(i + 1));
    const p = puzzle({
      positionCategory: 'Pos',
      categories: [
        { name: 'Pos', values: vals, isPosition: true },
        { name: 'A', values: vals.map((v) => `a${v}`) },
        { name: 'B', values: vals.map((v) => `b${v}`) },
      ],
    });
    expect(codes(p)).toContain('N_OUT_OF_RANGE');
  });

  it('rejects a cardinality mismatch (CARDINALITY_MISMATCH)', () => {
    const p = puzzle({
      categories: [
        { name: 'Pos', values: ['1', '2', '3'], isPosition: true },
        { name: 'Pet', values: ['Cat', 'Dog'] }, // only 2, needs 3
        { name: 'Color', values: ['Red', 'Green', 'Blue'] },
      ],
    });
    expect(codes(p)).toContain('CARDINALITY_MISMATCH');
  });

  it('rejects an unknown cell reference in a clue (UNKNOWN_CELL)', () => {
    const p = puzzle({
      clues: [{ id: 1, type: 'C3', x: { category: 'Pet', value: 'Hamster' }, k: 1 }],
    });
    expect(codes(p)).toContain('UNKNOWN_CELL');
  });

  it('rejects an unknown Y cell in a binary clue (UNKNOWN_CELL)', () => {
    const p = puzzle({
      clues: [
        {
          id: 1,
          type: 'C1',
          x: { category: 'Pet', value: 'Cat' },
          y: { category: 'Color', value: 'Purple' },
        },
      ],
    });
    expect(codes(p)).toContain('UNKNOWN_CELL');
  });

  it('rejects a self-referential binary clue (SAME_CELL)', () => {
    // §5.3: a value cannot be compared to itself (identical category AND value).
    const p = puzzle({
      clues: [
        {
          id: 1,
          type: 'C2',
          x: { category: 'Pet', value: 'Cat' },
          y: { category: 'Pet', value: 'Cat' },
        },
      ],
    });
    expect(codes(p)).toContain('SAME_CELL');
  });

  it('permits a same-category, different-value binary clue', () => {
    // The real validator allows same-category/different-value relations
    // (e.g. "green is immediately left of white"); only identical cells are
    // rejected. Such a clue is well-formed even if it makes the puzzle UNSAT.
    const r = validatePuzzle(
      puzzle({
        clues: [
          {
            id: 1,
            type: 'C5',
            x: { category: 'Color', value: 'Red' },
            y: { category: 'Color', value: 'Green' },
          },
        ],
      }),
    );
    expect(r.ok).toBe(true);
  });

  it('rejects a position out of range in C3 (POSITION_OUT_OF_RANGE)', () => {
    const p = puzzle({
      clues: [{ id: 1, type: 'C3', x: { category: 'Pet', value: 'Cat' }, k: 4 }],
    });
    expect(codes(p)).toContain('POSITION_OUT_OF_RANGE');
  });

  it('rejects position 0 in C4 (POSITION_OUT_OF_RANGE)', () => {
    const p = puzzle({
      clues: [{ id: 1, type: 'C4', x: { category: 'Pet', value: 'Cat' }, k: 0 }],
    });
    expect(codes(p)).toContain('POSITION_OUT_OF_RANGE');
  });

  it('rejects a contradictory C3 on the position category (CONTRADICTORY_POSITION)', () => {
    // (Pos,2) is the position value 2, so "at position 1" is contradictory.
    const p = puzzle({
      clues: [{ id: 1, type: 'C3', x: { category: 'Pos', value: '2' }, k: 1 }],
    });
    expect(codes(p)).toContain('CONTRADICTORY_POSITION');
  });

  it('rejects a contradictory C4 on the position category (CONTRADICTORY_POSITION)', () => {
    // (Pos,2) must be at position 2, so "not at position 2" is contradictory.
    const p = puzzle({
      clues: [{ id: 1, type: 'C4', x: { category: 'Pos', value: '2' }, k: 2 }],
    });
    expect(codes(p)).toContain('CONTRADICTORY_POSITION');
  });

  it('rejects too many clues (TOO_MANY_CLUES)', () => {
    const clues: Clue[] = Array.from({ length: 51 }, (_, i) => ({
      id: i + 1,
      type: 'C4',
      x: { category: 'Pet', value: 'Cat' },
      k: 1,
    }));
    expect(codes(puzzle({ clues }))).toContain('TOO_MANY_CLUES');
  });

  it('rejects a duplicate value within a category (DUPLICATE_VALUE)', () => {
    const p = puzzle({
      categories: [
        { name: 'Pos', values: ['1', '2', '3'], isPosition: true },
        { name: 'Pet', values: ['Cat', 'Cat', 'Bird'] },
        { name: 'Color', values: ['Red', 'Green', 'Blue'] },
      ],
    });
    expect(codes(p)).toContain('DUPLICATE_VALUE');
  });

  it('rejects duplicate clue ids (DUPLICATE_CLUE_ID)', () => {
    const p = puzzle({
      clues: [
        { id: 1, type: 'C3', x: { category: 'Pet', value: 'Cat' }, k: 1 },
        { id: 1, type: 'C3', x: { category: 'Pet', value: 'Dog' }, k: 2 },
      ],
    });
    expect(codes(p)).toContain('DUPLICATE_CLUE_ID');
  });

  it('rejects too few categories (CATEGORY_COUNT)', () => {
    const p = puzzle({
      categories: [
        { name: 'Pos', values: ['1', '2', '3'], isPosition: true },
        { name: 'Pet', values: ['Cat', 'Dog', 'Bird'] },
      ],
    });
    expect(codes(p)).toContain('CATEGORY_COUNT');
  });

  it('error objects carry code and message', () => {
    const r = validatePuzzle(puzzle({ positionCategory: 'Nope' }));
    expect(r.ok).toBe(false);
    if (!r.ok) {
      for (const e of r.errors) {
        expect(typeof e.code).toBe('string');
        expect(typeof e.message).toBe('string');
        expect(e.message.length).toBeGreaterThan(0);
      }
    }
  });
});
