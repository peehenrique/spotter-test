from __future__ import annotations

from dataclasses import dataclass
from enum import IntEnum


class RiskLevel(IntEnum):
    """Higher values are more dangerous and compare with max()."""

    LOW = 1
    MODERATE = 2
    HIGH = 3
    SEVERE = 4
    NO_TRAVEL = 5

    @property
    def label(self) -> str:
        return _LABELS[self]


_LABELS = {
    RiskLevel.LOW: "low",
    RiskLevel.MODERATE: "moderate",
    RiskLevel.HIGH: "high",
    RiskLevel.SEVERE: "severe",
    RiskLevel.NO_TRAVEL: "no_travel",
}


def classify_wind(mph: float) -> RiskLevel:
    """Wind bands from the assessment. Upper edges are exclusive, except no-travel at 55."""
    if mph < 25:
        return RiskLevel.LOW
    if mph < 35:
        return RiskLevel.MODERATE
    if mph < 45:
        return RiskLevel.HIGH
    if mph < 55:
        return RiskLevel.SEVERE
    return RiskLevel.NO_TRAVEL


def classify_rain(inches_per_hour: float) -> RiskLevel:
    """Shared boundaries belong to the worse band. 1.00 in/hr is still severe."""
    if inches_per_hour < 0.10:
        return RiskLevel.LOW
    if inches_per_hour < 0.25:
        return RiskLevel.MODERATE
    if inches_per_hour < 0.50:
        return RiskLevel.HIGH
    if inches_per_hour <= 1.00:
        return RiskLevel.SEVERE
    return RiskLevel.NO_TRAVEL


def classify_snow(inches_per_hour: float) -> RiskLevel:
    """Shared boundaries belong to the worse band. 3.0 in/hr is still severe."""
    if inches_per_hour < 0.5:
        return RiskLevel.LOW
    if inches_per_hour < 1.0:
        return RiskLevel.MODERATE
    if inches_per_hour < 2.0:
        return RiskLevel.HIGH
    if inches_per_hour <= 3.0:
        return RiskLevel.SEVERE
    return RiskLevel.NO_TRAVEL


def apply_load_to_wind(wind_mph: float, load_lb: float, wind_level: RiskLevel) -> tuple[RiskLevel, bool]:
    """Escalate wind for heavy loads. Returns the level and whether the load changed it.

    * 55 mph or more is no-travel for every load (already true from the wind table).
    * 45–54 mph and more than 30,000 lb becomes no-travel.
    * 35–44 mph and more than 40,000 lb becomes severe.
    """
    if 45 <= wind_mph < 55 and load_lb > 30_000:
        return RiskLevel.NO_TRAVEL, True
    if 35 <= wind_mph < 45 and load_lb > 40_000:
        return RiskLevel.SEVERE, True
    return wind_level, False


@dataclass(frozen=True)
class WeatherRisk:
    wind_mph: float
    rain_in_hr: float
    snow_in_hr: float
    wind_risk: RiskLevel
    rain_risk: RiskLevel
    snow_risk: RiskLevel
    risk: RiskLevel
    load_escalated: bool


def assess_weather(wind_mph: float, rain_in_hr: float, snow_in_hr: float, load_lb: float) -> WeatherRisk:
    """Checkpoint risk is the worst of wind (after load rules), rain, and snow."""
    wind_risk, escalated = apply_load_to_wind(wind_mph, load_lb, classify_wind(wind_mph))
    rain_risk = classify_rain(rain_in_hr)
    snow_risk = classify_snow(snow_in_hr)
    return WeatherRisk(
        wind_mph=wind_mph,
        rain_in_hr=rain_in_hr,
        snow_in_hr=snow_in_hr,
        wind_risk=wind_risk,
        rain_risk=rain_risk,
        snow_risk=snow_risk,
        risk=max(wind_risk, rain_risk, snow_risk),
        load_escalated=escalated,
    )
