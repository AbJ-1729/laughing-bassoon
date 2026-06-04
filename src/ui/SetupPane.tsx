/**
 * Left pane (SPECS §6.1): puzzle setup — category/value editor, position-category
 * selector, clue entry (structured or natural-language per the mode toggle), and
 * the reorderable clue list. Built on shadcn/ui primitives.
 */
import { useState } from 'react';
import { useStore } from '../store/store';
import { getClueHandler } from '../core/clues/registry';
import ClueEditor from './ClueEditor';
import NLClueEditor from './NLClueEditor';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type { EntryMode } from '../store/store';

export default function SetupPane() {
  const puzzle = useStore((s) => s.puzzle);
  const mode = useStore((s) => s.mode);
  const setMode = useStore((s) => s.setMode);
  const editingClueId = useStore((s) => s.editingClueId);
  const beginEditClue = useStore((s) => s.beginEditClue);
  const {
    setPuzzleMeta,
    addCategory,
    removeCategory,
    renameCategory,
    setPositionCategory,
    addValue,
    removeValue,
    renameValue,
    removeClue,
    moveClue,
  } = useStore.getState();

  // Position auto-sizes only when every non-position category agrees on length.
  const attrCats = puzzle.categories.filter((c) => c.name !== puzzle.positionCategory);
  const attrSizesUniform = attrCats.every(
    (c) => c.values.length === attrCats[0]?.values.length,
  );
  const attrSizes = attrCats.map((c) => `${c.name}: ${c.values.length}`).join(', ');

  return (
    <div className="space-y-4">
      <section className="space-y-1">
        <Input
          aria-label="Puzzle title"
          value={puzzle.title ?? ''}
          onChange={(e) => setPuzzleMeta({ title: e.target.value })}
          className="font-semibold"
          placeholder="Puzzle title"
        />
        <Textarea
          aria-label="Puzzle description"
          value={puzzle.description ?? ''}
          onChange={(e) => setPuzzleMeta({ description: e.target.value })}
          rows={2}
          maxLength={500}
          className="text-xs"
          placeholder="Description (optional)"
        />
      </section>

      <section>
        <div className="mb-1 flex items-center justify-between">
          <h2 className="text-sm font-semibold">Categories</h2>
          <Button variant="outline" size="sm" onClick={addCategory}>
            + Category
          </Button>
        </div>
        <div className="space-y-2">
          {puzzle.categories.map((cat) => (
            <div key={cat.name} className="rounded-md border p-2">
              <div className="flex items-center gap-1">
                <Input
                  aria-label={`Category name ${cat.name}`}
                  value={cat.name}
                  onChange={(e) => renameCategory(cat.name, e.target.value)}
                  className="h-8 flex-1 font-medium"
                />
                <label className="flex items-center gap-1 text-xs" title="Position category">
                  <input
                    type="radio"
                    name="positionCategory"
                    checked={cat.name === puzzle.positionCategory}
                    onChange={() => setPositionCategory(cat.name)}
                    aria-label={`Make ${cat.name} the position category`}
                  />
                  pos
                </label>
                {cat.name !== puzzle.positionCategory && (
                  <Button
                    aria-label={`Remove category ${cat.name}`}
                    variant="ghost"
                    size="icon"
                    className="text-destructive"
                    onClick={() => removeCategory(cat.name)}
                  >
                    ✕
                  </Button>
                )}
              </div>
              {cat.name === puzzle.positionCategory ? (
                <div className="mt-1 text-xs">
                  <p className="text-muted-foreground">
                    Positions 1–{cat.values.length} — auto-sized to match the other categories.
                  </p>
                  {!attrSizesUniform && (
                    <p className="mt-1 text-amber-600">
                      Categories have different sizes ({attrSizes}). Give every category the
                      same number of values to set the puzzle size.
                    </p>
                  )}
                </div>
              ) : (
                <ValueEditor
                  category={cat.name}
                  values={cat.values}
                  onAdd={(v) => addValue(cat.name, v)}
                  onRemove={(v) => removeValue(cat.name, v)}
                  onRename={(o, nv) => renameValue(cat.name, o, nv)}
                />
              )}
            </div>
          ))}
        </div>
      </section>

      <section>
        <div className="mb-1 flex items-center justify-between">
          <h2 className="text-sm font-semibold">Add clue</h2>
          <Tabs value={mode} onValueChange={(v) => setMode(v as EntryMode)}>
            <TabsList className="h-7">
              <TabsTrigger value="structured">Structured</TabsTrigger>
              <TabsTrigger value="nl">Natural language</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
        {mode === 'structured' ? <ClueEditor /> : <NLClueEditor />}
      </section>

      <section>
        <h2 className="mb-1 text-sm font-semibold">Clues ({puzzle.clues.length})</h2>
        <ol className="space-y-1">
          {puzzle.clues.map((clue, i) => (
            <li
              key={clue.id}
              className={`flex items-start gap-1 rounded-md border p-1 text-sm ${
                editingClueId === clue.id ? 'border-amber-400 bg-amber-50' : ''
              }`}
            >
              <span className="w-4 text-xs text-muted-foreground">{clue.id}</span>
              <span className="flex-1">
                {getClueHandler(clue.type).describe(clue)}
                {clue.naturalLanguage && (
                  <span className="block text-[11px] italic text-muted-foreground">
                    “{clue.naturalLanguage}”
                  </span>
                )}
              </span>
              <Button aria-label={`Edit clue ${clue.id}`} variant="ghost" size="icon" className="h-6 w-6" onClick={() => beginEditClue(clue.id)}>
                ✎
              </Button>
              <Button aria-label={`Move clue ${clue.id} up`} variant="ghost" size="icon" className="h-6 w-6" disabled={i === 0} onClick={() => moveClue(clue.id, -1)}>
                ↑
              </Button>
              <Button aria-label={`Move clue ${clue.id} down`} variant="ghost" size="icon" className="h-6 w-6" disabled={i === puzzle.clues.length - 1} onClick={() => moveClue(clue.id, 1)}>
                ↓
              </Button>
              <Button aria-label={`Delete clue ${clue.id}`} variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={() => removeClue(clue.id)}>
                ✕
              </Button>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}

function ValueEditor({
  category,
  values,
  onAdd,
  onRemove,
  onRename,
}: {
  category: string;
  values: string[];
  onAdd: (v: string) => void;
  onRemove: (v: string) => void;
  onRename: (oldVal: string, newVal: string) => void;
}) {
  const [draft, setDraft] = useState('');
  return (
    <div className="mt-2 space-y-1">
      {values.map((v) => (
        <div key={v} className="flex items-center gap-1">
          <Input
            aria-label={`${category} value ${v}`}
            value={v}
            onChange={(e) => onRename(v, e.target.value)}
            className="h-7 flex-1 text-xs"
          />
          <Button
            aria-label={`Remove value ${v}`}
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-destructive"
            onClick={() => onRemove(v)}
          >
            ✕
          </Button>
        </div>
      ))}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (draft.trim()) {
            onAdd(draft.trim());
            setDraft('');
          }
        }}
        className="flex gap-1"
      >
        <Input
          aria-label={`New value for ${category}`}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="add value…"
          className="h-7 flex-1 text-xs"
        />
        <Button type="submit" variant="outline" size="icon" className="h-7 w-7">
          +
        </Button>
      </form>
    </div>
  );
}
