/**
 * Structured clue editor (SPECS §5.3, §6.1). Exposes exactly the 9 supported
 * clue types via the registry — no hard-coded list. Binary clues pick X and Y
 * cells; C3/C4 pick a cell and a position. Built on shadcn/ui primitives.
 */
import { useEffect, useMemo, useState } from 'react';
import type { BinaryClue, Cell, Clue, ClueType, PositionalClue } from '../core/types';
import { clueTypes, getClueHandler } from '../core/clues/registry';
import { useStore } from '../store/store';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const POSITIONAL: ClueType[] = ['C3', 'C4'];

export default function ClueEditor() {
  const puzzle = useStore((s) => s.puzzle);
  const addClue = useStore((s) => s.addClue);
  const updateClue = useStore((s) => s.updateClue);
  const editingClueId = useStore((s) => s.editingClueId);
  const cancelEditClue = useStore((s) => s.cancelEditClue);
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

  // When entering edit mode, load the selected clue into the form (§6.1 edit).
  // When edit mode is cancelled (editingClueId → null) reset to defaults.
  const editingClue = puzzle.clues.find((c) => c.id === editingClueId);
  useEffect(() => {
    if (editingClueId === null) {
      setType('C1');
      setX(firstCell);
      setY(secondCell);
      setK(1);
      return;
    }
    if (!editingClue) return;
    setType(editingClue.type);
    setX(editingClue.x);
    if (editingClue.type === 'C3' || editingClue.type === 'C4') {
      setK((editingClue as PositionalClue).k);
    } else {
      setY((editingClue as BinaryClue).y);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editingClueId]);

  const isPositional = POSITIONAL.includes(type);
  const n =
    puzzle.categories.find((c) => c.name === puzzle.positionCategory)?.values
      .length ?? 0;

  const submit = () => {
    const clue = isPositional
      ? ({ type, x, k } as Omit<Clue, 'id'>)
      : ({ type, x, y } as Omit<Clue, 'id'>);
    if (editingClueId !== null) updateClue(editingClueId, clue);
    else addClue(clue);
  };

  return (
    <div className="space-y-2 rounded-md border p-2">
      <Select value={type} onValueChange={(v) => setType(v as ClueType)}>
        <SelectTrigger aria-label="Clue type" className="h-8 text-sm">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {clueTypes().map((t) => (
            <SelectItem key={t} value={t}>
              {t} — {getClueHandler(t).name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <CellPicker label="X" cell={x} onChange={setX} />

      {isPositional ? (
        <div className="flex items-center gap-2 text-sm">
          <span className="text-muted-foreground">Position</span>
          <Select value={String(k)} onValueChange={(v) => setK(Number(v))}>
            <SelectTrigger aria-label="Position" className="h-8 w-24 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Array.from({ length: n }, (_, i) => i + 1).map((p) => (
                <SelectItem key={p} value={String(p)}>
                  {p}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      ) : (
        <CellPicker label="Y" cell={y} onChange={setY} />
      )}

      <div className="flex gap-2">
        <Button size="sm" className="flex-1" onClick={submit}>
          {editingClueId !== null ? 'Save changes' : 'Add clue'}
        </Button>
        {editingClueId !== null && (
          <Button size="sm" variant="outline" onClick={cancelEditClue}>
            Cancel
          </Button>
        )}
      </div>
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
  const catMatch = puzzle.categories.find((c) => c.name === cell.category);
  const cat = catMatch ?? puzzle.categories[0];

  // If the referenced category was renamed or removed, snap to the first category.
  const categoryExists = catMatch !== undefined;
  useEffect(() => {
    if (!categoryExists && puzzle.categories[0]) {
      const first = puzzle.categories[0];
      onChange({ category: first.name, value: first.values[0] ?? '' });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [categoryExists]);

  // If the referenced value was removed, snap to the first value.
  const valueExists = cat?.values.includes(cell.value) ?? false;
  useEffect(() => {
    if (categoryExists && !valueExists && cat && cat.values.length > 0) {
      onChange({ category: cell.category, value: cat.values[0] });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [valueExists, cell.category]);

  return (
    <div className="flex items-center gap-1 text-sm">
      <span className="w-4 text-muted-foreground">{label}</span>
      <Select
        value={cell.category}
        onValueChange={(v) => {
          const next = puzzle.categories.find((c) => c.name === v)!;
          onChange({ category: next.name, value: next.values[0] });
        }}
      >
        <SelectTrigger aria-label={`${label} category`} className="h-8 flex-1 text-sm">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {puzzle.categories.map((c) => (
            <SelectItem key={c.name} value={c.name}>
              {c.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select
        value={cell.value}
        onValueChange={(v) => onChange({ category: cell.category, value: v })}
      >
        <SelectTrigger aria-label={`${label} value`} className="h-8 flex-1 text-sm">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {cat?.values.map((v) => (
            <SelectItem key={v} value={v}>
              {v}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
