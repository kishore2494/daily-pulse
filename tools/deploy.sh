#!/usr/bin/env bash
# Deploy the web app, and PROVE it went live.
#
# Why this script exists: this repo has TWO remotes and they are not interchangeable.
#
#   origin -> github.com/kishore2494/jurnal-app     (source mirror)
#   prod   -> github.com/kishore2494/daily-pulse    (what the app ACTUALLY loads)
#
# capacitor.config.json points the installed Android app at
# https://kishore2494.github.io/daily-pulse/ — the *prod* remote. Pushing only to origin
# looks completely successful and changes nothing for a single real user. That mistake was
# made and it cost a whole batch of work sitting undeployed while it read as shipped.
#
# It also does not trust the `on: push` trigger. Observed on this repo: a push to prod/main
# landed and registered NO workflow run at all, so the site stayed on the previous version
# with every command reporting success. The workflow is therefore dispatched explicitly and
# the LIVE URL is polled until it serves the expected version. Nothing here reports success
# on the strength of a git exit code.
#
# Usage:  tools/deploy.sh              # deploy current HEAD
#         tools/deploy.sh --tag        # also create+push a per-version snapshot tag
set -uo pipefail
cd "$(dirname "$0")/.."

LIVE="https://kishore2494.github.io/daily-pulse"
WANT_TAG=0
[ "${1:-}" = "--tag" ] && WANT_TAG=1

VER=$(grep -m1 -oE "APP_VERSION = 'v[0-9]+'" app.js | grep -oE 'v[0-9]+')
[ -z "$VER" ] && { echo "!! could not read APP_VERSION from app.js"; exit 1; }
echo "==> deploying $VER"

DIRTY=$(git status --porcelain | wc -l | tr -d ' ')
if [ "$DIRTY" != "0" ]; then
  echo "!! working tree has $DIRTY uncommitted file(s). Commit first — a deploy must be"
  echo "   reproducible from a commit, or the live site and the repo disagree."
  git status --short
  exit 1
fi

# One token, fetched once, never written to disk.
GHT=$(gh auth token -u kishore2494 2>/dev/null)
[ -z "$GHT" ] && { echo "!! no kishore2494 token from gh; run: gh auth login"; exit 1; }
export GHT
HELPER='!f(){ test "$1" = get && printf "username=kishore2494\npassword=%s\n" "$GHT"; }; f'
gitp() { git -c credential.helper= -c credential.helper="$HELPER" "$@"; }

# One shared checker (also run in CI): version consistency across app.js / sw.js /
# index.html, every precache entry present, and no third-party runtime assets. Runs BEFORE
# the push — a guard placed after it cannot stop anything, which is a mistake this script
# has already made once.
echo "==> release consistency check"
node tools/check-release.mjs || { echo "!! release check failed — refusing to deploy"; exit 1; }
node tools/check-backup-keys.mjs || { echo "!! a stored key is neither backed up nor excluded — refusing to deploy"; exit 1; }
node tools/check-readme.mjs || { echo "!! README and tools/ disagree — refusing to deploy"; exit 1; }
node tools/check-import.mjs || { echo "!! the backup-import validator does not reject bad files — refusing to deploy"; exit 1; }
node tools/gen-sitemap.mjs --check || { echo "!! sitemap.xml does not match the pages on disk — refusing to deploy"; exit 1; }
node tools/check-links.mjs || { echo "!! a page links somewhere that does not exist — refusing to deploy"; exit 1; }
node tools/check-overlap.mjs || { echo "!! overlap detection is broken — refusing to deploy"; exit 1; }
node tools/check-money.mjs || { echo "!! amount parsing is wrong — refusing to deploy"; exit 1; }
node tools/check-sync.mjs || { echo "!! the sync path accepts malformed sections — refusing to deploy"; exit 1; }
node tools/check-export.mjs || { echo "!! the CSV escaper is broken — refusing to deploy"; exit 1; }

for R in origin prod; do
  echo "==> push $R"
  gitp push "$R" HEAD:main || { echo "!! push to $R failed"; exit 1; }
done

if [ "$WANT_TAG" = "1" ]; then
  TAG="web-$VER"
  if git rev-parse -q --verify "refs/tags/$TAG" >/dev/null; then
    echo "==> tag $TAG already exists, leaving it alone"
  else
    git tag -a "$TAG" -m "web $VER — deployed $(date -u +%Y-%m-%dT%H:%MZ)"
    for R in origin prod; do gitp push "$R" "$TAG" >/dev/null 2>&1 && echo "==> tag $TAG -> $R"; done
  fi
fi

echo "==> dispatching Pages build on prod (never trust the push trigger)"
GH_TOKEN="$GHT" gh workflow run pages.yml --repo kishore2494/daily-pulse --ref main >/dev/null 2>&1 \
  || echo "   (dispatch call failed; a push-triggered run may still exist)"

echo "==> waiting for the build"
for i in $(seq 1 24); do
  sleep 15
  S=$(GH_TOKEN="$GHT" gh run list --repo kishore2494/daily-pulse --limit 1 \
        --json status,conclusion -q '.[0]|"\(.status)/\(.conclusion)"' 2>/dev/null)
  echo "   build poll $i: ${S:-unknown}"
  case "$S" in
    completed/success) break;;
    completed/failure|completed/cancelled)
      echo "!! Pages build failed. A wedged build holds the deployment lock and blocks every"
      echo "   later deploy — check it and re-dispatch:"
      echo "   gh run list --repo kishore2494/daily-pulse"
      exit 1;;
  esac
done

echo "==> confirming the LIVE url actually serves $VER"
# Poll until app.js turns over, then hand off to tools/verify-live.sh, which checks sw.js and
# index.html as well. app.js alone is not a release: sw.js drifted for thirteen versions once
# and every one of those deploys would have looked fine here.
for i in $(seq 1 20); do
  GOT=$(curl -s --max-time 25 "$LIVE/app.js?cb=$RANDOM$RANDOM" \
        | grep -m1 -oE "APP_VERSION = 'v[0-9]+'" | grep -oE 'v[0-9]+')
  echo "   live poll $i: ${GOT:-no response}"
  if [ "$GOT" = "$VER" ]; then
    # ./tools/... and not $(dirname "$0"), because line 23 already cd'd to the repo root —
    # a relative $0 would then resolve against the wrong directory when this script is invoked
    # by a relative path from somewhere else.
    exec ./tools/verify-live.sh "$VER"
  fi
  sleep 15
done

echo "!! $LIVE never served $VER. It is NOT deployed — do not report this as shipped."
exit 1
