#!/usr/bin/env bash
# Compact agent monitor. Usage: watch -n5 bash .claude/skills/carta-feature-implementor/monitor.sh
TODO="$(git rev-parse --show-toplevel)/todo-tasks"
shopt -s nullglob
found=false

# Chains
for m in "$TODO"/.running/chain-*.manifest; do
  found=true
  chain=$(sed -n 's/^chain: *//p' "$m")
  status=$(sed -n 's/^status: *//p' "$m")
  current=$(sed -n 's/^current: *//p' "$m")
  completed=$(sed -n 's/^completed: *//p' "$m")
  phases=$(sed -n 's/^phases: *//p' "$m")
  total=$(echo "$phases" | tr ',' '\n' | wc -l)
  done_n=0; [[ -n "$completed" ]] && done_n=$(echo "$completed" | tr ',' '\n' | wc -l)
  case "$status" in
    failed) printf "⛓️  %s  ❌ %s (%d/%d)\n" "$chain" "$current" "$done_n" "$total" ;;
    done)   printf "⛓️  %s  ✅ (%d/%d)\n" "$chain" "$done_n" "$total" ;;
    *)      printf "⛓️  %s  ▶ %s (%d/%d)\n" "$chain" "$current" "$done_n" "$total" ;;
  esac
done

# Solo running agents (not claimed by a chain)
for md in "$TODO"/.running/*.md; do
  slug=$(basename "$md" .md)
  grep -ql "$slug" "$TODO"/.running/chain-*.manifest 2>/dev/null && continue
  found=true
  printf "▶ %s\n" "$slug"
done

# 3 most recent completions (by mtime, newest first)
results=("$TODO"/.done/*.result.md)
if (( ${#results[@]} )); then
  now=$(date +%s)
  printf '%s\n' "${results[@]}" | while read -r r; do
    printf '%d %s\n' "$(stat -c %Y "$r")" "$r"
  done | sort -rn | head -3 | while read -r _ts r; do
    found=true
    age=$(( now - $(stat -c %Y "$r") ))
    slug=$(basename "$r" .result.md)
    status=$(sed -n 's/^[*]*[Ss]tatus[*]*: *//p' "$r" | head -1 | tr '[:upper:]' '[:lower:]')
    if (( age < 3600 )); then ago="$((age/60))m"
    elif (( age < 86400 )); then ago="$((age/3600))h"
    else ago="$((age/86400))d"; fi
    case "$status" in
      *success*) printf "✅ %s (%s ago)\n" "$slug" "$ago" ;;
      *)         printf "❌ %s (%s ago)\n" "$slug" "$ago" ;;
    esac
  done
fi

$found || echo "(idle)"
