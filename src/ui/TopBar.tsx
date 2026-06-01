/**
 * Top bar (SPECS §6.2): Examples menu, JSON import/export, and the Solve button
 * with status feedback (§6.3).
 */
import { useRef } from 'react';
import { useStore } from '../store/store';
import { EXAMPLES } from '../examples';
import { exportPuzzleJson } from './export';
import type { Puzzle } from '../core/types';

export default function TopBar() {
  const puzzle = useStore((s) => s.puzzle);
  const solving = useStore((s) => s.solving);
  const report = useStore((s) => s.report);
  const solve = useStore((s) => s.solve);
  const loadExample = useStore((s) => s.loadExample);
  const loadPuzzle = useStore((s) => s.loadPuzzle);
  const fileRef = useRef<HTMLInputElement>(null);

  const onImport = async (file: File) => {
    try {
      const puzzle = JSON.parse(await file.text()) as Puzzle;
      loadPuzzle(puzzle);
    } catch {
      alert('Could not read that file as a puzzle JSON.');
    }
  };

  const solved = report?.status === 'unique';
  return (
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
  );
}
