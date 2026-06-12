import { SINGAPORE_BOUNDS } from '../config/singaporeMap.js'

export { SINGAPORE_BOUNDS }

const EARTH_RADIUS_M = 6371000

/**
 * @param {number} degrees
 */
function toRadians(degrees) {
  return (degrees * Math.PI) / 180
}

/**
 * @param {{ lat: number, lon: number }} a
 * @param {{ lat: number, lon: number }} b
 * @returns {number}
 */
export function haversineMeters(a, b) {
  const dLat = toRadians(b.lat - a.lat)
  const dLon = toRadians(b.lon - a.lon)
  const lat1 = toRadians(a.lat)
  const lat2 = toRadians(b.lat)
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2
  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(h))
}

/**
 * @param {{ lat: number, lon: number }} point
 * @returns {boolean}
 */
export function isInSingaporeBounds({ lat, lon }) {
  const [[minLat, minLon], [maxLat, maxLon]] = SINGAPORE_BOUNDS
  return lat >= minLat && lat <= maxLat && lon >= minLon && lon <= maxLon
}

/**
 * @param {{ lat: number, lon: number }} point
 * @param {{ lat: number, lon: number }} a
 * @param {{ lat: number, lon: number }} b
 * @returns {number}
 */
function distanceToSegmentMeters(point, a, b) {
  const latMid = (a.lat + b.lat) / 2
  const cosLat = Math.cos(toRadians(latMid))
  const ax = a.lon * cosLat
  const ay = a.lat
  const bx = b.lon * cosLat
  const by = b.lat
  const px = point.lon * cosLat
  const py = point.lat

  const dx = bx - ax
  const dy = by - ay
  const lengthSq = dx * dx + dy * dy

  if (lengthSq === 0) {
    return haversineMeters(point, a)
  }

  let t = ((px - ax) * dx + (py - ay) * dy) / lengthSq
  t = Math.max(0, Math.min(1, t))

  const closest = {
    lat: ay + t * dy,
    lon: (ax + t * dx) / cosLat,
  }
  return haversineMeters(point, closest)
}

/**
 * @param {{ lat: number, lon: number }} point
 * @param {Array<{ lat: number, lon: number }>} path
 * @returns {number}
 */
export function distanceToPolylineMeters(point, path) {
  if (!path?.length) return Infinity
  if (path.length === 1) return haversineMeters(point, path[0])

  let minDistance = Infinity
  for (let index = 0; index < path.length - 1; index += 1) {
    minDistance = Math.min(
      minDistance,
      distanceToSegmentMeters(point, path[index], path[index + 1]),
    )
  }
  return minDistance
}

/**
 * @param {{ lat: number, lon: number }} point
 * @param {Array<{ location: { lat: number, lon: number } }>} steps
 * @returns {number}
 */
export function findNearestStepIndex(point, steps) {
  if (!steps?.length) return 0

  let nearestIndex = 0
  let nearestDistance = Infinity
  for (let index = 0; index < steps.length; index += 1) {
    const distance = haversineMeters(point, steps[index].location)
    if (distance < nearestDistance) {
      nearestDistance = distance
      nearestIndex = index
    }
  }
  return nearestIndex
}

export const NAV_STEP_ADVANCE_METERS = 20
export const NAV_OFF_ROUTE_METERS = 35
export const NAV_OFF_ROUTE_SECONDS = 8
export const NAV_REROUTE_DEBOUNCE_MS = 30000
export const NAV_ARRIVAL_METERS = 15
export const NAV_GPS_STALE_MS = 30000
