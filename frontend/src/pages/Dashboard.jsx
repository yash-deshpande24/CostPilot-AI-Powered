import { useEffect, useState } from 'react';
import { api } from '../api.js';
import { usd2 } from '../format.js';
import Home from '../views/Home.jsx';
import Overview from '../views/Overview.jsx';
import Services from '../views/Services.jsx';
import Calendar from '../views/Calendar.jsx';
import Savings from '../views/Savings.jsx';
import Ask from '../views/Ask.jsx';
import QuickBar from '../components/QuickBar.jsx';

const VIEWS = [
  { id: 'home', label: 'Home' },
  { id: 'overview', label: 'Overview' },
  { id: 'services', label: 'Services' },
  { id: 'calendar', label: 'Calendar' },
  { id: 'savings', label: 'Savings' },
  { id: 'ask', label: 'Ask AI' },
];
const fromHash = () => {
  const h = window.location.hash.slice(1);
  return VIEWS.some((v) => v.id === h) ? h : 'home';
};

// Turn the /costs response into a CSV download. Finds the first array of
// objects in the response (daily rows), so it works without knowing the exact key.
function downloadCsv(data) {
  const rows =
    [data?.daily, data?.days, data?.series, data?.byDay].find((x) => Array.isArray(x)) ||
    Object.values(data || {}).find((x) => Array.isArray(x) && x.length && typeof x[0] === 'object');
  if (!rows || !rows.length) { alert('No cost rows to export yet.'); return; }
  const cols = Object.keys(rows[0]).filter((k) => typeof rows[0][k] !== 'object');
  const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const csv = [cols.join(','), ...rows.map((r) => cols.map((c) => esc(r[c])).join(','))].join('\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
  a.download = `costpilot-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(a.href);
}

export default function Dashboard({ onSignOut, theme, onToggleTheme }) {
  const [view, setView] = useState(fromHash);
  const [range, setRange] = useState({ days: 30 });
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [recs, setRecs] = useState(null);
  const [recError, setRecError] = useState('');
  const [scanning, setScanning] = useState(false);
  const [scanMessage, setScanMessage] = useState('');
  const [ranking, setRanking] = useState(false);

  const expired = (e) => {
    if (e.status === 401) { onSignOut('expired'); return true; }
    return false;
  };

  const loadCosts = () =>
    api(range.from ? `/costs?from=${range.from}&to=${range.to}` : `/costs?days=${range.days || 30}`)
      .then((d) => { setData(d); setError(''); })
      .catch((e) => { if (!expired(e)) setError(e.message); });

  const loadRecs = () =>
    api('/recommendations')
      .then((r) => { setRecs(r); setRecError(''); })
      .catch((e) => { if (!expired(e)) setRecError(e.message); });

  useEffect(() => {
    const onHash = () => setView(fromHash());
    window.addEventListener('hashchange', onHash);
    loadRecs();
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  useEffect(() => { loadCosts(); }, [range]);

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

  async function rank() {
    setRanking(true);
    setScanMessage('');
    setRecError('');
    try {
      const r = await api('/ai/rank', { method: 'POST' });
      setScanMessage(`${r.mode === 'mock' ? 'Sample ranking. ' : ''}${r.headline}`);
      await loadRecs();
    } catch (e) {
      if (!expired(e)) setRecError(e.message);
    } finally {
      setRanking(false);
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

  const goHome = () => { window.location.hash = 'home'; window.scrollTo({ top: 0, behavior: 'smooth' }); };

  const live = data?.source === 'aws';
  return (
    <div className="app">
      <header className="topbar">
        <div className="brand-group">
          <strong className="brand" style={{ cursor: 'pointer' }} onClick={() => { window.location.hash = 'home'; }}>CostPilot</strong>
          {data && <span className={live ? 'pill live' : 'pill'}>{live ? 'Live AWS data' : 'Sample data'}</span>}
        </div>
        <div className="top-right">
          <nav className="switcher" role="tablist" aria-label="Dashboard views">
            {VIEWS.filter((v) => v.id !== 'home').map((v) => (
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
          {/* Wrapped so the click event isn't passed as the "reason" argument */}
          <button className="ghost" onClick={() => onSignOut()}>Sign out</button>
          {view !== 'home' && (
            <button className="ghost home-btn" onClick={goHome}>
              Home
            </button>
          )}
        </div>
      </header>

      <main className="stage">
        {view !== 'home' && (
          <button className="back-home" onClick={goHome}>
            ← Home
          </button>
        )}
        {error && <p className="error">{error}</p>}
        {!error && !data && view !== 'home' && <p className="muted">Loading your costs…</p>}
        {view === 'home' && <Home data={data} recs={recs} />}
        {data && view === 'overview' && <Overview data={data} recs={recs} range={range} onRangeChange={setRange} onOpenSavings={() => { window.location.hash = 'savings'; }} />}
        {data && view === 'services' && <Services data={data} />}
        {data && view === 'calendar' && <Calendar data={data} range={range} onRangeChange={setRange} />}
        {data && view === 'savings' && (
          <Savings
            recs={recs}
            error={recError ? `${recError}. Check that the backend is running: docker compose logs backend` : ''}
            scanning={scanning}
            ranking={ranking}
            message={scanMessage}
            monthlyRate={data.dailyAverage * 30}
            onScan={scan}
            onRank={rank}
            onDismiss={dismiss}
            onPrDone={loadRecs}
          />
        )}
        {data && view === 'ask' && <Ask />}
      </main>

      <QuickBar onExport={() => downloadCsv(data)} onSignOut={() => onSignOut()} />
    </div>
  );
}