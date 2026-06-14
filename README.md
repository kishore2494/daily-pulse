# Daily Pulse — your life tracker app

A fast, offline, installable app version of your **Daily Pulse** Google Form.
One tap to log mood, energy, habits, journal + tasks. Saves on your device and
(optionally) syncs every entry to a Google Sheet.

Works on **phone + desktop** as an installable app (PWA). No app store needed.

## What's inside
- `index.html`, `styles.css`, `app.js` — the app
- `manifest.webmanifest`, `sw.js`, `icons/` — makes it installable + offline
- `google-apps-script/Code.gs` — the Google Sheet sync backend

---

## 1) Try it on your Mac right now
```bash
cd "/Users/kishore/Documents/p/daily-pulse-app"
python3 -m http.server 8077
```
Open <http://127.0.0.1:8077> in Chrome. To install as a desktop app:
Chrome menu ▸ **Cast, save & share ▸ Install page as app**.

## 2) Put it on your phone (the real goal)
A phone needs the app on an **https link**, not a file. Easiest free options:

**Option A — GitHub Pages / Netlify / Vercel (recommended).** Upload this folder;
you get a link like `https://yourname.github.io/daily-pulse`. Open it on your
phone ▸ Share ▸ **Add to Home Screen**. Now it opens like a native app, offline.

> Ask me ("deploy it") and I'll set this up for you.

## 3) Connect your Google Sheet (optional but nice)
1. Open a Google Sheet ▸ **Extensions ▸ Apps Script**.
2. Paste everything from `google-apps-script/Code.gs`, **Save**.
3. **Deploy ▸ New deployment ▸ Web app** → Execute as *Me*, Access *Anyone* →
   **Deploy**, authorize, and **copy the Web App URL**.
4. In the app: **More ▸ Google Sheet sync** ▸ paste the URL ▸ **Save link**.

Every saved day now appends/updates a row in a `Log` tab. Hit **Push all to
Sheet** to back-fill everything you've logged so far.

---

## Features
- **Log** — your full Daily Pulse: mood, energy, sleep, deep-work, tasks done/planned,
  10-habit checklist, "went well / improve / journal", + a **Deep log** organised into
  collapsible sections (🧠 Mind & Focus · 😌 Wellbeing · 🩺 Health · 💼 Work · 📚 Learning ·
  💰 Finance · 📱 Digital · 🌱 Growth) — the bridge to your full 255-field Life Intelligence
  Tracker. Sunday adds a weekly-review block automatically.
- **Gym** — your real **Fitness Zone** plan (8 groups · 42 exercises: Cardio, Core, Chest,
  Triceps, Shoulder, Biceps, Back, Legs). Pick a group, tick each move off, tap any exercise
  for its **animated how-to demo + form tip + YouTube tutorial**, and log reps/weight.
  Per-day with a 💪 gym streak. Saves locally + folds a workout summary into the day's Sheet row.
  Edit the plan in `workout-plan.js`; animations live in `workout-anims.js`.
- **Tasks** — quick add, check off, carried-over tasks are flagged.
- **Habits** — per-habit streaks 🔥 and 90-day consistency heatmaps.
- **Stats** — streak, days logged, avg mood/energy, gym streak, workouts/30d; mood/energy &
  sleep/deep-work trend charts; 30-day habit completion bars.
- **History** — every past day, tap to view/edit.
- **More** — Sheet sync, daily reminder, JSON export/import backup.

## Notes
- Data is stored locally in your browser (localStorage). **Export a backup** from
  *More* periodically, or connect the Sheet so you always have a cloud copy.
- Reminders fire while the app is open/installed. For guaranteed background push,
  we'd add a small notification server later.
- The **Deep log** fields are the bridge to your full *Life Intelligence Tracker*
  (255-field spec). Add more fields in `DEEP_*` arrays in `app.js` and the matching
  `COLUMNS` in `Code.gs` — the form and Sheet pick them up automatically.
