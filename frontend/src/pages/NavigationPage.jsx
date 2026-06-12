import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router'
import {
  ArrowLeft,
  Mic,
  MicOff,
  Settings,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react'

import { CameraView } from '../components/CameraView.jsx'
import { NavRouteMap } from '../components/map/NavRouteMap.jsx'
import { useApp } from '../context/AppContext.js'
import { useWalkingNavigation } from '../hooks/useWalkingNavigation.js'
import { stopCurrentAudio } from '../utils/audioAlert.js'
import { iconStyle, scaleRem, scaleSize } from '../utils/scaleFont.js'
import { cancelSpeech, speakWarningAsync } from '../utils/speechAlert.js'

const LOADING_STATUSES = new Set(['locating', 'geocoding', 'routing'])

/**
 * @param {{ instruction: string, street_name?: string | null, distance_meters: number } | null} step
 * @param {string} dest
 */
function navInfoAriaLabel(step, dest) {
  if (!step) return `Navigating to ${dest}.`
  const street = step.street_name ?? 'current route'
  const distance =
    step.distance_meters > 0 ? `${Math.round(step.distance_meters)} meters.` : ''
  return `On ${street}. ${step.instruction}. ${distance} Going to ${dest}.`
}

export function NavigationPage() {
  const navigate = useNavigate()
  const {
    videoRef,
    cameraError,
    reattachCamera,
    active,
    volume,
    setVolume,
    speechRate,
    fontSize,
    layoutInverted,
    colors,
    feedback,
    setSettingsOpen,
    showToast,
    liveLocation,
    ensureCaptureForNavigation,
    registerNavSpeechResume,
    unregisterNavSpeechResume,
  } = useApp()

  const [destination, setDestination] = useState('')
  const [listening, setListening] = useState(false)
  const recognitionRef = useRef(null)
  const disambiguationRecognitionRef = useRef(null)
  const navigationStatusRef = useRef(status)
  const inputRef = useRef(null)

  useEffect(() => {
    navigationStatusRef.current = status
  }, [status])

  const speakInstruction = useCallback(
    async (text, onEnd) => {
      stopCurrentAudio()
      cancelSpeech()
      await speakWarningAsync(text, { volume, rate: speechRate, onEnd })
    },
    [volume, speechRate],
  )

  const navigation = useWalkingNavigation({
    liveLocation,
    speak: speakInstruction,
    ensureCaptureForNavigation,
  })

  const {
    status,
    error,
    candidates,
    selectedIndex,
    route,
    currentStep,
    destinationQuery,
    isActiveRoute,
    startRoute,
    confirmDestination,
    selectCandidate,
    nextCandidate,
    cancelRoute,
    repeatCurrentStep,
  } = navigation

  useEffect(() => {
    registerNavSpeechResume(repeatCurrentStep)
    return () => unregisterNavSpeechResume()
  }, [registerNavSpeechResume, unregisterNavSpeechResume, repeatCurrentStep])

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
  }, [
    confirmDestination,
    nextCandidate,
    selectCandidate,
    status,
  ])

  const handleStartRoute = useCallback(
    (dest) => {
      if (!dest.trim() || LOADING_STATUSES.has(status)) return
      feedback.togglePress(true)
      showToast(`Navigating to ${dest}`)
      void startRoute(dest)
    },
    [feedback, showToast, startRoute, status],
  )

  const handleCancelRoute = useCallback(() => {
    feedback.buttonPress()
    stopCurrentAudio()
    cancelSpeech()
    cancelRoute()
    setDestination('')
    showToast('Route cancelled')
  }, [cancelRoute, feedback, showToast])

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

  const sliderThumb = scaleSize(2.5, fontSize)
  const sliderTrack = scaleSize(0.75, fontSize)
  const sliderBorder = scaleSize(0.25, fontSize)
  const sliderHitArea = scaleSize(3, fontSize)

  const volumeBar = (
    <div
      className="flex flex-col items-center justify-center gap-3 px-6"
      style={{
        height: '20vh',
        borderTop: `2px solid ${colors.border}`,
        borderBottom: `2px solid ${colors.border}`,
        backgroundColor: colors.surface,
      }}
    >
      <div className="flex items-center justify-between w-full">
        <VolumeX style={iconStyle(2, fontSize, { color: colors.muted })} />
        <span
          style={{
            fontSize: scaleRem(1.1, fontSize),
            fontWeight: 700,
            color: colors.text,
            letterSpacing: '0.04em',
          }}
        >
          VOLUME — {Math.round(volume * 100)}%
        </span>
        <Volume2 style={iconStyle(2, fontSize, { color: colors.accent })} />
      </div>
      <div className="relative w-full flex items-center" style={{ height: sliderHitArea }}>
        <div
          className="absolute inset-y-0 left-0 rounded-full pointer-events-none"
          style={{
            width: `${volume * 100}%`,
            backgroundColor: colors.accent,
            top: '50%',
            height: sliderTrack,
            transform: 'translateY(-50%)',
          }}
        />
        <div
          className="absolute inset-y-0 rounded-full pointer-events-none"
          style={{
            inset: 0,
            top: '50%',
            height: sliderTrack,
            transform: 'translateY(-50%)',
            backgroundColor: colors.background,
            zIndex: 0,
          }}
        />
        <input
          type="range"
          min={0}
          max={100}
          step={5}
          value={Math.round(volume * 100)}
          onChange={(e) => {
            setVolume(parseInt(e.target.value, 10) / 100)
            feedback.sliderChange()
          }}
          className="nav-volume-slider relative w-full"
          style={{
            height: sliderHitArea,
            appearance: 'none',
            WebkitAppearance: 'none',
            background: 'transparent',
            cursor: 'pointer',
            zIndex: 1,
          }}
          aria-label={`Volume, currently ${Math.round(volume * 100)} percent`}
        />
      </div>
      <style>{`
        .nav-volume-slider::-webkit-slider-thumb {
          -webkit-appearance: none;
          width: ${sliderThumb};
          height: ${sliderThumb};
          border-radius: 50%;
          background: ${colors.accent};
          border: ${sliderBorder} solid ${colors.background};
          box-shadow: 0 0 0 2px ${colors.accent};
          cursor: pointer;
        }
        .nav-volume-slider::-moz-range-thumb {
          width: ${sliderThumb};
          height: ${sliderThumb};
          border-radius: 50%;
          background: ${colors.accent};
          border: ${sliderBorder} solid ${colors.background};
          box-shadow: 0 0 0 2px ${colors.accent};
          cursor: pointer;
        }
        .nav-volume-slider::-webkit-slider-runnable-track {
          height: ${sliderTrack};
          border-radius: ${scaleSize(0.375, fontSize)};
          background: transparent;
        }
        .nav-volume-slider::-moz-range-track {
          height: ${sliderTrack};
          border-radius: ${scaleSize(0.375, fontSize)};
          background: transparent;
        }
      `}</style>
    </div>
  )

  const cameraZone = (
    <CameraView
      videoRef={videoRef}
      active={active}
      colors={colors}
      cameraError={cameraError}
      fontSize={fontSize}
      reattachCamera={reattachCamera}
      expanded
    />
  )

  const destinationLabel = destinationQuery || destination

  if (!isActiveRoute) {
    const destinationBar = (
      <div className="mx-4 space-y-3">
        <div
          className="flex items-stretch rounded-2xl overflow-hidden"
          style={{
            minHeight: scaleSize(4.5, fontSize),
            backgroundColor: colors.surface,
            border: `3px solid ${listening ? colors.accent : colors.border}`,
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
            className="flex items-center justify-center active:opacity-80 flex-shrink-0"
            style={{
              width: scaleSize(4.5, fontSize),
              backgroundColor: listening ? colors.accent : colors.background,
              color: listening ? colors.background : colors.text,
              borderRight: `2px solid ${colors.border}`,
            }}
            aria-label={
              listening ? 'Stop recording destination' : 'Record destination by voice'
            }
            aria-pressed={listening}
          >
            {listening ? (
              <MicOff style={iconStyle(2, fontSize)} />
            ) : (
              <Mic style={iconStyle(2, fontSize, { color: colors.accent })} />
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
            className="flex-1 min-w-0 outline-none"
            style={{
              padding: `0 ${scaleSize(1, fontSize)}`,
              backgroundColor: 'transparent',
              color: colors.text,
              caretColor: colors.accent,
              fontSize: scaleRem(1.2, fontSize),
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
            className="flex items-center justify-center active:opacity-80 flex-shrink-0"
            style={{
              minWidth: scaleSize(4, fontSize),
              padding: `0 ${scaleSize(1.25, fontSize)}`,
              backgroundColor: canGo ? colors.accent : colors.background,
              color: canGo ? colors.background : colors.muted,
              borderLeft: `2px solid ${colors.border}`,
              fontSize: scaleRem(1.6, fontSize),
              fontWeight: 900,
              letterSpacing: '0.06em',
              opacity: canGo ? 1 : 0.6,
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
              color: colors.muted,
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
            className="rounded-2xl p-4 space-y-3"
            style={{
              backgroundColor: colors.surface,
              border: `2px solid ${colors.border}`,
            }}
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
            <p style={{ fontSize: scaleRem(0.95, fontSize), color: colors.muted }}>
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
                        index === selectedIndex ? colors.accent : colors.background,
                      color: index === selectedIndex ? colors.background : colors.text,
                      border: `2px solid ${colors.border}`,
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
                  backgroundColor: colors.background,
                  color: colors.text,
                  border: `2px solid ${colors.border}`,
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
    )

    const backButton = (
      <button
        type="button"
        onClick={() => {
          feedback.buttonPress()
          cancelRoute()
          navigate('/')
        }}
        className="flex-1 flex flex-col items-center justify-center gap-3 active:opacity-80 transition-opacity"
        style={{
          backgroundColor: colors.surface,
          color: colors.text,
          borderTop: `2px solid ${colors.border}`,
        }}
        aria-label="Back to walking mode"
      >
        <ArrowLeft style={iconStyle(3, fontSize)} />
        <span
          style={{
            fontSize: scaleRem(1.3, fontSize),
            fontWeight: 800,
            letterSpacing: '0.05em',
          }}
        >
          BACK
        </span>
      </button>
    )

    const settingsButton = (
      <button
        type="button"
        onClick={() => {
          feedback.buttonPress()
          setSettingsOpen(true)
        }}
        className="flex-1 flex flex-col items-center justify-center gap-3 active:opacity-80 transition-opacity"
        style={{
          backgroundColor: colors.surface,
          color: colors.text,
          borderTop: `2px solid ${colors.border}`,
          borderLeft: `2px solid ${colors.border}`,
        }}
        aria-label="Open settings"
      >
        <Settings style={iconStyle(3, fontSize)} />
        <span
          style={{
            fontSize: scaleRem(1.3, fontSize),
            fontWeight: 800,
            letterSpacing: '0.05em',
          }}
        >
          SETTINGS
        </span>
      </button>
    )

    const bottomRow = (
      <div className="flex">
        {backButton}
        {settingsButton}
      </div>
    )

    return (
      <div className="size-full flex flex-col overflow-hidden">
        {layoutInverted ? (
          <>
            {bottomRow}
            {destinationBar}
            {cameraZone}
          </>
        ) : (
          <>
            {cameraZone}
            {destinationBar}
            {bottomRow}
          </>
        )}
      </div>
    )
  }

  const navInfoZone = (
    <div
      className="flex flex-col items-center justify-center px-6"
      style={{
        gap: scaleSize(0.5, fontSize),
        minHeight: scaleSize(6, fontSize),
        backgroundColor: colors.surface,
        borderBottom: `2px solid ${colors.border}`,
      }}
      aria-live="assertive"
      aria-label={navInfoAriaLabel(currentStep, destinationLabel)}
    >
      <p
        style={{
          fontSize: scaleRem(1.3, fontSize),
          fontWeight: 900,
          color: colors.text,
          textAlign: 'center',
        }}
      >
        {currentStep?.street_name ?? (status === 'arrived' ? 'Destination' : 'Walking route')}
      </p>
      <p
        style={{
          fontSize: scaleRem(1.8, fontSize),
          fontWeight: 900,
          color: colors.accent,
          textAlign: 'center',
          lineHeight: 1.15,
        }}
      >
        {status === 'arrived'
          ? 'You have arrived at your destination'
          : currentStep?.instruction ?? 'Following route'}
      </p>
      {currentStep && currentStep.distance_meters > 0 && status !== 'arrived' && (
        <p
          style={{
            fontSize: scaleRem(1.1, fontSize),
            fontWeight: 700,
            color: colors.muted,
            textAlign: 'center',
          }}
        >
          {Math.round(currentStep.distance_meters)} m
        </p>
      )}
      <p
        style={{
          fontSize: scaleRem(0.9, fontSize),
          color: colors.muted,
          textAlign: 'center',
        }}
      >
        → {destinationLabel}
      </p>
    </div>
  )

  const routeMap = route ? (
    <NavRouteMap
      path={route.path}
      userPosition={liveLocation.coordinates}
      destination={route.destination}
      colors={colors}
      fontSize={fontSize}
    />
  ) : null

  const cancelBackRow = (
    <div className="flex" style={{ borderTop: `2px solid ${colors.border}` }}>
      <button
        type="button"
        onClick={handleCancelRoute}
        className="flex-1 flex flex-col items-center justify-center gap-3 active:opacity-80 transition-opacity"
        style={{
          backgroundColor: colors.surface,
          color: colors.text,
          borderRight: `2px solid ${colors.border}`,
          minHeight: '14vh',
        }}
        aria-label="Cancel navigation"
      >
        <X style={iconStyle(3, fontSize)} />
        <span
          style={{
            fontSize: scaleRem(1.3, fontSize),
            fontWeight: 800,
            letterSpacing: '0.05em',
          }}
        >
          CANCEL
        </span>
      </button>
      <button
        type="button"
        onClick={() => {
          feedback.buttonPress()
          navigate('/')
        }}
        className="flex-1 flex flex-col items-center justify-center gap-3 active:opacity-80 transition-opacity"
        style={{
          backgroundColor: colors.surface,
          color: colors.text,
          minHeight: '14vh',
        }}
        aria-label="Back to walking mode"
      >
        <ArrowLeft style={iconStyle(3, fontSize)} />
        <span
          style={{
            fontSize: scaleRem(1.3, fontSize),
            fontWeight: 800,
            letterSpacing: '0.05em',
          }}
        >
          BACK
        </span>
      </button>
    </div>
  )

  return (
    <div className="size-full flex flex-col overflow-hidden">
      {layoutInverted ? (
        <>
          {cancelBackRow}
          {volumeBar}
          {routeMap}
          {navInfoZone}
          {cameraZone}
        </>
      ) : (
        <>
          {cameraZone}
          {navInfoZone}
          {routeMap}
          {volumeBar}
          {cancelBackRow}
        </>
      )}
    </div>
  )
}
