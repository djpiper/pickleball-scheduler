import { useState, useEffect, useMemo, useCallback } from 'react';
import { Plus, Pencil, Trash2, Loader2, Check } from 'lucide-react';
import { C, MONO, SANS } from '../theme.js';
import { fetchCourts, createCourt, updateCourt, deleteCourt } from '../lib/api.js';
import { LIMITS, SURFACES } from '../../shared/validate.js';
import { Wordmark, Panel, Label, TextField, TextArea, Notice, Toggle, Segmented } from './ui.jsx';

// The directory itself is site-wide and unowned — anyone can edit or remove any
// entry. Voting is the one part that is per-poll: `vote` below is supplied by the
// Board's COURTS tab and left undefined by the standalone /?courts page, which is
// the whole difference between "browse the list" and "back the ones that work".

const SURFACE_LABEL = {
  concrete: 'Concrete',
  asphalt: 'Asphalt',
  tile: 'Sport tile',
  wood: 'Wood',
  other: 'Other',
};

const BLANK = {
  name: '',
  area: '',
  courtCount: 2,
  indoor: false,
  lighted: false,
  tennis: false,
  surface: '',
  notes: '',
};

// Matches the server's `ORDER BY name COLLATE NOCASE`, so an added row lands where
// a reload would have put it.
const byName = (list) => [...list].sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));

/**
 * The court list, with add/edit/delete. Pass `vote` to turn it into a ballot:
 *   { mine: Set<courtId>, counts: {courtId: [name]}, headcount, enabled, onToggle }
 */
export function CourtDirectory({ vote, header, onBack }) {
  const [courts, setCourts] = useState([]);
  const [status, setStatus] = useState('loading'); // loading | ready | error
  const [loadError, setLoadError] = useState('');
  const [editing, setEditing] = useState(null); // null | 'new' | <court id>
  const [confirming, setConfirming] = useState(null); // court id awaiting delete confirm
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setStatus('loading');
    try {
      const { courts: rows } = await fetchCourts();
      setCourts(rows);
      setStatus('ready');
    } catch (e) {
      setLoadError(e.message);
      setStatus('error');
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // While voting, the most-backed court rises to the top — the list doubles as the
  // result. Ties and the no-votes-yet case fall back to the name order.
  const ordered = useMemo(() => {
    if (!vote) return courts;
    const score = (c) => (vote.counts[c.id] || []).length;
    return [...courts].sort(
      (a, b) => score(b) - score(a) || a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })
    );
  }, [courts, vote]);

  const save = async (values) => {
    setBusy(true);
    setError('');
    try {
      if (editing === 'new') {
        const { court } = await createCourt(values);
        setCourts((prev) => byName([...prev, court]));
      } else {
        const { court } = await updateCourt(editing, values);
        setCourts((prev) => byName(prev.map((c) => (c.id === court.id ? court : c))));
      }
      setEditing(null);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const remove = async (id) => {
    setConfirming(null);
    setError('');
    try {
      await deleteCourt(id);
      setCourts((prev) => prev.filter((c) => c.id !== id));
    } catch (e) {
      setError(e.message);
    }
  };

  const openForm = (id) => {
    setEditing(id);
    setConfirming(null);
    setError('');
  };

  const current = editing && editing !== 'new' ? courts.find((c) => c.id === editing) : null;

  if (status === 'loading') {
    return (
      <div className="flex items-center py-10" style={{ color: C.dim, fontFamily: MONO }}>
        <Loader2 className="animate-spin" size={16} />
        <span className="ml-2 text-xs uppercase" style={{ letterSpacing: '0.18em' }}>
          Checking the courts
        </span>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <>
        <Notice tone="bad">{loadError}</Notice>
        <button
          type="button"
          onClick={load}
          className="rounded px-4 py-2 mt-3"
          style={{ border: `1px solid ${C.hair}`, color: C.line, fontFamily: MONO, fontSize: 12 }}
        >
          TRY AGAIN
        </button>
      </>
    );
  }

  if (editing) {
    return (
      <CourtForm
        key={editing}
        initial={current ?? BLANK}
        isNew={editing === 'new'}
        onSave={save}
        onCancel={() => {
          setEditing(null);
          setError('');
        }}
        busy={busy}
        error={error}
      />
    );
  }

  return (
    <>
      {courts.length === 0 ? (
        <Panel>
          <p style={{ color: C.dim, fontSize: 13 }}>No courts on the list yet — add the first one.</p>
        </Panel>
      ) : (
        <div className="rounded mb-3" style={{ background: C.panel, border: `1px solid ${C.hair}` }}>
          {header}
          {ordered.map((court, i) => (
            <CourtRow
              key={court.id}
              court={court}
              first={i === 0 && !header}
              leader={!!vote && i === 0 && (vote.counts[court.id] || []).length > 0}
              vote={vote}
              confirming={confirming === court.id}
              onEdit={() => openForm(court.id)}
              onAskDelete={() => setConfirming(court.id)}
              onCancelDelete={() => setConfirming(null)}
              onDelete={() => remove(court.id)}
            />
          ))}
        </div>
      )}

      {error && <Notice tone="bad">{error}</Notice>}

      <div className="flex gap-2 mt-4">
        <button
          type="button"
          onClick={() => openForm('new')}
          className="flex-1 rounded py-3 uppercase flex items-center justify-center gap-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-white"
          style={{
            background: C.ball,
            color: C.ink,
            fontFamily: MONO,
            fontSize: 12,
            fontWeight: 700,
            letterSpacing: '0.16em',
          }}
        >
          <Plus size={15} /> Add a court
        </button>
        {onBack && (
          <button
            type="button"
            onClick={onBack}
            className="rounded px-4"
            style={{ border: `1px solid ${C.hair}`, color: C.dim, fontFamily: MONO, fontSize: 12 }}
          >
            Back
          </button>
        )}
      </div>
    </>
  );
}

export default function Courts({ onBack }) {
  return (
    <div style={{ fontFamily: SANS }}>
      <Wordmark title="Court locations" sub="Where we could play" />
      <CourtDirectory onBack={onBack} />
      <Notice>
        Anyone with the link can add or correct an entry. Keep it to places this group
        can actually turn up and play.
      </Notice>
    </div>
  );
}

function CourtRow({ court, first, leader, vote, confirming, onEdit, onAskDelete, onCancelDelete, onDelete }) {
  const tags = [
    court.indoor ? 'Indoor' : 'Outdoor',
    court.lighted && 'Lighted',
    court.tennis && 'Shared w/ tennis',
    court.surface && SURFACE_LABEL[court.surface],
  ].filter(Boolean);

  const picked = !!vote && vote.mine.has(court.id);
  const backers = vote ? (vote.counts[court.id] || []).length : 0;

  const body = (
    <>
      <div className="flex items-baseline justify-between gap-3">
        <div className="flex items-baseline gap-2" style={{ minWidth: 0 }}>
          {vote && (
            <span
              className="rounded flex items-center justify-center shrink-0"
              style={{
                width: 16,
                height: 16,
                background: picked ? C.ball : 'transparent',
                border: `1px solid ${picked ? C.ball : C.hair}`,
                color: C.ink,
                alignSelf: 'center',
              }}
            >
              {picked && <Check size={11} strokeWidth={3} />}
            </span>
          )}
          <span
            style={{
              fontFamily: MONO,
              fontSize: 15,
              fontWeight: 600,
              color: leader ? C.ball : C.line,
            }}
          >
            {court.name}
          </span>
        </div>
        <div style={{ fontFamily: MONO, fontSize: 13, color: C.line, whiteSpace: 'nowrap' }}>
          {vote ? (
            <span style={{ fontSize: 17, fontWeight: 700, color: leader ? C.ball : C.line }}>
              {backers}
              <span style={{ fontSize: 12, color: C.dim }}>/{vote.headcount}</span>
            </span>
          ) : (
            <>
              {court.courtCount}
              <span style={{ color: C.dim, fontSize: 11, marginLeft: 4 }}>
                {court.courtCount === 1 ? 'COURT' : 'COURTS'}
              </span>
            </>
          )}
        </div>
      </div>

      <div className="flex flex-wrap gap-1 mt-2">
        {vote && (
          <span
            className="rounded px-2 py-1"
            style={{
              background: C.panelHi,
              color: C.line,
              fontFamily: MONO,
              fontSize: 10,
              letterSpacing: '0.12em',
            }}
          >
            {court.courtCount} {court.courtCount === 1 ? 'COURT' : 'COURTS'}
          </span>
        )}
        {tags.map((t) => (
          <span
            key={t}
            className="rounded px-2 py-1"
            style={{
              background: C.panelHi,
              color: C.line,
              fontFamily: MONO,
              fontSize: 10,
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
            }}
          >
            {t}
          </span>
        ))}
      </div>

      {court.area && <div style={{ color: C.dim, fontSize: 13, marginTop: 8 }}>{court.area}</div>}
      {court.notes && (
        <div style={{ color: C.dim, fontSize: 12.5, marginTop: 4, lineHeight: 1.5 }}>{court.notes}</div>
      )}
    </>
  );

  return (
    <div className="px-4 py-3" style={{ borderTop: first ? 'none' : `1px solid ${C.hair}` }}>
      {vote && vote.enabled ? (
        <button
          type="button"
          onClick={() => vote.onToggle(court.id)}
          aria-pressed={picked}
          aria-label={`${picked ? 'Withdraw' : 'Back'} ${court.name}`}
          className="w-full text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-white rounded"
        >
          {body}
        </button>
      ) : (
        body
      )}

      {vote && backers > 0 && (
        <div className="mt-2 flex items-baseline gap-2">
          <span
            style={{
              fontFamily: MONO,
              fontSize: 9.5,
              letterSpacing: '0.18em',
              color: C.dim,
              textTransform: 'uppercase',
              whiteSpace: 'nowrap',
            }}
          >
            Backed by
          </span>
          <span style={{ color: C.line, fontSize: 12.5 }}>{vote.counts[court.id].join(', ')}</span>
        </div>
      )}

      <div className="flex items-center gap-3 mt-3">
        {confirming ? (
          <>
            <button
              type="button"
              onClick={onDelete}
              style={{ color: C.coral, fontFamily: MONO, fontSize: 10.5, letterSpacing: '0.12em' }}
            >
              DELETE FOR EVERYONE
            </button>
            <button
              type="button"
              onClick={onCancelDelete}
              style={{ color: C.dim, fontFamily: MONO, fontSize: 10.5, letterSpacing: '0.12em' }}
            >
              KEEP IT
            </button>
          </>
        ) : (
          <>
            <button
              type="button"
              onClick={onEdit}
              aria-label={`Edit ${court.name}`}
              className="flex items-center gap-1"
              style={{ color: C.dim, fontFamily: MONO, fontSize: 10.5, letterSpacing: '0.12em' }}
            >
              <Pencil size={12} /> EDIT
            </button>
            <button
              type="button"
              onClick={onAskDelete}
              aria-label={`Remove ${court.name}`}
              className="flex items-center gap-1"
              style={{ color: C.dim, fontFamily: MONO, fontSize: 10.5, letterSpacing: '0.12em' }}
            >
              <Trash2 size={12} /> REMOVE
            </button>
          </>
        )}
      </div>
    </div>
  );
}

export function CourtForm({ initial, isNew, onSave, onCancel, busy, error }) {
  const [name, setName] = useState(initial.name);
  const [area, setArea] = useState(initial.area);
  const [courtCount, setCourtCount] = useState(initial.courtCount);
  const [indoor, setIndoor] = useState(initial.indoor);
  const [lighted, setLighted] = useState(initial.lighted);
  const [tennis, setTennis] = useState(initial.tennis);
  const [surface, setSurface] = useState(initial.surface);
  const [notes, setNotes] = useState(initial.notes);

  const valid = name.trim().length > 0 && !busy;

  const submit = () => {
    if (!valid) return;
    onSave({ name: name.trim(), area: area.trim(), courtCount, indoor, lighted, tennis, surface, notes: notes.trim() });
  };

  return (
    <div>
      <Panel>
        <Label>What's it called</Label>
        <div className="mt-2">
          <TextField
            value={name}
            onChange={setName}
            onEnter={submit}
            placeholder="Riverside Park"
            maxLength={LIMITS.courtName}
          />
        </div>

        <div className="mt-4">
          <Label>Where</Label>
          <div className="mt-2">
            <TextField
              value={area}
              onChange={setArea}
              onEnter={submit}
              placeholder="312 Elm St, or just the neighbourhood"
              maxLength={LIMITS.area}
            />
          </div>
        </div>
      </Panel>

      <Panel>
        <Label>How many courts</Label>
        <div className="mt-2">
          <Picker
            value={courtCount}
            onChange={(v) => setCourtCount(Number(v))}
            options={Array.from({ length: LIMITS.courtCount }, (_, i) => [i + 1, String(i + 1)])}
          />
        </div>

        <div className="mt-4">
          <Label>Indoor or out</Label>
          <div className="mt-2">
            <Segmented
              value={indoor}
              onChange={setIndoor}
              options={[
                [false, 'Outdoor'],
                [true, 'Indoor'],
              ]}
            />
          </div>
        </div>

        <div className="mt-4">
          <Label>Anything else true of it</Label>
          <div className="flex flex-wrap gap-2 mt-2">
            <Toggle value={lighted} onChange={setLighted}>
              Lighted
            </Toggle>
            <Toggle value={tennis} onChange={setTennis}>
              Also a tennis court
            </Toggle>
          </div>
        </div>

        <div className="mt-4">
          <Label>Surface</Label>
          <div className="mt-2">
            <Picker
              value={surface}
              onChange={setSurface}
              options={[['', 'Not sure'], ...SURFACES.map((s) => [s, SURFACE_LABEL[s]])]}
            />
          </div>
        </div>
      </Panel>

      <Panel>
        <Label>Worth knowing</Label>
        <div className="mt-2">
          <TextArea
            value={notes}
            onChange={setNotes}
            placeholder="Bring your own net. Busy after 6."
            maxLength={LIMITS.notes}
          />
        </div>
      </Panel>

      <div className="flex gap-2 mt-5">
        <button
          type="button"
          onClick={submit}
          disabled={!valid}
          className="flex-1 rounded py-3 uppercase focus:outline-none focus-visible:ring-2 focus-visible:ring-white"
          style={{
            background: valid ? C.ball : C.panelHi,
            color: valid ? C.ink : C.dim,
            fontFamily: MONO,
            fontSize: 12,
            fontWeight: 700,
            letterSpacing: '0.16em',
            opacity: valid ? 1 : 0.7,
          }}
        >
          {busy ? 'Working' : isNew ? 'Add it to the list' : 'Save changes'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded px-4"
          style={{ border: `1px solid ${C.hair}`, color: C.dim, fontFamily: MONO, fontSize: 12 }}
        >
          Back
        </button>
      </div>

      {error && <Notice tone="bad">{error}</Notice>}
      {!error && !name.trim() && <Notice>Give it a name to continue.</Notice>}
    </div>
  );
}

// Same styling as Setup.jsx's HourSelect — a plain select, because a dropdown of
// known values beats a free-text field nobody validates.
function Picker({ value, onChange, options }) {
  return (
    <select
      value={String(value)}
      onChange={(e) => {
        const raw = e.target.value;
        const match = options.find(([v]) => String(v) === raw);
        onChange(match ? match[0] : raw);
      }}
      className="rounded px-3 py-2 outline-none focus-visible:ring-2 focus-visible:ring-white"
      style={{ background: C.deep, color: C.line, border: `1px solid ${C.hair}`, fontFamily: MONO, fontSize: 14 }}
    >
      {options.map(([v, text]) => (
        <option key={String(v)} value={String(v)} style={{ background: C.deep }}>
          {text}
        </option>
      ))}
    </select>
  );
}
