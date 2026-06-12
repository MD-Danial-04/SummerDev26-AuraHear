"""Singapore geographic bounds and coordinate helpers."""

SINGAPORE_LAT_MIN = 1.15
SINGAPORE_LAT_MAX = 1.47
SINGAPORE_LON_MIN = 103.6
SINGAPORE_LON_MAX = 104.1


def is_in_singapore_bounds(lat: float, lon: float) -> bool:
    return (
        SINGAPORE_LAT_MIN <= lat <= SINGAPORE_LAT_MAX
        and SINGAPORE_LON_MIN <= lon <= SINGAPORE_LON_MAX
    )


def require_singapore_coordinate(lat: float, lon: float, label: str) -> None:
    from fastapi import HTTPException, status

    if not is_in_singapore_bounds(lat, lon):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"{label} must be within Singapore.",
        )
