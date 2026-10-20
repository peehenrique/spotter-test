from datetime import datetime, timedelta, timezone
from types import SimpleNamespace

from django.test import SimpleTestCase
from rest_framework.test import APIClient

from routing.services.errors import PlanError
from routing.services.osrm import RawRoute, parse_osrm_routes
from routing.services.planner import parse_plan_request, plan_trip
from routing.services.weather import HourlySeries


DEPARTURE = datetime.now(timezone.utc).replace(minute=0, second=0, microsecond=0) + timedelta(days=1)


def _line(lat, lon_start, lon_end, steps=8):
    coordinates = []
    for step in range(steps + 1):
        fraction = step / steps
        coordinates.append((lon_start + (lon_end - lon_start) * fraction, lat))
    return coordinates


def _route(lat, duration):
    coordinates = _line(lat, -100.0, -99.0)
    return RawRoute(
        distance_meters=90_000,
        duration_seconds=duration,
        coordinates=coordinates,
        segment_distances_meters=[],
        segment_durations_seconds=[],
    )


class ScriptedRouter:
    def routes_between(self, origin, destination):
        return [_route(40.0, duration=4000), _route(41.2, duration=3000)]


class ScriptedWeather:
    def forecast(self, points, start, end):
        hours = []
        cursor = start.astimezone(timezone.utc).replace(minute=0, second=0, microsecond=0)
        last = end.astimezone(timezone.utc).replace(minute=0, second=0, microsecond=0)
        while cursor <= last:
            hours.append(cursor.strftime("%Y-%m-%dT%H:00"))
            cursor += timedelta(hours=1)
        series = []
        for point in points:
            wind = 50.0 if point.lat >= 41 else 8.0
            series.append(
                HourlySeries(
                    times=list(hours),
                    wind_mph=[wind for _ in hours],
                    rain_in_hr=[0.0 for _ in hours],
                    snow_in_hr=[0.0 for _ in hours],
                )
            )
        return series


class OsrmParserTests(SimpleTestCase):
    def test_leg_annotations_are_concatenated(self):
        payload = {
            "code": "Ok",
            "routes": [
                {
                    "distance": 300,
                    "duration": 40,
                    "geometry": {"coordinates": [[0, 0], [1, 0], [2, 0]]},
                    "legs": [
                        {"annotation": {"distance": [100], "duration": [10]}},
                        {"annotation": {"distance": [200], "duration": [30]}},
                    ],
                }
            ],
        }
        routes = parse_osrm_routes(payload)
        self.assertEqual(routes[0].segment_distances_meters, [100, 200])
        self.assertEqual(routes[0].segment_durations_seconds, [10, 30])

    def test_no_route_is_a_client_error(self):
        with self.assertRaises(PlanError) as caught:
            parse_osrm_routes({"code": "NoRoute", "message": "No route found"})
        self.assertEqual(caught.exception.status, 400)


class PlannerTests(SimpleTestCase):
    def test_slower_calm_route_beats_a_windy_shortcut(self):
        request = parse_plan_request(
            {
                "origin": {"label": "West", "lat": 40.2, "lon": -100.0},
                "destination": {"label": "East", "lat": 40.2, "lon": -99.0},
                "departure": DEPARTURE.isoformat(),
                "load_weight_lb": 45000,
                "sample_interval_miles": 25,
            }
        )
        result = plan_trip(request, services=SimpleNamespace(geocoder=None, router=ScriptedRouter(), weather=ScriptedWeather()))
        self.assertEqual(result["recommended_route_id"], "route-1")
        by_id = {route["id"]: route for route in result["routes"]}
        self.assertEqual(by_id["route-1"]["summary"]["no_travel_miles"], 0)
        self.assertGreater(by_id["route-2"]["summary"]["no_travel_miles"], 0)
        self.assertEqual(len(result["corridor"]["hours"]), 49)
        self.assertGreater(len(result["corridor"]["points"]), 0)
        self.assertTrue(any(point["load_escalated"] for point in by_id["route-2"]["checkpoints"]))
        self.assertGreaterEqual(len(by_id["route-1"]["checkpoints"]), 2)

    def test_bad_interval_is_rejected(self):
        with self.assertRaises(PlanError):
            parse_plan_request(
                {
                    "origin": {"label": "A", "lat": 1, "lon": 2},
                    "destination": {"label": "B", "lat": 3, "lon": 4},
                    "departure": DEPARTURE.isoformat(),
                    "load_weight_lb": 1000,
                    "sample_interval_miles": 12,
                }
            )


class PlanEndpointTests(SimpleTestCase):
    def test_invalid_interval_does_not_call_upstream(self):
        client = APIClient()
        response = client.post(
            "/api/plan/",
            {
                "origin": {"label": "A", "lat": 1, "lon": 2},
                "destination": {"label": "B", "lat": 3, "lon": 4},
                "departure": DEPARTURE.isoformat(),
                "load_weight_lb": 1000,
                "sample_interval_miles": 12,
            },
            format="json",
        )
        self.assertEqual(response.status_code, 400)
        self.assertIn("10, 25, or 50", response.json()["detail"])

    def test_health(self):
        response = APIClient().get("/api/health/")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["status"], "ok")

    def test_short_geocode_query_skips_upstream(self):
        response = APIClient().get("/api/geocode/", {"q": "ab"})
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["results"], [])
