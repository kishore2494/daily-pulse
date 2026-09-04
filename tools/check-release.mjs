// Pre-release consistency checks for Daylog.
//
// The app has no unit tests — it is one large vanilla-JS file — but the bugs that have
// actually bitten it are structural and cheap to catch:
//
//   * sw.js's CACHE name drifting from APP_VERSION. When that happened the service worker
//     stopped re-installing, so OFFLINE users sat on a v214 shell for THIRTEEN releases while
//     the online site was fine (v228 fixed it).
//   * a precache entry that does not exist. cache.addAll() is ATOMIC — one 404 rejects the
//     whole precache and offline mode dies silently (v230-era guard).
//   * a third-party asset creeping back in. The app advertises "private & offline" in the
//     PDF footer; fonts were being fetched from Google on every launch until v229.
//
// Runs in CI and from tools/deploy.sh. Exits non-zero on any failure.

import { readFileSync, existsSync } from "node:fs";

const fail = [];
const app = readFileSync("app.js", "utf8");
const sw = readFileSync("sw.js", "utf8");
const html = readFileSync("index.html", "utf8");

// 1. one version, everywhere
const ver = app.match(/APP_VERSION = '(v\d+)'/)?.[1];
if (!ver) fail.push("app.js has no APP_VERSION");
const cache = sw.match(/CACHE = 'daily-pulse-(v\d+)'/)?.[1];
if (!cache) fail.push("sw.js has no daily-pulse-vN cache name");
if (ver && cache && ver !== cache) {
  fail.push(`version drift: app.js is ${ver} but sw.js cache is ${cache} — the service worker will not re-install, so offline users stay on the old shell`);
}
for (const f of ["styles.css", "app.js", "workout-anims.js", "workout-plan.js"]) {
  const q = html.match(new RegExp(`${f.replace(".", "\\.")}\\?v=(v?\\d+)`))?.[1];
  if (!q) fail.push(`index.html does not cache-bust ${f}`);
  else if (ver && `v${q.replace(/^v/, "")}` !== ver) fail.push(`index.html has ${f}?v=${q} but APP_VERSION is ${ver}`);
}

// 2. every precached file exists
const assets = [...(sw.match(/const ASSETS = \[([\s\S]*?)\]/)?.[1] ?? "").matchAll(/'([^']+)'/g)].map((m) => m[1]);
if (!assets.length) fail.push("could not parse sw.js ASSETS");
for (const a of assets) {
  if (a === "./") continue;
  if (!existsSync(a.replace(/^\.\//, ""))) fail.push(`precache entry missing on disk: ${a} — cache.addAll would reject and offline mode would break`);
}

// 3. no third-party runtime assets — the app claims "private & offline"
const ext = [...html.matchAll(/(?:src|href)="(https?:\/\/[^"]+)"/g)].map((m) => m[1])
  .filter((u) => !/^https?:\/\/(www\.)?(w3\.org)/.test(u));
if (ext.length) fail.push(`index.html loads third-party assets at runtime, which contradicts "private & offline": ${ext.join(", ")}`);

if (fail.length) {
  console.error("release check FAILED:");
  for (const f of fail) console.error(`  - ${f}`);
  process.exit(1);
}
console.log(`release check ok: ${ver}, ${assets.length} precache entries, no third-party assets`);
