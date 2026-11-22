import { usd } from '../format.js';

const TILES = [
  { id: 'overview', title: 'Overview', text: 'Daily spend chart, trends and what changed.', color: '#6f74e8', icon: 'M4 20V10m6 10V4m6 16v-7m4 7H2' },
  { id: 'services', title: 'Services', text: 'See which AWS services cost the most.', color: '#3fb6a8', icon: 'M3 7l9-4 9 4-9 4zM3 12l9 4 9-4M3 17l9 4 9-4' },
  { id: 'calendar', title: 'Calendar', text: 'Spend day by day across the month.', color: '#e9a23b', icon: 'M5 4h14a1 1 0 0 1 1 1v15a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1zM4 9h16M8 2v4m8-4v4' },
  { id: 'savings', title: 'Savings', text: 'Scan for idle resources and cut waste.', color: '#5eead4', icon: 'M12 2v20M17 6H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6' },
  { id: 'ask', title: 'Ask AI', text: 'Chat about your bill and get plain answers.', color: '#d97aa5', icon: 'M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8zM19 16l.8 2.2L22 19l-2.2.8L19 22l-.8-2.2L16 19l2.2-.8z' },
];

const open = (id) => { window.location.hash = id; window.scrollTo({ top: 0, behavior: 'smooth' }); };
const greeting = () => {
  const h = new Date().getHours();
  return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
};

export default function Home({ data, recs }) {
  const live = data?.source === 'aws';
  const count = recs?.count ?? 0;
  const stats = [
    { label: `Spend, last ${data?.days ?? 30} days`, value: data ? usd(data.total) : '…' },
    { label: 'Daily average', value: data ? usd(data.dailyAverage) : '…' },
    { label: 'Unusual days', value: data ? String(data.anomalies.length) : '…' },
    { label: 'Waste found', value: recs ? `${usd(recs.totalMonthlySavings)}/mo` : 'Not scanned', good: true },
  ];

  return (
    <section className="hm">
      <div className="hm-hero">
        <span className="hm-kicker">{greeting()} · {data ? (live ? 'Live AWS data' : 'Sample data') : 'Loading…'}</span>
        <h1>Know where your <span className="hm-grad">AWS money</span> goes.</h1>
        <p>See your spend, catch unusual days, find waste and ask questions in plain English.</p>
        <div className="hm-actions">
          <button className="primary" onClick={() => open('overview')}>Open overview</button>
          <button className="ghost" onClick={() => open('savings')}>Find savings{count > 0 ? ` (${count})` : ''}</button>
        </div>
      </div>

      <div className="hm-stats">
        {stats.map((s) => (
          <div key={s.label} className="hm-stat">
            <span className="hm-stat-label">{s.label}</span>
            <strong className={s.good ? 'good' : ''}>{s.value}</strong>
          </div>
        ))}
      </div>

      <h2 className="hm-title">Dashboards</h2>
      <div className="hm-grid">
        {TILES.map((t) => (
          <button key={t.id} className="hm-tile" style={{ '--c': t.color }} onClick={() => open(t.id)}>
            <span className="hm-icon">
              <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d={t.icon} /></svg>
            </span>
            <span className="hm-tile-title">
              {t.title}
              {t.id === 'savings' && count > 0 && <em className="hm-badge">{count}</em>}
            </span>
            <span className="hm-tile-text">{t.text}</span>
            <span className="hm-go" aria-hidden="true">Open →</span>
          </button>
        ))}
      </div>
    </section>
  );
}