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

## Nice-to-haves (not committed)
- Pomodoro count → Stats card. Widget. Apple/iOS store via the same Capacitor project. Data-viz polish on Stats.
