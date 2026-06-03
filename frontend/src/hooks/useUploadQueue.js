import { useCallback, useRef, useState } from 'react'

import { uploadChunk } from '../api/mediaUploadClient.js'

/**
 * Serial upload queue. Sequence increments after each upload attempt
 * (including 404) so dev traffic remains visible before the backend route exists.
 */
export function useUploadQueue() {
  const queueRef = useRef([])
  const processingRef = useRef(false)
  const sequenceRef = useRef(0)
  const sessionIdRef = useRef(null)

  const [lastSequence, setLastSequence] = useState(-1)
  const [uploadStatus, setUploadStatus] = useState('idle')

  const drainQueue = useCallback(async function drain() {
    if (processingRef.current) return
    processingRef.current = true

    while (queueRef.current.length > 0) {
      const item = queueRef.current.shift()
      if (!item) continue

      const sequence = sequenceRef.current
      sequenceRef.current += 1

      setUploadStatus('uploading')

      try {
        const result = await uploadChunk(item.blob, {
          sessionId: sessionIdRef.current,
          sequence,
          capturedAt: item.capturedAt,
          mimeType: item.mimeType,
        })

        setLastSequence(sequence)
        setUploadStatus(result.ok ? 'ok' : String(result.status))
      } catch {
        setLastSequence(sequence)
        setUploadStatus('network_error')
      }
    }

    processingRef.current = false

    if (queueRef.current.length > 0) {
      await drain()
    } else if (sessionIdRef.current) {
      setUploadStatus((prev) => (prev === 'uploading' ? 'idle' : prev))
    }
  }, [])

  const enqueue = useCallback(
    (blob, mimeType) => {
      if (!sessionIdRef.current) return

      queueRef.current.push({
        blob,
        mimeType,
        capturedAt: new Date().toISOString(),
      })
      void drainQueue()
    },
    [drainQueue],
  )

  const beginSession = useCallback((sessionId) => {
    sessionIdRef.current = sessionId
    sequenceRef.current = 0
    queueRef.current = []
    setLastSequence(-1)
    setUploadStatus('idle')
  }, [])

  const endSession = useCallback(() => {
    sessionIdRef.current = null
    queueRef.current = []
    setUploadStatus('idle')
  }, [])

  return {
    beginSession,
    endSession,
    enqueue,
    lastSequence,
    uploadStatus,
    getSessionId: () => sessionIdRef.current,
  }
}
