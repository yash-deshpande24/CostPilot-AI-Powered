import { useState } from 'react';

// Date range picker shared by Overview and Calendar.
// range is { days } or { from, to }; onRangeChange receives the same shape.
export default function RangeBar({ data, range, onRangeChange }) {
  const [from, setFrom] = useState(data.from || '');
  const [to, setTo] = useState(data.to || '');
  const custom = Boolean(range?.from);
  const valid = from && to && from <= to;

  return (
    <div className="cp-range">
      <div className="cp-range-presets" role="group" aria-label="Date range">
        {[30, 60, 90].map((n) => (
          <button key={n} className={!custom && range?.days === n ? 'on' : ''} onClick={() => onRangeChange({ days: n })}>
            Last {n} days
          </button>
        ))}
        <button
          className={custom && range.from === '2026-10-23' && range.to === '2027-01-26' ? 'on' : ''}
          onClick={() => onRangeChange({ from: '2026-10-23', to: '2027-01-26' })}
        >
          Oct 23 to Jan 26
        </button>
      </div>
      <div className="cp-range-custom">
        <label>From <input type="date" value={from} max={to || undefined} onChange={(e) => setFrom(e.target.value)} /></label>
        <label>To <input type="date" value={to} min={from || undefined} onChange={(e) => setTo(e.target.value)} /></label>
        <button disabled={!valid} onClick={() => onRangeChange({ from, to })}>Apply</button>
      </div>
    </div>
  );
}