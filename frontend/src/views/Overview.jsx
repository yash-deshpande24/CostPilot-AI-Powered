import { useState } from 'react';
import { usd, usd2, shortDate, sum } from '../format.js';
import RangeBar from '../components/RangeBar.jsx';
import ExplainCard from '../components/ExplainCard.jsx';

function Chart({ daily, anomalies, onHover }) {
  const W = 880, H = 260, pad = { t: 10, r: 6, b: 24, l: 6 };
  const max = Math.max(1, ...daily.map((d) => d.total));
  const bw = (W - pad.l - pad.r) / daily.length;
  const flagged = new Set(anomalies.map((a) => a.date));
  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      role="img"
      aria-label="Daily AWS spend with unusually high days highlighted"
      className="chart"
      onMouseLeave={() => onHover(null)}
    >
      {daily.map((d, i) => {
        const h = ((H - pad.t - pad.b) * d.total) / max;
        return (
          <rect
            key={d.date}
            x={pad.l + i * bw + 1}
            y={H - pad.b - h}
            width={Math.max(bw - 2, 1)}
            height={h}
            rx="3"
            className={flagged.has(d.date) ? 'bar spike' : 'bar'}
            onMouseEnter={() => onHover(d)}
          >
            <title>{`${shortDate(d.date)}: ${usd2(d.total)}`}</title>
          </rect>
        );
      })}
      <text x={pad.l} y={H - 5} className="axis">{shortDate(daily[0].date)}</text>
      <text x={W - pad.r} y={H - 5} textAnchor="end" className="axis">{shortDate(daily[daily.length - 1].date)}</text>
    </svg>
  );
}

export default function Overview({ data, recs, onOpenSavings, range, onRangeChange }) {
  const { daily, anomalies } = data;
  const [hover, setHover] = useState(null);
  const shown = hover || daily[daily.length - 1];

  const last7 = sum(daily.slice(-7).map((d) => d.total));
  const prev7 = sum(daily.slice(-14, -7).map((d) => d.total));
  const delta = prev7 > 0 ? ((last7 - prev7) / prev7) * 100 : null;

  return (
    <>
      {onRangeChange && <RangeBar key={`${data.from}-${data.to}`} data={data} range={range} onRangeChange={onRangeChange} />}

      <section className="kpis">
        <div className="kpi lead">
          <p className="kpi-label">Spend in the last {data.days} days</p>
          <p className="kpi-num">{usd(data.total)}</p>
          {delta !== null && (
            <p className={delta > 0 ? 'kpi-note up' : 'kpi-note down'}>
              {Math.abs(delta).toFixed(1)}% {delta > 0 ? 'more' : 'less'} than the week before
            </p>
          )}
        </div>
        <div className="kpi">
          <p className="kpi-label">Daily average</p>
          <p className="kpi-num">{usd(data.dailyAverage)}</p>
        </div>
        <div className="kpi">
          <p className="kpi-label">Unusual days</p>
          <p className="kpi-num">{anomalies.length}</p>
        </div>
        <div className="kpi">
          <p className="kpi-label">Waste found</p>
          <p className="kpi-num green">{recs ? usd(recs.totalMonthlySavings) : '–'}</p>
          <button className="link" onClick={onOpenSavings}>See what to fix</button>
        </div>
      </section>

      <section className="panel">
        <div className="readout">
          <h2>Daily spend</h2>
          {shown && (
            <p className="readout-value"><strong>{shortDate(shown.date)}</strong> {usd2(shown.total)}</p>
          )}
        </div>
        {daily.length > 0 ? <Chart daily={daily} anomalies={anomalies} onHover={setHover} /> : <p className="muted">No spend recorded for this period.</p>}
        <p className="legend"><span className="dot" /> Spend was more than 35% above the previous week's average</p>
      </section>

      {anomalies.length > 0 && (
        <section className="panel">
          <h2>What changed</h2>
          <ul className="changes">
            {anomalies.map((a) => (
              <li key={a.date}>
                <strong>{shortDate(a.date)}</strong>
                <span>Spend hit {usd(a.total)} against an expected {usd(a.expected)}. {a.topDriver} added about {usd(a.extraSpend)} of it.</span>
                <div className="explain-slot"><ExplainCard date={a.date} /></div>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}