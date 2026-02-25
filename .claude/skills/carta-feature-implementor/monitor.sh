#!/usr/bin/env bash
# Compact agent monitor. Usage: watch -n5 bash .claude/skills/carta-feature-implementor/monitor.sh
set -uo pipefail
TODO="$(git rev-parse --show-toplevel)/todo-tasks"

# Chains
shopt -s nullglob
for m in "$TODO"/.running/chain-*.manifest; do
  chain=$(grep -m1 '^chain:' "$m" | cut -d' ' -f2)
  status=$(grep -m1 '^status:' "$m" | cut -d' ' -f2)
  done_count=$(grep -m1 '^completed:' "$m" | tr ',' '\n' | grep -c . 2>/dev/null || echo 0)
  total=$(grep -m1 '^phases:' "$m" | tr ',' '\n' | grep -c .)
  current=$(grep -m1 '^current:' "$m" | cut -d' ' -f2)
  case "$status" in
    failed) printf "⛓️  %s  ❌ FAILED at %s (%d/%d)\n" "$chain" "$current" "$done_count" "$total" ;;
    done)   printf "⛓️  %s  ✅ complete (%d/%d)\n" "$chain" "$done_count" "$total" ;;
    *)      printf "⛓️  %s  ▶ %s (%d/%d)\n" "$chain" "$current" "$done_count" "$total" ;;
  esac
done

# Running agents (not in a chain)
for md in "$TODO"/.running/*.md; do
  slug=$(basename "$md" .md)
  # skip if claimed by a chain
  grep -ql "$slug" "$TODO"/.running/chain-*.manifest 2>/dev/null && continue
  printf "▶ %s\n" "$slug"
done

# Recent completions (last 10 min)
for r in "$TODO"/.done/*.result.md; do
  slug=$(basename "$r" .result.md)
  age=$(( $(date +%s) - $(stat -c %Y "$r") ))
  (( age > 600 )) && continue
  status=$(grep -m1 -i '^\*\*Status\*\*:\|^status:' "$r" | sed 's/^[^:]*: *//' | tr '[:upper:]' '[:lower:]')
  case "$status" in
    *success*) printf "✅ %s (done %dm ago)\n" "$slug" "$((age/60))" ;;
    *)         printf "❌ %s FAILED (%dm ago)\n" "$slug" "$((age/60))" ;;
  esac
done

# Nothing running?
running=("$TODO"/.running/*.md "$TODO"/.running/chain-*.manifest)
[ ${#running[@]} -eq 0 ] && echo "(idle)"
