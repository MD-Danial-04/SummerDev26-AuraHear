import {
  getCategoryMeta,
  getSeverityMeta,
  HAZARD_STATUSES,
} from '../../data/hazardTypes.js'

const FIGMA_SEVERITY_COLORS = {
  critical: '#FF3B30',
  high: '#FF3B30',
  medium: '#FF9500',
  low: '#34C759',
}

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
 *   colors?: import('../../hooks/useColorTheme.js').ThemeColors,
 *   fontSize?: number,
 * }} props
 */
export function HazardSidebar({
  hazards,
  selectedId,
  onSelect,
  colors,
  fontSize = 1,
}) {
  const themed = colors ?? {
    text: '#111',
    muted: '#666',
    accent: '#000',
    border: '#ccc',
    background: '#fff',
    surface: '#f5f5f5',
  }

  return (
    <div>
      <h3
        style={{
          fontSize: `${fontSize * 0.75}rem`,
          fontWeight: 700,
          letterSpacing: '0.12em',
          color: themed.text,
        }}
      >
        REPORTED HAZARDS ({hazards.length})
      </h3>
      <ul className="mt-2 space-y-2">
        {hazards.map((hazard) => {
          const category = getCategoryMeta(hazard.properties.category)
          const severity = getSeverityMeta(hazard.properties.severity)
          const severityColor =
            FIGMA_SEVERITY_COLORS[hazard.properties.severity] ?? severity.color
          const status =
            HAZARD_STATUSES[hazard.properties.status]?.label ??
            hazard.properties.status
          const isSelected = selectedId === hazard.id

          return (
            <li key={hazard.id}>
              <button
                type="button"
                onClick={() => onSelect(hazard)}
                className="w-full rounded-xl p-3 text-left transition-colors active:opacity-80 overflow-hidden flex"
                style={{
                  backgroundColor: isSelected ? themed.surface : themed.background,
                  border: `2px solid ${isSelected ? themed.accent : themed.border}`,
                }}
              >
                <span
                  className="w-1.5 shrink-0 rounded-full self-stretch mr-3"
                  style={{ backgroundColor: severityColor }}
                />
                <span className="min-w-0 flex-1">
                  <p
                    style={{
                      fontSize: `${fontSize * 0.9}rem`,
                      fontWeight: 700,
                      color: themed.text,
                    }}
                  >
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
                      style={{ backgroundColor: severityColor }}
                    >
                      {severity.label}
                    </span>
                  </div>
                  <p
                    className="mt-1"
                    style={{ fontSize: `${fontSize * 0.75}rem`, color: themed.text }}
                  >
                    {status} · {formatDate(hazard.properties.reportedAt)}
                  </p>
                </span>
              </button>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
