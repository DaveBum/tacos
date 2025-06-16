-- Users table
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Pages table
CREATE TABLE IF NOT EXISTS pages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  filename TEXT UNIQUE NOT NULL,
  title TEXT NOT NULL,
  template TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Page revisions
CREATE TABLE IF NOT EXISTS page_revisions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  page_id INTEGER NOT NULL,
  content TEXT NOT NULL,
  timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(page_id) REFERENCES pages(id)
);

-- Menu items
CREATE TABLE IF NOT EXISTS menu_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  label TEXT NOT NULL,
  url TEXT NOT NULL,
  "order" INTEGER,
  parent_id INTEGER,
  visible INTEGER DEFAULT 1
);

-- Locations
CREATE TABLE IF NOT EXISTS locations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  address TEXT NOT NULL,
  hours TEXT,
  embed_code TEXT,
  lat REAL,
  lng REAL
);

-- Deals
CREATE TABLE IF NOT EXISTS deals (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  description TEXT,
  image TEXT,
  start_datetime DATETIME,
  end_datetime DATETIME,
  active_flag INTEGER DEFAULT 1,
  featured INTEGER DEFAULT 0
);

-- Analytics events
CREATE TABLE IF NOT EXISTS analytics_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  event_type TEXT NOT NULL,
  page TEXT,
  timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
  session_id TEXT,
  ip TEXT,
  metadata TEXT
);

-- Analytics summary (page views)
CREATE TABLE IF NOT EXISTS page_views (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  date TEXT NOT NULL,
  page TEXT NOT NULL,
  views INTEGER DEFAULT 0
);

-- Media
CREATE TABLE IF NOT EXISTS media (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  filename TEXT NOT NULL,
  upload_datetime DATETIME DEFAULT CURRENT_TIMESTAMP,
  tags TEXT,
  usage_count INTEGER DEFAULT 0
);
