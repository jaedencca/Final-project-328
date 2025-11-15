"""
Build a GeoJSON of WA Hydrogen (HY) fuel stations from the NREL All Stations API.

- Filters: hydrogen only, state=WA, country=US, limit=all
- Keeps hydrogen-specific fields for map filtering and display.
"""

import os
import json
import requests

API_KEY = os.getenv("NREL_API_KEY", "ZusbR2G0ugcJUeumHhtN4mNfu6KmlshMzJTdzLJ9")

ALL_STATIONS_URL = "https://developer.nrel.gov/api/alt-fuel-stations/v1.json"

PARAMS = {
    "api_key": API_KEY,
    "fuel_type": "HY",      # Hydrogen
    "state": "WA",
    "country": "US",
    "limit": "all",         # get all matching stations
}

OUTPUT = "wa_hydrogen_stations.geojson"


def build_geojson():
    print("Requesting WA Hydrogen stations from All Stations API...")
    r = requests.get(ALL_STATIONS_URL, params=PARAMS, timeout=120)
    r.raise_for_status()

    data = r.json()
    stations = data.get("fuel_stations", [])
    print(f"Got {len(stations)} hydrogen stations")

    features = []

    for s in stations:
        lat = s.get("latitude")
        lon = s.get("longitude")
        if lat is None or lon is None:
            continue  # skip if no coordinates

        # ------- Hydrogen Properties --------
        properties = {
            "id": s.get("id"),
            "station_name": s.get("station_name"),
            "street_address": s.get("street_address"),
            "city": s.get("city"),
            "state": s.get("state"),
            "zip": s.get("zip"),
            "access_code": s.get("access_code"),
            "status_code": s.get("status_code"),

            # Hydrogen specific fields
            "hy_pressure": s.get("hy_pressure"),
            "hy_vehicle_class": s.get("hy_vehicle_class"),
            "hy_is_open": s.get("hy_is_open"),
            "hy_station_status": s.get("hy_station_status"),
        }

        # ------- GEOJSON Feature -------
        feature = {
            "type": "Feature",
            "geometry": {
                "type": "Point",
                "coordinates": [lon, lat],
            },
            "properties": properties,
        }

        features.append(feature)

    geojson = {
        "type": "FeatureCollection",
        "features": features,
    }

    with open(OUTPUT, "w", encoding="utf-8") as f:
        json.dump(geojson, f, indent=2)

    size_mb = os.path.getsize(OUTPUT) / (1024 * 1024)
    print(f"Saved cleaned hydrogen GeoJSON to {OUTPUT} ({size_mb:.2f} MB)")


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
