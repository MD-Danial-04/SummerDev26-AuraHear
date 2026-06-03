import {
  CAPTURE_MODE_VIDEO_CHUNK,
  CHUNK_UPLOAD_ENDPOINT,
  FORM_FIELDS,
} from './uploadContract.js'

/**
 * @param {Blob} blob
 * @param {import('./uploadContract.js').ChunkUploadMeta} meta
 * @returns {Promise<{ ok: boolean, status: number, statusText: string }>}
 */
export async function uploadChunk(blob, meta) {
  const ext = meta.mimeType.includes('mp4') ? 'mp4' : 'webm'
  const formData = new FormData()
  formData.append(FORM_FIELDS.file, blob, `chunk-${meta.sequence}.${ext}`)
  formData.append(FORM_FIELDS.sessionId, meta.sessionId)
  formData.append(FORM_FIELDS.sequence, String(meta.sequence))
  formData.append(FORM_FIELDS.capturedAt, meta.capturedAt)
  formData.append(FORM_FIELDS.captureMode, CAPTURE_MODE_VIDEO_CHUNK)

  const response = await fetch(CHUNK_UPLOAD_ENDPOINT, {
    method: 'POST',
    body: formData,
  })

  return {
    ok: response.ok,
    status: response.status,
    statusText: response.statusText,
  }
}
