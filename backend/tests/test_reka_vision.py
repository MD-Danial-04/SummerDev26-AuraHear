import unittest
from unittest.mock import patch

from fastapi import HTTPException

from app.models import AnalyzeResponse, HazardAlert
from app.config import Settings
from app.services.reka_vision import (
    ExtractedVideoFrame,
    RekaVisionService,
    _parse_alert,
)


class RekaVisionTests(unittest.TestCase):
    def test_parse_alert_fills_missing_optional_fields(self):
        alert = _parse_alert(
            """
            {
              "danger_level": "high",
              "confidence": 1.5,
              "summary": "A car is close.",
              "spoken_alert": "Car ahead. Stop.",
              "recommended_action": "Stop immediately."
            }
            """
        )

        self.assertEqual(alert.danger_level, "high")
        self.assertEqual(alert.confidence, 1.0)
        self.assertEqual(alert.hazards, [])
        self.assertEqual(alert.detected_objects, [])

    def test_parse_alert_accepts_json_wrapped_in_prose(self):
        alert = _parse_alert(
            """
            Here is the safety analysis:

            ```json
            {
              "danger_level": "medium",
              "confidence": 0.7,
              "summary": "A cyclist is approaching from the left.",
              "spoken_alert": "Cyclist left. Slow down.",
              "recommended_action": "Slow down and give space.",
              "hazards": ["cyclist"],
              "safe_path": "Keep slightly right.",
              "detected_objects": ["cyclist", "sidewalk"]
            }
            ```

            Responding in the requested format.
            """
        )

        self.assertEqual(alert.danger_level, "medium")
        self.assertEqual(alert.spoken_alert, "Cyclist left. Slow down.")
        self.assertEqual(alert.safe_path, "Keep slightly right.")

    def test_parse_alert_escalates_close_blocked_path_obstacles(self):
        alert = _parse_alert(
            """
            {
              "danger_level": "low",
              "confidence": 0.35,
              "summary": "A wall is directly ahead in the walking path.",
              "spoken_alert": "Wall ahead.",
              "recommended_action": "Continue carefully.",
              "hazards": ["wall"],
              "safe_path": null,
              "detected_objects": ["wall"]
            }
            """
        )

        self.assertEqual(alert.danger_level, "medium")
        self.assertGreaterEqual(alert.confidence, 0.6)
        self.assertEqual(alert.spoken_alert, "Wall ahead. Stop now.")
        self.assertEqual(
            alert.recommended_action,
            "Stop before the wall and rescan for a clear side.",
        )
        self.assertEqual(alert.direction_hint, "center")
        self.assertEqual(alert.proximity_hint, "immediate")

    def test_parse_alert_infers_directional_guidance_for_left_obstacle(self):
        alert = _parse_alert(
            """
            {
              "danger_level": "low",
              "confidence": 0.4,
              "summary": "A chair is directly ahead on the left side of the walking path.",
              "spoken_alert": "Chair left.",
              "recommended_action": "Proceed carefully.",
              "hazards": ["chair"],
              "safe_path": "Right side is clearer.",
              "detected_objects": ["chair"]
            }
            """
        )

        self.assertEqual(alert.danger_level, "medium")
        self.assertEqual(alert.direction_hint, "left")
        self.assertEqual(alert.proximity_hint, "immediate")
        self.assertEqual(alert.spoken_alert, "Chair left. Veer right now.")
        self.assertEqual(
            alert.recommended_action,
            "Veer right now and slow down until clear of the chair.",
        )

    def test_parse_alert_normalizes_model_direction_and_proximity_hints(self):
        alert = _parse_alert(
            """
            {
              "danger_level": "medium",
              "confidence": 0.8,
              "summary": "Barrier slightly right and close to the user's path.",
              "spoken_alert": "Barrier right.",
              "recommended_action": "Move away from it.",
              "direction_hint": "slightly right",
              "proximity_hint": "very close",
              "hazards": ["barrier"],
              "safe_path": "Left side is clearer.",
              "detected_objects": ["barrier"]
            }
            """
        )

        self.assertEqual(alert.direction_hint, "center_right")
        self.assertEqual(alert.proximity_hint, "immediate")
        self.assertEqual(alert.spoken_alert, "Barrier slightly right. Veer left now.")
        self.assertEqual(
            alert.recommended_action,
            "Veer left now and slow down until clear of the barrier.",
        )

    def test_parse_alert_uses_generic_obstacle_when_object_is_unspecified(self):
        alert = _parse_alert(
            """
            {
              "danger_level": "low",
              "confidence": 0.45,
              "summary": "An obstacle is directly ahead in the walking path.",
              "spoken_alert": "Something ahead.",
              "recommended_action": "Be careful.",
              "hazards": ["obstacle"],
              "safe_path": null,
              "detected_objects": []
            }
            """
        )

        self.assertEqual(alert.direction_hint, "center")
        self.assertEqual(alert.proximity_hint, "immediate")
        self.assertEqual(alert.spoken_alert, "Obstacle ahead. Stop now.")
        self.assertEqual(
            alert.recommended_action,
            "Stop before the obstacle and rescan for a clear side.",
        )

    def test_parse_alert_rejects_invalid_danger_level(self):
        with self.assertRaises(HTTPException) as exc:
            _parse_alert(
                """
                {
                  "danger_level": "urgent",
                  "confidence": 0.5,
                  "summary": "Something is wrong.",
                  "spoken_alert": "Stop.",
                  "recommended_action": "Stop."
                }
                """
            )

        self.assertEqual(exc.exception.status_code, 502)

    def test_safe_url_analysis_returns_fallback_without_api_key(self):
        settings = Settings()
        settings.reka_api_key = None
        service = RekaVisionService(settings)

        response = service.analyze_media_url_safely(
            "https://example.com/frame.jpg",
            "image",
        )

        self.assertEqual(response.alert.danger_level, "medium")
        self.assertEqual(response.alert.spoken_alert, "Analysis unavailable. Stop and rescan.")
        self.assertIsNone(response.raw_model_text)
        self.assertEqual(response.analysis_mode, "fallback")

    def test_video_analysis_repairs_non_json_response(self):
        settings = Settings()
        service = RekaVisionService(settings)
        service.client = _StubClient(
            [
                "The user is near traffic. A bus is approaching and the safest action is to stop.",
                """
                {
                  "danger_level": "high",
                  "confidence": 0.84,
                  "summary": "A bus is approaching the crossing.",
                  "spoken_alert": "Bus ahead. Stop.",
                  "recommended_action": "Stop and wait before crossing.",
                  "hazards": ["bus", "traffic"],
                  "safe_path": null,
                  "detected_objects": ["bus", "street"]
                }
                """,
            ]
        )

        response = service.analyze_media_url(
            "https://example.com/video.mp4",
            "video",
        )

        self.assertEqual(response.alert.danger_level, "high")
        self.assertEqual(response.alert.recommended_action, "Stop and wait before crossing.")
        self.assertIn('"danger_level": "high"', response.raw_model_text)

    def test_video_analysis_uses_sampled_frames_and_merges_results(self):
        settings = Settings()
        service = _FrameSamplingService(settings)

        response = service.analyze_bytes(
            b"video-bytes",
            "video/mp4",
            "video",
        )

        self.assertEqual(response.source_type, "video")
        self.assertEqual(response.alert.danger_level, "high")
        self.assertEqual(response.alert.spoken_alert, "Bus ahead. Stop.")
        self.assertEqual(
            response.alert.recommended_action,
            "Stop and wait before crossing.",
        )
        self.assertEqual(len(response.timeline), 2)
        self.assertEqual(response.timeline[0].timestamp_seconds, 0.0)
        self.assertEqual(response.timeline[1].timestamp_seconds, 10.0)
        self.assertEqual(
            response.timeline[1].recommended_action,
            "Stop and wait before crossing.",
        )
        self.assertEqual(response.alert.direction_hint, "center")
        self.assertEqual(response.alert.proximity_hint, "immediate")
        self.assertEqual(response.timeline[1].direction_hint, "center")
        self.assertEqual(response.timeline[1].proximity_hint, "immediate")
        self.assertIn("bus", response.alert.hazards)
        self.assertIn("wet road", response.alert.hazards)
        self.assertIn(
            "Most urgent sampled moment around 10.0s.",
            response.alert.summary,
        )
        self.assertIn('"video_analysis_mode": "sampled_frames"', response.raw_model_text)
        self.assertIn('"headline_timestamp_seconds": 10.0', response.raw_model_text)

    def test_video_analysis_prefers_more_urgent_action_when_severity_matches(self):
        settings = Settings()
        service = _UrgencySamplingService(settings)

        response = service.analyze_bytes(
            b"video-bytes",
            "video/mp4",
            "video",
        )

        self.assertEqual(response.alert.danger_level, "medium")
        self.assertEqual(response.alert.spoken_alert, "Taxi close. Stop.")
        self.assertEqual(response.alert.recommended_action, "Stop and wait for traffic.")
        self.assertEqual(response.timeline[1].timestamp_seconds, 6.0)
        self.assertIn("taxi", response.alert.hazards)

    def test_video_analysis_uses_direct_reka_when_ffmpeg_missing(self):
        settings = Settings()
        service = RekaVisionService(settings)
        service.client = _StubClient(
            [
                """
                {
                  "danger_level": "high",
                  "confidence": 0.88,
                  "summary": "Obstacle blocking the path ahead.",
                  "spoken_alert": "Wall ahead. Stop.",
                  "recommended_action": "Stop immediately.",
                  "hazards": ["wall"],
                  "safe_path": null,
                  "detected_objects": ["wall"]
                }
                """
            ]
        )

        with patch("app.services.reka_vision.shutil.which", return_value=None):
            with patch.object(service, "_analyze_video_bytes") as mock_sampled:
                response = service.analyze_bytes(
                    b"video-bytes",
                    "video/webm",
                    "video",
                )
                mock_sampled.assert_not_called()

        self.assertEqual(response.source_type, "video")
        self.assertEqual(response.alert.danger_level, "high")
        self.assertEqual(response.alert.spoken_alert, "Wall ahead. Stop.")
        self.assertFalse(response.timeline)


class _StubClient:
    def __init__(self, contents):
        self.chat = _StubChat(contents)


class _StubChat:
    def __init__(self, contents):
        self.completions = _StubCompletions(contents)


class _StubCompletions:
    def __init__(self, contents):
        self._contents = list(contents)

    def create(self, **_kwargs):
        content = self._contents.pop(0)
        return _StubResponse(content)


class _StubResponse:
    def __init__(self, content):
        self.choices = [_StubChoice(content)]


class _StubChoice:
    def __init__(self, content):
        self.message = _StubMessage(content)


class _StubMessage:
    def __init__(self, content):
        self.content = content


class _FrameSamplingService(RekaVisionService):
    def _extract_video_frames(self, _contents, _content_type):
        return [
            ExtractedVideoFrame(
                timestamp_seconds=0.0,
                content_type="image/jpeg",
                contents=b"frame-1",
            ),
            ExtractedVideoFrame(
                timestamp_seconds=10.0,
                content_type="image/jpeg",
                contents=b"frame-2",
            ),
        ]

    def _analyze_extracted_frame(self, frame, _context=None):
        if frame.timestamp_seconds == 0.0:
            return AnalyzeResponse(
                source_type="image",
                alert=HazardAlert(
                    danger_level="low",
                    confidence=0.7,
                    summary="User is on the sidewalk near a bus stop.",
                    spoken_alert="Bus approaching, stay alert.",
                    recommended_action="Continue walking, but stay aware of the bus.",
                    direction_hint="center",
                    proximity_hint="ahead",
                    hazards=["bus"],
                    safe_path="Sidewalk to the right.",
                    detected_objects=["bus", "sidewalk"],
                ),
                raw_model_text='{"danger_level":"low"}',
            )

        return AnalyzeResponse(
            source_type="image",
            alert=HazardAlert(
                danger_level="high",
                confidence=0.91,
                summary="User is entering a busy crossing with a bus approaching.",
                spoken_alert="Bus ahead. Stop.",
                recommended_action="Stop and wait before crossing.",
                direction_hint="center",
                proximity_hint="immediate",
                hazards=["bus", "wet road"],
                safe_path=None,
                detected_objects=["bus", "street"],
            ),
            raw_model_text='{"danger_level":"high"}',
        )


class _UrgencySamplingService(RekaVisionService):
    def _extract_video_frames(self, _contents, _content_type):
        return [
            ExtractedVideoFrame(
                timestamp_seconds=0.0,
                content_type="image/jpeg",
                contents=b"frame-a",
            ),
            ExtractedVideoFrame(
                timestamp_seconds=6.0,
                content_type="image/jpeg",
                contents=b"frame-b",
            ),
        ]

    def _analyze_extracted_frame(self, frame, _context=None):
        if frame.timestamp_seconds == 0.0:
            return AnalyzeResponse(
                source_type="image",
                alert=HazardAlert(
                    danger_level="medium",
                    confidence=0.82,
                    summary="User is near a crossing with light traffic.",
                    spoken_alert="Crosswalk ahead, stay alert.",
                    recommended_action="Prepare to cross carefully.",
                    hazards=["crosswalk"],
                    safe_path="Stay on the sidewalk edge.",
                    detected_objects=["crosswalk", "sidewalk"],
                ),
            )

        return AnalyzeResponse(
            source_type="image",
            alert=HazardAlert(
                danger_level="medium",
                confidence=0.82,
                summary="Taxi is entering the user's path at the crossing.",
                spoken_alert="Taxi close. Stop.",
                recommended_action="Stop and wait for traffic.",
                hazards=["taxi", "crosswalk"],
                safe_path=None,
                detected_objects=["taxi", "crosswalk"],
            ),
        )


if __name__ == "__main__":
    unittest.main()
