import { useState } from 'react';
import { api } from '../api.js';

export default function ExplainCard({ date }) {
  const [state, setState] = useState('idle');
  const [out, setOut] = useState(null);
  const [error, setError] = useState('');

  async function run() {
    setState('loading');
    setError('');
    try {
      setOut(await api('/ai/explain', { method: 'POST', body: { date } }));
      setState('done');
    } catch (e) {
      setError(e.message);
      setState('error');
    }
  }

  if (state === 'idle' || state === 'error') {
    return (
      <div>
        <button className="ghost small-btn" onClick={run}>Explain this</button>
        {state === 'error' && <p className="error tight">{error}</p>}
      </div>
    );
  }
  if (state === 'loading') return <p className="muted">Asking the analyst…</p>;

  const r = out.result;
  return (
    <div className="explain" aria-live="polite">
      <p>{r.summary}</p>
      {r.likely_causes.length > 0 && (
        <>
          <h3>Possible causes</h3>
          <ul>{r.likely_causes.map((c, i) => <li key={i}>{c}</li>)}</ul>
        </>
      )}
      <h3>What to check</h3>
      <ul>{r.what_to_check.map((c, i) => <li key={i}>{c}</li>)}</ul>
      <p className="ai-note">
        <span className={`chip ${r.confidence === 'high' ? 'low' : r.confidence === 'medium' ? 'medium' : 'high'}`}>Confidence {r.confidence}</span>
        {out.mode === 'mock'
          ? ' Sample explanation built from your numbers. Add an Anthropic API key for one written by Claude.'
          : out.cached ? ' Written by Claude earlier today.' : ' Written by Claude.'}
      </p>
    </div>
  );
}
