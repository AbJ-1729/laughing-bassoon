/**
 * Minimal Node/Express server (SPECS §4, §5.9).
 *
 * Two responsibilities, both intentionally small:
 *   1. POST /api/parse — the LLM clue-parsing proxy. Sends a structured prompt
 *      to an LLM and returns one of the 9 clue types or {error}. SPECS §4 calls
 *      for the Anthropic Claude API directly; per the project owner's budget
 *      constraint this routes through OpenRouter instead (an OpenAI-compatible
 *      gateway), with the model configurable — see ASSUMPTIONS.md §A.3.
 *   2. Serve the built static frontend (dist/) — this is how the app is
 *      deployed on this machine instead of Vercel (see ASSUMPTIONS.md §A.1).
 *
 * The app is fully usable without this server's LLM route; structured input,
 * solving and explanation are entirely client-side.
 */
import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
app.use(express.json({ limit: '64kb' }));

const PORT = process.env.PORT || 8787;
// OpenRouter (OpenAI-compatible). Model is configurable; the default is a
// budget-friendly model adequate for one-sentence→JSON parsing. Override with
// OPENROUTER_MODEL (e.g. 'anthropic/claude-3.5-sonnet') for higher accuracy.
const MODEL = process.env.OPENROUTER_MODEL || 'anthropic/claude-3.5-haiku';
const API_KEY = process.env.OPENROUTER_API_KEY;
const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';
const VALID_TYPES = new Set(['C1', 'C2', 'C3', 'C4', 'C5', 'C6', 'C7', 'C8', 'C9']);

const SUPPORTED = `C1 Equality "X is Y" {type,x:{category,value},y:{category,value}}
C2 Inequality "X is not Y" {type,x,y}
C3 At position "X is at position k" {type,x,k}
C4 Not at position "X is not at position k" {type,x,k}
C5 Immediately left of (pos(X)+1=pos(Y)) {type,x,y}
C6 Immediately right of (pos(X)-1=pos(Y)) {type,x,y}
C7 Next to (|pos(X)-pos(Y)|=1) {type,x,y}
C8 Somewhere left of (pos(X)<pos(Y)) {type,x,y}
C9 Somewhere right of (pos(X)>pos(Y)) {type,x,y}`;

function buildPrompt(text, schema) {
  return `You translate one English sentence describing a logic-grid puzzle clue into a single JSON clue object, or report that it cannot be mapped.

The puzzle categories and their values:
${JSON.stringify(schema, null, 2)}

Supported clue types (use EXACTLY these; reject anything else):
${SUPPORTED}

Rules:
- x and y are {"category","value"} referencing the schema above EXACTLY (case-sensitive).
- For C3/C4 use "k" (an integer position 1..n) instead of y.
- If the sentence cannot be expressed with exactly one of the 9 types, or references unknown categories/values, output {"error":"<reason>"}.
- Output ONLY minified JSON. No prose, no code fences.

Sentence: ${JSON.stringify(text)}`;
}

/** Some models wrap JSON in ```json fences despite instructions; strip them. */
function stripFences(s) {
  return s.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
}

app.post('/api/parse', async (req, res) => {
  const { text, schema } = req.body ?? {};
  if (typeof text !== 'string' || !Array.isArray(schema)) {
    return res.status(400).json({ error: 'Invalid request' });
  }
  if (!API_KEY) {
    return res.status(503).json({ error: 'LLM proxy not configured (no OPENROUTER_API_KEY).' });
  }
  try {
    const r = await fetch(OPENROUTER_URL, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${API_KEY}`,
        // Optional OpenRouter attribution headers.
        'HTTP-Referer': 'http://localhost',
        'X-Title': 'Logic-Grid Puzzle Solver',
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 256,
        temperature: 0,
        messages: [{ role: 'user', content: buildPrompt(text, schema) }],
      }),
    });
    if (!r.ok) return res.status(502).json({ error: 'LLM upstream error' });
    const data = await r.json();
    const raw = stripFences((data.choices?.[0]?.message?.content ?? '').trim());
    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch {
      return res.json({ error: 'Unparseable LLM response' });
    }
    if (parsed.error) return res.json({ error: parsed.error });
    // Enforce the §5.9 contract server-side: output must be one of the 9 types.
    if (!parsed.type || !VALID_TYPES.has(parsed.type)) {
      return res.json({ error: 'LLM returned a non-supported clue type' });
    }
    return res.json({ clue: parsed });
  } catch (err) {
    return res.status(502).json({ error: String(err?.message ?? err) });
  }
});

// Serve the built SPA (after `npm run build`).
const dist = path.resolve(__dirname, '..', 'dist');
app.use(express.static(dist));
app.get('*', (_req, res) => res.sendFile(path.join(dist, 'index.html')));

app.listen(PORT, () => {
  console.log(`Logic-grid app on http://localhost:${PORT}  (LLM proxy: ${API_KEY ? 'on' : 'off'})`);
});
