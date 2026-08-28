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
  // Mood is deliberately dir 0 — see the comment on VS_METRICS. A metric that IS scored:
  ok('vs sleep is an up-is-better metric', (VS_METRICS.find(m => m.k === 'sleep') || {}).dir === 1);
  ok('vs time tracked takes no side', (VS_METRICS.find(m => m.k === 'tracked') || {}).dir === 0);
  // a thin log must say so rather than render an empty frame
  localStorage.setItem('dp.entries', JSON.stringify({ [todayStr()]: { mood: 7 } }));
  const vThin = vsPastHTML();
  ok('vs degrades honestly on a thin log', /more day/.test(vThin) && !/wow-row/.test(vThin));
  vsMode = vSnapMode;
  if (vSnapE != null) localStorage.setItem('dp.entries', vSnapE); else localStorage.removeItem('dp.entries');
  if (vSnapT != null) localStorage.setItem('dp.timelog', vSnapT); else localStorage.removeItem('dp.timelog');
  if (vSnapH != null) localStorage.setItem('dp.health', vSnapH); else localStorage.removeItem('dp.health');

  // ---- Stats overview: hero + sparkline tiles ----
  ok('sparkline exists', typeof sparkline === 'function');
  ok('statTile exists', typeof statTile === 'function');
  // too few points is not a fake line
  ok('sparkline needs 2+ points', !/path/.test(sparkline([5])) && !/path/.test(sparkline([])));
  ok('sparkline draws a line and a fill', /spark-line/.test(sparkline([1,5,3,7])) && /spark-fill/.test(sparkline([1,5,3,7])));
  // nulls are bridged, not treated as zero — a gap must not fake a crash
  const spN = sparkline([6,null,6,null,6]);
  ok('sparkline bridges nulls', /spark-line/.test(spN));
  ok('a flat series does not divide by zero', /spark-line/.test(sparkline([5,5,5,5])));
  // the arrow follows the NUMBER; only the colour follows whether up is good
  const upGood = statTile({cls:'mood',label:'Mood',value:'7.0',spark:[6,7],delta:0.8,upGood:true});
  const upBad  = statTile({cls:'mood',label:'Screen',value:'7.0',spark:[6,7],delta:0.8,upGood:false});
  ok('a rise always shows an up arrow', /▲/.test(upGood) && /▲/.test(upBad));
  ok('a good rise is coloured up', /st-delta up/.test(upGood));
  ok('a bad rise is coloured down', /st-delta down/.test(upBad));
  ok('a change inside eps reads level',
     /st-delta flat/.test(statTile({cls:'mood',label:'M',value:'7.0',spark:[7,7],delta:0.01,eps:0.15})));
  ok('a missing value renders a dash, not a zero',
     statTile({ cls: 'mood', label: 'M', value: '–', spark: [] }).indexOf('>–<') !== -1);
  ok('a missing value shows no delta at all',
     !/st-delta/.test(statTile({ cls: 'mood', label: 'M', value: '–', spark: [], delta: 2 })));

  // ---- Notifications: one icon, and a live timer ----
  ok('there is a single notification icon constant', NOTIF_ICON === 'ic_stat_daylog');
  ok('the timer prefers the native live counter', /timerPlugin\(\)/.test(refreshTimerNotif.toString()));
  ok('the timer falls back with the icon set', /smallIcon: NOTIF_ICON/.test(refreshTimerNotif.toString()));
  ok('notification-button actions are drained on resume', typeof drainTimerAction === 'function');
  ok('the timer plugin is absent on the open web', timerPlugin() === null);

  // ---- Awards is its own screen, not a fifth Stats tab ----
  ok('awards is a nav destination', !!navCfg().find(n => n.k === 'awards'));
  ok('awards has a renderer', typeof RENDER.awards === 'function');
  ok('awards has a screen container', !!document.getElementById('s-awards'));
  ok('stats is back to four tabs', !/data-dashtab="awards"/.test((() => {
    const prev = dashTab; dashTab = 'overview'; renderDash();
    const h = document.getElementById('s-dash').innerHTML; dashTab = prev; return h; })()));

  // ---- One mood input, not two ----
  ok('the mood grid spans 1-10', MM_COLS[0] === 1 && MM_COLS[MM_COLS.length - 1] === 9);
  ok('the mood grid has 5 levels per axis', MM_COLS.length === 5 && MM_ROWS.length === 5);
  ok('every grid cell maps to a real quadrant',
     MM_COLS.every(m => MM_ROWS.every(e => !!MM_QUAD[mmQuad(m, e)])));
  // the grid must survive the sliders it replaced being hidden
  const gmSnapC = localStorage.getItem('dp.corecfg'), gmSnapDate = logDate;
  const gmCfg = coreCfg();
  ['mood', 'energy'].forEach(k => { const r = gmCfg.find(f => f.key === k); if (r) r.hidden = true; });
  localStorage.setItem('dp.corecfg', JSON.stringify(gmCfg));
  logDate = todayStr();
  ok('the grid survives its sliders being hidden', /mm-grid/.test(moodMeterHTML()));
  logDate = gmSnapDate;
  if (gmSnapC != null) localStorage.setItem('dp.corecfg', gmSnapC); else localStorage.removeItem('dp.corecfg');

  // ---- Only one alarm test button ----
  ok('the reminder test scaffold is gone', !/rem-test15/.test(renderSettings.toString()));

  // ---- Copy that quotes a number must match the code ----
  // Caught on a real device: What's-new said "54 awards across 8 families" after a ninth
  // family was added. Copy that states a count has to be derived or asserted, never typed.
  const awCount = awardList().length, awFams = AWARD_FAMILIES.length;
  const wnText = (WHATS_NEW.items || []).join(' ');
  const wnClaim = wnText.match(/(\d+) awards across (\d+) families/);
  ok('what\'s-new quotes the real award count', !wnClaim || +wnClaim[1] === awCount,
     wnClaim ? wnClaim[1] + ' claimed vs ' + awCount + ' actual' : 'no claim');
  ok('what\'s-new quotes the real family count', !wnClaim || +wnClaim[2] === awFams,
     wnClaim ? wnClaim[2] + ' claimed vs ' + awFams + ' actual' : 'no claim');

  // ---- Perfect days: the definition the app actually promises ----
  const pdSnapE = localStorage.getItem('dp.entries'), pdSnapC = localStorage.getItem('dp.habitcfg');
  localStorage.setItem('dp.habitcfg', JSON.stringify([
    { key: 'pa', emoji: '1', label: 'A' }, { key: 'pb', emoji: '2', label: 'B' },
    { key: 'pc', emoji: '3', label: 'C' }, { key: 'pd', emoji: '4', label: 'D' }]));
  reloadCfg(); _goalMap = null;
  const pdRun = mk => { const e = {};
    for (let i = 9; i >= 0; i--) e[addDays(todayStr(), -i)] = { mood: 7, habits: mk() };
    localStorage.setItem('dp.entries', JSON.stringify(e)); _goalMap = null;
    return (awardList().find(x => x.grp === 'perfect') || {}).cur; };
  // a habit never once tapped must COUNT AGAINST a perfect day, or the award is free
  ok('never-tapped habits break a perfect day', pdRun(() => ({ pa: true })) === 0, pdRun(() => ({ pa: true })));
  // a skip is neutral here, exactly as it is for streaks and strength
  ok('a skipped habit still allows a perfect day',
     pdRun(() => ({ pa: true, pb: true, pc: true, pd: 0 })) === 10);
  ok('all done is a perfect day', pdRun(() => ({ pa: true, pb: true, pc: true, pd: true })) === 10);
  // but a day where nothing was actually done is not perfect
  ok('all skipped is not a perfect day', pdRun(() => ({ pa: 0, pb: 0, pc: 0, pd: 0 })) === 0);
  ok('a missed habit is not a perfect day',
     pdRun(() => ({ pa: true, pb: true, pc: true, pd: false })) === 0);
  if (pdSnapE != null) localStorage.setItem('dp.entries', pdSnapE); else localStorage.removeItem('dp.entries');
  if (pdSnapC != null) localStorage.setItem('dp.habitcfg', pdSnapC); else localStorage.removeItem('dp.habitcfg');
  reloadCfg(); _goalMap = null;

  // ---- Deleting your own data ----
  ok('a wipe function exists', typeof wipeEverything === 'function');
  // Deliberately NOT two-step any more: two taps was far too little friction for something
  // with no undo. Four stages, a typed word, and an unskippable countdown.
  ok('the wipe is staged', typeof _wipeStage === 'number' && typeof wipeStageHTML === 'function');
  ok('the wipe requires a typed word', WIPE_WORD === 'DELETE');
  wipeReset();
  ok('the wipe starts disarmed', _wipeStage === 0);
  ok('stage 0 only offers to begin', /wipe-go/.test(wipeStageHTML()) && !/wipe-confirm/.test(wipeStageHTML()));
  _wipeStage = 2; _wipeCountdown = 5;
  ok('the countdown blocks stage 2', /disabled/.test(wipeStageHTML()));
  _wipeCountdown = 0;
  ok('stage 2 opens once the countdown ends', !/disabled/.test(wipeStageHTML()));
  _wipeStage = 3; _wipeTyped = 'delet';
  ok('a wrong word blocks stage 3', /disabled/.test(wipeStageHTML()));
  _wipeTyped = 'delete';
  ok('the right word opens stage 3', !/disabled/.test(wipeStageHTML()));
  _wipeStage = 4;
  ok('only stage 4 shows the final confirm', /wipe-confirm/.test(wipeStageHTML()));
  wipeReset();
  ok('reset clears the typed word too', _wipeStage === 0 && _wipeTyped === '');
  const wKeep = 'notDaylog.key';
  localStorage.setItem(wKeep, 'keep me');
  const wSnap = {};
  Object.keys(localStorage).filter(k => k.indexOf('dp.') === 0).forEach(k => { wSnap[k] = localStorage.getItem(k); });
  const wErased = wipeEverything();
  ok('the wipe erases every dp.* key', Object.keys(localStorage).filter(k => k.indexOf('dp.') === 0).length === 0);
  ok('the wipe leaves foreign keys alone', localStorage.getItem(wKeep) === 'keep me');
  ok('the wipe reports how much it erased', wErased === Object.keys(wSnap).length, wErased);
  localStorage.removeItem(wKeep);
  Object.keys(wSnap).forEach(k => localStorage.setItem(k, wSnap[k]));
  reloadCfg(); _goalMap = null;

  // ---- Empty states must not read as scores of zero ----
  ok('two celebrations do not clobber each other', /setTimeout\(\(\) => showAward/.test(showAward.toString()));

  // ---- Honesty: the app must never report success on failure ----
  ok('saveFile reports its outcome', /return 'blocked'/.test(saveFile.toString()));
  ok('saveOk treats blocked and cancel as failures',
     saveOk('shared') && saveOk('download') && saveOk('viewer') && !saveOk('blocked') && !saveOk('cancel'));
  ok('exportData only stamps a backup date on success',
     /saveOk\(r\)/.test(exportData.toString()) && /await saveFile/.test(exportData.toString()));
  // a failed write must be reportable to the caller
  const hSnapE = localStorage.getItem('dp.entries');
  const realSet = localStorage.setItem.bind(localStorage);
  localStorage.setItem = function (k, v) { if (k === 'dp.entries') throw new Error('QuotaExceeded'); return realSet(k, v); };
  const wrote = DB.saveEntries({ x: 1 });
  localStorage.setItem = realSet;
  ok('saveEntries reports a failed write', wrote === false, String(wrote));
  ok('the autosave dot is gated on the write', /wrote !== false/.test(saveDraftNow.toString()));
  if (hSnapE != null) localStorage.setItem('dp.entries', hSnapE); else localStorage.removeItem('dp.entries');
  // no invented statistics anywhere: the app has no telemetry that could produce one
  ok('no fabricated population statistic', !/3× longer|3x longer/.test(document.documentElement.innerHTML));
  // the one re-engagement nudge: no loss framing, and a real off switch
  const nudgeSrc = scheduleInactivityReminder.toString();
  ok('the nudge has an off switch', /dp\.nudgeOff/.test(nudgeSrc));
  ok('the nudge uses no loss framing',
     !/keeps your streak alive|miss you|don't lose|falling behind/i.test(nudgeSrc), nudgeSrc.slice(0, 300));
  // an opaque no-cors response must not be reported as a confirmed sync
  ok('no claim of a confirmed Sheet sync', !/Saved & synced/.test(document.documentElement.innerHTML));
  // celebrations must respect the haptics switch
  ok('celebrations route through the haptics gate', typeof buzzPattern === 'function');
  ok('buzzPattern honours dp.hapticsOff', /dp\.hapticsOff/.test(buzzPattern.toString()));
  ok('showAward does not bypass the gate', !/navigator\.vibrate/.test(showAward.toString()));
  ok('showMilestone does not bypass the gate', !/navigator\.vibrate/.test(showMilestone.toString()));
  // a backup that drops the user's own choices is not a backup
  ['logsec', 'awards', 'goals', 'freshSeen'].forEach(k =>
    ok('BACKUP_KEYS carries ' + k, BACKUP_KEYS.includes(k)));
  // mood and energy are states, never framed as performance
  ok('mood is not scored as performance', (VS_METRICS.find(m => m.k === 'mood') || {}).dir === 0);
  ok('energy is not scored as performance', (VS_METRICS.find(m => m.k === 'energy') || {}).dir === 0);
  // sample data must be labelled wherever it can be mistaken for real history
  const smSnap = localStorage.getItem('dp.sampleMeta'), smSnapE = localStorage.getItem('dp.entries');
  localStorage.setItem('dp.sampleMeta', JSON.stringify({ dates: ['x'] }));
  // Sample data means real entries in the real store — seed one so this exercises the
  // normal path, not just the empty-store early return.
  localStorage.setItem('dp.entries', JSON.stringify({ [todayStr()]: { mood: 7, habits: {} } }));
  ok('the trophy case labels sample data', /sample-bar/.test(awardsHTML()));
  localStorage.setItem('dp.entries', JSON.stringify({}));
  ok('an empty store still labels sample data', /sample-bar/.test(awardsHTML()));
  ok('sample data still writes no ledger entry', syncAwards().length === 0);
  if (smSnap != null) localStorage.setItem('dp.sampleMeta', smSnap); else localStorage.removeItem('dp.sampleMeta');
  if (smSnapE != null) localStorage.setItem('dp.entries', smSnapE); else localStorage.removeItem('dp.entries');

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
  // Seed the PREVIOUS week so the number path is what gets tested. With no prior week the
  // copy legitimately carries no number ("a clean seven days ahead"), which is a different
  // branch — assert the one that matters.
  const fSnapE = localStorage.getItem('dp.entries');
  const FE = {}; for (let i = 1; i <= 7; i++) FE[addDays('2026-08-24', -i)] = { mood: 7, habits: {} };
  localStorage.setItem('dp.entries', JSON.stringify(FE));
  logDate = '2026-08-24';
  const fOn = freshHTML();
  ok('the landmark renders on the day', fOn !== '' && /fresh-card/.test(fOn));
  ok('the landmark carries a real number', /<b>\d/.test(fOn), fOn.slice(0, 200));
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
  if (fSnapE != null) localStorage.setItem('dp.entries', fSnapE); else localStorage.removeItem('dp.entries');
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

  /* A reminder created during onboarding IS saved and IS listed in Settings — but the saved
     row and the blank add-row below it were visually identical (both time + text + button,
     both defaulting to 21:00), so it read as "my reminder never saved". These assert the two
     things that keep them distinguishable: saved rows live in their own .rem-list container,
     and a heading marks where that list ends and the add-form begins. */
  (function () {
    const rSnap = localStorage.getItem('dp.reminders');
    localStorage.setItem('dp.reminders', JSON.stringify(
      [{ id: 'remTEST1', time: '21:00', label: 'Log my day', enabled: true, mode: 'notify' }]));
    renderSettings();
    const card = [...document.querySelectorAll('#s-settings .card')]
      .find(c => /Reminders/.test((c.querySelector('h2') || {}).textContent || ''));
    ok('settings has a Reminders card', !!card);
    if (card) {
      ok('a saved reminder is listed', !!card.querySelector('[data-remid="remTEST1"]'));
      ok('saved reminder is editable (time + label inputs)',
        !!card.querySelector('[data-rem-time="remTEST1"]') && !!card.querySelector('[data-rem-label="remTEST1"]'));
      ok('saved reminder is deletable', !!card.querySelector('[data-rem-del="remTEST1"]'));
      ok('saved rows sit in their own list container', !!card.querySelector('.rem-list'));
      const h = card.querySelector('.rem-add-h');
      ok('add-form is separated by a heading', !!h && /add another/i.test(h.textContent));
      ok('saved row is not inside the add-form',
        !card.querySelector('.task-add [data-remid]'));
    }
    localStorage.removeItem('dp.reminders');
    renderSettings();
    const card2 = [...document.querySelectorAll('#s-settings .card')]
      .find(c => /Reminders/.test((c.querySelector('h2') || {}).textContent || ''));
    const h2 = card2 && card2.querySelector('.rem-add-h');
    ok('empty state says "Add a reminder", not "Add another"', !!h2 && /add a reminder/i.test(h2.textContent));
    if (rSnap != null) localStorage.setItem('dp.reminders', rSnap); else localStorage.removeItem('dp.reminders');
    renderSettings();
  })();

  /* ---- PROJECTS ---- */
  (function () {
    const pSnap = localStorage.getItem('dp.projects'), tSnap = localStorage.getItem('dp.timelog');
    const H = 3600000, now = Date.now();
    const mk = o => Object.assign({ name: 'x', status: 'active', act: '', steps: [], miles: [],
      notes: [], links: [], color: '#5570dd', created: todayStr(), prio: 2, outcome: '', due: '' }, o);

    // --- hours are exact: a block belongs to ONE project, or none ---
    const monday = (() => { const d = new Date(); d.setHours(9, 0, 0, 0);
      d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return d.getTime(); })();
    localStorage.setItem('dp.projects', JSON.stringify([mk({ id: 'pA' }), mk({ id: 'pB' })]));
    localStorage.setItem('dp.timelog', JSON.stringify([
      { id: 'b1', act: 'work', start: monday, end: monday + 2 * H, upd: 1, pid: 'pA' },
      { id: 'b2', act: 'work', start: monday + 3 * H, end: monday + 4 * H, upd: 1, pid: 'pB' },
      { id: 'b3', act: 'work', start: monday + 5 * H, end: monday + 6 * H, upd: 1 },
      { id: 'b4', act: 'work', start: monday - 7 * 24 * H, end: monday - 7 * 24 * H + 4 * H, upd: 1, pid: 'pA' },
    ]));
    ok('project hours count only tagged blocks', pjMs('pA') === 6 * H, pjMs('pA') / H);
    ok('a shared activity does not leak hours between projects', pjMs('pB') === 1 * H, pjMs('pB') / H);
    ok('an untagged block belongs to no project',
      pjMs('pA') + pjMs('pB') === 7 * H && DB.timelog().length === 4);
    ok('this-week hours exclude last week', pjWeekMs('pA') === 2 * H, pjWeekMs('pA') / H);
    const wk = pjWeeks('pA', 8);
    ok('week buckets land in the right slot', wk.length === 8 && wk[7] === 2 && wk[6] === 4, wk.join(','));

    // --- a running block counts up to now, not to zero ---
    localStorage.setItem('dp.timelog', JSON.stringify(
      [{ id: 'r1', act: 'work', start: now - 90 * 60000, end: null, upd: 1, pid: 'pA' }]));
    const runMs = pjMs('pA');
    ok('a running block counts toward its project', runMs > 88 * 60000 && runMs < 92 * 60000, runMs / 60000);

    // --- progress: no plan is NOT 0% ---
    localStorage.setItem('dp.timelog', '[]');
    ok('a project with no steps has no fake progress', pjProgress(pjNorm(mk({ id: 'p0' }))) === null);
    const pr = pjProgress(pjNorm(mk({ id: 'p0',
      steps: [{ id: 'a', done: true }, { id: 'b', done: false }], miles: [{ id: 'c', done: true }] })));
    ok('progress counts steps AND milestones', pr.done === 2 && pr.tot === 3 && pr.pct === 67, JSON.stringify(pr));

    // --- health badges, worst-first ---
    const H2 = p => pjHealth(pjNorm(p)).k;
    const openStep = [{ id: 's', text: 'a', done: false }];
    ok('overdue beats everything', H2(mk({ id: '1', due: addDays(todayStr(), -5), steps: openStep })) === 'overdue');
    ok('due within 3 days warns', H2(mk({ id: '2', due: addDays(todayStr(), 2), steps: openStep })) === 'due');
    ok('an active project untouched a week is stalled',
      H2(mk({ id: '3', steps: openStep, notes: [{ id: 'n', at: now - 12 * 86400000, text: 'x' }] })) === 'stalled');
    ok('recent work is on track',
      H2(mk({ id: '4', steps: openStep, notes: [{ id: 'n', at: now - 2 * 86400000, text: 'x' }] })) === 'on');
    /* Paused deliberately outranks overdue: you put it down on purpose, so nagging about a
       date you already chose to miss would be wrong. */
    ok('paused is not reported as overdue',
      H2(mk({ id: '5', status: 'paused', due: addDays(todayStr(), -9), steps: openStep })) === 'paused');
    ok('a finished project is never overdue',
      H2(mk({ id: '6', status: 'done', due: addDays(todayStr(), -9), steps: openStep })) === 'done');
    ok('all steps done clears an overdue flag',
      H2(mk({ id: '7', due: addDays(todayStr(), -5), steps: [{ id: 's', done: true, doneAt: now }] })) !== 'overdue');

    // --- startAct tags, and switches project on the same activity ---
    localStorage.setItem('dp.timelog', '[]');
    startAct('work', 'pA');
    const first = runningSeg();
    ok('startAct tags the new block with the project', first && first.pid === 'pA');
    ok('two blocks made in the same millisecond get different ids',
      new Set(DB.timelog().map(x => x.id)).size === DB.timelog().length);
    startAct('work', 'pB');
    const second = runningSeg();
    ok('same activity for another project opens a NEW block', second && second.id !== first.id && second.pid === 'pB');
    ok('the previous project\'s block was closed, keeping its own pid',
      DB.timelog().find(x => x.id === first.id).end != null &&
      DB.timelog().find(x => x.id === first.id).pid === 'pA');
    startAct('work', 'pB');
    ok('same activity AND same project stops the timer', runningSeg() == null);
    startAct('work');
    ok('an untagged start carries no pid', !('pid' in runningSeg()));
    localStorage.setItem('dp.timelog', '[]');

    // --- the screen renders, and reaches the detail view ---
    localStorage.setItem('dp.projects', JSON.stringify([mk({ id: 'pS', name: 'Screen test', steps: openStep })]));
    const before = pjOpen; pjOpen = null;
    renderProjects();
    const el = document.getElementById('s-projects');
    ok('projects screen renders a card per project', !!el.querySelector('[data-pj-open="pS"]'));
    ok('projects screen has a create button', !!document.getElementById('pj-add-open'));
    pjOpen = 'pS'; renderProjects();
    ok('detail view renders', !!document.getElementById('pj-back') && !!document.getElementById('pj-timer'));
    ok('detail view has a back button, milestones, steps, log and links',
      ['pj-mile-add', 'pj-step-add', 'pj-note-add', 'pj-link-add', 'pj-del'].every(i => !!document.getElementById(i)));
    ok('timer button is disabled until an activity is picked', document.getElementById('pj-timer').disabled);
    pjOpen = before;

    // --- Projects is reachable from the nav ---
    ok('projects is a nav destination', !!navCfg().find(n => n.k === 'projects'));
    ok('projects has a render function', typeof RENDER.projects === 'function');
    ok('projects is backed up', BACKUP_KEYS.includes('projects'));

    if (pSnap != null) localStorage.setItem('dp.projects', pSnap); else localStorage.removeItem('dp.projects');
    if (tSnap != null) localStorage.setItem('dp.timelog', tSnap); else localStorage.removeItem('dp.timelog');
  })();

  /* ---- GAP FILLER ---- */
  (function () {
    const tSnap = localStorage.getItem('dp.timelog'), sSnap = localStorage.getItem('dp.gapskip');
    const H = 3600000;
    // Weekdays: work 09-12 and 13-17. Weekends: reading 09-12. Every night: sleep 22-06:30.
    const build = () => {
      const log = [];
      for (let i = 2; i <= 42; i++) {
        const ds = addDays(todayStr(), -i), b0 = new Date(ds + 'T00:00:00').getTime();
        const wknd = [0, 6].includes(new Date(ds + 'T00:00:00').getDay());
        log.push({ id: 'a' + i, act: 'sleep', start: b0 - 2 * H, end: b0 + 6.5 * H, upd: 1 });
        log.push({ id: 'b' + i, act: wknd ? 'read' : 'work', start: b0 + 9 * H, end: b0 + 12 * H, upd: 1 });
        if (!wknd) log.push({ id: 'c' + i, act: 'work', start: b0 + 13 * H, end: b0 + 17 * H, upd: 1 });
      }
      return log;
    };
    const pastDay = wantWeekend => {
      for (let i = 1; i < 40; i++) {
        const ds = addDays(todayStr(), -i);
        if (gapIsWeekend(ds) === wantWeekend) return ds;
      }
    };
    localStorage.removeItem('dp.gapskip');

    // --- a weekday with two tracked blocks leaves gaps, split where the guess changes ---
    const wd = pastDay(false), wb = new Date(wd + 'T00:00:00').getTime();
    let log = build();
    log.push({ id: 'y1', act: 'sleep', start: wb - 2 * H, end: wb + 6.5 * H, upd: 1 });
    log.push({ id: 'y2', act: 'gym', start: wb + 12 * H, end: wb + 13 * H, upd: 1 });
    localStorage.setItem('dp.timelog', JSON.stringify(log));

    const raw = gapsRaw(wd);
    ok('a day with two tracked blocks has two raw gaps', raw.length === 2, raw.length);
    const rows = gapSegments(wd);
    /* The clamp loop used to iterate every row accumulated so far, re-clamping the FIRST
       gap's rows to the SECOND gap's bounds and inverting them, so with two gaps in a day
       only the last one was ever offered. */
    ok('rows come from every gap, not just the last one',
      rows.some(r => r.a < wb + 12 * H) && rows.some(r => r.a >= wb + 13 * H));
    ok('every row is at least the minimum length', rows.every(r => r.b - r.a >= GAP_MIN_MS));
    ok('no row overlaps a tracked block',
      rows.every(r => !segsForDay(wd).some(x => Math.min(x.b, r.b) - Math.max(x.a, r.a) > 0)));
    ok('rows never overlap each other',
      rows.every((r, i) => rows.slice(i + 1).every(o => Math.min(o.b, r.b) - Math.max(o.a, r.a) <= 0)));

    const at = h => rows.find(r => r.a === wb + h * H);
    ok('09:00 on a weekday is guessed as work', at(9) && at(9).pred.act === 'work',
      at(9) && at(9).pred.act);
    ok('13:00 on a weekday is guessed as work', at(13) && at(13).pred.act === 'work');
    ok('a window with no history gets no guess', at(6.5) ? at(6.5).pred.act === null : true);
    ok('a named guess always carries its support',
      rows.filter(r => r.pred.act).every(r => r.pred.days >= GAP_MIN_DAYS && r.pred.sampleDays >= r.pred.days));
    ok('a named guess always meets the share floor',
      rows.filter(r => r.pred.act).every(r => r.pred.share >= GAP_MIN_SHARE));

    // --- the weekday/weekend split is the whole point ---
    const we = pastDay(true), eb = new Date(we + 'T00:00:00').getTime();
    log = build().filter(s => !(s.start < eb + 86400000 && s.end > eb + 7 * H));
    log.push({ id: 'w1', act: 'sleep', start: eb - 2 * H, end: eb + 6.5 * H, upd: 1 });
    localStorage.setItem('dp.timelog', JSON.stringify(log));
    const wrows = gapSegments(we);
    const w9 = wrows.find(r => r.a === eb + 9 * H);
    ok('09:00 on a weekend is guessed as reading, not work', w9 && w9.pred.act === 'read',
      w9 && w9.pred.act);
    ok('the weekend guess says it used weekend days', w9 && w9.pred.basis === 'weekend days');

    // --- never nag about the future ---
    ok('today\'s gaps never run past now', gapSegments(todayStr()).every(r => r.b <= Date.now() + 2000));

    // --- accepting writes exactly the offered range, and the row then disappears ---
    localStorage.setItem('dp.timelog', JSON.stringify(log));
    const target = gapSegments(we).find(r => r.pred.act);
    const before = DB.timelog().length;
    const savedTtDate = ttDate;
    gapFill(we, target.a, target.b, target.pred.act);
    const added = DB.timelog().find(s => s.start === target.a && s.end === target.b);
    ok('accepting a guess writes one block over exactly that range',
      !!added && added.act === target.pred.act && DB.timelog().length === before + 1);
    ok('the filled range is no longer offered', !gapSegments(we).some(r => r.a === target.a));

    // --- leaving blank is remembered ---
    const next = gapSegments(we)[0];
    gapSkip(we, next.a);
    ok('leave-blank is remembered', !gapSegments(we).some(r => r.a === next.a));
    ok('leave-blank does not silence a different day',
      !gapSkipped(addDays(we, -1), next.a));
    ok('gap skips are backed up', BACKUP_KEYS.includes('gapskip'));

    // --- an empty log must not manufacture questions ---
    localStorage.setItem('dp.timelog', '[]');
    ok('no history means no rows at all', gapSegments(addDays(todayStr(), -1)).length === 0);
    /* One tracked day is not a pattern. Without this floor the card appeared on every past
       day of a fresh install asking "00:00-24:00, what were you doing?" */
    const oneDay = addDays(todayStr(), -3), ob = new Date(oneDay + 'T00:00:00').getTime();
    localStorage.setItem('dp.timelog', JSON.stringify(
      [{ id: 'o1', act: 'work', start: ob + 9 * H, end: ob + 10 * H, upd: 1 }]));
    ok('a single tracked day is not enough to start guessing',
      gapSegments(addDays(todayStr(), -1)).length === 0);

    /* A wholly untracked day is one 24h gap; only windows history can actually name are
       offered, so it never becomes a single useless "what were you doing all day?" row. */
    const blank = pastDay(false), bb = new Date(blank + 'T00:00:00').getTime();
    localStorage.setItem('dp.timelog', JSON.stringify(build().filter(x =>
      !(x.end > bb && x.start < bb + 86400000))));
    localStorage.removeItem('dp.gapskip');
    const brows = gapSegments(blank);
    ok('an untracked day offers only windows with a real guess',
      brows.length > 0 && brows.every(r => !!r.pred.act), brows.length);

    ttDate = savedTtDate;
    if (tSnap != null) localStorage.setItem('dp.timelog', tSnap); else localStorage.removeItem('dp.timelog');
    if (sSnap != null) localStorage.setItem('dp.gapskip', sSnap); else localStorage.removeItem('dp.gapskip');
  })();

  if (snapshot != null) localStorage.setItem('dp.tasks', snapshot); else localStorage.removeItem('dp.tasks');

  const summary = { pass, fail, results: R };
  console.log('UNIT TESTS: ' + pass + ' passed, ' + fail + ' failed');
  R.forEach(r => console.log(r));
  window.__testSummary = summary;
  return summary;
})();
