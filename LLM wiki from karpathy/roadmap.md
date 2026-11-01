# Roadmap — decided but not built

## Agreed, queued
- **Cloud sync — DECIDED 2026-08-19 (Kishore's plan, supersedes both earlier designs).**
  **Flow:** post-launch update → one What's-new popup + a Settings card → **"Sign in with
  Google"** (native one-tap; accounts chosen deliberately — a lost sync-code means lost data,
  a Google account gives free recovery) → **pay-what-you-want subscription: ₹9 / ₹49 / ₹99
  per month, EXACT same feature at every tier** ("Supporter / Fan / Patron — pick what it's
  worth to you"; three Play Billing subscription products). Honest same-feature tiering fits
  the brand — teardown showed users punish greedy pricing (Forest/Regain) and reward generous
  devs (Loop/How We Feel).
  - **Lapse behaviour:** payment stops → sync PAUSES. Local data always untouched
    (local-first). **Non-negotiable exception: lapsed users can always RESTORE (read/download)
    their cloud copy — they just can't push new changes.** Guards the broken-phone +
    lapsed-sub case, which is Journey's #1 angry-review generator ("stranded with 9 years of
    entries"). Read free forever, write needs payment.
  - **Backend:** blob-per-Google-account. Cloudflare Worker verifies the Google ID token
    (JWKS), stores one opaque-ish blob per `sub` in R2, `If-Match: rev`; existing
    `applyRemoteState` merge reused unchanged. (Firebase is the fallback if the token dance
    fights us.) Free tier ≈ thousands of users at ₹0.
  - **Native work:** Google Sign-In Capacitor plugin → new .aab (109+, post-launch only).
  - **⚠️ Play compliance the accounts trigger:** in-app AND web **account-deletion** flow is
    mandatory once sign-in exists — build it in phase 1, not later. Data Safety form changes
    in the same release (account identifiers + app activity, encrypted in transit, deletable).
    Listing wording becomes "no account required — optional sign-in for cloud sync".
  - **Popups:** the What's-new mention + Settings card only. Never a recurring nag.
  - Phase 0 done: `SHOW_SYNC` is now `!!settings.syncUrl` (app.js), so the sync card only shows for someone who already set up a Sheet (checked 2026-11-01).
- **Google Play Billing** — ₹9/mo sub w/ 30-day trial, OR simpler ₹99 one-time "Pro" unlock. Needs merchant profile (PAN + bank) in Play Console; then wire the Digital Goods API purchase + gate Pro features. Purchases auto-follow the user's Google account across devices.
- **Foreground service for the running-timer** — current timer notification with Pause/Stop works while the app process is alive; if Android fully kills the app, actions only apply on relaunch. A true always-live control needs a native foreground service (Java, + Android 14 foregroundServiceType declaration).

## Photos & voice: next steps (from v251, 2026-11-01)
- **Share INTO Daylog** from Google Photos and the gallery: an `ACTION_SEND image/*` intent
  filter plus a small plugin that hands the file to the web layer. Needs a native build.
- **Sharing voice notes in the app:** `DaylogShare.shareImage` hard-codes an image MIME type, so
  the viewer offers Share for photos only. Add `shareFile({base64, mime, filename})`. Native build.
- An image block in Write. (Media on an existing note: done in v253.)
- Optionally export media as a SEPARATE file once libraries get big; the guard asks past ~35 MB.

## Native fixes found 2026-11-01 — DONE in build 119 (built, not uploaded)
- **TimerNotifPlugin:** queue `{action, atMillis}` instead of one overwritten tag, so a Stop or
  Pause from the notification applies at the time it was tapped. Today a Stop at 18:00 seen at
  22:00 counts to 22:00, and Pause + Resume collapse to just Resume.
- **SharePlugin.shareTextFile:** report whether the user actually shared. Today it resolves as
  soon as the sheet opens, so `dp.lastBackup` is stamped after a cancel on Android ≤9, or
  when saving to Downloads fails.

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
  - Found again 2026-11-01 (review 2), both reproduced in a jsdom harness:
    - (DONE 2026-11-01, v253: per-habit stamps `habitsAt`; time-log tombstones `dp.timelogDel`;
      push-after-pull and flush-on-hide. The list-store tombstones below are still open.)
    - **Un-ticked habits come back.** Clearing a habit deletes its key, and the entry merge
      unions `habits`, so an older device's `true` wins over a newer un-tick. Storing `false`
      would fix the merge, but `false` is read as "logged" by goal counters and `entryHasContent`
      paths. Needs per-habit stamps or tombstones; decide together with the list-store tombstones.
    - **A pull drops a time block the other device never saw** (an unsynced running timer),
      and a deleted block comes back when the other device saves later. Same fix: tombstones
      (id → deletedAt), and never treat "missing" as "deleted" (review 4, 2026-11-01).
    - **A save in the last ~1.2 s before a kill never syncs.** `pushState` is debounced.
      On the next launch the pull sees a newer local `touched` and uploads nothing. Fix: when
      local `touched` is newer than remote, push after the pull; and send on hide with
      `keepalive`.
- **Sync security**: the sync URL is an unauthenticated bearer to all data; pull uses JSONP. Add a shared-secret token + CORS fetch with shape validation. Document the secrecy requirement.
- **Native**: add a BOOT_COMPLETED receiver (alarms lost on reboot); request POST_NOTIFICATIONS in Focus/timebox paths; fill the SCHEDULE_EXACT_ALARM Play declaration.
- **Perf**: renderToday re-renders whole screen per tap; layoutGraph O(N²) on main thread; pushState serializes all stores per keystroke (debounce note-save).
- **Consistency**: dead dp.exercises store. (Done: fonts are self-hosted, so the privacy claim holds; custom number fields show in Stats as averages; 'Push all to Sheet' sends Events/Articles since v253.)
- **UX**: 12-tab nav is cramped (<44px) — consider overflow sheet or fewer default tabs.
