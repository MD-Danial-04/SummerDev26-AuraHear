import { THREAT_SEVERITIES } from '../api/threatContract.js'

/** @type {Record<import('../api/threatContract.js').ThreatSeverity, number[]>} */
export const VIBRATION_PATTERNS = {
  low: [100],
  medium: [100, 50, 100],
  high: [200, 100, 200, 100, 200],
  critical: [300, 100, 300, 100, 300, 100, 300],
}

export function isVibrationSupported() {
  return typeof navigator !== 'undefined' && 'vibrate' in navigator
}

/**
 * @param {import('../api/threatContract.js').ThreatSeverity} severity
 */
export function vibrateForSeverity(severity) {
  if (!isVibrationSupported()) return false

  const pattern = VIBRATION_PATTERNS[severity]
  if (!pattern) return false

  return navigator.vibrate(pattern)
}

/**
 * @param {unknown} value
 * @returns {value is import('../api/threatContract.js').ThreatSeverity}
 */
export function isValidSeverity(value) {
  return typeof value === 'string' && THREAT_SEVERITIES.includes(value)
}
