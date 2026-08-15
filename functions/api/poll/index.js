// POST /api/poll  — create a poll, returns { id }
import { json, fail, readJson } from '../../../shared/http.js';
import { validatePoll, newId } from '../../../shared/validate.js';

export async function onRequestPost({ request, env }) {
  const body = await readJson(request);
  const check = validatePoll(body);
  if (!check.ok) return fail(400, check.error);

  const { title, dates, startHour, endHour } = check.value;
  const id = newId(6);
  const createdAt = Date.now();

  await env.DB.prepare(
    'INSERT INTO poll (id, title, dates, start_hour, end_hour, created_at) VALUES (?, ?, ?, ?, ?, ?)'
  )
    .bind(id, title, JSON.stringify(dates), startHour, endHour, createdAt)
    .run();

  return json({ id }, 201);
}
