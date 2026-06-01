# Assumptions & Clarifications

This document records every place where SPECS.md was silent, ambiguous, or in
tension with the project owner's direct instructions. Per the working
agreement, assumptions are kept to a minimum and each is justified.

## A. Direct-instruction overrides of SPECS.md

These are cases where the owner's message takes precedence over the written
spec. They are recorded here for transparency.

1. **Deployment target.** SPECS.md §4 lists *Vercel (frontend + serverless
   function for the LLM proxy)*. The owner instructed that the app be deployed
   **on this AWS machine**. Resolution: the build is deployment-target
   agnostic — the frontend is a static Vite bundle and the LLM proxy is a small
   Node/Express server (exactly the architecture §4 describes), but it is served
   from this machine rather than Vercel. A single `npm run start` boots the
   Express server which also serves the built static assets. No Vercel-specific
   APIs are used, so a future Vercel deploy remains possible.

2. **Commit attribution.** All commits are authored solely as
   `Abhijai Chugh <abhijai.chugh@gmail.com>` with no co-author trailers, per
   explicit instruction.

## B. Genuine ambiguities in SPECS.md

1. **`n` upper bound.** §5.1 says the position category has values `1..n` and a
   puzzle is well-formed iff `n ∈ [3, 8]`, while §5.4's variable-count formula
   and §9 talk about `n=6`. We enforce the hard well-formedness bound
   `n ∈ [3, 8]`; performance targets (§9) are stated for `n=6` and treated as
   guidance, not validation rules.

2. **Position category as a clue argument.** §5.4 C3 notes that a C3 clue whose
   `X` is the position category is "a tautology or contradiction resolved at
   parse time." We extend this resolution to all clue types: any clue argument
   referencing the position category is validated/normalised at parse time
   rather than encoded as a CNF variable (the position axis is implicit, per
   §5.4's variable definition which excludes it).

3. **Clue self-reference rule.** §5.3 says `X ≠ Y` and parenthetically
   "(different categories)". We interpret the binding rule as: `X` and `Y` must
   reference **different categories** (not merely different cells). Comparing two
   values of the same category is rejected at validation.

4. **LLM model + proxy.** §4 specifies "Anthropic Claude API (Sonnet) via
   lightweight Node proxy." The proxy reads `ANTHROPIC_API_KEY` from the
   environment and targets the latest Sonnet model. If the key is absent the NL
   path is disabled gracefully and the UI surfaces structured-input-only mode —
   consistent with §4's hard requirement that the app "must function fully
   offline when natural-language input is not used."

5. **"Presentation" deliverable.** The owner asked that the
   composition-over-inheritance work be included in "your presentation." As no
   slide tooling or presentation artifact exists in-repo, this is delivered as
   `docs/COMPOSITION_OVER_INHERITANCE.md` — structured as presentation-ready
   speaker notes the owner can lift into slides on Friday.

6. **Grid dimensions for k categories.** §6.1 describes the grid as
   `n × (k−1)n`. We render the standard logic-grid pairwise matrix consistent
   with this, with the position category as one fixed axis.

## C. Things deliberately NOT assumed

- No clue types beyond the 9 in §5.3 (§2.2 / §5.3 are explicit).
- No puzzle generation (§2.2).
- No persistence beyond JSON import/export (§2.2 / §7).
- No multilingual support (§2.2).
