import { useEffect, useState } from 'react';
import { api } from '../api.js';
import { usd2 } from '../format.js';
import Overview from '../views/Overview.jsx';
import Services from '../views/Services.jsx';
import Calendar from '../views/Calendar.jsx';
import Savings from '../views/Savings.jsx';

const VIEWS = [
  { id: 'overview', label: 'Overview' },
  { id: 'services', label: 'Services' },
  { id: 'calendar', label: 'Calendar' },
  { id: 'savings', label: 'Savings' },
];
const fromHash = () => {
  const h = window.location.hash.slice(1);
  return VIEWS.some((v) => v.id === h) ? h : 'overview';
};

export default function Dashboard({ onSignOut, theme, onToggleTheme }) {
  const [view, setView] = useState(fromHash);
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [recs, setRecs] = useState(null);
  const [recError, setRecError] = useState('');
  const [scanning, setScanning] = useState(false);
  const [scanMessage, setScanMessage] = useState('');

  const expired = (e) => {
    if (e.status === 401) { onSignOut(); return true; }
    return false;
  };

  const loadRecs = () =>
    api('/recommendations')
      .then((r) => { setRecs(r); setRecError(''); })
      .catch((e) => { if (!expired(e)) setRecError(e.message); });

  useEffect(() => {
    const onHash = () => setView(fromHash());
    window.addEventListener('hashchange', onHash);
    api('/costs?days=30').then(setData).catch((e) => { if (!expired(e)) setError(e.message); });
    loadRecs();
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  async function scan() {
    setScanning(true);
    setScanMessage('');
    setRecError('');
    try {
      const r = await api('/scan', { method: 'POST' });
      const failed = r.errors.length ? ` ${r.errors.length} scanner(s) failed: ${r.errors.map((x) => x.scanner).join(', ')}.` : '';
      setScanMessage(`Scan finished. Found ${r.found} item(s), about ${usd2(r.totalMonthlySavings)} a month.${failed}`);
      await loadRecs();
    } catch (e) {
      if (!expired(e)) setRecError(e.message);
    } finally {
      setScanning(false);
    }
  }

  async function dismiss(id) {
    try {
      await api(`/recommendations/${id}`, { method: 'PATCH', body: { status: 'dismissed' } });
      await loadRecs();
    } catch (e) {
      if (!expired(e)) setRecError(e.message);
    }
  }

  const live = data?.source === 'aws';
  return (
    <div className="app">
      <header className="topbar">
        <div className="brand-group">
          <strong className="brand">CostPilot</strong>
          {data && <span className={live ? 'pill live' : 'pill'}>{live ? 'Live AWS data' : 'Sample data'}</span>}
        </div>
        <div className="top-right">
          <nav className="switcher" role="tablist" aria-label="Dashboard views">
            {VIEWS.map((v) => (
              <button
                key={v.id}
                role="tab"
                aria-selected={view === v.id}
                className={view === v.id ? 'tab on' : 'tab'}
                onClick={() => { window.location.hash = v.id; }}
              >
                {v.label}
                {v.id === 'savings' && recs?.count > 0 && <span className="badge">{recs.count}</span>}
              </button>
            ))}
          </nav>
          <button className="ghost" onClick={onToggleTheme} aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}>
            {theme === 'dark' ? 'Light theme' : 'Dark theme'}
          </button>
          <button className="ghost" onClick={onSignOut}>Sign out</button>
        </div>
      </header>

      <main className="stage">
        {error && <p className="error">{error}</p>}
        {!error && !data && <p className="muted">Loading your costs…</p>}
        {data && view === 'overview' && <Overview data={data} recs={recs} onOpenSavings={() => { window.location.hash = 'savings'; }} />}
        {data && view === 'services' && <Services data={data} />}
        {data && view === 'calendar' && <Calendar data={data} />}
        {data && view === 'savings' && (
          <Savings recs={recs} error={recError} scanning={scanning} message={scanMessage} onScan={scan} onDismiss={dismiss} />
        )}
      </main>
    </div>
  );
}
