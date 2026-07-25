# Features

Nav = **5 pinned tabs + a More overflow grid** (v56). `dp.navcfg` items carry `primary` (in bottom bar, max 5 = `MAX_PRIMARY`), `hidden`, `noHide` (Log). renderNav() shows primary non-hidden tabs + a synthetic ⋯ More button → `renderMore()` grid of the rest (incl. Settings). Default opening tab = `settings.defaultTab` (device-local), applied via `navigateTo(defaultTab())` at init. All configurable in Settings ▸ Customize ▸ Tabs (📌 pin / 🎯 default / drag order / 👁 hide). Each screen = a `render*()` in the `RENDER` map, filling `#s-<key>`.

| Tab | key | render fn | storage | notes |
|---|---|---|---|---|
| Log | today | openToday/renderToday | dp.entries | core fields config-driven (`dp.corecfg`): mood, energy, sleep, deep-work, tasks, reflection, journal + deep-log sections (`dp.deepcfg`) + habit checklist (`dp.habitcfg`) |
| Time | time | openTime/renderTime | dp.timelog, dp.timeacts | 24h stopwatch, tap-to-switch, editable timeline, per-activity totals; writes `timeSummary` to the day's entry |
| Tasks | tasks | renderTasks | dp.tasks | carry-over, colors, drag |
| Notes | notes | renderNotes | dp.notes | drag, colors, voice |
| Plans | plans | renderPlans | dp.plans | named plan → own checklist |
| Focus | focus | renderFocus | dp.pomo, dp.timebox | Pomodoro (config cycles, countdown ring, native end-of-phase alarm, optional logs focus time to a Time activity, daily 🍅 count) + Timebox (plan today's blocks, start alarm, one-tap start) |
| Gym | gym | openGym/renderGym | dp.gym + configs | 6-day split (`dp.daycfg`), exercises (`dp.gymcfg` overrides + `dp.gymgroups` custom), animated demos (workout-anims.js), per-set log |
| Habits | habits | renderHabits | dp.entries | streaks + 90-day heatmaps, built from HABITS (=visible `dp.habitcfg`) |
| Stats | dash | renderDash | all | trends, Polymath Index, time analytics (v38), connections graph, weekly auto-review, wellbeing averages (DYNAMIC from deep-log config) |
| Cal | cal | renderCal | dp.entries, dp.gym, dp.timelog, dp.events | month grid tinted by mood + dots; dated events with alarms |
| Write | write | renderWrite | dp.docs | block editor: heading/text/checklist/bullet, dictation, drag |
| History | history | renderHistory | dp.entries | (hidden from nav by default; reachable via More) |
| More | settings | renderSettings | dp.settings | sync, reminders, ntfy, data backup, feedback, **Customize** (renderCustom → `#s-custom`), guide link |

## Customization engine (More ▸ Customize, renderCustom)
Everything is editable and hideable: theme accent (6 colors), nav tabs (reorder/rename/hide), core Log fields, deep-log sections/fields (add/rename/hide, incl. tick-list options), habits, time activities, gym exercises + sets + custom groups + the 6-day split. `reloadCfg()` rebuilds the live `HABITS`, `TIME_ACTS_ALL`, `DEEP_SECTIONS` from their configs. Hidden items keep their history.

## Onboarding (first run only)
3 steps: welcome (with data-loss note) → pick habits (+ add own) → pick activities (+ add own). Gated by `needsOnboard()` (no data + no `dp.onboarded`). Unpicked items are hidden via the same config flags.

## Alarms & notifications (native shell only, all offline)
- **Reminders** (`dp.reminders`) — daily; mode `alarm` (full-screen) or `notify`.
- **Events** (`dp.events`) — one-time dated, optional alarm.
- **Full-screen alarm** — `FullScreenAlarmPlugin` → `AlarmActivity` over lock screen (siren/vibrate/Dismiss/Snooze).
- **Running-timer notification** (id 770) — shows active activity + Pause/Stop/Resume (`refreshTimerNotif`).
- **2-day inactivity nudge** (id 760) — pre-scheduled, fires even if app never opened (`scheduleInactivityReminder`).
- **Pomodoro** (id 750) and **Timebox** (ids 800-830) end/start alarms.
- PWA fallbacks (no native shell): in-app foreground alarm, `.ics` calendar export, ntfy push.
