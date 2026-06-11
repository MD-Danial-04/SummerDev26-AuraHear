from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from fastapi.responses import Response, StreamingResponse

from app.config import Settings, get_settings
from app.models import (
    AnalyzeResponse,
    GeocodeRequest,
    GeocodeResponse,
    MediaChunkResponse,
    MediaChunkStatusResponse,
    MediaUrlRequest,
    NavigationRouteRequest,
    NavigationRouteResponse,
    SessionAlertsResponse,
    SessionAnalyzeResponse,
    SessionStartRequest,
    SessionStartResponse,
)
from app.services.audio_cache import get as get_cached_audio
from app.services.mock_threats import (
    TEST_CACHE_KEY,
    TEST_MESSAGE,
    ensure_test_audio,
    mock_warning_events,
)
from app.services.osm_navigation import OSMNavigationService
from app.services.reka_vision import RekaVisionService
from app.services.media_chunk_store import media_chunk_store
from app.services.session_store import session_store

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


def get_reka_service(settings: Settings = Depends(get_settings)) -> RekaVisionService:
    return RekaVisionService(settings)


def get_navigation_service(
    settings: Settings = Depends(get_settings),
) -> OSMNavigationService:
    return OSMNavigationService(settings)


@router.post("/navigation/geocode", response_model=GeocodeResponse)
def geocode_location(
    request: GeocodeRequest,
    service: OSMNavigationService = Depends(get_navigation_service),
):
    return service.geocode(request.query, request.limit)


@router.post("/navigation/route", response_model=NavigationRouteResponse)
def build_navigation_route(
    request: NavigationRouteRequest,
    service: OSMNavigationService = Depends(get_navigation_service),
):
    return service.build_route(request)


@router.post("/analyze/frame", response_model=AnalyzeResponse)
async def analyze_frame(
    frame: UploadFile = File(...),
    context: str | None = Form(default=None),
    service: RekaVisionService = Depends(get_reka_service),
):
    return await service.analyze_upload_safely(frame, "image", context)


@router.post("/analyze/frame-url", response_model=AnalyzeResponse)
def analyze_frame_url(
    request: MediaUrlRequest,
    service: RekaVisionService = Depends(get_reka_service),
):
    return service.analyze_media_url_safely(request.media_url, "image", request.context)


@router.post("/analyze/video", response_model=AnalyzeResponse)
async def analyze_video(
    video: UploadFile = File(...),
    context: str | None = Form(default=None),
    service: RekaVisionService = Depends(get_reka_service),
):
    return await service.analyze_upload_safely(video, "video", context)


@router.post("/analyze/video-url", response_model=AnalyzeResponse)
def analyze_video_url(
    request: MediaUrlRequest,
    service: RekaVisionService = Depends(get_reka_service),
):
    return service.analyze_media_url_safely(request.media_url, "video", request.context)


@router.post("/session/start", response_model=SessionStartResponse)
def start_session(request: SessionStartRequest):
    return session_store.start_session(
        context=request.context,
        alert_cooldown_seconds=request.alert_cooldown_seconds,
    )


@router.get("/session/{session_id}/alerts", response_model=SessionAlertsResponse)
def get_session_alerts(session_id: str):
    return session_store.get_alerts(session_id)


@router.post("/session/{session_id}/analyze/frame", response_model=SessionAnalyzeResponse)
async def analyze_session_frame(
    session_id: str,
    frame: UploadFile = File(...),
    context: str | None = Form(default=None),
    alert_cooldown_seconds: int | None = Form(default=None),
    settings: Settings = Depends(get_settings),
    service: RekaVisionService = Depends(get_reka_service),
):
    session_store.ensure_session(
        session_id,
        context=context,
        alert_cooldown_seconds=alert_cooldown_seconds or 8,
    )
    _enforce_session_analysis_rate(session_id, settings)
    analysis_context = _merge_context(session_store.get_context(session_id), context)
    analysis = await service.analyze_upload_safely(frame, "image", analysis_context)
    record = session_store.add_alert(session_id, analysis)
    return _session_response(session_id, analysis, record)


@router.post("/session/{session_id}/analyze/frame-url", response_model=SessionAnalyzeResponse)
def analyze_session_frame_url(
    session_id: str,
    request: MediaUrlRequest,
    settings: Settings = Depends(get_settings),
    service: RekaVisionService = Depends(get_reka_service),
):
    session_store.ensure_session(session_id, context=request.context)
    _enforce_session_analysis_rate(session_id, settings)
    analysis_context = _merge_context(
        session_store.get_context(session_id),
        request.context,
    )
    analysis = service.analyze_media_url_safely(
        request.media_url,
        "image",
        analysis_context,
    )
    record = session_store.add_alert(session_id, analysis)
    return _session_response(session_id, analysis, record)


@router.post("/session/{session_id}/analyze/video", response_model=SessionAnalyzeResponse)
async def analyze_session_video(
    session_id: str,
    video: UploadFile = File(...),
    context: str | None = Form(default=None),
    alert_cooldown_seconds: int | None = Form(default=None),
    settings: Settings = Depends(get_settings),
    service: RekaVisionService = Depends(get_reka_service),
):
    session_store.ensure_session(
        session_id,
        context=context,
        alert_cooldown_seconds=alert_cooldown_seconds or 8,
    )
    _enforce_session_analysis_rate(session_id, settings)
    analysis_context = _merge_context(session_store.get_context(session_id), context)
    analysis = await service.analyze_upload_safely(video, "video", analysis_context)
    record = session_store.add_alert(session_id, analysis)
    return _session_response(session_id, analysis, record)


@router.post("/session/{session_id}/analyze/video-url", response_model=SessionAnalyzeResponse)
def analyze_session_video_url(
    session_id: str,
    request: MediaUrlRequest,
    settings: Settings = Depends(get_settings),
    service: RekaVisionService = Depends(get_reka_service),
):
    session_store.ensure_session(session_id, context=request.context)
    _enforce_session_analysis_rate(session_id, settings)
    analysis_context = _merge_context(
        session_store.get_context(session_id),
        request.context,
    )
    analysis = service.analyze_media_url_safely(
        request.media_url,
        "video",
        analysis_context,
    )
    record = session_store.add_alert(session_id, analysis)
    return _session_response(session_id, analysis, record)


@router.post("/media/chunk", response_model=MediaChunkResponse)
async def upload_media_chunk(
    file: UploadFile = File(...),
    session_id: str = Form(...),
    sequence: int = Form(...),
    captured_at: str = Form(...),
    capture_mode: str = Form(...),
    settings: Settings = Depends(get_settings),
):
    if capture_mode != CAPTURE_MODE_VIDEO_CHUNK:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported capture_mode: {capture_mode}",
        )

    content = await file.read()
    if len(content) == 0:
        raise HTTPException(status_code=400, detail="Empty chunk")

    if len(content) > settings.max_chunk_bytes:
        raise HTTPException(
            status_code=413,
            detail=f"Chunk is too large. Limit is {settings.max_chunk_bytes} bytes.",
        )

    return media_chunk_store.add_chunk(
        session_id=session_id,
        sequence=sequence,
        captured_at=captured_at,
        content_type=file.content_type or "",
        contents=content,
    )


@router.get("/media/session/{session_id}/chunks", response_model=MediaChunkStatusResponse)
def get_media_chunk_status(session_id: str):
    return media_chunk_store.status(session_id)


@router.post("/media/session/{session_id}/analyze", response_model=SessionAnalyzeResponse)
def analyze_reconstructed_media(
    session_id: str,
    context: str | None = Form(default=None),
    settings: Settings = Depends(get_settings),
    service: RekaVisionService = Depends(get_reka_service),
):
    _enforce_session_analysis_rate(session_id, settings)
    contents, content_type = media_chunk_store.reconstruct(session_id)
    if not contents:
        raise HTTPException(status_code=400, detail="No contiguous media chunks found.")

    analysis_context = _merge_context(session_store.get_context(session_id), context)
    analysis = service.analyze_bytes_safely(
        contents=contents,
        content_type=content_type,
        source_type="video",
        context=analysis_context,
    )
    record = session_store.add_alert(session_id, analysis)
    return _session_response(session_id, analysis, record)


def _merge_context(session_context: str | None, request_context: str | None) -> str | None:
    contexts = [context for context in [session_context, request_context] if context]
    return " ".join(contexts) if contexts else None


def _enforce_session_analysis_rate(session_id: str, settings: Settings) -> None:
    session_store.enforce_analysis_rate(
        session_id=session_id,
        min_interval_seconds=settings.min_analysis_interval_seconds,
        max_per_minute=settings.max_session_analyses_per_minute,
    )


def _session_response(
    session_id: str,
    analysis: AnalyzeResponse,
    record,
) -> SessionAnalyzeResponse:
    return SessionAnalyzeResponse(
        source_type=analysis.source_type,
        alert=analysis.alert,
        timeline=analysis.timeline,
        raw_model_text=analysis.raw_model_text,
        analysis_mode=analysis.analysis_mode,
        session_id=session_id,
        alert_id=record.alert_id,
        should_speak=record.should_speak,
        suppressed_reason=record.suppressed_reason,
    )
