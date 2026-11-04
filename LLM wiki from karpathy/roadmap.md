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
- **Google Play Billing** — tip jar shipped (web v246, native 118) — see play-store.md ▸ Merchant setup.
- **Foreground service for the running-timer** — current timer notification with Pause/Stop works while the app process is alive; if Android fully kills the app, actions only apply on relaunch. A true always-live control needs a native foreground service (Java, + Android 14 foregroundServiceType declaration).

## Photos & voice: next steps (from v251, 2026-11-01)
- **Share INTO Daylog** from Google Photos and the gallery: an `ACTION_SEND image/*` intent
  filter plus a small plugin that hands the file to the web layer. Needs a native build.
- **Sharing voice notes in the app:** `DaylogShare.shareImage` hard-codes an image MIME type, so
  the viewer offers Share for photos only. Add `shareFile({base64, mime, filename})`. Native build.
- (Done v253: image block in Write; media on an existing note.)
- Optionally export media as a SEPARATE file once libraries get big; the guard asks past ~35 MB.

## Memories: next steps (from v254, 2026-11-04)
- **Native video share/save:** `DaylogShare.shareImage` is image-only; add a file share that
  streams from a path (not base64) — next native build. Also verify on a real phone that the
  `capture` video input opens the camera in video mode (Capacitor's file chooser) and that a
  long 4K clip stores and plays.
- **Videos out of the phone, by choice:** Kishore chose phone-only; if he loses the phone the
  videos go. Options to offer later: "Save all videos to a folder" (native), or Google Drive.
- History's day page and the Log's "On this day" could list that day's memories.
- HEIC photos keep no taken date (EXIF is read from JPEG only) — they fall back to the file date.
- A memory's own date does not move its media's `day` when edited (media `day` = taken day).

## Native fixes found 2026-11-01 — DONE in build 119 (built, not uploaded)
- **TimerNotifPlugin:** queue `{action, atMillis}` instead of one overwritten tag, so a Stop or
  Pause from the notification applies at the time it was tapped. Before 119 a Stop at 18:00 seen at
  22:00 counted to 22:00, and Pause + Resume collapsed to just Resume.
- **SharePlugin.shareTextFile:** report whether the user actually shared. Before 119 it resolved as
  soon as the sheet opened, so `dp.lastBackup` was stamped after a cancel on Android ≤9, or
  when saving to Downloads failed.

## User action items (only they can do)
- Finish Google Play identity verification (blocking everything).
- Deploy `Code.gs` (latest) + redeploy new version → unlocks Time Log / Events / Articles Sheet tabs,
  and (v253) stops `_State` pieces and "- …" journal lines coming back as #ERROR!.
  - (DONE 2026-11-02, unreleased (on origin after v253): `doGet` passes `SCRIPT_VERSION` as a second JSONP
    argument; the app keeps it per link in `dp.sheetScript` and says "update your Sheet
    script" in Settings ▸ Backup & restore when it is older than `SHEET_SCRIPT`.)
- Deploy `Feedback.gs` → paste URL into `FEEDBACK_URL` in app.js.
- Back up the upload keystore off-machine — see backups.md.
- Test full-screen alarm + timer notification on the real phone (emulator can't).

## Open questions / deferred
- **Tab count** — the default tab set may still overwhelm new users (5 pinned + menu since v250). Consider a "starter" default that hides advanced tabs.
- Whether to make the Sheet's `Log` columns dynamic (so custom deep-log fields get Sheet columns) — currently fixed.
- Marketing: programmatic-SEO pages — see distribution.md ▸ SEO (separate track).

## Phase 2 — iOS (decided 2026-08-16: AFTER Android production ships)
Android-first confirmed by Kishore. When Android is live:
- `npx cap add ios` in daily-pulse-native (Xcode 26.4 already on this Mac); simulator proof is FREE — no account needed. Distribution/TestFlight needs the **$99/yr Apple Developer account** (Kishore's call).
- iOS differences to plan for: bundle web assets IN the app (Apple rejects remote-URL wrappers; updates then ship via App Store releases), full-screen alarm impossible (degrade to notifications), Health = **HealthKit** not Health Connect, screen time NOT available (FamilyControls is parental-control-only), widgets = WidgetKit/SwiftUI. Speech plugin already supports iOS.
- Zero-cost interim: iPhone users can install the **PWA** (Safari → Add to Home Screen) today.

## From competitor research (2026-08-18) — ranked web-shippable wins
Still unbuilt: PIN lock (S) · flexible habit schedules e.g. 3x/week (M) · CSV import for entries (S; Money has one) · notes per habit check-in + week-start setting (S). Shipped: Year in Pixels (v124) — see competitors.md. Native-only gaps: widgets, Wear OS. Monetization: one-time unlock or free (fits privacy brand).

## Nice-to-haves (not committed)
- Pomodoro count → Stats card. Widget. Data-viz polish on Stats.

## From the 2026-07-24 audit — deferred fixes (prioritize before/around launch)
- **Sync robustness**: (DONE 2026-11-01, v253: the 14 lists with ids merge item by item with
  stamps + delete records — see architecture.md.) Still open: settings-like stores (habitcfg,
  actcfg, navcfg, finbudget, fincats, …) are last-writer-wins whole; gym merge is union-only
  (uncheck/edit doesn't propagate); plans merge as whole plans (two phones ticking different
  items of one plan: the later tick of the plan wins).
  - Found again 2026-11-01 (review 2), both reproduced in a jsdom harness:
    - (DONE 2026-11-01, v253: per-habit stamps `habitsAt`; time-log tombstones `dp.timelogDel`;
      push-after-pull and flush-on-hide. List stores: done too, same day.)
- **Sync security**: the sync URL is an unauthenticated bearer to all data; pull uses JSONP. Add a shared-secret token + CORS fetch with shape validation. Document the secrecy requirement.
- **Native**: fill the SCHEDULE_EXACT_ALARM Play declaration. (Done, build 109: BOOT_COMPLETED receiver, POST_NOTIFICATIONS.)
- **Perf**: renderToday re-renders whole screen per tap; layoutGraph O(N²) on main thread; pushState serializes all stores per keystroke (debounce note-save).
- **Consistency**: (Done: `dp.exercises` is a live list store (LIST_SYNC, merged on pull); fonts are self-hosted, so the privacy claim holds; custom number fields show in Stats as averages; 'Push all to Sheet' sends Events/Articles since v253.)
