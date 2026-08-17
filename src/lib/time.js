// Dates are handled as local-time "YYYY-MM-DD" strings, never Date objects on
// the wire. A slot key is `${date}#${minutesFromMidnight}` — e.g. "2026-08-20#1080".
export const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
export const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export const dkey = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export const dparse = (k) => {
  const [y, m, d] = k.split('-').map(Number);
  return new Date(y, m - 1, d);
};

export const fmtClock = (mins) => {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  const ap = h >= 12 ? 'pm' : 'am';
  const hh = h % 12 === 0 ? 12 : h % 12;
  return m ? `${hh}:${String(m).padStart(2, '0')}${ap}` : `${hh}${ap}`;
};

export const ck = (date, mins) => `${date}#${mins}`;

export const slotCountFor = (poll) => (poll.endHour - poll.startHour) * 2;
export const minsAtFor = (poll) => (i) => poll.startHour * 60 + i * 30;

// What a poll covers unless someone narrows it: every day for four weeks, 9am to
// 9pm. Creating a poll is meant to be one button — nobody knows up front which
// days are worth asking about, and that's exactly what the poll is for. 28 days
// is also LIMITS.dates, so the default payload sits right on the cap.
export const DEFAULT_START_HOUR = 9;
export const DEFAULT_END_HOUR = 21;
export const HORIZON_DAYS = 28;

export const startOfToday = () => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
};

export const horizonDays = (n = HORIZON_DAYS) => {
  const t = startOfToday();
  return Array.from({ length: n }, (_, i) => {
    const d = new Date(t);
    d.setDate(d.getDate() + i);
    return d;
  });
};

export const defaultDates = () => horizonDays().map(dkey);

/**
 * Group date keys into Sunday-start calendar weeks.
 * Each week carries `dates` (the poll's days, in order) and `cells` (all seven
 * columns, so the strip lines up under the SUN..SAT header even when the poll
 * starts mid-week).
 * @returns {{start: string, dates: string[], cells: {key: string, date: Date, active: boolean}[]}[]}
 */
export const weeksOf = (dates) => {
  const set = new Set(dates);
  const weeks = [];
  const byStart = new Map();

  for (const d of [...set].sort()) {
    const sun = dparse(d);
    sun.setDate(sun.getDate() - sun.getDay());
    const start = dkey(sun);

    let week = byStart.get(start);
    if (!week) {
      week = {
        start,
        dates: [],
        cells: Array.from({ length: 7 }, (_, i) => {
          const cd = new Date(sun);
          cd.setDate(cd.getDate() + i);
          const key = dkey(cd);
          return { key, date: cd, active: set.has(key) };
        }),
      };
      byStart.set(start, week);
      weeks.push(week);
    }
    week.dates.push(d);
  }

  return weeks;
};

// Half-hour slot count as a human span: 5 -> "2.5h".
export const fmtSpan = (slotCount) =>
  slotCount % 2 ? `${Math.floor(slotCount / 2)}.5h` : `${slotCount / 2}h`;
