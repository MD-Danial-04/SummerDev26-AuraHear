import { MapContainer, TileLayer } from 'react-leaflet'

import {
  OSM_ATTRIBUTION,
  OSM_TILE_URL,
  SINGAPORE_BOUNDS,
  SINGAPORE_CENTER,
  SINGAPORE_DEFAULT_ZOOM,
} from '../../config/singaporeMap.js'
import { MapFlyTo } from './MapFlyTo.jsx'

/**
 * @param {{
 *   children?: import('react').ReactNode,
 *   flyToTarget?: { lat: number, lng: number } | null,
 *   flyToZoom?: number,
 * }} props
 */
export function SingaporeMap({ children, flyToTarget, flyToZoom = 15 }) {
  return (
    <MapContainer
      center={SINGAPORE_CENTER}
      zoom={SINGAPORE_DEFAULT_ZOOM}
      maxBounds={SINGAPORE_BOUNDS}
      maxBoundsViscosity={1.0}
      className="h-full w-full"
      scrollWheelZoom
    >
      <TileLayer attribution={OSM_ATTRIBUTION} url={OSM_TILE_URL} />
      <MapFlyTo target={flyToTarget} zoom={flyToZoom} />
      {children}
    </MapContainer>
  )
}
