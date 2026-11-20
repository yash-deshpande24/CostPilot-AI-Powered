import { Router } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
const router = Router();

// Demo-only endpoint. Replace with persisted users, password hashing (Argon2/bcrypt),
// email verification, throttling, and audit logging before exposing this API.
router.post('/demo-token', (req, res) => {
  if (env.NODE_ENV === 'production') return res.status(404).end();
  const token = jwt.sign({ sub: 'local-demo-user', role: 'viewer' }, env.JWT_SECRET, { expiresIn: '30m' });
  res.json({ token, warning: 'Development-only demo token' });
});
export default router;
