import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { RefreshCw, Settings2, Eraser, Check, Users, Link2, Pencil, MapPin } from 'lucide-react';
import { C, MONO, SANS } from '../theme.js';
import { DOW, MON, dparse, ck, fmtClock, slotCountFor, minsAtFor } from '../lib/time.js';
import { saveParticipant, deleteParticipant } from '../lib/api.js';
import { Wordmark, Panel, Label, IconBtn, TextField, Notice } from './ui.jsx';
import Grid from './Grid.jsx';

const SAVE_DEBOUNCE_MS = 700;
const POLL_INTERVAL_MS = 20000;

export default function Board({ pollId, poll, participants, identity, onIdentity, onReload, onEditConfig, onOpenCourts }) {
  const [view, setView] = useState('mine');
  const [mine, setMine] = useState(() => new Set());
  const [status, setStatus] = useState('saved'); // saved | saving | error
  const [refreshing, setRefreshing] = useState(false);
  const [focusCell, setFocusCell] = useState(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [nameDraft, setNameDraft] = useState('');
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState('');

  const named = !!identity.name.trim();
  const slots = slotCountFor(poll);
  const minsAt = minsAtFor(poll);

  // Seed my own cells from the server exactly once per identity. After that the
  // local Set is authoritative for my row — background refreshes must not stomp
  // on cells I'm in the middle of painting.
  const seededFor = useRef(null);
  useEffect(() => {
    if (seededFor.current === identity.id) return;
    const rec = participants.find((p) => p.id === identity.id);
    setMine(new Set(rec?.slots ?? []));
    seededFor.current = identity.id;
  }, [participants, identity.id]);

  const timer = useRef(null);
  useEffect(() => () => clearTimeout(timer.current), []);

  const persist = useCallback(
    (nextSlots, name) => {
      clearTimeout(timer.current);
      setStatus('saving');
      timer.current = setTimeout(async () => {
        try {
          await saveParticipant(pollId, identity.id, { name, slots: [...nextSlots] });
          setStatus('saved');
          setError('');
        } catch (e) {
          setStatus('error');
          setError(e.message);
        }
      }, SAVE_DEBOUNCE_MS);
    },
    [pollId, identity.id]
  );

  const paint = useCallback(
    (key, adding) => {
      setMine((prev) => {
        if (adding === prev.has(key)) return prev;
        const next = new Set(prev);
        if (adding) next.add(key);
        else next.delete(key);
        persist(next, identity.name);
        return next;
      });
    },
    [persist, identity.name]
  );

  // Background sync. Cheap: one GET, four rows.
  useEffect(() => {
    const id = setInterval(() => {
      if (!document.hidden) onReload();
    }, POLL_INTERVAL_MS);
    return () => clearInterval(id);
  }, [onReload]);

  const refresh = async () => {
    setRefreshing(true);
    await onReload();
    setRefreshing(false);
  };

  const claimName = async (name) => {
    const clean = name.trim();
    if (!clean) return;
    const next = onIdentity({ ...identity, name: clean });
    try {
      setStatus('saving');
      await saveParticipant(pollId, next.id, { name: clean, slots: [...mine] });
      setStatus('saved');
      onReload();
    } catch (e) {
      setStatus('error');
      setError(e.message);
    }
  };

  // "That's me" — adopt an existing row instead of creating a duplicate when
  // someone opens the link on a second device.
  const claimExisting = (participant) => {
    onIdentity({ id: participant.id, name: participant.name });
    seededFor.current = null;
    setMenuOpen(false);
  };

  const clearMine = async () => {
    clearTimeout(timer.current);
    setMine(new Set());
    setMenuOpen(false);
    try {
      await deleteParticipant(pollId, identity.id);
      onIdentity({ ...identity, name: identity.name });
      onReload();
    } catch (e) {
      setError(e.message);
    }
  };

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError('Copy failed — grab the URL from the address bar.');
    }
  };

  // Everyone except me from the server, plus my live local state.
  const roster = useMemo(() => {
    const others = participants.filter((p) => p.id !== identity.id);
    return named ? [...others, { id: identity.id, name: identity.name, slots: [...mine] }] : others;
  }, [participants, identity, named, mine]);

  const counts = useMemo(() => {
    const map = {};
    for (const p of roster) {
      for (const s of p.slots || []) {
        (map[s] = map[s] || []).push(p.name);
      }
    }
    return map;
  }, [roster]);

  const headcount = Math.max(roster.length, 1);

  // Best windows: contiguous runs on one day where the same number of people are
  // free. Ranked by headcount first, then by how long the run is.
  const best = useMemo(() => {
    const runs = [];
    for (const date of poll.dates) {
      let run = null;
      for (let i = 0; i < slots; i++) {
        const c = (counts[ck(date, minsAt(i))] || []).length;
        if (run && run.count === c && c > 0) {
          run.end = i + 1;
        } else {
          if (run && run.count > 0) runs.push(run);
          run = c > 0 ? { date, start: i, end: i + 1, count: c } : null;
        }
      }
      if (run && run.count > 0) runs.push(run);
    }
    runs.sort(
      (a, b) => b.count - a.count || b.end - b.start - (a.end - a.start) || a.date.localeCompare(b.date)
    );
    return runs.filter((r) => r.count >= 2).slice(0, 3);
  }, [counts, poll.dates, slots, minsAt]);

  return (
    <div style={{ fontFamily: SANS }}>
      <Wordmark
        title={poll.title}
        sub={`${poll.dates.length} day${poll.dates.length > 1 ? 's' : ''} · ${fmtClock(poll.startHour * 60)}–${
          poll.endHour === 24 ? '12am' : fmtClock(poll.endHour * 60)
        }`}
      />

      <div className="rounded mb-4" style={{ background: C.panel, border: `1px solid ${C.hair}` }}>
        <div
          className="px-4 pt-3 pb-2 flex items-center justify-between"
          style={{ borderBottom: `1px solid ${C.hair}` }}
        >
          <span style={{ fontFamily: MONO, fontSize: 10, letterSpacing: '0.22em', color: C.dim }}>
            BEST WINDOWS
          </span>
          <span style={{ fontFamily: MONO, fontSize: 10, letterSpacing: '0.14em', color: C.dim }}>
            {roster.length} IN
          </span>
        </div>

        {best.length === 0 ? (
          <p className="px-4 py-4" style={{ color: C.dim, fontSize: 13 }}>
            Nothing overlaps yet. Mark your own times, then send the link around.
          </p>
        ) : (
          best.map((r, i) => {
            const dt = dparse(r.date);
            return (
              <div
                key={`${r.date}-${r.start}`}
                className="px-4 py-3 flex items-baseline justify-between gap-3"
                style={{ borderTop: i ? `1px solid ${C.hair}` : 'none' }}
              >
                <div>
                  <div style={{ fontFamily: MONO, fontSize: 15, fontWeight: 600, color: i === 0 ? C.ball : C.line }}>
                    {DOW[dt.getDay()]} {MON[dt.getMonth()]} {dt.getDate()}
                  </div>
                  <div style={{ fontFamily: MONO, fontSize: 12.5, color: C.dim, marginTop: 2 }}>
                    {fmtClock(minsAt(r.start))} – {fmtClock(minsAt(r.end))}
                  </div>
                </div>
                <div style={{ fontFamily: MONO, fontSize: 20, fontWeight: 700, color: i === 0 ? C.ball : C.line }}>
                  {r.count}
                  <span style={{ fontSize: 12, color: C.dim }}>/{headcount}</span>
                </div>
              </div>
            );
          })
        )}
      </div>

      {!named ? (
        <Panel>
          <Label>Who's playing</Label>
          <div className="flex gap-2 mt-2">
            <div className="flex-1">
              <TextField
                value={nameDraft}
                onChange={setNameDraft}
                onEnter={() => claimName(nameDraft)}
                placeholder="Your name"
                maxLength={40}
              />
            </div>
            <button
              type="button"
              onClick={() => claimName(nameDraft)}
              className="rounded px-4 focus:outline-none focus-visible:ring-2 focus-visible:ring-white"
              style={{ background: C.ball, color: C.ink, fontFamily: MONO, fontSize: 12, fontWeight: 700, letterSpacing: '0.12em' }}
            >
              GO
            </button>
          </div>
          {participants.length > 0 && (
            <div className="mt-3">
              <Label>Already marked times?</Label>
              <div className="flex flex-wrap gap-2 mt-2">
                {participants.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => claimExisting(p)}
                    className="rounded px-3 py-1"
                    style={{ border: `1px solid ${C.hair}`, color: C.line, fontSize: 12.5 }}
                  >
                    I'm {p.name}
                  </button>
                ))}
              </div>
            </div>
          )}
        </Panel>
      ) : (
        <div className="flex items-center justify-between gap-2 mb-3">
          <div className="flex rounded overflow-hidden" style={{ border: `1px solid ${C.hair}` }}>
            {[
              ['mine', 'My times'],
              ['all', 'Everyone'],
            ].map(([k, text]) => (
              <button
                key={k}
                type="button"
                onClick={() => {
                  setView(k);
                  setFocusCell(null);
                  if (k === 'all') refresh();
                }}
                className="px-4 py-2"
                style={{
                  background: view === k ? C.ball : 'transparent',
                  color: view === k ? C.ink : C.dim,
                  fontFamily: MONO,
                  fontSize: 11,
                  letterSpacing: '0.14em',
                  fontWeight: 600,
                }}
              >
                {text.toUpperCase()}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-1">
            <span style={{ fontFamily: MONO, fontSize: 10, color: status === 'error' ? C.coral : C.dim, letterSpacing: '0.1em' }}>
              {status === 'saving' ? 'SAVING' : status === 'error' ? 'RETRY' : 'SAVED'}
            </span>
            <IconBtn onClick={copyLink} label="Copy link">
              <Link2 size={15} />
            </IconBtn>
            <IconBtn onClick={refresh} label="Refresh">
              <RefreshCw size={15} className={refreshing ? 'animate-spin' : ''} />
            </IconBtn>
            <IconBtn onClick={() => setMenuOpen((v) => !v)} label="Options">
              <Settings2 size={15} />
            </IconBtn>
          </div>
        </div>
      )}

      {copied && <Notice>Link copied — paste it into Slack.</Notice>}
      {error && <Notice tone="bad">{error}</Notice>}

      {menuOpen && (
        <Panel>
          <button
            type="button"
            onClick={onOpenCourts}
            className="w-full text-left py-2 flex items-center gap-2"
            style={{ color: C.line, fontSize: 14 }}
          >
            <MapPin size={14} style={{ color: C.dim }} /> Court locations
          </button>
          <button
            type="button"
            onClick={onEditConfig}
            className="w-full text-left py-2 flex items-center gap-2"
            style={{ color: C.line, fontSize: 14 }}
          >
            <Pencil size={14} style={{ color: C.dim }} /> Change days or hours
          </button>
          <button
            type="button"
            onClick={clearMine}
            className="w-full text-left py-2 flex items-center gap-2"
            style={{ color: C.coral, fontSize: 14 }}
          >
            <Eraser size={14} /> Clear my times
          </button>
          <button
            type="button"
            onClick={() => {
              onIdentity({ ...identity, name: '' });
              setNameDraft('');
              setMenuOpen(false);
            }}
            className="w-full text-left py-2 flex items-center gap-2"
            style={{ color: C.dim, fontSize: 14 }}
          >
            <Users size={14} /> Switch player on this device
          </button>
        </Panel>
      )}

      <Grid
        poll={poll}
        mine={mine}
        onPaint={paint}
        view={view}
        counts={counts}
        headcount={headcount}
        focusCell={focusCell}
        onFocusCell={setFocusCell}
        enabled={named}
      />

      {view === 'all' && focusCell && (
        <div className="mt-3 rounded px-4 py-3" style={{ background: C.panelHi, border: `1px solid ${C.hair}` }}>
          <div style={{ fontFamily: MONO, fontSize: 11, color: C.dim, letterSpacing: '0.14em' }}>
            {(() => {
              const [d, m] = focusCell.split('#');
              const dt = dparse(d);
              return `${DOW[dt.getDay()].toUpperCase()} ${MON[dt.getMonth()].toUpperCase()} ${dt.getDate()} · ${fmtClock(Number(m))}`;
            })()}
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            {roster.map((p) => {
              const free = (p.slots || []).includes(focusCell);
              return (
                <span
                  key={p.id}
                  className="rounded px-2 py-1 flex items-center gap-1"
                  style={{
                    background: free ? C.ball : 'transparent',
                    color: free ? C.ink : C.dim,
                    border: `1px solid ${free ? C.ball : C.hair}`,
                    fontSize: 12.5,
                  }}
                >
                  {free && <Check size={12} />}
                  {p.name}
                </span>
              );
            })}
          </div>
        </div>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-2">
        {roster.length === 0 && <span style={{ color: C.dim, fontSize: 13 }}>No one has marked times yet.</span>}
        {roster.map((p) => (
          <span key={p.id} className="rounded px-3 py-1" style={{ border: `1px solid ${C.hair}`, color: C.line, fontSize: 12.5 }}>
            {p.name}
            <span style={{ fontFamily: MONO, color: C.dim, marginLeft: 6, fontSize: 11 }}>
              {(p.slots || []).length * 30}m
            </span>
          </span>
        ))}
      </div>

      <Notice>
        {view === 'mine'
          ? 'Drag across the grid to paint the blocks you could play. Everyone opening this link marks their own — and sees everyone else\u2019s.'
          : 'Brighter blocks mean more players free. Tap a block to see who.'}
      </Notice>
    </div>
  );
}
