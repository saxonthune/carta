#!/usr/bin/env bash
# Bump the templates CalVer in rhidoc/templates/__init__.py.
#
# Scheme: YYYY.MM.DD for the first release of a day, then a lowercase letter
# suffix (a, b, c, ...) for each same-day re-release. TEMPLATES_VERSION is the
# source of truth. It versions the files rhidoc installs into a workspace
# (handbook docs, AGENTS.md, wiring, skills) and is independent of the CLI
# version in pyproject.toml.
#
# Deliberate: run this only when cutting a templates release, not on every edit.
# `rhidoc update` reconciles hydrated files by content diff regardless of this
# string, so the version is a human-readable release label.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
INIT="${REPO_ROOT}/rhidoc/templates/__init__.py"

today="$(date +%Y.%m.%d)"
current="$(grep -oE 'TEMPLATES_VERSION = "[^"]*"' "$INIT" | sed -E 's/.*"([^"]*)".*/\1/')"

current_date="${current%[a-z]}"
current_suffix="${current#"$current_date"}"

if [[ "$current_date" != "$today" ]]; then
  new="$today"
elif [[ -z "$current_suffix" ]]; then
  new="${today}a"
elif [[ "$current_suffix" == "z" ]]; then
  echo "error: already at ${today}z — 26 releases today is plenty. Bump manually." >&2
  exit 1
else
  new="${today}$(echo "$current_suffix" | tr 'a-y' 'b-z')"
fi

sed -i -E "s/^TEMPLATES_VERSION = \".*\"/TEMPLATES_VERSION = \"${new}\"/" "$INIT"
echo "TEMPLATES_VERSION: ${current} -> ${new}"
echo "Next: run \`rhidoc update\` in workspaces to propagate, then commit."
