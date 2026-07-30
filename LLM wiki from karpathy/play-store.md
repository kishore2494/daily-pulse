# Play Store launch — status & handoff

_Last updated: 2026-07-29 · app live at v60 · Play Console: closed-test release submitting for review._

## Where we are RIGHT NOW
- Google Play Console account: **kishore_ (Personal)**, identity **verified**. One app: **Daily Pulse**, package **`io.github.kishore2494.dailypulse`**, status **Draft → first closed-test release being submitted for review**.
- Uploaded bundle: **versionCode 100 / versionName 60**, targetSdk 36 — the **Capacitor** build WITH native alarms (verified: contains FullScreenAlarmPlugin/AlarmActivity/AlarmReceiver + USE_FULL_SCREEN_INTENT). File: `store/assets/DailyPulse.aab`.
  - ⚠️ An earlier upload was the WRONG bundle (old TWA "2 (47)", no native alarms). It was replaced with 100. If a future release shows a low versionCode, re-upload `store/assets/DailyPulse.aab` (rebuild first — see below).
- Declarations done in Console: **Data safety = collects/shares NO data**; **Advertising ID = No**; **Full-screen intent = core functionality "Other"** (NOT "Alarm clock" — declaring a tracker as an alarm clock is a misdeclaration risk; so FSI is NOT pre-granted on Android 14+, alarm still fires as a high-priority notification and users can enable full-screen manually). **Category = Productivity**.
- **assetlinks/SHA-256 NOT needed** — that was only for the abandoned TWA approach. Capacitor loads the site in a native WebView (always fullscreen). The `.well-known/assetlinks.json` in the repo is harmless leftover.

## Immediate next steps (to actually launch)
1. **Submit the closed-test release for review** (0 errors; the "no deobfuscation file" warning is harmless — we don't obfuscate). Google reviews first release: hours–2 days.
2. **Add ≥12 testers** — Test and release ▸ Testing ▸ Closed testing ▸ your track ▸ **Testers** tab → email list (12 real Google accounts) + share the opt-in link. They must stay opted in **14 continuous days**.
3. After 14 days → **Apply for production** → answer the closed-test questions → Google review → live.
4. Verify the "Finish setting up your app" checklist is all green (privacy policy, content rating=Everyone, target audience 18+, store listing, category, contact).

## Store listing content (all prepared)
- App name: **Daily Pulse: Private Log**. Short/full description + data-safety answers: `store/play-listing.md`.
- Privacy policy URL: `https://kishore2494.github.io/daily-pulse/privacy.html`
- Website URL (for Console contact): `https://kishore2494.github.io/daily-pulse/landing.html` (the marketing landing page).
- Graphics in `store/assets/` (committed to git except the binaries):
  - `feature-graphic.png` 1024×500 · `screenshot-1..5-*.png` 412×820 (≤2:1) · `tablet-1..3.png` 1920×1200 (upload the SAME 3 to BOTH 7-inch and 10-inch slots) · app icon `icons/icon-512.png`.
  - `DailyPulse.aab` / `DailyPulse.apk` — git-IGNORED (rebuildable), sit in `store/assets/` on disk.

## Rebuild the bundle (if needed)
```
cd daily-pulse-native/android
# bump versionCode ABOVE the last uploaded (currently 100) in app/build.gradle
JAVA_HOME="/Applications/Android Studio.app/Contents/jbr/Contents/Home" ./gradlew bundleRelease assembleRelease
cp app/build/outputs/bundle/release/app-release.aab ../../daily-pulse-app/store/assets/DailyPulse.aab
cp app/build/outputs/apk/release/app-release.apk  ../../daily-pulse-app/store/assets/DailyPulse.apk
```
Verify it has native alarms: `aapt dump xmltree DailyPulse.apk AndroidManifest.xml | grep -iE "AlarmActivity|USE_FULL_SCREEN_INTENT"`.

## Decisions locked
- **Free launch.** Later: optional **₹9/mo cloud-sync subscription** (or ₹99 one-time Pro) via Google Play Billing. Sync/accounts = the premium feature. Sync UI currently HIDDEN in-app (`SHOW_SYNC=false` in renderSettings; code intact). Multi-device sync backend = Firebase (user must create the project) — see roadmap.
- Feedback: email field removed; posts to owner-only `Feedback.gs` sheet.

## Still on the USER (only they can do)
- Deploy the latest **`google-apps-script/Code.gs`** (Time Log/Events/Articles tabs) AND **`Feedback.gs`** in Apps Script, then paste the Feedback web-app URL into **`FEEDBACK_URL`** in app.js (feedback currently falls back to opening a GitHub issue).
- **Back up `daily-pulse-android/android.keystore` + `keystore-password.txt` off-machine** — irreplaceable; losing them = can never update the app.
- Line up the 12 testers.
- Real-phone test of the full-screen alarm + timer notification (emulator can't; MIUI needs manual "show on lock screen" perms).

## When the app goes live
- Swap the landing page's "Coming soon to Google Play" pill for a real **Get it on Google Play** badge + set `product.play_url`.
