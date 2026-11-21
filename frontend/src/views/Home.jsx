const TILES = [
  { id: 'overview', title: 'Overview', text: 'Spend for the last 30 days, daily chart and what changed.', icon: 'M4 20V10m6 10V4m6 16v-7m4 7H2' },
  { id: 'services', title: 'Services', text: 'See which AWS services cost the most.', icon: 'M3 7l9-4 9 4-9 4zM3 12l9 4 9-4M3 17l9 4 9-4' },
  { id: 'calendar', title: 'Calendar', text: 'Spend day by day across the month.', icon: 'M5 4h14a1 1 0 0 1 1 1v15a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1zM4 9h16M8 2v4m8-4v4' },
  { id: 'savings', title: 'Savings', text: 'Scan for idle resources and cut waste.', icon: 'M12 2v20M17 6H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6' },
];

const open = (id) => { window.location.hash = id; window.scrollTo({ top: 0, behavior: 'smooth' }); };

export default function Home({ data, recs }) {
  const live = data?.source === 'aws';
  const count = recs?.count ?? 0;
  return (
    <section className="cp-home">
      <div className="cp-home-hero">
        <h1>Know where your AWS money goes.</h1>
        <p>Pick a view below, or run a scan to find savings.</p>
        <div className="cp-home-actions">
          <button className="cp-home-primary" onClick={() => open('overview')}>Open overview</button>
          <button className="cp-home-secondary" onClick={() => open('savings')}>Find savings</button>
        </div>
      </div>

      <div className="cp-home-status">
        <div className="cp-home-card cp-stat">
          <span className="cp-stat-label">Data source</span>
          <strong>{data ? (live ? 'Live AWS data' : 'Sample data') : 'Loading…'}</strong>
        </div>
        <div className="cp-home-card cp-stat">
          <span className="cp-stat-label">Savings found</span>
          <strong>{recs ? `${count} item${count === 1 ? '' : 's'}` : 'Not scanned yet'}</strong>
        </div>
      </div>

      <div className="cp-home-grid">
        {TILES.map((t) => (
          <button key={t.id} className="cp-home-card cp-tile" onClick={() => open(t.id)}>
            <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d={t.icon} /></svg>
            <span className="cp-tile-title">{t.title}{t.id === 'savings' && count > 0 && <em className="cp-tile-badge">{count}</em>}</span>
            <span className="cp-tile-text">{t.text}</span>
          </button>
        ))}
      </div>
    </section>
  );
}