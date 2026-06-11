import { useEffect } from 'react'
import { useMap } from 'react-leaflet'

/**
 * Flies the map to a target when it changes.
 * @param {{ lat: number, lng: number } | null} target
 * @param {number} [zoom]
 */
export function MapFlyTo({ target, zoom = 15 }) {
  const map = useMap()

  useEffect(() => {
    if (!target) return
    map.flyTo([target.lat, target.lng], zoom, { duration: 1 })
  }, [target, zoom, map])

  return null
}
