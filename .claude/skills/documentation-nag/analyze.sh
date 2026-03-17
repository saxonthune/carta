#!/usr/bin/env bash
# documentation-nag analysis script
# Consolidates all git operations into a single bash call to minimize approval friction.
# Outputs structured markdown for the skill to consume.
set -euo pipefail

# --- Determine diff base ---
DOCS_BASE=""
if [ -f .carta/.last-sync ]; then
  CANDIDATE=$(cat .carta/.last-sync | tr -d '[:space:]')
  if git merge-base --is-ancestor "$CANDIDATE" HEAD 2>/dev/null; then
    DOCS_BASE="$CANDIDATE"
  fi
fi
if [ -z "$DOCS_BASE" ]; then
  DOCS_BASE=$(git log -1 --format=%H -- .carta/)
fi
if [ -z "$DOCS_BASE" ]; then
  DOCS_BASE="HEAD~20"
fi

BASE_SHORT=$(git rev-parse --short "$DOCS_BASE")
HEAD_SHORT=$(git rev-parse --short HEAD)
COMMIT_COUNT=$(git rev-list --count "$DOCS_BASE"..HEAD)
BRANCH=$(git branch --show-current)

echo "## Analysis: ${BASE_SHORT}..${HEAD_SHORT} (${COMMIT_COUNT} commits, branch: ${BRANCH})"
echo ""

# --- Warning for claude branches ---
if [[ "$BRANCH" == *_claude* ]]; then
  echo "> **WARNING:** On a worktree branch. Docs updates should typically run on the trunk after /git-sync-trunk."
  echo ""
fi

# --- Commits grouped by feature ---
echo "### Commits by Feature"
echo ""
echo '```'
git log --oneline --no-merges "$DOCS_BASE"..HEAD
echo '```'
echo ""

# --- Changed files by package (excluding .carta/) ---
echo "### Changed Files by Package"
echo ""
git diff --stat "$DOCS_BASE"..HEAD -- ':!.carta/' ':!.claude/' ':!pnpm-lock.yaml' | tail -1
echo ""
git diff --name-only "$DOCS_BASE"..HEAD -- ':!.carta/' ':!.claude/' ':!pnpm-lock.yaml' | \
  sed 's|/.*||' | sort | uniq -c | sort -rn | while read count dir; do
    echo "- **${dir}**: ${count} files"
  done
echo ""

# --- Semantic changes: new/deleted/renamed files ---
echo "### New Files"
echo ""
git diff --diff-filter=A --name-only "$DOCS_BASE"..HEAD -- ':!.carta/' ':!.claude/' ':!pnpm-lock.yaml' | head -30
echo ""

echo "### Deleted Files"
echo ""
git diff --diff-filter=D --name-only "$DOCS_BASE"..HEAD -- ':!.carta/' ':!.claude/' ':!pnpm-lock.yaml' | head -30
echo ""

# --- What docs WERE touched (for comparison) ---
echo "### Docs Touched in Range"
echo ""
DOCS_CHANGED=$(git diff --name-only "$DOCS_BASE"..HEAD -- '.carta/' | head -20)
if [ -z "$DOCS_CHANGED" ]; then
  echo "(none)"
else
  echo "$DOCS_CHANGED"
fi
echo ""

# --- Key code patterns: new exports, new hooks, new components ---
echo "### New Exports (from barrel files)"
echo ""
git diff "$DOCS_BASE"..HEAD -- '*/index.ts' '*/index.tsx' | grep '^+export' | head -20
echo ""

echo "### New React Components"
echo ""
git diff "$DOCS_BASE"..HEAD -- '*.tsx' | grep -E '^\+export (default )?function [A-Z]' | head -20
echo ""

echo "### New Hooks"
echo ""
git diff "$DOCS_BASE"..HEAD -- '*.ts' '*.tsx' | grep -E '^\+export function use[A-Z]' | head -20
echo ""

# --- Uncommitted changes ---
UNSTAGED=$(git status --short 2>/dev/null)
if [ -n "$UNSTAGED" ]; then
  echo "### Uncommitted Changes"
  echo ""
  echo '```'
  echo "$UNSTAGED"
  echo '```'
  echo ""
fi
