/** Minimum horizontal travel (px) to register a deliberate swipe. */
export const SWIPE_HORIZONTAL_MIN_PX = 40

/** Shorter travel allowed when the swipe is a fast flick (px). */
export const SWIPE_HORIZONTAL_FLICK_MIN_PX = 28

/** Minimum horizontal velocity for flick detection (px/ms). */
export const SWIPE_HORIZONTAL_FLICK_MIN_VELOCITY = 0.35

/** Minimum vertical travel (px) for a vertical swipe. */
export const SWIPE_VERTICAL_MIN_PX = 60

/** Vertical must exceed horizontal by this factor (stricter than horizontal check). */
export const SWIPE_VERTICAL_DOMINANCE_RATIO = 2

/**
 * @param {number} dx
 * @param {number} dy
 * @param {number} [durationMs]
 * @returns {boolean}
 */
export function isHorizontalSwipe(dx, dy, durationMs = 300) {
  const absDx = Math.abs(dx)
  const absDy = Math.abs(dy)

  if (absDx >= SWIPE_HORIZONTAL_MIN_PX && absDx > absDy * 1.1) return true

  return (
    absDx >= SWIPE_HORIZONTAL_FLICK_MIN_PX &&
    absDx > absDy &&
    durationMs > 0 &&
    absDx / durationMs >= SWIPE_HORIZONTAL_FLICK_MIN_VELOCITY
  )
}

/**
 * True when the gesture is clearly vertical and not predominantly horizontal.
 * @param {number} dx
 * @param {number} dy
 * @param {number} [durationMs]
 * @returns {boolean}
 */
export function isVerticalSwipe(dx, dy, durationMs = 300) {
  if (isHorizontalSwipe(dx, dy, durationMs)) return false

  const absDx = Math.abs(dx)
  const absDy = Math.abs(dy)

  if (absDy < SWIPE_VERTICAL_MIN_PX) return false
  return absDy > absDx * SWIPE_VERTICAL_DOMINANCE_RATIO
}

/**
 * Maps finger travel to the content edge being revealed (drag metaphor).
 * Drag right reveals left-side content; drag left reveals right-side content.
 * @param {number} dx
 * @returns {'left' | 'right' | null}
 */
export function horizontalSwipeDirection(dx) {
  if (dx < 0) return 'right'
  if (dx > 0) return 'left'
  return null
}
