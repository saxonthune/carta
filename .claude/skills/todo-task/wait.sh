#!/usr/bin/env bash
set -uo pipefail

# Blocking poller over report.sh — the single classifier. Auto-detects task vs
# chain by name and polls until a terminal state, deriving state from
# report.sh output only (never a PID: PIDs are unstable across chain phases
# and cleared on completion).
#
# Usage: wait.sh <name> [--timeout SECONDS] [--interval SECONDS]
#   <name>      a task slug OR a chain name (auto-detected)
#   --timeout   max seconds to wait before giving up (default: unbounded)
#   --interval  poll interval in seconds (default: 5)
# Exit: 0 if the run reached SUCCESS; non-zero otherwise (incl. timeout).

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(git rev-parse --show-toplevel)"
TODO="${REPO_ROOT}/.todo-tasks"
source "${SCRIPT_DIR}/lib.sh"

NAME=""
TIMEOUT=""
INTERVAL=5

while [[ $# -gt 0 ]]; do
  case "$1" in
    --timeout) TIMEOUT="$2"; shift 2 ;;
    --interval) INTERVAL="$2"; shift 2 ;;
    -*) echo "Unknown option: $1"; exit 1 ;;
    *) NAME="$1"; shift ;;
  esac
done

if [[ -z "$NAME" ]]; then
  echo "Usage: wait.sh <name> [--timeout SECONDS] [--interval SECONDS]"
  exit 1
fi

KIND="task"
if [[ -f "${TODO}/.running/chain-${NAME}.run" || -f "${TODO}/chains/${NAME}.md" ]]; then
  KIND="chain"
fi

finish() {
  local label="$1" code="$2"
  echo "wait: ${NAME} → ${label} (exit ${code})"
  exit "$code"
}

START="$(date +%s)"

while true; do
  if [[ "$KIND" == "chain" ]]; then
    ROW="$(bash "${SCRIPT_DIR}/report.sh" chain | awk -F'\t' -v n="$NAME" '$2 == n')"
    if [[ -n "$ROW" ]]; then
      STATUS="$(echo "$ROW" | cut -f3)"
      case "$STATUS" in
        "$SM_CHAIN_COMPLETE") finish "success" 0 ;;
        "$SM_CHAIN_FAILED"|"$SM_CHAIN_CONFLICT"|"$SM_CHAIN_AWAITING_MERGE"|"$SM_CHAIN_FINALIZABLE")
          finish "$STATUS" 1 ;;
        "$SM_CHAIN_RUNNING"|"$SM_CHAIN_WAITING") : ;;
      esac
    fi
  else
    ROW="$(bash "${SCRIPT_DIR}/report.sh" task | awk -F'\t' -v n="$NAME" '$2 == n')"
    if [[ -n "$ROW" ]]; then
      PHASE="$(echo "$ROW" | cut -f3)"
      OVERALL="$(echo "$ROW" | cut -f4)"
      case "$PHASE" in
        done|crashed)
          if [[ "$OVERALL" == "$SM_OVERALL_SUCCESS" ]]; then
            finish "success" 0
          else
            finish "$OVERALL" 1
          fi ;;
        running|pending) : ;;
      esac
    fi
  fi

  if [[ -n "$TIMEOUT" ]]; then
    NOW="$(date +%s)"
    ELAPSED=$(( NOW - START ))
    if (( ELAPSED >= TIMEOUT )); then
      finish "timeout after ${ELAPSED}s" 1
    fi
  fi

  sleep "$INTERVAL"
done
