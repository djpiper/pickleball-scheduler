// GET /api/poll/:id  — poll config + every participant's slots
// PUT /api/poll/:id  — edit the poll's title, days, or hours
import { json, fail, readJson } from '../../../../shared/http.js';
import { validatePoll, isValidId, sanitizeSlots } from '../../../../shared/validate.js';
import {
  rowToPoll,
  rowToParticipant,
  getPollRow,
  getParticipantRows,
  getCourtVoteRows,
  withCourtVotes,
} from '../../../../shared/db.js';

export async function onRequestGet({ params, env }) {
  if (!isValidId(params.id)) return fail(400, 'Bad poll id');

  const row = await getPollRow(env, params.id);
  if (!row) return fail(404, 'No poll with that link');

  const poll = rowToPoll(row);
  const [rows, votes] = await Promise.all([
    getParticipantRows(env, poll.id),
    getCourtVoteRows(env, poll.id),
  ]);
  return json({ poll, participants: withCourtVotes(rows.map(rowToParticipant), votes) });
}

export async function onRequestPut({ params, request, env }) {
  if (!isValidId(params.id)) return fail(400, 'Bad poll id');

  const row = await getPollRow(env, params.id);
  if (!row) return fail(404, 'No poll with that link');

  const body = await readJson(request);
  const check = validatePoll(body);
  if (!check.ok) return fail(400, check.error);

  const { title, dates, startHour, endHour } = check.value;
  await env.DB.prepare('UPDATE poll SET title = ?, dates = ?, start_hour = ?, end_hour = ? WHERE id = ?')
    .bind(title, JSON.stringify(dates), startHour, endHour, params.id)
    .run();

  // Narrowing the grid can orphan slots outside it. Re-clamp everyone so the
  // tallies stay honest instead of counting cells nobody can see.
  const nextPoll = { dates, startHour, endHour };
  const rows = await getParticipantRows(env, params.id);
  const rewrites = [];
  for (const r of rows) {
    const before = rowToParticipant(r).slots;
    const after = sanitizeSlots(before, nextPoll);
    if (after.length !== before.length) {
      rewrites.push(
        env.DB.prepare('UPDATE participant SET slots = ? WHERE id = ?').bind(JSON.stringify(after), r.id)
      );
    }
  }
  if (rewrites.length) await env.DB.batch(rewrites);

  const [fresh, votes] = await Promise.all([
    getParticipantRows(env, params.id),
    getCourtVoteRows(env, params.id),
  ]);
  return json({
    poll: { id: params.id, title, dates, startHour, endHour, createdAt: row.created_at },
    participants: withCourtVotes(fresh.map(rowToParticipant), votes),
  });
}
