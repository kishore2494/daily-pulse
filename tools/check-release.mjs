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

// 2b. and every script/stylesheet the page loads IS precached.
//
// Check 2 runs one way only: everything in ASSETS exists on disk. The mirror case breaks
// offline mode just as completely and is easier to cause — add a <script> to index.html,
// forget sw.js, and the app keeps working perfectly for you because the network serves it.
// Offline, that file is simply not in the cache and the app is broken for exactly the users
// the cache exists for. Same shape as the frozen CACHE name: invisible from online.
//
// Scoped to .js and .css — the files whose absence stops the app running. Images and fonts
// degrade rather than break, and listing every one here would make this a nuisance that gets
// switched off.
const loaded = [...new Set(
  [...html.matchAll(/(?:src|href)="\.?\/?([A-Za-z0-9._\/-]+\.(?:js|css))(?:\?[^"]*)?"/g)].map((m) => m[1]),
)];
const precached = new Set(assets.map((a) => a.replace(/^\.\//, "")));
for (const f of loaded) {
  if (!precached.has(f)) {
    fail.push(`index.html loads ${f} but sw.js does not precache it — the app would break offline while looking fine online`);
  }
}

// 2c. and every asset referenced from CSS is precached too.
//
// Check 2b covers what index.html LOADS via src/href — the scripts and the stylesheet. It does
// not see url(...) references, which is where the fonts live: v229 self-hosted them, and
// dm-sans and sora are declared in an inline @font-face inside index.html while twemoji comes
// from styles.css. All three are precached today, and nothing was checking that.
//
// The failure is quiet rather than dramatic: a font added and not precached still loads online,
// so it looks fine everywhere except offline, where the app falls back to a system face. Same
// shape as every other offline bug this file exists for — invisible from the place you test.
const cssSources = [html, readFileSync("styles.css", "utf8")].join("\n");
const urlRefs = [...new Set(
  [...cssSources.matchAll(/url\(\s*['"]?(?!data:|https?:)([^)'"]+)['"]?\s*\)/g)]
    .map((m) => m[1].trim().replace(/^\.\//, "").split("?")[0])
    // Fragment references — url(#n), and the %23-encoded form used inside inline SVG — point at
    // a filter or gradient in the same document, not at a file. The first version of this check
    // reported "%23n" as a missing precache entry.
    .filter((u) => u && !u.startsWith("#") && !u.startsWith("%23")),
)];
for (const f of urlRefs) {
  if (!precached.has(f)) {
    fail.push(`CSS references ${f} but sw.js does not precache it — it would fall back offline while looking fine online`);
  }
}

// The other direction, reported rather than enforced: a precached asset nothing references is
// dead weight in an ATOMIC cache.addAll, and a hint that something was removed by halves.
const referenced = new Set([...loaded, ...urlRefs, "index.html", "manifest.webmanifest"]);
const orphans = [...precached].filter(
  (f) =>
    f &&                          // './' normalises to "" — the app root, not a file
    !referenced.has(f) &&
    !/^icons\//.test(f),          // icons are named by the manifest, which this does not parse
);
if (orphans.length) {
  console.warn(`\n\u26a0 precached but referenced nowhere: ${orphans.join(", ")}`);
  console.warn("   Either something stopped using them, or this check cannot see how they are used.\n");
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
