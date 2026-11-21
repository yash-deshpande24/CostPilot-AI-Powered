import { usd, usd2, shortDate, sum } from '../format.js';
import RangeBar from '../components/RangeBar.jsx';

function Chart({ daily, anomalies }) {
  const W = 880, H = 260, pad = { t: 10, r: 6, b: 8, l: 6 };
  const max = Math.max(1, ...daily.map((d) => d.total));
  const bw = (W - pad.l - pad.r) / daily.length;
  const flagged = new Set(anomalies.map((a) => a.date));
  return (
    <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Daily AWS spend with unusually high days highlighted" className="chart">
      {daily.map((d, i) => {
        const h = ((H - pad.t - pad.b) * d.total) / max;
        return (
          <rect key={d.date} x={pad.l + i * bw + 1} y={H - pad.b - h} width={Math.max(bw - 2, 1)} height={h} rx="3"
            className={flagged.has(d.date) ? 'bar spike' : 'bar'}>
            <title>{`${shortDate(d.date)}: ${usd2(d.total)}`}</title>
          </rect>
        );
      })}
    </svg>
  );
}

export default function Overview({ data, recs, onOpenSavings, range, onRangeChange }) {
  const { daily, anomalies } = data;

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
        </div>
        {daily.length > 0 ? <Chart daily={daily} anomalies={anomalies} /> : <p className="muted">No spend recorded for this period.</p>}
        <p className="legend"><span className="dot" /> Spend was more than 35% above the previous week's average</p>
      </section>

      {anomalies.length > 0 && (
        <section className="panel">
          <h2>What changed</h2>
          <ul className="changes">
            {anomalies.map((a) => (
              <li key={a.date}>
                <span>Spend hit {usd(a.total)} against an expected {usd(a.expected)}. {a.topDriver} added about {usd(a.extraSpend)} of it.</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}