// Floating command dock. Used once at the bottom of Dashboard.jsx.
const go = (hash) => { window.location.hash = hash; window.scrollTo({ top: 0, behavior: 'smooth' }); };

const ITEMS = [
  { key: 'home', label: 'Home', icon: 'M3 11l9-8 9 8v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1z', act: () => go('home') },
  { key: 'refresh', label: 'Refresh', icon: 'M20 12a8 8 0 1 1-2.3-5.7M20 4v5h-5', act: () => window.location.reload() },
  { key: 'export', label: 'Export CSV', icon: 'M12 3v12m0 0l-4-4m4 4l4-4M4 21h16', act: ({ onExport }) => onExport?.() },
  { key: 'savings', label: 'Savings', icon: 'M12 2v20M17 6H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6', act: () => go('savings') },
  { key: 'top', label: 'Top', icon: 'M12 19V5m0 0l-6 6m6-6l6 6', act: () => window.scrollTo({ top: 0, behavior: 'smooth' }) },
  { key: 'out', label: 'Sign out', icon: 'M15 3h4a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1h-4M10 17l5-5-5-5M15 12H3', act: ({ onSignOut }) => onSignOut?.() },
];

export default function QuickBar(props) {
  return (
    <nav className="cp-dock" aria-label="Quick actions">
      {ITEMS.map((it) => (
        <button key={it.key} className={`cp-dock-btn ${it.key === 'out' ? 'is-out' : ''}`} onClick={() => it.act(props)} title={it.label}>
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d={it.icon} /></svg>
          <span>{it.label}</span>
        </button>
      ))}
    </nav>
  );
}