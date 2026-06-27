# Agent Result: generate-index-docs-from-children

date: 2026-06-27T15:04:11-04:00
session: completed
verification: passed
commits: 1
branch: feat060623_claude_generate-index-docs-from-children
surface deviations: none
turns: 90/100
cost: $4.764487450000002/$5.00
uncommitted: none
session id: fcd8218c-69d0-4050-8d4c-ba69ee0dbc0e


## Summary

None.

## Commits

```
09f0afa4 feat: generate 00-index.md bodies from direct children
```

## Build & Test Output (last 30 lines)

```
rhidoc/__version__.py                1      0   100%
rhidoc/_glyphs.py                   23      0   100%
rhidoc/ai_skill.py                 135     18    87%   797, 835-836, 855-856, 863-866, 881-883, 897-903
rhidoc/bundle.py                    74      2    97%   84, 88
rhidoc/commands/__init__.py          1      0   100%
rhidoc/commands/_parser.py         192     20    90%   338-339, 345, 356-364, 374-375, 394-397, 400-401, 433
rhidoc/commands/content.py         268     46    83%   29, 48-49, 56-57, 63-64, 89-90, 115-116, 121-122, 130, 166, 170-171, 174-175, 179, 192-193, 204-209, 233, 235, 239, 262, 269-270, 318-319, 327-328, 343, 345, 359, 367-368, 377, 383-384
rhidoc/commands/mdapi.py           266     40    85%   20-22, 32, 51-52, 70, 87, 91, 93, 104, 158, 283, 291, 368-369, 438-462
rhidoc/commands/setup.py           175     15    91%   130, 134, 144, 161, 217-218, 267-268, 291, 313-318
rhidoc/commands/structure.py       429     60    86%   37, 42, 47-48, 57-58, 63, 94-96, 116, 121-122, 131-132, 137, 156, 162, 165, 168, 183-187, 211-212, 226-227, 232-233, 253, 260-261, 268, 344, 362, 364, 403, 405, 444, 455-456, 463-464, 468, 498-501, 507, 518, 522, 529-530, 570, 576, 582, 592, 597
rhidoc/commands/transform.py       291     18    94%   35, 39, 173, 180-181, 194, 235, 258, 342-343, 350-353, 355, 359-360, 391, 397
rhidoc/docref.py                   108      4    96%   103, 148, 242-243
rhidoc/entries.py                   78     19    76%   28, 40-50, 111-112, 122-126
rhidoc/errors.py                     2      0   100%
rhidoc/frontmatter.py               78     19    76%   33, 41, 56-57, 62-63, 81-87, 91, 128-132, 139
rhidoc/main.py                       4      4     0%   2-6
rhidoc/mdlint.py                    39      0   100%
rhidoc/mdtree.py                   251     21    92%   89, 100, 119, 180-183, 213, 243-246, 259, 288, 294, 316, 318, 330, 334, 339, 376, 398, 406
rhidoc/numbering.py                  7      1    86%   10
rhidoc/planning.py                 154      6    96%   26, 77-80, 309
rhidoc/portable/__init__.py          0      0   100%
rhidoc/portable/rhidoc_main.py       6      6     0%   8-17
rhidoc/regenerate_core.py          293     44    85%   33, 38-39, 78, 88, 100-103, 124, 131, 140-141, 177-180, 193-195, 212, 258-261, 331, 334-338, 344, 362-363, 368, 374-378, 384-385, 418-422
rhidoc/rewriter.py                  60     21    65%   23, 29-31, 69-70, 99-120
rhidoc/workspace.py                 38      4    89%   41, 55-57
--------------------------------------------------------------
TOTAL                             2976    371    88%
--------------------------- snapshot report summary ----------------------------
35 snapshots passed.
=================== 422 passed, 4 subtests passed in 17.00s ====================
```
