#!/usr/bin/env bash
# Compact agent monitor. Usage: watch -n5 bash .claude/skills/carta-feature-implementor/monitor.sh
TODO="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)/todo-tasks"
shopt -s nullglob
now=$(date +%s)
T=$'\t'

mtime() {
  stat -c %Y "$1" 2>/dev/null || echo "$now"
}

elapsed() {
  local file="$1" age
  age=$(( now - $(mtime "$file") ))
  if (( age < 3600 )); then echo "$((age/60))m"
  elif (( age < 86400 )); then echo "$((age/3600))h$((age%3600/60))m"
  else echo "$((age/86400))d$((age%86400/3600))h"; fi
}

# Active: chains + solo running agents
active=$(
for m in "$TODO"/.running/chain-*.manifest; do
  [[ -r "$m" ]] || continue
  chain=$(sed -n 's/^chain: *//p' "$m" 2>/dev/null)
  status=$(sed -n 's/^status: *//p' "$m" 2>/dev/null)
  current=$(sed -n 's/^current: *//p' "$m" 2>/dev/null)
  completed=$(sed -n 's/^completed: *//p' "$m" 2>/dev/null)
  phases=$(sed -n 's/^phases: *//p' "$m" 2>/dev/null)
  total=$(echo "$phases" | tr ',' '\n' | wc -l)
  done_n=0; [[ -n "$completed" ]] && done_n=$(echo "$completed" | tr ',' '\n' | wc -l)
  e=$(elapsed "$m")
  case "$status" in
    failed) echo "⛓️ ❌${T}${chain}${T}${current}${T}${done_n}/${total}${T}${e}" ;;
    done)   echo "⛓️ ✅${T}${chain}${T}${T}${done_n}/${total}${T}" ;;
    *)      echo "⛓️ ▶${T}${chain}${T}${current}${T}${done_n}/${total}${T}${e}" ;;
  esac
done

for md in "$TODO"/.running/*.md; do
  [[ -r "$md" ]] || continue
  slug=$(basename "$md" .md)
  claimed=false; for _m in "$TODO"/.running/chain-*.manifest; do grep -ql "$slug" "$_m" 2>/dev/null && claimed=true && break; done; $claimed && continue
  echo "▶${T}${slug}${T}${T}${T}$(elapsed "$md")"
done
)

# Collect chain-claimed slugs
chain_slugs=""
for m in "$TODO"/.running/chain-*.manifest; do
  [[ -r "$m" ]] || continue
  chain_slugs+=" $(sed -n 's/^phases: *//p' "$m" 2>/dev/null | tr ',' ' ') "
done

# 3 most recent completions (by mtime, newest first) from .done/ and .archived/
recent=$(
results=("$TODO"/.done/*.result.md "$TODO"/.archived/*.result.md)
if (( ${#results[@]} )); then
  printf '%s\n' "${results[@]}" | while read -r r; do
    [[ -r "$r" ]] || continue
    printf '%d %s\n' "$(mtime "$r")" "$r"
  done | sort -rn | head -3 | while read -r _ts r; do
    [[ -r "$r" ]] || continue
    age=$(( now - $(mtime "$r") ))
    slug=$(basename "$r" .result.md)
    [[ "$chain_slugs" == *" $slug "* ]] && continue
    status=$(sed -n 's/^[*]*[Ss]tatus[*]*: *//p' "$r" 2>/dev/null | head -1 | tr '[:upper:]' '[:lower:]')
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

# Epics: compact one-line-per-epic summary
epics=$(
for ef in "$TODO"/*.epic.md; do
  [[ -r "$ef" ]] || continue
  epic=$(basename "$ef" .epic.md)
  total=0; done_n=0; running=0; failed=0
  for tf in "$TODO/${epic}"-[0-9]*.md "$TODO/.running/${epic}"-[0-9]*.md "$TODO/.done/${epic}"-[0-9]*.md; do
    [[ -f "$tf" ]] || continue
    ts=$(basename "$tf" .md)
    ((total++))
    if [[ -f "$TODO/.done/${ts}.result.md" ]]; then
      s=$(sed -n 's/^[*]*[Ss]tatus[*]*: *//p' "$TODO/.done/${ts}.result.md" 2>/dev/null | head -1 | tr '[:upper:]' '[:lower:]')
      case "$s" in *success*) ((done_n++)) ;; *) ((failed++)) ;; esac
    elif [[ -f "$TODO/.running/${ts}.md" ]]; then
      ((running++))
    fi
  done
  if (( total == 0 )); then continue; fi
  icon="📋"
  (( failed > 0 )) && icon="⚠️"
  (( running > 0 )) && icon="▶"
  (( done_n == total )) && icon="✅"
  echo "${icon}${T}${epic}${T}${done_n}/${total} done${T}${running} running${T}${failed} failed"
done
)

# Output
if [[ -n "$active" ]]; then
  echo "$active" | column -t -s "$T"
else
  echo "(no plans running)"
fi
if [[ -n "$recent" ]]; then
  echo
  echo "$recent" | column -t -s "$T"
fi
if [[ -n "$epics" ]]; then
  echo
  echo "$epics" | column -t -s "$T"
fi
