# The Strava build list — all 12, done

`DAYLOG-STRAVA-RESEARCH.md` ranked 12 items by value ÷ effort. Every one shipped between
v164 and v190 (2026-08-26/27). This page records what each became and, more usefully, the
rule each one is now bound by.

| # | Research item | Shipped as | Version |
|---|---|---|---|
| 1 | Achievement share cards | 5 canvas designs × 2 ratios, on-device | v164 |
| 2 | Best Efforts + PR medals | "Your best ever" top-3 ladder + best-this-year | v164 |
| 3 | Weekly streaks | 3-of-7 weekly cadence + tiered awards | v176 |
| 4 | Goals, 4 metrics × 3 timeframes | **9** measures × 3 timeframes, free | v187 |
| 5 | Month in Sport recap | 5-card month deck, no expiry | v184 |
| 6 | Tiered milestone badges | every award family is tiered | v164 |
| 7 | Trophy Case | Stats ▸ Awards, 60 awards / 9 families | v164 |
| 8 | Perceived exertion | 1–10 "how hard did it feel" on a time block | v180 |
| 9 | Post-activity save screen | save sheet on stop, ≥2 min | v180 |
| 10 | Temporal comparison | "You vs you" — week / month / year | v171 |
| 11 | Implementation intentions | habit cues (when & where) | v174 |
| 12 | Fresh-start effect | Monday / 1st / New Year landmark note | v190 |

**Still outstanding:** only the *delivery* half of #1. `SharePlugin.java` is written, registered
and compiling (`native-112`), but Android WebView has no Web Share API, so one-tap share
needs the next store build. Until then `deliverCard()` falls to its last rung and tells the
user to screenshot — it never promises a share sheet it cannot open.

## The rules these features are bound by

Taken from the research's own "do not build" and "demotivation modes" sections, and now
enforced in code rather than remembered:

- **No social comparison, ever.** No percentiles, no cohorts, no "average user". Temporal
  self-comparison is the sanctioned substitute.
- **Nothing fakeable.** Awards derive from the log on read. The weekly threshold is fixed at
  3 because a user-set minimum of 1 would make the award a formality.
- **Nothing revocable.** Once an award is in `dp.awards` it stays earned, even if the live
  metric decays. This had to be *fixed* — see `gotchas.md`.
- **No loss framing.** No "don't lose your streak", no streak insurance. Asserted by a test
  on the fresh-start copy.
- **No paywall on the reward layer.** The research called Strava's three progressive paywalls
  demotivating and named "nothing paywalled" as Daylog's genuine weapon.
- **Targets calibrated to the user.** Goal "Suggest" uses their own last three periods.
  Health insights split on the user's own median, never a magazine's 8,000 steps.
- **Honest degradation.** A period with no comparable past names the date it unlocks. A metric
  too thin to compare is named, not silently dropped. A card with no data is not rendered.
- **The bitmap travels, the data never does.** Share cards are drawn on device.
- **Every overlay closes on Android back**, and every new tap target clears 44px.

## What was deliberately NOT built

GPS, segments, leaderboards, KOM/QOM, kudos or any social-validation loop, Wear OS, BLE
sensors, gear tracking, the monthly summary email, variable reward schedules, and points as
currency. The research flagged kudos as the one mechanic that must not be copied, with
peer-reviewed evidence of harm via self-presentation and social pressure.
