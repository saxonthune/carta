#!/usr/bin/env bash
set -euo pipefail

# Tags current main commit and pushes, triggering release workflows.
#
#   ./cicd/tag-release.sh            # reads version from package.json
#   ./cicd/tag-release.sh 0.1.0-alpha.1  # explicit version (verified against package.json)

ROOT="$(cd "$(dirname "$0")/.." && pwd)"

CURRENT_VERSION=$(node -p "require('$ROOT/package.json').version")

if [ $# -ge 1 ]; then
  VERSION="$1"
  if [ "$CURRENT_VERSION" != "$VERSION" ]; then
    echo "Error: package.json version is ${CURRENT_VERSION}, expected ${VERSION}"
    echo "Did the version bump PR merge yet?"
    exit 1
  fi
else
  VERSION="$CURRENT_VERSION"
fi

TAG="v${VERSION}"

# --- Preflight ---

CURRENT_BRANCH=$(git -C "$ROOT" branch --show-current)
if [ "$CURRENT_BRANCH" != "main" ]; then
  echo "Error: must be on main (currently on $CURRENT_BRANCH)"
  exit 1
fi

if ! git -C "$ROOT" diff --quiet || ! git -C "$ROOT" diff --cached --quiet; then
  echo "Error: working tree is not clean"
  exit 1
fi

git -C "$ROOT" pull --ff-only origin main

# --- Tag and push ---

git -C "$ROOT" tag -a "$TAG" -m "Release ${TAG}"
git -C "$ROOT" push origin "$TAG"

echo ""
echo "Tagged ${TAG} and pushed."
echo "GitHub Actions will now:"
echo "  - Build desktop binaries (Linux, macOS, Windows)"
echo "  - Deploy static site to GitHub Pages"
echo ""
echo "Check progress: gh run list --workflow=release-desktop.yml"
