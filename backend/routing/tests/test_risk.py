from django.test import SimpleTestCase

from routing.services.risk import RiskLevel, apply_load_to_wind, assess_weather, classify_rain, classify_snow, classify_wind


class WindBandsTests(SimpleTestCase):
    def test_thresholds(self):
        cases = [
            (0, RiskLevel.LOW),
            (24.99, RiskLevel.LOW),
            (25, RiskLevel.MODERATE),
            (34.99, RiskLevel.MODERATE),
            (35, RiskLevel.HIGH),
            (44.99, RiskLevel.HIGH),
            (45, RiskLevel.SEVERE),
            (54.99, RiskLevel.SEVERE),
            (55, RiskLevel.NO_TRAVEL),
            (70, RiskLevel.NO_TRAVEL),
        ]
        for mph, expected in cases:
            self.assertEqual(classify_wind(mph), expected, mph)


class RainBandsTests(SimpleTestCase):
    def test_thresholds(self):
        cases = [
            (0, RiskLevel.LOW),
            (0.099, RiskLevel.LOW),
            (0.10, RiskLevel.MODERATE),
            (0.249, RiskLevel.MODERATE),
            (0.25, RiskLevel.HIGH),
            (0.499, RiskLevel.HIGH),
            (0.50, RiskLevel.SEVERE),
            (1.0, RiskLevel.SEVERE),
            (1.001, RiskLevel.NO_TRAVEL),
        ]
        for amount, expected in cases:
            self.assertEqual(classify_rain(amount), expected, amount)


class SnowBandsTests(SimpleTestCase):
    def test_thresholds(self):
        cases = [
            (0, RiskLevel.LOW),
            (0.49, RiskLevel.LOW),
            (0.5, RiskLevel.MODERATE),
            (0.99, RiskLevel.MODERATE),
            (1.0, RiskLevel.HIGH),
            (1.99, RiskLevel.HIGH),
            (2.0, RiskLevel.SEVERE),
            (3.0, RiskLevel.SEVERE),
            (3.01, RiskLevel.NO_TRAVEL),
        ]
        for amount, expected in cases:
            self.assertEqual(classify_snow(amount), expected, amount)


class LoadRuleTests(SimpleTestCase):
    def test_heavy_load_escalates_only_the_stated_wind_bands(self):
        level, escalated = apply_load_to_wind(50, 30000, RiskLevel.SEVERE)
        self.assertEqual(level, RiskLevel.SEVERE)
        self.assertFalse(escalated)

        level, escalated = apply_load_to_wind(50, 30001, RiskLevel.SEVERE)
        self.assertEqual(level, RiskLevel.NO_TRAVEL)
        self.assertTrue(escalated)

        level, escalated = apply_load_to_wind(40, 40000, RiskLevel.HIGH)
        self.assertEqual(level, RiskLevel.HIGH)
        self.assertFalse(escalated)

        level, escalated = apply_load_to_wind(40, 40001, RiskLevel.HIGH)
        self.assertEqual(level, RiskLevel.SEVERE)
        self.assertTrue(escalated)

        level, escalated = apply_load_to_wind(60, 1000, RiskLevel.NO_TRAVEL)
        self.assertEqual(level, RiskLevel.NO_TRAVEL)
        self.assertFalse(escalated)

        level, escalated = apply_load_to_wind(10, 80000, RiskLevel.LOW)
        self.assertEqual(level, RiskLevel.LOW)
        self.assertFalse(escalated)

    def test_checkpoint_uses_the_worst_condition(self):
        weather = assess_weather(wind_mph=40, rain_in_hr=2, snow_in_hr=0, load_lb=50000)
        self.assertEqual(weather.wind_risk, RiskLevel.SEVERE)
        self.assertTrue(weather.load_escalated)
        self.assertEqual(weather.rain_risk, RiskLevel.NO_TRAVEL)
        self.assertEqual(weather.risk, RiskLevel.NO_TRAVEL)
