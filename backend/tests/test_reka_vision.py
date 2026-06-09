import unittest

from fastapi import HTTPException

from app.config import Settings
from app.services.reka_vision import RekaVisionService, _parse_alert


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


if __name__ == "__main__":
    unittest.main()
