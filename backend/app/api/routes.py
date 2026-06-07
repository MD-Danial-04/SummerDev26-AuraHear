from fastapi import APIRouter, File, Form, HTTPException, UploadFile
from fastapi.responses import Response, StreamingResponse

from app.services.audio_cache import get as get_cached_audio
from app.services.mock_threats import (
    TEST_CACHE_KEY,
    TEST_MESSAGE,
    ensure_test_audio,
    mock_warning_events,
)

router = APIRouter()

CAPTURE_MODE_VIDEO_CHUNK = "video_chunk"


@router.get("/health")
def health():
    return {"status": "ok"}


@router.get("/sessions/{session_id}/warnings")
async def stream_warnings(session_id: str):
    return StreamingResponse(
        mock_warning_events(session_id),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
        },
    )


@router.get("/warnings/{warning_id}/audio")
async def get_warning_audio(warning_id: str):
    entry = get_cached_audio(warning_id)
    if entry is None:
        raise HTTPException(status_code=404, detail="Audio not found")

    data, mime_type = entry
    return Response(content=data, media_type=mime_type)


@router.get("/tts/test")
async def tts_test():
    ok = await ensure_test_audio()
    if not ok:
        return {
            "ok": False,
            "message": TEST_MESSAGE,
            "error": "tts_failed",
        }

    return {
        "ok": True,
        "message": TEST_MESSAGE,
        "audioUrl": "/api/tts/test/audio",
        "audioMimeType": "audio/mpeg",
    }


@router.get("/tts/test/audio")
async def tts_test_audio():
    entry = get_cached_audio(TEST_CACHE_KEY)
    if entry is None:
        ok = await ensure_test_audio()
        if not ok:
            raise HTTPException(status_code=503, detail="TTS synthesis failed")
        entry = get_cached_audio(TEST_CACHE_KEY)

    if entry is None:
        raise HTTPException(status_code=503, detail="TTS synthesis failed")

    data, mime_type = entry
    return Response(content=data, media_type=mime_type)


@router.post("/media/chunk")
async def upload_media_chunk(
    file: UploadFile = File(...),
    session_id: str = Form(...),
    sequence: int = Form(...),
    captured_at: str = Form(...),
    capture_mode: str = Form(...),
):
    if capture_mode != CAPTURE_MODE_VIDEO_CHUNK:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported capture_mode: {capture_mode}",
        )

    content = await file.read()
    if len(content) == 0:
        raise HTTPException(status_code=400, detail="Empty chunk")

    return {
        "accepted": True,
        "session_id": session_id,
        "sequence": sequence,
        "bytes": len(content),
        "captured_at": captured_at,
    }
