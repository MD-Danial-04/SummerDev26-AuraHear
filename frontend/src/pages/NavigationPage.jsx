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
import { useApp } from '../context/AppContext.js'
import { stopCurrentAudio } from '../utils/audioAlert.js'
import { iconStyle, scaleRem, scaleSize } from '../utils/scaleFont.js'
import { speakWarningAsync } from '../utils/speechAlert.js'

const SIMULATED_STEPS = [
  {
    currentStreet: 'Main Street',
    nextInstruction: 'Turn right onto Oak Avenue',
    distance: '80 m',
  },
  {
    currentStreet: 'Oak Avenue',
    nextInstruction: 'Continue straight past the park',
    distance: '200 m',
  },
  {
    currentStreet: 'Oak Avenue',
    nextInstruction: 'Turn left onto Elm Street',
    distance: '120 m',
  },
  {
    currentStreet: 'Elm Street',
    nextInstruction: 'Continue 50 metres to destination',
    distance: '50 m',
  },
  {
    currentStreet: 'Elm Street',
    nextInstruction: 'You have arrived at your destination',
    distance: '0 m',
  },
]

/** @param {typeof SIMULATED_STEPS[number]} step */
function stepSpeechText(step) {
  if (step.distance === '0 m') {
    return step.nextInstruction
  }
  return `${step.nextInstruction}. In ${step.distance}.`
}

/** @param {typeof SIMULATED_STEPS[number]} step */
function navInfoAriaLabel(step, dest) {
  if (step.distance === '0 m') {
    return `On ${step.currentStreet}. ${step.nextInstruction}. Going to ${dest}.`
  }
  return `On ${step.currentStreet}. ${step.nextInstruction}. In ${step.distance}. Going to ${dest}.`
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
  } = useApp()

  const [destination, setDestination] = useState('')
  const [activeRoute, setActiveRoute] = useState(false)
  const [currentStep, setCurrentStep] = useState(0)
  const [listening, setListening] = useState(false)
  const recognitionRef = useRef(null)
  const inputRef = useRef(null)
  const routeActiveRef = useRef(false)

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
      const s = SIMULATED_STEPS[stepIndex]
      if (!s) return

      showToast(s.nextInstruction)
      void speakInstruction(stepSpeechText(s), () => {
        if (!routeActiveRef.current) return
        if (s.distance === '0 m') return

        const nextIndex = stepIndex + 1
        if (nextIndex < SIMULATED_STEPS.length) {
          setCurrentStep(nextIndex)
          speakStepAndAdvance(nextIndex)
        }
      })
    },
    [speakInstruction, showToast],
  )

  const handleStartRoute = useCallback(
    (dest) => {
      if (!dest.trim()) return
      feedback.togglePress(true)
      routeActiveRef.current = true
      setActiveRoute(true)
      setCurrentStep(0)
      showToast(`Navigating to ${dest}`)
      speakStepAndAdvance(0)
    },
    [feedback, showToast, speakStepAndAdvance],
  )

  const handleCancelRoute = useCallback(() => {
    feedback.buttonPress()
    routeActiveRef.current = false
    stopCurrentAudio()
    setActiveRoute(false)
    setDestination('')
    setCurrentStep(0)
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

  useEffect(() => () => recognitionRef.current?.stop(), [])

  const canGo = destination.trim().length > 0
  const step = activeRoute ? SIMULATED_STEPS[currentStep] : null

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

  // ── Destination screen ─────────────────────────────────────────────────────
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
            if (e.key === 'Enter' && canGo) handleStartRoute(destination)
          }}
          placeholder={listening ? 'Listening…' : 'Destination…'}
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
    )

    const backButton = (
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

    const mainStack = (
      <>
        {cameraZone}
        {destinationBar}
        {bottomRow}
      </>
    )

    const invertedStack = (
      <>
        {bottomRow}
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

  // ── Active route screen ────────────────────────────────────────────────────
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
      aria-label={navInfoAriaLabel(step, destination)}
    >
      <p
        style={{
          fontSize: scaleRem(1.3, fontSize),
          fontWeight: 900,
          color: colors.text,
          textAlign: 'center',
        }}
      >
        {step.currentStreet}
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
        {step.nextInstruction}
      </p>
      {step.distance !== '0 m' && (
        <p
          style={{
            fontSize: scaleRem(1.1, fontSize),
            fontWeight: 700,
            color: colors.muted,
            textAlign: 'center',
          }}
        >
          {step.distance}
        </p>
      )}
      <p
        style={{
          fontSize: scaleRem(0.9, fontSize),
          color: colors.muted,
          textAlign: 'center',
        }}
      >
        → {destination}
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
