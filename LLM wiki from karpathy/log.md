# Log (reverse-chronological)

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
