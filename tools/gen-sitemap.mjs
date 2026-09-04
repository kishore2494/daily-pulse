// Generate sitemap.xml from the pages that actually exist.
//
// It was hand-maintained, and it drifted exactly the way a hand-maintained list does. Thirteen
// pages were missing, and among them was a closed island: the eight `daily-pulse-vs-*`
// comparison pages plus use-cases.html, the hub that links to 138 pages. None of the nine were
// in the sitemap, and NO page that was in the sitemap linked to any of them — they linked only
// to each other. So the highest-intent pages on the site, the ones someone searching
// "daylog vs daylio" would land on, were reachable only if a crawler already knew they existed.
//
// landing.html and sheets-setup.html were worse off still: not in the sitemap and not linked
// from anywhere at all.
//
// Generating from the directory removes the failure mode rather than fixing today's instance of
// it. tools/check-sitemap.mjs then refuses to ship if the two disagree.
//
//   node tools/gen-sitemap.mjs           # write sitemap.xml
//   node tools/gen-sitemap.mjs --check   # exit 1 if it would differ

import { readdirSync, readFileSync, writeFileSync, statSync } from "node:fs";

const SITE = "https://kishore2494.github.io/daily-pulse";

// Pages that exist but must NOT be advertised, each for a stated reason. Anything not listed
// here gets included, so a new page is in the sitemap the day it is written.
const EXCLUDED = new Map([
  ["tablet-frame.html", "a device mock-up used for store screenshots, not a page"],
]);

const pages = readdirSync(".").filter((f) => f.endsWith(".html")).sort();
const urlFor = (f) => (f === "index.html" ? `${SITE}/` : `${SITE}/${f}`);
const priorityFor = (f) =>
  f === "index.html" ? "1.0" : f === "landing.html" || f.startsWith("daily-pulse-vs-") ? "0.9" : "0.8";

const today = new Date().toISOString().slice(0, 10);
const lastmod = (f) => {
  try { return statSync(f).mtime.toISOString().slice(0, 10); } catch { return today; }
};

const included = pages.filter((f) => !EXCLUDED.has(f));
const body = included
  .map((f) => `  <url><loc>${urlFor(f)}</loc><lastmod>${lastmod(f)}</lastmod><changefreq>weekly</changefreq><priority>${priorityFor(f)}</priority></url>`)
  .join("\n");
const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body}\n</urlset>\n`;

if (process.argv.includes("--check")) {
  let current = "";
  try { current = readFileSync("sitemap.xml", "utf8"); } catch {}
  // Compare the URL SET, not the bytes: lastmod moves whenever a file is touched, and failing a
  // release over that would make this a nuisance that gets switched off.
  const urls = (s) => new Set([...s.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]));
  const have = urls(current), want = urls(xml);
  const missing = [...want].filter((u) => !have.has(u));
  const stale = [...have].filter((u) => !want.has(u));
  if (missing.length || stale.length) {
    console.error(`\n\x1b[31m✗ sitemap.xml does not match the pages on disk\x1b[0m`);
    for (const u of missing.slice(0, 8)) console.error(`   built but not listed: ${u}  — it will not be crawled`);
    for (const u of stale.slice(0, 8)) console.error(`   listed but not built: ${u}  — crawlers get a 404`);
    console.error("   Run: node tools/gen-sitemap.mjs\n");
    process.exit(1);
  }
  console.log(`sitemap: ${want.size} urls, matching the ${included.length} page(s) on disk (${EXCLUDED.size} excluded by design)`);
} else {
  writeFileSync("sitemap.xml", xml);
  console.log(`sitemap.xml: ${included.length} urls written (${EXCLUDED.size} excluded by design)`);
}
