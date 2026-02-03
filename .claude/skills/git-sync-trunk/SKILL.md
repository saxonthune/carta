---
name: git-sync-trunk
description: Merges worktree branches into trunk, then syncs with remote or main
---

# git-sync-trunk

Merges work from worktree branches into trunk, then optionally syncs with remote or main.

## When to Use

Invoke from the trunk branch when:
- Worktree branches have commits to merge in
- You need to pull latest from remote
- Both — merge worktrees first, then sync remote
- Before creating new worktrees (ensures clean base)

## What This Does

1. **Detects associated worktree branches** via `git worktree list`
2. **Merges worktree branches** that have commits ahead of trunk
3. **Syncs with remote** (pull) or main branch if applicable
4. **Reports what was merged** and any conflicts

## Execution Pattern

### 1. Detect Environment

```bash
# Verify we're on a trunk branch (no _claudeN suffix)
CURRENT_BRANCH=$(git branch --show-current)

# List all worktrees and their branches
git worktree list

# Find associated branches (branches with _claude suffix matching trunk name)
# e.g., trunk = feat260128_proto4
#        worktree branches = feat260128_proto4_claude1, feat260128_proto4_claude2
```

### 2. Check Worktree Branches for New Commits

For each worktree branch:
```bash
# Check if worktree branch has commits ahead of trunk
AHEAD=$(git rev-list --count $CURRENT_BRANCH..$WORKTREE_BRANCH)

if [ "$AHEAD" -gt 0 ]; then
  echo "$WORKTREE_BRANCH has $AHEAD commits to merge"
fi
```

### 3. Merge Worktree Branches

For each worktree branch with commits ahead:
```bash
git merge $WORKTREE_BRANCH
```

If there are multiple worktree branches with work, merge them one at a time and report status after each.

### 4. Sync with Remote (if applicable)

```bash
# If tracking remote
git pull origin $CURRENT_BRANCH

# Or if syncing with main
git fetch origin main
git merge origin/main
```

If no remote is configured or not needed, skip this step.

### 5. Handle Conflicts

If merge conflicts occur:
```markdown
Merge conflicts detected merging <branch>:
  - path/to/file.tsx

To resolve:
1. Edit the files to resolve conflict markers
2. `git add <resolved-files>`
3. `git commit` to complete the merge

Or abort: `git merge --abort`
```

### 6. Return Summary

```markdown
## Trunk Sync Complete

Branch: feat260128_proto4

Merged worktree branches:
- feat260128_proto4_claude1 (4 commits)
- feat260128_proto4_claude2 (2 commits)

Remote sync: pulled 3 commits from origin

No conflicts. Trunk is up to date with all worktrees and remote.

Next step: run `/git-sync-worktree` in each worktree to rebase onto updated trunk.
```

## Important Notes

- **Merge order**: Merge worktree branches first, then sync remote
- **Commit before syncing**: Ensure clean working directory
- **After trunk sync**: Remind user to run `/git-sync-worktree` in worktrees so they rebase onto the updated trunk
- **Stash if dirty**: Stash uncommitted changes before merging, restore after
- **Skip branches with no new commits**: Don't merge if worktree branch has nothing new
