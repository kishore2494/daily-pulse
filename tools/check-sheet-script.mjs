// Run the Google Sheet script (google-apps-script/Code.gs) for real against a stand-in sheet.
//
// Code.gs is the sync backend every user pastes into their own sheet, and nothing checked it.
// Two ways it changed what it stored, both from the same Sheets rule: a value written from a
// script is read like typed input, so one starting with = + or - becomes a formula (#ERROR!),
// and a leading ' is dropped.
//
//   _State    the whole app state, cut every 45000 characters into cells. The JSON is full of
//             "-" (every date), so a piece starting with one was likely once a state ran to a
//             few pieces, and every pull after that got broken JSON.
//   Log tabs  a journal or note written as "- ran 5k" showed as #ERROR! in the sheet.
//
// The stand-in models exactly that rule, and this check first proves the stand-in reproduces
// the damage, so it cannot pass by being too kind. It cannot prove what Google does; it pins
// what the script assumes Google does.
//
// It also holds sheets-setup.html to the file: the page carries its own copy for people to paste,
// and an edit to one and not the other ships a fix nobody installs.
//
// And it holds the script's SCRIPT_VERSION to the number app.js expects (SHEET_SCRIPT): the app
// tells a user their pasted copy is old by comparing the two, so a change to Code.gs that the app
// does not know about leaves everyone on the old copy without a word.

import { readFileSync } from "node:fs";

const gs = readFileSync("google-apps-script/Code.gs", "utf8");
const page = readFileSync("sheets-setup.html", "utf8");
const app = readFileSync("app.js", "utf8");
const fails = [];

// 1. the page's copy is the file
const unescape = (s) => s.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");
const copy = page.match(/<pre class="code" id="src">([\s\S]*?)<\/pre>/);
if (!copy) fails.push("sheets-setup.html has no <pre id=src> copy of the script — this check has gone stale");
else if (unescape(copy[1]).trim() !== gs.trim()) fails.push("sheets-setup.html's copy of the script differs from google-apps-script/Code.gs");

// 2. a stand-in sheet that stores values the way Sheets stores typed input
function typed(v) {
  if (typeof v !== "string") return v;
  if (v.length > 50000) throw new Error("Your input contains more than the maximum of 50000 characters in a single cell.");
  if (v[0] === "'") return v.slice(1);
  if (v[0] === "=") return "#ERROR!";
  if ((v[0] === "+" || v[0] === "-") && !/^[+-]\d+(\.\d+)?$/.test(v)) return "#ERROR!";
  return v;
}
function makeSheet() {
  let cells = [];
  return {
    clear() { cells = []; },
    getRange(r, c, nr, nc) {
      if (typeof r === "string") return { setNumberFormat() {} };
      return {
        setValues(vals) { vals.forEach((row, i) => row.forEach((v, j) => { (cells[r - 1 + i] ||= [])[c - 1 + j] = typed(v); })); },
        getValues() { return Array.from({ length: nr }, (_, i) => Array.from({ length: nc || 1 }, (_, j) => (cells[r - 1 + i] || [])[c - 1 + j] ?? "")); },
        setNumberFormat() {},
      };
    },
    getLastRow() { return cells.length; },
    appendRow(row) { cells.push(row.map(typed)); },
    setFrozenRows() {},
    hideSheet() {},
    cells: () => cells,
  };
}
const sheets = {};
const SpreadsheetApp = { getActiveSpreadsheet: () => ({ getSheetByName: (n) => sheets[n] || null, insertSheet: (n) => (sheets[n] = makeSheet()) }) };
const ContentService = { createTextOutput: (text) => ({ text, setMimeType() { return this; } }), MimeType: { JSON: "json", JAVASCRIPT: "js" } };
// eslint-disable-next-line no-new-func
const api = new Function("SpreadsheetApp", "ContentService", `${gs}\nreturn { saveState_, readState_, doPost, doGet, SCRIPT_VERSION };`)(SpreadsheetApp, ContentService);

// the stand-in must reproduce the damage, or every check below passes vacuously
if (typed("-x") !== "#ERROR!" || typed("=x") !== "#ERROR!" || typed("'x") !== "x") fails.push("the stand-in sheet no longer models Sheets' typed-input rules");

// 3. the state comes back exactly as pushed, whatever lands at a cut
let cuts = 0;
const roundTrip = (label, s) => {
  cuts++;
  try { api.saveState_(s); } catch (e) { fails.push(`${label}: saveState_ threw ${e.message}`); return; }
  const back = api.readState_();
  if (back !== s) fails.push(`${label}: came back changed (${s.length} chars in, ${back.length} out)`);
  const bad = sheets._State.cells().findIndex((row) => /^[=+\-'\s\uDC00-\uDFFF]/.test(String(row[0])) || /[\s\uD800-\uDBFF]$/.test(String(row[0])));
  if (bad >= 0) fails.push(`${label}: piece ${bad + 1} starts or ends with a character Sheets changes`);
};
const at45k = (c, run = 1) => '{"a":"' + "x".repeat(45000 - 6) + c.repeat(run) + 'yy"}';
for (const [name, c] of [["a dash", "-"], ["an equals sign", "="], ["a plus", "+"], ["an apostrophe", "'"], ["a space", " "], ["a newline", "\\n"]]) {
  roundTrip(`${name} at the 45000 cut`, at45k(c));
}
roundTrip("a 10000-dash run across the cut", at45k("-", 10000));
roundTrip("an emoji across the cut (two halves in JS)", '{"a":"' + "x".repeat(45000 - 7) + "\u{1F3C3} ran 5k" + '"}');
roundTrip("a run of emoji across the cut", '{"a":"' + "x".repeat(44000) + "\u{1F3C3}".repeat(1200) + '"}');
roundTrip("a 30000-dash run (no safe cut ahead, so it looks back)", '{"a":"' + "x".repeat(44994) + "-".repeat(30000) + "y".repeat(50000) + '"}');
roundTrip("a small state, one piece", JSON.stringify({ touched: 1, entries: { "2026-11-01": { mood: 7 } } }));
const big = { touched: Date.now(), entries: {} };
for (let i = 0; i < 1500; i++) {
  const d = new Date(Date.UTC(2022, 0, 1 + i)).toISOString().slice(0, 10);
  big.entries[d] = { mood: 1 + (i % 10), journal: "- walked the lake, =ok, +1 day, it's fine", updatedAt: d + "T21:00:00.000Z" };
}
roundTrip("a 4-year state of dates and dashes", JSON.stringify(big));

// 4. text typed into the app reaches the Log, Notes and other tabs as typed
const post = (data) => api.doPost({ postData: { contents: JSON.stringify(data) } });
post({ date: "2026-11-01", mood: 7, journal: "- ran 5k", wentWell: "=great", improve: "+1 hour sleep", habits: {} });
const header = sheets.Log.cells()[0], row = sheets.Log.cells()[1] || [];
const col = (k) => row[header.indexOf(k)];
if (col("journal") !== "- ran 5k") fails.push(`Log: a journal starting "- " is stored as ${JSON.stringify(col("journal"))}`);
if (col("wentWell") !== "=great") fails.push(`Log: text starting "=" is stored as ${JSON.stringify(col("wentWell"))}`);
if (col("improve") !== "+1 hour sleep") fails.push(`Log: text starting "+" is stored as ${JSON.stringify(col("improve"))}`);
if (col("mood") !== 7) fails.push(`Log: a number is no longer stored as a number (${JSON.stringify(col("mood"))})`);
post({ type: "notes", items: [{ text: "- buy milk", color: "", created: "2026-11-01" }] });
if (sheets.Notes.cells()[1][0] !== "- buy milk") fails.push(`Notes: "- buy milk" is stored as ${JSON.stringify(sheets.Notes.cells()[1][0])}`);
post({ type: "reminders", items: [{ time: "07:00", label: "-- stretch", enabled: true }] });
if (sheets.Reminders.cells()[1][1] !== "-- stretch") fails.push(`Reminders: "-- stretch" is stored as ${JSON.stringify(sheets.Reminders.cells()[1][1])}`);

// 5. the pull reports the script version, as a second argument, and it is the one the app expects
const want = +(app.match(/const SHEET_SCRIPT = (\d+);/) || [])[1];
if (!want) fails.push("app.js has no `const SHEET_SCRIPT = <n>;` — this check has gone stale");
else if (api.SCRIPT_VERSION !== want) fails.push(`Code.gs SCRIPT_VERSION is ${api.SCRIPT_VERSION} but app.js expects ${want}; raise both together`);
api.saveState_(JSON.stringify({ touched: 5 }));
let got = null;
try {
  const out = api.doGet({ parameter: { type: "pull", callback: "cb" } }).text;
  // eslint-disable-next-line no-new-func
  new Function("cb", out)((state, meta) => { got = { state, meta }; });
} catch (e) { fails.push(`pull: the JSONP reply does not run (${e.message})`); }
if (got && got.state?.touched !== 5) fails.push("pull: the state did not come back as the first argument");
if (got && got.meta?.script !== api.SCRIPT_VERSION) fails.push(`pull: the second argument is ${JSON.stringify(got.meta)}, not the script version`);

if (fails.length) {
  console.error("sheet script FAILED:");
  for (const f of fails) console.error(`  - ${f}`);
  process.exit(1);
}
console.log(`sheet script: the page's copy matches Code.gs; the state round-trips through ${cuts} hard cases; typed text stays text in 3 tabs; the pull reports script v${api.SCRIPT_VERSION}, as app.js expects`);
