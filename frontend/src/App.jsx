import { useCallback, useEffect, useRef, useState } from 'react'

import { CameraView } from './components/CameraView.jsx'
import { FeedbackToast } from './components/FeedbackToast.jsx'
import { QuickControls } from './components/QuickControls.jsx'
import { SettingsDrawer } from './components/SettingsDrawer.jsx'
import { useCameraStream } from './hooks/useCameraStream.js'
import { useChunkRecorder } from './hooks/useChunkRecorder.js'
import { useColorTheme } from './hooks/useColorTheme.js'
import { useInteractionFeedback } from './hooks/useInteractionFeedback.js'
import { useThreatRelay } from './hooks/useThreatRelay.js'
import { useThreatStream } from './hooks/useThreatStream.js'
import { useUploadQueue } from './hooks/useUploadQueue.js'
import { useVoiceCommands } from './hooks/useVoiceCommands.js'
import {
  playTestAudio,
  playWarningAudio,
  primeAudio,
  setAudioVolume,
  setSpeechActivityListener as setAudioSpeechActivityListener,
  stopCurrentAudio,
} from './utils/audioAlert.js'
import { vibrateForSeverity } from './utils/hapticAlert.js'
import {
  getSpeechDiagnostics,
  primeSpeech,
  setSpeechActivityListener as setBrowserSpeechActivityListener,
  setSpeechSettings,
  speakTest,
  speakWarningAsync,
} from './utils/speechAlert.js'

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

function App() {
  const videoRef = useRef(null)
  const [active, setActive] = useState(false)
  const [sessionId, setSessionId] = useState(null)
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
  const recorder = useChunkRecorder()
  const uploadQueue = useUploadQueue()
  const threatStream = useThreatStream(active ? sessionId : null)
  const threatRelay = useThreatRelay(threatStream.latestWarning)

  const latestRelayedWarning = threatRelay.relayedWarnings[0] ?? null
  const cameraError = camera.error
  const recorderError = recorder.error

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

  useEffect(() => {
    if (!active) return

    const stream = camera.getStream()
    const video = videoRef.current
    if (stream && video && video.srcObject !== stream) {
      video.srcObject = stream
      void video.play().catch(() => {})
    }
  }, [active, camera])

  const showToast = useCallback((message) => {
    setToastMessage(message)
    setToastKey((key) => key + 1)
  }, [])

  const startCapture = useCallback(async () => {
    primeAudio()
    primeSpeech()

    const id = crypto.randomUUID()
    uploadQueue.beginSession(id)
    setSessionId(id)

    const stream = await camera.start()
    if (!stream) {
      uploadQueue.endSession()
      setSessionId(null)
      return false
    }

    const onChunk = (blob) => {
      uploadQueue.enqueue(blob, recorder.mimeType ?? blob.type)
    }

    const started = recorder.start(stream, onChunk)
    if (!started) {
      camera.stop()
      uploadQueue.endSession()
      setSessionId(null)
      return false
    }

    setActive(true)
    return true
  }, [camera, recorder, uploadQueue])

  const stopCapture = useCallback(() => {
    recorder.stop()
    camera.stop()
    uploadQueue.endSession()
    setActive(false)
    setSessionId(null)
  }, [camera, recorder, uploadQueue])

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

  const handleToggle = useCallback(async () => {
    if (active) handleStop()
    else await handleStart()
  }, [active, handleStart, handleStop])

  const handleVolumeUp = useCallback(() => {
    setVolume((prev) => {
      const next = Math.min(1, Math.round((prev + 0.1) * 10) / 10)
      showToast(`Volume ${Math.round(next * 100)}%`)
      return next
    })
  }, [showToast])

  const handleVolumeDown = useCallback(() => {
    setVolume((prev) => {
      const next = Math.max(0, Math.round((prev - 0.1) * 10) / 10)
      showToast(`Volume ${Math.round(next * 100)}%`)
      return next
    })
  }, [showToast])

  const handleRepeat = useCallback(async () => {
    const warning = latestRelayedWarning
    if (!warning?.message) return

    stopCurrentAudio()
    primeAudio()

    if (warning.audioUrl) {
      const result = await playWarningAudio(warning.audioUrl, {
        interrupt: true,
        volume,
      })
      if (result.ok) {
        showToast('Repeating…')
        return
      }
    }

    await speakWarningAsync(warning.message, { volume, rate: speechRate })
    showToast('Repeating…')
  }, [latestRelayedWarning, volume, speechRate, showToast])

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
        void handleToggle()
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
  }, [handleToggle, handleVolumeUp, handleVolumeDown])

  const isAnalyzing = active && threatStream.connectionStatus === 'connected'
  const displayError = cameraError ?? recorderError

  const quickControlsProps = {
    isActive: active,
    onToggle: () => void handleToggle(),
    volume,
    onVolumeUp: handleVolumeUp,
    onVolumeDown: handleVolumeDown,
    speaking,
    isAnalyzing,
    lastAnalysis: latestRelayedWarning?.message ?? null,
    colors,
    voiceEnabled,
    onOpenSettings: () => setSettingsOpen(true),
    onRepeat: () => void handleRepeat(),
    feedback,
  }

  const cameraPanel = (
    <div className="flex-1 min-h-0 relative" style={{ minHeight: '45vh' }}>
      <CameraView
        videoRef={videoRef}
        isActive={active}
        error={displayError}
        colors={colors}
        onDoubleTap={() => void handleToggle()}
        onSwipeUp={handleVolumeUp}
        onSwipeDown={handleVolumeDown}
        onLongPress={() => void handleRepeat()}
      />
    </div>
  )

  const controlsPanel = (
    <div style={{ height: '46vh', borderTop: `2px solid ${colors.border}` }}>
      <QuickControls {...quickControlsProps} />
    </div>
  )

  const speechTestError = speechDebug.error
    ? SPEECH_TEST_ERRORS[speechDebug.error] ?? `Speech test failed: ${speechDebug.error}`
    : null

  return (
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

      {layoutInverted ? (
        <>
          <div style={{ borderBottom: `2px solid ${colors.border}` }}>
            <div style={{ height: '46vh' }}>
              <QuickControls {...quickControlsProps} />
            </div>
          </div>
          <div className="flex-1 min-h-0">{cameraPanel}</div>
        </>
      ) : (
        <>
          {cameraPanel}
          {controlsPanel}
        </>
      )}

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
        connectionStatus={threatStream.connectionStatus}
        streamError={threatStream.error}
        active={active}
        colors={colors}
        feedback={feedback}
        developerDetails={{
          colors,
          sessionId,
          lastSequence: uploadQueue.lastSequence,
          uploadStatus: uploadQueue.uploadStatus,
          recorderMimeType: recorder.mimeType,
          active,
          connectionStatus: threatStream.connectionStatus,
          lastSpeechSource: threatRelay.lastSpeechSource,
          speechDebug,
          capabilities: threatRelay.capabilities,
          recorderError,
          cameraError,
        }}
      />
    </div>
  )
}

export default App
