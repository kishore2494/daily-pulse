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
