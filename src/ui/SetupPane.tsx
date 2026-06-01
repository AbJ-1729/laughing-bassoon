/**
 * Left pane (SPECS §6.1): puzzle setup — category/value editor, position-category
 * selector, clue entry (structured or natural-language per the mode toggle), and
 * the reorderable clue list.
 */
import { useState } from 'react';
import { useStore } from '../store/store';
import { getClueHandler } from '../core/clues/registry';
import ClueEditor from './ClueEditor';
import NLClueEditor from './NLClueEditor';

export default function SetupPane() {
  const puzzle = useStore((s) => s.puzzle);
  const mode = useStore((s) => s.mode);
  const setMode = useStore((s) => s.setMode);
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

  return (
    <div className="space-y-4">
      <section>
        <input
          aria-label="Puzzle title"
          value={puzzle.title ?? ''}
          onChange={(e) => setPuzzleMeta({ title: e.target.value })}
          className="w-full rounded border border-slate-300 p-1 text-sm font-semibold"
          placeholder="Puzzle title"
        />
      </section>

      <section>
        <div className="mb-1 flex items-center justify-between">
          <h2 className="text-sm font-semibold">Categories</h2>
          <button
            onClick={addCategory}
            className="rounded border border-slate-300 px-2 text-xs hover:bg-slate-50"
          >
            + Category
          </button>
        </div>
        <div className="space-y-2">
          {puzzle.categories.map((cat) => (
            <div key={cat.name} className="rounded border border-slate-200 p-2">
              <div className="flex items-center gap-1">
                <input
                  aria-label={`Category name ${cat.name}`}
                  value={cat.name}
                  onChange={(e) => renameCategory(cat.name, e.target.value)}
                  className="flex-1 rounded border border-slate-200 p-1 text-sm font-medium"
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
                  <button
                    aria-label={`Remove category ${cat.name}`}
                    onClick={() => removeCategory(cat.name)}
                    className="rounded px-1 text-rose-500 hover:bg-rose-50"
                  >
                    ✕
                  </button>
                )}
              </div>
              {cat.name === puzzle.positionCategory ? (
                <p className="mt-1 text-xs text-slate-400">
                  Positions 1–{cat.values.length} (sized by other categories)
                </p>
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
          <div className="flex overflow-hidden rounded border border-slate-300 text-xs" role="tablist">
            <button
              role="tab"
              aria-selected={mode === 'structured'}
              onClick={() => setMode('structured')}
              className={`px-2 py-0.5 ${mode === 'structured' ? 'bg-slate-800 text-white' : ''}`}
            >
              Structured
            </button>
            <button
              role="tab"
              aria-selected={mode === 'nl'}
              onClick={() => setMode('nl')}
              className={`px-2 py-0.5 ${mode === 'nl' ? 'bg-slate-800 text-white' : ''}`}
            >
              Natural language
            </button>
          </div>
        </div>
        {mode === 'structured' ? <ClueEditor /> : <NLClueEditor />}
      </section>

      <section>
        <h2 className="mb-1 text-sm font-semibold">Clues ({puzzle.clues.length})</h2>
        <ol className="space-y-1">
          {puzzle.clues.map((clue, i) => (
            <li
              key={clue.id}
              className="flex items-start gap-1 rounded border border-slate-200 p-1 text-sm"
            >
              <span className="w-4 text-xs text-slate-400">{clue.id}</span>
              <span className="flex-1">
                {getClueHandler(clue.type).describe(clue)}
                {clue.naturalLanguage && (
                  <span className="block text-[11px] italic text-slate-400">
                    “{clue.naturalLanguage}”
                  </span>
                )}
              </span>
              <button
                aria-label={`Move clue ${clue.id} up`}
                disabled={i === 0}
                onClick={() => moveClue(clue.id, -1)}
                className="px-1 disabled:opacity-30"
              >
                ↑
              </button>
              <button
                aria-label={`Move clue ${clue.id} down`}
                disabled={i === puzzle.clues.length - 1}
                onClick={() => moveClue(clue.id, 1)}
                className="px-1 disabled:opacity-30"
              >
                ↓
              </button>
              <button
                aria-label={`Delete clue ${clue.id}`}
                onClick={() => removeClue(clue.id)}
                className="px-1 text-rose-500 hover:bg-rose-50"
              >
                ✕
              </button>
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
          <input
            aria-label={`${category} value ${v}`}
            value={v}
            onChange={(e) => onRename(v, e.target.value)}
            className="flex-1 rounded border border-slate-200 p-0.5 text-xs"
          />
          <button
            aria-label={`Remove value ${v}`}
            onClick={() => onRemove(v)}
            className="px-1 text-rose-400 hover:bg-rose-50"
          >
            ✕
          </button>
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
        <input
          aria-label={`New value for ${category}`}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="add value…"
          className="flex-1 rounded border border-slate-200 p-0.5 text-xs"
        />
        <button className="rounded border border-slate-300 px-1 text-xs">+</button>
      </form>
    </div>
  );
}
