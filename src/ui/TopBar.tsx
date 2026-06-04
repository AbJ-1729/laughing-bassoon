/**
 * Top bar (SPECS §6.2): Examples menu, JSON import/export, and the Solve button
 * with status feedback (§6.3).
 */
import { useRef, useState } from 'react';
import { useStore } from '../store/store';
import { EXAMPLES } from '../examples';
import { exportPuzzleJson } from './export';
import type { Puzzle } from '../core/types';
import { validatePuzzle } from '../core/validation';

export default function TopBar() {
  const puzzle = useStore((s) => s.puzzle);
  const solving = useStore((s) => s.solving);
  const report = useStore((s) => s.report);
  const solve = useStore((s) => s.solve);
  const loadExample = useStore((s) => s.loadExample);
  const loadPuzzle = useStore((s) => s.loadPuzzle);
  const fileRef = useRef<HTMLInputElement>(null);
  const [importError, setImportError] = useState<string | null>(null);

  const onImport = async (file: File) => {
    setImportError(null);
    let parsed: unknown;
    try {
      parsed = JSON.parse(await file.text());
    } catch {
      setImportError('Could not read that file as JSON.');
      return;
    }
    if (
      typeof parsed !== 'object' ||
      parsed === null ||
      !Array.isArray((parsed as Record<string, unknown>).categories) ||
      !Array.isArray((parsed as Record<string, unknown>).clues) ||
      typeof (parsed as Record<string, unknown>).positionCategory !== 'string'
    ) {
      setImportError('Invalid puzzle file: missing required fields (categories, positionCategory, clues).');
      return;
    }
    if ((parsed as Record<string, unknown>).version !== 1) {
      setImportError(
        `Unsupported puzzle version (found: ${(parsed as Record<string, unknown>).version ?? 'none'}). Only version 1 is supported.`,
      );
      return;
    }
    const result = validatePuzzle(parsed as Puzzle);
    if (!result.ok) {
      setImportError(`Puzzle is invalid: ${result.errors[0].message}`);
      return;
    }
    loadPuzzle(parsed as Puzzle);
  };

  const solved = report?.status === 'unique';
  return (
    <>
    <header className="flex items-center gap-3 border-b border-slate-200 bg-white px-4 py-2">
      <h1 className="text-lg font-semibold">Logic-Grid Puzzle Solver</h1>

      <select
        aria-label="Load example"
        defaultValue=""
        onChange={(e) => {
          if (e.target.value) loadExample(e.target.value);
          e.target.value = '';
        }}
        className="rounded border border-slate-300 p-1 text-sm"
      >
        <option value="">Examples…</option>
        {EXAMPLES.map((e) => (
          <option key={e.id} value={e.id}>
            {e.name} ({e.difficulty})
          </option>
        ))}
      </select>

      <button
        onClick={() => exportPuzzleJson(puzzle)}
        className="rounded border border-slate-300 px-2 py-1 text-sm hover:bg-slate-50"
      >
        Export JSON
      </button>
      <button
        onClick={() => fileRef.current?.click()}
        className="rounded border border-slate-300 px-2 py-1 text-sm hover:bg-slate-50"
      >
        Import JSON
      </button>
      <input
        ref={fileRef}
        type="file"
        accept="application/json"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onImport(f);
          e.target.value = '';
        }}
      />

      <div className="flex-1" />

      <button
        onClick={() => solve()}
        disabled={solving}
        className={`rounded px-4 py-1 text-sm font-semibold text-white disabled:opacity-50 ${
          solved ? 'bg-emerald-600 hover:bg-emerald-500' : 'bg-sky-600 hover:bg-sky-500'
        }`}
      >
        {solving ? 'Solving…' : solved ? '✓ Solved' : 'Solve'}
      </button>
    </header>
    {importError && (
      <div role="alert" className="flex items-center justify-between border-b border-rose-200 bg-rose-50 px-4 py-1.5 text-sm text-rose-700">
        <span>{importError}</span>
        <button onClick={() => setImportError(null)} className="ml-4 text-xs underline">dismiss</button>
      </div>
    )}
    </>
  );
}
