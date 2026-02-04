---
name: git-sync-worktree
description: Syncs a worktree's claude branch with its trunk branch via rebase
---

# git-sync-worktree

Rebases a worktree's claude branch onto its trunk branch.

## When to Use

Invoke from a worktree (on a `_claude1`, `_clauded`, etc. branch) when:
- Trunk has new commits you need
- Every 30-60 minutes during active development

## Execution

Run the script:

```bash
bash .claude/skills/git-sync-worktree/sync.sh
```

The script handles everything: branch detection, safety checks, rebase, and formatted output.

## If Rebase Conflicts Occur

The script will stop. To resolve:
1. Edit conflicted files
2. `git add <resolved-file>`
3. `git rebase --continue`

To abort: `git rebase --abort`
