from __future__ import annotations

import logging
import time
from dataclasses import dataclass
from threading import Lock

import requests

from routing.services.errors import PlanError
from routing.services.sslcompat import enable_modern_tls

enable_modern_tls()

logger = logging.getLogger(__name__)

USER_AGENT = "WeatherAwareTruckRouting/1.0 (full-stack assessment)"


@dataclass(frozen=True)
class Place:
    label: str
    lat: float
    lon: float


class Geocoder:
    """Nominatim search. The public instance allows about one request per second."""

    def __init__(self, base_url: str, timeout: float = 15) -> None:
        self.base_url = base_url.rstrip("/")
        self.timeout = timeout
        self._lock = Lock()
        self._last_request = 0.0

    def search(self, query: str) -> list[Place]:
        text = query.strip()
        if len(text) < 3:
            return []
        with self._lock:
            wait = 1.05 - (time.monotonic() - self._last_request)
            if wait > 0:
                time.sleep(wait)
            self._last_request = time.monotonic()
            try:
                response = requests.get(
                    "%s/search" % self.base_url,
                    params={"q": text, "format": "jsonv2", "limit": 5, "addressdetails": 0},
                    headers={"User-Agent": USER_AGENT, "Accept": "application/json"},
                    timeout=self.timeout,
                )
                response.raise_for_status()
                payload = response.json()
            except requests.RequestException as exc:
                logger.warning("Geocoding failed: %s", exc)
                raise PlanError("The place search is unavailable. Try again in a moment.") from exc
            except ValueError as exc:
                raise PlanError("The place search returned an unreadable response.") from exc
        places = []
        for item in payload if isinstance(payload, list) else []:
            try:
                places.append(
                    Place(
                        label=str(item.get("display_name") or text),
                        lat=float(item["lat"]),
                        lon=float(item["lon"]),
                    )
                )
            except (KeyError, TypeError, ValueError):
                continue
        return places
