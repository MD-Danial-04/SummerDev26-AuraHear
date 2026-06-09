import { THREAT_SEVERITIES } from '../api/threatContract.js'

/**
 * @param {unknown} raw
 * @returns {import('../api/threatContract.js').ThreatWarningPackage | null}
 */
export function parseThreatWarning(raw) {
  if (!raw || typeof raw !== 'object') return null

  const data = /** @type {Record<string, unknown>} */ (raw)
  const id = data.id
  const sessionId = data.sessionId ?? data.session_id
  const message = data.message
  const severity = data.severity
  const issuedAt = data.issuedAt ?? data.issued_at

  if (
    typeof id !== 'string' ||
    typeof sessionId !== 'string' ||
    typeof message !== 'string' ||
    !message ||
    typeof severity !== 'string' ||
    !THREAT_SEVERITIES.includes(severity) ||
    typeof issuedAt !== 'string'
  ) {
    return null
  }

  /** @type {import('../api/threatContract.js').ThreatWarningPackage} */
  const warning = {
    id,
    sessionId,
    message,
    severity,
    issuedAt,
  }

  if (typeof data.direction === 'string') {
    warning.direction = data.direction
  }

  const distanceM = data.distanceM ?? data.distance_m
  if (typeof distanceM === 'number') {
    warning.distanceM = distanceM
  }

  const audioUrl = data.audioUrl ?? data.audio_url
  if (typeof audioUrl === 'string') {
    warning.audioUrl = audioUrl
  }

  const audioMimeType = data.audioMimeType ?? data.audio_mime_type
  if (typeof audioMimeType === 'string') {
    warning.audioMimeType = audioMimeType
  }

  return warning
}
