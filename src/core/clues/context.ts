/**
 * CNF building blocks shared by every clue handler (SPECS §5.4).
 *
 * A clause is a list of integer literals (positive = variable true, negative =
 * variable false), per the canonical integer encoding the spec asks for. The
 * `EncodeContext` hides two concerns from the handlers:
 *
 *  1. Variable numbering — handlers never compute indices themselves.
 *  2. Position-category references — "X at position p" where X is a
 *     position-category cell resolves to a boolean *constant* (true iff the
 *     value equals p), because the position axis has no CNF variables (§5.4).
 *
 * Handlers therefore express semantics in terms of "cell is at position p"
 * atoms and let the context resolve constants and drop tautologies. This is the
 * composition seam: the encoder owns numbering/solving; handlers own meaning.
 */
import type { Cell } from '../types';

/** Nonzero integer literal. */
export type Lit = number;
/** A disjunction of literals. The empty clause denotes falsum (UNSAT). */
export type Clause = Lit[];

/** "Cell is at position p" resolved to either a variable or a constant. */
export type Atom =
  | { readonly kind: 'true' }
  | { readonly kind: 'false' }
  | { readonly kind: 'var'; readonly lit: number };

/** An atom with polarity, i.e. a literal within a clause under construction. */
export interface Signed {
  readonly atom: Atom;
  readonly neg: boolean;
}

export interface EncodeContext {
  readonly n: number;

  /** Positive literal: "cell is at position p". */
  at(cell: Cell, p: number): Signed;
  /** Negative literal: "cell is NOT at position p". */
  notAt(cell: Cell, p: number): Signed;

  /**
   * Assemble a clause, resolving constants:
   *  - a literal that is necessarily true makes the clause a tautology → null
   *    (the caller drops it);
   *  - a literal that is necessarily false is omitted;
   *  - if nothing remains and the clause is not a tautology, the empty clause
   *    `[]` is returned (falsum), which correctly forces UNSAT.
   */
  clause(literals: Signed[]): Clause | null;
}
