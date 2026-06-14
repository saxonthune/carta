# Agent Result: wire-docref-c-pure-cutover

**Date**: 2026-06-13T13:27:05-04:00
**Branch**: chain-docref-wiring_claude_wire-docref-c-pure-cutover
**Worktree**: /home/saxon/code/github/saxonthune/carta/../agent-wire-docref-c-pure-cutover
**Session**: completed
**Verification**: passed
**Merge**: clean
**Trunk**: unchanged
**Commits**: 1
**Retried**: false
**Surface Deviations**: declared


## Commits

```
375df6c4 feat: wire-docref-c-pure-cutover (agent)
```

## Claude Summary

All 265 tests pass and no inline ref grammar remains outside `docref.py`.

---

## Implementation Summary

Implemented the behavioral cutover from Task C: `DocRef`/`DocRef.SCAN` are now the primary wiring throughout the CLI.

### Changes made:

1. **`carta_cli/entries.py`** — Replaced the multi-path resolver with a strict two-path approach: ref forms (doc/d/bare coordinates via `_REF_RE` + `DocRef.parse`) or real existing filesystem paths. Removed fuzzy/stem/prefix guessing as a resolution mechanism. `_fuzzy_match` is retained only as an error-hint helper in `resolve_and_validate`.

2. **`carta_cli/commands/structure.py`** — Replaced the inline `ref_pattern = re.compile(r'(?<!\w)(doc\d{2}(?:\.\d{2})*)...')` in `_find_orphaned_refs` with `DocRef.SCAN`. Removed unused `import re`.

3. **`carta_cli/commands/content.py`** — `cmd_rewrite` now parses both sides of each `old=new` mapping through `DocRef.parse` (normalizing to canonical form). Dry-run scan uses `DocRef.SCAN`. Removed unused `import re`.

4. **`carta_cli/ai_skill.py`** — Updated argument resolution behavioral rule to document three input forms + canonical output + no-fuzzy rule. Updated rewrite command docs with normalization semantics.

5. **`carta_cli/templates/03-conventions.md`** — Synced with formal grammar from doc01.06: added the three input forms and slug-not-load-bearing note.

6. **`.carta/04-product-strategy/03-glossary.md`** — Added **Slug** entry disambiguating from **Title** (numbered directory) and **`title`** frontmatter field.

7. **`.carta/03-product-design/01-workspace-scripts/04-errors.md`** — Added `ERR-RESOLVE-BAD-REF` to the error catalog.

8. **`tests/test_cli.py`** — Updated 3 tests that relied on fuzzy resolution to reflect new behavior: stem-only path now returns non-existent literal, prefix-in-slash-path now returns non-existent literal, delete now requires full path or ref.

9. **`tests/__snapshots__/test_cli.ambr`** — Re-recorded 3 `TestHelpAi` snapshots for the updated ai-skill output.

## Notes

- The `portable/` directory only contains the shim (`carta_main.py`) and an empty `__init__.py`. The actual modules copied by `carta portable` are sourced from `carta_cli/` directly (via `_LIBRARY_MODULES` in `setup.py`), so changes to `entries.py`, `rewriter.py`, `commands/content.py`, etc. will be reflected in the next `carta portable` run automatically — no separate portable-specific changes needed.

- The dry-run count in `cmd_rewrite` is now slightly different: it uses `DocRef.SCAN.findall()` filtered for the specific ref rather than `re.compile(r'(?<!\w)' + re.escape(old) + ...)`. This is correct — `DocRef.SCAN` matches canonical forms only, which is the intent. Non-canonical occurrences (like dates) are excluded.

- `test_resolve_arg_accepts_prefix_only_at_root` still passes because `"01"` matches `_REF_RE` as a bare coordinate and resolves via `DocRef.to_path`. This is correct behavior — bare two-digit numbers are ref forms when they appear alone (no slashes).

## Surface Deviations

None. (The plan had no Surface block.)

## Build & Test Output (last 30 lines)

```
carta_cli/__init__.py                  0      0   100%
carta_cli/__version__.py               1      0   100%
carta_cli/_glyphs.py                  23      0   100%
carta_cli/ai_skill.py                113     11    90%   616-617, 636-637, 644-647, 662-664
carta_cli/bundle.py                   74      2    97%   84, 88
carta_cli/commands/__init__.py         1      0   100%
carta_cli/commands/_parser.py        156     20    87%   22-23, 196, 206-214, 235-236, 255-258, 261-262, 294
carta_cli/commands/content.py        268     46    83%   29, 48-49, 56-57, 63-64, 89-90, 115-116, 121-122, 130, 166, 170-171, 174-175, 179, 192-193, 204-209, 233, 235, 239, 262, 269-270, 318-319, 327-328, 343, 345, 359, 367-368, 377, 383-384
carta_cli/commands/setup.py          167     18    89%   129, 133, 143, 160, 216-217, 259-264, 286, 299-304
carta_cli/commands/structure.py      299     38    87%   29, 32, 36-37, 40, 43, 63, 65, 67, 95-96, 101-102, 122, 129-130, 137, 213, 231, 233, 272, 274, 298, 308, 312-315, 322, 333, 337, 343-344, 384, 390, 396, 406, 411
carta_cli/commands/transform.py      246     35    86%   35, 39, 116, 174, 231, 254, 312-353, 371
carta_cli/docref.py                  108      4    96%   103, 148, 242-243
carta_cli/entries.py                  78     19    76%   28, 40-50, 111-112, 122-126
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
TOTAL                               2080    276    87%
--------------------------- snapshot report summary ----------------------------
39 snapshots passed.
=================== 265 passed, 4 subtests passed in 10.11s ====================
/usr/bin/python3: No module named carta_cli.__main__; 'carta_cli' is a package and cannot be directly executed
prose scan via SCAN: ok
```
