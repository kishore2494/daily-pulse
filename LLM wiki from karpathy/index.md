# Daylog — Wiki Index

One-line catalog of every page. Start here.

- **[architecture.md](architecture.md)** — how the app is built: files, storage keys, sync model, native shell, service worker, build & deploy.
- **[features.md](features.md)** — every screen/feature, its storage key, render function, and how it flows into Stats/sync/backup.
- **[competitors.md](competitors.md)** — teardown of 14 rival trackers: the mechanic behind each, where we already win, what we shipped from it, what NOT to copy.
- **[gotchas.md](gotchas.md)** — hard-won lessons and traps (MIUI, emoji, push auth, keystore, full-screen-intent policy, cache bumps, shared emulator…).
- **[play-store.md](play-store.md)** — Play Store launch status, listing, policy notes, and the exact remaining steps.
- **[roadmap.md](roadmap.md)** — decided-but-not-built work (Google sign-in + Cloudflare blob sync, pay-what-you-want sub, foreground service, feedback endpoint) and open questions.
- **[schema.md](schema.md)** — the rules this wiki follows (ingest / query / lint).
- **[log.md](log.md)** — reverse-chronological timeline of changes and decisions.

**Current build:** v253 (4 independent reviews' fixes: Log save path, v252, backup/restore, Time tracker; perf; Write photo blocks; note media; lists sync item by item; Sheet script no longer mangles text), LIVE since 2026-11-01 (late night, tag `web-v253`); v252 before it. Code.gs changed too: each user must re-paste + redeploy it (Kishore's own sheet included). Deploy state is in log.md. **In progress on origin, NOT deployed (2026-11-02):** old-Sheet-script detection and pull failure reasons (see architecture.md ▸ The pull itself); Kishore's word "deploy" is needed to ship them. Bump with `tools/bump.sh`, which keeps `app.js`, `sw.js` and `index.html` in lockstep.
**Live:** production https://kishore2494.github.io/daily-pulse/ · dev https://kishore2494.github.io/jurnal-app/
- **[backups.md](backups.md)** — where every version lives, how snapshots are made, and the one unbacked file that matters
- **[strava-build.md](strava-build.md)** — the 12 ranked research items, what each shipped as, and the rules they are bound by
- **[distribution.md](distribution.md)** — how people find Daylog: install referrers, in-app share loops, web → Play, SEO pages, and pointers to the ASO proposal and launch drafts
- **[behaviour-audit.md](behaviour-audit.md)** — the six-dimension audit, its scores, what got fixed, and what is still open
