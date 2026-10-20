from __future__ import annotations

import logging
from concurrent.futures import ThreadPoolExecutor
from dataclasses import dataclass
from datetime import datetime, timezone

import requests

from routing.services.errors import PlanError
from routing.services.geo import Point
from routing.services.geocoding import USER_AGENT

logger = logging.getLogger(__name__)

CHUNK_SIZE = 40


@dataclass(frozen=True)
class HourlySeries:
    times: list[str]
    wind_mph: list[float | None]
    rain_in_hr: list[float | None]
    snow_in_hr: list[float | None]


class WeatherClient:
    def __init__(self, base_url: str, timeout: float = 25) -> None:
        self.base_url = base_url.rstrip("/")
        self.timeout = timeout

    def forecast(self, points: list[Point], start: datetime, end: datetime) -> list[HourlySeries]:
        if not points:
            return []
        chunks = [points[index : index + CHUNK_SIZE] for index in range(0, len(points), CHUNK_SIZE)]
        workers = min(4, len(chunks))
        with ThreadPoolExecutor(max_workers=workers) as pool:
            parts = list(pool.map(lambda chunk: self._fetch_chunk(chunk, start, end), chunks))
        return [series for part in parts for series in part]

    def _fetch_chunk(self, points: list[Point], start: datetime, end: datetime) -> list[HourlySeries]:
        params = {
            "latitude": ",".join("%.2f" % point.lat for point in points),
            "longitude": ",".join("%.2f" % point.lon for point in points),
            "hourly": "wind_speed_10m,rain,snowfall",
            "wind_speed_unit": "mph",
            "precipitation_unit": "inch",
            "timezone": "UTC",
            "start_date": start.date().isoformat(),
            "end_date": end.date().isoformat(),
        }
        url = "%s/v1/forecast" % self.base_url
        last_error: Exception | None = None
        for attempt in range(2):
            try:
                response = requests.get(
                    url,
                    params=params,
                    headers={"User-Agent": USER_AGENT},
                    timeout=self.timeout,
                )
            except requests.RequestException as exc:
                last_error = exc
                continue
            if response.status_code in {429, 503} and attempt == 0:
                continue
            if response.status_code != 200:
                logger.warning("Open-Meteo status %s: %s", response.status_code, response.text[:300])
                raise PlanError("The weather service is unavailable. Try again in a moment.")
            try:
                payload = response.json()
            except ValueError as exc:
                raise PlanError("The weather service returned an unreadable response.") from exc
            return parse_open_meteo(payload, len(points))
        logger.warning("Open-Meteo request failed: %s", last_error)
        raise PlanError("The weather service is unavailable. Try again in a moment.")


def parse_open_meteo(payload: dict | list, count: int) -> list[HourlySeries]:
    if isinstance(payload, dict) and payload.get("error"):
        raise PlanError(str(payload.get("reason") or "Weather service error"))
    items = payload if isinstance(payload, list) else [payload]
    if len(items) != count:
        raise PlanError("The weather service returned an unexpected number of locations.")
    series = []
    for item in items:
        if not isinstance(item, dict):
            raise PlanError("The weather service returned an unreadable location.")
        if item.get("error"):
            raise PlanError(str(item.get("reason") or "Weather service error"))
        hourly = item.get("hourly") or {}
        times = hourly.get("time") or []
        wind = hourly.get("wind_speed_10m") or []
        rain = _rain_series(hourly, len(times))
        snow = hourly.get("snowfall") or []
        if not times or not (len(times) == len(wind) == len(rain) == len(snow)):
            raise PlanError("The weather service left out hourly wind, rain, or snow.")
        series.append(
            HourlySeries(
                times=[str(value) for value in times],
                wind_mph=[_number(value) for value in wind],
                rain_in_hr=[_number(value) for value in rain],
                snow_in_hr=[_number(value) for value in snow],
            )
        )
    return series


def _rain_series(hourly: dict, count: int) -> list:
    """Liquid rain. Fall back to total precipitation when the rain series is missing."""
    rain = hourly.get("rain")
    if isinstance(rain, list) and len(rain) == count:
        return rain
    return hourly.get("precipitation") or []


def reading_at(series: HourlySeries, moment: datetime, time_index: dict[str, int] | None = None) -> tuple[float, float, float]:
    """Return wind mph, rain in/hr, and snow in/hr for the hour that contains `moment`.

    Snowfall is already inches because the request sets precipitation_unit to inch.
    """
    if not series.times:
        raise PlanError("Weather data does not cover this departure.")
    index_map = time_index if time_index is not None else {stamp: index for index, stamp in enumerate(series.times)}
    target = moment.astimezone(timezone.utc).replace(minute=0, second=0, microsecond=0)
    key = target.strftime("%Y-%m-%dT%H:00")
    index = index_map.get(key)
    if index is None:
        index = _nearest_index(series.times, target)
    index = _nearby_complete_hour(series, index)
    wind = series.wind_mph[index]
    rain = series.rain_in_hr[index]
    snow = series.snow_in_hr[index]
    if wind is None or rain is None or snow is None:
        raise PlanError("Weather data does not cover this departure.")
    return float(wind), float(rain), float(snow)


def _number(value: object) -> float | None:
    if value is None:
        return None
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def _nearest_index(times: list[str], target: datetime) -> int:
    best_index = 0
    best_delta = None
    for index, stamp in enumerate(times):
        parsed = _parse_hour(stamp)
        if parsed is None:
            continue
        delta = abs((parsed - target).total_seconds())
        if best_delta is None or delta < best_delta:
            best_index = index
            best_delta = delta
    if best_delta is None or best_delta > 3 * 3600:
        raise PlanError("Weather data does not cover this departure.")
    return best_index


def _nearby_complete_hour(series: HourlySeries, index: int) -> int:
    if _complete(series, index):
        return index
    for delta in range(1, 4):
        for candidate in (index - delta, index + delta):
            if 0 <= candidate < len(series.times) and _complete(series, candidate):
                return candidate
    return index


def _complete(series: HourlySeries, index: int) -> bool:
    return (
        series.wind_mph[index] is not None
        and series.rain_in_hr[index] is not None
        and series.snow_in_hr[index] is not None
    )


def _parse_hour(stamp: str) -> datetime | None:
    try:
        parsed = datetime.strptime(stamp, "%Y-%m-%dT%H:%M")
    except ValueError:
        return None
    return parsed.replace(tzinfo=timezone.utc)
