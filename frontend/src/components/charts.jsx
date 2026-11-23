import { SERVICE_COLORS, OTHER_COLOR, usd } from '../format.js';

export function Sparkline({ values, width = 120, height = 34 }) {
  if (values.length < 2) return null;
  const max = Math.max(...values);
  const min = Math.min(...values);
  const span = max - min || 1;
  const pts = values.map((v, i) => [(i / (values.length - 1)) * width, height - 3 - ((v - min) / span) * (height - 6)]);
  const line = pts.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ');
  return (
    <svg className="spark" viewBox={`0 0 ${width} ${height}`} aria-hidden="true" preserveAspectRatio="none">
      <path d={`${line} L${width},${height} L0,${height} Z`} className="spark-area" />
      <path d={line} className="spark-line" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

// A progress ring. "used" is a 0..1 fraction; "projected" draws a fainter arc behind it.
export function Ring({ size = 150, stroke = 14, used, projected, children }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const arc = (f) => `${Math.min(Math.max(f, 0), 1) * c} ${c}`;
  const common = { cx: size / 2, cy: size / 2, r, fill: 'none', strokeWidth: stroke, transform: `rotate(-90 ${size / 2} ${size / 2})` };
  return (
    <div className="ring" style={{ width: size, height: size }}>
      <svg viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
        <circle {...common} className="ring-track" />
        {projected !== undefined && <circle {...common} className="ring-proj" strokeDasharray={arc(projected)} strokeLinecap="round" />}
        <circle {...common} className="ring-used" strokeDasharray={arc(used)} strokeLinecap="round" />
      </svg>
      <div className="ring-center">{children}</div>
    </div>
  );
}

// parts: [{ name, value, color }]
export function Donut({ parts, size = 200, stroke = 30, children }) {
  const total = parts.reduce((s, p) => s + p.value, 0) || 1;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  let offset = 0;
  return (
    <div className="donut" style={{ width: size, height: size }}>
      <svg viewBox={`0 0 ${size} ${size}`} role="img" aria-label="Share of spend by service">
        {parts.map((p) => {
          const len = Math.max((p.value / total) * c - 2, 0);
          const el = (
            <circle key={p.name} cx={size / 2} cy={size / 2} r={r} fill="none" stroke={p.color} strokeWidth={stroke}
              strokeDasharray={`${len} ${c - len}`} strokeDashoffset={-offset} transform={`rotate(-90 ${size / 2} ${size / 2})`}>
              <title>{`${p.name}: ${usd(p.value)}`}</title>
            </circle>
          );
          offset += (p.value / total) * c;
          return el;
        })}
      </svg>
      <div className="donut-center">{children}</div>
    </div>
  );
}

// Daily spend, stacked by service. "names" are the services drawn in colour; the rest become "Other".
export function StackedBars({ daily, names, anomalies, onHover, hoverDate }) {
  const W = 880, H = 250, pad = { t: 14, r: 6, b: 24, l: 6 };
  const max = Math.max(1, ...daily.map((d) => d.total));
  const bw = (W - pad.l - pad.r) / daily.length;
  const flagged = new Set(anomalies.map((a) => a.date));
  const scale = (H - pad.t - pad.b) / max;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Daily AWS spend by service, with unusually high days marked" className="chart" onMouseLeave={() => onHover(null)}>
      {daily.map((d, i) => {
        const x = pad.l + i * bw + 2;
        const w = Math.max(bw - 4, 1);
        const segs = names.map((n, k) => ({ v: d.byService[n] || 0, color: SERVICE_COLORS[k % SERVICE_COLORS.length] }));
        segs.push({ v: Math.max(0, d.total - segs.reduce((s, g) => s + g.v, 0)), color: OTHER_COLOR });
        let y = H - pad.b;
        return (
          <g key={d.date} opacity={hoverDate && hoverDate !== d.date ? 0.55 : 1}>
            {segs.map((g, k) => {
              const h = g.v * scale;
              y -= h;
              return h > 0.3 ? <rect key={k} x={x} y={y} width={w} height={h} fill={g.color} stroke="var(--panel)" strokeWidth="0.6" /> : null;
            })}
            {flagged.has(d.date) && <rect x={x} y={2} width={w} height={5} rx="2" className="flag-mark" />}
            <rect x={x - 2} y={0} width={bw} height={H - pad.b} fill="transparent" onMouseEnter={() => onHover(d)} />
          </g>
        );
      })}
    </svg>
  );
}

// Squarified treemap. Items: [{ value, ... }]. Lays out inside a W x H box and returns positioned rectangles.
export function layoutTreemap(items, W, H) {
  const list = items.filter((i) => i.value > 0).sort((a, b) => b.value - a.value);
  const total = list.reduce((s, i) => s + i.value, 0);
  if (!total) return [];
  const nodes = list.map((i) => ({ ...i, area: (i.value / total) * W * H }));
  const out = [];
  let x = 0, y = 0, w = W, h = H;
  const worst = (row, side) => {
    const s = row.reduce((a, n) => a + n.area, 0);
    const mx = Math.max(...row.map((n) => n.area));
    const mn = Math.min(...row.map((n) => n.area));
    return Math.max((side * side * mx) / (s * s), (s * s) / (side * side * mn));
  };
  const place = (row) => {
    const s = row.reduce((a, n) => a + n.area, 0);
    if (w >= h) {
      const cw = s / h;
      let cy = y;
      for (const n of row) { const ch = n.area / cw; out.push({ ...n, x, y: cy, w: cw, h: ch }); cy += ch; }
      x += cw; w -= cw;
    } else {
      const rh = s / w;
      let cx = x;
      for (const n of row) { const cw2 = n.area / rh; out.push({ ...n, x: cx, y, w: cw2, h: rh }); cx += cw2; }
      y += rh; h -= rh;
    }
  };
  let row = [];
  for (const n of nodes) {
    const side = Math.min(w, h);
    if (row.length === 0 || worst([...row, n], side) <= worst(row, side)) row.push(n);
    else { place(row); row = [n]; }
  }
  if (row.length) place(row);
  return out;
}

export function Treemap({ items }) {
  const tiles = layoutTreemap(items, 100, 52);
  return (
    <div className="tm" role="img" aria-label="Spend by service, larger boxes cost more">
      {tiles.map((t) => (
        <div key={t.name} className="tm-tile" style={{ left: `${t.x}%`, top: `${(t.y / 52) * 100}%`, width: `${t.w}%`, height: `${(t.h / 52) * 100}%`, background: t.color }}>
          {t.w > 13 && t.h > 11 && <span className="tm-label">{t.name} {usd(t.value)}</span>}
        </div>
      ))}
    </div>
  );
}
