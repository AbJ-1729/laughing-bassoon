/**
 * Minimal ambient types for `logic-solver` (Emscripten-compiled MiniSat).
 * Only the surface we use is declared.
 */
declare module 'logic-solver' {
  export type Formula = string | NumTerm | Formula[];
  export interface NumTerm {
    readonly _isFormula?: true;
  }

  export interface Solution {
    getMap(): Record<string, boolean>;
    getTrueVars(): string[];
    evaluate(formula: Formula): boolean;
  }

  export class Solver {
    require(...formulas: Formula[]): void;
    forbid(...formulas: Formula[]): void;
    solve(): Solution | null;
    solveAssuming(formula: Formula): Solution | null;
  }

  export function or(...args: Formula[]): Formula;
  export function and(...args: Formula[]): Formula;
  export function not(arg: Formula): Formula;
  export function xor(...args: Formula[]): Formula;
  export function implies(a: Formula, b: Formula): Formula;
  export function equiv(a: Formula, b: Formula): Formula;
  export function exactlyOne(...args: Formula[]): Formula;
  export function atMostOne(...args: Formula[]): Formula;

  export const TRUE: string;
  export const FALSE: string;
}
