import { CircleMarker, Popup } from 'react-leaflet'

import {
  getCategoryMeta,
  getSeverityMeta,
  HAZARD_STATUSES,
} from '../../data/hazardTypes.js'

function formatDate(iso) {
  try {
    return new Date(iso).toLocaleDateString('en-SG', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    })
  } catch {
    return iso
  }
}

/**
 * @param {{ hazards: import('../../utils/hazardGeoJson.js').HazardFeature[], selectedId?: string | null }} props
 */
export function HazardMarkers({ hazards, selectedId }) {
  return hazards.map((hazard) => {
    const category = getCategoryMeta(hazard.properties.category)
    const severity = getSeverityMeta(hazard.properties.severity)
    const status =
      HAZARD_STATUSES[hazard.properties.status]?.label ?? hazard.properties.status
    const isSelected = selectedId === hazard.id

    return (
      <CircleMarker
        key={hazard.id}
        center={[hazard.lat, hazard.lng]}
        radius={isSelected ? 12 : 9}
        pathOptions={{
          color: category.color,
          fillColor: category.color,
          fillOpacity: 0.85,
          weight: isSelected ? 3 : 2,
        }}
      >
        <Popup>
          <div className="min-w-[200px] text-sm">
            <p className="font-semibold text-gray-900">{hazard.properties.title}</p>
            <p className="mt-1 text-gray-600">
              <span
                className="inline-block rounded px-1.5 py-0.5 text-xs font-medium text-white"
                style={{ backgroundColor: category.color }}
              >
                {category.label}
              </span>
              <span
                className="ml-1 inline-block rounded px-1.5 py-0.5 text-xs font-medium text-white"
                style={{ backgroundColor: severity.color }}
              >
                {severity.label}
              </span>
            </p>
            <p className="mt-2 text-gray-700">{hazard.properties.description}</p>
            <p className="mt-2 text-xs text-gray-500">
              Status: {status} · Reported {formatDate(hazard.properties.reportedAt)}
            </p>
          </div>
        </Popup>
      </CircleMarker>
    )
  })
}
