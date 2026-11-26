import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { connectDB } from './config/db.js';
import authRoutes from './routes/auth.js';
import costRoutes from './routes/costs.js';
import recommendationRoutes from './routes/recommendations.js';
import scanRoutes from './routes/scan.js';
import aiRoutes from './routes/ai.js';
import { costSource } from './services/costSource.js';
import { aiMode } from './services/ai/config.js';

const app = express();
app.use(cors());
app.use(express.json());

// /api/health is the same answer, reachable through the web app's nginx. The deploy smoke test uses it.
app.get(['/health', '/api/health'], (_req, res) =>
  res.json({ status: 'ok', version: process.env.APP_VERSION || 'dev', source: costSource(), ai: aiMode() })
);
app.use('/api/auth', authRoutes);
app.use('/api/costs', costRoutes);
app.use('/api/recommendations', recommendationRoutes);
app.use('/api/scan', scanRoutes);
app.use('/api/ai', aiRoutes);

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: 'Something went wrong on our side. Try again.' });
});

const port = process.env.PORT || 5000;
connectDB()
  .then(() =>
    app.listen(port, () => console.log(`API listening on :${port} (cost source: ${costSource()}, ai: ${aiMode()})`))
  )
  .catch((e) => {
    console.error('Could not connect to MongoDB:', e.message);
    process.exit(1);
  });

// Retry canary health check after analysis fix
