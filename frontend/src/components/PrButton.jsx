import { useState } from 'react';
import { api } from '../api.js';

// "Open PR" for one waste finding. Creates a pull request with a runbook. Merging it does not change AWS.
export default function PrButton({ rec }) {
  const [url, setUrl] = useState(rec.prUrl || '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function open() {
    setBusy(true);
    setError('');
    try {
      const r = await api(`/recommendations/${rec._id}/pr`, { method: 'POST' });
      setUrl(r.url);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  if (url) return <a className="link" href={url} target="_blank" rel="noopener noreferrer">View pull request</a>;
  return (
    <>
      <button className="ghost small-btn" onClick={open} disabled={busy}>{busy ? 'Opening…' : 'Open PR'}</button>
      {error && <span className="error small-text">{error}</span>}
    </>
  );
}
