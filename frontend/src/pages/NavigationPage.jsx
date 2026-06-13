import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router'
import { Mic, MicOff } from 'lucide-react'

import { useApp } from '../context/AppContext.js'
import { useAnnounce } from '../hooks/useAnnounce.js'
import { iconStyle, scaleRem, scaleSize } from '../utils/scaleFont.js'
import { isVerticalSwipe } from '../utils/swipeGesture.js'
import { withAlpha } from '../utils/withAlpha.js'

const LOADING_STATUSES = new Set(['locating', 'geocoding', 'routing'])

function gpsStatusText(liveLocation) {
  if (liveLocation.status === 'tracking' || liveLocation.status === 'ready') {
    const accuracy =
      liveLocation.coordinates?.accuracyMeters != null
        ? ` • accuracy ${Math.round(liveLocation.coordinates.accuracyMeters)} m`
        : ''
    return `GPS ready${accuracy}`
  }
  if (liveLocation.status === 'requesting') return 'Requesting GPS location…'
  if (liveLocation.status === 'unsupported') return 'GPS is not supported on this device.'
  return liveLocation.error || 'GPS permission is needed for navigation.'
}

export function NavigationPage() {
  const navigate = useNavigate()
  const {
    videoRef,
    cameraError,
    reattachCamera,
    active,
    fontSize,
    layoutInverted,
    colors,
    feedback,
    showToast,
    liveLocation,
    speakInstruction,
    navigation,
  } = useApp()

  const {
    status,
    error,
    candidates,
    selectedIndex,
    isActiveRoute,
    startRoute,
    confirmDestination,
    selectCandidate,
    nextCandidate,
  } = navigation

  const announce = useAnnounce()
  const [destination, setDestination] = useState('')
  const [listening, setListening] = useState(false)
  const recognitionRef = useRef(null)
  const disambiguationRecognitionRef = useRef(null)
  const navigationStatusRef = useRef('idle')
  const inputRef = useRef(null)
  const containerRef = useRef(null)

  useEffect(() => {
    navigationStatusRef.current = status
  }, [status])

  useEffect(() => {
    if (isActiveRoute) {
      navigate('/')
    }
  }, [isActiveRoute, navigate])

  useEffect(() => {
    const t = setTimeout(
      () => announce('Navigation. Enter your destination. Swipe down for home.'),
      300,
    )
    return () => clearTimeout(t)
  }, [announce])

  useEffect(() => {
    reattachCamera()
  }, [reattachCamera, active])

  useEffect(() => {
    if (liveLocation.status === 'idle') {
      void liveLocation.requestLocation({ keepUpdated: true }).catch(() => {})
    }
  }, [liveLocation])

  useEffect(() => {
    if (status !== 'disambiguating') {
      disambiguationRecognitionRef.current?.stop()
      disambiguationRecognitionRef.current = null
      return
    }

    const SpeechRecognitionAPI =
      window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SpeechRecognitionAPI) return

    const rec = new SpeechRecognitionAPI()
    rec.continuous = false
    rec.interimResults = false
    rec.lang = 'en-US'
    rec.onresult = (event) => {
      const text = event.results[0][0].transcript.toLowerCase()
      if (
        text.includes('next') ||
        text.includes('another') ||
        text.includes('other')
      ) {
        nextCandidate()
      } else if (
        text.includes('confirm') ||
        text.includes('select') ||
        text.includes('this one') ||
        text.includes('go')
      ) {
        void confirmDestination()
      } else if (text.includes('option two') || text.includes('second')) {
        selectCandidate(1)
      } else if (text.includes('option three') || text.includes('third')) {
        selectCandidate(2)
      }
    }
    rec.onend = () => {
      if (navigationStatusRef.current === 'disambiguating') {
        try {
          rec.start()
        } catch {
          // ignore restart errors
        }
      }
    }
    rec.start()
    disambiguationRecognitionRef.current = rec

    return () => {
      rec.stop()
      disambiguationRecognitionRef.current = null
    }
  }, [confirmDestination, nextCandidate, selectCandidate, status])

  const handleStartRoute = useCallback(
    (dest) => {
      if (!dest.trim() || LOADING_STATUSES.has(status)) return
      feedback.togglePress(true)
      showToast(`Navigating to ${dest}`)
      void startRoute(dest)
    },
    [feedback, showToast, startRoute, status],
  )

  useEffect(() => {
    const el = containerRef.current
    if (!el) return

    let startX = 0
    let startY = 0
    let startTime = 0
    let pointerId = null

    const onPointerDown = (e) => {
      if (e.pointerType === 'mouse' && e.button !== 0) return
      pointerId = e.pointerId
      startX = e.clientX
      startY = e.clientY
      startTime = Date.now()
    }

    const onPointerUp = (e) => {
      if (pointerId !== null && e.pointerId !== pointerId) return
      pointerId = null

      const dx = e.clientX - startX
      const dy = e.clientY - startY
      const duration = Date.now() - startTime

      if (isVerticalSwipe(dx, dy, duration) && dy > 0) {
        feedback.buttonPress()
        navigate('/')
      }
    }

    const onPointerCancel = () => {
      pointerId = null
    }

    el.addEventListener('pointerdown', onPointerDown)
    el.addEventListener('pointerup', onPointerUp)
    el.addEventListener('pointercancel', onPointerCancel)
    return () => {
      el.removeEventListener('pointerdown', onPointerDown)
      el.removeEventListener('pointerup', onPointerUp)
      el.removeEventListener('pointercancel', onPointerCancel)
    }
  }, [navigate, feedback])

  const startListening = useCallback(() => {
    const SpeechRecognitionAPI =
      window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SpeechRecognitionAPI) {
      showToast('Voice not supported on this device')
      return
    }
    feedback.togglePress(true)
    const rec = new SpeechRecognitionAPI()
    rec.continuous = false
    rec.interimResults = true
    rec.lang = 'en-US'
    rec.onstart = () => {
      setListening(true)
      void speakInstruction('Listening for destination')
    }
    rec.onresult = (e) => {
      const t = e.results[0][0].transcript
      setDestination(t)
      if (e.results[0].isFinal) {
        setListening(false)
        void speakInstruction(`Destination set to ${t}`)
      }
    }
    rec.onerror = () => {
      setListening(false)
      showToast("Couldn't hear you — try again")
    }
    rec.onend = () => setListening(false)
    rec.start()
    recognitionRef.current = rec
  }, [feedback, showToast, speakInstruction])

  const stopListening = useCallback(() => {
    recognitionRef.current?.stop()
    setListening(false)
  }, [])

  useEffect(
    () => () => {
      recognitionRef.current?.stop()
      disambiguationRecognitionRef.current?.stop()
    },
    [],
  )

  const canGo =
    destination.trim().length > 0 &&
    !LOADING_STATUSES.has(status) &&
    status !== 'disambiguating'

  const loadingLabel =
    status === 'locating'
      ? 'Finding your location…'
      : status === 'geocoding'
        ? 'Searching Singapore…'
        : status === 'routing'
          ? 'Calculating route…'
          : null

  const videoBackground = (
    <>
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className="absolute inset-0 size-full object-cover"
      />
      {!active && !cameraError && (
        <div
          className="absolute inset-0"
          style={{ backgroundColor: withAlpha(colors.background, 0.55) }}
        />
      )}
      {cameraError && (
        <div className="absolute inset-0 flex items-center justify-center px-8">
          <p
            className="text-center whitespace-pre-line"
            style={{ color: colors.text, fontSize: scaleRem(1.1, fontSize), fontWeight: 700 }}
          >
            {cameraError}
          </p>
        </div>
      )}
      {active && (
        <div
          className="absolute top-5 left-5 flex items-center gap-2 px-3 py-1.5 rounded-full z-10"
          style={{
            backgroundColor: withAlpha(colors.background, 0.7),
            outline: `2px solid ${colors.accent}`,
          }}
        >
          <span
            className="w-2 h-2 rounded-full animate-pulse inline-block"
            style={{ backgroundColor: colors.accent }}
          />
          <span
            className="text-xs font-bold tracking-widest"
            style={{ color: colors.accent }}
          >
            LIVE
          </span>
        </div>
      )}
    </>
  )

  const bottomHintBar = (
    <div
      className="absolute bottom-0 inset-x-0 flex justify-between items-center px-5 py-3 pointer-events-none z-20"
      style={{ backgroundColor: withAlpha(colors.background, 0.6) }}
    >
      <span style={{ color: colors.text, fontSize: scaleRem(0.9, fontSize), letterSpacing: '0.06em' }}>
        ↓ HOME
      </span>
      <span style={{ color: colors.text, fontSize: scaleRem(0.9, fontSize), letterSpacing: '0.06em' }}>
        SWIPE DOWN
      </span>
    </div>
  )

  const overlayPosition = layoutInverted
    ? 'absolute top-16 inset-x-0 px-6 z-10'
    : 'absolute bottom-24 inset-x-0 px-6 z-10'

  if (isActiveRoute) {
    return (
      <div
        className="size-full relative overflow-hidden"
        style={{ backgroundColor: colors.background }}
      >
        {videoBackground}
      </div>
    )
  }

  return (
    <div
      ref={containerRef}
      className="size-full relative overflow-hidden"
      style={{
        backgroundColor: colors.background,
        touchAction: 'none',
        userSelect: 'none',
      }}
    >
      {videoBackground}

      <div className={`${overlayPosition} flex flex-col items-center gap-4 max-h-[70svh] overflow-y-auto`}>
        <span
          style={{
            fontSize: 'clamp(1.2rem, 4vw, 1.6rem)',
            fontWeight: 900,
            color: colors.text,
            letterSpacing: '0.08em',
          }}
        >
          WHERE TO?
        </span>

        <div
          className="flex items-center gap-2 w-full max-w-md rounded-full px-2 py-2"
          style={{
            backgroundColor: withAlpha(colors.background, 0.7),
            outline: listening ? `2px solid ${colors.accent}` : 'none',
          }}
          aria-live="polite"
        >
          <button
            type="button"
            onClick={() => {
              feedback.buttonPress()
              if (listening) stopListening()
              else startListening()
            }}
            className="flex items-center justify-center active:opacity-80 flex-shrink-0 rounded-full"
            style={{
              width: scaleSize(3.5, fontSize),
              height: scaleSize(3.5, fontSize),
              backgroundColor: listening ? colors.accent : withAlpha(colors.background, 0.5),
              color: listening ? colors.background : colors.text,
            }}
            aria-label={
              listening ? 'Stop recording destination' : 'Record destination by voice'
            }
            aria-pressed={listening}
          >
            {listening ? (
              <MicOff style={iconStyle(1.8, fontSize)} />
            ) : (
              <Mic style={iconStyle(1.8, fontSize, { color: colors.accent })} />
            )}
          </button>

          <input
            ref={inputRef}
            type="text"
            value={destination}
            onChange={(e) => setDestination(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && canGo) handleStartRoute(destination)
            }}
            placeholder={listening ? 'Listening…' : 'Singapore destination…'}
            className="flex-1 min-w-0 outline-none bg-transparent"
            style={{
              color: colors.text,
              caretColor: colors.accent,
              fontSize: scaleRem(1.1, fontSize),
              fontWeight: 600,
            }}
            aria-label="Enter destination in Singapore"
            autoComplete="off"
            disabled={LOADING_STATUSES.has(status) || status === 'disambiguating'}
          />

          <button
            type="button"
            onClick={() => handleStartRoute(destination)}
            disabled={!canGo}
            className="flex items-center justify-center active:opacity-80 flex-shrink-0 rounded-full"
            style={{
              minWidth: scaleSize(3.5, fontSize),
              height: scaleSize(3.5, fontSize),
              padding: `0 ${scaleSize(1, fontSize)}`,
              backgroundColor: canGo ? colors.accent : withAlpha(colors.background, 0.5),
              color: canGo ? colors.background : colors.text,
              fontSize: scaleRem(1.2, fontSize),
              fontWeight: 900,
              letterSpacing: '0.06em',
            }}
            aria-label={
              canGo
                ? `Start navigation to ${destination}`
                : 'Start navigation (enter a destination first)'
            }
          >
            GO
          </button>
        </div>

        <p
          className="text-center"
          style={{
            color: colors.text,
            fontSize: scaleRem(0.9, fontSize),
            fontWeight: 600,
          }}
        >
          {gpsStatusText(liveLocation)}
        </p>

        {loadingLabel && (
          <p
            className="text-center"
            style={{
              color: colors.accent,
              fontSize: scaleRem(1.1, fontSize),
              fontWeight: 700,
            }}
            aria-live="assertive"
          >
            {loadingLabel}
          </p>
        )}

        {error && (
          <p
            className="text-center"
            style={{
              color: colors.text,
              fontSize: scaleRem(1, fontSize),
              fontWeight: 600,
            }}
            aria-live="assertive"
          >
            {error}
          </p>
        )}

        {status === 'disambiguating' && candidates.length > 0 && (
          <div
            className="w-full max-w-md rounded-2xl p-4 space-y-3"
            style={{ backgroundColor: withAlpha(colors.background, 0.85) }}
            aria-live="polite"
          >
            <p
              style={{
                fontSize: scaleRem(1.1, fontSize),
                fontWeight: 800,
                color: colors.text,
              }}
            >
              Choose destination
            </p>
            <p style={{ fontSize: scaleRem(0.95, fontSize), color: colors.text }}>
              Say next for another option, or tap confirm.
            </p>
            <ul className="space-y-2">
              {candidates.map((candidate, index) => (
                <li key={`${candidate.lat}-${candidate.lon}-${index}`}>
                  <button
                    type="button"
                    onClick={() => selectCandidate(index)}
                    className="w-full text-left rounded-xl px-3 py-3 active:opacity-80"
                    style={{
                      backgroundColor:
                        index === selectedIndex ? colors.accent : withAlpha(colors.background, 0.5),
                      color: index === selectedIndex ? colors.background : colors.text,
                      fontSize: scaleRem(1, fontSize),
                      fontWeight: 700,
                    }}
                    aria-pressed={index === selectedIndex}
                  >
                    {index + 1}. {candidate.name}
                  </button>
                </li>
              ))}
            </ul>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => nextCandidate()}
                className="flex-1 rounded-xl py-3 active:opacity-80"
                style={{
                  backgroundColor: withAlpha(colors.background, 0.5),
                  color: colors.text,
                  fontWeight: 800,
                }}
              >
                NEXT
              </button>
              <button
                type="button"
                onClick={() => void confirmDestination()}
                className="flex-1 rounded-xl py-3 active:opacity-80"
                style={{
                  backgroundColor: colors.accent,
                  color: colors.background,
                  fontWeight: 800,
                }}
              >
                CONFIRM
              </button>
            </div>
          </div>
        )}
      </div>

      {bottomHintBar}
    </div>
  )
}
