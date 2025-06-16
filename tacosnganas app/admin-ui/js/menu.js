/**
 * TACOnganas Admin Panel - Navigation Menu Management
 *
 * Features:
 * - Drag-and-drop reordering and nesting of menu items using SortableJS.
 * - CRUD operations for menu items (label, link type, URL/page, visibility, new tab, CSS classes).
 * - Fetches list of site pages for internal linking.
 * - Saves the entire menu structure to the backend.
 */

// Ensure adminApp and Sortable are available
if (typeof window.adminApp === 'undefined') {
    console.error('FATAL ERROR: adminApp global object not found. Menu management cannot function.');
    // ...show error in UI...
}
if (typeof Sortable === 'undefined') {
    console.error('FATAL ERROR: SortableJS library not found. Menu management cannot function.');
    // Display error on page
}

document.addEventListener('DOMContentLoaded', () => {
    const DOMElements = {
        notificationsArea: document.getElementById('menuNotifications'),
        menuListContainer: document.getElementById('menuListContainer'),
        noMenuItemsMessage: document.getElementById('noMenuItemsMessage'),
        menuSpinner: document.getElementById('menuSpinner'),
        addNewTopLevelItemBtn: document.getElementById('addNewTopLevelItemBtn'),
        saveMenuStructureBtn: document.getElementById('saveMenuStructureBtn'),
        // Item Details Form
        itemForm: document.getElementById('menuItemForm'),
        itemFormTitle: document.getElementById('menuItemFormTitle'),
        itemIdInput: document.getElementById('menuItemId'),
        itemParentIdInput: document.getElementById('menuItemParentIdInput'), // Hidden input for parent when adding sub-item
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

    if (!DOMElements.menuListContainer || !DOMElements.itemForm) {
        console.warn("Menu management elements not found on this page. Skipping init.");
        return;
    }

    const menuState = {
        menuItems: [], // Flat list of all menu items from backend
        sitePages: [], // List of site pages {id, title, filename}
        selectedItemId: null, // ID of the item currently being edited in the form
        isLoading: false,
        sortableInstances: [], // To keep track of SortableJS instances for cleanup
    };

    // --- UTILITY FUNCTIONS ---
    const showNotification = (message, type = 'info') => adminApp.showNotification(message, type, 'menuNotifications');
    const apiRequest = async (method, endpoint, body = null) => adminApp.apiRequest(method, endpoint, body);
    const escapeHtml = (str) => String(str || '').replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'})[m]);
    const generateId = () => `temp_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`; // For new client-side items

    // --- DATA FETCHING ---
    async function fetchMenuItems() {
        setLoading(true);
        try {
            const items = await apiRequest('GET', '/menu');
            menuState.menuItems = items.map(item => ({ ...item, id: item.id || generateId() }) ); // Ensure all items have an ID
            renderFullMenu();
        } catch (error) {
            showNotification(`Error fetching menu items: ${error.message}`, 'error');
            DOMElements.noMenuItemsMessage.style.display = 'block';
        } finally {
            setLoading(false);
        }
    }

    async function fetchSitePages() {
        try {
            const pages = await apiRequest('GET', '/pages/list'); // Assuming an endpoint like this exists
            menuState.sitePages = pages || [];
            populatePageSelector();
        } catch (error) {
            showNotification(`Error fetching site pages: ${error.message}`, 'warning');
        }
    }

    function populatePageSelector() {
        DOMElements.itemPageIdSelect.innerHTML = '<option value="">-- Select a Page --</option>';
        menuState.sitePages.forEach(page => {
            const option = document.createElement('option');
            option.value = page.id || page.filename; // Use a consistent identifier
            option.textContent = page.title || page.filename;
            DOMElements.itemPageIdSelect.appendChild(option);
        });
    }

    // --- RENDERING ---
    function renderFullMenu() {
        DOMElements.menuListContainer.innerHTML = '';
        menuState.sortableInstances.forEach(s => s.destroy()); // Destroy old instances
        menuState.sortableInstances = [];

        if (menuState.menuItems.length === 0) {
            DOMElements.noMenuItemsMessage.style.display = 'block';
            return;
        }
        DOMElements.noMenuItemsMessage.style.display = 'none';

        const menuTree = buildTree(menuState.menuItems);
        const rootUl = createMenuLevel(menuTree, true); // true for root level
        DOMElements.menuListContainer.appendChild(rootUl);
    }

    function buildTree(items, parentId = null) {
        return items
            .filter(item => item.parentId === parentId)
            .sort((a, b) => a.order - b.order)
            .map(item => ({ ...item, children: buildTree(items, item.id) }));
    }

    function createMenuLevel(items, isRoot = false) {
        const ul = document.createElement('ul');
        ul.className = `list-group menu-sortable-list ${isRoot ? 'root-menu' : 'submenu'}`;
        if (!isRoot) ul.style.minHeight = '30px'; // Smaller min-height for submenus

        items.forEach(item => {
            const li = document.createElement('li');
            li.className = 'list-group-item';
            li.dataset.id = item.id;
            if (!item.isVisible) li.classList.add('menu-item-hidden');
            if (item.id === menuState.selectedItemId) li.classList.add('active');

            let linkInfo = '';
            if (item.type === 'page') {
                const page = menuState.sitePages.find(p => (p.id || p.filename) === item.pageId);
                linkInfo = page ? ` <small class="text-muted">(${page.title || item.pageId})</small>` : ` <small class="text-danger">(Page not found: ${item.pageId})</small>`;
            } else if (item.type === 'url') {
                linkInfo = ` <small class="text-muted">(${item.url})</small>`;
            } else if (item.type === 'placeholder') {
                linkInfo = ` <small class="text-muted">(Placeholder)</small>`;
            }

            li.innerHTML = `
                <div class="d-flex justify-content-between align-items-center">
                    <span class="menu-item-label">
                        <i class="fas fa-grip-vertical me-2 text-muted" title="Drag to reorder/nest"></i>
                        ${escapeHtml(item.label)}${linkInfo}
                        ${item.openInNewTab ? ' <i class="fas fa-external-link-alt fa-xs text-muted" title="Opens in new tab"></i>' : ''}
                        ${item.customCssClasses ? ` <span class="badge bg-secondary fa-xs">${escapeHtml(item.customCssClasses)}</span>` : ''}
                    </span>
                    <span class="menu-item-actions">
                        <button class="btn btn-outline-primary btn-xs edit-item-btn" title="Edit Item"><i class="fas fa-pencil-alt"></i></button>
                        <button class="btn btn-outline-success btn-xs add-subitem-btn" title="Add Sub-item"><i class="fas fa-plus-circle"></i></button>
                        <button class="btn btn-outline-danger btn-xs delete-item-btn-quick" title="Delete Item"><i class="fas fa-trash-alt"></i></button>
                    </span>
                </div>
            `;

            li.querySelector('.edit-item-btn').addEventListener('click', (e) => { e.stopPropagation(); loadItemIntoForm(item.id); });
            li.querySelector('.add-subitem-btn').addEventListener('click', (e) => { e.stopPropagation(); prepareFormForNewItem(item.id); });
            li.querySelector('.delete-item-btn-quick').addEventListener('click', (e) => { e.stopPropagation(); handleDeleteItem(item.id); });
            
            ul.appendChild(li);

            if (item.children && item.children.length > 0) {
                const childUl = createMenuLevel(item.children);
                li.appendChild(childUl);
            }
        });

        const sortable = new Sortable(ul, {
            group: 'nested-menu', // Group name for all sortable lists
            animation: 150,
            fallbackOnBody: true,
            swapThreshold: 0.65,
            handle: '.fa-grip-vertical', // Use a handle for dragging
            onEnd: handleSortEnd,
        });
        menuState.sortableInstances.push(sortable);
        return ul;
    }

    function setLoading(isLoading) {
        menuState.isLoading = isLoading;
        DOMElements.menuSpinner.style.display = isLoading ? 'block' : 'none';
        DOMElements.saveMenuStructureBtn.disabled = isLoading;
        DOMElements.addNewTopLevelItemBtn.disabled = isLoading;
        // Disable form elements too
    }

    // --- FORM HANDLING ---
    function loadItemIntoForm(itemId) {
        const item = findItemById(menuState.menuItems, itemId);
        if (!item) {
            showNotification('Error: Could not find item to edit.', 'error');
            return;
        }
        clearItemForm(false); // Don't reset selectedItemId yet
        menuState.selectedItemId = itemId;

        DOMElements.itemFormTitle.textContent = `Edit: ${item.label}`;
        DOMElements.itemIdInput.value = item.id;
        DOMElements.itemParentIdInput.value = item.parentId || '';
        DOMElements.itemLabelInput.value = item.label;
        DOMElements.itemTypeSelect.value = item.type || 'page';
        DOMElements.itemPageIdSelect.value = item.pageId || '';
        DOMElements.itemUrlInput.value = item.url || '';
        DOMElements.itemIsVisibleCheckbox.checked = item.isVisible !== false; // Default true
        DOMElements.itemOpenInNewTabCheckbox.checked = item.openInNewTab === true;
        DOMElements.itemCssClassesInput.value = item.customCssClasses || '';

        updateFormVisibilityBasedOnType();
        DOMElements.deleteMenuItemBtn.style.display = 'inline-block';
        DOMElements.itemFormPlaceholder.style.display = 'none';
        DOMElements.itemForm.style.display = 'block';
        DOMElements.itemLabelInput.focus();
        renderFullMenu(); // To highlight the selected item
    }

    function prepareFormForNewItem(parentId = null) {
        clearItemForm();
        menuState.selectedItemId = null; // Important: indicates a new item
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
        DOMElements.itemFormPlaceholder.style.display = 'block';
        DOMElements.itemForm.style.display = 'none'; // Hide form until an item is selected or new is added
        if (resetSelected) {
            menuState.selectedItemId = null;
            renderFullMenu(); // Remove active highlight
        }
    }

    DOMElements.itemTypeSelect.addEventListener('change', updateFormVisibilityBasedOnType);
    function updateFormVisibilityBasedOnType() {
        const type = DOMElements.itemTypeSelect.value;
        DOMElements.itemPageLinkGroup.style.display = type === 'page' ? 'block' : 'none';
        DOMElements.itemCustomUrlGroup.style.display = type === 'url' ? 'block' : 'none';
        if (type === 'page') DOMElements.itemPageIdSelect.required = true; else DOMElements.itemPageIdSelect.required = false;
        if (type === 'url') DOMElements.itemUrlInput.required = true; else DOMElements.itemUrlInput.required = false;
    }

    DOMElements.itemForm.addEventListener('submit', function(event) {
        event.preventDefault();
        const id = DOMElements.itemIdInput.value;
        const parentId = DOMElements.itemParentIdInput.value || null; // Ensure null for top-level
        const label = DOMElements.itemLabelInput.value.trim();
        const type = DOMElements.itemTypeSelect.value;
        const pageId = DOMElements.itemPageIdSelect.value;
        const url = DOMElements.itemUrlInput.value.trim();
        const isVisible = DOMElements.itemIsVisibleCheckbox.checked;
        const openInNewTab = DOMElements.itemOpenInNewTabCheckbox.checked;
        const customCssClasses = DOMElements.itemCssClassesInput.value.trim();

        if (!label) {
            showNotification('Item label is required.', 'warning');
            return;
        }
        if (type === 'page' && !pageId) {
            showNotification('Please select a page for page link type.', 'warning');
            return;
        }
        if (type === 'url' && !url) {
            showNotification('Please enter a URL for custom URL type.', 'warning');
            return;
        }

        const itemData = { label, type, pageId, url, isVisible, openInNewTab, customCssClasses, parentId };

        if (id && id.startsWith('temp_')) { // It's a new item that was selected for edit before saving structure
             const existingItem = findItemById(menuState.menuItems, id);
             if(existingItem) {
                Object.assign(existingItem, itemData);
                showNotification(`Item "${label}" updated locally. Save structure to persist.`, 'success');
             }
        } else if (id) { // Editing existing item (persisted or temporary)
            const existingItem = findItemById(menuState.menuItems, id);
            if (existingItem) {
                Object.assign(existingItem, itemData); // Update item in our local state
                showNotification(`Item "${label}" updated locally. Save structure to persist.`, 'success');
            }
        } else { // Adding new item
            const newItem = {
                id: generateId(), // Temporary client-side ID
                ...itemData,
                order: (menuState.menuItems.filter(i => i.parentId === parentId).length), // Append to end of its level
                children: []
            };
            menuState.menuItems.push(newItem);
            showNotification(`Item "${label}" added locally. Save structure to persist.`, 'success');
        }
        renderFullMenu();
        // Optionally, re-load the saved/added item into form or clear form
        if (id || menuState.menuItems.find(i => i.label === label)) { // if editing or new item was found
            const savedItem = findItemById(menuState.menuItems, id || menuState.menuItems.find(i => i.label === label && i.parentId === parentId)?.id);
            if (savedItem) loadItemIntoForm(savedItem.id);
            else clearItemForm();
        } else {
            clearItemForm();
        }
    });

    // --- ITEM ACTIONS ---
    DOMElements.addNewTopLevelItemBtn.addEventListener('click', () => prepareFormForNewItem(null));
    DOMElements.clearItemFormBtn.addEventListener('click', () => clearItemForm());
    DOMElements.deleteMenuItemBtn.addEventListener('click', function() {
        if (menuState.selectedItemId) {
            handleDeleteItem(menuState.selectedItemId);
        }
    });

    function handleDeleteItem(itemId) {
        const itemToDelete = findItemById(menuState.menuItems, itemId);
        if (!itemToDelete) return;

        adminApp.confirm(`Are you sure you want to delete "${itemToDelete.label}" and all its sub-items? This is a local change until you save the structure.`, () => {
            // Recursively find all children to delete
            const idsToDelete = [itemId, ...getAllDescendantIds(menuState.menuItems, itemId)];
            menuState.menuItems = menuState.menuItems.filter(item => !idsToDelete.includes(item.id));
            
            // Re-calculate order for siblings of deleted items if necessary (or let backend handle on save)
            // For simplicity, we'll let the main save operation re-order.

            showNotification(`Item "${itemToDelete.label}" and its sub-items removed locally.`, 'info');
            if (menuState.selectedItemId === itemId) {
                clearItemForm();
            }
            renderFullMenu();
        });
    }
    
    function getAllDescendantIds(items, parentId) {
        let descendantIds = [];
        const children = items.filter(item => item.parentId === parentId);
        for (const child of children) {
            descendantIds.push(child.id);
            descendantIds = descendantIds.concat(getAllDescendantIds(items, child.id));
        }
        return descendantIds;
    }


    // --- SORTABLEJS LOGIC ---
    function handleSortEnd(event) {
        const itemId = event.item.dataset.id;
        const newParentEl = event.to;
        const oldParentEl = event.from;
        
        let newParentId = null;
        if (newParentEl.classList.contains('submenu')) { // Dropped into a sublist
            newParentId = newParentEl.closest('li.list-group-item').dataset.id;
        } // else it's in a root list, parentId remains null or its original root

        const item = findItemById(menuState.menuItems, itemId);
        if (!item) return;

        item.parentId = newParentId;

        // Update order of all items in the new parent list
        const siblings = Array.from(newParentEl.children);
        siblings.forEach((siblingLi, index) => {
            const siblingItem = findItemById(menuState.menuItems, siblingLi.dataset.id);
            if (siblingItem) {
                siblingItem.order = index;
                // If an item was moved from another list, its parentId also needs update
                if (siblingItem.id === itemId) {
                    siblingItem.parentId = newParentId;
                }
            }
        });

        // If item moved from a different list, update order of old siblings too
        if (oldParentEl !== newParentEl) {
            const oldSiblings = Array.from(oldParentEl.children);
            oldSiblings.forEach((siblingLi, index) => {
                const siblingItem = findItemById(menuState.menuItems, siblingLi.dataset.id);
                if (siblingItem) siblingItem.order = index;
            });
        }
        
        // console.log('Updated menuItems after sort:', JSON.parse(JSON.stringify(menuState.menuItems)));
        showNotification('Menu order/structure changed locally. Save to persist.', 'info');
        // No need to re-render full menu here, SortableJS handles DOM. But our data is updated.
        // If highlighting selected item, might need to call loadItemIntoForm if the moved item was selected.
        if (item.id === menuState.selectedItemId) {
            loadItemIntoForm(item.id); // Re-select to update parentId in form if needed
        }
    }

    // --- SAVE STRUCTURE ---
    DOMElements.saveMenuStructureBtn.addEventListener('click', async function() {
        setLoading(true);
        // Before saving, ensure order is consistent for all items
        // This can be complex if relying purely on SortableJS updates for a flat list.
        // A safer way is to re-flatten the current DOM structure.
        const finalMenuItems = serializeMenuFromDOM(DOMElements.menuListContainer.querySelector('ul.root-menu'));
        // console.log("Serialized for save:", finalMenuItems);

        try {
            await apiRequest('POST', '/menu/save', finalMenuItems); // Or PUT
            showNotification('Menu structure saved successfully!', 'success');
            // Fetch again to get any backend-assigned IDs or re-ordering
            fetchMenuItems(); 
        } catch (error) {
            showNotification(`Error saving menu structure: ${error.message}`, 'error');
        } finally {
            setLoading(false);
        }
    });

    function serializeMenuFromDOM(rootUlElement, parentId = null, currentOrder = {val: 0}) {
        let items = [];
        if (!rootUlElement) return items;

        Array.from(rootUlElement.children).forEach((liElement, index) => {
            if (!liElement.matches('li.list-group-item')) return; // Skip if not a menu item li

            const itemId = liElement.dataset.id;
            const originalItem = findItemById(menuState.menuItems, itemId) || {}; // Get other props

            const serializedItem = {
                id: itemId.startsWith('temp_') ? null : itemId, // Send null for new items so backend assigns ID
                label: originalItem.label || 'Unknown Label',
                type: originalItem.type || 'page',
                pageId: originalItem.pageId,
                url: originalItem.url,
                isVisible: originalItem.isVisible !== false,
                openInNewTab: originalItem.openInNewTab === true,
                customCssClasses: originalItem.customCssClasses,
                parentId: parentId,
                order: index, // Order within this specific list/level
            };
            items.push(serializedItem);

            const childUlElement = liElement.querySelector('ul.submenu');
            if (childUlElement) {
                // Pass the actual ID of the current item as parentId for its children
                // If it's a temp ID, the backend needs to handle this relationship upon creation
                const actualParentIdForChildren = itemId; // Backend needs to map temp IDs if sent
                items = items.concat(serializeMenuFromDOM(childUlElement, actualParentIdForChildren, currentOrder));
            }
        });
        return items;
    }
    
    function findItemById(items, id) {
        return items.find(item => item.id === id);
    }

    // --- INITIALIZATION ---
    function initializeMenuManagement() {
        clearItemForm(); // Start with form hidden
        fetchSitePages(); // Fetch pages for the dropdown
        fetchMenuItems(); // Fetch and render the current menu
    }

    initializeMenuManagement();
});