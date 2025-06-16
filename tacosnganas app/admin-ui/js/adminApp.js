const adminApp = (() => {
    const API_BASE_URL = '/api/admin'; // Adjust if your API is hosted elsewhere or has a different prefix

    const loadingOverlay = document.getElementById('loadingOverlay');
    const notificationsContainer = document.getElementById('editorNotifications'); // Assuming this is generic enough

    /**
     * Shows the global loading overlay.
     */
    function showLoading(message = 'Loading...') {
        if (loadingOverlay) {
            loadingOverlay.style.display = 'flex';
            document.getElementById('loadingMessage').textContent = message;
        }
    }

    /**
     * Hides the global loading overlay.
     */
    function hideLoading() {
        if (loadingOverlay) {
            loadingOverlay.style.display = 'none';
        }
    }

    /**
     * Displays a toast notification.
     * @param {string} message - The message to display.
     * @param {string} type - 'success', 'error', 'warning', 'info' (corresponds to Bootstrap alert classes).
     * @param {number} duration - How long the toast should be visible (in ms). Default 5000ms.
     */
    function showToast(message, type = 'info', duration = 5000) {
        if (!notificationsContainer) {
            console.warn('Notifications container not found. Toast not shown:', message);
            return;
        }

        const toastId = 'toast-' + Date.now();
        const toastHTML = `
            <div id="${toastId}" class="toast align-items-center text-white bg-${type} border-0 fade show" role="alert" aria-live="assertive" aria-atomic="true" data-bs-delay="${duration}">
                <div class="d-flex">
                    <div class="toast-body">
                        ${message}
                    </div>
                    <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast" aria-label="Close"></button>
                </div>
            </div>
        `;
        
        notificationsContainer.insertAdjacentHTML('beforeend', toastHTML);
        
        const toastElement = document.getElementById(toastId);
        const toastInstance = new bootstrap.Toast(toastElement, { delay: duration });
        toastInstance.show();

        toastElement.addEventListener('hidden.bs.toast', () => {
            toastElement.remove();
        });
    }

    /**
     * Makes an API request.
     * @param {string} endpoint - The API endpoint (e.g., '/pages', '/media/upload').
     * @param {string} method - HTTP method (GET, POST, PUT, DELETE).
     * @param {object} [body] - Request body for POST/PUT.
     * @param {boolean} [isFormData=false] - Set to true if body is FormData.
     * @returns {Promise<object>} - The JSON response from the API.
     */
    async function apiRequest(endpoint, method = 'GET', body = null, isFormData = false) {
        showLoading();
        const url = `${API_BASE_URL}${endpoint}`;
        const options = {
            method: method,
            headers: {},
        };

        // Add Authorization header if a token exists (e.g., stored in localStorage)
        const authToken = localStorage.getItem('adminAuthToken');
        if (authToken) {
            options.headers['Authorization'] = `Bearer ${authToken}`;
        }

        if (body) {
            if (isFormData) {
                // FormData sets its own Content-Type with boundary
                options.body = body;
            } else {
                options.headers['Content-Type'] = 'application/json';
                options.body = JSON.stringify(body);
            }
        }

        try {
            const response = await fetch(url, options);

            if (!response.ok) {
                let errorData;
                try {
                    errorData = await response.json();
                } catch (e) {
                    errorData = { message: response.statusText };
                }
                const errorMessage = errorData.message || `Error ${response.status}: ${response.statusText}`;
                showToast(errorMessage, 'error');
                hideLoading();
                throw new Error(errorMessage);
            }

            // If response is not JSON, or empty, handle gracefully
            const contentType = response.headers.get('content-type');
            if (contentType && contentType.includes('application/json')) {
                const jsonData = await response.json();
                hideLoading();
                return jsonData;
            } else {
                hideLoading();
                return await response.text(); // Or handle as needed, e.g., for HTML content
            }

        } catch (error) {
            console.error('API Request Failed:', error);
            showToast(error.message || 'Network error or server unavailable.', 'error');
            hideLoading();
            throw error;
        }
    }

    // --- GrapesJS Editor Instance ---
    let editor = null; // Stores the GrapesJS editor instance

    // Analytics Chart Instances
    let analyticsChartInstances = {
        trafficOverviewChart: null,
        trafficSourcesChart: null,
        engagementRateChart: null,
        popularPagesChart: null,
        seoKeywordsChart: null,
        technicalPerformanceChart: null,
        errorRateChart: null,
        // Add more as needed
    };

    /**
     * Initializes the GrapesJS editor.
     * Placeholder for full GrapesJS configuration.
     */
    function initGrapesJSEditor(pageHtmlContent = '') {
        showLoading();
        if (editor) {
            editor.destroy();
        }

        // Hide initial placeholder, show loading spinner
        const initialPlaceholder = document.getElementById('gjsInitialPlaceholder');
        const initialLoadingSpinner = document.getElementById('initialLoadingSpinner');
        if(initialPlaceholder) initialPlaceholder.style.display = 'none';
        if(initialLoadingSpinner) initialLoadingSpinner.style.display = 'block';

        // Basic GrapesJS initialization
        editor = grapesjs.init({
            container: '#gjs',
            fromElement: true, // If you want to load the editor with the content of the container
            height: '100%',
            width: 'auto',
            storageManager: false, // Disable built-in storage manager, we'll handle saving
            assetManager: {
                // Configuration for the Asset Manager
                // We will trigger our custom modal
                openAssetsOnDrop: true,
                assets: [], // Initial assets, can be loaded dynamically
                // upload: 'YOUR_UPLOAD_ENDPOINT', // For direct uploads if not using custom manager
                // uploadName: 'files',
                custom: {
                    open(props) {
                        // Trigger your custom Asset Manager modal
                        const assetManagerModal = new bootstrap.Modal(document.getElementById('assetManagerModal'));
                        assetManagerModal.show();
                        // `props.select` is the function to call when an asset is selected
                        // `props.options` contains GrapesJS asset manager options
                        // `props.types` indicates the types of assets to show (e.g., ['image'])
                        // You'll need to wire your modal to call props.select(assetUrl, { type: 'image' })
                    },
                    close(props) {
                        // Logic to close your custom Asset Manager modal if needed
                    }
                }
            },
            blockManager: {
                appendTo: '#gjs-blocks-container',
            },
            layerManager: {
                appendTo: '#gjs-layers-container',
            },
            styleManager: {
                appendTo: '#gjs-styles-container',
            },
            traitManager: {
                appendTo: '#gjs-traits-container',
            },
            panels: {
                defaults: [
                    // Basic panels, customize as needed
                    {
                        id: 'panel-top',
                        el: '.editor-toolbar', // Attach to our existing toolbar
                    },
                    {
                        id: 'basic-actions',
                        el: '#gjs-panel-commands-buttons',
                        buttons: [
                            { id: 'visibility', command: 'core:component-outline', className: 'fa fa-clone', active: true, label: 'Components Outline' },
                            { id: 'preview', command: 'core:preview', className: 'fa fa-eye', label: 'Preview' },
                            { id: 'fullscreen', command: 'core:fullscreen', className: 'fa fa-arrows-alt', label: 'Fullscreen' },
                            { id: 'export-template', command: 'core:export-template', className: 'fa fa-code', label: 'View Code' },
                            { id: 'undo', command: 'core:undo', className: 'fa fa-undo', label: 'Undo' },
                            { id: 'redo', command: 'core:redo', className: 'fa fa-repeat', label: 'Redo' },
                            { id: 'core:canvas-clear', command: 'core:canvas-clear', className: 'fa fa-trash', label: 'Clear Canvas' },
                        ],
                    },
                    {
                        id: 'devices-actions',
                        el: '#gjs-devices-buttons',
                        buttons: [
                            { id: 'device-desktop', command: 'set-device-desktop', className: 'fa fa-desktop', active: true, label: 'Desktop' },
                            { id: 'device-tablet', command: 'set-device-tablet', className: 'fa fa-tablet', label: 'Tablet' },
                            { id: 'device-mobile', command: 'set-device-mobile', className: 'fa fa-mobile', label: 'Mobile' },
                        ],
                    }
                ]
            },
            // Define device commands
            commands: {
                add: (editor) => {
                    editor.Commands.add('set-device-desktop', {
                        run: (editor) => editor.setDevice('Desktop'),
                        stop: () => {},
                    });
                    editor.Commands.add('set-device-tablet', {
                        run: (editor) => editor.setDevice('Tablet'),
                        stop: () => {},
                    });
                    editor.Commands.add('set-device-mobile', {
                        run: (editor) => editor.setDevice('Mobile'),
                        stop: () => {},
                    });
                }
            },
            // Add TACOnganas specific blocks (placeholder)
            // blockManager: { ... custom blocks ... }
        });

        if (pageHtmlContent) {
            editor.setComponents(pageHtmlContent);
        }

        // Event listener for changes to update UI
        editor.on('change:changesCount', (model, count) => {
            const unsavedIndicator = document.getElementById('unsavedChangesIndicator');
            if (unsavedIndicator) {
                unsavedIndicator.style.display = count > 0 ? 'inline-block' : 'none';
            }
        });

        // Hide loading spinner, show placeholder if no content
        if(initialLoadingSpinner) initialLoadingSpinner.style.display = 'none';
        if(!pageHtmlContent && initialPlaceholder) initialPlaceholder.style.display = 'flex';

        hideLoading();
        showToast('Editor initialized.', 'success', 2000);
        enableEditorControls();
    }

    function enableEditorControls(enable = true) {
        const controls = [
            'pageSelectorDropdown', 'pageSettingsBtn', 'savePageBtn', 'saveOptionsDropdown',
            'previewPageBtn', 'openRevisionsToolbarBtn', 'openSeoToolbarBtn', 'publishPageBtn'
        ];
        controls.forEach(id => {
            const el = document.getElementById(id);
            if (el) el.disabled = !enable;
        });
    }

    /**
     * Loads the list of pages into the page selector dropdown.
     */
    async function loadPages() {
        const pageSelectorList = document.getElementById('pageSelectorList');
        const selectedPageName = document.getElementById('selectedPageName');
        if (!pageSelectorList || !selectedPageName) return;

        selectedPageName.textContent = 'Loading Pages...';
        pageSelectorList.innerHTML = '<li><input type="search" class="form-control form-control-sm m-2 w-auto" placeholder="Search pages..." id="pageSearchInputInDropdown"></li><li><h6 class="dropdown-header">Site Pages</h6></li>'; // Reset with search and header

        try {
            const pages = await apiRequest('/pages', 'GET'); // Assuming API endpoint /api/admin/pages
            if (pages && pages.length > 0) {
                pages.forEach(page => {
                    const listItem = document.createElement('li');
                    const link = document.createElement('a');
                    link.className = 'dropdown-item';
                    link.href = '#';
                    link.textContent = page.title || page.name; // Use page.title if available, else page.name
                    link.dataset.pageFile = page.name; // Assuming page.name is the filename like 'index.html'
                    link.dataset.pageId = page.id; // Assuming page has an ID
                    link.addEventListener('click', (e) => {
                        e.preventDefault();
                        loadPageContent(page.name);
                        if (selectedPageName) selectedPageName.textContent = page.title || page.name;
                        document.getElementById('pageSelectorDropdown').dispatchEvent(new Event('hide.bs.dropdown')); // Close dropdown
                    });
                    listItem.appendChild(link);
                    pageSelectorList.appendChild(listItem);
                });
                // Load the first page by default or a specific one (e.g., index.html)
                const defaultPage = pages.find(p => p.name === 'index.html') || pages[0];
                if (defaultPage) {
                    loadPageContent(defaultPage.name);
                    if (selectedPageName) selectedPageName.textContent = defaultPage.title || defaultPage.name;
                }
            } else {
                if (selectedPageName) selectedPageName.textContent = 'No Pages Found';
                pageSelectorList.innerHTML += '<li><span class="dropdown-item-text">No pages available.</span></li>';
            }
        } catch (error) {
            if (selectedPageName) selectedPageName.textContent = 'Error Loading Pages';
            showToast('Failed to load pages: ' + error.message, 'error');
        }
        pageSelectorList.innerHTML += '<li><hr class="dropdown-divider"></li><li><a class="dropdown-item" href="#" id="createNewPageFromDropdown"><i class="fas fa-plus me-2"></i>Create New Page...</a></li>';
        // Re-attach event listener for create new page if it was part of innerHTML reset
        const createNewPageBtnDropdown = document.getElementById('createNewPageFromDropdown');
        if (createNewPageBtnDropdown) {
            createNewPageBtnDropdown.addEventListener('click', handleCreateNewPage);
        }
        // Add search functionality to dropdown
        const pageSearchInput = document.getElementById('pageSearchInputInDropdown');
        if(pageSearchInput) {
            pageSearchInput.addEventListener('keyup', () => {
                const filter = pageSearchInput.value.toLowerCase();
                const items = pageSelectorList.querySelectorAll('li > a.dropdown-item[data-page-file]');
                items.forEach(item => {
                    const text = item.textContent.toLowerCase();
                    item.parentElement.style.display = text.includes(filter) ? '' : 'none';
                });
            });
        }
    }

    /**
     * Loads the content of a specific page into GrapesJS.
     * @param {string} pageFilename - The filename of the page to load.
     */
    async function loadPageContent(pageFilename) {
        if (!pageFilename) {
            showToast('No page filename provided.', 'warning');
            initGrapesJSEditor(); // Initialize with empty editor
            return;
        }
        showLoading();
        try {
            // This API endpoint should return the HTML content of the page
            // And potentially its metadata (title, SEO settings etc)
            const pageData = await apiRequest(`/pages/${pageFilename}`, 'GET'); 
            
            let htmlContent = '';
            let pageMeta = {};

            if (typeof pageData === 'string') {
                htmlContent = pageData; // API returns raw HTML
            } else if (typeof pageData === 'object' && pageData.html) {
                htmlContent = pageData.html;
                pageMeta = pageData.meta || {}; // Store metadata
            }

            if (!editor) {
                initGrapesJSEditor(htmlContent);
            } else {
                editor.setComponents(htmlContent);
                editor.store(); // Clear undo history for new page
            }
            document.getElementById('selectedPageName').textContent = pageMeta.title || pageFilename;
            document.getElementById('settingsModalPageName').textContent = pageMeta.title || pageFilename;
            document.getElementById('seoModalPageName').textContent = pageMeta.title || pageFilename;
            document.getElementById('pageSettingsFilename').value = pageFilename;

            // Populate page settings modal (basic example)
            document.getElementById('pageTitleInput').value = pageMeta.title || '';
            document.getElementById('pageFilenameInput').value = pageFilename;
            // TODO: Populate other fields in Page Settings & SEO modals from pageMeta

            showToast(`Page "${pageFilename}" loaded.`, 'success');
            enableEditorControls(true);
            document.getElementById('currentPageStatus').textContent = `Status: ${pageMeta.status || 'Draft'}`;
            document.getElementById('currentPageStatus').style.display = 'inline-block';
            document.getElementById('lastSavedTimestamp').textContent = pageMeta.lastSaved ? `Last saved: ${new Date(pageMeta.lastSaved).toLocaleString()}` : '';

        } catch (error) {
            showToast(`Error loading page "${pageFilename}": ${error.message}`, 'error');
            initGrapesJSEditor(); // Initialize with empty editor on error
            enableEditorControls(false); // Disable controls if page load fails
            document.getElementById('selectedPageName').textContent = 'Error!';
        }
        hideLoading();
    }

    /**
     * Saves the current page content.
     */
    async function savePage() {
        if (!editor) {
            showToast('Editor not initialized.', 'error');
            return;
        }
        const pageFilename = document.getElementById('pageSettingsFilename').value;
        if (!pageFilename) {
            showToast('No page selected to save.', 'warning');
            return;
        }

        showLoading();
        const htmlContent = editor.getHtml();
        const cssContent = editor.getCss();
        // Combine HTML and CSS (GrapesJS can export them separately or together)
        // For simplicity, we might save them as a single HTML file with embedded styles, or handle separately on backend
        const fullHtml = `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><title>${document.getElementById('pageTitleInput').value || pageFilename}</title><style>${cssContent}</style></head><body>${htmlContent}</body></html>`;

        try {
            // API endpoint to save page content
            await apiRequest(`/pages/${pageFilename}`, 'PUT', { html: fullHtml, title: document.getElementById('pageTitleInput').value });
            showToast(`Page "${pageFilename}" saved successfully.`, 'success');
            editor.store(); // Resets changes count
            document.getElementById('lastSavedTimestamp').textContent = `Last saved: ${new Date().toLocaleString()}`;
        } catch (error) {
            showToast(`Error saving page "${pageFilename}": ${error.message}`, 'error');
        }
        hideLoading();
    }

    function handleCreateNewPage(event) {
        if(event) event.preventDefault();
        // For now, prompt for a filename. Later, use a modal for more options.
        const newPageFilename = prompt("Enter filename for the new page (e.g., new-page.html):");
        if (newPageFilename && newPageFilename.endsWith('.html')) {
            // Optimistically add to dropdown and load
            const pageSelectorList = document.getElementById('pageSelectorList');
            const selectedPageName = document.getElementById('selectedPageName');
            
            // Create a placeholder page object for the new page
            const newPage = {
                name: newPageFilename,
                title: newPageFilename.replace('.html', '').replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase()), // Basic title generation
                id: 'temp-' + Date.now() // Temporary ID
            };

            // Add to dropdown (simplified, ideally API call first then update UI)
            const listItem = document.createElement('li');
            const link = document.createElement('a');
            link.className = 'dropdown-item';
            link.href = '#';
            link.textContent = newPage.title;
            link.dataset.pageFile = newPage.name;
            link.dataset.pageId = newPage.id;
            link.addEventListener('click', (e) => {
                e.preventDefault();
                loadPageContent(newPage.name); // This will try to load, might fail if not yet on server
                if (selectedPageName) selectedPageName.textContent = newPage.title;
            });
            listItem.appendChild(link);
            // Insert before the "Create New Page" item or its divider
            const createNewPageItem = document.getElementById('createNewPageFromDropdown');
            if (createNewPageItem && createNewPageItem.parentElement.previousElementSibling) { // insert before divider
                pageSelectorList.insertBefore(listItem, createNewPageItem.parentElement.previousElementSibling);
            } else if (createNewPageItem) { // insert before create new itself
                 pageSelectorList.insertBefore(listItem, createNewPageItem.parentElement);
            } else {
                pageSelectorList.appendChild(listItem); // fallback
            }

            // "Load" this new, empty page into the editor
            if (selectedPageName) selectedPageName.textContent = newPage.title;
            document.getElementById('settingsModalPageName').textContent = newPage.title;
            document.getElementById('seoModalPageName').textContent = newPage.title;
            document.getElementById('pageSettingsFilename').value = newPage.name;
            document.getElementById('pageTitleInput').value = newPage.title;
            document.getElementById('pageFilenameInput').value = newPage.name;
            initGrapesJSEditor('<h1>Welcome to your new page!</h1><p>Start building here.</p>'); // Initialize with placeholder content
            showToast(`New page "${newPage.name}" created locally. Save to persist.`, 'info');
            enableEditorControls(true);
        } else if (newPageFilename) {
            showToast('Invalid filename. Must end with .html', 'warning');
        }
    }

    /**
     * Handles sidebar toggle functionality.
     */
    function toggleSidebar() {
        const sidebar = document.getElementById('editorSidebar');
        const toggleBtn = document.getElementById('sidebarToggleBtn');
        sidebar.classList.toggle('collapsed');
        const isCollapsed = sidebar.classList.contains('collapsed');
        toggleBtn.title = isCollapsed ? 'Show Sidebar' : 'Hide Sidebar';
        toggleBtn.innerHTML = isCollapsed ? '<i class="fas fa-chevron-right"></i>' : '<i class="fas fa-chevron-left"></i>';
        // Optional: Trigger GrapesJS resize if necessary
        if (editor) {
            // editor.trigger('resize'); // May not be needed depending on GrapesJS setup
        }
    }

    function destroyAllAnalyticsCharts() {
        for (const chartKey in analyticsChartInstances) {
            if (analyticsChartInstances[chartKey] instanceof Chart) {
                analyticsChartInstances[chartKey].destroy();
                analyticsChartInstances[chartKey] = null;
            }
        }
    }

    function initAnalyticsDashboard() {
        console.log("Initializing Analytics Dashboard...");
        destroyAllAnalyticsCharts(); // Clear previous instances

        // Mock Data (significantly enhanced)
        const mockAnalyticsData = {
            siteOverview: {
                totalVisits: 12580,
                uniqueVisitors: 9870,
                avgSessionDuration: "3m 45s",
                bounceRate: "45.2%",
                pagesPerVisit: 2.8,
                newVisitorsPercent: "60%",
                trafficTrend: [120, 150, 130, 180, 200, 170, 210, 230, 220, 250, 240, 280], // Last 12 days/weeks
                trafficLabels: ['Day 1', 'Day 2', 'Day 3', 'Day 4', 'Day 5', 'Day 6', 'Day 7', 'Day 8', 'Day 9', 'Day 10', 'Day 11', 'Day 12'],
                trafficSources: { organic: 45, direct: 25, referral: 15, social: 10, other: 5 },
            },
            contentEngagement: {
                mostPopularPages: [
                    { name: 'Homepage', views: 3500, avgTime: '4m 10s', bounce: '30%' },
                    { name: 'Our Menu', views: 2800, avgTime: '3m 20s', bounce: '40%' },
                    { name: 'Locations', views: 1500, avgTime: '2m 50s', bounce: '55%' },
                    { name: 'About Us', views: 1200, avgTime: '2m 15s', bounce: '60%' },
                    { name: 'Contact', views: 900, avgTime: '1m 30s', bounce: '70%' },
                ],
                engagementRate: [60, 65, 58, 70, 68, 72, 67], // Last 7 days
                engagementLabels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
                averagePageLoadTime: "2.1s",
                exitPages: [
                    { name: 'Checkout Step 1', exits: 120 },
                    { name: 'Product Page X', exits: 90 },
                ]
            },
            seoPerformance: {
                topKeywords: [
                    { keyword: 'best tacos near me', rank: 3, volume: 1200, clicks: 150 },
                    { keyword: 'tacosnganas menu', rank: 1, volume: 800, clicks: 200 },
                    { keyword: 'mexican food downtown', rank: 7, volume: 950, clicks: 80 },
                    { keyword: 'authentic tacos', rank: 5, volume: 700, clicks: 90 },
                ],
                organicTraffic: [300, 320, 310, 350, 370, 360, 400], // Last 7 days
                organicTrafficLabels: ['Day 1', 'Day 2', 'Day 3', 'Day 4', 'Day 5', 'Day 6', 'Day 7'],
                indexedPages: 25,
                crawlErrors: 3,
                backlinksCount: 157,
            },
            technical: {
                siteSpeedScore: 85, // e.g., Lighthouse score
                uptimePercentage: 99.98,
                errorRateData: [0.1, 0.05, 0.2, 0.1, 0.15, 0.08, 0.12], // Last 7 days
                errorRateLabels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
                averageServerResponseTime: "150ms",
                brokenLinksCount: 2,
            }
        };

        // --- Populate Scorecards ---
        // Traffic Insights
        document.getElementById('metricTotalVisits').textContent = mockAnalyticsData.siteOverview.totalVisits.toLocaleString();
        document.getElementById('metricUniqueVisitors').textContent = mockAnalyticsData.siteOverview.uniqueVisitors.toLocaleString();
        document.getElementById('metricAvgSessionDuration').textContent = mockAnalyticsData.siteOverview.avgSessionDuration;
        document.getElementById('metricBounceRate').textContent = mockAnalyticsData.siteOverview.bounceRate;

        // Content & Engagement
        document.getElementById('metricAvgPageLoadTime').textContent = mockAnalyticsData.contentEngagement.averagePageLoadTime;
        document.getElementById('metricPagesPerVisit').textContent = mockAnalyticsData.siteOverview.pagesPerVisit;
        // Add more scorecards if defined in HTML

        // SEO Performance
        document.getElementById('metricOrganicTraffic').textContent = mockAnalyticsData.seoPerformance.organicTraffic.reduce((a, b) => a + b, 0).toLocaleString() + " (last 7d)";
        document.getElementById('metricIndexedPages').textContent = mockAnalyticsData.seoPerformance.indexedPages;
        document.getElementById('metricBacklinks').textContent = mockAnalyticsData.seoPerformance.backlinksCount;

        // Technical
        document.getElementById('metricSiteSpeedScore').textContent = mockAnalyticsData.technical.siteSpeedScore + "/100";
        document.getElementById('metricUptime').textContent = mockAnalyticsData.technical.uptimePercentage + "%";
        document.getElementById('metricCrawlErrors').textContent = mockAnalyticsData.seoPerformance.crawlErrors;


        // --- Initialize Charts ---

        // Traffic Overview Chart (Line)
        const trafficCtx = document.getElementById('trafficOverviewChart');
        if (trafficCtx) {
            analyticsChartInstances.trafficOverviewChart = new Chart(trafficCtx, {
                type: 'line',
                data: {
                    labels: mockAnalyticsData.siteOverview.trafficLabels,
                    datasets: [{
                        label: 'Total Visits',
                        data: mockAnalyticsData.siteOverview.trafficTrend,
                        borderColor: 'rgba(236, 0, 140, 1)', // TACOnganas Pink
                        backgroundColor: 'rgba(236, 0, 140, 0.1)',
                        tension: 0.3,
                        fill: true,
                    }]
                },
                options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } }
            });
        }

        // Traffic Sources Chart (Doughnut)
        const sourcesCtx = document.getElementById('trafficSourcesChart');
        if (sourcesCtx) {
            analyticsChartInstances.trafficSourcesChart = new Chart(sourcesCtx, {
                type: 'doughnut',
                data: {
                    labels: Object.keys(mockAnalyticsData.siteOverview.trafficSources),
                    datasets: [{
                        label: 'Traffic Sources',
                        data: Object.values(mockAnalyticsData.siteOverview.trafficSources),
                        backgroundColor: [
                            'rgba(247, 148, 29, 0.8)', // TACOnganas Orange
                            'rgba(0, 174, 239, 0.8)',  // TACOnganas Blue
                            'rgba(140, 198, 63, 0.8)', // Green
                            'rgba(255, 205, 86, 0.8)', // Yellow
                            'rgba(153, 102, 255, 0.8)' // Purple
                        ],
                    }]
                },
                options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom' } } }
            });
        }

        // Engagement Rate Chart (Bar)
        const engagementCtx = document.getElementById('engagementRateChart');
        if (engagementCtx) {
            analyticsChartInstances.engagementRateChart = new Chart(engagementCtx, {
                type: 'bar',
                data: {
                    labels: mockAnalyticsData.contentEngagement.engagementLabels,
                    datasets: [{
                        label: 'Engagement Rate (%)',
                        data: mockAnalyticsData.contentEngagement.engagementRate,
                        backgroundColor: 'rgba(0, 174, 239, 0.7)', // TACOnganas Blue
                        borderColor: 'rgba(0, 174, 239, 1)',
                        borderWidth: 1
                    }]
                },
                options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, max: 100 } } }
            });
        }
        
        // Popular Pages Table
        const popularPagesTableBody = document.getElementById('popularPagesTableBody');
        if (popularPagesTableBody) {
            popularPagesTableBody.innerHTML = ''; // Clear existing
            mockAnalyticsData.contentEngagement.mostPopularPages.forEach(page => {
                const row = `<tr>
                    <td>${page.name}</td>
                    <td>${page.views.toLocaleString()}</td>
                    <td>${page.avgTime}</td>
                    <td>${page.bounce}</td>
                </tr>`;
                popularPagesTableBody.innerHTML += row;
            });
        }

        // SEO Keywords Table
        const seoKeywordsTableBody = document.getElementById('seoKeywordsTableBody');
        if (seoKeywordsTableBody) {
            seoKeywordsTableBody.innerHTML = ''; // Clear existing
            mockAnalyticsData.seoPerformance.topKeywords.forEach(kw => {
                const row = `<tr>
                    <td>${kw.keyword}</td>
                    <td>${kw.rank}</td>
                    <td>${kw.volume.toLocaleString()}</td>
                    <td>${kw.clicks.toLocaleString()}</td>
                </tr>`;
                seoKeywordsTableBody.innerHTML += row;
            });
        }
        
        // Technical Performance Chart (Could be a gauge or radar - using bar for simplicity now)
        const techPerfCtx = document.getElementById('technicalPerformanceChart');
        if (techPerfCtx) {
             analyticsChartInstances.technicalPerformanceChart = new Chart(techPerfCtx, {
                type: 'bar',
                data: {
                    labels: ['Site Speed', 'Mobile Friendliness', 'Accessibility'], // Example metrics
                    datasets: [{
                        label: 'Performance Score (out of 100)',
                        data: [
                            mockAnalyticsData.technical.siteSpeedScore, 
                            92, // Mocked mobile friendliness
                            88  // Mocked accessibility
                        ],
                        backgroundColor: [
                            'rgba(236, 0, 140, 0.7)',
                            'rgba(247, 148, 29, 0.7)',
                            'rgba(0, 174, 239, 0.7)',
                        ],
                        borderWidth: 1
                    }]
                },
                options: { responsive: true, maintainAspectRatio: false, indexAxis: 'y', plugins: { legend: { display: false } }, scales: { x: { beginAtZero: true, max: 100 } } }
            });
        }

        // Error Rate Chart (Line)
        const errorRateCtx = document.getElementById('errorRateChart');
        if (errorRateCtx) {
            analyticsChartInstances.errorRateChart = new Chart(errorRateCtx, {
                type: 'line',
                data: {
                    labels: mockAnalyticsData.technical.errorRateLabels,
                    datasets: [{
                        label: 'Error Rate (%)',
                        data: mockAnalyticsData.technical.errorRateData,
                        borderColor: 'rgba(255, 99, 132, 1)',
                        backgroundColor: 'rgba(255, 99, 132, 0.1)',
                        tension: 0.3,
                        fill: true,
                    }]
                },
                options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true } } }
            });
        }
        
        // Add event listeners for date pickers (mock functionality)
        const dateRangePicker = document.getElementById('analyticsDateRange');
        if (dateRangePicker) {
            dateRangePicker.addEventListener('change', (event) => {
                showToast(`Analytics date range changed to: ${event.target.value}. (Data refresh not implemented yet)`, 'info', 2000);
                // In a real app, you'd call a function here to fetch and update data for the new range.
                // For now, we could re-initialize with the same mock data or slightly alter it.
            });
        }
        console.log("Analytics Dashboard Initialized with mock data.");
    }


    function initEventListeners() {
        const sidebarToggleBtn = document.getElementById('sidebarToggleBtn');
        if (sidebarToggleBtn) sidebarToggleBtn.addEventListener('click', toggleSidebar);

        const savePageBtn = document.getElementById('savePageBtn');
        if (savePageBtn) savePageBtn.addEventListener('click', savePage);

        // Hotkey for saving (Ctrl+S or Cmd+S)
        document.addEventListener('keydown', function(event) {
            if ((event.ctrlKey || event.metaKey) && event.key === 's') {
                event.preventDefault();
                if(!savePageBtn.disabled) savePage();
            }
        });

        const createNewPageInitialLink = document.getElementById('initialCreatePageLink');
        if (createNewPageInitialLink) createNewPageInitialLink.addEventListener('click', handleCreateNewPage);
        
        // Page Settings Modal Save Button
        const savePageSettingsBtn = document.getElementById('savePageSettingsBtn');
        if (savePageSettingsBtn) {
            savePageSettingsBtn.addEventListener('click', async () => {
                const pageFilename = document.getElementById('pageSettingsFilename').value;
                const pageTitle = document.getElementById('pageTitleInput').value;
                const newFilename = document.getElementById('pageFilenameInput').value;
                // TODO: Get other settings (SEO, advanced)
                if (!pageFilename) {
                    showToast('No page context for saving settings.', 'error');
                    return;
                }
                if (newFilename !== pageFilename) {
                    showToast('Filename changes require a "Save As" or rename operation, not yet implemented here.', 'warning');
                    // For now, just update title and other non-filename properties
                }
                try {
                    // Example: Update page metadata (title, status, etc.)
                    // This assumes an API endpoint for updating page metadata separate from content
                    // Or, it could be part of the main page save operation
                    await apiRequest(`/pages/${pageFilename}/meta`, 'PUT', {
                        title: pageTitle,
                        status: document.getElementById('pageStatusSelect').value,
                        // seo: { title: document.getElementById('quickSeoTitle').value, ... }
                    });
                    showToast('Page settings saved.', 'success');
                    document.getElementById('selectedPageName').textContent = pageTitle;
                    document.getElementById('settingsModalPageName').textContent = pageTitle;
                    document.getElementById('seoModalPageName').textContent = pageTitle;
                    bootstrap.Modal.getInstance(document.getElementById('pageSettingsModal')).hide();
                } catch (error) {
                    showToast('Error saving page settings: ' + error.message, 'error');
                }
            });
        }

        // Basic setup for other modals to ensure they can be opened
        // Full functionality for these modals will be in their respective modules (e.g., mediaManager.js)
        ['assetManagerModal', 'seoSettingsModal', 'revisionsModal', 'templatesModal', 'globalSectionsModal', 'helpModal'].forEach(modalId => {
            const modalElement = document.getElementById(modalId);
            if (modalElement) {
                // If there are buttons in the toolbar that directly target these modals, they are handled by Bootstrap data attributes.
                // Custom logic for when modals are shown/hidden can be added here if needed.
                // modalElement.addEventListener('shown.bs.modal', () => { console.log(`${modalId} shown`); });
            }
        });

        // Back to Dashboard Link
        const backToDashboardLink = document.getElementById('backToDashboardLink');
        if(backToDashboardLink) {
            backToDashboardLink.addEventListener('click', (e) => {
                e.preventDefault();
                // This should ideally navigate to the main admin dashboard, not the editor itself.
                // For now, it might just reload or go to a known admin root.
                // window.location.href = '/admin/'; // Or whatever the dashboard URL is
                showToast('Navigating to dashboard (not implemented yet).', 'info');
            });
        }

        // Logout Button
        const logoutBtn = document.getElementById('logoutBtn');
        if(logoutBtn) {
            logoutBtn.addEventListener('click', (e) => {
                e.preventDefault();
                // Clear auth token, redirect to login
                localStorage.removeItem('adminAuthToken');
                // window.location.href = '/admin/login.html'; // Or your login page
                showToast('Logged out successfully (redirect pending).', 'success');
            });
        }

        // Initial loading overlay logic
        const loadingOverlayElement = document.getElementById('loadingOverlay');
        if (loadingOverlayElement) {
            // Ensure it's hidden by default via JS if CSS fails or is slow
            // loadingOverlayElement.style.display = 'none'; 
            // The showLoading/hideLoading functions will manage this, but good to ensure initial state.
            // Transition for opacity
            loadingOverlayElement.style.transition = 'opacity 0.3s ease-in-out';
            // Call showLoading at the very start of an operation and hideLoading at the end.
        }

        const openAnalyticsBtn = document.getElementById('openAnalyticsToolbarBtn');
        const analyticsModalElement = document.getElementById('analyticsDashboardModal');

        if (openAnalyticsBtn && analyticsModalElement) {
            // Initialize charts when the modal is about to be shown
            analyticsModalElement.addEventListener('show.bs.modal', () => {
                console.log("Analytics modal show event triggered.");
                initAnalyticsDashboard();
            });
            // Optional: Destroy charts when modal is hidden to free resources
            // analyticsModalElement.addEventListener('hidden.bs.modal', destroyAllAnalyticsCharts);
        } else {
            if (!openAnalyticsBtn) console.warn("Analytics toolbar button not found.");
            if (!analyticsModalElement) console.warn("Analytics modal element not found.");
        }
    }

    /**
     * Initializes the admin application.
     */
    async function init() {
        showLoading(); // Show loading overlay at the very beginning
        document.getElementById('loadingMessage').textContent = 'Initializing Admin Panel...';
        
        initEventListeners();
        // Initialize GrapesJS with a delay to ensure DOM is fully ready and other scripts might load
        // And to allow the loading screen to be visible.
        setTimeout(async () => {
            document.getElementById('loadingMessage').textContent = 'Loading Editor Core...';
            try {
                await loadPages(); // This will also attempt to load the first page and init GrapesJS
                // If loadPages doesn't find any page, init GrapesJS with empty content
                if (!editor && !document.getElementById('pageSettingsFilename').value) {
                     initGrapesJSEditor(); // Initialize empty if no page was loaded by loadPages
                }
            } catch (error) {
                showToast('Fatal error during initialization: ' + error.message, 'error');
                console.error("Initialization failed:", error);
                initGrapesJSEditor(); // Attempt to load editor even on page load failure
            }
            // Final hide loading, even if parts failed, editor should be somewhat usable or show error state.
            hideLoading(); 
        }, 250); // Small delay for UX
    }

    // Public API
    return {
        init: init,
        showToast: showToast, // Expose for other modules if needed
        apiRequest: apiRequest, // Expose for other modules
        getEditor: () => editor, // Allow access to editor instance
        loadPageContent: loadPageContent, // Expose for external triggers if any
        saveCurrentPage: savePage, // Expose for external triggers
        getCurrentPageFilename: () => {
            const pageFilename = document.getElementById('pageSettingsFilename').value;
            return pageFilename || null;
        },
        openMediaManagerForGrapesJS: (callback, types) => { 
            // Custom logic to open media manager from GrapesJS
            // `callback` is the function to call with the selected media URL
            // `types` can be used to filter media types (e.g., images, videos)
            const mediaManagerModal = new bootstrap.Modal(document.getElementById('mediaManagerModal'));
            mediaManagerModal.show();

            // Example: On media select, set the image in GrapesJS
            document.getElementById('mediaSelectButton').onclick = () => {
                const selectedMediaUrl = '/path/to/selected/image.jpg'; // Get this from your media manager logic
                callback(selectedMediaUrl, { type: 'image' });
                mediaManagerModal.hide();
            };
        },
        updateUnsavedChangesIndicator: (count) => {
            const unsavedIndicator = document.getElementById('unsavedChangesIndicator');
            if (unsavedIndicator) {
                unsavedIndicator.style.display = count > 0 ? 'inline-block' : 'none';
            }
        },
        handleCreateNewPage: handleCreateNewPage, // Expose if called from index.html
        // ... other public methods
    };
})();

// Make GrapesJS available globally if it's not already (e.g. via CDN)
// if (typeof grapesjs === 'undefined' && typeof require !== 'undefined') {
//    window.grapesjs = require('grapesjs');
// }


// Placeholder for grapesjs-preset-webpage if you use it
// const grapesjsPresetWebpage = require('grapesjs-preset-webpage');

// Placeholder for custom GrapesJS plugins
// const customPlugin = (editor) => {
//    editor.BlockManager.add('my-first-block', {
//      label: 'Simple block',
//      content: '<div class="my-block">This is a simple block</div>',
//    });
// };

// Example of using a preset and a custom plugin:
// const editor = grapesjs.init({
//    container: '#gjs',
//    plugins: [grapesjsPresetWebpage, customPlugin],
//    pluginsOpts: {
//      [grapesjsPresetWebpage]: { /* options */ }
//    }
//    // ... other configurations
// });


/* 
Potential further enhancements:
- Full GrapesJS configuration (custom blocks for TACOnganas, plugins for forms, navbars, etc.)
- Integration with Media Manager (selecting images in GrapesJS should open the modal and return selected image URL)
- Page Templates: Saving and loading page structures as templates.
- Reusable Blocks/Sections: Saving parts of a page to be reused.
- SEO Modal: Full functionality for updating SEO metadata.
- Revisions Modal: Loading and restoring page revisions.
- Publish Workflow: More complex publishing (e.g., staging, live, scheduled).
- User Roles & Permissions (if multiple admin users).
- Robust error handling and user feedback for all operations.
- Backend API integrations for all features (pages, media, menu, locations, etc.).
- `grapes-config.js` for detailed GrapesJS setup.
*/

