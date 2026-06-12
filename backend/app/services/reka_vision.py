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

BLOCKED_PATH_KEYWORDS = {
    "obstacle",
    "wall",
    "barrier",
    "blocked path",
    "blocked sidewalk",
    "closed door",
    "door",
    "gate",
    "pole",
    "bollard",
    "bin",
    "chair",
    "table",
    "curb",
    "stairs",
    "stair",
    "drop",
    "fence",
    "construction",
    "glass",
}

STATIC_OBSTACLE_KEYWORDS = {
    "obstacle",
    "wall",
    "barrier",
    "blocked path",
    "blocked sidewalk",
    "closed door",
    "door",
    "gate",
    "pole",
    "bollard",
    "bin",
    "chair",
    "table",
    "fence",
    "construction",
    "glass",
}

GENERIC_OBJECT_LABELS = {
    "obstacle",
    "hazard",
    "object",
    "blocked path",
    "blocked sidewalk",
}

TRAFFIC_KEYWORDS = {
    "car",
    "bus",
    "taxi",
    "truck",
    "vehicle",
    "traffic",
    "cyclist",
    "bike",
    "bicycle",
    "motorcycle",
}

DIRECTION_KEYWORDS = {
    "upper_left": ["upper left", "top left"],
    "upper_right": ["upper right", "top right"],
    "lower_left": ["lower left", "bottom left"],
    "lower_right": ["lower right", "bottom right"],
    "center_left": ["center left", "slightly left", "just left"],
    "center_right": ["center right", "slightly right", "just right"],
    "left": ["left"],
    "right": ["right"],
    "center": ["ahead", "front", "center", "straight ahead"],
}


SYSTEM_PROMPT = """
You are AuraHear, an assistive vision safety system for blind pedestrians.
Analyze the supplied image or short video for immediate physical danger.
Prioritize hazards that require action in the next 1-5 seconds: moving vehicles,
cyclists, obstacles, stairs, drops, construction, wet floors, crowds, blocked paths,
traffic signals, and people approaching quickly.
Pay special attention to static obstacles directly ahead in the walking path:
walls, closed doors, poles, bollards, bins, chairs, tables, barriers, curbs,
glass panels, and low obstacles. If the direct path appears blocked within the
next 1-2 steps, return at least medium danger. If collision appears imminent,
recommend stopping immediately.

Return only valid JSON with this exact shape:
{
  "danger_level": "none|low|medium|high|critical",
  "confidence": 0.0,
  "summary": "brief scene summary",
  "spoken_alert": "short phrase suitable for text-to-speech",
  "recommended_action": "specific immediate action",
  "direction_hint": "left|center_left|center|center_right|right|upper_left|upper_right|lower_left|lower_right|unknown",
  "proximity_hint": "immediate|near|ahead|clear|unknown",
  "hazards": ["hazard 1"],
  "safe_path": "where the user can move safely, or null",
  "detected_objects": ["object 1"]
}
Use orthogonal phrasing like left, right, or center. Avoid clock-face directions.
Keep spoken_alert under 14 words. Do not mention uncertainty unless it affects safety.
Prefer a brief action in spoken_alert when useful, for example:
"Obstacle left. Veer right." or "Obstacle ahead. Slow down."
If a specific obstacle is identifiable, keep its name in the alert, for example:
"Chair left. Veer right." or "Closed door ahead. Stop."
In recommended_action, give a concise maneuver suggestion such as veer slightly right,
sidestep left, stay centered, or stop and rescan. Do not invent exact step counts or
exact meter distances unless they are visually obvious.
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
        "user's direct path in the next 2-3 seconds or roughly the next 1-2 steps. "
        "Prioritize close blocked-path "
        "obstacles such as walls, closed doors, poles, bollards, bins, chairs, "
        "tables, barriers, curbs, stairs, and drops."
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
        alert = HazardAlert.model_validate(_normalize_payload(payload))
    except ValidationError as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Reka returned invalid safety fields: {exc.errors()}",
        ) from exc

    return _apply_blocked_path_guardrails(alert)


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


def _apply_blocked_path_guardrails(alert: HazardAlert) -> HazardAlert:
    combined_text = _alert_text(alert)
    mentions_blocked_path = any(
        keyword in combined_text
        for keyword in BLOCKED_PATH_KEYWORDS
    )

    direction_hint = _resolve_direction_hint(alert, combined_text)
    proximity_hint = _resolve_proximity_hint(alert, combined_text)

    updated_fields: dict[str, Any] = {
        "danger_level": alert.danger_level,
        "confidence": alert.confidence,
        "summary": alert.summary,
        "spoken_alert": alert.spoken_alert,
        "recommended_action": alert.recommended_action,
        "direction_hint": direction_hint,
        "proximity_hint": proximity_hint,
        "hazards": list(alert.hazards),
        "safe_path": alert.safe_path,
        "detected_objects": list(alert.detected_objects),
    }

    if not mentions_blocked_path:
        return HazardAlert.model_validate(updated_fields)

    if alert.danger_level in {"none", "low"}:
        updated_fields["danger_level"] = "medium"
        updated_fields["confidence"] = max(alert.confidence, 0.6)

    if any(keyword in combined_text for keyword in STATIC_OBSTACLE_KEYWORDS):
        obstacle_label = _primary_obstacle_label(alert, combined_text)
        updated_fields["spoken_alert"] = _build_obstacle_spoken_alert(
            obstacle_label,
            direction_hint,
            proximity_hint,
            alert.safe_path,
        )
        updated_fields["recommended_action"] = _build_obstacle_action(
            obstacle_label,
            direction_hint,
            proximity_hint,
            alert.safe_path,
        )

    return HazardAlert.model_validate(updated_fields)


def _alert_text(alert: HazardAlert) -> str:
    return " ".join(
        [
            alert.summary,
            alert.spoken_alert,
            alert.recommended_action,
            *alert.hazards,
            *alert.detected_objects,
            alert.safe_path or "",
            alert.direction_hint,
            alert.proximity_hint,
        ]
    ).lower()


def _resolve_direction_hint(alert: HazardAlert, combined_text: str) -> str:
    if alert.direction_hint != "unknown":
        return alert.direction_hint

    for direction_hint, phrases in DIRECTION_KEYWORDS.items():
        if any(phrase in combined_text for phrase in phrases):
            return direction_hint

    return "unknown"


def _resolve_proximity_hint(alert: HazardAlert, combined_text: str) -> str:
    if alert.proximity_hint != "unknown":
        return alert.proximity_hint

    if alert.danger_level == "none" and not alert.hazards:
        return "clear"

    if any(
        phrase in combined_text
        for phrase in [
            "imminent",
            "immediately",
            "right ahead",
            "directly ahead",
            "very close",
            "about to hit",
        ]
    ):
        return "immediate"

    if alert.danger_level in {"high", "critical"}:
        return "immediate"

    if alert.danger_level == "medium":
        return "near"

    if alert.hazards or alert.detected_objects:
        return "ahead"

    return "unknown"


def _primary_obstacle_label(alert: HazardAlert, combined_text: str) -> str:
    candidates = [
        *alert.detected_objects,
        *alert.hazards,
    ]

    for candidate in candidates:
        normalized = str(candidate).strip().lower()
        if (
            normalized
            and normalized in STATIC_OBSTACLE_KEYWORDS
            and normalized not in GENERIC_OBJECT_LABELS
            and normalized not in TRAFFIC_KEYWORDS
        ):
            return normalized

    for keyword in STATIC_OBSTACLE_KEYWORDS:
        if keyword in combined_text and keyword not in GENERIC_OBJECT_LABELS:
            return keyword

    return "obstacle"


def _build_obstacle_spoken_alert(
    obstacle_label: str,
    direction_hint: str,
    proximity_hint: str,
    safe_path: str | None,
) -> str:
    direction_phrase = _direction_phrase(direction_hint)
    clear_side = _preferred_clear_side(safe_path) or _opposite_side(direction_hint)
    action_phrase = _short_avoidance_phrase(clear_side, proximity_hint)
    subject = _spoken_object_label(obstacle_label)
    return f"{subject} {direction_phrase}. {action_phrase}"


def _build_obstacle_action(
    obstacle_label: str,
    direction_hint: str,
    proximity_hint: str,
    safe_path: str | None,
) -> str:
    clear_side = _preferred_clear_side(safe_path) or _opposite_side(direction_hint)
    obstacle_phrase = _action_object_label(obstacle_label)
    urgent_movement_hint = _movement_hint(clear_side, direction_hint, immediate=True)
    steady_movement_hint = _movement_hint(clear_side, direction_hint, immediate=False)

    if clear_side == "right":
        return (
            f"{steady_movement_hint} and continue cautiously past the {obstacle_phrase}."
            if proximity_hint != "immediate"
            else f"{urgent_movement_hint} now and slow down until clear of the {obstacle_phrase}."
        )

    if clear_side == "left":
        return (
            f"{steady_movement_hint} and continue cautiously past the {obstacle_phrase}."
            if proximity_hint != "immediate"
            else f"{urgent_movement_hint} now and slow down until clear of the {obstacle_phrase}."
        )

    if proximity_hint == "immediate":
        return f"Stop before the {obstacle_phrase} and rescan for a clear side."

    return (
        f"Slow down, keep the {obstacle_phrase} in mind, and rescan for a clear side."
    )


def _spoken_object_label(obstacle_label: str) -> str:
    if obstacle_label == "obstacle":
        return "Obstacle"
    return obstacle_label.capitalize()


def _action_object_label(obstacle_label: str) -> str:
    return obstacle_label if obstacle_label != "obstacle" else "obstacle"


def _direction_phrase(direction_hint: str) -> str:
    mapping = {
        "left": "left",
        "center_left": "slightly left",
        "center": "ahead",
        "center_right": "slightly right",
        "right": "right",
        "upper_left": "upper left",
        "upper_right": "upper right",
        "lower_left": "lower left",
        "lower_right": "lower right",
        "unknown": "ahead",
    }
    return mapping.get(direction_hint, "ahead")


def _short_avoidance_phrase(clear_side: str | None, proximity_hint: str) -> str:
    if proximity_hint == "immediate":
        if clear_side == "right":
            return "Veer right now."
        if clear_side == "left":
            return "Veer left now."
        return "Stop now."

    if clear_side == "right":
        return "Veer right."
    if clear_side == "left":
        return "Veer left."
    return "Slow down."


def _movement_hint(clear_side: str | None, direction_hint: str, *, immediate: bool) -> str:
    if clear_side == "right":
        if immediate:
            return "Veer right"
        if direction_hint in {"left", "center_left", "upper_left", "lower_left"}:
            return "Keep right"
        return "Veer slightly right"

    if clear_side == "left":
        if immediate:
            return "Veer left"
        if direction_hint in {"right", "center_right", "upper_right", "lower_right"}:
            return "Keep left"
        return "Veer slightly left"

    return "Slow down"


def _preferred_clear_side(safe_path: str | None) -> str | None:
    if not safe_path:
        return None

    normalized = safe_path.lower()
    if "right" in normalized:
        return "right"
    if "left" in normalized:
        return "left"
    return None


def _opposite_side(direction_hint: str) -> str | None:
    if direction_hint in {"left", "center_left", "upper_left", "lower_left"}:
        return "right"
    if direction_hint in {"right", "center_right", "upper_right", "lower_right"}:
        return "left"
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
            direction_hint=winning_alert.direction_hint,
            proximity_hint=winning_alert.proximity_hint,
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
        direction_hint=alert.direction_hint,
        proximity_hint=alert.proximity_hint,
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
    payload.setdefault("direction_hint", "unknown")
    payload.setdefault("proximity_hint", "unknown")
    payload.setdefault("hazards", [])
    payload.setdefault("detected_objects", [])
    payload.setdefault("safe_path", None)
    payload["confidence"] = _clamp_confidence(payload["confidence"])
    payload["direction_hint"] = _normalize_direction_hint(payload["direction_hint"])
    payload["proximity_hint"] = _normalize_proximity_hint(payload["proximity_hint"])
    payload["hazards"] = _string_list(payload["hazards"])
    payload["detected_objects"] = _string_list(payload["detected_objects"])
    return payload


def _clamp_confidence(value: Any) -> float:
    try:
        confidence = float(value)
    except (TypeError, ValueError):
        return 0.0
    return max(0.0, min(1.0, confidence))


def _normalize_direction_hint(value: Any) -> str:
    normalized = str(value).strip().lower().replace("-", "_").replace(" ", "_")
    synonyms = {
        "slight_left": "center_left",
        "slightly_left": "center_left",
        "slight_right": "center_right",
        "slightly_right": "center_right",
        "ahead": "center",
        "front": "center",
        "straight_ahead": "center",
        "top_left": "upper_left",
        "top_right": "upper_right",
        "bottom_left": "lower_left",
        "bottom_right": "lower_right",
    }
    normalized = synonyms.get(normalized, normalized)
    if normalized in {
        "left",
        "center_left",
        "center",
        "center_right",
        "right",
        "upper_left",
        "upper_right",
        "lower_left",
        "lower_right",
    }:
        return normalized
    return "unknown"


def _normalize_proximity_hint(value: Any) -> str:
    normalized = str(value).strip().lower().replace("-", "_").replace(" ", "_")
    synonyms = {
        "very_close": "immediate",
        "close": "near",
        "nearby": "near",
        "soon": "ahead",
        "safe": "clear",
    }
    normalized = synonyms.get(normalized, normalized)
    if normalized in {"immediate", "near", "ahead", "clear"}:
        return normalized
    return "unknown"


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
