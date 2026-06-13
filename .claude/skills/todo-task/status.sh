#!/usr/bin/env bash
set -uo pipefail

# ─── Agent Status Report ────────────────────────────────────────────────────
# A pure renderer over report.sh. It does NOT walk the filesystem, parse result
# formats, or classify state — the reporter is the single source of truth.
#
# Usage: status.sh [--archive] [--force-failed]
#   --archive       after rendering, run archive.sh (auto-eligible outcomes)
#   --force-failed  passed through to archive.sh (also archive failures)

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${SCRIPT_DIR}/lib.sh"

DO_ARCHIVE=false
ARCHIVE_ARGS=()
for arg in "$@"; do
  case "$arg" in
    --archive|--archive-success) DO_ARCHIVE=true ;;
    --force-failed) DO_ARCHIVE=true; ARCHIVE_ARGS+=(--force-failed) ;;
    *) echo "Unknown option: $arg"; exit 1 ;;
  esac
done

# ─── Collect reporter records once ──────────────────────────────────────────

mapfile -t RECORDS < <(bash "${SCRIPT_DIR}/report.sh")

declare -a BUCKET_ATTENTION=() BUCKET_QUESTIONABLE=() BUCKET_READY=() BUCKET_SUCCESS=()
declare -a CRASHED=() RUNNING=() PENDING=() DRAFTS=() CHAINS=() EPICS=() STALE=()

for rec in "${RECORDS[@]}"; do
  IFS=$'\t' read -r type rest <<< "$rec"
  case "$type" in
    task)
      IFS=$'\t' read -r _ slug phase overall bucket commits worktree branch age notes <<< "$rec"
      case "$phase" in
        done)
          row="${slug}|${overall}|${commits}|${notes}"
          case "$bucket" in
            "$SM_BUCKET_ATTENTION")    BUCKET_ATTENTION+=("$row") ;;
            "$SM_BUCKET_QUESTIONABLE") BUCKET_QUESTIONABLE+=("$row") ;;
            "$SM_BUCKET_READY")        BUCKET_READY+=("$row") ;;
            "$SM_BUCKET_SUCCESS")      BUCKET_SUCCESS+=("$row") ;;
          esac ;;
        crashed)  CRASHED+=("${slug}|${overall}|${commits}|${worktree}|${notes}") ;;
        running)  RUNNING+=("${slug}|${worktree}|${branch}") ;;
        pending)  PENDING+=("${slug}") ;;
        draft)    DRAFTS+=("${slug}") ;;
      esac ;;
    chain) IFS=$'\t' read -r _ name cstatus done_n total current phases worktree branch <<< "$rec"
           CHAINS+=("${name}|${cstatus}|${done_n}|${total}|${current}|${phases}|${worktree}|${branch}") ;;
    epic)  IFS=$'\t' read -r _ name total done_n running_n failed_n members <<< "$rec"
           EPICS+=("${name}|${total}|${done_n}|${running_n}|${failed_n}|${members}") ;;
    stale) IFS=$'\t' read -r _ slug worktree <<< "$rec"
           STALE+=("${slug}|${worktree}") ;;
  esac
done

HAS_ATTENTION=false
[[ ${#BUCKET_ATTENTION[@]} -gt 0 || ${#BUCKET_QUESTIONABLE[@]} -gt 0 || ${#CRASHED[@]} -gt 0 ]] && HAS_ATTENTION=true

# ─── Renderers ──────────────────────────────────────────────────────────────

render_bucket() {
  local title="$1"; local -n rows="$2"
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

if [[ ${#BUCKET_ATTENTION[@]} -gt 0 || ${#BUCKET_QUESTIONABLE[@]} -gt 0 || ${#BUCKET_READY[@]} -gt 0 || ${#BUCKET_SUCCESS[@]} -gt 0 ]]; then
  echo "## Completed Agents"
  echo ""
  render_bucket "Needs Attention" BUCKET_ATTENTION
  render_bucket "Questionable" BUCKET_QUESTIONABLE
  render_bucket "Ready for Review" BUCKET_READY
  render_bucket "Success" BUCKET_SUCCESS
fi

if [[ ${#CRASHED[@]} -gt 0 ]]; then
  echo "## Crashed Agents"
  echo ""
  echo "Run-record present but the process died before merging. Result read from the worktree."
  echo ""
  echo "| Agent | State | Commits | Worktree | Notes |"
  echo "|-------|-------|---------|----------|-------|"
  for row in "${CRASHED[@]}"; do
    IFS='|' read -r slug overall commits worktree notes <<< "$row"
    echo "| **${slug}** | ${overall} | ${commits} | \`${worktree}\` | ${notes} |"
  done
  echo ""
fi

if [[ ${#RUNNING[@]} -gt 0 ]]; then
  echo "## Running Agents"
  echo ""
  for row in "${RUNNING[@]}"; do
    IFS='|' read -r slug worktree branch <<< "$row"
    echo "- **${slug}** — branch \`${branch}\`, worktree \`${worktree}\`"
  done
  echo ""
fi

if [[ ${#CHAINS[@]} -gt 0 ]]; then
  echo "## Chains"
  echo ""
  echo "| Chain | Status | Progress | Current/Failed | Phases |"
  echo "|-------|--------|----------|----------------|--------|"
  for row in "${CHAINS[@]}"; do
    IFS='|' read -r name cstatus done_n total current phases worktree branch <<< "$row"
    echo "| **${name}** | ${cstatus} | ${done_n}/${total} | ${current} | ${phases} |"
    [[ "$cstatus" == "failed" ]] && HAS_ATTENTION=true
  done
  echo ""
fi

if [[ ${#EPICS[@]} -gt 0 ]]; then
  echo "## Epics"
  echo ""
  echo "| Epic | Done | Running | Failed | Total | Members |"
  echo "|------|------|---------|--------|-------|---------|"
  for row in "${EPICS[@]}"; do
    IFS='|' read -r name total done_n running_n failed_n members <<< "$row"
    echo "| **${name}** | ${done_n} | ${running_n} | ${failed_n} | ${total} | ${members} |"
    [[ "$failed_n" -gt 0 ]] && HAS_ATTENTION=true
  done
  echo ""
fi

if [[ ${#PENDING[@]} -gt 0 ]]; then
  echo "## Pending Plans"
  echo ""
  for slug in "${PENDING[@]}"; do
    echo "- **${slug}**"
  done
  echo ""
fi

if [[ ${#DRAFTS[@]} -gt 0 ]]; then
  echo "## Drafts (untriaged)"
  echo ""
  echo "Filed ideas in the gitignored inbox. Triage to turn them into executable specs."
  for slug in "${DRAFTS[@]}"; do
    echo "- ${slug}"
  done
  echo ""
fi

if [[ ${#STALE[@]} -gt 0 ]]; then
  echo "## Stale Worktrees"
  echo ""
  echo "Worktrees with no live run-record. Archive (or 'git worktree remove') to clean up:"
  for row in "${STALE[@]}"; do
    IFS='|' read -r slug worktree <<< "$row"
    echo "- ${slug} — \`${worktree}\`"
  done
  echo ""
fi

# ─── Summary ────────────────────────────────────────────────────────────────

echo "---"
echo "Summary: ${#BUCKET_SUCCESS[@]} success, ${#BUCKET_READY[@]} ready, ${#BUCKET_QUESTIONABLE[@]} questionable, ${#BUCKET_ATTENTION[@]} attention, ${#CRASHED[@]} crashed, ${#RUNNING[@]} running, ${#CHAINS[@]} chains, ${#PENDING[@]} pending, ${#DRAFTS[@]} drafts, ${#EPICS[@]} epics, ${#STALE[@]} stale"

if [[ "$HAS_ATTENTION" == "true" ]]; then
  echo "Attention needed — review the agents above before proceeding."
fi

# ─── Archive (delegated) ────────────────────────────────────────────────────

if [[ "$DO_ARCHIVE" == "true" ]]; then
  echo ""
  echo "## Archiving"
  echo ""
  bash "${SCRIPT_DIR}/archive.sh" "${ARCHIVE_ARGS[@]}"
fi
