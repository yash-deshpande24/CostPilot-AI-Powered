import AiCache from '../../models/AiCache.js';
import { aiMode } from './config.js';
import { ask } from './claude.js';
import { buildBillSummary, buildDayDetail } from './context.js';
import { EXPLAIN_TOOL, RANK_TOOL, explainSystem, rankSystem, chatSystem } from './prompts.js';
import { mockExplain, mockRank, mockChat } from './mock.js';
import { consumeCall, addTokens } from './usage.js';
import { httpError, friendlyAiError } from './errors.js';

const RISK = ['low', 'medium', 'high'];
const EFFORT = ['minutes', 'hours', 'days'];

// Keeps only valid ids, fixes bad values, puts missing items last, and numbers the result 1..n.
export function sanitizeRanking(raw, ids) {
  const seen = new Set();
  const out = [];
  for (const r of raw?.rankings || []) {
    if (!ids.includes(r.id) || seen.has(r.id)) continue;
    seen.add(r.id);
    out.push({
      id: r.id,
      p: Number.isFinite(r.priority) ? r.priority : 999,
      risk: RISK.includes(r.risk) ? r.risk : 'medium',
      effort: EFFORT.includes(r.effort) ? r.effort : 'hours',
      reason: String(r.reason || '').slice(0, 300),
    });
  }
  out.sort((a, b) => a.p - b.p);
  for (const id of ids) {
    if (!seen.has(id)) out.push({ id, p: 999, risk: 'medium', effort: 'hours', reason: 'Not ranked by the AI. Review it yourself.' });
  }
  return { headline: String(raw?.headline || '').slice(0, 300), rankings: out.map(({ p, ...r }, i) => ({ ...r, priority: i + 1 })) };
}

async function viaClaude(userId, args) {
  await consumeCall(userId);
  try {
    const res = await ask(args);
    await addTokens(userId, res.usage);
    return res;
  } catch (e) {
    throw friendlyAiError(e);
  }
}

export async function explainSpend({ userId, source, daily, date }) {
  const detail = buildDayDetail(daily, date);
  if (!detail) throw httpError(404, 'There is no cost data for that date.');
  if (aiMode() === 'mock') return { mode: 'mock', cached: false, result: mockExplain(detail) };

  const key = `explain:${source}:${date}:${detail.total}`;
  const hit = await AiCache.findOne({ key }).lean();
  if (hit) return { mode: 'claude', cached: true, result: hit.value };

  const res = await viaClaude(userId, {
    system: explainSystem(),
    messages: [{ role: 'user', content: `<day_data>\n${JSON.stringify(detail)}\n</day_data>\nExplain this day.` }],
    tool: EXPLAIN_TOOL,
  });
  await AiCache.updateOne({ key }, { $set: { value: res.input, createdAt: new Date() } }, { upsert: true });
  return { mode: 'claude', cached: false, result: res.input };
}

// items: [{ _id, type, title, resourceId, detail, monthlySavings }]. Returns { mode, headline, ranked: [{ _id, ... }] }.
export async function rankRecommendations({ userId, items }) {
  const list = items.map((r, i) => ({ id: `r${i + 1}`, type: r.type, title: r.title, resourceId: r.resourceId, detail: r.detail, monthlySavings: r.monthlySavings }));
  const ids = list.map((r) => r.id);
  const mode = aiMode();

  let raw;
  if (mode === 'mock') {
    raw = mockRank(list);
  } else {
    const res = await viaClaude(userId, {
      system: rankSystem(),
      messages: [{ role: 'user', content: `<recommendations>\n${JSON.stringify(list)}\n</recommendations>\nRank them.` }],
      tool: RANK_TOOL,
    });
    raw = res.input;
  }
  const clean = sanitizeRanking(raw, ids);
  const byId = Object.fromEntries(list.map((r, i) => [r.id, items[i]._id]));
  return { mode, headline: clean.headline, ranked: clean.rankings.map((r) => ({ ...r, _id: byId[r.id] })) };
}

export async function chatWithBill({ userId, question, source, daily, anomalies, recs, history }) {
  const summary = buildBillSummary({ source, daily, anomalies, recs });
  if (aiMode() === 'mock') return { mode: 'mock', answer: mockChat(question, summary) };

  const past = history.slice(-6);
  while (past.length && past[0].role !== 'user') past.shift();
  const res = await viaClaude(userId, {
    system: chatSystem(JSON.stringify(summary)),
    messages: [...past.map((m) => ({ role: m.role, content: m.content })), { role: 'user', content: question }],
    maxTokens: 3000,
  });
  return { mode: 'claude', answer: res.text };
}
