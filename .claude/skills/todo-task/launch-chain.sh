#!/usr/bin/env bash
set -euo pipefail

# Launch execute-chain.sh in the background with log capture.
# Usage: launch-chain.sh <chain-name> <plan1> <plan2> [plan3] ... [--after <slug>]

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(git rev-parse --show-toplevel)"

AFTER=""
AFTER_NEXT=false
POSITIONAL=()

for arg in "$@"; do
  if [[ "$AFTER_NEXT" == "true" ]]; then
    AFTER="$arg"
    AFTER_NEXT=false
    continue
  fi
  case "$arg" in
    --after) AFTER_NEXT=true ;;
    *)       POSITIONAL+=("$arg") ;;
  esac
done

if [[ ${#POSITIONAL[@]} -lt 3 ]]; then
  echo "Usage: launch-chain.sh <chain-name> <plan1> <plan2> [plan3] ... [--after <slug>]"
  exit 1
fi

CHAIN_NAME="${POSITIONAL[0]}"
TODO="${REPO_ROOT}/.todo-tasks"

if [[ -n "$AFTER" ]]; then
  if [[ ! -f "${TODO}/tasks/${AFTER}.md" && ! -f "${TODO}/results/${AFTER}.agent.md" ]]; then
    echo "Predecessor '${AFTER}' not found: no spec at tasks/${AFTER}.md and no result at results/${AFTER}.agent.md"
    exit 1
  fi
fi

# Fast-fail on preconditions before backgrounding.
# Runs execute-chain.sh --validate-only synchronously; if it exits non-zero,
# the error is printed to stderr and we bail without creating a log.
if ! bash "${SCRIPT_DIR}/execute-chain.sh" "$@" --validate-only; then
  echo ""
  echo "Validation failed. Not launching."
  exit 1
fi

mkdir -p "${TODO}/.running"
LOG="${TODO}/.running/chain-${CHAIN_NAME}.log"

if [[ -n "$AFTER" ]]; then
  nohup bash "${SCRIPT_DIR}/execute-chain.sh" "${POSITIONAL[@]}" --after "${AFTER}" > "${LOG}" 2>&1 &
else
  nohup bash "${SCRIPT_DIR}/execute-chain.sh" "${POSITIONAL[@]}" > "${LOG}" 2>&1 &
fi

echo "Chain launched: ${CHAIN_NAME} (pid $!)"
echo "Log: tail -f ${LOG}"
