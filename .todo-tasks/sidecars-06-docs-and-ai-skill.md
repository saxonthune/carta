# Docs and ai-skill Updates for Sidecars

## Motivation

With bundling implemented (tasks 01–05), Carta's own documentation must describe the bundle rule, the attachment lifecycle, and the new `attach` command. Users and AI agents rely on `.carta/` docs and `carta ai-skill` output to drive correct use. See `sidecars.epic.md`.

**Requires**: tasks 01–05 landed. This is the final step of v0.2.0.

## Do NOT

- Do NOT over-elaborate. Carta values sparse docs (doc00.02 unfolding philosophy). One paragraph per concept usually beats five.
- Do NOT invent new concept entries unless clearly needed (see the `doc02.02` call below — add an Attachment concept only if it introduces behavior worth describing).
- Do NOT modify the codex beyond what's listed. No restructuring of existing sections.
- Do NOT commit code changes here — this is a documentation + ai-skill text task only.
- Do NOT change `CLAUDE.md`. It already defers to `.carta/` and `carta ai-skill`; no new guidance needed.
- Do NOT hand-edit `MANIFEST.md`'s table rows. Use `carta regenerate` to regenerate it after all other doc edits.

## Plan

### 1. Update `doc00.03` (conventions)

File: `.carta/00-codex/03-conventions.md`

Add a section "Bundles and attachments":
- A bundle = siblings of a directory sharing a two-digit numeric prefix. Root is the `NN-<slug>.md`; attachments are the remaining siblings. Directories cannot be bundle roots.
- Sidecar filenames: `NN-<anything>.<ext>`. No reserved infix. Bundling is prefix-based, not name-based.
- Structural operations (move, delete, rename, punch, flatten) treat a bundle as a unit.
- Orphans (sidecars without a root md, or sharing a prefix with a directory) are warned about but never block regeneration.

### 2. Update `doc00.07` (docs-syntax-reference)

File: `.carta/00-codex/07-docs-syntax-reference.md`

Add a subsection defining the formal grammar for a bundle:
- Directory entry: `NN-<slug>[.<ext>]` where `NN` is two digits and `<slug>` is kebab-case.
- Bundle root: `NN-<slug>.md` (leaf markdown).
- Attachment: any file in the same directory named `NN-*` that is not the root md and not a directory.
- Formal regex for attachment: `^(\d{2})-[^/]+\.[^./]+$` minus `\.md$`.

### 3. Update `doc01.02.01` (workspace-scripts design)

File: `.carta/01-carta-gold/02-product-design/01-workspace-scripts.md`

- Add `attach` to the commands table with a one-line summary.
- Add a short "Bundles" subsection:
  - State the bundling rule.
  - Note that every structural operation (move, delete, rename, punch, flatten) operates on bundles, not individual files.
  - Scope statement: the Docs API owns the bundle as a structural unit. Kind-awareness and content interpretation are reconciliation's concern (doc01.03.07).

### 4. Update `doc01.03.06.01` (cli-scripts)

File: `.carta/01-carta-gold/03-product-strategy/06-products/01-cli-scripts.md`

- Add `attach` to the operations table.
- Add the bundle concept to the operations narrative (one paragraph).

### 5. Update `doc02.02` concepts section

File: `.carta/02-carta/02-concepts/`

Decision point: add an `Attachment` concept entry?
- **Yes**, because the concept has behavior: *"purpose is to let non-md artifacts inherit a host doc's structural position."* The operational principle (Jackson): if I attach an artifact to doc X, then when X moves, the artifact moves; when X is deleted, the artifact is deleted.
- Create `.carta/02-carta/02-concepts/01-attachment.md` (or next available prefix) with a short Jackson-style concept description: purpose, state (filesystem adjacency), actions (attach, implicit travel via structural ops), operational principle.
- Update `.carta/02-carta/02-concepts/00-index.md` to list it.

### 6. Update `ai_skill.py` command reference text

File: `carta_cli/ai_skill.py`

- Add an `attach` section matching the style of existing command entries (arguments, side effects, flags, when-to-use).
- In the `move`, `delete`, `rename`, `punch`, `flatten` sections, add a note: "Operates on bundles — non-md siblings sharing the target's numeric prefix travel with it."
- Add a top-level "Bundles and attachments" section near the beginning, explaining the rule concisely for AI consumers.
- Document orphan warnings: mention that `regenerate` prints orphan warnings to stderr when sidecars lack a root or share a prefix with a directory.

### 7. Bump version to 0.2.0

File: `carta_cli/__version__.py`. Change from `0.1.0-alpha.3` to `0.2.0`. If the project uses a `pyproject.toml` version field, bump it in sync (grep for the current version string to confirm).

### 8. Regenerate MANIFEST.md for the Carta workspace

Run `carta regenerate` in the Carta repo root. This populates the new Attachments column with `—` cells across all existing docs (no sidecars exist yet in Carta's own workspace) and updates the Column Definitions preamble automatically from `manifest-preamble.md`.

Commit the regenerated `MANIFEST.md` as part of this task.

### 9. Update CLAUDE.md project structure table?

Not needed. `CLAUDE.md` defers to `.carta/` and `carta ai-skill` for semantic reference. No direct changes required.

### 10. Consider a skill file update

File: `.claude/skills/carta-cli/SKILL.md`

Check if this file embeds command-specific guidance that the new `attach` verb should appear in. If so, add a line about `attach` and bundle awareness. If the skill defers to `carta ai-skill` output, no change needed.

`.claude/skills/docs-development/SKILL.md` — same check. Likely defers; no change needed.

## Files to Modify

- `.carta/00-codex/03-conventions.md` — bundle rule section.
- `.carta/00-codex/07-docs-syntax-reference.md` — grammar subsection.
- `.carta/01-carta-gold/02-product-design/01-workspace-scripts.md` — bundles section, `attach` row.
- `.carta/01-carta-gold/03-product-strategy/06-products/01-cli-scripts.md` — bundles, `attach` row.
- `.carta/02-carta/02-concepts/01-attachment.md` — new concept entry (verify next prefix).
- `.carta/02-carta/02-concepts/00-index.md` — link the new concept.
- `carta_cli/ai_skill.py` — attach section + bundle narrative + op notes (~60-100 line delta).
- `.carta/MANIFEST.md` — regenerated.
- `.claude/skills/carta-cli/SKILL.md` — optional.
- `carta_cli/__version__.py` — bump to `0.2.0`.
- `pyproject.toml` (if the version is duplicated there) — bump in sync.

## Verification

- `make test` passes (no code regressions from ai_skill.py changes).
- `carta ai-skill` output includes the new `attach` section and bundle narrative.
- `carta regenerate` on the Carta workspace produces a MANIFEST with the Attachments column, `—` for every row (since Carta itself has no attachments yet).
- Grep for `docXX.YY` references to `01.03.06.01` and `01.02.01` to verify the doc updates didn't break cross-refs.
- Eyeball `doc00.03` and `doc00.07` to confirm the bundle explanation matches the code behavior.

## Out of Scope

- Adding attachment examples to Carta's own specs. The team can dogfood attachments in a follow-up.
- Kind declarations or attachment frontmatter.
- Reconciliation-side docs (doc01.03.07 is already mechanism-agnostic).
- Any code beyond `ai_skill.py`.

## Notes

- Sparse-docs principle: if a single paragraph captures a concept, stop there. Unfold later when a real force demands it.
- The Attachment concept's operational principle is clean: "attached artifacts follow their host doc through every structural op, without frontmatter declaration." Keep it to ~10 lines of prose.
- `ai_skill.py` contains the canonical AI reference. Precision and completeness matter more there than in prose docs — AI agents will not read all `.carta/` files but will always read `ai-skill` output.
- The regenerated MANIFEST will have its diff limited to added column cells (mostly `—`) and the preamble's column-definitions section.
