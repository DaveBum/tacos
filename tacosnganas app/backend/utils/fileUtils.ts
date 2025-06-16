import fs from 'fs-extra'; // Use fs-extra for convenience (like ensureDir)
import path from 'path';
import { getDb } from '../db';
import { App as ElectronApp } from 'electron';

const IS_DEV = process.env.NODE_ENV !== 'production';

/**
 * Gets the absolute path to the root of the 'tacosnganas' website folder.
 * This is where all public website files (HTML, CSS, JS, images) are stored.
 */
export function getWebsiteRootPath(electronApp: ElectronApp): string {
    const projectRoot = IS_DEV ? path.join(__dirname, '..', '..', '..') : process.resourcesPath;
    // In dev, __dirname is backend/utils. up 3 to project root.
    // In prod, process.resourcesPath is the root of packaged app contents.
    return path.join(projectRoot, 'tacosnganas');
}

/**
 * Gets the absolute path to a specific file or directory within the 'tacosnganas' website folder.
 * @param relativePath Path relative to the tacosnganas website root (e.g., 'index.html' or 'images/logo.png')
 */
export function getWebsiteFilePath(electronApp: ElectronApp, relativePath: string): string {
    return path.join(getWebsiteRootPath(electronApp), relativePath);
}

/**
 * Gets the absolute path to the media upload directory within the 'tacosnganas' website folder.
 * Typically 'tacosnganas/images/uploads' or 'tacosnganas/assets/uploads'.
 */
export function getMediaUploadPath(electronApp: ElectronApp, subfolder: string = 'images/uploads'): string {
    const uploadPath = getWebsiteFilePath(electronApp, subfolder);
    fs.ensureDirSync(uploadPath); // Ensure directory exists
    return uploadPath;
}

/**
 * Reads the content of a page (HTML file) from the tacosnganas website folder.
 * @param pageFilename Filename of the page (e.g., 'index.html')
 */
export async function readPageContent(electronApp: ElectronApp, pageFilename: string): Promise<string> {
    const filePath = getWebsiteFilePath(electronApp, pageFilename);
    if (!fs.existsSync(filePath)) {
        throw new Error(`Page file not found: ${pageFilename}`);
    }
    return fs.readFile(filePath, 'utf-8');
}

/**
 * Writes content to a page (HTML file) in the tacosnganas website folder.
 * Also creates a revision in the database.
 * @param pageFilename Filename of the page (e.g., 'index.html')
 * @param content HTML content to write
 * @param userId User ID of the editor
 */
export async function writePageContent(
    electronApp: ElectronApp, 
    pageFilename: string, 
    content: string, 
    userId: number | string,
    pageId?: number | string // Optional: if known, use it for revision linking
): Promise<void> {
    const filePath = getWebsiteFilePath(electronApp, pageFilename);
    const db = getDb();

    // 1. Create a backup/revision before overwriting
    let currentPageId = pageId;
    if (!currentPageId) {
        const pageRow = db.prepare('SELECT id FROM pages WHERE filename = ?').get(pageFilename) as { id: number } | undefined;
        if (pageRow) {
            currentPageId = pageRow.id;
        }
    }

    if (currentPageId) {
        let oldContent = '';
        if (fs.existsSync(filePath)) {
            oldContent = await fs.readFile(filePath, 'utf-8');
        }
        if (oldContent !== content) { // Only save revision if content changed
            const revisionStmt = db.prepare(
                'INSERT INTO page_revisions (page_id, content, editor_id, commit_message) VALUES (?, ?, ?, ?)'
            );
            revisionStmt.run(currentPageId, oldContent, userId, 'Page content updated via editor');
            console.log(`Revision saved for page: ${pageFilename} (Page ID: ${currentPageId})`);
        }
    } else {
        console.warn(`Could not find pageId for ${pageFilename}, revision not saved.`);
    }

    // 2. Write the new content to the file
    await fs.writeFile(filePath, content, 'utf-8');
    console.log(`Page content written to: ${filePath}`);

    // 3. Update the last_edited_at and last_edited_by fields in the pages table
    if (currentPageId) {
        const updatePageStmt = db.prepare('UPDATE pages SET last_edited_at = CURRENT_TIMESTAMP, last_edited_by = ? WHERE id = ?');
        updatePageStmt.run(userId, currentPageId);
    }
}

/**
 * Deletes a page file and its corresponding database entry.
 * @param electronApp 
 * @param pageFilename 
 */
export async function deletePage(electronApp: ElectronApp, pageFilename: string): Promise<void> {
    const filePath = getWebsiteFilePath(electronApp, pageFilename);
    const db = getDb();

    const pageRow = db.prepare('SELECT id FROM pages WHERE filename = ?').get(pageFilename) as { id: number } | undefined;
    if (!pageRow) {
        throw new Error(`Page ${pageFilename} not found in database.`);
    }

    // DB will cascade delete revisions and handle menu_items (SET NULL)
    db.prepare('DELETE FROM pages WHERE id = ?').run(pageRow.id);

    if (fs.existsSync(filePath)) {
        await fs.unlink(filePath);
        console.log(`Deleted page file: ${filePath}`);
    }
    console.log(`Page ${pageFilename} (ID: ${pageRow.id}) deleted from database.`);
}

/**
 * Creates a new page file from a template or basic structure.
 * @param electronApp 
 * @param pageFilename 
 * @param title 
 * @param content 
 * @param userId 
 * @param templateName 
 */
export async function createNewPage(
    electronApp: ElectronApp,
    pageFilename: string,
    title: string,
    initialContent: string,
    userId: number | string,
    description?: string,
    keywords?: string,
    templateName?: string
): Promise<{id: number | bigint}> {
    const filePath = getWebsiteFilePath(electronApp, pageFilename);
    const db = getDb();

    if (fs.existsSync(filePath)) {
        throw new Error(`Page file ${pageFilename} already exists.`);
    }

    // Add to pages table
    const stmt = db.prepare(
        'INSERT INTO pages (filename, title, description, keywords, template_used, last_edited_by, last_edited_at) VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)'
    );
    const result = stmt.run(pageFilename, title, description, keywords, templateName, userId);
    const newPageId = result.lastInsertRowid;

    // Write initial content to file
    await fs.writeFile(filePath, initialContent, 'utf-8');
    console.log(`Created new page file: ${filePath} with ID: ${newPageId}`);

    // Optionally, create an initial revision
    const revisionStmt = db.prepare(
        'INSERT INTO page_revisions (page_id, content, editor_id, commit_message) VALUES (?, ?, ?, ?)'
    );
    revisionStmt.run(newPageId, initialContent, userId, 'Initial page creation');

    return { id: newPageId };
}

/**
 * Sanitizes a filename to prevent path traversal and invalid characters.
 * @param filename 
 * @returns Sanitized filename
 */
export function sanitizeFilename(filename: string): string {
    // Remove directory traversal attempts (../, ..\)
    let saneFilename = path.normalize(filename).replace(/^\.\.[\/\\]+/, '');
    // Remove leading/trailing slashes/backslashes and dots
    saneFilename = saneFilename.replace(/^[\/\\]+/, '').replace(/[\/\\]+$/, '');
    saneFilename = saneFilename.replace(/^\.+/, '');
    // Basic sanitization: allow alphanumeric, hyphens, underscores, dots.
    // Replace other characters with hyphen. Ensure it ends with .html or other allowed extension.
    saneFilename = saneFilename.replace(/[^a-zA-Z0-9_.-]/g, '-');
    // Ensure it doesn't just become '.html' or similar from bad input
    if (saneFilename.startsWith('.')) {
        saneFilename = `page${saneFilename}`;
    }
    if (!saneFilename.match(/\.(html|htm|css|js|json)$/i) && saneFilename.includes('.')) {
        // If it has a dot but not a recognized web extension, this might be risky.
        // For now, we assume GrapesJS pages are HTML.
        // If it's like 'mypage.config', it will be 'mypage-config'
        saneFilename = saneFilename.split('.')[0]; 
    }
    if (!saneFilename.toLowerCase().endsWith('.html')) {
        saneFilename += '.html';
    }
    return saneFilename;
}

/**
 * Lists all HTML files in the root of the tacosnganas website folder.
 * This is a simplified way to get pages; a more robust way would query the `pages` table.
 */
export async function listHtmlPages(electronApp: ElectronApp): Promise<string[]> {
    const websiteRoot = getWebsiteRootPath(electronApp);
    const files = await fs.readdir(websiteRoot);
    return files.filter(file => file.endsWith('.html') || file.endsWith('.htm'));
}

/**
 * Ensures that common sections like header and footer are consistently applied.
 * This is a complex topic. For now, this function is a placeholder for the logic
 * that would either inject template content or verify includes.
 * 
 * A simple strategy: if header.html and footer.html exist in a 'templates' folder,
 * ensure pages use them. This might involve parsing and modifying HTML, or using a client-side include.
 */
export async function applyCommonSections(electronApp: ElectronApp, pageContent: string, pageFilename: string): Promise<string> {
    const templatesDir = getWebsiteFilePath(electronApp, 'templates');
    const headerPath = path.join(templatesDir, 'header.html');
    const footerPath = path.join(templatesDir, 'footer.html');

    let processedContent = pageContent;

    if (fs.existsSync(headerPath)) {
        const headerContent = await fs.readFile(headerPath, 'utf-8');
        // Example: Replace a placeholder like <!-- APP_HEADER --> or a specific existing header tag
        // This is a naive replacement and might need to be more sophisticated
        if (processedContent.includes('<!-- APP_HEADER -->')) {
            processedContent = processedContent.replace('<!-- APP_HEADER -->', headerContent);
        } else {
            // Fallback: try to inject after <body> if no placeholder
            // This is very basic and might break layouts.
            // A more robust solution uses a proper templating engine or defined blocks in GrapesJS.
            // processedContent = processedContent.replace(/<body[^>]*>/i, `$&\n${headerContent}`);
        }
    }

    if (fs.existsSync(footerPath)) {
        const footerContent = await fs.readFile(footerPath, 'utf-8');
        if (processedContent.includes('<!-- APP_FOOTER -->')) {
            processedContent = processedContent.replace('<!-- APP_FOOTER -->', footerContent);
        } else {
            // Fallback: try to inject before </body>
            // processedContent = processedContent.replace(/<\/body>/i, `${footerContent}\n$&`);
        }
    }
    return processedContent;
}

/**
 * Gets the path to the templates directory within the tacosnganas website folder.
 */
export function getTemplatesPath(electronApp: ElectronApp): string {
    return getWebsiteFilePath(electronApp, 'templates');
}
