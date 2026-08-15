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

export const getPollRow = (env, id) =>
  env.DB.prepare('SELECT * FROM poll WHERE id = ?').bind(id).first();

export const getParticipantRows = async (env, pollId) => {
  const { results } = await env.DB
    .prepare('SELECT id, name, slots, updated_at FROM participant WHERE poll_id = ? ORDER BY updated_at ASC')
    .bind(pollId)
    .all();
  return results ?? [];
};
