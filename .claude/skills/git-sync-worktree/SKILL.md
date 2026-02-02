---
name: git-sync-worktree
description: Syncs a worktree's claude branch with its trunk branch
---

# git-sync-worktree

Syncs a worktree's experimental claude branch with its trunk branch using rebase for clean history.

## When to Use

Invoke from a worktree (on a `_claude1`, `_claude2`, etc. branch) when:
- Trunk branch has new commits you need
- Before merging your work back to trunk
- Every 30-60 minutes during active development
- After trunk has been synced with remote

## What This Does

1. **Detects worktree and trunk** branch names
2. **Fetches latest trunk state** from the main worktree
3. **Rebases worktree branch** onto trunk
4. **Handles conflicts** with clear guidance
5. **Verifies sync success**

## Execution Pattern

### 1. Detect Environment
```bash
# Check current branch (should be <trunk>_claude1, etc.)
CURRENT_BRANCH=$(git branch --show-current)

# Extract trunk name (remove _claudeN suffix)
TRUNK_BRANCH=$(echo $CURRENT_BRANCH | sed 's/_claude[0-9]*$//')

# Verify we're in a worktree
git worktree list
```

### 2. Sync with Trunk
```bash
# Fetch trunk branch state
git fetch . $TRUNK_BRANCH:$TRUNK_BRANCH

# Rebase onto trunk
git rebase $TRUNK_BRANCH
```

### 3. Handle Rebase Conflicts

If conflicts occur during rebase:
```markdown
⚠️  Rebase conflicts in:
  - packages/web-client/src/components/Map.tsx

To resolve:
1. Open the file and fix conflict markers (<<<<<<, =======, >>>>>>>)
2. `git add <resolved-file>`
3. `git rebase --continue`

To skip this commit: `git rebase --skip`
To abort entirely: `git rebase --abort`

After resolving, re-run `/git-sync-worktree` to verify.
```

### 4. Return Summary

```markdown
## Worktree Sync Complete

Worktree branch: feat260128_proto4_claude1
Trunk branch: feat260128_proto4
Rebase successful: 7 commits replayed

Your branch is now based on latest trunk.
No conflicts.

Changes from trunk:
- abc123 Fix edge rendering bug
- def456 Add LOD support

Your commits (rebased):
- xyz789 Add schema group layout
- uvw456 Fix metamap positioning

Ready to continue work.
```

## Alternative: Merge Instead of Rebase

If rebase conflicts are too complex, offer merge as fallback:
```bash
# Abort rebase
git rebase --abort

# Use merge instead
git merge $TRUNK_BRANCH
```

Note: Merge preserves history but makes it messier. Prefer rebase when possible.

## Important Notes

- **Commit before syncing**: Rebase works on commits, not dirty working directory
- **Rebase is safe here**: You control this branch, nobody else uses it
- **Small frequent syncs**: Easier than large infrequent ones
- **Can always abort**: `git rebase --abort` returns to pre-rebase state
- **Check reflog**: `git reflog` if you need to undo a completed rebase

## Safety Check

Before starting:
```bash
# Ensure no uncommitted changes
if [[ -n $(git status --porcelain) ]]; then
  echo "⚠️  Uncommitted changes detected."
  echo "Commit or stash before syncing."
  exit 1
fi
```

## Example Workflow

```bash
# In worktree on feat260128_proto4_claude1
# Trunk has 3 new commits

/git-sync-worktree

# Output:
# ✓ Fetched trunk (feat260128_proto4)
# ✓ Rebased 5 commits successfully
# ✓ Sync complete
```
