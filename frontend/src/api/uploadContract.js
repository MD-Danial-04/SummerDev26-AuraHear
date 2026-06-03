/**
 * Upload contract for POST /api/media/chunk (backend team reference).
 *
 * @typedef {Object} ChunkUploadMeta
 * @property {string} sessionId - UUID for the capture session
 * @property {number} sequence - Monotonic chunk index per session
 * @property {string} capturedAt - ISO8601 timestamp
 * @property {string} mimeType - Blob MIME type (e.g. video/webm)
 */

export const CHUNK_UPLOAD_ENDPOINT = '/api/media/chunk'

export const CHUNK_INTERVAL_MS = 2500

export const CAPTURE_MODE_VIDEO_CHUNK = 'video_chunk'

export const FORM_FIELDS = {
  file: 'file',
  sessionId: 'session_id',
  sequence: 'sequence',
  capturedAt: 'captured_at',
  captureMode: 'capture_mode',
}
