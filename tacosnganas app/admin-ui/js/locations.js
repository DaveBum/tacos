/**
 * TACOnganas Admin Panel - Advanced Locations Management
 *
 * Features:
 * - CRUD operations for restaurant locations.
 * - Interactive map (Leaflet.js) for selecting/viewing location coordinates.
 * - Client-side table sorting, searching, and pagination.
 * - Enhanced form UX with validation feedback and helper buttons.
 * - Simple client-side state management.
 * - Assumes adminApp global object for API calls and notifications.
 * - Assumes Leaflet.js is included in the HTML.
 */

// Ensure adminApp is available
if (typeof window.adminApp === 'undefined') {
    console.error('FATAL ERROR: adminApp global object not found. Locations management cannot function.');
    document.addEventListener('DOMContentLoaded', () => {
        const notificationsDiv = document.getElementById('locationNotifications'); // Assumed HTML element
        if (notificationsDiv) {
            notificationsDiv.innerHTML = `<div class="alert alert-danger" role="alert">Critical Error: Application core (adminApp) not loaded. Locations functionality is disabled.</div>`;
        }
    });
}

document.addEventListener('DOMContentLoaded', () => {
    // DOM Element Selectors (cached for performance)
    const DOMElements = {
        notificationsArea: document.getElementById('locationNotifications'),
        form: document.getElementById('locationForm'),
        formTitle: document.getElementById('locationFormTitle'),
        idInput: document.getElementById('locationId'),
        nameInput: document.getElementById('locationName'),
        addressInput: document.getElementById('locationAddress'),
        hoursInput: document.getElementById('locationHours'),
        phoneInput: document.getElementById('locationPhone'),
        latitudeInput: document.getElementById('locationLatitude'),
        longitudeInput: document.getElementById('locationLongitude'),
        mapEmbedInput: document.getElementById('locationMapEmbed'),
        isActiveInput: document.getElementById('locationIsActive'),
        saveBtn: document.getElementById('saveLocationBtn'),
        cancelBtn: document.getElementById('cancelEditLocationBtn'),
        // Interactive Map Elements
        interactiveMapContainer: document.getElementById('interactiveLocationMap'), // Div for Leaflet map
        addressToMapBtn: document.getElementById('addressToMapBtn'), // Button to use address on map
        // Embed Generation & Preview
        generateEmbedBtn: document.getElementById('generateEmbedBtn'),
        previewEmbedBtn: document.getElementById('previewEmbedBtn'),
        mapEmbedPreviewCard: document.getElementById('mapEmbedPreviewCard'),
        mapEmbedPreviewContainer: document.getElementById('mapPreviewContainer'),
        // Table & List Elements
        tableContainer: document.getElementById('locationsTableContainer'), // Will contain the table
        searchInput: document.getElementById('locationSearchInput'),
        noLocationsMessage: document.getElementById('noLocationsMessage'),
        paginationControls: document.getElementById('paginationControls'), // Nav element for pagination
    };

    // Check if essential elements are present
    if (!DOMElements.form || !DOMElements.tableContainer) {
        // console.log("Location management elements not found on this page. Skipping advanced init.");
        return;
    }

    // Application State
    const state = {
        locations: [], // Full list of locations from API
        filteredLocations: [], // Locations after search/filter
        editingLocation: null, // Location object being edited, or null for new
        isLoading: false,
        currentPage: 1,
        itemsPerPage: 5, // Configurable
        sortColumn: 'name',
        sortDirection: 'asc',
        searchTerm: '',
        mapInstance: null,
        mapMarker: null,
    };

    // --- UTILITY FUNCTIONS ---
    const showNotification = (message, type = 'info', areaId = 'locationNotifications') => {
        if (window.adminApp && typeof window.adminApp.showNotification === 'function') {
            window.adminApp.showNotification(message, type, areaId);
        } else {
            const notificationsDiv = document.getElementById(areaId);
            if (notificationsDiv) {
                const alertType = type === 'error' ? 'danger' : type;
                notificationsDiv.innerHTML = `<div class="alert alert-${alertType} alert-dismissible fade show" role="alert">
                                                ${message}
                                                <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
                                              </div>`;
            }
        }
    };

    const apiRequest = async (method, endpoint, body = null) => {
        if (window.adminApp && typeof window.adminApp.apiRequest === 'function') {
            return window.adminApp.apiRequest(method, endpoint, body);
        }
        showNotification('API request function is not available.', 'error');
        throw new Error('API request function is not available.');
    };

    const escapeHtml = (str) => {
        if (str === null || str === undefined) return '';
        return String(str).replace(/[&<>"']/g, match => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;'
        }[match]));
    };

    const setLoadingState = (loading) => {
        state.isLoading = loading;
        DOMElements.saveBtn.disabled = loading;
        DOMElements.saveBtn.innerHTML = loading
            ? `<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Processing...`
            : (state.editingLocation ? 'Update Location' : 'Save Location');
    };

    // --- INTERACTIVE MAP (LEAFLET.JS) ---
    const initInteractiveMap = () => {
        if (!L) {
            showNotification('Leaflet library not loaded. Interactive map disabled.', 'warning');
            DOMElements.interactiveMapContainer.innerHTML = '<p class="text-danger text-center">Map library not loaded.</p>';
            return;
        }
        if (state.mapInstance) state.mapInstance.remove(); // Remove existing map if any

        // Default view (e.g., center of a known area or a default city)
        state.mapInstance = L.map(DOMElements.interactiveMapContainer).setView([34.0522, -118.2437], 10); // Los Angeles

        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        }).addTo(state.mapInstance);

        state.mapInstance.on('click', (e) => {
            const { lat, lng } = e.latlng;
            DOMElements.latitudeInput.value = lat.toFixed(6);
            DOMElements.longitudeInput.value = lng.toFixed(6);
            updateMapMarker(lat, lng);
            validateField(DOMElements.latitudeInput);
            validateField(DOMElements.longitudeInput);
        });
    };

    const updateMapMarker = (lat, lng, zoomToMarker = true) => {
        if (!state.mapInstance) return;
        if (state.mapMarker) {
            state.mapMarker.setLatLng([lat, lng]);
        } else {
            state.mapMarker = L.marker([lat, lng]).addTo(state.mapInstance);
        }
        if (zoomToMarker) {
            state.mapInstance.setView([lat, lng], 15); // Zoom to marker
        }
    };
    
    const findAddressOnMap = async () => {
        const address = DOMElements.addressInput.value.trim();
        if (!address) {
            showNotification('Please enter an address first.', 'warning');
            return;
        }
        if (!state.mapInstance) initInteractiveMap();
        if (!state.mapInstance) return; // Guard if init failed

        showNotification('Geocoding address... (Note: This is a placeholder. Real geocoding requires a backend service and API key).', 'info');
        
        // === Placeholder for actual Geocoding Service Call ===
        // In a real app, you'd call your backend:
        // try {
        //   const coords = await apiRequest('POST', '/locations/geocode', { address });
        //   if (coords && coords.latitude && coords.longitude) {
        //     DOMElements.latitudeInput.value = coords.latitude;
        //     DOMElements.longitudeInput.value = coords.longitude;
        //     updateMapMarker(coords.latitude, coords.longitude);
        //     showNotification('Address found and map updated!', 'success');
        //   } else {
        //     showNotification('Could not find coordinates for the address.', 'warning');
        //   }
        // } catch (error) {
        //   showNotification('Error during geocoding: ' + error.message, 'error');
        // }
        // For now, we'll just log it and maybe center map on a default if address is "known"
        console.warn("Geocoding simulation: For a real app, integrate a backend geocoding service.");
        // Example: if address is "Eiffel Tower", pan to Paris (very basic simulation)
        if (address.toLowerCase().includes("eiffel tower")) {
            const lat = 48.8584, lng = 2.2945;
            DOMElements.latitudeInput.value = lat.toFixed(6);
            DOMElements.longitudeInput.value = lng.toFixed(6);
            updateMapMarker(lat, lng);
        } else {
            showNotification('Address search is simulated. Click map to set coordinates or enter manually.', 'info');
        }
    };


    // --- FORM HANDLING & VALIDATION ---
    const validateField = (inputElement) => {
        let isValid = true;
        const value = inputElement.value.trim();
        const feedbackElement = inputElement.nextElementSibling && inputElement.nextElementSibling.classList.contains('invalid-feedback')
            ? inputElement.nextElementSibling
            : null;

        inputElement.classList.remove('is-invalid', 'is-valid');

        switch (inputElement.id) {
            case 'locationName':
            case 'locationAddress':
                isValid = !!value;
                if (feedbackElement) feedbackElement.textContent = `${inputElement.labels[0].textContent} is required.`;
                break;
            case 'locationLatitude':
            case 'locationLongitude':
                isValid = value === '' || (!isNaN(parseFloat(value)) && isFinite(value));
                 if (feedbackElement) feedbackElement.textContent = `Must be a valid number.`;
                break;
            // Add more cases for other fields if needed
        }

        if (isValid) {
            inputElement.classList.add('is-valid');
        } else {
            inputElement.classList.add('is-invalid');
        }
        return isValid;
    };

    const validateForm = () => {
        let isFormValid = true;
        [DOMElements.nameInput, DOMElements.addressInput, DOMElements.latitudeInput, DOMElements.longitudeInput].forEach(input => {
            if (!validateField(input)) isFormValid = false;
        });
        return isFormValid;
    };
    
    const populateForm = (location) => {
        state.editingLocation = location;
        DOMElements.formTitle.textContent = 'Edit Location';
        DOMElements.idInput.value = location.id;
        DOMElements.nameInput.value = location.name;
        DOMElements.addressInput.value = location.address;
        DOMElements.hoursInput.value = location.hours || '';
        DOMElements.phoneInput.value = location.phone || '';
        DOMElements.latitudeInput.value = location.latitude || '';
        DOMElements.longitudeInput.value = location.longitude || '';
        DOMElements.mapEmbedInput.value = location.mapEmbedCode || '';
        DOMElements.isActiveInput.checked = location.isActive === undefined ? true : location.isActive;
        DOMElements.saveBtn.textContent = 'Update Location';
        DOMElements.cancelBtn.style.display = 'inline-block';

        // Update interactive map
        if (!state.mapInstance) initInteractiveMap();
        if (state.mapInstance && location.latitude && location.longitude) {
            updateMapMarker(parseFloat(location.latitude), parseFloat(location.longitude));
        } else if (state.mapMarker) { // Clear marker if no coords
            state.mapMarker.remove();
            state.mapMarker = null;
        }
        
        [DOMElements.nameInput, DOMElements.addressInput, DOMElements.latitudeInput, DOMElements.longitudeInput].forEach(el => el.classList.remove('is-invalid', 'is-valid'));
        DOMElements.nameInput.focus();
        window.scrollTo({ top: DOMElements.form.offsetTop - 20, behavior: 'smooth' });
        previewMapEmbed();
    };

    const resetForm = () => {
        state.editingLocation = null;
        DOMElements.form.reset();
        DOMElements.idInput.value = '';
        DOMElements.isActiveInput.checked = true;
        DOMElements.formTitle.textContent = 'Add New Location';
        DOMElements.saveBtn.textContent = 'Save Location';
        DOMElements.cancelBtn.style.display = 'none';
        DOMElements.mapEmbedPreviewCard.style.display = 'none';
        DOMElements.mapEmbedPreviewContainer.innerHTML = '';
        [DOMElements.nameInput, DOMElements.addressInput, DOMElements.latitudeInput, DOMElements.longitudeInput].forEach(el => el.classList.remove('is-invalid', 'is-valid'));

        if (state.mapMarker) {
            state.mapMarker.remove();
            state.mapMarker = null;
        }
        if (state.mapInstance) { // Reset map view to default
            state.mapInstance.setView([34.0522, -118.2437], 10);
        }
    };

    const handleFormSubmit = async (event) => {
        event.preventDefault();
        if (!validateForm()) {
            showNotification('Please correct the errors in the form.', 'warning');
            return;
        }
        setLoadingState(true);

        const formData = {
            name: DOMElements.nameInput.value.trim(),
            address: DOMElements.addressInput.value.trim(),
            hours: DOMElements.hoursInput.value.trim(),
            phone: DOMElements.phoneInput.value.trim() || null,
            latitude: DOMElements.latitudeInput.value.trim() ? parseFloat(DOMElements.latitudeInput.value.trim()) : null,
            longitude: DOMElements.longitudeInput.value.trim() ? parseFloat(DOMElements.longitudeInput.value.trim()) : null,
            mapEmbedCode: DOMElements.mapEmbedInput.value.trim() || null,
            isActive: DOMElements.isActiveInput.checked,
        };

        try {
            if (state.editingLocation) {
                await apiRequest('PUT', `/locations/${state.editingLocation.id}`, formData);
                showNotification('Location updated successfully!', 'success');
            } else {
                await apiRequest('POST', '/locations', formData);
                showNotification('Location added successfully!', 'success');
            }
            resetForm();
            fetchLocations();
        } catch (error) {
            const errorMsg = error.response?.data?.message || error.message || 'Unknown server error';
            showNotification(`Failed to save location: ${errorMsg}`, 'error');
        } finally {
            setLoadingState(false);
        }
    };

    // --- EMBED CODE GENERATION & PREVIEW ---
    const generateEmbedCode = () => {
        const lat = DOMElements.latitudeInput.value.trim();
        const lng = DOMElements.longitudeInput.value.trim();
        const address = DOMElements.addressInput.value.trim();
        let qParam;

        if (lat && lng && !isNaN(parseFloat(lat)) && !isNaN(parseFloat(lng))) {
            qParam = `${lat},${lng}`;
        } else if (address) {
            qParam = encodeURIComponent(address);
        } else {
            showNotification('Please provide an address or valid coordinates to generate an embed code.', 'warning');
            return;
        }
        // Basic Google Maps Embed URL structure
        const embedUrl = `https://www.google.com/maps/embed/v1/place?key=YOUR_GOOGLE_MAPS_API_KEY_HERE&q=${qParam}&zoom=15`;
        const iframeCode = `<iframe width="600" height="450" style="border:0;" loading="lazy" allowfullscreen referrerpolicy="no-referrer-when-downgrade" src="${embedUrl}"></iframe>`;
        
        DOMElements.mapEmbedInput.value = iframeCode;
        showNotification('Embed code generated. Remember to replace YOUR_GOOGLE_MAPS_API_KEY_HERE with your actual API key if needed for full functionality, or ensure your key allows embedding without it for basic place display.', 'info');
        previewMapEmbed();
    };
    
    const previewMapEmbed = () => {
        const embedCode = DOMElements.mapEmbedInput.value.trim();
        if (embedCode) {
            if (embedCode.toLowerCase().startsWith('<iframe') && embedCode.toLowerCase().endsWith('</iframe>')) {
                DOMElements.mapEmbedPreviewContainer.innerHTML = embedCode;
                const iframe = DOMElements.mapEmbedPreviewContainer.querySelector('iframe');
                if (iframe) {
                    iframe.style.width = '100%';
                    iframe.style.height = '400px'; // Fixed height for preview
                }
                DOMElements.mapEmbedPreviewCard.style.display = 'block';
            } else {
                DOMElements.mapEmbedPreviewContainer.innerHTML = '<p class="text-danger">Invalid iframe embed code.</p>';
                DOMElements.mapEmbedPreviewCard.style.display = 'block';
            }
        } else {
            DOMElements.mapEmbedPreviewCard.style.display = 'none';
            DOMElements.mapEmbedPreviewContainer.innerHTML = '';
        }
    };

    // --- DATA FETCHING & RENDERING ---
    const fetchLocations = async () => {
        setLoadingState(true);
        try {
            const locationsData = await apiRequest('GET', '/locations');
            state.locations = locationsData || [];
            applyFiltersAndSort(); // This will also trigger render
        } catch (error) {
            showNotification(`Failed to load locations: ${error.message || 'Unknown error'}`, 'error');
            state.locations = [];
            state.filteredLocations = [];
            renderTable(); // Render empty or error state
        } finally {
            setLoadingState(false);
        }
    };

    const applyFiltersAndSort = () => {
        let items = [...state.locations];

        // Filter by search term
        if (state.searchTerm) {
            const term = state.searchTerm.toLowerCase();
            items = items.filter(loc =>
                loc.name.toLowerCase().includes(term) ||
                loc.address.toLowerCase().includes(term) ||
                (loc.phone && loc.phone.toLowerCase().includes(term))
            );
        }

        // Sort
        items.sort((a, b) => {
            let valA = a[state.sortColumn] || '';
            let valB = b[state.sortColumn] || '';
            if (typeof valA === 'string') valA = valA.toLowerCase();
            if (typeof valB === 'string') valB = valB.toLowerCase();
            if (state.sortColumn === 'isActive') { // Boolean sort
                valA = a.isActive ? 1 : 0;
                valB = b.isActive ? 1 : 0;
            }


            if (valA < valB) return state.sortDirection === 'asc' ? -1 : 1;
            if (valA > valB) return state.sortDirection === 'asc' ? 1 : -1;
            return 0;
        });

        state.filteredLocations = items;
        state.currentPage = 1; // Reset to first page after filter/sort
        renderTable();
        renderPagination();
    };
    
    const renderTable = () => {
        DOMElements.tableContainer.innerHTML = ''; // Clear previous table
        if (state.isLoading && state.filteredLocations.length === 0) { // Show loading only if table is truly empty
            DOMElements.tableContainer.innerHTML = '<p class="text-center">Loading locations...</p>';
            DOMElements.noLocationsMessage.style.display = 'none';
            return;
        }

        if (state.filteredLocations.length === 0 && !state.searchTerm) {
            DOMElements.noLocationsMessage.style.display = 'block';
            DOMElements.paginationControls.style.display = 'none';
            return;
        }
        if (state.filteredLocations.length === 0 && state.searchTerm) {
             DOMElements.tableContainer.innerHTML = `<p class="text-center">No locations match your search for "${escapeHtml(state.searchTerm)}".</p>`;
             DOMElements.noLocationsMessage.style.display = 'none';
             DOMElements.paginationControls.style.display = 'none';
             return;
        }

        DOMElements.noLocationsMessage.style.display = 'none';

        const table = document.createElement('table');
        table.className = 'table table-striped table-hover table-sm'; // Added table-sm for compactness
        
        // Table Header
        const thead = table.createTHead();
        const headerRow = thead.insertRow();
        const headers = [
            { key: 'name', text: 'Name' }, { key: 'address', text: 'Address' },
            { key: 'hours', text: 'Hours' }, { key: 'phone', text: 'Phone' },
            { key: 'isActive', text: 'Active' }, { key: 'actions', text: 'Actions', sortable: false }
        ];
        headers.forEach(header => {
            const th = document.createElement('th');
            th.textContent = header.text;
            if (header.sortable !== false) {
                th.style.cursor = 'pointer';
                th.addEventListener('click', () => handleSort(header.key));
                if (state.sortColumn === header.key) {
                    th.innerHTML += state.sortDirection === 'asc' ? ' <i class="fas fa-sort-up"></i>' : ' <i class="fas fa-sort-down"></i>';
                } else {
                    th.innerHTML += ' <i class="fas fa-sort text-muted"></i>';
                }
            }
            headerRow.appendChild(th);
        });

        // Table Body - Paginated
        const tbody = table.createTBody();
        const startIndex = (state.currentPage - 1) * state.itemsPerPage;
        const endIndex = startIndex + state.itemsPerPage;
        const paginatedItems = state.filteredLocations.slice(startIndex, endIndex);

        paginatedItems.forEach(location => {
            const row = tbody.insertRow();
            row.innerHTML = `
                <td>${escapeHtml(location.name)}</td>
                <td>${escapeHtml(location.address)}</td>
                <td>${escapeHtml(location.hours || '').replace(/\n/g, '<br>')}</td>
                <td>${escapeHtml(location.phone || 'N/A')}</td>
                <td><span class="badge bg-${location.isActive ? 'success' : 'secondary'}">${location.isActive ? 'Active' : 'Inactive'}</span></td>
                <td>
                    <button class="btn btn-xs btn-outline-primary edit-location-btn me-1" data-id="${location.id}" title="Edit"><i class="fas fa-edit"></i></button>
                    <button class="btn btn-xs btn-outline-danger delete-location-btn" data-id="${location.id}" title="Delete"><i class="fas fa-trash-alt"></i></button>
                </td>
            `;
        });
        DOMElements.tableContainer.appendChild(table);

        // Re-attach event listeners for dynamic buttons
        DOMElements.tableContainer.querySelectorAll('.edit-location-btn').forEach(btn => btn.addEventListener('click', (e) => {
            const id = e.currentTarget.dataset.id;
            const locToEdit = state.locations.find(l => l.id.toString() === id);
            if (locToEdit) populateForm(locToEdit);
        }));
        DOMElements.tableContainer.querySelectorAll('.delete-location-btn').forEach(btn => btn.addEventListener('click', (e) => handleDelete(e.currentTarget.dataset.id)));
    };

    const renderPagination = () => {
        const ul = DOMElements.paginationControls.querySelector('ul');
        if (!ul) return;
        ul.innerHTML = '';
        const totalPages = Math.ceil(state.filteredLocations.length / state.itemsPerPage);

        if (totalPages <= 1) {
            DOMElements.paginationControls.style.display = 'none';
            return;
        }
        DOMElements.paginationControls.style.display = 'block';

        // Previous Button
        const prevLi = document.createElement('li');
        prevLi.className = `page-item ${state.currentPage === 1 ? 'disabled' : ''}`;
        prevLi.innerHTML = `<a class="page-link" href="#" data-page="${state.currentPage - 1}">Previous</a>`;
        ul.appendChild(prevLi);

        // Page Numbers
        for (let i = 1; i <= totalPages; i++) {
            const pageLi = document.createElement('li');
            pageLi.className = `page-item ${state.currentPage === i ? 'active' : ''}`;
            pageLi.innerHTML = `<a class="page-link" href="#" data-page="${i}">${i}</a>`;
            ul.appendChild(pageLi);
        }

        // Next Button
        const nextLi = document.createElement('li');
        nextLi.className = `page-item ${state.currentPage === totalPages ? 'disabled' : ''}`;
        nextLi.innerHTML = `<a class="page-link" href="#" data-page="${state.currentPage + 1}">Next</a>`;
        ul.appendChild(nextLi);

        ul.querySelectorAll('a.page-link').forEach(a => a.addEventListener('click', (e) => {
            e.preventDefault();
            const page = parseInt(e.target.dataset.page);
            if (page >= 1 && page <= totalPages) {
                state.currentPage = page;
                renderTable(); // Re-render only the table body for current page
                renderPagination(); // Re-render pagination to update active state
            }
        }));
    };

    const handleSort = (columnKey) => {
        if (state.sortColumn === columnKey) {
            state.sortDirection = state.sortDirection === 'asc' ? 'desc' : 'asc';
        } else {
            state.sortColumn = columnKey;
            state.sortDirection = 'asc';
        }
        applyFiltersAndSort();
    };

    const handleSearch = (event) => {
        state.searchTerm = event.target.value;
        // Debounce search for better performance on large datasets if needed
        applyFiltersAndSort();
    };
    
    const handleDelete = async (id) => {
        const locationToDelete = state.locations.find(l => l.id.toString() === id);
        if (!locationToDelete) return;

        const confirmDelete = window.adminApp && typeof window.adminApp.confirm === 'function'
            ? await window.adminApp.confirm(`Are you sure you want to delete "${escapeHtml(locationToDelete.name)}"? This action cannot be undone.`)
            : confirm(`Are you sure you want to delete "${escapeHtml(locationToDelete.name)}"? This action cannot be undone.`);

        if (confirmDelete) {
            setLoadingState(true);
            try {
                await apiRequest('DELETE', `/locations/${id}`);
                showNotification(`Location "${escapeHtml(locationToDelete.name)}" deleted successfully!`, 'success');
                if (state.editingLocation && state.editingLocation.id.toString() === id) {
                    resetForm();
                }
                fetchLocations(); // Refresh the list
            } catch (error) {
                showNotification(`Failed to delete location: ${error.message || 'Unknown error'}`, 'error');
            } finally {
                setLoadingState(false);
            }
        }
    };

    // --- EVENT LISTENERS ---
    DOMElements.form.addEventListener('submit', handleFormSubmit);
    DOMElements.cancelBtn.addEventListener('click', resetForm);
    DOMElements.searchInput.addEventListener('input', handleSearch);
    DOMElements.generateEmbedBtn.addEventListener('click', generateEmbedCode);
    DOMElements.previewEmbedBtn.addEventListener('click', previewMapEmbed);
    if (DOMElements.addressToMapBtn) DOMElements.addressToMapBtn.addEventListener('click', findAddressOnMap);

    // Add live validation listeners
    [DOMElements.nameInput, DOMElements.addressInput, DOMElements.latitudeInput, DOMElements.longitudeInput].forEach(input => {
        input.addEventListener('blur', () => validateField(input));
        input.addEventListener('input', () => { // Remove error as user types
            if (input.classList.contains('is-invalid')) {
                input.classList.remove('is-invalid');
                const feedbackElement = input.nextElementSibling;
                if (feedbackElement && feedbackElement.classList.contains('invalid-feedback')) {
                    // feedbackElement.textContent = ''; // Or keep message but remove class
                }
            }
        });
    });

    // --- INITIALIZATION ---
    const initializePage = () => {
        initInteractiveMap(); // Initialize Leaflet map
        fetchLocations();     // Fetch initial data
        resetForm();          // Ensure form is in a clean state
    };

    initializePage();
});