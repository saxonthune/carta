# Sidecar Bundling (v0.2.0)

## Goal

Let non-markdown artifacts (xstate JSON, mermaid diagrams, schemas, mockups, etc.) live inside a `.carta/` workspace as first-class members of a doc's *bundle*, so structural operations (`move`, `delete`, `rename`, `punch`, `flatten`) preserve the spec-artifact graph automatically.

## The Design (locked in)

- **Bundling rule**: a **bundle** is the set of siblings in a single directory sharing a two-digit numeric prefix. The **root** is the unique `NN-<slug>.md` in the group; the remaining siblings are **attachments**. A bundle prefix with no `.md` root is an **orphan**.
- **Directories are never bundle roots.** A subdirectory at prefix `NN-` does not own sidecar attachments. Any non-md sibling sharing the prefix of a subdirectory is an orphan.
- **No `kind` infix required.** Users can name sidecars anything (`01-xstate.json`, `01-interactions.yaml`, `01-mockup.png`). Bundling is purely prefix-based.
- **No frontmatter declaration.** The filesystem is the source of truth. Reconciliation (doc01.03.07) is a later concern and may add frontmatter hints if needed.
- **Slug-rename matcher**: when `rename` changes a doc's slug, attachments whose basename begins with `NN-<old-slug>.` are renamed to the new slug; attachments that don't share the old slug (e.g. `01-xstate.json` next to `01-game-logic.md`) are left alone. Prefix matching keeps them bundled regardless.
- **Multi-doc references**: not a Carta feature. If two docs need the same artifact, either one owns it and the other references the parent doc in prose, or a thin md wrapper owns the attachment.

## Lifecycle across operations

| Op | Bundle behavior |
|----|-----------------|
| `create` | Unchanged — creates just the `.md`. |
| `attach` (new) | Copies an external file into the bundle at the target's prefix. |
| `move` | The whole bundle travels; attachments get the destination prefix. |
| `delete` | Cascades to every attachment. Gap-closing renumbers whole bundles. |
| `rename` | Renames the md; renames same-slug attachments; leaves other same-prefix attachments alone. |
| `punch` | `NN-slug.md` → `NN-slug/00-index.md`. Attachments move into the new dir, reprefixed to `00-`. |
| `flatten` | Each hoisted child's bundle travels as a unit, reprefixed to its new parent position. |
| `regenerate` | MANIFEST gains attachments info; orphan warnings emitted. |
| `rewrite` / `copy` | Unchanged. |

## Tasks

Execution order mirrors dependency: 01 is the foundation; 02–05 consume it; 06 is docs.

1. **[01-bundle-resolver](sidecars-01-bundle-resolver.md)** — pure resolver module + orphan/slug-match helpers + tests.
2. **[02-move-delete-rename](sidecars-02-move-delete-rename.md)** — bundle-aware move, delete, rename.
3. **[03-punch-flatten](sidecars-03-punch-flatten.md)** — bundle-aware punch and flatten with reprefixing.
4. **[04-attach-command](sidecars-04-attach-command.md)** — new `carta attach` verb.
5. **[05-regenerate-manifest](sidecars-05-regenerate-manifest.md)** — MANIFEST attachment column + orphan warnings.
6. **[06-docs-and-ai-skill](sidecars-06-docs-and-ai-skill.md)** — doc00.03, doc00.07, doc01.02.01, doc01.03.06.01, doc02.02 updates + `ai_skill.py` reference text + MANIFEST regeneration.

## Out of Scope (v0.2.0)

- Level 3: sidecars as first-class doc-ref targets (`docXX.YY.ZZ` pointing *at* a JSON).
- `kind` declaration in filenames or frontmatter.
- Reconciliation's kind-aware consumption of attachments.
- `carta cat` sidecar support.
- `carta copy` extension to auto-route into bundles (users call `attach` explicitly).
