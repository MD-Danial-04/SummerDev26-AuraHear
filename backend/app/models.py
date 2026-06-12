from typing import Literal

from pydantic import BaseModel, Field


DangerLevel = Literal["none", "low", "medium", "high", "critical"]
DirectionHint = Literal[
    "left",
    "center_left",
    "center",
    "center_right",
    "right",
    "upper_left",
    "upper_right",
    "lower_left",
    "lower_right",
    "unknown",
]
ProximityHint = Literal["immediate", "near", "ahead", "clear", "unknown"]


class MediaUrlRequest(BaseModel):
    media_url: str = Field(..., description="Publicly reachable image or video URL.")
    context: str | None = Field(
        default=None,
        description="Optional context such as location, direction of travel, or user request.",
    )


class Coordinate(BaseModel):
    lat: float = Field(..., ge=-90, le=90)
    lon: float = Field(..., ge=-180, le=180)


class GeocodeRequest(BaseModel):
    query: str = Field(..., min_length=2, description="Address or landmark to look up.")
    limit: int = Field(default=5, ge=1, le=10)


class GeocodeResult(BaseModel):
    name: str
    lat: float
    lon: float


class GeocodeResponse(BaseModel):
    query: str
    results: list[GeocodeResult] = Field(default_factory=list)


class NavigationRouteRequest(BaseModel):
    origin: Coordinate
    destination: Coordinate
    origin_name: str | None = Field(
        default=None,
        description="Optional human-readable label for the origin.",
    )
    destination_name: str | None = Field(
        default=None,
        description="Optional human-readable label for the destination.",
    )


class NavigationStep(BaseModel):
    instruction: str
    spoken_instruction: str
    distance_meters: float
    duration_seconds: float
    street_name: str | None = None
    maneuver_type: str | None = None
    maneuver_modifier: str | None = None
    location: Coordinate


class NavigationSummary(BaseModel):
    distance_meters: float
    duration_seconds: float
    estimated_minutes: int


class NavigationRouteResponse(BaseModel):
    origin: Coordinate
    destination: Coordinate
    origin_name: str | None = None
    destination_name: str | None = None
    summary: NavigationSummary
    steps: list[NavigationStep] = Field(default_factory=list)
    path: list[Coordinate] = Field(default_factory=list)


class HazardAlert(BaseModel):
    danger_level: DangerLevel
    confidence: float = Field(..., ge=0, le=1)
    summary: str
    spoken_alert: str
    recommended_action: str
    direction_hint: DirectionHint = "unknown"
    proximity_hint: ProximityHint = "unknown"
    hazards: list[str] = Field(default_factory=list)
    safe_path: str | None = None
    detected_objects: list[str] = Field(default_factory=list)


class VideoTimelineItem(BaseModel):
    timestamp_seconds: float = Field(..., ge=0)
    danger_level: DangerLevel
    confidence: float = Field(..., ge=0, le=1)
    summary: str
    spoken_alert: str
    recommended_action: str
    direction_hint: DirectionHint = "unknown"
    proximity_hint: ProximityHint = "unknown"
    hazards: list[str] = Field(default_factory=list)
    safe_path: str | None = None
    detected_objects: list[str] = Field(default_factory=list)


AnalysisMode = Literal["reka", "fallback"]


class AnalyzeResponse(BaseModel):
    source_type: Literal["image", "video"]
    alert: HazardAlert
    timeline: list[VideoTimelineItem] = Field(default_factory=list)
    raw_model_text: str | None = None
    analysis_mode: AnalysisMode = "reka"


class SessionStartRequest(BaseModel):
    context: str | None = Field(
        default=None,
        description="Reusable context for this walk, such as location or route.",
    )
    alert_cooldown_seconds: int = Field(default=8, ge=1, le=60)


class SessionStartResponse(BaseModel):
    session_id: str
    started_at: str
    context: str | None = None
    alert_cooldown_seconds: int


class SessionAlertRecord(BaseModel):
    alert_id: str
    created_at: str
    source_type: Literal["image", "video"]
    alert: HazardAlert
    should_speak: bool
    suppressed_reason: str | None = None


class SessionAnalyzeResponse(AnalyzeResponse):
    session_id: str
    alert_id: str
    should_speak: bool
    suppressed_reason: str | None = None


class SessionAlertsResponse(BaseModel):
    session_id: str
    alerts: list[SessionAlertRecord]


class MediaChunkResponse(BaseModel):
    accepted: bool
    session_id: str
    sequence: int
    bytes: int
    captured_at: str
    stored_chunks: int
    contiguous_chunks: int
    reconstructed_bytes: int
    missing_sequences: list[int] = Field(default_factory=list)


class MediaChunkStatusResponse(BaseModel):
    session_id: str
    stored_chunks: int
    contiguous_chunks: int
    reconstructed_bytes: int
    missing_sequences: list[int] = Field(default_factory=list)
