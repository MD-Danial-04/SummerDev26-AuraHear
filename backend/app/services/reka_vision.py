import base64
from dataclasses import dataclass
import json
from pathlib import Path
import shutil
import subprocess
import tempfile
from typing import Any, Literal

from fastapi import HTTPException, UploadFile, status
from openai import OpenAI
from pydantic import ValidationError

from app.config import Settings
from app.models import AnalyzeResponse, HazardAlert, VideoTimelineItem


IMAGE_TYPES = {"image/jpeg", "image/png", "image/webp"}
VIDEO_TYPES = {"video/mp4", "video/webm", "video/quicktime"}
IMAGE_OUTPUT_TYPE = "image/jpeg"

DANGER_RANK = {
    "none": 0,
    "low": 1,
    "medium": 2,
    "high": 3,
    "critical": 4,
}

ACTION_PRIORITY = {
    "continue": 1,
    "prepare": 2,
    "slow": 3,
    "caution": 3,
    "stop": 4,
    "wait": 4,
    "hold": 4,
    "turn back": 5,
    "move back": 5,
}


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
Do not wrap the JSON in markdown fences or add any explanation before or after it.
""".strip()

REPAIR_SYSTEM_PROMPT = """
You convert safety-analysis text into strict JSON for AuraHear.
Return only valid JSON with the exact required fields.
If the original text is vague or incomplete, infer conservatively for pedestrian safety.
Do not add markdown fences or commentary.
""".strip()


class RekaResponseError(HTTPException):
    def __init__(
        self,
        *,
        status_code: int,
        detail: Any,
        raw_model_text: str | None = None,
    ) -> None:
        super().__init__(status_code=status_code, detail=detail)
        self.raw_model_text = raw_model_text


@dataclass(frozen=True)
class ExtractedVideoFrame:
    timestamp_seconds: float
    content_type: str
    contents: bytes


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
        contents = await upload.read()
        return self.analyze_bytes(contents, content_type, source_type, context)

    def analyze_bytes(
        self,
        contents: bytes,
        content_type: str,
        source_type: Literal["image", "video"],
        context: str | None = None,
    ) -> AnalyzeResponse:
        allowed_types = IMAGE_TYPES if source_type == "image" else VIDEO_TYPES

        if content_type not in allowed_types:
            raise HTTPException(
                status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
                detail=f"Unsupported {source_type} content type: {content_type}",
            )

        if not contents:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Uploaded file is empty.",
            )

        if len(contents) > self.settings.max_upload_bytes:
            raise HTTPException(
                status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                detail=(
                    f"Uploaded {source_type} is too large. "
                    f"Limit is {self.settings.max_upload_bytes} bytes."
                ),
            )

        if source_type == "video":
            if shutil.which("ffmpeg") and shutil.which("ffprobe"):
                return self._analyze_video_bytes(contents, content_type, context)
            media_url = _to_data_url(content_type, contents)
            return self.analyze_media_url(media_url, source_type, context)

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
            return _fallback_analysis(
                source_type,
                exc.detail,
                raw_model_text=getattr(exc, "raw_model_text", None),
            )

    def analyze_bytes_safely(
        self,
        contents: bytes,
        content_type: str,
        source_type: Literal["image", "video"],
        context: str | None = None,
    ) -> AnalyzeResponse:
        try:
            return self.analyze_bytes(contents, content_type, source_type, context)
        except HTTPException as exc:
            if exc.status_code < 500:
                raise
            return _fallback_analysis(
                source_type,
                exc.detail,
                raw_model_text=getattr(exc, "raw_model_text", None),
            )

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

        raw_text = _response_text(response.choices[0].message.content)
        try:
            alert = _parse_alert(raw_text)
        except HTTPException as exc:
            repaired_text = self._repair_analysis_text(raw_text, source_type)
            if repaired_text:
                try:
                    alert = _parse_alert(repaired_text)
                except HTTPException:
                    pass
                else:
                    return AnalyzeResponse(
                        source_type=source_type,
                        alert=alert,
                        raw_model_text=repaired_text,
                    )

            raise RekaResponseError(
                status_code=exc.status_code,
                detail=exc.detail,
                raw_model_text=raw_text,
            ) from exc

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
            return _fallback_analysis(
                source_type,
                exc.detail,
                raw_model_text=getattr(exc, "raw_model_text", None),
            )

    def _analyze_video_bytes(
        self,
        contents: bytes,
        content_type: str,
        context: str | None = None,
    ) -> AnalyzeResponse:
        frames = self._extract_video_frames(contents, content_type)
        frame_results: list[tuple[ExtractedVideoFrame, AnalyzeResponse]] = []

        for frame in frames:
            analysis = self._analyze_extracted_frame(
                frame,
                _frame_context(context, frame.timestamp_seconds),
            )
            frame_results.append((frame, analysis))

        if not frame_results:
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail="No frames could be analyzed from the uploaded video.",
            )

        return _merge_frame_analyses(frame_results)

    def _analyze_extracted_frame(
        self,
        frame: ExtractedVideoFrame,
        context: str | None = None,
    ) -> AnalyzeResponse:
        return self.analyze_bytes(frame.contents, frame.content_type, "image", context)

    def _extract_video_frames(
        self,
        contents: bytes,
        content_type: str,
    ) -> list[ExtractedVideoFrame]:
        if shutil.which("ffmpeg") is None or shutil.which("ffprobe") is None:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="ffmpeg and ffprobe are required for video frame analysis.",
            )

        suffix = _video_suffix(content_type)

        with tempfile.TemporaryDirectory(prefix="aurah-video-") as temp_dir:
            temp_path = Path(temp_dir)
            input_path = temp_path / f"input{suffix}"
            input_path.write_bytes(contents)

            duration = _probe_duration(input_path)
            timestamps = _sample_timestamps(duration)
            frames: list[ExtractedVideoFrame] = []

            for index, timestamp_seconds in enumerate(timestamps):
                frame_path = temp_path / f"frame-{index}.jpg"
                command = [
                    "ffmpeg",
                    "-hide_banner",
                    "-loglevel",
                    "error",
                    "-y",
                    "-ss",
                    f"{timestamp_seconds:.3f}",
                    "-i",
                    str(input_path),
                    "-frames:v",
                    "1",
                    "-q:v",
                    "3",
                    str(frame_path),
                ]

                try:
                    subprocess.run(
                        command,
                        check=True,
                        capture_output=True,
                        text=True,
                    )
                except subprocess.CalledProcessError as exc:
                    error_output = exc.stderr.strip() or exc.stdout.strip() or str(exc)
                    raise HTTPException(
                        status_code=status.HTTP_502_BAD_GATEWAY,
                        detail=f"Video frame extraction failed: {error_output}",
                    ) from exc

                if not frame_path.exists():
                    continue

                frame_bytes = frame_path.read_bytes()
                if not frame_bytes:
                    continue

                frames.append(
                    ExtractedVideoFrame(
                        timestamp_seconds=timestamp_seconds,
                        content_type=IMAGE_OUTPUT_TYPE,
                        contents=frame_bytes,
                    )
                )

        if frames:
            return frames

        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Could not extract frames from uploaded video.",
        )

    def _repair_analysis_text(
        self,
        raw_text: str,
        source_type: Literal["image", "video"],
    ) -> str | None:
        if not self.client or not raw_text.strip():
            return None

        repair_prompt = (
            f"Convert this {source_type} safety analysis into the required JSON object.\n\n"
            f"{raw_text}"
        )

        try:
            response = self.client.chat.completions.create(
                model=self.settings.reka_model,
                temperature=0,
                messages=[
                    {"role": "system", "content": REPAIR_SYSTEM_PROMPT},
                    {"role": "user", "content": repair_prompt},
                ],
            )
        except Exception:
            return None

        return _response_text(response.choices[0].message.content)


def _build_user_prompt(source_type: str, context: str | None) -> str:
    prompt = (
        f"Analyze this {source_type} for immediate navigation hazards affecting the "
        "user's direct path in the next 2-3 seconds."
    )
    if context:
        prompt += f" User context: {context}"
    return prompt


def _to_data_url(content_type: str, contents: bytes) -> str:
    encoded = base64.b64encode(contents).decode("ascii")
    return f"data:{content_type};base64,{encoded}"


def _parse_alert(raw_text: str) -> HazardAlert:
    try:
        payload = _extract_json_payload(raw_text)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Reka returned a non-JSON safety analysis.",
        ) from exc

    if not isinstance(payload, dict):
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Reka returned JSON that was not an object.",
        )

    try:
        return HazardAlert.model_validate(_normalize_payload(payload))
    except ValidationError as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Reka returned invalid safety fields: {exc.errors()}",
        ) from exc


def _strip_code_fence(raw_text: str) -> str:
    stripped = raw_text.strip()
    if stripped.startswith("```json"):
        return stripped.removeprefix("```json").removesuffix("```").strip()
    if stripped.startswith("```"):
        return stripped.removeprefix("```").removesuffix("```").strip()
    return stripped


def _extract_json_payload(raw_text: str) -> dict[str, Any]:
    decoder = json.JSONDecoder()

    for candidate in (_strip_code_fence(raw_text), raw_text.strip()):
        if not candidate:
            continue

        try:
            payload = json.loads(candidate)
        except json.JSONDecodeError:
            payload = _decode_first_json_object(candidate, decoder)

        if isinstance(payload, dict):
            return payload

    raise ValueError("No JSON object found in model response.")


def _decode_first_json_object(
    text: str,
    decoder: json.JSONDecoder,
) -> dict[str, Any] | None:
    for index, char in enumerate(text):
        if char != "{":
            continue

        try:
            payload, _ = decoder.raw_decode(text[index:])
        except json.JSONDecodeError:
            continue

        if isinstance(payload, dict):
            return payload

    return None


def _response_text(content: Any) -> str:
    if isinstance(content, str):
        return content

    if isinstance(content, list):
        parts: list[str] = []
        for item in content:
            if isinstance(item, str):
                parts.append(item)
                continue

            if isinstance(item, dict):
                text = item.get("text")
                if text:
                    parts.append(str(text))
                continue

            text = getattr(item, "text", None)
            if text:
                parts.append(str(text))

        return "\n".join(parts)

    if content is None:
        return ""

    return str(content)


def _video_suffix(content_type: str) -> str:
    if content_type == "video/mp4":
        return ".mp4"
    if content_type == "video/webm":
        return ".webm"
    if content_type == "video/quicktime":
        return ".mov"
    return ".bin"


def _probe_duration(video_path: Path) -> float:
    command = [
        "ffprobe",
        "-v",
        "error",
        "-show_entries",
        "format=duration",
        "-of",
        "default=noprint_wrappers=1:nokey=1",
        str(video_path),
    ]

    try:
        response = subprocess.run(
            command,
            check=True,
            capture_output=True,
            text=True,
        )
    except subprocess.CalledProcessError as exc:
        error_output = exc.stderr.strip() or exc.stdout.strip() or str(exc)
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Video duration probe failed: {error_output}",
        ) from exc

    try:
        return max(0.0, float(response.stdout.strip()))
    except ValueError:
        return 0.0


def _sample_timestamps(duration_seconds: float) -> list[float]:
    if duration_seconds <= 0.5:
        return [0.0]

    candidates = [0.0]
    if duration_seconds > 2:
        candidates.append(duration_seconds * 0.33)
    if duration_seconds > 4:
        candidates.append(duration_seconds * 0.66)
    if duration_seconds > 6:
        candidates.append(max(duration_seconds - 1.0, 0.0))
    else:
        candidates.append(duration_seconds / 2)

    ordered: list[float] = []
    seen: set[float] = set()
    for candidate in candidates:
        timestamp = round(min(max(candidate, 0.0), max(duration_seconds - 0.05, 0.0)), 2)
        if timestamp in seen:
            continue
        seen.add(timestamp)
        ordered.append(timestamp)

    return ordered or [0.0]


def _frame_context(context: str | None, timestamp_seconds: float) -> str:
    parts = []
    if context:
        parts.append(context)
    parts.append(
        f"This frame was sampled around {timestamp_seconds:.1f} seconds into a short video."
    )
    return " ".join(parts)


def _merge_frame_analyses(
    frame_results: list[tuple[ExtractedVideoFrame, AnalyzeResponse]],
) -> AnalyzeResponse:
    ordered_results = sorted(frame_results, key=lambda item: item[0].timestamp_seconds)
    timeline = [
        _timeline_item(frame, analysis)
        for frame, analysis in ordered_results
    ]

    winning_frame, winning_analysis = max(ordered_results, key=_headline_result_rank)
    winning_alert = winning_analysis.alert

    hazards = _unique_strings(
        [
            *winning_alert.hazards,
            *_persistent_strings(
                [analysis.alert.hazards for _, analysis in ordered_results]
            ),
        ]
    )
    detected_objects = _unique_strings(
        [
            *winning_alert.detected_objects,
            *_persistent_strings(
                [analysis.alert.detected_objects for _, analysis in ordered_results]
            ),
        ]
    )
    safe_path = winning_alert.safe_path or next(
        (
            analysis.alert.safe_path
            for _, analysis in reversed(ordered_results)
            if analysis.alert.safe_path
        ),
        None,
    )
    summary = winning_alert.summary
    if len(ordered_results) > 1:
        summary = (
            f"{winning_alert.summary} Most urgent sampled moment around "
            f"{winning_frame.timestamp_seconds:.1f}s."
        )

    raw_model_text = json.dumps(
        {
            "video_analysis_mode": "sampled_frames",
            "headline_timestamp_seconds": winning_frame.timestamp_seconds,
            "timeline": [
                {
                    **timeline_item.model_dump(),
                    "raw_model_text": analysis.raw_model_text,
                }
                for timeline_item, (_, analysis) in zip(
                    timeline,
                    ordered_results,
                    strict=False,
                )
            ],
        },
        indent=2,
    )

    return AnalyzeResponse(
        source_type="video",
        alert=HazardAlert(
            danger_level=winning_alert.danger_level,
            confidence=winning_alert.confidence,
            summary=summary,
            spoken_alert=winning_alert.spoken_alert,
            recommended_action=winning_alert.recommended_action,
            hazards=hazards,
            safe_path=safe_path,
            detected_objects=detected_objects,
        ),
        timeline=timeline,
        raw_model_text=raw_model_text,
    )


def _headline_result_rank(
    frame_result: tuple[ExtractedVideoFrame, AnalyzeResponse],
) -> tuple[int, int, float, float]:
    frame, analysis = frame_result
    alert = analysis.alert
    return (
        DANGER_RANK.get(alert.danger_level, 0),
        _action_priority_score(alert.recommended_action, alert.spoken_alert),
        alert.confidence,
        frame.timestamp_seconds,
    )


def _timeline_item(
    frame: ExtractedVideoFrame,
    analysis: AnalyzeResponse,
) -> VideoTimelineItem:
    alert = analysis.alert
    return VideoTimelineItem(
        timestamp_seconds=frame.timestamp_seconds,
        danger_level=alert.danger_level,
        confidence=alert.confidence,
        summary=alert.summary,
        spoken_alert=alert.spoken_alert,
        recommended_action=alert.recommended_action,
        hazards=alert.hazards,
        safe_path=alert.safe_path,
        detected_objects=alert.detected_objects,
    )


def _action_priority_score(*texts: str | None) -> int:
    combined = " ".join(text.lower() for text in texts if text)
    best_score = 0
    for phrase, score in ACTION_PRIORITY.items():
        if phrase in combined and score > best_score:
            best_score = score
    return best_score


def _persistent_strings(
    value_groups: list[list[str]],
    minimum_count: int = 2,
) -> list[str]:
    counts: dict[str, int] = {}
    originals: dict[str, str] = {}

    for group in value_groups:
        frame_seen: set[str] = set()
        for value in group:
            normalized = str(value).strip()
            if not normalized:
                continue

            key = normalized.lower()
            if key in frame_seen:
                continue

            frame_seen.add(key)
            counts[key] = counts.get(key, 0) + 1
            originals.setdefault(key, normalized)

    return [
        originals[key]
        for key, count in counts.items()
        if count >= minimum_count
    ]


def _normalize_payload(payload: dict[str, Any]) -> dict[str, Any]:
    payload.setdefault("danger_level", "medium")
    payload.setdefault("confidence", 0.0)
    payload.setdefault("summary", "Scene analysis was incomplete.")
    payload.setdefault("spoken_alert", "Slow down and rescan.")
    payload.setdefault("recommended_action", "Slow down, hold position, and scan again.")
    payload.setdefault("hazards", [])
    payload.setdefault("detected_objects", [])
    payload.setdefault("safe_path", None)
    payload["confidence"] = _clamp_confidence(payload["confidence"])
    payload["hazards"] = _string_list(payload["hazards"])
    payload["detected_objects"] = _string_list(payload["detected_objects"])
    return payload


def _clamp_confidence(value: Any) -> float:
    try:
        confidence = float(value)
    except (TypeError, ValueError):
        return 0.0
    return max(0.0, min(1.0, confidence))


def _string_list(value: Any) -> list[str]:
    if value is None:
        return []
    if isinstance(value, list):
        return [str(item) for item in value if item is not None]
    return [str(value)]


def _unique_strings(values) -> list[str]:
    seen: set[str] = set()
    result: list[str] = []
    for value in values:
        normalized = str(value).strip()
        if not normalized:
            continue
        key = normalized.lower()
        if key in seen:
            continue
        seen.add(key)
        result.append(normalized)
    return result


def _fallback_analysis(
    source_type: Literal["image", "video"],
    reason: Any,
    raw_model_text: str | None = None,
) -> AnalyzeResponse:
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
        raw_model_text=raw_model_text,
        analysis_mode="fallback",
    )
