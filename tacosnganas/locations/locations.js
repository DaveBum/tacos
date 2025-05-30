let map;
let markers = [];
let infoWindow;
let locationsData = [];

const GMAP_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY; // For Vite/ESM, or use process.env for Node

// Custom Sombrero-Taco Pin SVG (Pink)
const customPinSvg = {
    path: "M16 0C7.163 0 0 7.163 0 16c0 2.795.708 5.422 2.001 7.752L16 48l13.999-24.248C31.292 21.422 32 18.795 32 16 32 7.163 24.837 0 16 0zm0 24a8 8 0 110-16 8 8 0 010 16z M10 14 Q16 10 22 14 Q16 18 10 14Z", // Simplified taco/sombrero
    fillColor: "#EC008C", // --tg-pink
    fillOpacity: 1,
    strokeWeight: 0,
    rotation: 0,
    scale: 0.8, // 32x48px effective size (0.8 * 40x60 base for path)
    anchor: new google.maps.Point(16, 48), // Tip of the pin
    labelOrigin: new google.maps.Point(16, 16) // Center of the circle part for numeric label
};

async function fetchLocations() {
    try {
        const response = await fetch('../data/locations.json');
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        locationsData = await response.json();
        // The provided JSON has a different structure, so we need to adapt it.
        // We need to generate an `id` and extract lat/lng if they are not top-level.
        // For this example, I'll assume lat/lng might be missing and need to be geocoded, or are present.
        // The prompt implies lat/lng are directly available in the JSON.
        // The provided JSON in the prompt is different from the one I can see in the workspace.
        // I will use the structure from the prompt.
        // "image" field in prompt's JSON: "119 N Danny Thomas Blvd. Memphis, TN 38103.jpeg"
        // "image" field in workspace JSON: not present, but we have address components to build it.

        // Let's re-map based on the prompt's JSON structure for lat/lng and image.
        // If the actual JSON is different, this mapping will need adjustment.
        locationsData = locationsData.map(loc => {
            // Attempt to create an ID from the name if not present
            const id = loc.id || loc.name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
            const imageFilename = loc.image || `${loc.address.street} ${loc.address.city}, ${loc.address.state} ${loc.address.zip}.jpeg`;
            
            // Crucially, the prompt specifies lat/lng directly on the object.
            // The workspace JSON does NOT have lat/lng. This is a major discrepancy.
            // For now, I will proceed assuming lat/lng ARE in the JSON as per the prompt.
            // If they are not, geocoding would be required, which is a much larger task.
            return {
                ...loc,
                id: id,
                // Ensure lat/lng are numbers
                lat: parseFloat(loc.lat),
                lng: parseFloat(loc.lng),
                image: imageFilename // Use the image field from prompt or construct it
            };
        });

        return locationsData;
    } catch (error) {
        console.error("Failed to fetch locations:", error);
        const listContainer = document.getElementById('locations-list');
        if(listContainer) listContainer.innerHTML = '<p>Error loading location data. Please try again later.</p>';
        return []; // Return empty array on error
    }
}

function initMap() {
    if (typeof google === 'undefined' || typeof google.maps === 'undefined') {
        console.error('Google Maps API not loaded.');
        // Optionally, display an error message to the user on the map itself
        const mapContainer = document.getElementById('map-container');
        if(mapContainer) mapContainer.innerHTML = '<p>Error loading Google Maps. Please check your internet connection or API key configuration.</p>';
        return;
    }

    map = new google.maps.Map(document.getElementById('map-container'), {
        center: { lat: 35.1173, lng: -89.9711 }, // Centered on Memphis, TN approx.
        zoom: 11,
        mapId: 'TACOSNGANAS_MAP_ID', // Optional: For cloud-based map styling
        streetViewControl: false,
        mapTypeControl: false,
        fullscreenControl: false,
        styles: [ // Basic styles to reduce clutter, more can be added from tacosnganas.css vars if needed
            {
                featureType: "poi",
                stylers: [{ visibility: "off" }]
            },
            {
                featureType: "transit",
                stylers: [{ visibility: "off" }]
            }
        ]
    });

    infoWindow = new google.maps.InfoWindow();

    fetchLocations().then(locations => {
        if (locations && locations.length > 0) {
            displayLocationList(locations);
            createMarkers(locations);
            if (locations.length > 0 && locations[0].lat && locations[0].lng) {
                 map.setCenter({ lat: locations[0].lat, lng: locations[0].lng });
                 map.setZoom(12);
            } else if (locations.length > 0) {
                // Fallback if first location has no lat/lng (should not happen with data validation)
                console.warn('First location is missing lat/lng. Using default map center.');
            }
        } else {
            console.log('No locations to display.');
        }
    });
}

function createMarkers(locations) {
    markers.forEach(marker => marker.setMap(null)); // Clear existing markers
    markers = [];

    locations.forEach((location, index) => {
        if (typeof location.lat !== 'number' || typeof location.lng !== 'number') {
            console.warn(`Location "${location.name}" is missing valid coordinates. Skipping marker.`);
            return; // Skip if lat or lng is not a valid number
        }

        const marker = new google.maps.marker.AdvancedMarkerElement({
            map: map,
            position: { lat: location.lat, lng: location.lng },
            title: location.name,
            content: buildMarkerContent(index + 1) // Pass numeric label
        });

        marker.addListener('click', () => {
            openInfoWindow(marker, location);
            map.panTo(marker.position);
            highlightLocationCard(location.id);
        });
        markers.push(marker);
    });
}

function buildMarkerContent(labelNumber) {
    const pinElement = document.createElement('div');
    pinElement.className = 'custom-map-pin-container'; // For potential future styling needs

    // Using the SVG directly for the marker icon via the API is preferred.
    // However, AdvancedMarkerElement content is an HTMLElement.
    // We will create an SVG element for the pin.
    const svgNS = "http://www.w3.org/2000/svg";
    const svgEl = document.createElementNS(svgNS, "svg");
    svgEl.setAttribute("xmlns", svgNS);
    svgEl.setAttribute("viewBox", "0 0 32 48");
    svgEl.setAttribute("width", "32");
    svgEl.setAttribute("height", "48");

    const path1 = document.createElementNS(svgNS, "path");
    path1.setAttribute("fill", "var(--tg-pink, #EC008C)"); // Fallback color
    path1.setAttribute("d", "M16 0C7.163 0 0 7.163 0 16c0 2.795.708 5.422 2.001 7.752L16 48l13.999-24.248C31.292 21.422 32 18.795 32 16 32 7.163 24.837 0 16 0zm0 24a8 8 0 110-16 8 8 0 010 16z");
    
    const path2 = document.createElementNS(svgNS, "path"); // Taco part
    path2.setAttribute("fill", "var(--tg-yellow, #F9C440)"); // Fallback color
    path2.setAttribute("d", "M10 14 Q16 10 22 14 Q16 18 10 14Z");

    svgEl.appendChild(path1);
    svgEl.appendChild(path2);
    pinElement.appendChild(svgEl);

    const labelEl = document.createElement('span');
    labelEl.className = 'pin-label';
    labelEl.textContent = labelNumber;
    labelEl.style.position = 'absolute';
    labelEl.style.top = '13px'; // Adjust based on 32x48 pin visual center for number
    labelEl.style.left = '50%';
    labelEl.style.transform = 'translateX(-50%)';
    labelEl.style.color = 'var(--tg-bg, #FFFFFF)';
    labelEl.style.fontFamily = 'var(--font-body, Inter)';
    labelEl.style.fontWeight = '700';
    labelEl.style.fontSize = '12px'; // Inter 700, tabular-nums (CSS handles tabular-nums)
    labelEl.style.fontVariantNumeric = 'tabular-nums';

    pinElement.appendChild(labelEl);
    return pinElement;
}


function openInfoWindow(markerOrElement, location) {
    const street = location.address?.street || location.name; // Fallback to name if street missing
    const cityStateZip = `${location.address?.city || ''}, ${location.address?.state || ''} ${location.address?.zip || ''}`.replace(/^, | , $|, $/, '');

    const hoursString = formatHours(location.hours);
    const phoneLink = location.phone ? `<a href="tel:${location.phone}">${formatPhoneNumber(location.phone)}</a>` : 'N/A';

    const contentString = `
        <div class="infowindow-content">
            <h4>${location.name}</h4>
            <p>${street}<br>${cityStateZip}</p>
            <p><strong>Phone:</strong> ${phoneLink}</p>
            <p><strong>Hours:</strong><br>${hoursString}</p>
            <a href="https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(`${street}, ${cityStateZip}`)}" target="_blank" rel="noopener noreferrer">Get Directions</a>
        </div>`;

    infoWindow.setContent(contentString);
    // For AdvancedMarkerElement, anchor is the element itself if it's an HTMLElement, or the marker if not.
    const anchor = (markerOrElement instanceof google.maps.marker.AdvancedMarkerElement) ? markerOrElement : markerOrElement.content;
    infoWindow.open(map, anchor);
}

function displayLocationList(locations) {
    const listContainer = document.getElementById('locations-list');
    if (!listContainer) return;
    listContainer.innerHTML = ''; // Clear previous list

    if (locations.length === 0) {
        listContainer.innerHTML = '<p>No locations found.</p>';
        return;
    }

    locations.forEach(location => {
        const card = document.createElement('div');
        card.className = 'location-card';
        card.id = `location-${location.id}`; // Unique ID for highlighting
        card.setAttribute('role', 'listitem');
        card.setAttribute('tabindex', '0'); // Make it focusable

        const imagePath = `../images/locations/${location.image || 'placeholder.jpg'}`;
        const street = location.address?.street || location.name;
        const cityStateZip = `${location.address?.city || ''}, ${location.address?.state || ''} ${location.address?.zip || ''}`.replace(/^, | , $|, $/, '');
        const phoneDisplay = location.phone ? formatPhoneNumber(location.phone) : 'Not available';
        const hoursHtml = formatHoursForCard(location.hours);

        card.innerHTML = `
            <img src="${imagePath}" alt="Exterior of ${location.name}" class="location-card-image" loading="lazy">
            <h3>${location.name}</h3>
            <p class="address">${street}<br>${cityStateZip}</p>
            <p class="phone"><strong>Phone:</strong> ${phoneDisplay}</p>
            <div class="hours">
                <p class="hours-title"><strong>Hours:</strong></p>
                ${hoursHtml}
            </div>
            <a href="https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(`${street}, ${cityStateZip}`)}" target="_blank" rel="noopener noreferrer" class="directions-link">Get Directions</a>
        `;

        card.addEventListener('click', () => {
            if (location.lat && location.lng) {
                map.panTo({ lat: location.lat, lng: location.lng });
                map.setZoom(15);
                const targetMarker = markers.find(m => m.title === location.name);
                if (targetMarker) {
                    openInfoWindow(targetMarker, location);
                }
            }
            highlightLocationCard(location.id);
        });
        card.addEventListener('keypress', (event) => {
            if (event.key === 'Enter' || event.key === ' ') {
                card.click();
            }
        });

        listContainer.appendChild(card);
    });
}

function highlightLocationCard(locationId) {
    document.querySelectorAll('.location-card').forEach(card => {
        card.classList.remove('active-location');
    });
    const activeCard = document.getElementById(`location-${locationId}`);
    if (activeCard) {
        activeCard.classList.add('active-location');
        activeCard.focus(); // For accessibility, focus the activated card
        // Scroll into view if not fully visible
        activeCard.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
}

function formatPhoneNumber(phoneStr) {
    if (!phoneStr) return 'N/A';
    const cleaned = ('' + phoneStr).replace(/\D/g, '');
    const match = cleaned.match(/^(\d{3})(\d{3})(\d{4})$/);
    if (match) {
        return `(${match[1]}) ${match[2]}-${match[3]}`;
    }
    return phoneStr; // Return original if not a 10-digit number
}

function formatHours(hoursData) {
    if (!hoursData) return 'N/A';
    // The prompt's JSON structure for hours is different from the workspace one.
    // Prompt: "hours": { "mon-thu": "8 AM – 10 PM", "fri-sat": "8 AM – 12 AM", "sun": "10 AM – 9 PM" }
    // Workspace: "hours": { "monday_thursday": "10AM - 9PM", "friday_sunday": "10AM - 10PM" }
    // Adapting to the prompt's structure:
    let formatted = '';
    if (hoursData["mon-thu"]) formatted += `Mon-Thu: ${hoursData["mon-thu"]}<br>`;
    if (hoursData["fri-sat"]) formatted += `Fri-Sat: ${hoursData["fri-sat"]}<br>`;
    if (hoursData["sun"]) formatted += `Sun: ${hoursData["sun"]}<br>`;
    
    // Fallback for workspace structure if prompt structure fields are missing
    if (!formatted && hoursData.monday_thursday) formatted += `Mon-Thu: ${hoursData.monday_thursday}<br>`;
    if (!formatted && hoursData.friday_saturday) formatted += `Fri-Sat: ${hoursData.friday_saturday}<br>`;
    if (!formatted && hoursData.sunday && !hoursData.friday_saturday) { // if friday_saturday covers sunday
         if(hoursData.friday_sunday && !hoursData.friday_saturday) formatted += `Fri-Sun: ${hoursData.friday_sunday}<br>`;
         else if(hoursData.sunday) formatted += `Sun: ${hoursData.sunday}<br>`;
    } else if (!formatted && hoursData.friday_sunday) {
        formatted += `Fri-Sun: ${hoursData.friday_sunday}<br>`;
    }

    return formatted.trim() || 'Hours not available';
}

function formatHoursForCard(hoursData) {
    if (!hoursData) return '<ul><li>Hours not available</li></ul>';
    let listItems = '';
    // Adapting to prompt's structure first
    if (hoursData["mon-thu"]) listItems += `<li><strong>Mon-Thu:</strong> ${hoursData["mon-thu"]}</li>`;
    if (hoursData["fri-sat"]) listItems += `<li><strong>Fri-Sat:</strong> ${hoursData["fri-sat"]}</li>`;
    if (hoursData["sun"]) listItems += `<li><strong>Sun:</strong> ${hoursData["sun"]}</li>`;

    // Fallback for workspace structure
    if (!listItems && hoursData.monday_thursday) listItems += `<li><strong>Mon-Thu:</strong> ${hoursData.monday_thursday}</li>`;
    if (!listItems && hoursData.friday_saturday) listItems += `<li><strong>Fri-Sat:</strong> ${hoursData.friday_saturday}</li>`;
    if (!listItems && hoursData.sunday && !hoursData.friday_saturday) {
        if(hoursData.friday_sunday && !hoursData.friday_saturday) listItems += `<li><strong>Fri-Sun:</strong> ${hoursData.friday_sunday}</li>`;
        else if(hoursData.sunday) listItems += `<li><strong>Sun:</strong> ${hoursData.sunday}</li>`;
    } else if (!listItems && hoursData.friday_sunday) {
        listItems += `<li><strong>Fri-Sun:</strong> ${hoursData.friday_sunday}</li>`;
    }
    
    return `<ul>${listItems || '<li>Hours not available</li>'}</ul>`;
}

// Expose initMap to global scope for Google Maps callback
window.initMap = initMap;

// Add event listener for DOMContentLoaded to ensure HTML is parsed before scripts run,
// though Google Maps async defer script might handle this.
// document.addEventListener('DOMContentLoaded', () => {
//     // initMap will be called by Google Maps API callback, so no explicit call here unless API key is missing.
//     // If API key is known to be missing or there's an issue, could trigger a fallback.
//     if (!GMAP_API_KEY) {
//         console.warn("Google Maps API Key is missing. Map functionality will be limited.");
//         const mapContainer = document.getElementById('map-container');
//         if(mapContainer) mapContainer.innerHTML = '<p>Map is unavailable. API key missing.</p>';
//         // Still try to load locations for the list view
//         fetchLocations().then(locations => displayLocationList(locations));
//     }
// });

// Handle API key in HTML
// The HTML script tag for Google Maps should look like:
// <script src="https://maps.googleapis.com/maps/api/js?key=YOUR_GOOGLE_MAPS_API_KEY&callback=initMap&libraries=marker&v=beta" async defer></script>
// The key `YOUR_GOOGLE_MAPS_API_KEY` needs to be replaced with the actual key, ideally from an environment variable.
// Since we cannot directly access .env here for the HTML, this is a reminder that it must be set in the HTML file.
// For a production build, a build process would typically inject this.

