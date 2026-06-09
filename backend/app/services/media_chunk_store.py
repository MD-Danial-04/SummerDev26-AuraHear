from dataclasses import dataclass

from app.models import MediaChunkResponse, MediaChunkStatusResponse


@dataclass
class MediaChunk:
    sequence: int
    captured_at: str
    content_type: str
    contents: bytes


class MediaChunkStore:
    def __init__(self) -> None:
        self.chunks: dict[str, dict[int, MediaChunk]] = {}

    def add_chunk(
        self,
        session_id: str,
        sequence: int,
        captured_at: str,
        content_type: str,
        contents: bytes,
    ) -> MediaChunkResponse:
        session_chunks = self.chunks.setdefault(session_id, {})
        session_chunks[sequence] = MediaChunk(
            sequence=sequence,
            captured_at=captured_at,
            content_type=content_type,
            contents=contents,
        )
        status = self.status(session_id)
        return MediaChunkResponse(
            accepted=True,
            session_id=session_id,
            sequence=sequence,
            bytes=len(contents),
            captured_at=captured_at,
            stored_chunks=status.stored_chunks,
            contiguous_chunks=status.contiguous_chunks,
            reconstructed_bytes=status.reconstructed_bytes,
            missing_sequences=status.missing_sequences,
        )

    def status(self, session_id: str) -> MediaChunkStatusResponse:
        session_chunks = self.chunks.get(session_id, {})
        contiguous_sequences = self._contiguous_sequences(session_chunks)
        missing_sequences = self._missing_sequences(session_chunks)
        reconstructed_bytes = sum(
            len(session_chunks[sequence].contents)
            for sequence in contiguous_sequences
        )
        return MediaChunkStatusResponse(
            session_id=session_id,
            stored_chunks=len(session_chunks),
            contiguous_chunks=len(contiguous_sequences),
            reconstructed_bytes=reconstructed_bytes,
            missing_sequences=missing_sequences,
        )

    def reconstruct(self, session_id: str) -> tuple[bytes, str]:
        session_chunks = self.chunks.get(session_id, {})
        contiguous_sequences = self._contiguous_sequences(session_chunks)
        if not contiguous_sequences:
            return b"", ""

        first_chunk = session_chunks[contiguous_sequences[0]]
        contents = b"".join(
            session_chunks[sequence].contents
            for sequence in contiguous_sequences
        )
        return contents, first_chunk.content_type

    def _contiguous_sequences(
        self,
        session_chunks: dict[int, MediaChunk],
    ) -> list[int]:
        if not session_chunks:
            return []

        sequences = sorted(session_chunks)
        expected = sequences[0]
        contiguous: list[int] = []
        for sequence in sequences:
            if sequence != expected:
                break
            contiguous.append(sequence)
            expected += 1
        return contiguous

    def _missing_sequences(
        self,
        session_chunks: dict[int, MediaChunk],
    ) -> list[int]:
        if not session_chunks:
            return []

        sequences = set(session_chunks)
        return [
            sequence
            for sequence in range(min(sequences), max(sequences) + 1)
            if sequence not in sequences
        ]


media_chunk_store = MediaChunkStore()
