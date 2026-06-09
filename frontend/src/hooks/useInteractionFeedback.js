import { useCallback } from 'react'

export function useInteractionFeedback() {
  const playClickSound = useCallback(() => {
    const AudioContext = window.AudioContext || window.webkitAudioContext
    if (!AudioContext) return

    const audioContext = new AudioContext()
    const oscillator = audioContext.createOscillator()
    const gainNode = audioContext.createGain()

    oscillator.connect(gainNode)
    gainNode.connect(audioContext.destination)

    oscillator.frequency.value = 800
    oscillator.type = 'sine'

    gainNode.gain.setValueAtTime(0.3, audioContext.currentTime)
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.1)

    oscillator.start(audioContext.currentTime)
    oscillator.stop(audioContext.currentTime + 0.1)
  }, [])

  const playSuccessSound = useCallback(() => {
    const AudioContext = window.AudioContext || window.webkitAudioContext
    if (!AudioContext) return

    const audioContext = new AudioContext()
    const oscillator = audioContext.createOscillator()
    const gainNode = audioContext.createGain()

    oscillator.connect(gainNode)
    gainNode.connect(audioContext.destination)

    oscillator.frequency.value = 1200
    oscillator.type = 'sine'

    gainNode.gain.setValueAtTime(0.2, audioContext.currentTime)
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.15)

    oscillator.start(audioContext.currentTime)
    oscillator.stop(audioContext.currentTime + 0.15)
  }, [])

  const vibrate = useCallback((pattern = 50) => {
    if ('vibrate' in navigator) {
      navigator.vibrate(pattern)
    }
  }, [])

  const buttonPress = useCallback(() => {
    playClickSound()
    vibrate(10)
  }, [playClickSound, vibrate])

  const togglePress = useCallback((isActive) => {
    if (isActive) {
      playSuccessSound()
      vibrate([50, 50, 50])
    } else {
      playClickSound()
      vibrate(30)
    }
  }, [playClickSound, playSuccessSound, vibrate])

  const sliderChange = useCallback(() => {
    vibrate(5)
  }, [vibrate])

  return {
    buttonPress,
    togglePress,
    sliderChange,
    playClickSound,
    playSuccessSound,
    vibrate,
  }
}
