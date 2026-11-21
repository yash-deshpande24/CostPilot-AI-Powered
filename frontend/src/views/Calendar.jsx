import { useMemo, useState } from 'react';
import { usd, usd2, longDate, shortDate } from '../format.js';

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export default function Calendar({ data }) {
  const { daily, anomalies } = data;
  const byDate = useMemo(() => Object.fromEntries(daily.map((d) => [d.date, d])), [daily]);
  const anomalyByDate = useMemo(() => Object.fromEntries(anomalies.map((a) => [a.date, a])), [anomalies]);
  const [picked, setPicked] = useState(anomalies[0]?.date || daily[daily.length - 1]?.date);

  if (daily.length === 0) return <section className="panel"><h2>Calendar</h2><p className="muted">No spend recorded for this period.</p></section>;

  const max = Math.max(1, ...daily.map((d) => d.total));
  const lead = (new Date(daily[0].date + 'T00:00:00Z').getUTCDay() + 6) % 7; // Monday first
  const cells = [...Array(lead).fill(null), ...daily];
  const day = byDate[picked];
  const note = anomalyByDate[picked];
  const services = day ? Object.entries(day.byService).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]) : [];
  const top = services[0]?.[1] || 1;

  return (
    <section className="calendar-view">
      <div className="panel">
        <h2>Spend by day</h2>
        <p className="muted tight">Darker days cost more. Pick a day to see what it was spent on.</p>
        <div className="cal">
          {WEEKDAYS.map((w) => <span key={w} className="cal-head">{w}</span>)}
          {cells.map((d, i) =>
            d === null ? (
              <span key={`b${i}`} />
            ) : (
              <button
                key={d.date}
                className={['cal-day', anomalyByDate[d.date] ? 'hot' : '', picked === d.date ? 'picked' : ''].join(' ')}
                style={{ '--i': d.total / max }}
                onClick={() => setPicked(d.date)}
                aria-pressed={picked === d.date}
                aria-label={`${longDate(d.date)}, ${usd(d.total)}${anomalyByDate[d.date] ? ', stood out' : ''}`}
              >
                <span className="cal-num">{Number(d.date.slice(8))}</span>
                <span className="cal-amt">{usd(d.total)}</span>
              </button>
            )
          )}
        </div>
      </div>

      <aside className="panel day-detail" aria-live="polite">
        {day && (
          <>
            <h2>{longDate(day.date)}</h2>
            <p className="day-total">{usd2(day.total)}</p>
            {note ? (
              <p className="day-note">Expected about {usd(note.expected)}. {note.topDriver} added about {usd(note.extraSpend)} on top.</p>
            ) : (
              <p className="muted">A normal day for this account.</p>
            )}
            <ul className="services-list">
              {services.map(([name, v]) => (
                <li key={name}>
                  <span>{name}</span>
                  <span className="track"><span className="fill" style={{ width: `${(v / top) * 100}%` }} /></span>
                  <span className="amt">{usd2(v)}</span>
                </li>
              ))}
            </ul>
            <p className="muted tight">Total for {shortDate(day.date)} across {services.length} services.</p>
          </>
        )}
      </aside>
    </section>
  );
}
