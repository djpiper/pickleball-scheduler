// GET  /api/court  — every court in the directory, sorted by name
// POST /api/court  — add one, returns { court }
//
// The directory is site-wide and unowned: anyone may add, edit, or delete any
// entry. That's the same trust model as the rest of the app — see the README's
// "Known limitations" before adding an ownership column.
import { json, fail, readJson } from '../../../shared/http.js';
import { validateCourt, newId } from '../../../shared/validate.js';
import { rowToCourt, getCourtRows } from '../../../shared/db.js';

const DUPLICATE = 'A court with that name is already listed — edit that one instead';

export async function onRequestGet({ env }) {
  const rows = await getCourtRows(env);
  return json({ courts: rows.map(rowToCourt) });
}

export async function onRequestPost({ request, env }) {
  const body = await readJson(request);
  const check = validateCourt(body);
  if (!check.ok) return fail(400, check.error);

  const c = check.value;

  // Wiki-style editing only works if the list doesn't fill with near-duplicates.
  const clash = await env.DB
    .prepare('SELECT id FROM court WHERE name = ? COLLATE NOCASE')
    .bind(c.name)
    .first();
  if (clash) return fail(409, DUPLICATE);

  const id = newId(6);
  const now = Date.now();

  await env.DB.prepare(
    `INSERT INTO court
       (id, name, area, court_count, indoor, lighted, tennis, surface, notes, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  )
    .bind(
      id,
      c.name,
      c.area,
      c.courtCount,
      c.indoor ? 1 : 0,
      c.lighted ? 1 : 0,
      c.tennis ? 1 : 0,
      c.surface,
      c.notes,
      now,
      now
    )
    .run();

  return json({ court: { id, ...c, createdAt: now, updatedAt: now } }, 201);
}
