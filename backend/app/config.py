import os
from functools import lru_cache


class Settings:
    reka_api_key: str | None
    reka_base_url: str
    reka_model: str
    cors_origins: list[str]

    def __init__(self) -> None:
        self.reka_api_key = os.getenv("REKA_API_KEY")
        self.reka_base_url = os.getenv("REKA_BASE_URL", "https://api.reka.ai/v1")
        self.reka_model = os.getenv("REKA_MODEL", "reka-flash")
        self.cors_origins = [
            origin.strip()
            for origin in os.getenv("CORS_ORIGINS", "http://localhost:5173").split(",")
            if origin.strip()
        ]


@lru_cache
def get_settings() -> Settings:
    return Settings()
