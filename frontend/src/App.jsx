import { useCallback, useRef, useState } from 'react'

import { useCameraStream } from './hooks/useCameraStream.js'
import { useChunkRecorder } from './hooks/useChunkRecorder.js'
import { useThreatRelay } from './hooks/useThreatRelay.js'
import { useThreatStream } from './hooks/useThreatStream.js'
import { useUploadQueue } from './hooks/useUploadQueue.js'
import { playTestAudio, primeAudio } from './utils/audioAlert.js'
import { vibrateForSeverity } from './utils/hapticAlert.js'
import { getSpeechDiagnostics, primeSpeech, speakTest } from './utils/speechAlert.js'

const SPEECH_TEST_ERRORS = {
  tts_failed: 'Backend TTS failed. Check server internet connection and edge-tts.',
  network_error: 'Could not reach backend TTS endpoint.',
  unsupported: 'Audio playback is not supported in this browser.',
  not_allowed: 'Audio blocked by the browser. Try clicking Test speech again.',
  no_voices_loaded:
    'System TTS fallback unavailable — no voices loaded on this device.',
}

function App() {
  const videoRef = useRef(null)
  const [active, setActive] = useState(false)
  const [sessionId, setSessionId] = useState(null)
  const [speechDebug, setSpeechDebug] = useState({
    status: 'idle',
    source: 'idle',
    voiceCount: 0,
    speechState: 'idle',
    error: null,
  })

  const camera = useCameraStream(videoRef)
  const recorder = useChunkRecorder()
  const uploadQueue = useUploadQueue()
  const threatStream = useThreatStream(active ? sessionId : null)
  const threatRelay = useThreatRelay(threatStream.latestWarning)

  const latestRelayedWarning = threatRelay.relayedWarnings[0] ?? null

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
      return
    }

    const onChunk = (blob) => {
      uploadQueue.enqueue(blob, recorder.mimeType ?? blob.type)
    }

    const started = recorder.start(stream, onChunk)
    if (!started) {
      camera.stop()
      uploadQueue.endSession()
      setSessionId(null)
      return
    }

    setActive(true)
  }, [camera, recorder, uploadQueue])

  const handleTestSpeech = useCallback(async () => {
    setSpeechDebug((prev) => ({ ...prev, status: 'testing', error: null }))

    vibrateForSeverity('medium')

    const appResult = await playTestAudio()
    if (appResult.ok) {
      setSpeechDebug({
        status: 'ok',
        source: 'app-tts',
        voiceCount: 0,
        speechState: 'playing',
        error: null,
      })
      return
    }

    const fallback = await speakTest()
    const diagnostics = fallback.diagnostics ?? getSpeechDiagnostics()

    setSpeechDebug({
      status: fallback.ok ? 'ok' : (fallback.error ?? appResult.error ?? 'speech_error'),
      source: fallback.ok ? 'system-tts' : (appResult.source ?? 'idle'),
      voiceCount: fallback.voiceCount ?? diagnostics.voiceCount,
      speechState: diagnostics.speechState,
      error: fallback.ok ? null : (appResult.error ?? fallback.error ?? 'speech_error'),
    })
  }, [])

  const stopCapture = useCallback(() => {
    recorder.stop()
    camera.stop()
    uploadQueue.endSession()
    setActive(false)
    setSessionId(null)
  }, [camera, recorder, uploadQueue])

  const errors = [camera.error, recorder.error].filter(Boolean)

  return (
    <main className="app">
      <h1>AuraHear</h1>
      <p className="app__subtitle">Chunked video upload (dev)</p>

      <video
        ref={videoRef}
        className="app__preview"
        muted
        playsInline
        autoPlay
        aria-hidden="true"
      />

      <div className="app__controls">
        <button
          type="button"
          onClick={startCapture}
          disabled={active}
        >
          Start capture
        </button>
        <button
          type="button"
          onClick={stopCapture}
          disabled={!active}
        >
          Stop capture
        </button>
      </div>

      <div className="app__controls app__controls--dev">
        <button type="button" onClick={handleTestSpeech}>
          Test speech
        </button>
      </div>

      {speechDebug.error && (
        <p className="app__speech-debug" role="alert">
          {SPEECH_TEST_ERRORS[speechDebug.error] ?? `Speech test failed: ${speechDebug.error}`}
        </p>
      )}

      {errors.length > 0 && (
        <p className="app__error" role="alert">
          {errors.join(' ')}
        </p>
      )}

      {threatStream.error && (
        <p className="app__error" role="alert">
          {threatStream.error}
        </p>
      )}

      <div
        className="app__warning"
        role="alert"
        aria-live="assertive"
        aria-atomic="true"
      >
        {latestRelayedWarning?.message ?? ''}
      </div>

      <dl className="app__status">
        <div>
          <dt>Session</dt>
          <dd>{sessionId ?? '—'}</dd>
        </div>
        <div>
          <dt>Last sequence</dt>
          <dd>{uploadQueue.lastSequence >= 0 ? uploadQueue.lastSequence : '—'}</dd>
        </div>
        <div>
          <dt>Upload status</dt>
          <dd>{uploadQueue.uploadStatus}</dd>
        </div>
        <div>
          <dt>Recorder MIME</dt>
          <dd>{recorder.mimeType ?? '—'}</dd>
        </div>
        <div>
          <dt>Capturing</dt>
          <dd>{active ? 'yes' : 'no'}</dd>
        </div>
        <div>
          <dt>Warning stream</dt>
          <dd>{threatStream.connectionStatus}</dd>
        </div>
        <div>
          <dt>Last warning</dt>
          <dd>{latestRelayedWarning?.message ?? '—'}</dd>
        </div>
        <div>
          <dt>Audio playback</dt>
          <dd>{threatRelay.capabilities.audio ? 'yes' : 'no'}</dd>
        </div>
        <div>
          <dt>Speech source</dt>
          <dd>{threatRelay.lastSpeechSource}</dd>
        </div>
        <div>
          <dt>Vibration</dt>
          <dd>{threatRelay.capabilities.vibration ? 'yes' : 'no'}</dd>
        </div>
        <div>
          <dt>Speech test</dt>
          <dd>{speechDebug.status}</dd>
        </div>
        <div>
          <dt>Test source</dt>
          <dd>{speechDebug.source}</dd>
        </div>
        <div>
          <dt>Speech state</dt>
          <dd>{speechDebug.speechState}</dd>
        </div>
      </dl>
    </main>
  )
}

export default App
