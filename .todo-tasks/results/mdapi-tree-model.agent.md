# Agent Result: mdapi-tree-model

date: 2026-06-24T09:33:06-04:00
session: completed
verification: passed
commits: 1
branch: chain-mdapi_claude_mdapi-tree-model
surface deviations: none
turns: 21/100
cost: $1.5105353000000001/$5.00
uncommitted: none
session id: 5d38e2b2-3162-4ce3-8a28-07430d72a973


## Summary

- All other declared symbols (`MdNode`, fields, `parse`, `render`, `resolve`, `walk`) match the Surface exactly.

## Commits

```
cbb22c2d mdapi phase 1: MdTree positional-address model with parse/render/resolve/walk
```

## Build & Test Output (last 30 lines)

```
rhidoc/__init__.py                   0      0   100%
rhidoc/__version__.py                1      0   100%
rhidoc/_glyphs.py                   23      0   100%
rhidoc/ai_skill.py                 113     11    90%   662-663, 682-683, 690-693, 708-710
rhidoc/bundle.py                    74      2    97%   84, 88
rhidoc/commands/__init__.py          1      0   100%
rhidoc/commands/_parser.py         153     20    87%   221-222, 228, 238-246, 256-257, 276-279, 282-283, 314
rhidoc/commands/content.py         268     46    83%   29, 48-49, 56-57, 63-64, 89-90, 115-116, 121-122, 130, 166, 170-171, 174-175, 179, 192-193, 204-209, 233, 235, 239, 262, 269-270, 318-319, 327-328, 343, 345, 359, 367-368, 377, 383-384
rhidoc/commands/setup.py           175     15    91%   129, 133, 143, 160, 216-217, 267-268, 291, 313-318
rhidoc/commands/structure.py       429     60    86%   37, 42, 47-48, 57-58, 63, 94-96, 116, 121-122, 131-132, 137, 156, 162, 165, 168, 183-187, 211-212, 226-227, 232-233, 253, 260-261, 268, 344, 362, 364, 403, 405, 444, 455-456, 463-464, 468, 498-501, 507, 518, 522, 529-530, 570, 576, 582, 592, 597
rhidoc/commands/transform.py       294     17    94%   35, 39, 174, 181-182, 236, 259, 343-344, 351-354, 356, 360-361, 392, 398
rhidoc/docref.py                   108      4    96%   103, 148, 242-243
rhidoc/entries.py                   78     19    76%   28, 40-50, 111-112, 122-126
rhidoc/errors.py                     2      0   100%
rhidoc/frontmatter.py               78     20    74%   33, 41, 56-57, 62-63, 81-87, 91, 96, 128-132, 139
rhidoc/main.py                       4      4     0%   2-6
rhidoc/mdtree.py                   224     20    91%   89, 100, 119, 172, 180-183, 213, 238, 242-245, 252, 281, 287, 309, 311, 342, 361, 369
rhidoc/numbering.py                  7      1    86%   10
rhidoc/planning.py                 154      6    96%   26, 77-80, 309
rhidoc/portable/__init__.py          0      0   100%
rhidoc/portable/rhidoc_main.py       6      6     0%   8-17
rhidoc/regenerate_core.py          199     23    88%   33, 38-39, 78, 88, 100-103, 124, 131, 140-141, 177-180, 193-195, 212, 258-261
rhidoc/rewriter.py                  60     21    65%   23, 29-31, 69-70, 99-120
rhidoc/workspace.py                 38      4    89%   41, 55-57
--------------------------------------------------------------
TOTAL                             2489    299    88%
--------------------------- snapshot report summary ----------------------------
36 snapshots passed.
=================== 323 passed, 4 subtests passed in 16.39s ====================
['1', '1.1', '1.1.1', '1.1.1.1']
```
