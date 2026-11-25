import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { runSmoke } from '../jobs/smoke.js';

const serve = (handler) => new Promise((resolve) => {
  const s = http.createServer(handler).listen(0, () => resolve({ s, url: `http://127.0.0.1:${s.address().port}` }));
});
const quiet = { log: () => {}, sleep: async () => {} };

const backendHandler = (version) => (req, res) => {
  if (req.url === '/health') { res.setHeader('content-type', 'application/json'); res.end(JSON.stringify({ status: 'ok', version })); }
  else { res.statusCode = 404; res.end('no'); }
};
const frontendHandler = (version) => (req, res) => {
  if (req.url === '/') res.end('<div id="root"></div>');
  else if (req.url === '/api/health') { res.setHeader('content-type', 'application/json'); res.end(JSON.stringify({ status: 'ok', version })); }
  else { res.statusCode = 404; res.end('no'); }
};

test('passes when backend, web page and the proxy all answer, with the right version', async () => {
  const b = await serve(backendHandler('sha-1a2b3c4'));
  const f = await serve(frontendHandler('sha-1a2b3c4'));
  const ok = await runSmoke({ backend: b.url, frontend: f.url, expectVersion: 'sha-1a2b3c4', retries: 2, delayMs: 1, ...quiet });
  b.s.close(); f.s.close();
  assert.equal(ok, true);
});

test('fails when the running version is not the one that was promoted', async () => {
  const b = await serve(backendHandler('sha-OLD'));
  const f = await serve(frontendHandler('sha-OLD'));
  const ok = await runSmoke({ backend: b.url, frontend: f.url, expectVersion: 'sha-NEW', retries: 2, delayMs: 1, ...quiet });
  b.s.close(); f.s.close();
  assert.equal(ok, false);
});

test('fails when the web page cannot reach the backend through its proxy', async () => {
  const b = await serve(backendHandler('v1'));
  const f = await serve((req, res) => { if (req.url === '/') res.end('ok'); else { res.statusCode = 502; res.end('bad gateway'); } });
  const ok = await runSmoke({ backend: b.url, frontend: f.url, expectVersion: 'v1', retries: 2, delayMs: 1, ...quiet });
  b.s.close(); f.s.close();
  assert.equal(ok, false);
});

test('fails cleanly when nothing is listening, and retries before giving up', async () => {
  let sleeps = 0;
  const ok = await runSmoke({ backend: 'http://127.0.0.1:1', frontend: 'http://127.0.0.1:1', retries: 3, delayMs: 1, log: () => {}, sleep: async () => { sleeps++; } });
  assert.equal(ok, false);
  assert.equal(sleeps, 2);
});

test('succeeds once a service comes up late', async () => {
  let n = 0;
  const b = await serve((req, res) => {
    if (++n < 3) { res.statusCode = 503; res.end('starting'); return; }
    res.setHeader('content-type', 'application/json'); res.end(JSON.stringify({ status: 'ok', version: 'v1' }));
  });
  const f = await serve(frontendHandler('v1'));
  const ok = await runSmoke({ backend: b.url, frontend: f.url, expectVersion: 'v1', retries: 5, delayMs: 1, ...quiet });
  b.s.close(); f.s.close();
  assert.equal(ok, true);
});
