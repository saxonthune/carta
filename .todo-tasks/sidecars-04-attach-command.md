# New `carta attach` Command

## Motivation

Users need an ergonomic way to bring an external file into a bundle at a target doc's prefix. `carta copy` is path-oriented and doesn't align filenames with a bundle root. `attach` makes the intent explicit: *this file is an artifact of that doc*. See `sidecars.epic.md`.

**Requires**: task 01 (`sidecars-01-bundle-resolver`) for `bundle.find_bundle`. Independent of tasks 02 and 03.

## Do NOT

- Do NOT overload `carta copy`. Leave it path-oriented and document the distinction (done in task 06).
- Do NOT add a `--kind` flag. Kind is out of scope for v0.2.0.
- Do NOT change frontmatter of the target md (no attachment declaration).
- Do NOT enforce a specific naming convention beyond prefix alignment. The user chooses the slug segment of the attachment's filename.
- Do NOT rewrite cross-refs — attachments have no refs.

## Plan

### 1. Add CLI parser entry in `carta_cli/commands/_parser.py`

Add an `attach` subparser mirroring the style of existing commands. Arguments:
- `target` (positional, required) — doc ref or workspace path of the target `NN-<slug>.md`.
- `source` (positional, required) — path to an external file (may be outside the workspace).
- `--rename SLUG` (optional) — override the attachment's slug segment. Default: derived from source filename stem.
- `--dry-run` — print planned operation without executing.

Wire the subparser to a new command handler.

### 2. Implement `cmd_attach`

Put the handler in `carta_cli/commands/content.py` next to `cmd_copy` (or in a new file if content.py is becoming crowded — check line count; if >250 lines, new file `carta_cli/commands/attach.py`).

Logic:
1. Resolve `target` to a path with `entries.resolve_and_validate`.
2. Require the target to be a leaf md (`NN-<slug>.md`). If the target is a directory or `00-index.md`, raise `CartaError("attach target must be a leaf doc (NN-<slug>.md)")` — directories can't own attachments, and `00-index.md` sits inside a directory where its bundle lives (users can attach there, but per the design, `00-index` *is* a leaf md, so allow it explicitly).

   **Decision**: allow `00-index.md` as a target. It is a leaf md; attaching to it is how users associate artifacts with a section's index rather than a specific child.
3. Compute the bundle via `bundle.find_bundle(target)`.
4. Determine the destination filename: `f"{bundle.prefix:02d}-{slug}{source_ext}"` where `slug = args.rename or Path(args.source).stem` and `source_ext = Path(args.source).suffix`.
   - If `args.rename` includes the extension, strip it (same pattern as `_apply_rename` in `planning.py`).
5. Check for collision: if a file already exists at that destination, raise `CartaError` and tell the user to move or delete the existing attachment first.
6. On dry run: print the planned copy (source → destination). Do not write.
7. Otherwise: `shutil.copy2(args.source, destination)` and regenerate MANIFEST (existing `do_regenerate` + preamble loader pattern).

### 3. Output

Mirror existing command output style:
```
Attached: /path/to/source.json -> .carta/.../01-state-engine.xstate.json
  Bundle: doc01.02.04.01 (01-state-engine.md)
  Prefix: 01
```

### 4. Tests: extend `tests/test_cli.py`

Add `TestAttach` class. Cases:
- Attach a file to a leaf md → attachment lands with correct prefix + source filename stem.
- Attach with `--rename my-machine` → attachment named `NN-my-machine.<ext>`.
- Attach with `--rename` that includes extension → extension not doubled.
- Attach to `00-index.md` → lands at `00-<stem>.<ext>` in the index's directory.
- Attach with a collision (same destination exists) → `CartaError`, nothing written.
- Attach with `--dry-run` → nothing written, correct output.
- Attach to a directory target → `CartaError`.
- Attach to a non-md target → `CartaError`.

### 5. Help text and ai-skill reference

- Help text for the subparser: "Copy an external file into a doc's bundle as an attachment. Bundles are sets of files sharing a numeric prefix; `attach` aligns the copied file with the target doc's prefix."
- Task 06 will add `attach` to `ai_skill.py`'s command reference table. No change needed here beyond standard argparse help.

## Files to Modify

- `carta_cli/commands/_parser.py` — new subparser entry (~25 lines).
- `carta_cli/commands/content.py` (or new `attach.py`) — `cmd_attach` handler (~80 lines).
- `carta_cli/commands/__init__.py` — export the new handler if this package uses explicit exports.
- `carta_cli/main.py` — wire the subcommand to its handler (check current dispatch pattern).
- `tests/test_cli.py` — new `TestAttach` cases (~180 lines).

## Verification

- `make test` passes.
- `carta attach --help` shows correct usage.
- Manual smoke:
  1. `carta init /tmp/sc && cd /tmp/sc && carta create 00-codex game`
  2. `echo '{"id":"game"}' > /tmp/fsm.json`
  3. `carta attach doc00.01 /tmp/fsm.json --rename xstate` → verify `.carta/00-codex/01-game.xstate.json` exists.
  4. `carta attach doc00.01 /tmp/fsm.json --rename xstate` again → verify collision error.
  5. `carta move doc00.01 00-codex --order 2` (after task 02 lands) → verify attachment travels.

## Out of Scope

- Kind flag / attachment metadata.
- `carta detach` (removal) — users delete attachments with `rm`; if demand emerges, add later.
- Recognition of attachments by `carta copy`.
- MANIFEST updates (task 05).

## Notes

- `shutil.copy2` preserves mtime; use it over `shutil.copy` so reconciliation (future) can check freshness.
- Reject sources that are directories for v0.2.0; `NN-slug.assets/` companion dirs can be created by hand or via a future `--assets-dir` flag.
- Don't silently overwrite. The collision error forces explicit user intent.
