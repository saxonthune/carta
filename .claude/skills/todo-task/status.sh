#!/usr/bin/env bash
set -uo pipefail

# ─── Agent Status Check ─────────────────────────────────────────────────────
# Comprehensive status report for all agents and plans.
# This script provides ALL information needed — no follow-up commands required.
#
# Usage: status.sh [--archive-success]
#   --archive-success: move successful .done/ results to .archived/ after displaying

REPO_ROOT="$(git rev-parse --show-toplevel)"
TODO="${REPO_ROOT}/.todo-tasks"
ARCHIVE_SUCCESS_ONLY=false

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${SCRIPT_DIR}/lib.sh"
source_task_config

for arg in "$@"; do
  case "$arg" in
    --archive-success) ARCHIVE_SUCCESS_ONLY=true ;;
    *) echo "Unknown option: $arg"; exit 1 ;;
  esac
done

# ─── Completed Agents ───────────────────────────────────────────────────────

DONE_RESULTS=()
while IFS= read -r f; do
  DONE_RESULTS+=("$f")
done < <(ls "${TODO}/.done/"*.result.md 2>/dev/null || true)

HAS_DONE=false
HAS_ATTENTION=false

declare -a BUCKET_SUCCESS=()
declare -a BUCKET_READY=()
declare -a BUCKET_QUESTIONABLE=()
declare -a BUCKET_ATTENTION=()

for result in "${DONE_RESULTS[@]}"; do
  [[ -z "$result" ]] && continue
  HAS_DONE=true
  slug=$(basename "$result" .result.md)

  # Try new format
  session=$(parse_result_field "$result" "session")
  if [[ -n "$session" ]]; then
    verification=$(parse_result_field "$result" "verification")
    merge=$(parse_result_field "$result" "merge")
    commits=$(parse_result_field "$result" "commits")
    overall=$(derive_overall_state "$session" "$verification" "$merge")
    bucket=$(state_bucket "$overall")
  else
    # Old format fallback
    old_status=$(parse_result_field "$result" "status")
    old_merge=$(parse_result_field "$result" "merge")
    commits=$(parse_result_field "$result" "commits")
    if [[ "$old_status" == "success" && "$old_merge" == "success" ]]; then
      overall="$SM_OVERALL_SUCCESS"; bucket="$SM_BUCKET_SUCCESS"
    elif [[ "$old_status" == "success" && "$old_merge" == "conflict" ]]; then
      overall="$SM_OVERALL_CONFLICT"; bucket="$SM_BUCKET_ATTENTION"
    elif [[ "$old_status" == "success" ]]; then
      overall="$SM_OVERALL_SUCCESS"; bucket="$SM_BUCKET_SUCCESS"
    else
      overall="$SM_OVERALL_BUILD_FAIL"; bucket="$SM_BUCKET_ATTENTION"
    fi
  fi

  retried=$(parse_result_field "$result" "retried")
  error=$(parse_result_field "$result" "error")
  notes=""
  [[ -n "$retried" && "$retried" != "false" && "$retried" != "0" ]] && notes="Retried. "

  wt_path="${REPO_ROOT}/../${WORKTREE_PREFIX}-${slug}"
  [[ -d "$wt_path" ]] && notes="${notes}[worktree exists] "

  # Add error context for non-success buckets
  if [[ "$bucket" != "$SM_BUCKET_SUCCESS" ]]; then
    if [[ -n "$error" ]]; then
      notes="${notes}${error}"
    elif [[ "$overall" == "$SM_OVERALL_NOOP" ]]; then
      notes="${notes}Agent produced 0 commits."
    elif [[ "$overall" == "$SM_OVERALL_DIRTY" ]]; then
      notes="${notes}Conflict markers in committed files!"
    elif [[ "$overall" == "$SM_OVERALL_CONFLICT" ]]; then
      notes="${notes}Merge conflict. Branch left intact."
    elif [[ "$overall" == "$SM_OVERALL_SESSION_FAIL" ]]; then
      notes="${notes}Session crashed. Check result file."
    else
      notes="${notes}Check result file."
    fi
  fi
  [[ -z "$notes" ]] && notes="Clean run."

  # Build the row: slug|overall|commits|notes
  ROW="${slug}|${overall}|${commits:-0}|${notes}"

  case "$bucket" in
    "$SM_BUCKET_SUCCESS")     BUCKET_SUCCESS+=("$ROW") ;;
    "$SM_BUCKET_READY")       BUCKET_READY+=("$ROW") ;;
    "$SM_BUCKET_QUESTIONABLE") BUCKET_QUESTIONABLE+=("$ROW") ;;
    "$SM_BUCKET_ATTENTION")   BUCKET_ATTENTION+=("$ROW") ;;
  esac
done

for f in "${TODO}/.done/"*.md; do
  [[ -f "$f" ]] || continue
  [[ "$f" == *.result.md ]] && continue
  slug=$(basename "$f" .md)
  [[ -f "${TODO}/.done/${slug}.result.md" ]] && continue
  HAS_DONE=true
  HAS_ATTENTION=true
  BUCKET_ATTENTION+=("${slug}|silent-failure|?|Silent failure — no .result.md written. Check worktree/branch.")
done

[[ ${#BUCKET_ATTENTION[@]} -gt 0 || ${#BUCKET_QUESTIONABLE[@]} -gt 0 ]] && HAS_ATTENTION=true

render_bucket() {
  local title="$1"
  local -n rows="$2"
  [[ ${#rows[@]} -eq 0 ]] && return
  echo "### ${title}"
  echo ""
  echo "| Agent | State | Commits | Notes |"
  echo "|-------|-------|---------|-------|"
  for row in "${rows[@]}"; do
    IFS='|' read -r slug overall commits notes <<< "$row"
    echo "| **${slug}** | ${overall} | ${commits} | ${notes} |"
  done
  echo ""
}

if [[ "$HAS_DONE" == "true" ]]; then
  echo "## Completed Agents"
  echo ""
  render_bucket "Needs Attention" BUCKET_ATTENTION
  render_bucket "Questionable" BUCKET_QUESTIONABLE
  render_bucket "Ready for Review" BUCKET_READY
  render_bucket "Success" BUCKET_SUCCESS
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
    chain=$(parse_result_field "$manifest" "chain")
    phases=$(parse_result_field "$manifest" "phases")
    current=$(parse_result_field "$manifest" "current")
    completed=$(parse_result_field "$manifest" "completed")
    cstatus=$(parse_result_field "$manifest" "status")
    failed=$(parse_result_field "$manifest" "failed_phase")
    chain_branch=$(parse_result_field "$manifest" "chain_branch")

    total=$(echo "$phases" | tr ',' '\n' | grep -c '.' || echo "0")
    done_count=0
    if [[ -n "$completed" ]]; then
      done_count=$(echo "$completed" | tr ',' '\n' | grep -c '.' || echo "0")
    fi

    if [[ "$cstatus" == "complete" ]]; then
      echo "| **${chain}** | COMPLETE | ${total}/${total} | — | ${phases} |"
    elif [[ "$cstatus" == "merging" ]]; then
      echo "| **${chain}** | MERGING | ${done_count}/${total} | merging to trunk | ${phases} |"
    elif [[ "$cstatus" == "failed" ]]; then
      echo "| **${chain}** | FAILED | ${done_count}/${total} | ${failed} | ${phases} |"
      HAS_ATTENTION=true
    else
      echo "| **${chain}** | RUNNING | ${done_count}/${total} | ${current} | ${phases} |"
    fi

    # Show chain branch info if available
    if [[ -n "$chain_branch" && "$chain_branch" != "none" ]]; then
      chain_worktree=$(parse_result_field "$manifest" "chain_worktree")
      if [[ -d "$chain_worktree" ]]; then
        local_commits=$(cd "$chain_worktree" 2>/dev/null && git log --oneline "$(git merge-base HEAD "${chain_branch}" 2>/dev/null || echo HEAD)..HEAD" 2>/dev/null | wc -l || echo "?")
        echo ""
        echo "  Chain worktree: \`${chain_worktree}\` (branch: \`${chain_branch}\`)"
      fi
    fi

    CHAIN_CLAIMED="${CHAIN_CLAIMED},${phases},"
  done
  echo ""

  for manifest in "${CHAIN_MANIFESTS[@]}"; do
    cstatus=$(parse_result_field "$manifest" "status")
    if [[ "$cstatus" == "running" ]]; then
      chain=$(parse_result_field "$manifest" "chain")
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

STALE_WTS=()
while IFS= read -r wt_line; do
  wt_path=$(echo "$wt_line" | awk '{print $1}')
  wt_dir=$(basename "$wt_path")
  if [[ "$wt_dir" == ${WORKTREE_PREFIX}-* ]]; then
    slug="${wt_dir#${WORKTREE_PREFIX}-}"

    # Skip chain worktrees that are actively managed
    if [[ "$slug" == chain-* ]]; then
      chain_name="${slug#chain-}"
      if [[ -f "${TODO}/.running/chain-${chain_name}.manifest" ]]; then
        manifest_status=$(parse_result_field "${TODO}/.running/chain-${chain_name}.manifest" "status")
        if [[ "$manifest_status" == "running" || "$manifest_status" == "merging" ]]; then
          continue  # active chain, not stale
        fi
      fi
      STALE_WTS+=("${slug} (chain worktree)")
      continue
    fi

    if [[ -f "${TODO}/.done/${slug}.result.md" ]] || ls "${TODO}/.archived/"*"-${slug}.result.md" 2>/dev/null | grep -q .; then
      status="done"
      if [[ -f "${TODO}/.done/${slug}.result.md" ]]; then
        stale_result_file="${TODO}/.done/${slug}.result.md"
        stale_session=$(parse_result_field "$stale_result_file" "session")
        if [[ -n "$stale_session" ]]; then
          stale_verify=$(parse_result_field "$stale_result_file" "verification")
          stale_merge=$(parse_result_field "$stale_result_file" "merge")
          status=$(derive_overall_state "$stale_session" "$stale_verify" "$stale_merge")
        else
          status=$(parse_result_field "$stale_result_file" "status")
        fi
      fi
      STALE_WTS+=("${slug} (${status})")
    elif [[ ! -f "${TODO}/.running/${slug}.md" ]]; then
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

    for task_file in "${TODO}/${epic_slug}"-[0-9]*.md "${TODO}/.running/${epic_slug}"-[0-9]*.md "${TODO}/.done/${epic_slug}"-[0-9]*.md; do
      [[ -f "$task_file" ]] || continue
      task_slug=$(basename "$task_file" .md)
      task_title=$(head -1 "$task_file" | sed 's/^#* //')

      if [[ -f "${TODO}/.done/${task_slug}.result.md" ]]; then
        epic_result_file="${TODO}/.done/${task_slug}.result.md"
        epic_result_session=$(parse_result_field "$epic_result_file" "session")
        if [[ -n "$epic_result_session" ]]; then
          epic_result_verify=$(parse_result_field "$epic_result_file" "verification")
          epic_result_merge=$(parse_result_field "$epic_result_file" "merge")
          epic_overall=$(derive_overall_state "$epic_result_session" "$epic_result_verify" "$epic_result_merge")
          epic_bucket=$(state_bucket "$epic_overall")
          if [[ "$epic_bucket" == "$SM_BUCKET_SUCCESS" || "$epic_bucket" == "$SM_BUCKET_READY" ]]; then
            echo "| ${task_slug} | DONE | ${task_title} |"
          else
            echo "| ${task_slug} | FAILED | ${task_title} |"
          fi
        else
          result_status=$(parse_result_field "$epic_result_file" "status")
          if [[ "$result_status" == "success" ]]; then
            echo "| ${task_slug} | DONE | ${task_title} |"
          else
            echo "| ${task_slug} | FAILED | ${task_title} |"
          fi
        fi
      elif [[ -f "${TODO}/.running/${task_slug}.md" ]]; then
        echo "| ${task_slug} | RUNNING | ${task_title} |"
      elif [[ -f "${TODO}/${task_slug}.md" ]]; then
        echo "| ${task_slug} | PENDING | ${task_title} |"
      fi
    done

    for archived_result in "${TODO}/.archived/"*"-${epic_slug}"-[0-9]*.result.md; do
      [[ -f "$archived_result" ]] || continue
      archived_base=$(basename "$archived_result" .result.md)
      task_slug="${archived_base#[0-9]*-}"
      [[ -f "${TODO}/.done/${task_slug}.result.md" ]] && continue
      arch_session=$(parse_result_field "$archived_result" "session")
      if [[ -n "$arch_session" ]]; then
        arch_verify=$(parse_result_field "$archived_result" "verification")
        arch_merge=$(parse_result_field "$archived_result" "merge")
        arch_overall=$(derive_overall_state "$arch_session" "$arch_verify" "$arch_merge")
        arch_bucket=$(state_bucket "$arch_overall")
        if [[ "$arch_bucket" == "$SM_BUCKET_SUCCESS" || "$arch_bucket" == "$SM_BUCKET_READY" ]]; then
          echo "| ${task_slug} | ARCHIVED | Done |"
        else
          echo "| ${task_slug} | ARCHIVED (failed) | Needs review |"
        fi
      else
        result_status=$(parse_result_field "$archived_result" "status")
        if [[ "$result_status" == "success" ]]; then
          echo "| ${task_slug} | ARCHIVED | Done |"
        else
          echo "| ${task_slug} | ARCHIVED (failed) | Needs review |"
        fi
      fi
    done

    echo ""
  done
fi

# ─── Pending Plans ──────────────────────────────────────────────────────────

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
echo "Summary: ${#BUCKET_SUCCESS[@]} success, ${#BUCKET_READY[@]} ready, ${#BUCKET_QUESTIONABLE[@]} questionable, ${#BUCKET_ATTENTION[@]} attention, ${running_n} running, ${chain_n} chains, ${pending_n} pending, ${epic_n} epics, ${stale_n} stale"

if [[ "$HAS_ATTENTION" == "true" ]]; then
  echo "Attention needed — review completed agents above before proceeding."
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
    # Determine success using new or old format
    archive_session=$(parse_result_field "$result" "session")
    archive_is_success=false
    if [[ -n "$archive_session" ]]; then
      archive_verification=$(parse_result_field "$result" "verification")
      archive_merge=$(parse_result_field "$result" "merge")
      archive_overall=$(derive_overall_state "$archive_session" "$archive_verification" "$archive_merge")
      [[ "$archive_overall" == "$SM_OVERALL_SUCCESS" ]] && archive_is_success=true
    else
      archive_status=$(parse_result_field "$result" "status")
      old_archive_merge=$(parse_result_field "$result" "merge")
      [[ "$archive_status" == "success" && "$old_archive_merge" == "success" ]] && archive_is_success=true
    fi

    if [[ "$archive_is_success" == "true" ]]; then
      [[ -f "${TODO}/.done/${slug}.md" ]] && mv "${TODO}/.done/${slug}.md" "${TODO}/.archived/${ts}-${slug}.md"
      mv "$result" "${TODO}/.archived/${ts}-${slug}.result.md"
      echo "- Archived ${slug}"
      archived=$((archived + 1))
    else
      echo "- Skipped ${slug} (not successful)"
    fi
  done
  if [[ $archived -eq 0 ]]; then
    echo "- Nothing to archive."
  fi
  echo ""
fi

# ─── Archive Stale Chains ────────────────────────────────────────────────────

if [[ "$ARCHIVE_SUCCESS_ONLY" == "true" && ${#CHAIN_MANIFESTS[@]} -gt 0 && -n "${CHAIN_MANIFESTS[0]:-}" ]]; then
  mkdir -p "${TODO}/.archived"
  ts=$(date +%Y%m%d)
  chain_archived=0
  for manifest in "${CHAIN_MANIFESTS[@]}"; do
    chain=$(parse_result_field "$manifest" "chain")
    cstatus=$(parse_result_field "$manifest" "status")

    # Skip active chains
    if [[ "$cstatus" == "running" || "$cstatus" == "merging" ]]; then
      continue
    fi

    should_archive=false

    if [[ "$cstatus" == "complete" ]]; then
      should_archive=true
    elif [[ "$cstatus" == "failed" ]]; then
      chain_branch=$(parse_result_field "$manifest" "chain_branch")
      if [[ -z "$chain_branch" || "$chain_branch" == "none" ]]; then
        should_archive=true
      elif ! git rev-parse --verify "refs/heads/${chain_branch}" &>/dev/null; then
        # Branch doesn't exist — already merged/deleted
        should_archive=true
      elif git merge-base --is-ancestor "${chain_branch}" HEAD 2>/dev/null; then
        # Branch was merged into current branch
        should_archive=true
      fi
      # Otherwise: branch exists and is not merged — skip, needs attention
    fi

    if [[ "$should_archive" == "true" ]]; then
      # Print header before first chain archive
      if [[ $chain_archived -eq 0 ]]; then
        echo ""
        echo "## Archiving Stale Chains"
        echo ""
      fi

      chain_worktree=$(parse_result_field "$manifest" "chain_worktree")
      chain_branch=$(parse_result_field "$manifest" "chain_branch")

      if [[ -n "$chain_worktree" && "$chain_worktree" != "none" && -d "$chain_worktree" ]]; then
        git worktree remove --force "$chain_worktree" 2>/dev/null || true
      fi
      if [[ -n "$chain_branch" && "$chain_branch" != "none" ]] && git rev-parse --verify "refs/heads/${chain_branch}" &>/dev/null; then
        git branch -D "$chain_branch" 2>/dev/null || true
      fi

      mv "$manifest" "${TODO}/.archived/${ts}-chain-${chain}.manifest"

      local_log="${TODO}/.running/chain-${chain}.log"
      if [[ -f "$local_log" ]]; then
        mv "$local_log" "${TODO}/.archived/${ts}-chain-${chain}.log"
      fi

      echo "- Archived chain ${chain}"
      chain_archived=$((chain_archived + 1))
    fi
  done
  if [[ $chain_archived -gt 0 ]]; then
    echo ""
  fi
fi
