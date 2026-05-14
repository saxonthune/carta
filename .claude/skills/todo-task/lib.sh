#!/usr/bin/env bash
# Shared helpers for todo-task scripts.
# Sourced by execute-plan.sh, status.sh, execute-chain.sh.

# ─── State Machine Vocabulary ──────────────────────────────────────────────
# Session phase: did Claude complete its work?
readonly SM_SESSION_COMPLETED="completed"
readonly SM_SESSION_FAILED="failed"

# Verification phase: did the code build and pass tests?
readonly SM_VERIFY_PASSED="passed"
readonly SM_VERIFY_FAILED="failed"
readonly SM_VERIFY_SKIPPED="skipped_no_commits"

# Merge phase: did the code land on trunk?
readonly SM_MERGE_CLEAN="clean"
readonly SM_MERGE_DIRTY="dirty"
readonly SM_MERGE_CONFLICT="conflict"
readonly SM_MERGE_SKIPPED_FLAG="skipped_flag"
readonly SM_MERGE_SKIPPED_VERIFY="skipped_no_verify"
readonly SM_MERGE_NOT_ATTEMPTED="not_attempted"

# Derived overall states
readonly SM_OVERALL_SUCCESS="success"
readonly SM_OVERALL_READY="ready_for_review"
readonly SM_OVERALL_CONFLICT="merge_conflict"
readonly SM_OVERALL_DIRTY="merged_with_markers"
readonly SM_OVERALL_NOOP="no_op"
readonly SM_OVERALL_BUILD_FAIL="build_failure"
readonly SM_OVERALL_SESSION_FAIL="session_failed"

# Buckets (for dashboard grouping)
readonly SM_BUCKET_SUCCESS="success"
readonly SM_BUCKET_READY="ready_for_review"
readonly SM_BUCKET_QUESTIONABLE="questionable"
readonly SM_BUCKET_ATTENTION="attention"

# derive_overall_state <session> <verification> <merge>
# Maps (session, verification, merge) → overall state.
# Echoes one of the SM_OVERALL_* values.
derive_overall_state() {
  local session="$1" verify="$2" merge="$3"
  if [[ "$session" == "$SM_SESSION_FAILED" ]]; then
    echo "$SM_OVERALL_SESSION_FAIL"; return
  fi
  case "$verify" in
    "$SM_VERIFY_FAILED") echo "$SM_OVERALL_BUILD_FAIL" ;;
    "$SM_VERIFY_SKIPPED") echo "$SM_OVERALL_NOOP" ;;
    "$SM_VERIFY_PASSED")
      case "$merge" in
        "$SM_MERGE_CLEAN") echo "$SM_OVERALL_SUCCESS" ;;
        "$SM_MERGE_DIRTY") echo "$SM_OVERALL_DIRTY" ;;
        "$SM_MERGE_CONFLICT") echo "$SM_OVERALL_CONFLICT" ;;
        "$SM_MERGE_SKIPPED_FLAG") echo "$SM_OVERALL_READY" ;;
        *) echo "$SM_OVERALL_BUILD_FAIL" ;;  # shouldn't happen
      esac ;;
    *) echo "$SM_OVERALL_BUILD_FAIL" ;;
  esac
}

# state_bucket <overall>
# Maps overall state → display bucket.
state_bucket() {
  local overall="$1"
  case "$overall" in
    "$SM_OVERALL_SUCCESS") echo "$SM_BUCKET_SUCCESS" ;;
    "$SM_OVERALL_READY") echo "$SM_BUCKET_READY" ;;
    "$SM_OVERALL_NOOP") echo "$SM_BUCKET_QUESTIONABLE" ;;
    *) echo "$SM_BUCKET_ATTENTION" ;;
  esac
}

# write_result_file <result_path> <slug> <session> <verification> <merge>
#   <commits_count> <commits_log> <branch> <worktree> <retried>
#   <session_id> <claude_result> <build_test_tail> [error_detail]
# Writes standardized result markdown. Validates inputs against vocabulary
# before writing; prints a warning for unknown values but writes anyway.
write_result_file() {
  local result_path="$1"
  local slug="$2"
  local session="$3"
  local verification="$4"
  local merge="$5"
  local commits_count="$6"
  local commits_log="$7"
  local branch="$8"
  local worktree="$9"
  local retried="${10}"
  local session_id="${11}"
  local claude_result="${12}"
  local build_test_tail="${13}"
  local error_detail="${14:-}"

  # Validate vocabulary (warn but don't abort)
  local valid_sessions="$SM_SESSION_COMPLETED $SM_SESSION_FAILED"
  local valid_verifications="$SM_VERIFY_PASSED $SM_VERIFY_FAILED $SM_VERIFY_SKIPPED"
  local valid_merges="$SM_MERGE_CLEAN $SM_MERGE_DIRTY $SM_MERGE_CONFLICT $SM_MERGE_SKIPPED_FLAG $SM_MERGE_SKIPPED_VERIFY $SM_MERGE_NOT_ATTEMPTED"

  if [[ " $valid_sessions " != *" $session "* ]]; then
    echo "WARNING: write_result_file: unknown session value: '$session'" >&2
  fi
  if [[ " $valid_verifications " != *" $verification "* ]]; then
    echo "WARNING: write_result_file: unknown verification value: '$verification'" >&2
  fi
  if [[ " $valid_merges " != *" $merge "* ]]; then
    echo "WARNING: write_result_file: unknown merge value: '$merge'" >&2
  fi

  cat > "$result_path" << RESULT_EOF
# Agent Result: ${slug}

**Date**: $(date -Iseconds)
**Branch**: ${branch}
**Worktree**: ${worktree}
**Session**: ${session}
**Verification**: ${verification}
**Merge**: ${merge}
**Commits**: ${commits_count}
**Retried**: ${retried}
$(if [[ -n "$error_detail" ]]; then echo "**Error**: ${error_detail}"; fi)

## Commits

\`\`\`
${commits_log}
\`\`\`

## Claude Summary

${claude_result}

## Build & Test Output (last 30 lines)

\`\`\`
${build_test_tail}
\`\`\`
RESULT_EOF
}

# source_task_config
# Sources project-specific config, then sets defaults for any unset variables.
# Reads: REPO_ROOT, SCRIPT_DIR (from caller scope)
# Sets: WORKTREE_PREFIX, MAX_BUDGET, RETRY_BUDGET, MAX_RETRIES
source_task_config() {
  if [[ -f "${REPO_ROOT}/.todo-tasks/task-config.sh" ]]; then
    source "${REPO_ROOT}/.todo-tasks/task-config.sh"
  elif [[ -f "${SCRIPT_DIR}/task-config.sh" ]]; then
    source "${SCRIPT_DIR}/task-config.sh"
  fi
  WORKTREE_PREFIX="${WORKTREE_PREFIX:-agent}"
  MAX_BUDGET="${MAX_BUDGET:-5.00}"
  RETRY_BUDGET="${RETRY_BUDGET:-3.00}"
  MAX_RETRIES="${MAX_RETRIES:-4}"
}

# parse_verification_commands <plan-path>
# Echoes the contents of the first fenced bash/sh block under a ## Verification
# heading. Exits non-zero and prints to stderr if no block is found.
parse_verification_commands() {
  local plan_path="$1"
  local result
  result=$(awk '
    BEGIN { in_section=0; in_fence=0 }
    in_fence && /^```[[:space:]]*$/ { exit }
    in_fence { print; next }
    in_section && /^##[[:space:]]/ { exit }
    in_section && (/^```bash[[:space:]]*$/ || /^```sh[[:space:]]*$/) { in_fence=1; next }
    /^##[[:space:]]+Verification[[:space:]]*$/ { in_section=1; next }
  ' "$plan_path")
  if [[ -z "$result" ]]; then
    echo "ERROR: plan has no fenced bash/sh block under ## Verification: ${plan_path}" >&2
    return 1
  fi
  echo "$result"
}

# parse_result_field <file> <key>
# Extracts a field value from a result or manifest file.
# Supports both plain "key: value" and bold "**key**: value" formats.
# Returns the value lowercased.
parse_result_field() {
  local file="$1" key="$2"
  local val=""
  val=$(grep -m1 -i "^${key}:" "$file" 2>/dev/null | sed "s/^[^:]*: *//" || true)
  if [[ -z "$val" ]]; then
    val=$(grep -m1 -i "^\*\*${key}\*\*:" "$file" 2>/dev/null | sed "s/^[^:]*: *//" || true)
  fi
  echo "${val,,}"
}
