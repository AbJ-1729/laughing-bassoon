/**
 * Minimal Unsatisfiable Subset extraction (SPECS §5.8).
 *
 * Deletion-based algorithm: start with all user clues; try removing each in
 * turn; if the instance stays UNSAT without it, drop it permanently; otherwise
 * keep it. The implicit bijection constraints are always present and never
 * removed. The result is a minimal core — removing any one clue makes it SAT.
 *
 * The solver is injected (default MiniSat), so this is solver-agnostic.
 */
import type { Cnf } from './encoder';
import type { Clause } from './clues/context';
import type { SatSolver } from './sat';
import { miniSatSolver } from './sat';

function isUnsat(
  solver: SatSolver,
  numVars: number,
  implicit: readonly Clause[],
  groups: { clueId: number; clauses: Clause[] }[],
  keep: ReadonlySet<number>,
): boolean {
  const clauses: Clause[] = [...implicit];
  for (const g of groups) {
    if (keep.has(g.clueId)) clauses.push(...g.clauses);
  }
  return solver.create(numVars, clauses).solve().status === 'unsat';
}

/**
 * @returns the clue ids forming a minimal unsatisfiable subset.
 * @throws if the full instance is actually SAT (caller must only invoke on UNSAT).
 */
export function extractMus(cnf: Cnf, solver: SatSolver = miniSatSolver): number[] {
  const groups = cnf.clueGroups.map((g) => ({ ...g }));
  let core = new Set<number>(groups.map((g) => g.clueId));

  if (!isUnsat(solver, cnf.numVars, cnf.implicitClauses, groups, core)) {
    throw new Error('extractMus called on a satisfiable instance');
  }

  for (const g of groups) {
    if (!core.has(g.clueId)) continue;
    const candidate = new Set(core);
    candidate.delete(g.clueId);
    if (isUnsat(solver, cnf.numVars, cnf.implicitClauses, groups, candidate)) {
      core = candidate; // clue not needed for the contradiction
    }
  }

  return [...core].sort((a, b) => a - b);
}
