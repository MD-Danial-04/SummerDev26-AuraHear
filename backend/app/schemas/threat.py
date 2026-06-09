from typing import Literal

from pydantic import BaseModel, Field

ThreatSeverity = Literal["low", "medium", "high", "critical"]


class ThreatWarningPackage(BaseModel):
    id: str
    session_id: str = Field(alias="sessionId")
    message: str
    severity: ThreatSeverity
    direction: str | None = None
    distance_m: float | None = Field(default=None, alias="distanceM")
    issued_at: str = Field(alias="issuedAt")
    audio_url: str | None = Field(default=None, alias="audioUrl")
    audio_mime_type: str | None = Field(default=None, alias="audioMimeType")

    model_config = {"populate_by_name": True}
