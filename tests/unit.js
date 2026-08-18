/* Daylog — unit tests for the pure logic.
   Run: load index.html in a browser, then in the console:  fetch('tests/unit.js').then(r=>r.text()).then(eval)
   (or the headless harness injects it). Tests the REAL app functions, not copies.
   Returns a {pass, fail, results[]} summary and logs it. */
(function () {
  const R = [];
  let pass = 0, fail = 0;
  const approx = (a, b, e = 0.001) => Math.abs(a - b) <= e;
  function ok(name, cond, got) {
    if (cond) { pass++; R.push('PASS ' + name); }
    else { fail++; R.push('FAIL ' + name + (got !== undefined ? ' → got ' + JSON.stringify(got) : '')); }
  }
  const snapshot = localStorage.getItem('dp.tasks');   // we mutate tasks; restore after

  // ---- time/duration math ----
  ok('hoursToHM 7.5 → 07:30', hoursToHM(7.5) === '07:30', hoursToHM(7.5));
  ok('hoursToHM 0 → 00:00', hoursToHM(0) === '00:00', hoursToHM(0));
  ok('hoursToHM empty → ""', hoursToHM('') === '', hoursToHM(''));
  ok('hmToHours 07:30 → 7.5', hmToHours('07:30') === 7.5, hmToHours('07:30'));
  ok('hmToHours bad → ""', hmToHours('nope') === '', hmToHours('nope'));
  ok('hours round-trip', hmToHours(hoursToHM(6.25)) === 6.25, hmToHours(hoursToHM(6.25)));

  // ---- sleep bed→wake (cross-midnight) ----
  ok('bedwake 23:00→06:30 = 7.5', bedwakeHours('23:00', '06:30') === 7.5, bedwakeHours('23:00', '06:30'));
  ok('bedwake 01:00→09:00 = 8', bedwakeHours('01:00', '09:00') === 8, bedwakeHours('01:00', '09:00'));
  ok('bedwake 22:15→06:45 = 8.5', bedwakeHours('22:15', '06:45') === 8.5, bedwakeHours('22:15', '06:45'));
  ok('bedwake missing → ""', bedwakeHours('', '06:00') === '', bedwakeHours('', '06:00'));

  // ---- emoji split ----
  ok('emojiSplit "🍳 Cooking"', (() => { const e = emojiSplit('🍳 Cooking'); return e.emoji === '🍳' && e.name === 'Cooking'; })());
  ok('emojiSplit plain → ⭐', (() => { const e = emojiSplit('Reading'); return e.emoji === '⭐' && e.name === 'Reading'; })());

  // ---- fmtDur ----
  ok('fmtDur 90min', fmtDur(90 * 60000) === '1h 30m', fmtDur(90 * 60000));
  ok('fmtDur 0', typeof fmtDur(0) === 'string');

  // ---- date helpers ----
  ok('addDays +1/-1 inverse', addDays(addDays('2026-01-15', 1), -1) === '2026-01-15', addDays(addDays('2026-01-15', 1), -1));
  ok('addDays crosses month', addDays('2026-01-31', 1) === '2026-02-01', addDays('2026-01-31', 1));
  ok('todayStr format', /^\d{4}-\d{2}-\d{2}$/.test(todayStr()), todayStr());

  // ---- taskCounts (seed tasks) ----
  const T = todayStr(), Y = addDays(T, -1);
  DB.saveTasks([
    { id: 'a', text: 'x', done: false, created: T },              // planned today
    { id: 'b', text: 'y', done: true, doneDate: T, created: T },  // done today
    { id: 'c', text: 'z', done: true, doneDate: Y, created: Y },  // done yesterday
  ]);
  const tcT = taskCounts(T);
  ok('taskCounts today planned=2', tcT.planned === 2, tcT);
  ok('taskCounts today done=1', tcT.done === 1, tcT);
  const tcY = taskCounts(Y);
  ok('taskCounts yesterday done=1', tcY.done === 1, tcY);

  // ---- polymath 0..100 ----
  const pm = polymath({ mood: 8, energy: 7, sleepHours: 7.5, deepWorkHours: 4, habits: { workout: true } });
  ok('polymath returns 0..100', pm && pm.total >= 0 && pm.total <= 100, pm && pm.total);
  ok('polymath null on empty', polymath(null) === null);

  // ---- barChart ----
  ok('barChart empty → placeholder', /No data|empty/i.test(barChart([{ x: 'a', y: null }], '#000')));
  ok('barChart draws svg', /<svg/.test(barChart([{ x: 'a', y: 5 }], '#000', { max: 10 })));

  // ---- coreCfg backfill flags ----
  const cc = coreCfg();
  ok('coreCfg sleep has bedwake', !!(cc.find(f => f.key === 'sleepHours') || {}).bedwake);
  ok('coreCfg deepwork has dur', !!(cc.find(f => f.key === 'deepWorkHours') || {}).dur);

  // ---- safeParse (corruption-proof storage) ----
  ok('safeParse valid', safeParse('{"a":1}', {}).a === 1);
  ok('safeParse corrupt → fallback', safeParse('{corrupt', 'FB') === 'FB');
  ok('safeParse null → fallback', safeParse(null, 42) === 42);
  ok('safeParse "null" → fallback', safeParse('null', 7) === 7);

  // ---- pearson correlation ----
  ok('pearson perfect +1', approx(pearson([[1, 2], [2, 4], [3, 6], [4, 8]]), 1));
  ok('pearson perfect -1', approx(pearson([[1, 8], [2, 6], [3, 4], [4, 2]]), -1));
  ok('pearson no variance → null', pearson([[1, 5], [2, 5], [3, 5]]) === null);
  ok('pearson tiny n → null', pearson([[1, 1], [2, 2]]) === null);

  // ---- snippet (search highlighting) ----
  ok('snippet highlights match', snippet('hello quarterly world', 'quarterly').includes('<b>quarterly</b>'));
  ok('snippet escapes html', !snippet('<img src=x> quarterly', 'quarterly').includes('<img'));
  ok('snippet truncates long text', snippet('x'.repeat(200) + ' quarterly ' + 'y'.repeat(200), 'quarterly').startsWith('…'));

  // ---- bestHabitStreak (seeded entries) ----
  const entSnap = localStorage.getItem('dp.entries');
  const E = {};
  ['2026-01-01', '2026-01-02', '2026-01-03', '2026-01-05', '2026-01-06'].forEach(d => { E[d] = { habits: { workout: true } }; });
  localStorage.setItem('dp.entries', JSON.stringify(E));
  ok('bestHabitStreak finds 3-run', bestHabitStreak('workout') === 3, bestHabitStreak('workout'));
  ok('bestHabitStreak unknown habit 0', bestHabitStreak('nope') === 0);

  // ---- trackedSleepHours (full night ending on date, no midnight clip) ----
  const tlSnap = localStorage.getItem('dp.timelog');
  const d0 = new Date('2026-01-10T00:00:00').getTime();
  localStorage.setItem('dp.timelog', JSON.stringify([
    { id: 'a', act: 'sleep', start: d0 - 3600000, end: d0 + 6 * 3600000, upd: 1 },      // 23:00→06:00 = 7h, ends Jan 10
    { id: 'b', act: 'sleep', start: d0 + 14 * 3600000, end: d0 + 15 * 3600000, upd: 1 } // 1h nap same day
  ]));
  ok('trackedSleepHours full night + nap', trackedSleepHours('2026-01-10') === 8, trackedSleepHours('2026-01-10'));
  ok('trackedSleepHours other day null', trackedSleepHours('2026-01-11') === null);
  ok('trackedHours ended-only (running excluded)', (() => {
    localStorage.setItem('dp.timelog', JSON.stringify([{ id: 'r', act: 'work', start: Date.now() - 3600000, end: null, upd: 1 }]));
    return trackedHours(todayStr(), 'work') === null;
  })());
  if (tlSnap != null) localStorage.setItem('dp.timelog', tlSnap); else localStorage.removeItem('dp.timelog');
  if (entSnap != null) localStorage.setItem('dp.entries', entSnap); else localStorage.removeItem('dp.entries');

  // ---- pattern-mining helpers ----
  ok('dpMedian odd', dpMedian([3, 1, 2]) === 2);
  ok('dpMedian even', dpMedian([1, 2, 3, 4]) === 2.5);
  ok('dpMedian empty → null', dpMedian([]) === null);
  ok('dpStd known', approx(dpStd([2, 4, 4, 4, 5, 5, 7, 9]), 2.138, 0.01), dpStd([2, 4, 4, 4, 5, 5, 7, 9]));
  ok('dpSlope up', approx(dpSlope([1, 2, 3, 4, 5]), 1));
  ok('dpSlope flat', approx(dpSlope([4, 4, 4, 4, 4]), 0));
  ok('dpSlope tiny n → null', dpSlope([1, 2]) === null);

  // ---- computePatterns on crafted data ----
  const pSnapE = localStorage.getItem('dp.entries'), pSnapT = localStorage.getItem('dp.timelog'), pSnapH = localStorage.getItem('dp.health');
  const PE = {};
  for (let i = 1; i <= 12; i++) {
    const d = addDays(todayStr(), -i);
    const good = i % 2 === 0;   // alternate good sleep+workout days vs short-sleep no-workout
    PE[d] = { mood: good ? 8 : 5, energy: good ? 8 : 5, sleepHours: good ? 7.5 : 5.5, habits: { workout: good } };
  }
  localStorage.setItem('dp.entries', JSON.stringify(PE));
  localStorage.removeItem('dp.timelog'); localStorage.removeItem('dp.health');
  const pats = computePatterns();
  ok('patterns found', pats.length >= 2, pats.length);
  ok('sleep sweet spot detected', pats.some(p => /sleep sweet spot/i.test(p.head)), pats.map(p => p.head).join('|'));
  ok('habit lift detected', pats.some(p => /lifts your mood/i.test(p.head)));
  ok('patterns escape labels', !pats.some(p => /<img|onerror/i.test(p.head)));
  if (pSnapE != null) localStorage.setItem('dp.entries', pSnapE); else localStorage.removeItem('dp.entries');
  if (pSnapT != null) localStorage.setItem('dp.timelog', pSnapT); else localStorage.removeItem('dp.timelog');
  if (pSnapH != null) localStorage.setItem('dp.health', pSnapH); else localStorage.removeItem('dp.health');

  // ---- fmtMin ----
  ok('fmtMin 445 → 7h25m', fmtMin(445) === '7h25m', fmtMin(445));
  ok('fmtMin null → null', fmtMin(null) === null);

  if (snapshot != null) localStorage.setItem('dp.tasks', snapshot); else localStorage.removeItem('dp.tasks');

  const summary = { pass, fail, results: R };
  console.log('UNIT TESTS: ' + pass + ' passed, ' + fail + ' failed');
  R.forEach(r => console.log(r));
  window.__testSummary = summary;
  return summary;
})();
