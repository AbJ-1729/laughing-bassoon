/**
 * Client for the LLM clue-parsing proxy (SPECS §5.9). Sends free-form text plus
 * the puzzle schema; receives a structured clue or an error. Enforces the 5s
 * timeout (§9). The structured result is the source of truth; the NL text is
 * kept only as a display label, and the user must confirm before it is added.
 */
import type { Clue, Puzzle } from '../core/types';

export type ParseResult =
  | { ok: true; clue: Omit<Clue, 'id'>; naturalLanguage: string }
  | { ok: false; error: string };

const TIMEOUT_MS = 5_000;
const VALID_CLUE_TYPES = new Set<string>(['C1', 'C2', 'C3', 'C4', 'C5', 'C6', 'C7', 'C8', 'C9']);

export async function parseNaturalLanguage(
  text: string,
  puzzle: Puzzle,
): Promise<ParseResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch('/api/parse', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({
        text,
        schema: puzzle.categories.map((c) => ({
          name: c.name,
          values: c.values,
          isPosition: c.name === puzzle.positionCategory,
        })),
      }),
    });
    if (!res.ok) {
      return { ok: false, error: "Couldn't parse this — try rephrasing or use structured input." };
    }
    const data = await res.json();
    if (data.error || !data.clue) {
      return { ok: false, error: "Couldn't parse this — try rephrasing or use structured input." };
    }
    // Guard against unknown clue types before they reach getClueHandler().
    if (typeof data.clue.type !== 'string' || !VALID_CLUE_TYPES.has(data.clue.type)) {
      return { ok: false, error: "Couldn't parse this — try rephrasing or use structured input." };
    }
    return { ok: true, clue: data.clue as Omit<Clue, 'id'>, naturalLanguage: text };
  } catch {
    return {
      ok: false,
      error:
        'Natural-language parsing is unavailable (offline or timed out). Use structured input instead.',
    };
  } finally {
    clearTimeout(timer);
  }
}
