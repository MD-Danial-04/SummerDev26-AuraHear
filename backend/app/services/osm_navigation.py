import json
import math
from urllib.parse import urlencode
from urllib.request import Request, urlopen

from fastapi import HTTPException, status

from app.config import Settings
from app.models import (
    Coordinate,
    GeocodeResponse,
    GeocodeResult,
    NavigationRouteRequest,
    NavigationRouteResponse,
    NavigationStep,
    NavigationSummary,
)


class OSMNavigationService:
    def __init__(self, settings: Settings) -> None:
        self.settings = settings

    def geocode(self, query: str, limit: int = 5) -> GeocodeResponse:
        params = urlencode(
            {
                "q": query,
                "format": "jsonv2",
                "limit": limit,
                "addressdetails": 0,
            }
        )
        url = f"{self.settings.osm_nominatim_base_url.rstrip('/')}/search?{params}"
        payload = self._get_json(url)

        if not isinstance(payload, list):
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail="OpenStreetMap geocoder returned an unexpected response.",
            )

        results = [
            GeocodeResult(
                name=item.get("display_name", query),
                lat=float(item["lat"]),
                lon=float(item["lon"]),
            )
            for item in payload
            if "lat" in item and "lon" in item
        ]
        return GeocodeResponse(query=query, results=results)

    def build_route(
        self,
        request: NavigationRouteRequest,
    ) -> NavigationRouteResponse:
        coordinates = (
            f"{request.origin.lon},{request.origin.lat};"
            f"{request.destination.lon},{request.destination.lat}"
        )
        params = urlencode(
            {
                "overview": "full",
                "geometries": "geojson",
                "steps": "true",
            }
        )
        url = (
            f"{self.settings.osm_routing_base_url.rstrip('/')}"
            f"/route/v1/walking/{coordinates}?{params}"
        )
        payload = self._get_json(url)

        routes = payload.get("routes")
        if not routes:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="No walking route was found between the selected points.",
            )

        route = routes[0]
        legs = route.get("legs") or []
        steps: list[NavigationStep] = []
        for leg in legs:
            for raw_step in leg.get("steps") or []:
                maneuver = raw_step.get("maneuver") or {}
                location = maneuver.get("location") or [request.origin.lon, request.origin.lat]
                street_name = raw_step.get("name") or None
                instruction = _build_instruction(raw_step)
                steps.append(
                    NavigationStep(
                        instruction=instruction,
                        spoken_instruction=_build_spoken_instruction(raw_step),
                        distance_meters=round(float(raw_step.get("distance", 0.0)), 1),
                        duration_seconds=round(float(raw_step.get("duration", 0.0)), 1),
                        street_name=street_name,
                        maneuver_type=maneuver.get("type"),
                        maneuver_modifier=maneuver.get("modifier"),
                        location=Coordinate(lat=float(location[1]), lon=float(location[0])),
                    )
                )

        geometry = route.get("geometry") or {}
        path = [
            Coordinate(lat=float(lat), lon=float(lon))
            for lon, lat in geometry.get("coordinates") or []
        ]

        summary = NavigationSummary(
            distance_meters=round(float(route.get("distance", 0.0)), 1),
            duration_seconds=round(float(route.get("duration", 0.0)), 1),
            estimated_minutes=max(1, math.ceil(float(route.get("duration", 0.0)) / 60)),
        )
        return NavigationRouteResponse(
            origin=request.origin,
            destination=request.destination,
            origin_name=request.origin_name,
            destination_name=request.destination_name,
            summary=summary,
            steps=steps,
            path=path,
        )

    def _get_json(self, url: str) -> dict | list:
        req = Request(
            url,
            headers={
                "User-Agent": self.settings.osm_user_agent,
                "Accept": "application/json",
            },
        )
        try:
            with urlopen(req, timeout=12) as response:
                charset = response.headers.get_content_charset() or "utf-8"
                body = response.read().decode(charset)
        except HTTPException:
            raise
        except Exception as exc:
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail=f"OpenStreetMap navigation request failed: {exc}",
            ) from exc

        try:
            return json.loads(body)
        except json.JSONDecodeError as exc:
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail="OpenStreetMap navigation service returned invalid JSON.",
            ) from exc


def _build_instruction(step: dict) -> str:
    maneuver = step.get("maneuver") or {}
    step_type = (maneuver.get("type") or "continue").replace("_", " ")
    modifier = (maneuver.get("modifier") or "").replace("_", " ")
    name = (step.get("name") or "").strip()

    parts = [step_type.capitalize()]
    if modifier:
        parts.append(modifier)
    if name:
        parts.append(f"onto {name}")
    if not name and step_type == "arrive":
        parts.append("at your destination")
    return " ".join(parts)


def _build_spoken_instruction(step: dict) -> str:
    instruction = _build_instruction(step)
    distance = float(step.get("distance", 0.0))
    if distance <= 0:
        return instruction
    rounded_distance = int(round(distance / 5) * 5)
    return f"{instruction} in about {rounded_distance} meters."
