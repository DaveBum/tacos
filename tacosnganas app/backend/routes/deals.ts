import { Router } from 'express';
import { getDb } from '../db/index';

const router = Router();

// List all deals
router.get('/', (req, res) => {
  const db = getDb();
  const deals = db.prepare('SELECT * FROM deals ORDER BY start_datetime DESC').all();
  res.json(deals);
});

// Create a new deal
router.post('/', (req, res) => {
  const { title, description, image, start_datetime, end_datetime, active_flag, featured } = req.body;
  if (!title) return res.status(400).json({ error: 'Missing title' });
  const db = getDb();
  db.prepare('INSERT INTO deals (title, description, image, start_datetime, end_datetime, active_flag, featured) VALUES (?, ?, ?, ?, ?, ?, ?)')
    .run(title, description || '', image || '', start_datetime, end_datetime, active_flag !== undefined ? active_flag : 1, featured || 0);
  res.json({ success: true });
});

// Update a deal
router.put('/:id', (req, res) => {
  const { title, description, image, start_datetime, end_datetime, active_flag, featured } = req.body;
  const id = req.params.id;
  const db = getDb();
  db.prepare('UPDATE deals SET title = ?, description = ?, image = ?, start_datetime = ?, end_datetime = ?, active_flag = ?, featured = ? WHERE id = ?')
    .run(title, description, image, start_datetime, end_datetime, active_flag, featured, id);
  res.json({ success: true });
});

// Delete a deal
router.delete('/:id', (req, res) => {
  const id = req.params.id;
  const db = getDb();
  db.prepare('DELETE FROM deals WHERE id = ?').run(id);
  res.json({ success: true });
});

// Preview a deal (force visible)
router.get('/:id/preview', (req, res) => {
  const id = req.params.id;
  const db = getDb();
  const deal = db.prepare('SELECT * FROM deals WHERE id = ?').get(id);
  if (!deal) return res.status(404).json({ error: 'Deal not found' });
  res.json({ ...deal, preview: true });
});

export default router;
