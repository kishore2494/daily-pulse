/* Eval seed. Deliberately adversarial: long habit labels, a skipped habit, a quantity
   habit with a unit, and a big streak number — the combinations that overflow chips. */
(function () {
  const t = todayStr(), e = {};
  const cfg = [
    { key: 'workout',     emoji: '🏋️', label: 'Workout' },
    { key: 'meditation',  emoji: '🧘', label: 'Meditation' },
    { key: 'reading',     emoji: '📖', label: 'Read 20 pages before bed', goal: { n: 20, cmp: 'atleast', unit: 'pages' } },
    { key: 'healthyFood', emoji: '🥗', label: 'Healthy food' },
    { key: 'noPhone',     emoji: '📵', label: 'No phone in the first hour', custom: true },
    { key: 'water',       emoji: '💧', label: 'Water', custom: true, goal: { n: 8, cmp: 'atleast', unit: 'glasses' } },
    { key: 'coffee',      emoji: '☕', label: 'Coffee', custom: true, goal: { n: 2, cmp: 'atmost', unit: 'cups' } },
  ];
  localStorage.setItem('dp.habitcfg', JSON.stringify(cfg));
  for (let i = 200; i >= 0; i--) {
    const d = addDays(t, -i), w = i % 7 !== 2;
    e[d] = { mood: 4 + (i % 6), energy: 4 + (i % 5), sleepHours: 6.5 + (i % 4) * 0.3,
      deepWork: 2 + (i % 3), screenTime: 3 + (i % 4),
      tasksDone: 2 + (i % 4), tasksPlanned: 5,
      journal: i % 5 === 0 ? 'A reasonably long journal entry with #tags to exercise wrapping.' : '',
      habits: { workout: w, meditation: i % 3 !== 0, reading: 14 + (i % 9),
                healthyFood: true, noPhone: i % 9 === 0 ? 0 : (i % 4 !== 0),
                water: 5 + (i % 4), coffee: i % 5 } };
  }
  e[t].habits.noPhone = 0;             // a SKIPPED chip must be on screen
  e[t].habits.workout = true;
  localStorage.setItem('dp.entries', JSON.stringify(e));
  const hs = {}, tl = [];
  for (let i = 30; i >= 0; i--) {
    const d = addDays(t, -i), d0 = new Date(d + 'T00:00:00').getTime();
    hs[d] = { steps: 6000 + i * 40, distanceKm: 4.3, calories: 2100, sleepMin: 420,
              exerciseMin: 30, hr: 66, screenMin: 200 + i, at: new Date().toISOString() };
    tl.push({ id: 'ev' + i + 'a', act: 'sleep', start: d0 - 3e6, end: d0 + 2.4e7, upd: d0 });
    tl.push({ id: 'ev' + i + 'b', act: 'work', start: d0 + 3.4e7, end: d0 + 4.4e7, upd: d0 });
  }
  localStorage.setItem('dp.health', JSON.stringify(hs));
  localStorage.setItem('dp.timelog', JSON.stringify(tl));
  localStorage.setItem('dp.tasks', JSON.stringify([
    { id: 'e1', text: 'A task with a deliberately long title to test wrapping and clipping', done: false, date: t },
    { id: 'e2', text: 'Short task', done: true, date: t }]));
  return 'eval seed ok';
})();
