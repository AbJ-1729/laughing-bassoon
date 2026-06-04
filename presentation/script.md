# Talking Script — Logic-Grid Puzzle Solver (VC Pitch)

**Audience:** the VC who funded the project and personally wrote the spec.
**Budget:** ~6 min slides + ~2 min live demo = 8 min, then 2 min Q&A.
**Presenters:** Abhijai (Slides 1–4 + demo) · Bhavay (Slides 5–9).
**Delivery:** spoken, warm, confident, respectful of his time. Slides are minimal;
this script is the voice. Bracketed cues `[ ]` are actions, not spoken.

> Pacing: read at ~140 words/min. Each slide is pre-timed. If a rehearsal runs
> long, trim Slide 5 and Slide 7 first (marked ✂).

---

## SLIDE 1 — Cover · Abhijai · ~20s

> [Stand together. Abhijai speaks; deck on cover.]

"Good morning — and welcome back. You wrote the spec for this one yourself, so
we'll keep it tight: in the next eight minutes we'll show you what we shipped,
the honest calls we made where the spec went quiet, and how we applied
Composition over Inheritance — the principle you sent us from the bush. We'll
finish by solving Einstein's riddle, live. I'm Abhijai; Bhavay will take the
engineering half."

[Advance.]

---

## SLIDE 2 — The Brief · Abhijai · ~35s

"The app does three things. **Define** — the user declares categories, values,
and clues; that's the puzzle. **Solve** — a real SAT solver finds the answer and
*verifies* it's the only one. But the part you called the novelty isn't the
solving — solving is mechanical. It's **Explain**. [gesture to the accented word]
Anyone can print an answer. We produce a step-by-step, human-readable proof of
*why* — the way a person would reason it out. That's the product, and that's
where we spent our effort."

[Advance.]

---

## SLIDE 3 — Built to the Spec · Abhijai · ~45s

"So, against your spec. All **nine** clue types — exactly nine, no more, no
fewer, because §5.3 said exactly. All **three** outcomes detected — a unique
solution, an under-constrained puzzle with multiple answers, and an
over-constrained one with no answer. It all runs client-side, in a Web Worker,
with the ten-second timeout you asked for. And it's backed by **126 automated
tests** at **91% coverage** on the core engine. [beat] This isn't a prototype
that demos well once. It's the spec, executed and tested."

[Advance.]

---

## SLIDE 4 — Where the Spec Was Silent · Abhijai → Bhavay · ~45s

"Now — four places the spec left room, and the calls we made. We wrote every one
of these up in an ASSUMPTIONS file, so nothing here is hidden. The decisive one
is the first: the spec said *X is not Y* means two **different categories**. But
your own mandatory example — the zebra — needs 'the green house is immediately
left of the white house.' That's two values of the **same** category. A
strict reading would've made your headline puzzle impossible to build, so we
bound it to different *cells* instead. The others: a MiniSat-backed solver
package, an OpenRouter proxy to respect the budget, and a proof that runs a
little longer than thirty steps on the zebra — but every single step is cited.
[turn to Bhavay] And that reasoning is where Bhavay picks up."

> [Handoff. Bhavay steps to the front.]

---

## SLIDE 5 — Reasoning, Not Just Answers · Bhavay · ~60s ✂

"Thanks. This is the heart of it. The SAT solver gives us the answer — but a SAT
proof is a wall of clauses; no human reads that. So we built a *separate*
inference engine that re-derives the same solution the way you or I would.
[gesture to the chain] 'From clue nine, the Norwegian is in house one. House one
is now taken — so no other nationality can sit there.' Each step names the clues
and the earlier steps it leans on, so the whole chain is auditable. [beat] And
here's the clever part: the engine uses the SAT solver's answer as an **oracle**.
When it has to make a guess, it already knows the right one — so the explanation
never shows a wrong turn or backtracking. The reader sees a clean, confident
line of reasoning, start to finish."

[Advance.]

---

## SLIDE 6 — Composition over Inheritance · Bhavay · ~20s

"Which brings me to the principle you asked us to apply. Here's our one-line
version: **we grow behaviour by adding a small part — never by deepening a class
hierarchy.** We did it in four places. Let me show you the clearest one."

[Advance.]

---

## SLIDE 7 — Four Seams · Bhavay · ~50s ✂

"Four seams. **One** — clues are plain data plus handler objects; there's no
`Clue` base class with nine subclasses. **Two** — a registry maps each clue's
type to its handler, so the encoder, the solver, the validator, and the UI all
just *ask the registry*. None of them holds a base-class reference; none of them
knows about clue types directly. **Three** — the six inference rules are just
objects in a priority list, so changing how the solver reasons is reordering a
list, not rewriting a hierarchy. **Four** — the SAT solver sits behind an
interface we inject, so we can swap it, or fake it in a test. Let me make seam
one concrete."

[Advance.]

---

## SLIDE 8 — Clues as Data + a Registry · Bhavay · ~70s

"This is one clue — C7, 'next to.' It's an **object.** It carries its type, which
reasoning rule it feeds, its position rule as a one-line function — positions
differ by one — and how to encode itself. All nine clues are objects exactly
like this, in one array, and the registry is built straight from that array.
[beat — point to the payoff line] Here's why it matters to you. To add a tenth
clue type tomorrow, I write **one new object** and append it. The encoder, the
inference engine, the validator, the interface — **none of them change**, because
none of them switch on the clue type; they ask the registry. With a classic
inheritance tree, that's a new subclass *plus* edits scattered across every part
that touches clues. Here, the system grows by addition, not by surgery. That's
Composition over Inheritance earning its keep — and it's why this codebase stays
cheap to extend."

[Advance.]

---

## SLIDE 9 — Where We Stand · Bhavay → demo · ~35s

"So where does that leave us. Your spec — met. The reasoning — readable, and
cited. The architecture — additive, so it's cheap to grow. [beat] But you didn't
fund slideware. So to close, Abhijai's going to solve Einstein's riddle in front
of you, live."

> [Handoff back to Abhijai, who takes the keyboard / drives the app.]

---

## DEMO — Abhijai drives · ~2 min

> Four beats. Narrate while you click; don't type anything live. Keep moving.

**1. Solve the zebra (~30s).**
"This is the classic — six categories, fifteen clues. [Examples → Zebra → Solve]
…and there it is. Solved and *verified* unique in well under a second. Every cell
filled."

**2. Scrub the deduction chain (~40s).**
"But the answer isn't the point — this is. [open the deduction panel; step
forward 3–4 times with the playback bar] Watch the grid light up as each step
fires. 'From clue nine, the Norwegian's in house one.' Next step. Each one tells
you which clues and which earlier steps justify it. You can walk the entire proof,
forward or back."

**3. Over-constrained → MUS (~25s).**
"Now a broken puzzle. [Examples → Contradiction → Solve] Red banner — no solution.
And it doesn't just say 'no'; it pinpoints the **minimal** set of clues that
actually conflict. Remove any one of them and it's solvable again."

**4. Under-constrained → ambiguity (~25s).**
"And the opposite. [Examples → Ambiguous → Solve] Here there's more than one valid
answer — so it shows you both, side by side, and flags exactly which cells are
ambiguous, so you know what clue to add. [look up] Unique, contradictory,
ambiguous — all three, exactly as you specified."

> [If anything misbehaves: cut to the static zebra screenshot slide and narrate
> beat 2 from it. Don't troubleshoot live.]

"That's the build. We'd love your questions."

---

## Q&A PREP — keep answers to ~20s each

**"Why is the zebra ~60 steps, not under 30?"**
"That target's met on the smaller puzzles. The zebra runs longer because we stay
faithful to your R2 template — one cited step per placement. Every step is correct
and justified; folding them is a verbosity toggle, not a correctness fix."

**"Why OpenRouter, not the Anthropic API I specified?"**
"Purely budget. The contract is identical — it returns one of the nine clue types
or an error, and the user confirms every parse. It's one environment variable to
switch back to Sonnet."

**"Does composition cost you anything?"**
"Honestly, yes — one extra layer of indirection, a registry lookup instead of a
method call. And we still use classes where there's real state, like the knowledge
grid. We're not anti-object — we're anti-deep-hierarchy."

**"Will it scale past your limits — bigger puzzles, more clues?"**
"Within the spec's bounds — up to eight values, fifty clues — everything solves in
under a hundred milliseconds. The heaviest path is the minimal-conflict extraction,
and even that stays sub-second."

**"Is the LLM in the trust path? What if it's wrong?"**
"It isn't. The model only *proposes* a structured clue; the user confirms it before
anything is added, and the structured form is the source of truth. The whole app
works fully offline without it."

**"What would you build next?"**
"Three things, in order: fold the bijection steps to shorten the zebra proof,
retrofit the component library the spec named, and a one-click share link. None of
them touch the core — that's the point of how it's built."

---

## Timing card (tape to the laptop)

| # | Slide | Who | Target | Running |
|---|-------|-----|--------|---------|
| 1 | Cover | Abhijai | 0:20 | 0:20 |
| 2 | Brief | Abhijai | 0:35 | 0:55 |
| 3 | Built to Spec | Abhijai | 0:45 | 1:40 |
| 4 | Spec Was Silent | Abhijai→ | 0:45 | 2:25 |
| 5 | Reasoning | Bhavay | 1:00 | 3:25 |
| 6 | Composition | Bhavay | 0:20 | 3:45 |
| 7 | Four Seams | Bhavay | 0:50 | 4:35 |
| 8 | Code | Bhavay | 1:10 | 5:45 |
| 9 | Where We Stand | Bhavay→ | 0:35 | 6:20 |
| — | Demo | Abhijai | 2:00 | 8:20 |

> If you're past **4:00** at the end of Slide 5, skip the second sentence of Slide 7.
