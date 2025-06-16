import { Router } from 'express';
import { getDb } from '../db/index';
import bcrypt from 'bcrypt';

const router = Router();

router.post('/login', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'Missing credentials' });
  const db = getDb();
  const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username);
  if (!user) return res.status(401).json({ error: 'Invalid credentials' });
  const match = await bcrypt.compare(password, user.password_hash);
  if (!match) return res.status(401).json({ error: 'Invalid credentials' });
  req.session.userId = user.id;
  res.json({ success: true, username: user.username });
});

router.post('/logout', (req, res) => {
  req.session.destroy(() => {
    res.json({ success: true });
  });
});

router.get('/me', (req, res) => {
  if (!req.session.userId) return res.status(401).json({ error: 'Not logged in' });
  const db = getDb();
  const user = db.prepare('SELECT id, username FROM users WHERE id = ?').get(req.session.userId);
  res.json({ user });
});

export default router;
