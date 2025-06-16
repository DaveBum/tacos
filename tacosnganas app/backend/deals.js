// deals.js for TACOnganas Desktop Application

// --- Data Store ---
// In a real application, this might come from a database or API
let currentDealsData = [
    {
        id: 'deal001',
        name: 'Taco Tuesday Special',
        description: 'Get 3 Tacos Al Pastor for $5.00 every Tuesday!',
        price: 5.00,
        originalPrice: 7.50,
        image: 'assets/images/taco_tuesday.png',
        validity: {
            type: 'dayOfWeek',
            value: 2 // Tuesday (0=Sunday, 1=Monday, ..., 6=Saturday)
        },
        conditions: 'Only on Tuesdays. Dine-in only.',
        active: true
    },
    {
        id: 'deal002',
        name: 'Family Fiesta Pack',
        description: '12 Tacos (choice of 3 meats), Large Guacamole, Large Chips, and 4 Drinks.',
        price: 35.00,
        originalPrice: 45.00,
        image: 'assets/images/family_fiesta.png',
        validity: {
            type: 'always'
        },
        conditions: 'Choice of chicken, beef, or carnitas.',
        active: true
    },
    {
        id: 'deal003',
        name: 'Lunch Combo',
        description: '2 Tacos, Rice, Beans, and a Small Drink.',
        price: 9.99,
        originalPrice: 12.50,
        image: 'assets/images/lunch_combo.png',
        validity: {
            type: 'timeOfDay',
            startTime: '11:00', // 11 AM
            endTime: '15:00',   // 3 PM
            days: [1, 2, 3, 4, 5] // Monday to Friday
        },
        conditions: 'Available Monday to Friday, 11 AM - 3 PM.',
        active: true
    },
    {
        id: 'deal004',
        name: 'Happy Hour Nachos',
        description: 'Half-price on our Grande Nachos during Happy Hour.',
        price: 7.50,
        originalPrice: 15.00,
        image: 'assets/images/happy_hour_nachos.png',
        validity: {
            type: 'timeOfDay',
            startTime: '16:00', // 4 PM
            endTime: '18:00',   // 6 PM
            days: [1, 2, 3, 4, 5] // Monday to Friday
        },
        conditions: 'Available Mon-Fri, 4 PM - 6 PM.',
        active: true
    },
    {
        id: 'deal005',
        name: 'Expired Deal Example',
        description: 'This deal is no longer active.',
        price: 10.00,
        originalPrice: 20.00,
        image: 'assets/images/expired_deal.png',
        validity: {
            type: 'always'
        },
        conditions: 'This was a great deal.',
        active: false // Inactive deal
    }
];

// --- Utility Functions ---
/**
 * Checks if a deal is currently valid based on its validity rules.
 * @param {object} deal - The deal object.
 * @returns {boolean} - True if the deal is valid, false otherwise.
 */
function isDealCurrentlyValid(deal) {
    if (!deal.active) {
        return false;
    }

    const now = new Date();
    const validity = deal.validity;

    if (!validity) return true; // If no validity rules, assume always valid if active

    switch (validity.type) {
        case 'dayOfWeek':
            return now.getDay() === validity.value;
        case 'dateRange':
            // Ensure dates are correctly parsed. Assumes YYYY-MM-DD format.
            const startDate = new Date(validity.startDate + "T00:00:00");
            const endDate = new Date(validity.endDate + "T23:59:59");
            return now >= startDate && now <= endDate;
        case 'timeOfDay':
            if (validity.days && !validity.days.includes(now.getDay())) {
                return false; // Not the correct day of the week
            }
            const currentTimeString = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
            return currentTimeString >= validity.startTime && currentTimeString <= validity.endTime;
        case 'always':
            return true;
        default:
            console.warn(`Unknown validity type for deal ${deal.id}: ${validity.type}`);
            return true; // Default to true if type is unknown but deal is active
    }
}

// --- Core Deal Functions ---

/**
 * Fetches all deals.
 * @param {boolean} onlyCurrentlyValid - If true, returns only active and currently valid deals.
 * @returns {Promise<Array<object>>} - A promise that resolves to an array of deal objects.
 */
async function getDeals(onlyCurrentlyValid = true) {
    // Simulate API call delay
    await new Promise(resolve => setTimeout(resolve, 50));

    if (onlyCurrentlyValid) {
        return currentDealsData.filter(deal => deal.active && isDealCurrentlyValid(deal));
    }
    return [...currentDealsData]; // Return a copy
}

/**
 * Renders deals to a specified DOM container.
 * @param {Array<object>} dealsToDisplay - Array of deal objects to display.
 * @param {string} containerId - The ID of the HTML element to append deals to.
 */
function displayDeals(dealsToDisplay, containerId) {
    const container = document.getElementById(containerId);
    if (!container) {
        console.error(`Deals container with ID "${containerId}" not found.`);
        return;
    }

    container.innerHTML = ''; // Clear previous deals

    if (dealsToDisplay.length === 0) {
        container.innerHTML = '<p class="no-deals-message">No current deals available. Check back soon!</p>';
        return;
    }

    const ul = document.createElement('ul');
    ul.className = 'deals-list';

    dealsToDisplay.forEach(deal => {
        const li = document.createElement('li');
        li.className = 'deal-item';
        li.dataset.dealId = deal.id;

        li.innerHTML = `
            <img src="${deal.image || 'assets/images/default_deal.png'}" alt="${deal.name}" class="deal-image">
            <div class="deal-info">
                <h3 class="deal-name">${deal.name}</h3>
                <p class="deal-description">${deal.description}</p>
                <div class="deal-pricing">
                    <span class="deal-price">$${deal.price.toFixed(2)}</span>
                    ${deal.originalPrice ? `<span class="deal-original-price">$${deal.originalPrice.toFixed(2)}</span>` : ''}
                </div>
                ${deal.conditions ? `<p class="deal-conditions"><em>${deal.conditions}</em></p>` : ''}
            </div>
            <button class="deal-apply-button" data-deal-id="${deal.id}">Apply Deal</button>
        `;
        ul.appendChild(li);
    });
    container.appendChild(ul);

    // Add event listeners to "Apply Deal" buttons
    container.querySelectorAll('.deal-apply-button').forEach(button => {
        button.addEventListener('click', (event) => {
            const dealId = event.target.dataset.dealId;
            handleApplyDeal(dealId);
        });
    });
}

/**
 * Handles applying a deal.
 * Placeholder function - actual implementation depends on the app's order system.
 * @param {string} dealId - The ID of the deal to apply.
 */
function handleApplyDeal(dealId) {
    const deal = currentDealsData.find(d => d.id === dealId);
    if (deal) {
        if (deal.active && isDealCurrentlyValid(deal)) {
            console.log(`Applying deal: ${deal.name} (ID: ${dealId})`);
            // In a real application, this would interact with an order/cart system.
            // e.g., cart.addDeal(deal), or trigger an event for another module.
            alert(`Deal "${deal.name}" applied! (This is a placeholder action)`);
        } else {
            alert(`Sorry, the deal "${deal.name}" is currently not valid or available.`);
        }
    } else {
        console.error(`Deal with ID ${dealId} not found for application.`);
        alert('Error: Could not find the selected deal.');
    }
}

// --- Admin Functions (Example - might be in a separate admin module) ---

/**
 * Adds a new deal to the list.
 * In a real app, this would also involve saving to a backend/database.
 * @param {object} dealData - The data for the new deal.
 * @returns {object} The added deal object.
 */
function addDeal(dealData) {
    const newDeal = {
        id: `deal${Date.now()}_${Math.random().toString(36).substr(2, 5)}`, // More unique ID
        active: true,
        ...dealData
    };
    currentDealsData.push(newDeal);
    console.log('Admin: Deal added:', newDeal);
    // Refresh the displayed deals (if a display is active)
    // Example: initDealsPage('deals-container');
    return newDeal;
}

/**
 * Updates an existing deal.
 * @param {string} dealId - The ID of the deal to update.
 * @param {object} updatedData - The new data for the deal.
 * @returns {object|null} The updated deal object or null if not found.
 */
function updateDeal(dealId, updatedData) {
    const dealIndex = currentDealsData.findIndex(d => d.id === dealId);
    if (dealIndex > -1) {
        // Preserve existing ID and merge data, ensuring 'active' and 'validity' are handled if part of updatedData
        currentDealsData[dealIndex] = { ...currentDealsData[dealIndex], ...updatedData };
        console.log('Admin: Deal updated:', currentDealsData[dealIndex]);
        // Refresh the displayed deals
        // Example: initDealsPage('deals-container');
        return currentDealsData[dealIndex];
    }
    console.error(`Admin: Deal with ID ${dealId} not found for update.`);
    return null;
}

/**
 * Deletes a deal (soft delete by setting active to false, or hard delete).
 * @param {string} dealId - The ID of the deal to delete.
 * @param {boolean} hardDelete - If true, removes from array. Otherwise, sets active to false.
 * @returns {boolean} True if successful, false otherwise.
 */
function deleteDeal(dealId, hardDelete = false) {
    const dealIndex = currentDealsData.findIndex(d => d.id === dealId);
    if (dealIndex > -1) {
        if (hardDelete) {
            currentDealsData.splice(dealIndex, 1);
            console.log(`Admin: Deal ${dealId} hard deleted.`);
        } else {
            currentDealsData[dealIndex].active = false;
            console.log(`Admin: Deal ${dealId} deactivated (soft delete).`);
        }
        // Refresh the displayed deals
        // Example: initDealsPage('deals-container');
        return true;
    }
    console.error(`Admin: Deal with ID ${dealId} not found for deletion.`);
    return false;
}

// --- Initialization ---
/**
 * Initializes the deals section/page.
 * Fetches deals and displays them in the specified container.
 * @param {string} containerId - The ID of the HTML element where deals should be displayed.
 */
async function initDealsPage(containerId = 'deals-container') {
    console.log(`Initializing deals page into container: #${containerId}`);
    try {
        const dealsToDisplay = await getDeals(true); // Get only active and currently valid deals
        displayDeals(dealsToDisplay, containerId);
    } catch (error) {
        console.error("Failed to initialize deals page:", error);
        const container = document.getElementById(containerId);
        if (container) {
            container.innerHTML = "<p class='error-message'>Error loading deals. Please try again later.</p>";
        }
    }
}

// --- Module Exports or Global Registration ---
// Depending on the application structure (e.g., ES modules, CommonJS, or global script)
// For a simple script include in HTML, functions are globally available.
// Example for ES Modules:
// export { initDealsPage, getDeals, handleApplyDeal, addDeal, updateDeal, deleteDeal };

// Example of how to call initialization when the DOM is ready,
// if this script is included in an HTML page.
// For a desktop app, this might be triggered by a view load event.
/*
document.addEventListener('DOMContentLoaded', () => {
    // Check if a deals container exists on the current page/view
    if (document.getElementById('deals-container')) {
        initDealsPage('deals-container');
    }

    // Example: Hook up admin functions to buttons if they exist
    // const addDealButton = document.getElementById('admin-add-deal-btn');
    // if(addDealButton) {
    //   addDealButton.addEventListener('click', () => {
    //     const sampleDeal = { name: 'New Test Deal', description: 'A great new deal', price: 1.99, active: true, validity: {type: 'always'}};
    //     addDeal(sampleDeal);
    //     initDealsPage('deals-container'); // Refresh list
    //   });
    // }
});
*/

console.log("deals.js loaded for TACOnganas.");