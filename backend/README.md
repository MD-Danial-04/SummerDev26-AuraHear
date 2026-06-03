# AuraHear Backend

FastAPI backend for AuraHear's Reka-powered assistive safety analysis.

## Setup

```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
export REKA_API_KEY=your_reka_api_key
python main.py
```

On Windows PowerShell:

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
$env:REKA_API_KEY="your_reka_api_key"
python main.py
```

API runs at http://localhost:8000.

## Environment

- `REKA_API_KEY`: required for Reka analysis
- `REKA_MODEL`: defaults to `reka-flash`
- `REKA_BASE_URL`: defaults to `https://api.reka.ai/v1`
- `CORS_ORIGINS`: comma-separated frontend origins, defaults to `http://localhost:5173`

## Health

- `GET /api/health`: returns backend status

## One-Off Analysis

- `POST /api/analyze/frame`: multipart form with `frame` image file and optional `context`
- `POST /api/analyze/video`: multipart form with `video` short video file and optional `context`
- `POST /api/analyze/frame-url`: JSON body with `media_url` and optional `context`
- `POST /api/analyze/video-url`: JSON body with `media_url` and optional `context`

Analysis responses include:

- `danger_level`: `none`, `low`, `medium`, `high`, or `critical`
- `confidence`
- `summary`
- `spoken_alert`
- `recommended_action`
- `hazards`
- `safe_path`
- `detected_objects`

## Session Analysis

Use sessions for repeated camera checks and alert cooldown.

- `POST /api/session/start`: starts a walking session with optional `context` and `alert_cooldown_seconds`
- `POST /api/session/{session_id}/analyze/frame`: analyzes a frame, stores the alert, and returns `should_speak`
- `POST /api/session/{session_id}/analyze/video`: analyzes a short video, stores the alert, and returns `should_speak`
- `POST /api/session/{session_id}/analyze/frame-url`: URL version of session frame analysis
- `POST /api/session/{session_id}/analyze/video-url`: URL version of session video analysis
- `GET /api/session/{session_id}/alerts`: returns stored alert history for the session

Session analysis suppresses repeated spoken alerts during the cooldown window.
If Reka is unavailable, the backend returns a conservative fallback warning telling the user to stop and rescan.

## Media Chunks

- `POST /api/media/chunk`: accepts video chunks with `session_id`, `sequence`, `captured_at`, and `capture_mode=video_chunk`

This endpoint currently validates and acknowledges chunks. It does not reconstruct long streams yet.
