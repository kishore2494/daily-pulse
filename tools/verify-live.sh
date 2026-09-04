#!/usr/bin/env bash
# Confirm the LIVE site is serving a version consistently across every file that carries one.
#
#   tools/verify-live.sh            check the version in app.js
#   tools/verify-live.sh v231       check a specific version
#
# deploy.sh used to confirm a release by fetching app.js and nothing else — and app.js is the
# one file that was never the problem. sw.js sat on daily-pulse-v214 for THIRTEEN releases while
# app.js advanced normally, so every one of those deploys would have printed "LIVE: serving
# vNNN" while offline users were served a v214 shell.
#
# check-release.mjs stops that drift reaching the repo. This stops a partial DEPLOY — a CDN
# holding one file, or an artifact missing one — from being reported as shipped.
#
# Exits non-zero if any file disagrees, so a script or a person can act on it.
set -euo pipefail

LIVE="https://kishore2494.github.io/daily-pulse"
cd "$(dirname "$0")/.."

VER="${1:-$(grep -m1 -oE "APP_VERSION = 'v[0-9]+'" app.js | grep -oE 'v[0-9]+')}"
[ -n "$VER" ] || { echo "!! could not determine a version to check"; exit 1; }
NUM="${VER#v}"

echo "expecting $VER across app.js, sw.js and index.html"

fetch() { curl -s --max-time 25 "$1?cb=$RANDOM$RANDOM"; }

APPGOT=$(fetch "$LIVE/app.js"  | grep -m1 -oE "APP_VERSION = 'v[0-9]+'" | grep -oE 'v[0-9]+' || true)
SWGOT=$( fetch "$LIVE/sw.js"   | grep -m1 -oE 'daily-pulse-v[0-9]+' || true)
IXGOT=$( fetch "$LIVE/"        | grep -m1 -oE 'app\.js\?v=[0-9]+' || true)

printf "  %-10s %s\n" "app.js"   "${APPGOT:-no response}"
printf "  %-10s %s\n" "sw.js"    "${SWGOT:-no response}"
printf "  %-10s %s\n" "index"    "${IXGOT:-no response}"

BAD=0
[ "$APPGOT" = "$VER" ]              || { echo "!! app.js is ${APPGOT:-unreadable}, expected $VER"; BAD=1; }
[ "$SWGOT"  = "daily-pulse-$VER" ]  || { echo "!! sw.js is ${SWGOT:-unreadable}, expected daily-pulse-$VER — OFFLINE users would get a stale shell"; BAD=1; }
[ "$IXGOT"  = "app.js?v=$NUM" ]     || { echo "!! index.html references ${IXGOT:-nothing}, expected app.js?v=$NUM"; BAD=1; }

if [ "$BAD" = "1" ]; then
  echo
  echo "NOT consistently deployed. Do not report this as shipped — re-dispatch the Pages build:"
  echo "  gh workflow run pages.yml --repo kishore2494/daily-pulse --ref main"
  exit 1
fi

echo "LIVE: $LIVE is serving $VER — app.js, sw.js and index.html all agree"
