#!/usr/bin/env bash
set -euo pipefail

# ─── Chain Executor ──────────────────────────────────────────────────────────
# Runs a sequence of plans in isolated worktrees, merging each into a chain
# worktree. The chain worktree acts as a clean trunk that the script controls,
# so individual phases never touch the user's working tree.
#
# Architecture:
#   real trunk (user's tree, may be dirty)
#     └── chain worktree (script-controlled, always clean)
#           └── task worktree (per phase, created/destroyed by execute-plan.sh)
#
# After each phase merges into the chain worktree, trunk commits are pulled in
# and conflicts resolved automatically. At the end, the chain branch is merged
# back into the real trunk.
#
# Usage: execute-chain.sh <chain-name> <plan1> <plan2> [plan3] ...
#   chain-name: identifier for this chain (used in manifest filename)
#   planN: plan slugs in execution order (without .md)

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(git rev-parse --show-toplevel)"
TODO="${REPO_ROOT}/.todo-tasks"

source "${SCRIPT_DIR}/lib.sh"
source_task_config

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

REAL_TRUNK="$(git branch --show-current)"
CHAIN_BRANCH="chain-${CHAIN_NAME}"
CHAIN_WORKTREE="${REPO_ROOT}/../${WORKTREE_PREFIX}-chain-${CHAIN_NAME}"
MANIFEST="${TODO}/.running/chain-${CHAIN_NAME}.manifest"

# ─── Guard: dirty tree check (once, at chain start) ─────────────────────────

if ! git diff --quiet || ! git diff --cached --quiet || [[ -n "$(git ls-files --others --exclude-standard)" ]]; then
  echo "ERROR: Working tree has uncommitted changes."
  echo ""
  echo "The chain creates a worktree from HEAD. Uncommitted changes won't"
  echo "be included and may cause conflicts when merging back."
  echo ""
  echo "Commit or stash your changes first, then re-launch."
  exit 1
fi

# ─── Validate All Plans Exist ────────────────────────────────────────────────

echo "═══ Chain Executor: ${CHAIN_NAME} ═══"
echo ""
echo "Phases: ${PHASES[*]}"
echo "Chain branch: ${CHAIN_BRANCH}"
echo "Chain worktree: ${CHAIN_WORKTREE}"
echo ""

for i in "${!PHASES[@]}"; do
  slug="${PHASES[$i]}"
  in_todo="${TODO}/${slug}.md"
  in_running="${TODO}/.running/${slug}.md"
  in_done="${TODO}/.done/${slug}.md"

  if [[ -f "$in_todo" || -f "$in_running" || -f "$in_done" ]]; then
    continue
  fi
  echo "ERROR: Plan '${slug}' not found in .todo-tasks/, .running/, or .done/"
  exit 1
done

# ─── Create Chain Worktree ──────────────────────────────────────────────────

echo "── Creating chain worktree ──"

# Clean up existing chain worktree/branch if present
if git worktree list | grep -q "${CHAIN_WORKTREE}"; then
  echo "Removing existing chain worktree..."
  git worktree remove --force "${CHAIN_WORKTREE}" 2>/dev/null || true
fi

if git branch --list "${CHAIN_BRANCH}" | grep -q "${CHAIN_BRANCH}"; then
  echo "Deleting existing chain branch..."
  git branch -D "${CHAIN_BRANCH}" 2>/dev/null || true
fi

git worktree add -b "${CHAIN_BRANCH}" "${CHAIN_WORKTREE}" "${REAL_TRUNK}"
echo "Chain worktree created at ${CHAIN_WORKTREE}"
echo ""

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
chain_branch: ${CHAIN_BRANCH}
chain_worktree: ${CHAIN_WORKTREE}
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

  # Launch this phase — execute-plan merges into the chain worktree, not trunk
  write_manifest "$slug" "running" "$completed_str"
  echo "Launching execute-plan.sh ${slug} (trunk: chain worktree)..."

  if bash "${SCRIPT_DIR}/execute-plan.sh" "${slug}" \
       --trunk-dir "${CHAIN_WORKTREE}" \
       --trunk-branch "${CHAIN_BRANCH}" \
       --no-guard; then
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

  # ── Pull trunk commits into chain worktree ──────────────────────────────
  # The user may have committed to trunk since the chain started. Pull those
  # in now so the next phase starts from an up-to-date base, and so the final
  # merge back to trunk is smaller/cleaner.

  echo "── Syncing trunk into chain worktree ──"
  cd "${CHAIN_WORKTREE}"

  if ! git merge "${REAL_TRUNK}" -m "chain: sync trunk into ${CHAIN_BRANCH} after ${slug}"; then
    echo "Merge conflict pulling trunk changes into chain worktree."
    echo "Attempting auto-resolution with Claude..."

    # Unset CLAUDECODE to allow nested claude invocations
    unset CLAUDECODE 2>/dev/null || true

    CONFLICT_FILES=$(git diff --name-only --diff-filter=U 2>/dev/null || echo "")
    RESOLVE_PROMPT="You are in a git worktree. There are merge conflicts after merging trunk into the chain branch.
Conflicted files: ${CONFLICT_FILES}

Resolve all merge conflicts. For each file, read it, understand both sides, pick the correct resolution.
Then stage the resolved files with 'git add' and commit with 'git commit --no-edit'.
Do NOT abort the merge."

    if claude -p \
      --allowedTools "Read,Write,Edit,Glob,Grep,Bash" \
      --permission-mode bypassPermissions \
      --output-format text \
      --max-turns 20 \
      --model sonnet \
      --max-budget-usd "1.00" \
      "${RESOLVE_PROMPT}" 2>&1; then
      echo "Trunk sync resolved."
    else
      echo "WARNING: Failed to auto-resolve trunk sync. Chain continuing with unmerged trunk changes."
      git merge --abort 2>/dev/null || true
    fi
  else
    echo "Trunk synced (no conflicts)."
  fi

  cd "${REPO_ROOT}"
  echo ""
done

# ─── Merge Chain Branch into Trunk ──────────────────────────────────────────

echo "── Merging chain into trunk ──"

write_manifest "done" "merging" "$(IFS=,; echo "${COMPLETED[*]}")"

cd "${REPO_ROOT}"

# Final sync: merge trunk into chain one more time before merging back
cd "${CHAIN_WORKTREE}"
if ! git merge "${REAL_TRUNK}" -m "chain: final trunk sync before merge" 2>/dev/null; then
  # If this conflicts, resolve it
  unset CLAUDECODE 2>/dev/null || true
  CONFLICT_FILES=$(git diff --name-only --diff-filter=U 2>/dev/null || echo "")
  RESOLVE_PROMPT="Resolve all merge conflicts. Conflicted files: ${CONFLICT_FILES}
Read each file, resolve correctly, git add, and git commit --no-edit."

  claude -p \
    --allowedTools "Read,Write,Edit,Glob,Grep,Bash" \
    --permission-mode bypassPermissions \
    --output-format text \
    --max-turns 20 \
    --model sonnet \
    --max-budget-usd "1.00" \
    "${RESOLVE_PROMPT}" 2>&1 || true
fi
cd "${REPO_ROOT}"

MERGE_STATUS="failed"

# Check if trunk has a dirty working tree — if so, skip merge but don't fail
if ! git diff --quiet || ! git diff --cached --quiet || [[ -n "$(git ls-files --others --exclude-standard)" ]]; then
  MERGE_STATUS="deferred (trunk has uncommitted changes)"
  echo "Trunk has uncommitted changes — deferring merge."
  echo "Chain branch ${CHAIN_BRANCH} is ready. Merge manually when ready:"
  echo "  git merge --squash ${CHAIN_BRANCH} && git commit -m 'feat: chain-${CHAIN_NAME} (agent)'"
elif git merge --squash "${CHAIN_BRANCH}" && git commit -m "feat: chain-${CHAIN_NAME} (agent)"; then
  MERGE_STATUS="success"
  echo "Chain merged into ${REAL_TRUNK}"

  # Clean up chain worktree and branch
  echo "── Cleaning up chain worktree ──"
  git worktree remove --force "${CHAIN_WORKTREE}" 2>/dev/null || true
  git branch -D "${CHAIN_BRANCH}" 2>/dev/null || true
  echo "Removed chain worktree and branch"
else
  git merge --abort 2>/dev/null || true
  MERGE_STATUS="conflict"
  echo "Merge conflict! Chain branch ${CHAIN_BRANCH} left intact for manual merge."
  echo "Chain worktree: ${CHAIN_WORKTREE}"
fi

# ─── Chain Complete ──────────────────────────────────────────────────────────

write_manifest "done" "complete" "$(IFS=,; echo "${COMPLETED[*]}")"

echo ""
echo "═══ Chain ${CHAIN_NAME} complete! All ${#PHASES[@]} phases succeeded. ═══"
echo "Completed: ${COMPLETED[*]}"
echo "Merge: ${MERGE_STATUS}"
