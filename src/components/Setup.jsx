import { useMemo, useState } from 'react';
import { C, MONO, SANS } from '../theme.js';
import { DOW, dkey, fmtClock } from '../lib/time.js';
import { Wordmark, Panel, Label, Tiny, TextField, Notice } from './ui.jsx';

const HORIZON_DAYS = 28;

export default function Setup({ initial, onSubmit, onCancel, busy, error, onOpenCourts }) {
  const today = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);

  const days = useMemo(
    () =>
      Array.from({ length: HORIZON_DAYS }, (_, i) => {
        const d = new Date(today);
        d.setDate(d.getDate() + i);
        return d;
      }),
    [today]
  );

  const [title, setTitle] = useState(initial?.title ?? 'Pickleball');
  const [sel, setSel] = useState(new Set(initial?.dates ?? []));
  const [startHour, setStartHour] = useState(initial?.startHour ?? 17);
  const [endHour, setEndHour] = useState(initial?.endHour ?? 21);

  const toggle = (k) =>
    setSel((prev) => {
      const n = new Set(prev);
      if (n.has(k)) n.delete(k);
      else n.add(k);
      return n;
    });

  const quick = (fn) => setSel(new Set(days.filter(fn).map(dkey)));

  const valid = sel.size > 0 && endHour > startHour && !busy;

  const submit = () => {
    if (!valid) return;
    onSubmit({
      title: title.trim() || 'Pickleball',
      dates: [...sel].sort(),
      startHour,
      endHour,
    });
  };

  return (
    <div style={{ fontFamily: SANS }}>
      <Wordmark
        title={initial ? 'Edit the grid' : 'Pickleball'}
        sub={initial ? 'Days and hours' : 'Set the window, then send the link'}
      />

      <Panel>
        <Label>What are we calling it</Label>
        <div className="mt-2">
          <TextField value={title} onChange={setTitle} maxLength={60} onEnter={submit} />
        </div>
      </Panel>

      <Panel>
        <div className="flex items-baseline justify-between gap-3 flex-wrap">
          <Label>Days in play</Label>
          <div className="flex gap-3">
            <Tiny onClick={() => quick((d) => d < new Date(today.getTime() + 7 * 864e5))}>Next 7</Tiny>
            <Tiny onClick={() => quick((d) => d.getDay() === 0 || d.getDay() === 6)}>Weekends</Tiny>
            <Tiny onClick={() => setSel(new Set())}>Clear</Tiny>
          </div>
        </div>

        <div className="grid grid-cols-7 gap-1 mt-3">
          {days.map((d) => {
            const k = dkey(d);
            const on = sel.has(k);
            const weekend = d.getDay() === 0 || d.getDay() === 6;
            return (
              <button
                key={k}
                type="button"
                onClick={() => toggle(k)}
                aria-pressed={on}
                className="rounded py-2 text-center focus:outline-none focus-visible:ring-2 focus-visible:ring-white"
                style={{
                  background: on ? C.ball : C.deep,
                  color: on ? C.ink : weekend ? C.line : C.dim,
                  border: `1px solid ${on ? C.ball : C.hair}`,
                  fontFamily: MONO,
                }}
              >
                <div style={{ fontSize: 9, letterSpacing: '0.1em', opacity: 0.8 }}>
                  {DOW[d.getDay()].slice(0, 2)}
                </div>
                <div style={{ fontSize: 14, fontWeight: 600 }}>{d.getDate()}</div>
              </button>
            );
          })}
        </div>
      </Panel>

      <Panel>
        <Label>Hours worth asking about</Label>
        <div className="flex items-center gap-3 mt-3">
          <HourSelect
            value={startHour}
            from={5}
            to={22}
            onChange={(v) => {
              setStartHour(v);
              if (v >= endHour) setEndHour(Math.min(24, v + 2));
            }}
          />
          <span style={{ color: C.dim, fontFamily: MONO, fontSize: 12 }}>to</span>
          <HourSelect value={endHour} from={startHour + 1} to={24} onChange={setEndHour} />
        </div>
        <Notice>Marked in 30-minute blocks. Keep the window tight — a shorter grid gets filled in.</Notice>
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
          {busy ? 'Working' : initial ? 'Save changes' : 'Open the grid'}
        </button>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="rounded px-4"
            style={{ border: `1px solid ${C.hair}`, color: C.dim, fontFamily: MONO, fontSize: 12 }}
          >
            Back
          </button>
        )}
      </div>

      {error && <Notice tone="bad">{error}</Notice>}
      {!error && sel.size === 0 && <Notice>Pick at least one day to continue.</Notice>}

      {onOpenCourts && (
        <div className="mt-5 pt-4" style={{ borderTop: `1px solid ${C.hair}` }}>
          <Tiny onClick={onOpenCourts}>Court locations →</Tiny>
        </div>
      )}
    </div>
  );
}

function HourSelect({ value, onChange, from, to }) {
  const opts = [];
  for (let h = from; h <= to; h++) opts.push(h);
  return (
    <select
      value={value}
      onChange={(e) => onChange(Number(e.target.value))}
      className="rounded px-3 py-2 outline-none focus-visible:ring-2 focus-visible:ring-white"
      style={{ background: C.deep, color: C.line, border: `1px solid ${C.hair}`, fontFamily: MONO, fontSize: 14 }}
    >
      {opts.map((h) => (
        <option key={h} value={h} style={{ background: C.deep }}>
          {h === 24 ? '12am' : fmtClock(h * 60)}
        </option>
      ))}
    </select>
  );
}
