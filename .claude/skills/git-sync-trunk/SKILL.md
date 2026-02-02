---
name: git-sync-trunk
description: Syncs the trunk branch with remote or main branch
---

# git-sync-trunk

Syncs your trunk feature branch with the latest changes from the remote or main branch.

## When to Use

Invoke when working on a trunk branch and need to:
- Pull latest changes from remote
- Sync with main/master branch
- Get updates before creating worktrees

## What This Does

1. **Checks current branch** and working directory state
2. **Stashes changes** if working directory is dirty
3. **Pulls from remote** or merges from main
4. **Restores stashed changes** if any
5. **Reports sync status** with conflict warnings if needed

## Execution Pattern

### 1. Check Current State
```bash
# Verify we're on the trunk branch
git branch --show-current

# Check for uncommitted changes
git status --porcelain
```

### 2. Sync Strategy

**If tracking remote:**
```bash
# Pull from remote tracking branch
git pull origin <branch-name>
```

**If syncing with main:**
```bash
# Fetch and merge from main
git fetch origin main
git merge origin/main
```

### 3. Handle Conflicts

If conflicts occur:
```markdown
⚠️  Merge conflicts detected in:
  - packages/web-client/src/components/Map.tsx
  - packages/web-client/src/hooks/useDocument.ts

Please resolve conflicts manually:
1. Open the files listed above
2. Edit to resolve conflict markers (<<<<<<, =======, >>>>>>>)
3. `git add <resolved-files>`
4. `git commit` to complete the merge

Or abort: `git merge --abort`
```

### 4. Return Summary

```markdown
## Trunk Sync Complete

Branch: feat260128_proto4
Synced with: origin/feat260128_proto4
Changes pulled: 3 commits
Files updated: 5

Latest commits:
- abc123 Fix edge rendering bug
- def456 Add LOD support
- ghi789 Update documentation

No conflicts. Ready to work.
```

## Important Notes

- **Stash before pull**: Preserve uncommitted changes
- **Check for conflicts**: Don't proceed if conflicts need resolution
- **Fast-forward preferred**: Use `--ff-only` when possible
- **Verify tests pass**: Quick check after sync
