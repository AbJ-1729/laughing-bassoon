/**
 * Worker protocol (SPECS §5.5). All payloads are plain, structured-cloneable
 * data — no class instances, Sets or functions cross the worker boundary.
 */
import type { Assignment, Cell, Puzzle } from '../core/types';
import type { Explanation } from '../core/inference/types';
import type { ValidationError } from '../core/puzzle-index';

export interface SolveRequest {
  readonly puzzle: Puzzle;
}

export type SolveReport =
  | { readonly status: 'unique'; readonly assignment: Assignment; readonly explanation: Explanation }
  | {
      readonly status: 'multiple';
      readonly assignmentA: Assignment;
      readonly assignmentB: Assignment;
      readonly ambiguous: Cell[];
    }
  | { readonly status: 'unsat'; readonly mus: number[]; readonly conflictText: string }
  | { readonly status: 'invalid'; readonly errors: ValidationError[] }
  | { readonly status: 'error'; readonly message: string };
