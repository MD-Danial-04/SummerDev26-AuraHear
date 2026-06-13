import { useEffect } from 'react'
import { Camera, CameraOff, Play, Square } from 'lucide-react'

import { iconStyle, scaleRem, scaleSize } from '../utils/scaleFont.js'
import { withAlpha } from '../utils/withAlpha.js'

/** @typedef {import('../hooks/useColorTheme.js').ThemeColors} ThemeColors */

/**
 * @param {{
 *   videoRef: import('react').RefObject<HTMLVideoElement | null>,
 *   active: boolean,
 *   colors: ThemeColors,
 *   cameraError: string | null,
 *   fontSize: number,
 *   showControls?: boolean,
 *   onToggle?: () => void,
 *   reattachCamera: () => void,
 *   expanded?: boolean,
 * }} props
 */
export function CameraView({
  videoRef,
  active,
  colors,
  cameraError,
  fontSize,
  showControls = false,
  onToggle,
  reattachCamera,
  expanded = false,
}) {
  useEffect(() => {
    reattachCamera()
  }, [active, reattachCamera])

  const toggleLabel = active ? 'Stop analysis' : 'Start analysis'
  const toggleText = active ? 'STOP' : 'START'

  return (
    <div
      className="relative min-h-0 w-full overflow-hidden"
      style={{
        flex: expanded ? '2 1 0%' : '1 1 0%',
        minHeight: expanded ? '45vh' : undefined,
        backgroundColor: '#000000',
        borderBottom: `2px solid ${colors.border}`,
      }}
      aria-label={
        showControls
          ? 'Camera view with start and stop controls'
          : 'Camera view'
      }
    >
      {!cameraError && (
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="absolute inset-0 size-full object-cover"
          style={{ opacity: active ? 1 : 0 }}
        />
      )}

      {cameraError ? (
        <div className="absolute inset-0 flex flex-col items-center justify-center px-6 text-center gap-3">
          <CameraOff style={iconStyle(3.5, fontSize, { color: colors.text })} />
          <p style={{ fontSize: scaleRem(1.1, fontSize), fontWeight: 700, color: colors.text }}>
            Camera access error
          </p>
          <p style={{ fontSize: scaleRem(0.9, fontSize), color: colors.text }}>{cameraError}</p>
        </div>
      ) : !active ? (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 px-6 text-center">
          <Camera style={iconStyle(4, fontSize, { color: colors.text })} />
          <p style={{ fontSize: scaleRem(1.1, fontSize), color: colors.text }}>
            Camera paused
          </p>
          {showControls && (
            <p style={{ fontSize: scaleRem(0.9, fontSize), color: colors.text }}>
              Press START to begin analysis
            </p>
          )}
        </div>
      ) : null}

      {active && (
        <div
          className="absolute flex items-center gap-2 rounded-full px-3 py-1"
          style={{
            top: scaleSize(0.75, fontSize),
            left: scaleSize(0.75, fontSize),
            backgroundColor: withAlpha(colors.background, 0.75),
            border: `1.5px solid ${colors.accent}`,
            zIndex: 2,
          }}
        >
          <span
            className="rounded-full"
            style={{
              width: scaleSize(0.5, fontSize),
              height: scaleSize(0.5, fontSize),
              backgroundColor: colors.accent,
            }}
          />
          <span
            style={{
              fontSize: scaleRem(0.75, fontSize),
              fontWeight: 700,
              letterSpacing: '0.1em',
              color: colors.accent,
            }}
          >
            LIVE
          </span>
        </div>
      )}

      {showControls && onToggle && (
        <button
          type="button"
          onClick={() => onToggle()}
          className="absolute inset-0 flex flex-col items-center justify-center active:opacity-80 transition-opacity"
          style={{
            gap: scaleSize(0.75, fontSize),
            zIndex: 3,
            backgroundColor: active ? 'transparent' : withAlpha(colors.background, 0.45),
          }}
          aria-label={toggleLabel}
          aria-pressed={active}
        >
          {!active && (
            <>
              <Play style={iconStyle(3, fontSize, { color: colors.accent })} fill="currentColor" />
              <span
                style={{
                  fontSize: scaleRem(1.5, fontSize),
                  fontWeight: 900,
                  letterSpacing: '0.06em',
                  color: colors.accent,
                }}
              >
                {toggleText}
              </span>
            </>
          )}
          {active && (
            <div
              className="flex flex-col items-center justify-center"
              style={{
                gap: scaleSize(0.75, fontSize),
                padding: scaleSize(1.25, fontSize),
                borderRadius: scaleSize(1, fontSize),
                backgroundColor: colors.surface,
                color: colors.accent,
                border: `3px solid ${colors.accent}`,
              }}
            >
              <Square style={iconStyle(3, fontSize)} fill="currentColor" />
              <span
                style={{
                  fontSize: scaleRem(1.5, fontSize),
                  fontWeight: 900,
                  letterSpacing: '0.06em',
                }}
              >
                {toggleText}
              </span>
            </div>
          )}
        </button>
      )}
    </div>
  )
}
