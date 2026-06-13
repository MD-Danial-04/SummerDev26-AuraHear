import { useCallback } from 'react'

import { useApp } from '../context/AppContext.js'

/**
 * Lightweight speechSynthesis announcements for page/setting names.
 * Hazard alerts use backend TTS via speakWarningAsync instead.
 */
export function useAnnounce() {
  const { volume, speechRate } = useApp()

  const announce = useCallback(
    (text) => {
      if (!('speechSynthesis' in window) || !text) return
      window.speechSynthesis.cancel()
      const utterance = new SpeechSynthesisUtterance(text)
      utterance.volume = volume
      utterance.rate = speechRate
      utterance.pitch = 1
      utterance.lang = 'en-US'
      window.speechSynthesis.speak(utterance)
    },
    [volume, speechRate],
  )

  return announce
}
