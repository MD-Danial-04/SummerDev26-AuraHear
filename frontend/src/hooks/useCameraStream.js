import { useCallback, useRef, useState } from 'react'

const VIDEO_CONSTRAINTS = {
  facingMode: 'environment',
  width: { ideal: 1280 },
  height: { ideal: 720 },
}

export function useCameraStream(videoRef) {
  const streamRef = useRef(null)
  const [error, setError] = useState(null)

  const start = useCallback(async () => {
    setError(null)

    if (!navigator.mediaDevices?.getUserMedia) {
      setError('Camera API is not available in this browser.')
      return null
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: VIDEO_CONSTRAINTS,
        audio: false,
      })
      streamRef.current = stream

      const video = videoRef.current
      if (video) {
        video.srcObject = stream
        await video.play()
      }

      return stream
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Failed to access camera.'
      setError(message)
      return null
    }
  }, [videoRef])

  const stop = useCallback(() => {
    const stream = streamRef.current
    if (stream) {
      for (const track of stream.getTracks()) {
        track.stop()
      }
      streamRef.current = null
    }

    const video = videoRef.current
    if (video) {
      video.srcObject = null
    }
  }, [videoRef])

  return { start, stop, error, getStream: () => streamRef.current }
}
