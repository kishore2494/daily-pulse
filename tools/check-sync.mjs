// Run remoteSectionOk() for real against the payloads a misconfigured sync endpoint sends.
//
// applyRemoteState is the second path by which foreign data enters the store. importData was
// hardened in v237; this one checked `remote.touched` and trusted the rest. Two demonstrated
// consequences, both persisted:
//
//   remote.entries = "oops"     Object.keys() walks the STRING's indices and writes 13 junk
//                               day-keys into the journal
//   remote.tasks = "garbage"    adopted wholesale, so DB.tasks() returns a string and the next
//                               .filter() throws — the app broken by a sync
//
// The sync URL is the user's own Apps Script, so the realistic cause is a half-working endpoint,
// not an attacker. That makes it likelier, not rarer.

import { readFileSync } from "node:fs";

const src = readFileSync("app.js", "utf8");
const start = src.indexOf("function remoteSectionOk(");
if (start < 0) {
  console.error("!! remoteSectionOk() is gone from app.js — the sync path is unchecked again");
  process.exit(1);
}
let depth = 0, i = src.indexOf("{", start);
for (; i < src.length; i++) {
  if (src[i] === "{") depth++;
  else if (src[i] === "}" && --depth === 0) break;
}

/** A localStorage stub, so the real function can be run outside a browser. */
function withLocal(stored) {
  const localStorage = { getItem: (k) => (k in stored ? stored[k] : null) };
  const safeParse = (raw, fallback) => { try { return raw === null ? fallback : JSON.parse(raw); } catch { return fallback; } };
  // eslint-disable-next-line no-new-func
  return new Function("localStorage", "safeParse", `${src.slice(start, i + 1)}; return remoteSectionOk;`)(localStorage, safeParse);
}

const fails = [];
const check = (label, stored, store, value, expected) => {
  const got = withLocal(stored)(store, value);
  if (got !== expected) fails.push(`${label}: got ${got}, expected ${expected}`);
};

// A primitive is never adoptable, with or without a local value.
for (const bad of ['"garbage"', "42", "true"]) {
  check(`primitive ${bad} with a local list`, { "dp.tasks": "[]" }, "dp.tasks", JSON.parse(bad), false);
  check(`primitive ${bad} on a fresh device`, {}, "dp.tasks", JSON.parse(bad), false);
}
check("null", { "dp.tasks": "[]" }, "dp.tasks", null, false);

// A list must stay a list, and an object an object.
check("object where a list is stored", { "dp.tasks": '[{"id":1}]' }, "dp.tasks", { a: 1 }, false);
check("list where an object is stored", { "dp.finset": '{"cur":"INR"}' }, "dp.finset", [1, 2], false);
check("list replacing a list", { "dp.tasks": '[{"id":1}]' }, "dp.tasks", [{ id: 2 }], true);
check("object replacing an object", { "dp.finset": '{"cur":"INR"}' }, "dp.finset", { cur: "USD" }, true);

// A fresh device has nothing to compare against: anything non-primitive is allowed through,
// which is the whole point of the primitive rule carrying the weight there.
check("array onto a fresh device", {}, "dp.tasks", [{ id: 1 }], true);
check("object onto a fresh device", {}, "dp.finset", { cur: "INR" }, true);

// Corrupt local storage must not make the check throw or refuse everything.
check("unparseable local value", { "dp.tasks": "{not json" }, "dp.tasks", [{ id: 1 }], true);
check("local primitive", { "dp.tasks": '"was a string"' }, "dp.tasks", [{ id: 1 }], true);

// And it has to be CALLED. A correct function nobody invokes protects nothing — this repo has
// shipped that shape before. Matched as a call with an argument, not as `remoteSectionOk(` on
// its own: the declaration is `function remoteSectionOk(store, value)`, so a naive pattern
// matches the definition and passes even when every call site is gone. That is exactly what my
// first attempt at this check did.
const body = src.slice(src.indexOf("function applyRemoteState("));
const calls = [...body.matchAll(/(?<!function\s)\bremoteSectionOk\s*\(/g)].length;
if (calls < 1) {
  fails.push("applyRemoteState never calls remoteSectionOk — sections are adopted unchecked again");
}

if (fails.length) {
  console.error("sync guard FAILED:");
  for (const f of fails) console.error(`  - ${f}`);
  process.exit(1);
}
console.log("sync: remoteSectionOk rejects primitives and shape swaps, allows real sections, 13 cases");
