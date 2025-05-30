'use strict';

import flatpickr from "https://cdn.jsdelivr.net/npm/flatpickr@4/dist/flatpickr.min.js";
import { Spanish } from "https://cdn.jsdelivr.net/npm/flatpickr@4/dist/l10n/es.js";
import { formatCurrency } from '../js/utils/formatter.js';
import { showToast } from '../js/ui/toast.js'; // Assuming this exists and works as in menu.js
import { validateEmail, validatePhone } from '../js/utils/validator.js';
// Confetti needs to be imported if used from a library, or implemented.
// For this, we'll assume a simple confetti function if no library is specified.
// If using a library like 'canvas-confetti', it would be: import confetti from 'canvas-confetti';

const LS_CATER_CART = 'tg_cater_cart';
const SESSION_MENU_CACHE = 'tg_catering_menu'; // Use a different cache key for catering menu if it can differ
const LANG_STORAGE_KEY = 'tg_lang';
const FORM_ID = '#cateringForm';
const MIN_ORDER_AMOUNT = 250;
const SERVICE_FEE_RATE = 0.18;
const TAX_RATE = 0.0975; // TN Tax Rate
const CSRF_META_SELECTOR = 'meta[name="csrf-token"]';
const HCAPTCHA_SITEKEY = import.meta.env?.VITE_HCAPTCHA_SITEKEY || null; // Adjusted for Vite/Snowpack like env vars

let menuData = [];
let cateringCart = JSON.parse(sessionStorage.getItem(LS_CATER_CART) || '[]');
let currentLang = localStorage.getItem(LANG_STORAGE_KEY) || 'en';
let holidays = [];
let lastRemovedItem = null; // For undo functionality
let undoTimeout = null;
let hcaptchaWidgetId = null;

const translations = {
    en: {
        "hero.title": "Bring the Fiesta to You",
        "hero.subtitle": "Taco bars, birria ramen, quesadillas – we’ve got every craving covered.",
        "hero.button": "Start Booking ↓",
        "step1.title": "Event Details",
        "step1.dateTimeLegend": "Date & Time",
        "step1.guestContactLegend": "Guests & Contact",
        "form.eventDate": "Event Date",
        "form.startTime": "Start Time",
        "form.endTime": "End Time",
        "form.guestCount": "Number of Guests",
        "form.contactName": "Contact Name",
        "form.contactEmail": "Email",
        "form.contactPhone": "Phone",
        "step2.title": "Build Your Menu",
        "menuTable.caption": "Menu items available for catering",
        "menuTable.item": "Item",
        "menuTable.price": "Price",
        "menuTable.quantity": "Quantity",
        "menuTable.calories": "Calories",
        "menu.showCalories": "Show calories",
        "menu.hideCalories": "Hide calories",
        "summary.title": "Your Quote",
        "summary.subtotal": "Subtotal:",
        "summary.serviceFee": `Service Fee (${SERVICE_FEE_RATE * 100}%):`,
        "summary.tax": `Est. Tax (${TAX_RATE * 100}%):`,
        "summary.grandTotal": "Grand Total:",
        "summary.minOrderWarning": `You’re under the minimum ${formatCurrency(MIN_ORDER_AMOUNT)} order. Add more items to proceed.`,
        "summary.requestButton": "Request Quote →",
        "summary.toggleOpen": "Show Quote Summary",
        "summary.toggleClose": "Hide Quote Summary",
        "filter.all": "All",
        "filter.tacos": "Tacos",
        "filter.quesadillas": "Quesadillas",
        "filter.burritos": "Burritos",
        "filter.sides_drinks": "Sides & Drinks",
        "filter.veg": "Veggie", // Example, adjust based on actual data
        "filter.shrimp": "Shrimp", // Example
        "error.required": "This field is required.",
        "error.email": "Please enter a valid email address.",
        "error.phone": "Please enter a valid phone number (e.g., (901) 555-1234).",
        "error.minGuests": "Minimum 10 guests required.",
        "error.maxGuests": "Maximum 500 guests allowed.",
        "error.dateInPast": "Event date cannot be in the past.",
        "error.timeOrder": "End time must be after start time.",
        "error.minOrder": `A minimum order of ${formatCurrency(MIN_ORDER_AMOUNT)} is required.`,
        "toast.timeError": "End time must be after start time. We've adjusted it for you.",
        "toast.formError": "Please correct the errors in the form.",
        "toast.submitError": "Unable to submit your request. Please check your connection and try again.",
        "toast.submitTimeout": "Request timed out. Please try again.",
        "toast.itemAdded": "Added to quote: ",
        "toast.itemRemoved": "Removed from quote: ",
        "toast.itemUpdated": "Quantity updated for: ",
        "toast.cartCleared": "Quote cleared.",
        "toast.recommendation": (num, item) => `Recommended ${num} ${item} for your guest count.`,
        "offline.message": "Could not load menu. Please check your connection and ",
        "offline.retry": "retry",
        "success.title": "¡Gracias!",
        "success.messageP1": (id) => `Your catering request <strong>${id}</strong> has been submitted.`,
        "success.messageP2": "We’ll confirm availability and details within 1 business day.",
        "success.bookAnother": "Book Another Event",
        "undo.button": "Undo",
    },
    es: {
        "hero.title": "Lleva la Fiesta Contigo",
        "hero.subtitle": "Barras de tacos, birria ramen, quesadillas – tenemos cubierto cada antojo.",
        "hero.button": "Comenzar Reserva ↓",
        "step1.title": "Detalles del Evento",
        "step1.dateTimeLegend": "Fecha y Hora",
        "step1.guestContactLegend": "Invitados y Contacto",
        "form.eventDate": "Fecha del Evento",
        "form.startTime": "Hora de Inicio",
        "form.endTime": "Hora de Fin",
        "form.guestCount": "Número de Invitados",
        "form.contactName": "Nombre de Contacto",
        "form.contactEmail": "Correo Electrónico",
        "form.contactPhone": "Teléfono",
        "step2.title": "Arma Tu Menú",
        "menuTable.caption": "Platillos disponibles para catering",
        "menuTable.item": "Platillo",
        "menuTable.price": "Precio",
        "menuTable.quantity": "Cantidad",
        "menuTable.calories": "Calorías",
        "menu.showCalories": "Mostrar calorías",
        "menu.hideCalories": "Ocultar calorías",
        "summary.title": "Tu Cotización",
        "summary.subtotal": "Subtotal:",
        "summary.serviceFee": `Cargo por Servicio (${SERVICE_FEE_RATE * 100}%):`,
        "summary.tax": `Impuesto Estimado (${TAX_RATE * 100}%):`,
        "summary.grandTotal": "Total General:",
        "summary.minOrderWarning": `El pedido mínimo es de ${formatCurrency(MIN_ORDER_AMOUNT)}. Agrega más platillos para continuar.`,
        "summary.requestButton": "Solicitar Cotización →",
        "summary.toggleOpen": "Mostrar Resumen de Cotización",
        "summary.toggleClose": "Ocultar Resumen de Cotización",
        "filter.all": "Todos",
        "filter.tacos": "Tacos",
        "filter.quesadillas": "Quesadillas",
        "filter.burritos": "Burritos",
        "filter.sides_drinks": "Acompañamientos y Bebidas",
        "filter.veg": "Vegetariano",
        "filter.shrimp": "Camarón",
        "error.required": "Este campo es obligatorio.",
        "error.email": "Por favor ingresa un correo electrónico válido.",
        "error.phone": "Por favor ingresa un número de teléfono válido (ej. (901) 555-1234).",
        "error.minGuests": "Se requiere un mínimo de 10 invitados.",
        "error.maxGuests": "Se permite un máximo de 500 invitados.",
        "error.dateInPast": "La fecha del evento no puede ser en el pasado.",
        "error.timeOrder": "La hora de fin debe ser posterior a la hora de inicio.",
        "error.minOrder": `Se requiere un pedido mínimo de ${formatCurrency(MIN_ORDER_AMOUNT)}.`,
        "toast.timeError": "La hora de fin debe ser posterior a la hora de inicio. La hemos ajustado.",
        "toast.formError": "Por favor corrige los errores en el formulario.",
        "toast.submitError": "No se pudo enviar tu solicitud. Verifica tu conexión e inténtalo de nuevo.",
        "toast.submitTimeout": "La solicitud expiró. Por favor, inténtalo de nuevo.",
        "toast.itemAdded": "Agregado a la cotización: ",
        "toast.itemRemoved": "Eliminado de la cotización: ",
        "toast.itemUpdated": "Cantidad actualizada para: ",
        "toast.cartCleared": "Cotización borrada.",
        "toast.recommendation": (num, item) => `Se recomiendan ${num} ${item} para tus invitados.`,
        "offline.message": "No se pudo cargar el menú. Verifica tu conexión e ",
        "offline.retry": "intenta de nuevo",
        "success.title": "¡Gracias!",
        "success.messageP1": (id) => `Tu solicitud de catering <strong>${id}</strong> ha sido enviada.`,
        "success.messageP2": "Confirmaremos disponibilidad y detalles dentro de 1 día hábil.",
        "success.bookAnother": "Reservar Otro Evento",
        "undo.button": "Deshacer",
    }
};

function _(key, ...args) {
    const langTranslations = translations[currentLang] || translations.en;
    let translation = langTranslations[key] || key;
    if (typeof translation === 'function') {
        return translation(...args);
    }
    // Basic pluralization/interpolation (very simple)
    if (args.length > 0 && typeof args[0] === 'object') { // Named arguments
        Object.entries(args[0]).forEach(([k, v]) => {
            translation = translation.replace(new RegExp(`{${k}}`, 'g'), v);
        });
    } else { // Positional arguments
        args.forEach((arg, i) => {
            translation = translation.replace(new RegExp(`\\{${i}\\}`, 'g'), arg);
        });
    }
    return translation;
}

document.addEventListener('DOMContentLoaded', init);

async function init() {
    await injectIncludes();
    createLanguageToggle(); // Create lang toggle after header is potentially injected
    applyTranslations(); // Initial translation pass

    try {
        holidays = await loadJsonData('/data/holidays.json', []);
    } catch (error) {
        if (location.hostname === 'localhost') {
            console.debug('Failed to load holidays:', error);
        }
        // Continue without holidays if fetch fails
    }
    initDatePicker(); // Initialize date picker with current lang

    try {
        menuData = await loadMenu();
        if (menuData.length > 0) {
            renderFilterChips();
            renderMenuRows();
            const offlineMsgRow = document.querySelector('#menuTable .offline-message');
            if (offlineMsgRow) offlineMsgRow.closest('tr').style.display = 'none';
        } else {
            throw new Error("Menu data is empty after load.");
        }
    } catch (error) {
        if (location.hostname === 'localhost') {
            console.debug('Failed to load or render menu:', error);
        }
        const offlineMsgRow = document.querySelector('#menuTable .offline-message');
        if (offlineMsgRow) {
             offlineMsgRow.closest('tr').style.display = 'table-row';
             const retryButton = document.getElementById('retryMenuLoad');
             if(retryButton) retryButton.addEventListener('click', init);
        }
    }

    renderSummary();
    bindFormInputs();
    bindSummaryToggle();
    bindQuantitySpinnersGlobal(); // For menu items
    bindGuestCountSpinner(); // For event details guest count
    setupScrollTo();
    setupUndoBanner();

    window.addEventListener('resize', debounce(handleResize, 150));
    handleResize(); // Initial call

    window.addEventListener('storage', (event) => {
        if (event.key === LS_CATER_CART) {
            cateringCart = JSON.parse(event.newValue || '[]');
            renderMenuRows(document.querySelector('.filter-bar .pill[aria-checked="true"]')?.dataset.filter || 'All');
            renderSummary();
        }
        if (event.key === LANG_STORAGE_KEY) {
            currentLang = event.newValue || 'en';
            applyTranslations();
            initDatePicker(); // Re-init datepicker with new locale
        }
    });
    
    if (HCAPTCHA_SITEKEY && document.getElementById('hcaptcha-container')) {
        loadHCaptcha();
    }

    requestIdleCallback(() => {
        const link = document.createElement('link');
        link.rel = 'prefetch';
        link.href = '/order/order.html'; // As per spec
        link.as = 'document';
        document.head.appendChild(link);
    });
}

async function injectIncludes() {
    const includeElements = document.querySelectorAll('[data-include]');
    for (const el of includeElements) {
        const filePath = el.dataset.include;
        try {
            const response = await fetch(filePath, {cache: "force-cache"});
            if (!response.ok) throw new Error(`Failed to fetch ${filePath}: ${response.statusText}`);
            const html = await response.text();
            // Replace the element itself if it's a div, otherwise set innerHTML
            if (el.tagName === 'DIV' && el.id) { // Common for header/footer placeholders
                 const tempDiv = document.createElement('div');
                 tempDiv.innerHTML = html;
                 el.replaceWith(...tempDiv.childNodes);
            } else {
                 el.innerHTML = html;
            }

        } catch (error) {
            if (location.hostname === 'localhost') {
                console.debug(`Error injecting HTML from ${filePath}:`, error);
            }
            el.innerHTML = `<p>Error loading content from ${filePath}.</p>`;
        }
    }
}

async function loadJsonData(url, defaultValue = []) {
    try {
        const response = await fetch(url, { cache: 'force-cache' });
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        return await response.json();
    } catch (error) {
        if (location.hostname === 'localhost') {
            console.debug(`Failed to load JSON from ${url}:`, error);
        }
        return defaultValue;
    }
}


async function loadMenu() {
    const cachedMenu = sessionStorage.getItem(SESSION_MENU_CACHE);
    if (cachedMenu) {
        try {
            return JSON.parse(cachedMenu);
        } catch (e) {
            if (location.hostname === 'localhost') {
                console.debug('Error parsing cached menu:', e);
            }
            sessionStorage.removeItem(SESSION_MENU_CACHE); // Clear corrupted cache
        }
    }
    try {
        // Assuming menu.json is in /data/ relative to project root,
        // and catering.js is in /catering/, so path is ../data/menu.json
        const response = await fetch('../data/menu.json', { cache: 'force-cache' });
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        const data = await response.json();
        // Ensure data is an array of items as expected by renderMenuRows
        const itemsArray = data.sections ? data.sections.flatMap(s => s.items.map(i => ({...i, category: s.title_en, id: sanitizeForId(i.name_en) }))) : (Array.isArray(data) ? data : []);

        // Add IDs if not present, and ensure structure for catering
        const processedData = itemsArray.map(item => ({
            id: item.id || sanitizeForId(item.name_en || item.englishName),
            englishName: item.name_en || item.englishName,
            spanishName: item.name_es || item.spanishName,
            price: parseFloat(item.price),
            category: item.category, // Assuming category comes from section title
            calories: parseInt(item.calories) || 0,
            photo: item.photo || `../images/menu/${sanitizeForId(item.name_en || item.englishName)}.jpeg`, // Adjust path as needed
            isVegetarian: item.isVegetarian || false, // Example property
            meat: item.meat || null // Example property
        }));

        sessionStorage.setItem(SESSION_MENU_CACHE, JSON.stringify(processedData));
        return processedData;
    } catch (error) {
        if (location.hostname === 'localhost') {
            console.debug('Failed to load menu:', error);
        }
        // Do not show toast here, handled by init's catch block
        return [];
    }
}


function initDatePicker() {
    const eventDateInput = document.getElementById('eventDate');
    if (!eventDateInput) return;
    flatpickr(eventDateInput, {
        disable: holidays,
        minDate: "today",
        altInput: true, // Creates a human-readable input
        altFormat: "F j, Y", // e.g., "June 1, 2024"
        dateFormat: "Y-m-d", // ISO format for submission
        locale: currentLang === 'es' ? Spanish : undefined,
        onChange: function(selectedDates, dateStr, instance) {
            validateField(instance.element); // Validate on change
        }
    });
}

function renderFilterChips() {
    const filterBar = document.querySelector('.filter-bar');
    if (!filterBar || !menuData || menuData.length === 0) return;

    const categories = ['All', ...new Set(menuData.map(item => item.category).filter(Boolean))];
    // Add Veg and Shrimp if they are special filters not necessarily categories
    // This depends on how 'Veg' and 'Shrimp' are determined (e.g. item.isVegetarian, item.meat === 'Shrimp')
    // For now, assuming they are categories or will be handled by filter logic.
    // if (!categories.includes('Veg')) categories.push('Veg');
    // if (!categories.includes('Shrimp')) categories.push('Shrimp');


    filterBar.innerHTML = ''; // Clear existing
    const pillTemplate = document.getElementById('filterPillTemplate');

    categories.forEach((category, index) => {
        if (!pillTemplate) return;
        const pillNode = pillTemplate.content.cloneNode(true);
        const button = pillNode.querySelector('.pill');
        button.textContent = _(`filter.${category.toLowerCase().replace(/\s+/g, '_')}`) || category;
        button.dataset.filter = category;
        button.setAttribute('role', 'radio'); // Part of a radio group
        button.setAttribute('aria-checked', index === 0 ? 'true' : 'false');
        if (index === 0) button.classList.add('selected'); // 'selected' class for styling active

        button.addEventListener('click', () => {
            filterBar.querySelectorAll('.pill').forEach(p => {
                p.classList.remove('selected');
                p.setAttribute('aria-checked', 'false');
            });
            button.classList.add('selected');
            button.setAttribute('aria-checked', 'true');
            renderMenuRows(category);
        });
        filterBar.appendChild(pillNode);
    });
}

function renderMenuRows(filter = 'All') {
    const tableBody = document.querySelector('#menuTable tbody');
    if (!tableBody || !menuData) return;

    // Preserve the offline message row if it exists
    const offlineRow = tableBody.querySelector('.offline-message');
    let offlineRowHTML = '';
    if (offlineRow) {
        offlineRowHTML = offlineRow.closest('tr').outerHTML;
    }
    
    tableBody.innerHTML = ''; // Clear existing rows (except potentially offline message)

    if (menuData.length === 0 && offlineRowHTML) {
        tableBody.innerHTML = offlineRowHTML; // Put back offline message if menu is truly empty
        const retryButton = document.getElementById('retryMenuLoad');
        if(retryButton) retryButton.addEventListener('click', init);
        return;
    }


    const menuItemTemplate = document.getElementById('menuItemTemplate');
    if (!menuItemTemplate) return;

    const filteredMenu = menuData.filter(item => {
        if (filter === 'All') return true;
        // Example filtering, adjust based on actual item properties
        if (filter === 'Veggie' || filter === 'Veg') return item.isVegetarian;
        if (filter === 'Shrimp') return item.meat === 'Shrimp' || item.category === 'Shrimp'; // Assuming 'Shrimp' could be a meat type or category
        return item.category === filter;
    });

    if (filteredMenu.length === 0) {
        const noResultsRow = document.createElement('tr');
        noResultsRow.innerHTML = `<td colspan="4" style="text-align:center; padding:1rem;">${_('No items match this filter.')}</td>`;
        tableBody.appendChild(noResultsRow);
    } else {
        filteredMenu.forEach(item => {
            const rowNode = menuItemTemplate.content.cloneNode(true);
            const row = rowNode.querySelector('.menu-item-row');

            const img = row.querySelector('.item-thumbnail');
            img.src = item.photo || '../images/ui/taco-fallback.svg'; // Ensure fallback path is correct
            img.alt = item.englishName;

            row.querySelector('.item-name-en').textContent = item.englishName;
            row.querySelector('.item-name-es').textContent = item.spanishName;
            row.querySelector('.item-price').textContent = formatCurrency(item.price);

            const quantityInput = row.querySelector('.item-quantity');
            const cartItem = cateringCart.find(ci => ci.id === item.id);
            quantityInput.value = cartItem ? cartItem.qty : 0;
            quantityInput.dataset.itemId = item.id;
            quantityInput.dataset.price = item.price;
            quantityInput.dataset.itemName = item.englishName; // For toast messages
            quantityInput.setAttribute('aria-label', `${item.englishName} quantity`);


            const minusBtn = row.querySelector('.spinner-btn.minus');
            const plusBtn = row.querySelector('.spinner-btn.plus');
            minusBtn.dataset.itemId = item.id;
            plusBtn.dataset.itemId = item.id;
            minusBtn.disabled = (!cartItem || cartItem.qty === 0);


            const caloriesButton = row.querySelector('.toggle-calories');
            const caloriesValue = caloriesButton.querySelector('.value');
            const caloriesInfoEl = row.querySelector('.calories-info');
            const showText = caloriesButton.querySelector('.show-text');
            const hideText = caloriesButton.querySelector('.hide-text');

            if (item.calories && item.calories > 0) {
                caloriesValue.textContent = item.calories;
                caloriesInfoEl.textContent = `${item.calories} kcal`; // Or more detailed info if available
                caloriesButton.addEventListener('click', () => {
                    const isExpanded = caloriesButton.getAttribute('aria-expanded') === 'true';
                    caloriesButton.setAttribute('aria-expanded', !isExpanded);
                    caloriesInfoEl.style.display = isExpanded ? 'none' : 'block';
                    if (showText && hideText) {
                        showText.style.display = isExpanded ? 'inline' : 'none';
                        hideText.style.display = isExpanded ? 'none' : 'inline';
                    }
                });
            } else {
                caloriesButton.style.display = 'none';
                caloriesInfoEl.style.display = 'none';
                row.querySelector('.item-calories.calories-col').innerHTML = '-'; // No calories data
            }
            tableBody.appendChild(rowNode);
        });
    }
    if (menuData.length > 0 && offlineRowHTML) { // If menu loaded, ensure offline message is hidden
        const offlineMsgRow = tableBody.querySelector('.offline-message');
        if (offlineMsgRow) offlineMsgRow.closest('tr').style.display = 'none';
    }
}


function bindQuantitySpinnersGlobal() {
    const menuTable = document.getElementById('menuTable');
    if (!menuTable) return;

    menuTable.addEventListener('click', event => {
        const target = event.target;
        if (target.classList.contains('spinner-btn')) {
            const itemId = target.dataset.itemId;
            const row = target.closest('.menu-item-row');
            if (!row) return;
            const quantityInput = row.querySelector(`.item-quantity[data-item-id="${itemId}"]`);
            if (!quantityInput) return;

            let currentValue = parseInt(quantityInput.value) || 0;
            const price = parseFloat(quantityInput.dataset.price);
            const itemName = quantityInput.dataset.itemName;


            if (target.classList.contains('plus')) {
                currentValue = Math.min(currentValue + 1, 99);
            } else if (target.classList.contains('minus')) {
                currentValue = Math.max(currentValue - 1, 0);
            }
            quantityInput.value = currentValue;
            row.querySelector('.spinner-btn.minus').disabled = (currentValue === 0);

            updateCartItem(itemId, currentValue, price, itemName);
        }
    });

    menuTable.addEventListener('change', event => { // Handle direct input change
        const target = event.target;
        if (target.classList.contains('item-quantity')) {
            const itemId = target.dataset.itemId;
            const price = parseFloat(target.dataset.price);
            const itemName = target.dataset.itemName;
            let quantity = parseInt(target.value) || 0;
            quantity = Math.max(0, Math.min(quantity, 99)); // Clamp value
            target.value = quantity; // Update input if clamped

            const row = target.closest('.menu-item-row');
            if(row) row.querySelector('.spinner-btn.minus').disabled = (quantity === 0);

            updateCartItem(itemId, quantity, price, itemName);
        }
    });
}

function bindGuestCountSpinner() {
    const guestCountControl = document.querySelector('#guestCount')?.closest('.form-control');
    if (!guestCountControl) return;
    const quantityInput = guestCountControl.querySelector('#guestCount');
    const minusBtn = guestCountControl.querySelector('.spinner-btn.minus');
    const plusBtn = guestCountControl.querySelector('.spinner-btn.plus');
    const min = parseInt(quantityInput.min) || 0;
    const max = parseInt(quantityInput.max) || 999;


    const updateButtons = () => {
        const value = parseInt(quantityInput.value);
        minusBtn.disabled = value <= min;
        plusBtn.disabled = value >= max;
    };

    minusBtn.addEventListener('click', () => {
        let value = parseInt(quantityInput.value);
        if (value > min) {
            quantityInput.value = value - 1;
            quantityInput.dispatchEvent(new Event('change', { bubbles: true })); // Trigger change for validation
            updateButtons();
            recommendQuantities(quantityInput.value);
        }
    });

    plusBtn.addEventListener('click', () => {
        let value = parseInt(quantityInput.value);
        if (value < max) {
            quantityInput.value = value + 1;
            quantityInput.dispatchEvent(new Event('change', { bubbles: true }));
            updateButtons();
            recommendQuantities(quantityInput.value);
        }
    });
    quantityInput.addEventListener('change', () => {
        let value = parseInt(quantityInput.value);
        if (isNaN(value) || value < min) quantityInput.value = min;
        if (value > max) quantityInput.value = max;
        validateField(quantityInput);
        updateButtons();
        recommendQuantities(quantityInput.value);
    });
    updateButtons(); // Initial state
}

function recommendQuantities(guestCountStr) {
    const guests = parseInt(guestCountStr);
    if (isNaN(guests) || guests < (parseInt(document.getElementById('guestCount')?.min) || 10)) return;

    // Example: 3 tacos per person, 1 drink per person
    const recommendations = [
        { category: 'Tacos', perGuest: 3, itemType: 'tacos' },
        { category: 'Sides & Drinks', perGuest: 1, itemType: 'drinks' } // Assuming drinks are in this category
    ];

    recommendations.forEach(rec => {
        const itemsInCategory = menuData.filter(item => item.category === rec.category);
        if (itemsInCategory.length > 0) {
            // For simplicity, recommend for the first item in category or a specific one
            // A more complex logic could distribute among items or pick popular ones
            const targetItem = itemsInCategory[0]; // Example: recommend for the first taco type
            const recommendedQty = Math.ceil(guests * rec.perGuest);
            
            // Check if item is already in cart, if not, this is a suggestion
            const cartItem = cateringCart.find(ci => ci.id === targetItem.id);
            if (!cartItem || cartItem.qty < recommendedQty) {
                 // This is where a non-intrusive suggestion could be made, e.g. a small note near the category
                 // For now, let's use a toast as per spec example, but this could be too noisy.
                 // showToast(_('toast.recommendation', recommendedQty, targetItem.englishName), 'info', 5000);
            }
        }
    });
}


function updateCartItem(itemId, quantity, price, itemName) {
    const existingItemIndex = cateringCart.findIndex(item => item.id === itemId);
    let toastMessage = '';

    if (quantity > 0) {
        if (existingItemIndex > -1) {
            cateringCart[existingItemIndex].qty = quantity;
            toastMessage = _('toast.itemUpdated') + itemName;
        } else {
            cateringCart.push({ id: itemId, qty: quantity, price: price, name: itemName });
            toastMessage = _('toast.itemAdded') + itemName;
        }
    } else {
        if (existingItemIndex > -1) {
            lastRemovedItem = { ...cateringCart[existingItemIndex] }; // Store for undo
            cateringCart.splice(existingItemIndex, 1);
            toastMessage = _('toast.itemRemoved') + itemName;
            showUndoBanner(toastMessage); // Show undo option
        }
    }

    if (toastMessage && !lastRemovedItem) { // Don't show regular toast if undo is shown
        showToast(toastMessage, 'info', 3000);
    }
    
    sessionStorage.setItem(LS_CATER_CART, JSON.stringify(cateringCart));
    renderSummary();
    updateLiveRegion(`${itemName} quantity ${quantity === 0 ? 'removed' : 'updated to ' + quantity}. Current total: ${document.getElementById('summaryGrandTotal')?.textContent || '$0.00'}`);
}

function showUndoBanner(message) {
    const undoBanner = document.getElementById('undoBanner');
    const undoMessageEl = document.getElementById('undoMessage');
    if (!undoBanner || !undoMessageEl || !lastRemovedItem) return;

    undoMessageEl.textContent = message;
    undoBanner.style.display = 'flex';

    clearTimeout(undoTimeout);
    undoTimeout = setTimeout(() => {
        clearUndo();
    }, 8000); // 8 seconds to undo
}

function setupUndoBanner() {
    const undoBtn = document.getElementById('undoBtn');
    if (undoBtn) {
        undoBtn.addEventListener('click', () => {
            if (lastRemovedItem) {
                // Re-add the item
                updateCartItem(lastRemovedItem.id, lastRemovedItem.qty, lastRemovedItem.price, lastRemovedItem.name);
                // Manually update the specific row's quantity input
                const inputEl = document.querySelector(`.item-quantity[data-item-id="${lastRemovedItem.id}"]`);
                if (inputEl) {
                    inputEl.value = lastRemovedItem.qty;
                    const row = inputEl.closest('.menu-item-row');
                    if(row) row.querySelector('.spinner-btn.minus').disabled = (lastRemovedItem.qty === 0);
                }
                showToast(`${_('Restored item:')} ${lastRemovedItem.name}`, 'success');
                clearUndo();
            }
        });
    }
}

function clearUndo() {
    const undoBanner = document.getElementById('undoBanner');
    if (undoBanner) undoBanner.style.display = 'none';
    lastRemovedItem = null;
    clearTimeout(undoTimeout);
}


function renderSummary() {
    let subtotal = 0;
    cateringCart.forEach(item => {
        subtotal += item.price * item.qty;
    });

    const serviceFee = subtotal * SERVICE_FEE_RATE;
    const taxableAmount = subtotal + serviceFee; // Tax is on subtotal + service fee
    const tax = taxableAmount * TAX_RATE;
    const grandTotal = subtotal + serviceFee + tax;

    document.getElementById('summarySubtotal').textContent = formatCurrency(subtotal);
    document.getElementById('summaryServiceFee').textContent = formatCurrency(serviceFee);
    document.getElementById('summaryTax').textContent = formatCurrency(tax);
    document.getElementById('summaryGrandTotal').textContent = formatCurrency(grandTotal);

    const minOrderWarning = document.getElementById('minOrderWarning');
    const requestQuoteBtn = document.getElementById('requestQuoteBtn');

    if (minOrderWarning && requestQuoteBtn) {
        const meetsMinOrder = subtotal >= MIN_ORDER_AMOUNT;
        const hasItems = cateringCart.length > 0;

        if (hasItems && !meetsMinOrder) {
            minOrderWarning.innerHTML = _('summary.minOrderWarning'); // Use innerHTML for translated string
            minOrderWarning.style.display = 'block';
            requestQuoteBtn.disabled = true;
        } else if (!hasItems) {
            minOrderWarning.style.display = 'none';
            requestQuoteBtn.disabled = true; // Cannot submit empty cart
        } else { // Has items and meets min order
            minOrderWarning.style.display = 'none';
            requestQuoteBtn.disabled = false;
        }
    }
    // Update live region for screen readers if summary changes significantly
    // updateLiveRegion(`Quote total: ${formatCurrency(grandTotal)}`); // This might be too verbose on every item change.
}

function bindFormInputs() {
    const form = document.querySelector(FORM_ID);
    if (!form) return;

    form.addEventListener('submit', async event => {
        event.preventDefault();
        if (!validateForm(form)) {
            showToast(_('toast.formError'), 'error');
            // Focus first invalid field
            const firstError = form.querySelector('[aria-invalid="true"], .error');
            if (firstError) firstError.focus();
            return;
        }
        await submitRequest(form);
    });

    // Add blur/input validation for individual fields
    form.querySelectorAll('input[required], input[type="email"], input[type="tel"], input[type="time"], input#guestCount').forEach(input => {
        input.addEventListener('blur', () => validateField(input));
        input.addEventListener('input', () => {
             // Clear error on input for better UX, re-validate on blur or submit
            const errorMsgEl = input.closest('.form-control')?.querySelector('.error-message');
            if (input.classList.contains('error') || input.getAttribute('aria-invalid') === 'true') {
                if (errorMsgEl) errorMsgEl.textContent = '';
                input.classList.remove('error');
                input.removeAttribute('aria-invalid');
            }
        });
    });
    // Special handling for time inputs to check order
    const startTimeInput = document.getElementById('startTime');
    const endTimeInput = document.getElementById('endTime');
    if (startTimeInput && endTimeInput) {
        [startTimeInput, endTimeInput].forEach(timeInput => {
            timeInput.addEventListener('change', () => {
                if (startTimeInput.value && endTimeInput.value) {
                    if (endTimeInput.value <= startTimeInput.value) {
                        // Attempt to auto-correct or just warn
                        const startMinutes = timeToMinutes(startTimeInput.value);
                        endTimeInput.value = minutesToTime(startMinutes + 60); // Default to 1 hour later
                        showToast(_('toast.timeError'), 'info', 4000);
                        validateField(endTimeInput); // Re-validate
                    }
                }
            });
        });
    }
}

function timeToMinutes(timeStr) { // "HH:MM"
    const [hours, minutes] = timeStr.split(':').map(Number);
    return hours * 60 + minutes;
}
function minutesToTime(totalMinutes) {
    const hours = String(Math.floor(totalMinutes / 60) % 24).padStart(2, '0');
    const minutes = String(totalMinutes % 60).padStart(2, '0');
    return `${hours}:${minutes}`;
}


function validateField(input) {
    let isValid = true;
    let errorMessage = '';
    const formControl = input.closest('.form-control');
    const errorMsgEl = formControl?.querySelector('.error-message');

    if (!errorMsgEl) return true; // Should not happen

    // Required
    if (input.required && !input.value.trim()) {
        isValid = false;
        errorMessage = _('error.required');
    }
    // Email
    else if (input.type === 'email' && input.value.trim() && !validateEmail(input.value.trim())) {
        isValid = false;
        errorMessage = _('error.email');
    }
    // Phone
    else if (input.type === 'tel' && input.value.trim() && !validatePhone(input.value.trim())) {
        isValid = false;
        errorMessage = _('error.phone');
    }
    // Guest Count
    else if (input.id === 'guestCount') {
        const val = parseInt(input.value);
        const min = parseInt(input.min);
        const max = parseInt(input.max);
        if (isNaN(val) || val < min) {
            isValid = false;
            errorMessage = _('error.minGuests');
        } else if (val > max) {
            isValid = false;
            errorMessage = _('error.maxGuests');
        }
    }
    // Event Date (check if in past, flatpickr handles this visually but good to double check)
    else if (input.id === 'eventDate' && input.value) {
        const selectedDate = flatpickr.parseDate(input.value, "Y-m-d");
        const today = new Date();
        today.setHours(0,0,0,0); // Compare dates only
        if (selectedDate < today) {
            isValid = false;
            errorMessage = _('error.dateInPast');
        }
    }
    // Time order (End time > Start time)
    else if ((input.id === 'startTime' || input.id === 'endTime')) {
        const startTimeInput = document.getElementById('startTime');
        const endTimeInput = document.getElementById('endTime');
        if (startTimeInput.value && endTimeInput.value && endTimeInput.value <= startTimeInput.value) {
            isValid = false;
            // Specific error for the field that was changed, or a general one
            errorMessage = _('error.timeOrder');
            // Apply error to endTimeInput if it's the one being validated or if startTime caused it
            const targetErrorEl = (input.id === 'endTime' ? errorMsgEl : endTimeInput.closest('.form-control')?.querySelector('.error-message'));
            if(targetErrorEl) targetErrorEl.textContent = errorMessage;
            endTimeInput.classList.add('error');
            endTimeInput.setAttribute('aria-invalid', 'true');
        }
    }


    if (!isValid) {
        errorMsgEl.textContent = errorMessage;
        input.classList.add('error');
        input.setAttribute('aria-invalid', 'true');
    } else {
        errorMsgEl.textContent = '';
        input.classList.remove('error');
        input.removeAttribute('aria-invalid');
    }
    return isValid;
}


function validateForm(form) {
    let allValid = true;
    form.querySelectorAll('input[required], input[type="email"], input[type="tel"], input#guestCount, input#eventDate, input#startTime, input#endTime').forEach(input => {
        if (!validateField(input)) {
            allValid = false;
        }
    });
    // Check min order amount if cart has items
    if (cateringCart.length > 0) {
        let subtotal = 0;
        cateringCart.forEach(item => { subtotal += item.price * item.qty; });
        if (subtotal < MIN_ORDER_AMOUNT) {
            allValid = false;
            // Error message is already handled by renderSummary's warning display
            // but we can ensure the button reflects this state if not already.
            const requestQuoteBtn = document.getElementById('requestQuoteBtn');
            if(requestQuoteBtn) requestQuoteBtn.disabled = true;
            const minOrderWarning = document.getElementById('minOrderWarning');
            if(minOrderWarning) {
                minOrderWarning.innerHTML = _('summary.minOrderWarning');
                minOrderWarning.style.display = 'block';
            }
        }
    }
    if (HCAPTCHA_SITEKEY && hcaptchaWidgetId) {
        const hcaptchaResponse = form.querySelector('[name="h-captcha-response"]')?.value;
        if (!hcaptchaResponse) {
            allValid = false;
            showToast(_("Please complete the CAPTCHA."), "error");
        }
    }

    return allValid;
}

async function submitRequest(form) {
    const submitButton = document.getElementById('requestQuoteBtn');
    const originalButtonText = submitButton.innerHTML;
    submitButton.disabled = true;
    submitButton.innerHTML = `<span class="spinner" role="status" aria-hidden="true"></span> ${_('Submitting...')}`;


    const payload = collectPayload(form);
    const csrfToken = document.querySelector(CSRF_META_SELECTOR)?.content;

    const headers = {
        'Content-Type': 'application/json',
    };
    if (csrfToken) {
        headers['CSRF-TOKEN'] = csrfToken;
    }

    try {
        const response = await fetch(form.action, {
            method: form.method,
            headers: headers,
            credentials: 'include', // As per spec
            body: JSON.stringify(payload),
            signal: AbortSignal.timeout(10000) // 10s timeout
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ message: `HTTP error! status: ${response.status}` }));
            throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
        }

        const result = await response.json();
        if (result.success && result.quoteId) {
            showSuccessScreen(result.quoteId);
        } else {
            throw new Error(result.message || 'Submission failed. Please try again.');
        }

    } catch (error) {
        if (location.hostname === 'localhost') {
            console.debug('Error submitting request:', error);
        }
        let errorMsg = _('toast.submitError');
        if (error.name === 'TimeoutError') {
            errorMsg = _('toast.submitTimeout');
        } else if (error.message) {
            // Potentially display server-provided error message if safe
            // errorMsg = error.message; // Be cautious with displaying server messages directly
        }
        showToast(errorMsg, 'error', 5000);
    } finally {
        submitButton.disabled = false;
        submitButton.innerHTML = originalButtonText;
        if (HCAPTCHA_SITEKEY && typeof hcaptcha !== 'undefined' && hcaptchaWidgetId) {
            hcaptcha.reset(hcaptchaWidgetId);
        }
    }
}

function collectPayload(form) {
    const formData = new FormData(form);
    const eventDetails = {};
    // Specific fields for event details
    ['eventDate', 'startTime', 'endTime', 'guestCount', 'contactName', 'contactEmail', 'contactPhone'].forEach(key => {
        eventDetails[key] = formData.get(key);
    });
    
    // Sanitize cart items to only include id and qty
    const items = cateringCart.map(item => ({ id: item.id, qty: item.qty }));

    return {
        ...eventDetails,
        items: items,
        // Add h-captcha-response if present
        'h-captcha-response': formData.get('h-captcha-response') || undefined
    };
}


function showSuccessScreen(quoteId) {
    const mainContent = document.getElementById('main');
    const summaryPane = document.getElementById('summaryPane');
    const successTemplate = document.getElementById('successMessageTemplate');

    if (!mainContent || !summaryPane || !successTemplate) return;

    mainContent.innerHTML = successTemplate.innerHTML;
    summaryPane.style.display = 'none'; // Hide summary

    const quoteIdEl = mainContent.querySelector('#quoteId');
    if (quoteIdEl) quoteIdEl.textContent = quoteId;
    
    applyTranslationsToElement(mainContent); // Re-translate new content

    const bookAnotherBtn = mainContent.querySelector('#bookAnotherEventBtn');
    if (bookAnotherBtn) {
        bookAnotherBtn.addEventListener('click', () => {
            // Reset form and cart, then reload or re-initialize view
            document.getElementById('cateringForm')?.reset();
            cateringCart = [];
            sessionStorage.removeItem(LS_CATER_CART);
            // Instead of reload, re-render the original content
            window.location.reload(); // Simplest way to reset to initial state
        });
    }

    // Clear cart and session
    cateringCart = [];
    sessionStorage.removeItem(LS_CATER_CART);
    // renderSummary(); // Not needed as summary is hidden
    // renderMenuRows(); // Not needed as main content is replaced

    // Confetti
    const confettiCanvas = mainContent.querySelector('#confettiCanvas');
    if (confettiCanvas && typeof confetti !== 'undefined') { // Check if confetti library is available
        const myConfetti = confetti.create(confettiCanvas, {
            resize: true,
            useWorker: true
        });
        myConfetti({
            particleCount: 150,
            spread: 180,
            origin: { y: 0.6 }
        });
    } else if (confettiCanvas) { // Basic fallback confetti
        basicConfetti(confettiCanvas);
    }
    
    mainContent.focus(); // Focus on the new content for accessibility
    updateLiveRegion(_('success.title') + " " + _('success.messageP1', quoteId));
}

function basicConfetti(canvas) {
    const ctx = canvas.getContext('2d');
    const W = canvas.width = canvas.offsetWidth;
    const H = canvas.height = canvas.offsetHeight;
    const particles = [];
    const particleCount = 100;
    const colors = ['#F9595A', '#F9D14C', '#5AC85F', '#2AACED', '#EC008C']; // Use theme confetti colors

    for (let i = 0; i < particleCount; i++) {
        particles.push({
            x: Math.random() * W,
            y: Math.random() * H - H, // Start off-screen top
            r: Math.random() * 4 + 1, // radius
            d: Math.random() * particleCount, // density
            color: colors[Math.floor(Math.random() * colors.length)],
            tilt: Math.floor(Math.random() * 10) - 10,
            tiltAngleIncremental: (Math.random() * 0.07) + .05,
            tiltAngle: 0
        });
    }

    function draw() {
        ctx.clearRect(0, 0, W, H);
        for (let i = 0; i < particleCount; i++) {
            const p = particles[i];
            ctx.beginPath();
            ctx.lineWidth = p.r;
            ctx.strokeStyle = p.color;
            ctx.moveTo(p.x + p.tilt + (p.r / 2), p.y);
            ctx.lineTo(p.x + p.tilt, p.y + p.tilt + (p.r / 2));
            ctx.stroke();
        }
        update();
    }

    let angle = 0;
    function update() {
        angle += 0.01;
        for (let i = 0; i < particleCount; i++) {
            const p = particles[i];
            p.tiltAngle += p.tiltAngleIncremental;
            p.y += (Math.cos(angle + p.d) + 1 + p.r / 2) / 1.5; // Slower fall
            p.x += Math.sin(angle);
            p.tilt = (Math.sin(p.tiltAngle - (i / 3))) * 15;

            if (p.y > H) { // Reset particle if it falls off screen
                particles[i] = { x: Math.random() * W, y: -10, r: p.r, d: p.d, color: p.color, tilt: Math.floor(Math.random() * 10) - 10, tiltAngleIncremental:p.tiltAngleIncremental, tiltAngle:0 };
            }
        }
    }
    let animationFrameId = requestAnimationFrame(function confettiLoop(){
        draw();
        animationFrameId = requestAnimationFrame(confettiLoop);
    });
    setTimeout(() => cancelAnimationFrame(animationFrameId), 5000); // Stop after 5s
}


function bindSummaryToggle() {
    const toggleButton = document.getElementById('summaryToggle');
    const summaryPane = document.getElementById('summaryPane');
    const openText = toggleButton?.querySelector('.toggle-text-open');
    const closeText = toggleButton?.querySelector('.toggle-text-close');


    if (!toggleButton || !summaryPane || !openText || !closeText) return;

    toggleButton.addEventListener('click', () => {
        const isExpanded = summaryPane.classList.toggle('open');
        toggleButton.setAttribute('aria-expanded', isExpanded);
        document.body.classList.toggle('summary-open', isExpanded);
        
        openText.style.display = isExpanded ? 'none' : 'inline';
        closeText.style.display = isExpanded ? 'inline' : 'none';

        if (isExpanded) {
            summaryPane.focus(); // Focus the pane when opened
        }
    });

    // Close with Escape key
    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape' && summaryPane.classList.contains('open')) {
            toggleButton.click();
        }
    });
    // Close on backdrop click
    document.body.addEventListener('click', (event) => {
        if (event.target === document.body && document.body.classList.contains('summary-open')) {
             toggleButton.click();
        }
    });
}

function handleResize() {
    const summaryPane = document.getElementById('summaryPane');
    const summaryToggle = document.getElementById('summaryToggle');
    if (!summaryPane || !summaryToggle) return;

    if (window.innerWidth >= 768) { // Desktop/Tablet breakpoint
        summaryPane.classList.remove('open'); // Ensure it's not in drawer mode
        summaryToggle.setAttribute('aria-expanded', 'false');
        summaryToggle.style.display = 'none';
        document.body.classList.remove('summary-open');
        summaryPane.style.transform = ''; // Reset transform if any
        document.getElementById('summaryContent').style.display = 'block'; // Ensure content is visible
    } else { // Mobile
        summaryToggle.style.display = 'flex';
        // If not explicitly opened, content should be hidden by default CSS for closed state
        if (!summaryPane.classList.contains('open')) {
            document.getElementById('summaryContent').style.display = 'none';
        }
    }
}

function setupScrollTo() {
    document.querySelectorAll('.cta-scroll[data-scroll]').forEach(button => {
        button.addEventListener('click', (e) => {
            e.preventDefault();
            const targetId = button.dataset.scroll;
            const targetElement = document.querySelector(targetId);
            if (targetElement) {
                targetElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
        });
    });
}

function createLanguageToggle() {
    const header = document.getElementById('site-header') || document.body; // Fallback to body
    let langToggleContainer = header.querySelector('.lang-toggle-container');
    if (!langToggleContainer) { // Create if not found in injected header
        langToggleContainer = document.createElement('div');
        langToggleContainer.className = 'lang-toggle-container'; // Add class for styling
        // Try to append it in a reasonable place, e.g., end of header or start of body
        const nav = header.querySelector('nav');
        if (nav) nav.appendChild(langToggleContainer);
        else header.insertBefore(langToggleContainer, header.firstChild);
    }


    const langToggleBtn = document.createElement('button');
    langToggleBtn.id = 'lang-toggle-catering';
    langToggleBtn.className = 'lang-toggle button-pill'; // Style as a pill button
    langToggleBtn.setAttribute('aria-label', 'Toggle language');
    langToggleBtn.innerHTML = `<span class="lang-en">EN</span> / <span class="lang-es">ES</span>`;
    langToggleContainer.appendChild(langToggleBtn);

    const langEnSpan = langToggleBtn.querySelector('.lang-en');
    const langEsSpan = langToggleBtn.querySelector('.lang-es');

    const updateLangToggleVisuals = () => {
        if (currentLang === 'es') {
            langEnSpan.classList.remove('active-lang');
            langEsSpan.classList.add('active-lang');
            document.documentElement.lang = 'es';
        } else {
            langEsSpan.classList.remove('active-lang');
            langEnSpan.classList.add('active-lang');
            document.documentElement.lang = 'en';
        }
    };

    langToggleBtn.addEventListener('click', () => {
        currentLang = (currentLang === 'en') ? 'es' : 'en';
        localStorage.setItem(LANG_STORAGE_KEY, currentLang);
        updateLangToggleVisuals();
        applyTranslations();
        initDatePicker(); // Re-initialize date picker with new language
        renderFilterChips(); // Re-render filter chips for new language
        renderMenuRows(document.querySelector('.filter-bar .pill[aria-checked="true"]')?.dataset.filter || 'All'); // Re-render menu for new language
        renderSummary(); // Re-render summary for new language (e.g. min order warning)
    });

    updateLangToggleVisuals(); // Set initial state
}


function applyTranslations() {
    document.querySelectorAll('[data-translate]').forEach(el => {
        const key = el.dataset.translate;
        const translation = _(key);
        if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
            if (el.placeholder) el.placeholder = translation;
            // Could also set 'aria-label' or 'title' if appropriate
        } else {
            el.innerHTML = translation; // Use innerHTML to support simple HTML in translations
        }
    });
    // For elements that might have translations in attributes like aria-label or title
    document.querySelectorAll('[data-translate-aria-label]').forEach(el => {
        el.setAttribute('aria-label', _(el.dataset.translateAriaLabel));
    });
    document.querySelectorAll('[data-translate-title]').forEach(el => {
        el.setAttribute('title', _(el.dataset.translateTitle));
    });

    // Update dynamic text like summary labels
    const serviceFeeEl = document.querySelector('#summaryServiceFeeLabel');
    if (serviceFeeEl) serviceFeeEl.textContent = _('summary.serviceFee');
    const taxEl = document.querySelector('#summaryTaxLabel');
    if (taxEl) taxEl.textContent = _('summary.tax');

    // Update undo button text
    const undoBtn = document.getElementById('undoBtn');
    if (undoBtn) undoBtn.textContent = _('undo.button');

    // Update hCaptcha container if it has translatable text (usually not, but for completeness)
    // Example: if there was a label associated with it.
}

function applyTranslationsToElement(element) {
    element.querySelectorAll('[data-translate]').forEach(el => {
        const key = el.dataset.translate;
        const translation = _(key);
        if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
            if (el.placeholder) el.placeholder = translation;
        } else {
            el.innerHTML = translation;
        }
    });
    element.querySelectorAll('[data-translate-aria-label]').forEach(el => {
        el.setAttribute('aria-label', _(el.dataset.translateAriaLabel));
    });
    element.querySelectorAll('[data-translate-title]').forEach(el => {
        el.setAttribute('title', _(el.dataset.translateTitle));
    });
}


function updateLiveRegion(message) {
    const liveRegion = document.getElementById('liveRegion');
    if (liveRegion) {
        liveRegion.textContent = message;
    }
}

function sanitizeForId(name) {
    if (!name) return `item-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    return name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
}

function debounce(func, delay) {
    let timeout;
    return function(...args) {
        const context = this;
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(context, args), delay);
    };
}

function loadHCaptcha() {
    if (!HCAPTCHA_SITEKEY || document.getElementById('hcaptcha-script')) return;

    const script = document.createElement('script');
    script.id = 'hcaptcha-script';
    script.src = 'https://js.hcaptcha.com/1/api.js?render=explicit';
    script.async = true;
    script.defer = true;
    script.onload = () => {
        const container = document.getElementById('hcaptcha-container');
        if (container && typeof hcaptcha !== 'undefined') {
            hcaptchaWidgetId = hcaptcha.render(container, {
                sitekey: HCAPTCHA_SITEKEY,
                theme: (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) ? 'dark' : 'light',
                // lang: currentLang // hCaptcha supports lang attribute
            });
        }
    };
    document.head.appendChild(script);
}