/**
 * Verbal explanation of an over-constrained puzzle's MUS (SPECS §5.8).
 *
 * Runs a *simplified* propagation (direct placements, relation narrowing, and
 * bijection elimination — no SAT, no oracle) over only the MUS clues and tries
 * to surface the squeeze: a cell left with no possible position, or a position
 * with no possible value. Propagation is incomplete in general, so when it
 * cannot pinpoint the empty cell it falls back to a clue-listing summary.
 */
import type { Cell, Puzzle } from '../types';
import { getClueHandler } from '../clues/registry';
import { isBinaryClue } from '../types';
import { KnowledgeState } from './state';

export function explainConflict(puzzle: Puzzle, musIds: number[]): string {
  const idSet = new Set(musIds);
  const clues = puzzle.clues.filter((c) => idSet.has(c.id));
  const state = new KnowledgeState(puzzle);
  let emptyCell: Cell | undefined;

  const eliminate = (cell: Cell, p: number): boolean => {
    const changed = state.eliminate(cell, p);
    if (changed && state.possible(cell).size === 0) emptyCell = cell;
    return changed;
  };

  let changed = true;
  let guard = 0;
  while (changed && !emptyCell && guard++ < 1000) {
    changed = false;

    // Direct placements / exclusions.
    for (const clue of clues) {
      if (clue.type === 'C3' && !state.isPositionCell(clue.x)) {
        for (const p of [...state.possible(clue.x)]) {
          if (p !== clue.k && eliminate(clue.x, p)) changed = true;
        }
      } else if (clue.type === 'C4' && !state.isPositionCell(clue.x)) {
        if (state.possible(clue.x).has(clue.k) && eliminate(clue.x, clue.k)) {
          changed = true;
        }
      }
    }

    // Relation narrowing for binary clues.
    for (const clue of clues) {
      if (!isBinaryClue(clue)) continue;
      const rel = getClueHandler(clue.type).relation;
      if (!rel) continue;
      changed = narrow(state, clue.x, clue.y, rel, eliminate) || changed;
      changed =
        narrow(state, clue.y, clue.x, (py, px) => rel(px, py), eliminate) ||
        changed;
    }

    // Bijection: a pinned cell frees its position from category siblings.
    for (const cell of state.cells) {
      const p = state.pinnedPosition(cell);
      if (p === undefined) continue;
      for (const v of valuesOf(puzzle, cell.category)) {
        if (v === cell.value) continue;
        const sibling = { category: cell.category, value: v };
        if (state.possible(sibling).has(p) && eliminate(sibling, p)) {
          changed = true;
        }
      }
    }
  }

  const list = clues
    .map((c) => `clue ${c.id} (${getClueHandler(c.type).describe(c)})`)
    .join(', ');

  const head = `These clues together are contradictory: ${musIds.join(', ')}. Removing any one of them resolves the contradiction.`;

  if (emptyCell) {
    return `${head} Following ${list}, ${emptyCell.value} (${emptyCell.category}) is forced out of every position, which is impossible.`;
  }
  return `${head} Together (${list}) they cannot be satisfied simultaneously.`;
}

function narrow(
  state: KnowledgeState,
  target: Cell,
  other: Cell,
  ok: (tp: number, op: number) => boolean,
  eliminate: (cell: Cell, p: number) => boolean,
): boolean {
  if (state.isPositionCell(target)) return false;
  const otherPoss = [...state.possible(other)];
  let changed = false;
  for (const tp of [...state.possible(target)]) {
    if (!otherPoss.some((op) => ok(tp, op))) {
      if (eliminate(target, tp)) changed = true;
    }
  }
  return changed;
}

function valuesOf(puzzle: Puzzle, category: string): string[] {
  return puzzle.categories.find((c) => c.name === category)?.values ?? [];
}
