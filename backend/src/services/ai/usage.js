import AiUsage from '../../models/AiUsage.js';
import { registry } from '../metrics.js';
import { dailyLimit } from './config.js';
import { httpError } from './errors.js';

const today = () => new Date().toISOString().slice(0, 10);

// Counts the call first, so parallel requests cannot slip past the limit.
export async function consumeCall(userId) {
  const doc = await AiUsage.findOneAndUpdate(
    { userId, date: today() },
    { $inc: { calls: 1 } },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
  if (doc.calls > dailyLimit()) {
    await AiUsage.updateOne({ _id: doc._id }, { $inc: { calls: -1 } });
    throw httpError(429, `You have used all ${dailyLimit()} AI requests for today. The limit resets at midnight UTC.`);
  }
}

export async function addTokens(userId, { input, output }) {
  registry.aiTokens.inc({ direction: 'input' }, input);
  registry.aiTokens.inc({ direction: 'output' }, output);
  await AiUsage.updateOne({ userId, date: today() }, { $inc: { inputTokens: input, outputTokens: output } });
}

export async function getUsage(userId) {
  const doc = await AiUsage.findOne({ userId, date: today() }).lean();
  return { calls: doc?.calls || 0, inputTokens: doc?.inputTokens || 0, outputTokens: doc?.outputTokens || 0, limit: dailyLimit() };
}

// Only an estimate, and only when you set both prices in .env.
export function estimateCostUsd({ inputTokens, outputTokens }) {
  const pin = Number(process.env.AI_PRICE_INPUT_PER_MTOK);
  const pout = Number(process.env.AI_PRICE_OUTPUT_PER_MTOK);
  if (!pin || !pout) return null;
  return Math.round(((inputTokens * pin + outputTokens * pout) / 1e6) * 10000) / 10000;
}
