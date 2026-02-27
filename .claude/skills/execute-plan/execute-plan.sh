#!/usr/bin/env bash
set -euo pipefail

# ─── Plan Executor Orchestrator ───────────────────────────────────────────────
# Creates a worktree, runs headless Claude to implement a plan, verifies, merges.
#
# Usage: execute-plan.sh <plan-name> [--no-merge]
#   plan-name: filename (without .md) in todo-tasks/
#   --no-merge: leave branch ready for manual merge instead of auto-merging

# ─── Parse Arguments ──────────────────────────────────────────────────────────

PLAN_SLUG=""
NO_MERGE=false

for arg in "$@"; do
  case "$arg" in
    --no-merge) NO_MERGE=true ;;
    -*) echo "Unknown option: $arg"; exit 1 ;;
    *) PLAN_SLUG="$arg" ;;
  esac
done

if [[ -z "$PLAN_SLUG" ]]; then
  echo "Usage: execute-plan.sh <plan-name> [--no-merge]"
  echo ""
  echo "Available plans:"
  ls todo-tasks/*.md 2>/dev/null | sed 's|todo-tasks/||;s|\.md$||' | sed 's/^/  /'
  exit 1
fi

# ─── Configuration ────────────────────────────────────────────────────────────

REPO_ROOT="$(git rev-parse --show-toplevel)"
TRUNK="$(git branch --show-current)"
BRANCH="${TRUNK}_claude_${PLAN_SLUG}"
WORKTREE_DIR="${REPO_ROOT}/../carta-agent-${PLAN_SLUG}"
MAX_BUDGET="5.00"
RETRY_BUDGET="3.00"

# ─── Step 1: Validate & Move to Running ──────────────────────────────────────

echo "═══ Plan Executor: ${PLAN_SLUG} ═══"
echo ""

PLAN_SOURCE_FILE="${REPO_ROOT}/todo-tasks/${PLAN_SLUG}.md"

if [[ ! -f "${PLAN_SOURCE_FILE}" ]]; then
  echo "ERROR: Plan file not found: todo-tasks/${PLAN_SLUG}.md"
  exit 1
fi

if [[ "$TRUNK" == *_claude* ]]; then
  echo "ERROR: Must run from trunk branch (current: ${TRUNK})"
  echo "Switch to a branch without '_claude' suffix first."
  exit 1
fi

# Move plan to .running/ — this IS the state transition
mkdir -p "${REPO_ROOT}/todo-tasks/.running"
mv "${PLAN_SOURCE_FILE}" "${REPO_ROOT}/todo-tasks/.running/${PLAN_SLUG}.md"
PLAN_FILE="todo-tasks/.running/${PLAN_SLUG}.md"

echo "Plan:      ${PLAN_FILE}"
echo "Trunk:     ${TRUNK}"
echo "Branch:    ${BRANCH}"
echo "Worktree:  ${WORKTREE_DIR}"
echo ""

# ─── Step 2: Create Worktree ─────────────────────────────────────────────────

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

git worktree add -b "${BRANCH}" "${WORKTREE_DIR}" "${TRUNK}"
echo "Worktree created at ${WORKTREE_DIR}"
echo ""

# ─── Step 3: Copy Plan into Worktree ────────────────────────────────────

echo "── Copying plan into worktree ──"

mkdir -p "${WORKTREE_DIR}/todo-tasks"
cp "${REPO_ROOT}/${PLAN_FILE}" "${WORKTREE_DIR}/todo-tasks/${PLAN_SLUG}.md"
echo "Copied plan from ${PLAN_FILE}"
echo ""

# ─── Step 4: Install Dependencies ────────────────────────────────────────────

echo "── Installing dependencies ──"
cd "${WORKTREE_DIR}"
pnpm install
echo "Dependencies installed"
echo ""

# ─── Step 5: Run Headless Claude ─────────────────────────────────────────────

# Unset CLAUDECODE to allow nested claude invocations from parent sessions
unset CLAUDECODE

echo "── Running headless Claude ──"

CLAUDE_PROMPT="Read the plan at todo-tasks/${PLAN_SLUG}.md and implement it fully. \
Follow the plan step by step. Commit after each logical unit of work. \
When done, run 'pnpm build && pnpm test' and fix any issues. \
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
  "${CLAUDE_PROMPT}" 2>&1) || true

# Extract session ID for potential retry
SESSION_ID=$(echo "${CLAUDE_OUTPUT}" | jq -r '.session_id // empty' 2>/dev/null || echo "")
CLAUDE_RESULT=$(echo "${CLAUDE_OUTPUT}" | jq -r '.result // empty' 2>/dev/null || echo "${CLAUDE_OUTPUT}")

echo "Claude session complete"
if [[ -n "$SESSION_ID" ]]; then
  echo "Session ID: ${SESSION_ID}"
fi
echo ""

# ─── Step 6: Verify Independently ────────────────────────────────────────────

echo "── Verifying build & tests ──"

BUILD_TEST_OUTPUT=""
VERIFIED=false

if cd "${WORKTREE_DIR}" && BUILD_TEST_OUTPUT=$(pnpm build 2>&1) && BUILD_TEST_OUTPUT+=$'\n'"$(pnpm test 2>&1)"; then
  VERIFIED=true
  echo "Build and tests PASSED"
else
  echo "Build or tests FAILED"
fi
echo ""

# ─── Step 7: Retry on Failure ────────────────────────────────────────────────

RETRIED=false
if [[ "$VERIFIED" == "false" ]]; then
  echo "── Retrying with error context ──"
  RETRIED=true

  ERROR_TAIL=$(echo "${BUILD_TEST_OUTPUT}" | tail -50)

  RETRY_PROMPT="The build or tests failed after your implementation. Here are the last 50 lines of output:

${ERROR_TAIL}

Fix the issues, then run 'pnpm build && pnpm test' again. Commit your fixes."

  if [[ -n "$SESSION_ID" ]]; then
    claude -p \
      --resume "${SESSION_ID}" \
      --permission-mode bypassPermissions \
      --output-format json \
      --max-turns 50 \
      --max-budget-usd "${RETRY_BUDGET}" \
      "${RETRY_PROMPT}" 2>&1 || true
  else
    claude -p \
      --allowedTools "Read,Write,Edit,Glob,Grep,Bash" \
      --permission-mode bypassPermissions \
      --output-format json \
      --max-turns 50 \
      --model sonnet \
      --max-budget-usd "${RETRY_BUDGET}" \
      "${RETRY_PROMPT}" 2>&1 || true
  fi

  echo ""
  echo "── Re-verifying build & tests ──"
  BUILD_TEST_OUTPUT=""
  if cd "${WORKTREE_DIR}" && BUILD_TEST_OUTPUT=$(pnpm build 2>&1) && BUILD_TEST_OUTPUT+=$'\n'"$(pnpm test 2>&1)"; then
    VERIFIED=true
    echo "Build and tests PASSED on retry"
  else
    echo "Build or tests STILL FAILING after retry"
  fi
  echo ""
fi

# ─── Step 8: Merge or Report ─────────────────────────────────────────────────

MERGE_STATUS="skipped"
COMMITS=$(cd "${WORKTREE_DIR}" && git log "${TRUNK}..HEAD" --oneline 2>/dev/null || echo "(none)")

if [[ "$VERIFIED" == "true" ]]; then
  if [[ "$NO_MERGE" == "false" ]]; then
    echo "── Merging into trunk ──"
    cd "${REPO_ROOT}"

    if git merge --squash "${BRANCH}" && git commit -m "feat: ${PLAN_SLUG} (agent)"; then
      MERGE_STATUS="success"
      echo "Merged ${BRANCH} into ${TRUNK}"

      # Clean up worktree and branch on successful merge
      echo "── Cleaning up worktree and branch ──"
      git worktree remove --force "${WORKTREE_DIR}" 2>/dev/null || true
      git branch -D "${BRANCH}" 2>/dev/null || true
      echo "Removed worktree and branch"
    else
      # Check if conflicts are doc-only — if so, resolve by accepting trunk
      CONFLICTED_FILES=$(git diff --name-only --diff-filter=U 2>/dev/null || true)
      NON_DOC_CONFLICTS=""
      DROPPED_DOC_FILES=""

      if [[ -n "$CONFLICTED_FILES" ]]; then
        while IFS= read -r file; do
          if [[ "$file" == .docs/* ]]; then
            DROPPED_DOC_FILES+="${file}"$'\n'
          else
            NON_DOC_CONFLICTS+="${file}"$'\n'
          fi
        done <<< "$CONFLICTED_FILES"
      fi

      if [[ -z "$NON_DOC_CONFLICTS" && -n "$DROPPED_DOC_FILES" ]]; then
        # All conflicts are in .docs/ — accept trunk's version and continue
        echo "Doc-only conflicts detected. Accepting trunk versions:"
        while IFS= read -r file; do
          [[ -z "$file" ]] && continue
          echo "  dropping agent edits: ${file}"
          git checkout --ours "${file}"
          git add "${file}"
        done <<< "$DROPPED_DOC_FILES"

        if git commit -m "feat: ${PLAN_SLUG} (agent)"; then
          MERGE_STATUS="success (doc conflicts resolved — agent doc edits dropped)"
          echo "Merged ${BRANCH} into ${TRUNK} (doc conflicts auto-resolved)"

          # Clean up worktree and branch
          echo "── Cleaning up worktree and branch ──"
          git worktree remove --force "${WORKTREE_DIR}" 2>/dev/null || true
          git branch -D "${BRANCH}" 2>/dev/null || true
          echo "Removed worktree and branch"
        else
          git merge --abort 2>/dev/null || true
          MERGE_STATUS="conflict"
          echo "Merge conflict! Branch ${BRANCH} left intact for manual merge."
        fi
      else
        git merge --abort 2>/dev/null || true
        MERGE_STATUS="conflict"
        echo "Merge conflict! Branch ${BRANCH} left intact for manual merge."
      fi
    fi
  else
    MERGE_STATUS="skipped (--no-merge)"
    echo "── Skipping merge (--no-merge) ──"
    echo "Branch ${BRANCH} is ready for manual merge."
  fi
else
  MERGE_STATUS="failed (build/test failure)"
  echo "── Skipping merge (verification failed) ──"
  echo "Worktree left intact at ${WORKTREE_DIR} for debugging."
fi

echo ""

# ─── Move to .done/ and Write Result File ────────────────────────────────────

mkdir -p "${REPO_ROOT}/todo-tasks/.done"
mv "${REPO_ROOT}/todo-tasks/.running/${PLAN_SLUG}.md" "${REPO_ROOT}/todo-tasks/.done/${PLAN_SLUG}.md"
rm -f "${REPO_ROOT}/todo-tasks/.running/${PLAN_SLUG}.log"

RESULT_FILE="${REPO_ROOT}/todo-tasks/.done/${PLAN_SLUG}.result.md"
BUILD_TEST_TAIL=$(echo "${BUILD_TEST_OUTPUT}" | tail -30)

cat > "${RESULT_FILE}" << RESULT_EOF
# Agent Result: ${PLAN_SLUG}

**Date**: $(date -Iseconds)
**Branch**: ${BRANCH}
**Worktree**: ${WORKTREE_DIR}
**Status**: $(if [[ "$VERIFIED" == "true" ]]; then echo "SUCCESS"; else echo "FAILURE"; fi)
**Merge**: ${MERGE_STATUS}
**Retried**: ${RETRIED}

## Commits

\`\`\`
${COMMITS}
\`\`\`

## Claude Summary

${CLAUDE_RESULT}

## Build & Test Output (last 30 lines)

\`\`\`
${BUILD_TEST_TAIL}
\`\`\`
RESULT_EOF

echo "═══ Result written to ${RESULT_FILE} ═══"
echo ""

if [[ "$VERIFIED" == "true" ]]; then
  echo "Done! Plan '${PLAN_SLUG}' implemented successfully."
else
  echo "Plan '${PLAN_SLUG}' implementation needs manual attention."
  echo "Check ${RESULT_FILE} for details."
  exit 1
fi
