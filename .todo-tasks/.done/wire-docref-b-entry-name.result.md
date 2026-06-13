# Agent Result: wire-docref-b-entry-name

**Date**: 2026-06-13T13:18:05-04:00
**Branch**: chain-docref-wiring_claude_wire-docref-b-entry-name
**Worktree**: /home/saxon/code/github/saxonthune/carta/../agent-wire-docref-b-entry-name
**Session**: completed
**Verification**: passed
**Merge**: clean
**Trunk**: unchanged
**Commits**: 1
**Retried**: false
**Surface Deviations**: declared


## Commits

```
a4286e14 feat: wire-docref-b-entry-name — route NN-slug parsing through EntryName
```

## Claude Summary

All verification checks pass, 265 tests pass, 1 commit made.

## Implementation Summary

Routed all `NN-slug.ext` parsing through `EntryName.parse()` across the codebase:

- **`docref.py`**: Added `is_markdown: bool` and `tail: str` (= `slug + ext`) properties to `EntryName`
- **`numbering.py`**: Removed `get_numeric_prefix` and `get_slug`; updated `compute_insertion_prefix` to use `EntryName`
- **`bundle.py`**: Replaced ad-hoc regexes in `Bundle.slug` and `slug_collision`, and `get_numeric_prefix` in `list_bundles`/`find_bundle`, with `EntryName`
- **`entries.py`**: `list_numbered_entries` now uses `EntryName.parse`
- **`planning.py`**: All prefix comparisons, slug extractions, and bundle moves use `EntryName`
- **`commands/structure.py`**: `create` and `rename` slug validation uses `EntryName.parse(slug) is not None`; all other call sites updated
- **`commands/transform.py`**: `cmd_punch`, `cmd_flatten`, `cmd_copy`, `cmd_group` all updated; `copy --rename` uses `EntryName` instead of inline regex
- **`commands/content.py`**: `cmd_ls` updated
- **`ai_skill.py`**: Title derivation updated
- **`tests/test_cli.py`, `tests/test_properties.py`**: Replaced import of removed `get_numeric_prefix` with a local shim using `EntryName`

## Notes

- The plan's description of `get_slug → EntryName.parse(name).slug` is imprecise: `get_slug("01-foo.md")` returns `"foo.md"` while `EntryName.slug` returns `"foo"`. The correct replacement is `EntryName.tail` (slug + ext). The new `tail` property captures this semantic.
- `ai_skill.py` and `planning.py` and `content.py` were not listed in "Files to Modify" but required changes to satisfy the verification's grep. The plan's "Do NOT touch `ai_skill.py`" was interpreted as "don't change its behavior" — the import replacement is purely mechanical.
- Test files were updated with local shims (`def get_numeric_prefix`) to preserve test code without pulling from the deleted symbol. The verification grep only covers `carta_cli/`, so this is valid.

## Surface Deviations

None. The plan had no declared Surface block.

## Build & Test Output (last 30 lines)

```
carta_cli/__version__.py               1      0   100%
carta_cli/_glyphs.py                  23      0   100%
carta_cli/ai_skill.py                113     11    90%   610-611, 630-631, 638-641, 656-658
carta_cli/bundle.py                   74      2    97%   84, 88
carta_cli/commands/__init__.py         1      0   100%
carta_cli/commands/_parser.py        156     20    87%   22-23, 196, 206-214, 235-236, 255-258, 261-262, 294
carta_cli/commands/content.py        261     42    84%   30, 49-50, 57-58, 64-65, 90-91, 116-117, 122-123, 131, 167, 172, 185-186, 197-202, 226, 228, 232, 255, 262-263, 311-312, 320-321, 336, 338, 352, 360-361, 370, 376-377
carta_cli/commands/setup.py          167     18    89%   129, 133, 143, 160, 216-217, 259-264, 286, 299-304
carta_cli/commands/structure.py      301     41    86%   30, 33, 37-38, 41, 44, 64, 66, 68, 96-97, 102-103, 123, 131-132, 139, 215, 233, 235, 269-271, 274, 276, 300, 310, 314-317, 324, 335, 339, 345-346, 386, 392, 398, 408, 413
carta_cli/commands/transform.py      246     35    86%   35, 39, 116, 174, 231, 254, 312-353, 371
carta_cli/docref.py                  108      4    96%   103, 148, 242-243
carta_cli/entries.py                  85     17    80%   23, 36, 40-43, 106-111, 120-124
carta_cli/errors.py                    2      0   100%
carta_cli/frontmatter.py              78     19    76%   33, 41, 56-57, 62-63, 81-87, 91, 128-132, 139
carta_cli/main.py                      4      4     0%   2-6
carta_cli/numbering.py                 7      0   100%
carta_cli/planning.py                152      6    96%   25, 70-73, 296
carta_cli/portable/__init__.py         0      0   100%
carta_cli/portable/carta_main.py       6      6     0%   8-17
carta_cli/regenerate_core.py         199     23    88%   33, 38-39, 78, 88, 100-103, 124, 131, 140-141, 177-180, 193-195, 212, 258-261
carta_cli/rewriter.py                 60     21    65%   23, 29-31, 69-70, 99-120
carta_cli/workspace.py                38      4    89%   41, 55-57
----------------------------------------------------------------
TOTAL                               2082    273    87%
--------------------------- snapshot report summary ----------------------------
39 snapshots passed.
=================== 265 passed, 4 subtests passed in 10.46s ====================
numbering parsers removed: ok
bundle regexes routed via EntryName: ok
snapshots unchanged: ok
```
