import express, { Application, Request, Response, NextFunction } from 'express';
import path from 'path';
import cors from 'cors';
import bodyParser from 'body-parser';
import session from 'express-session';
import SQLiteStoreFactory from 'better-sqlite3-session-store';
import betterSqlite3 from 'better-sqlite3';
import type { App as ElectronApp } from 'electron'; // Use type import for Electron App

// Import routes
import authRoutes from './routes/auth';
import pagesRoutes from './routes/pages';
import menuRoutes from './routes/menu';
import dealsRoutes from './routes/deals';
import mediaRoutes from './routes/media';
import locationsRoutes from './routes/locations';
import analyticsRoutes from './routes/analytics';
import { initDb } from './db';
import {รูปภาพ} from './utils/fileUtils'; // Corrected import for fileUtils

const IS_DEV = process.env.NODE_ENV !== 'production';

export function startServer(electronApp: ElectronApp): Promise<number> {
    return new Promise((resolve, reject) => {
        const app: Application = express();
        const port = IS_DEV ? (process.env.PORT || 3000) : 0; // Use 0 for dynamic port in production if preferred

        // Initialize Database
        const dbPath = path.join(electronApp.getPath('userData'), 'tacosnganas_admin.db');
        console.log(`Database path: ${dbPath}`);
        const db = initDb(dbPath, electronApp); // Pass electronApp to initDb if needed for paths

        // Middleware
        // In an Electron app where the frontend is served by this Express instance on localhost,
        // strict CORS might not be as critical as for a public web server, but good to have.
        app.use(cors({
            origin: true, // Reflects the request origin, or set to specific like `http://localhost:${port}` if fixed
            credentials: true
        }));
        app.use(bodyParser.json({ limit: '100mb' })); // Increased limit for potentially large GrapesJS pages
        app.use(bodyParser.urlencoded({ extended: true, limit: '100mb' }));

        const SQLiteStore = SQLiteStoreFactory(session);
        const sessionStore = new SQLiteStore({
            client: db,
            expired: {
                clear: true,
                intervalMs: 900000 // 15 minutes
            }
        });

        app.use(session({
            store: sessionStore,
            secret: process.env.SESSION_SECRET || 'a-very-strong-tacos-secret-key-please-change', // Use env var
            resave: false,
            saveUninitialized: false,
            cookie: {
                secure: !IS_DEV, // true if served over https (not typical for localhost Electron backend)
                httpOnly: true,
                sameSite: 'lax', // Recommended for CSRF protection
                maxAge: 24 * 60 * 60 * 1000 // 24 hours
            }
        })); 

        app.use((req: Request, res: Response, next: NextFunction) => {
            req.db = db;
            req.electronApp = electronApp; // Make electronApp available if needed by routes
            next();
        });

        // API Routes
        app.use('/api/auth', authRoutes);
        app.use('/api/pages', pagesRoutes);
        app.use('/api/menu', menuRoutes);
        app.use('/api/deals', dealsRoutes);
        app.use('/api/media', mediaRoutes);
        app.use('/api/locations', locationsRoutes);
        app.use('/api/analytics', analyticsRoutes);

        // Determine project root for serving static files
        // __dirname in this file (backend/server.ts) will be dist/backend/server.js after compilation.
        // Project root is two levels up from dist/backend.
        const projectRoot = IS_DEV ? path.join(__dirname, '..', '..') : path.join(__dirname, '..', '..'); 
        // In a packaged app, paths might need to be relative to app.getAppPath() or process.resourcesPath
        // For electron-builder, if admin-ui and tacosnganas are in 'files' array in package.json, 
        // they are copied to the app's root resources directory.
        const resourcesPath = IS_DEV ? projectRoot : process.resourcesPath; // process.resourcesPath for packaged app

        const adminUiPath = path.join(resourcesPath, 'admin-ui');
        console.log(`Serving Admin UI from: ${adminUiPath}`);
        app.use('/admin-ui', express.static(adminUiPath));

        const tacosNganasPublicPath = path.join(resourcesPath, 'tacosnganas');
        console.log(`Serving TACOnganas site preview from: ${tacosNganasPublicPath}`);
        app.use('/site-preview', express.static(tacosNganasPublicPath));
        
        // Serve GrapesJS assets if not using CDN and they are packaged with the app
        // This assumes GrapesJS dist files are copied to admin-ui/vendor/grapesjs
        const grapesJsPath = path.join(adminUiPath, 'vendor', 'grapesjs', 'dist');
        console.log(`Serving GrapesJS assets from: ${grapesJsPath}`);
        app.use('/vendor/grapesjs', express.static(grapesJsPath));

        // Serve Chart.js assets if not using CDN
        const chartJsPath = path.join(adminUiPath, 'vendor', 'chart.js', 'dist');
        console.log(`Serving Chart.js assets from: ${chartJsPath}`);
        app.use('/vendor/chart.js', express.static(chartJsPath));

        app.get('/', (req, res) => {
            // The Electron app's main window loads /admin-ui/login.html or /admin-ui/index.html directly.
            // This root route on the server can be a fallback or health check.
            res.send('TACOnganas Admin Backend is running.');
        });

        app.use((err: any, req: Request, res: Response, next: NextFunction) => {
            console.error('[Global Error Handler]:', err.message, err.stack);
            res.status(err.status || 500).json({ 
                message: err.message || 'Internal Server Error',
                errors: err.errors, // For validation errors from express-validator
            });
        });

        const server = app.listen(port, () => {
            const address = server.address();
            const actualPort = typeof address === 'string' ? parseInt(address.split(':').pop() || '3000') : address?.port || 3000;
            console.log(`Admin backend server running on http://localhost:${actualPort}`);
            resolve(actualPort);
        });

        server.on('error', (error) => {
            console.error(`Server failed to start (port ${port}):`, error);
            reject(error);
        });
    });
}

declare global {
    namespace Express {
        interface Request {
            db?: betterSqlite3.Database;
            session?: session.Session & Partial<session.SessionData> & { 
                userId?: number | string; 
                username?: string;
                role?: string;
            };
            electronApp?: ElectronApp; // Make Electron app instance available
            file?: Multer.File; // For Multer single file uploads
            files?: Multer.File[] | { [fieldname: string]: Multer.File[] }; // For Multer multiple/mixed file uploads
        }
    }
}
