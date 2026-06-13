import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router'

import { useApp } from '../context/AppContext.js'
import { NavOverlay } from '../components/navigation/NavOverlay.jsx'
import { WalkingPageHints } from '../components/WalkingPageHints.jsx'
import { useAnnounce } from '../hooks/useAnnounce.js'
import { scaleRem } from '../utils/scaleFont.js'
import { isHorizontalSwipe, horizontalSwipeDirection } from '../utils/swipeGesture.js'
import { withAlpha } from '../utils/withAlpha.js'

const prefersReducedMotion =
  typeof window !== 'undefined' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches

export function WalkingPage() {
  const navigate = useNavigate()
  const {
    videoRef,
    active,
    cameraPreview,
    toggleCapture,
    cameraError,
    reattachCamera,
    hazardMapEnabled,
    colors,
    feedback,
    fontSize,
  } = useApp()
  const announce = useAnnounce()

  const [swipeHint, setSwipeHint] = useState(null)
  const containerRef = useRef(null)
  const hintTimer = useRef(null)

  useEffect(() => {
    const t = setTimeout(() => announce('Camera'), 300)
    return () => clearTimeout(t)
  }, [announce])

  useEffect(() => {
    reattachCamera()
  }, [reattachCamera, active, cameraPreview])

  const showHint = useCallback((msg) => {
    if (hintTimer.current) clearTimeout(hintTimer.current)
    setSwipeHint(msg)
    hintTimer.current = setTimeout(() => setSwipeHint(null), 1200)
  }, [])

  const handleToggle = useCallback(() => {
    void toggleCapture()
  }, [toggleCapture])

  useEffect(() => {
    const el = containerRef.current
    if (!el) return

    let startX = 0
    let startY = 0
    let startTime = 0
    let pointerId = null

    const onPointerDown = (e) => {
      if (e.pointerType === 'mouse' && e.button !== 0) return
      pointerId = e.pointerId
      startX = e.clientX
      startY = e.clientY
      startTime = Date.now()
    }

    const onPointerUp = (e) => {
      if (pointerId !== null && e.pointerId !== pointerId) return
      pointerId = null

      const dx = e.clientX - startX
      const dy = e.clientY - startY
      const absDx = Math.abs(dx)
      const absDy = Math.abs(dy)
      const dist = Math.sqrt(dx * dx + dy * dy)
      const duration = Date.now() - startTime

      if (isHorizontalSwipe(dx, dy, duration)) {
        if (horizontalSwipeDirection(dx) === 'left') {
          feedback.buttonPress()
          showHint('← Navigation')
          setTimeout(() => navigate('/navigation'), 200)
        } else {
          feedback.buttonPress()
          showHint('Settings →')
          setTimeout(() => navigate('/settings'), 200)
        }
      } else if (absDy > 60 && absDy > absDx * 1.5 && dy < 0) {
        feedback.buttonPress()
        showHint('Help')
        announce(
          'Swipe left for navigation, swipe right for settings, and swipe up for help' +
            (hazardMapEnabled ? ', swipe down for hazard map' : '') +
            '. In settings, swipe left or right to change setting, swipe down for home. On navigation, swipe down for home.',
        )
      } else if (
        absDy > 60 &&
        absDy > absDx * 1.5 &&
        dy > 0 &&
        hazardMapEnabled
      ) {
        feedback.buttonPress()
        showHint('Hazard Map ↓')
        setTimeout(() => navigate('/authority'), 200)
      } else if (dist < 22 && duration < 350) {
        handleToggle()
      }
    }

    const onPointerCancel = () => {
      pointerId = null
    }

    el.addEventListener('pointerdown', onPointerDown)
    el.addEventListener('pointerup', onPointerUp)
    el.addEventListener('pointercancel', onPointerCancel)
    return () => {
      el.removeEventListener('pointerdown', onPointerDown)
      el.removeEventListener('pointerup', onPointerUp)
      el.removeEventListener('pointercancel', onPointerCancel)
    }
  }, [navigate, handleToggle, feedback, showHint, announce, hazardMapEnabled])

  return (
    <div
      ref={containerRef}
      className="size-full relative overflow-hidden"
      style={{ backgroundColor: colors.background, touchAction: 'none', userSelect: 'none' }}
      aria-label="Camera view. Tap to toggle analysis. Swipe left for navigation. Swipe right for settings."
    >
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className="absolute inset-0 size-full object-cover"
      />

      {!active && !cameraPreview && (
        <div className="absolute inset-0" style={{ backgroundColor: withAlpha(colors.background, 0.55) }} />
      )}

      {active && (
        <div
          className="absolute top-5 left-5 flex items-center gap-2 px-3 py-1.5 rounded-full"
          style={{
            backgroundColor: withAlpha(colors.background, 0.7),
            border: `2px solid ${colors.accent}`,
          }}
        >
          <span
            className={`w-2 h-2 rounded-full inline-block ${prefersReducedMotion ? '' : 'animate-pulse'}`}
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

      {cameraError && (
        <div className="absolute inset-0 flex items-center justify-center">
          <p
            className="text-center px-8 whitespace-pre-line"
            style={{ color: colors.text, fontSize: '1.1rem' }}
          >
            {cameraError}
          </p>
        </div>
      )}

      {!active && !cameraPreview && !cameraError && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 pointer-events-none">
          <span
            style={{
              fontSize: 'clamp(2rem, 8vw, 3.5rem)',
              fontWeight: 900,
              color: colors.text,
              letterSpacing: '0.08em',
            }}
          >
            TAP TO START
          </span>
          <span style={{ fontSize: 'clamp(0.85rem, 3vw, 1.1rem)', color: colors.text }}>
            Spatial analysis paused
          </span>
        </div>
      )}

      {!active && cameraPreview && !cameraError && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 pointer-events-none">
          <span style={{ fontSize: 'clamp(0.85rem, 3vw, 1.1rem)', color: colors.text }}>
            Camera on — tap again when analysis is ready
          </span>
        </div>
      )}

      {swipeHint && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div
            className="px-8 py-4 rounded-3xl"
            style={{
              backgroundColor: withAlpha(colors.background, 0.82),
              border: `2px solid ${colors.accent}`,
            }}
          >
            <span
              style={{
                fontSize: 'clamp(1.2rem, 5vw, 2rem)',
                fontWeight: 900,
                color: colors.text,
              }}
            >
              {swipeHint}
            </span>
          </div>
        </div>
      )}

      <WalkingPageHints
        colors={colors}
        fontSize={fontSize}
        hazardMapEnabled={hazardMapEnabled}
      />

      <NavOverlay />
    </div>
  )
}
