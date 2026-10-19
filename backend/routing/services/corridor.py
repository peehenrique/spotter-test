from __future__ import annotations

from routing.services.geo import (
    Point,
    bearing_degrees,
    coordinates_to_points,
    cumulative_miles,
    destination,
    haversine_miles,
    point_at_distance,
)

MAX_CORRIDOR_POINTS = 160


def build_corridor(
    geometries: list[list[tuple[float, float]]],
    stride_miles: float = 25,
    offsets_miles: tuple[float, ...] = (-14, 0, 14),
) -> list[Point]:
    """Sample a band around every route so the forecast slider can paint the corridor."""
    stride = stride_miles
    points: list[Point] = []
    while True:
        points = _sample(geometries, stride, offsets_miles)
        if len(points) <= MAX_CORRIDOR_POINTS or stride >= 80:
            return points
        stride *= 1.5


def _sample(
    geometries: list[list[tuple[float, float]]],
    stride_miles: float,
    offsets_miles: tuple[float, ...],
) -> list[Point]:
    found: list[Point] = []
    seen: set[tuple[float, float]] = set()
    for coordinates in geometries:
        points = coordinates_to_points(coordinates)
        if len(points) < 2:
            continue
        cumulative = cumulative_miles(points)
        total = cumulative[-1]
        targets = [0.0]
        cursor = stride_miles
        while cursor < total - 0.5:
            targets.append(cursor)
            cursor += stride_miles
        if total - targets[-1] > 1e-6:
            targets.append(total)
        for target in targets:
            center = point_at_distance(points, cumulative, target)
            bearing = _local_bearing(points, cumulative, target, total)
            for offset in offsets_miles:
                if offset == 0:
                    candidate = center
                else:
                    heading = bearing + (90 if offset > 0 else -90)
                    candidate = destination(center, heading, abs(offset))
                _add(found, seen, candidate)
    return found


def _local_bearing(points: list[Point], cumulative: list[float], target: float, total: float) -> float:
    before = point_at_distance(points, cumulative, max(0.0, target - 2))
    after = point_at_distance(points, cumulative, min(total, target + 2))
    if haversine_miles(before, after) < 0.05:
        return 90.0
    return bearing_degrees(before, after)


def _add(found: list[Point], seen: set[tuple[float, float]], point: Point) -> None:
    key = (round(point.lat, 2), round(point.lon, 2))
    if key in seen:
        return
    seen.add(key)
    found.append(point)
