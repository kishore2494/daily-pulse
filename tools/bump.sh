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
perl -pi -e "s/daily-pulse-v$CUR/daily-pulse-v$NEW/" sw.js
# add ?v= to local css/js if missing, otherwise update it
perl -pi -e "s/(href=\"styles\.css)(\?v=[0-9]+)?\"/\${1}?v=$NEW\"/" index.html
for f in app.js workout-anims.js workout-plan.js; do
  perl -pi -e "s/(src=\"$f)(\?v=[0-9]+)?\"/\${1}?v=$NEW\"/" index.html
done
echo "--- index.html now references ---"
grep -oE '(href|src)="(styles\.css|app\.js|workout-[a-z]+\.js)\?v=[0-9]+"' index.html
node --check app.js && echo "app.js syntax OK"
