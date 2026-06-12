import { useCallback, useEffect, useRef, useState } from 'react'

import { analyzeSessionChunk } from '../api/chunkAnalysisClient.js'
import { CHUNK_DURATION_MS } from '../api/uploadContract.js'
import { recordChunk } from './useChunkRecorder.js'

const LOOP_GAP_MS = 200
const RATE_LIMIT_BACKOFF_MS = 1600
const STREAM_WAIT_RETRY_MS = 400

/**
 * @param {() => MediaStream | null | undefined} getStream
 */
export function useChunkVideoAnalysis(getStream) {
  const timerRef = useRef(null)
  const sessionIdRef = useRef(null)
  const contextRef = useRef(null)
  const alertCooldownRef = useRef(6)
  const requestInFlightRef = useRef(false)
  const stoppedRef = useRef(false)

  const [status, setStatus] = useState('idle')
  const [error, setError] = useState(null)
  const [latestResult, setLatestResult] = useState(null)
  const [analysisCount, setAnalysisCount] = useState(0)
  const [lastAnalyzedAt, setLastAnalyzedAt] = useState(null)
  const [chunkCount, setChunkCount] = useState(0)
  const [lastChunkBytes, setLastChunkBytes] = useState(0)

  const clearScheduledRun = useCallback(() => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current)
      timerRef.current = null
    }
  }, [])

  const scheduleNextRun = useCallback(
    (delayMs, runLoop) => {
      clearScheduledRun()
      timerRef.current = window.setTimeout(runLoop, delayMs)
    },
    [clearScheduledRun],
  )

  const runLoop = useCallback(async () => {
    const activeSessionId = sessionIdRef.current
    if (!activeSessionId || stoppedRef.current) return

    if (requestInFlightRef.current) {
      scheduleNextRun(LOOP_GAP_MS, runLoop)
      return
    }

    const stream = getStream()
    if (!stream || stream.getVideoTracks().length === 0) {
      if (sessionIdRef.current === activeSessionId && !stoppedRef.current) {
        setStatus((prev) => (prev === 'starting' ? 'waiting_camera' : prev))
        scheduleNextRun(STREAM_WAIT_RETRY_MS, runLoop)
      }
      return
    }

    requestInFlightRef.current = true
    setStatus('recording')
    setError(null)

    try {
      const recorded = await recordChunk(stream, CHUNK_DURATION_MS)
      if (sessionIdRef.current !== activeSessionId || stoppedRef.current) return

      if (!recorded || recorded.blob.size === 0) {
        setStatus('active')
        scheduleNextRun(STREAM_WAIT_RETRY_MS, runLoop)
        return
      }

      setChunkCount((count) => count + 1)
      setLastChunkBytes(recorded.blob.size)
      setStatus('analyzing')

      const ext = recorded.mimeType.includes('mp4') ? 'mp4' : 'webm'
      const result = await analyzeSessionChunk(activeSessionId, recorded.blob, {
        context: contextRef.current ?? undefined,
        alertCooldownSeconds: alertCooldownRef.current,
        fileName: `chunk.${ext}`,
      })

      if (sessionIdRef.current !== activeSessionId || stoppedRef.current) return

      setLatestResult(result)
      setAnalysisCount((count) => count + 1)
      setLastAnalyzedAt(new Date().toISOString())
      setStatus('active')
      scheduleNextRun(LOOP_GAP_MS, runLoop)
    } catch (err) {
      if (sessionIdRef.current !== activeSessionId || stoppedRef.current) return

      const message = err instanceof Error ? err.message : 'Chunk analysis failed.'
      setStatus('error')
      setError(message)

      const backoff = message.includes('too quickly') ? RATE_LIMIT_BACKOFF_MS : LOOP_GAP_MS
      scheduleNextRun(backoff, runLoop)
    } finally {
      requestInFlightRef.current = false
    }
  }, [getStream, scheduleNextRun])

  const start = useCallback(
    (sessionId, context = null, { alertCooldownSeconds = 6 } = {}) => {
      stoppedRef.current = false
      sessionIdRef.current = sessionId
      contextRef.current = context
      alertCooldownRef.current = alertCooldownSeconds
      setError(null)
      setLatestResult(null)
      setAnalysisCount(0)
      setChunkCount(0)
      setLastChunkBytes(0)
      setLastAnalyzedAt(null)
      setStatus('starting')
      scheduleNextRun(250, runLoop)
    },
    [runLoop, scheduleNextRun],
  )

  const stop = useCallback(() => {
    stoppedRef.current = true
    sessionIdRef.current = null
    contextRef.current = null
    requestInFlightRef.current = false
    clearScheduledRun()
    setStatus('idle')
    setError(null)
  }, [clearScheduledRun])

  useEffect(() => stop, [stop])

  return {
    start,
    stop,
    status,
    error,
    latestResult,
    analysisCount,
    lastAnalyzedAt,
    chunkCount,
    lastChunkBytes,
  }
}
