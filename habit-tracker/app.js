// ---------- Storage ----------
const STORAGE_KEY = 'habitTrackerData_v1';

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

function loadData() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (raw) {
    try { return JSON.parse(raw); } catch (e) { console.error('Corrupt data, resetting', e); }
  }
  const fresh = { challengeStart: todayStr(), challengeLength: 75, habits: [] };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(fresh));
  return fresh;
}

function saveData() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

let data = loadData();

function uid() {
  return 'h_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

// ---------- Streak engine (unit-tested separately, see tests/) ----------
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
  let guard = 0;
  while (d <= endDateStr && guard < 5000) {
    if (isScheduled(habit, d)) dates.push(d);
    d = addDays(d, 1);
    guard++;
  }
  return dates;
}

function computeStreaks(habit) {
  const today = todayStr();
  const dates = scheduledDatesUpTo(habit, today);
  const doneFlags = dates.map(ds => !!habit.completions[ds]);

  let best = 0, run = 0;
  for (const f of doneFlags) {
    if (f) { run++; best = Math.max(best, run); } else run = 0;
  }

  let list = doneFlags.slice();
  if (dates.length && dates[dates.length - 1] === today && !doneFlags[doneFlags.length - 1]) {
    list = doneFlags.slice(0, -1); // today scheduled but not yet ticked: grace, don't break yet
  }
  let current = 0;
  for (let i = list.length - 1; i >= 0; i--) {
    if (list[i]) current++; else break;
  }
  return { current, best };
}

// ---------- Mutations ----------
function addHabit(name, frequency, customDays) {
  data.habits.push({
    id: uid(),
    name: name.trim(),
    frequency,
    customDays: frequency === 'custom' ? customDays : [],
    archived: false,
    createdAt: todayStr(),
    completions: {},
    pausedPeriods: []
  });
  saveData();
}

function toggleToday(id) {
  const habit = data.habits.find(h => h.id === id);
  const t = todayStr();
  if (habit.completions[t]) delete habit.completions[t];
  else habit.completions[t] = true;
  saveData();
  render();
}

function archiveHabit(id) {
  const habit = data.habits.find(h => h.id === id);
  habit.archived = true;
  habit.pausedPeriods.push({ start: todayStr(), end: null });
  saveData();
  render();
}

function restoreHabit(id) {
  const habit = data.habits.find(h => h.id === id);
  habit.archived = false;
  const open = [...habit.pausedPeriods].reverse().find(p => p.end === null);
  if (open) open.end = todayStr();
  saveData();
  render();
}

function deleteForever(id) {
  if (!confirm('Delete this habit permanently? This cannot be undone.')) return;
  data.habits = data.habits.filter(h => h.id !== id);
  saveData();
  render();
}

// ---------- Rendering ----------
const FREQ_LABEL = { daily: 'Every day', weekdays: 'Weekdays', custom: 'Custom days' };
const DAY_ABBR = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

function freqLabel(habit) {
  if (habit.frequency === 'custom') {
    return (habit.customDays || []).slice().sort().map(d => DAY_ABBR[d]).join(', ') || 'Custom';
  }
  return FREQ_LABEL[habit.frequency];
}

function matchesSearch(habit, query) {
  if (!query) return true;
  return habit.name.toLowerCase().includes(query.toLowerCase());
}

// ---------- Reminder: habits still unlogged today ----------
function getPendingTodayHabits() {
  const t = todayStr();
  return data.habits.filter(h => !h.archived && isScheduled(h, t) && !h.completions[t]);
}

function renderReminderBanner() {
  const banner = document.getElementById('reminderBanner');
  const pending = getPendingTodayHabits();
  if (pending.length === 0) {
    banner.hidden = true;
    return;
  }
  banner.hidden = false;
  const names = pending.map(h => h.name);
  const shown = names.slice(0, 3).join(', ');
  const extra = names.length > 3 ? ` and ${names.length - 3} more` : '';
  banner.innerHTML = `⏰ <strong>Morning check-in</strong>: ${pending.length} habit${pending.length > 1 ? 's' : ''} still unlogged today — ${escapeHtml(shown)}${extra ? escapeHtml(extra) : ''}`;
}

// ---------- Optional browser notification (fires once per day, tab must be open) ----------
function maybeFireDailyNotification() {
  if (!data.notificationsEnabled) return;
  if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return;
  const t = todayStr();
  if (data.lastNotifiedDate === t) return; // already notified today
  const pending = getPendingTodayHabits();
  if (pending.length === 0) return;
  const names = pending.map(h => h.name).slice(0, 5).join(', ');
  new Notification('Habit reminder', {
    body: `You still have ${pending.length} habit(s) to log today: ${names}`
  });
  data.lastNotifiedDate = t;
  saveData();
}

function updateNotifyButton() {
  const btn = document.getElementById('notifyToggle');
  if (!btn) return;
  if (typeof Notification === 'undefined') {
    btn.hidden = true;
    return;
  }
  if (Notification.permission === 'denied') {
    btn.textContent = '🔕 Notifications blocked';
    btn.disabled = true;
  } else if (data.notificationsEnabled && Notification.permission === 'granted') {
    btn.textContent = '🔔 Reminders on';
  } else {
    btn.textContent = '🔔 Remind me';
  }
}

function habitCardToday(habit) {
  const t = todayStr();
  const done = !!habit.completions[t];
  const { current, best } = computeStreaks(habit);
  const el = document.createElement('div');
  el.className = 'habit-card';
  el.innerHTML = `
    <button class="check-btn ${done ? 'done' : ''}" data-action="toggle" data-id="${habit.id}">${done ? '✓' : ''}</button>
    <div class="habit-info">
      <div class="habit-name ${done ? 'done' : ''}">${escapeHtml(habit.name)}</div>
      <div class="habit-meta">${freqLabel(habit)}</div>
      <div class="streaks">
        <span class="streak-pill">🔥 ${current} current</span>
        <span class="streak-pill best">🏆 ${best} best</span>
      </div>
    </div>
  `;
  return el;
}

function habitCardManage(habit) {
  const { current, best } = computeStreaks(habit);
  const el = document.createElement('div');
  el.className = 'habit-card';
  el.innerHTML = `
    <div class="habit-info">
      <div class="habit-name">${escapeHtml(habit.name)}</div>
      <div class="habit-meta">${freqLabel(habit)}</div>
      <div class="streaks">
        <span class="streak-pill">🔥 ${current} current</span>
        <span class="streak-pill best">🏆 ${best} best</span>
      </div>
    </div>
    <div class="card-actions">
      <button class="icon-btn" data-action="archive" data-id="${habit.id}">Archive</button>
    </div>
  `;
  return el;
}

function habitCardArchived(habit) {
  const { current, best } = computeStreaks(habit);
  const el = document.createElement('div');
  el.className = 'habit-card';
  el.innerHTML = `
    <div class="habit-info">
      <div class="habit-name">${escapeHtml(habit.name)}</div>
      <div class="habit-meta">${freqLabel(habit)} · paused</div>
      <div class="streaks">
        <span class="streak-pill">🔥 ${current} current</span>
        <span class="streak-pill best">🏆 ${best} best</span>
      </div>
    </div>
    <div class="card-actions">
      <button class="icon-btn" data-action="restore" data-id="${habit.id}">Restore</button>
      <button class="icon-btn danger" data-action="delete" data-id="${habit.id}">Delete</button>
    </div>
  `;
  return el;
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function renderCalendar() {
  const monthEl = document.getElementById('calendarMonth');
  if (!monthEl) return;

  const today = new Date();
  const year = today.getFullYear();
  const month = today.getMonth();
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const firstWeekday = firstDay.getDay();
  const daysInMonth = lastDay.getDate();

  const grid = document.getElementById('calendarGrid');
  if (!grid) return;

  grid.innerHTML = '';

  const prevMonthDays = firstWeekday;
  const totalCells = Math.ceil((prevMonthDays + daysInMonth) / 7) * 7;

  for (let i = 0; i < totalCells; i++) {
    const dayNum = i - prevMonthDays + 1;
    const cell = document.createElement('div');
    cell.className = 'calendar-cell';

    if (dayNum <= 0 || dayNum > daysInMonth) {
      cell.classList.add('muted');
      cell.textContent = '';
    } else {
      cell.textContent = dayNum;
      if (dayNum === today.getDate()) {
        cell.classList.add('today');
      }
    }

    grid.appendChild(cell);
  }

  const monthLabel = today.toLocaleString('default', { month: 'long', year: 'numeric' });
  monthEl.textContent = monthLabel;
}

function renderProgressRing(dayNum) {
  const ring = document.getElementById('challengeRing');
  const value = document.getElementById('ringValue');
  if (!ring || !value) return;

  const percent = Math.min(100, (dayNum / data.challengeLength) * 100);
  ring.style.setProperty('--progress', `${percent}%`);
  value.textContent = String(dayNum);
}

function render() {
  const query = document.getElementById('searchInput').value.trim();
  const t = todayStr();

  // Today tab
  const todayList = document.getElementById('todayList');
  todayList.innerHTML = '';
  const todaysHabits = data.habits
    .filter(h => !h.archived && isScheduled(h, t) && matchesSearch(h, query))
    .sort((a, b) => a.name.localeCompare(b.name));
  todaysHabits.forEach(h => todayList.appendChild(habitCardToday(h)));
  document.getElementById('todayEmpty').hidden = todaysHabits.length > 0;

  // Manage tab
  const manageList = document.getElementById('manageList');
  manageList.innerHTML = '';
  const activeHabits = data.habits
    .filter(h => !h.archived && matchesSearch(h, query))
    .sort((a, b) => a.name.localeCompare(b.name));
  activeHabits.forEach(h => manageList.appendChild(habitCardManage(h)));
  document.getElementById('manageEmpty').hidden = activeHabits.length > 0;

  // Archived tab
  const archivedList = document.getElementById('archivedList');
  archivedList.innerHTML = '';
  const archivedHabits = data.habits
    .filter(h => h.archived && matchesSearch(h, query))
    .sort((a, b) => a.name.localeCompare(b.name));
  archivedHabits.forEach(h => archivedList.appendChild(habitCardArchived(h)));
  document.getElementById('archivedEmpty').hidden = archivedHabits.length > 0;
  document.getElementById('archivedCount').textContent = archivedHabits.length ? archivedHabits.length : '';

  // Challenge progress
  const elapsed = Math.floor((new Date(t) - new Date(data.challengeStart)) / 86400000) + 1;
  const dayNum = Math.min(Math.max(elapsed, 1), data.challengeLength);
  document.getElementById('challengeProgress').textContent =
    `Day ${dayNum} of ${data.challengeLength}`;
  renderProgressRing(dayNum);

  // Morning reminder
  renderReminderBanner();
  updateNotifyButton();
  renderCalendar();
}

// ---------- Events ----------
document.addEventListener('click', (e) => {
  const btn = e.target.closest('[data-action]');
  if (!btn) return;
  const { action, id } = btn.dataset;
  if (action === 'toggle') toggleToday(id);
  if (action === 'archive') archiveHabit(id);
  if (action === 'restore') restoreHabit(id);
  if (action === 'delete') deleteForever(id);
});

document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById('tab-' + btn.dataset.tab).classList.add('active');
  });
});

document.querySelectorAll('input[name="freq"]').forEach(radio => {
  radio.addEventListener('change', (e) => {
    document.getElementById('customDaysRow').hidden = e.target.value !== 'custom';
  });
});

document.getElementById('addHabitForm').addEventListener('submit', (e) => {
  e.preventDefault();
  const name = document.getElementById('habitName').value;
  if (!name.trim()) return;
  const freq = document.querySelector('input[name="freq"]:checked').value;
  const customDays = Array.from(document.querySelectorAll('#customDaysRow input:checked')).map(cb => Number(cb.value));
  if (freq === 'custom' && customDays.length === 0) {
    alert('Pick at least one day for a custom schedule.');
    return;
  }
  addHabit(name, freq, customDays);
  e.target.reset();
  document.getElementById('customDaysRow').hidden = true;
  render();
});

document.getElementById('searchInput').addEventListener('input', render);

const notifyBtn = document.getElementById('notifyToggle');
if (notifyBtn) {
  notifyBtn.addEventListener('click', async () => {
    if (typeof Notification === 'undefined') return;
    if (Notification.permission === 'granted') {
      data.notificationsEnabled = !data.notificationsEnabled;
      saveData();
      updateNotifyButton();
      if (data.notificationsEnabled) maybeFireDailyNotification();
      return;
    }
    const perm = await Notification.requestPermission();
    if (perm === 'granted') {
      data.notificationsEnabled = true;
      saveData();
      maybeFireDailyNotification();
    }
    updateNotifyButton();
  });
}

render();
maybeFireDailyNotification();
