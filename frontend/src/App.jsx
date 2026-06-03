import { useCallback, useRef, useState } from 'react'

import { useCameraStream } from './hooks/useCameraStream.js'
import { useChunkRecorder } from './hooks/useChunkRecorder.js'
import { useUploadQueue } from './hooks/useUploadQueue.js'

function App() {
  const videoRef = useRef(null)
  const [active, setActive] = useState(false)
  const [sessionId, setSessionId] = useState(null)

  const camera = useCameraStream(videoRef)
  const recorder = useChunkRecorder()
  const uploadQueue = useUploadQueue()

  const startCapture = useCallback(async () => {
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

      {errors.length > 0 && (
        <p className="app__error" role="alert">
          {errors.join(' ')}
        </p>
      )}

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
      </dl>
    </main>
  )
}

export default App
