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
 * @param {number} [limit]
 * @returns {Promise<{ query: string, results: Array<{ name: string, lat: number, lon: number }> }>}
 */
export async function geocodeLocation(query, limit = 5) {
  const response = await fetch('/api/navigation/geocode', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
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
 *   originName?: string,
 *   destinationName?: string,
 * }} params
 * @returns {Promise<{
 *   origin: { lat: number, lon: number },
 *   destination: { lat: number, lon: number },
 *   origin_name?: string | null,
 *   destination_name?: string | null,
 *   summary: { distance_meters: number, duration_seconds: number, estimated_minutes: number },
 *   steps: Array<{
 *     instruction: string,
 *     spoken_instruction: string,
 *     distance_meters: number,
 *     duration_seconds: number,
 *     street_name?: string | null,
 *     location: { lat: number, lon: number },
 *   }>,
 *   path: Array<{ lat: number, lon: number }>,
 * }>}
 */
export async function buildWalkingRoute({
  origin,
  destination,
  originName,
  destinationName,
}) {
  const response = await fetch('/api/navigation/route', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
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
