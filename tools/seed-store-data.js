/* Seed realistic-looking data for Play Store screenshots.
   Rules learned the hard way:
   - insights must come out POSITIVE (a screenshot saying "workout drags your mood" is bad copy)
   - suppress the backup nudge, what's-new popup, onboarding and the tour, or they cover the shot
   - include SKIPPED habit days so the new three-state chip and heatmap tile are visible */
(function () {
  const t = todayStr(), e = {};
  const HAB = ['workout', 'meditation', 'reading', 'healthyFood'];
  const N = 400;                                   // a FULL year, so 'Year in pixels' is full
  // pass 1 - decide workout days (5 of every 7)
  const w = {};
  for (let i = N - 1; i >= 0; i--) w[i] = (i % 7 !== 2 && i % 7 !== 5);
  // pass 2 - mood carries over: a workout lifts today AND tomorrow, so the next-day
  // insight comes out positive (a screenshot must never read "workout drags your mood")
  for (let i = N - 1; i >= 0; i--) {
    const d = addDays(t, -i);
    const wToday = w[i], wPrev = !!w[i + 1];        // i+1 is the PREVIOUS day
    const mood   = 4.6 + (wToday ? 1.7 : 0) + (wPrev ? 1.5 : 0) + ((i % 3) - 1) * 0.3;
    const energy = 4.4 + (wToday ? 1.9 : 0) + (wPrev ? 1.3 : 0) + ((i % 4) - 1) * 0.3;
    const sleep  = (wToday ? 7.6 : 6.2) + ((i % 3) - 1) * 0.2;
    const hab = {};
    HAB.forEach((k, j) => {
      const r = (i + j * 5) % 11;
      hab[k] = r === 0 ? 0 : (r === 7 ? false : true);   // 0 = skipped, false = a real miss
    });
    hab.workout = wToday ? true : (i % 14 === 0 ? 0 : false);
    e[d] = {
      mood: Math.max(3, Math.min(10, Math.round(mood))),
      energy: Math.max(3, Math.min(10, Math.round(energy))),
      sleepHours: Math.round(sleep * 10) / 10,
      deepWork: wToday ? 3 + (i % 3) * 0.5 : 2,
      screenTime: wToday ? 3.1 + (i % 4) * 0.2 : 5.4 + (i % 3) * 0.3,
      habits: hab,
      tasksDone: 3 + (i % 4), tasksPlanned: 5 + (i % 3),
      win: i % 5 === 0 ? 'Shipped the thing I kept postponing.' : '',
      journal: i === 7
        ? 'Finally finished the book I had been putting off for months. Long run this morning too - felt strong all day. #proud #focused'
        : (i === 30 ? 'Slow month but the streak held. #calm' : (i % 6 === 0 ? 'Good day. #grateful' : '')),
    };
  }
  // leave one gap ~185 days back: a 400-day unbroken streak reads as fake in a store
  // screenshot, and one grey pixel in the year mosaic is barely visible.
  delete e[addDays(t, -186)];
  e[t].mood = 8; e[t].energy = 8;
  e[t].journal = 'Long run, then deep work until noon. #energised #proud';
  localStorage.setItem('dp.entries', JSON.stringify(e));
  // today: a filled-in log that shows the mood grid selected
  const today = e[t]; today.mood = 8; today.energy = 8; today.journal = 'Long run, then deep work until noon. #energised #proud';
  e[t] = today; localStorage.setItem('dp.entries', JSON.stringify(e));

  // ---- health store: screen time / steps / sleep for the whole range, so the
  // Health tab charts are full instead of showing "nothing synced yet" ----
  const hs = {};
  for (let i = N - 1; i >= 0; i--) {
    const d = addDays(t, -i), wToday = w[i];
    const steps    = wToday ? 9200 + (i % 5) * 420 : 4600 + (i % 6) * 300;
    const screenMin= wToday ? 175 + (i % 5) * 12 : 322 + (i % 7) * 14;
    const sleepMin = Math.round((e[d].sleepHours || 7) * 60);
    hs[d] = { steps, distanceKm: +(steps * 0.00072).toFixed(2), calories: 1750 + Math.round(steps * 0.06),
      sleepMin, exerciseMin: wToday ? 42 + (i % 4) * 6 : 11 + (i % 5),
      hr: 63 + (i % 9), screenMin, at: new Date().toISOString() };
  }
  localStorage.setItem('dp.health', JSON.stringify(hs));

  // ---- timelog: a night of sleep + two deep-work blocks + gym per day, so the
  // 24-hour timeline has something to draw ----
  const tl = [];
  for (let i = 20; i >= 0; i--) {
    const d = addDays(t, -i), d0 = new Date(d + 'T00:00:00').getTime();
    const id = 'shot' + d.replace(/-/g, '');
    tl.push({ id: id + 'a', act: 'sleep', start: d0 - 42 * 60000, end: d0 + (6 * 60 + 48) * 60000, upd: d0 });
    tl.push({ id: id + 'b', act: 'work',  start: d0 + 9.4 * 3.6e6, end: d0 + 12.3 * 3.6e6, upd: d0 });
    tl.push({ id: id + 'c', act: 'work',  start: d0 + 14.1 * 3.6e6, end: d0 + 16.7 * 3.6e6, upd: d0 });
    if (w[i]) tl.push({ id: id + 'd', act: 'gym', start: d0 + 18.2 * 3.6e6, end: d0 + 19.3 * 3.6e6, upd: d0 });
    tl.push({ id: id + 'e', act: 'eating', start: d0 + 13 * 3.6e6, end: d0 + 13.7 * 3.6e6, upd: d0 });
  }
  tl.sort((a, b) => a.start - b.start);
  localStorage.setItem('dp.timelog', JSON.stringify(tl));

  // pomodoro history so the Focus stats aren't empty
  const ph = {};
  for (let i = 30; i >= 0; i--) ph[addDays(t, -i)] = 2 + (i % 5);
  localStorage.setItem('dp.pomohist', JSON.stringify(ph));

  // quiet everything that would cover a screenshot
  localStorage.setItem('dp.onboarded', '1');
  localStorage.setItem('dp.tourDone', '1');
  localStorage.setItem('dp.whatsnew', WHATS_NEW.v);
  localStorage.setItem('dp.lastBackup', String(Date.now()));
  localStorage.setItem('dp.backupNudge', String(Date.now()));
  localStorage.removeItem('dp.throwbackOff');
  localStorage.removeItem('dp.moodMeterOff');
  return 'seeded ' + Object.keys(e).length + ' days · health ' + Object.keys(hs).length + ' · timelog ' + tl.length;
})();
