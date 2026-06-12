import os
from functools import lru_cache
from pathlib import Path

from dotenv import load_dotenv

_BACKEND_ROOT = Path(__file__).resolve().parents[1]
load_dotenv(_BACKEND_ROOT / ".env")


class Settings:
    reka_api_key: str | None
    reka_base_url: str
    reka_model: str
    osm_nominatim_base_url: str
    osm_routing_base_url: str
    osm_user_agent: str
    cors_origins: list[str]
    max_upload_bytes: int
    max_chunk_bytes: int
    min_analysis_interval_seconds: float
    max_session_analyses_per_minute: int

    def __init__(self) -> None:
        self.reka_api_key = os.getenv("REKA_API_KEY")
        self.reka_base_url = os.getenv("REKA_BASE_URL", "https://api.reka.ai/v1")
        self.reka_model = os.getenv("REKA_MODEL", "reka-flash")
        self.osm_nominatim_base_url = os.getenv(
            "OSM_NOMINATIM_BASE_URL",
            "https://nominatim.openstreetmap.org",
        )
        self.osm_routing_base_url = os.getenv(
            "OSM_ROUTING_BASE_URL",
            "https://router.project-osrm.org",
        )
        self.osm_user_agent = os.getenv(
            "OSM_USER_AGENT",
            "AuraHearHackathon/1.0 (contact: team@example.com)",
        )
        self.cors_origins = [
            origin.strip()
            for origin in os.getenv("CORS_ORIGINS", "http://localhost:5173").split(",")
            if origin.strip()
        ]
        self.max_upload_bytes = _int_env("MAX_UPLOAD_BYTES", 8 * 1024 * 1024)
        self.max_chunk_bytes = _int_env("MAX_CHUNK_BYTES", 3 * 1024 * 1024)
        self.min_analysis_interval_seconds = _float_env(
            "MIN_ANALYSIS_INTERVAL_SECONDS",
            1.5,
        )
        self.max_session_analyses_per_minute = _int_env(
            "MAX_SESSION_ANALYSES_PER_MINUTE",
            30,
        )


@lru_cache
def get_settings() -> Settings:
    return Settings()


def _int_env(name: str, default: int) -> int:
    value = os.getenv(name)
    if not value:
        return default
    return int(value)


def _float_env(name: str, default: float) -> float:
    value = os.getenv(name)
    if not value:
        return default
    return float(value)


def is_osm_user_agent_configured(user_agent: str) -> bool:
    normalized = user_agent.strip().lower()
    if not normalized:
        return False
    return "example.com" not in normalized and "team@" not in normalized
