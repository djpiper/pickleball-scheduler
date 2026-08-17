// Input validation for the API. Everything crossing the wire is untrusted:
// the app is unauthenticated, so these caps are the only thing standing between
// a bored coworker and a 5 MB row.

export const LIMITS = {
  title: 60,
  name: 40,
  dates: 28, // days a poll may span
  slots: 2000, // 28 days x ~48 half-hours, with headroom
  idLen: 32,
  courtName: 60,
  area: 80,
  notes: 200,
  courtCount: 40, // courts at one location
  courtVotes: 200, // courts one person may approve in a poll
};

export const SURFACES = ['concrete', 'asphalt', 'tile', 'wood', 'other'];

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const SLOT_RE = /^\d{4}-\d{2}-\d{2}#\d{1,4}$/;
const ID_RE = /^[A-Za-z0-9_-]{1,32}$/;

// Ambiguity-free alphabet: no 0/o/1/l/i.
const ALPHABET = '23456789abcdefghjkmnpqrstuvwxyz';

export function newId(len = 6) {
  const bytes = new Uint8Array(len);
  crypto.getRandomValues(bytes);
  let out = '';
  for (const b of bytes) out += ALPHABET[b % ALPHABET.length];
  return out;
}

export const isValidId = (v) => typeof v === 'string' && ID_RE.test(v);

const clampStr = (v, max) => String(v ?? '').trim().slice(0, max);

/**
 * Validate a poll create/update payload.
 * @returns {{ok: true, value: object} | {ok: false, error: string}}
 */
export function validatePoll(body) {
  if (!body || typeof body !== 'object') return { ok: false, error: 'Body must be a JSON object' };

  const title = clampStr(body.title, LIMITS.title) || 'Pickleball';

  if (!Array.isArray(body.dates)) return { ok: false, error: 'dates must be an array' };
  const dates = [...new Set(body.dates.filter((d) => typeof d === 'string' && DATE_RE.test(d)))].sort();
  if (dates.length === 0) return { ok: false, error: 'Pick at least one date' };
  if (dates.length > LIMITS.dates) return { ok: false, error: `No more than ${LIMITS.dates} dates` };

  const startHour = Number(body.startHour);
  const endHour = Number(body.endHour);
  const whole = (n) => Number.isInteger(n) && n >= 0 && n <= 24;
  if (!whole(startHour) || !whole(endHour)) return { ok: false, error: 'Hours must be whole numbers 0-24' };
  if (endHour <= startHour) return { ok: false, error: 'End hour must be after start hour' };

  return { ok: true, value: { title, dates, startHour, endHour } };
}

/**
 * Keep only well-formed slots that actually fall inside the poll's grid.
 * Silently drops the rest — a stale client shouldn't get a hard error, it should
 * just lose the cells that no longer exist after the organiser edits the days.
 */
export function sanitizeSlots(slots, poll) {
  if (!Array.isArray(slots)) return [];
  const allowed = new Set(poll.dates);
  const min = poll.startHour * 60;
  const max = poll.endHour * 60;

  const clean = [];
  for (const s of slots) {
    if (typeof s !== 'string' || !SLOT_RE.test(s)) continue;
    const [date, minsRaw] = s.split('#');
    const mins = Number(minsRaw);
    if (!allowed.has(date)) continue;
    if (mins < min || mins >= max) continue;
    if (mins % 30 !== 0) continue;
    clean.push(s);
    if (clean.length >= LIMITS.slots) break;
  }
  return [...new Set(clean)];
}

export const cleanName = (v) => clampStr(v, LIMITS.name);

/**
 * Keep only well-formed court ids from an approval-vote payload.
 * Ids that no longer exist are left in rather than checked against the court
 * table: deleting a court already clears its votes, and a stale client shouldn't
 * get a hard error for a court that vanished mid-session.
 */
export function sanitizeCourtVotes(courts) {
  if (!Array.isArray(courts)) return [];
  const clean = [];
  for (const id of courts) {
    if (!isValidId(id)) continue;
    clean.push(id);
    if (clean.length >= LIMITS.courtVotes) break;
  }
  return [...new Set(clean)];
}

/**
 * Validate a court create/update payload.
 * @returns {{ok: true, value: object} | {ok: false, error: string}}
 */
export function validateCourt(body) {
  if (!body || typeof body !== 'object') return { ok: false, error: 'Body must be a JSON object' };

  const name = clampStr(body.name, LIMITS.courtName);
  if (!name) return { ok: false, error: 'Name is required' };

  const courtCount = Number(body.courtCount);
  if (!Number.isInteger(courtCount) || courtCount < 1 || courtCount > LIMITS.courtCount) {
    return { ok: false, error: `Court count must be a whole number 1-${LIMITS.courtCount}` };
  }

  // An unknown surface is dropped rather than rejected, the same way sanitizeSlots
  // drops off-grid cells: a stale client shouldn't lose its whole submission over a
  // field nobody reads for correctness.
  const surfaceRaw = clampStr(body.surface, 20).toLowerCase();
  const surface = SURFACES.includes(surfaceRaw) ? surfaceRaw : '';

  return {
    ok: true,
    value: {
      name,
      area: clampStr(body.area, LIMITS.area),
      courtCount,
      indoor: Boolean(body.indoor),
      lighted: Boolean(body.lighted),
      tennis: Boolean(body.tennis),
      surface,
      notes: clampStr(body.notes, LIMITS.notes),
    },
  };
}
