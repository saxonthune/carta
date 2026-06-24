#!/usr/bin/env bash
set -euo pipefail

# ─── Chain Executor ──────────────────────────────────────────────────────────
# Runs a sequence of plans in ONE shared worktree, committing each phase's code
# and result onto a single chain branch, then merging the whole chain to trunk
# once at the end (atomic all-or-nothing).
#
# Architecture:
#   real trunk (user's tree, may be dirty)
#     └── chain worktree (script-controlled, always clean)
#           └── task worktree (per phase, created/destroyed by execute-plan.sh)
#
# State is derived, not stored:
#   - Liveness lives in the gitignored run-record .running/chain-{name}.run
#     (worktree, branch, pid, ordered phases, optional waiting_for).
#   - Per-phase progress is derived by classifying each phase's result files in
#     the chain worktree (carried to trunk by the single final squash-merge).
#   - The chain definition chains/{name}.md is written to trunk ONLY on clean
#     completion. A failed/aborted chain leaves no definition — it is "live and
#     failed", located via its run-record.
#
# Usage: execute-chain.sh <chain-name> <plan1> <plan2> [plan3] ... [--after <slug>]

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(git rev-parse --show-toplevel)"
TODO="${REPO_ROOT}/.todo-tasks"

source "${SCRIPT_DIR}/lib.sh"
source_task_config

# ─── Parse Arguments ─────────────────────────────────────────────────────────

CHAIN_NAME=""
PHASES=()
AFTER=""
AFTER_NEXT=false
VALIDATE_ONLY=false

for arg in "$@"; do
  if [[ "$AFTER_NEXT" == "true" ]]; then
    AFTER="$arg"
    AFTER_NEXT=false
    continue
  fi
  case "$arg" in
    --after) AFTER_NEXT=true ;;
    --validate-only) VALIDATE_ONLY=true ;;
    *)
      if [[ -z "$CHAIN_NAME" ]]; then
        CHAIN_NAME="$arg"
      else
        PHASES+=("$arg")
      fi
      ;;
  esac
done

if [[ -z "$CHAIN_NAME" || ${#PHASES[@]} -lt 2 ]]; then
  echo "Usage: execute-chain.sh <chain-name> <plan1> <plan2> [plan3] ..."
  echo "  Requires at least 2 plans to form a chain."
  exit 1
fi

REAL_TRUNK="$(git branch --show-current)"

if [[ "$REAL_TRUNK" == *_claude* ]]; then
  echo "ERROR: Must run from trunk branch (current: ${REAL_TRUNK})"
  echo "Switch to a branch without '_claude' suffix first."
  exit 1
fi

CHAIN_BRANCH="chain-${CHAIN_NAME}"
CHAIN_WORKTREE="${REPO_ROOT}/../${WORKTREE_PREFIX}-${REPO_NAME}-chain-${CHAIN_NAME}"
CHAIN_RESULTS="${CHAIN_WORKTREE}/.todo-tasks/results"
RUN_FILE="$(run_record_path "$CHAIN_NAME" chain)"

PHASES_CSV="$(IFS=,; echo "${PHASES[*]}")"

# ─── Wait for predecessor (if --after was given) ─────────────────────────────
# Resume/liveness is derived from the reporter; we poll its task records for the
# predecessor reaching phase=done with overall=success.

if [[ -n "${AFTER}" ]]; then
  echo "Waiting for predecessor '${AFTER}' to complete and merge..."

  while true; do
    pred_rec="$(bash "${SCRIPT_DIR}/report.sh" task | awk -F'\t' -v s="$AFTER" '$2==s {print $3"\t"$4}')"
    pred_phase="$(echo "$pred_rec" | cut -f1)"
    pred_overall="$(echo "$pred_rec" | cut -f2)"

    if [[ "$pred_phase" == "done" && "$pred_overall" == "$SM_OVERALL_SUCCESS" ]]; then
      echo "Predecessor '${AFTER}' succeeded. Proceeding with chain..."
      break
    elif [[ "$pred_phase" == "done" || "$pred_phase" == "crashed" ]]; then
      echo "ERROR: Predecessor '${AFTER}' did not succeed (phase: ${pred_phase}, state: ${pred_overall}). Aborting chain."
      exit 1
    fi
    sleep 15
  done
fi

# ─── Guard: dirty tree check (once, at chain start) ─────────────────────────

# `.todo-tasks/` is excluded — orchestrator-managed; phase specs are committed
# below before the chain worktree is cut.
if ! git diff --quiet -- . ':(exclude).todo-tasks' \
   || ! git diff --cached --quiet -- . ':(exclude).todo-tasks' \
   || [[ -n "$(git ls-files --others --exclude-standard -- . ':(exclude).todo-tasks')" ]]; then
  echo "ERROR: Working tree has uncommitted changes (outside .todo-tasks/)."
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

for slug in "${PHASES[@]}"; do
  if [[ ! -f "${TODO}/tasks/${slug}.md" ]]; then
    echo "ERROR: Plan '${slug}' not found at .todo-tasks/tasks/${slug}.md"
    exit 1
  fi
done

if [[ "$VALIDATE_ONLY" == "true" ]]; then
  echo "Validation passed."
  exit 0
fi

# ─── Commit Phase Specs to Real Trunk ────────────────────────────────────────
# Specs must be committed BEFORE the chain worktree is cut, so the chain worktree
# carries them and the final squash-merge never collides with an untracked spec.
# The orchestrator owns this commit; the user never hand-commits task files.

SPEC_PATHS=()
for slug in "${PHASES[@]}"; do
  rel=".todo-tasks/tasks/${slug}.md"
  [[ -n "$(git status --porcelain -- "$rel" 2>/dev/null)" ]] && SPEC_PATHS+=("$rel")
done
if [[ ${#SPEC_PATHS[@]} -gt 0 ]]; then
  echo "── Committing ${#SPEC_PATHS[@]} phase spec(s) to trunk ──"
  git add "${SPEC_PATHS[@]}" 2>/dev/null || true
  git commit -q -m "todotask: chain specs ${CHAIN_NAME}" -- "${SPEC_PATHS[@]}" 2>/dev/null || true
  echo ""
fi

# ─── Create Chain Worktree ──────────────────────────────────────────────────

echo "── Creating chain worktree ──"

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

# ─── Write Chain Run-record ──────────────────────────────────────────────────

write_run_record "$CHAIN_NAME" "$CHAIN_WORKTREE" "$CHAIN_BRANCH" "$$" chain
{
  echo "phases: ${PHASES_CSV}"
  [[ -n "$AFTER" ]] && echo "waiting_for: ${AFTER}"
} >> "$RUN_FILE"

echo "Run-record: ${RUN_FILE}"
echo ""

# ─── Execute Phases ──────────────────────────────────────────────────────────

for i in "${!PHASES[@]}"; do
  slug="${PHASES[$i]}"
  phase_num=$((i + 1))
  total=${#PHASES[@]}

  echo "── Phase ${phase_num}/${total}: ${slug} ──"

  # Resume: skip a phase whose result already classifies success in the chain
  # worktree (supports re-running a partially completed chain).
  if [[ "$(classify_task "${CHAIN_RESULTS}/${slug}.agent.md" "${CHAIN_RESULTS}/${slug}.merge.md")" == "$SM_OVERALL_SUCCESS" ]]; then
    echo "Already completed successfully, skipping."
    echo ""
    continue
  fi

  # Launch this phase — execute-plan merges into the chain worktree, not trunk.
  echo "Launching execute-plan.sh ${slug} (trunk: chain worktree)..."

  if bash "${SCRIPT_DIR}/execute-plan.sh" "${slug}" \
       --trunk-dir "${CHAIN_WORKTREE}" \
       --trunk-branch "${CHAIN_BRANCH}" \
       --no-guard; then
    echo "Phase ${slug} succeeded."
  else
    echo "Phase ${slug} failed. Stopping chain."
    echo ""
    echo "═══ Chain ${CHAIN_NAME} stopped at phase ${phase_num}/${total} ═══"
    echo "Failed phase: ${slug}"
    echo "Remaining: ${PHASES[*]:$((i+1))}"
    # Leave the run-record in place: the chain is "live and failed", located
    # via its run-record. Do NOT write the chain definition to trunk.
    exit 1
  fi

  # ── Pull trunk commits into chain worktree ──────────────────────────────
  echo "── Syncing trunk into chain worktree ──"
  cd "${CHAIN_WORKTREE}"

  if ! git merge "${REAL_TRUNK}" -m "chain: sync trunk into ${CHAIN_BRANCH} after ${slug}"; then
    echo "Merge conflict pulling trunk changes into chain worktree."
    echo "Attempting auto-resolution with Claude..."

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

cd "${CHAIN_WORKTREE}"
# Final sync: merge trunk into chain one more time before merging back
if ! git merge "${REAL_TRUNK}" -m "chain: final trunk sync before merge" 2>/dev/null; then
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
  echo ""
  echo "Run-record left in place (chain not yet on trunk). Re-run or merge manually."
  exit 1
elif git merge --squash "${CHAIN_BRANCH}" && git commit -m "feat: chain-${CHAIN_NAME} (agent)"; then
  MERGE_STATUS="success"
  echo "Chain merged into ${REAL_TRUNK}"

  # ── Write the chain definition to trunk (orchestrator owns trunk) ────────
  mkdir -p "${TODO}/chains"
  CHAIN_DEF="${TODO}/chains/${CHAIN_NAME}.md"
  {
    echo "# Chain: ${CHAIN_NAME}"
    echo ""
    echo "chain: ${CHAIN_NAME}"
    echo "phases: ${PHASES_CSV}"
    [[ -n "$AFTER" ]] && echo "after: ${AFTER}"
    echo "completed: $(date -Iseconds)"
    echo ""
    echo "## Phases"
    echo ""
    for slug in "${PHASES[@]}"; do
      echo "- ${slug}"
    done
  } > "$CHAIN_DEF"
  git add "${CHAIN_DEF}" && git commit -m "todotask: chain definition ${CHAIN_NAME}" >/dev/null 2>&1 || true
  echo "Wrote chain definition: ${CHAIN_DEF}"

  # Clean up chain worktree, branch, and run-record
  echo "── Cleaning up chain worktree ──"
  git worktree remove --force "${CHAIN_WORKTREE}" 2>/dev/null || true
  git branch -D "${CHAIN_BRANCH}" 2>/dev/null || true
  clear_run_record "$CHAIN_NAME" chain
  rm -f "${TODO}/.running/chain-${CHAIN_NAME}.log"
  echo "Removed chain worktree, branch, and run-record"
else
  git merge --abort 2>/dev/null || true
  MERGE_STATUS="conflict"
  echo "Merge conflict! Chain branch ${CHAIN_BRANCH} left intact for manual merge."
  echo "Chain worktree: ${CHAIN_WORKTREE}"
  echo "Run-record left in place (chain not on trunk)."
  exit 1
fi

# ─── Chain Complete ──────────────────────────────────────────────────────────

echo ""
echo "═══ Chain ${CHAIN_NAME} complete! All ${#PHASES[@]} phases succeeded. ═══"
echo "Completed: ${PHASES[*]}"
echo "Merge: ${MERGE_STATUS}"
