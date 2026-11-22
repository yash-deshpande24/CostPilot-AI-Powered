import crypto from 'crypto';
import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import { requireAuth } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/asyncHandler.js';

const router = Router();
const secret = () => process.env.JWT_SECRET || 'dev-secret-change-me';
const sign = (user) =>
  jwt.sign({ id: user._id, email: user.email, role: user.role }, secret(), { expiresIn: '7d' });

const RESET_MINUTES = 30;
const hashToken = (t) => crypto.createHash('sha256').update(t).digest('hex');

router.post('/register', async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password || password.length < 8) {
    return res.status(400).json({ error: 'Enter an email and a password of at least 8 characters.' });
  }
  if (await User.findOne({ email })) {
    return res.status(409).json({ error: 'That email is already registered.' });
  }
  const user = await User.create({ email, passwordHash: await bcrypt.hash(password, 10) });
  res.status(201).json({ token: sign(user), user: { email: user.email, role: user.role } });
});

router.post('/login', async (req, res) => {
  const { email, password } = req.body || {};
  const user = email && (await User.findOne({ email }));
  if (!user || !(await bcrypt.compare(password || '', user.passwordHash))) {
    return res.status(401).json({ error: 'Email or password is incorrect.' });
  }
  res.json({ token: sign(user), user: { email: user.email, role: user.role } });
});

// Step 1: ask for a reset link. The answer is the same whether or not the email exists,
// so nobody can use this route to find out who has an account.
router.post('/forgot', asyncHandler(async (req, res) => {
  const email = String(req.body?.email || '').trim().toLowerCase();
  const reply = { message: 'If that email is registered, a reset link has been created.' };
  const user = email && (await User.findOne({ email }));
  if (!user) return res.json(reply);

  const token = crypto.randomBytes(32).toString('hex');
  user.resetTokenHash = hashToken(token);
  user.resetExpires = new Date(Date.now() + RESET_MINUTES * 60 * 1000);
  await user.save();

  const link = `${process.env.APP_URL || 'http://localhost:8080'}/#reset/${token}`;
  console.log(`Password reset link for ${email} (valid ${RESET_MINUTES} min): ${link}`);
  // Demo only. With no email service yet, SHOW_RESET_LINK=true returns the link to the page.
  res.json(process.env.SHOW_RESET_LINK === 'true' ? { ...reply, link } : reply);
}));

// Step 2: set a new password with the token from the link. Tokens work once.
router.post('/reset', asyncHandler(async (req, res) => {
  const { token, password } = req.body || {};
  if (!token || !password || password.length < 8) {
    return res.status(400).json({ error: 'Enter a new password of at least 8 characters.' });
  }
  const user = await User.findOne({ resetTokenHash: hashToken(String(token)), resetExpires: { $gt: new Date() } });
  if (!user) return res.status(400).json({ error: 'This reset link is invalid or has expired. Request a new one.' });

  user.passwordHash = await bcrypt.hash(password, 10);
  user.resetTokenHash = undefined;
  user.resetExpires = undefined;
  await user.save();
  res.json({ ok: true });
}));

router.get('/me', requireAuth, (req, res) => res.json({ user: req.user }));

export default router;