// Run overlappingBlocks() for real, the way check-import.mjs runs validateBackup().
//
// Every automatic path keeps the timelog non-overlapping — startAct() closes the running block
// before opening the next. Manual entry did not check at all, so a block laid over an existing
// one silently double-counted those hours in the day summary, in the string that syncs, and in
// trackedMs across every stats window. A sixteen-hour eight-hour day, reported as fact.
//
// The function is pure, so it is extracted and executed here rather than grepped for. Boundary
// behaviour is the whole point: blocks that merely TOUCH (09:00-10:00 and 10:00-11:00) are the
// normal shape of a tracked day and must not be flagged, or the warning fires constantly and
// gets ignored — which is worse than not warning.

import { readFileSync } from "node:fs";

const src = readFileSync("app.js", "utf8");
const start = src.indexOf("function overlappingBlocks(");
if (start < 0) {
  console.error("!! overlappingBlocks() is gone from app.js — this check can no longer see overlaps");
  process.exit(1);
}
let depth = 0, i = src.indexOf("{", start);
for (; i < src.length; i++) {
  if (src[i] === "{") depth++;
  else if (src[i] === "}" && --depth === 0) break;
}
// eslint-disable-next-line no-new-func
const overlappingBlocks = new Function(`${src.slice(start, i + 1)}; return overlappingBlocks;`)();

const H = (h) => h * 3600000;
const blk = (id, from, to) => ({ id, act: "a", start: H(from), end: to == null ? null : H(to) });
const log = [blk("work", 9, 17), blk("gym", 18, 19)];

const cases = [
  ["identical to an existing block",        blk("new", 9, 17),   1],
  ["fully inside one",                      blk("new", 10, 12),  1],
  ["straddling one's start",                blk("new", 8, 10),   1],
  ["straddling one's end",                  blk("new", 16, 18),  1],
  ["swallowing one, touching the next",     blk("new", 8, 18),   1],
  ["swallowing one and clipping the next",  blk("new", 8, 18.5), 2],
  ["between two blocks, touching neither",  blk("new", 17, 18),  0],
  ["ending exactly where one starts",       blk("new", 7, 9),    0],
  ["starting exactly where one ends",       blk("new", 17, 17.5),0],
  ["before everything",                     blk("new", 1, 2),    0],
  ["a still-running block it runs into",    blk("new", 20, 22),  0],
];

const fails = [];
for (const [label, block, expected] of cases) {
  let got;
  try { got = overlappingBlocks(block, log); }
  catch (e) { fails.push(`${label}: threw ${e.message}`); continue; }
  if (got.length !== expected) fails.push(`${label}: found ${got.length} overlap(s), expected ${expected}`);
}

// A block never overlaps itself — the manual form re-saves an existing id on edit.
if (overlappingBlocks(log[0], log).length !== 0) fails.push("a block was reported as overlapping itself");

// An open-ended block runs to now, so anything after its start collides with it.
const running = [{ id: "open", act: "a", start: H(20), end: null }];
if (overlappingBlocks(blk("new", 21, 22), running).length !== 1) {
  fails.push("an open-ended block did not swallow a later one");
}

// Garbage in must not throw: the timelog is user data restored from a backup.
for (const bad of [null, undefined, "nope", [null], [{}], [{ start: null }]]) {
  try { overlappingBlocks(blk("new", 1, 2), bad); }
  catch (e) { fails.push(`threw on ${JSON.stringify(bad)}: ${e.message}`); }
}

if (fails.length) {
  console.error("overlap guard FAILED:");
  for (const f of fails) console.error(`  - ${f}`);
  process.exit(1);
}
console.log(`overlap guard ok: ${cases.length} cases, touching blocks not flagged, self and malformed input safe`);
