#!/usr/bin/env bash
set -euo pipefail

# ─── Agent Status Check ─────────────────────────────────────────────────────
# Reports on completed, running, and pending plan agents.
#
# Usage: status.sh [--archive]
#   --archive: move .done/ results to .archived/ after displaying

REPO_ROOT="$(git rev-parse --show-toplevel)"
TODO="${REPO_ROOT}/todo-tasks"
ARCHIVE=false

for arg in "$@"; do
  case "$arg" in
    --archive) ARCHIVE=true ;;
    *) echo "Unknown option: $arg"; exit 1 ;;
  esac
done

# ─── Completed Agents ───────────────────────────────────────────────────────

DONE_FILES=$(ls "${TODO}/.done/"*.result.md 2>/dev/null || true)

if [[ -n "$DONE_FILES" ]]; then
  echo "## Completed Agents"
  echo ""
  for result in ${DONE_FILES}; do
    slug=$(basename "$result" .result.md)
    # Extract header fields (first 10 lines)
    header=$(head -10 "$result")
    status=$(echo "$header" | grep '^\*\*Status\*\*' | sed 's/.*: //')
    merge=$(echo "$header" | grep '^\*\*Merge\*\*' | sed 's/.*: //')
    retried=$(echo "$header" | grep '^\*\*Retried\*\*' | sed 's/.*: //')

    # Extract Notes section if present
    notes=$(sed -n '/^## Notes/,/^## /{ /^## Notes/d; /^## /d; p; }' "$result" | head -5 | tr '\n' ' ' | sed 's/  */ /g; s/^ //; s/ $//')
    if [[ -z "$notes" ]]; then
      if [[ "$status" == "SUCCESS" ]]; then
        notes="Clean run, no concerns."
      else
        notes="Check result file for details."
      fi
    fi

    # Count commits
    commits=$(sed -n '/^## Commits/,/^## /{ /^```/,/^```/{ /^```/d; p; } }' "$result" | grep -c '.' || echo "0")

    if [[ "$retried" == "true" ]]; then
      notes="Retried once. ${notes}"
    fi

    echo "- **${slug}** | ${status} | merge: ${merge} | ${commits} commits | ${notes}"
  done
  echo ""
fi

# ─── Running Agents ──────────────────────────────────────────────────────────

RUNNING_FILES=$(ls "${TODO}/.running/"*.md 2>/dev/null || true)

if [[ -n "$RUNNING_FILES" ]]; then
  echo "## Running Agents"
  echo ""
  for plan in ${RUNNING_FILES}; do
    slug=$(basename "$plan" .md)
    log="${TODO}/.running/${slug}.log"
    echo "- **${slug}**"
    if [[ -f "$log" ]]; then
      echo "  Last output:"
      tail -5 "$log" | sed 's/^/  > /'
    fi
  done
  echo ""
fi

# ─── Pending Plans ───────────────────────────────────────────────────────────

PENDING_FILES=$(ls "${TODO}/"*.md 2>/dev/null || true)

if [[ -n "$PENDING_FILES" ]]; then
  echo "## Pending Plans"
  echo ""
  for plan in ${PENDING_FILES}; do
    slug=$(basename "$plan" .md)
    title=$(head -1 "$plan" | sed 's/^#* //')
    echo "- **${slug}** — ${title}"
  done
  echo ""
fi

# ─── Summary ─────────────────────────────────────────────────────────────────

done_count=$(echo "$DONE_FILES" | grep -c '.' 2>/dev/null || echo "0")
running_count=$(echo "$RUNNING_FILES" | grep -c '.' 2>/dev/null || echo "0")
pending_count=$(echo "$PENDING_FILES" | grep -c '.' 2>/dev/null || echo "0")

if [[ "$done_count" == "0" && "$running_count" == "0" && "$pending_count" == "0" ]]; then
  echo "No agents or plans found."
fi

# ─── Archive ─────────────────────────────────────────────────────────────────

if [[ "$ARCHIVE" == "true" && -n "$DONE_FILES" ]]; then
  echo "## Archiving"
  echo ""
  mkdir -p "${TODO}/.archived"
  ts=$(date +%Y%m%d)
  for result in ${DONE_FILES}; do
    slug=$(basename "$result" .result.md)
    [[ -f "${TODO}/.done/${slug}.md" ]] && mv "${TODO}/.done/${slug}.md" "${TODO}/.archived/${ts}-${slug}.md"
    mv "$result" "${TODO}/.archived/${ts}-${slug}.result.md"
    echo "- Archived ${slug}"
  done
  echo ""
fi
