import { useCallback, useEffect, useRef } from 'react'

/**
 * @param {boolean} enabled
 * @param {{
 *   onStart?: () => void,
 *   onStop?: () => void,
 *   onVolumeUp?: () => void,
 *   onVolumeDown?: () => void,
 *   onRepeat?: () => void,
 *   onSettings?: () => void,
 *   onCommandRecognized?: (command: string) => void,
 * }} callbacks
 */
export function useVoiceCommands(enabled, callbacks) {
  const recognitionRef = useRef(null)
  const callbacksRef = useRef(callbacks)

  useEffect(() => {
    callbacksRef.current = callbacks
  }, [callbacks])

  const processCommand = useCallback((transcript) => {
    const text = transcript.toLowerCase().trim()
    const cb = callbacksRef.current

    if (text.includes('start') || text.includes('begin') || text.includes('activate')) {
      cb.onStart?.()
      cb.onCommandRecognized?.('Start analysis')
    } else if (
      text.includes('stop') ||
      text.includes('pause') ||
      text.includes('deactivate')
    ) {
      cb.onStop?.()
      cb.onCommandRecognized?.('Stop analysis')
    } else if (
      text.includes('louder') ||
      text.includes('volume up') ||
      text.includes('increase volume')
    ) {
      cb.onVolumeUp?.()
      cb.onCommandRecognized?.('Volume up')
    } else if (
      text.includes('quieter') ||
      text.includes('softer') ||
      text.includes('volume down') ||
      text.includes('decrease volume')
    ) {
      cb.onVolumeDown?.()
      cb.onCommandRecognized?.('Volume down')
    } else if (
      text.includes('repeat') ||
      text.includes('again') ||
      text.includes('say again')
    ) {
      cb.onRepeat?.()
      cb.onCommandRecognized?.('Repeat')
    } else if (
      text.includes('settings') ||
      text.includes('options') ||
      text.includes('preferences')
    ) {
      cb.onSettings?.()
      cb.onCommandRecognized?.('Open settings')
    }
  }, [])

  useEffect(() => {
    if (!enabled) {
      recognitionRef.current?.stop()
      recognitionRef.current = null
      return
    }

    const SpeechRecognitionAPI =
      window.SpeechRecognition || window.webkitSpeechRecognition

    if (!SpeechRecognitionAPI) return

    const recognition = new SpeechRecognitionAPI()
    recognition.continuous = true
    recognition.interimResults = false
    recognition.lang = 'en-US'

    recognition.onresult = (event) => {
      const last = event.results[event.results.length - 1]
      if (last.isFinal) {
        processCommand(last[0].transcript)
      }
    }

    recognition.onerror = (event) => {
      if (event.error !== 'no-speech') {
        console.warn('Voice recognition error:', event.error)
      }
    }

    recognition.onend = () => {
      if (recognitionRef.current === recognition) {
        try {
          recognition.start()
        } catch {
          // ignore restart errors
        }
      }
    }

    try {
      recognition.start()
      recognitionRef.current = recognition
    } catch (err) {
      console.warn('Could not start voice recognition:', err)
    }

    return () => {
      recognitionRef.current = null
      try {
        recognition.stop()
      } catch {
        // ignore stop errors
      }
    }
  }, [enabled, processCommand])
}
