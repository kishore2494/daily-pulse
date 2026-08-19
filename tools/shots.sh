#!/usr/bin/env bash
# Generate Play Store phone screenshots (412x820, ratio 1.99 -> inside Play's 2:1 cap).
# browse captures the FULL page, so .topbar/#nav (position:fixed) would otherwise render
# mid-page. We hide them, measure the target's document offset, shoot, then crop.
set -uo pipefail
B=~/.claude/skills/gstack/browse/dist/browse
OUT="${1:?usage: shots.sh <outdir>}"
W=412; H=820
mkdir -p "$OUT"

shoot() {  # name  setup-js  target-selector  [pad]
  local name="$1" setup="$2" sel="$3" pad="${4:-12}"
  $B js "$setup; 'ok'" >/dev/null 2>&1
  sleep 1
  # hide fixed chrome so nothing floats into the middle of the capture
  $B js "document.querySelectorAll('.topbar,#nav').forEach(el=>el.style.visibility='hidden'); 'hidden'" >/dev/null 2>&1
  local y
  y=$($B js "(function(){var el=document.querySelector('$sel'); if(!el) return 0; var r=el.getBoundingClientRect(); return Math.max(0, Math.round(r.top + window.scrollY - $pad));})()" 2>/dev/null | tail -1)
  [ -z "$y" ] && y=0
  $B screenshot "/tmp/_shot_raw.png" >/dev/null 2>&1
  python3 tools/crop.py /tmp/_shot_raw.png "$OUT/$name.png" "$y" "$W" "$H"
  $B js "document.querySelectorAll('.topbar,#nav').forEach(el=>el.style.visibility=''); 'shown'" >/dev/null 2>&1
}

# 1  Log: today ring + on this day  (the reward loop, first impression)
shoot "01-today"     "logDate=todayStr(); loadDraft(); show('today'); window.scrollTo(0,0)"  ".ring-card"  10
# 2  Mood grid with the emotion words revealed
shoot "02-mood-grid" "logDate=todayStr(); loadDraft(); show('today'); var c=document.querySelector('[data-mm=\"9,9\"]'); if(c) c.click()"  ".mm-card"  10
# 3  Year in pixels
shoot "03-year"      "show('dash'); dashTab='overview'; renderDash()"  ".yp-card"  10
# 4  Your patterns (the on-device insight engine)
shoot "04-insights"  "show('dash'); dashTab='overview'; renderDash()"  ".pat-row"  64
# 5  Habits: strength score + skip-aware heatmaps
shoot "05-habits"    "show('habits')"  ".strength-row"  150
# 6  Screen time charts
shoot "06-screentime" "show('dash'); dashTab='health'; renderDash()"  ".card"  10
# 3b year-in-pixels needs the full grid in frame; shoot it tighter

# 7  24-hour timeline
shoot "07-timeline"  "show('time')"  "#s-time .card:nth-of-type(2)"  10
# 8  Menu / breadth
shoot "08-menu"      "show('today'); openDrawer()"  "body"  0
