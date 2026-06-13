import { useState } from 'react'
import { CircleMarker, Polyline } from 'react-leaflet'

import { SingaporeMap } from './SingaporeMap.jsx'

/**
 * @param {{
 *   path: Array<{ lat: number, lon: number }>,
 *   userPosition?: { lat: number, lon: number } | null,
 *   destination?: { lat: number, lon: number } | null,
 *   colors: { accent: string, text: string, border: string, surface: string },
 *   fontSize: number,
 * }} props
 */
export function NavRouteMap({
  path,
  userPosition,
  destination,
  colors,
  fontSize,
}) {
  const [expanded, setExpanded] = useState(false)

  const pathLatLngs = path.map((point) => [point.lat, point.lon])
  const flyTarget = userPosition
    ? { lat: userPosition.lat, lng: userPosition.lon }
    : destination
      ? { lat: destination.lat, lng: destination.lon }
      : null

  return (
    <div>
      <button
        type="button"
        onClick={() => setExpanded((open) => !open)}
        className="w-full flex items-center justify-between px-4 py-3 active:opacity-80"
        style={{
          color: colors.text,
          fontSize: `${Math.max(0.9, fontSize * 0.85)}rem`,
          fontWeight: 700,
        }}
        aria-expanded={expanded}
        aria-controls="nav-route-map-panel"
      >
        <span>{expanded ? 'Hide route map' : 'Show route map'}</span>
        <span aria-hidden="true">{expanded ? '▲' : '▼'}</span>
      </button>

      {expanded && (
        <div
          id="nav-route-map-panel"
          className="px-4 pb-4"
          style={{ height: '28svh', minHeight: 180 }}
          aria-label="Walking route map for visual reference"
        >
          <div className="h-full w-full overflow-hidden rounded-xl border border-gray-300">
            <SingaporeMap flyToTarget={flyTarget} flyToZoom={16}>
              {pathLatLngs.length > 1 && (
                <Polyline
                  positions={pathLatLngs}
                  pathOptions={{ color: colors.accent, weight: 5, opacity: 0.85 }}
                />
              )}
              {destination && (
                <CircleMarker
                  center={[destination.lat, destination.lon]}
                  radius={8}
                  pathOptions={{ color: colors.text, fillColor: colors.text, fillOpacity: 0.9 }}
                />
              )}
              {userPosition && (
                <CircleMarker
                  center={[userPosition.lat, userPosition.lon]}
                  radius={8}
                  pathOptions={{ color: colors.accent, fillColor: colors.accent, fillOpacity: 0.95 }}
                />
              )}
            </SingaporeMap>
          </div>
        </div>
      )}
    </div>
  )
}
