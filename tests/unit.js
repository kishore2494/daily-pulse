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
  ok('fmtMin under an hour drops the 0h', fmtMin(29) === '29m', fmtMin(29));

  // ---- You vs you (temporal comparison) ----
  const vSnapE = localStorage.getItem('dp.entries'), vSnapT = localStorage.getItem('dp.timelog'),
        vSnapH = localStorage.getItem('dp.health'), vSnapMode = vsMode;
  const VE = {};
  for (let i = 1; i <= 14; i++) VE[addDays(todayStr(), -i)] = { mood: i <= 7 ? 8 : 6, habits: {} };
  VE[todayStr()] = { mood: 1, habits: {} };            // a partial today that must be ignored
  localStorage.setItem('dp.entries', JSON.stringify(VE));
  localStorage.removeItem('dp.timelog'); localStorage.removeItem('dp.health');
  vsMode = 'w';
  const vw = vsPastHTML();
  ok('vs card renders', /vs-card/.test(vw));
  // 8.0, not ~7.1: today's mood of 1 must not be averaged into the recent window
  ok('vs excludes a partial today', /pm-score">8\.0/.test(vw), (vw.match(/pm-score">[^<]*/) || [])[0]);
  ok('vs shows the older window value', /vs 6\.0/.test(vw));
  ok('vs names the excluded day', /sits out of both sides/.test(vw));
  // window arithmetic: 7 days ending yesterday, and the pair before it
  const vA = vsWindow(7, 1), vB = vsWindow(7, 8);
  ok('vs window ends yesterday', vA.days[6] === addDays(todayStr(), -1), vA.days[6]);
  ok('vs windows do not overlap', vA.days[0] > vB.days[6]);
  ok('vs windows are the same length', vA.days.length === 7 && vB.days.length === 7);
  // year mode compares the same weekdays: 364 days back, not 365
  ok('vs year steps back 364 days', (VS_PERIODS.find(x => x.k === 'y') || {}).back === 364);
  ok('vs year keeps the weekday aligned',
     new Date(vsWindow(28, 1).days[0] + 'T00:00:00').getDay() ===
     new Date(vsWindow(28, 365).days[0] + 'T00:00:00').getDay());
  // direction: screen time is one of the metrics that is better DOWN
  ok('vs screen time is a down-is-better metric',
     (VS_METRICS.find(m => m.k === 'screen') || {}).dir === -1);
  ok('vs mood is an up-is-better metric', (VS_METRICS.find(m => m.k === 'mood') || {}).dir === 1);
  ok('vs time tracked takes no side', (VS_METRICS.find(m => m.k === 'tracked') || {}).dir === 0);
  // a thin log must say so rather than render an empty frame
  localStorage.setItem('dp.entries', JSON.stringify({ [todayStr()]: { mood: 7 } }));
  const vThin = vsPastHTML();
  ok('vs degrades honestly on a thin log', /more day/.test(vThin) && !/wow-row/.test(vThin));
  vsMode = vSnapMode;
  if (vSnapE != null) localStorage.setItem('dp.entries', vSnapE); else localStorage.removeItem('dp.entries');
  if (vSnapT != null) localStorage.setItem('dp.timelog', vSnapT); else localStorage.removeItem('dp.timelog');
  if (vSnapH != null) localStorage.setItem('dp.health', vSnapH); else localStorage.removeItem('dp.health');

  // ---- Fresh start (temporal landmarks) ----
  /* NOTE for future tests: overriding todayStr MUST forward its argument. addDays() calls
     todayStr(date) internally, so a stub that ignores the argument makes addDays return the
     fake "today" for every input — which silently broke this test the first time. */
  const fSnapSeen = localStorage.getItem('dp.freshSeen'), fSnapDate = logDate;
  const fReal = todayStr;
  const fFake = d => { window.todayStr = x => (x ? fReal(x) : d); };
  const fRestore = () => { window.todayStr = fReal; };
  fFake('2026-01-01');
  ok('Jan 1 is a YEAR landmark, not a month one', (freshLandmark() || {}).kind === 'year',
     JSON.stringify(freshLandmark()));
  fFake('2026-06-01');   // a Monday AND the 1st — month must win
  ok('the 1st outranks a Monday', (freshLandmark() || {}).kind === 'month',
     JSON.stringify(freshLandmark()));
  fFake('2026-08-24');
  ok('a Monday is a week landmark', (freshLandmark() || {}).kind === 'week');
  fFake('2026-08-25');
  ok('an ordinary Tuesday is no landmark', freshLandmark() === null);
  fFake('2026-08-30');
  ok('a Sunday is no landmark', freshLandmark() === null);
  // renders only on today, and only until dismissed
  fFake('2026-08-24'); localStorage.removeItem('dp.freshSeen');
  logDate = '2026-08-24';
  const fOn = freshHTML();
  ok('the landmark renders on the day', fOn !== '' && /fresh-card/.test(fOn));
  ok('the landmark carries a real number', /<b>/.test(fOn), fOn.slice(0, 120));
  ok('the landmark uses no loss framing',
     !/lose|losing|falling behind|at risk/i.test(fOn), fOn.slice(0, 200));
  logDate = addDays('2026-08-24', -7);
  ok('no landmark on a back-dated entry', freshHTML() === '');
  logDate = '2026-08-24';
  const fLm = freshLandmark();
  localStorage.setItem('dp.freshSeen', JSON.stringify({ [fLm.k]: '2026-08-24' }));
  ok('a dismissed landmark stays dismissed', freshHTML() === '');
  fRestore();
  logDate = fSnapDate;
  if (fSnapSeen != null) localStorage.setItem('dp.freshSeen', fSnapSeen); else localStorage.removeItem('dp.freshSeen');

  // ---- Custom goals ----
  const gSnapG = localStorage.getItem('dp.goals'), gSnapE2 = localStorage.getItem('dp.entries');
  ok('goals join BACKUP_KEYS', BACKUP_KEYS.includes('goals'));
  ok('goals reach the sync payload', /goals: DBgoals\(\)/.test(pushState.toString()));
  ok('goals are in the sync adopt list', /\['goals', 'dp\.goals'\]/.test(applyRemoteState.toString()));
  ok('nine measures offered free', GOAL_METRICS.length === 9, GOAL_METRICS.length);
  ok('three timeframes offered', Object.keys(GOAL_PERIODS).length === 3);
  // periods are calendar-true, not rolling
  const gW = goalWindow('w'), gM = goalWindow('m'), gY = goalWindow('y');
  ok('the week window starts on a Monday', new Date(gW.start + 'T00:00:00').getDay() === 1, gW.start);
  ok('the week window is 7 days', gW.days.length === 7);
  ok('the month window starts on the 1st', gW && gM.start.slice(8) === '01', gM.start);
  ok('the month window covers the whole month', gM.days.length === ymDays(todayStr().slice(0, 7)));
  ok('the year window is calendar-true', gY.start.slice(5) === '01-01' && gY.end.slice(5) === '12-31');
  ok('elapsed never exceeds the window', gM.elapsed <= gM.days.length && gY.elapsed <= gY.days.length);
  // progress maths
  const GE = {}; for (let i = 0; i < 7; i++) GE[addDays(todayStr(), -i)] = { mood: 7, habits: {} };
  localStorage.setItem('dp.entries', JSON.stringify(GE));
  localStorage.setItem('dp.goals', JSON.stringify([{ id: 'gu1', k: 'logged', p: 'w', n: 100, at: '' }]));
  let gP = goalProgress(DBgoals()[0]);
  ok('goal progress counts only elapsed days', gP.done === gW.elapsed, gP.done + ' vs ' + gW.elapsed);
  ok('goal progress reports the remaining gap', gP.left === 100 - gP.done);
  ok('goal per-day includes today', Math.abs(gP.perDay - gP.left / (gW.left + 1)) < 1e-9);
  ok('an unmet goal is not hit', gP.hit === false);
  // a met goal must not report a negative gap
  localStorage.setItem('dp.goals', JSON.stringify([{ id: 'gu2', k: 'logged', p: 'w', n: 1, at: '' }]));
  gP = goalProgress(DBgoals()[0]);
  ok('a met goal clamps to 100%', gP.pct === 100, gP.pct);
  ok('a met goal reports no gap', gP.left === 0 && gP.hit === true);
  // suggest comes from the user's own history, or nothing at all
  ok('suggest returns a number or null', [null].concat([goalSuggest('logged', 'w')])
     .some(v => v === null || typeof v === 'number'));
  ok('suggest on an untracked measure returns null', goalSuggest('workout', 'w') === null,
     String(goalSuggest('workout', 'w')));
  ok('an unknown measure yields no progress row', goalProgress({ id: 'x', k: 'nope', p: 'w', n: 5 }) === null);
  if (gSnapG != null) localStorage.setItem('dp.goals', gSnapG); else localStorage.removeItem('dp.goals');
  if (gSnapE2 != null) localStorage.setItem('dp.entries', gSnapE2); else localStorage.removeItem('dp.entries');

  // ---- Month in review ----
  ok('ymDays Jan', ymDays('2026-01') === 31);
  ok('ymDays Feb non-leap', ymDays('2026-02') === 28, ymDays('2026-02'));
  ok('ymDays Feb leap', ymDays('2024-02') === 29, ymDays('2024-02'));
  ok('ymPrev crosses the year', ymPrev('2026-01') === '2025-12', ymPrev('2026-01'));
  ok('ymNext crosses the year', ymNext('2026-12') === '2027-01', ymNext('2026-12'));
  ok('ymLabel is human', ymLabel('2026-07') === 'July 2026', ymLabel('2026-07'));
  const mSnapE = localStorage.getItem('dp.entries'), mSnapT = localStorage.getItem('dp.timelog');
  const ME = {}, mYM = ymPrev(ymOf(todayStr())), mTot = ymDays(mYM);
  const hK = habitCfg().filter(h => !h.hidden).map(h => h.key);
  for (let i = 1; i <= mTot; i++) {
    const hs = {}; hK.forEach(k => { hs[k] = true; });
    ME[mYM + '-' + String(i).padStart(2, '0')] = { mood: 8, energy: 7, sleepHours: 7.5, habits: hs };
  }
  localStorage.setItem('dp.entries', JSON.stringify(ME));
  localStorage.removeItem('dp.timelog');
  const MR = monthReview(mYM);
  ok('month covers every day', MR.logged === mTot && MR.coverage === 100, MR.logged + '/' + mTot);
  ok('a completed month is not partial', MR.partial === false);
  ok('month counts every habit tick', MR.ticks === mTot * hK.length, MR.ticks);
  ok('month counts perfect days', MR.perfect === mTot, MR.perfect);
  ok('month averages mood', Math.abs(MR.mood - 8) < 0.001, MR.mood);
  ok('month finds the best day', MR.best && MR.best.mood === 8);
  // the current month must declare itself partial
  const MRnow = monthReview(ymOf(todayStr()));
  ok('the running month is partial', MRnow.partial === true);
  ok('a partial month only counts elapsed days', MRnow.elapsed <= MRnow.total);
  // cards drop rather than render empty
  const mNames = mrCards(MR).map(c => c.t);
  ok('no time tracked drops the time card', !mNames.includes('Where the time went'), mNames.join(','));
  ok('month deck always has the shape card', mNames[0] === 'The month');
  ok('month deck lists habits', mNames.includes('Habits'));
  // a month with nothing logged must not divide by zero
  const MRempty = monthReview('2019-03');
  ok('an empty month does not blow up', MRempty.logged === 0 && MRempty.ticks === 0);
  ok('an empty month reports no best day', MRempty.best === null);
  if (mSnapE != null) localStorage.setItem('dp.entries', mSnapE); else localStorage.removeItem('dp.entries');
  if (mSnapT != null) localStorage.setItem('dp.timelog', mSnapT); else localStorage.removeItem('dp.timelog');

  // ---- Post-activity save ----
  const sSnapT = localStorage.getItem('dp.timelog');
  const sNow = Date.now(), sAct = allActs()[0].id;
  DB.saveTimelog([{ id: 'utA', act: sAct, start: sNow - 5400000, end: sNow - 600000, upd: sNow }]);
  ok('save sheet threshold is 2 minutes', SAVE_MIN_MS === 120000);
  saveSheetOpen('utA');
  ok('save sheet targets the block', saveState.id === 'utA');
  saveState.title = '  rewrote   the parser  '; saveState.rpe = 7; saveState.note = ' flow state ';
  saveSheetCommit();
  let sSeg = DB.timelog().find(x => x.id === 'utA');
  ok('save writes a normalised title', sSeg.t === 'rewrote the parser', sSeg.t);
  ok('save writes the effort rating', sSeg.rpe === 7);
  ok('save writes a trimmed note', sSeg.note === 'flow state', sSeg.note);
  ok('save touches upd for the sync differ', sSeg.upd >= sNow);
  // empty values must be DELETED, never stored as ''
  saveSheetOpen('utA');
  saveState.title = ''; saveState.rpe = null; saveState.note = '   ';
  saveSheetCommit();
  sSeg = DB.timelog().find(x => x.id === 'utA');
  ok('cleared title is deleted not blanked', !('t' in sSeg));
  ok('cleared effort is deleted not blanked', !('rpe' in sSeg));
  ok('cleared note is deleted not blanked', !('note' in sSeg));
  // the block must already be saved before the sheet is ever offered
  DB.saveTimelog([{ id: 'utB', act: sAct, start: sNow - 3600000, end: null, upd: sNow }]);
  startAct(sAct);
  const sEnded = DB.timelog().find(x => x.id === 'utB');
  ok('stopping ends the block regardless of the sheet', sEnded && sEnded.end != null);
  ok('a long block offers the sheet', saveState.id === 'utB', saveState.id);
  saveSheetClose();
  // a short block stops silently
  DB.saveTimelog([{ id: 'utC', act: sAct, start: Date.now() - 30000, end: null, upd: Date.now() }]);
  saveState.id = null;
  startAct(sAct);
  ok('a short block does not offer the sheet', saveState.id === null, saveState.id);
  // a title cap keeps a pasted paragraph out of the sync payload
  DB.saveTimelog([{ id: 'utD', act: sAct, start: sNow - 900000, end: sNow, upd: sNow }]);
  saveSheetOpen('utD'); saveState.title = 'x'.repeat(300); saveState.note = 'y'.repeat(900);
  saveSheetCommit();
  const sCap = DB.timelog().find(x => x.id === 'utD');
  ok('title is capped at 80', sCap.t.length === 80, sCap.t.length);
  ok('note is capped at 500', sCap.note.length === 500, sCap.note.length);
  if (sSnapT != null) localStorage.setItem('dp.timelog', sSnapT); else localStorage.removeItem('dp.timelog');

  // ---- Weekly cadence ----
  const wSnapE = localStorage.getItem('dp.entries');
  ok('weekStart maps a Sunday back to Monday', weekStart('2026-08-30') === '2026-08-24', weekStart('2026-08-30'));
  ok('weekStart is idempotent on a Monday', weekStart('2026-08-24') === '2026-08-24');
  const wTW = weekStart(todayStr()), WE = {};
  // five qualifying weeks, then only one day in the week still in progress
  for (let k = 1; k <= 5; k++) { const ws = addDays(wTW, -7 * k);
    for (let i = 0; i < 4; i++) WE[addDays(ws, i)] = { mood: 7, habits: {} }; }
  WE[wTW] = { mood: 7, habits: {} };
  localStorage.setItem('dp.entries', JSON.stringify(WE));
  let wS = weekStreak();
  ok('an unfinished week never breaks the weekly streak', wS.streak === 5, wS.streak);
  ok('an unfinished week is not banked', wS.current.ok === false);
  ok('weekly threshold is fixed at 3', wS.min === 3 && WEEK_MIN === 3);
  ok('unbanked line says how many more are needed', /more<\/b> to count it/.test(weekLineHTML()));
  // bank it
  for (let i = 0; i < 3; i++) WE[addDays(wTW, i)] = { mood: 7, habits: {} };
  localStorage.setItem('dp.entries', JSON.stringify(WE));
  wS = weekStreak();
  ok('a banked week counts toward what you see', wS.current.ok && wS.live === 6, wS.live);
  ok('banked line says the week counted', /This week counted/.test(weekLineHTML()));
  // a genuinely missed week does break it
  const WE2 = {};
  for (let k = 1; k <= 5; k++) { if (k === 3) continue; const ws = addDays(wTW, -7 * k);
    for (let i = 0; i < 4; i++) WE2[addDays(ws, i)] = { mood: 7, habits: {} }; }
  localStorage.setItem('dp.entries', JSON.stringify(WE2));
  ok('a missed week does break the weekly streak', weekStreak().streak === 2, weekStreak().streak);
  // a two-day week does not qualify
  const WE3 = {}; const ws3 = addDays(wTW, -7);
  for (let i = 0; i < 2; i++) WE3[addDays(ws3, i)] = { mood: 7, habits: {} };
  localStorage.setItem('dp.entries', JSON.stringify(WE3));
  ok('a two-day week does not qualify', weekStreak().streak === 0);
  // a malformed key must not bucket as NaN
  localStorage.setItem('dp.entries', JSON.stringify(Object.assign({ '': { mood: 5 } }, WE)));
  ok('weekBuckets ignores malformed keys', weekBuckets().every(b => /^\d{4}-\d{2}-\d{2}$/.test(b.start)));
  if (wSnapE != null) localStorage.setItem('dp.entries', wSnapE); else localStorage.removeItem('dp.entries');

  // ---- Habit cues (implementation intentions) ----
  const cSnapC = localStorage.getItem('dp.habitcfg'), cSnapDate = logDate;
  localStorage.setItem('dp.habitcfg', JSON.stringify([
    { key: 'cq', emoji: '📖', label: 'Read' }, { key: 'cw', emoji: '🏋️', label: 'Lift' }]));
  reloadCfg();
  const cH = habitCfg()[0];
  logDate = todayStr();
  // the regression that matters: with no cue the markup must be exactly what it always was
  ok('no cue leaves chip markup unchanged',
     chipTextHTML(cH) === '<span class="hlbl">' + escapeHtml(cH.label) + '</span>', chipTextHTML(cH));
  ok('habitCue is empty for an unset habit', habitCue(cH) === '');
  const cCfg = habitCfg(); cCfg[0].cue = 'after my morning coffee'; saveHabitCfg(cCfg);
  ok('cue renders on the chip', /hcue/.test(chipTextHTML(habitCfg()[0])));
  ok('cue renders its text', /after my morning coffee/.test(chipTextHTML(habitCfg()[0])));
  // a plan for a past day is noise
  logDate = addDays(todayStr(), -3);
  ok('cue is suppressed on a past day', !/hcue/.test(chipTextHTML(habitCfg()[0])));
  logDate = todayStr();
  // escaping on all three surfaces
  const cCfg2 = habitCfg(); cCfg2[0].cue = '<img src=x onerror=alert(1)> "q" & amp'; saveHabitCfg(cCfg2);
  const cH2 = habitCfg()[0];
  ok('cue escapes html on the chip', /&lt;img/.test(chipTextHTML(cH2)) && !/<img/.test(chipTextHTML(cH2)));
  ok('cue escapes html on the habits line', /&lt;img/.test(cueLineHTML(cH2)) && !/<img/.test(cueLineHTML(cH2)));
  ok('cue escapes html in the editor value', /&lt;img/.test(cueInputHTML(cH2)) && !/<img/.test(cueInputHTML(cH2)));
  // the editor row must never carry data-id, or enableDrag reorders phantom rows
  ok('cue editor row has no data-id', !/data-id/.test(cueInputHTML(cH2)));
  ok('cue editor caps length', new RegExp('maxlength="' + CUE_MAX + '"').test(cueInputHTML(cH2)));
  // empty is deleted, never stored, or every device sees habitcfg as changed
  const cCfg3 = habitCfg(); delete cCfg3[0].cue; saveHabitCfg(cCfg3);
  ok('cleared cue is deleted not blanked', !('cue' in habitCfg()[0]));
  ok('unset habit shows the plan prompt', /Plan a when/.test(cueLineHTML(habitCfg()[0])));
  logDate = cSnapDate;
  if (cSnapC != null) localStorage.setItem('dp.habitcfg', cSnapC); else localStorage.removeItem('dp.habitcfg');
  reloadCfg(); _goalMap = null;

  // ---- Awards ----
  const aSnapE = localStorage.getItem('dp.entries'), aSnapC = localStorage.getItem('dp.habitcfg'),
        aSnapA = localStorage.getItem('dp.awards'), aSnapI = localStorage.getItem('dp.awardsInit'),
        aSnapS = localStorage.getItem('dp.sampleMeta');
  localStorage.setItem('dp.habitcfg', JSON.stringify([{ key: 'w', emoji: '🏋️', label: 'W', added: '2000-01-01' }]));
  const AE = {}; for (let i = 200; i >= 0; i--) AE[addDays(todayStr(), -i)] = { mood: 7, habits: { w: true } };
  localStorage.setItem('dp.entries', JSON.stringify(AE));
  localStorage.removeItem('dp.awards'); localStorage.setItem('dp.awardsInit', '1');
  localStorage.removeItem('dp.sampleMeta');
  syncAwards();
  const aPeak = awardList().filter(a => a.grp === 'strength' && a.earned).length;
  ok('strength awards earned at peak', aPeak >= 4, aPeak);
  // decay the EMA by removing the last 10 days — earned awards must NOT be revoked
  for (let i = 0; i < 10; i++) delete AE[addDays(todayStr(), -i)];
  localStorage.setItem('dp.entries', JSON.stringify(AE));
  const aAfter = awardList().filter(a => a.grp === 'strength' && a.earned).length;
  ok('awards are never revoked', aAfter === aPeak, aPeak + ' -> ' + aAfter);
  // one stray old date must not zero habit strength
  AE['2010-01-01'] = { mood: 5, habits: {} };
  localStorage.setItem('dp.entries', JSON.stringify(AE));
  ok('a stray 2010 entry does not zero strength', bestHabitStrength() > 0, bestHabitStrength());
  // sample data must never write to the permanent ledger
  localStorage.removeItem('dp.awards');
  localStorage.setItem('dp.sampleMeta', JSON.stringify({ dates: ['x'] }));
  syncAwards();
  ok('sample data earns no real awards', Object.keys(awardLog()).length === 0);
  localStorage.removeItem('dp.sampleMeta');
  if (aSnapE != null) localStorage.setItem('dp.entries', aSnapE); else localStorage.removeItem('dp.entries');
  if (aSnapC != null) localStorage.setItem('dp.habitcfg', aSnapC); else localStorage.removeItem('dp.habitcfg');
  if (aSnapA != null) localStorage.setItem('dp.awards', aSnapA); else localStorage.removeItem('dp.awards');
  if (aSnapI != null) localStorage.setItem('dp.awardsInit', aSnapI); else localStorage.removeItem('dp.awardsInit');
  if (aSnapS != null) localStorage.setItem('dp.sampleMeta', aSnapS); else localStorage.removeItem('dp.sampleMeta');
  _goalMap = null;

  if (snapshot != null) localStorage.setItem('dp.tasks', snapshot); else localStorage.removeItem('dp.tasks');

  const summary = { pass, fail, results: R };
  console.log('UNIT TESTS: ' + pass + ' passed, ' + fail + ' failed');
  R.forEach(r => console.log(r));
  window.__testSummary = summary;
  return summary;
})();
