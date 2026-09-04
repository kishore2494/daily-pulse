// Run the CSV escaper for real, the way check-import.mjs runs the backup validator.
//
// exportCSV() is the only way a user gets their journal out into anything but Daylog, and its
// escaping is hand-rolled: one regex and one replace. It is CORRECT today — quotes doubled,
// fields containing a comma, quote or newline wrapped — and nothing anywhere checks that,
// so a tidy-up could break every export and no guard would notice until someone opened a file.
//
// It also REPORTS something it deliberately does not fail on. Five exported columns are free
// text the user typed (journal, wentWell, improve, workoutDetail, tasks), and a spreadsheet
// treats a cell starting with = + - or @ as a formula. A journal line written as "- ran 5k",
// which is how most people write a list, opens in Excel or Sheets as #NAME? rather than as the
// sentence they wrote. Every available fix alters the exported text — prefixing an apostrophe
// is the usual one, and it renders literally in some tools — so which trade-off is right
// depends on where these files get opened. That is not a decision to make silently inside an
// escaper, so it is surfaced here and recorded in the trip queue instead of guessed at.

import { readFileSync } from "node:fs";

const src = readFileSync("app.js", "utf8");

const line = src.split("\n").find((l) => l.includes("const esc = v =>"));
if (!line) {
  console.error("!! could not find the CSV escaper in exportCSV — this check has gone stale");
  process.exit(1);
}
// eslint-disable-next-line no-new-func
const esc = new Function(`${line.trim().replace(/;$/, "")}; return esc;`)();

const cases = [
  ["plain text",                 "ran 5k",                 "ran 5k"],
  ["a comma",                    "ran 5k, felt good",      '"ran 5k, felt good"'],
  ["a quote",                    'said "hi"',              '"said ""hi"""'],
  ["a newline",                  "line one\nline two",     '"line one\nline two"'],
  ["quote AND comma",            'a, "b"',                 '"a, ""b"""'],
  ["null",                       null,                     ""],
  ["undefined",                  undefined,                ""],
  ["a number",                   42,                       "42"],
  ["empty string",               "",                       ""],
];

const fails = [];
for (const [label, input, expected] of cases) {
  let got;
  try { got = esc(input); } catch (e) { fails.push(`${label}: threw ${e.message}`); continue; }
  if (got !== expected) fails.push(`${label}: got ${JSON.stringify(got)}, expected ${JSON.stringify(expected)}`);
}

// The property, not just the examples: anything containing a delimiter must come back quoted,
// and quotes inside must be doubled — that is what keeps a journal entry from shifting columns.
for (const s of ['a,b', 'a"b', "a\nb", 'a,"b",c']) {
  const out = esc(s);
  if (!out.startsWith('"') || !out.endsWith('"')) fails.push(`${JSON.stringify(s)} was not quoted`);
  if ((out.slice(1, -1).match(/"/g) ?? []).length % 2 !== 0) fails.push(`${JSON.stringify(s)}: unbalanced quotes`);
}

if (fails.length) {
  console.error("export guard FAILED:");
  for (const f of fails) console.error(`  - ${f}`);
  process.exit(1);
}

// Reported, never blocking. Failing the release over an open design question would only teach
// someone to delete the check.
const RISKY = /^[=+\-@\t\r]/;
const cols = src.match(/const cols = \[([\s\S]*?)\];/)?.[1] ?? "";
const free = ["journal", "wentWell", "improve", "workoutDetail", "tasks"].filter((c) => cols.includes(`'${c}'`));
console.log(`export: CSV escaping correct on ${cases.length} cases + 4 properties`);
if (free.length && RISKY.test("-")) {
  console.log(`   note: ${free.length} free-text column(s) (${free.join(", ")}) export unprefixed, so a line`);
  console.log(`   beginning = + - or @ is read as a formula by Excel/Sheets. Open question — see DEFERRED.`);
}
