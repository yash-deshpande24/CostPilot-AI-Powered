import test from 'node:test';
import assert from 'node:assert/strict';
import { generateDailyCosts } from '../services/mockCosts.js';
import { findAnomalies } from '../services/anomaly.js';
import { buildBillSummary, buildDayDetail } from '../services/ai/context.js';
import { mockExplain, mockRank, mockChat } from '../services/ai/mock.js';
import { sanitizeRanking } from '../services/ai/index.js';
import { ask, _setCaller } from '../services/ai/claude.js';
import { friendlyAiError, httpError } from '../services/ai/errors.js';
import { aiMode } from '../services/ai/config.js';

const daily = generateDailyCosts(30);
const anomalies = findAnomalies(daily);
const recs = [
  { title: 'Idle m5.xlarge instance', type: 'idle_ec2', resourceId: 'i-1', monthlySavings: 140.16, status: 'new' },
  { title: 'Unattached gp3 volume, 200 GB', type: 'unattached_ebs', resourceId: 'vol-1', monthlySavings: 16, status: 'new' },
];

test('bill summary has totals, services and the unusual day', () => {
  const s = buildBillSummary({ source: 'mock', daily, anomalies, recs });
  assert.equal(s.period.days, 30);
  assert.ok(s.totalSpend > 3000);
  assert.equal(s.byService[0].service, 'Amazon EC2');
  assert.equal(s.unusualDays.length, 1);
  assert.equal(s.totalPotentialMonthlySavings, 156.16);
});

test('day detail finds the service that jumped', () => {
  const d = buildDayDetail(daily, anomalies[0].date);
  assert.equal(d.biggestIncreases[0].service, 'Amazon EC2');
  assert.ok(d.extra > 50);
  assert.equal(buildDayDetail(daily, '1999-01-01'), null);
});

test('sample explanation uses the real numbers', () => {
  const d = buildDayDetail(daily, anomalies[0].date);
  const out = mockExplain(d);
  assert.match(out.summary, /Amazon EC2/);
  assert.ok(out.likely_causes.length >= 1);
  assert.equal(out.confidence, 'low');
});

test('sample ranking puts the biggest saving first', () => {
  const items = recs.map((r, i) => ({ ...r, id: `r${i + 1}` }));
  const out = mockRank(items);
  assert.equal(out.rankings[0].id, 'r1');
  assert.equal(out.rankings[0].priority, 1);
});

test('sample chat answers common questions', () => {
  const s = buildBillSummary({ source: 'mock', daily, anomalies, recs });
  assert.match(mockChat('Which service costs the most?', s), /Amazon EC2/);
  assert.match(mockChat('why did spend jump', s), /Amazon EC2/);
  assert.match(mockChat('what can I save?', s), /\$156/);
  assert.match(mockChat('blah blah', s), /Try one of the suggestions/);
});

test('sanitizeRanking drops bad ids, fixes values and appends missing items', () => {
  const raw = {
    headline: 'Start with r2.',
    rankings: [
      { id: 'r2', priority: 1, risk: 'low', effort: 'minutes', reason: 'Easy.' },
      { id: 'r2', priority: 2, risk: 'high', effort: 'days', reason: 'Duplicate.' },
      { id: 'zzz', priority: 3, risk: 'low', effort: 'hours', reason: 'Unknown.' },
      { id: 'r1', priority: 'x', risk: 'banana', effort: 'soon', reason: 'Bad values.' },
    ],
  };
  const out = sanitizeRanking(raw, ['r1', 'r2', 'r3']);
  assert.deepEqual(out.rankings.map((r) => r.id), ['r2', 'r1', 'r3']);
  assert.deepEqual(out.rankings.map((r) => r.priority), [1, 2, 3]);
  assert.equal(out.rankings[1].risk, 'medium');
  assert.equal(out.rankings[1].effort, 'hours');
  assert.match(out.rankings[2].reason, /Not ranked/);
});

test('ask() returns the tool input and adds up token usage', async () => {
  _setCaller(async (p) => {
    assert.equal(p.tool_choice.type, 'auto');
    assert.equal(p.tools[0].name, 'rank_recommendations');
    return { stop_reason: 'tool_use', content: [{ type: 'thinking', thinking: '...' }, { type: 'tool_use', name: 'rank_recommendations', input: { ok: true } }], usage: { input_tokens: 100, output_tokens: 20 } };
  });
  const out = await ask({ system: 's', messages: [], tool: { name: 'rank_recommendations' } });
  assert.deepEqual(out.input, { ok: true });
  assert.deepEqual(out.usage, { input: 100, output: 20 });
  _setCaller(null);
});

test('ask() retries once when the tool is not called, then gives up', async () => {
  let calls = 0;
  _setCaller(async () => { calls++; return { stop_reason: 'end_turn', content: [{ type: 'text', text: 'hi' }], usage: { input_tokens: 5, output_tokens: 5 } }; });
  await assert.rejects(ask({ system: 's', messages: [], tool: { name: 't' } }), /usable answer/);
  assert.equal(calls, 2);
  _setCaller(null);
});

test('ask() does not retry when the answer was cut off', async () => {
  let calls = 0;
  _setCaller(async () => { calls++; return { stop_reason: 'max_tokens', content: [{ type: 'tool_use', name: 't', input: {} }], usage: {} }; });
  await assert.rejects(ask({ system: 's', messages: [], tool: { name: 't' } }));
  assert.equal(calls, 1);
  _setCaller(null);
});

test('ask() returns plain text for chat and rejects empty answers', async () => {
  _setCaller(async () => ({ stop_reason: 'end_turn', content: [{ type: 'text', text: 'EC2 costs most.' }], usage: { input_tokens: 9, output_tokens: 4 } }));
  assert.equal((await ask({ system: 's', messages: [] })).text, 'EC2 costs most.');
  _setCaller(async () => ({ stop_reason: 'end_turn', content: [], usage: {} }));
  await assert.rejects(ask({ system: 's', messages: [] }), /empty/);
  _setCaller(null);
});

test('friendly errors never leak raw messages', () => {
  assert.match(friendlyAiError({ status: 401, message: 'invalid x-api-key sk-secret' }).userMessage, /API key was rejected/);
  assert.doesNotMatch(friendlyAiError({ status: 401, message: 'sk-secret' }).userMessage, /sk-secret/);
  assert.match(friendlyAiError({ status: 429 }).userMessage, /rate limiting/);
  assert.equal(friendlyAiError(httpError(429, 'limit')).userMessage, 'limit');
});

test('mode is mock without a key and claude with one', () => {
  const old = process.env.ANTHROPIC_API_KEY;
  delete process.env.ANTHROPIC_API_KEY;
  assert.equal(aiMode(), 'mock');
  process.env.ANTHROPIC_API_KEY = 'x';
  assert.equal(aiMode(), 'claude');
  if (old === undefined) delete process.env.ANTHROPIC_API_KEY; else process.env.ANTHROPIC_API_KEY = old;
});
