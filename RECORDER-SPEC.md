# Long-form recorder — shared spec (web + native)

Kishore (owner), 2026-11-21: "I need to journal a lot but can't type it." He wants to record for a long
time, pause, leave the app and come back, resume, stop; keep many recordings; export one recording as a
single audio file; a shortcut to start recording. He exports a recording, gives it to Claude to
transcribe, and pastes the text back into the day.

Today: voice notes on a day/note (app.js ~9870, `voiceMime`, `VOICE_BPS`), 10-minute cap, no pause.

## Native plugin `LongRecorder` (Android build 123+, registered in MainActivity)

All methods return Promises (Capacitor). `uri` is a `file://` path; the web plays it with
`Capacitor.convertFileSrc(uri)` (fetch it the same way to get a Blob).

| Method | Returns | Notes |
|---|---|---|
| `start({ id, title? })` | `{ id, uri }` | Starts a foreground service (type `microphone`) with an ongoing notification (Pause/Resume, Stop). Rejects with code `"busy"` if already recording, `"permission"` if RECORD_AUDIO is not granted (the web asks for the mic first via getUserMedia, which grants RECORD_AUDIO to the app). Also: `"invalid"` (id must match `[A-Za-z0-9_-]{1,80}`), `"exists"` (a file for that id is already there), `"storage"` (< 50 MB free), `"start_failed"` (Android refused: Daylog was not on screen, or the mic is held by another app). **The `uri` here is the in-progress `.aac` file; the finished file is a different `.m4a` uri (see below).** Call it only while Daylog is visible (Android 14+ rule). |
| `pause()` / `resume()` | `{ state, id, uri, elapsedMs, startedAt, title? }` | `elapsedMs` counts recorded time only, not paused time. Idempotent (pausing a paused recording just returns the state). Rejects `"not_recording"`. |
| `stop()` | `{ id, uri, durationMs, bytes, mime }` | Finalises the file and stops the service. **Can take a few seconds on a long recording** (the frames are copied into `.m4a`, roughly 1–5 s per hour of audio, not yet timed on a phone): show "Saving…". Rejects `"not_recording"`, or `"empty"` if nothing was captured (stopped within ~0.1 s; no file is kept). |
| `status()` | `{ state: 'idle'\|'recording'\|'paused', id?, uri?, elapsedMs?, startedAt?, title?, recovered? }` | Used on launch to reattach to a recording that kept going while the app was closed. `recovered` (once, then cleared) = `{ id, uri, durationMs, bytes, mime, modifiedAt, startedAt, title? }` when a recording was cut short by the process dying (OEM killer, crash, power off) and has just been finished from what was on disk. |
| `list()` | `{ items: [{ id, uri, bytes, modifiedAt, mime, recording }] }` | Files present in `<filesDir>/recordings/`, newest first. `recording: true` marks the file being recorded right now (status() reports it; do not treat it as finished). |
| `remove({ id })` | `{ removed }` | Deletes the file. Rejects `"busy"` for the recording in progress. |
| `share({ id, title? })` | `{ ok }` | Android share sheet, FileProvider content URI, correct audio MIME (`audio/mp4` for .m4a). With `title` the file is offered as `<title>.m4a` (unsafe characters removed); without it, as `<id>.m4a`. Rejects `"not_found"`, `"busy"`, `"share_failed"`. |

Every rejection is `call.reject(message, code)`: read `err.code`; `err.message` is a plain English sentence.

Event `recorderState` → `{ state, id, elapsedMs }` on every change, including Pause/Resume/Stop from the
notification. When a recording ends (from any source) the event has `state: 'idle'` and also carries
`uri, durationMs, bytes, mime` and `reason`: `'user'` (stop()), `'notification'`, `'error'` (the mic
failed or was taken, or the file stopped growing for 30 s of recording, i.e. the writer died; what was
recorded is kept), `'system'` (Android stopped the service), `'recovered'` (finished after a crash, see
status()), `'cap'` (3 hours recorded, pauses excluded: the native side enforces the web's 3-hour cap
because the web timer does not run in the background) or `'storage'` (less than 30 MB free). If nothing
was captured it carries `empty: true` and no `uri`. Events only reach a running WebView: on launch,
reconcile with `status()` + `list()`. For `cap`/`storage`/`error`/`system` the native side also posts a
one-time "Recording stopped" notification (it may have happened with Daylog closed).

Backup: `files/recordings/` and the recorder's state are excluded from Android Auto Backup and device
transfer (`res/xml/data_extraction_rules.xml`, `full_backup_content.xml`), so recordings really stay on
this phone and cannot blow the 25 MB backup quota; everything else is backed up as before.

Files: `<filesDir>/recordings/<id>.<ext>`. The native side picks the container (`.m4a` AAC, or ADTS
`.aac` if it prefers crash safety) and documents why; the web must not assume the extension (use the
`uri` it is given).

**Native choice (build 123): both.** While recording the file is `<id>.aac` (ADTS: every frame has its
own header, so a killed process still leaves a playable file up to that moment). On stop the AAC frames
are copied without re-encoding into `<id>.m4a` (exact duration, fast seeking, accepted by every
transcription service) and the `.aac` is deleted. So: **key recordings by `id`, and take the final
`uri` from `stop()`, the ending `recorderState` event, `status().recovered` or `list()`**, never the one
`start()` returned. A `.aac` only remains if that copy ever fails (it plays as is). Mono AAC-LC,
44.1 kHz, 64 kbps ≈ 29 MB per hour.

Playback: `Capacitor.convertFileSrc(uri)` works although the app loads the live site:
Capacitor serves `https://kishore2494.github.io/_capacitor_file_/data/user/0/…` from the phone itself,
with HTTP Range support (seeking works). Same for `fetch()` to get a Blob.

Android 13+: if notifications are not allowed, recording still works but the notification (and its
Pause/Stop buttons) is hidden; consider asking for notification permission before the first recording.
Tapping the notification opens Daylog (no queued action; reattach with `status()`).

## Shortcut and widget → web

A launcher shortcut "Record" (long-press the app icon) and a mic button on the home-screen widget queue
an action through the EXISTING widget queue (`WidgetBridgePlugin.enqueue(ctx, "record", 0, at)` +
`widgetTap` event; web drains it in `drainWidgetActions` / `widgetTapsApply`, app.js ~11006).
Queue item: `{ action: 'record', at }`. The web opens the Recordings screen and starts recording
(once per queued tap; a stale tap older than ~2 minutes only opens the screen).

As built (build 123): the widget's mic button is a token-checked widget intent (`WIDGET_RECORD`,
MainActivity → `takeIntent`); the shortcut goes through a non-exported trampoline
(`RecordShortcutActivity` → `WidgetBridgePlugin.queueTap(ctx, "record")`) so the app is brought forward
without the WebView reload a static shortcut's CLEAR_TASK would cause. Both fire `widgetTap`, and the web
also drains on `visibilitychange`. Web versions that do not know `'record'` ignore it (only `'mood'` is
applied today), so build 123 is safe before the web half is live.

## Web (works with or without the plugin)

- With `LongRecorder` present: use it (records with the screen off / app in background).
- Without it (browser, or Play build ≤122): MediaRecorder with `pause()`/`resume()`, a screen wake lock
  while recording, and a visible "keep Daylog open" note; chunks saved to IndexedDB every few seconds so
  a crash keeps what was recorded.
- Recordings screen: list by day, play with a scrub bar and ±15 s, rename, which day it belongs to,
  Export/Share one recording, Delete (with Undo like the rest of the app), and "Add transcript" → text is
  added to that day's journal through the Log's own save path and kept on the recording.
- Recordings stay on this phone and out of backup files and sync (like videos); metadata says so.

## Web side as built (branch `recorder`, 2026-11-22)

- Feature-detects `LongRecorder` and each method. Reconciles with `status()` + `list()` at start-up and on every
  return to the app; uses `status().recovered`; skips `list()` items with `recording: true`; takes the final uri
  from stop() / the ending event / recovered / list() and refreshes a stored uri when list() shows a new one.
- Event handling: `recording`/`paused` update the screen; any other state is an end. While the web's own stop() is
  in flight the ending event is ignored (stop()'s answer is used). `empty: true` → nothing kept. `reason` picks the
  toast: `recovered`, `error`/`system`, `storage` ("Recording stopped: phone storage is almost full"), `cap`
  ("Recording stopped at 3 hours"), else "Recording saved".
- Start-up/return reconcile leaves alone: the running id, ids `list()` marks `recording: true`, ids whose stop or
  finish is in flight, and (when `status()` failed or a start is pending) every live record. A finished record
  whose file is not in `list()` (e.g. after a phone transfer, since the files are excluded from Android backup) is
  kept and marked "The file is not on this phone"; Delete removes the row; the mark clears if the file returns.
- `remove()` answering `{ removed: false }` is treated like a rejection: the record goes only once `list()` no
  longer has the file. A start rejected `start_failed` is retried once after 300 ms (Android 7-9 can still hold
  the mic the web probe just released).
- Rejection codes read from `err.code`: start `busy` (reattach), `permission`, `storage`, `start_failed`; stop
  `empty`, `not_recording` (reconcile); pause/resume `not_recording` (reconcile).
- Asks for notification permission once before the first native recording when Android reports `prompt`.
- Under 0.7 s the web calls `remove({id})` and drops it. The three-hour cap: the native side enforces it (`cap`);
  the web also stops at 3 h while it is running.
- Browser only: a web recording holds a Web Lock `daylog-rec-<id>` so another tab's start-up does not recover it.
- Gap: a recording made by the web engine (browser, or Play ≤122) cannot be shared from the Play app: DaylogShare is
  image/text only and LongRecorder shares files in its own folder only. Fine for now; a future
  `LongRecorder.importFile`/`shareFile({base64,mime,filename})` would close it.
