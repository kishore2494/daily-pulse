# Features

Nav = **5 pinned tabs + a More overflow grid** (v56). `dp.navcfg` items carry `primary` (pinned to bottom bar — **no cap**, user pins however many they want), `hidden`, `noHide` (Log). renderNav() shows ALL pinned non-hidden tabs (no slice/cap) + a synthetic ⋯ More button → `renderMore()` grid of the rest (incl. Settings). Default opening tab = `settings.defaultTab` (device-local), applied via `navigateTo(defaultTab())` at init. All configurable in Settings ▸ Customize ▸ Tabs (📌 pin any number / 🎯 default / drag order / 👁 hide; a soft tip appears past 5 pins but nothing is blocked). Each screen = a `render*()` in the `RENDER` map, filling `#s-<key>`.

| Tab | key | render fn | storage | notes |
|---|---|---|---|---|
| Log | today | openToday/renderToday | dp.entries | core fields config-driven (`dp.corecfg`): mood, energy, sleep, deep-work, tasks, reflection, journal + deep-log sections (`dp.deepcfg`) + habit checklist (`dp.habitcfg`) |
| Time | time | openTime/renderTime | dp.timelog, dp.timeacts | 24h stopwatch, tap-to-switch, editable timeline, per-activity totals; writes `timeSummary` to the day's entry |
| Tasks | tasks | renderTasks | dp.tasks | carry-over, colors, drag |
| Notes | notes | renderNotes | dp.notes | drag, colors, voice |
| Plans | plans | renderPlans | dp.plans | named plan → own checklist |
| Focus | focus | renderFocus | dp.pomo, dp.timebox |
| Waves | waves | renderWaves | dp.waves | binaural-beat generator (delta/theta/alpha/beta/gamma), offline Web Audio, needs headphones | Pomodoro (config cycles, countdown ring, native end-of-phase alarm, optional logs focus time to a Time activity, daily 🍅 count) + Timebox (plan today's blocks, start alarm, one-tap start) |
| Gym | gym | openGym/renderGym | dp.gym + configs | 6-day split (`dp.daycfg`), exercises (`dp.gymcfg` overrides + `dp.gymgroups` custom), animated demos (workout-anims.js), per-set log |
| Habits | habits | renderHabits | dp.entries | streaks + 90-day heatmaps, built from HABITS (=visible `dp.habitcfg`) |
| Stats | dash | renderDash | all | trends, Polymath Index, time analytics (v38), connections graph, weekly auto-review, wellbeing averages (DYNAMIC from deep-log config) |
| Cal | cal | renderCal | dp.entries, dp.gym, dp.timelog, dp.events | month grid tinted by mood + dots; dated events with alarms |
| Write | write | renderWrite | dp.docs | block editor: heading/text/checklist/bullet, dictation, drag |
| History | history | renderHistory | dp.entries | (hidden from nav by default; reachable via More) |
| More | settings | renderSettings | dp.settings | sync, reminders, ntfy, data backup, feedback, **Customize** (renderCustom → `#s-custom`), guide link |

## Customization engine (More ▸ Customize, renderCustom)
Everything is editable and hideable: theme mode (navy/black/light) + accent (6 colors), nav tabs (reorder/rename/hide), core Log fields, deep-log sections/fields (add/rename/hide, incl. tick-list options), habits, time activities, gym exercises + sets + custom groups + the 6-day split. Deep-log: add/rename/hide fields AND **add or delete whole custom sections** (v58, ids `cs*`). `reloadCfg()` rebuilds the live `HABITS`, `TIME_ACTS_ALL`, `DEEP_SECTIONS` from their configs. Hidden items keep their history.

## Onboarding (first run only)
3 steps: welcome (with data-loss note) → pick habits (+ add own) → pick activities (+ add own). Gated by `needsOnboard()` (no data + no `dp.onboarded`). Unpicked items are hidden via the same config flags.

## Alarms & notifications (native shell only, all offline)
- **Reminders** (`dp.reminders`) — daily; mode `alarm` (full-screen) or `notify`.
- **Events** (`dp.events`) — one-time dated, optional alarm.
- **Web (no native shell):** `checkReminders` fires `fireAlarm`. Since v253 a reminder due while
  another is ringing waits in `_alarmQueue` and rings 600 ms after the first is dismissed.
  Before that it was marked notified and dropped. The same label is never queued twice.
- **Full-screen alarm** — `FullScreenAlarmPlugin` → `AlarmActivity` over lock screen (siren/vibrate/Dismiss/Snooze).
- **Running-timer notification** (id 770) — shows active activity + Pause/Stop/Resume (`refreshTimerNotif`).
- **2-day inactivity nudge** (id 760) — pre-scheduled, fires even if app never opened (`scheduleInactivityReminder`).
- **Pomodoro** (id 750) and **Timebox** (ids 800-830) end/start alarms.
- PWA fallbacks (no native shell): in-app foreground alarm, `.ics` calendar export, ntfy push.

## Added 2026-08-26/27 (v164 → v190)

Motivation and review layer, from `DAYLOG-STRAVA-RESEARCH.md`. Full mapping and the rules
each is bound by: `strava-build.md`.

- **Trophy case** (Stats ▸ Awards) — 60 awards across 9 tiered families, derived on read,
  never revocable, earned dates replayed from history.
- **Your best ever** (Stats ▸ Overview) — top-3 lifetime ladder per benchmark plus
  best-this-year; rows open that day.
- **Share cards** — 5 canvas designs at 4:5 and 9:16, drawn on device. Delivery falls through
  a 4-rung ladder because Android WebView has no Web Share API; delivery shipped natively
  (build 113+, live on Play), so `deliverCard()`'s screenshot rung is now only the PWA fallback.
- **You vs you** — temporal self-comparison over week / month / year, 10 measures, per-metric
  direction, today excluded, honest degradation.
- **Habit cues** — an optional when/where plan per habit, shown on the chip while un-ticked.
- **Weekly streaks** — a week counts at 3 of 7 days; the running week can never break it.
- **Month in review** — a 5-card deck for any month ever logged, no expiry.
- **Custom goals** — 9 measures × 3 timeframes, free, with the remaining gap always visible
  and "Suggest" drawn from the user's own last three periods.
- **Post-activity save** — title, 1–10 perceived effort and a note on any time block over two
  minutes; the block is saved before you are asked.
- **Fresh start** — one landmark note on a Monday, the 1st, or New Year's Day.
- **Health Connect insights** — 4 sensor insights and 13 correlations, every split on the
  user's own median.

Supporting: `tools/deploy.sh` (proves the live URL serves the version), unit tests (count: see log.md), and
an eval suite that now measures every Stats sub-tab and all four overlays.


## Photos & voice notes (v251, 2026-11-01)

**Storage:** IndexedDB `daylog-media`, object store `media` (keyPath `id`, indexes `day` and `ctx`).
A record looks like this:
`{ id, kind:'photo'|'voice', mime, blob, thumb?, day, ctx:'log'|'note:<noteId>', ts, w?, h?, dur?, size, caption?, enc? }`.
`enc` is the encoder generation (`MEDIA_ENC`, 2 since v252). A photo without it was saved by v251.
At boot `mediaLoad()` reads every record into the in-memory map `_media`. IDB blobs are
disk-backed handles, so this is cheap. After that, rendering is synchronous.

- **Where it shows:**
  - The Log section `media` ("Photos & voice", after Reflection). `logSecCfg()` now inserts a
    newly added section after its predecessor in the defaults, not at the very bottom.
  - Notes: Photo / Gallery / Voice each create a new note. The note is created only after the
    media is written, so a cancelled camera leaves no empty note. Deleting a note deletes its
    media.
  - An existing note (v253): its camera button (`data-note-attach`, state `openAttachId`) shows
    Photo / Gallery / Voice with `data-mctx="note:<id>"`. Every note now renders its compact
    media slot (empty and hidden by `:empty` until something is added), so an addition or a
    recording bar appears in place through `refreshMediaSlots()`.
  - History row pills (📷 n 🎙 n), History ▸ Photos (by month), "On this day" (photo-only days
    count), and the `photos` share card.
- **Photos:**
  - `mediaPhotoBlobs()` decodes with `createImageBitmap(..., {imageOrientation:'from-image'})`
    and re-encodes on a canvas. Since v252 that is **WebP q0.70 with a 1280px long edge**, plus a
    320px WebP q0.6 thumbnail. `mediaEncode` checks the type that comes back, because Safari
    returns a PNG when asked for WebP, and anything that is not WebP is redone as JPEG.
  - Measured in Chrome on six real 12 MP photos: 181 KB on average with the thumbnail
    (113–282). v251's 1600px JPEG q0.82 averaged 407 KB for the same six; 1440px WebP q0.74
    averaged 223 KB. Lower quality at 1440 saved little. Re-encoding also strips EXIF, so no GPS
    data is kept.
  - **Shrink older photos** (Settings ▸ Storage, `mediaShrinkAll`): re-encodes each photo with
    `enc < MEDIA_ENC` and replaces it only when the result is at least 10% smaller. It always
    stamps `enc`, so a photo is never re-compressed twice. It stops at the first quota abort and
    re-reads IDB afterwards, so the blobs are disk-backed again. On the six test photos the v251
    copies went from 2.4 MB to 901 KB.
  - Sharing converts to JPEG at full size (`mediaShareBlob`), because some apps take a shared
    .webp as a sticker. The backup stores `enc`. On restore, `b64ImageMime` sniffs the
    thumbnail's type from its first bytes (`UklGR` = WebP, `/9j/` = JPEG).
  - Camera = `<input capture=environment>`; gallery = `multiple`.
- **Voice:**
  - MediaRecorder, preferring `audio/webm;codecs=opus` at 24 kbps **mono** since v252
    (`VOICE_BPS`, `channelCount: 1`, AGC on). Measured at 22 kbps, about 180 KB a minute. v251
    used 32 kbps.
  - An AnalyserNode drives a level meter. If the peak stayed below 0.02, the save toast says
    the clip sounds silent.
  - Notes under 0.7 s are dropped; recording stops at 10 minutes.
  - Leaving the screen or the app, or pressing Android back, **saves** the recording.
  - `dur` is stored because webm from MediaRecorder carries no duration.
- **Viewer** (`#media-view`):
  - Swipe left/right to page, swipe down to close.
  - Caption (debounced put), "Open day", Share (native `DaylogShare.shareImage`, else Web Share,
    else a download) and Delete.
  - "Open day" opens the **read-only day page** (History), not the Log editor. It is hidden
    when that day's page or Log is already showing. Closing the viewer, or any
    `refreshMediaSlots()`, redraws an open day page in place (`histDayRefresh`).
  - Android back closes it first. From History ▸ Photos it pages through the whole gallery
    (`data-mset`).
- **Writes:** `mediaWrite()` resolves on transaction **complete**, not on the request. A quota
  abort lands after the request has "succeeded" (gotchas).
- **Backup and wipe:**
  - The backup carries `_media` as base64.
  - Restore validates each item with `mediaItemValid()`, adds only missing ids, never
    overwrites, and stops at the first quota failure. Its result is reported separately.
  - Delete-everything closes the handle and calls `deleteDatabase` before reloading.
- **Native:** no change was needed in build 118.
  - CAMERA is not declared, so Capacitor's file chooser takes the image-capture intent path.
  - RECORD_AUDIO and MODIFY_AUDIO_SETTINGS were already declared, so getUserMedia gets a
    runtime prompt.
  - The FileProvider `external-path "."` covers the capture file.
- **Not done yet:**
  - sharing voice notes in the native app (`shareImage` sets an image MIME type)


## History ▸ one day, read-only (v252, 2026-11-01)

A History row used to open the Log editor for that day. It now opens `historyDayHTML(d)`, a
read-only page, as a sub-view of History (`histDay`, like `curDoc` in Write).
- **What it shows**, only where the day has something:
  - Hero: the mood-tinted header (hue from mood, red→green), the weekday, full date and
    relative date (`relDay`), mood and energy bars, the mood-grid quadrant, and any mood words
    tagged in the journal. Edit sits top right.
  - Tiles: sleep with bed–wake, deep work, tasks done, checklist x/y, steps, screen time,
    exercises and money spent. 2 or 4 tiles use two columns, so none is left on a row alone.
  - Reflection: the core text fields with the user's own labels and trailing emoji removed, the
    journal with line breaks and #tags, and the Sunday review.
  - Photos (full images, captions overlaid, the first one wide when the count is odd) and
    playable voice notes. They cannot be deleted here (`voiceRowHTML(r, false)`).
  - Checklist (done, then skipped, then missed), a 24-hour time bar with the top 6 activities,
    workout, tasks done and events, money, notes created that day, and the deep log (only the
    fields that hold something).
- **Navigation:**
  - The ‹ › arrows step through the days History lists.
  - Back (on screen or Android) returns to the list at the same scroll position.
  - Edit sets `_editFromHist`. Back or Done on that Log flushes the debounced autosave and
    returns to the day page, which shows the edit. Leaving the Log any other way (`show()` to
    another screen, or `navigateTo`, including the Log tab) forgets the way back.
  - The History tab always opens on the list.
- **Every other "open that day" tap opens this page too**, never the Log: Calendar's "View day →"
  (was "Open log →"), a year-in-pixels square, a personal best, a Search hit in a day, an On
  this day row, and the photo viewer's "Open day". `dayOpen(d)` records `_dayFrom = {screen, y}`;
  the back button then names that screen ("← Calendar", "← Stats", "← Search", "← Log") and
  Back returns there at the same scroll (instant, because `html` has `scroll-behavior: smooth`).
  Edit → Log → Back still comes back to the day page first. `show()` to any screen other than
  the Log or History, and every `navigateTo`, forget `_dayFrom`.
- Money rows use `hd-in`, not `.in`/`.out`. The Money screen's global `.in`/`.out` rules colour
  whole rows.

## Write ▸ photos (v253)

- Camera / Photo under the block toolbar save a photo with ctx `doc:<docId>` and append a block
  `{t:'i', mid}` (`docPhotoBlock`). `photoBlockRow` shows it full width with the viewer caption;
  `#blk-list[data-mset]` makes the viewer page in block order.
- Deleting:
  - Removing the block deletes the photo, media first.
  - Deleting the photo in the viewer drops its block (`docDropBlocks`).
  - Deleting the article deletes its photos.
- A block whose photo is missing (synced from another phone) shows "not on this phone" and is
  never pruned automatically: pruning would sync back and orphan the photo on the phone that
  has it.
- Orphans: `mediaOrphanCtxs` includes `doc:` ctxs with no article. Notes ▸ Unattached offers
  "Make it an article again" (`mediaRestoreDoc`, titled "Recovered photos").
- `writeRefresh()` (from `refreshMediaSlots`) redraws the editor only when it holds a photo
  block, so typing elsewhere is not interrupted.
- The Sheet gets a `[photo: caption]` line.
- Backup: `mediaItemValid` accepts `doc:`.

## Settings ▸ Storage (v252, 2026-11-01)

`storagePageHTML()`, on the "Your data" group's Storage row (whose subtitle is the total).
- One card shows the total, a stacked bar and rows biggest first: localStorage grouped by
  `STORE_GROUPS` (logs, health, time, money `dp.fin*`, notes/tasks/plans, workouts, other),
  plus Photos, Voice notes and App files.
  - App files is the service worker cache, summed once per session by `storageMeasure()`. It is
    left out if it cannot be measured.
- **Text space** is the localStorage characters against Chrome/WebView's 10 MiB of UTF-16
  (5 Mi characters). It turns red at 70% and says to export a backup.
- The page says Android's App info shows more, because it also counts the app and its
  temporary files, and that **Clear storage** there deletes everything.
- The Shrink older photos card shows only while `mediaShrinkCount() > 0`.
