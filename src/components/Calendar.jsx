import { useMemo, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { C, MONO } from '../theme.js';
import { DOW, MON, dkey, ck, weeksOf, fmtSpan, slotCountFor, minsAtFor } from '../lib/time.js';
import Grid from './Grid.jsx';

/**
 * The month view. Weeks stack like a wall calendar; clicking one opens it
 * accordion-style into the painting grid for those seven days.
 *
 * The default poll is four weeks of 9am–9pm, which is 672 cells — a single flat
 * grid of that would be a horizontal scroll nobody finishes. A week is the unit
 * people actually think in ("I'm free Thursday evening"), it fits a phone
 * without scrolling sideways, and the collapsed rows still carry the answer:
 * each day is tinted by how much of it is claimed, so you can see where the
 * group is converging before opening anything.
 *
 * `highlight` and `stickyTop` are passed straight through to whichever week is
 * open — the roster outline and the pinned day header are the grid's business.
 */
export default function Calendar({
  poll,
  mine,
  onPaint,
  view,
  counts,
  headcount,
  focusCell,
  onFocusCell,
  enabled,
  highlight,
  stickyTop,
}) {
  const slots = slotCountFor(poll);
  const minsAt = useMemo(() => minsAtFor(poll), [poll]);
  const todayKey = useMemo(() => dkey(new Date()), []);

  // Weeks, each tagged with the month heading it should sit under (only the
  // first week of a month gets one).
  const weeks = useMemo(() => {
    let last = '';
    return weeksOf(poll.dates).map((w) => {
      const first = (w.cells.find((c) => c.active) ?? w.cells[0]).date;
      const month = `${MON[first.getMonth()]} ${first.getFullYear()}`;
      const heading = month === last ? null : month;
      last = month;
      return { ...w, heading };
    });
  }, [poll.dates]);

  // One week open at a time, starting on the one containing today. Held as a
  // date key rather than an index so editing the poll's days can't leave the
  // accordion pointing at a week that no longer exists.
  const [openWeek, setOpenWeek] = useState(
    () => (weeks.find((w) => w.dates.includes(todayKey)) ?? weeks[0])?.start ?? null
  );

  // A key that no longer matches a week — the organiser edited the poll's days
  // out from under us — falls back to the first week. `null` is different: it
  // means the reader closed everything on purpose, and must stay closed.
  const open =
    openWeek === null || weeks.some((w) => w.start === openWeek) ? openWeek : weeks[0]?.start;

  // Per-day rollups for the collapsed strip: how much of the day I've claimed,
  // and the most people free at any one moment in it.
  const stats = useMemo(() => {
    const out = {};
    for (const d of poll.dates) {
      let claimed = 0;
      let peak = 0;
      for (let i = 0; i < slots; i++) {
        const k = ck(d, minsAt(i));
        if (mine.has(k)) claimed++;
        const c = counts[k]?.length ?? 0;
        if (c > peak) peak = c;
      }
      out[d] = { claimed, peak };
    }
    return out;
  }, [poll.dates, slots, minsAt, mine, counts]);

  const columns = 'repeat(7, minmax(0, 1fr)) 22px';

  return (
    <div className="rounded" style={{ border: `1px solid ${C.hair}`, background: C.panel }}>
      <div className="grid px-2 pt-3 pb-1" style={{ gridTemplateColumns: columns }}>
        {DOW.map((d) => (
          <div
            key={d}
            className="text-center"
            style={{ fontFamily: MONO, fontSize: 9, letterSpacing: '0.14em', color: C.dim }}
          >
            {d.toUpperCase()}
          </div>
        ))}
        <div />
      </div>

      {weeks.map((w) => {
        const isOpen = w.start === open;
        const panelId = `week-${w.start}`;

        const claimed = w.dates.reduce((n, d) => n + stats[d].claimed, 0);
        const peak = w.dates.reduce((n, d) => Math.max(n, stats[d].peak), 0);
        const summary =
          view === 'mine'
            ? claimed
              ? `${fmtSpan(claimed)} marked`
              : 'Nothing marked'
            : peak
              ? `${peak} of ${headcount} free`
              : 'No overlap yet';

        return (
          <div key={w.start} style={{ borderTop: `1px solid ${C.hair}` }}>
            {w.heading && (
              <div
                className="px-3 pt-3"
                style={{ fontFamily: MONO, fontSize: 10, letterSpacing: '0.22em', color: C.dim }}
              >
                {w.heading.toUpperCase()}
              </div>
            )}

            <button
              type="button"
              onClick={() => setOpenWeek(isOpen ? null : w.start)}
              aria-expanded={isOpen}
              aria-controls={panelId}
              className="w-full px-2 py-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-white"
              style={{ background: isOpen ? C.panelHi : 'transparent', display: 'block' }}
            >
              <div className="flex items-baseline justify-between gap-3 px-1 pb-1.5">
                <span style={{ fontFamily: MONO, fontSize: 11.5, color: C.line, letterSpacing: '0.08em' }}>
                  {range(w)}
                </span>
                <span style={{ fontFamily: MONO, fontSize: 10, color: C.dim, letterSpacing: '0.1em' }}>
                  {summary.toUpperCase()}
                </span>
              </div>

              <div className="grid items-center" style={{ gridTemplateColumns: columns }}>
                {w.cells.map((c) => (
                  <DayCell
                    key={c.key}
                    cell={c}
                    stat={stats[c.key]}
                    view={view}
                    slots={slots}
                    headcount={headcount}
                    today={c.key === todayKey}
                  />
                ))}
                <ChevronDown
                  size={14}
                  style={{
                    color: C.dim,
                    justifySelf: 'center',
                    transform: isOpen ? 'rotate(180deg)' : 'none',
                    transition: 'transform 140ms',
                  }}
                />
              </div>
            </button>

            {isOpen && (
              <div id={panelId} className="px-2 pb-3">
                <Grid
                  poll={poll}
                  dates={w.dates}
                  mine={mine}
                  onPaint={onPaint}
                  view={view}
                  counts={counts}
                  headcount={headcount}
                  focusCell={focusCell}
                  onFocusCell={onFocusCell}
                  enabled={enabled}
                  highlight={highlight}
                  stickyTop={stickyTop}
                />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function DayCell({ cell, stat, view, slots, headcount, today }) {
  if (!cell.active) {
    return (
      <div
        className="py-1.5 text-center"
        style={{ fontFamily: MONO, fontSize: 13, color: C.dim, opacity: 0.35 }}
      >
        {cell.date.getDate()}
      </div>
    );
  }

  // A bar rather than a tinted cell: ball yellow washed over the panel at half
  // strength goes olive, and four weeks of olive squares tells you nothing. A
  // filled rail keeps the yellow at full strength and stays readable at 40px
  // wide. It measures the same thing the day opens into — how much of the day I
  // claimed, or how much of the group is free at the day's best moment.
  const fill = view === 'mine' ? stat.claimed / slots : stat.peak / headcount;
  const caption =
    view === 'mine'
      ? stat.claimed
        ? fmtSpan(stat.claimed)
        : ''
      : stat.peak
        ? `${stat.peak}/${headcount}`
        : '';

  return (
    <div
      className="rounded py-1.5 px-1 text-center"
      style={{ border: `1px solid ${today ? C.line : 'transparent'}`, fontFamily: MONO }}
    >
      <div style={{ fontSize: 13, fontWeight: 600, color: fill ? C.line : C.dim }}>
        {cell.date.getDate()}
      </div>
      <div className="rounded mt-1" style={{ height: 3, background: C.hair }}>
        {fill > 0 && (
          <div
            className="rounded"
            style={{ height: '100%', width: `${Math.max(12, fill * 100)}%`, background: C.ball }}
          />
        )}
      </div>
      <div style={{ fontSize: 9, letterSpacing: '0.04em', minHeight: 12, color: C.dim, marginTop: 1 }}>
        {caption}
      </div>
    </div>
  );
}

// "Aug 17 – 23", or "Aug 31 – Sep 2" across a month boundary.
function range(week) {
  const a = week.cells.find((c) => c.active).date;
  const b = [...week.cells].reverse().find((c) => c.active).date;
  const head = `${MON[a.getMonth()]} ${a.getDate()}`;
  if (a.getTime() === b.getTime()) return head;
  return `${head} – ${a.getMonth() === b.getMonth() ? b.getDate() : `${MON[b.getMonth()]} ${b.getDate()}`}`;
}
