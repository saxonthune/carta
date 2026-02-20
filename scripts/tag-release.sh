#!/usr/bin/env bash
set -euo pipefail

# Usage: scripts/tag-release.sh <version>
# Example: scripts/tag-release.sh 0.1.0-alpha.1
#
# Tags the current commit on main and pushes the tag.
# This triggers release-desktop.yml and release-web.yml workflows.

if [ $# -ne 1 ]; then
  echo "Usage: $0 <version>"
  echo "Example: $0 0.1.0-alpha.1"
  exit 1
fi

VERSION="$1"
TAG="v${VERSION}"

# Must be on main
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

# Verify the version in package.json matches
CURRENT_VERSION=$(node -p "require('./package.json').version")
if [ "$CURRENT_VERSION" != "$VERSION" ]; then
  echo "Error: package.json version is ${CURRENT_VERSION}, expected ${VERSION}"
  echo "Did the version bump PR merge yet?"
  exit 1
fi

# Tag and push
git tag -a "$TAG" -m "Release ${TAG}"
git push origin "$TAG"

echo ""
echo "Tagged ${TAG} and pushed."
echo "GitHub Actions will now:"
echo "  - Build desktop binaries (Linux, macOS, Windows)"
echo "  - Deploy static site to GitHub Pages"
echo ""
echo "Check progress: gh run list --workflow=release-desktop.yml"
echo "Draft release will appear at: gh release list"
