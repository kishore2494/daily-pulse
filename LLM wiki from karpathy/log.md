# Log (reverse-chronological)

## 2026-08-02 — Batch 4: Stats redesign (v65, live) + native 101/61 uploaded
- **v65 Stats redesign (web, live):** replaced the 17-card scroll-wall with a **segmented control** (`dashTab`: Overview / Time / Checklist) — directly answers testers' "simplify, remove clutter, separate time vs checklist". Overview = key stats + Polymath + mood/energy + insights + connections graph; Time = time analysis + sleep + deep-work + workout volume + gym breakdown; Checklist = habits + tasks + wellbeing scales + tracked numbers + mood calendar/weekday. New **`barChart(values,color,{max})`** — daily trends (mood/energy/sleep/deep-work/workout/polymath) now render as bar charts instead of line charts. Range row hidden on Checklist. Browser + screenshot verified.
- **Native build 101/61 UPLOADED by user** to Play closed testing (was awaiting upload in batch 3). Play showed 2 harmless warnings at Preview&confirm: (1) "no longer supports 20 devices" — RECORD_AUDIO implies an `android.hardware.microphone` feature req, dropping ~20 mic-less devices (~0%, mostly TVs); safe to proceed. Optional future fix: add `<uses-feature android:name="android.hardware.microphone" android:required="false"/>` (needs rebuild → 102). (2) no-deobfuscation-file — expected, we don't obfuscate. User advised to roll out.

## 2026-08-02 — Batch 3: web export fix (v64, live) + native rebuild 101/61 (awaiting upload)
- **v64 (web, live on both repos):** universal `saveFile(filename,content,mime)` — CSV / full-backup JSON / reminders ICS now work INSIDE the app (they silently failed before: WebView has no download manager). Path: Web Share API file → Android share sheet; else a copy-out modal (`showCopyModal`, textarea + Copy/Share). Browser still does a real download. Fixes testers' "export/backup/CSV not working" with no rebuild. Browser-verified all three routes.
- **Native rebuild (NOT web):** `daily-pulse-native` versionCode 100→**101**, versionName 60→**61**; built signed `bundleRelease assembleRelease` (BUILD SUCCESSFUL, ~1m22s). Verified .apk has RECORD_AUDIO + POST_NOTIFICATIONS + USE_FULL_SCREEN_INTENT + AlarmActivity/AlarmReceiver. Copied to `store/assets/DailyPulse.aab`. **USER ACTION: upload this .aab to Play closed testing** → testers get an in-app update (mic needs this; downloads/notifications already handled via web). Mic on-device behaviour untested (no device) — may need manual permission grant first time.
- Clarified to user: web changes need NO tester update (auto); a new .aab DOES (Play update). Production is gated by Google's 14-day closed-testing rule — earliest apply ~Aug 13 (testing started ~Jul 30). Cannot skip.

## 2026-08-02 — Tester feedback batch 2: side-nav drawer + polish (v63, live)
Backup taken first (user asked): tag `backup-v62-live`, branch `backup/v62-pre-navdrawer` (pushed to prod), file snapshot in `.backups/v62-<sha>/`. All below browser-verified, pushed to both repos.
- **Nav overhaul (the big recurring ask — user + 2 testers).** Bottom bar now **capped at 5**: up to `NAV_PRIMARY_MAX = 4` pinned tabs + a **☰ Menu** button. Menu opens a **slide-out side drawer** (right side, `#drawer`/`#drawer-scrim`, `renderDrawer/openDrawer/closeDrawer`) listing **every** screen one tap away, current highlighted, "pinned" badges, + a Settings row. A **'‹ Menu' back button** (`#nav-back` in topbar) appears on any screen that isn't a pinned tab and re-opens the drawer. NOTE: this reverses the earlier "no cap, user chooses count" (v55) — testers explicitly wanted max-5 + side nav; user confirmed "do both". Old `s-more` grid screen is now unreachable/dead (harmless).
- **Clock time picker** for Sleep hrs / Deep-work hrs: `time:true` flag on those DEFAULT_CORE_FIELDS (backfilled onto stored configs in `coreCfg()`); renders `<input type=time>`, converts HH:MM⇄decimal via `hoursToHM`/`hmToHours` (7:30⇄7.5), shows an "x h" hint. Handler branch on `[data-numtime]`.
- **Gym auto-saves** on exercise toggle + debounced as you type each log (new `persistGym(silent)` helper; mirrors count/detail into the day's entry). No more Save-trip.
- **Default habits trimmed 12→4** (Workout, Meditation, Reading, Healthy food) for NEW users; existing testers keep their stored set. Onboarding still lets you add more.
STILL PENDING: unnamed How-to button (need a screenshot to locate), NATIVE rebuild batch (downloads/CSV/PDF via Filesystem+Share, running-timer notification, mic in WebView), Stats redesign (simplify + bar charts, separate time vs checklist).

## 2026-08-02 — Tester feedback batch 1 (v62, live)
App is LIVE in Play closed testing; testers (Kishore's friends) sent ~25 feedback items. Batch 1 shipped (web push → both repos `kishore2494/daily-pulse` prod + `jurnal-app` origin; testers get it on next open). Browser-verified all six:
- **Auto-save on Log** — entries persist on-the-go (700ms debounce via `autosaveDraft()` wired into scale/check/habit/num/txt handlers); Save button relabeled "Done" + "Saves automatically" hint (`.autosave-hint`/`.autosave-dot` CSS).
- **Feedback** — opens mail (`mailto:akishorekumar2494@gmail.com`) instead of GitHub login; `sendFeedback` no longer references github. Still falls back to POST if `FEEDBACK_URL` set.
- **Duplicate History removed** from Settings (kept in More).
- **Mic** — `dictateInto` now `await`s `getUserMedia({audio:true})` to trigger the OS prompt; error toasts point to Settings › Apps › Permissions. Native manifest gained RECORD_AUDIO + MODIFY_AUDIO_SETTINGS (needs native rebuild+reupload to take effect in the installed app).
- **Custom activity emoji** — `emojiSplit()` parses "🍳 Cooking" → {emoji,name}; applied to 3 activity-add sites; placeholder updated.
- **Checklist alignment** — `.habit{min-height:52px}`; reminders row spacing.
STILL PENDING from the batch (bigger/deferred): 5-tab nav + side drawer (recurring ask), Stats redesign, native downloads/CSV/PDF (Filesystem+Share rebuild), running-timer notification, sleep-hrs time picker, fewer default habits, professional icon set, unnamed How-to button (needs a screenshot to locate).

## 2026-07-24 — Wiki bootstrapped
Created the wiki at v52 during an overnight autonomous QA session. Pages: architecture, features, gotchas, play-store, roadmap, schema, index. Facts verified against code (v52, 3455-line app.js, 13 nav tabs, ~24 dp.* keys). A parallel multi-agent audit was running; its verified findings + fixes are recorded in the session REPORT and folded here as applied.

## Backdrop (condensed history to v52)
- v35→v52 built in one long session. Milestones: Time tracker (v36), Sheet Time-Log sync (v37), Stats time analytics (v38), Calendar+events (v40), UI redesign "dark instrument panel" (v41), Write block-editor + Customize v1 (v42), deep-log/gym customizable (v43), EVERYTHING customizable incl. nav/theme/core-fields/gym-split (v44), onboarding + privacy + store prep (v45), data-loss education + feedback form (v46), native full-screen alarm via Capacitor (v47-v49), Play-Store prep, onboarding add-your-own + emoji fixes + guide page (v50), running-timer notification + 2-day inactivity nudge (v51), Focus tab: Pomodoro + Timebox (v52).
- Production repo `kishore2494/daily-pulse` created 2026-07-16; Capacitor native shell replaced the earlier TWA.

## 2026-07-24 — Overnight audit + hardening (v52 → v54)
60-agent adversarial audit (8 dims) + independent runtime QA. 42 confirmed findings (0 crit / 5 high / 20 med / 17 low). Full list in REPORT.md.
FIXED & shipped (v53/v54, browser-verified): field-level entry merge (HIGH data-loss), stored-XSS escaping across Log/Habits/Stats/Gym (2×HIGH), reminder-reschedule no longer cancels pomo/timer/timebox alarms, double-open timelog guard, pomo settings sync (live run stays local), a11y (pinch-zoom, 40px scale tap targets, safe-area-top, nav contrast), polymath NaN guard when all habits hidden.
DEFERRED (see REPORT.md + roadmap): sync-auth/JSONP hardening, list-store concurrent-edit convergence (tombstones), gym union-merge edits, ntfy plaintext labels, perf (full re-renders / layoutGraph / pushState serialize), no boot receiver, exact-alarm Play declaration, custom number/text deep-log fields absent from Stats, 12-tab nav crowding.

## 2026-07-25 — Nav overhaul (v55–v56)
v55: enlarged small icon-button tap targets (40px) + color-mix() fallback (nav layout unchanged per user pref at the time). v56: replaced the crammed 12-tab bar with **5 pinned tabs + More overflow grid**. navCfg gained `primary`; new `renderMore()` launcher screen (`s-more`); default-opening-tab setting (`settings.defaultTab`); Customize ▸ Tabs now has 📌 pin (max 5, enforced), 🎯 default, drag-order, 👁 hide. Legacy navcfg auto-migrates (seeds pins from NAV_DEF). Bottom bar went 12×33px → 6×~65px.

## 2026-07-25 — Nav: remove the 5-tab cap (v57)
Per user: don't force 5 pinned tabs — let them choose how many. Removed MAX_PRIMARY hard cap in renderNav + the pin-cap block in the handler; kept a non-blocking "4-5 stays easiest to tap" tip past 5 pins. Customize labels updated to "pin as many as you like".

## 2026-07-25 — Deep-log: add whole new sections (v58)
Customize ▸ Deep log now has a "New section…" input (emoji-aware) + delete (×) on custom sections (ids `cs*`). Previously you could only add FIELDS to existing sections. New sections render on Log; their scale (1-10) fields flow into Stats wellbeing averages. Verified end-to-end.

## 2026-07-26 — Big customize/stats/report/waves batch (v59)
- Customize is now a HUB of cards (customPage state) → each opens its own sub-page (tabs/log/habits/acts/deep/gym/theme).
- Settings reorganized into menu-rows (Customize / Download report / History / How-to). Sync & login HIDDEN behind `SHOW_SYNC=false` (kept for a future paid feature). ntfy already native-hidden. Feedback: email field removed (goes to owner-only Feedback.gs sheet).
- Nav active tab: stronger highlight (accent-gradient pill + top indicator bar + bold white label).
- Stats completeness: added 🔢 Tracked-numbers card (numeric deep-log field averages) + 🍅 pomodoro-today stat. (Custom habits/activities/scale-fields already flowed in.)
- NEW **Waves** tab: binaural-beat generator (`dp.waves`), 5 presets, ChannelMerger L/R oscillators, auto-stop timer + volume. Non-primary tab (lives in More).
- NEW **Download report (PDF)**: `downloadReport()` builds #print-report + window.print() → Save as PDF (offline). Print CSS hides the app while printing.

## 2026-07-26 — Fixes (v60)
- Settings menu rows: navigated only when the arrow was tapped (handlers used `ev.target.id===` which missed child spans) → switched to `ev.target.closest('#id')`; whole row is tappable now.
- PDF report printed the Settings page instead of the report (print-media class timing). Reworked: report now shows as an on-screen full-screen overlay (`body.reporting`, #print-report) with its own "Save as PDF / Print" + Close buttons; print CSS just hides the action bar. Reliable + testable.

## 2026-07-26 — Marketing landing page
Added landing.html (showcase front page: hero + phone shot, 9-feature grid, screenshot gallery from guide/img, privacy banner, CTAs). Served at /daily-pulse/landing.html — use as the Play Console website URL (can't be the app root, that's the PWA). Reuses guide/img screenshots.

## 2026-07-29 — v59/v60 batch + Play Console submission (handoff written)
Shipped v59 (Customize→hub of sub-pages; Settings reorg w/ menu-rows, Sync hidden via SHOW_SYNC=false, feedback email removed; stronger nav active highlight; Stats numeric-deep-log averages + 🍅 pomodoro stat; NEW Waves binaural-beat tab dp.waves; NEW Download-report-as-PDF via body.reporting overlay + window.print) and v60 (fix: settings menu rows tappable via closest(); report overlay instead of print-media so it stops printing the settings page). Added landing.html marketing page (/daily-pulse/landing.html) + store/assets/ (feature graphic, 5 phone shots 412×820, 3 tablet 1920×1200, DailyPulse.aab/.apk git-ignored). Rebuilt Capacitor bundle to versionCode 100/versionName 60 (targetSdk 36) — replaced the wrong TWA bundle that was uploaded. Play Console: app created, verified, closed-test release with bundle 100 submitting for review; declarations done (data safety=none, ad-ID=no, full-screen-intent core=Other). SHA-256/assetlinks confirmed NOT needed for Capacitor. See play-store.md for the full launch handoff + next steps.

## 2026-07-30 — Theme modes + overflow fix (v61)
Added appearance MODES (settings.mode: navy default / black AMOLED / light) on top of the 6 accent colours. applyTheme() sets data-mode on <html>; CSS overrides base vars per mode + fixes hard-coded dark bits in light (topbar bg/gradient-title, nav, btn-ghost). Selector in Customize ▸ Theme. Also fixed stray horizontal scroll on some screens via overflow-x:clip on .app/.screen (clip, not hidden, to preserve the sticky topbar). Verified all 7 screens overflow-free + light/black render clean.
