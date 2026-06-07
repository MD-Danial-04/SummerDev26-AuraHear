/**
 * Threat warning contract for GET /api/sessions/{sessionId}/warnings (SSE).
 *
 * @typedef {'low' | 'medium' | 'high' | 'critical'} ThreatSeverity
 *
 * @typedef {Object} ThreatWarningPackage
 * @property {string} id - Unique warning ID (dedup key)
 * @property {string} sessionId - Correlates to capture session UUID
 * @property {string} message - Descriptive text for TTS (primary relay)
 * @property {ThreatSeverity} severity
 * @property {string} [direction] - e.g. "ahead", "left", "right"
 * @property {number} [distanceM] - Optional proximity in meters
 * @property {string} issuedAt - ISO8601
 * @property {string} [audioUrl] - e.g. "/api/warnings/{id}/audio"
 * @property {string} [audioMimeType] - e.g. "audio/mpeg"
 */

export const THREAT_SSE_EVENT = 'warning'

export const TTS_TEST_ENDPOINT = '/api/tts/test'

export const TTS_TEST_AUDIO_ENDPOINT = '/api/tts/test/audio'

/**
 * @param {string} warningId
 * @returns {string}
 */
export function warningAudioEndpoint(warningId) {
  return `/api/warnings/${warningId}/audio`
}

export const SPEECH_LANG = 'en-US'

/** @type {ThreatSeverity[]} */
export const THREAT_SEVERITIES = ['low', 'medium', 'high', 'critical']

/**
 * @param {string} sessionId
 * @returns {string}
 */
export function threatWarningsEndpoint(sessionId) {
  return `/api/sessions/${sessionId}/warnings`
}
