// PUT /api/poll/:id/participant/:pid/courts  — replace one person's approvals
//
// Approval voting: the body is the whole set of courts this person would be happy
// with, and the write is delete-then-insert inside one batch. Whole-set writes
// keep this idempotent, so a retry after a flaky save can't double-count.
//
// Separate from the participant upsert on purpose: votes and times are painted at
// different moments, and sending both together would let a vote write clobber
// cells the user is mid-drag on.
import { json, fail, readJson } from '../../../../../../shared/http.js';
import { isValidId, sanitizeCourtVotes } from '../../../../../../shared/validate.js';
import { getPollRow } from '../../../../../../shared/db.js';

export async function onRequestPut({ params, request, env }) {
  if (!isValidId(params.id) || !isValidId(params.pid)) return fail(400, 'Bad id');

  const row = await getPollRow(env, params.id);
  if (!row) return fail(404, 'No poll with that link');

  const body = await readJson(request);
  if (!body) return fail(400, 'Body must be a JSON object');

  const courts = sanitizeCourtVotes(body.courts);
  const updatedAt = Date.now();

  const statements = [
    env.DB.prepare('DELETE FROM court_vote WHERE poll_id = ? AND participant_id = ?').bind(
      params.id,
      params.pid
    ),
  ];
  for (const courtId of courts) {
    statements.push(
      env.DB.prepare(
        'INSERT INTO court_vote (poll_id, participant_id, court_id, updated_at) VALUES (?, ?, ?, ?)'
      ).bind(params.id, params.pid, courtId, updatedAt)
    );
  }
  await env.DB.batch(statements);

  return json({ id: params.pid, courts, updatedAt });
}
