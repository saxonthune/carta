---
name: git-sync-worktree
description: Syncs a worktree's claude branch with its trunk branch via rebase
---

# git-sync-worktree

Rebases a worktree's claude branch onto its trunk branch for clean linear history.

## When to Use

Invoke from a worktree (on a `_claude1`, `_claude2`, etc. branch) when:
- After `/git-sync-trunk` was run on the trunk branch
- Trunk has new commits you need (from other worktrees or remote)
- Every 30-60 minutes during active development
- Before starting a new chunk of work

## What This Does

1. **Detects worktree and trunk** branch names automatically
2. **Checks for uncommitted changes** (must be clean)
3. **Rebases worktree branch** onto trunk
4. **Reports results** with commit lists

## Execution Pattern

### 1. Detect Environment

```bash
# Check current branch (should be <trunk>_claude1, etc.)
CURRENT_BRANCH=$(git branch --show-current)

# Extract trunk name (remove _claudeN suffix)
TRUNK_BRANCH=$(echo $CURRENT_BRANCH | sed 's/_claude[0-9]*$//')

# Verify we're in a worktree (not on trunk)
if [ "$CURRENT_BRANCH" = "$TRUNK_BRANCH" ]; then
  echo "You're on the trunk branch. Use /git-sync-trunk instead."
  exit 1
fi
```

### 2. Safety Check

```bash
# Ensure no uncommitted changes
if [[ -n $(git status --porcelain) ]]; then
  echo "Uncommitted changes detected. Commit or stash before syncing."
  exit 1
fi
```

### 3. Check Divergence

```bash
# Compare trunk and worktree with left-right markers
# < = commits only on trunk, > = commits only on worktree
git log --oneline --left-right $TRUNK_BRANCH...HEAD
```

Empty output means branches are identical. Otherwise shows what needs syncing.

### 4. Rebase onto Trunk

```bash
# Rebase onto trunk
git rebase $TRUNK_BRANCH
```

### 5. Handle Rebase Conflicts

If conflicts occur:
```markdown
Rebase conflicts in:
  - path/to/file.tsx

To resolve:
1. Edit the file to fix conflict markers
2. `git add <resolved-file>`
3. `git rebase --continue`

To skip this commit: `git rebase --skip`
To abort entirely: `git rebase --abort`
```

If conflicts are too complex, offer merge as fallback:
```bash
git rebase --abort
git merge $TRUNK_BRANCH
```

### 6. Return Summary

```markdown
## Worktree Sync Complete

Worktree branch: feat260128_proto4_claude1
Trunk branch: feat260128_proto4
Rebase successful: 7 commits replayed

Your branch is now based on latest trunk.
No conflicts.

Changes from trunk since last sync:
- abc123 Fix edge rendering
- def456 Merge feat260128_proto4_claude2

Your commits (rebased):
- xyz789 Add schema group layout
- uvw456 Fix metamap positioning

Ready to continue work.
```

## Typical Two-Step Workflow

```bash
# Step 1: In trunk worktree — merge all worktree work + sync remote
/git-sync-trunk

# Step 2: In each worktree — rebase onto updated trunk
/git-sync-worktree
```

## Important Notes

- **Commit before syncing**: Rebase requires a clean working directory
- **Rebase is safe here**: You control this branch, nobody else uses it
- **Small frequent syncs**: Easier than large infrequent ones
- **Can always abort**: `git rebase --abort` returns to pre-rebase state
- **Check reflog**: `git reflog` shows history if you need to undo a completed rebase
