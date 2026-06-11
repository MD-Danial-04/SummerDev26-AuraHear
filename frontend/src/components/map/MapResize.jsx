import { useEffect } from 'react'
import { useMap } from 'react-leaflet'

/** Keeps Leaflet tile layout in sync when the map container resizes. */
export function MapResize() {
  const map = useMap()

  useEffect(() => {
    const invalidate = () => {
      map.invalidateSize()
    }

    const frame = requestAnimationFrame(invalidate)
    window.addEventListener('resize', invalidate)

    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener('resize', invalidate)
    }
  }, [map])

  return null
}
