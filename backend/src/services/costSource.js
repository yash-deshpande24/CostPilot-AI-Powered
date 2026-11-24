import CostCache from '../models/CostCache.js';
import { generateDailyCosts, generateCostsBetween } from './mockCosts.js';
import { fetchAwsDailyCosts, fetchAwsCostsBetween } from './awsCost.js';

export const costSource = () => (process.env.COST_SOURCE === 'aws' ? 'aws' : 'mock');

// Cost Explorer calls cost money, so answers are kept in MongoDB for CACHE_HOURS.
async function viaCache(key, fetcher) {
  const ttlMs = (Number(process.env.CACHE_HOURS) || 24) * 3600 * 1000;
  const hit = await CostCache.findOne({ key });
  if (hit && Date.now() - hit.fetchedAt.getTime() < ttlMs) {
    return { source: 'aws', daily: hit.data, cached: true, fetchedAt: hit.fetchedAt };
  }
  const daily = await fetcher();
  const doc = await CostCache.findOneAndUpdate({ key }, { data: daily, fetchedAt: new Date() }, { upsert: true, new: true });
  return { source: 'aws', daily, cached: false, fetchedAt: doc.fetchedAt };
}

export async function getDailyCosts(days) {
  if (costSource() === 'mock') return { source: 'mock', daily: generateDailyCosts(days), cached: false };
  return viaCache(`ce:daily:${days}`, () => fetchAwsDailyCosts(days));
}

export async function getCostsBetween(from, to) {
  if (costSource() === 'mock') return { source: 'mock', daily: generateCostsBetween(from, to), cached: false };
  return viaCache(`ce:range:${from}:${to}`, () => fetchAwsCostsBetween(from, to));
}
