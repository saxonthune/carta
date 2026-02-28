#!/usr/bin/env bash
set -uo pipefail

# ─── Agent Status Check ─────────────────────────────────────────────────────
# Comprehensive status report for all agents and plans.
# This script provides ALL information needed — no follow-up commands required.
#
# Usage: status.sh [--archive-success]
#   --archive-success: move successful .done/ results to .archived/ after displaying

REPO_ROOT="$(git rev-parse --show-toplevel)"
TODO="${REPO_ROOT}/todo-tasks"
ARCHIVE_SUCCESS_ONLY=false

for arg in "$@"; do
  case "$arg" in
    --archive-success) ARCHIVE_SUCCESS_ONLY=true ;;
    *) echo "Unknown option: $arg"; exit 1 ;;
  esac
done

# ─── Helper: parse result file ──────────────────────────────────────────────
# Result files use either:
#   - Plain format: "status: success"
#   - Markdown bold format: "**Status**: SUCCESS"
#   - Manifest format: "status: running"
# This function handles all three, case-insensitive key match, returns lowercase value.
parse_result() {
  local file="$1" key="$2"
  local val=""
  # Try plain format first: "key: value"
  val=$(grep -m1 -i "^${key}:" "$file" 2>/dev/null | sed "s/^[^:]*: *//" || true)
  # Try markdown bold format: "**Key**: value"
  if [[ -z "$val" ]]; then
    val=$(grep -m1 -i "^\*\*${key}\*\*:" "$file" 2>/dev/null | sed "s/^[^:]*: *//" || true)
  fi
  # Return lowercase
  echo "${val,,}"
}

# ─── Completed Agents ───────────────────────────────────────────────────────

DONE_RESULTS=()
while IFS= read -r f; do
  DONE_RESULTS+=("$f")
done < <(ls "${TODO}/.done/"*.result.md 2>/dev/null || true)

HAS_DONE=false
HAS_FAILURES=false

if [[ ${#DONE_RESULTS[@]} -gt 0 && -n "${DONE_RESULTS[0]}" ]]; then
  HAS_DONE=true
  echo "## Completed Agents"
  echo ""
  echo "| Agent | Status | Merge | Commits | Notes |"
  echo "|-------|--------|-------|---------|-------|"
  for result in "${DONE_RESULTS[@]}"; do
    slug=$(basename "$result" .result.md)
    status=$(parse_result "$result" "status")
    merge=$(parse_result "$result" "merge")
    commits=$(parse_result "$result" "commits")
    retried=$(parse_result "$result" "retried")
    error=$(parse_result "$result" "error")

    notes=""
    if [[ -n "$retried" && "$retried" != "false" && "$retried" != "0" ]]; then
      notes="Retried. "
    fi
    if [[ "$status" != "success" ]]; then
      HAS_FAILURES=true
      if [[ -n "$error" ]]; then
        notes="${notes}${error}"
      else
        notes="${notes}Check result file."
      fi
    fi

    # Check for lingering worktree
    wt_path="${REPO_ROOT}/../carta-agent-${slug}"
    if [[ -d "$wt_path" ]]; then
      notes="${notes} [worktree exists]"
    fi

    echo "| **${slug}** | ${status} | ${merge} | ${commits:-0} | ${notes:-Clean run.} |"
  done
  echo ""
fi

# ─── Chains ─────────────────────────────────────────────────────────────────

CHAIN_MANIFESTS=()
while IFS= read -r f; do
  CHAIN_MANIFESTS+=("$f")
done < <(ls "${TODO}/.running/"chain-*.manifest 2>/dev/null || true)

CHAIN_CLAIMED=""

if [[ ${#CHAIN_MANIFESTS[@]} -gt 0 && -n "${CHAIN_MANIFESTS[0]}" ]]; then
  echo "## Chains"
  echo ""
  echo "| Chain | Status | Progress | Current/Failed | Phases |"
  echo "|-------|--------|----------|----------------|--------|"
  for manifest in "${CHAIN_MANIFESTS[@]}"; do
    chain=$(parse_result "$manifest" "chain")
    phases=$(parse_result "$manifest" "phases")
    current=$(parse_result "$manifest" "current")
    completed=$(parse_result "$manifest" "completed")
    cstatus=$(parse_result "$manifest" "status")
    failed=$(parse_result "$manifest" "failed_phase")

    total=$(echo "$phases" | tr ',' '\n' | grep -c '.' || echo "0")
    done_count=0
    if [[ -n "$completed" ]]; then
      done_count=$(echo "$completed" | tr ',' '\n' | grep -c '.' || echo "0")
    fi

    if [[ "$cstatus" == "complete" ]]; then
      echo "| **${chain}** | COMPLETE | ${total}/${total} | — | ${phases} |"
    elif [[ "$cstatus" == "failed" ]]; then
      echo "| **${chain}** | FAILED | ${done_count}/${total} | ${failed} | ${phases} |"
      HAS_FAILURES=true
    else
      echo "| **${chain}** | RUNNING | ${done_count}/${total} | ${current} | ${phases} |"
    fi

    CHAIN_CLAIMED="${CHAIN_CLAIMED},${phases},"
  done
  echo ""

  # Show recent log output for running chains
  for manifest in "${CHAIN_MANIFESTS[@]}"; do
    cstatus=$(parse_result "$manifest" "status")
    if [[ "$cstatus" == "running" ]]; then
      chain=$(parse_result "$manifest" "chain")
      log="${TODO}/.running/chain-${chain}.log"
      if [[ -f "$log" ]]; then
        echo "### Chain log: ${chain} (last 10 lines)"
        echo '```'
        tail -10 "$log"
        echo '```'
        echo ""
      fi
    fi
  done
fi

# ─── Running Agents (non-chain) ────────────────────────────────────────────

RUNNING_MDS=()
while IFS= read -r f; do
  RUNNING_MDS+=("$f")
done < <(ls "${TODO}/.running/"*.md 2>/dev/null || true)

if [[ ${#RUNNING_MDS[@]} -gt 0 && -n "${RUNNING_MDS[0]}" ]]; then
  echo "## Running Agents"
  echo ""
  for plan in "${RUNNING_MDS[@]}"; do
    slug=$(basename "$plan" .md)
    # Skip result files
    [[ "$slug" == *.result ]] && continue
    log="${TODO}/.running/${slug}.log"
    echo "### ${slug}"
    if [[ -f "$log" ]]; then
      echo "Last 10 lines of log:"
      echo '```'
      tail -10 "$log"
      echo '```'
    else
      echo "(no log file)"
    fi
    echo ""
  done
fi

# ─── Stale Worktrees ───────────────────────────────────────────────────────
# Worktrees that exist for agents already in .done/ or .archived/

STALE_WTS=()
while IFS= read -r wt_line; do
  wt_path=$(echo "$wt_line" | awk '{print $1}')
  wt_dir=$(basename "$wt_path")
  if [[ "$wt_dir" == carta-agent-* ]]; then
    slug="${wt_dir#carta-agent-}"
    # Check if this agent is done or archived (not running)
    if [[ -f "${TODO}/.done/${slug}.result.md" ]] || ls "${TODO}/.archived/"*"-${slug}.result.md" 2>/dev/null | grep -q .; then
      status="done"
      if [[ -f "${TODO}/.done/${slug}.result.md" ]]; then
        status=$(parse_result "${TODO}/.done/${slug}.result.md" "status")
      fi
      STALE_WTS+=("${slug} (${status})")
    elif [[ ! -f "${TODO}/.running/${slug}.md" ]]; then
      # Not running, not done — orphaned
      STALE_WTS+=("${slug} (orphaned)")
    fi
  fi
done < <(git worktree list 2>/dev/null)

if [[ ${#STALE_WTS[@]} -gt 0 ]]; then
  echo "## Stale Worktrees"
  echo ""
  echo "These worktrees exist for agents that are no longer running:"
  for wt in "${STALE_WTS[@]}"; do
    echo "- ${wt}"
  done
  echo ""
fi

# ─── Epics ─────────────────────────────────────────────────────────────────
# Epic files (*.epic.md) are NOT groomable plans — they're initiative overviews.
# Show each epic with auto-computed phase statuses.

EPIC_FILES=()
while IFS= read -r f; do
  EPIC_FILES+=("$f")
done < <(ls "${TODO}/"*.epic.md 2>/dev/null || true)

if [[ ${#EPIC_FILES[@]} -gt 0 && -n "${EPIC_FILES[0]}" ]]; then
  echo "## Epics"
  echo ""
  for epic_file in "${EPIC_FILES[@]}"; do
    epic_slug=$(basename "$epic_file" .epic.md)
    epic_title=$(head -1 "$epic_file" | sed 's/^#* //')
    echo "### ${epic_title}"
    echo ""
    echo "| Phase | Status | Notes |"
    echo "|-------|--------|-------|"

    # Find all task files for this epic across all directories
    for task_file in "${TODO}/${epic_slug}"-[0-9]*.md "${TODO}/.running/${epic_slug}"-[0-9]*.md "${TODO}/.done/${epic_slug}"-[0-9]*.md; do
      [[ -f "$task_file" ]] || continue
      task_slug=$(basename "$task_file" .md)
      task_title=$(head -1 "$task_file" | sed 's/^#* //')

      # Determine status by location
      if [[ -f "${TODO}/.done/${task_slug}.result.md" ]]; then
        result_status=$(parse_result "${TODO}/.done/${task_slug}.result.md" "status")
        if [[ "$result_status" == "success" ]]; then
          echo "| ${task_slug} | DONE | ${task_title} |"
        else
          echo "| ${task_slug} | FAILED | ${task_title} |"
        fi
      elif [[ -f "${TODO}/.running/${task_slug}.md" ]]; then
        echo "| ${task_slug} | RUNNING | ${task_title} |"
      elif [[ -f "${TODO}/${task_slug}.md" ]]; then
        echo "| ${task_slug} | PENDING | ${task_title} |"
      fi
    done

    # Also check archived results
    for archived_result in "${TODO}/.archived/"*"-${epic_slug}"-[0-9]*.result.md; do
      [[ -f "$archived_result" ]] || continue
      # Extract the task slug (strip date prefix and .result.md suffix)
      archived_base=$(basename "$archived_result" .result.md)
      task_slug="${archived_base#[0-9]*-}"
      # Skip if already shown from .done/
      [[ -f "${TODO}/.done/${task_slug}.result.md" ]] && continue
      result_status=$(parse_result "$archived_result" "status")
      if [[ "$result_status" == "success" ]]; then
        echo "| ${task_slug} | ARCHIVED | Done |"
      else
        echo "| ${task_slug} | ARCHIVED (failed) | Needs review |"
      fi
    done

    echo ""
  done
fi

# ─── Pending Plans ──────────────────────────────────────────────────────────
# Exclude *.epic.md — those are shown in the Epics section above.

PENDING_MDS=()
while IFS= read -r f; do
  [[ "$f" == *.epic.md ]] && continue
  PENDING_MDS+=("$f")
done < <(ls "${TODO}/"*.md 2>/dev/null || true)

if [[ ${#PENDING_MDS[@]} -gt 0 && -n "${PENDING_MDS[0]}" ]]; then
  echo "## Pending Plans"
  echo ""
  for plan in "${PENDING_MDS[@]}"; do
    slug=$(basename "$plan" .md)
    title=$(head -1 "$plan" | sed 's/^#* //')
    if [[ "$CHAIN_CLAIMED" == *",${slug},"* ]]; then
      echo "- **${slug}** — ${title} [claimed by chain]"
    else
      echo "- **${slug}** — ${title}"
    fi
  done
  echo ""
fi

# ─── Summary Line ──────────────────────────────────────────────────────────

done_n=${#DONE_RESULTS[@]}
[[ -z "${DONE_RESULTS[0]:-}" ]] && done_n=0
running_n=${#RUNNING_MDS[@]}
[[ -z "${RUNNING_MDS[0]:-}" ]] && running_n=0
pending_n=${#PENDING_MDS[@]}
[[ -z "${PENDING_MDS[0]:-}" ]] && pending_n=0
chain_n=${#CHAIN_MANIFESTS[@]}
[[ -z "${CHAIN_MANIFESTS[0]:-}" ]] && chain_n=0
epic_n=${#EPIC_FILES[@]}
[[ -z "${EPIC_FILES[0]:-}" ]] && epic_n=0
stale_n=${#STALE_WTS[@]}

echo "---"
echo "Summary: ${done_n} completed, ${running_n} running, ${chain_n} chains, ${pending_n} pending, ${epic_n} epics, ${stale_n} stale worktrees"

if [[ "$HAS_FAILURES" == "true" ]]; then
  echo "⚠️  Failures detected — triage needed before proceeding."
fi

# ─── Archive ────────────────────────────────────────────────────────────────

if [[ "$ARCHIVE_SUCCESS_ONLY" == "true" && "$HAS_DONE" == "true" ]]; then
  echo ""
  echo "## Archiving Successful Agents"
  echo ""
  mkdir -p "${TODO}/.archived"
  ts=$(date +%Y%m%d)
  archived=0
  for result in "${DONE_RESULTS[@]}"; do
    slug=$(basename "$result" .result.md)
    status=$(parse_result "$result" "status")
    if [[ "$status" == "success" ]]; then
      [[ -f "${TODO}/.done/${slug}.md" ]] && mv "${TODO}/.done/${slug}.md" "${TODO}/.archived/${ts}-${slug}.md"
      mv "$result" "${TODO}/.archived/${ts}-${slug}.result.md"
      echo "- Archived ${slug}"
      ((archived++))
    else
      echo "- Skipped ${slug} (${status})"
    fi
  done
  if [[ $archived -eq 0 ]]; then
    echo "- Nothing to archive."
  fi
  echo ""
fi
