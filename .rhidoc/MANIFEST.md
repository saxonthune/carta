# .rhidoc/ Manifest

Machine-readable index for AI navigation. Read this file first, then open only the docs relevant to your query.

**Retrieval strategy:** See doc00.00 (handbook index) for how to find and read docs efficiently.

## Column Definitions

- **Ref**: Cross-reference ID (`docXX.YY.ZZ`)
- **File**: Path relative to title directory
- **Summary**: One-line description for semantic matching
- **Tags**: Keywords for file-path→doc mapping
- **Deps**: Doc refs to check when this doc changes
- **Refs**: Reverse deps — docs that list this one in their Deps (computed automatically)
- **Attachments**: Non-md files sharing the doc's numeric prefix. Sidecar artifacts that travel with the doc during structural operations. Purely filesystem-derived; not a frontmatter field.

Orphaned attachments (non-md files with no corresponding root .md) are reported as warnings on stderr during regeneration and do not appear in this table.

## 00-handbook — Handbook

| Ref | File | Summary | Tags | Deps | Refs | Attachments |
|-----|------|---------|------|------|------|-------------|

| doc00.00 | `00-index.md` |  |  | — | doc01.09.05 | — |
| doc00.01 | `01-about.md` | Why this workspace exists, how to read it, two-sources-of-truth theory | docs, meta, theory | — | — | — |
| doc00.02 | `02-maintenance.md` | Doc philosophy — docs convert volatile source signals into stable intent; declarative intent, prefer facts to prose, author freely then structure separately, docs grow by unfolding | docs, maintenance, philosophy | — | doc01.09.12 | — |
| doc00.03 | `03-conventions.md` | Cross-reference syntax, frontmatter schema, file naming, writing style | docs, conventions | — | doc01.10 | — |
| doc00.04 | `04-plain-language.md` | The plain-language standard for workspace prose — named standards, contrastive rules for jargon, word senses, parts of speech, prepositions, and sentence shape; normative register (invariant, principle, illustration); the glossary as controlled vocabulary | docs, plain-language, style, vocabulary, glossary | — | — | — |
| doc00.05 | `05-controlled-vocabulary.md` | The workspace glossary as a controlled vocabulary — entry kinds and sentence patterns from fact-based modeling (ORM), a worked example, and the naming rule | glossary, vocabulary, facts, subtypes, naming, docs | — | — | — |
| doc00.06 | `06-drift.md` | Why docs drift and the rules that prevent it — the two-copies condition, the reason-to-write test, the generate-or-type escape for shared facts, timeless writing, and the banned-pattern list | docs, drift, maintenance, style | — | — | — |

## 01-product-strategy — Product Strategy

| Ref | File | Summary | Tags | Deps | Refs | Attachments |
|-----|------|---------|------|------|------|-------------|

| doc01.00 | `00-index.md` |  |  | — | — | — |
| doc01.01 | `01-mission.md` | Core goal — spec-driven development tool | mission, principles | — | doc01.05.01, doc01.05.02, doc01.05.03, doc01.06 | — |
| doc01.02 | `02-vision.md` | Rhidoc is the transmission mechanism between AI and SDLC — converting AI capability into software through structured specifications | vision, transmission, ai, sdlc, spec-driven | — | — | — |
| doc01.03 | `03-concept-glossary.md` | Core ideas behind Rhidoc — signals metaphysics, intention, interpretation vs transduction, drift, and living structure | glossary, concepts, theory, signals, transduction | — | — | — |
| doc01.04 | `04-workspace-glossary.md` | Canonical vocabulary for the .rhidoc/ workspace format — products, workspace, spec, shape | glossary, terms, workspace | — | — | — |
| doc01.06 | `06-docs-system.md` | The .rhidoc/ workspace format — hierarchical docs, frontmatter, cross-references, MANIFEST | docs, workspace, format | doc01.01 | doc01.07.01, doc01.08, doc01.09.06 | — |
| doc01.08 | `08-spec-reconciliation.md` | Comparing specifications against source code to detect drift and suggest alignment — mechanism-agnostic | reconciliation, specs, spec-driven, alignment | doc01.06 | doc01.09.04, doc02.01 | — |
| doc01.10 | `10-docs-syntax-reference.md` | Formal grammar and extraction rules for doc references, sections, frontmatter, and MANIFEST | docs, syntax, reference, sections, grammar | doc00.03 | — | — |

### Primary Sources

| Ref | File | Summary | Tags | Deps | Refs | Attachments |
|-----|------|---------|------|------|------|-------------|

| doc01.05.00 | `05-primary-sources/00-index.md` |  |  | — | — | — |
| doc01.05.01 | `05-primary-sources/01-the-carta-experiment.md` | Artifact-driven development, code-minus-one abstraction layers | AI, coding, planning, category theory, morphisms, artifact-driven development | doc01.01 | doc01.05.02, doc01.05.03, doc01.09.03, doc01.09.04, doc01.09.07, doc01.09.08 | — |
| doc01.05.02 | `05-primary-sources/02-theoretical-foundations.md` | Why spec-driven development works with AI — primary sources from Alexander, Simon, and Shannon, plus the decreasing indirection thesis | spec-driven, AI, theory, patterns, complexity, information-theory, artifact-driven development | doc01.01, doc01.05.01, doc01.09.03 | doc01.05.03, doc01.09.07, doc01.09.09 | — |
| doc01.05.03 | `05-primary-sources/03-unfolding-as-development.md` | Embryonic development applied to software — start with a working end-to-end system, let forces cross thresholds before adding complexity, preserve structure at every step | unfolding, methodology, alexander, forces, structure-preserving, ai, development | doc01.01, doc01.05.01, doc01.05.02 | doc01.09.10, doc01.09.11 | — |

### Products

| Ref | File | Summary | Tags | Deps | Refs | Attachments |
|-----|------|---------|------|------|------|-------------|

| doc01.07.00 | `07-products/00-index.md` |  |  | — | — | — |
| doc01.07.01 | `07-products/01-cli-scripts.md` | Deterministic Python operations on .rhidoc/ workspace documents — designed primarily for AI agents | docs-api, workspace, tools, scripts, ai | doc01.06 | doc03.01.01 | — |

### Research Sessions

| Ref | File | Summary | Tags | Deps | Refs | Attachments |
|-----|------|---------|------|------|------|-------------|

| doc01.09.00 | `09-research/00-index.md` |  |  | — | — | — |
| doc01.09.01 | `09-research/01-token-efficiency-in-skills-and-agents.md` | Token optimization patterns: lean extraction, subagent isolation, surgical reads | tokens, efficiency, skills, agents, context-engineering | — | doc01.09.02, doc01.09.12 | — |
| doc01.09.02 | `09-research/02-verifiability-and-testability.md` | Epistemology of verification, test value hierarchy, decomposition inventory, testability architecture | testing, verification, epistemology, agents, testability, oracles, properties | doc01.09.01 | — | — |
| doc01.09.03 | `09-research/03-decomposition-and-composition-theory.md` | Mathematical foundations for spec-driven development — what makes a good decomposition, and how pieces compose back | decomposition, composition, information-theory, modularity, spec-driven, category-theory, complexity | doc01.05.01 | doc01.05.02, doc01.09.07 | — |
| doc01.09.04 | `09-research/04-spec-code-reconciliation.md` | Two-source-of-truth model, filesystem data formats, deterministic scripts, LLM-assisted reconciliation between product specs and codebases | spec-driven, reconciliation, formats, scripts, decomposition, information-theory, llm, static-analysis | doc01.05.01, doc01.08 | doc01.09.05, doc01.09.06 | — |
| doc01.09.05 | `09-research/05-documentation-systems-and-retrieval.md` | Principles behind hierarchical docs systems, agentic search improvement, scientific comparison of docs structures, and what makes individual specs good enough for code generation | docs, retrieval, ai, specifications, elicitation, information-architecture, evaluation | doc00.00, doc01.09.04 | doc01.09.12 | — |
| doc01.09.06 | `09-research/06-spec-format-vocabulary.md` | What parts of the spec format Rhidoc has opinions on vs what's up to users — format concerns vs user concerns | specs, vocabulary, format, agnosticism, workspace, principles | doc01.06, doc01.09, doc01.09.04 | doc01.09.12 | — |
| doc01.09.07 | `09-research/07-product-as-transition-system.md` | Modeling products as guarded transition systems — verifiable reachability, dead-end detection, and deductive architecture from product properties | product-modeling, transition-systems, verification, architecture, reachability, spec-driven, artifact-driven development | doc01.05.01, doc01.05.02, doc01.09.03 | doc01.09.08, doc01.09.09 | — |
| doc01.09.08 | `09-research/08-structured-product-modeling.md` | The set of formal structures needed to fully describe a business product — entity models, decision tables, state machines, and six more — plus how they compose | product-modeling, decision-tables, state-machines, entities, enumerations, constraints, spec-driven | doc01.09.07, doc01.05.01 | doc01.09.09 | — |
| doc01.09.09 | `09-research/09-action-based-api-design.md` | Why REST taxonomies are dead structures, how action-based APIs grow additively, and the connection between API shape and living systems | api, rest, rpc, trpc, concept-design, living-structure, additive-growth | doc01.05.02, doc01.09.07, doc01.09.08 | doc01.09.10, doc01.09.11 | — |
| doc01.09.10 | `09-research/10-contract-first-development.md` | The action contract is the skeleton, not the database — define contracts, build screens against mocks, defer persistence until the contract stabilizes | contract-first, mock-first, action-based, unfolding, persistence, methodology | doc01.05.03, doc01.09.09 | doc01.09.11 | — |
| doc01.09.11 | `09-research/11-concept-first-sequencing.md` | How concept-driven design composes with unfolding — concepts before code, contracts before backends, the ordering that makes AI-powered development coherent | concepts, jackson, unfolding, sequencing, methodology, ai | doc01.05.03, doc01.09.10, doc01.09.09 | — | — |
| doc01.09.12 | `09-research/12-structured-authoring-and-the-format-tax.md` | Evidence that constraining LLM generation through a structured write-API imposes a measurable quality tax, while post-hoc structuring of a free draft does not — author freely, structure separately | authoring, structure, format-tax, constrained-decoding, specs, ai, generation | doc01.09.05, doc01.09.01, doc01.09.06, doc00.02 | doc01.09.13 | — |
| doc01.09.13 | `09-research/13-plain-language-instruction-signal.md` | Sources behind the shipped plain-language guide (doc00.04), why an instruction signal beats linters and word lists, and the design constraints on the condensed artifact | plain-language, register, instruction-signal, authoring, handbook, vocabulary | doc01.09.12 | — | — |

## 02-architecture — Architecture

| Ref | File | Summary | Tags | Deps | Refs | Attachments |
|-----|------|---------|------|------|------|-------------|

| doc02.00 | `00-index.md` |  |  | — | — | — |
| doc02.01 | `01-script-pipeline.md` | Architecture considerations for spec-code reconciliation — mechanism-agnostic, research-stage | reconciliation, architecture, specs, alignment | doc01.08 | doc03.02 | — |

### Design Patterns

| Ref | File | Summary | Tags | Deps | Refs | Attachments |
|-----|------|---------|------|------|------|-------------|

| doc02.02.00 | `02-design-patterns/00-index.md` |  |  | — | — | — |
| doc02.02.01 | `02-design-patterns/01-python-for-ai.md` | File structure, typing, naming, testability patterns for AI-maintained Python | python, patterns, ai, conventions, testing, typing | doc02.02 | — | — |

## 03-product-design — Product Design

| Ref | File | Summary | Tags | Deps | Refs | Attachments |
|-----|------|---------|------|------|------|-------------|

| doc03.00 | `00-index.md` |  |  | — | — | — |
| doc03.02 | `02-cli-user-flow.md` | How users install the rhidoc CLI, hydrate a repo, and use it for workspace operations | cli, workflow, installation, use-case | doc02.01 | — | — |

### Workspace Scripts

| Ref | File | Summary | Tags | Deps | Refs | Attachments |
|-----|------|---------|------|------|------|-------------|

| doc03.01.00 | `01-workspace-scripts/00-index.md` |  |  | — | — | — |
| doc03.01.01 | `01-workspace-scripts/01-workspace-scripts.md` | Design details for the Rhidoc Docs API — command semantics, delivery mechanisms, scope boundary | docs-api, workspace, tools, scripts | doc01.07.01 | — | — |
| doc03.01.02 | `01-workspace-scripts/02-invariants.md` | Invariants that every valid .rhidoc/ workspace must satisfy at rest — functions of state, oracles for property tests | invariants, workspace, properties, specs | — | doc03.01.03, doc03.01.04 | — |
| doc03.01.03 | `01-workspace-scripts/03-properties.md` | PROP-* property statements for the action catalog, each tagged with the actions and invariants they correlate | properties, testing, invariants, specs | doc03.01.02 | — | — |
| doc03.01.04 | `01-workspace-scripts/04-errors.md` | ERR-* error codes — one per guard failure, mapped to exception classes and CLI exit behavior | errors, guards, specs | doc03.01.02 | — | — |

### Decisions Index

| Ref | File | Summary | Tags | Deps | Refs | Attachments |
|-----|------|---------|------|------|------|-------------|

| doc03.03.00 | `03-decisions/00-index.md` |  |  | — | — | — |

## Tag Index

Quick lookup for file-path→doc mapping:

| Tag | Relevant Docs |
|-----|---------------|
| `AI` | doc01.05.01, doc01.05.02 |
| `action-based` | doc01.09.10 |
| `additive-growth` | doc01.09.09 |
| `agents` | doc01.09.01, doc01.09.02 |
| `agnosticism` | doc01.09.06 |
| `ai` | doc01.02, doc01.05.03, doc01.07.01, doc01.09.05, doc01.09.11, doc01.09.12, doc02.02.01 |
| `alexander` | doc01.05.03 |
| `alignment` | doc01.08, doc02.01 |
| `api` | doc01.09.09 |
| `architecture` | doc01.09.07, doc02.01 |
| `artifact-driven development` | doc01.05.01, doc01.05.02, doc01.09.07 |
| `authoring` | doc01.09.12, doc01.09.13 |
| `category theory` | doc01.05.01 |
| `category-theory` | doc01.09.03 |
| `cli` | doc03.02 |
| `coding` | doc01.05.01 |
| `complexity` | doc01.05.02, doc01.09.03 |
| `composition` | doc01.09.03 |
| `concept-design` | doc01.09.09 |
| `concepts` | doc01.03, doc01.09.11 |
| `constrained-decoding` | doc01.09.12 |
| `constraints` | doc01.09.08 |
| `context-engineering` | doc01.09.01 |
| `contract-first` | doc01.09.10 |
| `conventions` | doc00.03, doc02.02.01 |
| `decision-tables` | doc01.09.08 |
| `decomposition` | doc01.09.03, doc01.09.04 |
| `development` | doc01.05.03 |
| `docs` | doc00.01, doc00.02, doc00.03, doc00.04, doc00.05, doc00.06, doc01.06, doc01.09.05, doc01.10 |
| `docs-api` | doc01.07.01, doc03.01.01 |
| `drift` | doc00.06 |
| `efficiency` | doc01.09.01 |
| `elicitation` | doc01.09.05 |
| `entities` | doc01.09.08 |
| `enumerations` | doc01.09.08 |
| `epistemology` | doc01.09.02 |
| `errors` | doc03.01.04 |
| `evaluation` | doc01.09.05 |
| `facts` | doc00.05 |
| `forces` | doc01.05.03 |
| `format` | doc01.06, doc01.09.06 |
| `format-tax` | doc01.09.12 |
| `formats` | doc01.09.04 |
| `generation` | doc01.09.12 |
| `glossary` | doc00.04, doc00.05, doc01.03, doc01.04 |
| `grammar` | doc01.10 |
| `guards` | doc03.01.04 |
| `handbook` | doc01.09.13 |
| `information-architecture` | doc01.09.05 |
| `information-theory` | doc01.05.02, doc01.09.03, doc01.09.04 |
| `installation` | doc03.02 |
| `instruction-signal` | doc01.09.13 |
| `invariants` | doc03.01.02, doc03.01.03 |
| `jackson` | doc01.09.11 |
| `living-structure` | doc01.09.09 |
| `llm` | doc01.09.04 |
| `maintenance` | doc00.02, doc00.06 |
| `meta` | doc00.01 |
| `methodology` | doc01.05.03, doc01.09.10, doc01.09.11 |
| `mission` | doc01.01 |
| `mock-first` | doc01.09.10 |
| `modularity` | doc01.09.03 |
| `morphisms` | doc01.05.01 |
| `naming` | doc00.05 |
| `oracles` | doc01.09.02 |
| `patterns` | doc01.05.02, doc02.02.01 |
| `persistence` | doc01.09.10 |
| `philosophy` | doc00.02 |
| `plain-language` | doc00.04, doc01.09.13 |
| `planning` | doc01.05.01 |
| `principles` | doc01.01, doc01.09.06 |
| `product-modeling` | doc01.09.07, doc01.09.08 |
| `properties` | doc01.09.02, doc03.01.02, doc03.01.03 |
| `python` | doc02.02.01 |
| `reachability` | doc01.09.07 |
| `reconciliation` | doc01.08, doc01.09.04, doc02.01 |
| `reference` | doc01.10 |
| `register` | doc01.09.13 |
| `rest` | doc01.09.09 |
| `retrieval` | doc01.09.05 |
| `rpc` | doc01.09.09 |
| `scripts` | doc01.07.01, doc01.09.04, doc03.01.01 |
| `sdlc` | doc01.02 |
| `sections` | doc01.10 |
| `sequencing` | doc01.09.11 |
| `signals` | doc01.03 |
| `skills` | doc01.09.01 |
| `spec-driven` | doc01.02, doc01.05.02, doc01.08, doc01.09.03, doc01.09.04, doc01.09.07, doc01.09.08 |
| `specifications` | doc01.09.05 |
| `specs` | doc01.08, doc01.09.06, doc01.09.12, doc02.01, doc03.01.02, doc03.01.03, doc03.01.04 |
| `state-machines` | doc01.09.08 |
| `static-analysis` | doc01.09.04 |
| `structure` | doc01.09.12 |
| `structure-preserving` | doc01.05.03 |
| `style` | doc00.04, doc00.06 |
| `subtypes` | doc00.05 |
| `syntax` | doc01.10 |
| `terms` | doc01.04 |
| `testability` | doc01.09.02 |
| `testing` | doc01.09.02, doc02.02.01, doc03.01.03 |
| `theory` | doc00.01, doc01.03, doc01.05.02 |
| `tokens` | doc01.09.01 |
| `tools` | doc01.07.01, doc03.01.01 |
| `transduction` | doc01.03 |
| `transition-systems` | doc01.09.07 |
| `transmission` | doc01.02 |
| `trpc` | doc01.09.09 |
| `typing` | doc02.02.01 |
| `unfolding` | doc01.05.03, doc01.09.10, doc01.09.11 |
| `use-case` | doc03.02 |
| `verification` | doc01.09.02, doc01.09.07 |
| `vision` | doc01.02 |
| `vocabulary` | doc00.04, doc00.05, doc01.09.06, doc01.09.13 |
| `workflow` | doc03.02 |
| `workspace` | doc01.04, doc01.06, doc01.07.01, doc01.09.06, doc03.01.01, doc03.01.02 |
