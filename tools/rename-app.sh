#!/usr/bin/env bash
# Rename the app's DISPLAY name everywhere.  Usage: tools/rename-app.sh "New Name"
#
# DELIBERATELY NOT CHANGED (would break every installed app / lose Play identity):
#   • hosting URL  https://kishore2494.github.io/daily-pulse/  (native shell loads it)
#   • package id   io.github.kishore2494.dailypulse
#   • bundle filenames DailyPulse.aab / .apk
set -euo pipefail
NEW="${1:?usage: rename-app.sh \"New Name\"}"
NEWNOSP="$(echo "$NEW" | tr -d ' ')"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
NATIVE="$ROOT/../daily-pulse-native/android/app/src/main/res/values/strings.xml"
cd "$ROOT"

FILES=$(grep -rl "Daily Pulse\|DailyPulse" --include="*.html" --include="*.js" --include="*.webmanifest" --include="*.json" --include="*.md" . 2>/dev/null \
  | grep -v "/\.backups/" | grep -v "/node_modules/" | grep -v "/\.git/" | grep -v "LLM wiki from karpathy/log.md")

for f in $FILES; do
  perl -pi -e "s/\QDaily Pulse\E/$NEW/g" "$f"
  perl -pi -e "s/\QDailyPulse\E/$NEWNOSP/g" "$f"
done

# put back the things that must never change
for f in $FILES; do
  perl -pi -e "s|github\.io/[A-Za-z0-9._-]*/|github.io/daily-pulse/|g" "$f"
  perl -pi -e "s/${NEWNOSP}\.aab/DailyPulse.aab/g; s/${NEWNOSP}\.apk/DailyPulse.apk/g" "$f"
  perl -pi -e "s/io\.github\.kishore2494\.[a-z0-9]+/io.github.kishore2494.dailypulse/g" "$f"
  perl -pi -e "s/daily-pulse-v([0-9]+)/daily-pulse-v\$1/g" "$f"
done

if [ -f "$NATIVE" ]; then
  perl -pi -e "s|(<string name=\"app_name\">)[^<]*|\${1}$NEW|; s|(<string name=\"title_activity_main\">)[^<]*|\${1}$NEW|" "$NATIVE"
  echo "✓ native app label → $NEW"
fi

echo "✓ renamed in $(echo "$FILES" | wc -w | tr -d ' ') files"
echo "--- sanity ---"
echo "stale 'Daily Pulse' in app/index/guide/landing: $(grep -c 'Daily Pulse' app.js index.html guide.html landing.html 2>/dev/null | awk -F: '{s+=$2} END {print s+0}')"
echo "hosting url intact: $(grep -c 'github.io/daily-pulse/' index.html app.js guide.html 2>/dev/null | awk -F: '{s+=$2} END {print s+0}') refs"
node --check app.js && echo "app.js syntax OK"
