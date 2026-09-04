// The README must name the release tools that exist, and only those.
//
// Before this, no document in the repo mentioned a single file in tools/. The release process —
// bump the three version stamps, run the guards, push both remotes, prove the live site — was
// entirely tribal knowledge, including every guard added while hardening this app. Someone
// coming back to it in six months (Kishore, most likely) would have had to read deploy.sh to
// find out that it existed.
//
// Both directions, because each fails differently:
//   a tool the README never mentions   nobody knows to run it, and it may as well not exist
//   a tool the README names that is gone  the instructions send you into an error
//
// The second is what happened to the FieldOps runbook: it told operators to set BACKUP_CERT,
// which backup.sh has never read, and following it produced unencrypted backups.
//
// RELEASE_TOOLS is deliberately narrow. tools/ also holds one-off helpers — screenshots, an app
// rename, an alarm probe — that nobody needs in a README, and demanding they be documented
// would make this check noise, which is how a check ends up deleted.

import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const readme = readFileSync(join(root, "README.md"), "utf8");

const RELEASE_TOOLS = ["bump.sh", "deploy.sh", "check-release.mjs", "check-backup-keys.mjs", "verify-live.sh"];

const present = new Set(readdirSync(join(root, "tools")));
const problems = [];

const vanished = RELEASE_TOOLS.filter((t) => !present.has(t));
if (vanished.length) problems.push(`this check names tools that no longer exist: ${vanished.join(", ")}`);

const undocumented = RELEASE_TOOLS.filter((t) => present.has(t) && !readme.includes(`tools/${t}`));
if (undocumented.length) {
  problems.push(`release tools the README never mentions: ${undocumented.join(", ")}\n` +
                `     Nobody knows to run them, which makes them decorative.`);
}

// Anything the README tells you to run has to be there.
const named = [...new Set([...readme.matchAll(/tools\/([a-zA-Z0-9._-]+)/g)].map((m) => m[1]))];
const phantom = named.filter((t) => !present.has(t));
if (phantom.length) {
  problems.push(`the README points at tools that do not exist: ${phantom.join(", ")}\n` +
                `     Following the instructions would fail.`);
}

if (problems.length) {
  console.error("\n\x1b[31m✗ README and tools/ disagree\x1b[0m");
  for (const p of problems) console.error(`   ${p}`);
  console.error("");
  process.exit(1);
}
console.log(`readme: ${RELEASE_TOOLS.length} release tools, all documented and all present`);
