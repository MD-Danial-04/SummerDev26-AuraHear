import { useEffect, useRef, useState } from 'react'
import { Camera, CameraOff } from 'lucide-react'

/** @typedef {import('../hooks/useColorTheme.js').ThemeColors} ThemeColors */

/**
 * @param {{
 *   videoRef: import('react').RefObject<HTMLVideoElement | null>,
 *   isActive: boolean,
 *   error: string | null,
 *   colors: ThemeColors,
 *   onDoubleTap?: () => void,
 *   onSwipeUp?: () => void,
 *   onSwipeDown?: () => void,
 *   onLongPress?: () => void,
 * }} props
 */
export function CameraView({
  videoRef,
  isActive,
  error,
  colors,
  onDoubleTap,
  onSwipeUp,
  onSwipeDown,
  onLongPress,
}) {
  const containerRef = useRef(null)
  const [gestureHint, setGestureHint] = useState(null)
  const hintTimerRef = useRef(null)

  const showVideo = isActive && !error

  useEffect(() => {
    const el = containerRef.current
    if (!el) return

    let startX = 0
    let startY = 0
    let startTime = 0
    let lastTapTime = 0
    let longPressTimer

    const showHint = (msg) => {
      if (hintTimerRef.current) clearTimeout(hintTimerRef.current)
      setGestureHint(msg)
      hintTimerRef.current = setTimeout(() => setGestureHint(null), 1400)
    }

    const onTouchStart = (e) => {
      startX = e.touches[0].clientX
      startY = e.touches[0].clientY
      startTime = Date.now()
      longPressTimer = setTimeout(() => {
        onLongPress?.()
        showHint('Repeat ↺')
      }, 800)
    }

    const onTouchMove = () => clearTimeout(longPressTimer)

    const onTouchEnd = (e) => {
      clearTimeout(longPressTimer)
      const dx = e.changedTouches[0].clientX - startX
      const dy = e.changedTouches[0].clientY - startY
      const duration = Date.now() - startTime
      const dist = Math.sqrt(dx * dx + dy * dy)

      if (dist > 60 && duration < 500 && Math.abs(dy) > Math.abs(dx)) {
        if (dy < 0) {
          onSwipeUp?.()
          showHint('Volume ↑')
        } else {
          onSwipeDown?.()
          showHint('Volume ↓')
        }
      } else if (dist < 20 && duration < 300) {
        const now = Date.now()
        if (now - lastTapTime < 400) {
          onDoubleTap?.()
          showHint('Toggle')
          lastTapTime = 0
        } else {
          lastTapTime = now
        }
      }
    }

    el.addEventListener('touchstart', onTouchStart, { passive: true })
    el.addEventListener('touchmove', onTouchMove, { passive: true })
    el.addEventListener('touchend', onTouchEnd, { passive: true })

    return () => {
      el.removeEventListener('touchstart', onTouchStart)
      el.removeEventListener('touchmove', onTouchMove)
      el.removeEventListener('touchend', onTouchEnd)
      clearTimeout(longPressTimer)
      if (hintTimerRef.current) clearTimeout(hintTimerRef.current)
    }
  }, [onDoubleTap, onSwipeUp, onSwipeDown, onLongPress])

  return (
    <div
      ref={containerRef}
      className="relative size-full flex items-center justify-center overflow-hidden select-none"
      style={{ backgroundColor: '#000000', touchAction: 'none' }}
      aria-label="Camera view. Double-tap to toggle. Swipe up or down to adjust volume. Long-press to repeat."
    >
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className={`absolute inset-0 size-full object-cover ${showVideo ? 'block' : 'hidden'}`}
        aria-hidden="true"
      />

      {error ? (
        <div className="relative z-10 text-center p-8 max-w-sm">
          <CameraOff className="w-14 h-14 mx-auto mb-4" style={{ color: '#FFFFFF' }} />
          <p className="font-semibold mb-2" style={{ color: '#FFFFFF' }}>
            Camera Access Error
          </p>
          <p className="text-sm" style={{ color: '#AAAAAA' }}>{error}</p>
          <p className="text-xs mt-3" style={{ color: '#666666' }}>
            Enable camera permissions in your browser and refresh.
          </p>
        </div>
      ) : !isActive ? (
        <div className="relative z-10 text-center p-8">
          <Camera className="w-16 h-16 mx-auto mb-4" style={{ color: '#333333' }} />
          <p style={{ color: '#555555' }}>Camera paused</p>
          <p className="text-sm mt-2" style={{ color: '#444444' }}>
            Double-tap or press START
          </p>
        </div>
      ) : null}

      {isActive && !error && (
        <div
          className="absolute top-3 left-3 z-10 flex items-center gap-2 px-3 py-1 rounded-full"
          style={{
            backgroundColor: 'rgba(0,0,0,0.75)',
            border: `1.5px solid ${colors.accent}`,
          }}
        >
          <div
            className="w-2 h-2 rounded-full animate-pulse"
            style={{ backgroundColor: colors.accent }}
          />
          <span
            className="text-xs font-bold tracking-widest"
            style={{ color: colors.accent }}
          >
            LIVE
          </span>
        </div>
      )}

      {gestureHint && (
        <div className="absolute inset-0 z-20 flex items-center justify-center pointer-events-none">
          <div
            className="px-8 py-4 rounded-3xl text-2xl font-bold"
            style={{
              backgroundColor: 'rgba(0,0,0,0.85)',
              color: colors.text,
              border: `2px solid ${colors.accent}`,
            }}
          >
            {gestureHint}
          </div>
        </div>
      )}

      <div
        className="absolute bottom-0 inset-x-0 z-10 flex justify-around py-2 px-4"
        style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}
      >
        <span className="text-xs" style={{ color: '#888' }}>
          ↕ Volume
        </span>
        <span className="text-xs" style={{ color: '#888' }}>
          2× Toggle
        </span>
        <span className="text-xs" style={{ color: '#888' }}>
          Hold Repeat
        </span>
      </div>
    </div>
  )
}
