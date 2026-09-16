function isPaused(habit, dateStr) {
  return (habit.pausedPeriods || []).some(p => dateStr >= p.start && (p.end === null || dateStr <= p.end));
}

function isScheduled(habit, dateStr) {
  if (dateStr < habit.createdAt) return false;
  if (isPaused(habit, dateStr)) return false;
  const day = new Date(dateStr + 'T00:00:00').getDay();
  if (habit.frequency === 'daily') return true;
  if (habit.frequency === 'weekdays') return day >= 1 && day <= 5;
  if (habit.frequency === 'custom') return (habit.customDays || []).includes(day);
  return false;
}

function addDays(dateStr, n) {
  const d = new Date(dateStr + 'T00:00:00');
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

function scheduledDatesUpTo(habit, endDateStr) {
  const dates = [];
  let d = habit.createdAt;
  while (d <= endDateStr) {
    if (isScheduled(habit, d)) dates.push(d);
    d = addDays(d, 1);
  }
  return dates;
}

function computeStreaks(habit, todayStr) {
  const dates = scheduledDatesUpTo(habit, todayStr);
  const doneFlags = dates.map(ds => !!habit.completions[ds]);

  let best = 0, run = 0;
  for (const f of doneFlags) {
    if (f) { run++; best = Math.max(best, run); }
    else run = 0;
  }

  let list = doneFlags.slice();
  if (dates.length && dates[dates.length - 1] === todayStr && !doneFlags[doneFlags.length - 1]) {
    list = doneFlags.slice(0, -1);
  }
  let current = 0;
  for (let i = list.length - 1; i >= 0; i--) {
    if (list[i]) current++; else break;
  }
  return { current, best };
}

module.exports = { isScheduled, computeStreaks, addDays, scheduledDatesUpTo };
