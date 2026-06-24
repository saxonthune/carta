#!/usr/bin/env bash
# Tabbed TUI dashboard for todo-tasks.
# Usage: bash monitor.sh           — interactive tabbed loop (q to quit)
#        bash monitor.sh --once    — single Overview frame, then exit
#
# A pure renderer over report.sh — it never walks the filesystem or classifies
# state itself. All state comes from the reporter's TSV (including the `age`
# column, so the monitor stays filesystem-free).
#
# Architecture: a slow data tick (~5s) runs report.sh once and caches the parsed
# records into arrays; a fast render tick (~200ms) re-draws the current tab from
# cache only, so the spinner animates, elapsed timers climb, and tab switches
# are instant. The fast read doubles as the frame clock and the keypress reader.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${SCRIPT_DIR}/lib.sh"

NONE="-"

# ── Color setup ──────────────────────────────────────────────────────────────
if [[ -t 1 ]]; then
  BOLD=$(tput bold 2>/dev/null || true)
  DIM=$(tput dim 2>/dev/null || true)
  GREEN=$(tput setaf 2 2>/dev/null || true)
  YELLOW=$(tput setaf 3 2>/dev/null || true)
  RED=$(tput setaf 1 2>/dev/null || true)
  CYAN=$(tput setaf 6 2>/dev/null || true)
  RESET=$(tput sgr0 2>/dev/null || true)
  EL=$'\033[K'
else
  BOLD="" DIM="" GREEN="" YELLOW="" RED="" CYAN="" RESET=""
  EL=""
fi

# ── Glyphs (width-1 only — bash ${#s} counts code points, not display cells,
#    so double-width glyphs would break column alignment) ─────────────────────
SPIN=(⠋ ⠙ ⠹ ⠸ ⠼ ⠴ ⠦ ⠧)
BAR_ON="▰"
BAR_OFF="▱"
PAUSE="‖"
TABS=(Overview Active Done Backlog)

# ── Generic helpers ──────────────────────────────────────────────────────────
age_ago() {
  local age="${1:-0}"
  [[ "$age" =~ ^[0-9]+$ ]] || { echo "?"; return; }
  if   (( age < 3600 ));  then echo "$((age/60))m ago"
  elif (( age < 86400 )); then echo "$((age/3600))h ago"
  else                         echo "$((age/86400))d ago"; fi
}

elapsed_str() {
  local s="${1:-0}"
  [[ "$s" =~ ^[0-9]+$ ]] || { printf '?'; return; }
  if   (( s < 60 ));   then printf '%ds' "$s"
  elif (( s < 3600 )); then printf '%dm%02ds' "$((s/60))" "$((s%60))"
  else                      printf '%dh%02dm' "$((s/3600))" "$(((s%3600)/60))"; fi
}

# truncate STR W — clip STR to W display cells, appending … when it overflows.
truncate() {
  local s="$1" w="$2"
  (( w < 1 )) && w=1
  if (( ${#s} > w )); then
    printf '%s…' "${s:0:w-1}"
  else
    printf '%s' "$s"
  fi
}

# progress_bar DONE TOTAL W — width-W filled/empty bar; guards TOTAL=0.
progress_bar() {
  local done_n="$1" total="$2" w="$3" i filled=0 bar=""
  (( w < 1 )) && w=1
  if (( total > 0 )); then
    filled=$(( done_n * w / total ))
    (( filled > w )) && filled=w
    (( filled < 0 )) && filled=0
  fi
  for ((i=0; i<filled; i++)); do bar+="$BAR_ON"; done
  for ((i=filled; i<w; i++)); do bar+="$BAR_OFF"; done
  printf '%s' "$bar"
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

# ── Data layer (slow tick) ───────────────────────────────────────────────────
# Cache arrays — filled by parse_records, read by every render_* function. Rows
# are tab-joined (report.sh guarantees no tabs in any field, including notes).
RECORDS=()
RUN_TASKS=() CHAINS=() RECENT_TOP=()
BK_ATTENTION=() BK_QUESTIONABLE=() BK_READY=() BK_SUCCESS=() CRASHED=()
PENDING=() DRAFTS=() EPICS=() STALE=()
ARCHIVED=() ARCHIVED_TOP=()
declare -A CHAIN_MEMBER=()
N_RUNNING=0 N_SUCCESS=0 N_READY=0 N_QUESTIONABLE=0 N_ATTENTION=0
N_PENDING=0 N_CRASHED=0 N_CHAINS=0 N_DRAFTS=0 N_EPICS=0 N_STALE=0 N_ARCHIVED=0
LAST_FETCH_EPOCH=0

fetch_data() {
  # Live records + archived records (the latter is a separate report.sh call —
  # archived is deliberately excluded from the default `all` output).
  mapfile -t RECORDS < <(bash "${SCRIPT_DIR}/report.sh"; bash "${SCRIPT_DIR}/report.sh" archived)
  LAST_FETCH_EPOCH=$(date +%s)
  parse_records
}

parse_records() {
  RUN_TASKS=() CHAINS=() RECENT_TOP=()
  BK_ATTENTION=() BK_QUESTIONABLE=() BK_READY=() BK_SUCCESS=() CRASHED=()
  PENDING=() DRAFTS=() EPICS=() STALE=()
  ARCHIVED=() ARCHIVED_TOP=()
  CHAIN_MEMBER=()
  N_RUNNING=0 N_SUCCESS=0 N_READY=0 N_QUESTIONABLE=0 N_ATTENTION=0
  N_PENDING=0 N_CRASHED=0 N_CHAINS=0 N_DRAFTS=0 N_EPICS=0 N_STALE=0 N_ARCHIVED=0

  local -a recent_raw=() archived_raw=()
  local rec type
  for rec in "${RECORDS[@]}"; do
    [[ -z "$rec" ]] && continue
    IFS=$'\t' read -r type _ <<< "$rec"
    case "$type" in
      task)
        local slug phase overall bucket commits worktree branch age notes row
        IFS=$'\t' read -r _ slug phase overall bucket commits worktree branch age notes <<< "$rec"
        case "$phase" in
          running)
            RUN_TASKS+=("$(printf '%s\t%s\t%s\t%s\t%s' "$slug" "$commits" "$branch" "$worktree" "$age")")
            N_RUNNING=$((N_RUNNING+1)) ;;
          pending)
            PENDING+=("$slug"); N_PENDING=$((N_PENDING+1)) ;;
          draft)
            DRAFTS+=("$slug"); N_DRAFTS=$((N_DRAFTS+1)) ;;
          done)
            recent_raw+=("$(printf '%s\t%s\t%s\t%s\t%s' "$age" "$overall" "$slug" "$commits" "$notes")")
            row="$(printf '%s\t%s\t%s\t%s' "$slug" "$overall" "$commits" "$notes")"
            case "$bucket" in
              "$SM_BUCKET_ATTENTION")    BK_ATTENTION+=("$row");    N_ATTENTION=$((N_ATTENTION+1)) ;;
              "$SM_BUCKET_QUESTIONABLE") BK_QUESTIONABLE+=("$row"); N_QUESTIONABLE=$((N_QUESTIONABLE+1)) ;;
              "$SM_BUCKET_READY")        BK_READY+=("$row");        N_READY=$((N_READY+1)) ;;
              "$SM_BUCKET_SUCCESS")      BK_SUCCESS+=("$row");       N_SUCCESS=$((N_SUCCESS+1)) ;;
            esac ;;
          crashed)
            recent_raw+=("$(printf '%s\t%s\t%s\t%s\t%s' "$age" "$overall" "$slug" "$commits" "$notes")")
            CRASHED+=("$(printf '%s\t%s\t%s\t%s\t%s' "$slug" "$overall" "$commits" "$worktree" "$notes")")
            N_CRASHED=$((N_CRASHED+1)) ;;
        esac ;;
      chain)
        local name cstatus done_n total current phases cw cb
        IFS=$'\t' read -r _ name cstatus done_n total current phases cw cb <<< "$rec"
        case "$cstatus" in
          complete)
            # A completed chain counts as a success and surfaces in Recent.
            recent_raw+=("$(printf '0\t%s\t%s\t%s\t%s' "$SM_OVERALL_SUCCESS" "chain:${name}" "$NONE" "$NONE")")
            N_SUCCESS=$((N_SUCCESS+1)) ;;
          *)
            CHAINS+=("$(printf '%s\t%s\t%s\t%s\t%s\t%s\t%s\t%s' "$name" "$cstatus" "$done_n" "$total" "$current" "$phases" "$cw" "$cb")")
            N_CHAINS=$((N_CHAINS+1)) ;;
        esac ;;
      epic)
        local ename etotal edone erunning efailed members
        IFS=$'\t' read -r _ ename etotal edone erunning efailed members <<< "$rec"
        EPICS+=("$(printf '%s\t%s\t%s\t%s\t%s' "$ename" "$etotal" "$edone" "$erunning" "$efailed")")
        N_EPICS=$((N_EPICS+1)) ;;
      stale)
        local sslug swt
        IFS=$'\t' read -r _ sslug swt <<< "$rec"
        STALE+=("$(printf '%s\t%s' "$sslug" "$swt")")
        N_STALE=$((N_STALE+1)) ;;
      archived)
        local aslug aoverall acommits aage anotes
        IFS=$'\t' read -r _ aslug aoverall acommits aage anotes <<< "$rec"
        archived_raw+=("$(printf '%s\t%s\t%s\t%s\t%s' "$aage" "$aoverall" "$aslug" "$acommits" "$anotes")")
        N_ARCHIVED=$((N_ARCHIVED+1)) ;;
    esac
  done

  # Recent = top-3 most-recently-touched (smallest age first), sorted once here.
  if (( ${#recent_raw[@]} > 0 )); then
    mapfile -t RECENT_TOP < <(printf '%s\n' "${recent_raw[@]}" | sort -t$'\t' -k1,1n | head -3)
  fi
  # Archived = all sorted by most-recently-archived; ARCHIVED_TOP is the top-3.
  if (( ${#archived_raw[@]} > 0 )); then
    mapfile -t ARCHIVED     < <(printf '%s\n' "${archived_raw[@]}" | sort -t$'\t' -k1,1n)
    mapfile -t ARCHIVED_TOP < <(printf '%s\n' "${ARCHIVED[@]}" | head -3)
  fi

  # Build chain-member set (all phases of active chains) and filter PENDING to
  # exclude chain phases — they belong to the chains block, not the flat list.
  local _cm_phases _ph_slug
  local -a _ph_arr=() _pending_show=()
  if [[ ${#CHAINS[@]} -gt 0 ]]; then
    local _ce
    for _ce in "${CHAINS[@]}"; do
      _cm_phases=""
      IFS=$'\t' read -r _ _ _ _ _ _cm_phases _ _ <<< "$_ce"
      IFS=',' read -ra _ph_arr <<< "$_cm_phases"
      for _ph_slug in "${_ph_arr[@]}"; do
        [[ -n "$_ph_slug" ]] && CHAIN_MEMBER["$_ph_slug"]=1
      done
    done
  fi
  local _ps
  for _ps in "${PENDING[@]}"; do
    [[ -n "${CHAIN_MEMBER[$_ps]:-}" ]] || _pending_show+=("$_ps")
  done
  PENDING=("${_pending_show[@]+"${_pending_show[@]}"}")
  N_PENDING=${#PENDING[@]}
}

# ── Render layer (fast tick, cache-only) ─────────────────────────────────────
render_header() {
  local clock done_total
  clock="$(date +%H:%M:%S)"
  done_total=$(( N_SUCCESS + N_READY + N_QUESTIONABLE + N_ATTENTION + N_CRASHED ))
  printf ' %stodo-tasks%s  %s%d running · %d done · %d pending%s  %s%s%s%s\n' \
    "$BOLD" "$RESET" "$DIM" "$N_RUNNING" "$done_total" "$N_PENDING" "$RESET" \
    "$CYAN" "$clock" "$RESET" "$EL"
  printf '%s\n' "$EL"
}

render_overview() {
  render_header
  local now delta spin sw
  now=$(date +%s); delta=$(( now - LAST_FETCH_EPOCH ))
  spin="${SPIN[$SPIN_I]}"
  sw=$(( COLS - 26 )); (( sw < 8 )) && sw=8

  if (( N_RUNNING > 0 )); then
    printf ' %sActive%s%s\n' "$BOLD" "$RESET" "$EL"
    # One compact line per task: spinner, slug (fixed width so the right-side
    # items sit close in, not at the screen edge), elapsed, commits, branch —
    # the branch is clipped to whatever space is left so the line never wraps.
    local e slug commits branch worktree age live aslugw bw
    aslugw=32; (( aslugw > COLS - 24 )) && aslugw=$(( COLS - 24 )); (( aslugw < 8 )) && aslugw=8
    for e in "${RUN_TASKS[@]}"; do
      IFS=$'\t' read -r slug commits branch worktree age <<< "$e"
      live=$(( age + delta ))
      bw=$(( COLS - 4 - aslugw - 1 - 7 - 2 - ${#commits} - 1 - 2 )); (( bw < 0 )) && bw=0
      printf '  %s%s%s %-*s %s%7s%s  %s%sc  %s%s%s\n' \
        "$YELLOW" "$spin" "$RESET" \
        "$aslugw" "$(truncate "$slug" "$aslugw")" \
        "$CYAN" "$(age_ago "$live")" "$RESET" \
        "$DIM" "$commits" "$(truncate "$branch" "$bw")" "$RESET" "$EL"
    done
    printf '%s\n' "$EL"
  fi

  if (( N_CHAINS > 0 )); then
    printf ' %sChains%s%s\n' "$BOLD" "$RESET" "$EL"
    render_chains
    printf '%s\n' "$EL"
  fi

  if (( ${#RECENT_TOP[@]} > 0 )); then
    printf ' %sRecent%s%s\n' "$BOLD" "$RESET" "$EL"
    local e age overall slug commits notes col lbl nw slugw
    nw=$(( COLS - 40 )); (( nw < 6 )) && nw=6
    slugw=$(( sw > 20 ? 20 : sw ))
    for e in "${RECENT_TOP[@]}"; do
      IFS=$'\t' read -r age overall slug commits notes <<< "$e"
      col="$(overall_color "$overall")"; lbl="$(overall_label "$overall")"
      local note_disp=""
      [[ "$notes" != "$NONE" && -n "$notes" ]] && note_disp="$(truncate "$notes" "$nw")"
      printf '  %s%-10s%s %-*s %s%s · %sc %s%s%s\n' \
        "$col" "$lbl" "$RESET" \
        "$slugw" "$(truncate "$slug" "$slugw")" \
        "$DIM" "$(age_ago "$age")" "$commits" "$note_disp" "$RESET" "$EL"
    done
    printf '%s\n' "$EL"
  fi

  if (( N_ARCHIVED > 0 )); then
    printf ' %sRecently archived%s%s\n' "$BOLD" "$RESET" "$EL"
    render_archived_rows "${ARCHIVED_TOP[@]}"
    printf '%s\n' "$EL"
  fi

  if (( N_EPICS > 0 )); then
    printf ' %sEpics%s%s\n' "$BOLD" "$RESET" "$EL"
    local e name total done_n running failed bar
    for e in "${EPICS[@]}"; do
      IFS=$'\t' read -r name total done_n running failed <<< "$e"
      bar="$(progress_bar "$done_n" "$total" 10)"
      printf '  %s%s%s %s%s%s %d/%d%s\n' \
        "$CYAN" "$(truncate "$name" "$sw")" "$RESET" "$GREEN" "$bar" "$RESET" "$done_n" "$total" "$EL"
    done
    printf '%s\n' "$EL"
  fi

  if (( N_PENDING > 0 )); then
    printf ' %sPending%s%s\n' "$BOLD" "$RESET" "$EL"
    local s pending_line=""
    for s in "${PENDING[@]}"; do
      [[ -n "$pending_line" ]] && pending_line+=" · "
      pending_line+="$s"
    done
    printf '  %s%s%s%s\n' "$DIM" "$(truncate "$pending_line" $((COLS-4)))" "$RESET" "$EL"
    printf '%s\n' "$EL"
  fi

  printf '  %s%d running  %d success  %d ready  %d questionable  %d attention  %d pending%s%s\n' \
    "$DIM" "$N_RUNNING" "$N_SUCCESS" "$N_READY" "$N_QUESTIONABLE" "$N_ATTENTION" "$N_PENDING" "$RESET" "$EL"
  return 0
}

render_active() {
  render_header
  local now delta spin
  now=$(date +%s); delta=$(( now - LAST_FETCH_EPOCH ))
  spin="${SPIN[$SPIN_I]}"

  if (( N_RUNNING == 0 && N_CHAINS == 0 )); then
    printf ' %sno active agents or chains%s%s\n' "$DIM" "$RESET" "$EL"
    return
  fi

  if (( N_RUNNING > 0 )); then
    printf ' %sRunning agents%s%s\n' "$BOLD" "$RESET" "$EL"
    local e slug commits branch worktree age live
    for e in "${RUN_TASKS[@]}"; do
      IFS=$'\t' read -r slug commits branch worktree age <<< "$e"
      live=$(( age + delta ))
      printf '  %s%s%s %s%s%s%s\n' "$YELLOW" "$spin" "$RESET" "$BOLD" "$slug" "$RESET" "$EL"
      printf '      %slast seen%s %s · %scommits%s %s · %sbranch%s %s%s\n' \
        "$DIM" "$RESET" "$(age_ago "$live")" \
        "$DIM" "$RESET" "$commits" \
        "$DIM" "$RESET" "$branch" "$EL"
      [[ "$worktree" != "$NONE" ]] && printf '      %sworktree%s %s%s\n' "$DIM" "$RESET" "$worktree" "$EL"
    done
    printf '%s\n' "$EL"
  fi

  if (( N_CHAINS > 0 )); then
    printf ' %sChains%s%s\n' "$BOLD" "$RESET" "$EL"
    local e name cstatus done_n total current phases cw cb col
    local -a ph_arr=()
    local i ph ph_start
    for e in "${CHAINS[@]}"; do
      IFS=$'\t' read -r name cstatus done_n total current phases cw cb <<< "$e"
      col="$YELLOW"; [[ "$cstatus" == failed ]] && col="$RED"
      case "$cstatus" in
        running)
          printf '  %s%s%s  %srunning%s  phase %d/%d: %s%s\n' \
            "$BOLD" "$name" "$RESET" \
            "$col" "$RESET" "$(( done_n + 1 ))" "$total" "$(truncate "$current" 30)" "$EL" ;;
        failed)
          printf '  %s%s%s  %sfailed at phase %d/%d: %s%s%s\n' \
            "$BOLD" "$name" "$RESET" \
            "$col" "$(( done_n + 1 ))" "$total" "$(truncate "$current" 30)" "$RESET" "$EL" ;;
        waiting)
          printf '  %s%s%s  %swaiting%s  %s%s%s\n' \
            "$BOLD" "$name" "$RESET" "$col" "$RESET" "$DIM" "$(truncate "$current" 40)" "$EL" ;;
      esac
      [[ "$cw" != "$NONE" ]] && printf '      %sworktree%s %s%s\n' "$DIM" "$RESET" "$cw" "$EL"
      IFS=',' read -ra ph_arr <<< "$phases"
      if [[ "$cstatus" == "waiting" ]]; then ph_start=0; else ph_start=$(( done_n + 1 )); fi
      for (( i = ph_start; i < ${#ph_arr[@]}; i++ )); do
        ph="${ph_arr[$i]}"
        [[ -n "$ph" ]] && printf '      %squeued%s  %s%s\n' "$DIM" "$RESET" "$ph" "$EL"
      done
    done
  fi
  return 0
}

# render_archived_rows ROW... — one compact line per archived task. Old-format
# archives (overall "-") render as a dim "archived" label.
render_archived_rows() {
  local e age overall slug commits notes col lbl cdisp slugw
  slugw=$(( COLS - 30 )); (( slugw < 8 )) && slugw=8; (( slugw > 28 )) && slugw=28
  for e in "$@"; do
    IFS=$'\t' read -r age overall slug commits notes <<< "$e"
    if [[ "$overall" == "$NONE" ]]; then
      col="$DIM"; lbl="archived"
    else
      col="$(overall_color "$overall")"; lbl="$(overall_label "$overall")"
    fi
    cdisp=""
    [[ "$commits" != "$NONE" ]] && cdisp="${commits}c"
    printf '  %s%-10s%s %-*s %s%s %s%s%s\n' \
      "$col" "$lbl" "$RESET" \
      "$slugw" "$(truncate "$slug" "$slugw")" \
      "$DIM" "$(age_ago "$age")" "$cdisp" "$RESET" "$EL"
  done
  return 0
}

render_chains() {
  [[ ${#CHAINS[@]} -eq 0 ]] && return
  local e name cstatus done_n total current phases cw cb col
  local -a ph_arr=()
  local i ph ph_start nw
  nw=$(( COLS - 44 )); (( nw < 10 )) && nw=10
  for e in "${CHAINS[@]}"; do
    IFS=$'\t' read -r name cstatus done_n total current phases cw cb <<< "$e"
    col="$YELLOW"
    [[ "$cstatus" == "failed" ]] && col="$RED"
    case "$cstatus" in
      running)
        printf '  %s%s%s  %srunning%s  phase %d/%d: %s%s\n' \
          "$BOLD" "$(truncate "$name" 24)" "$RESET" \
          "$col" "$RESET" "$(( done_n + 1 ))" "$total" \
          "$(truncate "$current" "$nw")" "$EL" ;;
      failed)
        printf '  %s%s%s  %sfailed at phase %d/%d: %s%s%s\n' \
          "$BOLD" "$(truncate "$name" 24)" "$RESET" \
          "$col" "$(( done_n + 1 ))" "$total" \
          "$(truncate "$current" "$nw")" "$RESET" "$EL" ;;
      waiting)
        printf '  %s%s%s  %swaiting%s  %s%s%s\n' \
          "$BOLD" "$(truncate "$name" 24)" "$RESET" \
          "$col" "$RESET" "$DIM" "$(truncate "$current" "$nw")" "$EL" ;;
    esac
    # Indented upcoming phases (done phases hidden, current phase named above)
    IFS=',' read -ra ph_arr <<< "$phases"
    if [[ "$cstatus" == "waiting" ]]; then
      ph_start=0
    else
      ph_start=$(( done_n + 1 ))
    fi
    for (( i = ph_start; i < ${#ph_arr[@]}; i++ )); do
      ph="${ph_arr[$i]}"
      [[ -n "$ph" ]] && printf '    %squeued%s  %s%s\n' "$DIM" "$RESET" "$ph" "$EL"
    done
  done
}

render_done_bucket() {
  local title="$1"; shift
  printf ' %s%s%s%s\n' "$BOLD" "$title" "$RESET" "$EL"
  local e slug overall commits notes col lbl
  for e in "$@"; do
    IFS=$'\t' read -r slug overall commits notes <<< "$e"
    col="$(overall_color "$overall")"; lbl="$(overall_label "$overall")"
    printf '  %s%-11s%s %s  %s%sc%s%s\n' \
      "$col" "$lbl" "$RESET" "$(truncate "$slug" $((COLS-22)))" "$DIM" "$commits" "$RESET" "$EL"
    [[ "$notes" != "$NONE" && -n "$notes" ]] && \
      printf '      %s%s%s%s\n' "$DIM" "$(truncate "$notes" $((COLS-8)))" "$RESET" "$EL"
  done
  printf '%s\n' "$EL"
}

render_done() {
  render_header
  local total_done=$(( N_ATTENTION + N_QUESTIONABLE + N_READY + N_SUCCESS + N_CRASHED ))
  if (( total_done == 0 && N_ARCHIVED == 0 )); then
    printf ' %sno completed agents%s%s\n' "$DIM" "$RESET" "$EL"
    return
  fi

  (( N_ATTENTION > 0 ))    && render_done_bucket "Needs attention"  "${BK_ATTENTION[@]}"
  (( N_QUESTIONABLE > 0 )) && render_done_bucket "Questionable"     "${BK_QUESTIONABLE[@]}"
  (( N_READY > 0 ))        && render_done_bucket "Ready for review" "${BK_READY[@]}"
  (( N_SUCCESS > 0 ))      && render_done_bucket "Success"          "${BK_SUCCESS[@]}"

  if (( N_CRASHED > 0 )); then
    printf ' %sCrashed%s%s\n' "$BOLD" "$RESET" "$EL"
    local e slug overall commits worktree notes col lbl
    for e in "${CRASHED[@]}"; do
      IFS=$'\t' read -r slug overall commits worktree notes <<< "$e"
      col="$(overall_color "$overall")"; lbl="$(overall_label "$overall")"
      printf '  %s%-11s%s %s  %s%sc%s%s\n' \
        "$col" "$lbl" "$RESET" "$(truncate "$slug" $((COLS-22)))" "$DIM" "$commits" "$RESET" "$EL"
      [[ "$notes" != "$NONE" && -n "$notes" ]] && \
        printf '      %s%s%s%s\n' "$DIM" "$(truncate "$notes" $((COLS-8)))" "$RESET" "$EL"
    done
    printf '%s\n' "$EL"
  fi

  if (( N_ARCHIVED > 0 )); then
    # Cap the list so the screen stays scoped; surface what was dropped.
    local cap=10
    printf ' %sRecently archived%s%s\n' "$BOLD" "$RESET" "$EL"
    render_archived_rows "${ARCHIVED[@]:0:cap}"
    (( N_ARCHIVED > cap )) && printf '  %s+%d more archived%s%s\n' "$DIM" "$((N_ARCHIVED-cap))" "$RESET" "$EL"
  fi
  return 0
}

render_backlog() {
  render_header
  local empty=1 s
  if (( N_PENDING > 0 )); then
    empty=0
    printf ' %sPending%s%s\n' "$BOLD" "$RESET" "$EL"
    for s in "${PENDING[@]}"; do printf '  %spending%s  %s%s\n' "$DIM" "$RESET" "$s" "$EL"; done
    printf '%s\n' "$EL"
  fi
  if (( N_DRAFTS > 0 )); then
    empty=0
    printf ' %sDrafts%s%s\n' "$BOLD" "$RESET" "$EL"
    for s in "${DRAFTS[@]}"; do printf '  %sdraft%s    %s%s\n' "$DIM" "$RESET" "$s" "$EL"; done
    printf '%s\n' "$EL"
  fi
  if (( N_EPICS > 0 )); then
    empty=0
    printf ' %sEpics%s%s\n' "$BOLD" "$RESET" "$EL"
    local e name total done_n running failed bar
    for e in "${EPICS[@]}"; do
      IFS=$'\t' read -r name total done_n running failed <<< "$e"
      bar="$(progress_bar "$done_n" "$total" 10)"
      printf '  %s%s%s %s%s%s %d/%d%s\n' \
        "$CYAN" "$name" "$RESET" "$GREEN" "$bar" "$RESET" "$done_n" "$total" "$EL"
    done
    printf '%s\n' "$EL"
  fi
  if (( N_STALE > 0 )); then
    empty=0
    printf ' %sStale worktrees%s%s\n' "$BOLD" "$RESET" "$EL"
    local e slug wt
    for e in "${STALE[@]}"; do
      IFS=$'\t' read -r slug wt <<< "$e"
      printf '  %s%s%s  %s%s%s%s\n' "$YELLOW" "$slug" "$RESET" "$DIM" "$wt" "$RESET" "$EL"
    done
    printf '%s\n' "$EL"
  fi
  (( empty == 1 )) && printf ' %sbacklog empty%s%s\n' "$DIM" "$RESET" "$EL"
  return 0
}

render_tab() {
  case "$CUR_TAB" in
    0) render_overview ;;
    1) render_active ;;
    2) render_done ;;
    3) render_backlog ;;
  esac
}

render_footer() {
  printf '%s\n' "$EL"
  local i out=""
  for i in 0 1 2 3; do
    if (( i == CUR_TAB )); then
      out+="${BOLD}${CYAN}[$((i+1))]${TABS[$i],,}${RESET}  "
    else
      out+="${DIM}$((i+1)) ${TABS[$i],,}${RESET}  "
    fi
  done
  printf ' %s  %s←/→ switch · q quit%s%s\n' "$out" "$DIM" "$RESET" "$EL"
}

draw() {
  COLS=$(tput cols 2>/dev/null || echo 80)
  LINES=$(tput lines 2>/dev/null || echo 24)
  if $need_full_clear; then
    tput clear 2>/dev/null || printf '\033[H\033[2J'
    need_full_clear=false
  else
    tput cup 0 0 2>/dev/null || printf '\033[H'
  fi
  render_tab
  render_footer
  tput ed 2>/dev/null || printf '\033[J'
}

# ── Main ─────────────────────────────────────────────────────────────────────
ONCE=false
for arg in "$@"; do
  [[ "$arg" == "--once" ]] && ONCE=true
done
[[ ! -t 1 ]] && ONCE=true

SPIN_I=0
CUR_TAB=0

if $ONCE; then
  COLS=$(tput cols 2>/dev/null || echo 80)
  LINES=$(tput lines 2>/dev/null || echo 24)
  fetch_data
  render_overview
  render_footer
  exit 0
fi

# Fractional read -t needs bash 4+. On bash 3.2 fall back to a 1s integer tick
# and skip arrow parsing — number keys and q still work.
if (( BASH_VERSINFO[0] >= 4 )); then
  HAS_FRAC_READ=true; TICK=0.2
else
  HAS_FRAC_READ=false; TICK=1
fi

tput civis 2>/dev/null || true
cleanup() {
  tput cnorm 2>/dev/null || true
  tput clear 2>/dev/null || true
  exit 0
}
trap cleanup INT TERM

fetch_data
need_full_clear=true
while true; do
  now=$(date +%s)
  (( now - LAST_FETCH_EPOCH >= 5 )) && fetch_data
  draw
  SPIN_I=$(( (SPIN_I + 1) % ${#SPIN[@]} ))

  key=""
  read -rsn1 -t"$TICK" key || true
  case "$key" in
    q) cleanup ;;
    1) (( CUR_TAB != 0 )) && need_full_clear=true; CUR_TAB=0 ;;
    2) (( CUR_TAB != 1 )) && need_full_clear=true; CUR_TAB=1 ;;
    3) (( CUR_TAB != 2 )) && need_full_clear=true; CUR_TAB=2 ;;
    4) (( CUR_TAB != 3 )) && need_full_clear=true; CUR_TAB=3 ;;
    $'\e')
      # Arrow = 3-byte escape sequence; grab the trailing 2 bytes. A bare ESC
      # (empty rest) and Up/Down ([A/[B) are deliberately ignored.
      if $HAS_FRAC_READ; then
        rest=""
        read -rsn2 -t0.0005 rest || true
        case "$rest" in
          '[C'|'OC') CUR_TAB=$(( (CUR_TAB + 1) % 4 )); need_full_clear=true ;;
          '[D'|'OD') CUR_TAB=$(( (CUR_TAB + 3) % 4 )); need_full_clear=true ;;
        esac
      fi ;;
  esac
done
