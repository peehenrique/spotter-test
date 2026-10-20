from django.test import SimpleTestCase

from routing.services.geo import Point
from routing.services.osrm import OsrmClient, RawRoute


def _line(lat: float) -> RawRoute:
    coordinates = [(lon, lat) for lon in (-100.0, -99.5, -99.0, -98.5, -98.0)]
    return RawRoute(
        distance_meters=160_000,
        duration_seconds=7_200,
        coordinates=coordinates,
        segment_distances_meters=[],
        segment_durations_seconds=[],
    )


class ScriptedOsrm(OsrmClient):
    def __init__(self, fetch):
        super().__init__("http://osrm.test")
        self._scripted = fetch

    def _fetch(self, points, alternatives):
        return self._scripted(points, alternatives)


class RouteOptionsTests(SimpleTestCase):
    def test_alternatives_a_few_miles_apart_both_stay(self):
        primary = [_line(40.0), _line(40.07)]

        def fetch(points, alternatives):
            if len(points) == 2:
                return primary
            return [_line(40.0)]

        routes = ScriptedOsrm(fetch).routes_between(Point(40.0, -100.0), Point(40.0, -98.0))
        lats = {round(route.coordinates[0][1], 2) for route in routes}
        self.assertIn(40.0, lats)
        self.assertIn(40.07, lats)

    def test_third_route_can_come_from_a_via_away_from_the_middle(self):
        base = _line(40.0)

        def fetch(points, alternatives):
            if len(points) == 2:
                return [base]
            via = points[1]
            fraction = (via.lon + 100.0) / 2.0
            lateral_miles = abs(via.lat - 40.0) * 69.0
            off_middle = fraction <= 0.4 or fraction >= 0.6
            if off_middle and lateral_miles > 12:
                return [_line(via.lat)]
            return [base]

        routes = ScriptedOsrm(fetch).routes_between(Point(40.0, -100.0), Point(40.0, -98.0))
        self.assertEqual(len(routes), 3)
