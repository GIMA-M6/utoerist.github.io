const map = L.map('map', { zoomControl: false }).setView([52.0907, 5.1214], 13);

L.control.zoom({ position: 'bottomright' }).addTo(map);
L.tileLayer('https://{s}.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, Tiles style by <a href="https://www.hotosm.org/" target="_blank">Humanitarian OpenStreetMap Team</a> hosted by <a href="https://openstreetmap.fr/" target="_blank">OpenStreetMap France</a>'
}).addTo(map);
// Utrecht Bounding Box

async function drawUtrechtMask() {
    try {

        const response = await fetch('JSONUTRECHT.geojson');
        const data = await response.json();

        let utrechtCoords = [];

        const geometry = data.features ? data.features[0].geometry : data.geometry;

        if (!geometry) {
            console.error("No geometry found in JSONUTRECHT.geojson");
            return;
        }

        if (geometry.type === 'Polygon') {
            utrechtCoords = geometry.coordinates[0].map(c => [c[1], c[0]]);
        } else if (geometry.type === 'MultiPolygon') {
            utrechtCoords = geometry.coordinates[0][0].map(c => [c[1], c[0]]);
        }

        const outerWorld = [
            [90, -180],
            [90, 180],
            [-90, 180],
            [-90, -180]
        ];

        L.polygon([outerWorld, utrechtCoords], {
            color: '#333', 
            weight: 2, 
            fillColor: '#000', 
            fillOpacity: 0.4,
            interactive: false
        }).addTo(map);

    } catch (error) {
        console.error("Error loading JSONUTRECHT.geojson:", error);
    }
}

drawUtrechtMask();

let startCoords = null;
let endCoords = null;
let mainRouteLine = null;
let altRouteLine = null;
let markers = [];
let timeoutId;

function formatDistance(meters) {
    if (meters >= 1000) return (meters / 1000).toFixed(1) + " km";
    return Math.round(meters) + " m";
}

function formatTime(mins) {
    if (mins < 1) return "1 min";
    if (mins >= 60) {
        let h = Math.floor(mins / 60);
        let m = mins % 60;
        return h + " h" + (m > 0 ? " " + m + " min" : "");
    }
    return mins + " min";
}

async function getAddressFromCoords(lat, lng) {
    try {
        const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`);
        const data = await response.json();
        
        if (data && data.address) {
            let street = data.address.road || data.address.pedestrian || data.address.footway || data.address.cycleway || "";
            let number = data.address.house_number || "";
            let city = data.address.city || data.address.town || data.address.village || "Utrecht";
            
            if (street) {
                let formattedAddress = `${street} ${number}, ${city}`;
                return formattedAddress.replace(" ,", ",").trim(); 
            }
            return data.display_name.split(",")[0] + ", " + city;
        }
    } catch (error) {
        console.error("Geocoding failed:", error);
    }
    return `Lat: ${lat.toFixed(4)}, Lon: ${lng.toFixed(4)}`; 
}

// Autocomplete
async function fetchSuggestions(query, boxId, isStart) {
    const box = document.getElementById(boxId);
    
    if (query.length < 3) {
        box.style.display = 'none';
        return;
    }

    const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query + ', Utrecht')}&limit=5`;

    try {
        const response = await fetch(url);
        const data = await response.json();
        
        box.innerHTML = ''; 
        
        if (data.length > 0) {
            data.forEach(item => {
                const div = document.createElement('div');
                div.className = 'suggestion-item';
                
                const shortName = item.display_name.split(',').slice(0, 2).join(',');
                div.innerText = shortName;
                
                // Wat er gebeurt als je op een suggestie klikt
                div.onclick = () => {
                    const inputId = isStart ? 'start-input' : 'end-input';
                    document.getElementById(inputId).value = shortName; 
                    box.style.display = 'none'; 
                    geocodeExactLocation(item, isStart);
                };
                
                box.appendChild(div);
            });
            box.style.display = 'block'; 
        } else {
            box.style.display = 'none';
        }
    } catch (error) {
        console.error("Suggestion Error:", error);
    }
}

// Click Functionality
function geocodeExactLocation(data, isStart) {
    const lat = parseFloat(data.lat);
    const lng = parseFloat(data.lon);
    const coords = { lat: lat, lng: lng };
    
    if (isStart) startCoords = coords;
    else endCoords = coords;

    const marker = L.marker([lat, lng]).addTo(map);
    markers.push(marker);
    map.setView([lat, lng], 15);
    document.getElementById('status-text').innerText = "Location selected!";
}

// Drop-down menu
document.getElementById('start-input').addEventListener('input', function(e) {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fetchSuggestions(e.target.value, 'start-suggestions', true), 500);
});

document.getElementById('end-input').addEventListener('input', function(e) {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fetchSuggestions(e.target.value, 'end-suggestions', false), 500);
});

document.addEventListener('click', function(e) {
    if (!e.target.closest('.input-group')) {
        document.getElementById('start-suggestions').style.display = 'none';
        document.getElementById('end-suggestions').style.display = 'none';
    }
});


// Searching
async function geocodeLocation(query, isStart) {
    const statusText = document.getElementById('status-text');
    statusText.innerText = "Searching for location...";

    const searchUrl = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query + ', Utrecht')}&limit=1`;

    try {
        const response = await fetch(searchUrl);
        const data = await response.json();

        if (data.length > 0) {
            geocodeExactLocation(data[0], isStart);
            
            const placeName = data[0].display_name.split(',').slice(0, 2).join(', ');
            
            if (isStart) document.getElementById('start-input').value = placeName;
            else document.getElementById('end-input').value = placeName;
            
            statusText.innerText = "Location found!";
        } else {
            statusText.innerText = "Location not found in Utrecht.";
        }
    } catch (error) {
        statusText.innerText = "Search failed.";
    }
}

document.getElementById('search-start').addEventListener('click', () => {
    const query = document.getElementById('start-input').value;
    if (query.length > 2) geocodeLocation(query, true);
});
document.getElementById('search-end').addEventListener('click', () => {
    const query = document.getElementById('end-input').value;
    if (query.length > 2) geocodeLocation(query, false);
});
document.getElementById('start-input').addEventListener('keypress', e => {
    if (e.key === 'Enter') document.getElementById('search-start').click();
});
document.getElementById('end-input').addEventListener('keypress', e => {
    if (e.key === 'Enter') document.getElementById('search-end').click();
});

// Current Location
document.getElementById('loc-btn').addEventListener('click', function() {
    if (!navigator.geolocation) {
        alert("Current location not supported by your browser.");
        return;
    }

    const startInput = document.getElementById('start-input');
    startInput.value = "Searching location...";

    navigator.geolocation.getCurrentPosition(
        async function(position) {
            const lat = position.coords.latitude;
            const lng = position.coords.longitude;

            if (startCoords && endCoords) {
                document.getElementById('reset-btn').click(); 
            }

            startCoords = { lat: lat, lng: lng };

            const marker = L.marker([lat, lng], { title: "Current Location" }).addTo(map);
            markers.push(marker);
            map.setView([lat, lng], 16);

            const address = await getAddressFromCoords(lat, lng);
            startInput.value = address;
        },
        function(error) {
            console.error("Error getting location:", error);
            startInput.value = "";
            alert("Could not retrieve location. Ensure location access is enabled in your browser.");
        },
        {
            enableHighAccuracy: true
        }
    );
});

// Map Click Functionality
map.on('click', async function(e) {
    const lat = e.latlng.lat;
    const lng = e.latlng.lng;
    
    if (!startCoords || (startCoords && endCoords)) {
        
        if (startCoords && endCoords) {
            document.getElementById('reset-btn').click(); 
        }
        
        startCoords = { lat: lat, lng: lng };
        
        const marker = L.marker([lat, lng], { title: "Origin" }).addTo(map);
        markers.push(marker);
        
        document.getElementById('start-input').value = "Adres ophalen...";
        
        const address = await getAddressFromCoords(lat, lng);
        document.getElementById('start-input').value = address;
        
    } else if (!endCoords) {
        
        endCoords = { lat: lat, lng: lng };
        
        const marker = L.marker([lat, lng], { title: "Destination" }).addTo(map);
        markers.push(marker);
        
        document.getElementById('end-input').value = "Adres ophalen...";
        
        const address = await getAddressFromCoords(lat, lng);
        document.getElementById('end-input').value = address;
    }
});

// Scenic Slider
document.getElementById('scenic-slider').addEventListener('input', function(e) {
    const val = parseFloat(e.target.value);
    let text = "Balanced";
    if (val === 0) text = "Fastest Route";
    else if (val > 0 && val < 0.5) text = "Slightly Scenic";
    else if (val > 0.5 && val < 1) text = "Very Scenic";
    else if (val === 1) text = "Maximum Scenic";
    
    document.getElementById('scenic-value-display').innerText = `${text} (${val})`;
});

// Backend connection
document.getElementById('calc-btn').addEventListener('click', async function() {
    if (!startCoords || !endCoords) {
        alert("Please select both an Origin and a Destination first!");
        return;
    }

    const statusText = document.getElementById('status-text');
    statusText.innerText = "Calculating route... (waking up server if asleep, max 60s)";

    // API Link
    const alphaValue = parseFloat(document.getElementById('scenic-slider').value);

    let apiUrl = '';
    
    if (alphaValue === 0) {
        apiUrl = `https://olegbergs-route-backend-api.hf.space/get-route?start_lat=${startCoords.lat}&start_lon=${startCoords.lng}&end_lat=${endCoords.lat}&end_lon=${endCoords.lng}`;
    } else {
        apiUrl = `https://olegbergs-route-backend-api.hf.space/get-scenic-route?start_lat=${startCoords.lat}&start_lon=${startCoords.lng}&end_lat=${endCoords.lat}&end_lon=${endCoords.lng}&alpha=${alphaValue}`;
    }

    try {
        let altAlphaValue = alphaValue === 0 ? 1.0 : 0;
        
        let mainUrl = alphaValue === 0 
            ? `https://olegbergs-route-backend-api.hf.space/get-route?start_lat=${startCoords.lat}&start_lon=${startCoords.lng}&end_lat=${endCoords.lat}&end_lon=${endCoords.lng}`
            : `https://olegbergs-route-backend-api.hf.space/get-scenic-route?start_lat=${startCoords.lat}&start_lon=${startCoords.lng}&end_lat=${endCoords.lat}&end_lon=${endCoords.lng}&alpha=${alphaValue}`;
            
        let altUrl = altAlphaValue === 0 
            ? `https://olegbergs-route-backend-api.hf.space/get-route?start_lat=${startCoords.lat}&start_lon=${startCoords.lng}&end_lat=${endCoords.lat}&end_lon=${endCoords.lng}`
            : `https://olegbergs-route-backend-api.hf.space/get-scenic-route?start_lat=${startCoords.lat}&start_lon=${startCoords.lng}&end_lat=${endCoords.lat}&end_lon=${endCoords.lng}&alpha=${altAlphaValue}`;

        const [mainResponse, altResponse] = await Promise.all([
            fetch(mainUrl),
            fetch(altUrl)
        ]);

        if (!mainResponse.ok || !altResponse.ok) throw new Error("Server error or sleep timeout");
        
        const mainData = await mainResponse.json();
        const altData = await altResponse.json();
        
        if (mainData.status === "success" && altData.status === "success") {
            if (mainRouteLine) map.removeLayer(mainRouteLine);
            if (altRouteLine) map.removeLayer(altRouteLine);
            
            altRouteLine = L.polyline(altData.route, {
                color: '#444', weight: 5, opacity: 0.8, dashArray: '8, 8'
            }).addTo(map);

            const mainColor = alphaValue > 0 ? '#153bd4' : '#e32400'; 
            mainRouteLine = L.polyline(mainData.route, {
                color: mainColor, weight: 6, opacity: 0.9
            }).addTo(map);
            
            map.fitBounds(mainRouteLine.getBounds(), { padding: [50, 50] });
            statusText.innerText = "Routes found!";

            document.getElementById('main-route-title').innerText = alphaValue === 0 ? "Fastest Route" : "Scenic Route";
            document.getElementById('main-route-title').style.color = mainColor;
            document.getElementById('stat-dist').innerText = formatDistance(mainData.distance_m);
            document.getElementById('stat-time').innerText = formatTime(mainData.time_minutes);
            document.getElementById('stat-scenic').innerText = mainData.mean_scenic_score !== null ? mainData.mean_scenic_score.toFixed(1) : 'N/A';

            document.getElementById('alt-route-title').innerText = altAlphaValue === 0 ? "Fastest Alt." : "Scenic Alt.";
            document.getElementById('alt-stat-dist').innerText = formatDistance(altData.distance_m);
            document.getElementById('alt-stat-time').innerText = formatTime(altData.time_minutes);
            document.getElementById('alt-stat-scenic').innerText = altData.mean_scenic_score !== null ? altData.mean_scenic_score.toFixed(1) : 'N/A';
            
            document.getElementById('route-stats').style.display = 'block';

        } else {
            statusText.innerText = "Could not find one or both routes.";
            document.getElementById('route-stats').style.display = 'none';
        }
    } catch (error) {
        console.error("API Error:", error);
        statusText.innerText = "Error connecting to server. Please try again.";
        document.getElementById('route-stats').style.display = 'none';
    }
});


// Reset function
document.getElementById('reset-btn').addEventListener('click', function() {
    startCoords = null;
    endCoords = null;

    document.getElementById('start-input').value = "";
    document.getElementById('end-input').value = "";
    document.getElementById('status-text').innerText = "";
    document.getElementById('route-stats').style.display = 'none';

    if (mainRouteLine) map.removeLayer(mainRouteLine);
    if (altRouteLine) map.removeLayer(altRouteLine);
    markers.forEach(marker => map.removeLayer(marker));
    markers = [];

    document.getElementById('scenic-summary').innerText = "";
    document.getElementById('scenic-breakdown').innerHTML = "";
    document.getElementById('scenic-segments').innerHTML = "";
    document.getElementById('scenic-info').style.display = 'none';
});

// Menu Toggle
document.getElementById('toggle-menu-btn').addEventListener('click', function() {
    const uiPanel = document.getElementById('ui-panel');
    const btn = document.getElementById('toggle-menu-btn');
    
    if (uiPanel.classList.contains('panel-hidden')) {
        uiPanel.classList.remove('panel-hidden');
        btn.innerHTML = 'Hide Menu';
    } else {
        uiPanel.classList.add('panel-hidden');
        btn.innerHTML = 'Show Menu';
    }
});
