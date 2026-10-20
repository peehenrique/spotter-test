from __future__ import annotations

from dataclasses import dataclass

from routing.services.geo import (
    METERS_PER_MILE,
    Point,
    coordinates_to_points,
    cumulative_miles,
    haversine_miles,
    point_at_distance,
)


@dataclass(frozen=True)
class SamplePoint:
    lat: float
    lon: float
    distance_miles: float
    elapsed_seconds: float


def sample_polyline(
    coordinates: list[tuple[float, float]],
    segment_distances_meters: list[float] | None,
    segment_durations_seconds: list[float] | None,
    total_duration_seconds: float,
    interval_miles: float,
) -> list[SamplePoint]:
    """Place checkpoints every `interval_miles`, always including the destination.

    Elapsed time follows the routing engine's per-segment durations when they line
    up with the geometry. Otherwise it follows distance along the line.
    """
    points = coordinates_to_points(coordinates)
    if len(points) < 2:
        raise ValueError("A route needs at least two positions.")

    miles, durations = _metrics(
        points,
        segment_distances_meters,
        segment_durations_seconds,
        total_duration_seconds,
    )
    samples = []
    for target in _targets(miles[-1], interval_miles):
        location = point_at_distance(points, miles, target)
        samples.append(
            SamplePoint(
                lat=location.lat,
                lon=location.lon,
                distance_miles=target,
                elapsed_seconds=_elapsed_at(miles, durations, target),
            )
        )
    return samples


def _metrics(
    points: list[Point],
    segment_distances_meters: list[float] | None,
    segment_durations_seconds: list[float] | None,
    total_duration_seconds: float,
) -> tuple[list[float], list[float]]:
    use_annotations = (
        segment_distances_meters is not None
        and segment_durations_seconds is not None
        and len(segment_distances_meters) == len(points) - 1
        and len(segment_durations_seconds) == len(points) - 1
        and sum(segment_distances_meters) > 0
    )
    if use_annotations:
        assert segment_distances_meters is not None
        assert segment_durations_seconds is not None
        miles = [0.0]
        elapsed = [0.0]
        durations = _scaled_durations(segment_durations_seconds, total_duration_seconds)
        for distance_m, duration_s in zip(segment_distances_meters, durations):
            miles.append(miles[-1] + distance_m / METERS_PER_MILE)
            elapsed.append(elapsed[-1] + duration_s)
        return miles, elapsed

    miles = cumulative_miles(points)
    if miles[-1] <= 0:
        miles = [index * (1 / max(len(points) - 1, 1)) for index in range(len(points))]
    elapsed = [total_duration_seconds * (distance / miles[-1]) if miles[-1] else 0.0 for distance in miles]
    return miles, elapsed


def _scaled_durations(durations: list[float], total_duration_seconds: float) -> list[float]:
    total = sum(durations)
    if total <= 0:
        share = total_duration_seconds / len(durations)
        return [share for _ in durations]
    if abs(total - total_duration_seconds) <= 1:
        return list(durations)
    scale = total_duration_seconds / total
    return [value * scale for value in durations]


def _targets(total_miles: float, interval_miles: float) -> list[float]:
    if total_miles <= 0:
        return [0.0]
    targets = [0.0]
    cursor = interval_miles
    while cursor < total_miles - 1e-6:
        targets.append(cursor)
        cursor += interval_miles
    if total_miles - targets[-1] > 1e-6:
        targets.append(total_miles)
    return targets


def _elapsed_at(miles: list[float], elapsed: list[float], target_miles: float) -> float:
    if target_miles <= 0:
        return 0.0
    if target_miles >= miles[-1]:
        return elapsed[-1]
    hi = 1
    while hi < len(miles) - 1 and miles[hi] < target_miles:
        hi += 1
    lo = hi - 1
    span = miles[hi] - miles[lo]
    if span <= 0:
        return elapsed[hi]
    ratio = (target_miles - miles[lo]) / span
    return elapsed[lo] + (elapsed[hi] - elapsed[lo]) * ratio


def separation_miles(a: list[tuple[float, float]], b: list[tuple[float, float]], samples: int = 8) -> float:
    """Mean distance between two lines, sampled by distance fraction."""
    points_a = coordinates_to_points(a)
    points_b = coordinates_to_points(b)
    miles_a = cumulative_miles(points_a)
    miles_b = cumulative_miles(points_b)
    if samples < 2:
        samples = 2
    total = 0.0
    for index in range(samples):
        fraction = index / (samples - 1)
        left = point_at_distance(points_a, miles_a, miles_a[-1] * fraction)
        right = point_at_distance(points_b, miles_b, miles_b[-1] * fraction)
        total += haversine_miles(left, right)
    return total / samples
