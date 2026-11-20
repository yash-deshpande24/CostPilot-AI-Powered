import 'dotenv/config';
import { z } from 'zod';

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  CORS_ORIGIN: z.string().default('http://localhost:5173'),
  JWT_SECRET: z.string().min(24).default('development-only-change-this-secret'),
  AWS_REGION: z.string().default('ap-south-1'),
  AWS_COST_EXPLORER_ENABLED: z.string().default('false'),
  SQS_QUEUE_URL: z.string().optional(),
  OPENAI_API_KEY: z.string().optional()
});
export const env = schema.parse(process.env);
