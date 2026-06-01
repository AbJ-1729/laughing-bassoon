/**
 * Turns the raw solving pipeline result (§5.5) into the plain, serialisable
 * `SolveReport` the UI consumes — attaching the deduction chain for unique
 * puzzles (§5.6) and the verbal conflict explanation for UNSAT ones (§5.8).
 *
 * Kept pure and worker-free so it can run synchronously in tests and as a
 * fallback when Web Workers are unavailable.
 */
import type { Puzzle } from './types';
import type { SatSolver } from './sat';
import { miniSatSolver } from './sat';
import { solvePuzzle } from './pipeline';
import { explain } from './inference/engine';
import { explainConflict } from './inference/mus-explain';
import type { SolveReport } from '../worker/protocol';

export function buildReport(
  puzzle: Puzzle,
  solver: SatSolver = miniSatSolver,
): SolveReport {
  const result = solvePuzzle(puzzle, solver);
  switch (result.status) {
    case 'unique':
      return {
        status: 'unique',
        assignment: result.assignment,
        explanation: explain(puzzle, result.assignment),
      };
    case 'multiple':
      return {
        status: 'multiple',
        assignmentA: result.assignmentA,
        assignmentB: result.assignmentB,
        ambiguous: result.ambiguous,
      };
    case 'unsat':
      return {
        status: 'unsat',
        mus: result.mus,
        conflictText: explainConflict(puzzle, result.mus),
      };
    case 'invalid':
      return { status: 'invalid', errors: result.errors };
  }
}
