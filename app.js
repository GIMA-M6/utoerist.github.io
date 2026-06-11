// 1. Initialiseer de kaart ZONDER de standaard zoomknoppen
const map = L.map('map', { zoomControl: false }).setView([52.0907, 5.1214], 13);
// 2. handmatige zoomknoppen
L.control.zoom({ position: 'bottomright' }).addTo(map);
L.tileLayer('https://{s}.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, Tiles style by <a href="https://www.hotosm.org/" target="_blank">Humanitarian OpenStreetMap Team</a> hosted by <a href="https://openstreetmap.fr/" target="_blank">OpenStreetMap France</a>'
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
            fillOpacity: 0.4,     // 40% transparant
            interactive: false
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
let mainRouteLine = null;
let altRouteLine = null;
let markers = [];
let timeoutId; // Voor de typ-vertraging (debouncing)

// Hulpfunctie: Maak een mooie afstand (m of km)
function formatDistance(meters) {
    if (meters >= 1000) return (meters / 1000).toFixed(1) + " km";
    return Math.round(meters) + " m";
}

// Hulpfunctie: Maak een mooie tijd (min of uren)
function formatTime(mins) {
    if (mins < 1) return "1 min";
    if (mins >= 60) {
        let h = Math.floor(mins / 60);
        let m = mins % 60;
        return h + " h" + (m > 0 ? " " + m + " min" : "");
    }
    return mins + " min";
}

// --- REVERSE GEOCODING ---
// Vertaalt een klik op de kaart naar een leesbaar adres via OpenStreetMap Nominatim
async function getAddressFromCoords(lat, lng) {
    try {
        const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`);
        const data = await response.json();
        
        if (data && data.address) {
            // Probeer straat + huisnummer + stad op te bouwen
            let street = data.address.road || data.address.pedestrian || data.address.footway || data.address.cycleway || "";
            let number = data.address.house_number || "";
            let city = data.address.city || data.address.town || data.address.village || "Utrecht"; // Fallback stad
            
            // Als we een straatnaam hebben gevonden, maak er iets moois van
            if (street) {
                let formattedAddress = `${street} ${number}, ${city}`;
                // Verwijder dubbele spaties voor het geval er geen huisnummer is
                return formattedAddress.replace(" ,", ",").trim(); 
            }
            // Als het bijvoorbeeld in het midden van een bos is zonder straat, pak de algemene naam
            return data.display_name.split(",")[0] + ", " + city;
        }
    } catch (error) {
        console.error("Geocoding failed:", error);
    }
    // Fallback: Als het internet wegvalt of API faalt, laat alsnog de coördinaten zien
    return `Lat: ${lat.toFixed(4)}, Lon: ${lng.toFixed(4)}`; 
}

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
            
            // Pak de eerste TWEE stukjes (slice 0, 2) en plak ze aan elkaar
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

// --- GEOLOCATIE (Mijn huidige locatie) ---
document.getElementById('loc-btn').addEventListener('click', function() {
    // 1. Check of browser deze functie ondersteunt
    if (!navigator.geolocation) {
        alert("Geolocation wordt niet ondersteund door jouw browser.");
        return;
    }

    // 2. Geef de gebruiker visuele feedback dat we aan het zoeken zijn
    const startInput = document.getElementById('start-input');
    startInput.value = "Searching location...";

    // 3. Vraag de locatie op
    navigator.geolocation.getCurrentPosition(
        async function(position) {
            // Succes! We hebben de coördinaten
            const lat = position.coords.latitude;
            const lng = position.coords.longitude;

            // Wis een eventuele eerdere route/kaart als beide al waren ingevuld
            if (startCoords && endCoords) {
                document.getElementById('reset-btn').click(); 
            }

            // Sla op in jouw globale variabelen
            startCoords = { lat: lat, lng: lng };

            // Plaats de marker en vlieg er naartoe op de kaart
            const marker = L.marker([lat, lng], { title: "Current Location" }).addTo(map);
            markers.push(marker);
            map.setView([lat, lng], 16); // 16 is lekker dichtbij ingezoomd

            // Gebruik jouw Reverse Geocoding functie om er een mooi adres van te maken!
            const address = await getAddressFromCoords(lat, lng);
            startInput.value = address;
        },
        function(error) {
            // Foutafhandeling (bijv. als de gebruiker op "Blokkeren" klikt)
            console.error("Error getting location:", error);
            startInput.value = "";
            alert("Kon locatie niet ophalen. Zorg dat je locatie-toegang toestaat in je browser.");
        },
        {
            enableHighAccuracy: true // Vraagt om GPS-precisie (vooral op telefoons)
        }
    );
});

// --- MAP CLICK EVENT ---
map.on('click', async function(e) {
    const lat = e.latlng.lat;
    const lng = e.latlng.lng;
    
    // Bepaal of we de start of het einde aan het invullen zijn
    // We kijken nu naar jouw eigen 'startCoords' en 'endCoords'
    if (!startCoords || (startCoords && endCoords)) {
        
        // Als beide al ingevuld waren en je klikt nog een keer: wis de kaart
        if (startCoords && endCoords) {
            document.getElementById('reset-btn').click(); 
        }
        
        // Sla de coördinaten op in jouw formaat
        startCoords = { lat: lat, lng: lng };
        
        // Plaats de marker en voeg toe aan jouw 'markers' array
        const marker = L.marker([lat, lng], { title: "Origin" }).addTo(map);
        markers.push(marker);
        
        // Zet er tijdelijk "Adres ophalen..." neer zodat de gebruiker weet dat ie laadt
        document.getElementById('start-input').value = "Adres ophalen...";
        
        // Vraag het adres op en vul het in
        const address = await getAddressFromCoords(lat, lng);
        document.getElementById('start-input').value = address;
        
    } else if (!endCoords) {
        
        // We vullen de bestemming in
        endCoords = { lat: lat, lng: lng };
        
        const marker = L.marker([lat, lng], { title: "Destination" }).addTo(map);
        markers.push(marker);
        
        // Tijdelijke laad-tekst
        document.getElementById('end-input').value = "Adres ophalen...";
        
        // Vraag het adres op en vul het in
        const address = await getAddressFromCoords(lat, lng);
        document.getElementById('end-input').value = address;
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
        // 1. Bepaal wat de gebruiker koos (Main) en wat het alternatief is (Alt)
        let altAlphaValue = alphaValue === 0 ? 1.0 : 0; // Als ze Snelst kiezen, is alt 100% Scenic, en vice versa.
        
        let mainUrl = alphaValue === 0 
            ? `https://olegbergs-route-backend-api.hf.space/get-route?start_lat=${startCoords.lat}&start_lon=${startCoords.lng}&end_lat=${endCoords.lat}&end_lon=${endCoords.lng}`
            : `https://olegbergs-route-backend-api.hf.space/get-scenic-route?start_lat=${startCoords.lat}&start_lon=${startCoords.lng}&end_lat=${endCoords.lat}&end_lon=${endCoords.lng}&alpha=${alphaValue}`;
            
        let altUrl = altAlphaValue === 0 
            ? `https://olegbergs-route-backend-api.hf.space/get-route?start_lat=${startCoords.lat}&start_lon=${startCoords.lng}&end_lat=${endCoords.lat}&end_lon=${endCoords.lng}`
            : `https://olegbergs-route-backend-api.hf.space/get-scenic-route?start_lat=${startCoords.lat}&start_lon=${startCoords.lng}&end_lat=${endCoords.lat}&end_lon=${endCoords.lng}&alpha=${altAlphaValue}`;

        // 2. Promise.all! Vraag beide routes tegelijkertijd op bij de server (scheelt de helft van de wachttijd)
        const [mainResponse, altResponse] = await Promise.all([
            fetch(mainUrl),
            fetch(altUrl)
        ]);

        if (!mainResponse.ok || !altResponse.ok) throw new Error("Server error or sleep timeout");
        
        const mainData = await mainResponse.json();
        const altData = await altResponse.json();
        
        if (mainData.status === "success" && altData.status === "success") {
            // Verwijder oude lijnen op de kaart
            if (mainRouteLine) map.removeLayer(mainRouteLine);
            if (altRouteLine) map.removeLayer(altRouteLine);
            
            // 3. Teken EERST het alternatief (deze komt dan netjes 'onder' de hoofdroute te liggen)
            // Stijl: Grijs, transparant (0.5), en gestreept (dashArray)
            altRouteLine = L.polyline(altData.route, {
                color: '#888', weight: 5, opacity: 0.6, dashArray: '8, 8'
            }).addTo(map);

            // 4. Teken DAARNA de hoofdroute (Bovenop, volle kleur)
            const mainColor = alphaValue > 0 ? '#153bd4' : '#e32400'; 
            mainRouteLine = L.polyline(mainData.route, {
                color: mainColor, weight: 6, opacity: 0.9
            }).addTo(map);
            
            // Zoom netjes in
            map.fitBounds(mainRouteLine.getBounds(), { padding: [50, 50] });
            statusText.innerText = "Routes found!";

            // 5. Vul de HTML Stats in (Main Route)
            document.getElementById('main-route-title').innerText = alphaValue === 0 ? "Fastest Route" : "Scenic Route";
            document.getElementById('main-route-title').style.color = mainColor;
            document.getElementById('stat-dist').innerText = formatDistance(mainData.distance_m);
            document.getElementById('stat-time').innerText = formatTime(mainData.time_minutes);
            document.getElementById('stat-scenic').innerText = mainData.mean_scenic_score !== null ? mainData.mean_scenic_score.toFixed(1) : 'N/A';

            // 6. Vul de HTML Stats in (Alt Route)
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


// Reset
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

    // Scenic explanation resetten
    document.getElementById('scenic-summary').innerText = "";
    document.getElementById('scenic-breakdown').innerHTML = "";
    document.getElementById('scenic-segments').innerHTML = "";
    document.getElementById('scenic-info').style.display = 'none';
});

// --- MENU TOGGLE LOGIC ---
document.getElementById('toggle-menu-btn').addEventListener('click', function() {
    const uiPanel = document.getElementById('ui-panel');
    const btn = document.getElementById('toggle-menu-btn');
    
    // Check if the panel currently has the hidden class
    if (uiPanel.classList.contains('panel-hidden')) {
        // Menu is currently hidden -> SHOW IT
        uiPanel.classList.remove('panel-hidden');
        btn.innerHTML = 'Hide Menu';
    } else {
        // Menu is currently visible -> HIDE IT
        uiPanel.classList.add('panel-hidden');
        btn.innerHTML = 'Show Menu';
    }
});
