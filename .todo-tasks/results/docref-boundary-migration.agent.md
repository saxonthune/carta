# Agent Result: docref-boundary-migration

date: 2026-07-15T18:36:41-04:00
session: completed
verification: passed
commits: 1
branch: feat260714_claude_docref-boundary-migration
surface deviations: none
turns: 53/100
cost: $2.3497494999999997/$5.00
uncommitted: none
session id: efc59129-103d-4de5-9702-7f108443387d


## Summary

None.

## Commits

```
e6204529 carry DocRef through rewriter/planning interior instead of flattening to str
```

## Build & Test Output (last 30 lines)

```
rhidoc/__version__.py                1      0   100%
rhidoc/_glyphs.py                   23      0   100%
rhidoc/ai_skill.py                 145     19    87%   799, 837-838, 858-859, 866-870, 885-887, 912-918
rhidoc/bundle.py                    75      2    97%   87, 91
rhidoc/commands/__init__.py          1      0   100%
rhidoc/commands/_parser.py         192     20    90%   338-339, 345, 356-364, 374-375, 394-397, 400-401, 433
rhidoc/commands/content.py         329     47    86%   40, 59-60, 67-68, 74-75, 100-101, 128-129, 134-136, 162, 219, 223-224, 227-228, 232, 245-246, 257-262, 304, 306, 310, 333, 340-341, 400-401, 409-410, 425, 427, 451, 459-460, 469, 475-476
rhidoc/commands/mdapi.py           356     40    89%   21-23, 33, 52-53, 71, 87, 91, 93, 104, 181, 354, 362, 461-462, 561-585
rhidoc/commands/setup.py           205     15    93%   150, 154, 164, 181, 248-249, 317-318, 341, 363-368
rhidoc/commands/structure.py       483     60    88%   60, 67, 72-73, 82-83, 88, 119-121, 141, 146-147, 156-157, 162, 182, 188, 191, 194, 209-213, 237-238, 252-253, 258-259, 279, 286-287, 294, 387, 405, 407, 446, 448, 515, 527-528, 535-536, 540, 568-571, 577, 588, 592, 599-600, 656, 662, 668, 678, 683
rhidoc/commands/transform.py       345     18    95%   47, 51, 224, 231-232, 245, 288, 311, 418-419, 426-429, 431, 435-436, 469, 475
rhidoc/docref.py                   120      4    97%   128, 173, 267-268
rhidoc/entries.py                   82     19    77%   35, 47-57, 118-119, 129-133
rhidoc/errors.py                     2      0   100%
rhidoc/frontmatter.py               78     19    76%   33, 41, 56-57, 62-63, 81-87, 91, 128-132, 139
rhidoc/main.py                       4      4     0%   2-6
rhidoc/mdlint.py                    40      0   100%
rhidoc/mdtree.py                   251     21    92%   89, 100, 119, 180-183, 213, 243-246, 259, 288, 294, 316, 318, 330, 334, 339, 376, 398, 406
rhidoc/numbering.py                  7      1    86%   10
rhidoc/planning.py                 160      5    97%   26, 77-80
rhidoc/portable/__init__.py          0      0   100%
rhidoc/portable/rhidoc_main.py       6      6     0%   8-19
rhidoc/regenerate_core.py          293     44    85%   33, 38-39, 78, 88, 100-103, 124, 131, 140-141, 177-180, 193-195, 212, 258-261, 331, 334-338, 344, 362-363, 368, 374-378, 384-385, 418-422
rhidoc/rewriter.py                  58     20    66%   24, 30-32, 67-68, 97-117
rhidoc/workspace.py                 38      4    89%   41, 55-57
--------------------------------------------------------------
TOTAL                             3297    371    89%
--------------------------- snapshot report summary ----------------------------
35 snapshots passed.
=================== 430 passed, 4 subtests passed in 17.58s ====================
```
