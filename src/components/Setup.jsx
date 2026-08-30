import { useMemo, useState } from 'react';
import { C, MONO, SANS } from '../theme.js';
import {
  DOW,
  MON,
  dkey,
  dparse,
  fmtClock,
  horizonDays,
  defaultDates,
  startOfToday,
  HORIZON_DAYS,
  MAX_HORIZON_DAYS,
  EXTEND_DAYS,
  DEFAULT_START_HOUR,
  DEFAULT_END_HOUR,
} from '../lib/time.js';
import { Wordmark, Panel, Label, Tiny, TextField, Notice } from './ui.jsx';

export default function Setup({ initial, onSubmit, onCancel, busy, error, onOpenCourts }) {
  // How far out the day chips reach. Four weeks unless the poll being edited
  // already runs past that, in which case the picker has to show the days it
  // holds — otherwise editing the hours would silently hide half the calendar.
  const [horizon, setHorizon] = useState(() => horizonFor(initial?.dates));
  const days = useMemo(() => horizonDays(horizon), [horizon]);
  const months = useMemo(() => monthsOf(days), [days]);
  const canExtend = horizon < MAX_HORIZON_DAYS;

  const [title, setTitle] = useState(initial?.title ?? 'Pickleball');
  const [sel, setSel] = useState(() => new Set(initial?.dates ?? defaultDates()));
  const [startHour, setStartHour] = useState(initial?.startHour ?? DEFAULT_START_HOUR);
  const [endHour, setEndHour] = useState(initial?.endHour ?? DEFAULT_END_HOUR);

  // Creating a poll shouldn't require any decisions: the defaults already cover
  // more than the group will use, and the calendar is where people narrow it
  // down. Editing is the opposite — that's the one screen you open *to* change
  // the days and hours — so it starts unfolded.
  const [custom, setCustom] = useState(!!initial);

  const toggle = (k) =>
    setSel((prev) => {
      const n = new Set(prev);
      if (n.has(k)) n.delete(k);
      else n.add(k);
      return n;
    });

  const quick = (fn) => setSel(new Set(days.filter(fn).map(dkey)));

  // Reaching further out shows more chips; it doesn't tick them. Nobody wants a
  // twelve-week poll by accident, and the new weeks are one "All" away.
  const extend = () => setHorizon((h) => Math.min(MAX_HORIZON_DAYS, h + EXTEND_DAYS));

  const wholeHorizon = sel.size === days.length && days.every((d) => sel.has(dkey(d)));

  const summary = `${
    wholeHorizon ? `Every day for ${days.length / 7} weeks` : `${sel.size} day${sel.size === 1 ? '' : 's'}`
  } · ${fmtClock(startHour * 60)}–${endHour === 24 ? '12am' : fmtClock(endHour * 60)}`;

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
        title={initial ? 'Edit the calendar' : 'Pickleball'}
        sub={initial ? 'Days and hours' : 'Name it, send the link, everyone marks their times'}
      />

      <Panel>
        <Label>What are we calling it</Label>
        <div className="mt-2">
          <TextField value={title} onChange={setTitle} maxLength={60} onEnter={submit} />
        </div>
      </Panel>

      <Panel>
        <div className="flex items-baseline justify-between gap-3">
          <Label>What's on the calendar</Label>
          <Tiny onClick={() => setCustom((v) => !v)}>{custom ? 'Done' : 'Narrow it down'}</Tiny>
        </div>

        <div className="mt-2" style={{ fontFamily: MONO, fontSize: 15, color: C.line }}>
          {summary}
        </div>

        {!custom && (
          <Notice>
            Everyone picks the blocks that work for them, week by week. Only narrow this if whole
            days or hours are off the table for the entire group.
          </Notice>
        )}

        {custom && (
          <>
            <div className="flex items-baseline justify-between gap-3 mt-4">
              <Label>Days in play</Label>
              <div className="flex gap-3">
                <Tiny onClick={() => setSel(new Set(days.map(dkey)))}>All</Tiny>
                <Tiny onClick={() => quick((d) => d < new Date(days[0].getTime() + 7 * 864e5))}>Next 7</Tiny>
                <Tiny onClick={() => quick((d) => d.getDay() === 0 || d.getDay() === 6)}>Weekends</Tiny>
                <Tiny onClick={() => setSel(new Set())}>Clear</Tiny>
              </div>
            </div>

            {/* Chips sit in month blocks under a fixed SUN..SAT header rather than
                one continuous run. Four rows of bare numbers you can read; twelve
                rows of them, spanning three or four months, you cannot. The first
                chip of each block starts in its own weekday column, so the whole
                picker reads as a wall calendar — the same shape the poll itself
                opens into. */}
            <div className="grid grid-cols-7 gap-1 mt-3 pb-1">
              {DOW.map((d) => (
                <div
                  key={d}
                  className="text-center"
                  style={{ fontFamily: MONO, fontSize: 9, letterSpacing: '0.12em', color: C.dim }}
                >
                  {d.slice(0, 2).toUpperCase()}
                </div>
              ))}
            </div>

            {months.map((m) => (
              <div key={m.key}>
                <div
                  className="pt-2 pb-1"
                  style={{ fontFamily: MONO, fontSize: 10, letterSpacing: '0.22em', color: C.dim }}
                >
                  {m.label.toUpperCase()}
                </div>
                <div className="grid grid-cols-7 gap-1">
                  {m.days.map((d, i) => {
                    const k = dkey(d);
                    const on = sel.has(k);
                    const weekend = d.getDay() === 0 || d.getDay() === 6;
                    return (
                      <button
                        key={k}
                        type="button"
                        onClick={() => toggle(k)}
                        aria-pressed={on}
                        aria-label={`${DOW[d.getDay()]} ${m.label} ${d.getDate()}`}
                        className="rounded py-2 text-center focus:outline-none focus-visible:ring-2 focus-visible:ring-white"
                        style={{
                          gridColumnStart: i === 0 ? d.getDay() + 1 : undefined,
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
              </div>
            ))}

            {canExtend ? (
              <button
                type="button"
                onClick={extend}
                className="w-full rounded py-2 mt-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-white"
                style={{
                  border: `1px dashed ${C.hair}`,
                  color: C.dim,
                  fontFamily: MONO,
                  fontSize: 11,
                  letterSpacing: '0.14em',
                }}
              >
                + {EXTEND_DAYS / 7} MORE WEEKS
              </button>
            ) : (
              <Notice>
                {MAX_HORIZON_DAYS / 7} weeks is as far out as one poll reaches. Start a second one for
                anything past {months.at(-1)?.label}.
              </Notice>
            )}

            <div className="mt-5">
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
              <Notice>Marked in 30-minute blocks.</Notice>
            </div>
          </>
        )}
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
          {busy ? 'Working' : initial ? 'Save changes' : 'Open the calendar'}
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

/**
 * How far the picker has to reach to show a poll's own days. Four weeks for a new
 * poll; for one being edited, far enough to cover its furthest day, rounded up to
 * a whole week so the chip grid keeps its shape.
 */
function horizonFor(dates) {
  if (!dates?.length) return HORIZON_DAYS;
  const today = startOfToday().getTime();
  // Rounded, not floored: a DST boundary inside the span shifts the raw division
  // by an hour, which would otherwise buy a whole extra week.
  const furthest = Math.max(...dates.map((d) => Math.round((dparse(d).getTime() - today) / 864e5)));
  const weeks = Math.ceil((furthest + 1) / 7) * 7;
  return Math.min(MAX_HORIZON_DAYS, Math.max(HORIZON_DAYS, weeks));
}

/** Consecutive days split into calendar months, in order. */
function monthsOf(days) {
  const out = [];
  for (const d of days) {
    const key = `${d.getFullYear()}-${d.getMonth()}`;
    if (out.at(-1)?.key !== key) {
      out.push({ key, label: `${MON[d.getMonth()]} ${d.getFullYear()}`, days: [] });
    }
    out.at(-1).days.push(d);
  }
  return out;
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
