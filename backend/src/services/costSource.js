import CostCache from '../models/CostCache.js';
import { generateDailyCosts } from './mockCosts.js';
import { fetchAwsDailyCosts } from './awsCost.js';

export const costSource = () => (process.env.COST_SOURCE === 'aws' ? 'aws' : 'mock');

export async function getDailyCosts(days) {
  if (costSource() === 'mock') {
    return { source: 'mock', daily: generateDailyCosts(days), cached: false };
  }

  const key = `ce:daily:${days}`;
  const ttlMs = (Number(process.env.CACHE_HOURS) || 24) * 3600 * 1000;
  const hit = await CostCache.findOne({ key });
  if (hit && Date.now() - hit.fetchedAt.getTime() < ttlMs) {
    return { source: 'aws', daily: hit.data, cached: true, fetchedAt: hit.fetchedAt };
  }

  const daily = await fetchAwsDailyCosts(days);
  const doc = await CostCache.findOneAndUpdate(
    { key },
    { data: daily, fetchedAt: new Date() },
    { upsert: true, new: true }
  );
  return { source: 'aws', daily, cached: false, fetchedAt: doc.fetchedAt };
}
