// "Open pull request" button for one finding on the Savings tab.
// Uses the app's api() helper, so the login token is handled for you.
import { useState } from 'react';
import { api } from '../api.js';

export default function PrButton({ recommendationId, onDone }) {
  const [state, setState] = useState('idle'); // idle | working | done | error
  const [pr, setPr] = useState(null);
  const [preview, setPreview] = useState(null);
  const [error, setError] = useState('');

  async function open() {
    setState('working');
    setError('');
    try {
      const data = await api(`/recommendations/${recommendationId}/pr`, { method: 'POST' });
      setPr(data.pr);
      setPreview(data.preview || null);
      setState('done');
      if (onDone) onDone(data.pr);
    } catch (e) {
      // 409 means a pull request is already open: show it instead of an error.
      if (e.status === 409 && e.data && e.data.pr) {
        setPr(e.data.pr);
        setState('done');
        return;
      }
      setError(e.message);
      setState('error');
    }
  }

  if (state === 'done' && pr) {
    return (
      <span className="pr-cell">
        {pr.url ? (
          <a className="link" href={pr.url} target="_blank" rel="noreferrer">
            PR #{pr.number}
          </a>
        ) : (
          <span className="muted small" title="No GitHub token is set, so nothing was sent to GitHub.">
            Preview only
          </span>
        )}
        {preview && (
          <details className="pr-preview">
            <summary className="small">what would open</summary>
            <pre>{`${preview.path}\n\n${preview.content}`}</pre>
          </details>
        )}
      </span>
    );
  }

  return (
    <span className="pr-cell">
      <button className="link" onClick={open} disabled={state === 'working'}>
        {state === 'working' ? 'Opening…' : 'Open PR'}
      </button>
      {state === 'error' && (
        <span className="error small" role="alert">
          {error}
        </span>
      )}
    </span>
  );
}
