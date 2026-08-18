#!/usr/bin/env bash
# Rename the app's DISPLAY name everywhere.   Usage: tools/rename-app.sh "New Name"
#
# NOT CHANGED on purpose (changing these breaks installed apps / Play identity):
#   • hosting URL   https://kishore2494.github.io/daily-pulse/   (the native shell loads it)
#   • package id    io.github.kishore2494.dailypulse
#   • bundle files  DailyPulse.aab / DailyPulse.apk
#   • sw cache key  daily-pulse-vNNN
#   • "LLM wiki from karpathy/"  — historical record, keeps the old name deliberately
set -euo pipefail
NEW="${1:?usage: rename-app.sh \"New Name\"}"
NEWNOSP="$(echo "$NEW" | tr -d ' ')"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
NATIVE="$ROOT/../daily-pulse-native/android/app/src/main/res/values/strings.xml"
cd "$ROOT"

n=0
while IFS= read -r f; do
  [ -f "$f" ] || continue
  perl -pi -e "s/\QDaily Pulse\E/$NEW/g; s/\QDailyPulse\E/$NEWNOSP/g" "$f"
  perl -pi -e "s|github\.io/[A-Za-z0-9._-]*/|github.io/daily-pulse/|g" "$f"
  perl -pi -e "s/\Q$NEWNOSP\E\.aab/DailyPulse.aab/g; s/\Q$NEWNOSP\E\.apk/DailyPulse.apk/g" "$f"
  perl -pi -e "s/io\.github\.kishore2494\.[a-z0-9]+/io.github.kishore2494.dailypulse/g" "$f"
  n=$((n+1))
done < <(grep -rl "Daily Pulse\|DailyPulse" \
          --include="*.html" --include="*.js" --include="*.webmanifest" --include="*.json" --include="*.md" . 2>/dev/null \
          | grep -v "/\.backups/" | grep -v "/node_modules/" | grep -v "/\.git/" | grep -v "LLM wiki from karpathy/")

if [ -f "$NATIVE" ]; then
  perl -pi -e "s|(<string name=\"app_name\">)[^<]*|\${1}$NEW|; s|(<string name=\"title_activity_main\">)[^<]*|\${1}$NEW|" "$NATIVE"
  echo "✓ native app label → $NEW"
fi

echo "✓ renamed \"Daily Pulse\" → \"$NEW\" in $n files"
echo "--- sanity ---"
echo "stale old name (app/index/guide/landing/privacy): $(cat app.js index.html guide.html landing.html privacy.html 2>/dev/null | grep -c 'Daily Pulse')"
echo "hosting url refs intact                         : $(cat app.js index.html guide.html landing.html 2>/dev/null | grep -c 'github.io/daily-pulse/')"
echo "sw cache key intact                             : $(grep -c 'daily-pulse-v' sw.js)"
node --check app.js && echo "app.js syntax OK"
