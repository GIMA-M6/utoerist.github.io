// 1. Initialiseer de kaart gecentreerd op Utrecht
const map = L.map('map').setView([52.0907, 5.1214], 14);
L.tileLayer('https://tiles.stadiamaps.com/tiles/outdoors/{z}/{x}/{y}{r}.{ext}', {
    minZoom: 0,
    maxZoom: 20,
    attribution: '&copy; <a href="https://www.stadiamaps.com/" target="_blank">Stadia Maps</a> &copy; <a href="https://openmaptiles.org/" target="_blank">OpenMapTiles</a> &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    ext: 'png'
}).addTo(map);
// 1b. Utrecht Bounding Box

async function drawUtrechtMask() {
    try {
        // 1. Haal jouw lokale bestand op (zorg dat dit precies zo heet als je bestand)
        const response = await fetch('JSONUTRECHT.geojson');
        const data = await response.json();

        let utrechtCoords = [];

        // 2. Zoek de geometrie in het standaard GeoJSON formaat
        // Meestal zit dit verborgen in de eerste "Feature" van de "FeatureCollection"
        const geometry = data.features ? data.features[0].geometry : data.geometry;

        if (!geometry) {
            console.error("Kon geen geometry vinden in JSONUTRECHT.geojson");
            return;
        }

        // 3. GeoJSON gebruikt [Lengtegraad, Breedtegraad], Leaflet wil [Breedtegraad, Lengtegraad].
        if (geometry.type === 'Polygon') {
            utrechtCoords = geometry.coordinates[0].map(c => [c[1], c[0]]);
        } else if (geometry.type === 'MultiPolygon') {
            // Als de grens uit meerdere stukken bestaat (bijv. eilandjes), pakken we het grootste stuk
            utrechtCoords = geometry.coordinates[0][0].map(c => [c[1], c[0]]);
        }

        // 4. Maak een rechthoek die de hele wereld bedekt
        const outerWorld = [
            [90, -180],
            [90, 180],
            [-90, 180],
            [-90, -180]
        ];

        // 5. Teken het masker met het 'gat' in de vorm van jouw bestand
        L.polygon([outerWorld, utrechtCoords], {
            color: '#333',       // Randkleur van Utrecht
            weight: 2,           // Dikte van de rand
            fillColor: '#000',   // Zwarte invulling
            fillOpacity: 0.3     // 30% transparant
        }).addTo(map);

    } catch (error) {
        console.error("Fout bij het laden van JSONUTRECHT.geojson:", error);
    }
}

// Roep de functie aan zodra de pagina laadt
drawUtrechtMask();
// -----------------------------------------------------------

// 2. Variabelen om de status op te slaan
let startCoords = null;
let endCoords = null;
let routeLine = null;
let markers = [];
let timeoutId; // Voor de typ-vertraging (debouncing)

// --- DEEL 1: AUTOCOMPLETE & ZOEKEN TERWIJL JE TYPT ---
async function fetchSuggestions(query, boxId, isStart) {
    const box = document.getElementById(boxId);
    
    // Pas zoeken als er 3 of meer letters zijn getypt
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
                    document.getElementById(inputId).value = item.display_name.split(',')[0];
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

// Hulpfunctie: Verwerkt de klik op een suggestie uit het menu
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

// Event Listeners voor typen in de zoekbalken (met 500ms debounce)
document.getElementById('start-input').addEventListener('input', function(e) {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fetchSuggestions(e.target.value, 'start-suggestions', true), 500);
});

document.getElementById('end-input').addEventListener('input', function(e) {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fetchSuggestions(e.target.value, 'end-suggestions', false), 500);
});

// Verberg de drop-down menu's als je ergens anders op het scherm klikt
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
            const placeName = data[0].display_name.split(',')[0];
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


// Clicking
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
// Slider
document.getElementById('scenic-slider').addEventListener('input', function(e) {
    const val = parseFloat(e.target.value);
    let text = "Balanced";
    if (val === 0) text = "Fastest Route";
    else if (val > 0 && val < 0.5) text = "Slightly Scenic";
    else if (val > 0.5 && val < 1) text = "Very Scenic";
    else if (val === 1) text = "Maximum Scenic";
    
    document.getElementById('scenic-value-display').innerText = `${text} (${val})`;
});

// Backend
document.getElementById('calc-btn').addEventListener('click', async function() {
    if (!startCoords || !endCoords) {
        alert("Please select both an Origin and a Destination first!");
        return;
    }

    const statusText = document.getElementById('status-text');
    statusText.innerText = "Calculating route... (waking up server if asleep, max 60s)";

    // Hugging Face API Link
    const alphaValue = parseFloat(document.getElementById('scenic-slider').value);

    let apiUrl = '';
    
    // Alpha 0 is fast
    if (alphaValue === 0) {
        apiUrl = `https://olegbergs-route-backend-api.hf.space/get-route?start_lat=${startCoords.lat}&start_lon=${startCoords.lng}&end_lat=${endCoords.lat}&end_lon=${endCoords.lng}`;
    } else {
        // Else scenic
        apiUrl = `https://olegbergs-route-backend-api.hf.space/get-scenic-route?start_lat=${startCoords.lat}&start_lon=${startCoords.lng}&end_lat=${endCoords.lat}&end_lon=${endCoords.lng}&alpha=${alphaValue}`;
    }

    try {
        const response = await fetch(apiUrl);
        if (!response.ok) throw new Error("Server error or sleep timeout");
        
        const data = await response.json();
        
        if (data.status === "success") {
            if (routeLine) map.removeLayer(routeLine);
            
            const lineColor = alphaValue > 0 ? '#153bd4' : '#e32400'; // Blue scenic, Red fast
            
            routeLine = L.polyline(data.route, {color: lineColor, weight: 6, opacity: 0.8}).addTo(map);
            map.fitBounds(routeLine.getBounds(), { padding: [50, 50] });
            statusText.innerText = "Route found!";

           // Dynamic distance
            let distanceText = "";
            if (data.distance_m >= 1000) {
                // Deel door 1000 en rond af op 1 decimaal (bijv. 1.6 km)
                distanceText = (data.distance_m / 1000).toFixed(1) + " km";
            } else {
                // Onder de 1000, gewoon afronden op hele meters (bijv. 600 m)
                distanceText = Math.round(data.distance_m) + " m";
            }

            document.getElementById('stat-dist').innerText = distanceText;
            
            document.getElementById('stat-scenic').innerText = data.mean_scenic_score !== null ? data.mean_scenic_score.toFixed(2) : 'N/A';
            
            document.getElementById('route-stats').style.display = 'block';

        } else {
            statusText.innerText = "Could not find a route.";
            document.getElementById('route-stats').style.display = 'none';
        }
    } catch (error) {
        console.error("API Error:", error);
        statusText.innerText = "Error connecting to server. Please try again.";
        document.getElementById('route-stats').style.display = 'none';
    }
});


// Reset
document.getElementById('reset-btn').addEventListener('click', function() {
    startCoords = null;
    endCoords = null;

    document.getElementById('start-input').value = "";
    document.getElementById('end-input').value = "";
    document.getElementById('status-text').innerText = "";
    document.getElementById('route-stats').style.display = 'none';

    if (routeLine) map.removeLayer(routeLine);
    markers.forEach(marker => map.removeLayer(marker));
    markers = [];

    // Scenic explanation resetten
    document.getElementById('scenic-summary').innerText = "";
    document.getElementById('scenic-breakdown').innerHTML = "";
    document.getElementById('scenic-segments').innerHTML = "";
    document.getElementById('scenic-info').style.display = 'none';
});

