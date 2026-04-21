#!/usr/bin/env bash
# Self-refreshing TUI dashboard for todo-tasks.
# Usage: bash monitor.sh           — refresh loop (ctrl-c to exit)
#        bash monitor.sh --once    — single frame, then exit
set -euo pipefail

REPO_ROOT="$(git rev-parse --show-toplevel)"
TODO="${REPO_ROOT}/.todo-tasks"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${SCRIPT_DIR}/lib.sh"

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

EL=$'\033[K'

# ── Generic helpers ──────────────────────────────────────────────────────────
mtime() { stat -c %Y "$1" 2>/dev/null || date +%s; }

elapsed() {
  local now age; now=$(date +%s); age=$((now - $(mtime "$1")))
  if   (( age < 3600 ));  then echo "$((age/60))m"
  elif (( age < 86400 )); then echo "$((age/3600))h$((age%3600/60))m"
  else                         echo "$((age/86400))d$((age%86400/3600))h"; fi
}

age_ago() {
  local age=$1
  if   (( age < 3600 ));  then echo "$((age/60))m ago"
  elif (( age < 86400 )); then echo "$((age/3600))h ago"
  else                         echo "$((age/86400))d ago"; fi
}

count_csv() { echo "${1}" | tr ',' '\n' | grep -c . || echo 0; }

# classify_result <result_file> → echoes an SM_OVERALL_* state
classify_result() {
  local f="$1" s v m
  s=$(parse_result_field "$f" session)
  if [[ -n "$s" ]]; then
    v=$(parse_result_field "$f" verification)
    m=$(parse_result_field "$f" merge)
    derive_overall_state "$s" "$v" "$m"
  else
    # Old-format fallback: "Status: success" / "Merge: success"
    local old oldm
    old=$(parse_result_field "$f" status)
    oldm=$(parse_result_field "$f" merge)
    if [[ "$old" == "success" ]]; then
      [[ "$oldm" == "conflict" ]] && echo "$SM_OVERALL_CONFLICT" || echo "$SM_OVERALL_SUCCESS"
    else
      echo "$SM_OVERALL_BUILD_FAIL"
    fi
  fi
}

overall_color() {
  case "$1" in
    "$SM_OVERALL_SUCCESS") echo "$GREEN" ;;
    "$SM_OVERALL_READY")   echo "$CYAN" ;;
    "$SM_OVERALL_NOOP")    echo "$YELLOW" ;;
    *)                     echo "$RED" ;;
  esac
}

overall_label() {
  case "$1" in
    "$SM_OVERALL_SUCCESS")      echo "success" ;;
    "$SM_OVERALL_READY")        echo "ready" ;;
    "$SM_OVERALL_NOOP")         echo "no-op" ;;
    "$SM_OVERALL_CONFLICT")     echo "conflict" ;;
    "$SM_OVERALL_DIRTY")        echo "dirty" ;;
    "$SM_OVERALL_LEAKED_TRUNK") echo "leaked" ;;
    "$SM_OVERALL_BUILD_FAIL")   echo "failed" ;;
    "$SM_OVERALL_SESSION_FAIL") echo "crashed" ;;
    *)                          echo "$1" ;;
  esac
}

# ── Collectors ───────────────────────────────────────────────────────────────
# Each collector echoes one tab-separated record per line. Output is consumed
# by render_frame via `mapfile`. Collectors run in subshells; they inherit
# $CHAIN_SLUGS from the parent but cannot mutate it.

# Space-padded list of slugs claimed by active chains, e.g. " a b c ".
# Pre-computed once per frame so recent/active collectors agree.
compute_chain_slugs() {
  local slugs=" "
  local m phases
  for m in "$TODO"/.running/chain-*.manifest; do
    [[ -r "$m" ]] || continue
    phases=$(parse_result_field "$m" phases)
    slugs+="$(echo "$phases" | tr ',' ' ') "
  done
  printf '%s' "$slugs"
}

# Active = currently running chains + non-chain running tasks.
# Record: type \t label \t elapsed
#   type ∈ {chain, chain-fail, running}
collect_active() {
  local m chain status current completed phases total done_n e
  for m in "$TODO"/.running/chain-*.manifest; do
    [[ -r "$m" ]] || continue
    chain=$(parse_result_field "$m" chain)
    status=$(parse_result_field "$m" status)
    current=$(parse_result_field "$m" current)
    completed=$(parse_result_field "$m" completed)
    phases=$(parse_result_field "$m" phases)
    total=$(count_csv "$phases")
    done_n=0
    [[ -n "$completed" ]] && done_n=$(count_csv "$completed")
    e=$(elapsed "$m")
    case "$status" in
      done|complete) ;;  # shown in recent, not active
      failed) printf 'chain-fail\t%s [%d/%d] %s\t%s\n' "$chain" "$done_n" "$total" "$current" "$e" ;;
      *)      printf 'chain\t%s [%d/%d] %s\t%s\n' "$chain" "$((done_n+1))" "$total" "$current" "$e" ;;
    esac
  done

  local md slug
  for md in "$TODO"/.running/*.md; do
    [[ -r "$md" ]] || continue
    slug=$(basename "$md" .md)
    case "$CHAIN_SLUGS" in *" $slug "*) continue ;; esac
    printf 'running\t%s\t%s\n' "$slug" "$(elapsed "$md")"
  done
}

# Recent = top-3 most-recently-touched result files and completed chains.
# Record: overall_state \t slug \t age_ago
collect_recent() {
  local now; now=$(date +%s)
  {
    local r slug overall
    for r in "$TODO"/.done/*.result.md "$TODO"/.archived/*.result.md; do
      [[ -r "$r" ]] || continue
      slug=$(basename "$r" .result.md)
      case "$CHAIN_SLUGS" in *" $slug "*) continue ;; esac
      overall=$(classify_result "$r")
      printf '%d\t%s\t%s\n' "$(mtime "$r")" "$slug" "$overall"
    done
    local m cs cn cp ct
    for m in "$TODO"/.running/chain-*.manifest; do
      [[ -r "$m" ]] || continue
      cs=$(parse_result_field "$m" status)
      case "$cs" in done|complete) ;; *) continue ;; esac
      cn=$(parse_result_field "$m" chain)
      cp=$(parse_result_field "$m" phases)
      ct=$(count_csv "$cp")
      printf '%d\tchain:%s(%d/%d)\t%s\n' "$(mtime "$m")" "$cn" "$ct" "$ct" "$SM_OVERALL_SUCCESS"
    done
  } | sort -rn | head -3 | while IFS=$'\t' read -r ts slug overall; do
    [[ -z "$slug" ]] && continue
    printf '%s\t%s\t%s\n' "$overall" "$slug" "$(age_ago $((now - ts)))"
  done
}

# Pending = root-level .md files that are NOT already running and have
# NO result file in .done/. This is the state-machine rule: a task with
# a result is not pending, even if its source .md was never moved.
# Record: slug
collect_pending() {
  local tf slug
  for tf in "$TODO"/*.md; do
    [[ -r "$tf" ]] || continue
    [[ "$tf" == *.epic.md ]] && continue
    slug=$(basename "$tf" .md)
    [[ -f "$TODO/.running/${slug}.md" ]] && continue
    [[ -f "$TODO/.done/${slug}.result.md" ]] && continue
    printf '%s\n' "$slug"
  done
}

# Epics = one summary row per *.epic.md, classifying member tasks via lib.sh.
# Record: epic_name \t summary
collect_epics() {
  local ef epic tf ets result overall bucket af
  for ef in "$TODO"/*.epic.md; do
    [[ -r "$ef" ]] || continue
    epic=$(basename "$ef" .epic.md)

    declare -A seen=()
    for tf in "$TODO/${epic}"-[0-9]*.md \
              "$TODO/.running/${epic}"-[0-9]*.md \
              "$TODO/.done/${epic}"-[0-9]*.md; do
      [[ -f "$tf" ]] || continue
      [[ "$tf" == *.result.md ]] && continue
      seen[$(basename "$tf" .md)]=1
    done
    for tf in "$TODO/.archived/"*"-${epic}"-[0-9]*.md; do
      [[ -f "$tf" ]] || continue
      [[ "$tf" == *.result.md ]] && continue
      local esl; esl=$(basename "$tf" .md); esl="${esl#[0-9]*-}"
      seen["$esl"]=1
    done

    local total=0 done_n=0 running_n=0 failed_n=0
    for ets in "${!seen[@]}"; do
      total=$((total + 1))
      result=""
      if [[ -f "$TODO/.done/${ets}.result.md" ]]; then
        result="$TODO/.done/${ets}.result.md"
      else
        for af in "$TODO/.archived/"*"-${ets}.result.md"; do
          [[ -f "$af" ]] && result="$af" && break
        done
      fi
      if [[ -n "$result" ]]; then
        overall=$(classify_result "$result")
        bucket=$(state_bucket "$overall")
        case "$bucket" in
          "$SM_BUCKET_SUCCESS"|"$SM_BUCKET_READY") done_n=$((done_n + 1)) ;;
          *)                                       failed_n=$((failed_n + 1)) ;;
        esac
      elif [[ -f "$TODO/.running/${ets}.md" ]]; then
        running_n=$((running_n + 1))
      fi
    done
    unset seen
    (( total == 0 )) && continue

    local summary="${done_n}/${total} done"
    (( running_n > 0 )) && summary+="  ${running_n} running"
    (( failed_n > 0 ))  && summary+="  ${failed_n} failed"
    printf '%s\t%s\n' "$epic" "$summary"
  done
}

# ── Renderers ────────────────────────────────────────────────────────────────
render_active() {
  local entry type label e color
  for entry in "$@"; do
    [[ -z "$entry" ]] && continue
    IFS=$'\t' read -r type label e <<< "$entry"
    case "$type" in
      chain|running) color="$YELLOW" ;;
      chain-fail)    color="$RED" ;;
      *)             color="" ;;
    esac
    printf '  %srunning%s  %s  %s%s\n' "$color" "$RESET" "$label" "$e" "$EL"
  done
  [[ $# -gt 0 ]] && printf '%s\n' "$EL"
  return 0
}

render_recent() {
  local entry overall slug ago color label
  for entry in "$@"; do
    [[ -z "$entry" ]] && continue
    IFS=$'\t' read -r overall slug ago <<< "$entry"
    color=$(overall_color "$overall")
    label=$(overall_label "$overall")
    printf '  %s%-9s%s  %s  %s%s\n' "$color" "$label" "$RESET" "$slug" "$ago" "$EL"
  done
  [[ $# -gt 0 ]] && printf '%s\n' "$EL"
  return 0
}

render_pending() {
  local slug
  for slug in "$@"; do
    [[ -z "$slug" ]] && continue
    printf '  %spending%s  %s%s\n' "$DIM" "$RESET" "$slug" "$EL"
  done
  [[ $# -gt 0 ]] && printf '%s\n' "$EL"
  return 0
}

render_epics() {
  local entry name summary
  [[ $# -eq 0 ]] && return 0
  printf '  %sepics%s%s\n' "$DIM" "$RESET" "$EL"
  for entry in "$@"; do
    [[ -z "$entry" ]] && continue
    IFS=$'\t' read -r name summary <<< "$entry"
    printf '  %s%s%s  %s%s\n' "$CYAN" "$name" "$RESET" "$summary" "$EL"
  done
  printf '%s\n' "$EL"
}

render_summary() {
  local n_running="$1" n_success="$2" n_ready="$3" n_questionable="$4" n_attention="$5" n_pending="$6"
  printf '  %s%s running  %s success  %s ready  %s questionable  %s attention  %s pending%s%s\n' \
    "$DIM" "$n_running" "$n_success" "$n_ready" "$n_questionable" "$n_attention" "$n_pending" "$RESET" "$EL"
}

# ── Frame ────────────────────────────────────────────────────────────────────
render_frame() {
  local CHAIN_SLUGS
  CHAIN_SLUGS=$(compute_chain_slugs)
  export CHAIN_SLUGS  # visible to subshells launched by mapfile

  local -a active recent pending epics
  mapfile -t active  < <(collect_active)
  mapfile -t recent  < <(collect_recent)
  mapfile -t pending < <(collect_pending)
  mapfile -t epics   < <(collect_epics)

  # Bucket counts for summary
  local n_success=0 n_ready=0 n_questionable=0 n_attention=0
  local entry overall bucket
  for entry in "${recent[@]}"; do
    [[ -z "$entry" ]] && continue
    IFS=$'\t' read -r overall _ _ <<< "$entry"
    bucket=$(state_bucket "$overall")
    case "$bucket" in
      "$SM_BUCKET_SUCCESS")      n_success=$((n_success+1)) ;;
      "$SM_BUCKET_READY")        n_ready=$((n_ready+1)) ;;
      "$SM_BUCKET_QUESTIONABLE") n_questionable=$((n_questionable+1)) ;;
      "$SM_BUCKET_ATTENTION")    n_attention=$((n_attention+1)) ;;
    esac
  done

  printf '\n  %stodo-tasks%s%s\n%s\n' "$BOLD" "$RESET" "$EL" "$EL"
  render_active  "${active[@]}"
  render_recent  "${recent[@]}"
  render_pending "${pending[@]}"
  render_epics   "${epics[@]}"
  render_summary "${#active[@]}" "$n_success" "$n_ready" "$n_questionable" "$n_attention" "${#pending[@]}"
}

# ── Main ─────────────────────────────────────────────────────────────────────
ONCE=false
for arg in "$@"; do
  [[ "$arg" == "--once" ]] && ONCE=true
done
[[ ! -t 1 ]] && ONCE=true

if $ONCE; then
  render_frame
  exit 0
fi

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
