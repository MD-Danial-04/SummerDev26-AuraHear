import { useCallback, useEffect, useRef, useState } from 'react'

import { analyzeSessionFrame } from '../api/sessionAnalysisClient.js'

const FRAME_INTERVAL_MS = 1800
const CAMERA_WAIT_RETRY_MS = 400
const MAX_FRAME_WIDTH = 960
const JPEG_QUALITY = 0.72

/**
 * @param {HTMLVideoElement | null} video
 * @returns {Promise<Blob | null>}
 */
async function captureVideoFrame(video) {
  if (
    !video ||
    video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA ||
    video.videoWidth <= 0 ||
    video.videoHeight <= 0
  ) {
    return null
  }

  const scale = Math.min(1, MAX_FRAME_WIDTH / video.videoWidth)
  const width = Math.max(1, Math.round(video.videoWidth * scale))
  const height = Math.max(1, Math.round(video.videoHeight * scale))
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height

  const context = canvas.getContext('2d')
  if (!context) {
    return null
  }

  context.drawImage(video, 0, 0, width, height)

  return new Promise((resolve) => {
    canvas.toBlob(resolve, 'image/jpeg', JPEG_QUALITY)
  })
}

/**
 * @param {import('react').RefObject<HTMLVideoElement | null>} videoRef
 */
export function useLiveFrameAnalysis(videoRef) {
  const timerRef = useRef(null)
  const sessionIdRef = useRef(null)
  const contextRef = useRef(null)
  const alertCooldownRef = useRef(6)
  const requestInFlightRef = useRef(false)

  const [status, setStatus] = useState('idle')
  const [error, setError] = useState(null)
  const [latestResult, setLatestResult] = useState(null)
  const [analysisCount, setAnalysisCount] = useState(0)
  const [lastAnalyzedAt, setLastAnalyzedAt] = useState(null)

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
    if (!activeSessionId) return

    if (requestInFlightRef.current) {
      scheduleNextRun(FRAME_INTERVAL_MS, runLoop)
      return
    }

    const frame = await captureVideoFrame(videoRef.current)
    if (!frame) {
      if (sessionIdRef.current === activeSessionId) {
        setStatus((prev) => (prev === 'starting' ? 'waiting_camera' : prev))
        scheduleNextRun(CAMERA_WAIT_RETRY_MS, runLoop)
      }
      return
    }

    requestInFlightRef.current = true
    setStatus('analyzing')
    setError(null)

    try {
      const result = await analyzeSessionFrame(activeSessionId, frame, {
        context: contextRef.current ?? undefined,
        alertCooldownSeconds: alertCooldownRef.current,
      })

      if (sessionIdRef.current !== activeSessionId) return

      setLatestResult(result)
      setAnalysisCount((count) => count + 1)
      setLastAnalyzedAt(new Date().toISOString())
      setStatus('active')
    } catch (err) {
      if (sessionIdRef.current !== activeSessionId) return

      setStatus('error')
      setError(err instanceof Error ? err.message : 'Frame analysis failed.')
    } finally {
      requestInFlightRef.current = false

      if (sessionIdRef.current === activeSessionId) {
        scheduleNextRun(FRAME_INTERVAL_MS, runLoop)
      }
    }
  }, [scheduleNextRun, videoRef])

  const start = useCallback(
    (sessionId, context = null, { alertCooldownSeconds = 6 } = {}) => {
      sessionIdRef.current = sessionId
      contextRef.current = context
      alertCooldownRef.current = alertCooldownSeconds
      setError(null)
      setLatestResult(null)
      setAnalysisCount(0)
      setLastAnalyzedAt(null)
      setStatus('starting')
      scheduleNextRun(250, runLoop)
    },
    [runLoop, scheduleNextRun],
  )

  const stop = useCallback(() => {
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
  }
}
