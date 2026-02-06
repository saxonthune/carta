---
name: git-sync-trunk
description: Merges worktree branches into trunk, then syncs with remote or main
---

# git-sync-trunk

Merges work from worktree branches into trunk, then optionally syncs with remote.

## When to Use

Invoke from the trunk branch when:
- Worktree branches have commits to merge in
- You need to pull latest from remote
- Before creating new worktrees (ensures clean base)

## Execution

Run the sync script:

```bash
bash .claude/skills/git-sync-trunk/sync.sh
```

The script will:
1. Verify you're on trunk (no `_claude` suffix)
2. Find worktree branches matching `{trunk}_claude*`
3. Merge each branch with commits ahead
4. Sync with remote if configured
5. Report summary

## Handling Conflicts

If a merge conflict occurs, the script halts with instructions:

1. Edit conflicting files to resolve markers
2. `git add <files>`
3. `git commit`
4. Re-run: `bash .claude/skills/git-sync-trunk/sync.sh`

The script resumes with remaining branches.

**Workflow Preference**: When the agent resolves conflicts, it will inform the user that changes are ready and stop. The user handles all `git add`, `git commit`, and `git push` operations.

## After Sync

Remind users to run `/git-sync-worktree` in each worktree to rebase onto the updated trunk.
