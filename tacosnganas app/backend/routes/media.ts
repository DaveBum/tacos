import { Router } from 'express';
import { getDb } from '../db/index';
import multer from 'multer';
import * as path from 'path';
import * as fs from 'fs';

const router = Router();
const MEDIA_PATH = path.join(__dirname, '../../../tacosnganas/images');

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, MEDIA_PATH);
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + '_' + file.originalname.replace(/[^a-zA-Z0-9.\-_]/g, ''));
  }
});
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/gif'];
    if (allowed.includes(file.mimetype)) cb(null, true);
    else cb(new Error('Invalid file type'));
  }
});

// List all media
router.get('/', (req, res) => {
  const db = getDb();
  const media = db.prepare('SELECT * FROM media ORDER BY upload_datetime DESC').all();
  res.json(media);
});

// Upload media
router.post('/upload', upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
  const db = getDb();
  db.prepare('INSERT INTO media (filename, tags) VALUES (?, ?)')
    .run(req.file.filename, req.body.tags || '');
  res.json({ success: true, filename: req.file.filename });
});

// Delete media
router.delete('/:id', (req, res) => {
  const id = req.params.id;
  const db = getDb();
  const media = db.prepare('SELECT filename FROM media WHERE id = ?').get(id);
  if (!media) return res.status(404).json({ error: 'Media not found' });
  const filePath = path.join(MEDIA_PATH, media.filename);
  if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  db.prepare('DELETE FROM media WHERE id = ?').run(id);
  res.json({ success: true });
});

// Tag media
router.put('/:id/tags', (req, res) => {
  const id = req.params.id;
  const { tags } = req.body;
  const db = getDb();
  db.prepare('UPDATE media SET tags = ? WHERE id = ?').run(tags, id);
  res.json({ success: true });
});

// Usage tracking (scan for usage in site files)
router.get('/:id/usage', (req, res) => {
  const id = req.params.id;
  const db = getDb();
  const media = db.prepare('SELECT filename FROM media WHERE id = ?').get(id);
  if (!media) return res.status(404).json({ error: 'Media not found' });
  // Scan tacosnganas folder for filename usage
  const sitePath = path.join(__dirname, '../../../tacosnganas');
  let usageCount = 0;
  function scanDir(dir: string) {
    fs.readdirSync(dir).forEach(file => {
      const fullPath = path.join(dir, file);
      if (fs.statSync(fullPath).isDirectory()) scanDir(fullPath);
      else if (fs.readFileSync(fullPath, 'utf-8').includes(media.filename)) usageCount++;
    });
  }
  scanDir(sitePath);
  db.prepare('UPDATE media SET usage_count = ? WHERE id = ?').run(usageCount, id);
  res.json({ usageCount });
});

export default router;
