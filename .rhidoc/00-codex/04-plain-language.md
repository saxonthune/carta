---
title: Plain Language
summary: The plain-language standard for workspace prose — named standards, contrastive rules for jargon, word senses, parts of speech, prepositions, and sentence shape; the glossary as controlled vocabulary
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

## The Glossary Is the Controlled Vocabulary

The workspace glossary owns the domain terms: one preferred term per concept, and prose adheres to it. A concept with no name is a reason to extend the glossary, not to coin a label in passing. Prose that drifts — jargon, a coined compound, a term used two ways — is flagged and corrected against the glossary, not adopted.
