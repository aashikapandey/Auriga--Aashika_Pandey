const { computeStreaks, addDays } = require('./logic.js');

function assert(cond, msg) {
  if (!cond) { console.error('FAIL:', msg); process.exitCode = 1; }
  else console.log('OK:', msg);
}

const start = '2026-09-07';
let habit = {
  createdAt: start,
  frequency: 'weekdays',
  customDays: [],
  completions: {},
  pausedPeriods: []
};

['2026-09-07','2026-09-08','2026-09-09','2026-09-11'].forEach(d => habit.completions[d] = true);

let s = computeStreaks(habit, '2026-09-11');
assert(s.current === 1, 'current streak after a Thu miss should reset to 1 (Fri only) got ' + s.current);
assert(s.best === 3, 'best streak should be 3 (Mon-Wed) got ' + s.best);

s = computeStreaks(habit, '2026-09-12');
assert(s.current === 1, 'weekend should not break weekday streak, got ' + s.current);

s = computeStreaks(habit, '2026-09-14');
assert(s.current === 1, 'ungoing today (not yet ticked) should not break streak, got ' + s.current);

habit.completions['2026-09-14'] = true;
s = computeStreaks(habit, '2026-09-14');
assert(s.current === 2, 'after ticking today streak should extend to 2, got ' + s.current);

habit.pausedPeriods.push({ start: '2026-09-15', end: '2026-09-16' });
s = computeStreaks(habit, '2026-09-17');
assert(s.current === 2, 'streak preserved across a paused period, got ' + s.current);

console.log('All checks complete.');
