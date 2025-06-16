import { Router } from 'express';
import { getDb } from '../db/index';

const router = Router();

// List all locations
router.get('/', (req, res) => {
  const db = getDb();
  const locations = db.prepare('SELECT * FROM locations ORDER BY id ASC').all();
  res.json(locations);
});

// Create a new location
router.post('/', (req, res) => {
  const { name, address, hours, embed_code, lat, lng } = req.body;
  if (!name || !address) return res.status(400).json({ error: 'Missing name or address' });
  const db = getDb();
  db.prepare('INSERT INTO locations (name, address, hours, embed_code, lat, lng) VALUES (?, ?, ?, ?, ?, ?)')
    .run(name, address, hours || '', embed_code || '', lat || null, lng || null);
  res.json({ success: true });
});

// Update a location
router.put('/:id', (req, res) => {
  const { name, address, hours, embed_code, lat, lng } = req.body;
  const id = req.params.id;
  const db = getDb();
  db.prepare('UPDATE locations SET name = ?, address = ?, hours = ?, embed_code = ?, lat = ?, lng = ? WHERE id = ?')
    .run(name, address, hours, embed_code, lat, lng, id);
  res.json({ success: true });
});

// Delete a location
router.delete('/:id', (req, res) => {
  const id = req.params.id;
  const db = getDb();
  db.prepare('DELETE FROM locations WHERE id = ?').run(id);
  res.json({ success: true });
});

export default router;
