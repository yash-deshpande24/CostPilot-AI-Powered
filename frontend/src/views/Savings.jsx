import { usd2 } from '../format.js';

const TYPE_LABEL = { unattached_ebs: 'Unattached disks', unattached_eip: 'Unused IP addresses', idle_ec2: 'Idle servers' };
const TYPE_COLOR = { unattached_ebs: '#6f74e8', unattached_eip: '#e9a23b', idle_ec2: '#3fb6a8' };

export default function Savings({ recs, error, scanning, message, onScan, onDismiss }) {
  const byType = {};
  (recs?.items || []).forEach((r) => { byType[r.type] = (byType[r.type] || 0) + r.monthlySavings; });
  const total = recs?.totalMonthlySavings || 0;

  return (
    <>
      <section className="panel savings-hero">
        <div>
          <p className="kpi-label">Estimated savings</p>
          <p className="kpi-num green">{usd2(total)}<span className="per"> a month</span></p>
          {recs?.lastScanAt && <p className="muted tight">Last scan {new Date(recs.lastScanAt).toLocaleString()}</p>}
        </div>
        <button className="primary" onClick={onScan} disabled={scanning}>{scanning ? 'Scanning…' : 'Scan now'}</button>
      </section>

      {message && <p className="note">{message}</p>}
      {error && <p className="error">{error}</p>}

      {recs && recs.count === 0 && (
        <section className="panel"><p className="muted">No waste found yet. Select Scan now to check your account.</p></section>
      )}

      {recs && recs.count > 0 && (
        <>
          <section className="panel">
            <h2>Where the waste is</h2>
            <div className="share" role="img" aria-label="Savings by type">
              {Object.entries(byType).map(([t, v]) => <span key={t} style={{ flexGrow: v, background: TYPE_COLOR[t] }} />)}
            </div>
            <ul className="share-legend">
              {Object.entries(byType).map(([t, v]) => (
                <li key={t}>
                  <span className="swatch" style={{ background: TYPE_COLOR[t] }} />
                  <span>{TYPE_LABEL[t] || t}</span>
                  <strong>{usd2(v)}</strong>
                  <span className="muted">{((v / total) * 100).toFixed(0)}%</span>
                </li>
              ))}
            </ul>
          </section>

          <section className="panel">
            <h2>Fix these first</h2>
            <ul className="recs">
              {recs.items.map((r) => (
                <li key={r._id}>
                  <div>
                    <strong>{r.title}</strong>
                    <p className="muted small">{r.resourceId}</p>
                    <p className="muted small">{r.detail}</p>
                  </div>
                  <div className="rec-right">
                    <span className="amt">{usd2(r.monthlySavings)}/mo</span>
                    <button className="link" onClick={() => onDismiss(r._id)}>Dismiss</button>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        </>
      )}
    </>
  );
}
