#!/usr/bin/env bash
set -euo pipefail

# Syntax-check every shell script in the skill directory with `bash -n`.
# Run manually, or wire into CI / a pre-commit hook:
#   bash .claude/skills/todo-task/lint-syntax.sh
# Exits non-zero if any script fails to parse.

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

fail=0
for f in "${SCRIPT_DIR}"/*.sh; do
  [[ -e "$f" ]] || continue
  if bash -n "$f"; then
    echo "ok    $(basename "$f")"
  else
    echo "FAIL  $(basename "$f")"
    fail=1
  fi
done

if [[ "$fail" -ne 0 ]]; then
  echo ""
  echo "Syntax errors found. Fix the files above before shipping."
  exit 1
fi

echo ""
echo "All skill scripts parse cleanly."
