import { useState, useEffect, useCallback } from 'react';
import { Loader2 } from 'lucide-react';
import { C, MONO, SANS } from './theme.js';
import { createPoll, fetchPoll, updatePoll } from './lib/api.js';
import { loadIdentity, saveIdentity } from './lib/identity.js';
import Setup from './components/Setup.jsx';
import Board from './components/Board.jsx';
import { Wordmark, Notice } from './components/ui.jsx';

// Routes are just two shapes, so there's no router dependency:
//   /            → create a poll
//   /?p=<pollId> → the grid
//
// The poll id lives in the query string rather than a path segment on purpose:
// a static host only ever has to serve index.html, so shared links can't 404 on
// a missing SPA-fallback rule. (Cloudflare's `_redirects` splat is rejected as a
// loop by current wrangler, and a dead link is the one bug this app can't have.)
// To move to /p/:id later, add SPA fallback on the host and swap these two fns.
const readRoute = () => {
  const id = new URLSearchParams(window.location.search).get('p');
  return id && /^[A-Za-z0-9_-]{1,32}$/.test(id) ? { name: 'poll', pollId: id } : { name: 'create' };
};

const pollPath = (id) => `${window.location.pathname}?p=${id}`;

export default function App() {
  const [route, setRoute] = useState(readRoute);
  const [state, setState] = useState({ status: 'idle' }); // idle | loading | ready | error
  const [identity, setIdentity] = useState(null);
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState('');

  useEffect(() => {
    const onPop = () => {
      setRoute(readRoute());
      setEditing(false);
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  const go = (path) => {
    window.history.pushState({}, '', path);
    setRoute(readRoute());
  };

  const load = useCallback(async (pollId) => {
    try {
      const data = await fetchPoll(pollId);
      setState({ status: 'ready', ...data });
      return data;
    } catch (e) {
      setState({ status: 'error', message: e.message });
      return null;
    }
  }, []);

  useEffect(() => {
    if (route.name !== 'poll') {
      setState({ status: 'idle' });
      return;
    }
    setIdentity(loadIdentity(route.pollId));
    setState({ status: 'loading' });
    load(route.pollId);
  }, [route, load]);

  const handleIdentity = (next) => {
    saveIdentity(route.pollId, next);
    setIdentity(next);
    return next;
  };

  const handleCreate = async (body) => {
    setBusy(true);
    setFormError('');
    try {
      const { id } = await createPoll(body);
      go(pollPath(id));
    } catch (e) {
      setFormError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const handleEdit = async (body) => {
    setBusy(true);
    setFormError('');
    try {
      const data = await updatePoll(route.pollId, body);
      setState({ status: 'ready', ...data });
      setEditing(false);
    } catch (e) {
      setFormError(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen w-full" style={{ background: C.deep, color: C.line, fontFamily: SANS }}>
      <div className="mx-auto w-full px-4 py-6" style={{ maxWidth: 980 }}>
        {route.name === 'create' && (
          <Setup onSubmit={handleCreate} busy={busy} error={formError} />
        )}

        {route.name === 'poll' && state.status === 'loading' && <Spinner />}

        {route.name === 'poll' && state.status === 'error' && (
          <div>
            <Wordmark title="Dead link" sub="Nothing here" />
            <Notice tone="bad">{state.message}</Notice>
            <button
              type="button"
              onClick={() => go(window.location.pathname)}
              className="rounded px-4 py-3 mt-4"
              style={{ background: C.ball, color: C.ink, fontFamily: MONO, fontSize: 12, fontWeight: 700, letterSpacing: '0.14em' }}
            >
              START A NEW ONE
            </button>
          </div>
        )}

        {route.name === 'poll' && state.status === 'ready' && identity && (
          editing ? (
            <Setup
              initial={state.poll}
              onSubmit={handleEdit}
              onCancel={() => setEditing(false)}
              busy={busy}
              error={formError}
            />
          ) : (
            <Board
              pollId={route.pollId}
              poll={state.poll}
              participants={state.participants}
              identity={identity}
              onIdentity={handleIdentity}
              onReload={() => load(route.pollId)}
              onEditConfig={() => setEditing(true)}
            />
          )
        )}
      </div>
    </div>
  );
}

function Spinner() {
  return (
    <div className="flex items-center justify-center py-20" style={{ color: C.dim, fontFamily: MONO }}>
      <Loader2 className="animate-spin" size={18} />
      <span className="ml-2 text-xs uppercase" style={{ letterSpacing: '0.18em' }}>
        Rolling out the net
      </span>
    </div>
  );
}
