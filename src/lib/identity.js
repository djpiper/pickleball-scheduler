// There is no login. A browser's identity for a given poll is a random id kept
// in localStorage; the server upserts against it. Scoped per poll so two polls
// in the same browser stay independent.
//
// Consequence worth knowing: same person, second device = second row. The Board
// offers a "that's me" claim flow so they can adopt an existing participant id
// instead of creating a duplicate.

const key = (pollId) => `pb:me:${pollId}`;

const randomId = () => {
  if (crypto.randomUUID) return crypto.randomUUID().replace(/-/g, '').slice(0, 20);
  const b = new Uint8Array(10);
  crypto.getRandomValues(b);
  return [...b].map((x) => x.toString(16).padStart(2, '0')).join('');
};

export function loadIdentity(pollId) {
  try {
    const raw = localStorage.getItem(key(pollId));
    if (raw) {
      const v = JSON.parse(raw);
      if (v && typeof v.id === 'string') return { id: v.id, name: v.name || '' };
    }
  } catch {
    /* private browsing, disabled storage — fall through to a fresh identity */
  }
  return { id: randomId(), name: '' };
}

export function saveIdentity(pollId, identity) {
  try {
    localStorage.setItem(key(pollId), JSON.stringify(identity));
  } catch {
    /* non-persistent session; the id still works for this tab */
  }
  return identity;
}
