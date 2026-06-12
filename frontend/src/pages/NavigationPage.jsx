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

import {
  buildNavigationRoute,
  geocodeLocation,
} from '../api/navigationClient.js'
import { CameraView } from '../components/CameraView.jsx'
import { useApp } from '../context/AppContext.js'
import { stopCurrentAudio } from '../utils/audioAlert.js'
import { iconStyle, scaleRem, scaleSize } from '../utils/scaleFont.js'
import { speakWarningAsync } from '../utils/speechAlert.js'

function stepSpeechText(step) {
  return step.spokenInstruction || step.nextInstruction
}

function navInfoAriaLabel(step, destinationName) {
  if (!step) {
    return `Navigation to ${destinationName}`
  }

  if (!step.distanceLabel || step.distanceLabel === '0 m') {
    return `On ${step.currentStreet}. ${step.nextInstruction}. Going to ${destinationName}.`
  }

  return `On ${step.currentStreet}. ${step.nextInstruction}. In ${step.distanceLabel}. Going to ${destinationName}.`
}

function formatDistance(distanceMeters) {
  if (distanceMeters >= 1000) {
    return `${(distanceMeters / 1000).toFixed(1)} km`
  }

  return `${Math.max(0, Math.round(distanceMeters))} m`
}

function routeStepFromApi(step, index, steps) {
  const previousStreet = index > 0 ? steps[index - 1]?.street_name : null
  return {
    currentStreet: step.street_name || previousStreet || 'Walking route',
    nextInstruction: step.instruction,
    spokenInstruction: step.spoken_instruction || step.instruction,
    distanceLabel: formatDistance(step.distance_meters ?? 0),
  }
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
    liveLocation,
    setSettingsOpen,
    showToast,
  } = useApp()

  const [destination, setDestination] = useState('')
  const [activeRoute, setActiveRoute] = useState(false)
  const [currentStep, setCurrentStep] = useState(0)
  const [listening, setListening] = useState(false)
  const [routeSteps, setRouteSteps] = useState([])
  const [routeSummary, setRouteSummary] = useState(null)
  const [routeDestinationName, setRouteDestinationName] = useState('')
  const [routeLoading, setRouteLoading] = useState(false)
  const [routeError, setRouteError] = useState(null)
  const recognitionRef = useRef(null)
  const inputRef = useRef(null)
  const routeActiveRef = useRef(false)
  const routeStepsRef = useRef([])

  const speakInstruction = useCallback(
    async (text, onEnd) => {
      stopCurrentAudio()
      await speakWarningAsync(text, { volume, rate: speechRate, onEnd })
    },
    [volume, speechRate],
  )

  const speakStepAndAdvance = useCallback(
    (stepIndex) => {
      if (!routeActiveRef.current) return

      const step = routeStepsRef.current[stepIndex]
      if (!step) return

      showToast(step.nextInstruction)
      void speakInstruction(stepSpeechText(step), () => {
        if (!routeActiveRef.current) return
        if (step.distanceLabel === '0 m') return

        const nextIndex = stepIndex + 1
        if (nextIndex < routeStepsRef.current.length) {
          setCurrentStep(nextIndex)
          speakStepAndAdvance(nextIndex)
        }
      })
    },
    [showToast, speakInstruction],
  )

  const handleStartRoute = useCallback(
    async (requestedDestination) => {
      const trimmedDestination = requestedDestination.trim()
      if (!trimmedDestination || routeLoading) return

      feedback.togglePress(true)
      setRouteLoading(true)
      setRouteError(null)
      showToast('Finding route...')

      try {
        const origin =
          liveLocation.coordinates ??
          (await liveLocation.requestLocation({
            keepUpdated: true,
          }))
        const geocode = await geocodeLocation(trimmedDestination, { limit: 1 })
        const destinationResult = geocode.results?.[0]
        if (!destinationResult) {
          throw new Error('No matching destination was found.')
        }

        const route = await buildNavigationRoute({
          origin,
          destination: {
            lat: destinationResult.lat,
            lon: destinationResult.lon,
          },
          originName: 'Current location',
          destinationName: destinationResult.name,
        })

        const steps = (route.steps ?? []).map(routeStepFromApi)
        if (steps.length === 0) {
          throw new Error('No route steps were returned for this destination.')
        }

        routeStepsRef.current = steps
        setRouteSteps(steps)
        setRouteSummary(route.summary ?? null)
        setRouteDestinationName(route.destination_name || destinationResult.name)
        setDestination(destinationResult.name)
        setCurrentStep(0)
        setRouteError(null)
        routeActiveRef.current = true
        setActiveRoute(true)
        showToast(`Navigating to ${destinationResult.name}`)
        speakStepAndAdvance(0)
      } catch (error) {
        const message =
          error instanceof Error ? error.message : 'Unable to build a walking route.'
        routeActiveRef.current = false
        routeStepsRef.current = []
        setRouteSteps([])
        setRouteSummary(null)
        setRouteDestinationName('')
        setActiveRoute(false)
        setCurrentStep(0)
        setRouteError(message)
        showToast(message)
      } finally {
        setRouteLoading(false)
      }
    },
    [feedback, liveLocation, routeLoading, showToast, speakStepAndAdvance],
  )

  const handleCancelRoute = useCallback(() => {
    feedback.buttonPress()
    routeActiveRef.current = false
    routeStepsRef.current = []
    stopCurrentAudio()
    setActiveRoute(false)
    setDestination('')
    setCurrentStep(0)
    setRouteSteps([])
    setRouteSummary(null)
    setRouteDestinationName('')
    setRouteError(null)
    showToast('Route cancelled')
  }, [feedback, showToast])

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
      const transcript = e.results[0][0].transcript
      setDestination(transcript)
      if (e.results[0].isFinal) {
        setListening(false)
        void speakInstruction(`Destination set to ${transcript}`)
      }
    }
    rec.onerror = () => {
      setListening(false)
      showToast("Couldn't hear you - try again")
    }
    rec.onend = () => setListening(false)
    rec.start()
    recognitionRef.current = rec
  }, [feedback, showToast, speakInstruction])

  const stopListening = useCallback(() => {
    recognitionRef.current?.stop()
    setListening(false)
  }, [])

  useEffect(() => () => recognitionRef.current?.stop(), [])

  useEffect(() => {
    void liveLocation.requestLocation({
      keepUpdated: true,
      timeout: 12000,
      maximumAge: 10000,
    }).catch(() => {})
  }, [liveLocation])

  const canGo = destination.trim().length > 0 && !routeLoading
  const step = activeRoute ? routeSteps[currentStep] : null

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
          VOLUME - {Math.round(volume * 100)}%
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

  if (!activeRoute) {
    const destinationBar = (
      <div
        className="flex items-stretch mx-4 rounded-2xl overflow-hidden"
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
          aria-label={listening ? 'Stop recording destination' : 'Record destination by voice'}
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
            if (e.key === 'Enter' && canGo) {
              void handleStartRoute(destination)
            }
          }}
          placeholder={listening ? 'Listening...' : 'Destination...'}
          className="flex-1 min-w-0 outline-none"
          style={{
            padding: `0 ${scaleSize(1, fontSize)}`,
            backgroundColor: 'transparent',
            color: colors.text,
            caretColor: colors.accent,
            fontSize: scaleRem(1.2, fontSize),
            fontWeight: 600,
          }}
          aria-label="Enter destination"
          autoComplete="off"
        />

        <button
          type="button"
          onClick={() => void handleStartRoute(destination)}
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
          {routeLoading ? '...' : 'GO'}
        </button>
      </div>
    )

    const routeErrorBanner = routeError ? (
      <div
        className="mx-4 rounded-xl px-4 py-3 text-center"
        style={{
          backgroundColor: colors.surface,
          border: `2px solid ${colors.border}`,
          color: colors.text,
          fontSize: scaleRem(0.95, fontSize),
        }}
      >
        {routeError}
      </div>
    ) : null

    const locationBanner = (
      <div
        className="mx-4 rounded-xl px-4 py-3 text-center"
        style={{
          backgroundColor: colors.surface,
          border: `2px solid ${colors.border}`,
          color: colors.text,
          fontSize: scaleRem(0.95, fontSize),
        }}
      >
        {liveLocation.status === 'tracking' || liveLocation.status === 'ready'
          ? `GPS ready${liveLocation.coordinates?.accuracyMeters != null ? ` • accuracy ${Math.round(liveLocation.coordinates.accuracyMeters)} m` : ''}`
          : liveLocation.status === 'requesting'
            ? 'Requesting GPS location...'
            : liveLocation.status === 'unsupported'
              ? 'GPS is not supported on this device.'
              : liveLocation.error || 'GPS permission is needed for navigation.'}
      </div>
    )

    const bottomRow = (
      <div className="flex">
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
      </div>
    )

    const mainStack = (
      <>
        {cameraZone}
        {destinationBar}
        {locationBanner}
        {routeErrorBanner}
        {bottomRow}
      </>
    )

    const invertedStack = (
      <>
        {bottomRow}
        {routeErrorBanner}
        {locationBanner}
        {destinationBar}
        {cameraZone}
      </>
    )

    return (
      <div className="size-full flex flex-col overflow-hidden">
        {layoutInverted ? invertedStack : mainStack}
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
      aria-label={navInfoAriaLabel(step, routeDestinationName || destination)}
    >
      {routeSummary && (
        <p
          style={{
            fontSize: scaleRem(0.95, fontSize),
            fontWeight: 700,
            color: colors.muted,
            textAlign: 'center',
          }}
        >
          {formatDistance(routeSummary.distance_meters)} - {routeSummary.estimated_minutes} min
        </p>
      )}
      {(liveLocation.status === 'tracking' || liveLocation.status === 'ready') &&
        liveLocation.coordinates && (
          <p
            style={{
              fontSize: scaleRem(0.85, fontSize),
              fontWeight: 600,
              color: colors.muted,
              textAlign: 'center',
            }}
          >
            GPS {liveLocation.coordinates.lat.toFixed(5)}, {liveLocation.coordinates.lon.toFixed(5)}
          </p>
        )}
      <p
        style={{
          fontSize: scaleRem(1.3, fontSize),
          fontWeight: 900,
          color: colors.text,
          textAlign: 'center',
        }}
      >
        {step?.currentStreet}
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
        {step?.nextInstruction}
      </p>
      {step?.distanceLabel !== '0 m' && (
        <p
          style={{
            fontSize: scaleRem(1.1, fontSize),
            fontWeight: 700,
            color: colors.muted,
            textAlign: 'center',
          }}
        >
          {step?.distanceLabel}
        </p>
      )}
      <p
        style={{
          fontSize: scaleRem(0.9, fontSize),
          color: colors.muted,
          textAlign: 'center',
        }}
      >
        Step {currentStep + 1} of {routeSteps.length} to {routeDestinationName || destination}
      </p>
    </div>
  )

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

  const activeStack = (
    <>
      {cameraZone}
      {navInfoZone}
      {volumeBar}
      {cancelBackRow}
    </>
  )

  const activeInverted = (
    <>
      {cancelBackRow}
      {volumeBar}
      {navInfoZone}
      {cameraZone}
    </>
  )

  return (
    <div className="size-full flex flex-col overflow-hidden">
      {layoutInverted ? activeInverted : activeStack}
    </div>
  )
}
