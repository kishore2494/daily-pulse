# Architecture

## Stack
Vanilla HTML/CSS/JS — **no framework, no build step**. Three core files in `daily-pulse-app/`:
- `index.html` — shell: topbar, one empty `<section class="screen" id="s-*">` per screen, `<nav id="nav">`, alarm overlay, onboarding overlay, toast. Screens are filled by JS.
- `app.js` (~3455 lines) — everything: storage, screens, sync, native bridges. Single file, section-commented (`SCREEN: …`).
- `styles.css` (~582 lines) — "dark instrument panel" theme (Sora + DM Sans, glassy nav, gradient accents, glow + grain background). Revert-safe: `git checkout pre-ux-v40 -- styles.css`.
- `sw.js` — network-first service worker + cache-bust on `controllerchange`. **Bump `CACHE` with every release.**
- `manifest.webmanifest`, `icons/`, `guide.html` (how-to), `privacy.html`, `google-apps-script/Code.gs`.

## Data model — local-first
Everything lives in `localStorage` under `dp.*`. The `DB` object (top of app.js) wraps get/save for each store; every save calls `pushState()` (debounced multi-device push).

Storage keys:
- `dp.entries` — daily log entries keyed by date `YYYY-MM-DD` (mood, energy, habits{}, deep-log fields, journal, timeSummary…). Merged per-date, newest `updatedAt` wins.
- `dp.timelog` — 24h time-tracker segments `{id, act, start(ms), end(ms|null), upd}`. Merged by id, newest `upd`.
- `dp.gym` — workout ticks/logs keyed by date. `dp.exercises` legacy.
- `dp.tasks`, `dp.notes`, `dp.plans`, `dp.reminders`, `dp.events`, `dp.docs`, `dp.timeacts` (custom activities), `dp.timebox` — lists.
- **Config stores** (customization): `dp.habitcfg`, `dp.actcfg`, `dp.deepcfg`, `dp.gymcfg`, `dp.gymgroups`, `dp.daycfg`, `dp.corecfg`, `dp.navcfg`, `dp.pomo`.
- `dp.settings` — syncUrl, accent (theme), ntfyTopic/ntfyOn.
- Bookkeeping: `dp.touched` (last-write ms), `dp.onboarded`, `dp.lastBackup`, `dp.pausedAct` (pomodoro), `dp.notified.*` (fired-reminder flags, cleaned by `cleanNotifiedFlags()`), `dp.ntfy.sent`.

**Three lists that must stay in sync — edit ALL when adding a store:**
1. `pushState()` payload (what gets pushed to the cloud)
2. `applyRemoteState()` merge (what gets pulled/merged) — lists adopt newest-device-wins; entries/gym/timelog merge per-record
3. `BACKUP_KEYS` (export/import backup)
Plus `reloadCfg()` if it's a customization config, and the Apps Script `Code.gs` if it needs a readable Sheet tab.

## Multi-device sync (optional)
The Google Sheet **link is the login**. `google-apps-script/Code.gs` is a Web App (Execute as Me, access Anyone). Full-state snapshot chunked into a hidden `_State` tab; pulled via **JSONP** (`pullState`) to dodge CORS; pushed via `no-cors` POST (`pushState`, debounced 1.2s). Readable tabs also written: `Log`, `Time Log`, `Events`, `Articles`, `Notes`, `Reminders`, `Feedback`. **When Code.gs changes, the user must re-paste it and redeploy a new version** — the Sheet's Log columns are FIXED, so brand-new custom fields sync between devices but don't auto-create Sheet columns.

## Native shell (Android)
Two wrappers exist; **Capacitor is current**:
- `daily-pulse-native/` (Capacitor) — loads the live site remotely (`server.url`), so web pushes update the app instantly. Adds native plugins: `@capacitor/local-notifications` + a custom `FullScreenAlarmPlugin` (Java) for lock-screen alarms. This builds the `.aab` for the Play Store.
- `daily-pulse-android/` (older TWA/Bubblewrap) — superseded; keep only for `android.keystore` + `keystore-password.txt` (the shared signing identity — back these up, never lose them).

Because the shell loads the remote URL, **web-only features need no rebuild** (they reach the installed app on next open). Only native-code changes (new plugin, permission, icon) need a Gradle rebuild with JDK 21 (Android Studio's JBR).

## Deploy
Two GitHub repos, both GitHub Pages, both owned by personal account **kishore2494** (git keychain defaults to work account kishore-FP — see gotchas for the push helper):
- `kishore2494/daily-pulse` → **production** URL. Push here for stable releases.
- `kishore2494/jurnal-app` → **dev** URL. First/original repo.
Git remotes in `daily-pulse-app/`: `origin` = jurnal-app, `prod` = daily-pulse. Release = commit, push both, bump version + cache.
