// Every key the app stores must be either backed up or deliberately excluded.
//
// The export/import in Settings is offered inside the wipe flow, so it is the last thing
// standing between the user and losing everything. Twice now it has quietly dropped data:
// v230 found eleven of the user's own choices missing from BACKUP_KEYS, and v231 found
// dp.settings — their name, reminder time and sync URL — still missing after that sweep.
// Both times the app said "Backup restored" and the user had no way to know otherwise.
//
// The rule was written down as prose in a comment, which is why it kept being broken: nothing
// could check a comment. BACKUP_EXCLUDED turns the exclusions into a list, and this script
// holds the two to account. Add a key to neither and the release fails here.
//
// Dynamic writes are the known blind spot: keys written through helpers such as
// flagRow('dp.hapticsOff', ...) never appear as a literal argument to safeSet. Those are
// reported as unmatched entries rather than ignored, so the list cannot rot unnoticed either.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const src = readFileSync(join(root, "app.js"), "utf8");

/** Pull an array literal out of the source and evaluate it (comments and all). */
function arrayLiteral(name) {
  const at = src.indexOf(`const ${name}`);
  if (at === -1) throw new Error(`${name} not found in app.js — this check has gone stale`);
  const open = src.indexOf("[", at);
  let depth = 0;
  for (let i = open; i < src.length; i++) {
    if (src[i] === "[") depth++;
    else if (src[i] === "]" && --depth === 0) return eval(src.slice(open, i + 1));
  }
  throw new Error(`unterminated ${name}`);
}

const backed = arrayLiteral("BACKUP_KEYS");
const excluded = arrayLiteral("BACKUP_EXCLUDED");

// Every literal key written through safeSet() or localStorage.setItem().
const written = new Set();
for (const m of src.matchAll(/(?:safeSet|localStorage\.setItem)\(\s*['"]dp\.([^'"]+)['"]/g)) {
  written.add(m[1]);
}

const problems = [];

// A key must be in exactly one of the two lists.
const both = backed.filter((k) => excluded.includes(k));
if (both.length) problems.push(`in BOTH BACKUP_KEYS and BACKUP_EXCLUDED: ${both.join(", ")}`);

const unaccounted = [...written]
  .filter((k) => !k.endsWith("."))                       // dp.notified.<id> is a key PREFIX
  .filter((k) => !backed.includes(k) && !excluded.includes(k))
  .sort();
if (unaccounted.length) {
  problems.push(
    `written by the app but in neither list: ${unaccounted.join(", ")}\n` +
    `     Add each to BACKUP_KEYS if it is the user's data or a choice they made, or to\n` +
    `     BACKUP_EXCLUDED if it only describes this install. Silence here is how a\n` +
    `     wipe-then-restore loses data while reporting success.`
  );
}

// Entries that no literal write matches — either dead, or written through a helper.
const unmatched = [...backed, ...excluded].filter((k) => !written.has(k)).sort();

if (problems.length) {
  console.error("\n\x1b[31m✗ backup key coverage\x1b[0m");
  for (const p of problems) console.error(`   ${p}`);
  console.error("");
  process.exit(1);
}

console.log(
  `backup keys: ${written.size} written, ${backed.length} backed up, ${excluded.length} excluded by design` +
  (unmatched.length ? ` (${unmatched.length} written via helpers, not literals: ${unmatched.join(", ")})` : "")
);
