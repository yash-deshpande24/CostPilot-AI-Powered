import { usd, shortDate, sum, SERVICE_COLORS } from '../format.js';
import { Treemap, Sparkline } from '../components/charts.jsx';

export default function Services({ data }) {
  const { daily, byService, anomalies } = data;
  const rows = byService.slice(0, 8);
  const flagged = new Set(anomalies.map((a) => a.date));

  if (rows.length === 0) {
    return <section className="panel"><h2>Services</h2><p className="muted">No services have charges in this period.</p></section>;
  }

  const change = (name) => {
    const a = sum(daily.slice(-7).map((d) => d.byService[name] || 0));
    const b = sum(daily.slice(-14, -7).map((d) => d.byService[name] || 0));
    return b > 0 ? ((a - b) / b) * 100 : null;
  };

  return (
    <>
      <section className="panel">
        <h2>Where the money goes</h2>
        <p className="muted tight">Bigger boxes cost more.</p>
        <Treemap items={rows.map((s, i) => ({ name: s.service, value: s.amount, color: SERVICE_COLORS[i % SERVICE_COLORS.length] }))} />
      </section>

      <section className="panel">
        <h2>How each service is moving</h2>
        <ul className="trend">
          {rows.map((s, i) => {
            const c = change(s.service);
            return (
              <li key={s.service}>
                <span className="heat-name"><span className="swatch" style={{ background: SERVICE_COLORS[i % SERVICE_COLORS.length] }} />{s.service}</span>
                <Sparkline values={daily.map((d) => d.byService[s.service] || 0)} width={140} height={30} />
                <strong className="amt">{usd(s.amount)}</strong>
                <span className={c === null ? 'muted' : c > 5 ? 'chg up' : c < -5 ? 'chg down' : 'chg flat'}>
                  {c === null ? 'no change data' : `${c > 0 ? '+' : ''}${c.toFixed(0)}% vs last week`}
                </span>
              </li>
            );
          })}
        </ul>
      </section>

      <section className="panel">
        <h2>Spend by service, day by day</h2>
        <p className="muted tight">Each row is scaled to its own busiest day, so you can see when a service jumped. Amber marks a day that stood out.</p>
        <div className="heat" style={{ '--n': daily.length }}>
          <span />
          {daily.map((d) => <span key={d.date} className={flagged.has(d.date) ? 'flag on' : 'flag'} title={flagged.has(d.date) ? `${shortDate(d.date)} stood out` : ''} />)}
          <span />
          {rows.map((s, i) => {
            const max = Math.max(...daily.map((d) => d.byService[s.service] || 0), 1);
            return (
              <div className="heat-row" key={s.service}>
                <span className="heat-name"><span className="swatch" style={{ background: SERVICE_COLORS[i % SERVICE_COLORS.length] }} />{s.service}</span>
                {daily.map((d) => {
                  const v = d.byService[s.service] || 0;
                  return <span key={d.date} className="cell" style={{ '--i': v / max }} title={`${s.service} on ${shortDate(d.date)}: ${usd(v)}`} />;
                })}
                <span className="heat-total">{usd(s.amount)}</span>
              </div>
            );
          })}
          <span />
          <span className="heat-axis"><span>{shortDate(daily[0].date)}</span><span>{shortDate(daily[daily.length - 1].date)}</span></span>
          <span />
        </div>
      </section>
    </>
  );
}