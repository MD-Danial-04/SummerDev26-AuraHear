from typing import Literal

from pydantic import BaseModel, Field


DangerLevel = Literal["none", "low", "medium", "high", "critical"]


class MediaUrlRequest(BaseModel):
    media_url: str = Field(..., description="Publicly reachable image or video URL.")
    context: str | None = Field(
        default=None,
        description="Optional context such as location, direction of travel, or user request.",
    )


class HazardAlert(BaseModel):
    danger_level: DangerLevel
    confidence: float = Field(..., ge=0, le=1)
    summary: str
    spoken_alert: str
    recommended_action: str
    hazards: list[str] = Field(default_factory=list)
    safe_path: str | None = None
    detected_objects: list[str] = Field(default_factory=list)


class AnalyzeResponse(BaseModel):
    source_type: Literal["image", "video"]
    alert: HazardAlert
    raw_model_text: str | None = None


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
