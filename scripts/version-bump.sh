#!/usr/bin/env bash
set -euo pipefail

# Usage: scripts/version-bump.sh <version>
# Example: scripts/version-bump.sh 0.1.0-alpha.1
#
# Creates a branch, bumps all package.json versions, commits, pushes, opens a PR.
# Assumes PRs are squash-merged.

if [ $# -ne 1 ]; then
  echo "Usage: $0 <version>"
  echo "Example: $0 0.1.0-alpha.1"
  exit 1
fi

NEW_VERSION="$1"
BRANCH="version-bump/v${NEW_VERSION}"

# 1. Must be on main with clean working tree
CURRENT_BRANCH=$(git branch --show-current)
if [ "$CURRENT_BRANCH" != "main" ]; then
  echo "Error: must be on main (currently on $CURRENT_BRANCH)"
  exit 1
fi

if ! git diff --quiet || ! git diff --cached --quiet; then
  echo "Error: working tree is not clean"
  exit 1
fi

git pull --ff-only origin main

# 2. Create branch
git checkout -b "$BRANCH"

# 3. Bump all package.json files
PACKAGE_FILES=(
  package.json
  packages/types/package.json
  packages/domain/package.json
  packages/document/package.json
  packages/compiler/package.json
  packages/web-client/package.json
  packages/server/package.json
  packages/desktop/package.json
)

for f in "${PACKAGE_FILES[@]}"; do
  # Replace the version field value, preserving formatting
  sed -i "s/\"version\": \".*\"/\"version\": \"${NEW_VERSION}\"/" "$f"
done

# 4. Commit and push
git add "${PACKAGE_FILES[@]}"
git commit -m "chore: bump version to ${NEW_VERSION}"
git push -u origin "$BRANCH"

# 5. Open PR
gh pr create \
  --title "chore: bump version to ${NEW_VERSION}" \
  --body "Bumps all package versions to \`${NEW_VERSION}\`." \
  --base main

echo ""
echo "PR created. After squash-merge, run:"
echo "  scripts/tag-release.sh ${NEW_VERSION}"
