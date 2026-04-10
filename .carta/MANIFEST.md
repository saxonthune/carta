# .carta/ Manifest

Machine-readable index for AI navigation. Read this file first, then open only the docs relevant to your query.

**Retrieval strategy:** See doc00.04 for AI retrieval patterns.

## Column Definitions

- **Ref**: Cross-reference ID (`docXX.YY.ZZ`)
- **File**: Path relative to title directory
- **Summary**: One-line description for semantic matching
- **Tags**: Keywords for file-path→doc mapping
- **Deps**: Doc refs to check when this doc changes
- **Refs**: Reverse deps — docs that list this one in their Deps (computed automatically)

## 00-codex — Codex Index

| Ref | File | Summary | Tags | Deps | Refs |
|-----|------|---------|------|------|------|

| doc00.00 | `00-index.md` | Codex section index: what meta-documentation covers | index, meta | — | — |
| doc00.01 | `01-about.md` | Why this workspace exists, two-sources-of-truth theory, how to read | docs, meta, theory | — | — |
| doc00.02 | `02-maintenance.md` | Doc lifecycle — unfolding philosophy, development loop, versioning, epochs | docs, maintenance, philosophy | — | — |
| doc00.03 | `03-conventions.md` | docXX.YY syntax, front matter, file naming | docs, conventions | — | doc00.07 |
| doc00.04 | `04-ai-retrieval.md` | AI retrieval patterns, legal RAG inspiration | docs, ai, retrieval | — | doc01.03.08.05 |
| doc00.05 | `05-taxonomy.md` | Title system rationale, Diataxis spirit | docs, structure | — | — |
| doc00.06 | `06-ai-agent-integration.md` | AI workflow patterns: spec-to-code, code-to-spec, MCP setup, guide directory | ai, workflow, mcp, guides | doc01.03.08.03 | — |
| doc00.07 | `07-docs-syntax-reference.md` | Formal grammar and extraction rules for doc references, sections, frontmatter, and MANIFEST | docs, syntax, reference, sections, grammar | doc00.03 | — |

## 01-carta-gold — Carta Gold

| Ref | File | Summary | Tags | Deps | Refs |
|-----|------|---------|------|------|------|

| doc01.00 | `00-index.md` |  |  | — | — |

### Architecture

| Ref | File | Summary | Tags | Deps | Refs |
|-----|------|---------|------|------|------|

| doc01.01.00 | `01-architecture/00-index.md` |  |  | — | — |
| doc01.01.01 | `01-architecture/01-script-pipeline.md` | Architecture considerations for spec-code reconciliation — mechanism-agnostic, research-stage | reconciliation, architecture, specs, alignment | doc01.03.07 | doc01.02.02 |
| doc01.01.02.00 | `01-architecture/02-design-patterns/00-index.md` | Language-specific patterns and conventions for AI-maintainable code | patterns, conventions, ai, architecture | — | — |
| doc01.01.02.01 | `01-architecture/02-design-patterns/01-python-for-ai.md` | File structure, typing, naming, testability patterns for AI-maintained Python | python, patterns, ai, conventions, testing, typing | doc01.01.02 | — |

### Product Design

| Ref | File | Summary | Tags | Deps | Refs |
|-----|------|---------|------|------|------|

| doc01.02.00 | `02-product-design/00-index.md` |  |  | — | — |
| doc01.02.01 | `02-product-design/01-workspace-scripts.md` | Design details for the Carta Docs API — command semantics, delivery mechanisms, scope boundary | docs-api, workspace, tools, scripts | doc01.03.06.01 | — |
| doc01.02.02 | `02-product-design/02-cli-user-flow.md` | How users install the carta CLI, hydrate a repo, and use it for workspace operations | cli, workflow, installation, use-case | doc01.01.01 | — |
| doc01.02.03.00 | `02-product-design/03-decisions/00-index.md` | Architecture Decision Records | index, adr, decisions | — | — |
| doc01.02.03.09 | `02-product-design/03-decisions/09-filesystem-workspace.md` | ADR: Filesystem-first workspace — `.carta/` directory, JSON canonical with binary sidecar, spec groups as directories, narrowed MCP surface, `carta serve .` | adr, workspace, filesystem, deployment, mcp, groups | doc01.03.04 | doc01.03.08.04 |

### Product Strategy

| Ref | File | Summary | Tags | Deps | Refs |
|-----|------|---------|------|------|------|

| doc01.03.00 | `03-product-strategy/00-index.md` |  |  | — | — |
| doc01.03.01 | `03-product-strategy/01-mission.md` | Core goal — spec-driven development tool | mission, principles | — | doc01.03.02, doc01.03.04.01, doc01.03.04.02, doc01.03.04.03, doc01.03.05 |
| doc01.03.02 | `03-product-strategy/02-principles.md` | Design principles: symmetric storage, inverse derivability, arrangement agnosticism | principles, design | doc01.03.01 | doc01.03.07, doc01.03.08.03, doc01.03.08.04, doc01.03.08.06 |
| doc01.03.03 | `03-product-strategy/03-glossary.md` | Canonical vocabulary: products, workspace, spec, shape | glossary, terms | — | — |
| doc01.03.04.00 | `03-product-strategy/04-primary-sources/00-index.md` | Author's original writings, directional intent | inspiration, vision, primary-source | — | — |
| doc01.03.04.01 | `03-product-strategy/04-primary-sources/01-the-carta-experiment.md` | Artifact-driven development, code-minus-one abstraction layers | AI, coding, planning, category theory, morphisms, artifact-driven development | doc01.03.01 | doc01.03.04.02, doc01.03.04.03, doc01.03.08.03, doc01.03.08.04, doc01.03.08.07, doc01.03.08.08 |
| doc01.03.04.02 | `03-product-strategy/04-primary-sources/02-theoretical-foundations.md` | Why spec-driven development works with AI — primary sources from Alexander, Simon, and Shannon, plus the decreasing indirection thesis | spec-driven, AI, theory, patterns, complexity, information-theory, artifact-driven development | doc01.03.01, doc01.03.04.01, doc01.03.08.03 | doc01.03.04.03, doc01.03.08.07, doc01.03.08.09 |
| doc01.03.04.03 | `03-product-strategy/04-primary-sources/03-unfolding-as-development.md` | Embryonic development applied to software — start with a working end-to-end system, let forces cross thresholds before adding complexity, preserve structure at every step | unfolding, methodology, alexander, forces, structure-preserving, ai, development | doc01.03.01, doc01.03.04.01, doc01.03.04.02 | doc01.03.08.10, doc01.03.08.11 |
| doc01.03.05 | `03-product-strategy/05-docs-system.md` | The .carta/ workspace format — hierarchical docs, frontmatter, cross-references, MANIFEST | docs, workspace, format | doc01.03.01 | doc01.03.06.01, doc01.03.07, doc01.03.08.06 |
| doc01.03.06.00 | `03-product-strategy/06-products/00-index.md` |  |  | — | — |
| doc01.03.06.01 | `03-product-strategy/06-products/01-cli-scripts.md` | Deterministic Python operations on .carta/ workspace documents — designed primarily for AI agents | docs-api, workspace, tools, scripts, ai | doc01.03.05 | doc01.02.01 |
| doc01.03.07 | `03-product-strategy/07-spec-reconciliation.md` | Comparing specifications against source code to detect drift and suggest alignment — mechanism-agnostic | reconciliation, specs, spec-driven, alignment | doc01.03.05, doc01.03.02 | doc01.01.01, doc01.03.08.04 |
| doc01.03.08.00 | `03-product-strategy/08-research/00-index.md` | Research section index: session format, what belongs here | index, research | — | — |
| doc01.03.08.01 | `03-product-strategy/08-research/01-token-efficiency-in-skills-and-agents.md` | Token optimization patterns: lean extraction, subagent isolation, surgical reads | tokens, efficiency, skills, agents, context-engineering | — | doc01.03.08.02 |
| doc01.03.08.02 | `03-product-strategy/08-research/02-verifiability-and-testability.md` | Epistemology of verification, test value hierarchy, decomposition inventory, testability architecture | testing, verification, epistemology, agents, testability, oracles, properties | doc01.03.08.01, doc01.01.05 | — |
| doc01.03.08.03 | `03-product-strategy/08-research/03-decomposition-and-composition-theory.md` | Mathematical foundations for spec-driven development — what makes a good decomposition, and how pieces compose back | decomposition, composition, information-theory, modularity, spec-driven, category-theory, complexity | doc01.03.02, doc01.03.04.01 | doc00.06, doc01.03.04.02, doc01.03.08.07 |
| doc01.03.08.04 | `03-product-strategy/08-research/04-spec-code-reconciliation.md` | Two-source-of-truth model, filesystem data formats, deterministic scripts, LLM-assisted reconciliation between product specs and codebases | spec-driven, reconciliation, formats, scripts, decomposition, information-theory, llm, static-analysis | doc01.03.02, doc01.03.04.01, doc01.03.07, doc01.02.03.09 | doc01.03.08.05, doc01.03.08.06 |
| doc01.03.08.05 | `03-product-strategy/08-research/05-documentation-systems-and-retrieval.md` | Principles behind hierarchical docs systems, agentic search improvement, scientific comparison of docs structures, and what makes individual specs good enough for code generation | docs, retrieval, ai, specifications, elicitation, information-architecture, evaluation | doc00.04, doc01.03.08.04 | — |
| doc01.03.08.06 | `03-product-strategy/08-research/06-spec-format-vocabulary.md` | What parts of the spec format Carta has opinions on vs what's up to users — format concerns vs user concerns | specs, vocabulary, format, agnosticism, workspace, principles | doc01.03.05, doc01.03.02, doc01.03.08, doc01.03.08.04 | — |
| doc01.03.08.07 | `03-product-strategy/08-research/07-product-as-transition-system.md` | Modeling products as guarded transition systems — verifiable reachability, dead-end detection, and deductive architecture from product properties | product-modeling, transition-systems, verification, architecture, reachability, spec-driven, artifact-driven development | doc01.03.04.01, doc01.03.04.02, doc01.03.08.03 | doc01.03.08.08, doc01.03.08.09 |
| doc01.03.08.08 | `03-product-strategy/08-research/08-structured-product-modeling.md` | The set of formal structures needed to fully describe a business product — entity models, decision tables, state machines, and six more — plus how they compose | product-modeling, decision-tables, state-machines, entities, enumerations, constraints, spec-driven | doc01.03.08.07, doc01.03.06.04, doc01.03.04.01 | doc01.03.08.09 |
| doc01.03.08.09 | `03-product-strategy/08-research/09-action-based-api-design.md` | Why REST taxonomies are dead structures, how action-based APIs grow additively, and the connection between API shape and living systems | api, rest, rpc, trpc, concept-design, living-structure, additive-growth | doc01.03.04.02, doc01.03.08.07, doc01.03.08.08 | doc01.03.08.10, doc01.03.08.11 |
| doc01.03.08.10 | `03-product-strategy/08-research/10-contract-first-development.md` | The action contract is the skeleton, not the database — define contracts, build screens against mocks, defer persistence until the contract stabilizes | contract-first, mock-first, action-based, unfolding, persistence, methodology | doc01.03.04.03, doc01.03.08.09 | doc01.03.08.11 |
| doc01.03.08.11 | `03-product-strategy/08-research/11-concept-first-sequencing.md` | How concept-driven design composes with unfolding — concepts before code, contracts before backends, the ordering that makes AI-powered development coherent | concepts, jackson, unfolding, sequencing, methodology, ai | doc01.03.04.03, doc01.03.08.10, doc01.03.08.09 | — |

## 02-carta — Carta

| Ref | File | Summary | Tags | Deps | Refs |
|-----|------|---------|------|------|------|

| doc02.00 | `00-index.md` |  |  | — | — |
| doc02.01 | `01-vision.md` | Carta is the transmission mechanism between AI and SDLC — converting AI capability into software through structured specifications | vision, transmission, ai, sdlc, spec-driven | — | doc02.02.00 |

### Concepts

| Ref | File | Summary | Tags | Deps | Refs |
|-----|------|---------|------|------|------|

| doc02.02.00 | `02-concepts/00-index.md` | Jackson-style concept inventory for Carta — the domain is software production | concepts, jackson, design | doc02.01 | — |

## Tag Index

Quick lookup for file-path→doc mapping:

| Tag | Relevant Docs |
|-----|---------------|
| `AI` | doc01.03.04.01, doc01.03.04.02 |
| `action-based` | doc01.03.08.10 |
| `additive-growth` | doc01.03.08.09 |
| `adr` | doc01.02.03.00, doc01.02.03.09 |
| `agents` | doc01.03.08.01, doc01.03.08.02 |
| `agnosticism` | doc01.03.08.06 |
| `ai` | doc00.04, doc00.06, doc01.01.02.00, doc01.01.02.01, doc01.03.04.03, doc01.03.06.01, doc01.03.08.05, doc01.03.08.11, doc02.01 |
| `alexander` | doc01.03.04.03 |
| `alignment` | doc01.01.01, doc01.03.07 |
| `api` | doc01.03.08.09 |
| `architecture` | doc01.01.01, doc01.01.02.00, doc01.03.08.07 |
| `artifact-driven development` | doc01.03.04.01, doc01.03.04.02, doc01.03.08.07 |
| `category theory` | doc01.03.04.01 |
| `category-theory` | doc01.03.08.03 |
| `cli` | doc01.02.02 |
| `coding` | doc01.03.04.01 |
| `complexity` | doc01.03.04.02, doc01.03.08.03 |
| `composition` | doc01.03.08.03 |
| `concept-design` | doc01.03.08.09 |
| `concepts` | doc01.03.08.11, doc02.02.00 |
| `constraints` | doc01.03.08.08 |
| `context-engineering` | doc01.03.08.01 |
| `contract-first` | doc01.03.08.10 |
| `conventions` | doc00.03, doc01.01.02.00, doc01.01.02.01 |
| `decision-tables` | doc01.03.08.08 |
| `decisions` | doc01.02.03.00 |
| `decomposition` | doc01.03.08.03, doc01.03.08.04 |
| `deployment` | doc01.02.03.09 |
| `design` | doc01.03.02, doc02.02.00 |
| `development` | doc01.03.04.03 |
| `docs` | doc00.01, doc00.02, doc00.03, doc00.04, doc00.05, doc00.07, doc01.03.05, doc01.03.08.05 |
| `docs-api` | doc01.02.01, doc01.03.06.01 |
| `efficiency` | doc01.03.08.01 |
| `elicitation` | doc01.03.08.05 |
| `entities` | doc01.03.08.08 |
| `enumerations` | doc01.03.08.08 |
| `epistemology` | doc01.03.08.02 |
| `evaluation` | doc01.03.08.05 |
| `filesystem` | doc01.02.03.09 |
| `forces` | doc01.03.04.03 |
| `format` | doc01.03.05, doc01.03.08.06 |
| `formats` | doc01.03.08.04 |
| `glossary` | doc01.03.03 |
| `grammar` | doc00.07 |
| `groups` | doc01.02.03.09 |
| `guides` | doc00.06 |
| `index` | doc00.00, doc01.02.03.00, doc01.03.08.00 |
| `information-architecture` | doc01.03.08.05 |
| `information-theory` | doc01.03.04.02, doc01.03.08.03, doc01.03.08.04 |
| `inspiration` | doc01.03.04.00 |
| `installation` | doc01.02.02 |
| `jackson` | doc01.03.08.11, doc02.02.00 |
| `living-structure` | doc01.03.08.09 |
| `llm` | doc01.03.08.04 |
| `maintenance` | doc00.02 |
| `mcp` | doc00.06, doc01.02.03.09 |
| `meta` | doc00.00, doc00.01 |
| `methodology` | doc01.03.04.03, doc01.03.08.10, doc01.03.08.11 |
| `mission` | doc01.03.01 |
| `mock-first` | doc01.03.08.10 |
| `modularity` | doc01.03.08.03 |
| `morphisms` | doc01.03.04.01 |
| `oracles` | doc01.03.08.02 |
| `patterns` | doc01.01.02.00, doc01.01.02.01, doc01.03.04.02 |
| `persistence` | doc01.03.08.10 |
| `philosophy` | doc00.02 |
| `planning` | doc01.03.04.01 |
| `primary-source` | doc01.03.04.00 |
| `principles` | doc01.03.01, doc01.03.02, doc01.03.08.06 |
| `product-modeling` | doc01.03.08.07, doc01.03.08.08 |
| `properties` | doc01.03.08.02 |
| `python` | doc01.01.02.01 |
| `reachability` | doc01.03.08.07 |
| `reconciliation` | doc01.01.01, doc01.03.07, doc01.03.08.04 |
| `reference` | doc00.07 |
| `research` | doc01.03.08.00 |
| `rest` | doc01.03.08.09 |
| `retrieval` | doc00.04, doc01.03.08.05 |
| `rpc` | doc01.03.08.09 |
| `scripts` | doc01.02.01, doc01.03.06.01, doc01.03.08.04 |
| `sdlc` | doc02.01 |
| `sections` | doc00.07 |
| `sequencing` | doc01.03.08.11 |
| `skills` | doc01.03.08.01 |
| `spec-driven` | doc01.03.04.02, doc01.03.07, doc01.03.08.03, doc01.03.08.04, doc01.03.08.07, doc01.03.08.08, doc02.01 |
| `specifications` | doc01.03.08.05 |
| `specs` | doc01.01.01, doc01.03.07, doc01.03.08.06 |
| `state-machines` | doc01.03.08.08 |
| `static-analysis` | doc01.03.08.04 |
| `structure` | doc00.05 |
| `structure-preserving` | doc01.03.04.03 |
| `syntax` | doc00.07 |
| `terms` | doc01.03.03 |
| `testability` | doc01.03.08.02 |
| `testing` | doc01.01.02.01, doc01.03.08.02 |
| `theory` | doc00.01, doc01.03.04.02 |
| `tokens` | doc01.03.08.01 |
| `tools` | doc01.02.01, doc01.03.06.01 |
| `transition-systems` | doc01.03.08.07 |
| `transmission` | doc02.01 |
| `trpc` | doc01.03.08.09 |
| `typing` | doc01.01.02.01 |
| `unfolding` | doc01.03.04.03, doc01.03.08.10, doc01.03.08.11 |
| `use-case` | doc01.02.02 |
| `verification` | doc01.03.08.02, doc01.03.08.07 |
| `vision` | doc01.03.04.00, doc02.01 |
| `vocabulary` | doc01.03.08.06 |
| `workflow` | doc00.06, doc01.02.02 |
| `workspace` | doc01.02.01, doc01.02.03.09, doc01.03.05, doc01.03.06.01, doc01.03.08.06 |
