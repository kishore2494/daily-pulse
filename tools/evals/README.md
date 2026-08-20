# Layout eval suite

A mechanical check for the class of UI bug you otherwise only find by squinting at a
phone: text escaping its container, chips overflowing the viewport, tap targets too
small, labels truncated into uselessness, screens that scroll forever.

## Run it

```bash
tools/evals/run.sh                    # prints a scored report
tools/evals/run.sh /tmp/after.json    # keep the raw findings for a diff
```

Use it as a **before/after gate on any UI change**:

```bash
tools/evals/run.sh /tmp/before.json   # …make the change…
tools/evals/run.sh /tmp/after.json
```

## What it does

`run.sh` drives headless Chromium (gstack `browse`) across **3 phone widths × 16 screens**
(48 combos), seeds deliberately adversarial data (`seed.js` — long habit names, a skipped
habit, quantity habits with units, big streak numbers), injects `checks.js`, and scores
the findings with `report.py`.

Widths are chosen from real Android reality: **320** (small/older, or display-zoom),
**360** (the most common Android CSS width by a wide margin), **412** (Pixel-class).

## Checks

| Finding | Severity | Means |
|---|---|---|
| `page-hscroll` | error | the page scrolls sideways |
| `past-viewport` | error | an element extends beyond the screen edge |
| `text-clipped` | error | text cut off with no ellipsis — the "skipped overflows the chip" bug |
| `label-squeezed` | error | an ellipsising label has so little width it's unreadable (<56px or <6 chars) |
| `escapes-parent` | error | a child sticks out of its parent's content box |
| `tap-tiny` | error | interactive element under 24px |
| `tap-small` | warn | interactive element under 44px (Android guidance is 48dp) |
| `under-nav` | warn | content stuck beneath the fixed bottom nav at the end of the page |
| `screensTall` | metric | viewport-heights of scrolling — the "too much scrolling" number |

Penalty score = `errors×10 + warns×3`. Lower is better; 0 is clean.

## Two false positives it took a round to learn

1. **`text-overflow: ellipsis` legitimately makes `scrollWidth > clientWidth`.** The first
   version flagged every correctly-truncating label as an error. Now those report
   `label-squeezed` only when the remaining width is genuinely unreadable.
2. **An `<input>` inside a `<label>` inherits the label's whole clickable area.** Measuring
   the 18px checkbox alone was wrong; the probe now measures the nearest `label` ancestor.

## Accepted findings (reported, deliberately not fixed)

- `.yp` cells are 5×9px — a year is 31 columns wide, and Daylio's grid has the same
  constraint. The mosaic is a *visualisation*; tapping a day is a convenience, and the same
  day is reachable from Calendar and History.
- `.scale > button` is ~23px wide at 320px because ten digits share one row. Their **40px
  height** is the dimension that matters for a horizontal strip.
- ~239 `tap-small` warns: chips and secondary buttons in the 34–43px range. Pushing them all
  to 44px would add height back, which fights the goal of less scrolling. The most-tapped
  controls (habit chips 46px, bottom nav, scale strip) all clear it.

## Result of the first run (2026-08-19, v130 → v137)

```
errors 103 → 8      penalty 1684 → 797
  escapes-parent       50 → 0
  past-viewport        10 → 0
  text-clipped         10 → 0
  escapes-parent-left   4 → 0
  tap-tiny             33 → 8   (the 8 are the accepted cases above)
Log screen height:  -10% @320/360,  -13% @412
```
