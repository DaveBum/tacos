/**
 * @file cart.js
 * @description Manages the shopping cart state, interactions, and data persistence for TacoNGanas.
 * Executed site-wide (menu, order, checkout).
 */

const CART_STORAGE_KEY = 'taconganas_cart_v1';
const MENU_DATA_PATH = '../data/menu.json';
const TAX_DATA_PATH = '../data/tax.json'; // TN 9.75% tax
const STOCK_API_URL = 'https://openapi.doordash.com/v2/items/stock?store_id='; // Append ENV_STORE_ID
const PROMO_VALIDATE_API = '/api/promos/validate';

let cart = [];
let menuItems = {}; // Cache for menu item details
let taxRate = 0.0975; // Default tax rate
let ENV_STORE_ID = 'YOUR_DOORDASH_STORE_ID'; // This should be configured via env or build process

const listeners = [];
let stockCheckTimeout = null;

/**
 * Fetches HTML partials and injects them into elements with `data-include` attributes.
 * @async
 */
async function includeHTML() {
    const elements = document.querySelectorAll('[data-include]');
    for (let el of elements) {
        const file = el.getAttribute('data-include');
        if (file) {
            try {
                const response = await fetch(file);
                if (response.ok) {
                    const text = await response.text();
                    el.innerHTML = text;
                } else {
                    el.innerHTML = 'Page not found.';
                    console.error(`Failed to fetch partial: ${file}`, response.statusText);
                }
            } catch (error) {
                console.error(`Error fetching partial ${file}:`, error);
                el.innerHTML = 'Error loading content.';
            }
            el.removeAttribute('data-include'); // Process only once
        }
    }
}

/**
 * Loads menu data from JSON file and caches it.
 * @async
 * @returns {Promise<Object>} A promise that resolves to the menu items object.
 */
async function loadMenuData() {
    if (Object.keys(menuItems).length > 0) return menuItems;
    try {
        const response = await fetch(MENU_DATA_PATH);
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        const data = await response.json();
        data.forEach(category => {
            category.items.forEach(item => {
                menuItems[item.id] = { ...item, category: category.name, spanishName: item.spanishName || '' };
            });
        });
        return menuItems;
    } catch (error) {
        console.error('Failed to load menu data:', error);
        return {}; // Return empty object on error to prevent site breakage
    }
}

/**
 * Loads tax rate from JSON file.
 * @async
 */
async function loadTaxRate() {
    try {
        const response = await fetch(TAX_DATA_PATH);
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        const data = await response.json();
        if (data && typeof data.rate === 'number') {
            taxRate = data.rate;
        }
    } catch (error) {
        console.error('Failed to load tax rate, using default:', error);
    }
}

/**
 * Loads cart from localStorage.
 */
function loadCart() {
    const storedCart = localStorage.getItem(CART_STORAGE_KEY);
    if (storedCart) {
        cart = JSON.parse(storedCart);
    }
    notifyListeners();
}

/**
 * Saves cart to localStorage and notifies listeners.
 */
function saveCart() {
    localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cart));
    notifyListeners();
    // Dispatch custom event for other modules/components to listen to
    document.dispatchEvent(new CustomEvent('cart-changed', { detail: getCartState() }));
    scheduleStockCheck();
}

/**
 * Adds an item to the cart or updates its quantity.
 * @param {string} itemId - The ID of the item to add.
 * @param {number} [quantity=1] - The quantity to add.
 */
function add(itemId, quantity = 1) {
    if (!menuItems[itemId]) {
        console.warn(`Attempted to add unknown item: ${itemId}`);
        return;
    }
    const existingItem = cart.find(item => item.id === itemId);
    if (existingItem) {
        existingItem.quantity += quantity;
    } else {
        cart.push({ id: itemId, quantity });
    }
    saveCart();
}

/**
 * Removes an item from the cart.
 * @param {string} itemId - The ID of the item to remove.
 */
function remove(itemId) {
    cart = cart.filter(item => item.id !== itemId);
    saveCart();
}

/**
 * Updates the quantity of an item in the cart.
 * @param {string} itemId - The ID of the item to update.
 * @param {number} quantity - The new quantity.
 */
function updateQty(itemId, quantity) {
    const item = cart.find(item => item.id === itemId);
    if (item) {
        if (quantity > 0) {
            item.quantity = quantity;
        } else {
            remove(itemId);
            return; // saveCart is called by remove()
        }
    }
    saveCart();
}

/**
 * Clears all items from the cart.
 */
function clear() {
    cart = [];
    saveCart();
}

/**
 * Gets the current cart items with details.
 * @returns {Array<Object>} Array of cart items with full details.
 */
function getCart() {
    return cart.map(item => {
        const menuItem = menuItems[item.id] || { name: 'Unknown Item', price: 0, spanishName: '' };
        return {
            ...item,
            name: menuItem.name,
            spanishName: menuItem.spanishName,
            price: menuItem.price,
            lineTotal: menuItem.price * item.quantity
        };
    });
}

/**
 * Calculates subtotal, tax, and total for the current cart.
 * Accounts for promotions and uses the stored tip percentage.
 * @returns {Object} Object containing subtotal, taxAmount, tipAmount, and total.
 */
function getTotals() {
    const detailedCart = getCart();
    const originalSubtotal = detailedCart.reduce((sum, item) => sum + item.lineTotal, 0);
    let subtotalAfterDiscount = originalSubtotal;
    let discountAmount = 0;
    let promoDetails = null;

    const storedPromo = localStorage.getItem('taconganas_promo');
    if (storedPromo) {
        const promo = JSON.parse(storedPromo);
        if (promo.valid) {
            promoDetails = promo;
            if (promo.discountType === 'percentage') {
                discountAmount = originalSubtotal * promo.discountValue;
            } else if (promo.discountType === 'fixed') {
                discountAmount = promo.discountValue;
            }
            // Ensure discount doesn't make subtotal negative or exceed subtotal
            discountAmount = Math.min(discountAmount, originalSubtotal);
            subtotalAfterDiscount = Math.max(0, originalSubtotal - discountAmount);
        }
    }

    const taxAmount = subtotalAfterDiscount * taxRate;
    const storedTipPercentage = parseFloat(localStorage.getItem('taconganas_tip_percentage') || '0');
    const tipAmount = subtotalAfterDiscount * storedTipPercentage; // Tip on (potentially discounted) subtotal
    const total = subtotalAfterDiscount + taxAmount + tipAmount;

    return {
        subtotal: originalSubtotal,
        discountAmount,
        promoDetails, // Contains full promo object if valid {code, message, valid, discountType, discountValue}
        subtotalAfterDiscount,
        taxAmount,
        taxRate,
        tipAmount,
        tipPercentage: storedTipPercentage,
        total,
        items: detailedCart,
        itemCount: cart.reduce((sum, item) => sum + item.quantity, 0)
    };
}

/**
 * Returns the complete state of the cart including items and totals.
 * Totals are calculated using the stored tip percentage and any active promotion.
 * @returns {Object} The full cart state.
 */
function getCartState() {
    return {
        items: getCart(),
        ...getTotals()
    };
}

/**
 * Registers a callback function to be called when the cart changes.
 * @param {Function} callback - The function to call on cart change.
 */
function onChange(callback) {
    listeners.push(callback);
}

/**
 * Notifies all registered listeners about a cart change.
 */
function notifyListeners() {
    const state = getCartState(); // Get current state to pass to listeners
    listeners.forEach(listener => listener(state));
}

/**
 * Handles localStorage changes from other tabs/windows.
 * @param {StorageEvent} event - The storage event.
 */
function handleStorageChange(event) {
    if (event.key === CART_STORAGE_KEY) {
        if (event.newValue) {
            cart = JSON.parse(event.newValue);
        } else {
            cart = [];
        }
        notifyListeners();
        // Dispatch custom event for other modules/components to listen to
        document.dispatchEvent(new CustomEvent('cart-changed', { detail: getCartState() }));
    }
}

/**
 * Schedules a stock check if not already scheduled.
 * Throttled to prevent excessive API calls.
 */
function scheduleStockCheck() {
    if (stockCheckTimeout) {
        clearTimeout(stockCheckTimeout);
    }
    stockCheckTimeout = setTimeout(async () => {
        await checkStockLevels();
        stockCheckTimeout = null;
    }, 3000); // 3-second throttle
}

/**
 * Checks stock levels for items in the cart via DoorDash API.
 * @async
 */
async function checkStockLevels() {
    if (!cart.length || !ENV_STORE_ID || ENV_STORE_ID === 'YOUR_DOORDASH_STORE_ID') {
        // console.log('Skipping stock check: cart empty or store ID not configured.');
        return;
    }
    const itemIds = cart.map(item => item.id).join(',');
    try {
        // This is a conceptual API endpoint. Actual DoorDash API might differ.
        // const response = await fetch(`${STOCK_API_URL}${ENV_STORE_ID}&item_ids=${itemIds}`);
        // if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        // const stockData = await response.json();
        // Process stockData and potentially notify user or update cart
        // For now, we'll just log it as the API is a mock.
        console.log(`Simulated stock check for items: ${itemIds} against store ${ENV_STORE_ID}`);
        // Example: stockData = [{itemId: "taco-pastor", stock: 5}, ...]
        // If an item is out of stock, you might dispatch an event or show a message.
        document.dispatchEvent(new CustomEvent('stock-levels-updated', { detail: { /* stockData */ } }));
    } catch (error) {
        console.error('Failed to check stock levels:', error);
    }
}

/**
 * Converts the internal cart representation to DoorDash lineItem schema.
 * @returns {Array<Object>} Array of line items formatted for DoorDash API.
 */
function doorDashPayload() {
    return cart.map(item => {
        const menuItem = menuItems[item.id];
        if (!menuItem) return null; // Should not happen if cart is managed properly

        return {
            id: menuItem.id, // External ID known to DoorDash
            name: menuItem.name,
            description: menuItem.description || menuItem.name,
            quantity: item.quantity,
            price: Math.round(menuItem.price * 100), // Price in cents
            // Modifiers/options would be handled here if applicable
            // item_options: [] 
        };
    }).filter(item => item !== null);
}

/**
 * Initializes the cart module.
 * Loads data, sets up listeners.
 * @async
 */
async function initCart() {
    // Attempt to get store ID from import map if checkout.js has set it globally
    // This is a bit of a hack; a shared config module would be better.
    if (window.DD_STORE_ID) ENV_STORE_ID = window.DD_STORE_ID;

    await Promise.all([loadMenuData(), loadTaxRate()]);
    loadCart();
    window.addEventListener('storage', handleStorageChange);
    await includeHTML(); // Fetch header/footer after DOM is available

    // Initial rendering if on order page
    if (document.getElementById('cart-container')) {
        renderOrderPage(getCartState());
    }
    // Update summary on checkout page
    if (document.getElementById('checkout-order-summary-container')) {
        renderCheckoutSummary(getCartState());
    }

    onChange(renderOrderPage); // Re-render order page on cart change
    onChange(renderCheckoutSummary); // Re-render checkout summary on cart change
    onChange(updateMobileCartTotalPreview); // Update mobile total preview
}

// --- DOM Manipulation and Rendering for Order Page --- //

/**
 * Renders the entire order page content based on cart state.
 * @param {Object} cartState - The current state of the cart.
 */
function renderOrderPage(cartState) {
    if (!document.getElementById('cart-container')) return; // Only run on order page

    renderCartItems(cartState.items);
    renderFinancialSummary('financial-summary-desktop', cartState);
    renderFinancialSummary('financial-summary-mobile-content', cartState);
    renderUpsellItems(); // Assuming upsell items are static or from menu data
    updateMobileCartTotalPreview(cartState);
    toggleMobileSummaryTrigger(cartState.itemCount > 0);
}

/**
 * Renders the cart items table or empty cart message.
 * @param {Array<Object>} items - Array of cart items.
 */
function renderCartItems(items) {
    const cartContainer = document.getElementById('cart-container');
    if (!cartContainer) return;

    if (items.length === 0) {
        cartContainer.innerHTML = `
            <div class="empty-cart-message">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" aria-hidden="true" focusable="false">
                    <path d="M85,30H70a5,5,0,0,0-5,5V90a5,5,0,0,0,5,5H85a5,5,0,0,0,5-5V35A5,5,0,0,0,85,30ZM35,30H20a5,5,0,0,0-5,5V90a5,5,0,0,0,5,5H35a5,5,0,0,0,5-5V35A5,5,0,0,0,35,30Z" fill="var(--tg-text-muted)" opacity="0.6"/>
                    <path d="M90,35 H70 V25 c0-8.284-6.716-15-15-15H50c-8.284,0-15,6.716-15,15 V35 H15 c-2.761,0-5,2.239-5,5 V90 c0,2.761,2.239,5,5,5 H90 c2.761,0,5-2.239,5-5 V40 C95,37.239,92.761,35,90,35 Z M45,25 c0-2.761,2.239-5,5-5 h5 c2.761,0,5,2.239,5,5 V35 H45 Z M30,45h45v5H30zm0,15h45v5H30zm0,15h30v5H30z" fill="var(--tg-pink)"/> 
                </svg>
                <h3>Your Cart is Feeling Lonely!</h3>
                <p>Fill it up with some delicious tacos and Nganas!</p>
                <a href="../menu/menu.html" class="button button-primary">Browse Menu</a>
            </div>`;
        return;
    }

    // Group items by category (preparation style) for accordion
    const groupedItems = items.reduce((acc, item) => {
        const category = menuItems[item.id]?.category || 'Other Items';
        if (!acc[category]) acc[category] = [];
        acc[category].push(item);
        return acc;
    }, {});

    let tableHTML = '';
    for (const category in groupedItems) {
        tableHTML += `
        <details class="accordion-group" open>
            <summary>${category}</summary>
            <table class="cart-table" aria-label="${category} items in cart">
                <thead>
                    <tr>
                        <th scope="col">Product</th>
                        <th scope="col">Quantity</th>
                        <th scope="col">Unit Price</th>
                        <th scope="col">Line Total</th>
                        <th scope="col" class="sr-only">Actions</th>
                    </tr>
                </thead>
                <tbody>
        `;
        groupedItems[category].forEach(item => {
            tableHTML += `
                <tr data-item-id="${item.id}">
                    <td data-label="Product">
                        <div class="item-name">
                            <strong>${item.name}</strong>
                            ${item.spanishName ? `<small>${item.spanishName}</small>` : ''}
                        </div>
                    </td>
                    <td data-label="Quantity">
                        <div class="quantity-stepper" role="spinbutton" aria-label="Quantity for ${item.name}" aria-valuenow="${item.quantity}" aria-valuemin="0">
                            <label for="qty-${item.id}" class="sr-only">Quantity for ${item.name}</label>
                            <button type="button" class="decrement-qty" data-item-id="${item.id}" aria-label="Decrease quantity of ${item.name}" ${item.quantity <= 1 ? 'disabled' : ''}>−</button>
                            <input type="number" id="qty-${item.id}" value="${item.quantity}" min="1" data-item-id="${item.id}" class="item-qty-input" aria-live="polite">
                            <button type="button" class="increment-qty" data-item-id="${item.id}" aria-label="Increase quantity of ${item.name}">+</button>
                        </div>
                    </td>
                    <td data-label="Unit Price">$${item.price.toFixed(2)}</td>
                    <td data-label="Line Total">$${item.lineTotal.toFixed(2)}</td>
                    <td>
                        <button type="button" class="remove-item-btn" data-item-id="${item.id}" aria-label="Remove ${item.name} from cart">
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="20" height="20" aria-hidden="true" focusable="false"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"></path></svg>
                        </button>
                    </td>
                </tr>
            `;
        });
        tableHTML += `</tbody></table></details>`;
    }
    cartContainer.innerHTML = tableHTML;
    addCartEventListeners();
}

/**
 * Renders the financial summary section.
 * @param {string} containerId - The ID of the container element for the summary.
 * @param {Object} cartState - The current state of the cart.
 */
function renderFinancialSummary(containerId, cartState) {
    const summaryContainer = document.getElementById(containerId);
    if (!summaryContainer) return;

    const { 
        subtotal, discountAmount, promoDetails, subtotalAfterDiscount, 
        taxAmount, taxRate, tipAmount, tipPercentage, total, itemCount 
    } = cartState;
    // currentTip is the tipPercentage from cartState, which is from localStorage via getTotals
    const currentTip = tipPercentage; 

    summaryContainer.innerHTML = `
        <div class="financial-summary">
            <h3 id="${containerId}-heading">Order Summary</h3>
            <div class="summary-row">
                <span>Subtotal (${itemCount} ${itemCount === 1 ? 'item' : 'items'})</span>
                <span>$${subtotal.toFixed(2)}</span>
            </div>
            ${promoDetails && promoDetails.valid ? `
                <div class="summary-row promo-applied success">
                    <span>Discount (${promoDetails.code})</span>
                    <span>-$${discountAmount.toFixed(2)}</span>
                </div>
                <div class="summary-row">
                    <span>New Subtotal</span>
                    <span>$${subtotalAfterDiscount.toFixed(2)}</span>
                </div>
            ` : ''}
            <div class="summary-row">
                <span>Sales Tax (${(taxRate * 100).toFixed(2)}%)</span>
                <span>$${taxAmount.toFixed(2)}</span>
            </div>
            
            <div class="tipping-options">
                <fieldset>
                    <legend>Add a Tip?</legend>
                    ${[0, 0.10, 0.15, 0.20].map(perc => `
                        <div>
                            <input type="radio" id="tip-${perc * 100}-${containerId}" name="tip-${containerId}" value="${perc}" ${currentTip === perc ? 'checked' : ''} data-tip-group="${containerId}">
                            <label for="tip-${perc * 100}-${containerId}">${perc === 0 ? 'No Tip' : `${perc * 100}%`}</label>
                        </div>
                    `).join('')}
                </fieldset>
            </div>
            <div class="summary-row tip-summary" ${tipAmount === 0 ? 'style="display:none;"' : ''}>
                <span>Tip</span>
                <span id="tip-amount-${containerId}">$${tipAmount.toFixed(2)}</span>
            </div>

            <div class="promo-code-field">
                <label for="promo-code-${containerId}" class="sr-only">Promotional Code</label>
                <input type="text" id="promo-code-${containerId}" placeholder="Promo Code" value="${(promoDetails && promoDetails.code) ? promoDetails.code : ''}">
                <button type="button" class="button button-tertiary apply-promo-btn" data-input-id="promo-code-${containerId}">Apply</button>
            </div>
            <div id="promo-message-${containerId}" class="promo-message ${promoDetails && promoDetails.valid ? 'success' : (promoDetails ? 'error' : '')}" style="font-size:0.9em; margin-bottom:1rem;">${promoDetails ? promoDetails.message : ''}</div>

            <div class="summary-row total">
                <span>Total</span>
                <span id="grand-total-${containerId}">$${total.toFixed(2)}</span>
            </div>
            ${containerId.includes('desktop') || containerId.includes('checkout') ? 
                `<a href="../order/checkout.html" class="button button-primary checkout-button ${itemCount === 0 ? 'disabled' : ''}" ${itemCount === 0 ? 'aria-disabled="true"' : ''}>Secure Checkout &rarr;</a>` : ''}
        </div>
    `;
    addSummaryEventListeners(containerId); // Removed subtotal argument
}

/**
 * Renders upsell items carousel.
 */
function renderUpsellItems() {
    const upsellContainer = document.getElementById('upsell-items-container');
    if (!upsellContainer) return;

    // Example: Get some items from menu data (e.g., drinks, sides)
    const potentialUpsellIds = ['item-jarritos-lime', 'item-consome-sm', 'item-horchata-lg', 'item-chips-salsa', 'item-elote'];
    let upsellHTML = '';
    potentialUpsellIds.forEach(id => {
        const item = menuItems[id];
        if (item) {
            upsellHTML += `
                <div class="upsell-chip" data-item-id="${item.id}" tabindex="0" role="button" aria-label="Add ${item.name} to cart">
                    <strong>${item.name}</strong>
                    <span>$${item.price.toFixed(2)}</span>
                </div>
            `;
        }
    });
    upsellContainer.innerHTML = upsellHTML;
    addUpsellEventListeners();
}

/**
 * Updates the total price preview on the mobile "View Total" button.
 * @param {Object} cartState - The current state of the cart.
 */
function updateMobileCartTotalPreview(cartState) {
    const mobilePreviewEl = document.getElementById('mobile-cart-total-preview');
    if (mobilePreviewEl) {
        const currentTip = parseFloat(localStorage.getItem('taconganas_tip_percentage') || '0');
        const total = cartState.subtotal + cartState.taxAmount + (cartState.subtotal * currentTip);
        mobilePreviewEl.textContent = `$${total.toFixed(2)}`;
    }
}

/**
 * Shows or hides the mobile summary trigger button.
 * @param {boolean} show - Whether to show the button.
 */
function toggleMobileSummaryTrigger(show) {
    const triggerBtn = document.getElementById('mobile-summary-view-btn');
    if (triggerBtn) {
        triggerBtn.style.display = show ? 'inline-block' : 'none';
    }
}

/**
 * Adds event listeners for cart interactions (quantity, remove).
 */
function addCartEventListeners() {
    document.querySelectorAll('.increment-qty, .decrement-qty').forEach(button => {
        button.addEventListener('click', handleQuantityChange);
    });
    document.querySelectorAll('.item-qty-input').forEach(input => {
        input.addEventListener('change', handleQuantityInputChange);
    });
    document.querySelectorAll('.remove-item-btn').forEach(button => {
        button.addEventListener('click', handleRemoveItem);
    });
}

/**
 * Adds event listeners for financial summary interactions (tip, promo).
 * @param {string} containerId - The ID of the summary container.
 * @param {number} subtotal - The current subtotal for tip calculation.
 */
function addSummaryEventListeners(containerId /* removed subtotal */) {
    document.querySelectorAll(`input[name='tip-${containerId}']`).forEach(radio => {
        radio.addEventListener('change', (e) => handleTipChange(e, containerId));
    });
    const promoBtn = document.querySelector(`#${containerId} .apply-promo-btn`); // Ensure selector is specific to container
    if(promoBtn) promoBtn.addEventListener('click', handleApplyPromo);

    // For mobile dialog
    if (containerId === 'financial-summary-mobile-content') {
        const mobileDialog = document.getElementById('mobile-summary-dialog');
        const mobileTrigger = document.getElementById('mobile-summary-view-btn');
        const mobileClose = document.getElementById('mobile-summary-close-btn');

        if (mobileTrigger) mobileTrigger.addEventListener('click', () => mobileDialog?.showModal());
        if (mobileClose) mobileClose.addEventListener('click', () => mobileDialog?.close());
    }
}

/**
 * Adds event listeners for upsell item clicks.
 */
function addUpsellEventListeners() {
    document.querySelectorAll('.upsell-chip').forEach(chip => {
        chip.addEventListener('click', (e) => {
            const itemId = e.currentTarget.dataset.itemId;
            if (itemId) add(itemId, 1);
        });
        chip.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault(); // Prevent default action (e.g., scrolling for space)
                const itemId = e.currentTarget.dataset.itemId;
                if (itemId) {
                    add(itemId, 1);
                }
            }
        });
    });
}

/**
 * Handles quantity change from +/- buttons.
 * @param {Event} event - The click event.
 */
function handleQuantityChange(event) {
    const button = event.currentTarget;
    const itemId = button.dataset.itemId;
    const input = document.getElementById(`qty-${itemId}`);
    if (!input) return;
    let quantity = parseInt(input.value);

    if (button.classList.contains('increment-qty')) {
        quantity++;
    } else if (button.classList.contains('decrement-qty')) {
        quantity = Math.max(1, quantity - 1); // Quantity cannot go below 1 via buttons, use remove for 0
    }
    updateQty(itemId, quantity);
}

/**
 * Handles quantity change from direct input.
 * @param {Event} event - The change event.
 */
function handleQuantityInputChange(event) {
    const input = event.currentTarget;
    const itemId = input.dataset.itemId;
    let quantity = parseInt(input.value);
    if (isNaN(quantity) || quantity < 0) quantity = 0; // Allow setting to 0 to remove
    updateQty(itemId, quantity);
}

/**
 * Handles item removal from cart.
 * @param {Event} event - The click event.
 */
function handleRemoveItem(event) {
    const button = event.currentTarget;
    const itemId = button.dataset.itemId;
    const item = getCart().find(i => i.id === itemId);

    // Optional: Confirmation dialog
    const confirmDialog = document.getElementById('remove-item-confirmation-dialog');
    if (confirmDialog && window.matchMedia("(max-width: 767px)").matches) { // Example: only on mobile
        document.getElementById('item-to-remove-name').textContent = item ? item.name : 'this item';
        confirmDialog.showModal();
        document.getElementById('confirm-remove-btn').onclick = () => {
            animateAndRemove(itemId, button.closest('tr'));
            confirmDialog.close();
        };
        document.getElementById('cancel-remove-btn').onclick = () => confirmDialog.close();
    } else {
        animateAndRemove(itemId, button.closest('tr'));
    }
}

/**
 * Animates item removal then calls cart.remove.
 * @param {string} itemId - ID of item to remove.
 * @param {HTMLElement} rowElement - The table row element to animate.
 */
function animateAndRemove(itemId, rowElement) {
    if (rowElement) {
        rowElement.classList.add('item-removing');
        rowElement.addEventListener('animationend', () => {
            remove(itemId); // Correctly call remove after animation
        }, { once: true });
    } else {
        remove(itemId);
    }
}

/**
 * Handles tip percentage change. Saves the new percentage and triggers a cart update.
 * @param {Event} event - The change event.
 * @param {string} containerId - The ID of the summary container where the change originated.
 */
function handleTipChange(event, containerId) {
    const tipPercentage = parseFloat(event.target.value);
    localStorage.setItem('taconganas_tip_percentage', tipPercentage.toString());
    saveCart(); // Triggers re-render of summaries with new totals via notifyListeners

    // Ensure the other summary's radio button is also checked
    const otherContainerId = containerId.includes('desktop') ? 'financial-summary-mobile-content' : 'financial-summary-desktop';
    const otherRadio = document.querySelector(`input[name='tip-${otherContainerId}'][value='${tipPercentage.toString()}']`);
    if (otherRadio && !otherRadio.checked) {
        otherRadio.checked = true;
    }
}

/**
 * Handles promo code application.
 * @async
 * @param {Event} event - The click event.
 */
async function handleApplyPromo(event) {
    const button = event.currentTarget;
    const inputId = button.dataset.inputId;
    const promoInput = document.getElementById(inputId);
    if (!promoInput) return;

    const promoCode = promoInput.value.trim();
    const containerId = inputId.includes('desktop') ? 'financial-summary-desktop' : 
                      inputId.includes('mobile-content') ? 'financial-summary-mobile-content' : 
                      (document.getElementById('checkout-order-summary-container') ? 'checkout-order-summary-container' : ''); // Adjust for checkout if needed

    const messageEl = document.getElementById(`promo-message-${containerId}`) || document.getElementById('promo-message-checkout'); // Fallback for checkout if specific ID used

    if (!messageEl) {
        console.error("Promo message element not found for container:", containerId);
        return;
    }
    
    if (!promoCode) {
        messageEl.textContent = 'Please enter a promo code.';
        messageEl.className = 'promo-message error';
        localStorage.removeItem('taconganas_promo'); // Clear any existing promo if input is blanked
        saveCart(); // Re-render to remove discount
        return;
    }

    messageEl.textContent = 'Validating...';
    messageEl.className = 'promo-message loading';

    try {
        // Simulate API call
        await new Promise(resolve => setTimeout(resolve, 750)); // Simulate network delay
        
        let promoData = { valid: false, message: 'Invalid promo code. Try TACOLOVE15 or GANAS5OFF.', code: promoCode, discountType: null, discountValue: 0 };

        if (promoCode.toUpperCase() === 'TACOLOVE15') {
            promoData = { valid: true, message: '15% off applied!', code: promoCode, discountType: 'percentage', discountValue: 0.15 };
        } else if (promoCode.toUpperCase() === 'GANAS5OFF') {
            promoData = { valid: true, message: '$5 off applied!', code: promoCode, discountType: 'fixed', discountValue: 5 };
        }

        if (promoData.valid) {
            localStorage.setItem('taconganas_promo', JSON.stringify(promoData));
            messageEl.textContent = promoData.message;
            messageEl.className = 'promo-message success';
        } else {
            localStorage.removeItem('taconganas_promo');
            messageEl.textContent = promoData.message;
            messageEl.className = 'promo-message error';
        }
        saveCart(); // Trigger re-render with new promo state
    } catch (error) {
        console.error('Promo validation error:', error);
        localStorage.removeItem('taconganas_promo');
        messageEl.textContent = 'Could not validate promo code. Please try again.';
        messageEl.className = 'promo-message error';
        saveCart(); // Re-render if error
    }
}

// --- Checkout Page Specific Rendering --- //

/**
 * Renders the order summary on the checkout page.
 * @param {Object} cartState - The current state of the cart.
 */
function renderCheckoutSummary(cartState) {
    const summaryContainer = document.getElementById('checkout-order-summary-container');
    if (!summaryContainer) return; // Only run on checkout page

    const { subtotal, taxAmount, total, itemCount } = cartState;
    // Tip is handled by DoorDash quote or selected on order page, assume it's included in `total` if applicable
    // For checkout, we typically show the final total from cart state which includes tip chosen on order page.
    const tipPercentage = parseFloat(localStorage.getItem('taconganas_tip_percentage') || '0');
    const finalTotal = subtotal + taxAmount + (subtotal * tipPercentage);

    summaryContainer.innerHTML = `
        <div class="summary-row">
            <span>Subtotal (${itemCount} ${itemCount === 1 ? 'item' : 'items'})</span>
            <span>$${subtotal.toFixed(2)}</span>
        </div>
        <div class="summary-row">
            <span>Sales Tax</span>
            <span>$${taxAmount.toFixed(2)}</span>
        </div>
        ${tipPercentage > 0 ? `
        <div class="summary-row">
            <span>Tip (${(tipPercentage * 100).toFixed(0)}%)</span>
            <span>$${(subtotal * tipPercentage).toFixed(2)}</span>
        </div>` : ''}
        <div class="summary-row total">
            <span>Order Total</span>
            <span id="checkout-grand-total">$${finalTotal.toFixed(2)}</span>
        </div>
    `;
}

// Initialize cart on DOMContentLoaded
document.addEventListener('DOMContentLoaded', initCart);

// Exports for other modules
export {
    add,
    remove,
    updateQty,
    clear,
    getCart,
    getTotals,
    getCartState,
    onChange,
    doorDashPayload,
    loadMenuData, // Export for checkout.js if it needs menu details for out-of-stock
    includeHTML // Export if app.js doesn't handle this
};
