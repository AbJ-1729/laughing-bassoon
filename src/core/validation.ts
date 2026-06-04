/**
 * Schema validation (SPECS §5.1). Ill-formed puzzles are rejected here, before
 * any encoding or solving is attempted, with messages identifying the specific
 * violation.
 *
 * Per-clue argument checks are delegated to each clue type's handler (§5.3),
 * keeping this module agnostic of individual clue semantics — composition.
 */
import type { Clue, Puzzle } from './types';
import { isPositionalClue } from './types';
import { getClueHandler } from './clues/registry';
import type { PuzzleIndex, ValidationError } from './puzzle-index';
import { buildIndex, cellExists } from './puzzle-index';

export type { ValidationError, PuzzleIndex } from './puzzle-index';

export type ValidationResult =
  | { readonly ok: true; readonly n: number }
  | { readonly ok: false; readonly errors: ValidationError[] };

const MIN_N = 3;
const MAX_N = 8;
const MIN_CATEGORIES = 3;
const MAX_CATEGORIES = 6;
const MAX_CLUES = 50;
const MAX_TITLE = 100;
const MAX_DESCRIPTION = 500;

export function validatePuzzle(puzzle: Puzzle): ValidationResult {
  const errors: ValidationError[] = [];

  // --- Metadata bounds (§5.1.3) ---
  if (puzzle.title && puzzle.title.length > MAX_TITLE) {
    errors.push({ code: 'TITLE_TOO_LONG', message: `Title must be ≤${MAX_TITLE} characters.` });
  }
  if (puzzle.description && puzzle.description.length > MAX_DESCRIPTION) {
    errors.push({
      code: 'DESCRIPTION_TOO_LONG',
      message: `Description must be ≤${MAX_DESCRIPTION} characters.`,
    });
  }

  // --- Category count (§5.1.1) ---
  if (
    puzzle.categories.length < MIN_CATEGORIES ||
    puzzle.categories.length > MAX_CATEGORIES
  ) {
    errors.push({
      code: 'CATEGORY_COUNT',
      message: `A puzzle must have between ${MIN_CATEGORIES} and ${MAX_CATEGORIES} categories (found ${puzzle.categories.length}).`,
    });
  }

  // --- Unique, non-empty category names ---
  const seenCatNames = new Set<string>();
  for (const c of puzzle.categories) {
    if (!c.name || !c.name.trim()) {
      errors.push({
        code: 'EMPTY_CATEGORY_NAME',
        message: 'A category has an empty or whitespace-only name.',
      });
    }
    if (seenCatNames.has(c.name)) {
      errors.push({
        code: 'DUPLICATE_CATEGORY',
        message: `Duplicate category name "${c.name}".`,
      });
    }
    seenCatNames.add(c.name);
    // Unique, non-empty values within a category (§5.1.1, case-sensitive).
    const seenVals = new Set<string>();
    for (const v of c.values) {
      if (v.length === 0) {
        errors.push({
          code: 'EMPTY_VALUE',
          message: `Category "${c.name}" has an empty value label.`,
        });
      }
      if (seenVals.has(v)) {
        errors.push({
          code: 'DUPLICATE_VALUE',
          message: `Category "${c.name}" has a duplicate value "${v}".`,
        });
      }
      seenVals.add(v);
    }
  }

  // --- Position category presence & uniqueness (§5.1, §3) ---
  const positionCats = puzzle.categories.filter(
    (c) => c.name === puzzle.positionCategory,
  );
  const flaggedPositionCats = puzzle.categories.filter((c) => c.isPosition);
  if (positionCats.length === 0) {
    errors.push({
      code: 'NO_POSITION_CATEGORY',
      message: `Position category "${puzzle.positionCategory}" is not among the declared categories.`,
    });
  }
  if (flaggedPositionCats.length > 1) {
    errors.push({
      code: 'MULTIPLE_POSITION_CATEGORIES',
      message: `Exactly one category may be the position category (found ${flaggedPositionCats.length}).`,
    });
  }

  // Cross-validate: any category flagged isPosition:true must be the declared positionCategory.
  for (const c of puzzle.categories) {
    if (c.isPosition && c.name !== puzzle.positionCategory) {
      errors.push({
        code: 'POSITION_FLAG_MISMATCH',
        message: `Category "${c.name}" has isPosition: true but is not the declared positionCategory "${puzzle.positionCategory}".`,
      });
    }
  }

  const posCat = positionCats[0];
  const n = posCat ? posCat.values.length : 0;

  // --- n bounds (§5.1) ---
  if (posCat) {
    if (n < MIN_N || n > MAX_N) {
      errors.push({
        code: 'N_OUT_OF_RANGE',
        message: `The position category must have between ${MIN_N} and ${MAX_N} values (found ${n}).`,
      });
    }
    // Position category values must be exactly "1".."n" (§3, §7).
    const expected = Array.from({ length: n }, (_, i) => String(i + 1));
    const matches =
      posCat.values.length === expected.length &&
      expected.every((e, i) => posCat.values[i] === e);
    if (!matches) {
      errors.push({
        code: 'POSITION_VALUES',
        message: `Position category "${posCat.name}" values must be the integers "1".."${n}" in order.`,
      });
    }
  }

  // --- All non-position categories have exactly n values (§5.1) ---
  if (posCat) {
    for (const c of puzzle.categories) {
      if (c.name === puzzle.positionCategory) continue;
      if (c.values.length !== n) {
        errors.push({
          code: 'CARDINALITY_MISMATCH',
          message: `Category "${c.name}" has ${c.values.length} values but must have exactly ${n} (the puzzle size).`,
        });
      }
    }
  }

  // --- Clue count (§5.1.2) ---
  if (puzzle.clues.length > MAX_CLUES) {
    errors.push({
      code: 'TOO_MANY_CLUES',
      message: `A puzzle may have at most ${MAX_CLUES} clues (found ${puzzle.clues.length}).`,
    });
  }

  // --- Clue ids are 1-indexed and unique (§5.3) ---
  const seenIds = new Set<number>();
  for (const clue of puzzle.clues) {
    if (seenIds.has(clue.id)) {
      errors.push({
        code: 'DUPLICATE_CLUE_ID',
        message: `Duplicate clue id ${clue.id}.`,
        clueId: clue.id,
      });
    }
    seenIds.add(clue.id);
  }

  // --- Per-clue argument validation (§5.3), delegated to handlers ---
  // Only attempt if the category structure is sound enough to index.
  if (posCat && errors.every((e) => e.code !== 'N_OUT_OF_RANGE')) {
    const index = buildIndex(puzzle);
    for (const clue of puzzle.clues) {
      errors.push(...validateClueArguments(clue, index));
    }
  }

  if (errors.length > 0) return { ok: false, errors };
  return { ok: true, n };
}

/** Shared argument checks plus the handler's type-specific checks. */
function validateClueArguments(clue: Clue, index: PuzzleIndex): ValidationError[] {
  const errors: ValidationError[] = [];

  // X must reference a declared cell.
  if (!cellExists(index, clue.x)) {
    errors.push({
      code: 'UNKNOWN_CELL',
      message: `Clue ${clue.id}: (${clue.x.category}, ${clue.x.value}) is not a declared category/value.`,
      clueId: clue.id,
    });
  }

  if (isPositionalClue(clue)) {
    if (!Number.isInteger(clue.k) || clue.k < 1 || clue.k > index.n) {
      errors.push({
        code: 'POSITION_OUT_OF_RANGE',
        message: `Clue ${clue.id}: position ${clue.k} is out of range 1..${index.n}.`,
        clueId: clue.id,
      });
    }
  } else {
    // Binary clue: Y must exist and X, Y must be different categories (§5.3, ASSUMPTIONS B3).
    if (!cellExists(index, clue.y)) {
      errors.push({
        code: 'UNKNOWN_CELL',
        message: `Clue ${clue.id}: (${clue.y.category}, ${clue.y.value}) is not a declared category/value.`,
        clueId: clue.id,
      });
    }
    // §5.3: "X ≠ Y — comparing a value to itself is rejected." Only identical
    // cells (same category AND value) are forbidden; same-category/different-
    // value clues are permitted — they are required to express the canonical
    // Einstein puzzle (§6.2), e.g. "green house is immediately left of white".
    if (clue.x.category === clue.y.category && clue.x.value === clue.y.value) {
      errors.push({
        code: 'SAME_CELL',
        message: `Clue ${clue.id}: X and Y must be different — a value cannot be compared to itself.`,
        clueId: clue.id,
      });
    }
  }

  // Type-specific checks contributed by the clue handler (§5.4 parse-time
  // resolution of position-category references, etc.).
  const handler = getClueHandler(clue.type);
  if (handler.validate) {
    errors.push(...handler.validate(clue, index));
  }

  return errors;
}
