import { useEffect, useRef, useState } from 'react';
import { api } from '../api.js';

const SUGGESTIONS = [
  'Why did spend jump?',
  'Which service costs the most?',
  'What can I save this month?',
  'Which day of the week costs the most?',
];

export default function Ask() {
  const [messages, setMessages] = useState([]);
  const [status, setStatus] = useState(null);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const end = useRef(null);

  const loadStatus = () => api('/ai/status').then(setStatus).catch(() => {});
  useEffect(() => {
    api('/ai/chat').then((r) => setMessages(r.items)).catch((e) => setError(e.message));
    loadStatus();
  }, []);
  useEffect(() => { end.current?.scrollIntoView({ block: 'end' }); }, [messages, busy]);

  async function send(question) {
    const q = question.trim();
    if (!q || busy) return;
    setText('');
    setError('');
    setBusy(true);
    setMessages((m) => [...m, { role: 'user', content: q }]);
    try {
      const r = await api('/ai/chat', { method: 'POST', body: { question: q } });
      setMessages((m) => [...m, { role: 'assistant', content: r.answer, mode: r.mode }]);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
      loadStatus();
    }
  }

  async function clear() {
    await api('/ai/chat', { method: 'DELETE' }).catch(() => {});
    setMessages([]);
    setError('');
  }

  return (
    <section className="panel chat">
      <div className="chat-head">
        <div>
          <h2>Ask about your bill</h2>
          {status && (
            <p className="muted small">
              {status.mode === 'claude' ? `Answers written by Claude (${status.model}).` : 'Sample answers built from your numbers. Add an Anthropic API key for Claude-written ones.'}{' '}
              {status.calls} of {status.limit} AI requests used today.
              {status.estimatedCostUsd !== null && ` About $${status.estimatedCostUsd.toFixed(4)} spent.`}
            </p>
          )}
        </div>
        {messages.length > 0 && <button className="link" onClick={clear}>Clear chat</button>}
      </div>

      <div className="chat-log" aria-live="polite">
        {messages.length === 0 && (
          <div className="chat-empty">
            <p className="muted">Ask anything about your spend. Try one of these:</p>
            <div className="suggest">
              {SUGGESTIONS.map((s) => <button key={s} className="ghost" onClick={() => send(s)}>{s}</button>)}
            </div>
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i} className={m.role === 'user' ? 'bubble user' : 'bubble ai'}>{m.content}</div>
        ))}
        {busy && <div className="bubble ai muted">Thinking…</div>}
        <div ref={end} />
      </div>

      {error && <p className="error">{error}</p>}
      <form className="chat-form" onSubmit={(e) => { e.preventDefault(); send(text); }}>
        <input value={text} onChange={(e) => setText(e.target.value)} maxLength={500} placeholder="Ask about your AWS spend" aria-label="Your question" />
        <button className="primary" disabled={busy || !text.trim()}>Send</button>
      </form>
    </section>
  );
}
