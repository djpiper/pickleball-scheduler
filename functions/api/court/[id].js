// PUT    /api/court/:id  — edit a court
// DELETE /api/court/:id  — drop it from the directory
import { json, fail, readJson } from '../../../shared/http.js';
import { validateCourt, isValidId } from '../../../shared/validate.js';
import { getCourtRow } from '../../../shared/db.js';

const DUPLICATE = 'A court with that name is already listed — edit that one instead';

export async function onRequestPut({ params, request, env }) {
  if (!isValidId(params.id)) return fail(400, 'Bad court id');

  const row = await getCourtRow(env, params.id);
  if (!row) return fail(404, 'No court with that id');

  const body = await readJson(request);
  const check = validateCourt(body);
  if (!check.ok) return fail(400, check.error);

  const c = check.value;

  // Same name guard as create, minus the row being edited — renaming a court to
  // the name it already has must not collide with itself.
  const clash = await env.DB
    .prepare('SELECT id FROM court WHERE name = ? COLLATE NOCASE AND id != ?')
    .bind(c.name, params.id)
    .first();
  if (clash) return fail(409, DUPLICATE);

  const updatedAt = Date.now();

  await env.DB.prepare(
    `UPDATE court SET
       name = ?, area = ?, court_count = ?, indoor = ?, lighted = ?,
       tennis = ?, surface = ?, notes = ?, updated_at = ?
     WHERE id = ?`
  )
    .bind(
      c.name,
      c.area,
      c.courtCount,
      c.indoor ? 1 : 0,
      c.lighted ? 1 : 0,
      c.tennis ? 1 : 0,
      c.surface,
      c.notes,
      updatedAt,
      params.id
    )
    .run();

  return json({ court: { id: params.id, ...c, createdAt: row.created_at, updatedAt } });
}

export async function onRequestDelete({ params, env }) {
  if (!isValidId(params.id)) return fail(400, 'Bad court id');

  await env.DB.prepare('DELETE FROM court WHERE id = ?').bind(params.id).run();
  return json({ ok: true });
}
