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
 * @param {{
 *   hazards: import('../../utils/hazardGeoJson.js').HazardFeature[],
 *   selectedId: string | null,
 *   onSelect: (hazard: import('../../utils/hazardGeoJson.js').HazardFeature) => void,
 * }} props
 */
export function HazardSidebar({ hazards, selectedId, onSelect }) {
  return (
    <div>
      <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500">
        Reported hazards ({hazards.length})
      </h3>
      <ul className="mt-2 space-y-2">
        {hazards.map((hazard) => {
          const category = getCategoryMeta(hazard.properties.category)
          const severity = getSeverityMeta(hazard.properties.severity)
          const status =
            HAZARD_STATUSES[hazard.properties.status]?.label ??
            hazard.properties.status
          const isSelected = selectedId === hazard.id

          return (
            <li key={hazard.id}>
              <button
                type="button"
                onClick={() => onSelect(hazard)}
                className={`w-full rounded-lg border p-3 text-left transition-colors ${
                  isSelected
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50'
                }`}
              >
                <p className="text-sm font-medium text-gray-900">
                  {hazard.properties.title}
                </p>
                <div className="mt-1 flex flex-wrap gap-1">
                  <span
                    className="rounded px-1.5 py-0.5 text-xs font-medium text-white"
                    style={{ backgroundColor: category.color }}
                  >
                    {category.label}
                  </span>
                  <span
                    className="rounded px-1.5 py-0.5 text-xs font-medium text-white"
                    style={{ backgroundColor: severity.color }}
                  >
                    {severity.label}
                  </span>
                </div>
                <p className="mt-1 text-xs text-gray-500">
                  {status} · {formatDate(hazard.properties.reportedAt)}
                </p>
              </button>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
