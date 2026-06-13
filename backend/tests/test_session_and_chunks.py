import unittest

from fastapi import HTTPException

from app.models import AnalyzeResponse, HazardAlert
from app.services.media_chunk_store import MediaChunkStore
from app.services.session_store import SessionStore


class SessionAndChunkTests(unittest.TestCase):
    def test_session_rate_limit_blocks_fast_repeat(self):
        store = SessionStore()
        session = store.start_session(context=None, alert_cooldown_seconds=8)

        store.enforce_analysis_rate(
            session.session_id,
            min_interval_seconds=10,
            max_per_minute=30,
        )

        with self.assertRaises(HTTPException) as exc:
            store.enforce_analysis_rate(
                session.session_id,
                min_interval_seconds=10,
                max_per_minute=30,
            )

        self.assertEqual(exc.exception.status_code, 429)

    def test_duplicate_alert_is_suppressed_during_cooldown(self):
        store = SessionStore()
        session = store.start_session(context=None, alert_cooldown_seconds=60)
        analysis = AnalyzeResponse(
            source_type="image",
            alert=HazardAlert(
                danger_level="high",
                confidence=0.9,
                summary="Cyclist approaching.",
                spoken_alert="Cyclist left. Stop.",
                recommended_action="Stop walking.",
                hazards=["cyclist"],
            ),
        )

        first = store.add_alert(session.session_id, analysis)
        second = store.add_alert(session.session_id, analysis)

        self.assertTrue(first.should_speak)
        self.assertFalse(second.should_speak)
        self.assertEqual(second.suppressed_reason, "Repeated alert suppressed during cooldown.")

    def test_wording_variant_same_hazard_is_suppressed_during_cooldown(self):
        store = SessionStore()
        session = store.start_session(context=None, alert_cooldown_seconds=60)
        first_analysis = AnalyzeResponse(
            source_type="image",
            alert=HazardAlert(
                danger_level="high",
                confidence=0.9,
                summary="Pole ahead.",
                spoken_alert="Pole ahead. Stop.",
                recommended_action="Stop walking.",
                hazards=["pole"],
            ),
        )
        second_analysis = AnalyzeResponse(
            source_type="image",
            alert=HazardAlert(
                danger_level="high",
                confidence=0.9,
                summary="Pole blocking path.",
                spoken_alert="Pole directly ahead. Stop now.",
                recommended_action="Stop walking.",
                hazards=["pole"],
            ),
        )

        first = store.add_alert(session.session_id, first_analysis)
        second = store.add_alert(session.session_id, second_analysis)

        self.assertTrue(first.should_speak)
        self.assertFalse(second.should_speak)
        self.assertEqual(second.suppressed_reason, "Repeated alert suppressed during cooldown.")

    def test_ensure_session_creates_missing_session_for_serverless(self):
        store = SessionStore()
        session_id = "78df8e06-374f-4c6f-bb75-5649b7f18650"

        session = store.ensure_session(
            session_id,
            context="User is walking forward.",
            alert_cooldown_seconds=6,
        )

        self.assertEqual(session.session_id, session_id)
        self.assertEqual(session.context, "User is walking forward.")
        self.assertEqual(session.alert_cooldown_seconds, 6)
        store.enforce_analysis_rate(session_id, min_interval_seconds=0, max_per_minute=30)

    def test_chunk_store_reconstructs_contiguous_chunks_and_reports_gap(self):
        store = MediaChunkStore()
        store.add_chunk("session-1", 0, "2026-06-09T00:00:00Z", "video/webm", b"aa")
        store.add_chunk("session-1", 2, "2026-06-09T00:00:02Z", "video/webm", b"cc")

        status = store.status("session-1")
        contents, content_type = store.reconstruct("session-1")

        self.assertEqual(status.stored_chunks, 2)
        self.assertEqual(status.contiguous_chunks, 1)
        self.assertEqual(status.missing_sequences, [1])
        self.assertEqual(contents, b"aa")
        self.assertEqual(content_type, "video/webm")

    def test_reconstruct_latest_returns_highest_sequence_only(self):
        store = MediaChunkStore()
        store.add_chunk("session-1", 0, "2026-06-09T00:00:00Z", "video/webm", b"aa")
        store.add_chunk("session-1", 2, "2026-06-09T00:00:02Z", "video/webm", b"cc")

        contents, content_type = store.reconstruct_latest("session-1")

        self.assertEqual(contents, b"cc")
        self.assertEqual(content_type, "video/webm")

    def test_clear_session_removes_stored_chunks(self):
        store = MediaChunkStore()
        store.add_chunk("session-1", 0, "2026-06-09T00:00:00Z", "video/webm", b"aa")

        store.clear_session("session-1")

        self.assertEqual(store.status("session-1").stored_chunks, 0)
        self.assertEqual(store.reconstruct_latest("session-1"), (b"", ""))


if __name__ == "__main__":
    unittest.main()
