# Wiki schema & rules

## Layout
- `index.md` — one-line catalog of every page. Update when pages are added/removed.
- `log.md` — reverse-chronological timeline. Append an entry per ingest/change.
- Topic pages: architecture, features, gotchas, play-store, roadmap.

## Operations
- **Ingest**: new fact/decision/bug → fold into the most relevant existing page (prefer updating over new pages; dedupe hard). Append a `log.md` entry. Update `index.md` if pages changed.
- **Query**: start at `index.md` → read relevant page → synthesize. Fall back to code/git only if the wiki is incomplete, then ingest what you learned.
- **Lint**: periodically scan for stale facts (esp. version numbers, "current" claims), contradictions, broken cross-refs, duplication. Report before rewriting.

## Conventions
- Convert relative dates to absolute (YYYY-MM-DD).
- Cite real file:line where useful; verify against current code before asserting.
- Keep pages tight; this wiki is read into context, so signal over prose.
