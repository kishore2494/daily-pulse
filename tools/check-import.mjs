// Run validateBackup() for real, against the files a user could actually pick.
//
// The restore path is the one place a user has no second copy, and importData used to accept
// anything that parsed as JSON. The dangerous case is not a crash — it is a file with none of
// our keys writing nothing and the app saying "Backup restored". This app has had to unlearn
// report-success-on-failure three times already; a grep asserting the validator "exists" would
// not have caught any of them.
//
// So the function is extracted from app.js and EXECUTED. It is pure by construction (its only
// free variable is BACKUP_KEYS, supplied here from the same file), which is what makes that
// possible without a browser.

import { readFileSync } from "node:fs";

const src = readFileSync("app.js", "utf8");

function block(name, open, close) {
  const i = src.indexOf(name);
  if (i < 0) throw new Error(`${name} not found in app.js`);
  let depth = 0;
  for (let j = src.indexOf(open, i); j < src.length; j++) {
    if (src[j] === open) depth++;
    else if (src[j] === close && --depth === 0) return src.slice(i, j + 1);
  }
  throw new Error(`unbalanced ${open}${close} after ${name}`);
}

const keysSrc = block("const BACKUP_KEYS", "[", "]");
const BACKUP_KEYS = eval(keysSrc.slice(keysSrc.indexOf("[")));
if (!Array.isArray(BACKUP_KEYS) || BACKUP_KEYS.length < 20) {
  console.error(`!! parsed only ${BACKUP_KEYS?.length} backup keys — this check has gone stale`);
  process.exit(1);
}

const fnSrc = block("function validateBackup", "{", "}");
// eslint-disable-next-line no-new-func
const validateBackup = new Function("BACKUP_KEYS", `${fnSrc}; return validateBackup;`)(BACKUP_KEYS);

const k0 = BACKUP_KEYS[0];
const cases = [
  // [label, payload, expect ok]
  ["a real backup",                     { [k0]: {}, [BACKUP_KEYS[1]]: [] },      true],
  ["one section only",                  { [k0]: {} },                            true],
  ["null",                              null,                                    false],
  ["an array (a CSV export, a list)",   [1, 2, 3],                               false],
  ["a string",                          "hello",                                 false],
  ["a number",                          42,                                      false],
  ["{} — parses fine, means nothing",   {},                                      false],
  ["another app's JSON",                { name: "x", version: "1.0.0" },         false],
  ["our key names, numeric contents",   { [k0]: 1, [BACKUP_KEYS[1]]: 2 },        false],
];

const fails = [];
for (const [label, payload, expected] of cases) {
  let got;
  try { got = validateBackup(payload); }
  catch (e) { fails.push(`${label}: threw ${e.message}`); continue; }
  if (got.ok !== expected) fails.push(`${label}: ok=${got.ok}, expected ${expected} (${got.reason})`);
  if (!got.ok && !got.reason) fails.push(`${label}: rejected with no reason to show the user`);
  if (!got.ok && got.keys.length) fails.push(`${label}: rejected but still returned ${got.keys.length} key(s) to write`);
}

// The property that matters most: a rejected file must never produce keys to write, because
// importData writes exactly what this returns.
for (const [label, payload] of cases) {
  let got; try { got = validateBackup(payload); } catch { continue; }
  if (!got.ok && got.keys.length) fails.push(`${label}: would still have written data`);
}

if (fails.length) {
  console.error("import guard FAILED:");
  for (const f of fails) console.error(`  - ${f}`);
  process.exit(1);
}
console.log(`import guard ok: validateBackup rejects ${cases.filter((c) => !c[2]).length} bad payloads, accepts ${cases.filter((c) => c[2]).length}, ${BACKUP_KEYS.length} keys`);
