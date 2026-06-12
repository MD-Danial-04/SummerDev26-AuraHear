/** Singapore map defaults for Leaflet (lat, lng). */
export const SINGAPORE_CENTER = [1.3521, 103.8198]

export const SINGAPORE_DEFAULT_ZOOM = 12

/** Restrict panning to Singapore + small buffer. */
export const SINGAPORE_BOUNDS = [
  [1.15, 103.6],
  [1.47, 104.1],
]

export const OSM_TILE_URL = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png'

export const OSM_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
