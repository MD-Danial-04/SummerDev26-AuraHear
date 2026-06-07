import base64
import json
from typing import Any, Literal

from fastapi import HTTPException, UploadFile, status
from openai import OpenAI

from app.config import Settings
from app.models import AnalyzeResponse, HazardAlert


IMAGE_TYPES = {"image/jpeg", "image/png", "image/webp"}
VIDEO_TYPES = {"video/mp4", "video/webm", "video/quicktime"}


SYSTEM_PROMPT = """
You are AuraHear, an assistive vision safety system for blind pedestrians.
Analyze the supplied image or short video for immediate physical danger.
Prioritize hazards that require action in the next 1-5 seconds: moving vehicles,
cyclists, obstacles, stairs, drops, construction, wet floors, crowds, blocked paths,
traffic signals, and people approaching quickly.

Return only valid JSON with this exact shape:
{
  "danger_level": "none|low|medium|high|critical",
  "confidence": 0.0,
  "summary": "brief scene summary",
  "spoken_alert": "short phrase suitable for text-to-speech",
  "recommended_action": "specific immediate action",
  "hazards": ["hazard 1"],
  "safe_path": "where the user can move safely, or null",
  "detected_objects": ["object 1"]
}
Keep spoken_alert under 14 words. Do not mention uncertainty unless it affects safety.
If the scene is unclear, be conservative and recommend slowing or stopping.
""".strip()


class RekaVisionService:
    def __init__(self, settings: Settings) -> None:
        self.settings = settings
        self.client = (
            OpenAI(base_url=settings.reka_base_url, api_key=settings.reka_api_key)
            if settings.reka_api_key
            else None
        )

    async def analyze_upload(
        self,
        upload: UploadFile,
        source_type: Literal["image", "video"],
        context: str | None = None,
    ) -> AnalyzeResponse:
        content_type = upload.content_type or ""
        allowed_types = IMAGE_TYPES if source_type == "image" else VIDEO_TYPES

        if content_type not in allowed_types:
            raise HTTPException(
                status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
                detail=f"Unsupported {source_type} content type: {content_type}",
            )

        contents = await upload.read()
        if not contents:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Uploaded file is empty.",
            )

        media_url = _to_data_url(content_type, contents)
        return self.analyze_media_url(media_url, source_type, context)

    async def analyze_upload_safely(
        self,
        upload: UploadFile,
        source_type: Literal["image", "video"],
        context: str | None = None,
    ) -> AnalyzeResponse:
        try:
            return await self.analyze_upload(upload, source_type, context)
        except HTTPException as exc:
            if exc.status_code < 500:
                raise
            return _fallback_analysis(source_type, exc.detail)

    def analyze_media_url(
        self,
        media_url: str,
        source_type: Literal["image", "video"],
        context: str | None = None,
    ) -> AnalyzeResponse:
        if not self.client:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="REKA_API_KEY is not configured on the backend.",
            )

        user_prompt = _build_user_prompt(source_type, context)
        media_content = (
            {"type": "image_url", "image_url": {"url": media_url}}
            if source_type == "image"
            else {"type": "video_url", "video_url": media_url}
        )

        try:
            response = self.client.chat.completions.create(
                model=self.settings.reka_model,
                temperature=0.1,
                messages=[
                    {"role": "system", "content": SYSTEM_PROMPT},
                    {
                        "role": "user",
                        "content": [
                            media_content,
                            {"type": "text", "text": user_prompt},
                        ],
                    },
                ],
            )
        except Exception as exc:
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail=f"Reka analysis failed: {exc}",
            ) from exc

        raw_text = response.choices[0].message.content or ""
        alert = _parse_alert(raw_text)
        return AnalyzeResponse(
            source_type=source_type,
            alert=alert,
            raw_model_text=raw_text,
        )

    def analyze_media_url_safely(
        self,
        media_url: str,
        source_type: Literal["image", "video"],
        context: str | None = None,
    ) -> AnalyzeResponse:
        try:
            return self.analyze_media_url(media_url, source_type, context)
        except HTTPException as exc:
            if exc.status_code < 500:
                raise
            return _fallback_analysis(source_type, exc.detail)


def _build_user_prompt(source_type: str, context: str | None) -> str:
    prompt = f"Analyze this {source_type} for immediate navigation hazards."
    if context:
        prompt += f" User context: {context}"
    return prompt


def _to_data_url(content_type: str, contents: bytes) -> str:
    encoded = base64.b64encode(contents).decode("ascii")
    return f"data:{content_type};base64,{encoded}"


def _parse_alert(raw_text: str) -> HazardAlert:
    try:
        payload = json.loads(_strip_code_fence(raw_text))
    except json.JSONDecodeError as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Reka returned a non-JSON safety analysis.",
        ) from exc

    return HazardAlert.model_validate(_normalize_payload(payload))


def _strip_code_fence(raw_text: str) -> str:
    stripped = raw_text.strip()
    if stripped.startswith("```json"):
        return stripped.removeprefix("```json").removesuffix("```").strip()
    if stripped.startswith("```"):
        return stripped.removeprefix("```").removesuffix("```").strip()
    return stripped


def _normalize_payload(payload: dict[str, Any]) -> dict[str, Any]:
    payload.setdefault("hazards", [])
    payload.setdefault("detected_objects", [])
    payload.setdefault("safe_path", None)
    return payload


def _fallback_analysis(source_type: Literal["image", "video"], reason: Any) -> AnalyzeResponse:
    return AnalyzeResponse(
        source_type=source_type,
        alert=HazardAlert(
            danger_level="medium",
            confidence=0.2,
            summary=f"Vision analysis is unavailable: {reason}",
            spoken_alert="Analysis unavailable. Stop and rescan.",
            recommended_action="Stop walking, hold position, and capture another frame.",
            hazards=["vision analysis unavailable"],
            safe_path=None,
            detected_objects=[],
        ),
        raw_model_text=None,
    )
