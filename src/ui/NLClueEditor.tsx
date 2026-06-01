/**
 * Natural-language clue entry (SPECS §5.9). The user types English; we ask the
 * proxy to interpret it; we display the parsed structured form and require an
 * explicit Confirm before the clue is added. The LLM never adds clues directly.
 */
import { useState } from 'react';
import { useStore } from '../store/store';
import { getClueHandler } from '../core/clues/registry';
import { validatePuzzle } from '../core/validation';
import { parseNaturalLanguage, type ParseResult } from './nl-client';
import type { Clue } from '../core/types';

export default function NLClueEditor() {
  const puzzle = useStore((s) => s.puzzle);
  const addClue = useStore((s) => s.addClue);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState<Extract<ParseResult, { ok: true }> | null>(null);
  const [error, setError] = useState<string | null>(null);

  const interpret = async () => {
    if (!text.trim()) return;
    setBusy(true);
    setError(null);
    setPending(null);
    const result = await parseNaturalLanguage(text.trim(), puzzle);
    setBusy(false);
    if (result.ok) {
      // Validate the parse against the schema before offering to confirm.
      const probe = validatePuzzle({
        ...puzzle,
        clues: [{ ...result.clue, id: puzzle.clues.length + 1 } as Clue],
      });
      if (!probe.ok) {
        setError("Couldn't parse this — try rephrasing or use structured input.");
        return;
      }
      setPending(result);
    } else {
      setError(result.error);
    }
  };

  const confirm = () => {
    if (!pending) return;
    addClue({ ...pending.clue, naturalLanguage: pending.naturalLanguage } as Omit<Clue, 'id'>);
    setPending(null);
    setText('');
  };

  const preview =
    pending &&
    getClueHandler(pending.clue.type).describe({ ...pending.clue, id: 0 } as Clue);

  return (
    <div className="space-y-2 rounded border border-slate-200 p-2">
      <textarea
        aria-label="Natural-language clue"
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={2}
        placeholder="e.g. The Norwegian lives in the first house."
        className="w-full rounded border border-slate-300 p-1 text-sm"
      />
      <button
        onClick={interpret}
        disabled={busy}
        className="w-full rounded bg-slate-800 px-2 py-1 text-sm text-white hover:bg-slate-700 disabled:opacity-50"
      >
        {busy ? 'Interpreting…' : 'Interpret'}
      </button>

      {error && <p className="text-xs text-rose-600">{error}</p>}

      {pending && (
        <div className="space-y-2 rounded bg-sky-50 p-2">
          <p className="text-sm">
            Interpreted as: <em>{preview}</em>
          </p>
          <div className="flex gap-2">
            <button
              onClick={confirm}
              className="rounded bg-emerald-600 px-2 py-1 text-xs text-white hover:bg-emerald-500"
            >
              Confirm &amp; add
            </button>
            <button
              onClick={() => setPending(null)}
              className="rounded border border-slate-300 px-2 py-1 text-xs"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
