# Roadmap — decided but not built

## Agreed, queued
- **Firebase accounts + cloud sync** — the frictionless multi-device story (Google Sign-In, one tap on Android, no passwords). Local-first stays default. This becomes the **₹9/mo premium** feature. *User must create the Firebase project*; then wire auth + move `applyRemoteState` merge logic to Firestore. Free tier covers thousands of users.
- **Google Play Billing** — ₹9/mo sub w/ 30-day trial, OR simpler ₹99 one-time "Pro" unlock. Needs merchant profile (PAN + bank) in Play Console; then wire the Digital Goods API purchase + gate Pro features. Purchases auto-follow the user's Google account across devices.
- **Foreground service for the running-timer** — current timer notification with Pause/Stop works while the app process is alive; if Android fully kills the app, actions only apply on relaunch. A true always-live control needs a native foreground service (Java, + Android 14 foregroundServiceType declaration).

## User action items (only they can do)
- Finish Google Play identity verification (blocking everything).
- Deploy `Code.gs` (latest) + redeploy new version → unlocks Time Log / Events / Articles Sheet tabs.
- Deploy `Feedback.gs` → paste URL into `FEEDBACK_URL` in app.js.
- Back up `daily-pulse-android/android.keystore` + `keystore-password.txt` off-machine.
- Test full-screen alarm + timer notification on the real phone (emulator can't).

## Open questions / deferred
- **Tab count** (13 nav tabs) may overwhelm new users — decided to let the 12-person closed test tell us before simplifying. Consider a "starter" default that hides advanced tabs.
- Whether to make the Sheet's `Log` columns dynamic (so custom deep-log fields get Sheet columns) — currently fixed.
- Marketing: a large programmatic-SEO page factory already exists (`daily-pulse-factory/`, ~128 pages) — separate track.

## Phase 2 — iOS (decided 2026-08-16: AFTER Android production ships)
Android-first confirmed by Kishore. When Android is live:
- `npx cap add ios` in daily-pulse-native (Xcode 26.4 already on this Mac); simulator proof is FREE — no account needed. Distribution/TestFlight needs the **$99/yr Apple Developer account** (Kishore's call).
- iOS differences to plan for: bundle web assets IN the app (Apple rejects remote-URL wrappers; updates then ship via App Store releases), full-screen alarm impossible (degrade to notifications), Health = **HealthKit** not Health Connect, screen time NOT available (FamilyControls is parental-control-only), widgets = WidgetKit/SwiftUI. Speech plugin already supports iOS.
- Zero-cost interim: iPhone users can install the **PWA** (Safari → Add to Home Screen) today.

## From competitor research (2026-08-18) — ranked web-shippable wins
1. Year in Pixels (S) · 2. streak grace + flexible habit schedules e.g. 3x/week (M) · 3. PIN lock (S) · 4. CSV import (S) · 5. notes per habit check-in + week-start setting (S). Native-only gaps: widgets, Wear OS. Monetization: one-time unlock or free (fits privacy brand).

## Nice-to-haves (not committed)
- Pomodoro count → Stats card. Widget. Data-viz polish on Stats.

## From the 2026-07-24 audit — deferred fixes (prioritize before/around launch)
- **Sync robustness**: list/config stores are last-writer-wins whole-list → concurrent multi-device edits can drop items. Move to id-keyed merge + tombstones + per-item stamps. Gym merge is union-only (uncheck/edit doesn't propagate).
- **Sync security**: the sync URL is an unauthenticated bearer to all data; pull uses JSONP. Add a shared-secret token + CORS fetch with shape validation. Document the secrecy requirement.
- **Native**: add a BOOT_COMPLETED receiver (alarms lost on reboot); request POST_NOTIFICATIONS in Focus/timebox paths; fill the SCHEDULE_EXACT_ALARM Play declaration.
- **Perf**: renderToday re-renders whole screen per tap; layoutGraph O(N²) on main thread; pushState serializes all stores per keystroke (debounce note-save).
- **Consistency**: custom deep-log NUMBER/TEXT fields never show in Stats (only scales); 'Push all to Sheet' omits Events/Articles; dead dp.exercises store; privacy claim vs Google Fonts fetch.
- **UX**: 12-tab nav is cramped (<44px) — consider overflow sheet or fewer default tabs.
