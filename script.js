mapboxgl.accessToken =
  "pk.eyJ1IjoiamFlZGVuY2NhIiwiYSI6ImNtaGM4cDNxdDI3cHkya3B1emRxYzJuNWQifQ.GD3_Rhp6YQw5CkRSFClT0w";

const map = new mapboxgl.Map({
  container: "map",
  style: "mapbox://styles/jaedencca/cmirrmnb5002501sn6k914u71",
  center: [-122.3321, 47.6062],
  zoom: 10,
});

map.addControl(new mapboxgl.NavigationControl());

const fuelLayers = {
  ev: {
    file: "/assets/wa_ev_stations_full_units.geojson",
    icon: "/assets/charging-station.png",
    color: "#00c776",
  },
  hydrogen: {
    file: "/assets/wa_hydrogen_stations.geojson",
    icon: "/assets/hydrogen-icon.png",
    color: "#0077ff",
  },
  biodiesel: {
    file: "/assets/wa_biodiesel_stations.geojson",
    icon: "/assets/biodiesel-icon.png",
    color: "#c7a000",
  },
};

// Preload icons first
async function preloadIcons() {
  const promises = Object.keys(fuelLayers).map((key) => {
    const { icon } = fuelLayers[key];

    return new Promise((resolve, reject) => {
      map.loadImage(icon, (err, image) => {
        if (err) reject(err);
        map.addImage(`icon-${key}`, image);
        resolve();
      });
    });
  });

  return Promise.all(promises);
}

// Load a single layer
async function loadFuelLayer(type, cfg) {
  const res = await fetch(cfg.file);
  const geojson = await res.json();

  map.addSource(type, {
    type: "geojson",
    data: geojson,
    cluster: true,
    clusterMaxZoom: 14,
    clusterRadius: 45,
  });

  map.addLayer({
    id: `${type}-clusters`,
    type: "circle",
    source: type,
    filter: ["has", "point_count"],
    paint: {
      "circle-color": cfg.color,
      "circle-radius": 26,
    },
  });

  map.addLayer({
    id: `${type}-cluster-count`,
    type: "symbol",
    source: type,
    filter: ["has", "point_count"],
    layout: {
      "text-field": "{point_count_abbreviated}",
      "text-size": 13,
    },
  });

  map.addLayer({
    id: `${type}-points`,
    type: "symbol",
    source: type,
    filter: ["!", ["has", "point_count"]],
    layout: {
      "icon-image": `icon-${type}`,
      "icon-size": 0.1,
      "icon-allow-overlap": true,
    },
  });

  // Popup
  map.on("click", `${type}-points`, (e) => {
    const p = e.features[0].properties;

    new mapboxgl.Popup()
      .setLngLat(e.features[0].geometry.coordinates)
      .setHTML(
        `
        <b>${p.station_name || "Unknown Station"}</b><br>
        <small>${p.street_address || "No address"}</small><br>
        <small>${p.city || "No city"}</small><br>
        <small>${p.state || "No state"}</small><br>
        <small>${p.access_code || "No access code"}</small><br>
      `
      )
      .addTo(map);
  });

  // Cluster expand
  map.on("click", `${type}-clusters`, (e) => {
    const clusterId = e.features[0].properties.cluster_id;
    map.getSource(type).getClusterExpansionZoom(clusterId, (err, zoom) => {
      if (err) return;
      map.easeTo({
        center: e.features[0].geometry.coordinates,
        zoom,
      });
    });
  });
}

map.on("load", async () => {
  await preloadIcons();

  for (const key in fuelLayers) {
    await loadFuelLayer(key, fuelLayers[key]);
  }
});

// Filter toggle
document.querySelectorAll("#filters button").forEach((btn) => {
  btn.addEventListener("click", () => {
    const type = btn.dataset.type;

    const layers = [
      `${type}-clusters`,
      `${type}-cluster-count`,
      `${type}-points`,
    ];

    const currentVisibility =
      map.getLayoutProperty(`${type}-points`, "visibility") || "visible";

    const newVis = currentVisibility === "visible" ? "none" : "visible";

    layers.forEach((layerId) => {
      map.setLayoutProperty(layerId, "visibility", newVis);
    });

    btn.classList.toggle("active");
  });
});
