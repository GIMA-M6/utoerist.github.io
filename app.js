// 1. Initialiseer de kaart gecentreerd op Utrecht
const map = L.map('map').setView([52.0907, 5.1214], 14);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© OpenStreetMap contributors'
}).addTo(map);

// 2. Variabelen om data op te slaan
let startCoords = null;
let endCoords = null;
let routeLine = null;
let markers = [];

// --- FUNCTIE: Geocoding via OpenStreetMap (Nominatim) ---
async function geocodeLocation(query, isStart) {
    const statusText = document.getElementById('status-text');
    statusText.innerText = "Searching for location...";

    // Voeg ', Utrecht' toe zodat zoeken buiten de stad wordt voorkomen
    const searchUrl = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query + ', Utrecht')}&limit=1`;

    try {
        const response = await fetch(searchUrl);
        const data = await response.json();

        if (data.length > 0) {
            const lat = parseFloat(data[0].lat);
            const lng = parseFloat(data[0].lon);
            const placeName = data[0].display_name.split(',')[0]; // Korte naam

            const coords = { lat: lat, lng: lng };
            
            if (isStart) {
                startCoords = coords;
                document.getElementById('start-input').value = placeName;
            } else {
                endCoords = coords;
                document.getElementById('end-input').value = placeName;
            }

            // Plaats pin en zoom
            const marker = L.marker([lat, lng]).addTo(map);
            markers.push(marker);
            map.setView([lat, lng], 15);
            
            statusText.innerText = "Location found!";
        } else {
            statusText.innerText = "Location not found in Utrecht.";
        }
    } catch (error) {
        console.error("Geocoding Error:", error);
        statusText.innerText = "Search failed.";
    }
}

// --- EVENT LISTENERS: Klikken op de kaart ---
map.on('click', function(e) {
    if (!startCoords) {
        startCoords = e.latlng;
        document.getElementById('start-input').value = `Lat: ${e.latlng.lat.toFixed(4)}, Lon: ${e.latlng.lng.toFixed(4)}`;
        markers.push(L.marker(e.latlng).addTo(map));
    } else if (!endCoords) {
        endCoords = e.latlng;
        document.getElementById('end-input').value = `Lat: ${e.latlng.lat.toFixed(4)}, Lon: ${e.latlng.lng.toFixed(4)}`;
        markers.push(L.marker(e.latlng).addTo(map));
    }
});

// --- EVENT LISTENERS: Zoekbalken ---
document.getElementById('search-start').addEventListener('click', function() {
    const query = document.getElementById('start-input').value;
    if (query.length > 2) geocodeLocation(query, true);
});

document.getElementById('search-end').addEventListener('click', function() {
    const query = document.getElementById('end-input').value;
    if (query.length > 2) geocodeLocation(query, false);
});

// Zorg dat 'Enter' ook werkt in de zoekbalken
document.getElementById('start-input').addEventListener('keypress', function(e) {
    if (e.key === 'Enter') document.getElementById('search-start').click();
});
document.getElementById('end-input').addEventListener('keypress', function(e) {
    if (e.key === 'Enter') document.getElementById('search-end').click();
});

// --- EVENT LISTENER: Route Berekenen (API Aanroep) ---
document.getElementById('calc-btn').addEventListener('click', async function() {
    if (!startCoords || !endCoords) {
        alert("Please select both an Origin and a Destination first!");
        return;
    }

    const statusText = document.getElementById('status-text');
    statusText.innerText = "Calculating route... (waking up server if asleep, max 60s)";

    // Link naar jullie live Render Python API
    const apiUrl = `https://route-backend-api.onrender.com/get-route?start_lat=${startCoords.lat}&start_lon=${startCoords.lng}&end_lat=${endCoords.lat}&end_lon=${endCoords.lng}`;

    try {
        const response = await fetch(apiUrl);
        if (!response.ok) throw new Error("Server error or sleep timeout");
        
        const data = await response.json();
        
        if (data.status === "success") {
            if (routeLine) map.removeLayer(routeLine);
            
            // Teken de rode lijn
            routeLine = L.polyline(data.route, {color: '#e32400', weight: 6, opacity: 0.8}).addTo(map);
            map.fitBounds(routeLine.getBounds());
            statusText.innerText = "Route found!";
        } else {
            statusText.innerText = "Could not find a route.";
        }
    } catch (error) {
        console.error("API Error:", error);
        statusText.innerText = "Error connecting to server. Please try again.";
    }
});

// --- EVENT LISTENER: Reset de kaart ---
document.getElementById('reset-btn').addEventListener('click', function() {
    startCoords = null;
    endCoords = null;
    
    document.getElementById('start-input').value = "";
    document.getElementById('end-input').value = "";
    document.getElementById('status-text').innerText = "";
    
    if (routeLine) map.removeLayer(routeLine);
    markers.forEach(marker => map.removeLayer(marker));
    markers = [];
});
