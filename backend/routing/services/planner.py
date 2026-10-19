from __future__ import annotations

import os
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone

from routing.services.corridor import build_corridor
from routing.services.errors import PlanError, PlanInputError
from routing.services.geo import decimate_coordinates, haversine_miles
from routing.services.geocoding import Geocoder, Place
from routing.services.osrm import OsrmClient, RawRoute
from routing.services.risk import assess_weather
from routing.services.sampling import SamplePoint, sample_polyline
from routing.services.scoring import Summary, format_duration, rank_routes, summarize
from routing.services.weather import WeatherClient, reading_at

FORECAST_HOURS = 49
MAX_DEPARTURE_DAYS = 6


@dataclass(frozen=True)
class PlanRequest:
    origin_label: str
    origin_lat: float | None
    origin_lon: float | None
    destination_label: str
    destination_lat: float | None
    destination_lon: float | None
    departure: datetime
    load_weight_lb: float
    sample_interval_miles: int


@dataclass
class Services:
    geocoder: Geocoder
    router: OsrmClient
    weather: WeatherClient


@dataclass
class _DraftRoute:
    id: str
    label: str
    duration_seconds: float
    coordinates: list[tuple[float, float]]
    samples: list[SamplePoint]


@dataclass
class _ScoredRoute:
    id: str
    label: str
    duration_seconds: float
    distance_miles: float
    geometry: list[tuple[float, float]]
    summary: Summary
    checkpoints: list[dict]


def parse_plan_request(data: object) -> PlanRequest:
    if not isinstance(data, dict):
        raise PlanInputError("Send the trip as a JSON object.")
    origin_label, origin_lat, origin_lon = _parse_place(data.get("origin"), "origin")
    destination_label, destination_lat, destination_lon = _parse_place(data.get("destination"), "destination")
    departure = _parse_departure(data.get("departure"))
    load_weight_lb = _parse_load(data.get("load_weight_lb"))
    interval = _parse_interval(data.get("sample_interval_miles"))
    _check_departure_window(departure)
    return PlanRequest(
        origin_label=origin_label,
        origin_lat=origin_lat,
        origin_lon=origin_lon,
        destination_label=destination_label,
        destination_lat=destination_lat,
        destination_lon=destination_lon,
        departure=departure,
        load_weight_lb=load_weight_lb,
        sample_interval_miles=interval,
    )


def plan_trip(request: PlanRequest, services: Services | None = None) -> dict:
    services = services or default_services()
    origin = _resolve(services.geocoder, request.origin_label, request.origin_lat, request.origin_lon, "origin")
    destination = _resolve(
        services.geocoder,
        request.destination_label,
        request.destination_lat,
        request.destination_lon,
        "destination",
    )
    if haversine_miles(origin_point(origin), origin_point(destination)) < 1:
        raise PlanInputError("Origin and destination are too close to compare routes.")

    raw_routes = services.router.routes_between(origin_point(origin), origin_point(destination))
    drafts = [_draft_route(index, raw, request.sample_interval_miles) for index, raw in enumerate(raw_routes[:3])]
    if not drafts:
        raise PlanInputError("No drivable route was found between those points.")

    corridor_points = build_corridor([draft.coordinates for draft in drafts])
    query_points, checkpoint_indexes, corridor_indexes = _weather_indexes(drafts, corridor_points)
    anchor = request.departure.astimezone(timezone.utc).replace(minute=0, second=0, microsecond=0)
    hours = [anchor + timedelta(hours=offset) for offset in range(FORECAST_HOURS)]
    latest_eta = max(
        request.departure + timedelta(seconds=sample.elapsed_seconds) for draft in drafts for sample in draft.samples
    )
    series = services.weather.forecast(query_points, anchor, max(hours[-1], latest_eta))
    if len(series) != len(query_points):
        raise PlanError("The weather service returned an unexpected number of locations.")
    indexed = [(item, {stamp: index for index, stamp in enumerate(item.times)}) for item in series]

    scored = [
        _score_route(draft, indexes, indexed, request.departure, request.load_weight_lb)
        for draft, indexes in zip(drafts, checkpoint_indexes)
    ]
    ranking = rank_routes(scored)
    recommended_id = ranking[0].id
    corridor = _corridor_payload(corridor_points, corridor_indexes, indexed, hours, request.load_weight_lb)
    return {
        "origin": _place_payload(origin),
        "destination": _place_payload(destination),
        "departure": _iso(request.departure),
        "load_weight_lb": request.load_weight_lb,
        "sample_interval_miles": request.sample_interval_miles,
        "recommended_route_id": recommended_id,
        "recommendation_reason": _reason(ranking[0]),
        "ranking": [route.id for route in ranking],
        "routes": [_route_payload(route, route.id == recommended_id) for route in scored],
        "corridor": corridor,
    }


def default_services() -> Services:
    return Services(
        geocoder=Geocoder(os.environ.get("NOMINATIM_BASE_URL", "https://nominatim.openstreetmap.org")),
        router=OsrmClient(os.environ.get("OSRM_BASE_URL", "https://router.project-osrm.org")),
        weather=WeatherClient(os.environ.get("OPEN_METEO_BASE_URL", "https://api.open-meteo.com")),
    )


def origin_point(place: Place):
    from routing.services.geo import Point

    return Point(place.lat, place.lon)


def _draft_route(index: int, raw: RawRoute, interval_miles: int) -> _DraftRoute:
    samples = sample_polyline(
        raw.coordinates,
        raw.segment_distances_meters or None,
        raw.segment_durations_seconds or None,
        raw.duration_seconds,
        interval_miles,
    )
    return _DraftRoute(
        id="route-%d" % (index + 1),
        label="Route %s" % chr(65 + index),
        duration_seconds=raw.duration_seconds,
        coordinates=raw.coordinates,
        samples=samples,
    )


def _score_route(draft, indexes, indexed, departure: datetime, load_lb: float) -> _ScoredRoute:
    checkpoints = []
    risk_points = []
    for position, (sample, series_index) in enumerate(zip(draft.samples, indexes)):
        series, time_index = indexed[series_index]
        eta = departure + timedelta(seconds=sample.elapsed_seconds)
        wind, rain, snow = reading_at(series, eta, time_index)
        weather = assess_weather(wind, rain, snow, load_lb)
        risk_points.append((sample.distance_miles, weather.risk))
        checkpoints.append(
            {
                "index": position,
                "lat": round(sample.lat, 5),
                "lon": round(sample.lon, 5),
                "distance_miles": round(sample.distance_miles, 1),
                "eta": _iso(eta),
                "wind_mph": round(weather.wind_mph, 1),
                "rain_in_hr": round(weather.rain_in_hr, 3),
                "snow_in_hr": round(weather.snow_in_hr, 2),
                "wind_risk": weather.wind_risk.label,
                "rain_risk": weather.rain_risk.label,
                "snow_risk": weather.snow_risk.label,
                "risk": weather.risk.label,
                "load_escalated": weather.load_escalated,
            }
        )
    summary = summarize(risk_points)
    distance = draft.samples[-1].distance_miles
    return _ScoredRoute(
        id=draft.id,
        label=draft.label,
        duration_seconds=draft.duration_seconds,
        distance_miles=distance,
        geometry=decimate_coordinates(draft.coordinates),
        summary=summary,
        checkpoints=checkpoints,
    )


def _weather_indexes(drafts: list[_DraftRoute], corridor_points):
    from routing.services.geo import Point

    queries: list[Point] = []
    keys: dict[tuple[float, float], int] = {}

    def add(lat: float, lon: float) -> int:
        key = (round(lat, 2), round(lon, 2))
        if key not in keys:
            keys[key] = len(queries)
            queries.append(Point(lat=key[0], lon=key[1]))
        return keys[key]

    checkpoint_indexes = [[add(sample.lat, sample.lon) for sample in draft.samples] for draft in drafts]
    corridor_indexes = [add(point.lat, point.lon) for point in corridor_points]
    return queries, checkpoint_indexes, corridor_indexes


def _corridor_payload(points, indexes, indexed, hours: list[datetime], load_lb: float) -> dict:
    payload_points = []
    for point, series_index in zip(points, indexes):
        series, time_index = indexed[series_index]
        risks = []
        for hour in hours:
            wind, rain, snow = reading_at(series, hour, time_index)
            risks.append(int(assess_weather(wind, rain, snow, load_lb).risk))
        payload_points.append({"lat": round(point.lat, 4), "lon": round(point.lon, 4), "risks": risks})
    return {"anchor": _iso(hours[0]), "hours": [_iso(hour) for hour in hours], "points": payload_points}


def _route_payload(route: _ScoredRoute, recommended: bool) -> dict:
    buckets = _rounded_buckets(route.summary, route.distance_miles)
    return {
        "id": route.id,
        "label": route.label,
        "recommended": recommended,
        "distance_miles": round(route.distance_miles, 1),
        "duration_seconds": int(round(route.duration_seconds)),
        "geometry": [[round(lon, 5), round(lat, 5)] for lon, lat in route.geometry],
        "summary": {
            "low_miles": buckets["low_miles"],
            "moderate_miles": buckets["moderate_miles"],
            "high_miles": buckets["high_miles"],
            "severe_miles": buckets["severe_miles"],
            "no_travel_miles": buckets["no_travel_miles"],
            "average_risk": round(route.summary.average_risk, 2),
        },
        "checkpoints": route.checkpoints,
    }


def _rounded_buckets(summary: Summary, total_miles: float) -> dict[str, float]:
    raw = {
        "low_miles": summary.low_miles,
        "moderate_miles": summary.moderate_miles,
        "high_miles": summary.high_miles,
        "severe_miles": summary.severe_miles,
        "no_travel_miles": summary.no_travel_miles,
    }
    rounded = {key: round(value, 1) for key, value in raw.items()}
    drift = round(round(total_miles, 1) - sum(rounded.values()), 1)
    if drift:
        largest = max(raw, key=lambda key: raw[key])
        rounded[largest] = round(rounded[largest] + drift, 1)
    return rounded


def _reason(route: _ScoredRoute) -> str:
    buckets = _rounded_buckets(route.summary, route.distance_miles)
    return (
        "%s ranks first with %.1f no-travel miles, %.1f severe miles, %.1f high miles, "
        "average risk %.2f, and %s of travel."
        % (
            route.label,
            buckets["no_travel_miles"],
            buckets["severe_miles"],
            buckets["high_miles"],
            route.summary.average_risk,
            format_duration(route.duration_seconds),
        )
    )


def _resolve(geocoder: Geocoder, label: str, lat: float | None, lon: float | None, field: str) -> Place:
    if lat is not None and lon is not None:
        return Place(label=label, lat=lat, lon=lon)
    matches = geocoder.search(label)
    if not matches:
        raise PlanInputError("Could not find that %s." % field)
    match = matches[0]
    return Place(label=label, lat=match.lat, lon=match.lon)


def _parse_place(value: object, field: str) -> tuple[str, float | None, float | None]:
    if not isinstance(value, dict):
        raise PlanInputError("Enter an %s." % field)
    label = str(value.get("label") or "").strip()
    if not label:
        raise PlanInputError("Enter an %s." % field)
    if len(label) > 300:
        raise PlanInputError("That %s name is too long." % field)
    lat = value.get("lat")
    lon = value.get("lon")
    if lat is None and lon is None:
        return label, None, None
    try:
        lat_f = float(lat)
        lon_f = float(lon)
    except (TypeError, ValueError):
        raise PlanInputError("Choose the %s from the suggestions." % field)
    if not -90 <= lat_f <= 90 or not -180 <= lon_f <= 180:
        raise PlanInputError("The %s coordinates are invalid." % field)
    return label, lat_f, lon_f


def _parse_departure(value: object) -> datetime:
    if not isinstance(value, str) or not value.strip():
        raise PlanInputError("Choose a departure date and time.")
    text = value.strip()
    if text.endswith("Z"):
        text = text[:-1] + "+00:00"
    try:
        parsed = datetime.fromisoformat(text)
    except ValueError as exc:
        raise PlanInputError("Departure must be an ISO date and time.") from exc
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=timezone.utc)
    return parsed.astimezone(timezone.utc)


def _parse_load(value: object) -> float:
    try:
        load = float(value)
    except (TypeError, ValueError):
        raise PlanInputError("Enter a load weight in pounds.")
    if load <= 0 or load > 200_000:
        raise PlanInputError("Load weight must be between 1 and 200,000 lb.")
    return load


def _parse_interval(value: object) -> int:
    try:
        interval = int(value)
    except (TypeError, ValueError):
        raise PlanInputError("Choose a sample interval of 10, 25, or 50 miles.")
    if interval not in {10, 25, 50}:
        raise PlanInputError("Sample interval must be 10, 25, or 50 miles.")
    return interval


def _check_departure_window(departure: datetime) -> None:
    now = datetime.now(timezone.utc)
    if departure < now - timedelta(hours=6):
        raise PlanInputError("Choose a departure from 6 hours ago through the next 6 days.")
    if departure > now + timedelta(days=MAX_DEPARTURE_DAYS):
        raise PlanInputError("Choose a departure from 6 hours ago through the next 6 days.")


def _place_payload(place: Place) -> dict:
    return {"label": place.label, "lat": place.lat, "lon": place.lon}


def _iso(value: datetime) -> str:
    return value.astimezone(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")
