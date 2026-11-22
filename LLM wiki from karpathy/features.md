# Features

Nav = **5 pinned tabs + a More overflow grid** (v56). `dp.navcfg` items carry `primary` (pinned to bottom bar — **no cap**, user pins however many they want), `hidden`, `noHide` (Log). renderNav() shows ALL pinned non-hidden tabs (no slice/cap) + a synthetic ⋯ More button → `renderMore()` grid of the rest (incl. Settings). Default opening tab = `settings.defaultTab` (device-local), applied via `navigateTo(defaultTab())` at init. All configurable in Settings ▸ Customize ▸ Tabs (📌 pin any number / 🎯 default / drag order / 👁 hide; a soft tip appears past 5 pins but nothing is blocked). Each screen = a `render*()` in the `RENDER` map, filling `#s-<key>`.

| Tab | key | render fn | storage | notes |
|---|---|---|---|---|
| Log | today | openToday/renderToday | dp.entries | core fields config-driven (`dp.corecfg`): mood, energy, sleep, deep-work, tasks, reflection, journal + deep-log sections (`dp.deepcfg`) + habit checklist (`dp.habitcfg`) |
| Time | time | openTime/renderTime | dp.timelog, dp.timeacts | 24h stopwatch, tap-to-switch, editable timeline, per-activity totals; writes `timeSummary` to the day's entry |
| Tasks | tasks | renderTasks | dp.tasks | carry-over, colors, drag |
| Notes | notes | renderNotes | dp.notes | drag, colors, voice |
| Plans | plans | renderPlans | dp.plans | named plan → own checklist |
| Focus | focus | renderFocus | dp.pomo, dp.timebox | Pomodoro (config cycles, countdown ring, native end-of-phase alarm, optional logs focus time to a Time activity, daily 🍅 count) + Timebox (plan today's blocks, start alarm, one-tap start) |
| Waves | waves | renderWaves | dp.waves | binaural-beat generator (delta/theta/alpha/beta/gamma), offline Web Audio, needs headphones |
| Gym | gym | openGym/renderGym | dp.gym + configs | 6-day split (`dp.daycfg`), exercises (`dp.gymcfg` overrides + `dp.gymgroups` custom), animated demos (workout-anims.js), per-set log |
| Habits | habits | renderHabits | dp.entries | streaks + 90-day heatmaps, built from HABITS (=visible `dp.habitcfg`) |
| Stats | dash | renderDash | all | trends, Polymath Index, time analytics (v38), connections graph, weekly auto-review, wellbeing averages (DYNAMIC from deep-log config) |
| Cal | cal | renderCal | dp.entries, dp.gym, dp.timelog, dp.events | month grid tinted by mood + dots; dated events with alarms |
| Write | write | renderWrite | dp.docs | block editor: heading/text/checklist/bullet, dictation, drag; photo/video/voice blocks (v254); lists articles only |
| Memories | memories | renderMemories | dp.docs (`kind:'memory'`) | v254 (unreleased): pages with date/place/people/tags, `[[links]]` + backlinks, timeline, bulk import, videos |
| Meals | meals | renderMeals | dp.meals, dp.meallib, dp.mealshop | unreleased (2026-11-15): weekly planner, shopping list, Today's meals on the Log — see ▸ Meals |
| History | history | renderHistory | dp.entries | (hidden from nav by default; reachable via More) |
| More | settings | renderSettings | dp.settings | sync, reminders, ntfy, data backup, feedback, **Customize** (renderCustom → `#s-custom`), guide link |

## Customization engine (More ▸ Customize, renderCustom)
Everything is editable and hideable: theme mode (navy/black/light) + accent (6 colors), nav tabs (reorder/rename/hide), core Log fields, deep-log sections/fields (add/rename/hide, incl. tick-list options), habits, time activities, gym exercises + sets + custom groups + the 6-day split. Deep-log: add/rename/hide fields AND **add or delete whole custom sections** (v58, ids `cs*`). `reloadCfg()` rebuilds the live `HABITS`, `TIME_ACTS_ALL`, `DEEP_SECTIONS` from their configs. Hidden items keep their history.

## Home-screen widget (Play build 121+, v262 web)
- Native (daily-pulse-native, `WidgetBridgePlugin.java` + `DaylogWidgetProvider.java`, layouts `widget_full` 4x2 /
  `widget_compact` 4x1 / `widget_narrow` 3x1, `xml/daylog_widget_info.xml`): deep-ink card, sunrise mark, "Not logged
  yet / Logged today / Feeling good", 🔥 streak chip, tasks hint, 5 faces 😣😕😐🙂😄 = mood 1/3/5/7/9 (the mood grid's
  MM_COLS). No journal text. Redraws for a new day after midnight without the app (inexact, 3-hour backstop).
- Data in: `pushWidgetData()` → `WidgetBridge.update({streak, mood, logged, day, tasksDone, tasksPlanned, …})` after
  every save, on open, when the app is left, and across midnight (`widgetSync`).
- Taps out: a face opens MainActivity, which queues `{mood, at}` natively (per-install secret on the intent so other
  apps can't inject; newest 20 kept). `drainWidgetActions()` at launch / on return / on the `widgetTap` event →
  `widgetTapsApply`: newest tap per day, saved via `saveDraftNow`; never overwrites a mood saved after the tap;
  energy untouched; dropped during onboarding. Then the Log + "Mood saved 🙂"; the grid says "Mood 🙂 saved · tap a
  square to add your energy too".
- The plugin also has `requestPin` and `status`: an "Add widget to home screen" button can ship web-only later.
- Not yet seen on a real device (as of 2026-11-21). A layout mistake shows as "Problem loading widget".

## Rating asks (native shell only)

- **Two ways, one budget: at most two asks per person, ever, and none after they tap Rate.**
- **Build ≤121 / no plugin:** the older card (`maybeAskForReview`, `dp.rateAsk {asks,last,done}`), shown when a
  celebration closes (7+ day streak or new award) after 7 real days; "Rate Daylog" opens the Play listing.
- **Build 122+:** Play's own in-app sheet via the `InAppReview` plugin (`InAppReviewPlugin.java`,
  `com.google.android.play:review:2.0.2`); the old card stands aside. `maybeAskReview()` runs after each save
  by hand and fires 2.5 s later (after the award scan) when: onboarded, no tour, today logged by hand with mood
  ≥7, 7+ hand-logged days (30+ and 60 days after the last ask for the second), no celebration or card on
  screen, not typing, app visible. `dp.reviewAsk {n,last}` is written before the call. Both keys are
  install-local (BACKUP_EXCLUDED). Google decides whether the sheet actually shows (quota) and never says;
  it only appears in an app installed from Play (internal testing works).
- No "Do you like Daylog?" pre-question and nothing routes unhappy users elsewhere: review gating is against
  Play policy. Mood ≥7 only picks the moment.

## Onboarding (first run only)
**2 steps since v262 (was 4):** (1) welcome + privacy + backup note + the restore door; (2) "Make it yours": the 4
starter habits (tap to drop) and "Remind me to log my day" ticked at 21:00 → "Start logging". Step 2 is the only
place onboarding asks for notification permission, so everyone who finishes passes it (`OB_LAST = 1`; an old step
number lands on the last step). Dropped from onboarding: the style picker (Settings ▸ Style & appearance), the
add-your-own habit/activity rows (Log checklist add row, Settings ▸ Customize). Gated by `needsOnboard()` (no data +
no `dp.onboarded`). Unpicked items are hidden via the same config flags.
**Tour: 4 steps (was 8):** mood card → time tracker → Your patterns → Menu (mentions Settings for looks, reminders,
backups). "Skip tour" first; every exit lands on the Log; after it, "Your turn: tap how today feels" until today
has a mood. The card moves to the top when it would cover its target.

## Alarms & notifications (native shell only, all offline)
- **Reminders** (`dp.reminders`) — daily; mode `alarm` (full-screen) or `notify`.
- **Events** (`dp.events`) — one-time dated, optional alarm.
- **Web (no native shell):** `checkReminders` fires `fireAlarm`. Since v253 a reminder due while
  another is ringing waits in `_alarmQueue` and rings 600 ms after the first is dismissed.
  Before that it was marked notified and dropped. The same label is never queued twice.
- **Full-screen alarm** — `FullScreenAlarmPlugin` → `AlarmActivity` over lock screen (siren/vibrate/Dismiss/Snooze).
- **Running-timer notification** (id 770) — shows active activity + Pause/Stop/Resume (`refreshTimerNotif`).
- **Log notifications — `nudgePlan()`** (since v261; `scheduleInactivityReminder` runs it on every save, open and
  Settings switch; never asks for permission). At most one log notification per day, all tapping through to the Log
  (`extra.go`, `setupNudgeTap`):
  - the **"Log my day" reminder** (`isLogReminder`: label "Log my day", notify mode, i.e. the one onboarding creates)
    is scheduled here, ids 840-846, today + 6 days, skipping today once `loggedByHand` (auto-filled timeSummary /
    workouts don't count). Copy: first-log line → "N more logged days and Stats can show…" (insights unlock at 5) →
    5 rotating lines. In alarm mode it is an ordinary reminder again (scheduleNativeAlarms).
  - **come-back nudges** (ids 760-764, `dp.nudgeOff` = Settings ▸ Log screen widgets ▸ Come-back nudges): days
    1 (brand-new users) or 2, then 5, 10, 20, 30 after the last logged day; the 30-day one says it is the last.
    Days already covered by the reminder are skipped. Time = the reminder's time, else 20:00.
  - Copy rules (tests enforce): no loss framing, no "streak", never quotes an entry on the lock screen.
  - **Mood buttons** (v262): every log notification has action type `dp_log` = 🙂 Good (8) / 😐 Okay (5) / 😕 Low (3)
    (`NOTIF_MOODS`). Capacitor builds actions as activity intents, so a button opens the app; `onNudgeAction` →
    `applyNotifMood(extra.day, v)`: today, or yesterday when last night's reminder is answered after midnight,
    older → today; a mood already set is never overwritten. Registering `dp_log` leaves the timer's types alone
    (Capacitor's writeActionGroup stores per type id).
  - **Sunday recap** (v262): once past 5 logged days, Sunday's "Log my day" reads "This week: N days logged, best
    mood on <weekday>. Log today to round it off." (`weekRecapCopy`, from `nudgeInput().recent`, needs ≥2 days).
- **One-time notification ask** (v262, `notifAskKind`/`notifAskHTML`, slot `#notif-ask-slot` under the Lift card on
  today's Log): after the first entry logged BY HAND today (saved entry, not the draft — loadDraft pre-fills tracked
  sleep). No "Log my day" reminder → "Want a nudge tomorrow?" + time → creates it (→ Android's prompt via
  scheduleNativeAlarms). Reminder set but permission off → "Your reminder can't ring" → requestPermissions, else
  opens Android's notification settings. Never during onboarding/tour, never on the web. One answer per install
  (`dp.notifAsk`, BACKUP_EXCLUDED). `_notifPerm` refreshed at start and on every return to the app.
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
- **Open items:** roadmap.md ▸ Photos & voice.


## Recordings (built 2026-11-22 on branch `recorder`, NOT deployed)

Kishore, 2026-11-21: "I need to journal a lot but can't type it." Long voice entries: record, pause, leave the app,
come back, stop; share one as an audio file (he gives it to Claude to transcribe) and paste the text back.
Contract with the Android side: `RECORDER-SPEC.md`. Code: app.js `SCREEN: RECORDINGS` block.

- **Where:** ☰ Menu ▸ Your tabs ▸ Recordings (always there, like Lift; not a navcfg tab) and the **Recordings** button
  beside 🎤 Speak under the journal. From a past day's Log, a new recording is saved on that day (`_recFor`).
- **Engines:** `recNative()` = `Capacitor.Plugins.LongRecorder` (build 123+): records with the screen off; at start-up
  and on every return `recNativeAttach()` calls `status()` (reattach, `recovered`) and `list()` (finish records
  stopped while closed, adopt files with no record, refresh uris: `.aac` while recording → `.m4a` after). Without it:
  MediaRecorder, `REC_SLICE_MS` 4 s slices written to IndexedDB as they arrive (chained writes), wake lock,
  "keep Daylog open"; `recRecover()` at start glues a killed recording's slices back (`cut: true`, "saved after
  Daylog closed"). Pausing flushes a slice (`requestData`). One microphone: voice notes refuse to start meanwhile.
- **Limits:** `REC_MAX_MS` 3 h (saves itself), warning at 2 h 50 m; under 0.7 s is dropped (`VOICE_MIN_MS`).
- **Storage:** IndexedDB `daylog-rec`: `recs` {id, src web|native, state live|done, ts, day, title?, mime, blob (web) or
  uri (native), dur, size, transcript?, trBlock?, trDay?, del?, cut?} and `chunks` {k, rid, seq, blob, ms}.
  Never in a backup (not in `_media`, no dp.* key), never synced. A delete hides at once with Undo; the `del` flag
  is saved so a kill inside the 6.5 s window still finishes it at the next start; a native file is removed first.
- **List:** by day, newest first; title (default "Recording · 9:40 pm", `recTitle`), length, size. Tap a row: scrub
  bar, ±15 s, Rename, Day (date input, not after today), Share, Add/Edit transcript, Delete. A webm from
  MediaRecorder has no duration; the player seeks to 1e101 once so Chrome finds it.
- **Share:** native → `LongRecorder.share({id,title})`; web blob → Web Share with files, else a download in a
  browser; the Play app ≤122 cannot share one (its share plugin is image/text only) and says so.
- **Add transcript:** `recTranscriptToDay` → `saveDraftNow` (flushAutosave first; loadDraft if the Log shows that
  day). The paragraph is "🎙️ <title>\n<text>"; saving again replaces it if unchanged by hand, emptying removes it.
- **Widget/shortcut:** `{action:'record', at}` → `widgetRecordRoute`: opens Recordings; starts one recording if a tap
  is ≤2 min old (`REC_STALE_TAP_MS`) and none is running. Mood taps are unaffected.
- **Tests:** unit.js (formatting, names, day moves, grouping, cap, queue routing, recovery plan, journal merge,
  storage/backup exclusion, screen/menu/Log) and unit-async.js (web engine with a fake MediaRecorder, crash
  recovery, Undo, native engine/reattach/notification events with a fake plugin, widget drain, wipe).
- **Edge rules (review, 2026-11-22):** a native record whose file is not in `list()` is marked "The file is not on
  this phone" (Android backup excludes the files), not dropped; a web recording holds a Web Lock so a second tab
  does not recover it; 🎤 Speak and voice notes are refused while a recording runs; the native side also stops at
  3 h (`cap`) and on low storage (`storage`).
- **Open:** run in the Play app with build 123; History's day page could list that day's recordings.

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

## Memories (v254, built 2026-11-04, NOT deployed)

Kishore asked for "live documentation" of his memories — photos, videos — "like Notion or
Obsidian". Decided with him: **inside Daylog**; a memory holds videos, a story, a timeline and
bulk import; big files stay **on the phone only** (no Drive, no compression).

- **Model:** a memory is a Write page (`dp.docs`) with `kind:'memory'`, `date` (YYYY-MM-DD, the
  day it happened), `place`, `people[]`, `tags[]`, `blocks`. So it syncs item by item like any
  page (LIST_SYNC `docs`), is in backups, and reaches the Sheet's Articles tab (first line =
  `memPropsLine`). Write's list filters memories out; search opens them on Memories.
- **Blocks:** the shared editor now serves both screens (`docHost`/`docCurId`/`docRerender`).
  Media blocks: `i` photo, `v` video, `a` voice (`isMediaBlk`, `mediaBlockType`,
  `docMediaBlock`). `docMediaActsHTML` = Photo · Video · Gallery · Voice, with a rec-only media
  slot that is empty unless a recording runs there.
- **Read view** (Notion-style): cover (first photo/video still, or `m.cover`), title, property
  rows (date + "N years ago", place/people/tags as filter chips), blocks with consecutive
  photos/videos as a gallery, then **Links to**, **Linked from** (backlinks, articles included)
  and **Same people or place**. `[[Title]]` matches a page title case-insensitively; an
  untitled memory goes by its date (`memTitle`). `memInline` escapes everything else.
- **Edit view:** title, date/place/people/tags (people and tags are comma lists, cleaned by
  `memWords`; suggestion chips from other memories; places via a datalist), the block editor,
  🔗 Link picker (inserts `[[Title]]` into the block last touched), Delete (media first).
- **Timeline:** year → month, 2-column cards (cover, title, date, place, people, snippet,
  counts), search over title/place/people/tags/text/captions, facet chips, and an "On this
  day" strip (same MM-DD, earlier years).
- **Bulk import** (`memImportPrepare` → `memImportRun`): many photos/videos at once, grouped by
  the day each was **taken** — JPEG EXIF DateTimeOriginal (`exifTaken`), MP4/MOV `mvhd`
  creation time (`mp4Taken` walks box headers only, so `moov` at the end costs a few reads),
  else `lastModified`. "One memory per day" or "All in one memory"; progress on the button;
  stops at a full disk; a page whose every file failed is removed. Media `ts`/`day` = taken.
- **Videos** (`kind:'video'`): stored as the File itself (no re-encode; IDB keeps it on disk),
  plus a 320px WebP still from a frame near the start, `w`/`h`/`dur` (`mediaVideoMeta`, gives
  up after `VIDEO_META_WAIT` 8 s — an undecodable HEVC clip still saves, with a plain tile).
  Over 300 MB asks first. Grids show a ▶ length badge; the viewer plays it (`<video controls>`).
  Also allowed in the Log's and notes' gallery picker, and History ▸ Photos shows the Log's.
  - **Not in backups:** `mediaForBackup` skips them (base64 of hundreds of MB would kill the
    WebView) and counts them; export says "videos stay on this phone"; Storage has a Videos
    row "not in backups"; Delete-everything warns; `mediaTotals().bytes` excludes them.
  - **Share:** web = Web Share with files or a download; **the Play app cannot share a video
    yet** (DaylogShare is image-only) — says so.
- **Verified** in headless Chrome with real files (EXIF JPEGs, MP4s with `moov` at end and
  start, a no-EXIF JPEG): 3 memories on the right days, stills + lengths, video plays in the
  viewer, links/backlinks/filters/search, backup = photos only. 44 unit tests (sync + async).
- **Open items:** roadmap.md ▸ Memories.

## Meals (built 2026-11-15 on branch worktree-agent-a7d95bec3ba692ed9, NOT deployed)

Kishore: "we may can have the meal planned". A weekly meal planner, in the ☰ menu under More
features (`adv: true`; the fresh-install test caps visible destinations at 9). Code: the
`MEALS` block in app.js (`renderMeals`, `mealsLogCard`, the sheet `mealSheetRender`), CSS: the
`===== Meals =====` block at the end of styles.css.
- **Screen:** week strip (swipe or arrows, today ringed, 4 slot dots per day, `x/28` bar),
  Copy last week (fills only empty slots, Undo), Plan / Shopping list tabs. Plan = the day's
  Breakfast · Lunch · Dinner · Snacks as cards (emoji tile, Indian veg/egg/non-veg mark, tags,
  eaten tick on today and past days); an empty slot offers a one-tap "Again?" (planned 2+ times
  there in 6 weeks) or "Try" (a starter idea for that slot, rotating by date). Then "This week at
  a glance" (7×4 emoji grid) and the insight.
- **Sheet** (`#ml-sheet`, Back steps edit/repeat → previous, else closes): add (slot switch,
  search-or-type, diet/tag filters, your meals favourites → recent → in-slot count, 35
  `MEAL_IDEAS` with ingredients), a meal's options (eaten, swap, repeat on… 14-day picker with
  Next 7 days / Weekdays, edit, remove with Undo), edit a library meal (emoji, name, type, tags,
  comma-separated ingredients; plans from today on follow the edit).
- **Shopping list:** ingredients of un-eaten meals planned today..+6, one line per ingredient
  (`mealIngKey`: case, "onions"/"onion", "tomatoes"/"tomato"), "×n" = meals needing it, plus typed
  items; Clear checked (Undo), Copy list (clipboard).
- **Log:** section `meals` ("Today's meals") after the checklist; hidden until a meal is planned
  (`get off()` in LOG_SECTIONS_DEF, and the first `mealAdd` unhides it). Eaten tick, and ⇄ = "had
  something else instead" (swap + eaten, the planned name kept as `was`).
- **Insight** (`mealInsight`): next-night sleep, else next-day mood, after planned dinners marked
  eaten vs planned dinners not eaten or swapped; only with ≥ 6 days a side (`MEAL_MIN_DAYS`), 15 min
  or 0.5 points, sample sizes in the sentence.
- **Storage:** `dp.meals` (plan items), `dp.meallib` (your meals + ingredients + fav),
  `dp.mealshop` (typed items; ticks on derived items as `g:<ingredient>` with the plan ids they
  covered, so a newly planned meal brings the line back). All three in LIST_SYNC, the push
  payload and BACKUP_KEYS. 60+ unit tests (plan, library, list, copy week, two-phone merge,
  backup round trip, Log card, sheet).
- **Deferred:** meals in Search and the PDF/CSV export; the Sheet has no Meals tab; an old app
  version's push drops `meals` from the Sheet until this phone saves again (same as every new list).

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


## Lift — low-mood support (built 2026-11-15, NOT deployed)

Kishore asked for "things to do" when the mood is low. All offline; JS in one block
(`===== Lift (low-mood support) =====`, before SCREEN: CALENDAR), CSS in one block at the end of styles.css.
- **Trigger** (`liftIsLow`): today's mood ≤ 4 (`LIFT_LOW`), or mood 5 / no mood with an unpleasant
  mood-grid word tagged (#sad, #anxious… from `MM_QUAD.red/blue`). The card (`liftSlotHTML`, Log section
  `lift` after the mood grid) appears the moment the mood is tapped (`liftSlotRefresh` from
  `autosaveDraft`, skipped while a text field has focus). "Not today" sets `lift.hide` on the day, with Undo.
  Only on today. No notification, ever.
- **Screen** (`renderLift`, `show('lift')`, drawer row `liftDrawerHTML`, not in NAV_DEF so it does not
  count against the fresh-install menu): hero, Breathe (box 4-4-4-4 ×4 or 4-7-8 ×3, orb + progress ring,
  timer reads `Date.now()` so it cannot drift, stops when you leave), 5-4-3-2-1 grounding (one tap per thing),
  One small thing (10 actions, `LIFT_ACTS`; "I did this" → `lift.did`), From your good days (mood 8+ days
  with words/tags/photos, `liftGoodDays`; memories), Write it out (appends to today's `journal`), Talk to someone.
- **Talk to someone** goes to the top when 3+ of the last 5 days with a mood (within 14 days, sample days
  excluded) are ≤ 4 (`liftEscalate`), or after "I'm not okay" (session only, never stored).
- **Learning line** (`liftLearn`): for hard days (mood ≤ 5) with a mood the next day, the next-day change
  after days WITH the action vs hard days WITHOUT it — not "did the mood rise", which every low day does.
  Needs ≥ 4 days on each side (`LIFT_MIN_N`) and a gap ≥ 0.3; shows only a positive one; says "not proof".
- **Storage:** `entry.lift = { did: [ids], hide: true }` on the day, written via `liftWrite` (flushes the
  Log autosave first, mirrors into the open draft). In `ENTRY_META`, so it never makes a day count as logged.
  Syncs with the day (field-level merge), in backups/import; not a Sheet Log column; not in the CSV.
- **Open items:** use `lift.did` to order the deck beyond the single best action; a Customize list for
  the user's own actions; a WHATS_NEW line when it ships.
