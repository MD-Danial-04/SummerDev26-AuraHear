export const NAVIGATION_GEOCODE_ENDPOINT = '/api/navigation/geocode'
export const NAVIGATION_ROUTE_ENDPOINT = '/api/navigation/route'

/**
 * @param {string} detail
 * @returns {string}
 */
function formatApiError(detail) {
  if (typeof detail === 'string') return detail
  if (Array.isArray(detail)) {
    return detail.map((item) => item.msg ?? String(item)).join(' ')
  }
  return 'Navigation request failed.'
}

/**
 * @param {Response} response
 * @returns {Promise<never>}
 */
async function throwNavigationError(response) {
  const payload = await response.json().catch(() => null)
  const detail = payload?.detail ?? `Navigation request failed (${response.status}).`
  throw new Error(formatApiError(detail))
}

/**
 * @param {string} query
 * @param {number | { limit?: number }} [limitOrOptions]
 * @returns {Promise<{ query: string, results: Array<{ name: string, lat: number, lon: number }> }>}
 */
export async function geocodeLocation(query, limitOrOptions = 5) {
  const limit =
    typeof limitOrOptions === 'object'
      ? (limitOrOptions.limit ?? 5)
      : limitOrOptions

  const response = await fetch(NAVIGATION_GEOCODE_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({ query, limit }),
  })

  if (!response.ok) {
    await throwNavigationError(response)
  }

  return response.json()
}

/**
 * @param {{
 *   origin: { lat: number, lon: number },
 *   destination: { lat: number, lon: number },
 *   originName?: string | null,
 *   destinationName?: string | null,
 * }} params
 */
export async function buildWalkingRoute({
  origin,
  destination,
  originName,
  destinationName,
}) {
  const response = await fetch(NAVIGATION_ROUTE_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({
      origin,
      destination,
      origin_name: originName ?? null,
      destination_name: destinationName ?? null,
    }),
  })

  if (!response.ok) {
    await throwNavigationError(response)
  }

  return response.json()
}

/** Alias used by earlier main-branch integrations. */
export async function buildNavigationRoute(request) {
  return buildWalkingRoute({
    origin: request.origin,
    destination: request.destination,
    originName: request.originName ?? request.origin_name ?? null,
    destinationName: request.destinationName ?? request.destination_name ?? null,
  })
}
