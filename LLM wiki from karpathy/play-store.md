# Play Store launch

## Status (as of v52, 2026-07-24)
- Google Play Console account created (personal, kishore2494).
- **BLOCKED on identity verification.** The "Three steps"/"Key tips" emails are generic welcome mail, NOT approval. The console shows a "finish setting up your developer account" banner and empty "Choose an app". Waiting for the real "identity verified" email / banner.
- Everything on our side is staged and ready.

## Decisions made
- **Free launch first.** A free app can NEVER become paid-download later — only add IAP. So: free forever + later an optional **₹9/month sync subscription with 30-day free trial** via Google Play Billing (no external gateway; Google takes 15% after small-business enrollment).
- **Premium feature = cloud sync / multi-device accounts** (the only thing with real server cost). Tracking stays 100% free & local.
- **Category: Productivity** (NOT Health & Fitness — Personal accounts are restricted from health/finance/government *service* apps; a personal tracker is fine but avoid the risky category).
- **App access declaration: no login required** — all functionality available without an account.

## Package
- App id `io.github.kishore2494.dailypulse`, signed with the shared keystore (see gotchas).
- Built from `daily-pulse-native/` (Capacitor). Upload the `.aab` from `android/app/build/outputs/bundle/release/`.
- Version: appVersionCode increments per store upload; versionName tracks the web APP_VERSION.

## Assets (done, on ~/Desktop/daily-pulse-store-assets/)
Feature graphic 1024×500 + 5 phone screenshots (Log, Time, Stats, Cal, Write). 512 icon in `icons/`. Listing copy, data-safety answers ("collects nothing"), content rating (Everyone) in `store/play-listing.md`. Privacy policy live at `/privacy.html`.

## Remaining steps (once verified)
1. Create app in Play Console (name "Daily Pulse: Private Life Log", free).
2. Fill listing from `store/play-listing.md`; upload assets; data-safety = no collection; category Productivity; app-access = no login; full-screen-intent declaration = reminder/alarm app.
3. **Closed test**: upload `.aab`, add ≥12 testers, run 14 days (Google requires this for new personal accounts).
4. Turn on **managed publishing** so go-live is on the user's command.
5. Promote to production.
Rough timeline: verification (days) → build/test 14 days → live. ~3 weeks.

## Feedback loop
In-app feedback form (More) posts to `google-apps-script/Feedback.gs` → a separate "Daily Pulse Feedback" Sheet. **User still needs to deploy Feedback.gs and paste its URL into `FEEDBACK_URL` in app.js** (until then it falls back to opening a GitHub issue).
