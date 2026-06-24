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

# Trunk phase: did the trunk branch move during the run? (leak detection)
readonly SM_TRUNK_UNCHANGED="unchanged"
readonly SM_TRUNK_MOVED="moved"

# Derived overall states
readonly SM_OVERALL_SUCCESS="success"
readonly SM_OVERALL_READY="ready_for_review"
readonly SM_OVERALL_CONFLICT="merge_conflict"
readonly SM_OVERALL_DIRTY="merged_with_markers"
readonly SM_OVERALL_NOOP="no_op"
readonly SM_OVERALL_TRUNK_LEAK="trunk_leak"
readonly SM_OVERALL_BUILD_FAIL="build_failure"
readonly SM_OVERALL_SESSION_FAIL="session_failed"
readonly SM_OVERALL_SALVAGEABLE="salvageable"

# Buckets (for dashboard grouping)
readonly SM_BUCKET_SUCCESS="success"
readonly SM_BUCKET_READY="ready_for_review"
readonly SM_BUCKET_QUESTIONABLE="questionable"
readonly SM_BUCKET_ATTENTION="attention"

# derive_overall_state <session> <verification> <merge> [trunk] [uncommitted]
# Maps (session, verification, merge, trunk, uncommitted) → overall state.
# uncommitted: human summary ("3 files, 280 lines") or "none"/"0"/empty when clean.
# Echoes one of the SM_OVERALL_* values.
derive_overall_state() {
  local session="$1" verify="$2" merge="$3" trunk="${4:-$SM_TRUNK_UNCHANGED}" uncommitted="${5:-none}"
  local has_dirt=false
  [[ -n "$uncommitted" && "$uncommitted" != "none" && "$uncommitted" != "0" ]] && has_dirt=true

  if [[ "$session" == "$SM_SESSION_FAILED" ]]; then
    if [[ "$has_dirt" == "true" ]]; then echo "$SM_OVERALL_SALVAGEABLE"; else echo "$SM_OVERALL_SESSION_FAIL"; fi
    return
  fi
  case "$verify" in
    "$SM_VERIFY_FAILED") echo "$SM_OVERALL_BUILD_FAIL" ;;
    "$SM_VERIFY_SKIPPED")
      if [[ "$trunk" == "$SM_TRUNK_MOVED" ]]; then
        echo "$SM_OVERALL_TRUNK_LEAK"
      elif [[ "$has_dirt" == "true" ]]; then
        echo "$SM_OVERALL_SALVAGEABLE"
      else
        echo "$SM_OVERALL_NOOP"
      fi ;;
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
    "$SM_OVERALL_TRUNK_LEAK") echo "$SM_BUCKET_ATTENTION" ;;
    "$SM_OVERALL_SALVAGEABLE") echo "$SM_BUCKET_ATTENTION" ;;
    *) echo "$SM_BUCKET_ATTENTION" ;;
  esac
}

# source_task_config
# Sources project-specific config, then sets defaults for any unset variables.
# Reads: REPO_ROOT, SCRIPT_DIR (from caller scope)
# Sets: WORKTREE_PREFIX, REPO_NAME, MAX_BUDGET, RETRY_BUDGET, MAX_RETRIES
source_task_config() {
  if [[ -f "${REPO_ROOT}/.todo-tasks/task-config.sh" ]]; then
    source "${REPO_ROOT}/.todo-tasks/task-config.sh"
  elif [[ -f "${SCRIPT_DIR}/task-config.sh" ]]; then
    source "${SCRIPT_DIR}/task-config.sh"
  fi
  WORKTREE_PREFIX="${WORKTREE_PREFIX:-todotask}"
  REPO_NAME="$(basename "${REPO_ROOT}")"
  MAX_BUDGET="${MAX_BUDGET:-5.00}"
  RETRY_BUDGET="${RETRY_BUDGET:-3.00}"
  MAX_RETRIES="${MAX_RETRIES:-4}"
  MAX_TURNS="${MAX_TURNS:-100}"
}

# summarize_uncommitted <dir>
# Echoes "N files, M lines" if the worktree has uncommitted changes (tracked
# modifications AND untracked files), or "none" when clean. Read-only: any
# intent-to-add markers used to count untracked lines are reset before return.
summarize_uncommitted() {
  local dir="$1"
  local porcelain; porcelain=$(git -C "$dir" status --porcelain 2>/dev/null || true)
  [[ -z "$porcelain" ]] && { echo "none"; return; }
  local files; files=$(echo "$porcelain" | grep -c . || echo 0)
  git -C "$dir" add -A --intent-to-add >/dev/null 2>&1 || true
  local lines; lines=$(git -C "$dir" diff --numstat 2>/dev/null | awk '{a+=$1+$2} END{print a+0}')
  git -C "$dir" reset -q >/dev/null 2>&1 || true
  echo "${files} files, ${lines} lines"
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

# surface_deviation_state <deviations-section-body>
# Classifies the extracted "## Surface Deviations" section body. The agent is told
# to write "None." when nothing deviated, but frequently appends an explanation
# ("None. The plan had no declared Surface block."), so the decision keys on the
# leading "None" word, not whole-body equality. A non-None first line ⇒ declared.
surface_deviation_state() {
  local body="$1" first
  first=$(printf '%s\n' "$body" | sed '/^[[:space:]]*$/d' | head -n1 \
            | sed 's/^[[:space:]]*//;s/[[:space:]]*$//')
  if [[ -z "$first" || "$first" =~ ^[Nn]one([[:punct:][:space:]].*)?$ ]]; then
    echo "none"
  else
    echo "declared"
  fi
}

# ─── Run-record (the only ephemeral state; gitignored) ─────────────────────
# A run-record supplies liveness (PID) and failure location (worktree path).
# Lives at .todo-tasks/.running/{slug}.run (task) or chain-{slug}.run (chain).
# Single writer: the orchestrator. Readers: the reporter. Never merged.

# run_record_path <slug> [kind]
# Echoes the run-record path for a task (default) or chain (kind="chain").
run_record_path() {
  local slug="$1" kind="${2:-task}"
  if [[ "$kind" == "chain" ]]; then
    echo "${REPO_ROOT}/.todo-tasks/.running/chain-${slug}.run"
  else
    echo "${REPO_ROOT}/.todo-tasks/.running/${slug}.run"
  fi
}

# write_run_record <slug> <worktree> <branch> <pid> [kind]
# Writes the run-record. Fields: slug, worktree, branch, pid, start, kind.
# Callers may append extra fields (e.g. phases:, waiting_for:) afterward.
write_run_record() {
  local slug="$1" worktree="$2" branch="$3" pid="$4" kind="${5:-task}"
  local path; path="$(run_record_path "$slug" "$kind")"
  mkdir -p "$(dirname "$path")"
  cat > "$path" << RUN_EOF
slug: ${slug}
worktree: ${worktree}
branch: ${branch}
pid: ${pid}
start: $(date -Iseconds)
kind: ${kind}
RUN_EOF
}

# read_run_field <run_file> <key>
# Extracts a field value from a run-record, preserving case (paths are
# case-sensitive — unlike parse_result_field, which lowercases).
read_run_field() {
  local file="$1" key="$2"
  grep -m1 "^${key}:" "$file" 2>/dev/null | sed "s/^[^:]*: *//" || true
}

# clear_run_record <slug> [kind]
# Removes the run-record. Idempotent.
clear_run_record() {
  local slug="$1" kind="${2:-task}"
  rm -f "$(run_record_path "$slug" "$kind")"
}

# run_is_alive <run_file>
# True if the run-record names a PID that is still running.
run_is_alive() {
  local file="$1" pid
  pid=$(read_run_field "$file" pid)
  [[ -n "$pid" ]] && kill -0 "$pid" 2>/dev/null
}

# ─── Result writers (split by epistemic owner) ─────────────────────────────

# write_agent_result <result_path> <slug> <session> <verification>
#   <commits_count> <commits_log> <branch> <session_id> <claude_result>
#   <build_test_tail> [error_detail] [surface_deviations] [turns] [cost] [uncommitted]
# Worktree-owned outcome. Written by the orchestrator while cd'd in the
# worktree, committed on the agent branch, carried to trunk by the merge.
# Contains ONLY facts the worktree knows in isolation — no merge/trunk fields.
write_agent_result() {
  local result_path="$1" slug="$2" session="$3" verification="$4"
  local commits_count="$5" commits_log="$6" branch="$7" session_id="$8"
  local claude_result="$9" build_test_tail="${10}"
  local error_detail="${11:-}" surface_deviations="${12:-none}"
  local turns="${13:-}" cost="${14:-}" uncommitted="${15:-none}"

  local valid_sessions="$SM_SESSION_COMPLETED $SM_SESSION_FAILED"
  local valid_verifications="$SM_VERIFY_PASSED $SM_VERIFY_FAILED $SM_VERIFY_SKIPPED"
  if [[ " $valid_sessions " != *" $session "* ]]; then
    echo "WARNING: write_agent_result: unknown session value: '$session'" >&2
  fi
  if [[ " $valid_verifications " != *" $verification "* ]]; then
    echo "WARNING: write_agent_result: unknown verification value: '$verification'" >&2
  fi

  cat > "$result_path" << RESULT_EOF
# Agent Result: ${slug}

date: $(date -Iseconds)
session: ${session}
verification: ${verification}
commits: ${commits_count}
branch: ${branch}
surface deviations: ${surface_deviations}
$(if [[ -n "$turns" ]]; then echo "turns: ${turns}"; fi)
$(if [[ -n "$cost" ]]; then echo "cost: ${cost}"; fi)
uncommitted: ${uncommitted}
$(if [[ -n "$session_id" ]]; then echo "session id: ${session_id}"; fi)
$(if [[ -n "$error_detail" ]]; then echo "error: ${error_detail}"; fi)

## Summary

${claude_result}

## Commits

\`\`\`
${commits_log}
\`\`\`

## Build & Test Output (last 30 lines)

\`\`\`
${build_test_tail}
\`\`\`
RESULT_EOF
}

# write_merge_result <result_path> <slug> <merge> [trunk] [conflict_detail]
# Trunk-owned outcome. Written by the orchestrator on trunk after the merge.
# Contains ONLY facts trunk knows after the merge.
write_merge_result() {
  local result_path="$1" slug="$2" merge="$3"
  local trunk="${4:-$SM_TRUNK_UNCHANGED}" conflict_detail="${5:-}"

  local valid_merges="$SM_MERGE_CLEAN $SM_MERGE_DIRTY $SM_MERGE_CONFLICT $SM_MERGE_SKIPPED_FLAG $SM_MERGE_SKIPPED_VERIFY $SM_MERGE_NOT_ATTEMPTED"
  local valid_trunks="$SM_TRUNK_UNCHANGED $SM_TRUNK_MOVED"
  if [[ " $valid_merges " != *" $merge "* ]]; then
    echo "WARNING: write_merge_result: unknown merge value: '$merge'" >&2
  fi
  if [[ " $valid_trunks " != *" $trunk "* ]]; then
    echo "WARNING: write_merge_result: unknown trunk value: '$trunk'" >&2
  fi

  {
    echo "# Merge Result: ${slug}"
    echo ""
    echo "date: $(date -Iseconds)"
    echo "merge: ${merge}"
    echo "trunk: ${trunk}"
    if [[ -n "$conflict_detail" ]]; then
      echo ""
      echo "## Conflict Detail"
      echo ""
      echo "$conflict_detail"
    fi
  } > "$result_path"
}

# classify_task <agent_md> <merge_md>
# The single home for task classification. Reads session/verification/uncommitted from
# the agent result and merge/trunk from the merge result, then echoes the
# derived overall state. A missing/empty merge_md ⇒ merge=not_attempted.
classify_task() {
  local agent_md="${1:-}" merge_md="${2:-}"
  local session="" verification="" merge="" trunk="" uncommitted=""

  if [[ -n "$agent_md" && -f "$agent_md" ]]; then
    session=$(parse_result_field "$agent_md" session)
    verification=$(parse_result_field "$agent_md" verification)
    uncommitted=$(parse_result_field "$agent_md" uncommitted)
  fi
  session="${session:-$SM_SESSION_FAILED}"
  verification="${verification:-$SM_VERIFY_FAILED}"

  if [[ -n "$merge_md" && -f "$merge_md" ]]; then
    merge=$(parse_result_field "$merge_md" merge)
    trunk=$(parse_result_field "$merge_md" trunk)
  fi
  merge="${merge:-$SM_MERGE_NOT_ATTEMPTED}"
  trunk="${trunk:-$SM_TRUNK_UNCHANGED}"
  uncommitted="${uncommitted:-none}"

  derive_overall_state "$session" "$verification" "$merge" "$trunk" "$uncommitted"
}
