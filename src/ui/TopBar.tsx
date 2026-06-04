/**
 * Top bar (SPECS §6.2): Examples menu, JSON import/export, and the Solve button
 * with status feedback (§6.3). Built on shadcn/ui primitives.
 */
import { useRef, useState } from 'react';
import { useStore } from '../store/store';
import { EXAMPLES } from '../examples';
import { exportPuzzleJson } from './export';
import type { Puzzle } from '../core/types';
import { validatePuzzle } from '../core/validation';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';

export default function TopBar() {
  const puzzle = useStore((s) => s.puzzle);
  const solving = useStore((s) => s.solving);
  const report = useStore((s) => s.report);
  const solve = useStore((s) => s.solve);
  const loadExample = useStore((s) => s.loadExample);
  const loadPuzzle = useStore((s) => s.loadPuzzle);
  const fileRef = useRef<HTMLInputElement>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [exampleKey, setExampleKey] = useState(0); // remount to reset placeholder

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
      <header className="flex items-center gap-3 border-b bg-card px-4 py-2">
        <h1 className="text-lg font-semibold">Logic-Grid Puzzle Solver</h1>

        <Select
          key={exampleKey}
          onValueChange={(v) => {
            loadExample(v);
            setExampleKey((k) => k + 1);
          }}
        >
          <SelectTrigger aria-label="Load example" className="h-8 w-48 text-sm">
            <SelectValue placeholder="Examples…" />
          </SelectTrigger>
          <SelectContent>
            {EXAMPLES.map((e) => (
              <SelectItem key={e.id} value={e.id}>
                {e.name} ({e.difficulty})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Button variant="outline" size="sm" onClick={() => exportPuzzleJson(puzzle)}>
          Export JSON
        </Button>
        <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()}>
          Import JSON
        </Button>
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

        <Button
          onClick={() => solve()}
          disabled={solving}
          className={cn(solved && 'bg-emerald-600 hover:bg-emerald-500')}
        >
          {solving ? 'Solving…' : solved ? '✓ Solved' : 'Solve'}
        </Button>
      </header>
      {importError && (
        <div
          role="alert"
          className="flex items-center justify-between border-b border-destructive/30 bg-destructive/10 px-4 py-1.5 text-sm text-destructive"
        >
          <span>{importError}</span>
          <Button variant="link" size="sm" onClick={() => setImportError(null)}>
            dismiss
          </Button>
        </div>
      )}
    </>
  );
}
