/**
 * @param {number} multiplier Size at fontSize === 1 (e.g. 1.6 for a 1.6rem title)
 * @param {number} fontSize User text-size multiplier (0.5–2)
 */
export function scaleRem(multiplier, fontSize) {
  return `${fontSize * multiplier}rem`
}

/** Layout size in rem (for widths, heights, minHeights, gaps) */
export function scaleSize(multiplier, fontSize) {
  return `${fontSize * multiplier}rem`
}

/**
 * @param {number} multiplier Icon size at fontSize === 1
 * @param {number} fontSize User text-size multiplier (0.5–2)
 * @param {import('react').CSSProperties} [extra]
 */
export function iconStyle(multiplier, fontSize, extra = {}) {
  const size = scaleRem(multiplier, fontSize)
  return { width: size, height: size, flexShrink: 0, ...extra }
}
