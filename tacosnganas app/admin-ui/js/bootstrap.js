/**
 * TACOnganas Admin Panel - Client-Side Bootstrap
 *
 * This script manages the entire admin panel's front-end logic, including:
 * - Authentication (login/logout)
 * - Single Page Application (SPA) navigation
 * - API communication with the backend
 * - Rendering views for Dashboard, Pages, Media, Deals, Locations, Settings
 * - UI interactions and event handling
 * - Integration points for Chart.js (Dashboard) and GrapesJS (Page Editor)
 */

window.adminApp = (function () { // Assign to window.adminApp
    'use strict';

    const API_BASE_URL = 'http://localhost:3000/api'; 

    // DOM Elements (module-scoped)
    let loginView, appView, mainContent, mainNav, notificationsAreaGlobal; // Renamed to avoid conflict
    let usernameInput, passwordInput, loginForm, loginError;
    let logoutButton;

    // Application State
    let currentPage = '';
    let authToken = localStorage.getItem('authToken') || null;
    let grapesEditorInstance = null;
    let currentPageFile = null;


    // Utility Functions
    const $ = (selector) => document.querySelector(selector);
    const $$ = (selector) => document.querySelectorAll(selector);

    function showNotification(message, type = 'info', areaId = 'editorNotificationsContainer', duration = 3500) {
        const notificationsDiv = document.getElementById(areaId);
        if (notificationsDiv) {
            const alertType = type === 'error' ? 'danger' : (type === 'warning' ? 'warning' : (type === 'success' ? 'success' : 'info'));
            const alertId = `notif-${Date.now()}`;
            const alertHtml = `
                <div class="alert alert-${alertType} alert-dismissible fade show mb-2" role="alert" id="${alertId}" style="min-width: 250px; pointer-events: auto;">
                    ${message}
                    <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
                </div>`;
            
            // Prepend to have newest on top if that's desired, or append if at bottom
            notificationsDiv.insertAdjacentHTML('beforeend', alertHtml);
            
            const newAlert = document.getElementById(alertId);
            if (duration > 0) {
                setTimeout(() => {
                    if (newAlert) {
                        const bsAlert = window.bootstrap && window.bootstrap.Alert ? window.bootstrap.Alert.getInstance(newAlert) : null;
                        if (bsAlert) {
                            bsAlert.close();
                        } else { newAlert.remove(); }
                    }
                }, duration);
            }
        } else {
            console.warn(`Notification area '${areaId}' not found. Message: ${message}`);
            window.alert(`[${type.toUpperCase()}] ${message}`);
        }
    }

    async function apiRequest(method, endpoint, body = null, headers = {}) {
        const options = {
            method,
            headers: {
                'Content-Type': 'application/json',
                ...headers,
            },
        };
        if (authToken) {
            options.headers['Authorization'] = `Bearer ${authToken}`;
        }
        if (body) {
            options.body = JSON.stringify(body);
        }

        try {
            const response = await fetch(`${API_BASE_URL}${endpoint}`, options);
            if (response.status === 401) {
                showNotification('Session expired or unauthorized. Please log in.', 'error');
                if (typeof handleLogout === 'function') handleLogout(false);
                return null;
            }
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({ message: response.statusText }));
                throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
            }
            if (response.headers.get("content-type")?.includes("application/json")) {
                return await response.json();
            }
            return await response.text();
        } catch (error) {
            console.error(`API Request Error (${method} ${endpoint}):`, error);
            showNotification(`API Error: ${error.message}`, 'error');
            throw error;
        }
    }
    
    async function apiMultipartRequest(method, endpoint, formData, headers = {}) {
        const options = {
            method,
            headers: { ...headers },
            body: formData,
        };
        if (authToken) {
            options.headers['Authorization'] = `Bearer ${authToken}`;
        }

        try {
            const response = await fetch(`${API_BASE_URL}${endpoint}`, options);
            if (response.status === 401) {
                showNotification('Session expired or unauthorized. Please log in.', 'error');
                if (typeof handleLogout === 'function') handleLogout(false);
                return null;
            }
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({ message: response.statusText }));
                throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
            }
            if (response.headers.get("content-type")?.includes("application/json")) {
                return await response.json();
            }
            return await response.text();
        } catch (error) {
            console.error(`API Multipart Request Error (${method} ${endpoint}):`, error);
            showNotification(`Multipart API Error: ${error.message}`, 'error');
            throw error;
        }
    }


    // --- Authentication ---
    async function checkAuthStatus() {
        try {
            // Assumes backend has an endpoint to check auth status,
            // possibly returning user info or just a 200 OK if authenticated.
            // If using session cookies, this might just try to load a protected route.
            const user = await apiRequest('GET', '/auth/status');
            if (user && user.loggedIn) { // Adjust based on your /auth/status response
                authToken = user.token; // If using JWT
                showAppView();
                return true;
            } else {
                showLoginView();
                return false;
            }
        } catch (error) {
            // If /auth/status fails (e.g. 401), it's handled by apiRequest to show login
            // This catch is for network errors or other unexpected issues
            console.error("Auth check failed:", error);
            showLoginView();
            return false;
        }
    }

    async function handleLogin(event) {
        if (event) event.preventDefault();
        const username = usernameInput.value.trim();
        const password = passwordInput.value.trim();

        if (!username || !password) {
            loginError.textContent = 'Username and password are required.';
            return;
        }
        loginError.textContent = '';

        try {
            const response = await apiRequest('POST', '/auth/login', { username, password });
            if (response && response.success) { // Adjust based on your login response
                authToken = response.token; // If using JWT
                localStorage.setItem('authToken', authToken); // Persist token if JWT
                showNotification('Login successful!', 'success');
                showAppView();
                navigateTo('dashboard'); // Navigate to dashboard after login
            } else {
                loginError.textContent = response.message || 'Login failed. Please check your credentials.';
            }
        } catch (error) {
            loginError.textContent = error.message || 'An error occurred during login.';
        }
    }

    async function handleLogout(redirect = true) {
        try {
            await apiRequest('POST', '/auth/logout');
        } catch (error) {
            console.error("Logout API call failed:", error);
        } finally {
            authToken = null;
            localStorage.removeItem('authToken');
            if (redirect) {
                // Redirect to login page, specific to how your app handles this.
                // For the editor, it might mean going back to a dashboard or login screen.
                // window.location.href = 'login.html'; // Or appropriate path
                showNotification('Logged out. Redirecting to login...', 'info');
                // This might be handled by electron main process or a different mechanism
                // For now, just clear token and notify.
                 if (window.electron && typeof window.electron.redirectToLogin === 'function') {
                    window.electron.redirectToLogin();
                 } else {
                    // Fallback if electron bridge not available
                    const loginPath = window.location.pathname.replace(/index\.html$/, 'login.html');
                    window.location.href = loginPath;
                 }
            }
        }
    }

    function showLoginView() {
        if (loginView) loginView.style.display = 'block';
        if (appView) appView.style.display = 'none';
        currentPage = 'login';
        window.location.hash = '#login';
    }

    function showAppView() {
        if (loginView) loginView.style.display = 'none';
        if (appView) appView.style.display = 'block';
        // Default to dashboard if no hash or hash is login
        if (!window.location.hash || window.location.hash === '#login') {
            navigateTo('dashboard');
        } else {
            handleHashChange(); // Load view based on current hash
        }
    }

    // --- SPA Navigation & View Rendering ---
    function setupNavigation() {
        if (!mainNav) return;
        mainNav.addEventListener('click', (event) => {
            if (event.target.tagName === 'A' && event.target.href.includes('#')) {
                event.preventDefault();
                const viewId = event.target.hash.substring(1);
                navigateTo(viewId);
            }
        });
        window.addEventListener('hashchange', handleHashChange);
    }

    function navigateTo(viewId) {
        if (viewId === currentPage && viewId !== 'editor') return; // Avoid reloading same view, unless it's editor
        window.location.hash = viewId;
    }

    function handleHashChange() {
        const hash = window.location.hash.substring(1) || 'dashboard';
        if (hash === 'login') { // Should be handled by auth check
            if (authToken) navigateTo('dashboard');
            else showLoginView();
            return;
        }

        // Ensure user is authenticated for app views
        if (!authToken && hash !== 'login') {
            checkAuthStatus().then(isAuthenticated => {
                if (isAuthenticated) {
                    loadView(hash);
                }
            });
            return;
        }
        loadView(hash);
    }

    function loadView(viewId) {
        if (!mainContent) return;
        currentPage = viewId;
        mainContent.innerHTML = `<h2>Loading ${viewId}...</h2>`; // Basic loading indicator

        // Update active link in nav
        $$('#main-nav a').forEach(a => a.classList.remove('active'));
        const activeLink = $(`#main-nav a[href="#${viewId}"]`);
        if (activeLink) activeLink.classList.add('active');

        switch (viewId) {
            case 'dashboard':
                loadDashboardView();
                break;
            case 'pages':
                loadPagesView();
                break;
            case 'media':
                loadMediaManagerView();
                break;
            case 'deals':
                loadDealsView();
                break;
            case 'locations':
                loadLocationsView();
                break;
            case 'settings':
                loadSettingsView();
                break;
            case 'editor': // Special case, might need params
                const params = new URLSearchParams(window.location.search);
                const pageFile = params.get('page');
                loadEditorView(pageFile);
                break;
            default:
                mainContent.innerHTML = `<h2>View not found: ${viewId}</h2>`;
        }
    }

    // --- View Specific Logic ---

    // Dashboard View
    async function loadDashboardView() {
        mainContent.innerHTML = `
            <h1>Dashboard</h1>
            <div class="dashboard-grid">
                <div class="metric-card" id="visits-today">Loading...</div>
                <div class="metric-card" id="active-deals">Loading...</div>
                <div class="metric-card" id="total-pages">Loading...</div>
            </div>
            <div class="charts-container">
                <div class="chart-card">
                    <h3>Site Traffic (Last 7 Days)</h3>
                    <canvas id="trafficChart"></canvas>
                </div>
                <div class="chart-card">
                    <h3>Top Pages (Last 7 Days)</h3>
                    <canvas id="topPagesChart"></canvas>
                </div>
            </div>
            <button id="publish-all-changes" class="publish-button">Publish All Site Changes</button>
        `;
        $('#publish-all-changes').addEventListener('click', handlePublishAllChanges);

        try {
            // Fetch summary stats
            const summary = await apiRequest('GET', '/stats/summary');
            if (summary) {
                $('#visits-today').textContent = `Visits Today: ${summary.visitsToday || 0}`;
                $('#active-deals').textContent = `Active Deals: ${summary.activeDeals || 0}`;
                $('#total-pages').textContent = `Total Pages: ${summary.totalPages || 0}`;
            }

            // Fetch chart data
            const trafficData = await apiRequest('GET', '/stats/traffic?period=7d');
            if (trafficData && trafficData.labels && trafficData.data) {
                renderLineChart('trafficChart', 'Page Visits', trafficData.labels, trafficData.data);
            }

            const topPagesData = await apiRequest('GET', '/stats/top-pages?period=7d');
            if (topPagesData && topPagesData.labels && topPagesData.data) {
                renderBarChart('topPagesChart', 'Views', topPagesData.labels, topPagesData.data);
            }
        } catch (error) {
            mainContent.innerHTML += `<p class="error">Failed to load dashboard data: ${error.message}</p>`;
        }
    }

    function renderLineChart(canvasId, label, labels, data) {
        const ctx = document.getElementById(canvasId)?.getContext('2d');
        if (!ctx) return;
        new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    label: label,
                    data: data,
                    borderColor: 'rgb(75, 192, 192)',
                    tension: 0.1
                }]
            },
            options: { responsive: true, maintainAspectRatio: false }
        });
    }

    function renderBarChart(canvasId, label, labels, data) {
        const ctx = document.getElementById(canvasId)?.getContext('2d');
        if (!ctx) return;
        new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [{
                    label: label,
                    data: data,
                    backgroundColor: 'rgba(54, 162, 235, 0.5)',
                    borderColor: 'rgb(54, 162, 235)',
                    borderWidth: 1
                }]
            },
            options: { responsive: true, maintainAspectRatio: false, indexAxis: 'y' }
        });
    }

    async function handlePublishAllChanges() {
        if (!confirm('Are you sure you want to publish all local changes to the live site? This will commit and push to GitHub.')) {
            return;
        }
        showNotification('Publishing changes... This may take a moment.', 'info');
        try {
            const result = await apiRequest('POST', '/site/publish');
            showNotification(result.message || 'Site published successfully!', 'success');
        } catch (error) {
            showNotification(`Publishing failed: ${error.message}`, 'error');
        }
    }

    // Pages View
    async function loadPagesView() {
        mainContent.innerHTML = `
            <h1>Manage Pages</h1>
            <button id="create-page-btn">Create New Page</button>
            <div id="pages-list">Loading pages...</div>
        `;
        $('#create-page-btn').addEventListener('click', () => showCreatePageModal());

        try {
            const pages = await apiRequest('GET', '/pages');
            const pagesListDiv = $('#pages-list');
            if (pages && pages.length > 0) {
                pagesListDiv.innerHTML = `
                    <table>
                        <thead>
                            <tr>
                                <th>Title</th>
                                <th>Filename</th>
                                <th>Last Modified</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${pages.map(page => `
                                <tr data-filename="${page.filename}">
                                    <td>${page.title}</td>
                                    <td>${page.filename}</td>
                                    <td>${new Date(page.lastModified).toLocaleString()}</td>
                                    <td>
                                        <button class="edit-page-btn">Edit</button>
                                        <button class="view-page-btn">View</button>
                                        <button class="delete-page-btn">Delete</button>
                                        <button class="seo-page-btn">SEO</button>
                                    </td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                `;
                pagesListDiv.querySelectorAll('.edit-page-btn').forEach(btn => btn.addEventListener('click', (e) => {
                    const filename = e.target.closest('tr').dataset.filename;
                    navigateToEditor(filename);
                }));
                pagesListDiv.querySelectorAll('.delete-page-btn').forEach(btn => btn.addEventListener('click', (e) => {
                    const filename = e.target.closest('tr').dataset.filename;
                    handleDeletePage(filename);
                }));
                pagesListDiv.querySelectorAll('.seo-page-btn').forEach(btn => btn.addEventListener('click', (e) => {
                    const filename = e.target.closest('tr').dataset.filename;
                    showSeoModal(filename);
                }));
                // Add view button functionality if needed (e.g., open in new tab/preview)
            } else {
                pagesListDiv.innerHTML = '<p>No pages found. Create one!</p>';
            }
        } catch (error) {
            $('#pages-list').innerHTML = `<p class="error">Failed to load pages: ${error.message}</p>`;
        }
    }

    function showCreatePageModal() {
        // Simple prompt for now, ideally a modal form
        const title = prompt("Enter new page title (e.g., 'About Us'):");
        if (!title) return;
        let filename = prompt("Enter filename (e.g., 'about.html', alphanumeric and .html only):");
        if (!filename) return;

        filename = filename.toLowerCase().replace(/[^a-z0-9.-_]/g, '');
        if (!filename.endsWith('.html')) filename += '.html';

        if (!/^[a-z0-9.-_]+\.html$/.test(filename)) {
            showNotification('Invalid filename. Use alphanumeric characters, hyphens, underscores, and end with .html.', 'error');
            return;
        }

        const template = prompt("Enter template name to use (e.g., 'default', 'landing-page', leave blank for default):", "default");

        handleCreatePage(title, filename, template);
    }

    async function handleCreatePage(title, filename, template) {
        try {
            const newPage = await apiRequest('POST', '/pages', { title, filename, template });
            showNotification(`Page "${newPage.title}" created successfully!`, 'success');
            loadPagesView(); // Refresh list
        } catch (error) {
            showNotification(`Failed to create page: ${error.message}`, 'error');
        }
    }

    async function handleDeletePage(filename) {
        if (!confirm(`Are you sure you want to delete page "${filename}"? This cannot be undone.`)) {
            return;
        }
        try {
            await apiRequest('DELETE', `/pages/${filename}`);
            showNotification(`Page "${filename}" deleted successfully.`, 'success');
            loadPagesView(); // Refresh list
        } catch (error) {
            showNotification(`Failed to delete page: ${error.message}`, 'error');
        }
    }

    function navigateToEditor(filename) {
        // Navigate to a dedicated editor URL/view.
        // The editor itself (GrapesJS) will be initialized by scripts on that page/view.
        // Pass filename as a query parameter.
        // This assumes editor.html is the host page for GrapesJS
        window.open(`editor.html?page=${encodeURIComponent(filename)}`, '_blank');
        showNotification(`Opening ${filename} in the editor... If a new tab/window doesn't open, check your pop-up blocker.`, 'info');
        // Or, if SPA and editor is a view:
        // window.location.hash = `editor?page=${encodeURIComponent(filename)}`;
    }
    
    // This function would be called from editor.html or its script after GrapesJS saves.
    // For now, it's a conceptual link. The editor will likely call an API endpoint directly.
    // function onPageSaved(filename, newContent) {
    //     showNotification(`Page "${filename}" saved successfully.`, 'success');
    //     if (currentPage === 'pages') loadPagesView(); // Refresh if on pages list
    // }

    async function showSeoModal(filename) {
        try {
            const seoData = await apiRequest('GET', `/pages/${filename}/seo`);
            const newTitle = prompt(`Enter SEO Title for ${filename}:`, seoData.title || '');
            if (newTitle === null) return; // User cancelled
            const newDescription = prompt(`Enter Meta Description for ${filename}:`, seoData.description || '');
            if (newDescription === null) return;

            await apiRequest('PUT', `/pages/${filename}/seo`, { title: newTitle, description: newDescription });
            showNotification(`SEO data for ${filename} updated.`, 'success');
        } catch (error) {
            showNotification(`Failed to update SEO data: ${error.message}`, 'error');
        }
    }


    // Editor View (Placeholder - GrapesJS integration is complex and typically in its own context)
    // This function is called if navigating to #editor.
    // Actual GrapesJS setup would be in editor.html or a dedicated editor.js.
    async function loadEditorView(pageFilename) {
        if (!pageFilename) {
            mainContent.innerHTML = `<h1>Page Editor</h1><p class="error">No page specified to edit.</p><a href="#pages">Back to Pages</a>`;
            return;
        }
        mainContent.innerHTML = `
            <h1>Edit Page: ${pageFilename}</h1>
            <p>The GrapesJS editor for this page would be initialized here.</p>
            <p>This is a placeholder. The actual editor is expected to be in <strong>editor.html</strong>.</p>
            <div id="grapesjs-editor-container" style="height: 600px; border: 1px solid #ccc;">
                <!-- GrapesJS will attach here -->
            </div>
            <button id="save-page-content-from-spa">Save (Conceptual)</button>
            <a href="#pages">Back to Pages List</a>
        `;
        // In a real SPA scenario, you'd initialize GrapesJS here.
        // For now, we assume editor.html is used.
        // Example: if GrapesJS was part of this SPA:
        // const pageContent = await apiRequest('GET', `/pages/${pageFilename}/content`);
        // initializeGrapesJsInstance('#grapesjs-editor-container', pageContent, pageFilename);
    }


    // Media Manager View
    async function loadMediaManagerView() {
        mainContent.innerHTML = `
            <h1>Media Manager</h1>
            <div class="media-upload-form">
                <input type="file" id="media-file-input" multiple accept="image/*,application/pdf">
                <button id="upload-media-btn">Upload Selected Files</button>
            </div>
            <div id="media-gallery">Loading media...</div>
        `;
        $('#upload-media-btn').addEventListener('click', handleMediaUpload);

        try {
            const mediaItems = await apiRequest('GET', '/media');
            const mediaGalleryDiv = $('#media-gallery');
            if (mediaItems && mediaItems.length > 0) {
                mediaGalleryDiv.innerHTML = `
                    <div class="media-grid">
                        ${mediaItems.map(item => `
                            <div class="media-item" data-filename="${item.filename}">
                                ${item.type.startsWith('image/') ? `<img src="/assets/${item.filename}" alt="${item.filename}" title="${item.filename}">` : `<div class="file-icon">${item.filename} (${item.type})</div>`}
                                <p>${item.filename} (${(item.size / 1024).toFixed(1)} KB)</p>
                                <button class="delete-media-btn">Delete</button>
                                <!-- Add crop/edit buttons if functionality exists -->
                            </div>
                        `).join('')}
                    </div>
                `;
                mediaGalleryDiv.querySelectorAll('.delete-media-btn').forEach(btn => btn.addEventListener('click', (e) => {
                    const filename = e.target.closest('.media-item').dataset.filename;
                    handleDeleteMedia(filename);
                }));
            } else {
                mediaGalleryDiv.innerHTML = '<p>No media files found. Upload some!</p>';
            }
        } catch (error) {
            $('#media-gallery').innerHTML = `<p class="error">Failed to load media: ${error.message}</p>`;
        }
    }

    async function handleMediaUpload() {
        const fileInput = $('#media-file-input');
        if (!fileInput.files.length) {
            showNotification('No files selected for upload.', 'warning');
            return;
        }

        const formData = new FormData();
        for (const file of fileInput.files) {
            formData.append('mediafiles', file); // 'mediafiles' should match Multer field name
        }

        showNotification('Uploading files...', 'info');
        try {
            const result = await apiMultipartRequest('POST', '/media/upload', formData);
            showNotification(result.message || `${fileInput.files.length} file(s) uploaded successfully!`, 'success');
            loadMediaManagerView(); // Refresh gallery
            fileInput.value = ''; // Clear file input
        } catch (error) {
            showNotification(`Upload failed: ${error.message}`, 'error');
        }
    }

    async function handleDeleteMedia(filename) {
        if (!confirm(`Are you sure you want to delete "${filename}"? This might break pages using this media.`)) {
            return;
        }
        try {
            await apiRequest('DELETE', `/media/${filename}`);
            showNotification(`Media file "${filename}" deleted successfully.`, 'success');
            loadMediaManagerView(); // Refresh gallery
        } catch (error) {
            showNotification(`Failed to delete media: ${error.message}`, 'error');
        }
    }

    // Deals View
    async function loadDealsView() {
        mainContent.innerHTML = `
            <h1>Manage Deals & Announcements</h1>
            <button id="create-deal-btn">Create New Deal/Announcement</button>
            <div id="deals-list">Loading deals...</div>
        `;
        $('#create-deal-btn').addEventListener('click', () => showDealForm(null)); // null for new deal

        try {
            const deals = await apiRequest('GET', '/deals');
            const dealsListDiv = $('#deals-list');
            if (deals && deals.length > 0) {
                dealsListDiv.innerHTML = `
                    <table>
                        <thead>
                            <tr>
                                <th>Title</th>
                                <th>Description</th>
                                <th>Start Date</th>
                                <th>End Date</th>
                                <th>Active</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${deals.map(deal => `
                                <tr data-id="${deal.id}">
                                    <td>${deal.title}</td>
                                    <td>${deal.description.substring(0, 50)}...</td>
                                    <td>${new Date(deal.start_datetime).toLocaleString()}</td>
                                    <td>${new Date(deal.end_datetime).toLocaleString()}</td>
                                    <td>${deal.active_flag ? 'Yes' : 'No'}</td>
                                    <td>
                                        <button class="edit-deal-btn">Edit</button>
                                        <button class="delete-deal-btn">Delete</button>
                                    </td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                `;
                dealsListDiv.querySelectorAll('.edit-deal-btn').forEach(btn => btn.addEventListener('click', (e) => {
                    const dealId = e.target.closest('tr').dataset.id;
                    const deal = deals.find(d => d.id == dealId);
                    showDealForm(deal);
                }));
                dealsListDiv.querySelectorAll('.delete-deal-btn').forEach(btn => btn.addEventListener('click', (e) => {
                    const dealId = e.target.closest('tr').dataset.id;
                    handleDeleteDeal(dealId);
                }));
            } else {
                dealsListDiv.innerHTML = '<p>No deals or announcements found.</p>';
            }
        } catch (error) {
            $('#deals-list').innerHTML = `<p class="error">Failed to load deals: ${error.message}</p>`;
        }
    }

    function showDealForm(deal = null) {
        // This should ideally be a modal or a dedicated form area
        const isEditing = deal !== null;
        const formHtml = `
            <div id="deal-form-modal" class="modal">
                <div class="modal-content">
                    <span class="close-button" onclick="this.parentElement.parentElement.remove()">&times;</span>
                    <h2>${isEditing ? 'Edit' : 'Create'} Deal/Announcement</h2>
                    <form id="deal-form">
                        <input type="hidden" id="deal-id" value="${isEditing ? deal.id : ''}">
                        <div><label for="deal-title">Title:</label><input type="text" id="deal-title" required value="${isEditing ? deal.title : ''}"></div>
                        <div><label for="deal-description">Description:</label><textarea id="deal-description" required>${isEditing ? deal.description : ''}</textarea></div>
                        <div><label for="deal-image">Image URL (optional):</label><input type="text" id="deal-image" value="${isEditing ? deal.image || '' : ''}"></div>
                        <div><label for="deal-start">Start Date/Time:</label><input type="datetime-local" id="deal-start" required value="${isEditing ? new Date(deal.start_datetime).toISOString().substring(0, 16) : ''}"></div>
                        <div><label for="deal-end">End Date/Time:</label><input type="datetime-local" id="deal-end" required value="${isEditing ? new Date(deal.end_datetime).toISOString().substring(0, 16) : ''}"></div>
                        <div><label for="deal-active">Active:</label><input type="checkbox" id="deal-active" ${isEditing && deal.active_flag ? 'checked' : ''}></div>
                        <button type="submit">${isEditing ? 'Save Changes' : 'Create Deal'}</button>
                    </form>
                </div>
            </div>
        `;
        // Append modal to body or mainContent
        if ($('#deal-form-modal')) $('#deal-form-modal').remove(); // Remove if already exists
        document.body.insertAdjacentHTML('beforeend', formHtml);
        $('#deal-form').addEventListener('submit', handleSaveDeal);
    }

    async function handleSaveDeal(event) {
        event.preventDefault();
        const id = $('#deal-id').value;
        const dealData = {
            title: $('#deal-title').value,
            description: $('#deal-description').value,
            image: $('#deal-image').value || null,
            start_datetime: new Date($('#deal-start').value).toISOString(),
            end_datetime: new Date($('#deal-end').value).toISOString(),
            active_flag: $('#deal-active').checked,
        };

        try {
            if (id) { // Editing existing deal
                await apiRequest('PUT', `/deals/${id}`, dealData);
                showNotification('Deal updated successfully!', 'success');
            } else { // Creating new deal
                await apiRequest('POST', '/deals', dealData);
                showNotification('Deal created successfully!', 'success');
            }
            $('#deal-form-modal').remove();
            loadDealsView(); // Refresh list
        } catch (error) {
            showNotification(`Failed to save deal: ${error.message}`, 'error');
        }
    }

    async function handleDeleteDeal(dealId) {
        if (!confirm(`Are you sure you want to delete this deal?`)) {
            return;
        }
        try {
            await apiRequest('DELETE', `/deals/${dealId}`);
            showNotification('Deal deleted successfully.', 'success');
            loadDealsView(); // Refresh list
        } catch (error) {
            showNotification(`Failed to delete deal: ${error.message}`, 'error');
        }
    }

    // Locations View
    async function loadLocationsView() {
        mainContent.innerHTML = `
            <h1>Manage Restaurant Locations</h1>
            <button id="create-location-btn">Add New Location</button>
            <div id="locations-list">Loading locations...</div>
        `;
        $('#create-location-btn').addEventListener('click', () => showLocationForm(null));

        try {
            const locations = await apiRequest('GET', '/locations');
            const locationsListDiv = $('#locations-list');
            if (locations && locations.length > 0) {
                locationsListDiv.innerHTML = `
                    <table>
                        <thead>
                            <tr>
                                <th>Name</th>
                                <th>Address</th>
                                <th>Hours</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${locations.map(loc => `
                                <tr data-id="${loc.id}">
                                    <td>${loc.name}</td>
                                    <td>${loc.address}</td>
                                    <td>${loc.hours}</td>
                                    <td>
                                        <button class="edit-location-btn">Edit</button>
                                        <button class="delete-location-btn">Delete</button>
                                    </td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                `;
                locationsListDiv.querySelectorAll('.edit-location-btn').forEach(btn => btn.addEventListener('click', (e) => {
                    const locId = e.target.closest('tr').dataset.id;
                    const loc = locations.find(l => l.id == locId);
                    showLocationForm(loc);
                }));
                locationsListDiv.querySelectorAll('.delete-location-btn').forEach(btn => btn.addEventListener('click', (e) => {
                    const locId = e.target.closest('tr').dataset.id;
                    handleDeleteLocation(locId);
                }));
            } else {
                locationsListDiv.innerHTML = '<p>No locations found.</p>';
            }
        } catch (error) {
            $('#locations-list').innerHTML = `<p class="error">Failed to load locations: ${error.message}</p>`;
        }
    }

    function showLocationForm(location = null) {
        const isEditing = location !== null;
        const formHtml = `
            <div id="location-form-modal" class="modal">
                <div class="modal-content">
                    <span class="close-button" onclick="this.parentElement.parentElement.remove()">&times;</span>
                    <h2>${isEditing ? 'Edit' : 'Add'} Location</h2>
                    <form id="location-form">
                        <input type="hidden" id="location-id" value="${isEditing ? location.id : ''}">
                        <div><label for="location-name">Name:</label><input type="text" id="location-name" required value="${isEditing ? location.name : ''}"></div>
                        <div><label for="location-address">Address:</label><input type="text" id="location-address" required value="${isEditing ? location.address : ''}"></div>
                        <div><label for="location-hours">Hours:</label><input type="text" id="location-hours" value="${isEditing ? location.hours || '' : ''}"></div>
                        <div><label for="location-map-embed">Map Embed Code (HTML):</label><textarea id="location-map-embed">${isEditing ? location.map_embed_code || '' : ''}</textarea></div>
                        <button type="submit">${isEditing ? 'Save Changes' : 'Add Location'}</button>
                    </form>
                </div>
            </div>
        `;
        if ($('#location-form-modal')) $('#location-form-modal').remove();
        document.body.insertAdjacentHTML('beforeend', formHtml);
        $('#location-form').addEventListener('submit', handleSaveLocation);
    }

    async function handleSaveLocation(event) {
        event.preventDefault();
        const id = $('#location-id').value;
        const locationData = {
            name: $('#location-name').value,
            address: $('#location-address').value,
            hours: $('#location-hours').value,
            map_embed_code: $('#location-map-embed').value,
        };

        try {
            if (id) {
                await apiRequest('PUT', `/locations/${id}`, locationData);
                showNotification('Location updated successfully!', 'success');
            } else {
                await apiRequest('POST', '/locations', locationData);
                showNotification('Location added successfully!', 'success');
            }
            $('#location-form-modal').remove();
            loadLocationsView();
        } catch (error) {
            showNotification(`Failed to save location: ${error.message}`, 'error');
        }
    }

    async function handleDeleteLocation(locationId) {
        if (!confirm(`Are you sure you want to delete this location?`)) {
            return;
        }
        try {
            await apiRequest('DELETE', `/locations/${locationId}`);
            showNotification('Location deleted successfully.', 'success');
            loadLocationsView();
        } catch (error) {
            showNotification(`Failed to delete location: ${error.message}`, 'error');
        }
    }

    // Settings View (Header/Footer, Site Nav, etc.)
    async function loadSettingsView() {
        mainContent.innerHTML = `
            <h1>Site Settings</h1>
            <div class="settings-section">
                <h2>Navigation Menu</h2>
                <div id="nav-menu-editor">Loading navigation...</div>
                <button id="save-nav-menu">Save Navigation Menu</button>
            </div>
            <div class="settings-section">
                <h2>Global Header</h2>
                <textarea id="header-content" rows="10" style="width:100%;"></textarea>
                <button id="save-header-content">Save Header</button>
            </div>
            <div class="settings-section">
                <h2>Global Footer</h2>
                <textarea id="footer-content" rows="10" style="width:100%;"></textarea>
                <button id="save-footer-content">Save Footer</button>
            </div>
        `;

        $('#save-nav-menu').addEventListener('click', handleSaveNavigationMenu);
        $('#save-header-content').addEventListener('click', () => handleSaveGlobalContent('header'));
        $('#save-footer-content').addEventListener('click', () => handleSaveGlobalContent('footer'));

        try {
            // Load Navigation Menu (example: sortable list)
            const menuItems = await apiRequest('GET', '/settings/navigation');
            const navEditor = $('#nav-menu-editor');
            // This would be a more complex UI, e.g., using SortableJS
            navEditor.innerHTML = `<ul>${menuItems.map(item => `<li data-id="${item.id}">${item.label} (${item.url}) <button class="remove-nav-item">X</button></li>`).join('')}</ul> <input type="text" id="new-nav-label" placeholder="Label"> <input type="text" id="new-nav-url" placeholder="URL"> <button id="add-nav-item">Add Item</button>`;
            // Add event listeners for add/remove/reorder nav items

            // Load Header/Footer
            const headerContent = await apiRequest('GET', '/settings/global/header');
            $('#header-content').value = headerContent.content || '';
            const footerContent = await apiRequest('GET', '/settings/global/footer');
            $('#footer-content').value = footerContent.content || '';

        } catch (error) {
            mainContent.innerHTML += `<p class="error">Failed to load settings: ${error.message}</p>`;
        }
    }
    
    async function handleSaveNavigationMenu() {
        // Collect data from the nav-menu-editor UI
        const items = []; // Example: [{label: 'Home', url: '/index.html', order: 0}, ...]
        // ... logic to extract items and their order from the UI ...
        alert('Navigation saving is conceptual. Implement UI and data extraction.');
        // try {
        //     await apiRequest('POST', '/settings/navigation', { menuItems: items });
        //     showNotification('Navigation menu saved!', 'success');
        // } catch (error) {
        //     showNotification(`Failed to save navigation: ${error.message}`, 'error');
        // }
    }

    async function handleSaveGlobalContent(partName) { // 'header' or 'footer'
        const content = $(`#${partName}-content`).value;
        if (!confirm(`Are you sure you want to update the global ${partName}? This will affect all pages.`)) {
            return;
        }
        try {
            await apiRequest('PUT', `/settings/global/${partName}`, { content });
            showNotification(`Global ${partName} updated successfully!`, 'success');
        } catch (error) {
            showNotification(`Failed to update ${partName}: ${error.message}`, 'error');
        }
    }


    // --- Initialization ---
    // function initApp() { // This was the old initApp
    //     // Assign DOM elements
    //     loginView = $('#login-view');
    //     appView = $('#app-view'); // Assuming your main app container has id="app-view"
    //     mainContent = $('#main-content');
    //     mainNav = $('#main-nav');
    //     notificationsArea = $('#notifications');

    //     usernameInput = $('#username');
    //     passwordInput = $('#password');
    //     loginForm = $('#login-form');
    //     logoutButton = $('#logout-button');

    //     if (loginForm) loginForm.addEventListener('submit', handleLogin);
    //     if (logoutButton) logoutButton.addEventListener('click', () => handleLogout());

    //     // Attempt to retrieve token if using JWT and page was reloaded
    //     const storedToken = localStorage.getItem('authToken');
    //     if (storedToken) {
    //         authToken = storedToken;
    //     }

    //     setupNavigation();
    //     checkAuthStatus().then(isAuthenticated => {
    //         if (isAuthenticated) {
    //             handleHashChange(); // Load initial view based on hash or default
    //         }
    //     });
    // }

    // This is the main initialization function called by index.html
    function init() {
        console.log("adminApp.init() called for editor.");
        // Example: Ensure the global notification area for the editor is set up
        // notificationsAreaGlobal = document.getElementById('editorNotificationsContainer'); 
        
        // ... other initialization logic for the editor page ...
        // Example: setup event listeners for buttons like logout
        const logoutBtn = document.getElementById('logoutBtn');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', (e) => {
                e.preventDefault();
                if (typeof handleLogout === 'function') {
                    handleLogout();
                } else {
                    console.error('handleLogout function is not defined on adminApp');
                }
            });
        }
        
        // ... more init logic ...

        // Use a showNotification function if available on adminApp, or a local one
        if (typeof showNotification === 'function') {
            showNotification('Editor initialized.', 'success', 'editorNotificationsContainer', 2000);
        } else {
            console.log('Editor initialized (showNotification not available at this point in init).');
        }
    }

    // Return the public API for adminApp
    return {
        init: init,
        showNotification: showNotification,
        apiRequest: apiRequest,
        // Add other methods that need to be public:
        handleLogout: handleLogout,
        getCurrentPageFilename: getCurrentPageFilename,
        getEditor: getEditor,
        _setEditor: _setEditor 
        // Ensure all functions referenced by the returned object are defined within this IIFE
    };

})(); // Immediately invoke the function

// Remove the old DOMContentLoaded listener for initApp from bootstrap.js
// document.addEventListener('DOMContentLoaded', initApp); // REMOVE THIS LINE

// Basic CSS for modals and notifications (should be in a separate CSS file)
const adminStyles = `
  .modal { display: block; position: fixed; z-index: 1000; left: 0; top: 0; width: 100%; height: 100%; overflow: auto; background-color: rgba(0,0,0,0.4); }
  .modal-content { background-color: #fefefe; margin: 10% auto; padding: 20px; border: 1px solid #888; width: 80%; max-width: 600px; position: relative; }
  .close-button { color: #aaa; float: right; font-size: 28px; font-weight: bold; cursor: pointer; }
  .close-button:hover, .close-button:focus { color: black; text-decoration: none; }
  #notifications { position: fixed; top: 10px; right: 10px; z-index: 2000; }
  .notification { padding: 15px; margin-bottom: 10px; border-radius: 4px; color: #fff; min-width: 250px; }
  .notification-info { background-color: #2196F3; }
  .notification-success { background-color: #4CAF50; }
  .notification-warning { background-color: #ff9800; }
  .notification-error { background-color: #f44336; }
  #main-nav a.active { font-weight: bold; text-decoration: underline; }
  .media-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 10px; }
  .media-item img { max-width: 100%; height: auto; border: 1px solid #ddd; }
  .media-item .file-icon { padding: 20px; background: #eee; text-align: center; border: 1px solid #ddd;}
  .metric-card { background: #f0f0f0; padding: 15px; border-radius: 5px; text-align: center; }
  .dashboard-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; margin-bottom: 20px; }
  .charts-container { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 20px; }
  .chart-card { background: #fff; padding: 15px; border-radius: 5px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); height: 300px; }
  .publish-button { background-color: #4CAF50; color: white; padding: 10px 20px; border: none; cursor: pointer; font-size: 16px; border-radius: 4px; }
  .publish-button:hover { background-color: #45a049; }
  .settings-section { margin-bottom: 20px; padding: 15px; border: 1px solid #eee; }
`;
const styleSheet = document.createElement("style");
styleSheet.type = "text/css";
styleSheet.innerText = adminStyles;
document.head.appendChild(styleSheet);
