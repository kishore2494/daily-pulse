# Gotchas — hard-won lessons

## Deploy / git
- **Personal repos push as kishore2494**, but the macOS keychain defaults to the work account kishore-FP → plain `git push` 403s. Use:
  `gh auth switch --user kishore2494 && git -c credential.helper= -c credential.helper='!gh auth git-credential' push <remote> main && gh auth switch --user kishore-FP`
  Do NOT inline `$TOKEN` in a heredoc-quoted helper — the `\$` escaping breaks. Leave kishore-FP active afterward.
- **Two remotes**: `origin`=jurnal-app (dev), `prod`=daily-pulse (production). Push both for releases.
- **Always bump BOTH** `APP_VERSION` (app.js) and `CACHE` (sw.js) or the service worker serves stale code.
- GitHub Pages takes ~30-90s to serve a push; verify with `curl … | grep "APP_VERSION = 'vNN'"`.

## Android build
- **Capacitor 7 needs JDK 21** → use Android Studio's JBR: `JAVA_HOME="/Applications/Android Studio.app/Contents/jbr/Contents/Home"`. Bubblewrap's bundled JDK 17 fails ("invalid source release: 21").
- Bubblewrap's `@capacitor/assets` icon generator emitted an adaptive-icon XML referencing a missing `mipmap/ic_launcher_background`; fix by pointing `<background>` at `@color/ic_launcher_background`.
- The signing keystore + password live in `daily-pulse-android/` (`android.keystore`, `keystore-password.txt`). **Back them up. Lose them = can't update the app ever.** SHA-256 is in the site's `.well-known/assetlinks.json`.
- **`USE_FULL_SCREEN_INTENT`** (full-screen alarm) is a Play-restricted permission on Android 14+ → at submission you must tick the declaration that it's an alarm/reminder app.

## Emulator testing
- The emulator `Medium_Phone_API_36.1` is **SHARED with the user's FieldOps session** — screenshots may show the wrong app; collisions happen. Use `adb -s emulator-5554`.
- Prod emulator images can't `adb root`, and shell can't trigger a non-exported `AlarmReceiver` — so native alarms can't be fire-tested from shell. Cold-booted emulator on software GPU throws "System UI isn't responding" ANRs — that's the emulator, not the app.
- **Real-phone testing is authoritative** for alarms (emulator can't mimic MIUI, can't fast-forward days). Plain notification WAS proven firing with app dead (id 424242).
- Release WebView has no devtools socket → can't inject JS to drive it. Drive via `input tap` or test the web build in the `browse` headless Chromium instead.

## MIUI / Redmi (the user's phone)
- Blocks `adb install` (INSTALL_FAILED_USER_RESTRICTED) → push the APK to `/sdcard/Download/` and install from the file manager's **Internal storage ▸ Download** (the category tab may not show it until media-scanned).
- Blocks lock-screen takeover by default → user must enable **"Show on lock screen"** + **"Display pop-up windows while running in background"** in the app's MIUI permissions for full-screen alarms.

## Emoji / rendering
- Avoid ZWJ sequences (e.g. 🧑‍🤝‍🧑) and heavy variation-selector emoji — they render broken/tripled on older Android. Prefer single-codepoint (👥, 💪, 💬, 📖). Default configs were cleaned in v50.

## App logic
- `renderToday()` must NOT reload the draft from storage (only `openToday()` does) or in-progress edits get wiped before save.
- `checkReminders()` early-returns in the native shell so the web layer doesn't double-ring over the native alarms.
- Force-stopping the app cancels its AlarmManager alarms — to test alarms survive, use HOME + gentle kill, not force-stop.
- The `browse` gstack daemon wedges on stale state fairly often: `kill -9 $(lsof -ti :9400); rm -f /tmp/browse-server.json` then retry.
- Local server for browser testing dies between turns; restart `python3 -m http.server 8471` in the app dir as needed.

## Not part of the app
`daily-pulse-factory/` + the `focus-tracker-*.html` / comparison pages / `factory-data.json` inside `daily-pulse-app/` are a **programmatic-SEO landing-page generator** (separate marketing work, ~128 pages, n8n drip). Harmless to the app; don't confuse them with app code.


## MIUI / Xiaomi dark mode washes out a light WebView (RESOLVED 2026-08-19)

**Symptom:** with system dark mode ON, the whole app rendered under a uniform grey wash —
background `(165,167,170)` instead of `(243,245,250)`, modals included. With system dark
mode OFF it was perfectly clean. Ruled out first: JS errors (logcat clean), a stuck modal
(Back showed the exit dialog, so nothing was open), low brightness (raised 37→255, no
change), and a stray `values-night` directory (none exists).

**Two real theme defects, both introduced in build 106 during splash work:**
1. `AppTheme` had no `android:forceDarkAllowed` opt-out at all.
2. `AppTheme.NoActionBarLaunch` inherited `Theme.AppCompat.NoActionBar` — the **DARK**
   variant — and `AppTheme.NoActionBar` inherited `DayNight`.

**Fix** (`android/app/src/main/res/values/styles.xml`): every parent → `Theme.AppCompat.Light.*`,
and `<item name="android:forceDarkAllowed" tools:targetApi="q">false</item>` on all three
styles. Plus `WebSettings.setForceDark(FORCE_DARK_OFF)` in `MainActivity.onCreate` for
API 29-32. Shipped as **108/68**.

**The trap that cost the most time:** after installing 108 the app STILL looked dimmed.
It was a stale WebView render. The fix only shows after a genuine cold start with the
WebView HTTP cache cleared:

```
adb shell am force-stop io.github.kishore2494.dailypulse
adb shell "run-as io.github.kishore2494.dailypulse rm -rf /data/data/io.github.kishore2494.dailypulse/cache/WebView"
adb shell monkey -p io.github.kishore2494.dailypulse -c android.intent.category.LAUNCHER 1
```

Verified afterwards: clean `(243,245,250)` with `cmd uimode night yes`, stable across a
dark-mode off→on flip and a cold restart.

**Belt and braces (v120):** the default theme is now **Auto** — it follows
`prefers-color-scheme`, so if a user's phone is dark we render our own navy theme and the
OEM has nothing to force-darken. Note that because the native theme is now `Light` with
force-dark off, the WebView reports `prefers-color-scheme: light` even under MIUI dark
mode, so Auto resolves to light there; users who want dark pick it explicitly.


## Layout: the flex-shrink trap, and where screen height actually goes

**A flex row with a text label + fixed badges needs `min-width: 0` on the label.** Without it
the label refuses to shrink below its content width and *pushes its siblings out of the box*.
That is what made "skipped" overflow the habit chip. The label should be the only
`flex: 1 1 auto; min-width: 0` child; every badge is `flex: 0 0 auto`.

**`grid-auto-rows: 1fr` makes every row as tall as the tallest one.** One long wrapping label
inflated an entire habit grid. Use `auto` unless you genuinely want uniform rows.

**Measure height per card before optimising it.** The Log felt too long, and the instinct was
to shrink the visible chips. The actual culprit was ten *collapsed* deep-log sections at 79px
each (790px, 19% of the page) — each carrying full card padding, a card margin, and the h2's
bottom margin to render one title row. Collapsing them to list rows saved more than every
other tweak combined. `tools/evals/` prints this breakdown; use it.

**Run `tools/evals/run.sh` before and after any UI change.** It catches overflow, clipped
text, unreadable truncation, tiny tap targets and scroll bloat across 320/360/412px — the
class of bug that otherwise reaches the user's phone. Its README lists the two false
positives already fixed and the findings deliberately accepted.
