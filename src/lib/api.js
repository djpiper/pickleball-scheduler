// Thin wrapper over the Pages Functions API. Every call throws an Error whose
// message is safe to render — the server sends { error } on failures.

async function send(path, options) {
  let res;
  try {
    res = await fetch(`/api${path}`, {
      headers: { 'content-type': 'application/json' },
      ...options,
    });
  } catch {
    throw new Error('Network unreachable — check your connection and try again.');
  }

  let data = null;
  try {
    data = await res.json();
  } catch {
    /* empty or non-JSON body */
  }

  if (!res.ok) throw new Error((data && data.error) || `Request failed (${res.status})`);
  return data;
}

export const createPoll = (poll) =>
  send('/poll', { method: 'POST', body: JSON.stringify(poll) });

export const fetchPoll = (id) => send(`/poll/${id}`);

export const updatePoll = (id, poll) =>
  send(`/poll/${id}`, { method: 'PUT', body: JSON.stringify(poll) });

export const saveParticipant = (pollId, pid, { name, slots }) =>
  send(`/poll/${pollId}/participant/${pid}`, {
    method: 'PUT',
    body: JSON.stringify({ name, slots }),
  });

export const deleteParticipant = (pollId, pid) =>
  send(`/poll/${pollId}/participant/${pid}`, { method: 'DELETE' });

export const fetchCourts = () => send('/court');

export const createCourt = (court) =>
  send('/court', { method: 'POST', body: JSON.stringify(court) });

export const updateCourt = (id, court) =>
  send(`/court/${id}`, { method: 'PUT', body: JSON.stringify(court) });

export const deleteCourt = (id) => send(`/court/${id}`, { method: 'DELETE' });
