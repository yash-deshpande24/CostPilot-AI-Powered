// Checks that a fresh deploy really works. ArgoCD runs it inside the cluster after every sync (a PostSync hook).
// Exit code 0 = all checks passed. Exit code 1 = something is wrong, and ArgoCD shows the sync as failed.
import { fileURLToPath } from 'node:url';

const sleepMs = (ms) => new Promise((r) => setTimeout(r, ms));

export async function runSmoke({
  backend,
  frontend,
  expectVersion = '',
  fetchImpl = fetch,
  retries = 20,
  delayMs = 5000,
  sleep = sleepMs,
  log = console.log,
}) {
  const checks = [
    { name: 'backend /health', url: `${backend}/health`, ok: (res, body) => res.ok && body?.status === 'ok' && (!expectVersion || body.version === expectVersion) },
    { name: 'web page', url: `${frontend}/`, ok: (res) => res.ok },
    { name: 'web page to backend', url: `${frontend}/api/health`, ok: (res, body) => res.ok && body?.status === 'ok' },
  ];
  const passed = new Set();

  for (let attempt = 1; attempt <= retries; attempt++) {
    for (const c of checks) {
      if (passed.has(c.name)) continue;
      try {
        const res = await fetchImpl(c.url, { signal: AbortSignal.timeout(5000) });
        const text = await res.text();
        let body = null;
        try { body = JSON.parse(text); } catch { /* the web page is HTML */ }
        if (c.ok(res, body)) { passed.add(c.name); log(`PASS ${c.name}`); }
        else log(`waiting ${c.name}: status ${res.status} ${text.slice(0, 120)}`);
      } catch (e) {
        log(`waiting ${c.name}: ${e.message}`);
      }
    }
    if (passed.size === checks.length) return true;
    if (attempt < retries) await sleep(delayMs);
  }
  log(`FAILED after ${retries} tries. Passed: ${[...passed].join(', ') || 'none'}`);
  return false;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  runSmoke({
    backend: process.env.SMOKE_BACKEND_URL || 'http://backend:5000',
    frontend: process.env.SMOKE_FRONTEND_URL || 'http://frontend',
    expectVersion: process.env.EXPECT_VERSION || '',
  }).then((ok) => process.exit(ok ? 0 : 1));
}
