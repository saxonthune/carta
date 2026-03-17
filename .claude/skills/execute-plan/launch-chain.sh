#!/usr/bin/env bash
set -euo pipefail

# Launch execute-chain.sh in the background with log capture.
# Usage: launch-chain.sh <chain-name> <plan1> <plan2> [plan3] ...

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(git rev-parse --show-toplevel)"

if [[ $# -lt 2 ]]; then
  echo "Usage: launch-chain.sh <chain-name> <plan1> <plan2> [plan3] ..."
  exit 1
fi

CHAIN_NAME="$1"

mkdir -p "${REPO_ROOT}/todo-tasks/.running"
LOG="${REPO_ROOT}/todo-tasks/.running/chain-${CHAIN_NAME}.log"

nohup bash "${SCRIPT_DIR}/execute-chain.sh" "$@" > "${LOG}" 2>&1 &

echo "Chain launched: ${CHAIN_NAME} (pid $!)"
echo "Log: tail -f ${LOG}"
