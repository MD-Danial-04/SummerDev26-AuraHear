/**
 * @param {string} sessionId
 * @returns {string}
 */
export function sessionChunkAnalysisEndpoint(sessionId) {
  return `/api/session/${sessionId}/analyze/chunk`
}

/**
 * @param {string} sessionId
 * @param {Blob} chunk
 * @param {{ context?: string, alertCooldownSeconds?: number, fileName?: string }} [options]
 * @returns {Promise<{
 *   analysis_mode?: 'reka' | 'fallback',
 *   source_type: 'video',
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
export async function analyzeSessionChunk(
  sessionId,
  chunk,
  { context, alertCooldownSeconds = 6, fileName = 'chunk.webm' } = {},
) {
  const formData = new FormData()
  formData.append('chunk', chunk, fileName)
  if (context) {
    formData.append('context', context)
  }
  formData.append('alert_cooldown_seconds', String(alertCooldownSeconds))

  const response = await fetch(sessionChunkAnalysisEndpoint(sessionId), {
    method: 'POST',
    body: formData,
  })

  const payload = await response.json().catch(() => null)
  if (!response.ok) {
    const detail =
      payload?.detail ??
      (payload === null
        ? `Backend unreachable (${response.status}). Check Vercel API routing.`
        : 'Chunk analysis failed.')
    throw new Error(typeof detail === 'string' ? detail : 'Chunk analysis failed.')
  }

  return payload
}
