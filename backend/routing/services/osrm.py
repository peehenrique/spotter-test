from __future__ import annotations

import logging
from dataclasses import dataclass

import requests

from routing.services.errors import PlanError
from routing.services.geo import Point, bearing_degrees, coordinates_to_points, cumulative_miles, destination, point_at_distance
from routing.services.geocoding import USER_AGENT
from routing.services.sampling import separation_miles

logger = logging.getLogger(__name__)

SIMILAR_ROUTE_MILES = 8.0


@dataclass(frozen=True)
class RawRoute:
    distance_meters: float
    duration_seconds: float
    coordinates: list[tuple[float, float]]
    segment_distances_meters: list[float]
    segment_durations_seconds: list[float]


class OsrmClient:
    def __init__(self, base_url: str, timeout: float = 20) -> None:
        self.base_url = base_url.rstrip("/")
        self.timeout = timeout

    def routes_between(self, origin: Point, destination: Point) -> list[RawRoute]:
        primary = self._fetch([origin, destination], alternatives=2)
        unique: list[RawRoute] = []
        for route in primary:
            _add_unique(unique, route)
            if len(unique) == 3:
                return unique
        if not unique:
            raise PlanError("No drivable route was found between those points.", status=400)
        for via in via_candidates(unique[0]):
            try:
                extra = self._fetch([origin, via, destination], alternatives=0)
            except PlanError as exc:
                logger.info("Skipping a via-point route: %s", exc)
                continue
            for route in extra:
                _add_unique(unique, route)
                if len(unique) == 3:
                    return unique
        return unique

    def _fetch(self, points: list[Point], alternatives: int) -> list[RawRoute]:
        coords = ";".join("%.6f,%.6f" % (point.lon, point.lat) for point in points)
        alternative_value = str(alternatives) if alternatives else "false"
        url = "%s/route/v1/driving/%s" % (self.base_url, coords)
        try:
            response = requests.get(
                url,
                params={
                    "alternatives": alternative_value,
                    "overview": "full",
                    "geometries": "geojson",
                    "annotations": "duration,distance",
                    "steps": "false",
                },
                headers={"User-Agent": USER_AGENT},
                timeout=self.timeout,
            )
        except requests.RequestException as exc:
            logger.warning("OSRM request failed: %s", exc)
            raise PlanError("The routing service is unavailable. Try again in a moment.") from exc
        if response.status_code != 200:
            logger.warning("OSRM status %s: %s", response.status_code, response.text[:300])
            raise PlanError("The routing service is unavailable. Try again in a moment.")
        try:
            payload = response.json()
        except ValueError as exc:
            raise PlanError("The routing service returned an unreadable response.") from exc
        return parse_osrm_routes(payload)


def parse_osrm_routes(payload: dict) -> list[RawRoute]:
    code = payload.get("code")
    if code != "Ok":
        message = payload.get("message") or code or "No route"
        status = 400 if code == "NoRoute" else 502
        raise PlanError(str(message), status=status)
    routes = []
    for route in payload.get("routes") or []:
        parsed = _parse_route(route)
        if parsed is not None:
            routes.append(parsed)
    return routes


def _parse_route(route: dict) -> RawRoute | None:
    geometry = route.get("geometry") or {}
    coordinates = geometry.get("coordinates") or []
    if len(coordinates) < 2:
        return None
    distances: list[float] = []
    durations: list[float] = []
    for leg in route.get("legs") or []:
        annotation = leg.get("annotation") or {}
        distances.extend(float(value) for value in annotation.get("distance") or [])
        durations.extend(float(value) for value in annotation.get("duration") or [])
    if len(distances) != len(coordinates) - 1 or len(durations) != len(coordinates) - 1:
        distances = []
        durations = []
    try:
        parsed_coordinates = [(float(lon), float(lat)) for lon, lat in coordinates]
    except (TypeError, ValueError):
        return None
    return RawRoute(
        distance_meters=float(route.get("distance") or 0),
        duration_seconds=float(route.get("duration") or 0),
        coordinates=parsed_coordinates,
        segment_distances_meters=distances,
        segment_durations_seconds=durations,
    )


def via_candidates(route: RawRoute) -> list[Point]:
    points = coordinates_to_points(route.coordinates)
    cumulative = cumulative_miles(points)
    total = cumulative[-1]
    if total <= 0:
        return []
    midpoint = point_at_distance(points, cumulative, total * 0.5)
    before = point_at_distance(points, cumulative, total * 0.45)
    after = point_at_distance(points, cumulative, total * 0.55)
    bearing = bearing_degrees(before, after)
    offset = min(80.0, max(15.0, total * 0.2))
    wider = min(120.0, offset * 1.8)
    return [
        destination(midpoint, bearing - 90, offset),
        destination(midpoint, bearing + 90, offset),
        destination(midpoint, bearing - 90, wider),
        destination(midpoint, bearing + 90, wider),
    ]


def _add_unique(routes: list[RawRoute], candidate: RawRoute) -> None:
    for existing in routes:
        if separation_miles(existing.coordinates, candidate.coordinates) < SIMILAR_ROUTE_MILES:
            return
    routes.append(candidate)
