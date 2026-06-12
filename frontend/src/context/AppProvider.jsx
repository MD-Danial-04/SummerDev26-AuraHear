import { useCallback, useEffect, useRef, useState } from 'react'

import { startAnalysisSession } from '../api/sessionAnalysisClient.js'
import { FeedbackToast } from '../components/FeedbackToast.jsx'
import { SettingsDrawer } from '../components/SettingsDrawer.jsx'
import { useCameraStream } from '../hooks/useCameraStream.js'
import { useColorTheme } from '../hooks/useColorTheme.js'
import { useInteractionFeedback } from '../hooks/useInteractionFeedback.js'
import { useChunkVideoAnalysis } from '../hooks/useChunkVideoAnalysis.js'
import { useLiveLocation } from '../hooks/useLiveLocation.js'
import { useVoiceCommands } from '../hooks/useVoiceCommands.js'
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
  'User is walking forward and only needs hazards affecting their path in the next 2 to 3 seconds.'

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
  const [active, setActive] = useState(false)
  const [sessionId, setSessionId] = useState(null)
  const [lastSpeechSource, setLastSpeechSource] = useState('idle')
  const [latestGuidance, setLatestGuidance] = useState(null)
  const [volume, setVolume] = useState(0.8)
  const [speechRate, setSpeechRate] = useState(1)
  const [fontSize, setFontSize] = useState(1)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [voiceEnabled, setVoiceEnabled] = useState(false)
  const [layoutInverted, setLayoutInverted] = useState(false)
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

  const { theme, setTheme, colors } = useColorTheme('white-on-black')
  const feedback = useInteractionFeedback()
  const camera = useCameraStream(videoRef)
  const getCameraStream = useCallback(() => camera.getStream(), [camera])
  const chunkAnalysis = useChunkVideoAnalysis(getCameraStream)
  const liveLocation = useLiveLocation()
  const navSpeechResumeRef = useRef(null)
  const navHazardRerouteRef = useRef(null)
  const cameraError = camera.error

  useEffect(() => {
    setAudioVolume(volume)
    setSpeechSettings({ volume, rate: speechRate })
  }, [volume, speechRate])

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

  }, [active, camera, videoRef])

  useEffect(() => {
    if (!active) return
    reattachCamera()
  }, [active, reattachCamera])

  const showToast = useCallback((message) => {
    setToastMessage(message)
    setToastKey((key) => key + 1)
  }, [])

  const startCapture = useCallback(async () => {
    primeAudio()
    primeSpeech()

    const stream = await camera.start()
    if (!stream) {
      showToast(camera.error ?? 'Failed to access camera.')
      return false
    }

    try {
      const session = await startAnalysisSession({
        context: LIVE_ANALYSIS_CONTEXT,
        alertCooldownSeconds: 6,
      })
      setSessionId(session.session_id)
      chunkAnalysis.start(session.session_id, LIVE_ANALYSIS_CONTEXT, {
        alertCooldownSeconds: 6,
      })
      void liveLocation.requestLocation().catch(() => {})
      setActive(true)
      return true
    } catch (err) {
      camera.stop()
      const message =
        err instanceof Error ? err.message : 'Failed to start live analysis.'
      showToast(message)
      return false
    }
  }, [camera, chunkAnalysis, liveLocation, showToast])

  const stopCapture = useCallback(() => {
    chunkAnalysis.stop()
    liveLocation.stopTracking()
    camera.stop()
    stopCurrentAudio()
    cancelSpeech()
    setActive(false)
    setSessionId(null)
    setLastSpeechSource('idle')
  }, [camera, chunkAnalysis, liveLocation])

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

  const registerNavSpeechResume = useCallback((callback) => {
    navSpeechResumeRef.current = callback
  }, [])

  const unregisterNavSpeechResume = useCallback(() => {
    navSpeechResumeRef.current = null
  }, [])

  const registerNavHazardReroute = useCallback((callback) => {
    navHazardRerouteRef.current = callback
  }, [])

  const unregisterNavHazardReroute = useCallback(() => {
    navHazardRerouteRef.current = null
  }, [])

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
    const result = chunkAnalysis.latestResult
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

    vibrateForSeverity(severity)
    stopCurrentAudio()
    cancelSpeech()

    void speakWarningAsync(result.alert.spoken_alert, {
      severity,
      volume,
      rate: speechRate,
    }).then((speechResult) => {
      setLastSpeechSource(speechResult.ok ? 'system-tts' : 'idle')
      navHazardRerouteRef.current?.(result)
      navSpeechResumeRef.current?.()
    })

    showToast(result.alert.recommended_action)
  }, [chunkAnalysis.latestResult, showToast, speechRate, volume])

  useEffect(() => {
    if (!chunkAnalysis.error) return
    showToast(chunkAnalysis.error)
  }, [chunkAnalysis.error, showToast])

  useVoiceCommands(voiceEnabled, {
    onStart: () => void handleStart(),
    onStop: handleStop,
    onVolumeUp: handleVolumeUp,
    onVolumeDown: handleVolumeDown,
    onRepeat: () => void handleRepeat(),
    onSettings: () => setSettingsOpen(true),
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
    settingsOpen,
    setSettingsOpen,
    voiceEnabled,
    setVoiceEnabled,
    layoutInverted,
    setLayoutInverted,
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
    registerNavSpeechResume,
    unregisterNavSpeechResume,
    registerNavHazardReroute,
    unregisterNavHazardReroute,
    developerDetails: {
      colors,
      sessionId,
      active,
      captureMode: 'video_chunk',
      connectionStatus: chunkAnalysis.status,
      analysisMode: chunkAnalysis.latestResult?.analysis_mode ?? '—',
      analysisCount: chunkAnalysis.analysisCount,
      chunkCount: chunkAnalysis.chunkCount,
      lastChunkBytes: chunkAnalysis.lastChunkBytes,
      lastAnalyzedAt: chunkAnalysis.lastAnalyzedAt ?? '—',
      latestDanger: chunkAnalysis.latestResult?.alert.danger_level ?? '—',
      latestAlert: chunkAnalysis.latestResult?.alert.spoken_alert ?? '—',
      latestAction: chunkAnalysis.latestResult?.alert.recommended_action ?? '—',
      latestSafePath: chunkAnalysis.latestResult?.alert.safe_path ?? '—',
      shouldSpeak:
        chunkAnalysis.latestResult?.should_speak === undefined
          ? '—'
          : String(chunkAnalysis.latestResult.should_speak),
      suppressedReason: chunkAnalysis.latestResult?.suppressed_reason ?? '—',
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
      analysisError: chunkAnalysis.error,
      cameraError,
      liveLocationError: liveLocation.error,
    },
    analysisStatus: chunkAnalysis.status,
    analysisError: chunkAnalysis.error,
  }
}

/** @param {{ children: import('react').ReactNode }} props */
export function AppProvider({ children }) {
  const videoRef = useRef(null)
  const app = useAppState(videoRef)
  const {
    colors,
    fontSize,
    toastMessage,
    toastKey,
    settingsOpen,
    setSettingsOpen,
    speechRate,
    setSpeechRate,
    setFontSize,
    theme,
    handleThemeChange,
    voiceEnabled,
    setVoiceEnabled,
    layoutInverted,
    setLayoutInverted,
    feedback,
    speechTestError,
    handleTestSpeech,
    analysisStatus,
    analysisError,
    active,
    developerDetails,
  } = app

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

        <SettingsDrawer
          open={settingsOpen}
          onClose={() => setSettingsOpen(false)}
          speechRate={speechRate}
          onSpeechRateChange={setSpeechRate}
          fontSize={fontSize}
          onFontSizeChange={setFontSize}
          colorTheme={theme}
          onColorThemeChange={handleThemeChange}
          voiceEnabled={voiceEnabled}
          onVoiceEnabledChange={setVoiceEnabled}
          layoutInverted={layoutInverted}
          onLayoutInvertedChange={setLayoutInverted}
          onTestSpeech={() => void handleTestSpeech()}
          speechTestError={speechTestError}
          connectionStatus={analysisStatus}
          streamError={analysisError}
          active={active}
          colors={colors}
          feedback={feedback}
          developerDetails={developerDetails}
        />
      </div>
    </AppContext.Provider>
  )
}
