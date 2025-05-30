import { add as addToCart, updateQty as updateCartQty, getCart } from '../order/cart.js';

const API_URL = '../data/menu.json';
const STOCK_API_URL = '/items/stock'; // Placeholder for DoorDash API
const DEFAULT_LANG = 'en';
const LANG_STORAGE_KEY = 'tg_lang';

let allMenuItems = [];
let currentMenuItems = [];
let availableMeats = []; // To store meat options
let currentLang = localStorage.getItem(LANG_STORAGE_KEY) || DEFAULT_LANG;
let meatFilters = new Set();
let lastAddedItem = null; // For undo functionality
let stockData = {}; // To store item stock levels

// DOM Elements
const heroTagline = document.getElementById('hero-tagline');
const viewTacosBtn = document.getElementById('view-tacos-btn');
const langToggleBtn = document.getElementById('lang-toggle');
const langEnSpan = langToggleBtn.querySelector('.lang-en');
const langEsSpan = langToggleBtn.querySelector('.lang-es');
const searchBar = document.getElementById('search-bar');
const meatFilterRibbon = document.getElementById('meat-filter-ribbon');
const dishGrid = document.getElementById('dish-grid');
const noResultsDiv = document.getElementById('no-results');
const mainContent = document.getElementById('main-content');

// Modal Elements
const quickViewModal = document.getElementById('quick-view-modal');
const modalCloseBtn = document.getElementById('modal-close-btn');
const modalImg = document.getElementById('modal-img');
const modalSvgFallback = document.getElementById('modal-svg-fallback');
const modalDishNameEn = document.getElementById('modal-dish-name-en');
const modalDishNameEs = document.getElementById('modal-dish-name-es');
const modalDishDesc = document.getElementById('modal-dish-desc');
const modalMeatSelectorDiv = document.getElementById('modal-meat-selector');
const modalMeatOptions = document.getElementById('modal-meat-options');
const modalQuantityInput = document.getElementById('modal-quantity');
const modalDecreaseQtyBtn = quickViewModal.querySelector('.stepper-btn[data-action="decrease"]');
const modalIncreaseQtyBtn = quickViewModal.querySelector('.stepper-btn[data-action="increase"]');
const modalAddToCartBtn = document.getElementById('modal-add-to-cart-btn');

// Cart Dock Elements
const cartDock = document.getElementById('cart-dock');
const cartItemCountBadge = document.getElementById('cart-item-count');
const cartTotalPricePill = document.getElementById('cart-total-price');

// Toast Container
const toastContainer = document.getElementById('toast-container');

const FALLBACK_SVG_ICON = `
<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" fill="currentColor" aria-hidden="true">
  <path d="M89.6,38.8c-0.2-1.9-0.6-3.8-1.2-5.5c-0.7-1.7-1.6-3.3-2.7-4.8c-1.1-1.4-2.4-2.7-3.8-3.8
    c-1.5-1.1-3.1-2-4.8-2.7c-1.8-0.6-3.6-1-5.5-1.2c-0.1,0-0.2,0-0.3,0c-1.2,0-2.4-0.1-3.6-0.1c0,0,0,0,0,0c0,0,0,0,0,0
    c-1.2,0-2.4,0.1-3.6,0.1c-0.1,0-0.2,0-0.3,0c-1.9,0.2-3.8,0.6-5.5,1.2c-1.7,0.7-3.3,1.6-4.8,2.7c-1.4,1.1-2.7,2.4-3.8,3.8
    c-1.1,1.5-2,3.1-2.7,4.8c-0.6,1.8-1,3.6-1.2,5.5c0,0.1,0,0.2,0,0.3c0,1.2,0.1,2.4,0.1,3.6c0,0,0,0,0,0c0,0,0,0,0,0
    c0,1.2-0.1,2.4-0.1,3.6c0,0.1,0,0.2,0,0.3c0.2,1.9,0.6,3.8,1.2,5.5c0.7,1.7,1.6,3.3,2.7,4.8c1.1,1.4,2.4,2.7,3.8,3.8
    c1.5,1.1,3.1,2,4.8,2.7c1.8,0.6,3.6,1,5.5,1.2c0.1,0,0.2,0,0.3,0c1.2,0,2.4,0.1,3.6,0.1c0,0,0,0,0,0c0,0,0,0,0,0
    c1.2,0,2.4-0.1,3.6-0.1c0.1,0,0.2,0,0.3,0c1.9-0.2,3.8-0.6,5.5-1.2c1.7-0.7,3.3-1.6,4.8-2.7c1.4-1.1,2.7-2.4,3.8-3.8
    c1.1-1.5,2-3.1,2.7-4.8c0.6-1.8,1-3.6,1.2-5.5c0-0.1,0-0.2,0-0.3c0-1.2-0.1-2.4-0.1-3.6c0,0,0,0,0,0c0,0,0,0,0,0
    C89.5,41.2,89.6,40,89.6,38.8z M50,80C27.9,80,10,62.1,10,40S27.9,0,50,0s40,17.9,40,40S72.1,80,50,80z"/>
  <path d="M70.7,61.8C66.3,66.9,60,70,50,70c-4.8,0-9.4-1.2-13.3-3.4l-3.3,9.1c1.4,0.5,2.8,0.9,4.3,1.2c0.1,0,0.1,0,0.2,0
    c1.2,0.2,2.4,0.4,3.6,0.5c0.9,0.1,1.8,0.2,2.7,0.2c0.1,0,0.1,0,0.2,0c0.9,0,1.8-0.1,2.7-0.2c1.2-0.1,2.4-0.3,3.6-0.5
    c0.1,0,0.1,0,0.2,0c1.5-0.3,3-0.7,4.3-1.2l-3.3-9.1C61.1,60.6,66.1,60.1,70.7,61.8z"/>
  <path d="M81.2,47.2c-1.6-1.2-3.3-2.2-5.1-3c-0.6-0.3-1.2-0.5-1.8-0.8c-0.6-0.2-1.2-0.4-1.8-0.6c-1.1-0.4-2.3-0.7-3.4-1
    c-1.2-0.3-2.5-0.5-3.7-0.6c-1.1-0.1-2.1-0.2-3.2-0.2c-0.1,0-0.1,0-0.2,0c-1.1,0-2.1,0.1-3.2,0.2c-1.2,0.1-2.5,0.3-3.7,0.6
    c-1.1,0.3-2.3,0.6-3.4,1c-0.6,0.2-1.2,0.4-1.8,0.6c-0.6,0.3-1.2,0.5-1.8,0.8c-1.8,0.8-3.5,1.8-5.1,3C20.6,52.5,15,58.9,15,66
    c0,4.4,3.6,8,8,8h54c4.4,0,8-3.6,8-8C85,58.9,79.4,52.5,81.2,47.2z"/>
</svg>
`;

// --- Initialization ---
async function initializeMenu() {
    setLanguageUI(currentLang);
    updateCartDisplay(); // Initial cart display update

    try {
        const response = await fetch(API_URL);
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        const menuData = await response.json();

        // Extract meats first
        const meatsSection = menuData.sections.find(s => s.type === 'meats');
        if (meatsSection && meatsSection.options) {
            availableMeats = meatsSection.options.map(meat => ({
                id: sanitizeForId(meat.name_en), // Use sanitized English name as ID for meats
                name_en: meat.name_en,
                name_es: meat.name_es,
                description_en: meat.description_en,
                description_es: meat.description_es,
            }));
        }
        
        allMenuItems = [];
        menuData.sections.forEach(section => {
            if (section.type === 'dishes' || section.type === 'extras') {
                section.items.forEach(item => {
                    const itemId = sanitizeForId(item.name_en); // Generate ID
                    allMenuItems.push({
                        ...item,
                        id: itemId, // Add generated ID
                        category: section.title_en, // Use section title as category
                        // Ensure photo path is constructed if not directly available
                        photo: item.photo || `${itemId}.jpeg`, // Default photo naming convention
                        // Ensure englishName and spanishName fields are consistent with original expectation
                        englishName: item.name_en,
                        spanishName: item.name_es,
                        descriptionEN: item.description_en,
                        descriptionES: item.description_es
                    });
                });
            }
        });

        currentMenuItems = [...allMenuItems];
        
        populateMeatFilters();
        renderDishGrid();
        checkUrlParams();
        // fetchStockLevels(); // Initial stock fetch
        // setInterval(fetchStockLevels, 2 * 60 * 1000); // Fetch stock every 2 minutes
    } catch (error) {
        console.error("Failed to load menu data:", error);
        displayError("Could not load the menu. Please check your connection and try again.", true);
    }

    addEventListeners();
}

function addEventListeners() {
    viewTacosBtn.addEventListener('click', () => {
        const firstSection = document.querySelector('.filters-section') || mainContent;
        firstSection.scrollIntoView({ behavior: 'smooth' });
    });

    langToggleBtn.addEventListener('click', toggleLanguage);
    searchBar.addEventListener('input', debounce(handleSearch, 250));
    searchBar.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            const firstCard = dishGrid.querySelector('.dish-card button, .dish-card a');
            if (firstCard) {
                firstCard.focus();
            } else if (currentMenuItems.length === 0) {
                showToast('No se encontró nada 😢', 'confetti', 3000);
            }
        }
    });

    dishGrid.addEventListener('click', handleGridClick);
    
    // Modal listeners
    modalCloseBtn.addEventListener('click', () => quickViewModal.close());
    quickViewModal.addEventListener('close', () => {
        document.body.style.overflow = ''; // Restore scroll
    });
    modalDecreaseQtyBtn.addEventListener('click', () => updateModalQuantity(-1));
    modalIncreaseQtyBtn.addEventListener('click', () => updateModalQuantity(1));
    modalQuantityInput.addEventListener('change', () => {
        let val = parseInt(modalQuantityInput.value);
        if (isNaN(val) || val < 1) val = 1;
        modalQuantityInput.value = val;
    });
    modalAddToCartBtn.addEventListener('click', handleModalAddToCart);

    // Listen for custom cart events (if cart.js dispatches them on window or a specific element)
    window.addEventListener('cart-changed', updateCartDisplay);
}

// --- Language Handling ---
function setLanguageUI(lang) {
    currentLang = lang;
    localStorage.setItem(LANG_STORAGE_KEY, lang);
    document.documentElement.lang = lang;

    if (lang === 'es') {
        langEnSpan.style.display = 'none';
        langEsSpan.style.display = 'inline';
        langToggleBtn.setAttribute('data-lang', 'es');
        heroTagline.textContent = "Felicidad Portátil, Hecha al Momento."; // Example translation
        searchBar.placeholder = "Buscar tacos, tortas, ramen...";
        // Update other static text if necessary
    } else {
        langEnSpan.style.display = 'inline';
        langEsSpan.style.display = 'none';
        langToggleBtn.setAttribute('data-lang', 'en');
        heroTagline.textContent = "Hand-Held Happiness, Made Fresh.";
        searchBar.placeholder = "Search tacos, tortas, ramen...";
    }
    if (allMenuItems.length > 0) renderDishGrid(); // Re-render grid with new language
    if (quickViewModal.open) {
        const itemId = modalAddToCartBtn.dataset.itemId;
        if (itemId) {
            const item = allMenuItems.find(i => i.id === itemId);
            if (item) populateModal(item); // Re-populate modal if open
        }
    }
}

function toggleLanguage() {
    const newLang = currentLang === 'en' ? 'es' : 'en';
    setLanguageUI(newLang);
}

function getLocalizedText(item, fieldName) {
    const baseField = fieldName.replace('EN', '').replace('ES', '');
    if (currentLang === 'es') {
        // Adjust for new JSON structure (e.g., name_es, description_es)
        if (item[`${baseField}_es`]) return item[`${baseField}_es`];
        if (item[`${fieldName}ES`]) return item[`${fieldName}ES`]; // Fallback for older fields if any
    }
    // Adjust for new JSON structure (e.g., name_en, description_en)
    if (item[`${baseField}_en`]) return item[`${baseField}_en`];
    if (item[`${fieldName}EN`]) return item[`${fieldName}EN`]; // Fallback
    return item[baseField] || item[fieldName]; // Fallback to base field or original fieldName
}

// --- Filtering and Searching ---
function populateMeatFilters() {
    // Use availableMeats populated from menu.json
    meatFilterRibbon.innerHTML = ''; // Clear existing
    
    const allChip = createFilterChip('All', 'all', true); // 'All' is always an option
    meatFilterRibbon.appendChild(allChip);

    availableMeats.forEach(meat => {
        // Use meat.name_en for label and meat.id for value (sanitized name_en)
        const chip = createFilterChip(getLocalizedText(meat, 'name'), meat.id);
        meatFilterRibbon.appendChild(chip);
    });
}

function createFilterChip(label, value, isActive = false) {
    const chip = document.createElement('button');
    chip.className = 'meat-filter-chip';
    chip.textContent = label;
    chip.dataset.filterValue = value;
    chip.setAttribute('role', 'radio'); // Changed from checkbox to radio as it seems more appropriate for single select filter
    chip.setAttribute('aria-checked', isActive.toString());
    if (isActive) meatFilters.add(value);

    chip.addEventListener('click', () => handleMeatFilterClick(chip, value));
    return chip;
}

function handleMeatFilterClick(clickedChip, filterValue) {
    // Single select logic for meat filters
    meatFilterRibbon.querySelectorAll('.meat-filter-chip').forEach(chip => {
        const isClicked = chip === clickedChip;
        chip.setAttribute('aria-checked', isClicked.toString());
        if (isClicked) {
            meatFilters.clear();
            if (filterValue !== 'all') meatFilters.add(filterValue);
        } 
    });
    applyFiltersAndSearch();
    updateUrlForFilter(filterValue === 'all' ? '' : filterValue);
}

function handleSearch() {
    applyFiltersAndSearch();
}

function applyFiltersAndSearch() {
    const searchTerm = searchBar.value.toLowerCase().trim();
    currentMenuItems = allMenuItems.filter(item => {
        // Meat filter logic needs to check `allows_meat_choice` 
        // and if the selected meat filter matches any potential meat for the item.
        // This is complex if a dish doesn't have a specific meat but allows choice.
        // For now, if a meat filter is active (not 'all'), we assume items that
        // don't allow meat choice are filtered out, unless they inherently match the meat (e.g. "Shrimp Taco" and "Shrimp" filter).
        // A more robust solution might involve tagging items with applicable meats or categories.

        let matchesMeat = true; // Default to true if no meat filter or 'all'
        if (meatFilters.size > 0 && !meatFilters.has('all')) {
            const selectedMeatFilter = Array.from(meatFilters)[0]; // Assuming single select for meats
            if (item.allows_meat_choice) {
                // If item allows meat choice, it could potentially match any meat.
                // The actual meat is chosen in the modal.
                // For filtering, we might need to decide if these items always show, or if they need a specific 'meat' tag.
                // For simplicity here, if a meat filter is on, and item allows choice, we assume it *could* be that meat.
                // This might need refinement based on desired UX.
                // A direct item.meat property would simplify this.
                // Let's assume for now it matches if it allows choice.
                matchesMeat = true; 
            } else if (item.name_en.toLowerCase().includes(selectedMeatFilter.replace('_',' '))) {
                // Item doesn't allow meat choice, so its name must contain the meat.
                matchesMeat = true;
            } else {
                matchesMeat = false;
            }
        }

        const nameEn = item.name_en ? item.name_en.toLowerCase() : '';
        const nameEs = item.name_es ? item.name_es.toLowerCase() : '';
        const descEn = item.description_en ? item.description_en.toLowerCase() : '';
        const descEs = item.description_es ? item.description_es.toLowerCase() : '';

        const matchesSearch = !searchTerm || 
                              nameEn.includes(searchTerm) || 
                              nameEs.includes(searchTerm) || 
                              descEn.includes(searchTerm) || 
                              descEs.includes(searchTerm);
        return matchesMeat && matchesSearch;
    });
    renderDishGrid();
}

function checkUrlParams() {
    const urlParams = new URLSearchParams(window.location.search);
    const meatParam = urlParams.get('meat');
    if (meatParam) {
        const targetChip = meatFilterRibbon.querySelector(`[data-filter-value="${meatParam}"]`);
        if (targetChip) {
            handleMeatFilterClick(targetChip, meatParam);
        }
    }
}

function updateUrlForFilter(meatValue) {
    const url = new URL(window.location);
    if (meatValue) {
        url.searchParams.set('meat', meatValue);
    } else {
        url.searchParams.delete('meat');
    }
    window.history.pushState({}, '', url);
}

// --- Rendering Dish Grid ---
function renderDishGrid() {
    dishGrid.innerHTML = ''; // Clear previous items
    if (currentMenuItems.length === 0) {
        const message = searchBar.value ? "No dishes match your search. Try a different term!" : "No dishes available for this filter.";
        displayError(message, false);
        return;
    }
    noResultsDiv.style.display = 'none';

    const fragment = document.createDocumentFragment();
    currentMenuItems.forEach(item => {
        const card = createDishCard(item);
        fragment.appendChild(card);
    });
    dishGrid.appendChild(fragment);
    lazyLoadImages();
}

function createDishCard(item) {
    const card = document.createElement('article');
    card.className = 'dish-card';
    // item.id is now generated in initializeMenu
    card.dataset.itemId = item.id; 
    card.setAttribute('aria-labelledby', `dish-name-${item.id}`);

    const isSoldOut = stockData[item.id] === 0;
    const isLowStock = stockData[item.id] > 0 && stockData[item.id] < 5;

    if (isSoldOut) card.classList.add('sold-out');
    if (isLowStock) card.classList.add('low-stock');

    // Ensure item.photo is correctly used or generated
    const imagePath = `../images/menu/${item.photo || sanitizeForId(item.name_en) + '.jpeg'}`;

    card.innerHTML = `
        ${isLowStock ? '<div class="stock-overlay almost-gone">ALMOST GONE</div>' : ''}
        ${isSoldOut ? '<div class="stock-overlay sold-out-text">Sold Out</div>' : ''}
        <div class="dish-image-container">
            <img data-src="${imagePath}" alt="${item.name_en}" class="lazy-image">
            <div class="fallback-svg" style="display:none;">${FALLBACK_SVG_ICON}</div>
        </div>
        <div class="dish-info">
            <h3 id="dish-name-${item.id}" class="dish-name-en">${item.name_en}</h3>
            <p class="dish-name-es spanish-name">${item.name_es}</p>
            <!-- Description can be added here if needed on card -->
        </div>
        <span class="price-badge">$${item.price.toFixed(2)}</span>
        <button class="add-to-cart-fab ${isSoldOut ? 'disabled' : ''}" 
                aria-label="Add ${item.name_en} to cart" 
                data-item-id="${item.id}" 
                ${isSoldOut ? 'disabled' : ''}>
            <svg viewBox="0 0 50 24"><path d="M23,14.5 h-8.5 v8.5 h-5 v-8.5 H1 v-5 h8.5 V1 h5 v8.5 H23 v5z"/></svg>
        </button>
    `;

    const img = card.querySelector('.lazy-image');

    img.addEventListener('error', () => handleImageError(img, card));
    
    // Card click opens modal (but not if FAB is clicked)
    card.addEventListener('click', (e) => {
        if (!e.target.closest('.add-to-cart-fab')) {
            // item.id is now from the processed allMenuItems
            openQuickViewModal(item.id);
        }
    });

    return card;
}

function handleImageError(imgElement, cardElement) {
    imgElement.style.display = 'none';
    cardElement.querySelector('.fallback-svg').style.display = 'flex';
    cardElement.classList.add('img-missing');
}

// --- Lazy Loading Images ---
let observer;
function lazyLoadImages() {
    const images = document.querySelectorAll('img.lazy-image[data-src]');
    if (!observer) {
        observer = new IntersectionObserver((entries, obs) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    const img = entry.target;
                    img.src = img.dataset.src;
                    img.removeAttribute('data-src');
                    img.classList.remove('lazy-image');
                    obs.unobserve(img);
                }
            });
        }, { rootMargin: "0px 0px 200px 0px" }); // Load images 200px before they enter viewport
    }
    images.forEach(img => observer.observe(img));
}

// --- Quick View Modal ---
function openQuickViewModal(itemId) {
    const item = allMenuItems.find(i => i.id === itemId);
    if (!item) return;

    populateModal(item);

    document.body.style.overflow = 'hidden'; // Prevent background scroll
    quickViewModal.showModal();
}

function populateModal(item) {
    // item.photo should be correct from the processed allMenuItems
    modalImg.src = `../images/menu/${item.photo || sanitizeForId(item.name_en) + '.jpeg'}`;
    modalImg.alt = item.name_en;
    modalImg.onerror = () => {
        modalImg.style.display = 'none';
        modalSvgFallback.style.display = 'flex';
        modalSvgFallback.innerHTML = FALLBACK_SVG_ICON;
    };
    modalImg.onload = () => {
        modalImg.style.display = 'block';
        modalSvgFallback.style.display = 'none';
    }

    modalDishNameEn.textContent = item.name_en;
    modalDishNameEs.textContent = item.name_es;
    modalDishDesc.textContent = getLocalizedText(item, 'description'); // Uses new field names like description_en / description_es

    if (item.allows_meat_choice) {
        modalMeatOptions.innerHTML = ''; // Clear previous
        availableMeats.forEach(meat => {
            const option = document.createElement('option');
            option.value = meat.id; // meat.id is sanitized name_en
            option.textContent = getLocalizedText(meat, 'name'); // Display localized meat name
            modalMeatOptions.appendChild(option);
        });
        modalMeatSelectorDiv.style.display = 'block';
    } else {
        modalMeatSelectorDiv.style.display = 'none';
    }

    modalQuantityInput.value = 1;
    modalAddToCartBtn.dataset.itemId = item.id;
    modalAddToCartBtn.dataset.itemName = item.name_en; // For toast message
    modalAddToCartBtn.dataset.itemPrice = item.price;

    // Disable add button if sold out
    const isSoldOut = stockData[item.id] === 0;
    modalAddToCartBtn.disabled = isSoldOut;
    modalAddToCartBtn.textContent = isSoldOut ? 'Sold Out' : 'Add & Close';
}

function updateModalQuantity(change) {
    let currentValue = parseInt(modalQuantityInput.value);
    currentValue += change;
    if (currentValue < 1) currentValue = 1;
    modalQuantityInput.value = currentValue;
}

function handleModalAddToCart() {
    const itemId = modalAddToCartBtn.dataset.itemId;
    // const itemName = modalAddToCartBtn.dataset.itemName; // Already have item from allMenuItems
    // const itemPrice = parseFloat(modalAddToCartBtn.dataset.itemPrice); // Already have item
    const quantity = parseInt(modalQuantityInput.value);

    const originalItem = allMenuItems.find(i => i.id === itemId);
    if (!originalItem) {
        console.error("Original item not found for modal add to cart:", itemId);
        return;
    }
    const itemName = originalItem.name_en; // Use consistent name source
    const itemPrice = originalItem.price;
    
    let chosenMeat = null;
    let finalItemId = itemId; // Base item ID
    let finalItemName = itemName;

    if (modalMeatSelectorDiv.style.display === 'block' && modalMeatOptions.value) {
        const selectedMeatId = modalMeatOptions.value;
        const meatInfo = availableMeats.find(m => m.id === selectedMeatId);
        if (meatInfo) {
            chosenMeat = getLocalizedText(meatInfo, 'name');
            // Create a variant ID for items with meat choice for the cart
            // e.g., "quesadilla_asada" instead of just "quesadilla"
            finalItemId = `${itemId}_${selectedMeatId}`;
            finalItemName = `${itemName} (${chosenMeat})`;
        }
    }
    
    const itemToAdd = {
        id: finalItemId, 
        name: finalItemName, 
        price: itemPrice, 
        // baseId: itemId, // Could be useful for stock checking the base item
        // chosenMeat: chosenMeat // Store chosen meat for display in cart or re-population
    };

    const existingCartItem = getCart().find(ci => ci.id === finalItemId);
    if (existingCartItem) {
        updateCartQty(finalItemId, existingCartItem.quantity + quantity);
    } else {
        addToCart(itemToAdd, quantity); 
    }
    
    lastAddedItem = { itemId: finalItemId, quantity, originalItemId: itemId, chosenMeat }; // Store for potential undo

    showToast(`${quantity} ${finalItemName}${quantity > 1 ? 's' : ''} added to cart!`, 'success', 6000, true);
    animateCartBadge();
    quickViewModal.close();
}

// --- Cart Interaction ---
function handleGridClick(event) {
    const fabButton = event.target.closest('.add-to-cart-fab');
    if (fabButton && !fabButton.disabled) {
        const itemId = fabButton.dataset.itemId;
        const item = allMenuItems.find(i => i.id === itemId);
        if (item) {
            // If item allows meat choice, adding from grid FAB might be ambiguous.
            // For simplicity, if it allows meat choice, we could:
            // 1. Open the modal instead. (Preferred for clarity)
            // 2. Add a "default" version if applicable.
            // 3. Disable FAB if meat choice is mandatory and not made.
            // Current prompt implies FAB adds directly. If it allows_meat_choice, it adds the "base" item, and meat is chosen later or is a generic version.
            // Or, better, if allows_meat_choice, the FAB should perhaps open the modal.
            // For now, sticking to direct add as per initial FAB spec, but this is a UX consideration.
            // The prompt says: "Add-to-Cart FAB bottom-right... Click card reveals Quick-View Modal"
            // "When user clicks “Add”, visual +3 count animates onto dock; function add(itemId,1) is called."
            // This implies FAB adds directly. If allows_meat_choice, it will add the base item without specific meat.

            let itemToAddId = item.id;
            let itemToAddName = item.name_en;
            let itemToAddPrice = item.price;

            // If the item *requires* a meat choice and it's not specified (e.g. a generic "Quesadilla" item)
            // this direct add might be problematic. The current menu.json structure has items like
            // "TACONGANAS [SPECIALTY TACOS]" which implies a meat choice is needed.
            // The `add` function in cart.js would need to handle this.
            // For items that are specific (e.g., "Shrimp Taco"), this is fine.

            if (item.allows_meat_choice) {
                // To make the FAB work for items allowing meat choice without opening modal first,
                // we might need to pick a default meat or create a generic entry.
                // Or, the requirement means the FAB on such items should behave differently (e.g. open modal).
                // Given the spec "Click card reveals Quick-View Modal", and FAB is on the card,
                // it's safer to assume FAB adds the item as is, and modal handles variants.
                // If `item.id` is "quesadilla" and it allows meat choice, cart needs to know.
                // The current `addToCart` takes `item` object.
                // Let's assume for now that `item.id` is unique enough for the base item.
                // The modal handles creating variant IDs like `quesadilla_asada`.
                // So, FAB adds the base item.
            }


            const existingCartItem = getCart().find(ci => ci.id === itemToAddId);
            if (existingCartItem) {
                updateCartQty(itemToAddId, existingCartItem.quantity + 1);
            } else {
                addToCart({ id: itemToAddId, name: itemToAddName, price: itemToAddPrice }, 1);
            }
            lastAddedItem = { itemId: itemToAddId, quantity: 1, originalItemId: item.id }; // Store for potential undo
            showToast(`${itemToAddName} added to cart!`, 'success', 6000, true);
            animateCartBadge();
            // Announce for screen readers
            announcePolitely(`${itemToAddName} added to cart.`);
        }
    }
}

function updateCartDisplay() {
    const cart = getCart();
    let totalItems = 0;
    let totalPrice = 0;
    cart.forEach(item => {
        totalItems += item.quantity;
        totalPrice += item.price * item.quantity;
    });

    cartItemCountBadge.textContent = totalItems;
    cartTotalPricePill.textContent = `$${totalPrice.toFixed(2)}`;
    
    // Show/hide cart dock based on items
    cartDock.style.display = cart.length > 0 ? 'flex' : 'none';
}

function animateCartBadge() {
    cartItemCountBadge.style.transition = 'none'; // Remove transition for immediate scale up
    cartItemCountBadge.style.transform = 'scale(1.3)';
    setTimeout(() => {
        cartItemCountBadge.style.transition = 'transform 0.2s ease-out'; // Add transition back
        cartItemCountBadge.style.transform = 'scale(1)';
    }, 100);
}

// --- Stock Level Handling (Placeholder) ---
async function fetchStockLevels() {
    // This is a placeholder. In a real scenario, you'd fetch from an endpoint like DoorDash's.
    // For now, we'll simulate some items being low or out of stock.
    console.log("Fetching stock levels (simulated)...");
    try {
        // const response = await fetch(STOCK_API_URL);
        // if (!response.ok) throw new Error('Stock API fetch failed');
        // const liveStockData = await response.json(); 
        // stockData = liveStockData; 

        // Simulated data based on generated IDs:
        if (allMenuItems.length > 0) {
            const firstItemId = allMenuItems[0].id;
            if (firstItemId && stockData[firstItemId] === undefined) stockData[firstItemId] = 3; // Low stock

            if (allMenuItems.length > 1) {
                const secondItemId = allMenuItems[1].id;
                if (secondItemId && stockData[secondItemId] === undefined) stockData[secondItemId] = 0; // Sold out
            }
        }

        renderDishGrid(); // Re-render to reflect stock changes
    } catch (error) {
        console.error("Error fetching stock levels:", error);
        // Don't disrupt user if stock fetch fails, but log it.
    }
}

// --- Toast Notifications ---
let toastTimeout;
function showToast(message, type = 'info', duration = 3000, showUndo = false) {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    
    const messageSpan = document.createElement('span');
    messageSpan.className = 'toast-message';
    messageSpan.textContent = message;
    toast.appendChild(messageSpan);

    if (showUndo && lastAddedItem) {
        const undoButton = document.createElement('button');
        undoButton.className = 'toast-undo-btn';
        undoButton.textContent = 'UNDO';
        undoButton.setAttribute('aria-label', 'Undo last add to cart');
        undoButton.onclick = () => {
            undoLastAddToCart();
            toast.remove();
            clearTimeout(toastTimeout);
        };
        toast.appendChild(undoButton);
    }

    toastContainer.appendChild(toast);
    
    // Trigger animation
    setTimeout(() => toast.classList.add('show'), 50);

    clearTimeout(toastTimeout); // Clear existing timeout if a new toast appears
    toastTimeout = setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 500); // Remove from DOM after fade out
    }, duration);
}

function undoLastAddToCart() {
    if (!lastAddedItem) return;

    const { itemId, quantity, originalItemId, chosenMeat } = lastAddedItem; // itemId here is potentially variantId
    const cart = getCart();
    // itemId is the one used in cart (e.g., quesadilla_asada)
    const itemInCart = cart.find(ci => ci.id === itemId); 

    if (itemInCart) {
        if (itemInCart.quantity - quantity <= 0) {
            updateCartQty(itemId, 0); 
            showToast('Item removed from cart.', 'info', 3000);
        } else {
            updateCartQty(itemId, itemInCart.quantity - quantity);
            showToast('Last item quantity reduced.', 'info', 3000);
        }
    }
    lastAddedItem = null;
    // updateCartDisplay(); // cart-changed event should also trigger this
    // Manually trigger cart update as cart.js might not be fully implemented/dispatching events
    const customEvent = new CustomEvent('cart-changed');
    window.dispatchEvent(customEvent);
}

// --- Error Handling & Fallbacks ---
function displayError(message, showRetry = false) {
    noResultsDiv.innerHTML = ''; // Clear previous content
    const msgElement = document.createElement('p');
    msgElement.textContent = message;
    noResultsDiv.appendChild(msgElement);

    if (showRetry) {
        const retryButton = document.createElement('button');
        retryButton.className = 'cta-button retry-btn';
        retryButton.textContent = 'Retry';
        retryButton.onclick = () => {
            noResultsDiv.style.display = 'none';
            initializeMenu();
        };
        noResultsDiv.appendChild(retryButton);
    }
    noResultsDiv.style.display = 'block';
    dishGrid.innerHTML = ''; // Ensure grid is empty
}

// --- Utilities ---
function debounce(func, delay) {
    let timeout;
    return function(...args) {
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(this, args), delay);
    };
}

function sanitizeForId(text) {
    if (!text) return '';
    return text.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
}

let liveRegion;
function announcePolitely(message) {
    if (!liveRegion) {
        liveRegion = document.createElement('div');
        liveRegion.setAttribute('aria-live', 'polite');
        liveRegion.classList.add('visually-hidden');
        document.body.appendChild(liveRegion);
    }
    liveRegion.textContent = message;
}

// --- Start the application ---
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeMenu);
} else {
    initializeMenu();
}
