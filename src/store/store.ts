/**
 * Application state (SPECS §4 — Zustand). Holds the editable puzzle, the latest
 * solve outcome, and the playback cursor. Puzzle-editing actions are small and
 * focused; solving is delegated to the worker client (§5.5).
 */
import { create } from 'zustand';
import { isBinaryClue } from '../core/types';
import type { Cell, Clue, Puzzle } from '../core/types';
import { solveInWorker, type SolveOutcome } from '../worker/client';
import { EXAMPLES } from '../examples';

export type EntryMode = 'structured' | 'nl';

interface AppState {
  puzzle: Puzzle;
  report: SolveOutcome | null;
  solving: boolean;
  /** Playback cursor: 0 = initial state, i = after step i (§6.2). */
  stepIndex: number;
  mode: EntryMode;
  highlightedCells: Cell[];
  /** Clue currently being edited in the structured editor (§6.1 edit), or null. */
  editingClueId: number | null;

  setMode: (mode: EntryMode) => void;
  setPuzzleMeta: (meta: { title?: string; description?: string }) => void;

  addCategory: () => void;
  removeCategory: (name: string) => void;
  renameCategory: (oldName: string, newName: string) => void;
  setPositionCategory: (name: string) => void;
  addValue: (category: string, value: string) => void;
  removeValue: (category: string, value: string) => void;
  renameValue: (category: string, oldVal: string, newVal: string) => void;

  addClue: (clue: Omit<Clue, 'id'>) => void;
  updateClue: (id: number, clue: Omit<Clue, 'id'>) => void;
  removeClue: (id: number) => void;
  moveClue: (id: number, dir: -1 | 1) => void;
  beginEditClue: (id: number) => void;
  cancelEditClue: () => void;

  loadExample: (id: string) => void;
  loadPuzzle: (puzzle: Puzzle) => void;

  solve: () => Promise<void>;
  setStepIndex: (i: number) => void;
  setHighlight: (cells: Cell[]) => void;
}

function emptyPuzzle(): Puzzle {
  return {
    version: 1,
    title: 'Untitled puzzle',
    description: '',
    positionCategory: 'Position',
    categories: [
      { name: 'Position', values: ['1', '2', '3'], isPosition: true },
      { name: 'Category A', values: ['A1', 'A2', 'A3'] },
      { name: 'Category B', values: ['B1', 'B2', 'B3'] },
    ],
    clues: [],
  };
}

/** Reindex clue ids to 1..n in order (§5.3 stable, input-order ids). */
function reindex(clues: Clue[]): Clue[] {
  return clues.map((c, i) => ({ ...c, id: i + 1 }));
}

/** Keep the position category sized "1".."n" and reset stale solve state. */
function withClearedSolve(patch: Partial<AppState>): Partial<AppState> {
  // Structural changes also exit clue-edit mode (clue ids may be reindexed).
  return { report: null, stepIndex: 0, highlightedCells: [], editingClueId: null, ...patch };
}

// Module-level counter to detect stale solve results (S2 concurrency guard).
let _solveSeq = 0;

export const useStore = create<AppState>()((set, get) => ({
  puzzle: EXAMPLES[0].puzzle,
  report: null,
  solving: false,
  stepIndex: 0,
  mode: 'structured',
  highlightedCells: [],
  editingClueId: null,

  setMode: (mode) => set({ mode }),

  setPuzzleMeta: (meta) =>
    set((s) => ({ puzzle: { ...s.puzzle, ...meta } })),

  addCategory: () =>
    set((s) => {
      if (s.puzzle.categories.length >= 6) return s; // MAX_CATEGORIES per §5.1
      const n = positionCount(s.puzzle);
      const name = uniqueName('Category', s.puzzle.categories.map((c) => c.name));
      const values = Array.from({ length: n }, (_, i) => `${name.replace(/\s/g, '')}${i + 1}`);
      return withClearedSolve({
        puzzle: { ...s.puzzle, categories: [...s.puzzle.categories, { name, values }] },
      });
    }),

  removeCategory: (name) => {
    const s = get();
    if (name === s.puzzle.positionCategory) return;
    if (s.puzzle.categories.length <= 3) return; // must keep ≥3 categories (§5.1)
    const affected = s.puzzle.clues.filter((c) => clueReferencesCategory(c, name));
    if (
      affected.length > 0 &&
      !window.confirm(
        `Removing "${name}" will also delete ${affected.length} clue(s) that reference it. Continue?`,
      )
    ) return;
    set((s) => {
      if (name === s.puzzle.positionCategory) return s;
      const categories = s.puzzle.categories.filter((c) => c.name !== name);
      const clues = s.puzzle.clues.filter((c) => !clueReferencesCategory(c, name));
      return withClearedSolve({ puzzle: { ...s.puzzle, categories, clues: reindex(clues) } });
    });
  },

  renameCategory: (oldName, newName) =>
    set((s) => {
      if (!newName || s.puzzle.categories.some((c) => c.name === newName)) return s;
      const categories = s.puzzle.categories.map((c) =>
        c.name === oldName ? { ...c, name: newName } : c,
      );
      const clues = s.puzzle.clues.map((c) => renameInClue(c, oldName, newName));
      const positionCategory =
        s.puzzle.positionCategory === oldName ? newName : s.puzzle.positionCategory;
      return withClearedSolve({
        puzzle: { ...s.puzzle, categories, clues, positionCategory },
      });
    }),

  setPositionCategory: (name) => {
    const s = get();
    const target = s.puzzle.categories.find((c) => c.name === name);
    if (!target) return;
    const oldN = positionCount(s.puzzle);
    const newN = target.values.length;
    if (
      newN !== oldN &&
      !window.confirm(
        `Switching position category will resize the puzzle from ${oldN} to ${newN} positions. ` +
          `Some values and clues may be removed. Continue?`,
      )
    ) return;
    set((s) => {
      const tgt = s.puzzle.categories.find((c) => c.name === name)!;
      const n = tgt.values.length;
      // Promote target to position axis; resize all other categories to n.
      const categories = s.puzzle.categories.map((c) => {
        if (c.name === name)
          return { ...c, isPosition: true, values: Array.from({ length: n }, (_, i) => String(i + 1)) };
        const vals = c.values.slice(0, n);
        while (vals.length < n) vals.push(`${c.name.replace(/\s+/g, '')}${vals.length + 1}`);
        return { ...c, isPosition: false, values: vals };
      });
      // Drop clues referencing values that were truncated away or with k > n.
      const valid = new Set(categories.flatMap((c) => c.values.map((v) => `${c.name}\0${v}`)));
      const clues = reindex(
        s.puzzle.clues.filter((clue) => {
          if (!valid.has(`${clue.x.category}\0${clue.x.value}`)) return false;
          if (isBinaryClue(clue)) return valid.has(`${clue.y.category}\0${clue.y.value}`);
          return clue.k <= n; // positional clue: ensure k is still in range
        }),
      );
      return withClearedSolve({ puzzle: { ...s.puzzle, positionCategory: name, categories, clues } });
    });
  },

  addValue: (category, value) =>
    set((s) => {
      // Position category values are managed automatically — never add manually.
      if (category === s.puzzle.positionCategory) return s;
      const cat = s.puzzle.categories.find((c) => c.name === category);
      // Block if value is empty, already exists, or would push n above 8.
      if (!cat || !value.trim() || cat.values.includes(value) || cat.values.length >= 8) return s;
      const categories = s.puzzle.categories.map((c) =>
        c.name === category ? { ...c, values: [...c.values, value] } : c,
      );
      return withClearedSolve({ puzzle: { ...s.puzzle, categories } });
    }),

  removeValue: (category, value) => {
    const s = get();
    const affected = s.puzzle.clues.filter((c) => clueReferencesCell(c, { category, value }));
    if (
      affected.length > 0 &&
      !window.confirm(
        `Removing "${value}" will also delete ${affected.length} clue(s) that reference it. Continue?`,
      )
    ) return;
    set((s) => {
      const categories = s.puzzle.categories.map((c) =>
        c.name === category ? { ...c, values: c.values.filter((v) => v !== value) } : c,
      );
      const clues = s.puzzle.clues.filter((c) => !clueReferencesCell(c, { category, value }));
      return withClearedSolve({ puzzle: { ...s.puzzle, categories, clues: reindex(clues) } });
    });
  },

  renameValue: (category, oldVal, newVal) =>
    set((s) => {
      if (!newVal || newVal === oldVal) return s;
      const cat = s.puzzle.categories.find((c) => c.name === category);
      // Block rename if the new name already exists in this category.
      if (cat?.values.includes(newVal)) return s;
      const categories = s.puzzle.categories.map((c) =>
        c.name === category
          ? { ...c, values: c.values.map((v) => (v === oldVal ? newVal : v)) }
          : c,
      );
      const clues = s.puzzle.clues.map((c) =>
        renameValueInClue(c, category, oldVal, newVal),
      );
      return withClearedSolve({ puzzle: { ...s.puzzle, categories, clues } });
    }),

  addClue: (clue) =>
    set((s) =>
      withClearedSolve({
        puzzle: {
          ...s.puzzle,
          clues: reindex([...s.puzzle.clues, { ...clue, id: 0 } as Clue]),
        },
      }),
    ),

  updateClue: (id, clue) =>
    set((s) =>
      withClearedSolve({
        puzzle: {
          ...s.puzzle,
          clues: s.puzzle.clues.map((c) =>
            c.id === id ? ({ ...clue, id } as Clue) : c,
          ),
        },
      }),
    ),

  removeClue: (id) =>
    set((s) =>
      withClearedSolve({
        puzzle: {
          ...s.puzzle,
          clues: reindex(s.puzzle.clues.filter((c) => c.id !== id)),
        },
      }),
    ),

  moveClue: (id, dir) =>
    set((s) => {
      const clues = [...s.puzzle.clues];
      const idx = clues.findIndex((c) => c.id === id);
      const swap = idx + dir;
      if (idx < 0 || swap < 0 || swap >= clues.length) return s;
      [clues[idx], clues[swap]] = [clues[swap], clues[idx]];
      return withClearedSolve({ puzzle: { ...s.puzzle, clues: reindex(clues) } });
    }),

  beginEditClue: (id) => set({ editingClueId: id, mode: 'structured' }),
  cancelEditClue: () => set({ editingClueId: null }),

  loadExample: (id) => {
    const ex = EXAMPLES.find((e) => e.id === id);
    if (ex) set(withClearedSolve({ puzzle: ex.puzzle }));
  },

  loadPuzzle: (puzzle) => set(withClearedSolve({ puzzle })),

  solve: async () => {
    const seq = ++_solveSeq;
    set({ solving: true, report: null, stepIndex: 0, highlightedCells: [] });
    const outcome = await solveInWorker(get().puzzle);
    if (seq !== _solveSeq) return; // superseded by a newer solve
    set({ report: outcome, solving: false, stepIndex: 0 });
  },

  setStepIndex: (i) => {
    const report = get().report;
    const max =
      report && report.status === 'unique'
        ? report.explanation.steps.length
        : 0;
    const clamped = Math.max(0, Math.min(i, max));
    let highlight: Cell[] = [];
    if (report && report.status === 'unique' && clamped > 0) {
      highlight = report.explanation.steps[clamped - 1].affectedCells;
    }
    set({ stepIndex: clamped, highlightedCells: highlight });
  },

  setHighlight: (cells) => set({ highlightedCells: cells }),
}));

// --- helpers ---------------------------------------------------------------

function positionCount(puzzle: Puzzle): number {
  return (
    puzzle.categories.find((c) => c.name === puzzle.positionCategory)?.values
      .length ?? 3
  );
}

function uniqueName(base: string, existing: string[]): string {
  let i = existing.length + 1;
  let name = `${base} ${i}`;
  while (existing.includes(name)) name = `${base} ${++i}`;
  return name;
}

function clueReferencesCategory(clue: Clue, category: string): boolean {
  if (clue.x.category === category) return true;
  return 'y' in clue && clue.y.category === category;
}

function clueReferencesCell(clue: Clue, cell: Cell): boolean {
  const eq = (c: Cell) => c.category === cell.category && c.value === cell.value;
  if (eq(clue.x)) return true;
  return 'y' in clue && eq(clue.y);
}

function renameInClue(clue: Clue, oldName: string, newName: string): Clue {
  const fix = (c: Cell): Cell =>
    c.category === oldName ? { ...c, category: newName } : c;
  if ('y' in clue) return { ...clue, x: fix(clue.x), y: fix(clue.y) };
  return { ...clue, x: fix(clue.x) };
}

function renameValueInClue(
  clue: Clue,
  category: string,
  oldVal: string,
  newVal: string,
): Clue {
  const fix = (c: Cell): Cell =>
    c.category === category && c.value === oldVal ? { ...c, value: newVal } : c;
  if ('y' in clue) return { ...clue, x: fix(clue.x), y: fix(clue.y) };
  return { ...clue, x: fix(clue.x) };
}

export { emptyPuzzle };
