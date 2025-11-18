"""
Build a GeoJSON of WA EV charging stations with full EV unit detail
from the NREL All Stations API.

- Filters: electric only, state=WA, country=US, limit=all
- Keeps:
    * Station-level fields (name, address, connector types, counts, etc.)
    * Nested ev_charging_units with connector-level power and port counts.

You can serve this GeoJSON from your server and have the client
filter by connector type, power_kW, etc.
"""

import os
import json
import requests

API_KEY = os.getenv("NREL_API_KEY", "ZusbR2G0ugcJUeumHhtN4mNfu6KmlshMzJTdzLJ9")

ALL_STATIONS_URL = "https://developer.nrel.gov/api/alt-fuel-stations/v1.json"

PARAMS = {
    "api_key": API_KEY,
    "fuel_type": "ELEC",   # electric only
    "state": "WA",         # Washington
    "country": "US",       # explicit, default is US
    "limit": "all",        # get all matching stations
    # Optional refinements you can uncomment later:
    # "access": "public",  # only public access
    # "status": "E",       # only 'Available' stations
}

OUTPUT = "wa_ev_stations_full_units.geojson"


def build_geojson():
    print("Requesting WA EV stations from All Stations API...")
    r = requests.get(ALL_STATIONS_URL, params=PARAMS, timeout=120)
    r.raise_for_status()

    data = r.json()
    stations = data.get("fuel_stations", [])
    print(f"Got {len(stations)} stations")

    features = []

    for s in stations:
        lat = s.get("latitude")
        lon = s.get("longitude")
        if lat is None or lon is None:
            continue  # skip if no coordinates

        # ------- Build unit-level structure -------
        units_out = []
        for u in (s.get("ev_charging_units") or []):
            # connectors is a record keyed by connector type
            # e.g. {"J1772": {"power_kw": 7.2, "port_count": 2}, ...}
            connectors_raw = u.get("connectors") or {}
            connectors_out = []

            # Flatten the connectors record into a list of objects
            for c_type, c_info in connectors_raw.items():
                connectors_out.append({
                    "type": c_type,
                    "power_kw": c_info.get("power_kw"),
                    "port_count": c_info.get("port_count"),
                })

            units_out.append({
                "network": u.get("network"),
                "charging_level": u.get("charging_level"),
                "port_count": u.get("port_count"),
                "funding_sources": u.get("funding_sources"),
                "connectors": connectors_out,
            })

        # ------- Station-level feature -------
        feature = {
            "type": "Feature",
            "geometry": {
                "type": "Point",
                "coordinates": [lon, lat],
            },
            "properties": {
                "id": s.get("id"),
                "station_name": s.get("station_name"),
                "fuel_type_code": s.get("fuel_type_code"),
                "street_address": s.get("street_address"),
                "city": s.get("city"),
                "state": s.get("state"),
                "zip": s.get("zip"),
                "country": s.get("country"),
                "status_code": s.get("status_code"),
                "access_code": s.get("access_code"),
                "access_detail_code": s.get("access_detail_code"),
                "ev_network": s.get("ev_network"),
                "ev_network_web": s.get("ev_network_web"),
                "ev_pricing": s.get("ev_pricing"),
                "ev_connector_types": s.get("ev_connector_types"),
                "ev_level1_evse_num": s.get("ev_level1_evse_num"),
                "ev_level2_evse_num": s.get("ev_level2_evse_num"),
                "ev_dc_fast_num": s.get("ev_dc_fast_num"),
                # Full unit details for filtering on the client:
                "ev_charging_units": units_out,
            },
        }
        features.append(feature)

    geojson = {
        "type": "FeatureCollection",
        "features": features,
    }

    with open(OUTPUT, "w", encoding="utf-8") as f:
        json.dump(geojson, f, separators=(",", ":"))

    size_mb = os.path.getsize(OUTPUT) / (1024 * 1024)
    print(f"Saved GeoJSON to {OUTPUT} ({size_mb:.2f} MB)")


def main():
    try:
        build_geojson()
    except requests.HTTPError as e:
        print("HTTP error:", e)
        if e.response is not None:
            print("Response snippet:", e.response.text[:1000])
    except Exception as e:
        print("Unexpected error:", e)


if __name__ == "__main__":
    main()
