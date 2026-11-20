import { useEffect, useState } from 'react';

const API = import.meta.env.VITE_API_URL || '';

export default function App() {
  const [health, setHealth] = useState('Checking API…');
  const [costs, setCosts] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch(`${API}/health`).then((r) => r.json()).then((d) => setHealth(d.status))
      .catch(() => setHealth('API unavailable'));
    fetch(`${API}/api/costs`).then((r) => r.json()).then(setCosts)
      .catch((e) => setError(e.message));
  }, []);

  return <main className="shell">
    <header><div className="brand">◈ CostPilot</div><span className="pill">FinOps workspace</span></header>
    <section className="hero">
      <p className="eyebrow">AWS COST INTELLIGENCE</p>
      <h1>Understand your cloud spend.</h1>
      <p className="sub">A starting dashboard for cost visibility, anomaly detection and optimization recommendations.</p>
      <div className="status">API status: <strong>{health}</strong></div>
    </section>
    <section className="grid">
      <article className="panel"><p className="label">Monthly spend</p><h2>—</h2><p className="muted">Connect Cost Explorer to load live spend.</p></article>
      <article className="panel"><p className="label">Potential savings</p><h2>—</h2><p className="muted">Calculated from verified recommendations.</p></article>
      <article className="panel"><p className="label">Cost data source</p><h2>{costs?.source || 'Loading'}</h2><p className="muted">{costs?.message || error || 'AWS Cost Explorer integration status'}</p></article>
    </section>
    <section className="panel"><h3>Getting started</h3><ol>
      <li>Configure a least-privilege AWS role for Cost Explorer read access.</li>
      <li>Enable AWS cost data in backend environment settings.</li>
      <li>Connect a database and persist normalized cost records.</li>
      <li>Review recommendations before enabling any remediation.</li>
    </ol></section>
    <footer>CostPilot · Development scaffold · Do not use sample values for financial decisions.</footer>
  </main>;
}
