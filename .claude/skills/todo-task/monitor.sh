#!/usr/bin/env bash
# Self-refreshing TUI dashboard for todo-tasks.
# Usage: bash monitor.sh           — refresh loop (ctrl-c to exit)
#        bash monitor.sh --once    — single frame, then exit
set -euo pipefail

TODO="$(git rev-parse --show-toplevel)/.todo-tasks"
shopt -s nullglob

# ── Color setup ──────────────────────────────────────────────────────────────
if [[ -t 1 ]]; then
  BOLD=$(tput bold 2>/dev/null || true)
  DIM=$(tput dim 2>/dev/null || true)
  GREEN=$(tput setaf 2 2>/dev/null || true)
  YELLOW=$(tput setaf 3 2>/dev/null || true)
  RED=$(tput setaf 1 2>/dev/null || true)
  CYAN=$(tput setaf 6 2>/dev/null || true)
  RESET=$(tput sgr0 2>/dev/null || true)
else
  BOLD="" DIM="" GREEN="" YELLOW="" RED="" CYAN="" RESET=""
fi

# ── Helpers ───────────────────────────────────────────────────────────────────
mtime() {
  stat -c %Y "$1" 2>/dev/null || date +%s
}

elapsed() {
  local file="$1" age
  local now; now=$(date +%s)
  age=$(( now - $(mtime "$file") ))
  if (( age < 3600 )); then echo "$((age/60))m"
  elif (( age < 86400 )); then echo "$((age/3600))h$((age%3600/60))m"
  else echo "$((age/86400))d$((age%86400/3600))h"; fi
}

# ── Frame renderer ────────────────────────────────────────────────────────────
render_frame() {
  local now; now=$(date +%s)
  local T=$'\t'

  # ── Collect active (running) entries ─────────────────────────────────────
  local -a active_lines=()
  local chain_slugs=" "

  for m in "$TODO"/.running/chain-*.manifest; do
    [[ -r "$m" ]] || continue
    local chain status current completed phases total done_n e
    chain=$(sed -n 's/^chain: *//p' "$m" 2>/dev/null)
    status=$(sed -n 's/^status: *//p' "$m" 2>/dev/null)
    current=$(sed -n 's/^current: *//p' "$m" 2>/dev/null)
    completed=$(sed -n 's/^completed: *//p' "$m" 2>/dev/null)
    phases=$(sed -n 's/^phases: *//p' "$m" 2>/dev/null)
    total=$(echo "$phases" | tr ',' '\n' | grep -c . || echo 0)
    done_n=0
    [[ -n "$completed" ]] && done_n=$(echo "$completed" | tr ',' '\n' | grep -c . || echo 0)
    e=$(elapsed "$m")
    # Accumulate chain slugs so solo runner won't re-show them
    chain_slugs+="$(echo "$phases" | tr ',' ' ') "
    case "$status" in
      done|complete) ;;  # handled in recent section
      failed)
        active_lines+=("chain-fail${T}${chain} [${done_n}/${total}] ${current}${T}${e}")
        ;;
      *)
        active_lines+=("chain${T}${chain} [$((done_n+1))/${total}] ${current}${T}${e}")
        ;;
    esac
  done

  for md in "$TODO"/.running/*.md; do
    [[ -r "$md" ]] || continue
    local slug; slug=$(basename "$md" .md)
    # Skip if claimed by a chain
    local claimed=false
    for _m in "$TODO"/.running/chain-*.manifest; do
      grep -ql "$slug" "$_m" 2>/dev/null && claimed=true && break
    done
    $claimed && continue
    active_lines+=("running${T}${slug}${T}$(elapsed "$md")")
  done

  # ── Collect recent completions ────────────────────────────────────────────
  local -a recent_lines=()
  local recent_raw
  recent_raw=$(
    {
      for r in "$TODO"/.done/*.result.md "$TODO"/.archived/*.result.md; do
        [[ -r "$r" ]] || continue
        local rs; rs=$(basename "$r" .result.md)
        [[ "$chain_slugs" == *" $rs "* ]] && continue
        local st; st=$(sed -n 's/^[*]*[Ss]tatus[*]*: *//p' "$r" 2>/dev/null | head -1 | tr '[:upper:]' '[:lower:]')
        printf '%d %s %s\n' "$(mtime "$r")" "$rs" "$st"
      done
      for m in "$TODO"/.running/chain-*.manifest; do
        [[ -r "$m" ]] || continue
        local cs; cs=$(sed -n 's/^status: *//p' "$m" 2>/dev/null)
        case "$cs" in done|complete) ;; *) continue ;; esac
        local cn; cn=$(sed -n 's/^chain: *//p' "$m" 2>/dev/null)
        local cp; cp=$(sed -n 's/^phases: *//p' "$m" 2>/dev/null)
        local ct; ct=$(echo "$cp" | tr ',' '\n' | grep -c . || echo 0)
        printf '%d %s %s\n' "$(mtime "$m")" "chain:${cn}(${ct}/${ct})" "success"
      done
    } | sort -rn | head -3
  )
  while IFS=' ' read -r _ts rslug rstatus; do
    [[ -z "$rslug" ]] && continue
    local rage=$(( now - _ts ))
    local ago
    if (( rage < 3600 )); then ago="$((rage/60))m ago"
    elif (( rage < 86400 )); then ago="$((rage/3600))h ago"
    else ago="$((rage/86400))d ago"; fi
    case "$rstatus" in
      *success*) recent_lines+=("done${T}${rslug}${T}${ago}") ;;
      *)         recent_lines+=("failed${T}${rslug}${T}${ago}") ;;
    esac
  done <<< "$recent_raw"

  # ── Collect pending tasks ─────────────────────────────────────────────────
  local -a pending_lines=()
  for tf in "$TODO"/*.md; do
    [[ -r "$tf" ]] || continue
    [[ "$tf" == *.epic.md ]] && continue
    local pslug; pslug=$(basename "$tf" .md)
    pending_lines+=("$pslug")
  done

  # ── Collect epics ─────────────────────────────────────────────────────────
  local -a epic_lines=()
  for ef in "$TODO"/*.epic.md; do
    [[ -r "$ef" ]] || continue
    local epic; epic=$(basename "$ef" .epic.md)
    declare -A seen_slugs=()
    for tf in "$TODO/${epic}"-[0-9]*.md "$TODO/.running/${epic}"-[0-9]*.md "$TODO/.done/${epic}"-[0-9]*.md; do
      [[ -f "$tf" ]] || continue
      [[ "$tf" == *.result.md ]] && continue
      seen_slugs[$(basename "$tf" .md)]=1
    done
    for tf in "$TODO/.archived/"*"-${epic}"-[0-9]*.md; do
      [[ -f "$tf" ]] || continue
      [[ "$tf" == *.result.md ]] && continue
      local esl; esl=$(basename "$tf" .md); esl="${esl#[0-9]*-}"
      seen_slugs["$esl"]=1
    done
    local etotal=0 edone=0 erunning=0 efailed=0
    for ets in "${!seen_slugs[@]}"; do
      etotal=$((etotal + 1))
      if [[ -f "$TODO/.done/${ets}.result.md" ]]; then
        local es; es=$(sed -n 's/^[*]*[Ss]tatus[*]*: *//p' "$TODO/.done/${ets}.result.md" 2>/dev/null | head -1 | tr '[:upper:]' '[:lower:]')
        case "$es" in *success*) edone=$((edone + 1)) ;; *) efailed=$((efailed + 1)) ;; esac
      else
        local erf=""
        for _af in "$TODO/.archived/"*"-${ets}.result.md"; do
          [[ -f "$_af" ]] && erf="$_af" && break
        done
        if [[ -n "$erf" ]]; then
          local efs; efs=$(sed -n 's/^[*]*[Ss]tatus[*]*: *//p' "$erf" 2>/dev/null | head -1 | tr '[:upper:]' '[:lower:]')
          case "$efs" in *success*) edone=$((edone + 1)) ;; *) efailed=$((efailed + 1)) ;; esac
        elif [[ -f "$TODO/.running/${ets}.md" ]]; then
          erunning=$((erunning + 1))
        fi
      fi
    done
    unset seen_slugs
    (( etotal == 0 )) && continue
    local esummary="${edone}/${etotal} done"
    (( erunning > 0 )) && esummary+="  ${erunning} running"
    (( efailed > 0 )) && esummary+="  ${efailed} failed"
    epic_lines+=("${epic}${T}${esummary}")
  done

  # ── Counts for summary line ───────────────────────────────────────────────
  local n_running=${#active_lines[@]}
  local n_done=0 n_failed=0
  for rl in "${recent_lines[@]}"; do
    local rs_type; rs_type=$(echo "$rl" | cut -f1)
    case "$rs_type" in done) n_done=$((n_done + 1)) ;; failed) n_failed=$((n_failed + 1)) ;; esac
  done
  local n_pending=${#pending_lines[@]}

  # ── Output ─────────────────────────────────────────────────────────────────
  # EL = erase to end of line — prevents previous frame's longer lines bleeding through
  local EL=$'\033[K'

  printf '\n  %stodo-tasks%s%s\n%s\n' "$BOLD" "$RESET" "$EL" "$EL"

  # Running entries
  if (( ${#active_lines[@]} > 0 )); then
    for entry in "${active_lines[@]}"; do
      local etype eslug eelapsed
      etype=$(echo "$entry" | cut -f1)
      eslug=$(echo "$entry" | cut -f2)
      eelapsed=$(echo "$entry" | cut -f3)

      local color
      case "$etype" in
        chain|running)  color="$YELLOW" ;;
        chain-fail)     color="$RED" ;;
        *)              color="" ;;
      esac

      printf '  %srunning%s  %s  %s%s\n' "$color" "$RESET" "$eslug" "$eelapsed" "$EL"
    done
    printf '%s\n' "$EL"
  fi

  # Recent completions
  if (( ${#recent_lines[@]} > 0 )); then
    for entry in "${recent_lines[@]}"; do
      local rtype rslug2 rag
      rtype=$(echo "$entry" | cut -f1)
      rslug2=$(echo "$entry" | cut -f2)
      rag=$(echo "$entry" | cut -f3)

      local color status_word
      case "$rtype" in
        done)   color="$GREEN";  status_word="success" ;;
        failed) color="$RED";    status_word="failed" ;;
        *)      color=""; status_word="$rtype" ;;
      esac

      printf '  %s%-7s%s  %s  %s%s\n' "$color" "$status_word" "$RESET" "$rslug2" "$rag" "$EL"
    done
    printf '%s\n' "$EL"
  fi

  # Pending tasks
  if (( ${#pending_lines[@]} > 0 )); then
    for pslug in "${pending_lines[@]}"; do
      printf '  %spending%s  %s%s\n' "$DIM" "$RESET" "$pslug" "$EL"
    done
    printf '%s\n' "$EL"
  fi

  # Epics section
  if (( ${#epic_lines[@]} > 0 )); then
    printf '  %sepics%s%s\n' "$DIM" "$RESET" "$EL"
    for eline in "${epic_lines[@]}"; do
      local ename; ename=$(echo "$eline" | cut -f1)
      local esumm; esumm=$(echo "$eline" | cut -f2)
      printf '  %s%s%s  %s%s\n' "$CYAN" "$ename" "$RESET" "$esumm" "$EL"
    done
    printf '%s\n' "$EL"
  fi

  # Summary line
  printf '  %s%s running  %s done  %s failed  %s pending%s%s\n' \
    "$DIM" "$n_running" "$n_done" "$n_failed" "$n_pending" "$RESET" "$EL"
}

# ── Main ──────────────────────────────────────────────────────────────────────
ONCE=false
for arg in "$@"; do
  [[ "$arg" == "--once" ]] && ONCE=true
done

# Non-interactive stdout → single shot
[[ ! -t 1 ]] && ONCE=true

if $ONCE; then
  render_frame
  exit 0
fi

# Loop mode: hide cursor, trap exit for cleanup
tput civis 2>/dev/null || true
cleanup() {
  tput cnorm 2>/dev/null || true
  tput clear 2>/dev/null || true
  exit 0
}
trap cleanup INT TERM

tput clear 2>/dev/null || printf '\033[H\033[2J'
while true; do
  tput cup 0 0 2>/dev/null || printf '\033[H'
  render_frame
  printf '\n  %srefreshing every 5s · ctrl-c to exit%s' "$DIM" "$RESET"
  tput ed 2>/dev/null || printf '\033[J'
  sleep 5
done
