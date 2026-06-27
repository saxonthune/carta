# .rhidoc/ Manifest

Machine-readable index for AI navigation. Read this file first, then open only the docs relevant to your query.

**Retrieval strategy:** See doc00.00 (codex index) for how to find and read docs efficiently.

## Column Definitions

- **Ref**: Cross-reference ID (`docXX.YY.ZZ`)
- **File**: Path relative to title directory
- **Summary**: One-line description for semantic matching
- **Tags**: Keywords for file-path→doc mapping
- **Deps**: Doc refs to check when this doc changes
- **Refs**: Reverse deps — docs that list this one in their Deps (computed automatically)
- **Attachments**: Non-md files sharing the doc's numeric prefix. Sidecar artifacts that travel with the doc during structural operations. Purely filesystem-derived; not a frontmatter field.

Orphaned attachments (non-md files with no corresponding root .md) are reported as warnings on stderr during regeneration and do not appear in this table.

## 00-codex — Codex

| Ref | File | Summary | Tags | Deps | Refs | Attachments |
|-----|------|---------|------|------|------|-------------|

| doc00.00 | `00-index.md` | Meta-documentation — how to read, navigate, and maintain this workspace | index, meta | — | doc03.08.05 | — |
| doc00.01 | `01-about.md` | Why this workspace exists, how to read it, two-sources-of-truth theory | docs, meta, theory | — | — | — |
| doc00.02 | `02-maintenance.md` | Doc philosophy — docs convert volatile source signals into stable intent; declarative intent, banned patterns, prefer facts to prose (purposed terms, splits with criteria, directional facts), author freely then structure separately, when to grow detail | docs, maintenance, philosophy, relational-facts | — | doc03.08.12 | — |
| doc00.03 | `03-conventions.md` | Cross-reference syntax, frontmatter schema, file naming, writing style | docs, conventions | — | doc03.09 | — |

## 01-architecture — Architecture

| Ref | File | Summary | Tags | Deps | Refs | Attachments |
|-----|------|---------|------|------|------|-------------|

| doc01.00 | `00-index.md` |  |  | — | — | — |
| doc01.01 | `01-script-pipeline.md` | Architecture considerations for spec-code reconciliation — mechanism-agnostic, research-stage | reconciliation, architecture, specs, alignment | doc03.07 | doc02.02 | — |

### Design Patterns

| Ref | File | Summary | Tags | Deps | Refs | Attachments |
|-----|------|---------|------|------|------|-------------|

| doc01.02.00 | `02-design-patterns/00-index.md` | Language-specific patterns and conventions for AI-maintainable code | patterns, conventions, ai, architecture | — | — | — |
| doc01.02.01 | `02-design-patterns/01-python-for-ai.md` | File structure, typing, naming, testability patterns for AI-maintained Python | python, patterns, ai, conventions, testing, typing | doc01.02 | — | — |

## 02-product-design — Product Design

| Ref | File | Summary | Tags | Deps | Refs | Attachments |
|-----|------|---------|------|------|------|-------------|

| doc02.00 | `00-index.md` |  |  | — | — | — |
| doc02.02 | `02-cli-user-flow.md` | How users install the rhidoc CLI, hydrate a repo, and use it for workspace operations | cli, workflow, installation, use-case | doc01.01 | — | — |

### Workspace Scripts

| Ref | File | Summary | Tags | Deps | Refs | Attachments |
|-----|------|---------|------|------|------|-------------|

| doc02.01.00 | `01-workspace-scripts/00-index.md` |  |  | — | — | — |
| doc02.01.01 | `01-workspace-scripts/01-workspace-scripts.md` | Design details for the Rhidoc Docs API — command semantics, delivery mechanisms, scope boundary | docs-api, workspace, tools, scripts | doc03.06.01 | — | — |
| doc02.01.02 | `01-workspace-scripts/02-invariants.md` | Invariants that every valid .rhidoc/ workspace must satisfy at rest — functions of state, oracles for property tests | invariants, workspace, properties, specs | — | doc02.01.03, doc02.01.04 | — |
| doc02.01.03 | `01-workspace-scripts/03-properties.md` | PROP-* property statements for the action catalog, each tagged with the actions and invariants they correlate | properties, testing, invariants, specs | doc02.01.02 | — | — |
| doc02.01.04 | `01-workspace-scripts/04-errors.md` | ERR-* error codes — one per guard failure, mapped to exception classes and CLI exit behavior | errors, guards, specs | doc02.01.02 | — | — |

### Decisions Index

| Ref | File | Summary | Tags | Deps | Refs | Attachments |
|-----|------|---------|------|------|------|-------------|

| doc02.03.00 | `03-decisions/00-index.md` | Architecture Decision Records | index, adr, decisions | — | — | — |

## 03-product-strategy — Product Strategy

| Ref | File | Summary | Tags | Deps | Refs | Attachments |
|-----|------|---------|------|------|------|-------------|

| doc03.00 | `00-index.md` |  |  | — | — | — |
| doc03.01 | `01-mission.md` | Core goal — spec-driven development tool | mission, principles | — | doc03.04.01, doc03.04.02, doc03.04.03, doc03.05 | — |
| doc03.02 | `02-vision.md` | Rhidoc is the transmission mechanism between AI and SDLC — converting AI capability into software through structured specifications | vision, transmission, ai, sdlc, spec-driven | — | — | — |
| doc03.03 | `03-glossary.md` | Canonical vocabulary: products, workspace, spec, shape | glossary, terms | — | — | — |
| doc03.05 | `05-docs-system.md` | The .rhidoc/ workspace format — hierarchical docs, frontmatter, cross-references, MANIFEST | docs, workspace, format | doc03.01 | doc03.06.01, doc03.07, doc03.08.06 | — |
| doc03.07 | `07-spec-reconciliation.md` | Comparing specifications against source code to detect drift and suggest alignment — mechanism-agnostic | reconciliation, specs, spec-driven, alignment | doc03.05 | doc01.01, doc03.08.04 | — |
| doc03.09 | `09-docs-syntax-reference.md` | Formal grammar and extraction rules for doc references, sections, frontmatter, and MANIFEST | docs, syntax, reference, sections, grammar | doc00.03 | — | — |

### Primary Sources

| Ref | File | Summary | Tags | Deps | Refs | Attachments |
|-----|------|---------|------|------|------|-------------|

| doc03.04.00 | `04-primary-sources/00-index.md` | Author's original writings, directional intent | inspiration, vision, primary-source | — | — | — |
| doc03.04.01 | `04-primary-sources/01-the-carta-experiment.md` | Artifact-driven development, code-minus-one abstraction layers | AI, coding, planning, category theory, morphisms, artifact-driven development | doc03.01 | doc03.04.02, doc03.04.03, doc03.08.03, doc03.08.04, doc03.08.07, doc03.08.08 | — |
| doc03.04.02 | `04-primary-sources/02-theoretical-foundations.md` | Why spec-driven development works with AI — primary sources from Alexander, Simon, and Shannon, plus the decreasing indirection thesis | spec-driven, AI, theory, patterns, complexity, information-theory, artifact-driven development | doc03.01, doc03.04.01, doc03.08.03 | doc03.04.03, doc03.08.07, doc03.08.09 | — |
| doc03.04.03 | `04-primary-sources/03-unfolding-as-development.md` | Embryonic development applied to software — start with a working end-to-end system, let forces cross thresholds before adding complexity, preserve structure at every step | unfolding, methodology, alexander, forces, structure-preserving, ai, development | doc03.01, doc03.04.01, doc03.04.02 | doc03.08.10, doc03.08.11 | — |

### Products

| Ref | File | Summary | Tags | Deps | Refs | Attachments |
|-----|------|---------|------|------|------|-------------|

| doc03.06.00 | `06-products/00-index.md` |  |  | — | — | — |
| doc03.06.01 | `06-products/01-cli-scripts.md` | Deterministic Python operations on .rhidoc/ workspace documents — designed primarily for AI agents | docs-api, workspace, tools, scripts, ai | doc03.05 | doc02.01.01 | — |

### Research Sessions

| Ref | File | Summary | Tags | Deps | Refs | Attachments |
|-----|------|---------|------|------|------|-------------|

| doc03.08.00 | `08-research/00-index.md` | Research section index: session format, what belongs here | index, research | — | — | — |
| doc03.08.01 | `08-research/01-token-efficiency-in-skills-and-agents.md` | Token optimization patterns: lean extraction, subagent isolation, surgical reads | tokens, efficiency, skills, agents, context-engineering | — | doc03.08.02, doc03.08.12 | — |
| doc03.08.02 | `08-research/02-verifiability-and-testability.md` | Epistemology of verification, test value hierarchy, decomposition inventory, testability architecture | testing, verification, epistemology, agents, testability, oracles, properties | doc03.08.01 | — | — |
| doc03.08.03 | `08-research/03-decomposition-and-composition-theory.md` | Mathematical foundations for spec-driven development — what makes a good decomposition, and how pieces compose back | decomposition, composition, information-theory, modularity, spec-driven, category-theory, complexity | doc03.04.01 | doc03.04.02, doc03.08.07 | — |
| doc03.08.04 | `08-research/04-spec-code-reconciliation.md` | Two-source-of-truth model, filesystem data formats, deterministic scripts, LLM-assisted reconciliation between product specs and codebases | spec-driven, reconciliation, formats, scripts, decomposition, information-theory, llm, static-analysis | doc03.04.01, doc03.07 | doc03.08.05, doc03.08.06 | — |
| doc03.08.05 | `08-research/05-documentation-systems-and-retrieval.md` | Principles behind hierarchical docs systems, agentic search improvement, scientific comparison of docs structures, and what makes individual specs good enough for code generation | docs, retrieval, ai, specifications, elicitation, information-architecture, evaluation | doc00.00, doc03.08.04 | doc03.08.12 | — |
| doc03.08.06 | `08-research/06-spec-format-vocabulary.md` | What parts of the spec format Rhidoc has opinions on vs what's up to users — format concerns vs user concerns | specs, vocabulary, format, agnosticism, workspace, principles | doc03.05, doc03.08, doc03.08.04 | doc03.08.12 | — |
| doc03.08.07 | `08-research/07-product-as-transition-system.md` | Modeling products as guarded transition systems — verifiable reachability, dead-end detection, and deductive architecture from product properties | product-modeling, transition-systems, verification, architecture, reachability, spec-driven, artifact-driven development | doc03.04.01, doc03.04.02, doc03.08.03 | doc03.08.08, doc03.08.09 | — |
| doc03.08.08 | `08-research/08-structured-product-modeling.md` | The set of formal structures needed to fully describe a business product — entity models, decision tables, state machines, and six more — plus how they compose | product-modeling, decision-tables, state-machines, entities, enumerations, constraints, spec-driven | doc03.08.07, doc03.04.01 | doc03.08.09 | — |
| doc03.08.09 | `08-research/09-action-based-api-design.md` | Why REST taxonomies are dead structures, how action-based APIs grow additively, and the connection between API shape and living systems | api, rest, rpc, trpc, concept-design, living-structure, additive-growth | doc03.04.02, doc03.08.07, doc03.08.08 | doc03.08.10, doc03.08.11 | — |
| doc03.08.10 | `08-research/10-contract-first-development.md` | The action contract is the skeleton, not the database — define contracts, build screens against mocks, defer persistence until the contract stabilizes | contract-first, mock-first, action-based, unfolding, persistence, methodology | doc03.04.03, doc03.08.09 | doc03.08.11 | — |
| doc03.08.11 | `08-research/11-concept-first-sequencing.md` | How concept-driven design composes with unfolding — concepts before code, contracts before backends, the ordering that makes AI-powered development coherent | concepts, jackson, unfolding, sequencing, methodology, ai | doc03.04.03, doc03.08.10, doc03.08.09 | — | — |
| doc03.08.12 | `08-research/12-structured-authoring-and-the-format-tax.md` | Evidence that constraining LLM generation through a structured write-API imposes a measurable quality tax, while post-hoc structuring of a free draft does not — author freely, structure separately | authoring, structure, format-tax, constrained-decoding, specs, ai, generation | doc03.08.05, doc03.08.01, doc03.08.06, doc00.02 | — | — |

## Tag Index

Quick lookup for file-path→doc mapping:

| Tag | Relevant Docs |
|-----|---------------|
| `AI` | doc03.04.01, doc03.04.02 |
| `action-based` | doc03.08.10 |
| `additive-growth` | doc03.08.09 |
| `adr` | doc02.03.00 |
| `agents` | doc03.08.01, doc03.08.02 |
| `agnosticism` | doc03.08.06 |
| `ai` | doc01.02.00, doc01.02.01, doc03.02, doc03.04.03, doc03.06.01, doc03.08.05, doc03.08.11, doc03.08.12 |
| `alexander` | doc03.04.03 |
| `alignment` | doc01.01, doc03.07 |
| `api` | doc03.08.09 |
| `architecture` | doc01.01, doc01.02.00, doc03.08.07 |
| `artifact-driven development` | doc03.04.01, doc03.04.02, doc03.08.07 |
| `authoring` | doc03.08.12 |
| `category theory` | doc03.04.01 |
| `category-theory` | doc03.08.03 |
| `cli` | doc02.02 |
| `coding` | doc03.04.01 |
| `complexity` | doc03.04.02, doc03.08.03 |
| `composition` | doc03.08.03 |
| `concept-design` | doc03.08.09 |
| `concepts` | doc03.08.11 |
| `constrained-decoding` | doc03.08.12 |
| `constraints` | doc03.08.08 |
| `context-engineering` | doc03.08.01 |
| `contract-first` | doc03.08.10 |
| `conventions` | doc00.03, doc01.02.00, doc01.02.01 |
| `decision-tables` | doc03.08.08 |
| `decisions` | doc02.03.00 |
| `decomposition` | doc03.08.03, doc03.08.04 |
| `development` | doc03.04.03 |
| `docs` | doc00.01, doc00.02, doc00.03, doc03.05, doc03.08.05, doc03.09 |
| `docs-api` | doc02.01.01, doc03.06.01 |
| `efficiency` | doc03.08.01 |
| `elicitation` | doc03.08.05 |
| `entities` | doc03.08.08 |
| `enumerations` | doc03.08.08 |
| `epistemology` | doc03.08.02 |
| `errors` | doc02.01.04 |
| `evaluation` | doc03.08.05 |
| `forces` | doc03.04.03 |
| `format` | doc03.05, doc03.08.06 |
| `format-tax` | doc03.08.12 |
| `formats` | doc03.08.04 |
| `generation` | doc03.08.12 |
| `glossary` | doc03.03 |
| `grammar` | doc03.09 |
| `guards` | doc02.01.04 |
| `index` | doc00.00, doc02.03.00, doc03.08.00 |
| `information-architecture` | doc03.08.05 |
| `information-theory` | doc03.04.02, doc03.08.03, doc03.08.04 |
| `inspiration` | doc03.04.00 |
| `installation` | doc02.02 |
| `invariants` | doc02.01.02, doc02.01.03 |
| `jackson` | doc03.08.11 |
| `living-structure` | doc03.08.09 |
| `llm` | doc03.08.04 |
| `maintenance` | doc00.02 |
| `meta` | doc00.00, doc00.01 |
| `methodology` | doc03.04.03, doc03.08.10, doc03.08.11 |
| `mission` | doc03.01 |
| `mock-first` | doc03.08.10 |
| `modularity` | doc03.08.03 |
| `morphisms` | doc03.04.01 |
| `oracles` | doc03.08.02 |
| `patterns` | doc01.02.00, doc01.02.01, doc03.04.02 |
| `persistence` | doc03.08.10 |
| `philosophy` | doc00.02 |
| `planning` | doc03.04.01 |
| `primary-source` | doc03.04.00 |
| `principles` | doc03.01, doc03.08.06 |
| `product-modeling` | doc03.08.07, doc03.08.08 |
| `properties` | doc02.01.02, doc02.01.03, doc03.08.02 |
| `python` | doc01.02.01 |
| `reachability` | doc03.08.07 |
| `reconciliation` | doc01.01, doc03.07, doc03.08.04 |
| `reference` | doc03.09 |
| `relational-facts` | doc00.02 |
| `research` | doc03.08.00 |
| `rest` | doc03.08.09 |
| `retrieval` | doc03.08.05 |
| `rpc` | doc03.08.09 |
| `scripts` | doc02.01.01, doc03.06.01, doc03.08.04 |
| `sdlc` | doc03.02 |
| `sections` | doc03.09 |
| `sequencing` | doc03.08.11 |
| `skills` | doc03.08.01 |
| `spec-driven` | doc03.02, doc03.04.02, doc03.07, doc03.08.03, doc03.08.04, doc03.08.07, doc03.08.08 |
| `specifications` | doc03.08.05 |
| `specs` | doc01.01, doc02.01.02, doc02.01.03, doc02.01.04, doc03.07, doc03.08.06, doc03.08.12 |
| `state-machines` | doc03.08.08 |
| `static-analysis` | doc03.08.04 |
| `structure` | doc03.08.12 |
| `structure-preserving` | doc03.04.03 |
| `syntax` | doc03.09 |
| `terms` | doc03.03 |
| `testability` | doc03.08.02 |
| `testing` | doc01.02.01, doc02.01.03, doc03.08.02 |
| `theory` | doc00.01, doc03.04.02 |
| `tokens` | doc03.08.01 |
| `tools` | doc02.01.01, doc03.06.01 |
| `transition-systems` | doc03.08.07 |
| `transmission` | doc03.02 |
| `trpc` | doc03.08.09 |
| `typing` | doc01.02.01 |
| `unfolding` | doc03.04.03, doc03.08.10, doc03.08.11 |
| `use-case` | doc02.02 |
| `verification` | doc03.08.02, doc03.08.07 |
| `vision` | doc03.02, doc03.04.00 |
| `vocabulary` | doc03.08.06 |
| `workflow` | doc02.02 |
| `workspace` | doc02.01.01, doc02.01.02, doc03.05, doc03.06.01, doc03.08.06 |
