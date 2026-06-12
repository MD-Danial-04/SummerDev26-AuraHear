const MIME_CANDIDATES = [
  'video/webm;codecs=vp8',
  'video/webm',
  'video/mp4',
]

export function pickRecorderMimeType() {
  if (typeof MediaRecorder === 'undefined') {
    return null
  }
  for (const mime of MIME_CANDIDATES) {
    if (MediaRecorder.isTypeSupported(mime)) {
      return mime
    }
  }
  return ''
}

/**
 * Record one standalone video chunk by stop/restart (valid for ffmpeg).
 * @param {MediaStream} stream
 * @param {number} durationMs
 * @returns {Promise<{ blob: Blob, mimeType: string } | null>}
 */
export function recordChunk(stream, durationMs) {
  if (typeof MediaRecorder === 'undefined') {
    return Promise.resolve(null)
  }

  const selectedMime = pickRecorderMimeType()
  if (selectedMime === null) {
    return Promise.resolve(null)
  }

  return new Promise((resolve, reject) => {
    const parts = []
    const options = selectedMime ? { mimeType: selectedMime } : undefined

    let recorder
    try {
      recorder = new MediaRecorder(stream, options)
    } catch (err) {
      reject(err instanceof Error ? err : new Error('Failed to start recorder.'))
      return
    }

    const mimeType = recorder.mimeType || selectedMime || 'video/webm'
    let timeoutId = null

    const cleanup = () => {
      if (timeoutId !== null) {
        window.clearTimeout(timeoutId)
        timeoutId = null
      }
    }

    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        parts.push(event.data)
      }
    }

    recorder.onstop = () => {
      cleanup()
      if (parts.length === 0) {
        resolve(null)
        return
      }
      resolve({
        blob: new Blob(parts, { type: mimeType }),
        mimeType,
      })
    }

    recorder.onerror = () => {
      cleanup()
      reject(new Error('Recording failed.'))
    }

    recorder.start()
    timeoutId = window.setTimeout(() => {
      if (recorder.state !== 'inactive') {
        recorder.stop()
      }
    }, durationMs)
  })
}
