from datetime import datetime, timezone

from django.test import SimpleTestCase

from routing.services.weather import HourlySeries, parse_open_meteo, reading_at


def _series(**overrides):
    base = dict(
        times=["2026-10-20T14:00", "2026-10-20T15:00", "2026-10-20T16:00"],
        wind_mph=[10.0, 20.0, 30.0],
        rain_in_hr=[0.0, 0.2, 0.0],
        snow_cm=[0.0, 2.54, 0.0],
    )
    base.update(overrides)
    return HourlySeries(**base)


class OpenMeteoParserTests(SimpleTestCase):
    def test_single_location_object(self):
        payload = {
            "hourly": {
                "time": ["2026-10-20T14:00"],
                "wind_speed_10m": [12],
                "precipitation": [0.1],
                "snowfall": [0],
            }
        }
        series = parse_open_meteo(payload, 1)
        self.assertEqual(series[0].wind_mph, [12])

    def test_multiple_locations_are_a_list(self):
        hourly = {
            "time": ["2026-10-20T14:00"],
            "wind_speed_10m": [1],
            "precipitation": [0],
            "snowfall": [0],
        }
        series = parse_open_meteo([{"hourly": hourly}, {"hourly": hourly}], 2)
        self.assertEqual(len(series), 2)


class ReadingTests(SimpleTestCase):
    def test_hour_containing_the_eta_and_snow_conversion(self):
        moment = datetime(2026, 10, 20, 15, 40, tzinfo=timezone.utc)
        wind, rain, snow = reading_at(_series(), moment)
        self.assertEqual(wind, 20)
        self.assertEqual(rain, 0.2)
        self.assertAlmostEqual(snow, 1.0)

    def test_null_hour_falls_back_to_a_neighbor(self):
        series = _series(wind_mph=[10.0, None, 30.0], rain_in_hr=[0.0, None, 0.0], snow_cm=[0.0, None, 0.0])
        moment = datetime(2026, 10, 20, 15, 10, tzinfo=timezone.utc)
        wind, rain, snow = reading_at(series, moment)
        self.assertEqual((wind, rain, snow), (10.0, 0.0, 0.0))
