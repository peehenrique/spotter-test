from types import SimpleNamespace

from django.test import SimpleTestCase

from routing.services.risk import RiskLevel
from routing.services.scoring import rank_routes, summarize


class SummarizeTests(SimpleTestCase):
    def test_segment_uses_the_worse_endpoint(self):
        summary = summarize(
            [
                (0, RiskLevel.LOW),
                (10, RiskLevel.SEVERE),
                (30, RiskLevel.LOW),
            ]
        )
        self.assertAlmostEqual(summary.severe_miles, 30)
        self.assertAlmostEqual(summary.low_miles, 0)
        self.assertAlmostEqual(summary.average_risk, 4)


class RankingTests(SimpleTestCase):
    def _route(self, route_id, no_travel, severe, high, average, duration):
        summary = SimpleNamespace(
            no_travel_miles=no_travel,
            severe_miles=severe,
            high_miles=high,
            average_risk=average,
        )
        return SimpleNamespace(id=route_id, summary=summary, duration_seconds=duration)

    def test_preference_order(self):
        no_travel = self._route("no-travel", 1, 0, 0, 1, 100)
        severe = self._route("severe", 0, 5, 0, 1, 100)
        high = self._route("high", 0, 0, 9, 2, 100)
        calmer = self._route("calmer", 0, 0, 9, 1.5, 900)
        faster = self._route("faster", 0, 0, 9, 1.5, 400)
        ordered = [route.id for route in rank_routes([no_travel, severe, high, calmer, faster])]
        self.assertEqual(ordered, ["faster", "calmer", "high", "severe", "no-travel"])
