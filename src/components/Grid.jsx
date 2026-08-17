import { useRef, useEffect, useCallback } from 'react';
import { C, MONO, ballAlpha } from '../theme.js';
import { DOW, dparse, ck, slotCountFor, minsAtFor } from '../lib/time.js';

// A week of columns has to fit a phone without sideways scrolling, since the
// calendar expands one week at a time: 7 x 38 + 46 = 312px.
const HOUR_COL = 46;
const DAY_COL_MIN = 38;
const ROW_H = 32;

/**
 * The court. Two modes:
 *   view="mine"  — paint your own blocks (drag with a mouse, drag with a finger)
 *   view="all"   — read-only heatmap; tapping a cell selects it
 *
 * `dates` is the slice of the poll to draw — the calendar passes one week at a
 * time. It defaults to the whole poll so the grid still stands on its own.
 *
 * Painting model: mousedown/touchstart on a cell decides the stroke direction
 * (if the first cell was empty you're adding, otherwise erasing) and every cell
 * entered during the stroke gets that same value. Same behaviour as When2Meet,
 * and it's what makes filling a column fast.
 */
export default function Grid({
  poll,
  dates = poll.dates,
  mine,
  onPaint,
  view,
  counts,
  headcount,
  focusCell,
  onFocusCell,
  enabled,
}) {
  const slots = slotCountFor(poll);
  const minsAt = minsAtFor(poll);
  const dragRef = useRef(null);
  const gridRef = useRef(null);

  const begin = useCallback(
    (key) => {
      if (view !== 'mine' || !enabled) return;
      const adding = !mine.has(key);
      dragRef.current = { adding };
      onPaint(key, adding);
    },
    [view, enabled, mine, onPaint]
  );

  const extend = useCallback(
    (key) => {
      if (!dragRef.current) return;
      onPaint(key, dragRef.current.adding);
    },
    [onPaint]
  );

  useEffect(() => {
    const end = () => {
      dragRef.current = null;
    };
    window.addEventListener('mouseup', end);
    window.addEventListener('touchend', end);
    window.addEventListener('touchcancel', end);
    return () => {
      window.removeEventListener('mouseup', end);
      window.removeEventListener('touchend', end);
      window.removeEventListener('touchcancel', end);
    };
  }, []);

  // Touch drag needs a non-passive listener on the container: touchmove events
  // fire on the element where the touch STARTED, so we hit-test manually and
  // preventDefault to stop the page scrolling out from under the stroke.
  useEffect(() => {
    const el = gridRef.current;
    if (!el) return;
    const onMove = (e) => {
      if (!dragRef.current) return;
      e.preventDefault();
      const t = e.touches[0];
      const target = document.elementFromPoint(t.clientX, t.clientY);
      const key = target?.getAttribute?.('data-key');
      if (key) extend(key);
    };
    el.addEventListener('touchmove', onMove, { passive: false });
    return () => el.removeEventListener('touchmove', onMove);
  }, [extend]);

  const cols = `${HOUR_COL}px repeat(${dates.length}, minmax(${DAY_COL_MIN}px, 1fr))`;

  // The hour column stays put while the days scroll under it. Each row is its
  // own grid, so stickiness lives on the individual left-hand cells; they need
  // an opaque background or the day cells slide through them.
  const frozen = {
    position: 'sticky',
    left: 0,
    zIndex: 2,
    background: C.panel,
    borderRight: `1px solid ${C.hair}`,
  };

  return (
    <div className="rounded overflow-hidden" style={{ border: `1px solid ${C.hair}`, background: C.panel }}>
      <div className="overflow-x-auto">
        <div ref={gridRef} style={{ minWidth: dates.length * DAY_COL_MIN + HOUR_COL }}>
          <div className="grid" style={{ gridTemplateColumns: cols, borderBottom: `2px solid ${C.line}` }}>
            <div style={frozen} />
            {dates.map((d, di) => {
              const dt = dparse(d);
              return (
                <div key={d} className="py-2 text-center" style={{ borderLeft: di ? `1px solid ${C.hair}` : 'none' }}>
                  <div style={{ fontFamily: MONO, fontSize: 9.5, letterSpacing: '0.16em', color: C.dim }}>
                    {DOW[dt.getDay()].toUpperCase()}
                  </div>
                  <div style={{ fontFamily: MONO, fontSize: 15, fontWeight: 600, color: C.line }}>{dt.getDate()}</div>
                </div>
              );
            })}
          </div>

          {Array.from({ length: slots }, (_, i) => {
            const m = minsAt(i);
            const onHour = m % 60 === 0;
            return (
              <div key={i} className="grid" style={{ gridTemplateColumns: cols }}>
                <div
                  className="flex items-start justify-end pr-2"
                  style={{
                    ...frozen,
                    height: ROW_H,
                    fontFamily: MONO,
                    fontSize: 10,
                    color: C.dim,
                  }}
                >
                  <span style={{ transform: 'translateY(-6px)' }}>{onHour ? label(m) : ''}</span>
                </div>

                {dates.map((d, di) => {
                  const key = ck(d, m);
                  const who = counts[key] || [];
                  const isMine = mine.has(key);
                  let bg = 'transparent';
                  if (view === 'mine') bg = isMine ? C.ball : 'transparent';
                  else if (who.length) bg = ballAlpha(0.16 + 0.84 * (who.length / headcount));

                  const interactive = view === 'mine' && enabled;

                  return (
                    <div
                      key={key}
                      data-key={key}
                      role="button"
                      aria-label={`${d} ${label(m)}${isMine ? ', marked' : ''}`}
                      aria-pressed={view === 'mine' ? isMine : undefined}
                      tabIndex={interactive ? 0 : -1}
                      onMouseDown={() => begin(key)}
                      onMouseEnter={() => extend(key)}
                      onTouchStart={() => begin(key)}
                      onClick={() => {
                        if (view === 'all') onFocusCell(focusCell === key ? null : key);
                      }}
                      onKeyDown={(e) => {
                        if (interactive && (e.key === 'Enter' || e.key === ' ')) {
                          e.preventDefault();
                          onPaint(key, !mine.has(key));
                        }
                      }}
                      className="focus:outline-none focus-visible:ring-2 focus-visible:ring-white"
                      style={{
                        height: ROW_H,
                        background: bg,
                        borderLeft: di ? `1px solid ${C.hair}` : 'none',
                        borderTop: onHour ? `1px solid ${C.hair}` : '1px dotted rgba(220,233,231,0.10)',
                        outline: focusCell === key ? `2px solid ${C.coral}` : 'none',
                        outlineOffset: '-2px',
                        cursor: interactive ? 'pointer' : 'default',
                        userSelect: 'none',
                        WebkitUserSelect: 'none',
                        touchAction: interactive ? 'none' : 'auto',
                      }}
                    />
                  );
                })}
              </div>
            );
          })}

          <div style={{ borderTop: `2px solid ${C.line}` }} />
        </div>
      </div>
    </div>
  );
}

function label(mins) {
  const h = Math.floor(mins / 60);
  const ap = h >= 12 && h < 24 ? 'pm' : 'am';
  const hh = h % 12 === 0 ? 12 : h % 12;
  return `${hh}${ap}`;
}
