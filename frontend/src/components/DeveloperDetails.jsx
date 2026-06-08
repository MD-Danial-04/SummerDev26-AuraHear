/** @typedef {import('../hooks/useColorTheme.js').ThemeColors} ThemeColors */

/**
 * @param {{
 *   colors: ThemeColors,
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
        className="cursor-pointer text-sm font-semibold select-none"
        style={{ color: colors.muted }}
      >
        Developer details
      </summary>

      <dl className="mt-4 grid gap-3 text-xs">
        <DetailRow label="Session" value={sessionId ?? '—'} colors={colors} />
        <DetailRow
          label="Last sequence"
          value={lastSequence >= 0 ? String(lastSequence) : '—'}
          colors={colors}
        />
        <DetailRow label="Upload status" value={uploadStatus} colors={colors} />
        <DetailRow label="Recorder MIME" value={recorderMimeType ?? '—'} colors={colors} />
        <DetailRow label="Capturing" value={active ? 'yes' : 'no'} colors={colors} />
        <DetailRow label="Warning stream" value={connectionStatus} colors={colors} />
        <DetailRow label="Speech source" value={lastSpeechSource} colors={colors} />
        <DetailRow
          label="Audio playback"
          value={capabilities.audio ? 'yes' : 'no'}
          colors={colors}
        />
        <DetailRow
          label="Vibration"
          value={capabilities.vibration ? 'yes' : 'no'}
          colors={colors}
        />
        <DetailRow label="Speech test" value={speechDebug.status} colors={colors} />
        <DetailRow label="Test source" value={speechDebug.source} colors={colors} />
        <DetailRow label="Speech state" value={speechDebug.speechState} colors={colors} />
        {speechDebug.error && (
          <DetailRow label="Speech error" value={speechDebug.error} colors={colors} />
        )}
        {recorderError && (
          <DetailRow label="Recorder error" value={recorderError} colors={colors} />
        )}
        {cameraError && (
          <DetailRow label="Camera error" value={cameraError} colors={colors} />
        )}
      </dl>
    </details>
  )
}

/**
 * @param {{ label: string, value: string, colors: ThemeColors }} props
 */
function DetailRow({ label, value, colors }) {
  return (
    <div className="grid grid-cols-[8rem_1fr] gap-2">
      <dt style={{ color: colors.muted }}>{label}</dt>
      <dd className="break-all" style={{ color: colors.text }}>
        {value}
      </dd>
    </div>
  )
}
