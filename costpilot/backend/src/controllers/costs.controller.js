import { getMonthlyCosts } from '../services/awsCost.js';
export async function listCosts(req, res, next) {
  try {
    const now = new Date();
    const end = now.toISOString().slice(0, 10);
    const startDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 5, 1));
    const start = startDate.toISOString().slice(0, 10);
    res.json(await getMonthlyCosts({ start, end }));
  } catch (error) { next(error); }
}
