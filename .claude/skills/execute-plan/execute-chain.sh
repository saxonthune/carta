#!/usr/bin/env bash
set -euo pipefail

# ─── Chain Executor ──────────────────────────────────────────────────────────
# Runs a sequence of plans via execute-plan.sh, stopping on first failure.
# Creates a manifest in .running/ to claim all phases and track progress.
#
# Usage: execute-chain.sh <chain-name> <plan1> <plan2> [plan3] ...
#   chain-name: identifier for this chain (used in manifest filename)
#   planN: plan slugs in execution order (without .md)
#
# Example:
#   execute-chain.sh map-v2 map-v2-interaction map-v2-connections map-v2-organizers

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(git rev-parse --show-toplevel)"
TODO="${REPO_ROOT}/todo-tasks"

# ─── Parse Arguments ─────────────────────────────────────────────────────────

CHAIN_NAME=""
PHASES=()

for arg in "$@"; do
  if [[ -z "$CHAIN_NAME" ]]; then
    CHAIN_NAME="$arg"
  else
    PHASES+=("$arg")
  fi
done

if [[ -z "$CHAIN_NAME" || ${#PHASES[@]} -lt 2 ]]; then
  echo "Usage: execute-chain.sh <chain-name> <plan1> <plan2> [plan3] ..."
  echo "  Requires at least 2 plans to form a chain."
  exit 1
fi

MANIFEST="${TODO}/.running/chain-${CHAIN_NAME}.manifest"

# ─── Validate All Plans Exist ────────────────────────────────────────────────

echo "═══ Chain Executor: ${CHAIN_NAME} ═══"
echo ""
echo "Phases: ${PHASES[*]}"
echo ""

# First phase may already be in .running/ (launched separately before chain)
for i in "${!PHASES[@]}"; do
  slug="${PHASES[$i]}"
  in_todo="${TODO}/${slug}.md"
  in_running="${TODO}/.running/${slug}.md"
  in_done="${TODO}/.done/${slug}.md"

  if [[ -f "$in_todo" || -f "$in_running" || -f "$in_done" ]]; then
    continue
  fi
  echo "ERROR: Plan '${slug}' not found in todo-tasks/, .running/, or .done/"
  exit 1
done

# ─── Create Manifest ─────────────────────────────────────────────────────────

mkdir -p "${TODO}/.running"

write_manifest() {
  local current="$1"
  local status="$2"
  local completed_str="$3"
  local failed_phase="${4:-}"

  cat > "$MANIFEST" << EOF
chain: ${CHAIN_NAME}
phases: $(IFS=,; echo "${PHASES[*]}")
current: ${current}
completed: ${completed_str}
status: ${status}
failed_phase: ${failed_phase}
EOF
}

COMPLETED=()
write_manifest "${PHASES[0]}" "running" ""

echo "Manifest: ${MANIFEST}"
echo ""

# ─── Execute Phases ──────────────────────────────────────────────────────────

for i in "${!PHASES[@]}"; do
  slug="${PHASES[$i]}"
  phase_num=$((i + 1))
  total=${#PHASES[@]}
  completed_str=$(IFS=,; echo "${COMPLETED[*]}")

  echo "── Phase ${phase_num}/${total}: ${slug} ──"

  # Skip if already done (supports resuming a partially completed chain)
  if [[ -f "${TODO}/.done/${slug}.result.md" ]]; then
    result_status=$(head -10 "${TODO}/.done/${slug}.result.md" | grep '^\*\*Status\*\*' | sed 's/.*: //')
    if [[ "$result_status" == "SUCCESS" ]]; then
      echo "Already completed successfully, skipping."
      COMPLETED+=("$slug")
      write_manifest "${PHASES[$((i+1))]:-done}" "running" "$(IFS=,; echo "${COMPLETED[*]}")"
      echo ""
      continue
    else
      echo "Previously failed. Stopping chain."
      write_manifest "$slug" "failed" "$completed_str" "$slug"
      exit 1
    fi
  fi

  # Skip if currently running (wait for it)
  if [[ -f "${TODO}/.running/${slug}.md" ]]; then
    echo "Phase is already running. Waiting for completion..."
    while [[ -f "${TODO}/.running/${slug}.md" ]]; do
      sleep 10
    done
    # Check result
    if [[ -f "${TODO}/.done/${slug}.result.md" ]]; then
      result_status=$(head -10 "${TODO}/.done/${slug}.result.md" | grep '^\*\*Status\*\*' | sed 's/.*: //')
      if [[ "$result_status" == "SUCCESS" ]]; then
        echo "Completed successfully."
        COMPLETED+=("$slug")
        write_manifest "${PHASES[$((i+1))]:-done}" "running" "$(IFS=,; echo "${COMPLETED[*]}")"
        echo ""
        continue
      else
        echo "Failed. Stopping chain."
        write_manifest "$slug" "failed" "$completed_str" "$slug"
        exit 1
      fi
    fi
  fi

  # Launch this phase
  write_manifest "$slug" "running" "$completed_str"
  echo "Launching execute-plan.sh ${slug}..."

  if bash "${SCRIPT_DIR}/execute-plan.sh" "${slug}"; then
    echo "Phase ${slug} succeeded."
    COMPLETED+=("$slug")
  else
    echo "Phase ${slug} failed. Stopping chain."
    write_manifest "$slug" "failed" "$(IFS=,; echo "${COMPLETED[*]}")" "$slug"
    echo ""
    echo "═══ Chain ${CHAIN_NAME} stopped at phase ${phase_num}/${total} ═══"
    echo "Failed phase: ${slug}"
    echo "Completed: ${COMPLETED[*]:-none}"
    echo "Remaining: ${PHASES[*]:$((i+1))}"
    exit 1
  fi

  echo ""
done

# ─── Chain Complete ──────────────────────────────────────────────────────────

write_manifest "done" "complete" "$(IFS=,; echo "${COMPLETED[*]}")"

echo "═══ Chain ${CHAIN_NAME} complete! All ${#PHASES[@]} phases succeeded. ═══"
echo "Completed: ${COMPLETED[*]}"
