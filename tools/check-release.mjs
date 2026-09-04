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

import { readFileSync, existsSync, readdirSync } from "node:fs";

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

// 2d. every guard in tools/ actually runs.
//
// A guard nobody runs is a comment with a shebang, and this is not hypothetical: on another repo
// the same week I wrote a check, mutation-tested it, and only found out it had never been added
// to the build when the mutation "escaped" — it was not in the pipeline at all.
//
// This lives inside check-release rather than in its own file for a specific reason. A separate
// tools/check-guards.mjs would have to be wired itself, and unwiring THAT would silence
// everything below it without a sound. This repo has no test runner to hide it in, so it goes in
// the one check that cannot be dropped from deploy.sh without the release check obviously
// disappearing with it.
//
// check-*.mjs must run in BOTH deploy.sh (before the push) and CI. verify-*.sh needs a live
// site, so it belongs in deploy.sh only.
const deploySh = readFileSync("tools/deploy.sh", "utf8");
const ciYml = readFileSync(".github/workflows/check.yml", "utf8");
const toolFiles = readdirSync("tools");

// gen-sitemap.mjs is named for what it mostly does, but `--check` makes it a guard, and a guard
// nobody runs is a comment with a shebang. Including it here means the same wiring rule covers
// it: run by deploy.sh AND by CI, or the release fails.
const checks = toolFiles.filter((f) => /^check-.*\.mjs$/.test(f) || f === "gen-sitemap.mjs");
const verifiers = toolFiles.filter((f) => /^verify-.*\.sh$/.test(f));
if (checks.length < 3) fail.push(`only found ${checks.length} check-*.mjs in tools/ — this check has gone stale`);

for (const f of checks) {
  if (!deploySh.includes(f)) fail.push(`tools/${f} is never run by deploy.sh — a release could ship without it`);
  if (!ciYml.includes(f)) fail.push(`tools/${f} is never run in CI — it only guards your own machine`);
}
for (const f of verifiers) {
  if (!deploySh.includes(f)) fail.push(`tools/${f} is never run by deploy.sh — nothing confirms the release landed`);
}

// 3. no third-party runtime assets — the app claims "private & offline"
//
// "Loads at runtime" has to mean actually loads. This used to match any src= or href= holding
// an absolute URL, which caught <link rel="canonical"> — a tag the browser never fetches — and
// reported it as a third-party asset contradicting the privacy claim. The message was wrong on
// both counts: nothing was loaded, and the URL was this site's own origin.
//
// So: only the tags that cause a fetch, and only origins that are not ours.
const SELF = "https://kishore2494.github.io/daily-pulse";
const FETCHING_REL = /^(stylesheet|preload|prefetch|modulepreload|manifest|icon|apple-touch-icon)$/i;
const ext = [];
for (const m of html.matchAll(/<(?:script|img|iframe|source|video|audio|embed)\b[^>]*\bsrc="(https?:\/\/[^"]+)"/gi)) {
  ext.push(m[1]);
}
for (const m of html.matchAll(/<link\b[^>]*>/gi)) {
  const rel = m[0].match(/\brel="([^"]+)"/i)?.[1] ?? "";
  const href = m[0].match(/\bhref="(https?:\/\/[^"]+)"/i)?.[1];
  if (href && rel.split(/\s+/).some((r) => FETCHING_REL.test(r))) ext.push(href);
}
const external = ext
  .filter((u) => !/^https?:\/\/(www\.)?(w3\.org)/.test(u))
  .filter((u) => !u.startsWith(SELF));
if (external.length) fail.push(`index.html loads third-party assets at runtime, which contradicts "private & offline": ${external.join(", ")}`);

// 4. a card type is a promise; keep it one the page can pay
//
// 128 landing pages declared twitter:card = summary_large_image and shipped no image at all.
// Every share of every one of them rendered blank where the picture goes, and nothing noticed,
// because the pages themselves were otherwise perfect. A declaration the page cannot back is
// worse than none: "summary" with no image degrades, "summary_large_image" with no image just
// fails. The app root was worse still — no description and no OG tags at all, on the single
// URL most likely to be shared.
const CARD = "og-card.png";
const socialPages = readdirSync(".").filter((f) => f.endsWith(".html"));
const noImage = [];
const relativeImg = [];
for (const f of socialPages) {
  const page = readFileSync(f, "utf8");
  const og = page.match(/<meta[^>]*property="og:image"[^>]*content="([^"]*)"/i)?.[1];
  const tw = page.match(/<meta[^>]*name="twitter:image"[^>]*content="([^"]*)"/i)?.[1];
  const large = /name="twitter:card"[^>]*content="summary_large_image"/i.test(page);
  if (large && !og && !tw) noImage.push(f);
  for (const u of [og, tw]) if (u && !/^https?:\/\//i.test(u)) relativeImg.push(`${f} -> ${u}`);
}
if (noImage.length) {
  fail.push(`${noImage.length} page(s) declare twitter:card=summary_large_image with no image: ` +
            `${noImage.slice(0, 4).join(", ")}${noImage.length > 4 ? ", …" : ""}`);
}
if (relativeImg.length) {
  // Social crawlers fetch these with no page context, so a relative path is a 404 to every one.
  fail.push(`${relativeImg.length} social image(s) are relative and will not resolve for crawlers: ` +
            `${relativeImg.slice(0, 3).join(", ")}`);
}
if (!existsSync(CARD)) {
  fail.push(`${CARD} is missing, and pages point at it. Run: python3 tools/make-og-card.py`);
} else {
  // Read the size out of the PNG's IHDR rather than trusting the generator: the dimensions are
  // the entire content of the summary_large_image promise, so they are what is worth checking.
  const buf = readFileSync(CARD);
  const cw = buf.readUInt32BE(16), ch = buf.readUInt32BE(20);
  if (cw < 1200 || ch < 630) fail.push(`${CARD} is ${cw}x${ch}; summary_large_image wants at least 1200x630`);
}

// 5. the Play Data safety declaration must stay true
//
// The live listing declares "No data collected" and "No data shared with third parties". Both
// are currently accurate, and one constant is all that stands behind the first:
//
//     const FEEDBACK_URL = '';   // paste the Feedback.gs web-app URL after deploying
//
// Fill that in and the app silently POSTs the user's free-text feedback plus their userAgent to
// an endpoint the developer owns. That is collection by Play's definition, and it would make the
// store declaration and privacy.html both false — on a published app, with no other signal that
// anything changed. The comment next to it literally reads "(silent collection)".
//
// ntfy is a different case and is fine: the user has to enable it and choose a topic, which is
// Play's user-initiated transfer exemption ("data transferred to a third party based on a
// specific action that you initiate"). It stays undeclared legitimately.
//
// This does not forbid the endpoint. It requires that turning it on is a deliberate act that
// also updates what the app tells people.
const feedbackUrl = app.match(/const FEEDBACK_URL = '([^']*)'/)?.[1];
if (feedbackUrl === undefined) {
  fail.push("FEEDBACK_URL is gone from app.js — this check can no longer tell whether the app collects feedback");
} else if (feedbackUrl !== "") {
  const privacy = existsSync("privacy.html") ? readFileSync("privacy.html", "utf8") : "";
  if (!/feedback/i.test(privacy) || !/collect|send|transmit/i.test(privacy)) {
    fail.push(
      "FEEDBACK_URL is set, so feedback is sent to a developer endpoint, but privacy.html does not say so.\n" +
      "    The Play listing also declares \"No data collected\" — update BOTH before shipping this."
    );
  }
}

if (fail.length) {
  console.error("release check FAILED:");
  for (const f of fail) console.error(`  - ${f}`);
  process.exit(1);
}
console.log(`release check ok: ${ver}, ${assets.length} precache entries, no third-party assets, ${socialPages.length} pages carry a social card`);
