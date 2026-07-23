---
title: Plain Language
summary: The plain-language standard for workspace prose — named standards, contrastive rules for jargon, word senses, parts of speech, prepositions, and sentence shape; normative register (invariant, principle, illustration); the glossary as controlled vocabulary
tags: [docs, plain-language, style, vocabulary, glossary]
deps: []
---

# Plain Language

Workspace prose is written in plain language. The standard is not house taste: **ISO 24495-1** (plain-language principles), the **plainlanguage.gov** federal guidelines, **ASD-STE100** Simplified Technical English (one word one meaning; each word in one part of speech), and **Garner's Modern English Usage** for usage calls. The rules below are the working subset; the named standards decide what the rules do not cover.

## Common Words Over Jargon

Use the plain phrase. Do not coin a compound or adopt a term of art where a plain verb phrase exists — a coined term is a private word the next reader must reverse-engineer. When a term of art is unavoidable, define it in one clause on first use, then use it consistently.

| ✗ Coined | ✓ Plain |
|---|---|
| we edge-typed the graph | we assigned supports/refutes types to the graph's edges |
| do a coverage push on the subtopic | gather more works on the subtopic |
| the keystone doc | the doc the others depend on |

## One Word, One Meaning

Each term carries one sense across the workspace. When a word starts doing two jobs, split the concepts and name them separately — the collision is a discovered gap in the vocabulary, not a style nit.

| ✗ Overloaded | ✓ Split |
|---|---|
| "standings" — both the live match feed and the computed ranking | "match feed" and "ranking" — two terms, two concepts |
| "mint" — assign an existing id, and also generate a new key | "assign an anchor id"; "generate a UUID" |

## Each Word in One Part of Speech

Use the plain verb. Verbing a noun, or wrapping a verb in a noun phrase, hides who does what.

| ✗ | ✓ |
|---|---|
| do a rename of the file | rename the file |
| run a validation on the config | validate the config |
| make a decision on the schema | decide the schema |

## Precise Prepositions

A transitive verb takes no preposition. A spatial preposition needs a real container, not a bare label.

| ✗ | ✓ |
|---|---|
| the doc references into W123 | the doc references W123 |
| write into L1 (a label, not a container) | write to the L1 store |
| based off of the abstract | based on the abstract |
| different than the prior run | different from the prior run |
| center around the thesis | center on the thesis |

## Sentence Shape

Short sentences, active voice, the actor as the subject. One idea per sentence; cut words that carry no information.

| ✗ | ✓ |
|---|---|
| It should be noted that validation is performed by the loader. | The loader validates the input. |
| There are three commands that operate on bundles. | Three commands operate on bundles. |

## Normative Register

A doc statement binds at one of three levels, and the language alone must tell the reader
which — an LLM applies an unmarked heuristic as a hard rule.

- **Invariant** — always true by construction, testable, apply literally. Written as a
  flat declarative: "Every Order is exactly one of: draft, placed."
- **Principle** — a design value that needs judgment to apply. Written as a triplet of
  preference verb, reason, and limit: "Favor X — because Y — except when Z." The
  preference verb ("favor", "prefer", "lean toward") marks the statement as
  interpretable; the reason teaches the intent; the limit keeps it from hardening into
  a rule.
- **Illustration** — an example, not a claim, marked as one: "e.g.", "such as".

| ✗ Unmarked | ✓ Marked |
|---|---|
| Differentiation over addition. | Favor differentiation over addition — a new need is usually an existing concept refined — except when no current concept's purpose covers it. |

State an invariant with no preference verb, and state a judgment call with one — never
as a flat command.

## The Glossary Is the Controlled Vocabulary

The workspace glossary owns the domain terms: one preferred term per concept, and prose adheres to it. Prose that drifts — jargon, a coined compound, a term used two ways — is flagged and corrected against the glossary, not adopted. The glossary's entry kinds and naming rules live in doc00.05.
