document.addEventListener('DOMContentLoaded', () => {
    const pageSelect = document.getElementById('pageSelect');
    const loadPageButton = document.getElementById('loadPageButton');
    const savePageButton = document.getElementById('savePageButton');
    const createPageButton = document.getElementById('createPageButton');
    const createPageModal = document.getElementById('createPageModal');
    const createPageForm = document.getElementById('createPageForm');
    const newPageFilenameInput = document.getElementById('newPageFilename');
    const newPageTitleInput = document.getElementById('newPageTitle');
    const publishToGithubButton = document.getElementById('publishToGithubButton');

    let currentPageFilename = null;

    // Function to load pages into the select dropdown
    async function loadPagesIntoSelect() {
        if (!pageSelect) return;
        try {
            const response = await fetch('/api/pages');
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            const pages = await response.json();
            
            pageSelect.innerHTML = '<option value="">Select a page</option>'; // Clear existing options
            pages.forEach(page => {
                const option = document.createElement('option');
                option.value = page.filename;
                option.textContent = `${page.title || page.filename} (${page.filename})`;
                pageSelect.appendChild(option);
            });
        } catch (error) {
            console.error('Error loading pages:', error);
            alert('Failed to load pages. ' + error.message);
        }
    }
    window.loadPagesIntoSelect = loadPagesIntoSelect; // Make it globally accessible for bootstrap.js

    // Load page content into GrapesJS editor
    async function loadPageContent(filename) {
        if (!filename) {
            alert('Please select a page to load.');
            return;
        }
        try {
            const response = await fetch(`/api/pages/content/${filename}`);
            if (!response.ok) {
                // If page content not found, it might be a new page or an error
                if (response.status === 404) {
                    // Initialize editor with blank content or default template
                    if (window.initializeGrapesJS) {
                        window.initializeGrapesJS('<div><h1>New Page</h1><p>Start editing here.</p></div>', '');
                    }
                    alert(`Page content for ${filename} not found. Editor initialized with default content.`);
                    currentPageFilename = filename; // Still set current page for saving
                    return;
                }
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const pageData = await response.json();
            
            if (window.initializeGrapesJS) {
                // Initialize GrapesJS with the fetched content
                // The backend should return html and css. If it returns GrapesJS components/styles JSON, adjust here.
                window.initializeGrapesJS(pageData.html_content, pageData.css_content);
                currentPageFilename = filename;
            } else {
                alert('GrapesJS editor is not initialized.');
            }
        } catch (error) {
            console.error('Error loading page content:', error);
            alert('Failed to load page content. ' + error.message);
        }
    }

    // Save page content
    async function savePage() {
        if (!currentPageFilename) {
            alert('No page selected or loaded to save.');
            return;
        }
        if (!window.getEditorContent) {
            alert('GrapesJS editor content not available.');
            return;
        }

        const content = window.getEditorContent();
        if (!content) {
            alert('Could not retrieve content from editor.');
            return;
        }

        try {
            // We send HTML and CSS. The backend will save these.
            // For better reload fidelity, GrapesJS JSON (content.components, content.styles) is preferred.
            // The backend pages.ts needs to be adapted to store/retrieve this JSON if used.
            const payload = {
                html_content: content.html,
                css_content: content.css,
                // grapesjs_components: JSON.stringify(content.components), // Optional: for GrapesJS specific format
                // grapesjs_styles: JSON.stringify(content.styles),      // Optional: for GrapesJS specific format
            };

            const response = await fetch(`/api/pages/content/${currentPageFilename}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({ message: 'Failed to save page. Unknown error.' }));
                throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
            }

            const result = await response.json();
            alert(result.message || 'Page saved successfully!');
        } catch (error) {
            console.error('Error saving page:', error);
            alert('Failed to save page. ' + error.message);
        }
    }

    // Create new page
    async function createNewPage(filename, title) {
        try {
            const response = await fetch('/api/pages', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ filename, title, html_content: '<h1>New Page</h1><p>Start editing here.</p>', css_content: '' }),
            });
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({ message: 'Failed to create page. Unknown error.' }));
                throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
            }
            const newPage = await response.json();
            alert(`Page ${newPage.filename} created successfully!`);
            await loadPagesIntoSelect(); // Refresh page list
            if (pageSelect) pageSelect.value = newPage.filename;
            await loadPageContent(newPage.filename); // Load the new page into editor
            if (createPageModal) window.closeModal('createPageModal');
        } catch (error) {
            console.error('Error creating page:', error);
            alert('Failed to create page. ' + error.message);
        }
    }
    
    // Publish to GitHub
    async function publishToGitHub() {
        if (!window.electronAPI || !window.electronAPI.publishToGithub) {
            alert('GitHub publishing feature is not available.');
            return;
        }
        try {
            // Optional: Add a confirmation dialog here
            alert('Attempting to publish changes to GitHub. This may take a moment...');
            const result = await window.electronAPI.publishToGithub('Automated commit from Admin Panel');
            alert('Successfully published to GitHub: ' + result);
        } catch (error) {
            console.error('Error publishing to GitHub:', error);
            alert('Failed to publish to GitHub: ' + error.message);
        }
    }


    // Event Listeners
    if (loadPageButton && pageSelect) {
        loadPageButton.addEventListener('click', () => {
            loadPageContent(pageSelect.value);
        });
    }

    if (savePageButton) {
        savePageButton.addEventListener('click', savePage);
    }

    if (createPageButton && createPageModal) {
        createPageButton.addEventListener('click', () => {
            if(window.openModal) window.openModal('createPageModal');
            if(newPageFilenameInput) newPageFilenameInput.value = '';
            if(newPageTitleInput) newPageTitleInput.value = '';
        });
    }

    if (createPageForm && newPageFilenameInput && newPageTitleInput) {
        createPageForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const filename = newPageFilenameInput.value.trim();
            const title = newPageTitleInput.value.trim();
            if (filename && title) {
                if (!filename.endsWith('.html')) {
                    alert('Filename must end with .html');
                    return;
                }
                createNewPage(filename, title);
            } else {
                alert('Please provide both filename and title.');
            }
        });
    }
    
    if (publishToGithubButton) {
        publishToGithubButton.addEventListener('click', publishToGitHub);
    }

    // Initial load of pages into select (if on a page that has the select element)
    // This is also called by bootstrap.js when navigating to the page editor section
    if (pageSelect) {
        loadPagesIntoSelect();
    }
    
    // If this script is loaded on editor.html, initialize GrapesJS and load pages
    // This ensures that if editor.html is loaded directly, it still works.
    if (window.location.pathname.endsWith('editor.html')) {
        if (window.initializeGrapesJS) window.initializeGrapesJS(); 
        if (window.loadPagesIntoSelect) loadPagesIntoSelect();
    }
});
