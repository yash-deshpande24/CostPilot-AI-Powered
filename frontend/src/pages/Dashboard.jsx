import { useEffect, useState } from 'react';
import { api } from '../api.js';

const usd = (n) => n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
const shortDate = (iso) => new Date(iso + 'T00:00:00Z').toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });

function DailyChart({ daily, anomalies }) {
  const W = 760, H = 240, pad = { t: 12, r: 8, b: 26, l: 8 };
  const max = Math.max(...daily.map((d) => d.total));
  const bw = (W - pad.l - pad.r) / daily.length;
  const flagged = new Set(anomalies.map((a) => a.date));
  return (
    <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Daily AWS spend, with unusually high days highlighted" className="chart">
      {daily.map((d, i) => {
        const h = ((H - pad.t - pad.b) * d.total) / max;
        const x = pad.l + i * bw;
        return (
          <rect key={d.date} x={x + 2} y={H - pad.b - h} width={bw - 4} height={h} rx="2"
            className={flagged.has(d.date) ? 'bar spike' : 'bar'}>
            <title>{`${shortDate(d.date)}: ${usd(d.total)}`}</title>
          </rect>
        );
      })}
      <text x={pad.l} y={H - 6} className="axis">{shortDate(daily[0].date)}</text>
      <text x={W - pad.r} y={H - 6} textAnchor="end" className="axis">{shortDate(daily[daily.length - 1].date)}</text>
    </svg>
  );
}

export default function Dashboard({ onSignOut }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api('/costs?days=30')
      .then(setData)
      .catch((e) => (e.status === 401 ? onSignOut() : setError(e.message)));
  }, []);

  if (error) return <main className="shell"><p className="error">{error}</p></main>;
  if (!data) return <main className="shell"><p className="muted">Loading your costs…</p></main>;

  const top = data.byService[0].amount;
  return (
    <main className="shell">
      <header className="topbar">
        <strong className="brand">CostPilot</strong>
        <span className="pill">Sample data</span>
        <button className="link" onClick={onSignOut}>Sign out</button>
      </header>

      <section className="summary">
        <div>
          <p className="muted">Spend, last {data.days} days</p>
          <p className="big">{usd(data.total)}</p>
        </div>
        <div>
          <p className="muted">Daily average</p>
          <p className="mid">{usd(data.dailyAverage)}</p>
        </div>
        <div>
          <p className="muted">Unusual days</p>
          <p className="mid">{data.anomalies.length}</p>
        </div>
      </section>

      <section className="panel">
        <h2>Daily spend</h2>
        <DailyChart daily={data.daily} anomalies={data.anomalies} />
        <p className="legend"><span className="dot" /> Spend is more than 35% above the previous week's average</p>
      </section>

      {data.anomalies.length > 0 && (
        <section className="panel">
          <h2>What changed</h2>
          <ul className="anomalies">
            {data.anomalies.map((a) => (
              <li key={a.date}>
                <strong>{shortDate(a.date)}</strong>
                <span>
                  Spend hit {usd(a.total)} against an expected {usd(a.expected)}. {a.topDriver} added about {usd(a.extraSpend)} of it.
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="panel">
        <h2>Spend by service</h2>
        <ul className="services">
          {data.byService.map((s) => (
            <li key={s.service}>
              <span>{s.service}</span>
              <span className="track"><span className="fill" style={{ width: `${(s.amount / top) * 100}%` }} /></span>
              <span className="amt">{usd(s.amount)}</span>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
