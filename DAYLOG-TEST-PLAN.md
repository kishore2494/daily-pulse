# Daylog — what to test on the phone

**Web is v197 and already live.** Your installed app loads
`https://kishore2494.github.io/daily-pulse/`, so **everything below except §7 works on the app
you already have** — just open it. Force-close and reopen once to be sure the WebView picks
up the new bundle.

**Only §7 needs the new build:** `~/Documents/p/Daylog-113-share.apk` (4 MB).
Signature `144d1f76…d728` — same key as your current install, so `adb install -r` upgrades
in place and **keeps your data**. Verified, not assumed.

---

## 1. Trophy case — Stats ▸ Awards
- [ ] Case lists awards grouped by family, each with a real earned date (not today's date)
- [ ] "Next up" shows the closest unearned award per family with a progress bar
- [ ] Tap any award → share card sheet opens showing that award

**Watch for:** an award you had before that has vanished. That was a real bug (awards were
silently revocable); it is fixed, but your phone is the only place with real long-term data.

## 2. Goals — Stats ▸ Overview
- [ ] "＋ Add a goal" → pick a measure, a timeframe, tap **Suggest**
- [ ] Suggest fills a number that matches roughly what you actually do (not a round number)
- [ ] The row shows "N to go" and a per-day figure
- [ ] Adding the same measure+timeframe again **updates** rather than creating a duplicate
- [ ] The ✕ removes it

## 3. You vs you — Stats ▸ Overview
- [ ] Switch between vs last week / month / year
- [ ] **Screen time going UP must be red, not green** (this was the old bug)
- [ ] Footer says today sits out of both sides
- [ ] "vs last year" should say it unlocks on a date, since you don't have a year of data yet

## 4. Habit cues
- [ ] Customize ▸ Checklist habits → type a cue on any habit, e.g. "after my morning coffee"
- [ ] It appears under that habit's name on the Log
- [ ] **Tick the habit → the cue disappears. Untick → it comes back**
- [ ] Habits screen shows the plan above the heatmap; tapping 📍 jumps to the editor

## 5. Weekly streak — on the Log, in the today-ring card
- [ ] Shows either "This week: N of 7 · X more to count it" or "✓ This week counted"
- [ ] Check the number against what you actually logged this week

## 6. Month in review + post-activity save
- [ ] Stats ▸ Overview → "See <month>" → page through 5 cards with ‹ › and the dots
- [ ] Numbers match reality for a month you remember
- [ ] Start a timer, leave it >2 min, stop it → the save sheet appears
- [ ] Fill in title + effort + note → Save → reopen that block on the timeline, details are there
- [ ] Tap **Skip** on another one → nothing is saved, block still ends correctly
- [ ] **Android back closes every sheet** (share, save, month deck)

## 7. Share delivery — NEEDS THE NEW APK (build 113)
Install `Daylog-113-share.apk` first.
- [ ] Open a share card → tap **Share**
- [ ] The Android share sheet opens with the image (WhatsApp, Gallery, etc.)
- [ ] The shared image is the card you were looking at, not a different design

**Before the new APK** the button says "Save image" and tells you to screenshot — that is the
correct fallback, not a bug. Android WebView has no share API at all.

## 8. New in v195–v197 — the audit fixes
- [ ] **Settings ▸ Delete everything** — first tap only *arms* it ("Tap again to erase
      everything") and disarms itself after 6 seconds. **Please test the arming, then let it
      time out — don't confirm it unless you actually want your data gone.**
- [ ] **Settings ▸ "Nudge after 2 quiet days"** toggle exists and turns off. This is the only
      re-engagement notification in the app, and its old copy ("keeps your streak alive 🔥")
      has been replaced.
- [ ] **Perfect days** — if you had a suspiciously high perfect-day count before, it may drop.
      That is the fix, not a bug: a habit you have never once tapped used to be ignored
      entirely, so ticking 1 of 4 habits earned a perfect day. Conversely, a day where you
      *skipped* one habit now DOES count as perfect.
- [ ] **Stats on a fresh install** shows "–/100", not "0/100", for Polymath.
- [ ] Turn haptics off in Settings, then earn an award — it should **not** buzz.

## 9. Still worth re-checking (unverified since the alarm work)
- [ ] **Reboot the phone with a reminder set**, then check the reminder still fires.
      `BootReceiver` has never been proven at runtime — adb cannot send `BOOT_COMPLETED`.
- [ ] Alarm sound picker round-trip: Customize ▸ Alarm sound → pick a tone → preview → save
      → fire a test alarm and confirm it uses that tone.

---

## Before uploading 113 to Play

1. **Play Console → App content → Health apps declaration.** This blocks the upload because
   the app now reads Health Connect. It is not optional.
2. Store copy is refreshed and ready to paste:
   - `store/PASTE-1-app-name.txt` (28/30) — unchanged
   - `store/PASTE-2-short-description.txt` (72/80) — now includes "goal tracker"
   - `store/PASTE-3-full-description.txt` (3996/4000)
3. The listing says **nothing about sharing**, on purpose. Once 113 is live and §7 passes,
   that section can be added.

## The one thing only you can do

`daily-pulse-android/android.keystore` is still on one disk with no copy. Check **Play Console
→ Test and release → Setup → App integrity → App signing** first — if Play App Signing is
enrolled, a lost upload key is recoverable; if not, it is terminal. The encrypted-backup
command is in `daylog-native-backup/KEYSTORE.md`.
