#!/usr/bin/env bash
set -euo pipefail

# Launch execute-plan.sh in the background with log capture.
# Usage: launch.sh <plan-name> [--no-merge]

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(git rev-parse --show-toplevel)"

PLAN_SLUG=""
EXTRA_ARGS=""

for arg in "$@"; do
  case "$arg" in
    --no-merge) EXTRA_ARGS+=" --no-merge" ;;
    -*) echo "Unknown option: $arg"; exit 1 ;;
    *) PLAN_SLUG="$arg" ;;
  esac
done

if [[ -z "$PLAN_SLUG" ]]; then
  echo "Usage: launch.sh <plan-name> [--no-merge]"
  exit 1
fi

mkdir -p "${REPO_ROOT}/todo-tasks/.running"
LOG="${REPO_ROOT}/todo-tasks/.running/${PLAN_SLUG}.log"

nohup bash "${SCRIPT_DIR}/execute-plan.sh" "${PLAN_SLUG}" ${EXTRA_ARGS} > "${LOG}" 2>&1 &

echo "Agent launched: ${PLAN_SLUG} (pid $!)"
echo "Log: tail -f ${LOG}"
echo "Results: todo-tasks/.done/${PLAN_SLUG}.result.md"
