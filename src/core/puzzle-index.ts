/**
 * Lightweight, dependency-free index over a puzzle's declared cells, plus the
 * shared `ValidationError` shape. Extracted into its own module so both the
 * validator and the per-clue handlers can depend on it without a dependency
 * cycle (validation → registry → handlers → here).
 */
import type { Cell, Puzzle } from './types';
import { cellKey } from './types';

export interface ValidationError {
  readonly code: string;
  readonly message: string;
  readonly clueId?: number;
}

export interface PuzzleIndex {
  readonly n: number;
  readonly positionCategory: string;
  readonly categoriesByName: Map<string, string[]>;
  /** Set of valid `cellKey` strings. */
  readonly cells: Set<string>;
}

export function buildIndex(puzzle: Puzzle): PuzzleIndex {
  const categoriesByName = new Map<string, string[]>();
  const cells = new Set<string>();
  for (const c of puzzle.categories) {
    categoriesByName.set(c.name, c.values);
    for (const v of c.values) cells.add(cellKey({ category: c.name, value: v }));
  }
  const posCat = puzzle.categories.find((c) => c.name === puzzle.positionCategory);
  return {
    n: posCat ? posCat.values.length : 0,
    positionCategory: puzzle.positionCategory,
    categoriesByName,
    cells,
  };
}

export function cellExists(index: PuzzleIndex, cell: Cell): boolean {
  return index.cells.has(cellKey(cell));
}

export function isPositionCell(index: PuzzleIndex, cell: Cell): boolean {
  return cell.category === index.positionCategory;
}

/** The fixed integer position of a position-category cell, or null otherwise. */
export function fixedPositionOf(index: PuzzleIndex, cell: Cell): number | null {
  if (cell.category !== index.positionCategory) return null;
  const p = Number(cell.value);
  return Number.isInteger(p) ? p : null;
}
