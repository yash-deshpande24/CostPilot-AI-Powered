import { usd2 } from '../format.js';
import { Ring } from '../components/charts.jsx';

const TYPE_LABEL = { unattached_ebs: 'Unattached disks', unattached_eip: 'Unused IP addresses', idle_ec2: 'Idle servers' };
const TYPE_COLOR = { unattached_ebs: '#6f74e8', unattached_eip: '#e9a23b', idle_ec2: '#3fb6a8' };

export default function Savings({ recs, error, scanning, ranking, message, monthlyRate, onScan, onRank, onDismiss }) {
  const byType = {};
  (recs?.items || []).forEach((r) => { byType[r.type] = (byType[r.type] || 0) + r.monthlySavings; });
  const total = recs?.totalMonthlySavings || 0;
  const ranked = (recs?.items || []).some((r) => r.aiPriority);
  const share = monthlyRate > 0 ? total / monthlyRate : 0;

  return (
    <>
      <section className="savings-hero">
        <div className="sh-copy">
          <p className="hero-lead">You could save about</p>
          <p className="hero-num">{usd2(total)}<span className="per"> a month</span></p>
          {recs?.lastScanAt && <p className="hero-sub">Last scan {new Date(recs.lastScanAt).toLocaleString()}</p>}
          <div className="btn-row">
            <button className="ghost" onClick={onRank} disabled={ranking || !recs || recs.count === 0}>{ranking ? 'Ranking…' : 'Rank with AI'}</button>
            <button className="primary" onClick={onScan} disabled={scanning}>{scanning ? 'Scanning…' : 'Scan now'}</button>
          </div>
        </div>
        {monthlyRate > 0 && (
          <div className="hero-glass">
            <Ring used={share} size={130} stroke={12}>
              <strong>{Math.round(share * 100)}%</strong>
              <span>of your monthly bill</span>
            </Ring>
          </div>
        )}
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
            <h2>{ranked ? 'Do these in this order' : 'Fix these first'}</h2>
            <ul className="recs">
              {recs.items.map((r) => (
                <li key={r._id}>
                  <div className="rec-main">
                    {r.aiPriority && <span className="rank-no" aria-label={`Priority ${r.aiPriority}`}>{r.aiPriority}</span>}
                    <div>
                      <strong>{r.title}</strong>
                      <p className="muted small">{r.resourceId}</p>
                      <p className="muted small">{r.detail}</p>
                      {r.aiReason && <p className="ai-reason">{r.aiReason}</p>}
                      {r.aiRisk && (
                        <p className="chips">
                          <span className={`chip ${r.aiRisk}`}>{`Risk ${r.aiRisk}`}</span>
                          <span className="chip">{`Effort ${r.aiEffort}`}</span>
                        </p>
                      )}
                    </div>
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