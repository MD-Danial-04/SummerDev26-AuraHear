import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router'

import { startAnalysisSession } from '../api/sessionAnalysisClient.js'
import { FeedbackToast } from '../components/FeedbackToast.jsx'
import { useCameraStream } from '../hooks/useCameraStream.js'
import { useColorTheme } from '../hooks/useColorTheme.js'
import { useInteractionFeedback } from '../hooks/useInteractionFeedback.js'
import { useLiveFrameAnalysis } from '../hooks/useLiveFrameAnalysis.js'
import { useLiveLocation } from '../hooks/useLiveLocation.js'
import { useVoiceCommands } from '../hooks/useVoiceCommands.js'
import { useWalkingNavigation } from '../hooks/useWalkingNavigation.js'
import {
  isAudioPlaybackSupported,
  playTestAudio,
  primeAudio,
  setAudioVolume,
  setSpeechActivityListener as setAudioSpeechActivityListener,
  stopCurrentAudio,
} from '../utils/audioAlert.js'
import { isVibrationSupported, vibrateForSeverity } from '../utils/hapticAlert.js'
import {
  cancelSpeech,
  getSpeechDiagnostics,
  isSpeechSupported,
  primeSpeech,
  setSpeechActivityListener as setBrowserSpeechActivityListener,
  setSpeechSettings,
  speakTest,
  speakWarningAsync,
} from '../utils/speechAlert.js'
import {
  loadPersistedSettings,
  savePersistedSettings,
} from '../utils/persistedSettings.js'

import { AppContext } from './AppContext.js'

const SPEECH_TEST_ERRORS = {
  tts_failed: 'Backend TTS failed. Check server internet connection and edge-tts.',
  network_error: 'Could not reach backend TTS endpoint.',
  unsupported: 'Audio playback is not supported in this browser.',
  not_allowed: 'Audio blocked by the browser. Try clicking Test speech again.',
  no_voices_loaded:
    'System TTS fallback unavailable — no voices loaded on this device.',
}

const THEME_NAMES = {
  'white-on-black': 'White on Black',
  'black-on-white': 'Black on White',
  'yellow-on-black': 'Yellow on Black',
  'green-on-black': 'Green on Black',
}

const LIVE_ANALYSIS_CONTEXT =
  'User is walking forward and needs immediate spoken warnings for hazards or obstacles directly in the path within the next 1 to 2 steps. Warn about walls, closed doors, poles, bollards, bins, chairs, tables, barriers, curbs, stairs, drops, and blocked sidewalks or corridors.'

const HAZARD_SPEECH_COOLDOWN_MS = 8000

const DANGER_RANK = {
  none: 0,
  low: 1,
  medium: 2,
  high: 3,
  critical: 4,
}

function hazardCategory(alert) {
  const hazards = [...(alert?.hazards ?? [])].map((h) => h.toLowerCase()).sort().join(',')
  return `${alert?.danger_level ?? 'none'}|${hazards}`
}

function dangerRank(dangerLevel) {
  return DANGER_RANK[dangerLevel] ?? 0
}

function shouldSpeakHazardNow(alert, lastSpoken, now = Date.now()) {
  const category = hazardCategory(alert)
  const rank = dangerRank(alert.danger_level)

  if (!lastSpoken.category) {
    return true
  }

  if (category !== lastSpoken.category) {
    return true
  }

  if (rank > lastSpoken.rank) {
    return true
  }

  return now - lastSpoken.at >= HAZARD_SPEECH_COOLDOWN_MS
}

function toThreatSeverity(dangerLevel) {
  if (dangerLevel === 'critical') return 'critical'
  if (dangerLevel === 'high') return 'high'
  if (dangerLevel === 'medium') return 'medium'
  return 'low'
}

function shouldAnnounce(result) {
  if (!result?.should_speak) return false
  const alert = result.alert
  if (!alert?.spoken_alert) return false
  if (result.analysis_mode === 'fallback') return true
  if (alert.danger_level === 'none') return false
  if (alert.danger_level === 'low' && alert.hazards.length === 0) return false
  return true
}

/**
 * @param {import('react').RefObject<HTMLVideoElement | null>} videoRef
 */
function useAppState(videoRef) {
  const navigate = useNavigate()
  const persisted = loadPersistedSettings()

  const [active, setActive] = useState(false)
  const [cameraPreview, setCameraPreview] = useState(false)
  const [sessionId, setSessionId] = useState(null)
  const [lastSpeechSource, setLastSpeechSource] = useState('idle')
  const [latestGuidance, setLatestGuidance] = useState(null)
  const [volume, setVolume] = useState(persisted.volume)
  const [speechRate, setSpeechRate] = useState(persisted.speechRate)
  const [fontSize, setFontSize] = useState(persisted.fontSize)
  const [voiceEnabled, setVoiceEnabled] = useState(persisted.voiceEnabled)
  const [layoutInverted, setLayoutInverted] = useState(persisted.layoutInverted)
  const [hazardMapEnabled, setHazardMapEnabled] = useState(persisted.hazardMapEnabled)
  const [toastMessage, setToastMessage] = useState(null)
  const [toastKey, setToastKey] = useState(0)
  const [speaking, setSpeaking] = useState(false)
  const [speechDebug, setSpeechDebug] = useState({
    status: 'idle',
    source: 'idle',
    voiceCount: 0,
    speechState: 'idle',
    error: null,
  })
  const lastSpokenHazardRef = useRef({ category: null, rank: 0, at: 0 })

  const { theme, setTheme, colors } = useColorTheme(persisted.colorTheme)
  const feedback = useInteractionFeedback()
  const camera = useCameraStream(videoRef)
  const frameAnalysis = useLiveFrameAnalysis(videoRef)
  const liveLocation = useLiveLocation()
  const cameraError = camera.error

  const speakInstruction = useCallback(
    async (text, onEnd) => {
      stopCurrentAudio()
      cancelSpeech()
      await speakWarningAsync(text, { volume, rate: speechRate, onEnd })
    },
    [volume, speechRate],
  )

  useEffect(() => {
    setAudioVolume(volume)
    setSpeechSettings({ volume, rate: speechRate })
  }, [volume, speechRate])

  useEffect(() => {
    savePersistedSettings({
      volume,
      speechRate,
      fontSize,
      voiceEnabled,
      layoutInverted,
      hazardMapEnabled,
      colorTheme: theme,
    })
  }, [volume, speechRate, fontSize, voiceEnabled, layoutInverted, hazardMapEnabled, theme])

  useEffect(() => {
    const updateSpeaking = (isSpeaking) => setSpeaking(isSpeaking)
    setAudioSpeechActivityListener(updateSpeaking)
    setBrowserSpeechActivityListener(updateSpeaking)
    return () => {
      setAudioSpeechActivityListener(null)
      setBrowserSpeechActivityListener(null)
    }
  }, [])

  const reattachCamera = useCallback(() => {
    const stream = camera.getStream()
    const video = videoRef.current
    if (stream && video && video.srcObject !== stream) {
      video.srcObject = stream
      void video.play().catch(() => {})
    }

  }, [camera, videoRef])

  useEffect(() => {
    if (!active && !cameraPreview) return
    reattachCamera()
  }, [active, cameraPreview, reattachCamera])

  const showToast = useCallback((message) => {
    setToastMessage(message)
    setToastKey((key) => key + 1)
  }, [])

  const startCapture = useCallback(async () => {
    primeAudio()
    primeSpeech()

    let stream = camera.getStream()
    const tracksLive =
      stream?.getVideoTracks().some((track) => track.readyState === 'live') ?? false
    if (!tracksLive) {
      stream = await camera.start()
    }
    if (!stream) {
      showToast(camera.error ?? 'Failed to access camera.')
      return false
    }

    setCameraPreview(true)
    reattachCamera()

    try {
      const session = await startAnalysisSession({
        context: LIVE_ANALYSIS_CONTEXT,
        alertCooldownSeconds: 6,
      })
      setSessionId(session.session_id)
      frameAnalysis.start(session.session_id, LIVE_ANALYSIS_CONTEXT, {
        alertCooldownSeconds: 6,
      })
      void liveLocation.requestLocation().catch(() => {})
      setActive(true)
      return true
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Failed to start live analysis.'
      showToast(message)
      return false
    }
  }, [camera, frameAnalysis, liveLocation, reattachCamera, showToast])

  const stopCapture = useCallback(() => {
    frameAnalysis.stop()
    liveLocation.stopTracking()
    camera.stop()
    setCameraPreview(false)
    stopCurrentAudio()
    cancelSpeech()
    setActive(false)
    setSessionId(null)
    setLastSpeechSource('idle')
  }, [camera, frameAnalysis, liveLocation])

  const ensureCaptureForNavigation = useCallback(async () => {
    primeAudio()
    primeSpeech()

    if (active) {
      if (
        liveLocation.status === 'idle' ||
        liveLocation.status === 'error' ||
        liveLocation.status === 'unsupported'
      ) {
        try {
          await liveLocation.requestLocation({ keepUpdated: true })
        } catch {
          return false
        }
      }
      return true
    }

    return startCapture()
  }, [active, liveLocation, startCapture])

  const navigation = useWalkingNavigation({
    liveLocation,
    speak: speakInstruction,
    ensureCaptureForNavigation,
  })

  const { handleHazardDuringNav } = navigation

  const handleStart = useCallback(async () => {
    if (!active) {
      feedback.togglePress(true)
      const started = await startCapture()
      if (started) {
        showToast('Analysis started')
      }
    }
  }, [active, feedback, startCapture, showToast])

  const handleStop = useCallback(() => {
    if (active) {
      feedback.togglePress(false)
      stopCapture()
      showToast('Analysis stopped')
    }
  }, [active, feedback, stopCapture, showToast])

  const toggleCapture = useCallback(async () => {
    if (active) handleStop()
    else await handleStart()
  }, [active, handleStart, handleStop])

  const handleVolumeUp = useCallback(() => {
    setVolume((prev) => {
      const next = Math.min(1, Math.round((prev + 0.1) * 10) / 10)
      showToast(`Volume ${Math.round(next * 100)}%`)
      return next
    })
    feedback.buttonPress()
  }, [showToast, feedback])

  const handleVolumeDown = useCallback(() => {
    setVolume((prev) => {
      const next = Math.max(0, Math.round((prev - 0.1) * 10) / 10)
      showToast(`Volume ${Math.round(next * 100)}%`)
      return next
    })
    feedback.buttonPress()
  }, [showToast, feedback])

  const handleRepeat = useCallback(async () => {
    if (!latestGuidance?.message) return

    stopCurrentAudio()
    cancelSpeech()
    primeAudio()
    const result = await speakWarningAsync(latestGuidance.message, {
      severity: latestGuidance.severity,
      volume,
      rate: speechRate,
    })
    setLastSpeechSource(result.ok ? 'system-tts' : 'idle')
    showToast('Repeating…')
  }, [latestGuidance, volume, speechRate, showToast])

  const handleThemeChange = useCallback(
    (newTheme) => {
      setTheme(newTheme)
      showToast(`Theme: ${THEME_NAMES[newTheme]}`)
    },
    [setTheme, showToast],
  )

  const handleTestSpeech = useCallback(async () => {
    primeAudio()
    primeSpeech()
    stopCurrentAudio()

    setSpeechDebug((prev) => ({ ...prev, status: 'testing', error: null }))

    vibrateForSeverity('medium')

    const appResult = await playTestAudio({ volume })
    if (appResult.ok) {
      setSpeechDebug({
        status: 'ok',
        source: 'app-tts',
        voiceCount: 0,
        speechState: 'playing',
        error: null,
      })
      showToast('Speech test playing')
      return
    }

    const fallback = await speakTest({ volume, rate: speechRate })
    const diagnostics = fallback.diagnostics ?? getSpeechDiagnostics()

    if (fallback.ok) {
      showToast('Speech test playing')
    }

    setSpeechDebug({
      status: fallback.ok ? 'ok' : (fallback.error ?? appResult.error ?? 'speech_error'),
      source: fallback.ok ? 'system-tts' : (appResult.source ?? 'idle'),
      voiceCount: fallback.voiceCount ?? diagnostics.voiceCount,
      speechState: diagnostics.speechState,
      error: fallback.ok ? null : (appResult.error ?? fallback.error ?? 'speech_error'),
    })
  }, [volume, speechRate, showToast])

  useEffect(() => {
    const result = frameAnalysis.latestResult
    if (!result) return

    const severity = toThreatSeverity(result.alert.danger_level)
    setLatestGuidance({
      message: result.alert.spoken_alert,
      severity,
      recommendedAction: result.alert.recommended_action,
      safePath: result.alert.safe_path,
      hazards: result.alert.hazards,
      analysisMode: result.analysis_mode ?? 'reka',
    })

    if (!shouldAnnounce(result)) {
      return
    }

    const now = Date.now()
    if (!shouldSpeakHazardNow(result.alert, lastSpokenHazardRef.current, now)) {
      return
    }

    lastSpokenHazardRef.current = {
      category: hazardCategory(result.alert),
      rank: dangerRank(result.alert.danger_level),
      at: now,
    }

    vibrateForSeverity(severity)
    stopCurrentAudio()
    cancelSpeech()

    void speakWarningAsync(result.alert.spoken_alert, {
      severity,
      volume,
      rate: speechRate,
    }).then((speechResult) => {
      setLastSpeechSource(speechResult.ok ? 'system-tts' : 'idle')
      handleHazardDuringNav(result)
    })

    showToast(result.alert.recommended_action)
  }, [
    frameAnalysis.latestResult,
    handleHazardDuringNav,
    showToast,
    speechRate,
    volume,
  ])

  useEffect(() => {
    if (!frameAnalysis.error) return
    showToast(frameAnalysis.error)
  }, [frameAnalysis.error, showToast])

  useVoiceCommands(voiceEnabled, {
    onStart: () => void handleStart(),
    onStop: handleStop,
    onVolumeUp: handleVolumeUp,
    onVolumeDown: handleVolumeDown,
    onRepeat: () => void handleRepeat(),
    onSettings: () => navigate('/settings'),
    onCommandRecognized: (cmd) => showToast(`Voice: ${cmd}`),
  })

  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.target !== document.body) return
      if (e.code === 'Space') {
        e.preventDefault()
        void toggleCapture()
      } else if (e.code === 'ArrowUp') {
        e.preventDefault()
        handleVolumeUp()
      } else if (e.code === 'ArrowDown') {
        e.preventDefault()
        handleVolumeDown()
      } else if (e.code === 'ArrowRight') {
        e.preventDefault()
        setSpeechRate((r) => Math.min(2, Math.round((r + 0.1) * 10) / 10))
      } else if (e.code === 'ArrowLeft') {
        e.preventDefault()
        setSpeechRate((r) => Math.max(0.5, Math.round((r - 0.1) * 10) / 10))
      } else if (e.code === 'Equal' && !e.shiftKey) {
        e.preventDefault()
        setFontSize((f) => Math.min(2, Math.round((f + 0.1) * 10) / 10))
      } else if (e.code === 'Minus') {
        e.preventDefault()
        setFontSize((f) => Math.max(0.5, Math.round((f - 0.1) * 10) / 10))
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [toggleCapture, handleVolumeUp, handleVolumeDown])

  const speechTestError = speechDebug.error
    ? SPEECH_TEST_ERRORS[speechDebug.error] ?? `Speech test failed: ${speechDebug.error}`
    : null

  return {
    videoRef,
    cameraError,
    reattachCamera,
    active,
    cameraPreview,
    toggleCapture,
    handleStart,
    handleStop,
    volume,
    setVolume,
    handleVolumeUp,
    handleVolumeDown,
    speechRate,
    setSpeechRate,
    fontSize,
    setFontSize,
    voiceEnabled,
    setVoiceEnabled,
    layoutInverted,
    setLayoutInverted,
    hazardMapEnabled,
    setHazardMapEnabled,
    theme,
    colors,
    handleThemeChange,
    feedback,
    speaking,
    showToast,
    toastMessage,
    toastKey,
    speechTestError,
    handleTestSpeech,
    liveLocation,
    ensureCaptureForNavigation,
    speakInstruction,
    navigation,
    developerDetails: {
      colors,
      sessionId,
      active,
      captureMode: 'frame',
      connectionStatus: frameAnalysis.status,
      analysisMode: frameAnalysis.latestResult?.analysis_mode ?? '—',
      analysisCount: frameAnalysis.analysisCount,
      lastAnalyzedAt: frameAnalysis.lastAnalyzedAt ?? '—',
      latestDanger: frameAnalysis.latestResult?.alert.danger_level ?? '—',
      latestAlert: frameAnalysis.latestResult?.alert.spoken_alert ?? '—',
      latestAction: frameAnalysis.latestResult?.alert.recommended_action ?? '—',
      latestSafePath: frameAnalysis.latestResult?.alert.safe_path ?? '—',
      shouldSpeak:
        frameAnalysis.latestResult?.should_speak === undefined
          ? '—'
          : String(frameAnalysis.latestResult.should_speak),
      suppressedReason: frameAnalysis.latestResult?.suppressed_reason ?? '—',
      liveLocationStatus: liveLocation.status,
      liveLocationUpdatedAt: liveLocation.updatedAt ?? '—',
      liveLocationAccuracy:
        liveLocation.coordinates?.accuracyMeters != null
          ? `${Math.round(liveLocation.coordinates.accuracyMeters)} m`
          : '—',
      liveLocationCoords: liveLocation.coordinates
        ? `${liveLocation.coordinates.lat.toFixed(6)}, ${liveLocation.coordinates.lon.toFixed(6)}`
        : '—',
      lastSpeechSource,
      speechDebug,
      capabilities: {
        audio: isAudioPlaybackSupported(),
        speech: isSpeechSupported(),
        vibration: isVibrationSupported(),
      },
      analysisError: frameAnalysis.error,
      cameraError,
      liveLocationError: liveLocation.error,
    },
    analysisStatus: frameAnalysis.status,
    analysisError: frameAnalysis.error,
  }
}

/** @param {{ children: import('react').ReactNode }} props */
export function AppProvider({ children }) {
  const videoRef = useRef(null)
  const app = useAppState(videoRef)
  const { colors, fontSize, toastMessage, toastKey } = app

  return (
    <AppContext.Provider value={app}>
      <div
        className="size-full flex flex-col overflow-hidden"
        style={{
          fontSize: `${fontSize}rem`,
          backgroundColor: colors.background,
          color: colors.text,
        }}
      >
        {toastMessage && (
          <FeedbackToast message={toastMessage} colors={colors} key={toastKey} />
        )}

        {children}
      </div>
    </AppContext.Provider>
  )
}
