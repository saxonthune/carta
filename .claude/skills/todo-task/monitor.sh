#!/usr/bin/env bash
# Self-refreshing TUI dashboard for todo-tasks.
# Usage: bash monitor.sh           — refresh loop (ctrl-c to exit)
#        bash monitor.sh --once    — single frame, then exit
#
# A pure renderer over report.sh — it never walks the filesystem or classifies
# state itself. All state comes from the reporter's TSV (including the `age`
# column, so the monitor stays filesystem-free).
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${SCRIPT_DIR}/lib.sh"

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
age_ago() {
  local age="${1:-0}"
  [[ "$age" =~ ^[0-9]+$ ]] || { echo "?"; return; }
  if   (( age < 3600 ));  then echo "$((age/60))m ago"
  elif (( age < 86400 )); then echo "$((age/3600))h ago"
  else                         echo "$((age/86400))d ago"; fi
}

overall_color() {
  case "$1" in
    "$SM_OVERALL_SUCCESS")    echo "$GREEN" ;;
    "$SM_OVERALL_READY")      echo "$CYAN" ;;
    "$SM_OVERALL_NOOP")       echo "$YELLOW" ;;
    "$SM_OVERALL_TRUNK_LEAK") echo "$RED" ;;
    *)                        echo "$RED" ;;
  esac
}

overall_label() {
  case "$1" in
    "$SM_OVERALL_SUCCESS")      echo "success" ;;
    "$SM_OVERALL_READY")        echo "ready" ;;
    "$SM_OVERALL_NOOP")         echo "no-op" ;;
    "$SM_OVERALL_TRUNK_LEAK")   echo "trunk-leak" ;;
    "$SM_OVERALL_CONFLICT")     echo "conflict" ;;
    "$SM_OVERALL_DIRTY")        echo "dirty" ;;
    "$SM_OVERALL_BUILD_FAIL")   echo "failed" ;;
    "$SM_OVERALL_SESSION_FAIL") echo "crashed" ;;
    *)                          echo "$1" ;;
  esac
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

render_drafts() {
  local slug
  for slug in "$@"; do
    [[ -z "$slug" ]] && continue
    printf '  %sdraft%s    %s%s\n' "$DIM" "$RESET" "$slug" "$EL"
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
  local -a active=() recent_raw=() pending=() drafts=() epics=()
  local n_success=0 n_ready=0 n_questionable=0 n_attention=0

  local rec type
  while IFS= read -r rec; do
    [[ -z "$rec" ]] && continue
    IFS=$'\t' read -r type _ <<< "$rec"
    case "$type" in
      task)
        local slug phase overall bucket commits worktree branch age notes
        IFS=$'\t' read -r _ slug phase overall bucket commits worktree branch age notes <<< "$rec"
        case "$phase" in
          running) active+=("$(printf 'running\t%s\t%s' "$slug" "$(age_ago "$age")")") ;;
          pending) pending+=("$slug") ;;
          draft)   drafts+=("$slug") ;;
          done|crashed)
            recent_raw+=("$(printf '%s\t%s\t%s\t%s' "$age" "$overall" "$slug" "$(age_ago "$age")")")
            case "$bucket" in
              "$SM_BUCKET_SUCCESS")      n_success=$((n_success+1)) ;;
              "$SM_BUCKET_READY")        n_ready=$((n_ready+1)) ;;
              "$SM_BUCKET_QUESTIONABLE") n_questionable=$((n_questionable+1)) ;;
              "$SM_BUCKET_ATTENTION")    n_attention=$((n_attention+1)) ;;
            esac ;;
        esac ;;
      chain)
        local name cstatus done_n total current phases cw cb
        IFS=$'\t' read -r _ name cstatus done_n total current phases cw cb <<< "$rec"
        case "$cstatus" in
          running) active+=("$(printf 'chain\t%s [%s/%s] %s\t' "$name" "$done_n" "$total" "$current")") ;;
          waiting) active+=("$(printf 'chain\t%s [%s/%s] %s\t' "$name" "$done_n" "$total" "$current")") ;;
          failed)  active+=("$(printf 'chain-fail\t%s [%s/%s] %s\t' "$name" "$done_n" "$total" "$current")") ;;
          complete) recent_raw+=("$(printf '0\t%s\tchain:%s(%s/%s)\t%s' "$SM_OVERALL_SUCCESS" "$name" "$total" "$total" "just now")")
                    n_success=$((n_success+1)) ;;
        esac ;;
      epic)
        local ename total done_n running_n failed_n members summary
        IFS=$'\t' read -r _ ename total done_n running_n failed_n members <<< "$rec"
        summary="${done_n}/${total} done"
        (( running_n > 0 )) && summary+="  ${running_n} running"
        (( failed_n > 0 ))  && summary+="  ${failed_n} failed"
        epics+=("$(printf '%s\t%s' "$ename" "$summary")") ;;
    esac
  done < <(bash "${SCRIPT_DIR}/report.sh")

  # Recent = top-3 most-recently-touched (smallest age first).
  local -a recent=()
  if [[ ${#recent_raw[@]} -gt 0 ]]; then
    mapfile -t recent < <(printf '%s\n' "${recent_raw[@]}" | sort -t$'\t' -k1,1n | head -3 | cut -f2-)
  fi

  printf '\n  %stodo-tasks%s%s\n%s\n' "$BOLD" "$RESET" "$EL" "$EL"
  render_active  "${active[@]}"
  render_recent  "${recent[@]}"
  render_pending "${pending[@]}"
  render_drafts  "${drafts[@]}"
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
