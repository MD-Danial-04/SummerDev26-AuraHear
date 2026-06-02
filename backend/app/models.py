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
