#!/usr/bin/env bash
set -euo pipefail

# Auto-bumps prerelease version across all packages.
#   ./cicd/version-bump.sh             # 0.1.0-alpha.1 → 0.1.0-alpha.2
#   ./cicd/version-bump.sh --preid alpha  # switch preid: 0.1.0-proto.5 → 0.1.0-alpha.0
#   ./cicd/version-bump.sh minor       # 0.1.0-alpha.2 → 0.2.0
#   ./cicd/version-bump.sh 1.0.0       # explicit version

ROOT="$(cd "$(dirname "$0")/.." && pwd)"

PREID=""
BUMP="prerelease"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --preid) PREID="$2"; shift 2 ;;
    *) BUMP="$1"; shift ;;
  esac
done

ARGS=(--no-git-tag-version)
if [ -n "$PREID" ]; then
  ARGS+=(--preid "$PREID")
fi

npm version "$BUMP" "${ARGS[@]}" --prefix "$ROOT" > /dev/null
pnpm -r --prefix "$ROOT" exec npm version "$BUMP" "${ARGS[@]}" > /dev/null 2>&1

VERSION=$(node -p "require('$ROOT/package.json').version")
echo "All packages → $VERSION"
