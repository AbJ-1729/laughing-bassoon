/**
 * Structured clue editor (SPECS §5.3, §6.1). Exposes exactly the 9 supported
 * clue types via the registry — no hard-coded list. Binary clues pick X and Y
 * cells; C3/C4 pick a cell and a position.
 */
import { useMemo, useState } from 'react';
import type { Cell, Clue, ClueType } from '../core/types';
import { clueTypes, getClueHandler } from '../core/clues/registry';
import { useStore } from '../store/store';

const POSITIONAL: ClueType[] = ['C3', 'C4'];

export default function ClueEditor() {
  const puzzle = useStore((s) => s.puzzle);
  const addClue = useStore((s) => s.addClue);
  const attrCats = puzzle.categories;

  const firstCell = useMemo<Cell>(
    () => ({ category: attrCats[0]?.name ?? '', value: attrCats[0]?.values[0] ?? '' }),
    [attrCats],
  );
  const secondCell = useMemo<Cell>(
    () => ({ category: attrCats[1]?.name ?? '', value: attrCats[1]?.values[0] ?? '' }),
    [attrCats],
  );

  const [type, setType] = useState<ClueType>('C1');
  const [x, setX] = useState<Cell>(firstCell);
  const [y, setY] = useState<Cell>(secondCell);
  const [k, setK] = useState(1);

  const isPositional = POSITIONAL.includes(type);
  const n =
    puzzle.categories.find((c) => c.name === puzzle.positionCategory)?.values
      .length ?? 0;

  const submit = () => {
    const clue = isPositional
      ? ({ type, x, k } as Omit<Clue, 'id'>)
      : ({ type, x, y } as Omit<Clue, 'id'>);
    addClue(clue);
  };

  return (
    <div className="space-y-2 rounded border border-slate-200 p-2">
      <select
        aria-label="Clue type"
        value={type}
        onChange={(e) => setType(e.target.value as ClueType)}
        className="w-full rounded border border-slate-300 p-1 text-sm"
      >
        {clueTypes().map((t) => (
          <option key={t} value={t}>
            {t} — {getClueHandler(t).name}
          </option>
        ))}
      </select>

      <CellPicker label="X" cell={x} onChange={setX} />

      {isPositional ? (
        <label className="block text-sm">
          Position
          <select
            aria-label="Position"
            value={k}
            onChange={(e) => setK(Number(e.target.value))}
            className="ml-2 rounded border border-slate-300 p-1"
          >
            {Array.from({ length: n }, (_, i) => i + 1).map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </label>
      ) : (
        <CellPicker label="Y" cell={y} onChange={setY} />
      )}

      <button
        onClick={submit}
        className="w-full rounded bg-slate-800 px-2 py-1 text-sm text-white hover:bg-slate-700"
      >
        Add clue
      </button>
    </div>
  );
}

export function CellPicker({
  label,
  cell,
  onChange,
}: {
  label: string;
  cell: Cell;
  onChange: (cell: Cell) => void;
}) {
  const puzzle = useStore((s) => s.puzzle);
  const cat = puzzle.categories.find((c) => c.name === cell.category) ?? puzzle.categories[0];
  return (
    <div className="flex items-center gap-1 text-sm">
      <span className="w-4 text-slate-500">{label}</span>
      <select
        aria-label={`${label} category`}
        value={cell.category}
        onChange={(e) => {
          const next = puzzle.categories.find((c) => c.name === e.target.value)!;
          onChange({ category: next.name, value: next.values[0] });
        }}
        className="flex-1 rounded border border-slate-300 p-1"
      >
        {puzzle.categories.map((c) => (
          <option key={c.name} value={c.name}>
            {c.name}
          </option>
        ))}
      </select>
      <select
        aria-label={`${label} value`}
        value={cell.value}
        onChange={(e) => onChange({ category: cell.category, value: e.target.value })}
        className="flex-1 rounded border border-slate-300 p-1"
      >
        {cat?.values.map((v) => (
          <option key={v} value={v}>
            {v}
          </option>
        ))}
      </select>
    </div>
  );
}
