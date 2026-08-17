// D1 row <-> API shape mapping. SQLite columns are snake_case, the JSON API is
// camelCase, and two columns hold JSON text.

const parseJson = (text, fallback) => {
  try {
    const v = JSON.parse(text);
    return Array.isArray(v) ? v : fallback;
  } catch {
    return fallback;
  }
};

export const rowToPoll = (row) => ({
  id: row.id,
  title: row.title,
  dates: parseJson(row.dates, []),
  startHour: row.start_hour,
  endHour: row.end_hour,
  createdAt: row.created_at,
});

export const rowToParticipant = (row) => ({
  id: row.id,
  name: row.name,
  slots: parseJson(row.slots, []),
  updatedAt: row.updated_at,
});

// SQLite has no BOOLEAN, so the flag columns are 0/1 and become real booleans here.
export const rowToCourt = (row) => ({
  id: row.id,
  name: row.name,
  area: row.area,
  courtCount: row.court_count,
  indoor: !!row.indoor,
  lighted: !!row.lighted,
  tennis: !!row.tennis,
  surface: row.surface,
  notes: row.notes,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

export const getPollRow = (env, id) =>
  env.DB.prepare('SELECT * FROM poll WHERE id = ?').bind(id).first();

export const getParticipantRows = async (env, pollId) => {
  const { results } = await env.DB
    .prepare('SELECT id, name, slots, updated_at FROM participant WHERE poll_id = ? ORDER BY updated_at ASC')
    .bind(pollId)
    .all();
  return results ?? [];
};

// Votes live in their own table, so the poll payload stitches them onto each
// participant — the client then treats `courts` exactly like `slots`.
export const getCourtVoteRows = async (env, pollId) => {
  const { results } = await env.DB
    .prepare('SELECT participant_id, court_id FROM court_vote WHERE poll_id = ?')
    .bind(pollId)
    .all();
  return results ?? [];
};

export const withCourtVotes = (participants, voteRows) => {
  const byParticipant = new Map();
  for (const v of voteRows) {
    const list = byParticipant.get(v.participant_id) ?? [];
    list.push(v.court_id);
    byParticipant.set(v.participant_id, list);
  }
  return participants.map((p) => ({ ...p, courts: byParticipant.get(p.id) ?? [] }));
};

export const getCourtRow = (env, id) =>
  env.DB.prepare('SELECT * FROM court WHERE id = ?').bind(id).first();

export const getCourtRows = async (env) => {
  const { results } = await env.DB
    .prepare('SELECT * FROM court ORDER BY name COLLATE NOCASE ASC')
    .all();
  return results ?? [];
};
