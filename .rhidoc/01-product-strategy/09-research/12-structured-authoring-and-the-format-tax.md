---
title: Structured Authoring and the Format Tax
summary: Evidence that constraining LLM generation through a structured write-API imposes a measurable quality tax, while post-hoc structuring of a free draft does not — author freely, structure separately
tags: [authoring, structure, format-tax, constrained-decoding, specs, ai, generation]
deps: [doc01.09.05, doc01.09.01, doc01.09.06, doc00.02]
date: 2026-06-23
---

# Structured Authoring and the Format Tax

A research session testing one design instinct: that an AI agent will produce **denser, more coherent, more complete** specs if its writing is forced through a structured, tree-based editing API (insert nodes into a hierarchy, write into addressable subtrees) rather than emitting free-form prose with a plain write tool — and that the resulting artifact reads better for a downstream LLM. Grounded by a verified `/deep-research` pass (104 agents, 22 primary sources, 25 claims under 3-vote adversarial verification — 5 survived, 20 killed).

## #sec01 Verdict

The evidence **does not support forcing generation through the structure**, and partially argues against it. It **does support** structuring the artifact *after* a free draft. The distinction is load-bearing:

- **Constraining the generation** (the model composes directly into the structured form) imposes a measurable **format tax** on reasoning and writing quality.
- **Structuring the artifact post-hoc** (the model reasons and drafts freely, then a separate step places the draft into the tree) recovers almost all of that tax.

This maps onto the signal-conversion thesis (doc00.02): the free draft is the *signal* (becoming); the well-formed addressable artifact is its *settled form* (being). The optimal path keeps the two acts separate — **author freely, structure separately** — rather than fusing them into a single constrained-generation step.

## #sec02 What Survived Verification

Five claims survived 3-vote adversarial verification:

1. **The problem is real.** Free-writing LLMs have genuine, corroborated weaknesses in global structure, input coverage, and citation consistency (OutlineForge; corroborated by LongGenBench, LongEval, and 2025–2026 citation-hallucination studies). *High confidence (2-1).* The motivation for imposing structure stands — the deficiency it targets exists.

2. **A tree mechanism is a viable way to build a complete artifact incrementally.** Casting authoring as long-horizon planning over a hierarchical state with diff-based structural edits permits step-wise construction of a complete manuscript (OutlineForge, MDP over outline states). *High (3-0).* This is an **architecture** claim — the mechanism works — **not** a claim that it beats free-form generation on quality.

3. **Structured-output requirements degrade reasoning and writing.** Requiring JSON / XML / LaTeX / Markdown output substantially degrades performance across open-weight models (The Format Tax; Let Me Speak Freely — GPT-3.5 GSM8K 76.6% → 49.25% under strict JSON). *High (2-1).* **Scope limit:** the tax is specific to **open-weight** models — recent frontier closed-weight models show little to no format tax.

4. **The tax enters at the format-requesting prompt, not the decoder.** Ablation: the format-requesting prompt alone accounts for ~92% of the degradation (−3.9pp); adding grammar-constrained decoding contributes only −1.6pp more. *High (3-0).* **Most of the loss is recovered by separating reasoning/writing from formatting.** This is the strongest practical result in the pass.

5. **Constrained generation during self-correction trades reasoning for compliance.** Format constraints during reflection produce "structure snowballing" — near-perfect syntactic compliance while semantic errors go undetected and uncorrected. *Medium (2-1); single-model preprint, size-dependent and mitigable per CRANE.*

## #sec03 What Was Refuted

For honesty about what this pass does **not** license:

- **The positive case for structured authoring is largely unestablished, not merely unproven.** Nearly every "hierarchical/outline authoring improves quality/coherence/diversity/completeness" claim was refuted 0-3 (DOME dynamic hierarchical outlining; RecurrentGPT memory ablations; Writing Path outline-guided generation). These are the claims a structured write-API would rely on, and they did not survive.

- **The read-side / downstream-consumption benefit is also not firmly established here.** The document-structure-aids-RAG claims (+4.4 EM from explicit hierarchy; depth-scaling gains) were split/refuted (1-2 and 0-3). The read side remains the *more defensible* motivation, but this pass cannot strongly affirm it — earlier confidence that it was "near-pure benefit" was overstated.

## #sec04 Design Implication

The subsystem that lets an agent edit a markdown doc as an addressable tree (read-subtree, read-to-depth, insert, renumber) is **not invalidated** — its role is relocated:

- **The API is a placement / normalization layer, not a generation channel.** The agent reasons and drafts in free prose; a separate post-hoc pass lays the draft into the addressable tree. Finding 4 says this separation is where the quality lives.
- **The read-side operations are the safer investment** (they cost the model nothing at authoring time), though their benefit is defensible rather than proven.
- **A "hardcore, all writes through the API" rule survives only in the placement reading** — every *committed artifact* passes through the API, but the *thinking* is not straitjacketed into the structure. Forcing composition into the tree is the taxed path the evidence cautions against.

## #sec05 Scope and Caveats

- Strongest write-side sources (The Format Tax, the Alignment Tax / structure-snowballing work, OutlineForge, The Constraint Tax) are 2026 arXiv preprints — several not yet peer-reviewed, some single-author / single-model.
- The format tax is scoped to **open-weight** models; frontier closed-weight models (the strongest deployed agents) may not pay it. The size of any tax for the project's actual model is unmeasured.
- **No surviving claim is a head-to-head comparison** of a structured tree-editing API versus a free-form write tool for agent authoring. The closest evidence concerns output-format constraints and constrained decoding — a related but not identical mechanism. The project-specific question is best answered by an in-house Cranfield-style eval (doc01.09.05) plus a write-side A/B on density/coherence/completeness.

## #sec06 Open Questions

1. Does the open-weight-only format tax persist for the project's frontier model when the constraint is a fine-grained insert-node / write-subtree API rather than whole-response JSON formatting?
2. Does the read-side case (hierarchical structure improving retrieval precision/recall, answer correctness, token cost) hold under the project's own eval? This pass left it unconfirmed.
3. What is the effect of editing **granularity** (whole-file rewrite vs targeted structural subtree edits) on coherence and drift over long documents? Unaddressed by surviving evidence.
4. Where exactly is the placement boundary — does an agent draft a whole section freely then commit it, or draft per-node? The tax evidence favors larger free spans before committing.

## #sec07 References

- The Format Tax (arXiv 2604.03616) — structured output degrades open-weight reasoning/writing; tax enters at the prompt, not the decoder; frontier models exempt.
- Let Me Speak Freely? (arXiv 2408.02442, EMNLP 2024) — format restrictions degrade reasoning.
- From Hallucination to Structure Snowballing: The Alignment Tax of Constrained Decoding in LLM Reflection (arXiv 2604.06066).
- The Constraint Tax (arXiv 2605.26128); CRANE (arXiv 2502.09061, ICML 2025) — interleaving unconstrained reasoning recovers accuracy.
- OutlineForge (arXiv 2601.09858) — MDP over hierarchical outline states; real free-writing deficiencies in structure/coverage/citation.
- Refuted in this pass: DOME / dynamic hierarchical outlining (arXiv 2412.13575); RecurrentGPT (arXiv 2305.13304); Writing Path (arXiv 2404.13919); document-structure-aware RAG (arXiv 2510.04293).
