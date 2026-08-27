# Behaviour-design audit (2026-08-27)

Six independent graders read the actual code — not the pitch — and scored Daylog against
behaviour-design and ethical-persuasion criteria. Every claimed weakness was then handed to a
separate agent whose only job was to refute it.

## Scores

| Dimension | Score | The short version |
|---|---|---|
| Dark patterns / manipulation | **7.5** | 8 of 11 checklist items provably clean; variable rewards absent by grep. Three live violations pulled it down. |
| Autonomy / self-determination | **7.2** | Exceptional customisation surface; four fixable defects on top of an architecture that genuinely hands control over. |
| Reward design | **7.0** | No currency anywhere — a 9-level foundation. Lost points because it *celebrated things the user did not do*. |
| **Honesty** | **4.5** | Earned. Several "success on failure" paths were still live, plus one invented statistic. |
| Harm to vulnerable users | **6.0** | Humane mechanics real and load-bearing; three architectural harms contradicted the project's own rules. |
| Attention cost | **6.3** | Genuinely restrained core (completeness = 11 items, not 49); notification and celebration volume was not. |

The synthesis agent and 14 verifiers died on a weekly rate limit, so there is **no
agent-produced overall grade** — the six dimension scores above are the real output. Do not
invent a weighted total from them and attribute it to the audit.

## What was fixed as a result (v194 → v197)

**Honesty**
- An **invented statistic** in onboarding: "People who set a daily reminder keep their streak
  3× longer." No accounts, no server, no analytics — no population it could ever have been
  measured on. Removed; a test now asserts no such claim exists.
- `saveFile()` returned undefined from every branch while toasting its own outcome, so callers
  guessed wrong. Now returns `'shared'|'download'|'copy'|'viewer'|'cancel'|'blocked'`.
- `exportData()` stamped `dp.lastBackup` unconditionally and un-awaited → **"last backup:
  today ✅" after a cancelled share sheet.** The most dangerous lie in the app.
- `generatePdfReport` toasted "Report PDF ready 📄" + a notification on every failure path.
- `DB.saveEntries` discarded `safeSet`'s return → "Saved 🎉" over a write that never landed on
  a full phone, overwriting the quota warning in the same tick.
- The Sheet POST is `no-cors`, so its response is opaque: "Saved & synced ✓" → "Sent 📤".

**Rules this project wrote down, then broke**
- `scheduleInactivityReminder` shipped *"a 60-second log keeps your streak alive 🔥"* — on by
  default, no off switch, and precisely the streak-insurance nudge `strava-build.md` claims to
  refuse. The test enforcing that rule only ever inspected `freshHTML()`. **A rule is only
  enforced where the test looks.**
- Celebrations called `navigator.vibrate` directly, bypassing `dp.hapticsOff`.

**Correctness**
- Perfect days were simultaneously too generous (a never-tapped habit was excluded forever, so
  ticking 1 of 4 earned a perfect day) and too harsh (a **skip** broke the day, two lines after
  the UI promises it is safe).
- `BACKUP_KEYS` silently omitted `logsec`, `awards` and `freshSeen` — a phone move cost the
  user their Log layout and the ledger that makes awards permanent.
- Polymath rendered a hard **0/100** on an empty store: a new user's first look at Stats told
  them they had scored zero.
- `showMilestone` and `showAward` share `#milestone`; the second clobbered the first.

**Harm framing**
- "You vs you" scored mood and energy as performance, so a bad fortnight rendered mood in red
  as **"Biggest slip"**. Mood is a state, not something you can try harder at. Both now dir 0.

**Autonomy**
- There was **no way to delete your own data** short of uninstalling. Settings now has a
  two-step, self-disarming delete that touches only `dp.*` keys.

## Still open

- **Attention volume.** ~25 blocking full-screen confetti modals in month one vs ~2 in month
  six. The award count (60) may simply be too many; tier spacing is fine, frequency is not.
- **`loggedStreak()` counts a content-free entry** — opening the app and saving nothing
  extends a streak.
- **Crisis response.** A mood tracker will record a very low mood and the app does nothing.
  The audit deliberately argued both sides; for an offline, no-account app a helpline link is
  not obviously right. Needs a human decision, not a default.
- **"Next up" understates remaining effort** (unverified — its verifier died).

## The lesson worth keeping

Four of these were things the project had *documented as rules* and then violated in code,
including one where the enforcing test existed but only checked one of the two places the rule
applied. Writing the rule down is not enforcement. Grep for the pattern, not the file.
