import { Router } from 'express';
import { getDb } from '../db/index';
import dayjs from 'dayjs';

const router = Router();

// Log analytics event
router.post('/event', (req, res) => {
  const { event_type, page, session_id, ip, metadata } = req.body;
  const db = getDb();
  db.prepare('INSERT INTO analytics_events (event_type, page, session_id, ip, metadata) VALUES (?, ?, ?, ?, ?)')
    .run(event_type, page || '', session_id || '', ip || req.ip, JSON.stringify(metadata || {}));
  // Increment page_views summary if event_type is page_view
  if (event_type === 'page_view' && page) {
    const date = dayjs().format('YYYY-MM-DD');
    const row = db.prepare('SELECT * FROM page_views WHERE date = ? AND page = ?').get(date, page);
    if (row) {
      db.prepare('UPDATE page_views SET views = views + 1 WHERE id = ?').run(row.id);
    } else {
      db.prepare('INSERT INTO page_views (date, page, views) VALUES (?, ?, 1)').run(date, page);
    }
  }
  res.json({ success: true });
});

// Get summary stats for dashboard
router.get('/summary', (req, res) => {
  const db = getDb();
  const today = dayjs().format('YYYY-MM-DD');
  const totalVisits = db.prepare('SELECT SUM(views) as total FROM page_views').get().total || 0;
  const todayVisits = db.prepare('SELECT SUM(views) as total FROM page_views WHERE date = ?').get(today).total || 0;
  const topPages = db.prepare('SELECT page, SUM(views) as views FROM page_views GROUP BY page ORDER BY views DESC LIMIT 5').all();
  const dealsClicks = db.prepare("SELECT metadata, COUNT(*) as clicks FROM analytics_events WHERE event_type = 'deal_click' GROUP BY metadata").all();
  res.json({ totalVisits, todayVisits, topPages, dealsClicks });
});

// Get page views over time
router.get('/page-views', (req, res) => {
  const db = getDb();
  const rows = db.prepare('SELECT date, page, views FROM page_views ORDER BY date DESC, page').all();
  res.json(rows);
});

// Get geo stats
router.get('/geo', (req, res) => {
  const db = getDb();
  const rows = db.prepare('SELECT ip FROM analytics_events WHERE event_type = "page_view"').all();
  // Use geoip-lite in the frontend or here if needed
  res.json(rows);
});

export default router;
