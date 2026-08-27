# Store images — how these were made

`store-1` … `store-7` are the Play Store phone screenshots. 1080×1920 (9:16), well inside
Play's limits.

They are **not raw screenshots**. Raw screenshots of a private tracker look like a wall of
grey cards and sell nothing, which is the note Kishore gave. Each one is a marketing frame:
a vivid gradient, a bold headline, one supporting line, and a **real screen from the real
app** in a phone frame — never a mockup or an emulator.

Deliberately alternating light and dark app themes across the set, so someone scrolling the
listing sees both.

| # | Angle | App screen | Theme |
|---|---|---|---|
| 1 | It tells you what actually works | Stats ▸ patterns | light |
| 2 | 60 awards, none fakeable | Awards ▸ trophy case | dark |
| 3 | Any target, no paywall | Stats ▸ goals | light |
| 4 | One tap, your whole day | Time tracker | dark |
| 5 | One square for every day | Year in pixels | dark |
| 6 | How do you actually feel? | Mood grid (5×5) | light |
| 7 | No account, no cloud | Stats ▸ insights | dark |

## Regenerating them

`store-images.html` is the generator. It embeds the captured app screens as base64 data URIs
so it is completely self-contained — open it and every frame renders.

1. Capture app screens at a 412×900 viewport with the eval seed loaded, cropping the
   full-page shot at the element's absolute offset. Two gotchas: `browse screenshot` always
   captures the FULL document (so crop at `rect.top + scrollY`, not at the viewport), and
   `sips -c` crops from the **centre** — use PIL.
2. Base64 them into `store-images.html`.
3. Render at a 1080×1920 viewport and slice every `1920 + 40` (the frame margin).

The previous raw screenshots are kept in `.superseded-2026-08-27/`.
