from datetime import UTC, datetime, timedelta
from uuid import uuid4

from fastapi import HTTPException, status

from app.models import (
    AnalyzeResponse,
    SessionAlertRecord,
    SessionAlertsResponse,
    SessionStartResponse,
)


class SessionState:
    def __init__(
        self,
        session_id: str,
        started_at: datetime,
        context: str | None,
        alert_cooldown_seconds: int,
    ) -> None:
        self.session_id = session_id
        self.started_at = started_at
        self.context = context
        self.alert_cooldown_seconds = alert_cooldown_seconds
        self.alerts: list[SessionAlertRecord] = []
        self.last_spoken_signature: str | None = None
        self.last_spoken_at: datetime | None = None
        self.analysis_timestamps: list[datetime] = []


class SessionStore:
    def __init__(self) -> None:
        self.sessions: dict[str, SessionState] = {}

    def start_session(
        self,
        context: str | None,
        alert_cooldown_seconds: int,
    ) -> SessionStartResponse:
        session_id = str(uuid4())
        started_at = datetime.now(UTC)
        self.sessions[session_id] = SessionState(
            session_id=session_id,
            started_at=started_at,
            context=context,
            alert_cooldown_seconds=alert_cooldown_seconds,
        )
        return SessionStartResponse(
            session_id=session_id,
            started_at=_format_time(started_at),
            context=context,
            alert_cooldown_seconds=alert_cooldown_seconds,
        )

    def add_alert(
        self,
        session_id: str,
        analysis: AnalyzeResponse,
    ) -> SessionAlertRecord:
        session = self._get_session(session_id)
        now = datetime.now(UTC)
        signature = _alert_signature(analysis)
        should_speak, suppressed_reason = self._speech_decision(
            session=session,
            signature=signature,
            now=now,
            analysis=analysis,
        )

        record = SessionAlertRecord(
            alert_id=str(uuid4()),
            created_at=_format_time(now),
            source_type=analysis.source_type,
            alert=analysis.alert,
            should_speak=should_speak,
            suppressed_reason=suppressed_reason,
        )
        session.alerts.append(record)

        if should_speak:
            session.last_spoken_signature = signature
            session.last_spoken_at = now

        return record

    def get_alerts(self, session_id: str) -> SessionAlertsResponse:
        session = self._get_session(session_id)
        return SessionAlertsResponse(session_id=session_id, alerts=session.alerts)

    def get_context(self, session_id: str) -> str | None:
        return self._get_session(session_id).context

    def enforce_analysis_rate(
        self,
        session_id: str,
        min_interval_seconds: float,
        max_per_minute: int,
    ) -> None:
        session = self._get_session(session_id)
        now = datetime.now(UTC)
        window_start = now - timedelta(minutes=1)
        session.analysis_timestamps = [
            timestamp
            for timestamp in session.analysis_timestamps
            if timestamp >= window_start
        ]

        if session.analysis_timestamps:
            elapsed = (now - session.analysis_timestamps[-1]).total_seconds()
            if elapsed < min_interval_seconds:
                raise HTTPException(
                    status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                    detail=(
                        "Analysis requested too quickly. "
                        f"Wait {min_interval_seconds - elapsed:.2f} seconds."
                    ),
                )

        if len(session.analysis_timestamps) >= max_per_minute:
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="Session analysis limit reached for this minute.",
            )

        session.analysis_timestamps.append(now)

    def _get_session(self, session_id: str) -> SessionState:
        session = self.sessions.get(session_id)
        if not session:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Unknown session_id: {session_id}",
            )
        return session

    def _speech_decision(
        self,
        session: SessionState,
        signature: str,
        now: datetime,
        analysis: AnalyzeResponse,
    ) -> tuple[bool, str | None]:
        if analysis.alert.danger_level == "none":
            return False, "No immediate hazard detected."

        if session.last_spoken_signature != signature or not session.last_spoken_at:
            return True, None

        elapsed = (now - session.last_spoken_at).total_seconds()
        if elapsed < session.alert_cooldown_seconds:
            return False, "Repeated alert suppressed during cooldown."

        return True, None


def _alert_signature(analysis: AnalyzeResponse) -> str:
    hazards = ",".join(sorted(hazard.lower() for hazard in analysis.alert.hazards))
    return "|".join(
        [
            analysis.alert.danger_level,
            analysis.alert.spoken_alert.strip().lower(),
            hazards,
        ]
    )


def _format_time(value: datetime) -> str:
    return value.isoformat().replace("+00:00", "Z")


session_store = SessionStore()
