/**
 * Mutable knowledge state for the inference engine (SPECS §5.6).
 *
 * Tracks, for each non-position cell, the set of positions it could still
 * occupy (initially {1..n}). The dual "possible values per (category,
 * position)" view (§5.6) is derived on demand — cheap at n ≤ 8 and avoids
 * keeping two structures in sync.
 *
 * Position-category cells are constants: "(Pos, q)" is always at position q and
 * is never tracked here (§5.4). `possible()` returns the frozen singleton {q}
 * for them so the propagation rules can treat all operands uniformly.
 */
import type { Cell, Puzzle } from '../types';
import { cellKey } from '../types';

export class KnowledgeState {
  readonly n: number;
  private readonly positionCategory: string;
  private readonly sets = new Map<string, Set<number>>();
  /** Non-position cells, in a stable order. */
  readonly cells: Cell[] = [];

  constructor(puzzle: Puzzle) {
    const posCat = puzzle.categories.find(
      (c) => c.name === puzzle.positionCategory,
    )!;
    this.n = posCat.values.length;
    this.positionCategory = puzzle.positionCategory;
    const allPositions = Array.from({ length: this.n }, (_, i) => i + 1);
    for (const cat of puzzle.categories) {
      if (cat.name === this.positionCategory) continue;
      for (const value of cat.values) {
        const cell = { category: cat.name, value };
        this.cells.push(cell);
        this.sets.set(cellKey(cell), new Set(allPositions));
      }
    }
  }

  isPositionCell(cell: Cell): boolean {
    return cell.category === this.positionCategory;
  }

  /** The positions `cell` may still occupy. Constants for position cells. */
  possible(cell: Cell): ReadonlySet<number> {
    if (this.isPositionCell(cell)) return new Set([Number(cell.value)]);
    return this.sets.get(cellKey(cell))!;
  }

  isPinned(cell: Cell): boolean {
    return this.possible(cell).size === 1;
  }

  pinnedPosition(cell: Cell): number | undefined {
    const s = this.possible(cell);
    return s.size === 1 ? [...s][0] : undefined;
  }

  /** Remove a position from a (non-position) cell. Returns whether it changed. */
  eliminate(cell: Cell, position: number): boolean {
    if (this.isPositionCell(cell)) return false; // constants are immutable
    const set = this.sets.get(cellKey(cell))!;
    return set.delete(position);
  }

  /** Values of `category` that can still occupy `position`. */
  valuesAt(category: string, position: number, values: string[]): string[] {
    return values.filter((v) =>
      this.possible({ category, value: v }).has(position),
    );
  }

  /** True once every non-position cell is pinned to a single position. */
  isComplete(): boolean {
    return this.cells.every((c) => this.isPinned(c));
  }

  snapshotPossible(cell: Cell): number[] {
    return [...this.possible(cell)].sort((a, b) => a - b);
  }
}
