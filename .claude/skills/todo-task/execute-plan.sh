#!/usr/bin/env bash
set -uo pipefail

# ─── Plan Executor Orchestrator ───────────────────────────────────────────────
# Creates a worktree, runs headless Claude to implement a plan, verifies, merges.
#
# Usage: execute-plan.sh <plan-name> [options]
#   plan-name: filename (without .md) in .todo-tasks/
#   --no-merge: leave branch ready for manual merge instead of auto-merging
#   --trunk-dir <path>: merge back into this directory instead of repo root
#   --trunk-branch <name>: branch name to treat as trunk (for worktree-based chains)
#   --no-guard: skip the dirty-tree check (caller guarantees a clean trunk)

# ─── Parse Arguments ──────────────────────────────────────────────────────────

PLAN_SLUG=""
NO_MERGE=false
VALIDATE_ONLY=false
TRUNK_DIR=""
TRUNK_BRANCH=""
NO_GUARD=false

while [[ $# -gt 0 ]]; do
  case "$1" in
    --no-merge) NO_MERGE=true ;;
    --validate-only) VALIDATE_ONLY=true ;;
    --no-guard) NO_GUARD=true ;;
    --trunk-dir) TRUNK_DIR="$2"; shift ;;
    --trunk-branch) TRUNK_BRANCH="$2"; shift ;;
    -*) echo "Unknown option: $1"; exit 1 ;;
    *) PLAN_SLUG="$1" ;;
  esac
  shift
done

if [[ -z "$PLAN_SLUG" ]]; then
  echo "Usage: execute-plan.sh <plan-name> [--no-merge] [--trunk-dir <path>] [--trunk-branch <name>] [--no-guard]"
  echo ""
  echo "Available plans:"
  ls .todo-tasks/*.md 2>/dev/null | grep -v '\.epic\.md$' | sed 's|.todo-tasks/||;s|\.md$||' | sed 's/^/  /'
  exit 1
fi

# ─── Configuration ────────────────────────────────────────────────────────────

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(git rev-parse --show-toplevel)"

source "${SCRIPT_DIR}/lib.sh"
source_task_config

# Use caller-specified trunk or detect from current branch
if [[ -n "$TRUNK_BRANCH" ]]; then
  TRUNK="$TRUNK_BRANCH"
else
  TRUNK="$(git branch --show-current)"
fi

# Use caller-specified trunk directory or default to repo root
if [[ -n "$TRUNK_DIR" ]]; then
  MERGE_DIR="$(cd "$TRUNK_DIR" && pwd)"
else
  MERGE_DIR="$REPO_ROOT"
fi

BRANCH="${TRUNK}_claude_${PLAN_SLUG}"
WORKTREE_DIR="${REPO_ROOT}/../${WORKTREE_PREFIX}-${PLAN_SLUG}"
PLAN_SOURCE_FILE="${REPO_ROOT}/.todo-tasks/${PLAN_SLUG}.md"

# ─── Emergency Finalizer ─────────────────────────────────────────────────────
# Runs on unexpected EXIT. Prevents tasks from getting stuck in .running/ forever.

emergency_finalize() {
  local plan_running="${REPO_ROOT:-}/.todo-tasks/.running/${PLAN_SLUG:-}.md"
  local result_file="${REPO_ROOT:-}/.todo-tasks/.done/${PLAN_SLUG:-}.result.md"

  [[ -z "${PLAN_SLUG:-}" ]] && return
  [[ ! -f "$plan_running" ]] && return
  [[ -f "$result_file" ]] && return

  mkdir -p "${REPO_ROOT}/.todo-tasks/.done"
  write_result_file "$result_file" "$PLAN_SLUG" \
    "$SM_SESSION_FAILED" "$SM_VERIFY_FAILED" "$SM_MERGE_NOT_ATTEMPTED" \
    0 "(none)" "${BRANCH:-unknown}" "${WORKTREE_DIR:-unknown}" false "" \
    "Script exited unexpectedly at phase: ${CURRENT_PHASE:-unknown}" "" \
    "Emergency exit"

  mv "$plan_running" "${REPO_ROOT}/.todo-tasks/.done/${PLAN_SLUG}.md" 2>/dev/null || true
}

trap 'emergency_finalize' EXIT

# ─── Phase Functions ──────────────────────────────────────────────────────────

# phase_validate
# Checks plan exists, trunk branch is valid, working tree is clean.
# Exits 0 early if --validate-only.
phase_validate() {
  echo "═══ Plan Executor: ${PLAN_SLUG} ═══"
  echo ""

  if [[ ! -f "${PLAN_SOURCE_FILE}" ]]; then
    echo "ERROR: Plan file not found: .todo-tasks/${PLAN_SLUG}.md"
    exit 1
  fi

  if [[ "$TRUNK" == *_claude* ]]; then
    echo "ERROR: Must run from trunk branch (current: ${TRUNK})"
    echo "Switch to a branch without '_claude' suffix first."
    exit 1
  fi

  # Guard: refuse to launch if working tree is dirty (unless caller says skip)
  if [[ "$NO_GUARD" == "false" ]]; then
    if ! git -C "$MERGE_DIR" diff --quiet || ! git -C "$MERGE_DIR" diff --cached --quiet || [[ -n "$(git -C "$MERGE_DIR" ls-files --others --exclude-standard)" ]]; then
      echo "ERROR: Working tree has uncommitted changes."
      echo ""
      echo "The agent runs in a worktree branched from HEAD. Any uncommitted"
      echo "changes won't be in the worktree and will likely cause merge"
      echo "conflicts when the agent's branch merges back."
      echo ""
      echo "Commit your current changes before re-launching."
      echo "If the user prefers manual git operations, prompt them"
      echo "to commit or stash their changes, then re-launch."
      exit 1
    fi
  fi

  # Validate that the plan has a parseable ## Verification fenced block
  if ! VERIFY_SCRIPT=$(parse_verification_commands "${PLAN_SOURCE_FILE}"); then
    exit 1
  fi

  # Validation passed — exit early if that's all we were asked to do
  if [[ "$VALIDATE_ONLY" == "true" ]]; then
    echo "Validation passed."
    exit 0
  fi
}

# phase_move_to_running
# Moves plan file to .running/. Sets PLAN_FILE.
phase_move_to_running() {
  # Move plan to .running/ — this IS the state transition
  mkdir -p "${REPO_ROOT}/.todo-tasks/.running"
  mv "${PLAN_SOURCE_FILE}" "${REPO_ROOT}/.todo-tasks/.running/${PLAN_SLUG}.md"
  PLAN_FILE=".todo-tasks/.running/${PLAN_SLUG}.md"

  echo "Plan:      ${PLAN_FILE}"
  echo "Trunk:     ${TRUNK}"
  echo "Branch:    ${BRANCH}"
  echo "Worktree:  ${WORKTREE_DIR}"
  echo ""
}

# phase_create_worktree
# Creates the git worktree. WORKTREE_DIR is already set from config.
phase_create_worktree() {
  echo "── Creating worktree ──"

  # Clean up existing worktree/branch if present
  if git worktree list | grep -q "${WORKTREE_DIR}"; then
    echo "Removing existing worktree at ${WORKTREE_DIR}..."
    git worktree remove --force "${WORKTREE_DIR}" 2>/dev/null || true
  fi

  if git branch --list "${BRANCH}" | grep -q "${BRANCH}"; then
    echo "Deleting existing branch ${BRANCH}..."
    git branch -D "${BRANCH}" 2>/dev/null || true
  fi

  git worktree add -b "${BRANCH}" "${WORKTREE_DIR}" "${TRUNK}" || exit 1
  echo "Worktree created at ${WORKTREE_DIR}"
  echo ""
}

# phase_copy_plan
# Copies plan into worktree.
phase_copy_plan() {
  echo "── Copying plan into worktree ──"
  mkdir -p "${WORKTREE_DIR}/.todo-tasks"
  cp "${REPO_ROOT}/${PLAN_FILE}" "${WORKTREE_DIR}/.todo-tasks/${PLAN_SLUG}.md" || exit 1
  echo "Copied plan from ${PLAN_FILE}"
  echo ""
}

# phase_run_session
# Runs headless Claude. Sets SESSION_ID, CLAUDE_RESULT, SESSION_STATE, SESSION_ERROR.
phase_run_session() {
  # Unset CLAUDECODE to allow nested claude invocations from parent sessions
  unset CLAUDECODE

  # Pin CWD to the worktree so the inner session's edits and commits land on
  # the agent branch, not the trunk the script was invoked from.
  cd "${WORKTREE_DIR}"

  echo "── Running headless Claude ──"

  CLAUDE_PROMPT="Read the plan at .todo-tasks/${PLAN_SLUG}.md and implement it fully. \
Follow the plan step by step. \
IMPORTANT: You MUST git commit after each logical unit of work. You are a headless agent — no user is present. \
If you do not commit, your work will be lost. This overrides any memory or instructions about deferring commits to the user. \
When done, verify you made at least one commit (run 'git log --oneline -3'). The runner will execute the plan's ## Verification section separately. \
Output your implementation summary, then end with a '## Notes' section containing: \
- Any deviations from the plan (and why) \
- Caveats or known limitations in the implementation \
- Things a reviewer should pay attention to \
- Anything that surprised you or felt wrong \
If there's nothing noteworthy, write '## Notes' followed by 'None.'"

  CLAUDE_OUTPUT=$(claude -p \
    --allowedTools "Read,Write,Edit,Glob,Grep,Bash" \
    --permission-mode bypassPermissions \
    --output-format json \
    --max-turns 100 \
    --model sonnet \
    --max-budget-usd "${MAX_BUDGET}" \
    "${CLAUDE_PROMPT}" 2>&1)
  CLAUDE_EXIT=$?

  # Extract session ID for potential retry
  JQ_ALT='.session_id // empty'
  SESSION_ID=$(echo "${CLAUDE_OUTPUT}" | jq -r "$JQ_ALT" 2>/dev/null || echo "")
  JQ_ALT='.result // empty'
  CLAUDE_RESULT=$(echo "${CLAUDE_OUTPUT}" | jq -r "$JQ_ALT" 2>/dev/null || echo "${CLAUDE_OUTPUT}")

  # Detect session failure
  SESSION_STATE="$SM_SESSION_COMPLETED"
  SESSION_ERROR=""

  if [[ $CLAUDE_EXIT -ne 0 ]]; then
    SESSION_STATE="$SM_SESSION_FAILED"
    SESSION_ERROR="Claude CLI exited with code ${CLAUDE_EXIT}"
  elif [[ -z "$CLAUDE_RESULT" && -z "$SESSION_ID" ]]; then
    SESSION_STATE="$SM_SESSION_FAILED"
    SESSION_ERROR="No result or session ID returned — possible crash or network failure"
  fi

  echo "Claude session complete"
  if [[ -n "$SESSION_ID" ]]; then
    echo "Session ID: ${SESSION_ID}"
  fi
  if [[ "$SESSION_STATE" == "$SM_SESSION_FAILED" ]]; then
    echo "WARNING: Session failed — ${SESSION_ERROR}"
  fi
  echo ""
}

# check_trunk_leak
# Compares current trunk SHA to TRUNK_SHA_BEFORE. If trunk moved, sets:
#   LEAKED=true, LEAKED_COMMITS, LEAKED_ERROR. Otherwise sets LEAKED=false.
check_trunk_leak() {
  LEAKED=false
  LEAKED_COMMITS=""
  LEAKED_ERROR=""
  local trunk_sha_now
  trunk_sha_now=$(git -C "$MERGE_DIR" rev-parse "$TRUNK" 2>/dev/null || echo "")
  if [[ -n "$trunk_sha_now" && "$trunk_sha_now" != "$TRUNK_SHA_BEFORE" ]]; then
    LEAKED=true
    LEAKED_COMMITS=$(git -C "$MERGE_DIR" log "${TRUNK_SHA_BEFORE}..${trunk_sha_now}" --oneline 2>/dev/null || echo "")
    LEAKED_ERROR="Agent committed to trunk (${TRUNK}) instead of agent branch. To reset trunk: git -C \"${MERGE_DIR}\" reset --hard ${TRUNK_SHA_BEFORE}"
  fi
}

# phase_verify
# Runs verification commands from the plan. Sets VERIFIED (true/false), BUILD_TEST_OUTPUT, VERIFICATION_STATE.
phase_verify() {
  echo "── Verifying build & tests ──"

  check_trunk_leak
  if [[ "$LEAKED" == "true" ]]; then
    echo "ERROR: Agent commits leaked to trunk (${TRUNK})."
    echo "Leaked commits:"
    echo "${LEAKED_COMMITS}"
    echo ""
    echo "${LEAKED_ERROR}"
    VERIFIED=false
    VERIFICATION_STATE="$SM_VERIFY_LEAKED_TRUNK"
    BUILD_TEST_OUTPUT="Trunk leak detected. Leaked commits:\n${LEAKED_COMMITS}\n\n${LEAKED_ERROR}"
    SESSION_ERROR="${LEAKED_ERROR}"
    echo ""
    return
  fi

  BUILD_TEST_OUTPUT=""
  VERIFIED=false
  VERIFICATION_STATE="$SM_VERIFY_FAILED"

  # No-op detection: if agent produced 0 commits, skip build/test
  COMMITS=$(cd "${WORKTREE_DIR}" && git log "${TRUNK}..HEAD" --oneline 2>/dev/null || echo "")
  COMMITS_COUNT=$(echo "$COMMITS" | grep -c '.' 2>/dev/null || echo 0)
  [[ -z "$COMMITS" ]] && COMMITS_COUNT=0

  if [[ "$COMMITS_COUNT" -eq 0 ]]; then
    echo "WARNING: Agent produced 0 commits. Marking as no-op."
    VERIFICATION_STATE="$SM_VERIFY_SKIPPED"
    BUILD_TEST_OUTPUT="No commits produced — skipping build/test verification."
    echo ""
    return
  fi

  if cd "${WORKTREE_DIR}" && BUILD_TEST_OUTPUT=$(bash -c "$VERIFY_SCRIPT" 2>&1); then
    VERIFIED=true
    VERIFICATION_STATE="$SM_VERIFY_PASSED"
    echo "Build and tests PASSED"
  else
    echo "Build or tests FAILED"
  fi
  echo ""
}

# phase_retry_if_needed
# Retry loop. Updates VERIFIED, BUILD_TEST_OUTPUT. Sets RETRIED, RETRY_COUNT.
phase_retry_if_needed() {
  RETRIED=false
  RETRY_COUNT=0

  cd "${WORKTREE_DIR}"

  while [[ "$VERIFIED" == "false" && "$RETRY_COUNT" -lt "$MAX_RETRIES" ]]; do
    RETRY_COUNT=$((RETRY_COUNT + 1))
    echo "── Retry ${RETRY_COUNT}/${MAX_RETRIES} with error context ──"
    RETRIED=true

    ERROR_TAIL=$(echo "${BUILD_TEST_OUTPUT}" | tail -50)

    RETRY_PROMPT="The build or tests failed after your implementation. Here are the last 50 lines of output:

${ERROR_TAIL}

Fix the issues and commit your fixes. The runner will re-run verification automatically."

    if [[ -n "$SESSION_ID" ]]; then
      RETRY_OUTPUT=$(claude -p \
        --resume "${SESSION_ID}" \
        --permission-mode bypassPermissions \
        --output-format json \
        --max-turns 50 \
        --max-budget-usd "${RETRY_BUDGET}" \
        "${RETRY_PROMPT}" 2>&1) || true
      # Update session ID from retry output
      NEW_SESSION_ID=$(echo "${RETRY_OUTPUT}" | jq -r '.session_id // empty' 2>/dev/null || echo "")
      if [[ -n "$NEW_SESSION_ID" ]]; then
        SESSION_ID="$NEW_SESSION_ID"
      fi
    else
      RETRY_OUTPUT=$(claude -p \
        --allowedTools "Read,Write,Edit,Glob,Grep,Bash" \
        --permission-mode bypassPermissions \
        --output-format json \
        --max-turns 50 \
        --model sonnet \
        --max-budget-usd "${RETRY_BUDGET}" \
        "${RETRY_PROMPT}" 2>&1) || true
      NEW_SESSION_ID=$(echo "${RETRY_OUTPUT}" | jq -r '.session_id // empty' 2>/dev/null || echo "")
      if [[ -n "$NEW_SESSION_ID" ]]; then
        SESSION_ID="$NEW_SESSION_ID"
      fi
    fi

    echo ""
    echo "── Re-verifying build & tests (attempt ${RETRY_COUNT}) ──"
    BUILD_TEST_OUTPUT=""
    if cd "${WORKTREE_DIR}" && BUILD_TEST_OUTPUT=$(bash -c "$VERIFY_SCRIPT" 2>&1); then
      VERIFIED=true
      echo "Build and tests PASSED on retry ${RETRY_COUNT}"
    else
      echo "Build or tests STILL FAILING after retry ${RETRY_COUNT}"
    fi
    echo ""
  done
}

# phase_merge
# Merges worktree branch into trunk, or skips. Sets MERGE_STATUS, COMMITS, DIRTY_FILES.
phase_merge() {
  MERGE_STATUS="$SM_MERGE_NOT_ATTEMPTED"
  DIRTY_FILES=""
  COMMITS=$(cd "${WORKTREE_DIR}" && git log "${TRUNK}..HEAD" --oneline 2>/dev/null || echo "(none)")

  check_trunk_leak
  if [[ "$LEAKED" == "true" ]]; then
    echo "ERROR: Trunk advanced during session — leaked commits detected pre-merge."
    echo "${LEAKED_COMMITS}"
    echo "${LEAKED_ERROR}"
    VERIFIED=false
    VERIFICATION_STATE="$SM_VERIFY_LEAKED_TRUNK"
    MERGE_STATUS="$SM_MERGE_NOT_ATTEMPTED"
    BUILD_TEST_OUTPUT="Trunk leak detected pre-merge. Leaked commits:\n${LEAKED_COMMITS}\n\n${LEAKED_ERROR}"
    SESSION_ERROR="${LEAKED_ERROR}"
    echo ""
    return
  fi

  if [[ "$VERIFIED" == "true" ]]; then
    if [[ "$NO_MERGE" == "false" ]]; then
      echo "── Merging into trunk ──"
      cd "${MERGE_DIR}"

      if git merge --squash "${BRANCH}" && git commit -m "feat: ${PLAN_SLUG} (agent)"; then
        # Scan for conflict markers in the merge commit
        DIRTY_FILES=$(git diff-tree --no-commit-id --name-only -r HEAD | \
          xargs -r grep -l -E '^(<{7} |={7}$|>{7} )' 2>/dev/null || true)

        if [[ -n "$DIRTY_FILES" ]]; then
          MERGE_STATUS="$SM_MERGE_DIRTY"
          echo "WARNING: Merge commit contains conflict markers in:"
          echo "$DIRTY_FILES"
          echo "NOT auto-reverting. Manual review required."
        else
          MERGE_STATUS="$SM_MERGE_CLEAN"
          echo "Merged ${BRANCH} into ${TRUNK}"

          # Clean up worktree and branch on clean merge only
          echo "── Cleaning up worktree and branch ──"
          git worktree remove --force "${WORKTREE_DIR}" 2>/dev/null || true
          git branch -D "${BRANCH}" 2>/dev/null || true
          echo "Removed worktree and branch"
        fi
      else
        git merge --abort 2>/dev/null || true
        MERGE_STATUS="$SM_MERGE_CONFLICT"
        echo "Merge conflict! Branch ${BRANCH} left intact for manual merge."
      fi
    else
      MERGE_STATUS="$SM_MERGE_SKIPPED_FLAG"
      echo "── Skipping merge (--no-merge) ──"
      echo "Branch ${BRANCH} is ready for manual merge."
    fi
  else
    MERGE_STATUS="$SM_MERGE_SKIPPED_VERIFY"
    echo "── Skipping merge (verification failed) ──"
    echo "Worktree left intact at ${WORKTREE_DIR} for debugging."
  fi

  echo ""
}

# phase_finalize
# Moves files to .done/, writes result file, prints summary.
phase_finalize() {
  mkdir -p "${REPO_ROOT}/.todo-tasks/.done"
  mv "${REPO_ROOT}/.todo-tasks/.running/${PLAN_SLUG}.md" "${REPO_ROOT}/.todo-tasks/.done/${PLAN_SLUG}.md"
  rm -f "${REPO_ROOT}/.todo-tasks/.running/${PLAN_SLUG}.log"

  RESULT_FILE="${REPO_ROOT}/.todo-tasks/.done/${PLAN_SLUG}.result.md"
  BUILD_TEST_TAIL=$(echo "${BUILD_TEST_OUTPUT}" | tail -30)

  # Append dirty-merge warning to Claude result if markers were found
  if [[ "$MERGE_STATUS" == "$SM_MERGE_DIRTY" && -n "${DIRTY_FILES:-}" ]]; then
    CLAUDE_RESULT+=$'\n\n## Merge Marker Warning\n\nConflict markers detected in:\n'"${DIRTY_FILES}"
  fi

  # Compute commits count (COMMITS may already be set from phase_verify or phase_merge)
  COMMITS_COUNT=$(echo "$COMMITS" | grep -c '.' 2>/dev/null || echo 0)
  [[ "$COMMITS" == "(none)" || -z "$COMMITS" ]] && COMMITS_COUNT=0

  write_result_file "$RESULT_FILE" "$PLAN_SLUG" \
    "$SESSION_STATE" "$VERIFICATION_STATE" "$MERGE_STATUS" \
    "$COMMITS_COUNT" "${COMMITS:-(none)}" "$BRANCH" "$WORKTREE_DIR" "$RETRIED" \
    "${SESSION_ID:-}" "$CLAUDE_RESULT" "$BUILD_TEST_TAIL" "${SESSION_ERROR:-}"

  echo "═══ Result written to ${RESULT_FILE} ═══"
  echo ""

  if [[ "$VERIFIED" == "true" ]]; then
    echo "Done! Plan '${PLAN_SLUG}' implemented successfully."
  else
    echo "Plan '${PLAN_SLUG}' implementation needs manual attention."
    echo "Check ${RESULT_FILE} for details."
    exit 1
  fi
}

# ─── Main ─────────────────────────────────────────────────────────────────────

main() {
  CURRENT_PHASE="validate";        phase_validate
  TRUNK_SHA_BEFORE=$(git -C "$MERGE_DIR" rev-parse "$TRUNK")
  CURRENT_PHASE="move_to_running"; phase_move_to_running
  CURRENT_PHASE="create_worktree"; phase_create_worktree
  CURRENT_PHASE="copy_plan";       phase_copy_plan
  CURRENT_PHASE="run_session";     phase_run_session

  if [[ "${SESSION_STATE}" == "$SM_SESSION_FAILED" ]]; then
    # Session failed — skip verify, retry, merge; go straight to finalize
    VERIFIED=false
    VERIFICATION_STATE="$SM_VERIFY_FAILED"
    MERGE_STATUS="$SM_MERGE_NOT_ATTEMPTED"
    COMMITS=""
    RETRIED=false
    RETRY_COUNT=0
    BUILD_TEST_OUTPUT=""
  else
    CURRENT_PHASE="verify";          phase_verify

    if [[ "${VERIFICATION_STATE}" == "$SM_VERIFY_SKIPPED" || "${VERIFICATION_STATE}" == "$SM_VERIFY_LEAKED_TRUNK" ]]; then
      # No commits (or commits leaked to trunk) — skip retry and merge
      MERGE_STATUS="$SM_MERGE_NOT_ATTEMPTED"
      RETRIED=false
      RETRY_COUNT=0
    else
      CURRENT_PHASE="retry_if_needed"; phase_retry_if_needed

      # Re-set VERIFICATION_STATE after retries
      if [[ "$VERIFIED" == "true" ]]; then
        VERIFICATION_STATE="$SM_VERIFY_PASSED"
      else
        VERIFICATION_STATE="$SM_VERIFY_FAILED"
      fi

      CURRENT_PHASE="merge";           phase_merge
    fi
  fi

  CURRENT_PHASE="finalize";        phase_finalize
}

main
