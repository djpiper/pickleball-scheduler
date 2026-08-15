import { C, MONO } from '../theme.js';

export function Wordmark({ title = 'Pickleball', sub }) {
  return (
    <div className="mb-5">
      <h1 style={{ fontFamily: MONO, fontSize: 26, fontWeight: 700, color: C.line, lineHeight: 1.1 }}>
        {title}
      </h1>
      {sub && (
        <div className="flex items-center gap-2 mt-2">
          <span style={{ width: 26, height: 2, background: C.ball, display: 'inline-block' }} />
          <span
            style={{
              fontFamily: MONO,
              fontSize: 10.5,
              letterSpacing: '0.2em',
              color: C.dim,
              textTransform: 'uppercase',
            }}
          >
            {sub}
          </span>
        </div>
      )}
    </div>
  );
}

export function Panel({ children }) {
  return (
    <div className="rounded px-4 py-4 mb-3" style={{ background: C.panel, border: `1px solid ${C.hair}` }}>
      {children}
    </div>
  );
}

export function Label({ children }) {
  return (
    <span
      style={{
        fontFamily: MONO,
        fontSize: 10,
        letterSpacing: '0.2em',
        color: C.dim,
        textTransform: 'uppercase',
      }}
    >
      {children}
    </span>
  );
}

export function Tiny({ children, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        fontFamily: MONO,
        fontSize: 10.5,
        letterSpacing: '0.12em',
        color: C.ball,
        textTransform: 'uppercase',
      }}
    >
      {children}
    </button>
  );
}

export function IconBtn({ children, onClick, label }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="rounded p-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-white"
      style={{ color: C.dim, border: `1px solid ${C.hair}` }}
    >
      {children}
    </button>
  );
}

export function TextField({ value, onChange, onEnter, placeholder, maxLength }) {
  return (
    <input
      value={value}
      maxLength={maxLength}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' && onEnter) onEnter();
      }}
      className="w-full rounded px-3 py-2 outline-none focus-visible:ring-2 focus-visible:ring-white"
      style={{ background: C.deep, color: C.line, border: `1px solid ${C.hair}`, fontSize: 15 }}
    />
  );
}

export function Notice({ children, tone = 'dim' }) {
  const color = tone === 'bad' ? C.coral : C.dim;
  return (
    <p className="mt-3" style={{ color, fontSize: 12.5, lineHeight: 1.5 }}>
      {children}
    </p>
  );
}
