const map = L.map("map").setView([47.6062, -122.3321], 10);

// Replace with your Mapbox access token
const MAPBOX_TOKEN = "pk.eyJ1IjoiamFlZGVuY2NhIiwiYSI6ImNtaGM4cDNxdDI3cHkya3B1emRxYzJuNWQifQ.GD3_Rhp6YQw5CkRSFClT0w";
L.tileLayer(
  `https://api.mapbox.com/styles/v1/mapbox/streets-v12/tiles/{z}/{x}/{y}?access_token=${MAPBOX_TOKEN}`,
  {
    maxZoom: 19,
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

// Containers for layer groups and raw marker lists
const layers = {};
const markersByFuel = {};

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
const fuelSelect = document.getElementById('fuelSelect');
const clearBtn = document.getElementById('clearBtn');
const locateBtn = document.getElementById('locateBtn');
const geocodeBtn = document.getElementById('geocodeBtn');
const addressInput = document.getElementById('addressInput');
const sortBtn = document.getElementById('sortBtn');
const resultsEl = document.getElementById('results');

function clearAllLayers() {
  for (const l of Object.values(layers)) {
    if (map.hasLayer(l)) map.removeLayer(l);
  }
}

function showLayersForFuel(fuel) {
  clearAllLayers();
  if (fuel === 'ALL') {
    for (const l of Object.values(layers)) map.addLayer(l);
  } else if (layers[fuel]) {
    map.addLayer(layers[fuel]);
  }
}

fuelSelect.addEventListener('change', (e) => {
  showLayersForFuel(e.target.value);
  resultsEl.innerHTML = '';
});

clearBtn.addEventListener('click', () => {
  fuelSelect.value = 'ALL';
  showLayersForFuel('ALL');
  resultsEl.innerHTML = '';
});

// Geocode helper
async function geocode(query) {
  const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}`);
  const data = await res.json();
  return data[0];
}

// Bring up results sorted by distance for currently visible fuel selection
function showSortedResults() {
  if (!userLocation) {
    alert('No user location available. Click "Use my location" or enter an address to find stations near you.');
    return;
  }

  const selectedFuel = fuelSelect.value;
  let candidateMarkers = [];
  if (selectedFuel === 'ALL') {
    for (const arr of Object.values(markersByFuel)) candidateMarkers = candidateMarkers.concat(arr);
  } else {
    candidateMarkers = markersByFuel[selectedFuel] ? [...markersByFuel[selectedFuel]] : [];
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
    div.innerHTML = `<strong>${name}</strong><div style="color:#666">${distText}</div>`;
    div.addEventListener('click', () => {
      const ll = item.marker.getLatLng();
      map.setView(ll, 14);
      item.marker.openPopup();
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
    userLocation = [lng, lat];
    L.marker([lat, lng]).addTo(map).bindPopup('Your current location').openPopup();
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
    userLocation = [lon, lat];
    L.marker([lat, lon]).addTo(map).bindPopup('Search location').openPopup();
    map.setView([lat, lon], 13);
  } catch (err) {
    console.error(err);
    alert('Geocode failed');
  } finally {
    geocodeBtn.disabled = false;
    geocodeBtn.textContent = 'Find';
  }
});

// Optional: initially show all layers once loaded (give a brief delay to allow async loads)
setTimeout(() => showLayersForFuel('ALL'), 800);

// show small locate marker when browser provides location via map.locate events
map.locate({ setView: false, maxZoom: 14 });
map.on('locationfound', (e) => {
  // only show if userLocation not set by UI
  if (!userLocation) {
    userLocation = [e.latlng.lng, e.latlng.lat];
    L.marker(e.latlng).addTo(map).bindPopup('Your current location');
  }
});
