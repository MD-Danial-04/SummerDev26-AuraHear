import { TTS_TEST_ENDPOINT } from '../api/threatContract.js'

/** @type {HTMLAudioElement | null} */
let currentAudio = null

export function isAudioPlaybackSupported() {
  return typeof window !== 'undefined' && 'Audio' in window
}

/**
 * Prime audio playback on a user gesture so later alerts are not blocked.
 */
export function primeAudio() {
  if (!isAudioPlaybackSupported()) return

  const audio = new Audio()
  audio.volume = 0
  audio.muted = true
  void audio.play().catch(() => {})
}

export function stopCurrentAudio() {
  if (!currentAudio) return

  currentAudio.pause()
  currentAudio.currentTime = 0
  currentAudio = null
}

/**
 * @param {string} url
 * @param {{ interrupt?: boolean, onEnd?: () => void }} [options]
 * @returns {Promise<{ ok: boolean, error?: string }>}
 */
export function playWarningAudio(url, { interrupt = false, onEnd } = {}) {
  if (!isAudioPlaybackSupported()) {
    return Promise.resolve({ ok: false, error: 'unsupported' })
  }

  if (!url) {
    return Promise.resolve({ ok: false, error: 'empty_url' })
  }

  if (interrupt) {
    stopCurrentAudio()
  }

  const audio = new Audio(url)
  currentAudio = audio

  return new Promise((resolve) => {
    const finish = (ok, error) => {
      if (currentAudio === audio) {
        currentAudio = null
      }
      onEnd?.()
      resolve({ ok, error })
    }

    audio.onended = () => finish(true)
    audio.onerror = () => finish(false, 'audio_error')

    void audio.play().then(() => {}).catch((err) => {
      const message = err instanceof Error ? err.message : 'not_allowed'
      finish(false, message.includes('NotAllowed') ? 'not_allowed' : 'play_failed')
    })
  })
}

/**
 * @returns {Promise<{ ok: boolean, error?: string, audioUrl?: string, source?: string }>}
 */
export async function playTestAudio() {
  if (!isAudioPlaybackSupported()) {
    return { ok: false, error: 'unsupported', source: 'app-tts' }
  }

  try {
    const response = await fetch(TTS_TEST_ENDPOINT)
    const payload = await response.json()

    if (!response.ok || !payload.ok || !payload.audioUrl) {
      return {
        ok: false,
        error: payload.error ?? 'tts_failed',
        source: 'app-tts',
      }
    }

    const playResult = await playWarningAudio(payload.audioUrl, { interrupt: true })

    return {
      ...playResult,
      audioUrl: payload.audioUrl,
      source: playResult.ok ? 'app-tts' : 'app-tts',
    }
  } catch {
    return { ok: false, error: 'network_error', source: 'app-tts' }
  }
}
