import requests
import json

API_KEY = "mt2MmRuURhgcr7iF3pa8egb4agavf9nX8cn840Ee"
url = f"https://developer.nrel.gov/api/alt-fuel-stations/v1.json?api_key={API_KEY}&fuel_type=E85&limit=20000"

response = requests.get(url)
data = response.json()

features = []

for s in data.get("fuel_stations", []):
    if s.get("e85_has_blender_pump") is not None and s.get("longitude") and s.get("latitude"):
        feature = {
            "type": "Feature",
            "geometry": {
                "type": "Point",
                "coordinates": [s["longitude"], s["latitude"]],
            },
            "properties": {
                "station_name": s.get("station_name"),
                "street_address": s.get("street_address"),
                "city": s.get("city"),
                "state": s.get("state"),
                "zip": s.get("zip"),
                "phone": s.get("station_phone"),
                "e85_blender": s.get("e85_has_blender_pump"),
            },
        }
        features.append(feature)

geojson = {
    "type": "FeatureCollection",
    "features": features
}

with open("e85_stations.geojson", "w") as f:
    json.dump(geojson, f, indent=2)

print("✔ E85 data cleaned and saved as e85_stations.geojson")

