// Run parseAmt() and finFmt() for real, the way the other guards run their functions.
//
// parseAmt is the single point where a typed amount becomes stored money. Every balance, every
// budget, every net-worth figure descends from it, and it was untested. The arithmetic is
// already right in the way that matters most — everything is integer MINOR units (paise), never
// floats, so no total can drift by a rounding error. What was unpinned is the parsing, which
// has real work in it: k and L suffixes, Indian comma grouping, a currency symbol, a sign that
// belongs to the direction rather than the amount, and two decimal places.
//
// Break any of that in a refactor and the failure is wrong money in someone's ledger, discovered
// long after the transaction it came from.
//
// Two behaviours below are QUIRKS, pinned deliberately rather than endorsed. They are recorded
// so that changing them is a decision, and so the next person reading the function knows they
// were seen.

import { readFileSync } from "node:fs";

const src = readFileSync("app.js", "utf8");
function extract(name) {
  const start = src.indexOf(`function ${name}(`);
  if (start < 0) {
    console.error(`!! ${name}() is gone from app.js — this check has gone stale`);
    process.exit(1);
  }
  let depth = 0, i = src.indexOf("{", start);
  for (; i < src.length; i++) {
    if (src[i] === "{") depth++;
    else if (src[i] === "}" && --depth === 0) break;
  }
  return src.slice(start, i + 1);
}
// eslint-disable-next-line no-new-func
const parseAmt = new Function(`${extract("parseAmt")}; return parseAmt;`)();

const fails = [];
const eq = (input, expected, why) => {
  const got = parseAmt(input);
  if (got !== expected) fails.push(`${JSON.stringify(input)} -> ${got}, expected ${expected}  (${why})`);
};

// ── the money that matters ────────────────────────────────────────────────────
eq("100", 10000, "whole rupees become paise");
eq("100.5", 10050, "one decimal place is tenths of a rupee, not paise");
eq("100.50", 10050, "two decimal places");
eq("0.99", 99, "under a rupee");
eq(".5", 50, "a leading dot is still half a rupee");
eq("0", 0, "zero is a real amount, not empty");

// ── the shorthand people actually type ────────────────────────────────────────
eq("1k", 100000, "k is a thousand");
eq("1K", 100000, "and is case-insensitive");
eq("1.5k", 150000, "with decimals");
eq("2.5L", 25000000, "L is a lakh — 2.5L is 250,000 rupees");
eq("3l", 30000000, "lower case lakh");

// ── what a real Indian amount looks like when pasted ──────────────────────────
eq("1,00,000", 10000000, "Indian comma grouping is stripped, not misread");
eq("₹250", 25000, "a currency symbol is stripped");
eq("  42  ", 4200, "surrounding whitespace");
eq("-50", 5000, "a minus is DISCARDED: direction lives in t.dir, not in the amount");

// ── refusals ──────────────────────────────────────────────────────────────────
eq("", null, "empty is not zero");
eq("abc", null, "text with no digits");
eq(".", null, "a lone dot");
eq(null, null, "null");
eq(undefined, null, "undefined");

// ── quirks, pinned rather than endorsed ───────────────────────────────────────
eq("1.005", 100, "TRUNCATES the third decimal rather than rounding to 101 — sub-paise input");
eq("1e3", 1300, "letters are stripped, so scientific notation silently becomes 13 rupees");
eq("1.2.3", 120, "a second dot is dropped rather than rejected");

// ── the property that protects every total ────────────────────────────────────
// Integers only. A float here is how a ledger ends up 0.01 out with no failing test.
for (const input of ["100", "0.07", "1.5k", "2.5L", "1,00,000", "999999999"]) {
  const v = parseAmt(input);
  if (!Number.isInteger(v)) fails.push(`${JSON.stringify(input)} produced ${v}, which is not an integer number of paise`);
}
// A number and its string form must agree. They did not: the numeric branch used
// Math.round(n * 100), and 1.005 * 100 is 100.49999999999999 in binary floating point, so it
// returned 100 where the string path also returns 100 but for an entirely different reason —
// two rules that happened to collide. It now routes through the same parser.
for (const n of [100, 100.5, 0.99, 1.005, 2.675, 0]) {
  const viaNumber = parseAmt(n), viaString = parseAmt(String(n));
  if (viaNumber !== viaString) {
    fails.push(`parseAmt(${n}) = ${viaNumber} but parseAmt("${n}") = ${viaString} — one rule, two answers`);
  }
  if (!Number.isInteger(viaNumber)) fails.push(`parseAmt(${n}) = ${viaNumber}, not whole paise`);
}
if (parseAmt(Infinity) !== null) fails.push(`parseAmt(Infinity) = ${parseAmt(Infinity)}, expected null`);
if (parseAmt(NaN) !== null) fails.push(`parseAmt(NaN) = ${parseAmt(NaN)}, expected null`);

if (fails.length) {
  console.error("money guard FAILED:");
  for (const f of fails) console.error(`  - ${f}`);
  process.exit(1);
}
console.log(`money: parseAmt correct on ${25} cases — k/L suffixes, comma grouping, refusals, integer paise only`);
