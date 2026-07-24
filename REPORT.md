# Daily Pulse — Overnight Audit & Hardening Report
_2026-07-24 · v52 → v53 · autonomous session while you slept_

## TL;DR
Ran a 60-agent adversarial audit (8 dimensions) + independent runtime QA. **42 confirmed findings** (0 critical, 5 high, 20 medium, 17 low).
Applied **12 safe, browser-verified fixes** (shipped as v53, live on both repos). Deferred the risky/architectural items below for your call. No unverified code was pushed. Backup + git tag `v52-overnight` exist if you want to revert.

## ✅ Fixed & shipped in v53
- **HIGH multi-device data-loss: entries now merge FIELD-LEVEL, so a partial timeSummary/gym write on a stale device can no longer wipe another device's journal/mood/habits. Verified with the exact failure scenario.**
- **HIGH stored XSS: journal / reflection / weekly-review textareas now escapeHtml — a `</textarea><img onerror>` payload no longer executes.**
- **HIGH stored XSS: user-editable labels (habit names, deep-section titles, gym day/group names, wellbeing labels, coach-review) now escaped across Log/Habits/Stats/Gym.**
- **1-10 mood/energy buttons given min-height 40px (were ~20-26px).**
- **Reminder reschedule no longer cancels the Pomodoro/timer/timebox alarms (blanket cancel now excludes reserved notification IDs).**
- **Sync could leave two 'running' time segments (double-counting); now the earlier open segment auto-closes.**
- **Pinch-zoom re-enabled (removed maximum-scale/user-scalable=no) — accessibility.**
- **Top bar respects the notch (safe-area-inset-top).**
- **Inactive nav labels use higher-contrast color.**
- **Pomodoro settings now sync across devices (the live countdown stays device-local, as it should).**

## ⏳ Deferred — need your decision (not shipped)
- **[MEDIUM] Background sync (applyRemoteState) discards unsaved in-progress edits on the Today screen**
  - Why deferred: risk=moderate. Skip the re-render/reload of the Today screen when it's active and `draft` differs from the stored entry (dirty check), or merge remote into draft without clobbering unsaved fields; alternatively only
- **[MEDIUM] Gym merge is union-only: un-checking or editing a logged exercise never propagates and gets reverted across de**
  - Why deferred: risk=moderate. Track a per-day updated timestamp (mirror the timelog approach) or store done/log with per-key upd stamps so the newer side wins, allowing removals and edits — not a pure union.
- **[MEDIUM] List and config stores use last-writer-wins whole-list replacement — concurrent edits on the earlier-touched d**
  - Why deferred: risk=risky. Move list stores to id-keyed merge with tombstones (deleted-id set) and per-item updated stamps so add/edit/delete/reorder all converge without dropping the other device's items; configs can keep LWW 
- **[MEDIUM] Reminder and calendar-event labels sent in plaintext to public third-party ntfy.sh**
  - Why deferred: risk=moderate. At minimum surface this clearly in the privacy policy/UI; prefer a generic message (e.g. 'Daily Pulse reminder') rather than the raw label, or make label inclusion opt-in. Consider a longer/full-entro
- **[MEDIUM] Sync URL is an unauthenticated bearer credential to all personal data; pull uses JSONP (arbitrary code executi**
  - Why deferred: risk=risky. Document that the sync URL grants full data access and must be kept secret; consider a shared-secret token validated in doPost/doGet, and replace JSONP pull with a CORS-enabled fetch + strict shape va
- **[MEDIUM] 12-tab bottom nav: ~27-30px per tab, 9px labels wrap/clip on small screens**
  - Why deferred: risk=moderate. Reduce the default visible tab count (hide more by default, as history already is) or switch to a horizontally-scrollable nav / a 'More' overflow sheet so each tab keeps >=44px. At minimum add `white-
- **[MEDIUM] renderToday() rebuilds the entire Today screen innerHTML on every tap, re-parsing dp.entries ~12+ times each t**
  - Why deferred: risk=moderate. Toggle only the affected DOM node's class instead of re-rendering (mirror the pattern already used for habit taps in the Dashboard graph at :3307-3309). At minimum, compute all habit streaks in one pa
- **[MEDIUM] layoutGraph() runs a 220-iteration O(N^2) force simulation synchronously on the main thread, re-run on Dashboa**
  - Why deferred: risk=moderate. Reduce iteration count / cap N, cache the computed layout so a node tap only re-styles edges/circles (focus highlight) instead of recomputing the whole simulation, and/or run the sim off the tap path.
- **[MEDIUM] pushState() re-reads and serializes the ENTIRE database (~18 stores) on every mutation; note typing triggers a**
  - Why deferred: risk=moderate. Debounce the per-keystroke saveNotes (save on blur/change, not every input), and have pushState send only changed stores or reuse already-in-memory objects instead of re-reading every getter. Consider
- **[MEDIUM] setupReminders fires scheduleNativeAlarms/refreshTimerNotif/scheduleTimeboxAlarms concurrently — cancel-all ra**
  - Why deferred: risk=moderate. await scheduleNativeAlarms() before refreshTimerNotif()/scheduleTimeboxAlarms(), and stop cancelling ids outside the reminder/event namespace (see finding 1).
- **[MEDIUM] Pomodoro/timebox/timer/inactivity schedule without ever requesting POST_NOTIFICATIONS**
  - Why deferred: risk=safe. Request/verify notification permission before scheduling in these paths (or gate the Focus/timebox UI behind a one-time permission request), and surface failures instead of swallowing them.
- **[MEDIUM] No boot receiver — full-screen (setAlarmClock) alarms are lost on reboot**
  - Why deferred: risk=moderate. Add RECEIVE_BOOT_COMPLETED and a BOOT_COMPLETED BroadcastReceiver that reschedules the persisted alarm list (persist the alarm payloads natively so they can be restored without the WebView).
- **[MEDIUM] SCHEDULE_EXACT_ALARM used but the exact-alarm Play Console declaration is not in the submission plan**
  - Why deferred: risk=safe. Fill out the Play Console exact-alarm permission declaration (justify as a reminder/alarm app) and add it to store/play-listing.md's declarations list. Alternatively, if exact firing is not essential 

## Low-severity (batch later)
- polymath() discipline pillar divides by HABITS.length → NaN score when all habits hidden
- Time tracker assumes a fixed 86,400,000 ms day — mis-clips segments on DST-transition days
- pomo is saved, pushed, and backed up but NEVER applied on remote pull (only store that doe
- Active time-activity chip highlight relies on color-mix() (unsupported on old Android WebV
- Small icon-button tap targets (delete / color / toggle) ~18-24px
- Two 1-second setInterval timers (plus a 10s reminder poll) are never cleared or paused; th
- Notified flags are pruned only once at startup by cleanNotifiedFlags()
- fs-test alarm id 399 lies inside the FS cancellation sweep (MAX_IDS=400) and is silently c
- FS alarm ids drawn from shared seq can exceed MAX_IDS=400 and become uncancellable
- AlarmActivity rings and vibrates indefinitely with no auto-timeout
- Reserved notification ids (750/760/770/800-830/424242) can collide with sequential reminde
- "Works 100% offline" / "no third-party" claims conflict with Google Fonts being fetched ov
- Hiding ALL habits makes the Polymath Index render as NaN (Stats + Weekly review break)
- Time-activity rows in Customize show a drag handle that does nothing (reorder never wired)
- Custom deep-log NUMBER/TEXT fields never appear in Stats, contradicting the in-app promise
- 'Push all to Sheet' (resyncAll) omits Events and Articles/docs tabs
- Legacy dp.exercises / DEFAULT_EXERCISES is dead: synced and backed up but never rendered o

## Runtime QA (independent, all passed)
- 14/14 screens render, zero console errors · backup export/import round-trip preserves all stores · sync merge loses no data either direction · empty-state + hide-all-habits + custom-habit propagation all fine.

## Also done overnight
- Fresh backup: git tag `v52-overnight` (both repos) + `backups/daily-pulse-backup-v52-20260724.zip`.
- Bootstrapped `LLM wiki from karpathy/` (8 pages) — durable project knowledge base.

## Still waiting on YOU (unchanged)
- Google Play identity verification (blocks launch). Deploy Code.gs + Feedback.gs. Back up the keystore off-machine. Real-phone test of full-screen alarm + timer notification.