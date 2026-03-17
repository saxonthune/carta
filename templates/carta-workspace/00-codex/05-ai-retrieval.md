---
title: AI Retrieval Patterns
status: active
---

# AI Retrieval Patterns

How AI agents efficiently and thoroughly navigate `.carta/`. Inspired by legal AI retrieval-augmented generation (RAG) research.

## The Legal Parallel

Legal codes share key characteristics with our documentation:

| Legal Domain | .carta/ Equivalent |
|--------------|-------------------|
| Constitutions (foundational principles) | `01-context/` (mission, principles) |
| Statutes (structured rules) | `02-system/` (architecture, interfaces) |
| Case law (applied precedent) | `03-product/` (features, workflows) |
| Regulations (operational procedures) | `04-operations/` (dev, testing, deploy) |
| Legal indices & digests | `MANIFEST.md` |

Legal AI systems face the same challenge: **find all relevant authorities without reading everything**. Their solutions inform our approach.

## Research-Backed Techniques

### 1. Hierarchical Document Treatment

From [Bridging Legal Knowledge and AI (2025)](https://arxiv.org/abs/2502.20364):

> "Systems store vectorized representations treating each document type uniquely. Constitutional provisions are split into paragraphs for granular semantic search, statutes are divided into sections with metadata."

**Applied to .carta/:**
- `01-context/` → read fully (foundational, rarely changes)
- `02-system/` → read section headers, then targeted sections
- `03-product/` → index by feature tags, read on-demand
- `04-operations/` → read only when build/test/deploy changes

### 2. Summary Augmented Chunking (SAC)

Standard RAG retrieves chunks that appear relevant but may be wrong documents. SAC includes document summaries with each chunk to reduce mismatch.

**Applied to MANIFEST.md:**
Each entry includes a one-line summary and semantic tags:

```markdown
| doc02.02 | 02-state.md | State management layer | state, hooks |
```

### 3. Provenance Tracking

From [Raven RAG System (2025)](https://pmc.ncbi.nlm.nih.gov/articles/PMC12616094/):

> "For every response, provide the original source text alongside the generated answer. Achieved 92% completeness."

**Applied to documentation updates:**
Every edit must cite its source doc section. Example:

```markdown
## Edit: README.md
Source: doc02.02 §Hooks Layer

+| `useTheme.ts` | Theme management hook |
```

### 4. Minimal Relevant Segments

From [LegalBench-RAG (2024)](https://arxiv.org/abs/2408.10343):

> "Focus on extracting minimal, highly relevant text segments rather than large chunks. Large chunks exceed context windows and induce hallucinations."

**Applied to section-level retrieval:**
Instead of reading entire docs, grep for specific sections:

```bash
# Read only the "Hooks Layer" section from state.md
grep -A 50 "### Hooks Layer" .carta/02-system/02-state.md
```

### 5. Dependency Graphs

From [Stanford Legal RAG Hallucination Study](https://hai.stanford.edu/news/ai-trial-legal-models-hallucinate-1-out-6-or-more-benchmarking-queries):

> "Even best commercial legal RAG has 17% hallucination rate. Knowledge graphs help by capturing relationships between documents."

**Applied to MANIFEST.md:**
Track document dependencies to ensure related docs are updated together:

```markdown
| doc02.08 | 08-frontend.md | ... | doc02.02, doc02.07 |
```

When editing doc02.02, the system knows to check doc02.08.

## Completeness Verification

After generating documentation updates, verify:

1. **Coverage**: Every changed code path maps to at least one doc
2. **Provenance**: Every edit cites a source section
3. **Dependency check**: Docs that depend on edited docs are reviewed
4. **Cross-reference integrity**: Existing `docXX.YY` references still resolve

## MANIFEST.md Structure

The manifest serves as the retrieval index. Enhanced structure:

```markdown
| Ref | File | Summary | Tags | Depends On |
|-----|------|---------|------|------------|
| doc02.02 | 02-state.md | State management layer | state, hooks | doc02.01 |
```

- **Summary**: One-line description for semantic matching
- **Tags**: Lowercase keywords for file-path→doc mapping
- **Depends On**: Doc refs that should be checked when this doc changes

## Token Budget Guidelines

| Operation | Typical Tokens | When to Use |
|-----------|---------------|-------------|
| MANIFEST only | `manifest_tokens` | Initial orientation |
| MANIFEST + 1 doc | `manifest_tokens + avg_doc_tokens` | Single-subsystem change |
| MANIFEST + N docs | `manifest_tokens + avg_doc_tokens * N` | Cross-cutting change |
| Full .carta/ read | `manifest_tokens + total_doc_tokens` | Major refactor, epoch bump |

Target: **90% of documentation updates should read <10% of docs**.

The actual token counts scale with your workspace size. Measure `manifest_tokens` (typically 1,000-2,000 for a medium project) and `avg_doc_tokens` (typically 500-1,500 per doc) to calibrate your budget.

## References

- [Bridging Legal Knowledge and AI (arXiv 2502.20364)](https://arxiv.org/abs/2502.20364)
- [LegalBench-RAG Benchmark (arXiv 2408.10343)](https://arxiv.org/abs/2408.10343)
- [LRAGE Evaluation Tool (arXiv 2504.01840)](https://arxiv.org/html/2504.01840v1)
- [Stanford AI Legal Hallucination Study](https://hai.stanford.edu/news/ai-trial-legal-models-hallucinate-1-out-6-or-more-benchmarking-queries)
- [Harvard JOLT: RAG for Legal Work](https://jolt.law.harvard.edu/digest/retrieval-augmented-generation-rag-towards-a-promising-llm-architecture-for-legal-work)
