from __future__ import annotations

from dataclasses import dataclass
from typing import TypeVar

from routing.services.risk import RiskLevel

T = TypeVar("T")


@dataclass(frozen=True)
class Summary:
    low_miles: float
    moderate_miles: float
    high_miles: float
    severe_miles: float
    no_travel_miles: float
    average_risk: float


def summarize(checkpoints: list[tuple[float, RiskLevel]]) -> Summary:
    """Attribute each segment to the worse of its two checkpoints.

    A truck is still in the worse condition until the next sample improves, so
    the miles between a calm point and a severe point count as severe.
    """
    buckets = {level: 0.0 for level in RiskLevel}
    weighted = 0.0
    total = 0.0
    for (start_miles, start_risk), (end_miles, end_risk) in zip(checkpoints, checkpoints[1:]):
        miles = max(0.0, end_miles - start_miles)
        level = max(start_risk, end_risk)
        buckets[level] += miles
        weighted += miles * int(level)
        total += miles
    average = (weighted / total) if total else float(RiskLevel.LOW)
    return Summary(
        low_miles=buckets[RiskLevel.LOW],
        moderate_miles=buckets[RiskLevel.MODERATE],
        high_miles=buckets[RiskLevel.HIGH],
        severe_miles=buckets[RiskLevel.SEVERE],
        no_travel_miles=buckets[RiskLevel.NO_TRAVEL],
        average_risk=average,
    )


def rank_routes(routes: list[T]) -> list[T]:
    """Prefer fewer no-travel miles, then severe, then high, then lower average risk, then time.

    The brief lists severe miles ahead of high miles, average risk, and travel time.
    No-travel is worse than severe, so those miles are the first key.
    """
    return sorted(routes, key=_score_key)


def _score_key(route: T) -> tuple[float, float, float, float, float, str]:
    summary = route.summary
    return (
        round(summary.no_travel_miles, 3),
        round(summary.severe_miles, 3),
        round(summary.high_miles, 3),
        round(summary.average_risk, 4),
        round(route.duration_seconds, 1),
        route.id,
    )


def format_duration(seconds: float) -> str:
    minutes = int(round(seconds / 60.0))
    hours, mins = divmod(minutes, 60)
    if hours <= 0:
        return "%dm" % mins
    return "%dh %dm" % (hours, mins)
