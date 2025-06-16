import express, { Router, Request, Response, NextFunction } from 'express';
import { isAuthenticated } from './auth'; // Import authentication middleware
import {
    getWebsiteRootPath,
    getWebsiteFilePath,
    readPageContent,
    writePageContent,
    deletePage,
    createNewPage,
    sanitizeFilename,
    applyCommonSections,
    getTemplatesPath
} from '../utils/fileUtils';
import { getDb } from '../db';
import fs from 'fs-extra';
import path from 'path';
import { body, param, validationResult } from 'express-validator';

const router: Router = express.Router();

// GET /api/pages - List all manageable pages
router.get('/', isAuthenticated, async (req: Request, res: Response, next: NextFunction) => {
    try {
        const db = getDb();
        const pages = db.prepare(
            'SELECT id, filename, title, description, keywords, template_used, last_edited_at, ' +
            '(SELECT username FROM users WHERE users.id = pages.last_edited_by) as editor_username ' +
            'FROM pages ORDER BY filename ASC'
        ).all();
        res.json(pages);
    } catch (error) {
        next(error);
    }
});

// GET /api/pages/content/:filename - Get content of a specific page
router.get('/content/:filename', isAuthenticated, 
    [param('filename').notEmpty().withMessage('Filename is required')],
    async (req: Request, res: Response, next: NextFunction) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }
        try {
            const pageFilename = sanitizeFilename(req.params.filename);
            if (!req.electronApp) {
                return res.status(500).json({ message: 'Electron app instance not available.' });
            }
            let content = await readPageContent(req.electronApp, pageFilename);
            // Apply common sections like header/footer before sending to editor
            content = await applyCommonSections(req.electronApp, content, pageFilename);
            res.send(content);
        } catch (error) {
            next(error);
        }
    }
);

// POST /api/pages/content/:filename - Save content of a specific page
router.post('/content/:filename', isAuthenticated,
    [
        param('filename').notEmpty().withMessage('Filename is required'),
        body('htmlContent').isString().withMessage('HTML content must be a string'),
        // GrapesJS also sends cssContent, but we'll handle that if/when GrapesJS is configured to output separate CSS
    ],
    async (req: Request, res: Response, next: NextFunction) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }
        try {
            const pageFilename = sanitizeFilename(req.params.filename);
            const { htmlContent } = req.body; // GrapesJS might send html and css separately
            
            if (!req.electronApp || !req.session?.userId) {
                return res.status(500).json({ message: 'Application context or user session not available.' });
            }

            // Here, you might want to extract CSS from htmlContent if GrapesJS embeds it,
            // or handle req.body.cssContent if GrapesJS sends it separately and save it to a .css file.
            // For simplicity, assuming htmlContent contains all necessary HTML and inline/embedded CSS for now.

            await writePageContent(req.electronApp, pageFilename, htmlContent, req.session.userId);
            res.json({ message: `Page '${pageFilename}' saved successfully.` });
        } catch (error) {
            next(error);
        }
    }
);

// POST /api/pages - Create a new page
router.post('/', isAuthenticated,
    [
        body('filename').notEmpty().withMessage('Filename is required').custom((value) => {
            if (!value.toLowerCase().endsWith('.html')) {
                throw new Error('Filename must end with .html');
            }
            return true;
        }),
        body('title').notEmpty().withMessage('Title is required'),
        body('initialContent').optional().isString(),
        body('template').optional().isString() // e.g., 'blank_template.html' or 'article_template.html'
    ],
    async (req: Request, res: Response, next: NextFunction) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }
        try {
            const { filename, title, description, keywords, template } = req.body;
            let initialContent = req.body.initialContent as string | undefined;
            const saneFilename = sanitizeFilename(filename);

            if (!req.electronApp || !req.session?.userId) {
                return res.status(500).json({ message: 'Application context or user session not available.' });
            }

            // Load content from template if specified
            if (template) {
                const templatesPath = getTemplatesPath(req.electronApp);
                const templateFilePath = path.join(templatesPath, sanitizeFilename(template)); // Sanitize template name too
                if (fs.existsSync(templateFilePath)) {
                    initialContent = await fs.readFile(templateFilePath, 'utf-8');
                    // Replace placeholders in template if any (e.g., {{PAGE_TITLE}})
                    initialContent = initialContent.replace(/\{\{PAGE_TITLE\}\}/g, title);
                } else {
                    return res.status(400).json({ message: `Template file '${template}' not found.` });
                }
            } else if (!initialContent) {
                // Default basic HTML structure if no template and no initial content
                initialContent = `<!DOCTYPE html>\n<html lang="en">\n<head>\n    <meta charset="UTF-8">\n    <meta name="viewport" content="width=device-width, initial-scale=1.0">\n    <title>${title}</title>\n    <meta name="description" content="${description || ''}">\n    <meta name="keywords" content="${keywords || ''}">\n    <!-- APP_HEADER -->\n</head>\n<body>\n    <h1>${title}</h1>\n    <p>New page content goes here.</p>\n    <!-- APP_FOOTER -->\n</body>\n</html>`;
            }
            
            // Apply common sections to the initial content
            initialContent = await applyCommonSections(req.electronApp, initialContent, saneFilename);

            const newPage = await createNewPage(
                req.electronApp,
                saneFilename,
                title,
                initialContent,
                req.session.userId,
                description,
                keywords,
                template
            );
            res.status(201).json({ message: `Page '${saneFilename}' created successfully.`, page: {id: newPage.id, filename: saneFilename, title} });
        } catch (error: any) {
            if (error.message.includes('already exists')) {
                return res.status(409).json({ message: error.message });
            }
            next(error);
        }
    }
);

// PUT /api/pages/metadata/:id - Update page metadata (title, SEO, etc.)
router.put('/metadata/:id', isAuthenticated,
    [
        param('id').isInt({ gt: 0 }).withMessage('Valid Page ID is required'),
        body('title').notEmpty().withMessage('Title is required'),
        body('description').optional().isString(),
        body('keywords').optional().isString(),
        body('template_used').optional().isString()
    ],
    async (req: Request, res: Response, next: NextFunction) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }
        try {
            const pageId = req.params.id;
            const { title, description, keywords, template_used } = req.body;
            const db = getDb();

            const stmt = db.prepare(
                'UPDATE pages SET title = ?, description = ?, keywords = ?, template_used = ?, last_edited_at = CURRENT_TIMESTAMP, last_edited_by = ? WHERE id = ?'
            );
            const result = stmt.run(title, description, keywords, template_used, req.session?.userId, pageId);

            if (result.changes === 0) {
                return res.status(404).json({ message: `Page with ID ${pageId} not found.` });
            }

            // If filename needs to change based on title, that's a more complex operation (rename file, update links)
            // For now, filename is immutable via this endpoint.

            res.json({ message: `Metadata for page ID ${pageId} updated successfully.` });
        } catch (error) {
            next(error);
        }
    }
);

// DELETE /api/pages/:filename - Delete a page
router.delete('/:filename', isAuthenticated, 
    [param('filename').notEmpty().withMessage('Filename is required')],
    async (req: Request, res: Response, next: NextFunction) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }
        try {
            const pageFilename = sanitizeFilename(req.params.filename);
            if (!req.electronApp) {
                return res.status(500).json({ message: 'Electron app instance not available.' });
            }
            await deletePage(req.electronApp, pageFilename);
            res.json({ message: `Page '${pageFilename}' deleted successfully.` });
        } catch (error: any) {
            if (error.message.includes('not found')) {
                return res.status(404).json({ message: error.message });
            }
            next(error);
        }
    }
);

// GET /api/pages/revisions/:pageId - Get revision history for a page
router.get('/revisions/:pageId', isAuthenticated, 
    [param('pageId').isInt({ gt: 0 }).withMessage('Valid Page ID is required')],
    async (req: Request, res: Response, next: NextFunction) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }
        try {
            const pageId = req.params.pageId;
            const db = getDb();
            const revisions = db.prepare(
                'SELECT pr.id, pr.timestamp, pr.commit_message, u.username as editor_username ' +
                'FROM page_revisions pr LEFT JOIN users u ON pr.editor_id = u.id ' +
                'WHERE pr.page_id = ? ORDER BY pr.timestamp DESC'
            ).all(pageId);
            res.json(revisions);
        } catch (error) {
            next(error);
        }
    }
);

// GET /api/pages/revision/:revisionId - Get content of a specific revision
router.get('/revision/:revisionId', isAuthenticated, 
    [param('revisionId').isInt({ gt: 0 }).withMessage('Valid Revision ID is required')],
    async (req: Request, res: Response, next: NextFunction) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }
        try {
            const revisionId = req.params.revisionId;
            const db = getDb();
            const revision = db.prepare('SELECT content FROM page_revisions WHERE id = ?').get(revisionId) as { content: string } | undefined;
            if (!revision) {
                return res.status(404).json({ message: `Revision with ID ${revisionId} not found.` });
            }
            res.send(revision.content);
        } catch (error) {
            next(error);
        }
    }
);

// POST /api/pages/restore/:revisionId - Restore a page to a specific revision
router.post('/restore/:revisionId', isAuthenticated, 
    [param('revisionId').isInt({ gt: 0 }).withMessage('Valid Revision ID is required')],
    async (req: Request, res: Response, next: NextFunction) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }
        try {
            const revisionId = req.params.revisionId;
            const db = getDb();
            const revision = db.prepare(
                'SELECT pr.content, pr.editor_id, p.filename ' +
                'FROM page_revisions pr JOIN pages p ON pr.page_id = p.id ' +
                'WHERE pr.id = ?'
            ).get(revisionId) as { content: string, editor_id: number, filename: string } | undefined;

            if (!revision) {
                return res.status(404).json({ message: `Revision with ID ${revisionId} not found.` });
            }

            if (!req.electronApp || !req.session?.userId) {
                return res.status(500).json({ message: 'Application context or user session not available.' });
            }

            // The user restoring might be different from original editor_id of the revision
            await writePageContent(req.electronApp, revision.filename, revision.content, req.session.userId);
            res.json({ message: `Page '${revision.filename}' restored successfully from revision ID ${revisionId}.` });
        } catch (error) {
            next(error);
        }
    }
);

// GET /api/pages/templates - List available page templates
router.get('/templates', isAuthenticated, async (req: Request, res: Response, next: NextFunction) => {
    try {
        if (!req.electronApp) {
            return res.status(500).json({ message: 'Electron app instance not available.' });
        }
        const templatesPath = getTemplatesPath(req.electronApp);
        if (!fs.existsSync(templatesPath)) {
            // If templates directory doesn't exist, create it or return empty list
            fs.ensureDirSync(templatesPath);
            return res.json([]);
        }
        const files = await fs.readdir(templatesPath);
        const htmlTemplates = files
            .filter(file => file.toLowerCase().endsWith('.html') || file.toLowerCase().endsWith('.htm'))
            .map(file => ({ filename: file, name: path.basename(file, path.extname(file)).replace(/_/g, ' ') }));
        res.json(htmlTemplates);
    } catch (error) {
        next(error);
    }
});

export default router;
