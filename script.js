const API_KEY = "Ioaw398mdAchulbDmmlaESbNv7PekHPPm87Mk1eG";

const map = L.map("map").setView([47.6062, -122.3321], 10);

L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
  maxZoom: 19,
}).addTo(map);

const markers = L.markerClusterGroup();

const evIcon = L.icon({
  iconUrl: "/assets/charging-station.png",
  iconSize: [35, 35],
  iconAnchor: [17, 35],
  popupAnchor: [0, -30],
});

async function loadStations() {
  try {
    const response = await fetch(
      `https://developer.nrel.gov/api/alt-fuel-stations/v1.json?fuel_type=ELEC&state=WA&api_key=${API_KEY}`
    );

    const json = await response.json();
    const stations = json.fuel_stations;

    stations.forEach((s) => {
      if (!s.latitude || !s.longitude) return;

      const popupHTML = `
        <b>${s.station_name}</b><br>
        Fuel: Electric<br>
        Connectors: ${s.ev_connector_types?.join(", ") || "N/A"}<br>
        Level 1: ${s.ev_level1_evse_num || 0}<br>
        Level 2: ${s.ev_level2_evse_num || 0}<br>
        DC Fast: ${s.ev_dc_fast_num || 0}<br>
        Address: ${s.street_address}, ${s.city}
      `;

      const marker = L.marker([s.latitude, s.longitude], { icon: evIcon })
        .bindPopup(popupHTML);

      markers.addLayer(marker);
    });

    map.addLayer(markers);
  } catch (error) {
    console.error("Error loading stations:", error);
  }
}

loadStations();

map.locate({ setView: true, maxZoom: 14 });

map.on("locationfound", (e) => {
  L.marker(e.latlng).addTo(map).bindPopup("You are here");
});

async function geocode(query) {
  const res = await fetch(
    `https://nominatim.openstreetmap.org/search?format=json&q=${query}`
  );
  const data = await res.json();
  return data[0];
}

function isWithinRadius(userPoint, stationPoint, radiusMeters) {
  return map.distance(userPoint, stationPoint) <= radiusMeters;
}
