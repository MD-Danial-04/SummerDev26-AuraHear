import { scaleRem } from '../utils/scaleFont.js'

/** @typedef {import('../hooks/useColorTheme.js').ThemeColors} ThemeColors */

/**
 * @param {{
 *   colors: ThemeColors,
 *   fontSize?: number,
 *   sessionId: string | null,
 *   lastSequence: number,
 *   uploadStatus: string,
 *   recorderMimeType: string | null,
 *   active: boolean,
 *   connectionStatus: string,
 *   lastSpeechSource: string,
 *   speechDebug: { status: string, source: string, speechState: string, error: string | null },
 *   capabilities: { audio: boolean, speech: boolean, vibration: boolean },
 *   recorderError: string | null,
 *   cameraError: string | null,
 * }} props
 */
export function DeveloperDetails({
  colors,
  fontSize = 1,
  sessionId,
  lastSequence,
  uploadStatus,
  recorderMimeType,
  active,
  connectionStatus,
  lastSpeechSource,
  speechDebug,
  capabilities,
  recorderError,
  cameraError,
}) {
  return (
    <details className="mt-2">
      <summary
        className="cursor-pointer font-semibold select-none"
        style={{ color: colors.muted, fontSize: scaleRem(0.875, fontSize) }}
      >
        Developer details
      </summary>

      <dl className="mt-4 grid gap-3" style={{ fontSize: scaleRem(0.75, fontSize) }}>
        <DetailRow label="Session" value={sessionId ?? '—'} colors={colors} fontSize={fontSize} />
        <DetailRow
          label="Last sequence"
          value={lastSequence >= 0 ? String(lastSequence) : '—'}
          colors={colors}
          fontSize={fontSize}
        />
        <DetailRow label="Upload status" value={uploadStatus} colors={colors} fontSize={fontSize} />
        <DetailRow
          label="Recorder MIME"
          value={recorderMimeType ?? '—'}
          colors={colors}
          fontSize={fontSize}
        />
        <DetailRow
          label="Capturing"
          value={active ? 'yes' : 'no'}
          colors={colors}
          fontSize={fontSize}
        />
        <DetailRow
          label="Warning stream"
          value={connectionStatus}
          colors={colors}
          fontSize={fontSize}
        />
        <DetailRow
          label="Speech source"
          value={lastSpeechSource}
          colors={colors}
          fontSize={fontSize}
        />
        <DetailRow
          label="Audio playback"
          value={capabilities.audio ? 'yes' : 'no'}
          colors={colors}
          fontSize={fontSize}
        />
        <DetailRow
          label="Vibration"
          value={capabilities.vibration ? 'yes' : 'no'}
          colors={colors}
          fontSize={fontSize}
        />
        <DetailRow
          label="Speech test"
          value={speechDebug.status}
          colors={colors}
          fontSize={fontSize}
        />
        <DetailRow
          label="Test source"
          value={speechDebug.source}
          colors={colors}
          fontSize={fontSize}
        />
        <DetailRow
          label="Speech state"
          value={speechDebug.speechState}
          colors={colors}
          fontSize={fontSize}
        />
        {speechDebug.error && (
          <DetailRow
            label="Speech error"
            value={speechDebug.error}
            colors={colors}
            fontSize={fontSize}
          />
        )}
        {recorderError && (
          <DetailRow
            label="Recorder error"
            value={recorderError}
            colors={colors}
            fontSize={fontSize}
          />
        )}
        {cameraError && (
          <DetailRow
            label="Camera error"
            value={cameraError}
            colors={colors}
            fontSize={fontSize}
          />
        )}
      </dl>
    </details>
  )
}

/**
 * @param {{ label: string, value: string, colors: ThemeColors, fontSize: number }} props
 */
function DetailRow({ label, value, colors, fontSize }) {
  return (
    <div
      className="grid gap-2"
      style={{ gridTemplateColumns: `${fontSize * 8}rem 1fr` }}
    >
      <dt style={{ color: colors.muted }}>{label}</dt>
      <dd className="break-all" style={{ color: colors.text }}>
        {value}
      </dd>
    </div>
  )
}
