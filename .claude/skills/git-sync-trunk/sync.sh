#!/bin/bash
# git-sync-trunk: Merge worktree branches into trunk, sync with remote

set -e

TRUNK=$(git branch --show-current)

# Verify we're on trunk (no _claude suffix)
if [[ "$TRUNK" =~ _claude[a-z0-9]*$ ]]; then
  echo "ERROR: On worktree branch '$TRUNK'. Switch to trunk first."
  exit 1
fi

if [ -n "$(git status --porcelain)" ]; then
  echo "ERROR: Uncommitted changes. Commit or stash first."
  git status --short
  exit 1
fi

# Find worktree branches matching this trunk
WORKTREE_BRANCHES=$(git branch --list "${TRUNK}_claude*" | sed 's/^[* ]*//')
MERGED=()
SKIPPED=()

for BRANCH in $WORKTREE_BRANCHES; do
  AHEAD=$(git rev-list --count "$TRUNK".."$BRANCH" 2>/dev/null || echo "0")

  if [ "$AHEAD" -eq 0 ]; then
    SKIPPED+=("$BRANCH")
    continue
  fi

  echo "Merging $BRANCH ($AHEAD commits)..."

  # Get commit summary for merge message
  SUMMARY=$(git log --oneline "$TRUNK".."$BRANCH" | head -1 | cut -d' ' -f2-)

  if ! git merge "$BRANCH" -m "Merge ${BRANCH##*_}: $SUMMARY"; then
    echo ""
    echo "## Merge Conflict"
    echo ""
    echo "Conflict merging \`$BRANCH\`. Resolve, then re-run this script."
    echo ""
    echo "To resolve:"
    echo "1. Edit conflicting files"
    echo "2. \`git add <files>\`"
    echo "3. \`git commit\`"
    echo "4. Re-run: \`bash .claude/skills/git-sync-trunk/sync.sh\`"
    echo ""
    echo "Or abort: \`git merge --abort\`"
    exit 1
  fi

  MERGED+=("$BRANCH:$AHEAD")
done

# Sync with remote if configured
REMOTE_STATUS=""
if git rev-parse --verify origin/"$TRUNK" >/dev/null 2>&1; then
  git fetch origin "$TRUNK" 2>/dev/null || true
  BEHIND=$(git rev-list --count HEAD..origin/"$TRUNK" 2>/dev/null || echo "0")
  if [ "$BEHIND" -gt 0 ]; then
    echo "Pulling $BEHIND commits from origin..."
    git pull origin "$TRUNK"
    REMOTE_STATUS="Pulled $BEHIND commits"
  else
    REMOTE_STATUS="Already up to date"
  fi
fi

# Summary
echo ""
echo "## Trunk Sync Complete"
echo ""
echo "**Branch:** \`$TRUNK\`"
echo ""

if [ ${#MERGED[@]} -gt 0 ]; then
  echo "**Merged:**"
  for M in "${MERGED[@]}"; do
    BRANCH="${M%:*}"
    COUNT="${M#*:}"
    echo "- \`$BRANCH\` ($COUNT commits)"
  done
  echo ""
fi

if [ ${#SKIPPED[@]} -gt 0 ]; then
  echo "**Skipped (no new commits):** ${SKIPPED[*]}"
  echo ""
fi

if [ -n "$REMOTE_STATUS" ]; then
  echo "**Remote:** $REMOTE_STATUS"
  echo ""
fi

if [ ${#MERGED[@]} -gt 0 ]; then
  echo "**Next:** Run \`/git-sync-worktree\` in each worktree to rebase onto updated trunk."
else
  echo "Nothing to merge. Trunk is current."
fi
