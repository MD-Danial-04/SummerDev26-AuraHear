try:
    import edge_tts
except ImportError:
    edge_tts = None

DEFAULT_VOICE = "en-US-JennyNeural"
AUDIO_MIME_TYPE = "audio/mpeg"


async def synthesize_speech(text: str) -> bytes | None:
    if not text or not text.strip():
        return None

    if edge_tts is None:
        return None

    try:
        communicate = edge_tts.Communicate(text.strip(), DEFAULT_VOICE)
        chunks: list[bytes] = []

        async for chunk in communicate.stream():
            if chunk["type"] == "audio":
                chunks.append(chunk["data"])

        if not chunks:
            return None

        return b"".join(chunks)
    except Exception:
        return None
