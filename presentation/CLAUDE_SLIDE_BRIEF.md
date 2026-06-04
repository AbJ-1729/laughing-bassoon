# Slide-Generation Brief — paste this whole file to Claude

> **How to use:** Copy everything below the line into Claude. It is fully
> self-contained — Claude does **not** need access to the codebase. Pick your
> output format in §1, then send. Everything is factual and pre-verified; do not
> let the model invent numbers, features, or claims beyond what's written here.

---

## ROLE & TASK

You are an expert presentation designer and engineer building a **VC pitch deck**
for a software project called the **Logic-Grid Puzzle Solver**. Produce a
**9-slide deck** that is clean, premium, minimal-text, and investor-ready. The
deck supports a spoken 8-minute pitch (≈6 min slides + ≈2 min live demo) to the
investor who **funded the project and personally wrote its specification**.

Quality bar: this should look like a deck from a top product studio — generous
whitespace, one idea per slide, large type, a single accent color, no bullet
soup. The slides **complement** the speaker; they are not the script.

---

## 1. OUTPUT FORMAT — produce ALL of the following

1. **A runnable `python-pptx` script** that generates `pitch.pptx` with all 9
   slides, the exact on-screen text in §6, the design system in §5, and the
   **speaker notes** (from §6/§7) placed in each slide's notes field. Use only
   `python-pptx` (no external image fetches); embed the code card as a styled
   text box with a dark fill. Make it run with `pip install python-pptx` then
   `python build_deck.py`.
2. **A one-screen "deck map"** table (slide #, title, the ≤8-word on-screen line,
   presenter, seconds) so I can sanity-check pacing before running it.

If you cannot run code, still output the full script as text plus the deck map.
Do not output a vague outline — output the real, complete script.

---

## 2. THE SCENARIO (tone & framing)

- **Audience:** one VC. He wrote the spec himself and is technical enough to read
  code. He just returned from a safari trip; he's busy — 10 minutes total
  (8 min present + 2 min Q&A). He explicitly asked to see two things: (a) that
  the app **matches his spec**, and (b) how the team applied **Composition over
  Inheritance**, a principle he picked up on the trip.
- **Voice:** confident, warm, concise, *honest*. Address him as the spec's author
  ("you specified…", "your zebra example…"). One light, non-corny nod to the
  safari is fine. Do **not** oversell; he respects precision.
- **Two presenters:** *Abhijai* (slides 1–4 + the demo) and *Bhavay* (slides 5–9).
  The deck must support a clean handoff after slide 4 and a handoff to the demo
  after slide 9.

---

## 3. WHAT THE PRODUCT IS (for your understanding — don't dump this on a slide)

A web app where a user defines an "Einstein / zebra" logic-grid puzzle
(categories, values, clues) and gets back **the solution plus a step-by-step,
human-readable deduction chain** explaining how it's derived. A SAT solver finds
and verifies the unique answer; a separate forward-chaining inference engine,
guided by the SAT answer as an oracle, produces the plain-English proof — each
step citing the clues and prior steps it depends on. The novelty is the
**explanation**, not the solving.

---

## 4. VERIFIED FACTS (use these exactly — do NOT invent or inflate)

- **9 of 9** supported clue types implemented (C1–C9: equality, inequality,
  at/not-at position, immediately left/right of, next to, somewhere left/right of).
- **3 outcomes** detected: **unique** (shows the deduction chain),
  **under-constrained** (shows two solutions + flags ambiguous cells),
  **over-constrained** (shows a **minimal unsatisfiable subset (MUS)** of clues).
- **126 automated tests passing**; **91% coverage** on the core engine
  (validation/encoder/inference at or near 100%).
- Pipeline: **validate → encode → solve → classify → explain.**
- Runs **fully client-side in a Web Worker**, with a **10-second timeout**;
  in practice puzzles solve in **<100 ms**.
- SAT solver: **MiniSat** (via the `logic-solver` package).
- Inference engine: **6 rules (R1–R6)**, applied in priority order, **SAT answer
  used as an oracle** so the narrated proof never shows backtracking.
- **Fully offline-capable** — only the optional natural-language clue entry needs
  a network/LLM; the user **confirms every parse** before a clue is added.
- 5 built-in example puzzles, including Einstein's classic zebra (6 categories,
  15 clues).

**Never claim:** deployment to a public URL, a demo video, mobile support,
puzzle generation, or any clue type beyond the 9. These are out of scope.

---

## 5. DESIGN SYSTEM (apply consistently)

- **Palette:** paper `#F4F2E8` (background) · ink `#1A1A15` (text) · **emerald
  `#137A4C`** (single accent — it's the app's "Solved" green) · amber `#B6852A`
  (under-constrained) · rose `#A23B36` (over-constrained). Use the accent
  sparingly — one highlight per slide.
- **Type:** display/headings = **Newsreader** (serif); body/labels = **Hanken
  Grotesk** (sans); code = **JetBrains Mono**. (If unavailable in pptx, fall back
  to Georgia / Calibri / Consolas respectively.)
- **Scale (16:9, 13.33"×7.5"):** display ~54pt, title ~36pt, subtitle ~24pt,
  body ~18–20pt, code ~15pt, kicker label ~11pt mono uppercase with letter-spacing.
- **Layout:** wide margins; left-aligned; a small mono **kicker** label at the top
  of each content slide; lots of negative space.
- **Code card:** dark fill `#1A1A15`, light text, monospace, with simple syntax
  emphasis (keywords purple `#C792EA`, types blue `#82AAFF`, functions green
  `#7FD6A6`, strings amber `#E6C07B`, comments grey italic).
- **Section break (slide 6):** full emerald background, paper-colored text;
  optionally a small row of dots as a subtle "safari/leopard" motif.

---

## 6. THE 9 SLIDES (exact content)

> On-screen text must stay minimal — roughly what's quoted. The longer prose is
> the **speaker note** for that slide (put it in the notes field, not on the slide).

**Slide 1 — Cover · Abhijai · ~20s**
On screen: title **"Logic-Grid Puzzle Solver"**; subtitle *"Define a puzzle.
Solve it. Read the reasoning."*; small line "Abhijai · Bhavay".
Notes: "Welcome back. You wrote this spec yourself, so we'll keep it tight: what
we shipped, the honest calls where the spec went quiet, and how we applied
Composition over Inheritance — the principle you sent from the bush. We'll finish
by solving Einstein's riddle live."

**Slide 2 — The Brief · Abhijai · ~35s**
On screen: three words in columns — **Define · Solve · Explain** (Explain in
emerald, emphasized).
Notes: "Three jobs. Define a puzzle. Solve it — a real SAT solver finds and
verifies the answer. But the novelty you specified isn't solving, it's Explain —
a step-by-step, human-readable proof. Anyone can print an answer; we show the
reasoning."

**Slide 3 — Built to the Spec · Abhijai · ~45s**
On screen: four big metrics — **9/9 clue types · 3 outcomes · 126 tests · 91%
core coverage**; small footer line: "validate → encode → solve → classify →
explain · client-side · Web Worker · 10s timeout".
Notes: "All nine clue types, exactly — §5.3 said exactly. All three outcomes:
unique, under-constrained, over-constrained. Client-side, in a Web Worker, with
your ten-second timeout. 126 tests, 91% core coverage. Not a mock-up — the spec,
executed and tested."

**Slide 4 — Where the Spec Was Silent · Abhijai → hands to Bhavay · ~45s**
On screen: four short lines —
"≠ means different *cells*, not categories" ·
"logic-solver (same MiniSat core)" ·
"OpenRouter proxy (budget)" ·
"Zebra ≈ 60 steps — all cited".
Notes: "Four places the spec left room; all written up in our ASSUMPTIONS file.
The decisive one: the spec said *X is not Y* means different **categories** — but
your own zebra needs 'green is immediately left of white,' two values of the same
category. A strict reading makes your headline puzzle unbuildable, so we bound it
to different **cells**. The rest: a MiniSat-backed package, an OpenRouter proxy
for budget, and a zebra proof a bit longer than 30 steps — but every step cited.
Bhavay will show you how it reasons."

**Slide 5 — Reasoning, Not Just Answers · Bhavay · ~60s**
On screen: headline **"SAT finds it. The engine explains it."** (the word
*explains* in emerald); a small visual of a 2-step deduction chain with "from
clue 9" / "from step 1" pills next to a grid that's filling in; footer:
"oracle-guided · every step cites its clues + prior steps · no visible
backtracking".
Notes: "The SAT solver gives the answer — but a SAT proof is unreadable. So a
separate inference engine re-derives it the way a person would: 'From clue nine,
the Norwegian is in house one. House one is taken — so no other nationality can
be there.' Every step cites what it depends on. And we use the SAT answer as an
oracle: when the engine guesses, it already knows the right branch, so the proof
never shows backtracking. That's the product."

**Slide 6 — Composition over Inheritance · Bhavay · ~20s (SECTION BREAK)**
On screen (emerald bg): title **"Composition over Inheritance"**; one line "Grow
behaviour by adding a part — not by editing a class tree."
Notes: "The principle you asked about. Our one-liner: we add behaviour by adding
a small part, never by deepening a class hierarchy. Four places — here's the
clearest."

**Slide 7 — Four Seams · Bhavay · ~50s**
On screen: 2×2 grid of short labels —
"Clues = data + handler objects" · "A registry, not a base class" ·
"Inference rules = objects in a list" · "SAT solver = injected interface".
Notes: "Four seams. One: clues are plain data plus handler objects — no Clue
superclass with nine subclasses. Two: a registry maps each clue's type to its
handler, so the encoder, solver, validator and UI all just *ask the registry* —
none switches on clue type. Three: the six inference rules are objects in a
priority list — reprioritising is reordering a list. Four: the SAT solver sits
behind an interface we inject — swappable, and fakeable in tests. Let me make
seam one concrete."

**Slide 8 — Clues as Data + a Registry · Bhavay · ~70s (THE code slide)**
On screen: one dark code card containing exactly:
```ts
const C7: ClueHandler = {
  type: 'C7',
  inferenceRule: 'R3',
  relation: (px, py) => Math.abs(px - py) === 1,
  encode: (c, ctx) => /* … */,
};
const REGISTRY = new Map(ALL_HANDLERS.map(h => [h.type, h]));
```
Below the card, one line: **"Add a 10th clue type = one new object. Zero edits to
encoder, engine, validator."** Tiny file ref: "src/core/clues/handlers.ts ·
registry.ts".
Notes: "This is clue C7, 'next to.' It's an object: its type, which rule it feeds,
its position rule as a one-line function, and how to encode itself. All nine clues
are objects like this in one array; the registry is built from that array. The
payoff: to add a tenth clue type, I write one object and append it. The encoder,
the engine, the validator, the UI — none change, because none switch on clue type;
they ask the registry. With inheritance that's a new subclass plus edits scattered
everywhere. Here it's additive. That's composition earning its keep."

**Slide 9 — Where We Stand · Bhavay → hands to demo · ~35s**
On screen: three short lines "Spec, met. · Reasoning, readable. · Architecture,
additive."; large italic line **"Now — let's solve one live."**; tiny echo of the
metrics from slide 3.
Notes: "Spec — met. Reasoning — readable and cited. Architecture — additive, cheap
to grow. But you didn't fund slideware — so Abhijai will solve Einstein's riddle
live."

---

## 7. SPEAKER NOTES — also include the DEMO + Q&A

Put a **demo script** in slide 9's notes (or an appended hidden slide):

> **Demo (Abhijai, ~2 min), narrate while clicking — no live typing:**
> 1) Load **Zebra** → Solve. "Six categories, fifteen clues — solved and verified
> unique in under a second."
> 2) **Scrub the deduction chain** 3–4 steps. "Watch the grid light up; each step
> cites its clues."
> 3) Load **Contradiction** → Solve → show the red **MUS** banner. "It pinpoints
> the minimal set of conflicting clues — remove any one and it's solvable."
> 4) Load **Ambiguous** → Solve → two solutions side by side. "More than one
> answer; it flags the ambiguous cells. Unique, contradictory, ambiguous — all
> three, as specified." Fallback: a static zebra-solved screenshot.

Append a **Q&A prep** card (hidden slide or appendix notes), ~20s answers:
- *Zebra ~60 steps?* Faithful to the R2 template — one cited step per placement;
  folding them is a verbosity toggle, not a correctness issue.
- *Why OpenRouter not Anthropic?* Budget; identical contract (9 types or an
  error, user confirms every parse); one env var to switch to Sonnet.
- *Does composition cost anything?* Yes — one layer of indirection; we still use
  classes for state. Anti-deep-hierarchy, not anti-OOP.
- *Scale past the limits?* Within spec (≤8 values, ≤50 clues) everything is
  <100 ms; the MUS path is heaviest and still sub-second.
- *Is the LLM in the trust path?* No — it only proposes a parse; the user
  confirms, the structured form is the source of truth, and it works offline.

---

## 8. HARD RULES (quality gate — follow all)

1. **Exactly 9 slides** (a hidden 10th for the demo/Q&A appendix is fine).
2. **One idea per slide.** No slide has more than ~12 words of body text besides
   its title (the code slide is the only exception).
3. **Only one code slide** (slide 8). Do not add more code.
4. **Every number must match §4 exactly.** No invented stats, no rounding up.
5. **Honest tone on slide 4** — present assumptions as confident decisions, not
   apologies, and never hide them.
6. **Speaker notes in the notes field**, not on the slides.
7. **One accent color**, consistent fonts, lots of whitespace. No clip-art, no
   stock photos, no gradients except the optional emerald section break.
8. Keep the deck-map pacing total at **≈6:20 of slides + 2:00 demo ≈ 8:20**; if a
   slide's text won't fit the time, shorten the text, not the timing.

Now produce: (1) the deck-map table, then (2) the complete runnable python-pptx
script. Begin.
