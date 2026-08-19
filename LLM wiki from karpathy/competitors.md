# Competitor teardown (2026-08-19)

Fourteen apps studied from Play listings, official docs, FOSS source, and review
analyses. Rule applied throughout: **copy the mechanic, not the monetization.**
Every paid app here paywalls something we already give away.

## The field

| App | Installs | ★ | Money | The one mechanic that makes it |
|---|---|---|---|---|
| **Daylio** | 10M+ | 4.7 (460K) | free + $4.99–$59.99 | "Influence on Mood" per-activity, incl. **next-day** effect + confidence label |
| **Loop** | 5M+ | 4.8 (61K) | GPLv3, **free forever** | Habit **strength score**: EMA, 13-day half-life; SKIP state; partial credit |
| **HabitNow** | 5M+ | 4.7 (92K) | free ≤7 habits, **$11.99 one-time** | Frequency engine (every N days, X/week, flexible) + "At least/Exactly/Less than" |
| **StayFree** | 10M+ | 4.6 (275K) | **free, ad-free** — sells panel data (Sensor Tower) | Cross-device usage w/o account; in-app breakdown (Reels 62.5%) |
| **Forest** | 10M+ | 4.8 iOS | freemium since Dec 2025; Plus ~$39.99/yr | Withered tree as a **permanent scar**; 2,500 coins = 1 real tree |
| **Finch** | — | 4.9 (737K iOS) | Plus ~$69.99/yr | **No punishment ever**; buyable "fix your streak"; parasocial bird |
| **How We Feel** | 500K+ | **4.8**, **no IAP at all** | nonprofit, donation-funded | **Mood Meter**: pleasantness × energy quadrant → ~144 given emotion words |
| **Habitica** | — | — | $5/mo | Missed dailies deal **HP damage**; party bosses |
| **Journey** | 5M+ | 4.4 (94K) | ~$49.99/yr | **Throwback** (1wk/1mo/1yr ago) — paywalled |
| **Daybook** | 1M+ | 4.5 (59K) | ~$29.99/yr | Speak-to-write + handwriting scanner |
| **Routinery** | 1M+ | 4.5 (18K) | ~$39.99/yr | **Sequential timed routine** — full-screen escort, auto-advance |
| **Habitify** | — | — | $7.49/mo, free ≤3 habits | **Time-block segmentation** (morning/afternoon/evening) |
| **HabitKit** | — | 4.86 | free ≤4, ~$19.99/yr | GitHub-contribution tile grid *is* the product |
| **YourHour / Regain** | 1M+ each | 4.2 / 4.4 | ads+IAP / $99.99/yr | Floating timer overlay; content-level Reels/Shorts blocking |

## Where we already win

- **Nothing is paywalled.** Statistics (TickTick), export (Journey/Daybook), themes and
  templates (Daybook), automatic backup (Daylio), widgets (HabitNow/HabitKit), >5 moods
  (Daylio), allow-lists and insights (Forest) — all free here.
- **Breadth in one app.** No competitor combines habits + mood + sleep + time tracking +
  automatic screen time + gym + journal. Daylio has no screen time; StayFree has no mood.
- **Screen-time × mood correlation** — none of the three wellbeing apps touch mood at all.
- **No account, no cloud, nothing uploaded.** The 4.8★ outlier (How We Feel) is the one
  that charges nothing and stores on-device. That is our exact position.
- Categories/tags/grouping — Loop closed these as won't-do.

## Shipped from this teardown (v120)

| Gap | Source | What we shipped |
|---|---|---|
| A rest day read as a failure | Loop `SKIP`, HabitNow skip/failed | Three-state habit: tap cycles **done → skipped → clear**. Skips are streak-neutral, excluded from the 30-day rate and from mood correlation. |
| Streak is all-or-nothing, no sense of trend | Loop `Score.kt` | **Habit strength 0-100** — EMA, 13-day half-life. Verified against Loop's published curve: 96 at 60 perfect days (they publish 95.9). |
| Old entries never resurface | Journey Throwback (paid), Daylio "On This Day" | **"On this day"** card at the top of the Log — a week/month/3 months/year ago, tap to open. |
| Same-day mood correlation is reverse-causal | Daylio's four separate deltas | **Next-day mood influence** with High/Medium/Low confidence from sample size and effect size ÷ spread. |

## Next candidates, ranked by value ÷ cost

1. **Mood Meter grid** (How We Feel) — we already collect mood *and* energy 1-10, which are
   exactly its two axes. One CSS grid, four quadrants, one tap sets both. Then a curated
   ~40-word emotion vocabulary per quadrant appended as tags. The same grid inverts into an
   output: scatter every logged day to show where the year lives. **Highest differentiation
   per hour of work in the whole list.**
2. **Preset habit/routine gallery** (TickTick 60+, Routinery categories) — static JSON, kills
   the empty state.
3. **Quantity habits with At least / Exactly / Less than** (HabitNow) — unlocks *negative*
   habits ("less than 2 coffees"), which we cannot express at all today.
4. **Flexible frequency** (HabitNow: every N days, X per week, missed day slides).
5. **Sequential routine player** (Routinery) — reuses the pomodoro tick loop and habit
   check-off. Keep the timer **wall-clock-derived** (store step start, compute elapsed on
   resume) or it desyncs when the screen sleeps. Offer a plain chime, and never make habits
   routine-only — both are Routinery's top complaints.
6. **Time-block segmentation** (Habitify) — morning/afternoon/evening instead of one flat list.
7. **Browser extension** for web usage — reuses our web codebase, sidesteps accessibility
   entirely. StayFree's has ~200K users at 4.7★.

## Do NOT copy

- **Blocking of any kind.** A WebView cannot paint over another app; overlays need
  `SYSTEM_ALERT_WINDOW` + a foreground service, and in-app/keyword blocking needs an
  **AccessibilityService** — native-only, and a real Play policy/rejection risk. Decisive
  evidence: blocking is StayFree's single most-complained-about surface *even with* full
  native permissions ("stops working after a day", accessibility silently self-disabling).
- **Punishment mechanics** — Forest's permanent dead stumps, Plant Together's collective
  failure, Habitica's HP damage. These drive quit-on-first-lapse. Finch's model (no
  punishment, repairable streak) is the template, and our skip state is the cheap version.
- **Rewarded ads in a focus app** (Forest) — its most-cited hypocrisy.
- **Gating utility**: analytics (TickTick), automatic backup (Daylio's #1 data-loss anger),
  PIN lock, widgets, export. Gate cosmetics if anything, like Finch.
- **Five hard-coded mood parent categories** (Daylio) — users repeatedly hit that ceiling.
- **Deep red "failed" marks** (HabitNow) — a wall of red demotivates; neutral "missed" is enough.
- **Alarms that ignore terminal states** (HabitNow's top complaint) — our full-screen alarm
  must be cancelled by *every* end state: done, skipped, cleared, rescheduled.
- **Leaderboards / friends / Tree Town** — all need accounts and cloud.
- **11 onboarding screens before first value** (Daylio, paywall at #11).

## Our own mirror-image risk

Journey's reviews contain the exact horror story our local-first model prevents (a user
"stranded" with 9 years of entries behind a sync paywall). But ours is the inverse: uninstall
erases everything. That makes the backup/export nudge a **retention feature, not a chore** —
keep it prominent.

## Unverified

StayFree's current price (evidence says genuinely free/ad-free, no IAP badge); HabitNow's
onboarding flow; HabitKit's lifetime price (sources conflict $5.99 vs $41.99); TickTick's
exact free habit cap; whether Journey's Throwback works free; Reddit was unreachable, so
review themes come from Play/blogs/aggregators, not primary threads.
