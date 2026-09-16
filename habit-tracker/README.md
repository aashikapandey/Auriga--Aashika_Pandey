# Habit Tracker — 75 Day Challenge

A small, dependency-free habit tracker built for anyone running a multi-week
challenge (like a 75-day one) with a mix of daily and weekday-only habits.
Every morning you get one screen: today's habits, tap to tick them off, and
your current + best streak right there.

## Features

- **Today view** — shows only the habits actually scheduled for today (daily,
  weekdays-only, or custom days), so you're never ticking off something that
  isn't due.
- **Streaks** — every habit tracks its **current streak** and **best-ever
  streak**. Non-scheduled days (e.g. weekends for a weekday habit) don't break
  a streak, and today isn't marked "broken" just because you haven't ticked it
  yet — you get until the day ends.
- **Archive, not delete** — habits you've quietly given up on can be archived
  instead of deleted. Archiving freezes the streak exactly where it was; the
  paused days don't count against you. Restore anytime and it picks back up.
  Permanent delete is still available from the Archived tab if you really want
  it gone.
- **Search** — a search box at the top filters every tab live, for when your
  list has grown long and you just want to find and tick one thing.
- **Challenge progress** — a "Day N of 75" header with a progress bar.
- All data is stored locally in the browser (`localStorage`) — no account, no
  server, no setup.

## Project structure

habit-tracker/
├── index.html # markup
├── styles.css # styling
├── app.js # all app logic (storage, streak engine, rendering)
├── tests/
│ ├── logic.js # copy of the streak-calculation functions, isolated for testing
│ └── streaks.test.js # plain-Node assertions covering streak edge cases
└── README.md / REASONING.md / AI_LOGS.md


## Running it

No build step, no dependencies. Any of these work:

**Option A — just open it**
Double-click `index.html`, or open it directly in a browser.

**Option B — serve it (recommended in Codespaces, avoids any local-file quirks)**
```bash
cd habit-tracker
python3 -m http.server 8080
# then open the forwarded port 8080 in the browser, or click the popup
# Codespaces gives you when a port opens
```
or, with Node:
```bash
npx serve .
```

That's it — the app loads and you can start adding habits immediately.

## Running the tests

The streak-calculation logic (the trickiest part of this app) is covered by a
small standalone test file that doesn't need a browser:

```bash
cd habit-tracker/tests
node streaks.test.js
```

You should see a series of `OK:` lines and `All checks complete.` at the end.
`tests/logic.js` is a copy of the exact streak functions used in `app.js`
(`isScheduled`, `computeStreaks`, etc.) — kept in isolation so they can run
under plain Node without a DOM.

## Debugging

- **Data got weird / want a clean slate**: open DevTools console and run
  `localStorage.removeItem('habitTrackerData_v1')`, then refresh.
- **Streak looks wrong**: check the habit's frequency — a "weekdays" habit is
  only ever evaluated against Mon–Fri, so a Saturday gap is expected and
  won't break it. Also note: if today's box isn't ticked yet, the current
  streak still shows the value *as of yesterday* — that's intentional (grace
  period), not a bug.
- **Habit not showing on Today**: it's either archived (check the Archived
  tab) or just not scheduled for today (check its frequency in Manage).
- All state lives in one `localStorage` key (`habitTrackerData_v1`), visible
  under Application → Local Storage in DevTools, which makes it easy to
  inspect or hand-edit while debugging.

## Design notes

See `REASONING.md` for the thinking behind the data model, the streak
algorithm, and the archive/pause approach.
check whats