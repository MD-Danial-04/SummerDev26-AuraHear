import { useEffect, useRef, useState } from 'react'

import {
  THREAT_SSE_EVENT,
  threatWarningsEndpoint,
} from '../api/threatContract.js'
import { parseThreatWarning } from '../utils/parseThreatWarning.js'

const INITIAL_BACKOFF_MS = 1000
const MAX_BACKOFF_MS = 10000

/**
 * @param {string | null} sessionId
 */
export function useThreatStream(sessionId) {
  const [latestWarning, setLatestWarning] = useState(null)
  const [connectionStatus, setConnectionStatus] = useState('idle')
  const [error, setError] = useState(null)

  const sessionIdRef = useRef(sessionId)
  const eventSourceRef = useRef(null)
  const reconnectTimerRef = useRef(null)
  const backoffRef = useRef(INITIAL_BACKOFF_MS)

  useEffect(() => {
    sessionIdRef.current = sessionId

    const clearReconnectTimer = () => {
      if (reconnectTimerRef.current !== null) {
        window.clearTimeout(reconnectTimerRef.current)
        reconnectTimerRef.current = null
      }
    }

    const closeEventSource = () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close()
        eventSourceRef.current = null
      }
    }

    const scheduleReconnect = () => {
      if (!sessionIdRef.current) return

      clearReconnectTimer()
      const delay = backoffRef.current
      backoffRef.current = Math.min(delay * 2, MAX_BACKOFF_MS)

      reconnectTimerRef.current = window.setTimeout(() => {
        connect()
      }, delay)
    }

    const connect = () => {
      const activeSessionId = sessionIdRef.current
      if (!activeSessionId) return

      closeEventSource()
      setConnectionStatus('connecting')
      setError(null)

      const source = new EventSource(threatWarningsEndpoint(activeSessionId))
      eventSourceRef.current = source

      source.onopen = () => {
        if (sessionIdRef.current !== activeSessionId) return
        backoffRef.current = INITIAL_BACKOFF_MS
        setConnectionStatus('connected')
        setError(null)
      }

      source.onerror = () => {
        if (sessionIdRef.current !== activeSessionId) return

        closeEventSource()
        setConnectionStatus('reconnecting')
        setError('Warning stream disconnected')
        scheduleReconnect()
      }

      source.addEventListener(THREAT_SSE_EVENT, (event) => {
        if (sessionIdRef.current !== activeSessionId) return

        try {
          const parsed = parseThreatWarning(JSON.parse(event.data))
          if (parsed) {
            setLatestWarning(parsed)
          }
        } catch {
          setError('Invalid warning payload')
        }
      })
    }

    if (!sessionId) {
      clearReconnectTimer()
      closeEventSource()
      setLatestWarning(null)
      setConnectionStatus('idle')
      setError(null)
      backoffRef.current = INITIAL_BACKOFF_MS
      return () => {
        clearReconnectTimer()
        closeEventSource()
      }
    }

    connect()

    return () => {
      clearReconnectTimer()
      closeEventSource()
    }
  }, [sessionId])

  return {
    latestWarning,
    connectionStatus,
    error,
  }
}
