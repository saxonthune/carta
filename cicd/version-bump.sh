#!/usr/bin/env bash
set -euo pipefail

# Bumps version across all packages, opens a PR from main.
#
#   ./cicd/version-bump.sh                  # 0.1.0-alpha.1 → 0.1.0-alpha.2
#   ./cicd/version-bump.sh --preid alpha    # switch preid: 0.1.0-proto.5 → 0.1.0-alpha.0
#   ./cicd/version-bump.sh minor            # 0.1.0-alpha.2 → 0.2.0
#   ./cicd/version-bump.sh 1.0.0            # explicit version

ROOT="$(cd "$(dirname "$0")/.." && pwd)"

# --- Parse args ---

PREID=""
BUMP="prerelease"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --preid) PREID="$2"; shift 2 ;;
    *) BUMP="$1"; shift ;;
  esac
done

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

# --- Bump versions ---

NPM_ARGS=(--no-git-tag-version)
if [ -n "$PREID" ]; then
  NPM_ARGS+=(--preid "$PREID")
fi

npm version "$BUMP" "${NPM_ARGS[@]}" --prefix "$ROOT" > /dev/null
pnpm -r --prefix "$ROOT" exec npm version "$BUMP" "${NPM_ARGS[@]}" > /dev/null 2>&1

VERSION=$(node -p "require('$ROOT/package.json').version")
echo "All packages → $VERSION"

# --- Branch, commit, PR ---

BRANCH="version-bump/v${VERSION}"
git -C "$ROOT" checkout -b "$BRANCH"
git -C "$ROOT" add '*/package.json' package.json
git -C "$ROOT" commit -m "chore: bump version to ${VERSION}"
git -C "$ROOT" push -u origin "$BRANCH"

PR_URL=$(gh pr create \
  --repo "$(gh repo view --json nameWithOwner -q .nameWithOwner)" \
  --title "chore: bump version to ${VERSION}" \
  --body "Bumps all package versions to \`${VERSION}\`." \
  --base main)

echo ""
echo "PR created: $PR_URL"
echo "Waiting for checks to pass..."

gh pr checks "$PR_URL" --watch --fail-fast

echo "Checks passed. Merging..."
gh pr merge "$PR_URL" --squash --delete-branch

git checkout main
git pull --ff-only origin main

echo ""
echo "Merged. Run:"
echo "  ./cicd/tag-release.sh ${VERSION}"
