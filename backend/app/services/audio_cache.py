from collections import OrderedDict

MAX_ENTRIES = 100

_cache: OrderedDict[str, tuple[bytes, str]] = OrderedDict()


def put(key: str, data: bytes, mime_type: str = "audio/mpeg") -> None:
    if key in _cache:
        _cache.move_to_end(key)
    _cache[key] = (data, mime_type)

    while len(_cache) > MAX_ENTRIES:
        _cache.popitem(last=False)


def get(key: str) -> tuple[bytes, str] | None:
    entry = _cache.get(key)
    if entry is None:
        return None

    _cache.move_to_end(key)
    return entry
