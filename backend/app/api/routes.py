from fastapi import APIRouter, Depends, File, Form, UploadFile

from app.config import Settings, get_settings
from app.models import AnalyzeResponse, MediaUrlRequest
from app.services.reka_vision import RekaVisionService

router = APIRouter()


@router.get("/health")
def health():
    return {"status": "ok"}


def get_reka_service(settings: Settings = Depends(get_settings)) -> RekaVisionService:
    return RekaVisionService(settings)


@router.post("/analyze/frame", response_model=AnalyzeResponse)
async def analyze_frame(
    frame: UploadFile = File(...),
    context: str | None = Form(default=None),
    service: RekaVisionService = Depends(get_reka_service),
):
    return await service.analyze_upload(frame, "image", context)


@router.post("/analyze/frame-url", response_model=AnalyzeResponse)
def analyze_frame_url(
    request: MediaUrlRequest,
    service: RekaVisionService = Depends(get_reka_service),
):
    return service.analyze_media_url(request.media_url, "image", request.context)


@router.post("/analyze/video", response_model=AnalyzeResponse)
async def analyze_video(
    video: UploadFile = File(...),
    context: str | None = Form(default=None),
    service: RekaVisionService = Depends(get_reka_service),
):
    return await service.analyze_upload(video, "video", context)


@router.post("/analyze/video-url", response_model=AnalyzeResponse)
def analyze_video_url(
    request: MediaUrlRequest,
    service: RekaVisionService = Depends(get_reka_service),
):
    return service.analyze_media_url(request.media_url, "video", request.context)
