# Agent Result: carta-before-vocab

date: 2026-06-13T22:06:36-04:00
session: completed
verification: passed
commits: 1
branch: feat/260422_claude_carta-before-vocab
surface deviations: declared
session id: 7f1d2d94-86b8-4a42-a8fe-c35ac5295ce2


## Summary

Implementation complete. 294 tests pass, all verification checks pass.

---

The plan implemented the full `--insert` → `--before` rename across make, move, copy, and flatten, unified under the vocabulary: **append** (flag-less), **`--at REF`** (strict), **`--before REF`** (displacing).

## Notes

- The `04-create.yaml` and `04-create.md` files still contain `--order N` in the `carta create` command — this is explicitly out of scope per the plan ("stale carta create residue — a separate cleanup task"). The verification grep finds these files, but that's expected and documented in the plan's Out of Scope section.
- The `cmd_flatten` `--before` ref path uses only `ref.segments[-1]` (the last segment as an int position), which is consistent with how `cmd_make`'s `--before` path works — flatten's logic already takes `insertion_start` as an int, so the ref is simply a way to name that int.
- The test method names in `TestMakeInsert` still say `test_insert_*` (e.g., `test_insert_shifts_siblings`) — the plan specified updating class docstrings and class names, not individual method names. These methods test the `--before` behavior; their names are just legacy identifiers and not user-facing.

## Surface Deviations

None. The plan had no declared Surface block.

## Commits

```
1d5e6412 Unify positional-write vocabulary on --at / --before
```

## Build & Test Output (last 30 lines)

```
carta_cli/__init__.py                  0      0   100%
carta_cli/__version__.py               1      0   100%
carta_cli/_glyphs.py                  23      0   100%
carta_cli/ai_skill.py                113     11    90%   662-663, 682-683, 690-693, 708-710
carta_cli/bundle.py                   74      2    97%   84, 88
carta_cli/commands/__init__.py         1      0   100%
carta_cli/commands/_parser.py        150     20    87%   22-23, 216, 226-234, 244-245, 264-267, 270-271, 302
carta_cli/commands/content.py        268     46    83%   29, 48-49, 56-57, 63-64, 89-90, 115-116, 121-122, 130, 166, 170-171, 174-175, 179, 192-193, 204-209, 233, 235, 239, 262, 269-270, 318-319, 327-328, 343, 345, 359, 367-368, 377, 383-384
carta_cli/commands/setup.py          175     15    91%   129, 133, 143, 160, 216-217, 267-268, 291, 313-318
carta_cli/commands/structure.py      429     60    86%   37, 42, 47-48, 57-58, 63, 94-96, 116, 121-122, 131-132, 137, 156, 162, 165, 168, 183-187, 211-212, 226-227, 232-233, 253, 260-261, 268, 344, 362, 364, 403, 405, 444, 455-456, 463-464, 468, 498-501, 507, 518, 522, 529-530, 570, 576, 582, 592, 597
carta_cli/commands/transform.py      294     17    94%   35, 39, 174, 181-182, 236, 259, 343-344, 351-354, 356, 360-361, 392, 398
carta_cli/docref.py                  108      4    96%   103, 148, 242-243
carta_cli/entries.py                  78     19    76%   28, 40-50, 111-112, 122-126
carta_cli/errors.py                    2      0   100%
carta_cli/frontmatter.py              78     19    76%   33, 41, 56-57, 62-63, 81-87, 91, 128-132, 139
carta_cli/main.py                      4      4     0%   2-6
carta_cli/numbering.py                 7      1    86%   10
carta_cli/planning.py                154      6    96%   26, 77-80, 309
carta_cli/portable/__init__.py         0      0   100%
carta_cli/portable/carta_main.py       6      6     0%   8-17
carta_cli/regenerate_core.py         199     23    88%   33, 38-39, 78, 88, 100-103, 124, 131, 140-141, 177-180, 193-195, 212, 258-261
carta_cli/rewriter.py                 60     21    65%   23, 29-31, 69-70, 99-120
carta_cli/workspace.py                38      4    89%   41, 55-57
----------------------------------------------------------------
TOTAL                               2262    278    88%
--------------------------- snapshot report summary ----------------------------
36 snapshots passed.
=================== 294 passed, 4 subtests passed in 11.74s ====================
.carta/03-product-design/01-workspace-scripts/05-actions/04-create.yaml:5:cli: "carta create <destination> <slug> [--order N] [--title TEXT] [--summary TEXT] [--tags CSV] [--deps CSV] [--dry-run]"
.carta/03-product-design/01-workspace-scripts/05-actions/04-create.md:10:Create a new `.md` file at a given position in a directory, with frontmatter drafted from the CLI args. Does not renumber siblings — either appends or inserts at `--order`, bumping only entries at/above that position.
```
