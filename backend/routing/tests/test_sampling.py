from django.test import SimpleTestCase

from routing.services.geo import Point, destination
from routing.services.sampling import sample_polyline


class SamplingTests(SimpleTestCase):
    def test_interval_includes_start_samples_and_destination(self):
        coordinates = [(lon / 10.0, 0.0) for lon in range(0, 11)]
        samples = sample_polyline(coordinates, None, None, total_duration_seconds=3600, interval_miles=25)
        distances = [sample.distance_miles for sample in samples]
        self.assertEqual(distances[0], 0)
        self.assertAlmostEqual(distances[1], 25, delta=0.05)
        self.assertGreater(distances[-1], 60)
        self.assertLess(distances[-1] - distances[-2], 25.5)
        self.assertEqual(samples[0].elapsed_seconds, 0)
        self.assertAlmostEqual(samples[-1].elapsed_seconds, 3600, delta=0.01)
        self.assertAlmostEqual(samples[0].lat, 0, delta=0.0001)
        self.assertAlmostEqual(samples[-1].lon, 1, delta=0.0001)

    def test_annotations_control_eta(self):
        coordinates = [(0.0, 0.0), (1.0, 0.0)]
        samples = sample_polyline(
            coordinates,
            segment_distances_meters=[160934.4],
            segment_durations_seconds=[1000],
            total_duration_seconds=1000,
            interval_miles=50,
        )
        self.assertAlmostEqual(samples[-1].distance_miles, 100, delta=0.1)
        halfway = next(sample for sample in samples if abs(sample.distance_miles - 50) < 0.1)
        self.assertAlmostEqual(halfway.elapsed_seconds, 500, delta=1)

    def test_interval_is_kept_when_the_next_mark_is_near_the_destination(self):
        end = destination(Point(0.0, 0.0), 0, 60)
        samples = sample_polyline(
            [(0.0, 0.0), (end.lon, end.lat)],
            None,
            None,
            total_duration_seconds=3600,
            interval_miles=50,
        )
        distances = [sample.distance_miles for sample in samples]
        self.assertTrue(any(abs(distance - 50) < 0.2 for distance in distances), distances)
        self.assertAlmostEqual(distances[-1], 60, delta=0.2)

    def test_short_route_still_includes_the_destination(self):
        coordinates = [(0.0, 0.0), (0.05, 0.0)]
        samples = sample_polyline(coordinates, None, None, total_duration_seconds=600, interval_miles=50)
        self.assertEqual(len(samples), 2)
        self.assertEqual(samples[0].distance_miles, 0)
        self.assertGreater(samples[1].distance_miles, 0)
