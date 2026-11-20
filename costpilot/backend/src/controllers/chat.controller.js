import { z } from 'zod';
import { generateCostExplanation } from '../services/ai.js';
const bodySchema = z.object({ question: z.string().min(1).max(2000) });
export async function chat(req, res, next) {
  try {
    const parsed = bodySchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Invalid question' });
    res.json(await generateCostExplanation(parsed.data));
  } catch (error) { next(error); }
}
