/**
 * Solving pipeline (SPECS §5.5).
 *
 * validate → encode → solve → classify (unique / under-constrained / UNSAT).
 * Explanation generation (§5.6) is a separate, composable step invoked by the
 * caller on a unique result, so the pipeline stays free of UI/narrative concerns.
 *
 * The SAT solver is injected for testability; the default is MiniSat.
 */
import type { Assignment, Cell, Puzzle } from './types';
import type { Cnf } from './encoder';
import { encodePuzzle } from './encoder';
import type { SatModel, SatSolver } from './sat';
import { miniSatSolver } from './sat';
import { validatePuzzle, type ValidationError } from './validation';
import { decodeAssignment, ambiguousCells } from './assignment';
import { extractMus } from './mus';

export interface UniqueResult {
  readonly status: 'unique';
  readonly puzzle: Puzzle;
  readonly cnf: Cnf;
  readonly assignment: Assignment;
  readonly model: SatModel;
}

export interface MultipleResult {
  readonly status: 'multiple';
  readonly assignmentA: Assignment;
  readonly assignmentB: Assignment;
  readonly ambiguous: Cell[];
}

export interface UnsatResult {
  readonly status: 'unsat';
  /** Clue ids forming a minimal unsatisfiable subset (§5.8). */
  readonly mus: number[];
}

export interface InvalidResult {
  readonly status: 'invalid';
  readonly errors: ValidationError[];
}

export type SolveResult =
  | UniqueResult
  | MultipleResult
  | UnsatResult
  | InvalidResult;

export function solvePuzzle(
  puzzle: Puzzle,
  solver: SatSolver = miniSatSolver,
): SolveResult {
  const validation = validatePuzzle(puzzle);
  if (!validation.ok) return { status: 'invalid', errors: validation.errors };

  const cnf = encodePuzzle(puzzle);
  const instance = solver.create(cnf.numVars, cnf.allClauses);

  const first = instance.solve();
  if (first.status === 'unsat') {
    // §5.5 step 5: over-constrained → MUS.
    return { status: 'unsat', mus: extractMus(cnf, solver) };
  }

  // §5.5 step 3: block the found assignment and re-solve to test uniqueness.
  instance.block(first.model);
  const second = instance.solve();

  if (second.status === 'unsat') {
    return {
      status: 'unique',
      puzzle,
      cnf,
      assignment: decodeAssignment(puzzle, cnf, first.model),
      model: first.model,
    };
  }

  // Under-constrained (§5.7).
  const assignmentA = decodeAssignment(puzzle, cnf, first.model);
  const assignmentB = decodeAssignment(puzzle, cnf, second.model);
  return {
    status: 'multiple',
    assignmentA,
    assignmentB,
    ambiguous: ambiguousCells(puzzle, assignmentA, assignmentB),
  };
}
