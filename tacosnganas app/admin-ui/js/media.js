/**
 * TACOnganas Admin Panel - Advanced Media Manager
 *
 * Features:
 * - File uploads with progress, type, and size validation.
 * - Gallery display with thumbnails, search, filtering, and pagination.
 * - Image cropping using Cropper.js.
 * - Asset deletion with warnings.
 * - Integration point for GrapesJS Asset Manager.
 * - Client-side state management for media items.
 */

// Ensure adminApp is available
if (typeof window.adminApp === 'undefined') {
    console.error('FATAL ERROR: adminApp global object not found. Media Manager cannot function.');
    document.addEventListener('DOMContentLoaded', () => {
        const notificationsDiv = document.getElementById('mediaNotifications'); // Assumed HTML element
        if (notificationsDiv) {
            notificationsDiv.innerHTML = `<div class="alert alert-danger" role="alert">Critical Error: Application core (adminApp) not loaded. Media Manager functionality is disabled.</div>`;
        }
    });
}

document.addEventListener('DOMContentLoaded', () => {
    // DOM Element Selectors
    const DOMElements = {
        // Notifications
        notificationsArea: document.getElementById('mediaNotifications'),
        // Upload Area
        uploadForm: document.getElementById('mediaUploadForm'),
        fileInput: document.getElementById('mediaFileInput'),
        uploadBtn: document.getElementById('mediaUploadBtn'), // Optional, if not auto-uploading on select
        uploadProgressArea: document.getElementById('uploadProgressArea'),
        // Gallery Area
        galleryContainer: document.getElementById('mediaGalleryContainer'),
        searchInput: document.getElementById('mediaSearchInput'),
        filterTypeSelect: document.getElementById('mediaFilterType'), // Select for 'all', 'image', 'video', 'document'
        noMediaMessage: document.getElementById('noMediaMessage'),
        // Pagination
        paginationControls: document.getElementById('mediaPaginationControls'),
        // Image Detail Modal (Optional, for viewing larger image and more details)
        imageDetailModal: document.getElementById('imageDetailModal'),
        imageDetailImg: document.getElementById('imageDetailImg'),
        imageDetailFilename: document.getElementById('imageDetailFilename'),
        imageDetailDimensions: document.getElementById('imageDetailDimensions'),
        imageDetailSize: document.getElementById('imageDetailSize'),
        imageDetailUrl: document.getElementById('imageDetailUrlInput'), // Input to copy URL
        // Cropper Modal
        cropperModal: document.getElementById('cropperModal'),
        cropperImage: document.getElementById('cropperImageElement'), // The <img> tag inside the modal for Cropper
        cropSaveBtn: document.getElementById('cropSaveBtn'),
        cropCancelBtn: document.getElementById('cropCancelBtn'),
        // For GrapesJS integration
        mediaManagerModal: document.getElementById('mediaManagerModal'), // The main modal for the media manager if used with GrapesJS
        selectAssetBtn: document.getElementById('selectAssetForEditorBtn'), // Button within the media manager modal
    };

    // Check if essential elements are present
    if (!DOMElements.galleryContainer || !DOMElements.fileInput) {
        // console.log("Media Manager elements not found on this page. Skipping advanced init.");
        return;
    }

    // Application State
    const mediaState = {
        assets: [], // Full list of assets from API
        filteredAssets: [],
        isLoading: false,
        currentPage: 1,
        itemsPerPage: 12, // e.g., 3x4 grid
        sortCriteria: { column: 'uploadDate', direction: 'desc' }, // Or 'name', 'size', 'type'
        searchTerm: '',
        filterType: 'all',
        cropperInstance: null,
        currentCroppingAsset: null, // Asset being cropped
        grapesJSCallback: null, // Callback for GrapesJS asset selection
        grapesJSAssetType: null, // 'image', 'video', etc. requested by GrapesJS
    };

    // --- UTILITY FUNCTIONS ---
    const showNotification = (message, type = 'info') => {
        if (window.adminApp && typeof window.adminApp.showNotification === 'function') {
            window.adminApp.showNotification(message, type, 'mediaNotifications');
        } else { /* Fallback */ }
    };

    const apiRequest = async (method, endpoint, body = null, isFormData = false) => {
        if (window.adminApp && typeof window.adminApp.apiRequest === 'function') {
            return window.adminApp.apiRequest(method, endpoint, body, isFormData); // Assume apiRequest can handle FormData
        }
        showNotification('API request function is not available.', 'error');
        throw new Error('API request function is not available.');
    };
    
    const confirmDialog = async (message) => {
        if (window.adminApp && typeof window.adminApp.confirm === 'function') {
            return window.adminApp.confirm(message);
        }
        return window.confirm(message);
    };

    const escapeHtml = (str) => String(str || '').replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'})[m]);
    const formatFileSize = (bytes) => {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    };

    // --- FILE UPLOAD LOGIC ---
    const handleFileUpload = async (files) => {
        if (!files || files.length === 0) return;
        DOMElements.uploadProgressArea.innerHTML = ''; // Clear previous progress bars

        const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB example, configure as needed
        const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'video/mp4', 'application/pdf']; // Example

        for (const file of files) {
            if (file.size > MAX_FILE_SIZE) {
                showNotification(`File "${escapeHtml(file.name)}" is too large (max ${formatFileSize(MAX_FILE_SIZE)}).`, 'warning');
                continue;
            }
            if (!ALLOWED_TYPES.includes(file.type)) {
                showNotification(`File type for "${escapeHtml(file.name)}" is not allowed.`, 'warning');
                continue;
            }

            const formData = new FormData();
            formData.append('mediaFile', file); // 'mediaFile' should match backend (Multer fieldname)

            const progressId = `progress-${Date.now()}-${Math.random().toString(36).substring(2,7)}`;
            const progressElement = document.createElement('div');
            progressElement.className = 'mb-2';
            progressElement.innerHTML = `
                <div class="fw-bold small">${escapeHtml(file.name)} (${formatFileSize(file.size)})</div>
                <div class="progress" id="${progressId}">
                    <div class="progress-bar progress-bar-striped progress-bar-animated" role="progressbar" style="width: 0%" aria-valuenow="0" aria-valuemin="0" aria-valuemax="100">0%</div>
                </div>
            `;
            DOMElements.uploadProgressArea.appendChild(progressElement);

            try {
                // Assuming adminApp.apiRequest can handle XHR for progress or uses fetch with ReadableStream
                // For simplicity, if apiRequest doesn't support progress, this will just be a normal upload.
                // A more robust solution would use XHR directly here for progress.
                // Let's simulate progress if apiRequest is a simple fetch wrapper.
                
                // If your adminApp.apiRequest is a simple fetch wrapper, you'd need to implement XHR here for progress.
                // Example using XHR for progress:
                await uploadWithXHR(formData, progressId);
                showNotification(`File "${escapeHtml(file.name)}" uploaded successfully!`, 'success');
                fetchMediaAssets(); // Refresh gallery
            } catch (error) {
                document.getElementById(progressId)?.querySelector('.progress-bar')?.classList.add('bg-danger');
                document.getElementById(progressId)?.querySelector('.progress-bar')?.textContent = 'Upload Failed';
                showNotification(`Upload failed for "${escapeHtml(file.name)}": ${error.message || 'Unknown error'}`, 'error');
            }
        }
        DOMElements.fileInput.value = ''; // Reset file input
    };

    const uploadWithXHR = (formData, progressId) => {
        return new Promise((resolve, reject) => {
            const xhr = new XMLHttpRequest();
            xhr.open('POST', `${window.adminApp.API_BASE_URL}/media/upload`, true); // Adjust endpoint
            // xhr.setRequestHeader('Authorization', `Bearer ${adminApp.getToken()}`); // If using JWT

            xhr.upload.onprogress = (event) => {
                if (event.lengthComputable) {
                    const percentComplete = Math.round((event.loaded / event.total) * 100);
                    const progressBar = document.getElementById(progressId)?.querySelector('.progress-bar');
                    if (progressBar) {
                        progressBar.style.width = percentComplete + '%';
                        progressBar.textContent = percentComplete + '%';
                        progressBar.setAttribute('aria-valuenow', percentComplete);
                    }
                }
            };

            xhr.onload = () => {
                if (xhr.status >= 200 && xhr.status < 300) {
                    resolve(JSON.parse(xhr.responseText));
                } else {
                    let errorMsg = 'Upload failed.';
                    try {
                        const errResp = JSON.parse(xhr.responseText);
                        errorMsg = errResp.message || errorMsg;
                    } catch (e) {/* ignore */}
                    reject(new Error(errorMsg + ` (Status: ${xhr.status})`));
                }
            };
            xhr.onerror = () => reject(new Error('Network error during upload.'));
            xhr.send(formData);
        });
    };


    // --- MEDIA RENDERING ---
    const fetchMediaAssets = async () => {
        mediaState.isLoading = true;
        renderGallery(); // Show loading state
        try {
            const assets = await apiRequest('GET', '/media/list');
            mediaState.assets = assets || [];
            applyFiltersAndSort(); // This will also trigger render
        } catch (error) {
            showNotification(`Failed to load media assets: ${error.message || 'Unknown error'}`, 'error');
            mediaState.assets = [];
            mediaState.filteredAssets = [];
            renderGallery();
        } finally {
            mediaState.isLoading = false;
        }
    };

    const applyFiltersAndSort = () => {
        let items = [...mediaState.assets];
        // Filter by search term
        if (mediaState.searchTerm) {
            const term = mediaState.searchTerm.toLowerCase();
            items = items.filter(asset => asset.filename.toLowerCase().includes(term) || (asset.tags && asset.tags.join(' ').toLowerCase().includes(term)));
        }
        // Filter by type
        if (mediaState.filterType !== 'all') {
            items = items.filter(asset => asset.mimetype && asset.mimetype.startsWith(mediaState.filterType)); // e.g., 'image/'
        }
        // Sort (implement more sort options if needed)
        items.sort((a, b) => {
            if (mediaState.sortCriteria.column === 'uploadDate') {
                return mediaState.sortCriteria.direction === 'desc'
                    ? new Date(b.uploadDate) - new Date(a.uploadDate)
                    : new Date(a.uploadDate) - new Date(b.uploadDate);
            }
            // Add other sort criteria like name, size
            return 0;
        });
        mediaState.filteredAssets = items;
        mediaState.currentPage = 1;
        renderGallery();
        renderPagination();
    };

    const renderGallery = () => {
        DOMElements.galleryContainer.innerHTML = '';
        if (mediaState.isLoading && mediaState.filteredAssets.length === 0) {
            DOMElements.galleryContainer.innerHTML = '<div class="text-center p-5"><div class="spinner-border text-primary" role="status"><span class="visually-hidden">Loading...</span></div><p>Loading media...</p></div>';
            DOMElements.noMediaMessage.style.display = 'none';
            return;
        }
        if (mediaState.filteredAssets.length === 0) {
            DOMElements.noMediaMessage.style.display = 'block';
            DOMElements.noMediaMessage.textContent = mediaState.searchTerm || mediaState.filterType !== 'all' ? 'No media found matching your criteria.' : 'No media assets uploaded yet.';
            return;
        }
        DOMElements.noMediaMessage.style.display = 'none';

        const startIndex = (mediaState.currentPage - 1) * mediaState.itemsPerPage;
        const endIndex = startIndex + mediaState.itemsPerPage;
        const paginatedAssets = mediaState.filteredAssets.slice(startIndex, endIndex);

        paginatedAssets.forEach(asset => {
            const assetCard = document.createElement('div');
            assetCard.className = 'col'; // Bootstrap grid column
            assetCard.innerHTML = `
                <div class="card h-100 media-asset-card ${mediaState.grapesJSCallback ? 'selectable-asset' : ''}" data-asset-id="${asset.id || asset.filename}">
                    ${asset.mimetype && asset.mimetype.startsWith('image/') ? `
                        <img src="${asset.url}" class="card-img-top media-thumbnail" alt="${escapeHtml(asset.filename)}" loading="lazy">
                    ` : `
                        <div class="card-img-top media-thumbnail-placeholder d-flex align-items-center justify-content-center bg-light">
                            <i class="fas ${getIconForMimeType(asset.mimetype)} fa-3x text-secondary"></i>
                        </div>
                    `}
                    <div class="card-body p-2">
                        <p class="card-title small text-truncate mb-1" title="${escapeHtml(asset.filename)}">${escapeHtml(asset.filename)}</p>
                        <p class="card-text x-small text-muted mb-1">${formatFileSize(asset.size)}</p>
                    </div>
                    <div class="card-footer p-1 bg-light d-flex justify-content-evenly">
                        ${mediaState.grapesJSCallback ? `
                            <button class="btn btn-xs btn-success select-for-editor-btn" title="Select for Editor"><i class="fas fa-check-circle"></i></button>
                        ` : `
                            ${asset.mimetype && asset.mimetype.startsWith('image/') ? `<button class="btn btn-xs btn-outline-primary crop-btn" title="Crop Image"><i class="fas fa-crop-alt"></i></button>` : ''}
                            <button class="btn btn-xs btn-outline-info view-btn" title="View Details"><i class="fas fa-eye"></i></button>
                            <button class="btn btn-xs btn-outline-danger delete-btn" title="Delete Asset"><i class="fas fa-trash-alt"></i></button>
                        `}
                    </div>
                </div>
            `;
            DOMElements.galleryContainer.appendChild(assetCard);

            // Event listeners for card buttons
            if (mediaState.grapesJSCallback) {
                assetCard.querySelector('.select-for-editor-btn')?.addEventListener('click', () => handleSelectForEditor(asset));
                assetCard.addEventListener('click', () => handleSelectForEditor(asset)); // Click anywhere on card
            } else {
                assetCard.querySelector('.crop-btn')?.addEventListener('click', () => openCropper(asset));
                assetCard.querySelector('.view-btn')?.addEventListener('click', () => openDetailModal(asset));
                assetCard.querySelector('.delete-btn')?.addEventListener('click', () => handleDeleteAsset(asset));
            }
        });
    };
    
    const getIconForMimeType = (mimeType) => {
        if (!mimeType) return 'fa-file';
        if (mimeType.startsWith('image/')) return 'fa-file-image';
        if (mimeType.startsWith('video/')) return 'fa-file-video';
        if (mimeType.startsWith('audio/')) return 'fa-file-audio';
        if (mimeType === 'application/pdf') return 'fa-file-pdf';
        if (mimeType === 'application/msword' || mimeType.includes('wordprocessingml')) return 'fa-file-word';
        if (mimeType === 'application/vnd.ms-excel' || mimeType.includes('spreadsheetml')) return 'fa-file-excel';
        return 'fa-file-alt';
    };

    const renderPagination = () => { /* Similar to locations.js pagination, adapt for mediaState */ }; // Placeholder - implement as in locations.js

    // --- SEARCH & FILTER ---
    DOMElements.searchInput?.addEventListener('input', (e) => {
        mediaState.searchTerm = e.target.value;
        applyFiltersAndSort();
    });
    DOMElements.filterTypeSelect?.addEventListener('change', (e) => {
        mediaState.filterType = e.target.value;
        applyFiltersAndSort();
    });

    // --- IMAGE CROPPING (Cropper.js) ---
    const openCropper = (asset) => {
        if (!asset || !asset.mimetype || !asset.mimetype.startsWith('image/')) {
            showNotification('Cropping is only available for images.', 'warning');
            return;
        }
        mediaState.currentCroppingAsset = asset;
        DOMElements.cropperImage.src = asset.url; // Use a version that avoids browser caching if needed

        // Ensure modal is shown before initializing cropper
        const cropperModalInstance = new bootstrap.Modal(DOMElements.cropperModal); // Assuming Bootstrap 5
        DOMElements.cropperModal.addEventListener('shown.bs.modal', () => {
            if (mediaState.cropperInstance) {
                mediaState.cropperInstance.destroy();
            }
            mediaState.cropperInstance = new Cropper(DOMElements.cropperImage, {
                aspectRatio: NaN, // Free aspect ratio, or set one e.g. 16/9
                viewMode: 1,      // Restrict crop box to canvas
                dragMode: 'move',
                background: true,
                responsive: true,
                checkOrientation: false, // Handle EXIF orientation on backend if needed
            });
        }, { once: true });
        cropperModalInstance.show();
    };

    DOMElements.cropSaveBtn?.addEventListener('click', async () => {
        if (!mediaState.cropperInstance || !mediaState.currentCroppingAsset) return;
        const croppedCanvas = mediaState.cropperInstance.getCroppedCanvas({
            // Options for output, e.g., width, height, imageSmoothingEnabled
            // imageSmoothingQuality: 'high',
        });
        if (!croppedCanvas) {
            showNotification('Could not get cropped image data.', 'error');
            return;
        }

        croppedCanvas.toBlob(async (blob) => {
            if (!blob) {
                showNotification('Failed to create blob from cropped image.', 'error');
                return;
            }
            const formData = new FormData();
            formData.append('croppedImage', blob, `cropped_${mediaState.currentCroppingAsset.filename}`);
            formData.append('originalAssetId', mediaState.currentCroppingAsset.id || mediaState.currentCroppingAsset.filename);
            // You might want to send crop coordinates as well: formData.append('cropData', JSON.stringify(mediaState.cropperInstance.getData()));

            DOMElements.cropSaveBtn.disabled = true;
            DOMElements.cropSaveBtn.innerHTML = `<span class="spinner-border spinner-border-sm"></span> Saving...`;
            try {
                await apiRequest('POST', '/media/crop', formData, true); // true for FormData
                showNotification('Image cropped and saved successfully!', 'success');
                fetchMediaAssets(); // Refresh gallery
                const cropperModalInstance = bootstrap.Modal.getInstance(DOMElements.cropperModal);
                cropperModalInstance?.hide();
            } catch (error) {
                showNotification(`Failed to save cropped image: ${error.message || 'Unknown error'}`, 'error');
            } finally {
                DOMElements.cropSaveBtn.disabled = false;
                DOMElements.cropSaveBtn.innerHTML = 'Save Crop';
            }
        }, mediaState.currentCroppingAsset.mimetype); // Maintain original mimetype
    });
    
    DOMElements.cropperModal?.addEventListener('hidden.bs.modal', () => {
        if (mediaState.cropperInstance) {
            mediaState.cropperInstance.destroy();
            mediaState.cropperInstance = null;
        }
        DOMElements.cropperImage.src = '#'; // Clear image to free memory
        mediaState.currentCroppingAsset = null;
    });


    // --- ASSET DELETION ---
    const handleDeleteAsset = async (asset) => {
        const confirmed = await confirmDialog(`Are you sure you want to delete "${escapeHtml(asset.filename)}"? This might break pages if the asset is in use. This action cannot be undone.`);
        if (confirmed) {
            try {
                // The backend should handle actual file deletion and DB record removal
                await apiRequest('DELETE', `/media/${asset.id || encodeURIComponent(asset.filename)}`);
                showNotification(`Asset "${escapeHtml(asset.filename)}" deleted successfully.`, 'success');
                fetchMediaAssets(); // Refresh
            } catch (error) {
                showNotification(`Failed to delete asset: ${error.message || 'Unknown error'}`, 'error');
            }
        }
    };

    // --- IMAGE DETAIL MODAL ---
    const openDetailModal = (asset) => {
        DOMElements.imageDetailImg.src = asset.url;
        DOMElements.imageDetailFilename.textContent = asset.filename;
        DOMElements.imageDetailDimensions.textContent = asset.width && asset.height ? `${asset.width} x ${asset.height}px` : 'N/A';
        DOMElements.imageDetailSize.textContent = formatFileSize(asset.size);
        DOMElements.imageDetailUrl.value = asset.url;
        const detailModalInstance = new bootstrap.Modal(DOMElements.imageDetailModal);
        detailModalInstance.show();
    };
    DOMElements.imageDetailUrl?.addEventListener('click', (e) => { // Select all text on click
        e.target.select();
        try {
            document.execCommand('copy');
            showNotification('URL copied to clipboard!', 'info');
        } catch (err) {
            showNotification('Failed to copy URL automatically. Please copy manually.', 'warning');
        }
    });


    // --- GRAPESJS INTEGRATION ---
    /**
     * This function is intended to be called by GrapesJS's Asset Manager.
     * It opens the media manager UI (likely in a modal) and sets up a callback.
     * @param {Function} callback - GrapesJS callback function to receive the selected asset.
     * @param {string} assetType - Type of asset requested (e.g., 'image').
     */
    const openForGrapesJS = (callback, assetType = 'image') => {
        mediaState.grapesJSCallback = callback;
        mediaState.grapesJSAssetType = assetType; // Store requested type to filter if needed

        // Show the media manager (e.g., as a modal)
        // This assumes DOMElements.mediaManagerModal is your main media manager container/modal
        const managerModalInstance = new bootstrap.Modal(DOMElements.mediaManagerModal);
        managerModalInstance.show();
        
        // Refresh assets and highlight selectable items
        fetchMediaAssets().then(() => {
            // The renderGallery function will add 'selectable-asset' class and different buttons
            // if mediaState.grapesJSCallback is set.
        });
        
        // You might want a dedicated "Select" button in the modal footer
        // that becomes active when an asset is chosen in the gallery.
        // For now, clicking an asset card directly calls handleSelectForEditor.
    };
    
    // Register with adminApp if it has a placeholder for this
    if (window.adminApp) {
        window.adminApp.openMediaManagerForGrapesJS = openForGrapesJS;
    }

    const handleSelectForEditor = (asset) => {
        if (mediaState.grapesJSCallback) {
            const assetDetails = {
                type: asset.mimetype && asset.mimetype.startsWith('image/') ? 'image' : (asset.mimetype && asset.mimetype.startsWith('video/') ? 'video' : 'file'),
                src: asset.url,
                height: asset.height || undefined, // GrapesJS might use these
                width: asset.width || undefined,
                name: asset.filename,
            };
            mediaState.grapesJSCallback(assetDetails);
            
            // Close the media manager modal
            const managerModalInstance = bootstrap.Modal.getInstance(DOMElements.mediaManagerModal);
            managerModalInstance?.hide();

            // Reset state
            mediaState.grapesJSCallback = null;
            mediaState.grapesJSAssetType = null;
            fetchMediaAssets(); // Re-render gallery in normal mode
        }
    };
    
    DOMElements.mediaManagerModal?.addEventListener('hidden.bs.modal', () => {
        // If modal is closed without selection, ensure GrapesJS callback is cleared
        if (mediaState.grapesJSCallback) {
            mediaState.grapesJSCallback(null); // Signal no selection or handle as needed
            mediaState.grapesJSCallback = null;
            mediaState.grapesJSAssetType = null;
            fetchMediaAssets(); // Re-render gallery in normal mode
        }
    });


    // --- INITIALIZATION ---
    const initializeMediaManager = () => {
        if (DOMElements.uploadForm) {
            DOMElements.uploadForm.addEventListener('submit', (e) => e.preventDefault()); // We handle upload via JS
        }
        DOMElements.fileInput?.addEventListener('change', (e) => handleFileUpload(e.target.files));
        // Optional: drag and drop upload
        // setupDragAndDropUpload();

        fetchMediaAssets();
    };

    initializeMediaManager();
});