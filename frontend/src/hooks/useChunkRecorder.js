import { useCallback, useRef, useState } from 'react'

import { CHUNK_INTERVAL_MS } from '../api/uploadContract.js'

const MIME_CANDIDATES = [
  'video/webm;codecs=vp8',
  'video/webm',
  'video/mp4',
]

function pickRecorderMimeType() {
  if (typeof MediaRecorder === 'undefined') {
    return null
  }
  for (const mime of MIME_CANDIDATES) {
    if (MediaRecorder.isTypeSupported(mime)) {
      return mime
    }
  }
  return ''
}

export function useChunkRecorder() {
  const recorderRef = useRef(null)
  const [mimeType, setMimeType] = useState(null)
  const [error, setError] = useState(null)

  const start = useCallback((stream, onChunk) => {
    setError(null)

    if (typeof MediaRecorder === 'undefined') {
      setError('MediaRecorder is not supported in this browser.')
      return false
    }

    const selectedMime = pickRecorderMimeType()
    if (selectedMime === null) {
      setError('No supported video recording format found.')
      return false
    }

    try {
      const options = selectedMime ? { mimeType: selectedMime } : undefined
      const recorder = new MediaRecorder(stream, options)

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          onChunk(event.data)
        }
      }

      recorder.onerror = () => {
        setError('Recording failed.')
      }

      recorder.start(CHUNK_INTERVAL_MS)
      recorderRef.current = recorder
      setMimeType(recorder.mimeType || selectedMime || 'unknown')
      return true
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Failed to start recorder.'
      setError(message)
      return false
    }
  }, [])

  const stop = useCallback(() => {
    const recorder = recorderRef.current
    if (recorder && recorder.state !== 'inactive') {
      recorder.stop()
    }
    recorderRef.current = null
  }, [])

  return { start, stop, mimeType, error }
}
