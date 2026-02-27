#!/usr/bin/env bash
# Compact agent monitor. Usage: watch -n5 bash .claude/skills/carta-feature-implementor/monitor.sh
TODO="$(git rev-parse --show-toplevel)/todo-tasks"
shopt -s nullglob
now=$(date +%s)
T=$'\t'

elapsed() {
  local file="$1" age
  age=$(( now - $(stat -c %Y "$file") ))
  if (( age < 3600 )); then echo "$((age/60))m"
  elif (( age < 86400 )); then echo "$((age/3600))h$((age%3600/60))m"
  else echo "$((age/86400))d$((age%86400/3600))h"; fi
}

lines=$(
# Chains
for m in "$TODO"/.running/chain-*.manifest; do
  chain=$(sed -n 's/^chain: *//p' "$m")
  status=$(sed -n 's/^status: *//p' "$m")
  current=$(sed -n 's/^current: *//p' "$m")
  completed=$(sed -n 's/^completed: *//p' "$m")
  phases=$(sed -n 's/^phases: *//p' "$m")
  total=$(echo "$phases" | tr ',' '\n' | wc -l)
  done_n=0; [[ -n "$completed" ]] && done_n=$(echo "$completed" | tr ',' '\n' | wc -l)
  e=$(elapsed "$m")
  case "$status" in
    failed) echo "⛓️ ❌${T}${chain}${T}${current}${T}${done_n}/${total}${T}${e}" ;;
    done)   echo "⛓️ ✅${T}${chain}${T}${T}${done_n}/${total}${T}" ;;
    *)      echo "⛓️ ▶${T}${chain}${T}${current}${T}${done_n}/${total}${T}${e}" ;;
  esac
done

# Solo running agents (not claimed by a chain)
for md in "$TODO"/.running/*.md; do
  slug=$(basename "$md" .md)
  grep -ql "$slug" "$TODO"/.running/chain-*.manifest 2>/dev/null && continue
  echo "▶${T}${slug}${T}${T}${T}$(elapsed "$md")"
done

# Collect chain-claimed slugs
chain_slugs=""
for m in "$TODO"/.running/chain-*.manifest; do
  chain_slugs+=" $(sed -n 's/^phases: *//p' "$m" | tr ',' ' ') "
done

# 3 most recent completions (by mtime, newest first), excluding chain members
results=("$TODO"/.done/*.result.md)
if (( ${#results[@]} )); then
  printf '%s\n' "${results[@]}" | while read -r r; do
    printf '%d %s\n' "$(stat -c %Y "$r")" "$r"
  done | sort -rn | head -3 | while read -r _ts r; do
    age=$(( now - $(stat -c %Y "$r") ))
    slug=$(basename "$r" .result.md)
    [[ "$chain_slugs" == *" $slug "* ]] && continue
    status=$(sed -n 's/^[*]*[Ss]tatus[*]*: *//p' "$r" | head -1 | tr '[:upper:]' '[:lower:]')
    if (( age < 3600 )); then ago="$((age/60))m ago"
    elif (( age < 86400 )); then ago="$((age/3600))h ago"
    else ago="$((age/86400))d ago"; fi
    case "$status" in
      *success*) echo "✅${T}${slug}${T}${T}${T}${ago}" ;;
      *)         echo "❌${T}${slug}${T}${T}${T}${ago}" ;;
    esac
  done
fi
)

if [[ -n "$lines" ]]; then
  echo "$lines" | column -t -s "$T"
else
  echo "(idle)"
fi
