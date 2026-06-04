/**
 * Unit tests for explainConflict (SPECS §5.8 verbal explanation).
 *
 * Three distinct paths through the function:
 *  1. emptyCell detected via relation narrowing (C3 + C8 squeeze).
 *  2. emptyCell detected via bijection (two C3 clues placing different values
 *     at the same position — bijection propagation empties one sibling).
 *  3. Fallback: propagation cannot pinpoint an empty cell (C1+C2 on the same
 *     pair — arc-consistency alone produces no elimination).
 *
 * Also verifies the §5.8-mandated message format and clue listing.
 */
import { describe, it, expect } from 'vitest';
import type { Puzzle } from '@/core/types';
import { explainConflict } from '@/core/inference/mus-explain';

function base(clues: Puzzle['clues']): Puzzle {
  return {
    version: 1,
    positionCategory: 'Pos',
    categories: [
      { name: 'Pos', values: ['1', '2', '3'], isPosition: true },
      { name: 'Animal', values: ['Fox', 'Owl', 'Bat'] },
      { name: 'Tag', values: ['A', 'B', 'C'] },
    ],
    clues,
  };
}

describe('explainConflict §5.8', () => {
  // ── Path 1: emptyCell via relation narrowing ──────────────────────────────
  it('detects empty cell squeezed by C3 + C8 (relation-narrowing path)', () => {
    // Fox at position 1; Owl must be somewhere LEFT of Fox.
    // Fox's only possible position is 1, so Owl needs pos < 1 → impossible.
    const puzzle = base([
      { id: 1, type: 'C3', x: { category: 'Animal', value: 'Fox' }, k: 1 },
      { id: 2, type: 'C8', x: { category: 'Animal', value: 'Owl' }, y: { category: 'Animal', value: 'Fox' } },
    ]);
    const text = explainConflict(puzzle, [1, 2]);

    // §5.8 required header.
    expect(text).toMatch(/contradictory/i);
    expect(text).toContain('1, 2');
    expect(text).toContain('Removing any one of them resolves the contradiction');

    // Rich path: names the squeezed cell.
    expect(text).toContain('Owl');
    expect(text).toMatch(/forced out of every position/);
  });

  // ── Path 2: emptyCell via bijection ──────────────────────────────────────
  it('detects empty cell via bijection (two C3 clues at the same position)', () => {
    // Both Fox and Owl are forced to position 1.
    // Direct propagation pins both; bijection then eliminates Owl from pos 1
    // (Fox already occupies it) → Owl possible = {} → emptyCell.
    const puzzle = base([
      { id: 1, type: 'C3', x: { category: 'Animal', value: 'Fox' }, k: 1 },
      { id: 2, type: 'C3', x: { category: 'Animal', value: 'Owl' }, k: 1 },
    ]);
    const text = explainConflict(puzzle, [1, 2]);

    expect(text).toMatch(/contradictory/i);
    expect(text).toContain('1, 2');
    // Bijection path also produces the emptyCell message.
    expect(text).toMatch(/forced out of every position/);
  });

  // ── Path 3: fallback (no emptyCell detected) ──────────────────────────────
  it('falls back to generic message when propagation cannot find empty cell', () => {
    // C1: Fox is at same position as Owl (same-category — contradicts bijection).
    // Arc-consistency alone cannot detect the contradiction: for every Fox
    // position there is still an Owl position satisfying p1 === p2, and vice
    // versa. Only SAT (which sees the bijection globally) can prove UNSAT.
    const puzzle = base([
      { id: 1, type: 'C1', x: { category: 'Animal', value: 'Fox' }, y: { category: 'Animal', value: 'Owl' } },
    ]);
    const text = explainConflict(puzzle, [1]);

    expect(text).toMatch(/contradictory/i);
    expect(text).toContain('Removing any one of them resolves the contradiction');
    // Must NOT claim to have found the empty cell.
    expect(text).not.toMatch(/forced out of every position/);
    // Fallback path lists clue description.
    expect(text).toContain('clue 1');
  });

  // ── Message format ────────────────────────────────────────────────────────
  it('lists all MUS clue IDs in the header', () => {
    const puzzle = base([
      { id: 3, type: 'C3', x: { category: 'Animal', value: 'Fox' }, k: 1 },
      { id: 7, type: 'C8', x: { category: 'Animal', value: 'Owl' }, y: { category: 'Animal', value: 'Fox' } },
    ]);
    const text = explainConflict(puzzle, [3, 7]);
    expect(text).toContain('3, 7');
  });

  it('includes the clue descriptions in the output', () => {
    const puzzle = base([
      { id: 1, type: 'C3', x: { category: 'Animal', value: 'Fox' }, k: 1 },
      { id: 2, type: 'C8', x: { category: 'Animal', value: 'Owl' }, y: { category: 'Animal', value: 'Fox' } },
    ]);
    const text = explainConflict(puzzle, [1, 2]);
    // Both clues should appear by their descriptions in the output.
    expect(text).toContain('clue 1');
    expect(text).toContain('clue 2');
  });

  it('handles C4 (not-at-position) clues in the MUS', () => {
    // Fox not at position 1, Fox not at position 2, Fox not at position 3
    // → Fox has no valid position → emptyCell.
    const puzzle = base([
      { id: 1, type: 'C4', x: { category: 'Animal', value: 'Fox' }, k: 1 },
      { id: 2, type: 'C4', x: { category: 'Animal', value: 'Fox' }, k: 2 },
      { id: 3, type: 'C4', x: { category: 'Animal', value: 'Fox' }, k: 3 },
    ]);
    const text = explainConflict(puzzle, [1, 2, 3]);
    expect(text).toMatch(/contradictory/i);
    expect(text).toContain('Fox');
    expect(text).toMatch(/forced out of every position/);
  });

  it('handles a single-clue MUS gracefully', () => {
    // One C3 clue referencing the same position twice is valid here — the
    // MUS contains only id=1 and the message should still be well-formed.
    const puzzle = base([
      { id: 1, type: 'C3', x: { category: 'Animal', value: 'Fox' }, k: 1 },
      { id: 2, type: 'C3', x: { category: 'Animal', value: 'Owl' }, k: 1 },
    ]);
    const text = explainConflict(puzzle, [1]);
    expect(text).toMatch(/contradictory/i);
    expect(typeof text).toBe('string');
    expect(text.length).toBeGreaterThan(0);
  });
});
