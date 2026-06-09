import { useEffect, useRef, useState } from 'react'

import { isAudioPlaybackSupported, playWarningAudio } from '../utils/audioAlert.js'
import { speakWarningAsync, isSpeechSupported } from '../utils/speechAlert.js'
import { vibrateForSeverity, isVibrationSupported } from '../utils/hapticAlert.js'

const SEEN_IDS_MAX = 50
const RELAY_THROTTLE_MS = 3000

/**
 * @param {import('../api/threatContract.js').ThreatWarningPackage | null} latestWarning
 */
export function useThreatRelay(latestWarning) {
  const [relayedWarnings, setRelayedWarnings] = useState([])
  const [lastRelayedAt, setLastRelayedAt] = useState(null)
  const [lastSpeechSource, setLastSpeechSource] = useState('idle')

  const seenIdsRef = useRef([])
  const seenIdSetRef = useRef(new Set())
  const lastRelayedAtRef = useRef(0)
  const lastSeverityRef = useRef(null)

  useEffect(() => {
    if (!latestWarning) return

    if (seenIdSetRef.current.has(latestWarning.id)) return

    const now = Date.now()
    const sameSeverity = lastSeverityRef.current === latestWarning.severity
    if (
      sameSeverity &&
      now - lastRelayedAtRef.current < RELAY_THROTTLE_MS
    ) {
      return
    }

    seenIdsRef.current.push(latestWarning.id)
    seenIdSetRef.current.add(latestWarning.id)

    if (seenIdsRef.current.length > SEEN_IDS_MAX) {
      const evicted = seenIdsRef.current.shift()
      if (evicted) {
        seenIdSetRef.current.delete(evicted)
      }
    }

    const interrupt =
      latestWarning.severity === 'critical' || latestWarning.severity === 'high'

    vibrateForSeverity(latestWarning.severity)

    const relaySpeech = async () => {
      if (latestWarning.audioUrl) {
        const result = await playWarningAudio(latestWarning.audioUrl, { interrupt })
        if (result.ok) {
          setLastSpeechSource('app-tts')
          return
        }
      }

      const fallback = await speakWarningAsync(latestWarning.message, {
        severity: latestWarning.severity,
      })

      setLastSpeechSource(fallback.ok ? 'system-tts' : 'idle')
    }

    void relaySpeech()

    lastRelayedAtRef.current = now
    lastSeverityRef.current = latestWarning.severity
    setLastRelayedAt(now)
    setRelayedWarnings((prev) => [latestWarning, ...prev].slice(0, 10))
  }, [latestWarning])

  return {
    relayedWarnings,
    lastRelayedAt,
    lastSpeechSource,
    capabilities: {
      audio: isAudioPlaybackSupported(),
      speech: isSpeechSupported(),
      vibration: isVibrationSupported(),
    },
  }
}
