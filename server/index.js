/**
 * Minimal Node/Express server (SPECS §4, §5.9).
 *
 * Two responsibilities, both intentionally small:
 *   1. POST /api/parse — the LLM clue-parsing proxy. Calls Claude (Sonnet) with
 *      a structured prompt and returns one of the 9 clue types or {error}.
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
const MODEL = process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-6';
const API_KEY = process.env.ANTHROPIC_API_KEY;

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

app.post('/api/parse', async (req, res) => {
  const { text, schema } = req.body ?? {};
  if (typeof text !== 'string' || !Array.isArray(schema)) {
    return res.status(400).json({ error: 'Invalid request' });
  }
  if (!API_KEY) {
    return res.status(503).json({ error: 'LLM proxy not configured (no ANTHROPIC_API_KEY).' });
  }
  try {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 256,
        messages: [{ role: 'user', content: buildPrompt(text, schema) }],
      }),
    });
    if (!r.ok) return res.status(502).json({ error: 'LLM upstream error' });
    const data = await r.json();
    const raw = (data.content?.[0]?.text ?? '').trim();
    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch {
      return res.json({ error: 'Unparseable LLM response' });
    }
    if (parsed.error) return res.json({ error: parsed.error });
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
