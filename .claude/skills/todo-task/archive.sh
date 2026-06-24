#!/usr/bin/env bash
set -uo pipefail

# ─── Archive ─────────────────────────────────────────────────────────────────
# The ONLY component that moves files, and it does so with `git rm`: the tracked
# active files leave main's working tree while a physical copy lands in the
# gitignored .archived/. Serial, single-writer, conflict-free.
#
# Usage:
#   archive.sh                 archive every auto-eligible outcome
#   archive.sh <slug> [...]    archive specific task slug(s)
#   archive.sh --force-failed  also archive failures (build/session/no-op/leak)
#
# Auto-eligibility (per outcome):
#   success                              → yes
#   chain complete                       → yes (definition + member files)
#   ready_for_review (--no-merge)        → no (awaiting human merge)
#   merge_conflict / merged_with_markers → no (keep worktree for resolution)
#   build_failure/session_failed/no_op/  → no; only with --force-failed
#     trunk_leak / chain failed

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(git rev-parse --show-toplevel)"
TODO="${REPO_ROOT}/.todo-tasks"
source "${SCRIPT_DIR}/lib.sh"

TS="$(date +%Y%m%d)"
FORCE_FAILED=false
SLUGS=()
for arg in "$@"; do
  case "$arg" in
    --force-failed) FORCE_FAILED=true ;;
    -*) echo "Unknown option: $arg"; exit 1 ;;
    *) SLUGS+=("$arg") ;;
  esac
done

# force_eligible <overall> — failures that --force-failed will archive.
# Note: SM_OVERALL_SALVAGEABLE is intentionally absent — never auto-rm a worktree
# that holds recoverable uncommitted work. Resolve it by hand.
force_eligible() {
  case "$1" in
    "$SM_OVERALL_BUILD_FAIL"|"$SM_OVERALL_SESSION_FAIL"|"$SM_OVERALL_NOOP"|"$SM_OVERALL_TRUNK_LEAK") return 0 ;;
    *) return 1 ;;
  esac
}

# archive_one <slug>
archive_one() {
  local slug="$1"
  mkdir -p "${TODO}/.archived"

  local run="${TODO}/.running/${slug}.run" wt="" br=""
  if [[ -f "$run" ]]; then
    wt="$(read_run_field "$run" worktree)"
    br="$(read_run_field "$run" branch)"
  fi

  # Copy tracked trunk files to the gitignored archive.
  [[ -f "${TODO}/tasks/${slug}.md" ]]           && cp "${TODO}/tasks/${slug}.md"           "${TODO}/.archived/${TS}-${slug}.md"
  [[ -f "${TODO}/results/${slug}.agent.md" ]]   && cp "${TODO}/results/${slug}.agent.md"   "${TODO}/.archived/${TS}-${slug}.agent.md"
  [[ -f "${TODO}/results/${slug}.merge.md" ]]   && cp "${TODO}/results/${slug}.merge.md"   "${TODO}/.archived/${TS}-${slug}.merge.md"
  # Capture a stranded agent.md that never reached trunk (lives in the worktree).
  if [[ ! -f "${TODO}/results/${slug}.agent.md" && -n "$wt" && -f "${wt}/.todo-tasks/results/${slug}.agent.md" ]]; then
    cp "${wt}/.todo-tasks/results/${slug}.agent.md" "${TODO}/.archived/${TS}-${slug}.agent.md"
  fi

  git -C "$REPO_ROOT" rm -q --ignore-unmatch \
    ".todo-tasks/tasks/${slug}.md" \
    ".todo-tasks/results/${slug}.agent.md" \
    ".todo-tasks/results/${slug}.merge.md" >/dev/null 2>&1 || true
  if ! git -C "$REPO_ROOT" diff --cached --quiet; then
    git -C "$REPO_ROOT" commit -q -m "todotask: archive ${slug}" >/dev/null 2>&1 || true
  fi

  clear_run_record "$slug"
  [[ -n "$wt" && -d "$wt" ]] && git worktree remove --force "$wt" 2>/dev/null || true
  [[ -n "$br" ]] && git branch -D "$br" 2>/dev/null || true

  echo "- Archived ${slug}"
}

# archive_chain <name> — archive a completed chain's definition.
archive_chain() {
  local name="$1"
  mkdir -p "${TODO}/.archived"
  [[ -f "${TODO}/chains/${name}.md" ]] && cp "${TODO}/chains/${name}.md" "${TODO}/.archived/${TS}-chain-${name}.md"
  git -C "$REPO_ROOT" rm -q --ignore-unmatch ".todo-tasks/chains/${name}.md" >/dev/null 2>&1 || true
  if ! git -C "$REPO_ROOT" diff --cached --quiet; then
    git -C "$REPO_ROOT" commit -q -m "todotask: archive chain ${name}" >/dev/null 2>&1 || true
  fi
  echo "- Archived chain ${name}"
}

archived=0

if [[ ${#SLUGS[@]} -gt 0 ]]; then
  # Explicit slug(s).
  for slug in "${SLUGS[@]}"; do
    rec="$(bash "${SCRIPT_DIR}/report.sh" task | awk -F'\t' -v s="$slug" '$2==s{print $3"\t"$4}')"
    if [[ -z "$rec" ]]; then
      echo "- Skipped ${slug} (no such task)"; continue
    fi
    phase="$(echo "$rec" | cut -f1)"; overall="$(echo "$rec" | cut -f2)"
    if [[ "$phase" == "running" ]]; then
      echo "- Skipped ${slug} (still running)"; continue
    fi
    if [[ "$overall" == "$SM_OVERALL_SUCCESS" ]] || { [[ "$FORCE_FAILED" == "true" ]] && force_eligible "$overall"; }; then
      archive_one "$slug"; archived=$((archived+1))
    else
      echo "- Skipped ${slug} (${overall}) — pass --force-failed to archive failures, or merge/resolve manually"
    fi
  done
else
  # Sweep: every auto-eligible outcome.
  while IFS=$'\t' read -r _ slug phase overall _bucket _commits _wt _br _age _notes; do
    [[ "$phase" == "done" || "$phase" == "crashed" ]] || continue
    if [[ "$overall" == "$SM_OVERALL_SUCCESS" ]] || { [[ "$FORCE_FAILED" == "true" ]] && force_eligible "$overall"; }; then
      archive_one "$slug"; archived=$((archived+1))
    fi
  done < <(bash "${SCRIPT_DIR}/report.sh" task)

  # Completed chains: archive the definition (members archived above as success).
  while IFS=$'\t' read -r _ name cstatus _rest; do
    [[ "$cstatus" == "complete" ]] && { archive_chain "$name"; archived=$((archived+1)); }
  done < <(bash "${SCRIPT_DIR}/report.sh" chain)
fi

[[ $archived -eq 0 ]] && echo "- Nothing to archive."
