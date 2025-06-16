-- Seed data for the TACOnganas Admin App database

-- Default Admin User
-- Password is 'adminpassword' (hashed with bcrypt in the application logic before insertion if done via app)
-- For direct seeding, you would pre-hash it. Example hash for 'adminpassword' (bcrypt, cost 10):
-- $2b$10$abcdefghijklmnopqrstuvwxysABCDEFGHIJKLMNOPQRSTUV (this is just a placeholder structure, actual hash is longer)
-- The application will create this user with a hashed password if it doesn't exist.
-- This SQL is more of a placeholder if manual seeding is done.
-- The initDb function in db/index.ts handles creating the admin user with a secure password.

-- Example: INSERT INTO users (username, password_hash, role) VALUES ('admin', '$2b$10$....your_bcrypt_hash_here....', 'admin');

-- Initial Site Settings (optional, can be managed via UI later)
INSERT OR IGNORE INTO settings (key, value, description) VALUES 
    ('site_name', 'TACOnganas', 'The primary name of the website.'),
    ('default_seo_description', 'Delicious and authentic Mexican food at TACOnganas.', 'Default meta description for pages.'),
    ('default_seo_keywords', 'tacos, mexican food, restaurant, TACOnganas', 'Default meta keywords for pages.');

-- Example Menu Items (if you want a default menu structure)
-- Note: page_id would need to correspond to actual pages created.
-- This is better managed via the UI after initial setup.
/*
INSERT OR IGNORE INTO menu_items (label, page_id, item_order) VALUES
    ('Home', (SELECT id from pages WHERE filename='index.html'), 0),
    ('Menu', (SELECT id from pages WHERE filename='menu.html'), 1),
    ('Locations', (SELECT id from pages WHERE filename='locations.html'), 2),
    ('Catering', (SELECT id from pages WHERE filename='catering.html'), 3),
    ('Order Online', NULL, 4); -- Example of an external link or placeholder
*/

-- Example Location (better managed via UI)
/*
INSERT OR IGNORE INTO locations (name, address, city, state, zip_code, phone, hours, latitude, longitude, google_maps_embed_code)
VALUES 
    ('TACOnganas Downtown', '123 Main St', 'Memphis', 'TN', '38103', '901-555-1234', 'Mon-Sat: 11am-10pm, Sun: 12pm-8pm', 35.1495, -90.0490, '<iframe src="https://www.google.com/maps/embed?pb=..."></iframe>');
*/

-- Example Deal (better managed via UI)
/*
INSERT OR IGNORE INTO deals (title, description, image_url, start_datetime, end_datetime, is_active, type, discount_details, target_url)
VALUES
    ('Taco Tuesday Special!', 'Get 3 tacos for $5 every Tuesday!', '/images/deals/taco_tuesday.jpg', '2025-01-07 00:00:00', '2025-12-31 23:59:59', TRUE, 'deal', '3 tacos for $5', '/order?item=taco_tuesday_special');
*/

-- Note: Most data like pages, menu items, locations, deals, and media will be managed dynamically through the application UI.
-- The primary purpose of this seed file in the context of the application is to ensure a default admin user can be created if one doesn't exist,
-- and perhaps some very basic site settings.
-- The actual creation of the admin user with a hashed password is handled in backend/db/index.ts.

SELECT 'Seed data script executed (mostly placeholders, admin user creation is programmatic).';
