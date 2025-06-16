import betterSqlite3 from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import bcrypt from 'bcrypt';
import type { App as ElectronApp } from 'electron'; // Type import

let dbInstance: betterSqlite3.Database;
const SALT_ROUNDS = 10; // Consistent with auth.ts

export function initDb(dbPath: string, electronApp?: ElectronApp): betterSqlite3.Database {
    if (dbInstance) {
        return dbInstance;
    }

    const dbDir = path.dirname(dbPath);
    if (!fs.existsSync(dbDir)) {
        fs.mkdirSync(dbDir, { recursive: true });
        console.log(`Created database directory: ${dbDir}`);
    }

    dbInstance = new betterSqlite3(dbPath, { verbose: process.env.NODE_ENV === 'development' ? console.log : undefined });
    console.log(`Connected to SQLite database at: ${dbPath}`);

    // Determine base path for SQL files (schema.sql, seed.sql)
    // In dev, __dirname is backend/db. In prod (packaged), it's dist/backend/db.
    // SQL files should be co-located or in a known relative path.
    // Assuming they are in the same directory as this compiled JS file.
    const sqlFilesBasePath = __dirname;

    const schemaPath = path.join(sqlFilesBasePath, 'schema.sql');
    try {
        if (!fs.existsSync(schemaPath)) {
            throw new Error(`Database schema file not found at ${schemaPath}`);
        }
        const schema = fs.readFileSync(schemaPath, 'utf8');
        dbInstance.exec(schema);
        console.log('Database schema initialized/verified.');
    } catch (error) {
        console.error('Error initializing database schema:', error);
        throw error; 
    }
    
    // Seed default admin user if not exists
    const checkAdminUserStmt = dbInstance.prepare('SELECT COUNT(*) as count FROM users WHERE username = ?');
    const adminUsername = 'admin';
    const adminUserExists = (checkAdminUserStmt.get(adminUsername) as { count: number }).count > 0;

    if (!adminUserExists) {
        console.log(`Admin user '${adminUsername}' not found, creating default admin...`);
        const defaultAdminPassword = 'adminpassword'; // Keep this secure or prompt user on first launch
        try {
            const hashedPassword = bcrypt.hashSync(defaultAdminPassword, SALT_ROUNDS);
            const insertAdminStmt = dbInstance.prepare('INSERT INTO users (username, password_hash, role) VALUES (?, ?, ?)');
            insertAdminStmt.run(adminUsername, hashedPassword, 'admin');
            console.log(`Default admin user '${adminUsername}' created with a default password. Please change it immediately.`);
        } catch (error) {
            console.error('Error creating default admin user:', error);
            // This could be critical, decide if app should proceed
        }
    }

    // Seed initial settings if not present (from seed.sql or directly)
    const seedPath = path.join(sqlFilesBasePath, 'seed.sql');
    try {
        if (fs.existsSync(seedPath)){
            const seedSql = fs.readFileSync(seedPath, 'utf8');
            // Execute seed.sql carefully, it might contain INSERT OR IGNORE for settings
            dbInstance.exec(seedSql);
            console.log('Ran seed.sql for initial settings.');
        } else {
            console.warn(`Seed file not found at ${seedPath}, skipping generic seed.`);
        }
    } catch (error) {
        console.error('Error running seed.sql:', error);
    }

    dbInstance.pragma('journal_mode = WAL');
    dbInstance.pragma('foreign_keys = ON');

    return dbInstance;
}

export function getDb(): betterSqlite3.Database {
    if (!dbInstance) {
        throw new Error('Database not initialized. Call initDb first.');
    }
    return dbInstance;
}

// Function to close the database connection, useful for cleanup or testing
export function closeDb(): void {
    if (dbInstance) {
        dbInstance.close();
        console.log('Database connection closed.');
        // dbInstance = null; // Typescript doesn't like reassigning const/let like this if not careful with scope
    }
}

// Graceful shutdown: ensure DB is closed when Electron app quits
if (process.env.NODE_ENV !== 'test') { // Avoid issues in test environments
    const electronApp = require('electron').app; // Dynamic require if used in backend not having direct electron dep
    if (electronApp) {
        electronApp.on('will-quit', () => {
            closeDb();
        });
    }
}
