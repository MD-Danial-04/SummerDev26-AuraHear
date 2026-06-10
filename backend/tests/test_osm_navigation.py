import json
import unittest
from unittest.mock import patch

from app.config import Settings
from app.models import NavigationRouteRequest
from app.services.osm_navigation import OSMNavigationService


class _FakeHeaders:
    @staticmethod
    def get_content_charset():
        return "utf-8"


class _FakeResponse:
    def __init__(self, payload):
        self._payload = payload
        self.headers = _FakeHeaders()

    def read(self):
        return json.dumps(self._payload).encode("utf-8")

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc, tb):
        return False


class OSMNavigationTests(unittest.TestCase):
    def setUp(self):
        self.settings = Settings()
        self.service = OSMNavigationService(self.settings)

    @patch("app.services.osm_navigation.urlopen")
    def test_geocode_returns_named_results(self, mock_urlopen):
        mock_urlopen.return_value = _FakeResponse(
            [
                {
                    "display_name": "Marina Bay Sands, Singapore",
                    "lat": "1.2834",
                    "lon": "103.8607",
                }
            ]
        )

        response = self.service.geocode("Marina Bay Sands", limit=1)

        self.assertEqual(response.query, "Marina Bay Sands")
        self.assertEqual(len(response.results), 1)
        self.assertEqual(response.results[0].name, "Marina Bay Sands, Singapore")
        self.assertAlmostEqual(response.results[0].lat, 1.2834)

    @patch("app.services.osm_navigation.urlopen")
    def test_build_route_returns_steps_and_path(self, mock_urlopen):
        mock_urlopen.return_value = _FakeResponse(
            {
                "routes": [
                    {
                        "distance": 420.5,
                        "duration": 318.2,
                        "geometry": {
                            "coordinates": [
                                [103.8607, 1.2834],
                                [103.8612, 1.2840],
                            ]
                        },
                        "legs": [
                            {
                                "steps": [
                                    {
                                        "distance": 100.0,
                                        "duration": 80.0,
                                        "name": "Bayfront Avenue",
                                        "maneuver": {
                                            "type": "depart",
                                            "modifier": "straight",
                                            "location": [103.8607, 1.2834],
                                        },
                                    },
                                    {
                                        "distance": 40.0,
                                        "duration": 25.0,
                                        "name": "",
                                        "maneuver": {
                                            "type": "arrive",
                                            "location": [103.8612, 1.2840],
                                        },
                                    },
                                ]
                            }
                        ],
                    }
                ]
            }
        )
        request = NavigationRouteRequest.model_validate(
            {
                "origin": {"lat": 1.2834, "lon": 103.8607},
                "destination": {"lat": 1.2840, "lon": 103.8612},
                "origin_name": "Start",
                "destination_name": "Finish",
            }
        )

        response = self.service.build_route(request)

        self.assertEqual(response.summary.estimated_minutes, 6)
        self.assertEqual(len(response.steps), 2)
        self.assertEqual(response.steps[0].instruction, "Depart straight onto Bayfront Avenue")
        self.assertEqual(
            response.steps[0].spoken_instruction,
            "Depart straight onto Bayfront Avenue in about 100 meters.",
        )
        self.assertEqual(response.steps[1].instruction, "Arrive at your destination")
        self.assertEqual(len(response.path), 2)


if __name__ == "__main__":
    unittest.main()
