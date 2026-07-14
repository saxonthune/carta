---
title: Plain Language Instruction Signal
summary: Sources behind the shipped plain-language guide (doc00.04), why an instruction signal beats linters and word lists, and the design constraints on the condensed artifact
tags: [plain-language, register, instruction-signal, authoring, codex, vocabulary]
deps: [doc01.09.12]
---

# Plain Language Instruction Signal

The codex ships a plain-language guide (doc00.04) as a single condensed artifact that skills compose by reference. This doc records the sources it condenses, the alternatives that were ruled out, and the design constraints that shaped it.

## The Problem

Doc prose drifts out of register session after session — jargon, coined compounds, one term carrying two senses, nominalized verbs. The signal that corrects the drift is an instruction signal, not a checker; without a shipped home it gets re-derived each session and lost when the session ends.

## Alternatives Ruled Out

- **First-pass authoring discipline.** The register does not hold under load — the model's trained verbosity bias reasserts mid-task. Consistent with the format-tax result (doc01.09.12): author freely, structure separately. The guide therefore serves rewrite and audit passes, not first-draft constraint.
- **Off-the-shelf prose linters.** Tested empirically: proselint's output on technical Markdown was overwhelmingly straight-vs-curly-quote noise; write-good similar. Neither catches coined vocabulary, the dominant failure.
- **Vocabulary allowlists/denylists.** Poor precision in a corpus dense with proper nouns, and an unbounded maintenance burden. ASD-STE100's dictionary half is exactly this shape and needs an institution behind it.

## Sources

| Source | What it holds | Role in doc00.04 |
|---|---|---|
| plainlanguage.gov (US Federal Plain Language Guidelines) | Public-domain guidance dense with before/after rewrites | Primary raw corpus — already contrastive |
| ASD-STE100 (Simplified Technical English) | Writing rules + approved-word dictionary | The rules: one word one meaning, one part of speech, short active sentences. The dictionary is skipped (an allowlist) |
| ISO 24495-1 | Four plain-language principles; paywalled, example-poor | Named anchor only |
| Garner's Modern English Usage | Usage and preposition calls | Cited by name for disputes |
| Kuhn 2014 CNL survey; Attempto Controlled English | The pre-LLM "constrain the writing language" tradition | Rationale/background; not shipped content |

## Why an Instruction Signal Works

The model already holds these standards from pretraining. The shipped artifact does three jobs the standards themselves cannot:

- **Activates the register.** Naming the standards recruits a large trained prior for a few tokens.
- **Pins the local failure modes.** Contrastive ✗/✓ pairs demonstrate the decision boundary that generic standards under-emphasize: coined compounds, sense collisions, part-of-speech drift, imprecise prepositions.
- **Names the glossary as the controlled vocabulary.** One preferred term per concept; extension over coinage; drift flagged, not adopted.

Register-steering research supports the cost model: styles lose content in proportion to how much they constrain the carrier — its token budget, lexicon, or identity (the style-transfer triad, arxiv:2011.00416; deletion taxonomy, arxiv:2204.07562). A plain-language register constrains none of these, so steering toward it is informationally free.

## Design Constraints on the Artifact

- **One condensed copy.** The template in `rhidoc/templates/` is the sole condensed artifact, shipped into every workspace as a codex doc via init/rehydrate. A second condensed intermediate would drift from the first.
- **Neutral.** The guide states the standard and nothing else — no opinions on when it applies. Each consuming skill (docs-development, auditors, pass-through cleaners) owns its own invocation guidance.
- **Examples carry the tokens.** Per rule: a one-line statement, a one-clause rationale, then contrastive pairs. Roughly two-thirds of the token budget sits in the pairs, because a pair demonstrates the boundary a definition only describes.
- **Composable size.** Small enough to load into another skill's context without crowding it; a guide that outgrows that budget gets summarized rather than obeyed.
