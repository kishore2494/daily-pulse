#!/usr/bin/env bash
# Bump the release version in ONE place. Keeps three things in lockstep that used to drift:
#   app.js  APP_VERSION      (what More > About shows)
#   sw.js   CACHE            (forces the service worker to re-cache)
#   index.html  ?v= queries  (defeats the WebView HTTP cache + the GitHub Pages edge cache)
# Without the ?v= queries a CSS-only change can sit stale on an installed app for a long
# time - that cost us a full debugging cycle once, so don't hand-edit these.
set -euo pipefail
cd "$(dirname "$0")/.."
CUR=$(grep -m1 -oE "APP_VERSION = 'v[0-9]+'" app.js | grep -oE '[0-9]+')
NEW="${1:-$((CUR + 1))}"
echo "v$CUR -> v$NEW"
perl -pi -e "s/APP_VERSION = 'v$CUR'/APP_VERSION = 'v$NEW'/" app.js
# sw.js's CACHE name is the ONLY thing that changes sw.js's bytes, and a service worker
# re-installs (and therefore re-precaches) only when its bytes change. This substitution
# keyed on $CUR read from app.js, so the moment the two drifted apart it matched nothing and
# `perl -pi` said nothing — a silent no-op. That is exactly what happened: sw.js sat on
# daily-pulse-v214 from 2026-08-27 while the app reached v227, so the SW never re-installed
# and OFFLINE users kept being served the v214 app shell for thirteen releases. Online users
# were fine because the fetch handler is network-first, which is why nobody noticed.
#
# So: substitute on whatever is actually IN sw.js, and verify afterwards.
SW_CUR=$(grep -m1 -oE "daily-pulse-v[0-9]+" sw.js | grep -oE '[0-9]+')
[ -n "$SW_CUR" ] || { echo "!! bump: no daily-pulse-vN cache name found in sw.js"; exit 1; }
[ "$SW_CUR" = "$CUR" ] || echo "   (sw.js was on v$SW_CUR, app.js on v$CUR — they had drifted)"
perl -pi -e "s/daily-pulse-v$SW_CUR/daily-pulse-v$NEW/" sw.js
# add ?v= to local css/js if missing, otherwise update it
perl -pi -e "s/(href=\"styles\.css)(\?v=[0-9]+)?\"/\${1}?v=$NEW\"/" index.html
for f in app.js workout-anims.js workout-plan.js; do
  perl -pi -e "s/(src=\"$f)(\?v=[0-9]+)?\"/\${1}?v=$NEW\"/" index.html
done
echo "--- index.html now references ---"
grep -oE '(href|src)="(styles\.css|app\.js|workout-[a-z]+\.js)\?v=[0-9]+"' index.html
# Verify every substitution actually landed. A bump that silently does nothing is worse than
# one that fails, because the deploy then reports success and ships a stale service worker.
fail=0
grep -q "APP_VERSION = 'v$NEW'" app.js || { echo "!! bump: app.js APP_VERSION was NOT updated"; fail=1; }
grep -q "daily-pulse-v$NEW" sw.js     || { echo "!! bump: sw.js CACHE was NOT updated — offline users would stay on the old shell"; fail=1; }
for f in styles.css app.js workout-anims.js workout-plan.js; do
  grep -q "$f?v=$NEW" index.html || { echo "!! bump: index.html still lacks $f?v=$NEW"; fail=1; }
done
[ "$fail" = 0 ] || { echo "!! bump FAILED — do not deploy this build"; exit 1; }
echo "bump: app.js, sw.js CACHE and all index.html ?v= are on v$NEW"

node --check app.js && echo "app.js syntax OK"
