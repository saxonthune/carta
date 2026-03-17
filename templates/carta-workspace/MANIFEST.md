# .carta/ Manifest

Machine-readable index for AI navigation. Read this file first, then open only the docs relevant to your query.

**Retrieval strategy:** See doc00.05 for AI retrieval patterns inspired by legal RAG research.

## Column Definitions

- **Ref**: Cross-reference ID (`docXX.YY.ZZ`)
- **File**: Path relative to title directory
- **Summary**: One-line description for semantic matching
- **Tags**: Keywords for file-path→doc mapping
- **Deps**: Doc refs to check when this doc changes

## 00-codex — Meta-documentation

| Ref | File | Summary | Tags | Deps |
|-----|------|---------|------|------|
| doc00.00 | `00-index.md` | Codex section index: what meta-documentation covers | index, meta | — |
| doc00.01 | `01-about.md` | How to read docs, cross-reference syntax | docs, meta | — |
| doc00.02 | `02-taxonomy.md` | Title system rationale, Diataxis spirit | docs, structure | — |
| doc00.03 | `03-conventions.md` | docXX.YY syntax, front matter, file naming | docs, conventions | — |
| doc00.04 | `04-maintenance.md` | Git versioning, epochs, adding/deprecating | docs, maintenance | — |
| doc00.05 | `05-ai-retrieval.md` | AI retrieval patterns, legal RAG inspiration | docs, ai, retrieval | — |

## 01-context — Mission, principles, vocabulary

<!-- Add entries as you create docs in 01-context/ -->

| Ref | File | Summary | Tags | Deps |
|-----|------|---------|------|------|

## 02-system — Architecture and technical design

<!-- Add entries as you create docs in 02-system/ -->

| Ref | File | Summary | Tags | Deps |
|-----|------|---------|------|------|

## 03-product — Features, use cases, workflows

<!-- Add entries as you create docs in 03-product/ -->

| Ref | File | Summary | Tags | Deps |
|-----|------|---------|------|------|

## 04-operations — Development and process

<!-- Add entries as you create docs in 04-operations/ -->

| Ref | File | Summary | Tags | Deps |
|-----|------|---------|------|------|

## Tag Index

Quick lookup for file-path→doc mapping:

| Tag | Relevant Docs |
|-----|---------------|
| `index` | doc00.00 |
| `meta` | doc00.00, doc00.01 |
| `docs` | doc00.01, doc00.02, doc00.03, doc00.04, doc00.05 |
| `structure` | doc00.02 |
| `conventions` | doc00.03 |
| `maintenance` | doc00.04 |
| `ai` | doc00.05 |
| `retrieval` | doc00.05 |
