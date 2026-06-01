/**
 * SAT solving (SPECS §4, §5.5).
 *
 * The rest of the system depends on the `SatSolver` *interface*, never on a
 * concrete solver. The default implementation wraps `logic-solver`
 * (Emscripten-compiled MiniSat). Because the dependency is inverted behind an
 * interface, the solver is swappable (e.g. for a native build or a test double)
 * without touching the pipeline — composition over inheritance applied at the
 * integration boundary.
 */
import Logic from 'logic-solver';
import type { Clause } from './clues/context';

export interface SatModel {
  /** Indices of variables assigned true. */
  readonly trueVars: ReadonlySet<number>;
}

export type SatOutcome =
  | { readonly status: 'sat'; readonly model: SatModel }
  | { readonly status: 'unsat' };

/** An incremental solver instance over a fixed clause set. */
export interface IncrementalSolver {
  solve(): SatOutcome;
  /** Add a blocking clause forbidding exactly `model` (§5.5 step 3). */
  block(model: SatModel): void;
}

export interface SatSolver {
  create(numVars: number, clauses: readonly Clause[]): IncrementalSolver;
}

function litName(lit: number): Logic.Formula {
  const name = `v${Math.abs(lit)}`;
  return lit < 0 ? Logic.not(name) : name;
}

class MiniSatIncremental implements IncrementalSolver {
  private readonly solver = new Logic.Solver();
  private hasEmptyClause = false;

  constructor(
    private readonly numVars: number,
    clauses: readonly Clause[],
  ) {
    for (const clause of clauses) {
      if (clause.length === 0) {
        // The empty clause is falsum; record it and skip (logic-solver has no
        // literal for it). The instance is unconditionally UNSAT.
        this.hasEmptyClause = true;
        continue;
      }
      this.solver.require(Logic.or(...clause.map(litName)));
    }
  }

  solve(): SatOutcome {
    if (this.hasEmptyClause) return { status: 'unsat' };
    const sol = this.solver.solve();
    if (!sol) return { status: 'unsat' };
    const map = sol.getMap();
    const trueVars = new Set<number>();
    for (let v = 1; v <= this.numVars; v++) {
      if (map[`v${v}`]) trueVars.add(v);
    }
    return { status: 'sat', model: { trueVars } };
  }

  block(model: SatModel): void {
    const literals: Logic.Formula[] = [];
    for (let v = 1; v <= this.numVars; v++) {
      literals.push(model.trueVars.has(v) ? `v${v}` : Logic.not(`v${v}`));
    }
    // Forbid the full assignment → ¬(l1 ∧ l2 ∧ ...).
    this.solver.forbid(Logic.and(...literals));
  }
}

export const miniSatSolver: SatSolver = {
  create(numVars, clauses) {
    return new MiniSatIncremental(numVars, clauses);
  },
};
