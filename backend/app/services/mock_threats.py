import asyncio
import json
import random
import uuid
from datetime import datetime, timezone

from app.schemas.threat import ThreatWarningPackage
from app.services.audio_cache import get as get_cached_audio
from app.services.audio_cache import put as cache_audio
from app.services.tts import AUDIO_MIME_TYPE, synthesize_speech

MOCK_MESSAGES = [
    {
        "message": "Obstacle ahead on your path",
        "severity": "high",
        "direction": "ahead",
        "distance_m": 2.5,
    },
    {
        "message": "Curb to your left",
        "severity": "medium",
        "direction": "left",
        "distance_m": 1.0,
    },
    {
        "message": "Person approaching from the right",
        "severity": "medium",
        "direction": "right",
        "distance_m": 4.0,
    },
    {
        "message": "Low hanging branch ahead",
        "severity": "critical",
        "direction": "ahead",
        "distance_m": 1.5,
    },
    {
        "message": "Wet surface detected ahead",
        "severity": "low",
        "direction": "ahead",
        "distance_m": 3.0,
    },
]

MIN_INTERVAL_S = 8
MAX_INTERVAL_S = 12

TEST_CACHE_KEY = "__test__"
TEST_MESSAGE = "AuraHear test. Obstacle ahead on your path."


async def attach_audio(warning: ThreatWarningPackage) -> ThreatWarningPackage:
    audio_bytes = await synthesize_speech(warning.message)
    if not audio_bytes:
        return warning

    cache_audio(warning.id, audio_bytes, AUDIO_MIME_TYPE)
    return warning.model_copy(
        update={
            "audio_url": f"/api/warnings/{warning.id}/audio",
            "audio_mime_type": AUDIO_MIME_TYPE,
        }
    )


async def build_mock_warning(session_id: str) -> ThreatWarningPackage:
    template = random.choice(MOCK_MESSAGES)
    warning_id = str(uuid.uuid4())

    warning = ThreatWarningPackage(
        id=warning_id,
        sessionId=session_id,
        message=template["message"],
        severity=template["severity"],
        direction=template.get("direction"),
        distanceM=template.get("distance_m"),
        issuedAt=datetime.now(timezone.utc).isoformat(),
    )

    return await attach_audio(warning)


async def ensure_test_audio() -> bool:
    if get_cached_audio(TEST_CACHE_KEY) is not None:
        return True

    audio_bytes = await synthesize_speech(TEST_MESSAGE)
    if audio_bytes is None:
        return False

    cache_audio(TEST_CACHE_KEY, audio_bytes, AUDIO_MIME_TYPE)
    return True


async def mock_warning_events(session_id: str):
    """Yield SSE-formatted mock warning events while the client is connected."""
    while True:
        interval = random.uniform(MIN_INTERVAL_S, MAX_INTERVAL_S)
        await asyncio.sleep(interval)

        warning = await build_mock_warning(session_id)
        payload = json.dumps(warning.model_dump(mode="json", by_alias=True))
        yield f"event: warning\ndata: {payload}\n\n"
