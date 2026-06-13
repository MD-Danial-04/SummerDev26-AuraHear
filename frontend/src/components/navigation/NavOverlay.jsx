import { useCallback, useEffect, useRef, useState } from 'react'

import { NavRouteMap } from '../map/NavRouteMap.jsx'
import { useApp } from '../../context/AppContext.js'
import { useAnnounce } from '../../hooks/useAnnounce.js'
import { stopCurrentAudio } from '../../utils/audioAlert.js'
import { scaleRem, scaleSize } from '../../utils/scaleFont.js'
import { cancelSpeech } from '../../utils/speechAlert.js'
import { withAlpha } from '../../utils/withAlpha.js'

const LONG_PRESS_MS = 600
const CANCEL_ARM_TIMEOUT_MS = 5000
const SWIPE_DOWN_THRESHOLD = 60

/**
 * @param {{ instruction: string, street_name?: string | null, distance_meters: number } | null} step
 * @param {string} dest
 */
function navInfoAriaLabel(step, dest) {
  if (!step) return `Navigating to ${dest}.`
  const street = step.street_name ?? 'current route'
  const distance =
    step.distance_meters > 0 ? `${Math.round(step.distance_meters)} meters.` : ''
  return `On ${street}. ${step.instruction}. ${distance} Going to ${dest}.`
}

/**
 * Minimal direction overlay shown on the main camera page during active navigation.
 */
export function NavOverlay() {
  const {
    navigation,
    liveLocation,
    layoutInverted,
    colors,
    fontSize,
    feedback,
    showToast,
  } = useApp()
  const announce = useAnnounce()

  const {
    status,
    route,
    currentStep,
    destinationQuery,
    isActiveRoute,
    cancelRoute,
  } = navigation

  const [cancelArmed, setCancelArmed] = useState(false)
  const overlayRef = useRef(null)
  const longPressTimerRef = useRef(null)
  const cancelArmTimerRef = useRef(null)
  const pointerStartRef = useRef({ x: 0, y: 0, id: null })

  const disarmCancel = useCallback(() => {
    if (cancelArmTimerRef.current) {
      clearTimeout(cancelArmTimerRef.current)
      cancelArmTimerRef.current = null
    }
    setCancelArmed(false)
  }, [])

  const armCancel = useCallback(() => {
    feedback.buttonPress()
    setCancelArmed(true)
    announce('Swipe down to confirm cancel. Release to keep route.')
    if (cancelArmTimerRef.current) clearTimeout(cancelArmTimerRef.current)
    cancelArmTimerRef.current = setTimeout(disarmCancel, CANCEL_ARM_TIMEOUT_MS)
  }, [announce, disarmCancel, feedback])

  const handleCancelRoute = useCallback(() => {
    feedback.buttonPress()
    stopCurrentAudio()
    cancelSpeech()
    cancelRoute()
    disarmCancel()
    showToast('Route cancelled')
  }, [cancelRoute, disarmCancel, feedback, showToast])

  useEffect(() => () => {
    if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current)
    if (cancelArmTimerRef.current) clearTimeout(cancelArmTimerRef.current)
  }, [])

  const clearLongPressTimer = useCallback(() => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current)
      longPressTimerRef.current = null
    }
  }, [])

  const onOverlayPointerDown = useCallback(
    (e) => {
      if (e.pointerType === 'mouse' && e.button !== 0) return
      pointerStartRef.current = { x: e.clientX, y: e.clientY, id: e.pointerId }
      clearLongPressTimer()
      if (!cancelArmed) {
        longPressTimerRef.current = setTimeout(armCancel, LONG_PRESS_MS)
      }
    },
    [armCancel, cancelArmed, clearLongPressTimer],
  )

  const onOverlayPointerUp = useCallback(
    (e) => {
      if (pointerStartRef.current.id !== null && e.pointerId !== pointerStartRef.current.id) {
        return
      }
      clearLongPressTimer()
      pointerStartRef.current.id = null

      if (!cancelArmed) return

      const dx = e.clientX - pointerStartRef.current.x
      const dy = e.clientY - pointerStartRef.current.y
      const absDx = Math.abs(dx)
      const absDy = Math.abs(dy)

      if (absDy > SWIPE_DOWN_THRESHOLD && absDy > absDx * 1.5 && dy > 0) {
        e.stopPropagation()
        handleCancelRoute()
        return
      }

      disarmCancel()
    },
    [cancelArmed, clearLongPressTimer, disarmCancel, handleCancelRoute],
  )

  const onOverlayPointerMove = useCallback(
    (e) => {
      if (pointerStartRef.current.id !== e.pointerId) return
      const dx = e.clientX - pointerStartRef.current.x
      const dy = e.clientY - pointerStartRef.current.y
      if (Math.sqrt(dx * dx + dy * dy) > 12) {
        clearLongPressTimer()
      }
    },
    [clearLongPressTimer],
  )

  const onOverlayPointerCancel = useCallback(() => {
    clearLongPressTimer()
    pointerStartRef.current.id = null
  }, [clearLongPressTimer])

  const cancelArmPointerRef = useRef({ x: 0, y: 0 })

  const onCapturePointerDown = useCallback((e) => {
    e.stopPropagation()
    cancelArmPointerRef.current = { x: e.clientX, y: e.clientY }
  }, [])

  const onCapturePointerUp = useCallback(
    (e) => {
      e.stopPropagation()
      const dx = e.clientX - cancelArmPointerRef.current.x
      const dy = e.clientY - cancelArmPointerRef.current.y
      const absDx = Math.abs(dx)
      const absDy = Math.abs(dy)

      if (absDy > SWIPE_DOWN_THRESHOLD && absDy > absDx * 1.5 && dy > 0) {
        handleCancelRoute()
        return
      }

      disarmCancel()
    },
    [disarmCancel, handleCancelRoute],
  )

  if (!isActiveRoute) return null

  const destinationLabel = destinationQuery
  const overlayAnchor = layoutInverted ? 'bottom-24' : 'top-16'

  const directionCard = (
    <div
      ref={overlayRef}
      className="rounded-2xl px-5 py-3 flex flex-col items-center"
      style={{
        backgroundColor: withAlpha(colors.background, 0.75),
        gap: scaleSize(0.35, fontSize),
        outline: cancelArmed ? `2px solid ${colors.accent}` : 'none',
      }}
      aria-live="assertive"
      aria-label={navInfoAriaLabel(currentStep, destinationLabel)}
      onPointerDown={onOverlayPointerDown}
      onPointerUp={onOverlayPointerUp}
      onPointerMove={onOverlayPointerMove}
      onPointerCancel={onOverlayPointerCancel}
    >
      <p
        style={{
          fontSize: scaleRem(1.8, fontSize),
          fontWeight: 900,
          color: colors.accent,
          textAlign: 'center',
          lineHeight: 1.15,
        }}
      >
        {status === 'arrived'
          ? 'You have arrived at your destination'
          : currentStep?.instruction ?? 'Following route'}
      </p>
      {currentStep && currentStep.distance_meters > 0 && status !== 'arrived' && (
        <p
          style={{
            fontSize: scaleRem(1.1, fontSize),
            fontWeight: 700,
            color: colors.text,
            textAlign: 'center',
          }}
        >
          {Math.round(currentStep.distance_meters)} m
        </p>
      )}
      <p
        style={{
          fontSize: scaleRem(0.85, fontSize),
          color: colors.text,
          textAlign: 'center',
          opacity: 0.9,
        }}
      >
        → {destinationLabel}
        {route?.summary ? ` · ${route.summary.estimated_minutes} min` : ''}
      </p>
    </div>
  )

  const routeMapOverlay = route ? (
    <div
      className="rounded-2xl overflow-hidden w-full"
      style={{ backgroundColor: withAlpha(colors.background, 0.75) }}
    >
      <NavRouteMap
        path={route.path}
        userPosition={liveLocation.coordinates}
        destination={route.destination}
        colors={colors}
        fontSize={fontSize}
      />
    </div>
  ) : null

  return (
    <>
      <div
        className={`absolute inset-x-4 z-10 pointer-events-auto flex flex-col gap-2 max-h-[50svh] overflow-y-auto ${overlayAnchor}`}
      >
        {directionCard}
        {routeMapOverlay}
      </div>

      {cancelArmed && (
        <div
          className="absolute inset-0 z-30 flex items-center justify-center px-6"
          style={{ backgroundColor: withAlpha(colors.background, 0.55) }}
          onPointerDown={onCapturePointerDown}
          onPointerUp={onCapturePointerUp}
          aria-live="assertive"
          role="dialog"
          aria-label="Confirm cancel navigation"
        >
          <div
            className="rounded-3xl px-8 py-6 text-center max-w-md"
            style={{
              backgroundColor: withAlpha(colors.background, 0.92),
              outline: `2px solid ${colors.accent}`,
            }}
          >
            <p
              style={{
                fontSize: scaleRem(1.2, fontSize),
                fontWeight: 900,
                color: colors.text,
                lineHeight: 1.3,
              }}
            >
              Swipe down to confirm cancel
            </p>
            <p
              style={{
                fontSize: scaleRem(0.95, fontSize),
                color: colors.text,
                marginTop: scaleSize(0.5, fontSize),
                opacity: 0.85,
              }}
            >
              Release anywhere else to keep route
            </p>
          </div>
        </div>
      )}
    </>
  )
}
