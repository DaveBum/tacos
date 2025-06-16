/**
 * TACOnganas Admin Panel - GrapesJS Configuration
 *
 * This file configures the GrapesJS editor for the TACOnganas website.
 * It includes:
 * - Custom blocks for TACOnganas specific content (Menus, Deals, Locations)
 * - Integration with the Media Manager
 * - Storage manager for loading/saving page content via API
 * - Custom panels and commands
 * - SEO metadata editing capabilities
 * - Reusable sections/templates management
 * - Global section handling (Header/Footer)
 */

// Assume adminApp.apiRequest and adminApp.openMediaManager are available globally
// or pass them as arguments to an initialization function.
// For simplicity, this example might use placeholder global functions.
// In a real app, these would be properly scoped and passed.

// Placeholder for API interaction (should be part of your main app logic, e.g., bootstrap.js)
if (typeof window.adminApp === 'undefined') {
    console.warn('adminApp global object not found. Using placeholders for API and Media Manager.');
    window.adminApp = {
        API_BASE_URL: 'http://localhost:3000/api', // Ensure this matches your backend
        apiRequest: async (method, endpoint, body = null) => {
            const url = `${window.adminApp.API_BASE_URL}${endpoint}`;
            console.log(`Mock API Request: ${method} ${url}`, body);
            // Simulate API calls for demonstration if not integrated
            if (method === 'GET' && endpoint.startsWith('/pages/') && endpoint.endsWith('/content')) {
                return {
                    html: `<body><h1>Hello World from Mock API!</h1><p>Edit this content.</p></body>`,
                    css: `body { font-family: Arial, sans-serif; }`,
                    // components: '<div>...</div>', // Or GrapesJS JSON components
                    // styles: '[{ selectors: ["body"], style: { "font-family": "Arial" } }]', // Or GrapesJS JSON styles
                };
            }
            if (method === 'PUT' && endpoint.startsWith('/pages/')) {
                return { success: true, message: 'Page saved (mock)' };
            }
            if (method === 'GET' && endpoint === '/media/list-for-editor') {
                return [
                    { type: 'image', src: 'https://via.placeholder.com/150/FF0000/FFFFFF?Text=Dummy1.jpg', height: 150, width: 150, name: 'Dummy1.jpg' },
                    { type: 'image', src: 'https://via.placeholder.com/150/00FF00/FFFFFF?Text=Dummy2.png', height: 150, width: 150, name: 'Dummy2.png' },
                ];
            }
            if (method === 'GET' && endpoint === '/templates/sections') {
                return [
                    { id: 'template1', name: 'Hero Section Template', html: '<section class="hero"><div class="container"><h1>Reusable Hero</h1><p>Some text</p></div></section>', css: '.hero { background: #f0f0f0; padding: 20px; }' },
                    { id: 'template2', name: 'Contact Form Template', html: '<form class="contact-form"><input type="text" placeholder="Name"><button>Submit</button></form>', css: '.contact-form input { margin-bottom: 10px; }' },
                ];
            }
            return { success: true };
        },
        openMediaManager: (callback) => {
            console.log('Mock Media Manager Opened');
            // Simulate selecting an image
            const selectedAsset = {
                type: 'image', // 'image', 'video', etc.
                src: 'https://via.placeholder.com/300/0000FF/FFFFFF?Text=SelectedImage.jpg',
                height: 300,
                width: 300,
                name: 'SelectedImage.jpg'
            };
            if (confirm(`Use mock image "${selectedAsset.name}"?`)) {
                callback(selectedAsset);
            }
        },
        showNotification: (message, type = 'info') => {
            alert(`[${type.toUpperCase()}] ${message}`);
        },
        getCurrentPageFilename: () => {
            // This should be dynamically set when editor.html is loaded
            const params = new URLSearchParams(window.location.search);
            return params.get('page') || 'index.html';
        }
    };
}


function initializeGrapesJSEditor(pageFilename) {
    if (!pageFilename) {
        adminApp.showNotification('Error: No page filename provided for the editor.', 'error');
        return null;
    }

    const editor = grapesjs.init({
        container: '#gjs', // Main editor container
        height: 'calc(100vh - 50px)', // Adjust as needed
        width: 'auto',
        fromElement: false, // We will load content via storage manager

        // --- Storage Manager ---
        // Handles loading and saving page data (HTML, CSS, components)
        storageManager: {
            id: 'taco-cms-',             // Prefix for local storage keys (if used, but we prefer API)
            type: 'remote',             // Use 'remote' for API-based storage
            autosave: false,            // Turn off autosave, rely on explicit save command
            autoload: true,             // Autoload data on editor init
            stepsBeforeSave: 1,         // Number of changes before triggering 'storage:store' (if autosave was on)
            options: {
                remote: {
                    urlLoad: `${adminApp.API_BASE_URL}/pages/${encodeURIComponent(pageFilename)}/content`,
                    urlStore: `${adminApp.API_BASE_URL}/pages/${encodeURIComponent(pageFilename)}/content`,
                    //contentTypeJson: true, // If your backend expects JSON for components/styles

                    // Before sending data to the server
                    onStore: (data, editor) => {
                        const pageHtml = editor.getHtml();
                        const pageCss = editor.getCss();
                        const pageComponents = editor.getComponents(); // GrapesJS JSON structure
                        const pageStyles = editor.getStyle();       // GrapesJS JSON structure for styles

                        // Extract SEO data
                        const titleEl = editor.Canvas.getDocument().head.querySelector('title');
                        const metaDescEl = editor.Canvas.getDocument().head.querySelector('meta[name="description"]');
                        
                        const seoData = {
                            title: titleEl ? titleEl.innerText : '',
                            description: metaDescEl ? metaDescEl.content : '',
                        };

                        // Extract Header/Footer content if they are special components
                        let headerContent = '';
                        let footerContent = '';
                        const wrapper = editor.getWrapper(); // Get the main <body> component

                        const headerComponent = wrapper.find('[data-gjs-type="global-header"]')[0];
                        if (headerComponent) {
                            headerContent = headerComponent.toHTML();
                        }
                        const footerComponent = wrapper.find('[data-gjs-type="global-footer"]')[0];
                        if (footerComponent) {
                            footerContent = footerComponent.toHTML();
                        }

                        return {
                            filename: pageFilename,
                            html: pageHtml, // Full HTML including <head> and <body>
                            css: pageCss,
                            // Send GrapesJS components/styles if your backend can store/process them
                            // components: JSON.stringify(pageComponents),
                            // styles: JSON.stringify(pageStyles),
                            seo: seoData,
                            globalHeaderContent: headerContent || undefined, // Send only if changed/present
                            globalFooterContent: footerContent || undefined,
                        };
                    },

                    // After data is loaded from the server
                    onLoad: (result) => {
                        // Result should be an object like { html: '...', css: '...', components: '...', styles: '...' }
                        // GrapesJS will use html & css by default if components & styles are not provided.
                        // If your API returns GrapesJS JSON, map it here:
                        // return {
                        //   components: result.components ? JSON.parse(result.components) : editor.Parser.parseHtml(result.html).components,
                        //   style: result.styles ? JSON.parse(result.styles) : editor.Parser.parseCss(result.css),
                        // };
                        // For simplicity, if API returns {html, css}, GrapesJS handles it.
                        // If API returns { components, styles } in GrapesJS JSON format:
                        // return { components: JSON.parse(result.components), styles: JSON.parse(result.styles) };
                        
                        // If API returns { html, css, seo, globalHeader, globalFooter }
                        // The seo, globalHeader, globalFooter are handled by custom logic after load.
                        return { html: result.html, css: result.css };
                    }
                }
            },
        },

        // --- Asset Manager ---
        // Integrates with your custom Media Manager
        assetManager: {
            // assets: [], // Initial assets, can be loaded dynamically
            upload: false, // Disable GrapesJS built-in uploader, we use our own
            // pickAssets: (type) => { /* ... */ }, // For multi-asset selection
            // select: (asset, complete) => { /* ... */ }, // When an asset is selected

            // This function is called when GrapesJS needs to open the asset manager
            open: (options) => {
                // `options` might contain `types: ['image']` or `select: (asset) => {}`
                // Call your application's media manager
                adminApp.openMediaManager((selectedAsset) => {
                    if (selectedAsset && selectedAsset.src) {
                        // GrapesJS expects an array of assets or a single asset object
                        // The object should have at least a `src` property.
                        // Other properties: type ('image'), height, width.
                        editor.AssetManager.add(selectedAsset); // Add to GrapesJS assets
                        
                        // If a specific selection callback is provided by GrapesJS (e.g. for image component)
                        if (options && typeof options.select === 'function') {
                            options.select(selectedAsset, true); // true to close the asset manager
                        } else {
                            // Fallback if no specific select, just add and close
                            editor.AssetManager.close();
                        }
                    } else {
                        editor.AssetManager.close(); // Close if no asset selected
                    }
                });
            },
            // Optional: Load assets from your backend to populate GrapesJS asset manager initially
            // This is useful if you want GrapesJS to have a list of available assets without opening your full media manager.
            // However, the `open` method above provides tighter integration.
            // loadAssets: async () => {
            //   try {
            //     const assets = await adminApp.apiRequest('GET', '/media/list-for-editor'); // Endpoint returning GrapesJS asset format
            //     return assets;
            //   } catch (error) {
            //     console.error('Failed to load assets for GrapesJS Asset Manager:', error);
            //     return [];
            //   }
            // },
        },

        // --- Canvas ---
        // Configuration for the editing canvas
        canvas: {
            styles: [
                // Load site's global CSS into the canvas for accurate preview
                // This path should be relative to where editor.html is served or an absolute path
                // to the live site's CSS if previewing external CSS.
                // For local development, ensure this path correctly points to your site's main CSS.
                '/tacosnganas/css/style.css', // Assuming backend serves tacosnganas folder
                '/tacosnganas/css/theme.css', // Example additional theme CSS
                // Add any other global CSS files your site uses
            ],
            scripts: [
                // Load site's global JS into the canvas if needed for dynamic elements preview
                // Be cautious with JS in canvas as it can interfere with editor.
                // '/tacosnganas/js/main.js',
            ],
        },

        // --- Device Manager ---
        // For responsive design previews
        deviceManager: {
            devices: [
                { name: 'Desktop', width: '' }, // default
                { name: 'Tablet', width: '768px', widthMedia: '992px' },
                { name: 'Mobile', width: '375px', widthMedia: '767px' },
            ]
        },

        // --- Panels ---
        // Defines the UI panels (top, left, right) and their buttons
        panels: {
            defaults: [
                // --- Top Panel ---
                {
                    id: 'panel-top',
                    buttons: [
                        { id: 'editor-mode-switcher', className: 'fa fa-desktop', command: 'set-device-desktop', active: true, label: 'Desktop' },
                        { id: 'editor-mode-tablet', className: 'fa fa-tablet', command: 'set-device-tablet', label: 'Tablet' },
                        { id: 'editor-mode-mobile', className: 'fa fa-mobile', command: 'set-device-mobile', label: 'Mobile' },
                        { id: 'preview', className: 'fa fa-eye', command: 'core:preview', label: 'Preview' },
                        { id: 'fullscreen', className: 'fa fa-arrows-alt', command: 'core:fullscreen', label: 'Fullscreen' },
                        { id: 'export-template', className: 'fa fa-code', command: 'core:export-template', label: 'View Code' },
                        { id: 'undo', className: 'fa fa-undo', command: 'core:undo', label: 'Undo' },
                        { id: 'redo', className: 'fa fa-repeat', command: 'core:redo', label: 'Redo' },
                        { id: 'save-db', className: 'fa fa-save', command: 'core:save-db', label: 'Save Page' },
                        { id: 'open-seo-editor', className: 'fa fa-line-chart', command: 'open-seo-editor', label: 'SEO' },
                        { id: 'manage-reusable-sections', className: 'fa fa-puzzle-piece', command: 'manage-reusable-sections', label: 'Reusable Sections' },
                    ],
                },
                // --- Left Panel (Layers, Traits, Styles, Blocks) ---
                {
                    id: 'panel-switcher',
                    buttons: [
                        { id: 'show-layers', active: true, label: 'Layers', command: 'show-layers', className: 'fa fa-bars', togglable: false },
                        { id: 'show-style', label: 'Styles', command: 'show-styles', className: 'fa fa-paint-brush', togglable: false },
                        { id: 'show-traits', label: 'Settings', command: 'show-traits', className: 'fa fa-cog', togglable: false },
                        { id: 'show-blocks', label: 'Blocks', command: 'show-blocks', className: 'fa fa-th-large', togglable: false },
                    ],
                },
                // --- Right Panel (where Layers, Traits, etc. appear) ---
                { id: 'panel-right', }
            ]
        },

        // --- Block Manager ---
        // Defines the draggable blocks/components
        blockManager: {
            appendTo: '#blocks-container', // Custom element to append blocks, or GrapesJS handles it
            blocks: [
                // Basic Blocks (GrapesJS provides some, customize or add more)
                { id: 'text', label: 'Text', content: '<div data-gjs-type="text">Insert your text here</div>', category: 'Basic', attributes: { class: 'gjs-fonts gjs-f-text' } },
                { id: 'image', label: 'Image', select: true, content: { type: 'image' }, category: 'Basic', activate: true, attributes: { class: 'fa fa-picture-o' } },
                { id: 'link', label: 'Link', content: { type: 'link', content: 'Link text' }, category: 'Basic', attributes: { class: 'fa fa-link' } },
                { id: 'video', label: 'Video', content: { type: 'video', src: 'img/video.mp4', provider: 'so' }, category: 'Basic', attributes: { class: 'fa fa-youtube-play' } },
                { id: 'map', label: 'Map', content: { type: 'map', style: { height: '350px'} }, category: 'Basic', attributes: { class: 'fa fa-map-o' } },
                
                // Layout Blocks
                { id: 'section', label: 'Section', content: '<section class="py-5"><div class="container">New Section</div></section>', category: 'Layout', attributes: { class: 'gjs-block-section fa fa-columns' } },
                { id: 'container', label: 'Container', content: '<div class="container"></div>', category: 'Layout', attributes: { class: 'fa fa-folder-o' } },
                { id: 'row', label: 'Row', content: '<div class="row"></div>', category: 'Layout', attributes: { class: 'fa fa-ellipsis-h' } },
                { id: 'column', label: 'Column', content: '<div class="col"></div>', category: 'Layout', attributes: { class: 'fa fa-square-o' } },
                { id: 'column_1', label: '1 Column', content: '<div class="row" data-gjs-droppable=".col"><div class="col"></div></div>', category: 'Layout', attributes: { class: 'fa fa-square-o' } },
                { id: 'column_2', label: '2 Columns', content: '<div class="row" data-gjs-droppable=".col"><div class="col"></div><div class="col"></div></div>', category: 'Layout', attributes: { class: 'fa fa-columns' } },
                { id: 'column_3', label: '3 Columns', content: '<div class="row" data-gjs-droppable=".col"><div class="col"></div><div class="col"></div><div class="col"></div></div>', category: 'Layout', attributes: { class: 'fa fa-th' } },

                // TACOnganas Specific Blocks
                {
                    id: 'taco-deal-item',
                    label: 'Deal Item',
                    category: 'TACOnganas',
                    attributes: { class: 'fa fa-tag' },
                    content: `
                        <div class="deal-item card mb-3" data-gjs-type="deal-component">
                            <img src="https://via.placeholder.com/300x200.png?text=Deal+Image" class="card-img-top" alt="Deal Image">
                            <div class="card-body">
                                <h5 class="card-title" data-gjs-editable="true">Special Taco Deal</h5>
                                <p class="card-text" data-gjs-editable="true">Delicious tacos at a special price. Limited time offer!</p>
                                <p class="card-text" data-gjs-editable="true"><small class="text-muted">Expires: Tomorrow</small></p>
                                <a href="#" class="btn btn-primary" data-gjs-editable="true">Claim Deal</a>
                            </div>
                        </div>
                    `
                },
                {
                    id: 'taco-location-card',
                    label: 'Location Card',
                    category: 'TACOnganas',
                    attributes: { class: 'fa fa-map-marker' },
                    content: `
                        <div class="location-card card mb-3" data-gjs-type="location-component">
                            <div class="card-body">
                                <h5 class="card-title" data-gjs-editable="true">Downtown Branch</h5>
                                <p class="card-text" data-gjs-editable="true">123 Main St, Anytown, USA</p>
                                <p class="card-text" data-gjs-editable="true">Hours: 9 AM - 9 PM</p>
                                <div data-gjs-type="map" style="height:200px;" data-gjs-name="Location Map"></div>
                            </div>
                        </div>
                    `
                },
                {
                    id: 'taco-menu-section',
                    label: 'Menu Section',
                    category: 'TACOnganas',
                    attributes: { class: 'fa fa-cutlery' },
                    content: `
                        <section class="menu-section py-4" data-gjs-type="menu-section-component">
                            <div class="container">
                                <h2 class="text-center mb-4" data-gjs-editable="true">Our Tacos</h2>
                                <div class="row">
                                    <div class="col-md-6 menu-item">
                                        <h4 data-gjs-editable="true">Carne Asada Taco</h4>
                                        <p data-gjs-editable="true">$3.00 - Grilled steak, onions, cilantro.</p>
                                    </div>
                                    <div class="col-md-6 menu-item">
                                        <h4 data-gjs-editable="true">Al Pastor Taco</h4>
                                        <p data-gjs-editable="true">$3.00 - Marinated pork, pineapple, onions, cilantro.</p>
                                    </div>
                                </div>
                            </div>
                        </section>
                    `
                },
                {
                    id: 'google-map-embed',
                    label: 'Google Map Embed',
                    category: 'TACOnganas',
                    attributes: { class: 'fa fa-map-signs' },
                    content: {
                        type: 'map-embed-component', // Custom component type
                        content: 'Google Map will appear here. Configure address in settings.',
                        style: { height: '400px', width: '100%', border: '1px dashed #ccc', display: 'flex', 'align-items': 'center', 'justify-content': 'center' },
                        // Default attributes for the component's model
                        attributes: { address: '1600 Amphitheatre Parkway, Mountain View, CA', zoom: 15 }
                    }
                },
                // Global Header/Footer (special handling)
                {
                    id: 'global-header-placeholder',
                    label: 'Site Header',
                    category: 'Global Sections',
                    attributes: { class: 'fa fa-header' },
                    content: {
                        type: 'global-header', // Custom component type
                        content: '<!-- Global Header Content Loaded Here -->',
                        style: { padding: '10px', border: '2px dashed blue', 'min-height': '50px', 'text-align': 'center' },
                        attributes: { 'data-global-section': 'header' }
                    }
                },
                {
                    id: 'global-footer-placeholder',
                    label: 'Site Footer',
                    category: 'Global Sections',
                    attributes: { class: 'fa fa-caret-square-o-down' },
                    content: {
                        type: 'global-footer', // Custom component type
                        content: '<!-- Global Footer Content Loaded Here -->',
                        style: { padding: '10px', border: '2px dashed green', 'min-height': '50px', 'text-align': 'center' },
                        attributes: { 'data-global-section': 'footer' }
                    }
                },
            ]
        },

        // --- Component Manager (Define custom component types) ---
        domComponents: {
            // Define custom component types used in blocks or for special behavior
            types: [
                {
                    id: 'map-embed-component',
                    model: {
                        defaults: {
                            tagName: 'div',
                            droppable: false,
                            attributes: { 
                                'data-gjs-map-address': '1600 Amphitheatre Parkway, Mountain View, CA',
                                'data-gjs-map-zoom': 15
                            },
                            traits: [
                                { type: 'text', name: 'address', label: 'Address', changeProp: 1, 'data-gjs-map-address': true },
                                { type: 'number', name: 'zoom', label: 'Zoom Level', min: 1, max: 20, changeProp: 1, 'data-gjs-map-zoom': true },
                            ],
                            script: function() {
                                const address = this.getAttribute('data-gjs-map-address');
                                const zoom = this.getAttribute('data-gjs-map-zoom') || 15;
                                const apiKey = 'YOUR_GOOGLE_MAPS_API_KEY'; // IMPORTANT: Replace with your actual API key or manage securely
                                
                                if (!apiKey || apiKey === 'YOUR_GOOGLE_MAPS_API_KEY') {
                                    this.innerHTML = '<p style="color:red; text-align:center;">Google Maps API Key not configured.</p>';
                                    return;
                                }

                                const iframe = document.createElement('iframe');
                                iframe.width = '100%';
                                iframe.height = '100%';
                                iframe.frameBorder = '0';
                                iframe.style.border = '0';
                                iframe.src = `https://www.google.com/maps/embed/v1/place?key=${apiKey}&q=${encodeURIComponent(address)}&zoom=${zoom}`;
                                iframe.allowFullscreen = true;
                                
                                // Clear previous content and append iframe
                                while (this.firstChild) {
                                    this.removeChild(this.firstChild);
                                }
                                this.appendChild(iframe);
                            }
                        },
                        // Update script when traits change
                        updated(property, value, prevValue) {
                            if (property === 'attributes' && (this.getAttributes()['data-gjs-map-address'] !== prevValue['data-gjs-map-address'] || this.getAttributes()['data-gjs-map-zoom'] !== prevValue['data-gjs-map-zoom'])) {
                                this.runScript();
                            }
                        }
                    },
                    view: {} // Default view is fine
                },
                {
                    id: 'global-header',
                    model: {
                        defaults: {
                            tagName: 'header',
                            droppable: true, // Allow dropping elements inside header
                            draggable: '[data-gjs-type="wrapper"]', // Only draggable within the body/wrapper
                            removable: false,
                            copyable: false,
                            layerable: true,
                            name: 'Global Header',
                            attributes: { 'data-global-section': 'header', 'data-gjs-locked': 'true' }, // Lock content by default
                            content: '<!-- Global Header Content -->',
                            // Add traits to edit global header properties if needed
                            // traits: [ { name: 'edit-global-header', type: 'button', text: 'Edit Header Globally', command: 'edit-global-header-cmd' } ]
                        },
                        async init() {
                            // Load global header content on initialization
                            try {
                                const headerData = await adminApp.apiRequest('GET', '/settings/global/header');
                                if (headerData && headerData.content) {
                                    this.components(headerData.content); // Replace placeholder with actual content
                                }
                            } catch (error) {
                                console.error('Failed to load global header content:', error);
                                this.components('<div>Error loading global header.</div>');
                            }
                            // Prevent direct editing unless a specific "edit global" mode is active
                            this.set('editable', false); 
                        }
                    },
                    view: {
                        // Custom view logic if needed, e.g., to add an overlay or edit button
                    }
                },
                {
                    id: 'global-footer',
                    model: {
                        defaults: {
                            tagName: 'footer',
                            droppable: true,
                            draggable: '[data-gjs-type="wrapper"]',
                            removable: false,
                            copyable: false,
                            layerable: true,
                            name: 'Global Footer',
                            attributes: { 'data-global-section': 'footer', 'data-gjs-locked': 'true' },
                            content: '<!-- Global Footer Content -->',
                        },
                        async init() {
                            try {
                                const footerData = await adminApp.apiRequest('GET', '/settings/global/footer');
                                if (footerData && footerData.content) {
                                    this.components(footerData.content);
                                }
                            } catch (error) {
                                console.error('Failed to load global footer content:', error);
                                this.components('<div>Error loading global footer.</div>');
                            }
                            this.set('editable', false);
                        }
                    },
                    view: {}
                }
                // Add other custom component types: deal-component, location-component, menu-section-component
            ]
        },

        // --- Style Manager ---
        // Configure CSS styling options
        styleManager: {
            appendTo: '#styles-container',
            sectors: [
                {
                    name: 'General',
                    open: false,
                    buildProps: ['float', 'display', 'position', 'top', 'right', 'left', 'bottom']
                },
                {
                    name: 'Dimension',
                    open: false,
                    buildProps: ['width', 'height', 'max-width', 'min-height', 'margin', 'padding']
                },
                {
                    name: 'Typography',
                    open: false,
                    buildProps: ['font-family', 'font-size', 'font-weight', 'letter-spacing', 'color', 'line-height', 'text-align', 'text-decoration', 'text-shadow'],
                    properties: [
                        {
                            property: 'text-align',
                            list: [
                                { value: 'left', className: 'fa fa-align-left' },
                                { value: 'center', className: 'fa fa-align-center' },
                                { value: 'right', className: 'fa fa-align-right' },
                                { value: 'justify', className: 'fa fa-align-justify' },
                            ]
                        }
                    ]
                },
                {
                    name: 'Decorations',
                    open: false,
                    buildProps: ['background-color', 'border-radius', 'border', 'box-shadow', 'background']
                },
                {
                    name: 'Extra',
                    open: false,
                    buildProps: ['opacity', 'transition', 'transform']
                }
            ]
        },

        // --- Layer Manager ---
        layerManager: {
            appendTo: '#layers-container',
        },

        // --- Trait Manager ---
        traitManager: {
            appendTo: '#traits-container',
        },

        // --- Selector Manager ---
        // For managing CSS selectors/classes
        selectorManager: {
            appendTo: '#selectors-container',
        },
        
        // --- Rich Text Editor ---
        // Configuration for the built-in RTE
        richTextEditor: {
            actions: [
                'bold', 'italic', 'underline', 'strikethrough', 
                'link', 'unlink',
                'insertOrderedList', 'insertUnorderedList',
                'justifyLeft', 'justifyCenter', 'justifyRight', 'justifyFull',
                'formatBlock' // For H1, H2, P etc.
            ],
            // Example custom action
            // {
            //   name: 'clearFormatting',
            //   icon: '<b>C</b>',
            //   attributes: {title: 'Clear Formatting'},
            //   result: rte => rte.exec('removeFormat')
            // }
        },

        // --- Plugins ---
        // GrapesJS plugins can extend functionality
        plugins: [
            'gjs-preset-webpage', // Basic preset with common blocks, panels, commands
            // 'grapesjs-custom-code', // If you need to allow users to add custom HTML/JS/CSS
            // 'grapesjs-parser-postcss', // For PostCSS support if needed
            // 'grapesjs-tooltip', // For tooltips on elements
            // 'grapesjs-touch', // For better touch support
            // 'grapesjs-component-code-editor', // Edit component code directly
        ],
        pluginsOpts: {
            'gjs-preset-webpage': {
                // Options for the webpage preset
                blocks: [/* override default blocks if needed, or let it add its own */],
                // modalImportTitle: 'Import Template',
                // modalImportLabel: '<div style="margin-bottom: 10px; font-size: 13px;">Paste here your HTML/CSS and click Import</div>',
                // ... other preset options
            },
            // 'grapesjs-custom-code': { /* options */ },
        },

        // --- Internationalization ---
        // i18n: {
        //     messages: { en: { /* Custom messages */ } },
        // },

        // --- Protection against XSS ---
        // When an HTML/CSS is loaded into the editor, it's advisable to sanitize it
        // `editor.Parser.parseHtml(html)` can be configured with a sanitizer
        // parser: {
        //   optionsHtml: {
        //     htmlType: 'text/html', // Type of the HTML content. If 'text/html' the content is sanitized
        //     // allowScripts: 1, // Allow SCRIPT tags
        //     // sanitizer: (node, rule) => { /* your custom sanitizer */ }
        //   }
        // }

    });

    // --- Custom Commands ---
    editor.Commands.add('core:save-db', {
        run: (editor, sender) => {
            sender && sender.set('active', true); // Show button as active
            editor.store(res => {
                adminApp.showNotification('Page content saved successfully to backend!', 'success');
                console.log('Save successful:', res);
                sender && sender.set('active', false);
                // Potentially trigger a revision history update here
            }).catch(err => {
                adminApp.showNotification(`Error saving page: ${err.message || 'Unknown error'}`, 'error');
                console.error('Save failed:', err);
                sender && sender.set('active', false);
            });
        }
    });

    editor.Commands.add('show-layers', {
        getRowEl(editor) { return editor.getContainer().closest('.editor-row'); },
        getLayersEl(row) { return row.querySelector('.layers-container') },
        run(editor, sender) {
            const lmEl = this.getLayersEl(this.getRowEl(editor));
            lmEl.style.display = '';
        },
        stop(editor, sender) {
            const lmEl = this.getLayersEl(this.getRowEl(editor));
            lmEl.style.display = 'none';
        }
    });
    editor.Commands.add('show-styles', {
        getRowEl(editor) { return editor.getContainer().closest('.editor-row'); },
        getStyleEl(row) { return row.querySelector('.styles-container') },
        run(editor, sender) {
            const smEl = this.getStyleEl(this.getRowEl(editor));
            smEl.style.display = '';
        },
        stop(editor, sender) {
            const smEl = this.getStyleEl(this.getRowEl(editor));
            smEl.style.display = 'none';
        }
    });
    editor.Commands.add('show-blocks', {
        getRowEl(editor) { return editor.getContainer().closest('.editor-row'); },
        getBlocksEl(row) { return row.querySelector('.blocks-container') },
        run(editor, sender) {
            const bmEl = this.getBlocksEl(this.getRowEl(editor));
            bmEl.style.display = '';
        },
        stop(editor, sender) {
            const bmEl = this.getBlocksEl(this.getRowEl(editor));
            bmEl.style.display = 'none';
        }
    });
     editor.Commands.add('show-traits', {
        getRowEl(editor) { return editor.getContainer().closest('.editor-row'); },
        getTraitsEl(row) { return row.querySelector('.traits-container') },
        run(editor, sender) {
            const tmEl = this.getTraitsEl(this.getRowEl(editor));
            tmEl.style.display = '';
        },
        stop(editor, sender) {
            const tmEl = this.getTraitsEl(this.getRowEl(editor));
            tmEl.style.display = 'none';
        }
    });

    // Command to open SEO modal/panel
    editor.Commands.add('open-seo-editor', {
        run: (editor, sender) => {
            // This should open a modal or a dedicated panel for SEO editing
            // For now, using prompts as placeholders
            const doc = editor.Canvas.getDocument();
            let currentTitle = doc.head.querySelector('title')?.innerText || '';
            let currentDesc = doc.head.querySelector('meta[name="description"]')?.content || '';

            const newTitle = prompt('Enter Page Title (for SEO):', currentTitle);
            if (newTitle !== null) {
                let titleTag = doc.head.querySelector('title');
                if (!titleTag) {
                    titleTag = doc.createElement('title');
                    doc.head.appendChild(titleTag);
                }
                titleTag.innerText = newTitle;
            }

            const newDesc = prompt('Enter Meta Description (for SEO):', currentDesc);
            if (newDesc !== null) {
                let metaTag = doc.head.querySelector('meta[name="description"]');
                if (!metaTag) {
                    metaTag = doc.createElement('meta');
                    metaTag.name = 'description';
                    doc.head.appendChild(metaTag);
                }
                metaTag.content = newDesc;
            }
            adminApp.showNotification('SEO data updated in editor. Save page to persist.', 'info');
        }
    });

    // Command to manage reusable sections
    editor.Commands.add('manage-reusable-sections', {
        run: async (editor, sender) => {
            // This should open a modal to:
            // 1. Save selected component as a reusable section
            // 2. Load and insert existing reusable sections
            const selectedComponent = editor.getSelected();
            const action = prompt("Reusable Sections: Type 'save' to save selected, 'load' to load existing, or 'cancel'.");

            if (action === 'save' && selectedComponent) {
                const sectionName = prompt("Enter a name for this reusable section:");
                if (sectionName) {
                    const html = selectedComponent.toHTML();
                    const css = editor.CodeManager.getCode(selectedComponent, 'css', { cssc: editor.CssComposer });
                    try {
                        await adminApp.apiRequest('POST', '/templates/sections', { name: sectionName, html, css });
                        adminApp.showNotification(`Section "${sectionName}" saved!`, 'success');
                    } catch (e) {
                        adminApp.showNotification(`Error saving section: ${e.message}`, 'error');
                    }
                }
            } else if (action === 'load') {
                try {
                    const sections = await adminApp.apiRequest('GET', '/templates/sections');
                    if (sections && sections.length > 0) {
                        const sectionNames = sections.map((s, i) => `${i + 1}. ${s.name}`).join('\n');
                        const choice = prompt(`Available sections:\n${sectionNames}\n\nEnter number to load:`);
                        const selectedIndex = parseInt(choice) - 1;
                        if (selectedIndex >= 0 && selectedIndex < sections.length) {
                            const sectionToLoad = sections[selectedIndex];
                            editor.addComponents(sectionToLoad.html); // Add HTML
                            if (sectionToLoad.css) editor.addStyle(sectionToLoad.css); // Add CSS
                            adminApp.showNotification(`Section "${sectionToLoad.name}" loaded!`, 'success');
                        } else {
                            adminApp.showNotification('Invalid selection.', 'warning');
                        }
                    } else {
                        adminApp.showNotification('No reusable sections found.', 'info');
                    }
                } catch (e) {
                    adminApp.showNotification(`Error loading sections: ${e.message}`, 'error');
                }
            }
        }
    });
    
    // --- Event Listeners ---
    editor.on('load', () => {
        adminApp.showNotification(`Editor loaded for ${pageFilename}`, 'info');
        // After load, ensure global sections are correctly populated if not handled by component init
        // This is a fallback or alternative to component init for global sections
        const wrapper = editor.getWrapper();
        const headerComp = wrapper.find('[data-gjs-type="global-header"]')[0];
        const footerComp = wrapper.find('[data-gjs-type="global-footer"]')[0];

        if (headerComp && headerComp.components().length === 0) { // If placeholder content is still there
             adminApp.apiRequest('GET', '/settings/global/header').then(data => {
                if (data && data.content) headerComp.components(data.content);
             }).catch(e => console.error("Error auto-loading header on editor load:", e));
        }
        if (footerComp && footerComp.components().length === 0) {
             adminApp.apiRequest('GET', '/settings/global/footer').then(data => {
                if (data && data.content) footerComp.components(data.content);
             }).catch(e => console.error("Error auto-loading footer on editor load:", e));
        }

        // Set initial panel view
        editor.runCommand('show-layers'); // Or 'show-blocks'
    });

    editor.on('storage:error', (err) => {
        adminApp.showNotification(`Storage Error: ${err.message || 'Unknown error'}`, 'error');
        console.error('Storage Error:', err);
    });

    editor.on('component:selected', (component) => {
        // Example: If a global header/footer is selected, maybe show a specific trait or warning
        if (component.get('type') === 'global-header' || component.get('type') === 'global-footer') {
            // adminApp.showNotification('Editing global sections here might require a separate "Edit Global" mode or will be saved globally.', 'info');
            // component.set('editable', true); // Temporarily allow editing, or use a command
        }
    });
    
    // Make editor instance globally accessible for debugging or external calls if needed
    window.grapesEditor = editor;
    return editor;
}

// Example of how this might be called from editor.html:
// document.addEventListener('DOMContentLoaded', () => {
//     const pageFile = adminApp.getCurrentPageFilename(); // Get from URL or global state
//     if (pageFile) {
//         initializeGrapesJSEditor(pageFile);
//     } else {
//         document.getElementById('gjs').innerHTML = '<p style="color:red; text-align:center; padding-top: 50px;">Error: Page filename not specified. Cannot load editor.</p>';
//     }
// });
