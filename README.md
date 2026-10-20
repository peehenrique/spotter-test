# Weather-Aware Truck Routing

A React and Django app that compares three driving routes for a truck and recommends the one with the safer weather, given the load weight and the departure time.

## Run it

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r backend/requirements.txt
cd backend && python manage.py test && python manage.py runserver
```

In another terminal:

```bash
cd frontend
npm install
npm run dev
```

Open http://localhost:5173. **Sample trip** loads Chicago to Kansas City at 42,000 lb.

Docker Compose serves the built app on http://localhost:8080:

```bash
docker compose up --build
```

## What the driver enters

Origin, destination, departure date and time, load weight, and a weather sample interval of 10, 25, or 50 miles.

## How a plan is built

1. Nominatim geocodes a place only when the request has no coordinates.
2. OSRM returns up to three driving routes. If the engine offers fewer than three lines at least 3 miles apart, the server asks again through via points on both sides, before and after the midpoint.
3. Checkpoints are placed every N miles along the road geometry, including the destination. Arrival time at each checkpoint follows OSRM's segment durations.
4. Open-Meteo supplies hourly wind (mph), liquid rain (inches), and snowfall (centimeters, converted to inches) for the hour the truck is expected to be there.
5. Each checkpoint takes the worst of wind, rain, and snow. Load rules can raise the wind level before that comparison.
6. Miles between two checkpoints count as the worse of the two samples.
7. Routes are ordered by fewest severe miles, then fewest high miles, then lowest distance-weighted average risk, then shortest travel time. No-travel miles are not a separate key; they raise the average, where no-travel is 5.

Average risk uses Low = 1, Moderate = 2, High = 3, Severe = 4, No travel = 5.

The corridor heatmap is fetched once for departure through 48 hours. The slider only changes which hour is drawn.

## Risk thresholds

Shared boundaries use the worse band. The top of the severe band stays severe, matching the "greater than" no-travel rule.

| | Low | Moderate | High | Severe | No travel |
| --- | --- | --- | --- | --- | --- |
| Wind (mph) | < 25 | 25–34.9 | 35–44.9 | 45–54.9 | ≥ 55 |
| Rain (in/hr) | < 0.10 | 0.10–0.24 | 0.25–0.49 | 0.50–1.00 | > 1.00 |
| Snow (in/hr) | < 0.5 | 0.5–0.9 | 1.0–1.9 | 2.0–3.0 | > 3.0 |

Load rules, applied to wind:

- 55 mph or more is no-travel for every load.
- 45–54 mph and more than 30,000 lb becomes no-travel.
- 35–44 mph and more than 40,000 lb becomes severe.

## API

`GET /api/health/`

`GET /api/geocode/?q=chicago`

`POST /api/plan/`

```json
{
  "origin": {"label": "Chicago, IL", "lat": 41.8781, "lon": -87.6298},
  "destination": {"label": "Kansas City, MO", "lat": 39.0997, "lon": -94.5786},
  "departure": "2026-10-21T11:00:00Z",
  "load_weight_lb": 42000,
  "sample_interval_miles": 25
}
```

Route geometry is GeoJSON order: `[longitude, latitude]`.

## External services

- Routing: [OSRM](https://project-osrm.org/) public demo (`OSRM_BASE_URL`)
- Geocoding: [Nominatim](https://nominatim.org/) (`NOMINATIM_BASE_URL`), limited to about one request per second
- Weather: [Open-Meteo](https://open-meteo.com/) (`OPEN_METEO_BASE_URL`)

OSRM durations are for the public driving profile, not a truck-restricted network. Departure must fall between 6 hours ago and 6 days ahead so the hourly forecast covers the trip.

## Tests

```bash
cd backend && python manage.py test
```

The risk, sampling, ranking, and planning tests do not call the external services.
