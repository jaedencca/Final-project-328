const map = L.map("map").setView([47.6062, -122.3321], 10);

// Replace with your Mapbox access token
const MAPBOX_TOKEN = "pk.eyJ1IjoibWFpa2hhbmh0IiwiYSI6ImNtaHllNDdidjBheXkya29mdHNzc3M1b2wifQ.F0AfMAmhk0OpXT6yqUE3Vw";
L.tileLayer(
  `https://api.mapbox.com/styles/v1/jaedencca/cmirrmnb5002501sn6k914u71/tiles/{z}/{x}/{y}?access_token=${MAPBOX_TOKEN}`,
  {
    maxZoom: 19,
    tileSize: 512,
    zoomOffset: -1,
    attribution:
      'Map data &copy; <a href="https://www.openstreetmap.org/">OpenStreetMap</a> contributors, ' +
      '<a href="https://creativecommons.org/licenses/by-sa/2.0/">CC-BY-SA</a>, ' +
      'Imagery © <a href="https://www.mapbox.com/">Mapbox</a>',
  }
).addTo(map);

// Marker icons, only ev so far, NEED icons for others, just copy this format ...
const evIcon = L.icon({
  iconUrl: "./assets/charging-station.png",
  iconSize: [50, 50],
  iconAnchor: [17, 35],
  popupAnchor: [0, -30],
});

// Use provided PNG assets for hydrogen and biodiesel markers
const hydrogenIcon = L.icon({
  iconUrl: './assets/hydrogen-icon.png',
  iconSize: [50, 50],
  iconAnchor: [17, 35],
  popupAnchor: [0, -30],
  className: '',
});

const biodieselIcon = L.icon({
  iconUrl: './assets/biodiesel-icon.png',
  iconSize: [50, 50],
  iconAnchor: [17, 35],
  popupAnchor: [0, -30],
  className: '',
});

// Files in the assets folder
const fuelFiles = {
  EV: "assets/wa_ev_stations_full_units.geojson",
  HYDROGEN: "assets/wa_hydrogen_stations.geojson",
  BIODIESEL: "assets/wa_biodiesel_stations.geojson",
};

const LIME = '#32cd32';

// Containers for layer groups and raw marker lists
const layers = {};
const markersByFuel = {};
let routeLayer = null; // holds current displayed route (polyline + markers)
let userMarker = null; // current user/search location marker

// initialize user location (as [lng, lat])
let userLocation = null;

// Helpers for popup content
function formatAddress(props) {
  const line1 = props.street_address || props.address;
  const cityState = [props.city, props.state].filter(Boolean).join(', ');
  const zip = props.zip;
  const parts = [line1, [cityState, zip].filter(Boolean).join(' ')].filter(Boolean);
  return parts.join('<br>');
}

function makePopupContent(props, fuelType) {
  const name = props.station_name || props.name || 'Station';
  const address = formatAddress(props);
  let content = `<b>${name}</b><br>`;
  content += `<div><b>Fuel:</b> ${fuelType}</div>`;
  if (address) content += `<div>${address}</div>`;

  if (fuelType === 'EV') {
    const connectors = Array.isArray(props.ev_connector_types)
      ? props.ev_connector_types.join(', ')
      : props.ev_connector_types || 'Not listed';
    const level1 = props.ev_level1_evse_num ?? '0';
    const level2 = props.ev_level2_evse_num ?? '0';
    const dc = props.ev_dc_fast_num ?? '0';
    const pricing = props.ev_pricing || 'Not listed';
    const network = props.ev_network || 'Unknown network';
    const status = props.status_code || 'Unknown status';

    content += `<div><b>Network:</b> ${network}</div>`;
    content += `<div><b>Status:</b> ${status}</div>`;
    content += `<div><b>Connectors:</b> ${connectors}</div>`;
    content += `<div><b>Level1/2/DC:</b> ${level1}/${level2}/${dc}</div>`;
    content += `<div><b>Pricing:</b> ${pricing}</div>`;
  } else if (fuelType === 'HYDROGEN') {
    const pressure = props.hy_pressure || 'Not listed';
    const vehicleClass = props.hy_vehicle_class || 'Not listed';
    const stationStatus = props.hy_station_status || 'Unknown';
    const isOpen = props.hy_is_open == null ? 'Unknown' : props.hy_is_open ? 'Yes' : 'No';
    const access = props.access_code || 'Not listed';
    const status = props.status_code || 'Unknown status';

    content += `<div><b>Status:</b> ${status}</div>`;
    content += `<div><b>Access:</b> ${access}</div>`;
    content += `<div><b>Pressure:</b> ${pressure}</div>`;
    content += `<div><b>Vehicle class:</b> ${vehicleClass}</div>`;
    content += `<div><b>Open now:</b> ${isOpen}</div>`;
    content += `<div><b>Station status:</b> ${stationStatus}</div>`;
  } else if (fuelType === 'BIODIESEL') {
    const blend = props.bd_blends || 'Not listed';
    const cards = props.cards_accepted || 'Not listed';
    const access = props.access_code || 'Not listed';
    const status = props.status_code || 'Unknown status';

    content += `<div><b>Status:</b> ${status}</div>`;
    content += `<div><b>Access:</b> ${access}</div>`;
    content += `<div><b>Blend:</b> ${blend}</div>`;
    content += `<div><b>Cards accepted:</b> ${cards}</div>`;
  } else {
    // generic fallback
    const access = props.access_code || 'Not listed';
    const status = props.status_code || 'Unknown status';
    content += `<div><b>Status:</b> ${status}</div>`;
    content += `<div><b>Access:</b> ${access}</div>`;
  }

  return content;
}

// Load all GeoJSONs and prepare layers
async function loadAllFuelFiles() {
  for (const [fuel, path] of Object.entries(fuelFiles)) {
    try {
      const res = await fetch(path);
      const geo = await res.json();

      const cluster = L.markerClusterGroup();
      const markers = [];

      L.geoJSON(geo, {
        pointToLayer: (feature, latlng) => {
          let marker;
          if (fuel === 'EV') {
            marker = L.marker([latlng.lat, latlng.lng], { icon: evIcon });
          } else if (fuel === 'HYDROGEN') {
            marker = L.marker([latlng.lat, latlng.lng], { icon: hydrogenIcon });
          } else if (fuel === 'BIODIESEL') {
            marker = L.marker([latlng.lat, latlng.lng], { icon: biodieselIcon });
          } else {
            marker = L.marker([latlng.lat, latlng.lng]);
          }

          const popup = makePopupContent(feature.properties || {}, fuel);
          marker.bindPopup(popup);
          markers.push({ marker, feature });
          cluster.addLayer(marker);
          return marker;
        },
      });

      layers[fuel] = cluster;
      markersByFuel[fuel] = markers;
      // don't add to map yet; UI will control which layers are shown
    } catch (err) {
      console.error(`Failed to load ${fuel} (${path}):`, err);
    }
  }
}

// Initialize
loadAllFuelFiles();

// UI elements
const fuelButtons = {
  EV: document.getElementById('btnEV'),
  HYDROGEN: document.getElementById('btnHYDROGEN'),
  BIODIESEL: document.getElementById('btnBIODIESEL'),
};
const locateBtn = document.getElementById('locateBtn');
const geocodeBtn = document.getElementById('geocodeBtn');
const addressInput = document.getElementById('addressInput');
const sortBtn = document.getElementById('sortBtn');
const resultsEl = document.getElementById('results');

const fuelVisibility = {
  EV: true,
  HYDROGEN: true,
  BIODIESEL: true,
};

// Car filter state
const carFilter = {
  enabled: false,
  fuelType: null,
  evConnectorType: null,
  evChargingLevel: null,
  hydrogenPressure: null,
  biodieselBlend: null,
};

// Function to check if a station matches car specifications
function stationMatchesCarFilter(feature, fuelType) {
  if (!carFilter.enabled) return true;
  if (carFilter.fuelType !== fuelType) return false;

  const props = feature.properties || {};

  if (fuelType === 'EV') {
    // Check EV connector type
    if (carFilter.evConnectorType) {
      const connectorTypes = Array.isArray(props.ev_connector_types)
        ? props.ev_connector_types.join(' ').toUpperCase()
        : (props.ev_connector_types || '').toUpperCase();
      
      if (!connectorTypes.includes(carFilter.evConnectorType.toUpperCase())) {
        return false;
      }
    }

    // Check EV charging level
    if (carFilter.evChargingLevel) {
      const hasLevel1 = (props.ev_level1_evse_num ?? 0) > 0;
      const hasLevel2 = (props.ev_level2_evse_num ?? 0) > 0;
      const hasDCFast = (props.ev_dc_fast_num ?? 0) > 0;

      if (carFilter.evChargingLevel === 'Level1' && !hasLevel1) return false;
      if (carFilter.evChargingLevel === 'Level2' && !hasLevel2) return false;
      if (carFilter.evChargingLevel === 'DCFast' && !hasDCFast) return false;
    }

    return true;
  } else if (fuelType === 'HYDROGEN') {
    // Check hydrogen pressure
    if (carFilter.hydrogenPressure) {
      const pressure = props.hy_pressure || '';
      if (!pressure.includes(carFilter.hydrogenPressure)) {
        return false;
      }
    }
    return true;
  } else if (fuelType === 'BIODIESEL') {
    // Check biodiesel blend
    if (carFilter.biodieselBlend) {
      const blends = props.bd_blends || '';
      if (!blends.includes(carFilter.biodieselBlend)) {
        return false;
      }
    }
    return true;
  }

  return true;
}

function clearAllLayers() {
  for (const l of Object.values(layers)) {
    if (map.hasLayer(l)) map.removeLayer(l);
  }
}

function updateLayerVisibility() {
  clearAllLayers();
  
  // If car filter is enabled, use filtered layers
  if (carFilter.enabled) {
    for (const [fuel, visible] of Object.entries(fuelVisibility)) {
      if (!visible || !markersByFuel[fuel]) continue;

      const cluster = L.markerClusterGroup();
      
      // Add only markers that match the car filter
      markersByFuel[fuel].forEach(({ marker, feature }) => {
        if (stationMatchesCarFilter(feature, fuel)) {
          cluster.addLayer(marker);
        }
      });

      if (cluster.getLayers().length > 0) {
        map.addLayer(cluster);
      }
    }
  } else {
    // Show all layers normally
    for (const [fuel, visible] of Object.entries(fuelVisibility)) {
      if (visible && layers[fuel]) map.addLayer(layers[fuel]);
    }
  }
}

function setButtonState(fuel) {
  const btn = fuelButtons[fuel];
  if (btn) {
    btn.classList.toggle('active', fuelVisibility[fuel]);
    btn.setAttribute('aria-pressed', fuelVisibility[fuel] ? 'true' : 'false');
  }
}

for (const [fuel, btn] of Object.entries(fuelButtons)) {
  setButtonState(fuel);
  btn.addEventListener('click', () => {
    fuelVisibility[fuel] = !fuelVisibility[fuel];
    setButtonState(fuel);
    updateLayerVisibility();
    resultsEl.innerHTML = '';
  });
}

// Geocode helper
async function geocode(query) {
  const params = new URLSearchParams({
    format: 'json',
    q: `${query}, Washington`, // bias query text to WA
    countrycodes: 'us',
    viewbox: '-124.848974,45.543541,-116.916071,49.002494', // WA bbox west,south,east,north
    bounded: '1',
    limit: '5',
  });

  const res = await fetch(`https://nominatim.openstreetmap.org/search?${params.toString()}`);
  const data = await res.json();
  if (!Array.isArray(data) || data.length === 0) return null;

  const waMatch = data.find((d) => d.address && d.address.state === 'Washington');
  return waMatch || data[0];
}

// Clear any existing route from the map
function clearRoute() {
  if (routeLayer) {
    map.removeLayer(routeLayer);
    routeLayer = null;
  }
}

function setUserMarker(lat, lng, label = 'Your current location') {
  if (userMarker) {
    map.removeLayer(userMarker);
    userMarker = null;
  }
  userMarker = L.circleMarker([lat, lng], {
    radius: 7,
    color: LIME,
    weight: 2,
    fillColor: LIME,
    fillOpacity: 0.9,
    title: label,
  }).addTo(map);
}

// Draw driving route on map using OSRM public demo server
async function showRoute(originLngLat, destLatLng) {
  // originLngLat: [lng, lat]; destLatLng: {lat, lng}
  if (!originLngLat || !destLatLng) return;

  const url = `https://router.project-osrm.org/route/v1/driving/${originLngLat[0]},${originLngLat[1]};${destLatLng.lng},${destLatLng.lat}?overview=full&geometries=geojson`;

  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Routing error ${res.status}`);
    const data = await res.json();
    if (!data.routes || !data.routes.length) throw new Error('No route found');

    const coords = data.routes[0].geometry.coordinates.map(([lon, lat]) => [lat, lon]);

    clearRoute();
    routeLayer = L.layerGroup().addTo(map);

    const line = L.polyline(coords, { color: LIME, weight: 4, opacity: 0.85 });
    const start = L.circleMarker([originLngLat[1], originLngLat[0]], {
      radius: 6,
      color: LIME,
      weight: 2,
      fillColor: LIME,
      fillOpacity: 0.9,
    }).bindTooltip('Start', { direction: 'top' });

    const end = L.circleMarker([destLatLng.lat, destLatLng.lng], {
      radius: 6,
      color: LIME,
      weight: 2,
      fillColor: LIME,
      fillOpacity: 0.9,
    }).bindTooltip('Destination', { direction: 'top' });

    routeLayer.addLayer(line);
    routeLayer.addLayer(start);
    routeLayer.addLayer(end);

    map.fitBounds(line.getBounds(), { padding: [40, 40] });
  } catch (err) {
    console.error('Route fetch failed', err);
    alert('Unable to draw directions right now. Please try again.');
  }
}

// Bring up results sorted by distance for currently visible fuel selection
function showSortedResults() {
  if (!userLocation) {
    alert('No user location available. Click "Use my location" or enter an address to find stations near you.');
    return;
  }

  let candidateMarkers = [];
  const activeFuels = Object.entries(fuelVisibility).filter(([, v]) => v).map(([k]) => k);
  if (activeFuels.length === 0) {
    alert('Turn on at least one fuel type to sort nearby stations.');
    return;
  }
  for (const fuel of activeFuels) {
    if (markersByFuel[fuel]) candidateMarkers = candidateMarkers.concat(markersByFuel[fuel]);
  }

  const userPoint = turf.point([userLocation[0], userLocation[1]]); // [lng, lat]

  const withDist = candidateMarkers.map(({ marker, feature }) => {
    const coords = feature.geometry && feature.geometry.coordinates ? feature.geometry.coordinates : [marker.getLatLng().lng, marker.getLatLng().lat];
    const stationPoint = turf.point([coords[0], coords[1]]);
    const km = turf.distance(userPoint, stationPoint, { units: 'kilometers' });
    return { marker, feature, distanceKm: km };
  }).filter(d => isFinite(d.distanceKm));

  withDist.sort((a, b) => a.distanceKm - b.distanceKm);

  // Build results UI (top 50)
  resultsEl.innerHTML = '';
  const top = withDist.slice(0, 50);
  if (top.length === 0) {
    resultsEl.innerHTML = '<div>No stations found for this selection.</div>';
    return;
  }

  top.forEach((item, idx) => {
    const name = item.feature.properties && (item.feature.properties.station_name || item.feature.properties.name) || `Station ${idx+1}`;
    const distText = `${(item.distanceKm).toFixed(2)} km`;
    const div = document.createElement('div');
    div.className = 'result-item';
    const ll = item.marker.getLatLng();

    // Click anywhere on the item to focus/open popup
    div.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;">
        <div>
          <strong>${name}</strong>
          <div style="color:#666">${distText}</div>
        </div>
        <button class="dir-btn" style="padding:4px 8px;font-size:12px;cursor:pointer;">Directions</button>
      </div>
    `;

    div.addEventListener('click', () => {
      map.setView(ll, 14);
      item.marker.openPopup();
    });

    // Directions button opens Google Maps from userLocation to station
    const btn = div.querySelector('.dir-btn');
    btn.addEventListener('click', async (ev) => {
      ev.stopPropagation();
      if (!userLocation) {
        alert('Set your location first (Use my location or enter an address).');
        return;
      }
      await showRoute(userLocation, ll);
    });
    resultsEl.appendChild(div);
  });
}

sortBtn.addEventListener('click', () => showSortedResults());

locateBtn.addEventListener('click', () => {
  if (!navigator.geolocation) {
    alert('Geolocation is not supported by your browser');
    return;
  }
  locateBtn.disabled = true;
  locateBtn.textContent = 'Locating...';
  navigator.geolocation.getCurrentPosition((pos) => {
    const lat = pos.coords.latitude;
    const lng = pos.coords.longitude;
    clearRoute();
    userLocation = [lng, lat];
    setUserMarker(lat, lng, 'Your current location');
    map.setView([lat, lng], 13);
    locateBtn.disabled = false;
    locateBtn.textContent = 'Use my location';
    // Optionally auto-sort
    // showSortedResults();
  }, (err) => {
    console.error(err);
    alert('Unable to get your location');
    locateBtn.disabled = false;
    locateBtn.textContent = 'Use my location';
  });
});

geocodeBtn.addEventListener('click', async () => {
  const q = addressInput.value.trim();
  if (!q) return alert('Please enter an address to search nearby stations.');
  geocodeBtn.disabled = true;
  geocodeBtn.textContent = 'Searching...';
  try {
    const r = await geocode(q);
    if (!r) return alert('Address not found');
    const lat = parseFloat(r.lat);
    const lon = parseFloat(r.lon);
    clearRoute();
    userLocation = [lon, lat];
    setUserMarker(lat, lon, 'Search location');
    map.setView([lat, lon], 13);
  } catch (err) {
    console.error(err);
    alert('Geocode failed');
  } finally {
    geocodeBtn.disabled = false;
    geocodeBtn.textContent = 'Find';
  }
});

// ============= CAR FILTER FUNCTIONALITY =============

const useCarFilterCheckbox = document.getElementById('useCarFilter');
const carFilterContent = document.getElementById('carFilterContent');
const carFuelTypeSelect = document.getElementById('carFuelType');
const evFilters = document.getElementById('evFilters');
const hydrogenFilters = document.getElementById('hydrogenFilters');
const biodieselFilters = document.getElementById('biodieselFilters');
const evConnectorTypeSelect = document.getElementById('evConnectorType');
const evChargingLevelSelect = document.getElementById('evChargingLevel');
const hydrogenPressureSelect = document.getElementById('hydrogenPressure');
const biodieselBlendSelect = document.getElementById('biodieselBlend');
const applyCarFilterBtn = document.getElementById('applyCarFilter');
const clearCarFilterBtn = document.getElementById('clearCarFilter');

// Toggle car filter section visibility
useCarFilterCheckbox.addEventListener('change', () => {
  carFilterContent.style.display = useCarFilterCheckbox.checked ? 'block' : 'none';
  if (!useCarFilterCheckbox.checked) {
    carFilter.enabled = false;
    updateLayerVisibility();
    resultsEl.innerHTML = '';
  }
});

// Update visible filter options based on selected fuel type
carFuelTypeSelect.addEventListener('change', () => {
  const selectedFuel = carFuelTypeSelect.value;
  evFilters.style.display = selectedFuel === 'EV' ? 'block' : 'none';
  hydrogenFilters.style.display = selectedFuel === 'HYDROGEN' ? 'block' : 'none';
  biodieselFilters.style.display = selectedFuel === 'BIODIESEL' ? 'block' : 'none';
});

// Apply car filter
applyCarFilterBtn.addEventListener('click', () => {
  const selectedFuel = carFuelTypeSelect.value;
  
  if (!selectedFuel) {
    alert('Please select a fuel type for your vehicle.');
    return;
  }

  // Update car filter state
  carFilter.enabled = true;
  carFilter.fuelType = selectedFuel;
  carFilter.evConnectorType = selectedFuel === 'EV' ? evConnectorTypeSelect.value : null;
  carFilter.evChargingLevel = selectedFuel === 'EV' ? evChargingLevelSelect.value : null;
  carFilter.hydrogenPressure = selectedFuel === 'HYDROGEN' ? hydrogenPressureSelect.value : null;
  carFilter.biodieselBlend = selectedFuel === 'BIODIESEL' ? biodieselBlendSelect.value : null;

  // Ensure only the selected fuel type is visible
  fuelVisibility.EV = selectedFuel === 'EV';
  fuelVisibility.HYDROGEN = selectedFuel === 'HYDROGEN';
  fuelVisibility.BIODIESEL = selectedFuel === 'BIODIESEL';

  // Update fuel buttons to reflect this
  for (const [fuel, btn] of Object.entries(fuelButtons)) {
    setButtonState(fuel);
  }

  // Update the map with filtered results
  updateLayerVisibility();
  resultsEl.innerHTML = '';
  
  // Show a summary message
  let filterSummary = `Filtering ${selectedFuel}`;
  if (selectedFuel === 'EV' && (carFilter.evConnectorType || carFilter.evChargingLevel)) {
    const filters = [];
    if (carFilter.evConnectorType) filters.push(`${carFilter.evConnectorType}`);
    if (carFilter.evChargingLevel) filters.push(`${carFilter.evChargingLevel}`);
    filterSummary += ` (${filters.join(', ')})`;
  } else if (selectedFuel === 'HYDROGEN' && carFilter.hydrogenPressure) {
    filterSummary += ` (${carFilter.hydrogenPressure} bar)`;
  } else if (selectedFuel === 'BIODIESEL' && carFilter.biodieselBlend) {
    filterSummary += ` (${carFilter.biodieselBlend})`;
  }
  
  resultsEl.innerHTML = `<div style="padding: 8px; background: #e3f2fd; border-radius: 4px; margin-top: 8px;"><strong>✓ ${filterSummary}</strong></div>`;
});

// Clear car filter
clearCarFilterBtn.addEventListener('click', () => {
  carFilter.enabled = false;
  carFilter.fuelType = null;
  carFilter.evConnectorType = null;
  carFilter.evChargingLevel = null;
  carFilter.hydrogenPressure = null;
  carFilter.biodieselBlend = null;

  // Reset UI
  useCarFilterCheckbox.checked = false;
  carFilterContent.style.display = 'none';
  carFuelTypeSelect.value = '';
  evConnectorTypeSelect.value = '';
  evChargingLevelSelect.value = '';
  hydrogenPressureSelect.value = '';
  biodieselBlendSelect.value = '';

  // Reset visibility to show all fuel types
  fuelVisibility.EV = true;
  fuelVisibility.HYDROGEN = true;
  fuelVisibility.BIODIESEL = true;

  for (const [fuel, btn] of Object.entries(fuelButtons)) {
    setButtonState(fuel);
  }

  updateLayerVisibility();
  resultsEl.innerHTML = '';
});

// ============= END CAR FILTER FUNCTIONALITY =============

// Optional: initially show all layers once loaded (give a brief delay to allow async loads)
setTimeout(() => updateLayerVisibility(), 800);

// show small locate marker when browser provides location via map.locate events
map.locate({ setView: false, maxZoom: 14 });
map.on('locationfound', (e) => {
  // only show if userLocation not set by UI
  if (!userLocation) {
    clearRoute();
    userLocation = [e.latlng.lng, e.latlng.lat];
    setUserMarker(e.latlng.lat, e.latlng.lng, 'Your current location');
  }
});
