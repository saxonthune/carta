---
title: Docs Syntax Reference
status: draft
summary: Formal grammar and extraction rules for doc references, sections, frontmatter, and MANIFEST
tags: [docs, syntax, reference, sections, grammar]
deps: [doc00.03]
---

# Docs Syntax Reference

A lightweight specification for the `.carta/` document syntax. Intended as a machine-readable reference for AI agents and tooling authors. Covers the grammar of document references, in-file sections, frontmatter schema, and extraction algorithms.

This is the formal companion to doc00.03 (Conventions), which covers usage guidance and writing style. When the two conflict, this document is authoritative for syntax; doc00.03 is authoritative for style.

## #sec01 Document References

A **doc reference** identifies a file in the workspace by its position in the directory tree.

### Grammar

```
doc_ref     = "doc" segment ( "." segment )*
segment     = DIGIT DIGIT
DIGIT       = "0"-"9"
```

Pattern: `doc\d{2}(\.\d{2})*`

### Resolution

Each segment maps to a numbered directory or file prefix. Resolution walks the workspace root:

```
doc01.05.08.03
 │    │   └─ file prefix 03 (03-*.md)
 │    └───── subdir prefix 08 (08-*/)
 └────────── title prefix 01 (01-*/)
```

The final segment resolves to either a file (`NN-slug.md`) or a directory's index (`NN-slug/00-index.md`).

### Examples

```
doc00.03        → 00-codex/03-conventions.md
doc01.05.08.03     → 01-product-strategy/08-research/03-wagon-aware-layout-architecture.md
doc01.04.08.01     → 02-product-design/08-decisions/01-yjs-state.md
```

## #sec02 Section References

A **section reference** identifies a section within a file. Sections allow atomic, referenceable claims within a single document — like clauses in a building code.

### Grammar

```
section_ref = doc_ref "#sec" segment ( "." segment )*
segment     = DIGIT DIGIT
```

Pattern: `doc\d{2}(\.\d{2})+(#sec\d{2}(\.\d{2})*)?`

### Examples

```
doc01.04.03#sec02      → file doc01.04.03, section 02
doc01.04.03#sec01.02   → file doc01.04.03, section 01, subsection 02
```

Subsections (`#sec01.02`) are supported by the grammar but expected to be rare. Prefer splitting into separate sections or separate documents over deep nesting.

## #sec03 Section Markers in Markdown

Sections are marked by headings that begin with `#secNN`.

### Format

```markdown
## #sec01 Section Title

Section content here.

## #sec02 Another Section

More content.
```

Rules:

- The marker is `## #secNN` — a level-2 heading whose text starts with the section ID.
- Section IDs are sequential: `#sec01`, `#sec02`, `#sec03`, etc.
- Everything before the first `## #sec` marker is the **preamble** (`#sec00`), implicitly. It is never explicitly marked.
- Sections **partition the document completely**. Every line of content after frontmatter belongs to exactly one section.
- A section ends at the next `## #sec` heading or end of file.
- Headings within a section (level 3+) are allowed and do not create new sections.

### Subsection markers

```markdown
## #sec01 Visual States

### #sec01.01 Default State

Content.

### #sec01.02 Disabled State

Content.
```

Subsection markers use `###` (level 3) and extend the parent section ID with a dot segment.

### Detection regex

```
^## #sec\d{2}\b          # section heading
^### #sec\d{2}\.\d{2}\b  # subsection heading
```

## #sec04 Frontmatter Schema

Every `.carta/` document begins with YAML frontmatter.

### Fields

```yaml
---
title: Human-readable title          # required
status: active                        # required: draft | active | deprecated
summary: One-line MANIFEST summary    # required
tags: [keyword1, keyword2]            # required
deps: [doc01.05.02, doc01.03.05]            # optional: doc refs to check on change
epoch: 1                              # optional: staleness marker
sections: 4                           # optional: number of #sec markers in file
---
```

| Field | Required | Type | Notes |
|-------|----------|------|-------|
| `title` | yes | string | Display name |
| `status` | yes | enum | `draft`, `active`, `deprecated` |
| `summary` | yes | string | One-line description for MANIFEST |
| `tags` | yes | string[] | Lowercase keywords for retrieval |
| `deps` | no | string[] | Doc refs this document depends on |
| `epoch` | no | integer | Staleness audit marker |
| `sections` | no | integer | Count of `#sec` markers. Absent or `0` means no sections. |

### Status semantics

- `draft` — work in progress. May be incomplete or inaccurate.
- `active` — current and maintained.
- `deprecated` — superseded. Must include a note at the top: "Superseded by docXX.YY."

## #sec05 File and Directory Naming

```
NN-slug.md          # document file
NN-slug/            # document directory
NN-slug/00-index.md # directory index (required for every directory)
```

- `NN` is a two-digit prefix controlling sort order.
- `slug` is kebab-case: lowercase alphanumeric and hyphens.
- Gaps in numbering are allowed and intentional.
- Directories exceeding 99 entries should be split into subdirectories.

## #sec06 MANIFEST.md Structure

MANIFEST.md is the machine-readable retrieval index. It is generated by `carta regenerate` and should not be edited by hand.

### Table format

```markdown
| Ref | File | Summary | Tags | Deps | Refs |
|-----|------|---------|------|------|------|
| doc01.05.02 | `02-principles.md` | Design principles | principles, design | doc01.05.01 | doc01.04.05 |
```

| Column | Source | Description |
|--------|--------|-------------|
| Ref | computed | Doc reference from file position |
| File | computed | Filename relative to group directory |
| Summary | frontmatter | `summary` field |
| Tags | frontmatter | `tags` field, comma-separated |
| Deps | frontmatter | `deps` field, comma-separated |
| Refs | computed | Reverse deps — other docs that list this one in their Deps |

### Tag index

MANIFEST includes a tag index at the bottom: a table mapping each tag to the doc refs that carry it. This supports file-path-to-doc mapping for AI agents.

## #sec07 Extraction Algorithms

### Resolve a doc reference

```
resolve(ref: string, root: Path) → Path:
  segments = ref.removePrefix("doc").split(".")
  path = root
  for each segment except last:
    path = path / glob("{segment}-*/")[0]
  last = segments[-1]
  file = path / glob("{last}-*.md")
  if file exists: return file
  dir = path / glob("{last}-*/")
  if dir exists: return dir / "00-index.md"
  error: unresolvable ref
```

### Extract a section

```
extract(content: string, secId: string) → string:
  if secId == "sec00":
    start = after frontmatter
    end = first line matching /^## #sec\d{2}\b/ or EOF
  else:
    start = line matching /^## #{secId}\b/
    end = next line matching /^## #sec\d{2}\b/ or EOF
  return lines[start..end]
```

### Detect sections in a file

```
detect_sections(content: string) → list[{id, title, line}]:
  for each line matching /^## #(sec\d{2}(?:\.\d{2})*)\s+(.*)/
    yield {id: match[1], title: match[2], line: line_number}
```

## #sec08 Lifecycle

Documents progress through states:

```
(nothing) → prose → prose with sections → subdocuments
```

1. **Prose** — a doc with no sections. All content is `#sec00`. This is the seed state.
2. **Prose with sections** — when distinct, referenceable concerns emerge, add `#sec` markers. The preamble (`#sec00`) holds the overview; sections differentiate from it.
3. **Subdocuments** — when a section outgrows its host, `carta punch` expands the file into a directory. The section becomes its own doc with its own potential sections.

A doc with no sections is complete. Sections are a response to the need for atomic references, not a template to fill in. See doc00.02 (Maintenance — unfolding philosophy).
