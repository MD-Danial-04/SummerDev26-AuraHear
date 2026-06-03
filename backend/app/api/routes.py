from fastapi import APIRouter, File, Form, HTTPException, UploadFile

router = APIRouter()

CAPTURE_MODE_VIDEO_CHUNK = "video_chunk"


@router.get("/health")
def health():
    return {"status": "ok"}


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
