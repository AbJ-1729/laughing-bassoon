/**
 * Derives the grid's per-cell mark (§6.1 ✓/✗/?) from a knowledge-state
 * snapshot, and selects the snapshot for the current playback step (§6.2).
 */
import type { Puzzle } from '../core/types';
import { cellKey } from '../core/types';
import type { PositionSnapshot } from '../core/inference/types';
import type { SolveOutcome } from '../worker/client';

export type CellMark = 'true' | 'false' | 'unknown';

export function markFor(
  snapshot: PositionSnapshot,
  category: string,
  value: string,
  position: number,
): CellMark {
  const possible = snapshot[cellKey({ category, value })];
  if (!possible) return 'unknown';
  if (possible.length === 1 && possible[0] === position) return 'true';
  if (!possible.includes(position)) return 'false';
  return 'unknown';
}

/** An all-unknown snapshot for a puzzle (used before solving / for non-unique). */
export function blankSnapshot(puzzle: Puzzle): PositionSnapshot {
  const n =
    puzzle.categories.find((c) => c.name === puzzle.positionCategory)?.values
      .length ?? 0;
  const all = Array.from({ length: n }, (_, i) => i + 1);
  const snap: PositionSnapshot = {};
  for (const cat of puzzle.categories) {
    if (cat.name === puzzle.positionCategory) continue;
    for (const v of cat.values) snap[cellKey({ category: cat.name, value: v })] = all;
  }
  return snap;
}

/** Build a fully-pinned snapshot from a complete assignment (for under-constrained views). */
export function snapshotFromAssignment(
  puzzle: Puzzle,
  assignment: Record<string, Record<string, number>>,
): PositionSnapshot {
  const snap: PositionSnapshot = {};
  for (const cat of puzzle.categories) {
    if (cat.name === puzzle.positionCategory) continue;
    for (const v of cat.values) {
      snap[cellKey({ category: cat.name, value: v })] = [assignment[cat.name][v]];
    }
  }
  return snap;
}

/** The snapshot to render for the given playback step. */
export function snapshotForStep(
  puzzle: Puzzle,
  report: SolveOutcome | null,
  stepIndex: number,
): PositionSnapshot {
  if (report && report.status === 'unique') {
    const snaps = report.explanation.snapshots;
    return snaps[Math.min(stepIndex, snaps.length - 1)] ?? blankSnapshot(puzzle);
  }
  return blankSnapshot(puzzle);
}
