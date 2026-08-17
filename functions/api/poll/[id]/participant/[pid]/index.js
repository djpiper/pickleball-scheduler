// PUT    /api/poll/:id/participant/:pid  — upsert one person's name + slots
// DELETE /api/poll/:id/participant/:pid  — remove them from the poll
//
// One row per participant is deliberate: two people painting the grid at the
// same moment write different rows, so there's no last-write-wins clobbering.
import { json, fail, readJson } from '../../../../../../shared/http.js';
import { isValidId, cleanName, sanitizeSlots } from '../../../../../../shared/validate.js';
import { rowToPoll, getPollRow } from '../../../../../../shared/db.js';

export async function onRequestPut({ params, request, env }) {
  if (!isValidId(params.id) || !isValidId(params.pid)) return fail(400, 'Bad id');

  const row = await getPollRow(env, params.id);
  if (!row) return fail(404, 'No poll with that link');
  const poll = rowToPoll(row);

  const body = await readJson(request);
  if (!body) return fail(400, 'Body must be a JSON object');

  const name = cleanName(body.name);
  if (!name) return fail(400, 'Name is required');

  const slots = sanitizeSlots(body.slots, poll);
  const updatedAt = Date.now();

  await env.DB.prepare(
    `INSERT INTO participant (id, poll_id, name, slots, updated_at)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       name = excluded.name,
       slots = excluded.slots,
       updated_at = excluded.updated_at
     WHERE participant.poll_id = excluded.poll_id`
  )
    .bind(params.pid, params.id, name, JSON.stringify(slots), updatedAt)
    .run();

  return json({ id: params.pid, name, slots, updatedAt });
}

export async function onRequestDelete({ params, env }) {
  if (!isValidId(params.id) || !isValidId(params.pid)) return fail(400, 'Bad id');

  // Their court votes go with them — otherwise "clear my times" would leave a
  // ghost vote propping up a location nobody is still backing.
  await env.DB.batch([
    env.DB.prepare('DELETE FROM participant WHERE id = ? AND poll_id = ?').bind(params.pid, params.id),
    env.DB.prepare('DELETE FROM court_vote WHERE participant_id = ? AND poll_id = ?').bind(params.pid, params.id),
  ]);

  return json({ ok: true });
}
