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
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';

export default function NLClueEditor() {
  const puzzle = useStore((s) => s.puzzle);
  const addClue = useStore((s) => s.addClue);
  const setMode = useStore((s) => s.setMode);
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
    <div className="space-y-2 rounded-md border p-2">
      <Textarea
        aria-label="Natural-language clue"
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={2}
        placeholder="e.g. The Norwegian lives in the first house."
      />
      <Button onClick={interpret} disabled={busy} size="sm" className="w-full">
        {busy ? 'Interpreting…' : 'Interpret'}
      </Button>

      {error && (
        <div className="space-y-1">
          <p className="text-xs text-destructive">{error}</p>
          <Button variant="link" size="sm" onClick={() => setMode('structured')} className="px-0">
            Switch to structured input
          </Button>
        </div>
      )}

      {pending && (
        <div className="space-y-2 rounded-md bg-accent p-2">
          <p className="text-sm">
            Interpreted as: <em>{preview}</em>
          </p>
          <div className="flex gap-2">
            <Button
              size="sm"
              onClick={confirm}
              className="bg-emerald-600 hover:bg-emerald-500"
            >
              Confirm &amp; add
            </Button>
            <Button variant="outline" size="sm" onClick={() => setPending(null)}>
              Cancel
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
