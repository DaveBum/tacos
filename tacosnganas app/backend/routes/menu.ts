import { Router } from 'express';
import { getDb } from '../db/index';

const router = Router();

/**
 * TACOnganas Admin Panel - Advanced Navigation Menu Management (Enhanced Version)
 *
 * Enhancements:
 * - Accessibility improvements (ARIA attributes, focus management).
 * - Configuration for max nesting depth.
 * - Constants for strings.
 * - Refined user feedback and error handling.
 */

// Ensure adminApp and Sortable are available
if (typeof window.adminApp === 'undefined' || typeof window.adminApp.apiRequest !== 'function') {
    console.error('FATAL ERROR: adminApp global object or its methods are not found. Menu management cannot function.');
    document.addEventListener('DOMContentLoaded', () => {
        const notificationsDiv = document.getElementById('menuNotifications');
        if (notificationsDiv) {
            notificationsDiv.innerHTML = `<div class="alert alert-danger" role="alert">Critical Error: Application core (adminApp) not loaded. Menu Management is disabled.</div>`;
            notificationsDiv.setAttribute('aria-live', 'assertive');
        }
    });
    throw new Error("adminApp not available for Menu Management.");
}

if (typeof Sortable === 'undefined') {
    console.error('FATAL ERROR: SortableJS library not found. Menu management cannot function.');
    document.addEventListener('DOMContentLoaded', () => {
        const notificationsDiv = document.getElementById('menuNotifications');
        if (notificationsDiv) {
            notificationsDiv.innerHTML = `<div class="alert alert-danger" role="alert">Critical Error: SortableJS library not loaded. Menu Management is disabled.</div>`;
            notificationsDiv.setAttribute('aria-live', 'assertive');
        }
    });
    throw new Error("SortableJS not available for Menu Management.");
}

document.addEventListener('DOMContentLoaded', () => {
    const CONSTANTS = {
        ITEM_CLASS: 'list-group-item',
        SUBMENU_CLASS: 'submenu',
        ROOT_MENU_CLASS: 'root-menu',
        SORTABLE_LIST_CLASS: 'menu-sortable-list',
        ACTIVE_ITEM_CLASS: 'active',
        HIDDEN_ITEM_CLASS: 'menu-item-hidden',
        TEMP_ID_PREFIX: 'temp_',
        ROLE_LIST: 'list',
        ROLE_LISTITEM: 'listitem',
        // Messages (examples, could be moved to a dedicated i18n module)
        MSG_NO_CHANGES: 'No changes to save.',
        MSG_SAVE_SUCCESS: 'Menu structure saved successfully!',
        MSG_SAVE_FAIL: 'Failed to save menu structure. Please check details and try again.',
        MSG_LOAD_FAIL: 'Failed to load menu structure. Please try again later.',
        MSG_ITEM_UPDATED_LOCALLY: 'Item updated locally.',
        MSG_ITEM_ADDED_LOCALLY: 'Item added locally.',
        MSG_ITEM_REMOVED_LOCALLY: 'Item and sub-items removed locally.',
        MSG_ORDER_CHANGED_LOCALLY: 'Menu order/structure changed locally. Save to persist.',
        MSG_MAX_DEPTH_REACHED: 'Maximum nesting depth reached. Cannot move item here.',
    };

    const menuConfig = {
        maxNestingDepth: 3, // 0 for root, 1 for first level children, etc. So 3 allows Root -> Child -> Grandchild
        notificationDuration: 5000,
        debounceSaveDelay: 1000, // For potential future auto-save or debounced manual save
    };

    const DOMElements = {
        notificationsArea: document.getElementById('menuNotifications'),
        menuListContainer: document.getElementById('menuListContainer'),
        noMenuItemsMessage: document.getElementById('noMenuItemsMessage'),
        menuSpinner: document.getElementById('menuSpinner'),
        addNewTopLevelItemBtn: document.getElementById('addNewTopLevelItemBtn'),
        saveMenuStructureBtn: document.getElementById('saveMenuStructureBtn'),
        unsavedChangesIndicator: document.getElementById('unsavedChangesIndicator'),

        itemForm: document.getElementById('menuItemForm'),
        itemFormTitle: document.getElementById('menuItemFormTitle'),
        itemIdInput: document.getElementById('menuItemId'),
        itemParentIdInput: document.getElementById('menuItemParentIdInput'),
        itemLabelInput: document.getElementById('menuItemLabel'),
        itemTypeSelect: document.getElementById('menuItemType'),
        itemPageLinkGroup: document.getElementById('menuItemPageLinkGroup'),
        itemPageIdSelect: document.getElementById('menuItemPageId'),
        itemCustomUrlGroup: document.getElementById('menuItemCustomUrlGroup'),
        itemUrlInput: document.getElementById('menuItemUrl'),
        itemIsVisibleCheckbox: document.getElementById('menuItemIsVisible'),
        itemOpenInNewTabCheckbox: document.getElementById('menuItemOpenInNewTab'),
        itemCssClassesInput: document.getElementById('menuItemCssClasses'),
        saveMenuItemDetailsBtn: document.getElementById('saveMenuItemDetailsBtn'),
        deleteMenuItemBtn: document.getElementById('deleteMenuItemBtn'),
        clearItemFormBtn: document.getElementById('clearItemFormBtn'),
        itemFormPlaceholder: document.getElementById('menuItemFormPlaceholder'),
    };

    // Set ARIA live region for notifications
    if (DOMElements.notificationsArea) {
        DOMElements.notificationsArea.setAttribute('aria-live', 'polite');
    }

    if (!DOMElements.menuListContainer || !DOMElements.itemForm) {
        console.warn("Menu management core DOM elements not found. Skipping initialization.");
        if (DOMElements.notificationsArea) {
             DOMElements.notificationsArea.innerHTML = `<div class="alert alert-warning" role="alert">Menu management UI elements are missing. Functionality may be limited.</div>`;
        }
        return;
    }

    const menuState = {
        menuItems: [],
        originalMenuItems: [],
        sitePages: [],
        selectedItemId: null,
        isLoading: false,
        isDirty: false,
        sortableInstances: [],
    };

    // --- UTILITY FUNCTIONS ---
    const showNotification = (message, type = 'info', duration = menuConfig.notificationDuration) => adminApp.showNotification(message, type, 'menuNotifications', duration);
    const apiRequest = async (method, endpoint, body = null) => {
        try {
            return await adminApp.apiRequest(method, endpoint, body);
        } catch (error) {
            console.error(`API Request Failed: ${method} ${endpoint}`, error);
            const errorMsg = error.message || (error.response ? await error.response.text() : 'Unknown API error');
            showNotification(`API Error: ${errorMsg}`, 'error');
            throw error;
        }
    };
    const escapeHtml = (str) => String(str || '').replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'})[m]);
    const generateId = () => `${CONSTANTS.TEMP_ID_PREFIX}${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

    function setDirty(dirtyState = true) {
        menuState.isDirty = dirtyState;
        if (DOMElements.unsavedChangesIndicator) {
            DOMElements.unsavedChangesIndicator.style.display = dirtyState ? 'inline-block' : 'none';
        }
        DOMElements.saveMenuStructureBtn.disabled = !dirtyState || menuState.isLoading;
    }

    window.addEventListener('beforeunload', (event) => {
        if (menuState.isDirty) {
            event.preventDefault();
            event.returnValue = 'You have unsaved changes. Are you sure you want to leave?';
        }
    });

    // --- DATA FETCHING ---
    async function fetchMenuItems() {
        setLoading(true);
        try {
            const items = await apiRequest('GET', '/menu');
            if (!Array.isArray(items)) throw new Error("Received invalid data format for menu items.");
            menuState.menuItems = items.map(item => ({ ...item, id: item.id || generateId() }));
            menuState.originalMenuItems = JSON.parse(JSON.stringify(menuState.menuItems));
            renderFullMenu();
            setDirty(false);
        } catch (error) {
            showNotification(CONSTANTS.MSG_LOAD_FAIL, 'error');
            DOMElements.noMenuItemsMessage.textContent = 'Could not load menu items. Please check server connection and try refreshing.';
            DOMElements.noMenuItemsMessage.style.display = 'block';
        } finally {
            setLoading(false);
        }
    }

    async function fetchSitePages() {
        try {
            const pages = await apiRequest('GET', '/pages/list');
            menuState.sitePages = Array.isArray(pages) ? pages : [];
            if (!Array.isArray(pages)) console.warn("Received invalid data format for site pages.");
            populatePageSelector();
        } catch (error) {
            showNotification(`Warning: Could not fetch site pages. ${error.message}`, 'warning');
        }
    }

    function populatePageSelector() {
        DOMElements.itemPageIdSelect.innerHTML = '<option value="">-- Select a Page --</option>';
        menuState.sitePages.forEach(page => {
            const option = document.createElement('option');
            option.value = page.id || page.filename;
            option.textContent = `${page.title || page.filename} (${page.filename || page.id})`;
            DOMElements.itemPageIdSelect.appendChild(option);
        });
    }

    // --- RENDERING ---
    /**
     * Renders the entire menu structure in the DOM.
     */
    function renderFullMenu() {
        DOMElements.menuListContainer.innerHTML = '';
        menuState.sortableInstances.forEach(s => s.destroy());
        menuState.sortableInstances = [];

        if (menuState.menuItems.length === 0 && !menuState.isLoading) {
            DOMElements.noMenuItemsMessage.textContent = 'No menu items configured. Click "Add Top-Level Item" to start.';
            DOMElements.noMenuItemsMessage.style.display = 'block';
            return;
        }
        DOMElements.noMenuItemsMessage.style.display = 'none';

        const menuTree = buildTree(menuState.menuItems);
        const rootUl = createMenuLevelDOM(menuTree, 0, true); // Pass current depth
        DOMElements.menuListContainer.appendChild(rootUl);
    }

    /**
     * Recursively builds a tree structure from a flat list of menu items.
     * @param {Array} items - Flat list of menu items.
     * @param {String|null} parentId - The ID of the parent item.
     * @returns {Array} A tree of menu items.
     */
    function buildTree(items, parentId = null) {
        return items
            .filter(item => item.parentId === parentId)
            .sort((a, b) => a.order - b.order)
            .map(item => ({ ...item, children: buildTree(items, item.id) }));
    }

    /**
     * Creates the DOM elements for a level of the menu.
     * @param {Array} items - Array of item objects for the current level.
     * @param {number} depth - Current nesting depth of this level.
     * @param {boolean} isRoot - True if this is the root level.
     * @returns {HTMLUListElement} The UL element for this menu level.
     */
    function createMenuLevelDOM(items, depth, isRoot = false) {
        const ul = document.createElement('ul');
        ul.className = `${CONSTANTS.SORTABLE_LIST_CLASS} ${isRoot ? CONSTANTS.ROOT_MENU_CLASS : CONSTANTS.SUBMENU_CLASS}`;
        ul.setAttribute('role', CONSTANTS.ROLE_LIST);
        if (!isRoot) ul.style.minHeight = '30px';

        items.forEach(item => {
            const li = document.createElement('li');
            li.className = `${CONSTANTS.ITEM_CLASS} d-flex flex-column`;
            li.dataset.id = item.id;
            li.setAttribute('role', CONSTANTS.ROLE_LISTITEM);
            // li.setAttribute('aria-level', depth + 1); // If using treegrid role

            if (!item.isVisible) li.classList.add(CONSTANTS.HIDDEN_ITEM_CLASS);
            if (item.id === menuState.selectedItemId) li.classList.add(CONSTANTS.ACTIVE_ITEM_CLASS, 'border-primary');

            const itemContentDiv = document.createElement('div');
            itemContentDiv.className = 'd-flex justify-content-between align-items-center w-100';
            
            let linkInfo = '';
            if (item.type === 'page') {
                const page = menuState.sitePages.find(p => (p.id || p.filename) === item.pageId);
                linkInfo = page ? ` <small class="text-muted">(${escapeHtml(page.title || item.pageId)})</small>` : ` <small class="text-danger">(Page missing: ${escapeHtml(item.pageId)})</small>`;
            } else if (item.type === 'url') {
                linkInfo = ` <small class="text-muted">(${escapeHtml(item.url)})</small>`;
            } else if (item.type === 'placeholder') {
                linkInfo = ` <small class="text-muted">(Placeholder)</small>`;
            }

            itemContentDiv.innerHTML = `
                <span class="menu-item-label flex-grow-1">
                    <i class="fas fa-grip-vertical me-2 text-muted" title="Drag to reorder/nest" aria-hidden="true"></i>
                    ${escapeHtml(item.label)}${linkInfo}
                    ${item.openInNewTab ? ' <i class="fas fa-external-link-alt fa-xs text-muted" title="Opens in new tab" aria-hidden="true"></i>' : ''}
                    ${item.customCssClasses ? ` <span class="badge bg-secondary fa-xs">${escapeHtml(item.customCssClasses)}</span>` : ''}
                </span>
                <span class="menu-item-actions flex-shrink-0">
                    <button class="btn btn-outline-primary btn-xs edit-item-btn" title="Edit Item" aria-label="Edit ${escapeHtml(item.label)}"><i class="fas fa-pencil-alt" aria-hidden="true"></i></button>
                    <button class="btn btn-outline-success btn-xs add-subitem-btn" title="Add Sub-item" aria-label="Add sub-item to ${escapeHtml(item.label)}"><i class="fas fa-plus-circle" aria-hidden="true"></i></button>
                    <button class="btn btn-outline-danger btn-xs delete-item-btn-quick" title="Delete Item" aria-label="Delete ${escapeHtml(item.label)}"><i class="fas fa-trash-alt" aria-hidden="true"></i></button>
                </span>
            `;
            
            li.appendChild(itemContentDiv);

            itemContentDiv.querySelector('.edit-item-btn').addEventListener('click', (e) => { e.stopPropagation(); loadItemIntoForm(item.id); });
            itemContentDiv.querySelector('.add-subitem-btn').addEventListener('click', (e) => { e.stopPropagation(); prepareFormForNewItem(item.id); });
            itemContentDiv.querySelector('.delete-item-btn-quick').addEventListener('click', (e) => { e.stopPropagation(); handleDeleteItem(item.id); });
            
            ul.appendChild(li);

            if (item.children && item.children.length > 0) {
                const childUl = createMenuLevelDOM(item.children, depth + 1); // Increment depth
                li.appendChild(childUl);
            }
        });

        const sortable = new Sortable(ul, {
            group: 'nested-menu',
            animation: 150,
            fallbackOnBody: true,
            swapThreshold: 0.65,
            handle: '.fa-grip-vertical',
            onEnd: (evt) => handleSortEnd(evt, depth), // Pass current depth to handler
        });
        menuState.sortableInstances.push(sortable);
        return ul;
    }

    function setLoading(isLoading) {
        menuState.isLoading = isLoading;
        DOMElements.menuSpinner.style.display = isLoading ? 'block' : 'none';
        DOMElements.saveMenuStructureBtn.disabled = isLoading || !menuState.isDirty;
        DOMElements.addNewTopLevelItemBtn.disabled = isLoading;
        Array.from(DOMElements.itemForm.elements).forEach(el => el.disabled = isLoading);
    }

    // --- FORM HANDLING ---
    function loadItemIntoForm(itemId) {
        const item = findItemById(menuState.menuItems, itemId);
        if (!item) {
            showNotification('Error: Could not find item to edit.', 'error');
            clearItemForm();
            return;
        }
        clearItemForm(false);
        menuState.selectedItemId = itemId;

        DOMElements.itemFormTitle.textContent = `Edit: ${escapeHtml(item.label)}`;
        DOMElements.itemIdInput.value = item.id;
        DOMElements.itemParentIdInput.value = item.parentId || '';
        DOMElements.itemLabelInput.value = item.label;
        DOMElements.itemTypeSelect.value = item.type || 'page';
        DOMElements.itemPageIdSelect.value = item.pageId || '';
        DOMElements.itemUrlInput.value = item.url || '';
        DOMElements.itemIsVisibleCheckbox.checked = item.isVisible !== false;
        DOMElements.itemOpenInNewTabCheckbox.checked = item.openInNewTab === true;
        DOMElements.itemCssClassesInput.value = item.customCssClasses || '';

        updateFormVisibilityBasedOnType();
        DOMElements.deleteMenuItemBtn.style.display = 'inline-block';
        DOMElements.deleteMenuItemBtn.setAttribute('aria-label', `Delete menu item ${escapeHtml(item.label)}`);
        DOMElements.itemFormPlaceholder.style.display = 'none';
        DOMElements.itemForm.style.display = 'block';
        DOMElements.itemLabelInput.focus();
        renderFullMenu();
    }

    function prepareFormForNewItem(parentId = null) {
        clearItemForm();
        menuState.selectedItemId = null;
        DOMElements.itemFormTitle.textContent = parentId ? 'Add New Sub-item' : 'Add New Top-Level Item';
        DOMElements.itemParentIdInput.value = parentId || '';
        DOMElements.itemIsVisibleCheckbox.checked = true;
        DOMElements.itemOpenInNewTabCheckbox.checked = false;
        updateFormVisibilityBasedOnType();
        DOMElements.itemFormPlaceholder.style.display = 'none';
        DOMElements.itemForm.style.display = 'block';
        DOMElements.itemLabelInput.focus();
    }

    function clearItemForm(resetSelected = true) {
        DOMElements.itemForm.reset();
        DOMElements.itemIdInput.value = '';
        DOMElements.itemParentIdInput.value = '';
        DOMElements.itemFormTitle.textContent = 'Menu Item Details';
        DOMElements.deleteMenuItemBtn.style.display = 'none';
        DOMElements.deleteMenuItemBtn.removeAttribute('aria-label');
        DOMElements.itemFormPlaceholder.style.display = 'block';
        DOMElements.itemForm.style.display = 'none';
        updateFormVisibilityBasedOnType();
        if (resetSelected) {
            const previouslySelected = menuState.selectedItemId;
            menuState.selectedItemId = null;
            if (previouslySelected) renderFullMenu();
        }
    }

    DOMElements.itemTypeSelect.addEventListener('change', updateFormVisibilityBasedOnType);
    function updateFormVisibilityBasedOnType() {
        const type = DOMElements.itemTypeSelect.value;
        DOMElements.itemPageLinkGroup.style.display = type === 'page' ? 'block' : 'none';
        DOMElements.itemCustomUrlGroup.style.display = type === 'url' ? 'block' : 'none';
        DOMElements.itemPageIdSelect.required = (type === 'page');
        DOMElements.itemUrlInput.required = (type === 'url');
    }

    DOMElements.itemForm.addEventListener('submit', function(event) {
        event.preventDefault();
        const id = DOMElements.itemIdInput.value;
        const parentId = DOMElements.itemParentIdInput.value || null;
        const label = DOMElements.itemLabelInput.value.trim();
        const type = DOMElements.itemTypeSelect.value;
        const pageId = (type === 'page') ? DOMElements.itemPageIdSelect.value : null;
        const url = (type === 'url') ? DOMElements.itemUrlInput.value.trim() : null;
        const isVisible = DOMElements.itemIsVisibleCheckbox.checked;
        const openInNewTab = DOMElements.itemOpenInNewTabCheckbox.checked;
        const customCssClasses = DOMElements.itemCssClassesInput.value.trim();

        if (!label) { showNotification('Item label is required.', 'warning'); DOMElements.itemLabelInput.focus(); return; }
        if (type === 'page' && !pageId) { showNotification('Please select a page.', 'warning'); DOMElements.itemPageIdSelect.focus(); return; }
        if (type === 'url' && !url) { showNotification('Please enter a URL.', 'warning'); DOMElements.itemUrlInput.focus(); return; }
        if (type === 'url' && url && !isValidHttpUrl(url)) { showNotification('Please enter a valid URL (e.g., https://example.com).', 'warning'); DOMElements.itemUrlInput.focus(); return; }

        const itemData = { label, type, pageId, url, isVisible, openInNewTab, customCssClasses, parentId };
        let itemUpdated = false;

        if (id) {
            const existingItem = findItemById(menuState.menuItems, id);
            if (existingItem) { Object.assign(existingItem, itemData); itemUpdated = true; showNotification(`${CONSTANTS.MSG_ITEM_UPDATED_LOCALLY}: "${escapeHtml(label)}"`, 'success'); }
            else { showNotification(`Error: Could not find item with ID ${id} to update.`, 'error'); return; }
        } else {
            const newItem = { id: generateId(), ...itemData, order: menuState.menuItems.filter(i => i.parentId === parentId).length, children: [] };
            menuState.menuItems.push(newItem); itemUpdated = true; showNotification(`${CONSTANTS.MSG_ITEM_ADDED_LOCALLY}: "${escapeHtml(label)}"`, 'success');
        }

        if (itemUpdated) {
            setDirty(true); renderFullMenu();
            const savedItem = findItemById(menuState.menuItems, id || menuState.menuItems.find(i => i.label === label && i.parentId === parentId)?.id);
            if (savedItem) loadItemIntoForm(savedItem.id); else clearItemForm();
        }
    });
    
    function isValidHttpUrl(string) {
        try { const url = new URL(string); return url.protocol === "http:" || url.protocol === "https:"; }
        catch (_) { return false; }
    }

    // --- ITEM ACTIONS ---
    DOMElements.addNewTopLevelItemBtn.addEventListener('click', () => prepareFormForNewItem(null));
    DOMElements.clearItemFormBtn.addEventListener('click', () => clearItemForm());
    DOMElements.deleteMenuItemBtn.addEventListener('click', async function() { // Assuming adminApp.confirm is Promise-based
        if (menuState.selectedItemId) {
            const itemToDelete = findItemById(menuState.menuItems, menuState.selectedItemId);
            if (!itemToDelete) { showNotification('Item not found for deletion.', 'warning'); return; }

            try {
                const confirmed = await adminApp.confirm(`Are you sure you want to delete "${escapeHtml(itemToDelete.label)}" and all its sub-items? This is a local change.`);
                if (confirmed) {
                    const idsToDelete = [menuState.selectedItemId, ...getAllDescendantIds(menuState.menuItems, menuState.selectedItemId)];
                    menuState.menuItems = menuState.menuItems.filter(item => !idsToDelete.includes(item.id));
                    showNotification(CONSTANTS.MSG_ITEM_REMOVED_LOCALLY, 'info');
                    clearItemForm(); // Clear form as selected item is gone
                    setDirty(true); renderFullMenu();
                    DOMElements.addNewTopLevelItemBtn.focus(); // Focus a stable element
                }
            } catch (err) { /* User cancelled or error in confirm */ console.log("Deletion cancelled or confirm error."); }
        }
    });
    
    // Quick delete from list
    async function handleDeleteItem(itemId) { // Assuming adminApp.confirm is Promise-based
        const itemToDelete = findItemById(menuState.menuItems, itemId);
        if (!itemToDelete) { showNotification('Item not found for deletion.', 'warning'); return; }
        
        try {
            const confirmed = await adminApp.confirm(`Are you sure you want to delete "${escapeHtml(itemToDelete.label)}" and all its sub-items? This is a local change.`);
            if (confirmed) {
                const idsToDelete = [itemId, ...getAllDescendantIds(menuState.menuItems, itemId)];
                menuState.menuItems = menuState.menuItems.filter(item => !idsToDelete.includes(item.id));
                showNotification(CONSTANTS.MSG_ITEM_REMOVED_LOCALLY, 'info');
                if (menuState.selectedItemId === itemId || idsToDelete.includes(menuState.selectedItemId)) {
                    clearItemForm();
                }
                setDirty(true); renderFullMenu();
                // Attempt to focus the "Add New Top-Level Item" button or the menu container
                const focusTarget = DOMElements.addNewTopLevelItemBtn || DOMElements.menuListContainer;
                if(focusTarget) focusTarget.focus();
            }
        } catch (err) { /* User cancelled or error in confirm */ console.log("Deletion cancelled or confirm error."); }
    }
    
    function getAllDescendantIds(items, parentId) {
        let descendantIds = [];
        const children = items.filter(item => item.parentId === parentId);
        children.forEach(child => {
            descendantIds.push(child.id);
            descendantIds = descendantIds.concat(getAllDescendantIds(items, child.id));
        });
        return descendantIds;
    }

    // --- SORTABLEJS LOGIC ---
    /**
     * Handles the end of a drag-and-drop operation.
     * @param {Event} event - The SortableJS event object.
     * @param {number} originalDepth - The depth of the list where dragging started (not directly used here but shows context).
     */
    function handleSortEnd(event, originalDepth) {
        const itemId = event.item.dataset.id;
        const newParentEl = event.to; // The UL element the item was dropped into
        const oldParentEl = event.from;

        // Determine new parent ID and new depth
        let newParentId = null;
        let newDepth = 0;
        if (newParentEl.classList.contains(CONSTANTS.SUBMENU_CLASS)) { 
            const parentLi = newParentEl.closest(`li.${CONSTANTS.ITEM_CLASS}`);
            if (parentLi) {
                newParentId = parentLi.dataset.id;
                // Calculate depth by traversing up to root
                let currentEl = parentLi;
                while(currentEl && !currentEl.classList.contains(CONSTANTS.ROOT_MENU_CLASS) && currentEl.parentElement.closest(`li.${CONSTANTS.ITEM_CLASS}`)) {
                    newDepth++;
                    currentEl = currentEl.parentElement.closest(`li.${CONSTANTS.ITEM_CLASS}`);
                }
                newDepth++; // for the current parentLi itself
            }
        } // Else, it's in a root list, parentId is null, depth is 0.

        // Check max nesting depth
        if (newDepth >= menuConfig.maxNestingDepth) {
            showNotification(CONSTANTS.MSG_MAX_DEPTH_REACHED, 'warning');
            // Revert the drag operation: move item back to original position
            // This is tricky with SortableJS. A full re-render from original state might be needed,
            // or more complex DOM manipulation. For now, we'll re-render and the user has to fix.
            // A better UX would be to prevent the drop visually if it exceeds depth.
            // SortableJS `onMove` callback can be used for this.
            // For simplicity here, we allow the drop and then re-render, which will place it back if state isn't updated.
            // Or, more simply, don't update the state if depth is exceeded, and re-render.
            renderFullMenu(); // This will effectively cancel the visual move if state isn't changed.
            return;
        }

        const item = findItemById(menuState.menuItems, itemId);
        if (!item) { console.error("Sorted item not found in state:", itemId); return; }

        item.parentId = newParentId;

        Array.from(newParentEl.children).forEach((siblingLi, index) => {
            const siblingItem = findItemById(menuState.menuItems, siblingLi.dataset.id);
            if (siblingItem) {
                siblingItem.order = index;
                if (siblingItem.id === itemId) siblingItem.parentId = newParentId;
            }
        });

        if (oldParentEl !== newParentEl && oldParentEl.classList.contains(CONSTANTS.SORTABLE_LIST_CLASS)) {
            Array.from(oldParentEl.children).forEach((siblingLi, index) => {
                const siblingItem = findItemById(menuState.menuItems, siblingLi.dataset.id);
                if (siblingItem) siblingItem.order = index;
            });
        }
        
        setDirty(true);
        showNotification(CONSTANTS.MSG_ORDER_CHANGED_LOCALLY, 'info');
        renderFullMenu(); 
        if (item.id === menuState.selectedItemId) loadItemIntoForm(item.id);
    }

    // --- SAVE STRUCTURE ---
    // let saveDebounceTimer; // For debouncing save if needed
    DOMElements.saveMenuStructureBtn.addEventListener('click', async function() {
        // clearTimeout(saveDebounceTimer); // Clear any pending debounce
        if (!menuState.isDirty) { showNotification(CONSTANTS.MSG_NO_CHANGES, 'info'); return; }
        
        setLoading(true);
        DOMElements.saveMenuStructureBtn.disabled = true; // Explicitly disable during save
        const finalMenuItems = serializeMenuFromState();

        try {
            await apiRequest('POST', '/menu/save', finalMenuItems);
            showNotification(CONSTANTS.MSG_SAVE_SUCCESS, 'success');
            fetchMenuItems(); // Refreshes state, gets new IDs, resets dirty flag
        } catch (error) {
            showNotification(CONSTANTS.MSG_SAVE_FAIL, 'error');
            DOMElements.saveMenuStructureBtn.disabled = menuState.isDirty; // Re-enable if dirty and save failed
        } finally {
            setLoading(false); // setLoading will also handle button state based on isDirty
        }
    });

    function serializeMenuFromState() {
        return menuState.menuItems.map(item => ({
            id: item.id.startsWith(CONSTANTS.TEMP_ID_PREFIX) ? null : item.id,
            label: item.label, type: item.type, pageId: item.pageId, url: item.url,
            isVisible: item.isVisible, openInNewTab: item.openInNewTab,
            customCssClasses: item.customCssClasses, parentId: item.parentId, order: item.order,
        }));
    }
    
    function findItemById(items, id) {
        return id ? items.find(item => item.id === id) : null;
    }

    // --- INITIALIZATION ---
    function initializeMenuManagement() {
        clearItemForm();
        setLoading(true);
        Promise.all([fetchSitePages(), fetchMenuItems()])
            .catch(err => console.error("Error during initial menu setup:", err))
            .finally(() => setLoading(false));
        setDirty(false);
    }

    initializeMenuManagement();
});
