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
