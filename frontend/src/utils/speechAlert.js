import { SPEECH_LANG } from '../api/threatContract.js'

const TEST_SPEECH_MESSAGE = 'AuraHear test. Obstacle ahead on your path.'

/** @type {SpeechSynthesisUtterance | null} */
let currentUtterance = null

export function isSpeechSupported() {
  return typeof window !== 'undefined' && 'speechSynthesis' in window
}

/**
 * @returns {{ supported: boolean, voiceCount: number, voices: SpeechSynthesisVoice[], speaking: boolean, pending: boolean, paused: boolean, speechState: string }}
 */
export function getSpeechDiagnostics() {
  if (!isSpeechSupported()) {
    return {
      supported: false,
      voiceCount: 0,
      voices: [],
      speaking: false,
      pending: false,
      paused: false,
      speechState: 'unsupported',
    }
  }

  const synthesis = window.speechSynthesis
  const voices = synthesis.getVoices()

  let speechState = 'idle'
  if (synthesis.speaking) {
    speechState = synthesis.paused ? 'paused' : 'speaking'
  } else if (synthesis.pending) {
    speechState = 'pending'
  }

  return {
    supported: true,
    voiceCount: voices.length,
    voices,
    speaking: synthesis.speaking,
    pending: synthesis.pending,
    paused: synthesis.paused,
    speechState,
  }
}

/**
 * @param {number} [timeoutMs]
 * @returns {Promise<SpeechSynthesisVoice[]>}
 */
export function waitForVoices(timeoutMs = 3000) {
  if (!isSpeechSupported()) {
    return Promise.resolve([])
  }

  const existing = window.speechSynthesis.getVoices()
  if (existing.length > 0) {
    return Promise.resolve(existing)
  }

  return new Promise((resolve) => {
    let settled = false

    const finish = () => {
      if (settled) return
      settled = true
      window.speechSynthesis.removeEventListener('voiceschanged', onVoicesChanged)
      resolve(window.speechSynthesis.getVoices())
    }

    const onVoicesChanged = () => {
      if (window.speechSynthesis.getVoices().length > 0) {
        finish()
      }
    }

    window.speechSynthesis.addEventListener('voiceschanged', onVoicesChanged)
    window.setTimeout(finish, timeoutMs)
  })
}

/**
 * Prime speech on a user gesture so later alerts are not blocked.
 */
export function primeSpeech() {
  if (!isSpeechSupported()) return

  window.speechSynthesis.resume()

  const utterance = new SpeechSynthesisUtterance('')
  utterance.volume = 0
  utterance.lang = SPEECH_LANG
  window.speechSynthesis.speak(utterance)
}

export function cancelSpeech() {
  if (!isSpeechSupported()) return
  window.speechSynthesis.cancel()
  currentUtterance = null
}

/**
 * @param {string} message
 * @param {{ severity?: import('../api/threatContract.js').ThreatSeverity, onEnd?: () => void }} [options]
 * @returns {Promise<{ ok: boolean, error?: string }>}
 */
export async function speakWarningAsync(message, { severity = 'medium', onEnd } = {}) {
  if (!isSpeechSupported()) {
    return { ok: false, error: 'unsupported' }
  }

  if (!message) {
    return { ok: false, error: 'empty_message' }
  }

  const voices = await waitForVoices()
  if (voices.length === 0) {
    return { ok: false, error: 'no_voices_loaded' }
  }

  window.speechSynthesis.resume()

  return new Promise((resolve) => {
    const utterance = new SpeechSynthesisUtterance(message)
    utterance.lang = SPEECH_LANG
    utterance.rate = severity === 'critical' ? 1.1 : 1

    if (severity === 'critical' || severity === 'high') {
      window.speechSynthesis.cancel()
    }

    const finish = (ok, error) => {
      if (currentUtterance === utterance) {
        currentUtterance = null
      }
      onEnd?.()
      resolve({ ok, error })
    }

    utterance.onend = () => finish(true)
    utterance.onerror = (event) => {
      finish(false, event.error || 'speech_error')
    }

    currentUtterance = utterance
    window.speechSynthesis.speak(utterance)
  })
}

/**
 * @param {string} message
 * @param {{ severity?: import('../api/threatContract.js').ThreatSeverity, onEnd?: () => void }} [options]
 */
export function speakWarning(message, options = {}) {
  void speakWarningAsync(message, options)
}

/**
 * @returns {Promise<{ ok: boolean, error?: string, voiceCount: number, diagnostics: ReturnType<typeof getSpeechDiagnostics> }>}
 */
export async function speakTest() {
  primeSpeech()

  const voices = await waitForVoices()
  const diagnostics = getSpeechDiagnostics()

  if (voices.length === 0) {
    return {
      ok: false,
      error: 'no_voices_loaded',
      voiceCount: 0,
      diagnostics,
    }
  }

  const result = await speakWarningAsync(TEST_SPEECH_MESSAGE, { severity: 'medium' })

  return {
    ...result,
    voiceCount: voices.length,
    diagnostics: getSpeechDiagnostics(),
  }
}
