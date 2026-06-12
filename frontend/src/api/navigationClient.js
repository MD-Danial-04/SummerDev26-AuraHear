export const NAVIGATION_GEOCODE_ENDPOINT = '/api/navigation/geocode'
export const NAVIGATION_ROUTE_ENDPOINT = '/api/navigation/route'

/**
 * @param {string} query
 * @param {{ limit?: number }} [options]
 */
export async function geocodeLocation(query, { limit = 1 } = {}) {
  const response = await fetch(NAVIGATION_GEOCODE_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({ query, limit }),
  })

  const payload = await response.json().catch(() => null)
  if (!response.ok) {
    const detail =
      payload?.detail ??
      (payload === null
        ? `Navigation service unreachable (${response.status}).`
        : 'Failed to geocode destination.')
    throw new Error(typeof detail === 'string' ? detail : 'Failed to geocode destination.')
  }

  return payload
}

/**
 * @param {{
 *   origin: { lat: number, lon: number },
 *   destination: { lat: number, lon: number },
 *   originName?: string | null,
 *   destinationName?: string | null,
 * }} request
 */
export async function buildNavigationRoute(request) {
  const response = await fetch(NAVIGATION_ROUTE_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify(request),
  })

  const payload = await response.json().catch(() => null)
  if (!response.ok) {
    const detail =
      payload?.detail ??
      (payload === null
        ? `Routing service unreachable (${response.status}).`
        : 'Failed to build route.')
    throw new Error(typeof detail === 'string' ? detail : 'Failed to build route.')
  }

  return payload
}

/**
 * @param {{ enableHighAccuracy?: boolean, timeout?: number, maximumAge?: number }} [options]
 * @returns {Promise<{ lat: number, lon: number }>}
 */
export function getCurrentCoordinates({
  enableHighAccuracy = true,
  timeout = 10000,
  maximumAge = 15000,
} = {}) {
  if (typeof window === 'undefined' || !navigator.geolocation) {
    return Promise.reject(new Error('Location is not supported on this device.'))
  }

  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          lat: position.coords.latitude,
          lon: position.coords.longitude,
        })
      },
      (error) => {
        if (error.code === error.PERMISSION_DENIED) {
          reject(new Error('Location permission was denied.'))
          return
        }

        if (error.code === error.TIMEOUT) {
          reject(new Error('Timed out while finding your location.'))
          return
        }

        reject(new Error('Could not determine your current location.'))
      },
      {
        enableHighAccuracy,
        timeout,
        maximumAge,
      },
    )
  })
}
