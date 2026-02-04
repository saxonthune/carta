#!/bin/bash
# git-sync-worktree: Rebase worktree branch onto its trunk

set -e

CURRENT=$(git branch --show-current)
TRUNK=$(echo "$CURRENT" | sed 's/_claude[a-z0-9]*$//')

if [ "$CURRENT" = "$TRUNK" ]; then
  echo "ERROR: On trunk branch '$TRUNK'. Use /git-sync-trunk instead."
  exit 1
fi

if [ -n "$(git status --porcelain)" ]; then
  echo "ERROR: Uncommitted changes. Commit or stash first."
  git status --short
  exit 1
fi

echo "Rebasing $CURRENT onto $TRUNK..."
git rebase "$TRUNK"

echo ""
echo "## Worktree Sync Complete"
echo ""
echo "| | |"
echo "|---|---|"
echo "| **Worktree** | \`$CURRENT\` |"
echo "| **Trunk** | \`$TRUNK\` |"
echo "| **Result** | Success |"
echo ""

TRUNK_COMMITS=$(git log --oneline HEAD~10.."$TRUNK" 2>/dev/null | head -5)
if [ -n "$TRUNK_COMMITS" ]; then
  echo "Recent trunk commits:"
  echo "$TRUNK_COMMITS" | sed 's/^/- /'
  echo ""
fi

echo "Ready to continue work."
