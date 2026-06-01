/**
 * Helpers to turn a SAT model into a human-meaningful `Assignment` and to
 * compare assignments (SPECS §5.5, §5.7).
 */
import type { Assignment, Cell, Puzzle } from './types';
import type { Cnf } from './encoder';
import type { SatModel } from './sat';

/**
 * Decode a SAT model into an Assignment mapping every (category, value) to its
 * 1-indexed position. The position category maps to itself.
 */
export function decodeAssignment(
  puzzle: Puzzle,
  cnf: Cnf,
  model: SatModel,
): Assignment {
  const assignment: Assignment = {};
  for (const cat of puzzle.categories) assignment[cat.name] = {};

  // Position category: value "p" → position p.
  const posCat = puzzle.categories.find(
    (c) => c.name === puzzle.positionCategory,
  )!;
  for (const v of posCat.values) assignment[posCat.name][v] = Number(v);

  // Non-position categories: read the true variables.
  for (const v of model.trueVars) {
    const { category, value, position } = cnf.varMap.decode(v);
    assignment[category][value] = position;
  }
  return assignment;
}

/** Cells whose position differs between two assignments (the ambiguous ones). */
export function ambiguousCells(
  puzzle: Puzzle,
  a: Assignment,
  b: Assignment,
): Cell[] {
  const out: Cell[] = [];
  for (const cat of puzzle.categories) {
    if (cat.name === puzzle.positionCategory) continue;
    for (const value of cat.values) {
      if (a[cat.name]?.[value] !== b[cat.name]?.[value]) {
        out.push({ category: cat.name, value });
      }
    }
  }
  return out;
}
