import { scaleRem } from '../utils/scaleFont.js'

/** @typedef {import('../hooks/useColorTheme.js').ThemeColors} ThemeColors */

/**
 * @param {{
 *   colors: ThemeColors,
 *   fontSize?: number,
 *   sessionId: string | null,
 *   active: boolean,
 *   captureMode?: string,
 *   connectionStatus: string,
 *   analysisMode: string,
 *   analysisCount: number,
 *   chunkCount?: number,
 *   lastChunkBytes?: number,
 *   lastAnalyzedAt: string,
 *   latestDanger: string,
 *   latestAlert: string,
 *   latestAction: string,
 *   latestSafePath: string,
 *   shouldSpeak?: string,
 *   suppressedReason?: string,
 *   lastSpeechSource: string,
 *   speechDebug: { status: string, source: string, speechState: string, error: string | null },
 *   capabilities: { audio: boolean, speech: boolean, vibration: boolean },
 *   analysisError: string | null,
 *   cameraError: string | null,
 *   liveLocationStatus?: string,
 *   liveLocationUpdatedAt?: string,
 *   liveLocationAccuracy?: string,
 *   liveLocationCoords?: string,
 *   liveLocationError?: string | null,
 * }} props
 */
export function DeveloperDetails({
  colors,
  fontSize = 1,
  sessionId,
  active,
  captureMode = '—',
  connectionStatus,
  analysisMode,
  analysisCount,
  chunkCount = 0,
  lastChunkBytes = 0,
  lastAnalyzedAt,
  latestDanger,
  latestAlert,
  latestAction,
  latestSafePath,
  shouldSpeak = '—',
  suppressedReason = '—',
  liveLocationStatus = '—',
  liveLocationUpdatedAt = '—',
  liveLocationAccuracy = '—',
  liveLocationCoords = '—',
  lastSpeechSource,
  speechDebug,
  capabilities,
  analysisError,
  cameraError,
  liveLocationError = null,
}) {
  return (
    <details className="mt-2">
      <summary
        className="cursor-pointer font-semibold select-none"
        style={{ color: colors.text, fontSize: scaleRem(0.875, fontSize) }}
      >
        Developer details
      </summary>

      <dl className="mt-4 grid gap-3" style={{ fontSize: scaleRem(0.75, fontSize) }}>
        <DetailRow label="Session" value={sessionId ?? '—'} colors={colors} fontSize={fontSize} />
        <DetailRow
          label="Capturing"
          value={active ? 'yes' : 'no'}
          colors={colors}
          fontSize={fontSize}
        />
        <DetailRow label="Capture mode" value={captureMode} colors={colors} fontSize={fontSize} />
        <DetailRow
          label="Analysis loop"
          value={connectionStatus}
          colors={colors}
          fontSize={fontSize}
        />
        <DetailRow label="Analysis mode" value={analysisMode} colors={colors} fontSize={fontSize} />
        <DetailRow
          label="Chunks recorded"
          value={String(chunkCount)}
          colors={colors}
          fontSize={fontSize}
        />
        <DetailRow
          label="Last chunk bytes"
          value={lastChunkBytes > 0 ? String(lastChunkBytes) : '—'}
          colors={colors}
          fontSize={fontSize}
        />
        <DetailRow
          label="Analyses completed"
          value={String(analysisCount)}
          colors={colors}
          fontSize={fontSize}
        />
        <DetailRow
          label="Last analyzed"
          value={lastAnalyzedAt}
          colors={colors}
          fontSize={fontSize}
        />
        <DetailRow label="Latest danger" value={latestDanger} colors={colors} fontSize={fontSize} />
        <DetailRow label="Latest alert" value={latestAlert} colors={colors} fontSize={fontSize} />
        <DetailRow
          label="Latest action"
          value={latestAction}
          colors={colors}
          fontSize={fontSize}
        />
        <DetailRow
          label="Safe path"
          value={latestSafePath}
          colors={colors}
          fontSize={fontSize}
        />
        <DetailRow label="Should speak" value={shouldSpeak} colors={colors} fontSize={fontSize} />
        <DetailRow
          label="Suppressed reason"
          value={suppressedReason}
          colors={colors}
          fontSize={fontSize}
        />
        <DetailRow
          label="Location status"
          value={liveLocationStatus}
          colors={colors}
          fontSize={fontSize}
        />
        <DetailRow
          label="Location updated"
          value={liveLocationUpdatedAt}
          colors={colors}
          fontSize={fontSize}
        />
        <DetailRow
          label="Location accuracy"
          value={liveLocationAccuracy}
          colors={colors}
          fontSize={fontSize}
        />
        <DetailRow
          label="Coordinates"
          value={liveLocationCoords}
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
          label="Speech support"
          value={capabilities.speech ? 'yes' : 'no'}
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
        {analysisError && (
          <DetailRow
            label="Analysis error"
            value={analysisError}
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
        {liveLocationError && (
          <DetailRow
            label="Location error"
            value={liveLocationError}
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
      <dt style={{ color: colors.text }}>{label}</dt>
      <dd className="break-all" style={{ color: colors.text }}>
        {value}
      </dd>
    </div>
  )
}
