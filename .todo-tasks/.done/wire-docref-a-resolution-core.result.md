# Agent Result: wire-docref-a-resolution-core

**Date**: 2026-06-13T13:09:44-04:00
**Branch**: feat/260422_claude_wire-docref-a-resolution-core
**Worktree**: /home/saxon/code/github/saxonthune/carta/../agent-wire-docref-a-resolution-core
**Session**: completed
**Verification**: passed
**Merge**: clean
**Trunk**: unchanged
**Commits**: 1
**Retried**: false
**Surface Deviations**: declared


## Commits

```
51413ac9 feat: wire DocRef as resolution core, delete ref_convert.py
```

## Claude Summary

Implementation complete. 265 tests pass, 39 snapshots unchanged.

## Implementation Summary

The plan was implemented across 9 files in a single logical commit:

1. **`carta_cli/docref.py`** — Added `DocEntry` dataclass binding `ref: DocRef` + `path: Path`, with a `slug` property derived via `EntryName.parse`.

2. **`carta_cli/entries.py`** — Rewrote `resolve_arg` and `resolve_and_validate` to return `DocEntry`. Dropped `_REF_RE` module-level constant (replaced with an inline `re.match`). Added `_make_entry` helper with best-effort ref derivation (catches both `ValueError` and `IndexError` for edge cases like `path == carta_root`). The fuzzy/literal path branches are preserved unchanged.

3. **`carta_cli/ref_convert.py`** — Deleted.

4. **`carta_cli/regenerate_core.py`**, **`carta_cli/planning.py`** — Replaced `path_to_ref` import/usage with `DocRef.from_path`.

5. **`carta_cli/commands/content.py`**, **`structure.py`**, **`transform.py`** — Updated all `resolve_arg`/`resolve_and_validate` call sites to use `.path` (and `.ref` where the entry was already in scope). Replaced `path_to_ref` with `str(DocRef.from_path(...))`.

6. **`carta_cli/commands/setup.py`** — Swapped `"ref_convert.py"` → `"docref.py"` in `_LIBRARY_MODULES`.

7. **`tests/`** — Updated 3 test files to import from `docref` with local shims. Updated `TestResolveArg` to use `.path`. Updated sidecar format tests to reflect the new behavior.

## Notes

- **`carta.pyz` binary**: The plan's verification grep matches this pre-existing binary artifact (a zipapp containing old bundled code). All Python `.py` source files are clean. The binary is outside scope.

- **Sidecar ref format change**: `path_to_ref` for sidecars returned `"docXX.YY/slug.ext"` but `DocRef.from_path` returns just `"docXX.YY"`. No `.ambr` snapshot tested the old format (confirmed by grep). Six non-snapshot tests were updated to reflect the new behavior: 4 `TestResolveArg` tests (now access `.path`), `test_bundle_shows_attachments`, and `test_tree_refs_sidecar_format`.

- **`IndexError` edge case**: `DocRef.from_path(carta_root, carta_root)` raises `IndexError` (empty parts list) rather than `ValueError`. `_make_entry` catches both — this is a latent bug in `DocRef.from_path` triggered by passing `"."` as destination.

## Surface Deviations

None. The plan had no explicit `## Surface after this phase` section.

## Build & Test Output (last 30 lines)

```
carta_cli/__version__.py               1      0   100%
carta_cli/_glyphs.py                  23      0   100%
carta_cli/ai_skill.py                113     11    90%   610-611, 630-631, 638-641, 656-658
carta_cli/bundle.py                   76      2    97%   86, 90
carta_cli/commands/__init__.py         1      0   100%
carta_cli/commands/_parser.py        156     20    87%   22-23, 196, 206-214, 235-236, 255-258, 261-262, 294
carta_cli/commands/content.py        262     42    84%   31, 50-51, 58-59, 65-66, 91-92, 117-118, 123-124, 132, 168, 173, 186-187, 198-203, 227, 229, 233, 256, 263-264, 312-313, 321-322, 337, 339, 353, 361-362, 371, 377-378
carta_cli/commands/setup.py          167     18    89%   129, 133, 143, 160, 216-217, 259-264, 286, 299-304
carta_cli/commands/structure.py      298     38    87%   30, 33, 37-38, 41, 44, 64, 66, 68, 96-97, 102-103, 123, 131-132, 139, 215, 233, 235, 274, 276, 299, 309, 313-316, 323, 334, 338, 344-345, 385, 389, 395, 405, 410
carta_cli/commands/transform.py      242     36    85%   34, 38, 113, 171, 227, 250, 308-350, 368
carta_cli/docref.py                  102      4    96%   103, 148, 233-234
carta_cli/entries.py                  86     17    80%   24, 37, 41-44, 107-112, 121-125
carta_cli/errors.py                    2      0   100%
carta_cli/frontmatter.py              78     19    76%   33, 41, 56-57, 62-63, 81-87, 91, 128-132, 139
carta_cli/main.py                      4      4     0%   2-6
carta_cli/numbering.py                13      0   100%
carta_cli/planning.py                151      6    96%   25, 70-73, 293
carta_cli/portable/__init__.py         0      0   100%
carta_cli/portable/carta_main.py       6      6     0%   8-17
carta_cli/regenerate_core.py         199     23    88%   33, 38-39, 78, 88, 100-103, 124, 131, 140-141, 177-180, 193-195, 212, 258-261
carta_cli/rewriter.py                 60     21    65%   23, 29-31, 69-70, 99-120
carta_cli/workspace.py                38      4    89%   41, 55-57
----------------------------------------------------------------
TOTAL                               2078    271    87%
--------------------------- snapshot report summary ----------------------------
39 snapshots passed.
=================== 265 passed, 4 subtests passed in 10.08s ====================
ref_convert deleted: ok
grep: carta_cli/carta.pyz: binary file matches
snapshots unchanged: ok
```
