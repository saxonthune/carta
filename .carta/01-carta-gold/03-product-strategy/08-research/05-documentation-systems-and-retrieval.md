---
title: Documentation Systems, Retrieval Quality, and Spec Authoring
status: active
summary: Principles behind hierarchical docs systems, agentic search improvement, scientific comparison of docs structures, and what makes individual specs good enough for code generation
tags: [docs, retrieval, ai, specifications, elicitation, information-architecture, evaluation]
deps: [doc00.04, doc01.03.08.04]
---

# Documentation Systems, Retrieval Quality, and Spec Authoring

Research session exploring three questions: what principles make hierarchical docs systems work for AI agents, how to scientifically compare one structure to another, and what makes an individual spec good enough that an LLM can reliably generate code from it.

## Why Hierarchical Docs Systems Work

Three principles from information retrieval theory explain why the `.carta/` docs structure succeeds:

### 1. Two-phase retrieval (cheap triage, then targeted read)

Every successful IR system separates *finding* from *reading*. MANIFEST.md is an inverted index — tags map to doc refs, summaries enable semantic matching. The agent never reads a doc it hasn't triaged first. RAG research confirms: systems that first identify which documents matter, then extract which sections matter, consistently outperform flat search. The `.carta/` system implements this with Grep (files_with_matches mode) then Read (specific lines).

### 2. Predictable structure reduces search entropy

Every doc has the same frontmatter shape (title, status, summary, tags, deps). Every directory has a predictable role (00-codex = meta, 01-product = what, 02-system = how, 03-operations = run, 04-research = why). The agent doesn't need to understand the docs to navigate them — the structure itself is a map. This is why faceted classification outperforms single hierarchy: the tag index gives the agent a second access path when the directory hierarchy doesn't match the query.

### 3. Simon's near-decomposability applied to documentation

Each doc is self-contained with explicit dependencies. The agent can read one doc without needing to read its neighbors. When it does need neighbors, the `deps` field says exactly which ones. Weak coupling between docs means the agent's context window stays focused.

## Improvements to the Docs System

### A. Reverse dependency index

MANIFEST has `deps` (what this doc depends on), but not "what depends on this doc." When the agent modifies doc01.03.08.04 (metamodel), it must scan the entire MANIFEST to find downstream docs. A reverse index in MANIFEST turns "what do I need to update?" from O(n) scan to O(1) lookup. This is a deterministic derivation from existing deps — a script can generate it.

### B. Section-level anchors for high-traffic docs

Current finest granularity is a whole doc. Docs like doc01.03.08.04 (metamodel) have distinct sections (M2, M1, M0, Port Registry, Standard Library) that are independently queryable. A section index for the 5-10 most-read docs would let the agent skip to the right 20 lines instead of reading 236.

Example format in MANIFEST:

```
| Doc | Section | Line | Tags |
|-----|---------|------|------|
| doc01.03.08.04 | M2: Fixed Primitives | 29 | DataKind, DisplayHint, Polarity |
| doc01.03.08.04 | M1: User-Defined Schemas | 76 | ConstructSchema, FieldSchema, PortConfig |
```

### C. Query patterns (worked examples)

The agent learns retrieval patterns faster from examples than from rules. A "common queries" section with question-to-retrieval-path mappings acts as few-shot prompting for retrieval.

### D. Freshness markers

A `last-verified` field in frontmatter (updated by documentation-nag) lets the agent weight recent docs higher. Only needed for high-churn docs where staleness is a real risk.

## Scientifically Comparing Docs Structures

### The Cranfield evaluation paradigm

Borrowed from information retrieval evaluation:

**1. Build a question bank.** 30-50 questions an agent should be able to answer using `.carta/`. Mix of:
- Factual lookup ("What are the five DataKind values?")
- Cross-reference ("Which docs need updating if I change the port polarity model?")
- Architectural ("Where does connection validation happen?")
- Procedural ("How do I add a new schema package?")

**2. Define ground truth.** For each question, the minimal set of docs (and sections) containing the answer.

**3. Measure retrieval quality.** Run the agent's retrieval strategy against each question:
- **Recall@k**: Of relevant docs, how many did the agent find in its first k reads?
- **Precision@k**: Of docs the agent read, how many were actually relevant?
- **Mean Reciprocal Rank**: How early did the first relevant doc appear?
- **Token cost**: Total tokens consumed across all reads.

**4. Measure downstream task quality.** After retrieval, did the agent answer correctly? Catches cases where retrieval was perfect but content was ambiguous.

### Practical implementation

A script that takes a question + retrieval strategy, records which files would be read and in what order, compares against ground truth, outputs precision/recall/tokens. Run whenever docs are restructured. If precision drops: reading too many irrelevant docs. If recall drops: index is missing connections. If tokens spike: granularity too coarse.

### What this lets you compare

- Flat tags vs. hierarchical paths
- Section-level index vs. doc-level index
- Reverse deps vs. forward deps only
- Fewer long docs vs. more short docs
- Different tag vocabularies

The question bank is manual curation, but once built, every structural change can be evaluated empirically.

## What Makes an Individual Spec Good

For LLM-to-code generation, four of IEEE 830's eight properties matter:

### 1. Unambiguous (one interpretation)

The most damaging requirement smell. Research identifies six major smell types:

| Smell | Example | Fix |
|-------|---------|-----|
| Vagueness | "handle errors appropriately" | "return ProblemDetails with 400 for validation, 404 for missing" |
| Subjectivity | "fast response time" | "p95 latency < 200ms" |
| Optionality | "may include pagination" | "includes pagination" or remove |
| Weakness | "should validate input" | "validates input; rejects if..." |
| Implicit reference | "the data" | "the `HouseholdAccount` record" |
| Unresolved branching | "depending on the case" | enumerate all cases |

The fix is always: **replace adjectives and adverbs with nouns and numbers.**

### 2. Complete (no gaps the LLM guesses at)

Completeness means every decision point is resolved:
- Inputs are typed (not "takes account data" but `{ householdId: string, members: Member[] }`)
- Outputs are typed
- Error cases are enumerated
- Edge cases are addressed or explicitly deferred

The test: **can you write the function signature and error cases from the spec alone, without asking questions?**

### 3. Testable (verifiable)

Every behavioral claim should map to a test assertion. Given/When/Then works as a completeness check: if you can't write it, the spec is too vague. If you can, the spec practically is the test.

### 4. Decomposed (low entropy per file)

Per Simon and Shannon: one concern per spec. A spec covering one transform with typed inputs and outputs is low-entropy. A spec covering "the whole flow" is high-entropy.

### What doesn't matter for LLM consumption

- Traceability (back-references to business requirements)
- Ranked importance (priority is a project management concern)
- Modifiability (specs are cheap to rewrite)

## Agent-Driven Elicitation

### Research findings

IEEE Requirements Engineering 2025 produced two directly applicable papers:

- **Follow-up question generation guided by mistake types** (arxiv 2507.02858): LLM-generated follow-up questions outperform human interviewer questions when guided by a taxonomy of common interviewer mistakes (failing to ask about error cases, accepting vague answers, not probing for edge cases, not asking about data types).

- **LLMREI: Automating Requirements Elicitation Interviews** (arxiv 2507.02564): Full multi-turn LLM interviewer conducting structured elicitation conversations.

### Elicitation protocol

The agent's job is to fill a shape file's frontmatter. Every unfilled field is a question.

**Phase 1 — Seed**: User gives a one-liner.

**Phase 2 — Expand**: Agent generates a draft shape file with best guesses and explicit `???` gaps.

**Phase 3 — Interrogate**: One question at a time, guided by smell types. After each answer:
- Vagueness: Did the answer use "appropriate," "relevant," "etc."? Probe.
- Missing error case: New entity referenced? "What if it doesn't exist?"
- Missing type: Data mentioned without shape? "What fields?"
- Implicit branching: "If" or "depending on"? "What are all the cases?"

**Phase 4 — Validate**: Read back the filled spec. "Is this complete? What did I miss?"

**Phase 5 — Smell check**: Scan for the 6 major smells. Flag and clarify.

### The completeness oracle

Strongest test: can `collate.py` assemble spec + patterns into a prompt and can the LLM generate a function signature + test stubs without inventing anything? If the LLM has to invent a field name, error case, or type, the spec has a gap. The invented items become the next interview questions.

### Partial automation

A `lint-spec.py` can catch low-hanging fruit deterministically:
- Vague words: "appropriate," "relevant," "proper," "etc.," "various," "some"
- Weak words: "should," "may," "might," "could," "can"
- Subjective words: "fast," "slow," "simple," "easy," "complex," "large," "small"
- Remaining `???` markers
- Empty `depends-on` arrays
- Missing error case sections

## References

- [Hierarchical RAG with Knowledge Structures (EMNLP 2025)](https://aclanthology.org/2025.findings-emnlp.321.pdf)
- [Enhancing RAG: Best Practices (COLING 2025)](https://aclanthology.org/2025.coling-main.449/)
- [Requirements Elicitation Follow-Up Question Generation (IEEE RE 2025)](https://arxiv.org/abs/2507.02858)
- [LLMREI: Automating Requirements Elicitation Interviews](https://arxiv.org/abs/2507.02564)
- [Characterizing Requirements Smells (2024)](https://arxiv.org/html/2404.11106v1)
- [Automated Smell Detection in NL Requirements (FSE 2024)](https://arxiv.org/abs/2305.07097)
- [IEEE 830-1998: Software Requirements Specifications](https://ieeexplore.ieee.org/document/720574)
- [On the Use of Agentic Coding Manifests (2025)](https://arxiv.org/html/2509.14744v1)
- [Stanford IR Book: Evaluation](https://nlp.stanford.edu/IR-book/pdf/08eval.pdf)
- [NN/g: Taxonomy 101](https://www.nngroup.com/articles/taxonomy-101/)
- [Faceted Classification (Berkeley Press)](https://berkeley.pressbooks.pub/tdo4p/chapter/faceted-classification/)
