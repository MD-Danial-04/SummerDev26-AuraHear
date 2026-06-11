export const SESSION_START_ENDPOINT = '/api/session/start'

/**
 * @param {string} sessionId
 * @returns {string}
 */
export function sessionFrameAnalysisEndpoint(sessionId) {
  return `/api/session/${sessionId}/analyze/frame`
}

/**
 * @param {{ context?: string, alertCooldownSeconds?: number }} [options]
 * @returns {Promise<{ session_id: string, started_at: string, context: string | null, alert_cooldown_seconds: number }>}
 */
export async function startAnalysisSession({
  context,
  alertCooldownSeconds = 6,
} = {}) {
  const response = await fetch(SESSION_START_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({
      context: context ?? null,
      alert_cooldown_seconds: alertCooldownSeconds,
    }),
  })

  const payload = await response.json().catch(() => null)
  if (!response.ok) {
    const detail =
      payload?.detail ??
      (payload === null
        ? `Backend unreachable (${response.status}). Check Vercel API routing.`
        : 'Failed to start live analysis session.')
    throw new Error(typeof detail === 'string' ? detail : 'Failed to start live analysis session.')
  }

  return payload
}

/**
 * @param {string} sessionId
 * @param {Blob} frame
 * @param {{ context?: string, fileName?: string }} [options]
 * @returns {Promise<{
 *   analysis_mode?: 'reka' | 'fallback',
 *   source_type: 'image',
 *   alert: {
 *     danger_level: 'none' | 'low' | 'medium' | 'high' | 'critical',
 *     confidence: number,
 *     summary: string,
 *     spoken_alert: string,
 *     recommended_action: string,
 *     hazards: string[],
 *     safe_path: string | null,
 *     detected_objects: string[],
 *   },
 *   raw_model_text?: string | null,
 *   session_id: string,
 *   alert_id: string,
 *   should_speak: boolean,
 *   suppressed_reason?: string | null,
 * }>}
 */
export async function analyzeSessionFrame(
  sessionId,
  frame,
  { context, fileName = 'frame.jpg', alertCooldownSeconds = 6 } = {},
) {
  const formData = new FormData()
  formData.append('frame', frame, fileName)
  if (context) {
    formData.append('context', context)
  }
  formData.append('alert_cooldown_seconds', String(alertCooldownSeconds))

  const response = await fetch(sessionFrameAnalysisEndpoint(sessionId), {
    method: 'POST',
    body: formData,
  })

  const payload = await response.json().catch(() => null)
  if (!response.ok) {
    const detail =
      payload?.detail ??
      (payload === null
        ? `Backend unreachable (${response.status}). Check Vercel API routing.`
        : 'Frame analysis failed.')
    throw new Error(typeof detail === 'string' ? detail : 'Frame analysis failed.')
  }

  return payload
}
