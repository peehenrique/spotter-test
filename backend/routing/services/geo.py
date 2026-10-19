from __future__ import annotations

import math
from dataclasses import dataclass

EARTH_RADIUS_MILES = 3958.7613
METERS_PER_MILE = 1609.344


@dataclass(frozen=True)
class Point:
    lat: float
    lon: float


def haversine_miles(a: Point, b: Point) -> float:
    lat1, lon1, lat2, lon2 = (math.radians(value) for value in (a.lat, a.lon, b.lat, b.lon))
    dlat = lat2 - lat1
    dlon = lon2 - lon1
    chord = math.sin(dlat / 2) ** 2 + math.cos(lat1) * math.cos(lat2) * math.sin(dlon / 2) ** 2
    return 2 * EARTH_RADIUS_MILES * math.asin(math.sqrt(chord))


def bearing_degrees(a: Point, b: Point) -> float:
    lat1 = math.radians(a.lat)
    lat2 = math.radians(b.lat)
    dlon = math.radians(b.lon - a.lon)
    y = math.sin(dlon) * math.cos(lat2)
    x = math.cos(lat1) * math.sin(lat2) - math.sin(lat1) * math.cos(lat2) * math.cos(dlon)
    return (math.degrees(math.atan2(y, x)) + 360) % 360


def destination(start: Point, bearing_deg: float, distance_miles: float) -> Point:
    angular = distance_miles / EARTH_RADIUS_MILES
    bearing = math.radians(bearing_deg)
    lat1 = math.radians(start.lat)
    lon1 = math.radians(start.lon)
    lat2 = math.asin(
        math.sin(lat1) * math.cos(angular) + math.cos(lat1) * math.sin(angular) * math.cos(bearing)
    )
    lon2 = lon1 + math.atan2(
        math.sin(bearing) * math.sin(angular) * math.cos(lat1),
        math.cos(angular) - math.sin(lat1) * math.sin(lat2),
    )
    return Point(lat=math.degrees(lat2), lon=_wrap_lon(math.degrees(lon2)))


def coordinates_to_points(coordinates: list[tuple[float, float]]) -> list[Point]:
    """GeoJSON positions are [longitude, latitude]."""
    return [Point(lat=lat, lon=lon) for lon, lat in coordinates]


def cumulative_miles(points: list[Point]) -> list[float]:
    cumulative = [0.0]
    for start, end in zip(points, points[1:]):
        cumulative.append(cumulative[-1] + haversine_miles(start, end))
    return cumulative


def point_at_distance(points: list[Point], cumulative: list[float], target_miles: float) -> Point:
    if not points:
        raise ValueError("Cannot interpolate an empty line.")
    if target_miles <= 0 or len(points) == 1:
        return points[0]
    if target_miles >= cumulative[-1]:
        return points[-1]
    hi = 1
    while hi < len(cumulative) - 1 and cumulative[hi] < target_miles:
        hi += 1
    lo = hi - 1
    span = cumulative[hi] - cumulative[lo]
    if span <= 0:
        return points[hi]
    ratio = (target_miles - cumulative[lo]) / span
    return Point(
        lat=points[lo].lat + (points[hi].lat - points[lo].lat) * ratio,
        lon=points[lo].lon + (points[hi].lon - points[lo].lon) * ratio,
    )


def decimate_coordinates(
    coordinates: list[tuple[float, float]],
    min_miles: float = 0.4,
    max_points: int = 1200,
) -> list[tuple[float, float]]:
    if len(coordinates) <= 2:
        return list(coordinates)
    spacing = min_miles
    reduced = coordinates
    while True:
        reduced = _decimate_once(coordinates, spacing)
        if len(reduced) <= max_points or spacing >= 25:
            return reduced
        spacing *= 1.8


def _decimate_once(coordinates: list[tuple[float, float]], min_miles: float) -> list[tuple[float, float]]:
    kept = [coordinates[0]]
    last = Point(lat=coordinates[0][1], lon=coordinates[0][0])
    for lon, lat in coordinates[1:-1]:
        point = Point(lat=lat, lon=lon)
        if haversine_miles(last, point) >= min_miles:
            kept.append((lon, lat))
            last = point
    kept.append(coordinates[-1])
    return kept


def _wrap_lon(lon: float) -> float:
    return (lon + 540) % 360 - 180
