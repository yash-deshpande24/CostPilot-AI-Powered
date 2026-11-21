import { useMemo, useState } from 'react';
import { usd, usd2, longDate, shortDate } from '../format.js';
import RangeBar from '../components/RangeBar.jsx';

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const MONTH = new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' });
const TODAY = new Date().toISOString().slice(0, 10);

// Split the daily list into months, each with the blank cells it needs
// so the 1st lands under the right weekday (Monday first).
function groupByMonth(daily) {
  const months = [];
  for (const d of daily) {
    const key = d.date.slice(0, 7);
    let m = months[months.length - 1];
    if (!m || m.key !== key) {
      const first = new Date(d.date + 'T00:00:00Z');
      m = { key, label: MONTH.format(first), lead: (first.getUTCDay() + 6) % 7, days: [] };
      months.push(m);
    }
    m.days.push(d);
  }
  return months;
}

export default function Calendar({ data, range, onRangeChange }) {
  const { daily, anomalies } = data;
  const byDate = useMemo(() => Object.fromEntries(daily.map((d) => [d.date, d])), [daily]);
  const anomalyByDate = useMemo(() => Object.fromEntries(anomalies.map((a) => [a.date, a])), [anomalies]);
  const months = useMemo(() => groupByMonth(daily), [daily]);
  const fallback = byDate[TODAY] ? TODAY : anomalies[0]?.date || daily[daily.length - 1]?.date;
  const [picked, setPicked] = useState(fallback);

  const bar = onRangeChange && (
    <RangeBar key={`${data.from}-${data.to}`} data={data} range={range} onRangeChange={onRangeChange} />
  );

  if (daily.length === 0) {
    return (
      <>
        {bar}
        <section className="panel"><h2>Calendar</h2><p className="muted">No spend recorded for this period.</p></section>
      </>
    );
  }

  const max = Math.max(1, ...daily.map((d) => d.total));
  const day = byDate[picked] || byDate[fallback];
  const note = day && anomalyByDate[day.date];
  const services = day ? Object.entries(day.byService).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]) : [];
  const top = services[0]?.[1] || 1;

  return (
    <>
      {bar}
      <section className="calendar-view">
        <div className="panel">
          <h2>Spend by day</h2>
          <p className="muted tight">Darker days cost more. Pick a day to see what it was spent on.</p>

          <div className="cal cp-cal-weekdays">
            {WEEKDAYS.map((w) => <span key={w} className="cal-head">{w}</span>)}
          </div>

          {months.map((m) => (
            <div key={m.key} className="cp-month">
              <h3 className="cp-month-title">{m.label}</h3>
              <div className="cal">
                {Array.from({ length: m.lead }, (_, i) => <span key={`b${i}`} />)}
                {m.days.map((d) => (
                  <button
                    key={d.date}
                    className={[
                      'cal-day',
                      anomalyByDate[d.date] ? 'hot' : '',
                      day?.date === d.date ? 'picked' : '',
                      d.date === TODAY ? 'today' : '',
                      d.projected ? 'projected' : '',
                    ].join(' ')}
                    style={{ '--i': d.total / max }}
                    onClick={() => setPicked(d.date)}
                    aria-pressed={day?.date === d.date}
                    title={`${longDate(d.date)}${d.date === TODAY ? ' (today)' : ''}${d.projected ? ' (sample forecast)' : ''}`}
                    aria-label={`${longDate(d.date)}, ${usd(d.total)}${anomalyByDate[d.date] ? ', stood out' : ''}`}
                  >
                    <span className="cal-num">{Number(d.date.slice(8))}{d.date === TODAY && <em className="cp-today-tag">Today</em>}</span>
                    <span className="cal-amt">{usd(d.total)}</span>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>

        <aside className="panel day-detail" aria-live="polite">
          {day && (
            <>
              <h2>{longDate(day.date)}</h2>
              <p className="day-total">{usd2(day.total)}</p>
              {day.projected && <p className="muted">Sample forecast. This date has not happened yet.</p>}
              {note ? (
                <p className="day-note">Expected about {usd(note.expected)}. {note.topDriver} added about {usd(note.extraSpend)} on top.</p>
              ) : (
                !day.projected && <p className="muted">A normal day for this account.</p>
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
    </>
  );
}