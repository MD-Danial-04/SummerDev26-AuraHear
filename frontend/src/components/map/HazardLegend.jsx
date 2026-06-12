import {
  HAZARD_CATEGORIES,
  HAZARD_SEVERITIES,
} from '../../data/hazardTypes.js'

function LegendContent() {
  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500">
          Categories
        </h3>
        <ul className="mt-2 space-y-1.5">
          {Object.entries(HAZARD_CATEGORIES).map(([key, meta]) => (
            <li key={key} className="flex items-center gap-2 text-sm text-gray-700">
              <span
                className="h-3 w-3 shrink-0 rounded-full"
                style={{ backgroundColor: meta.color }}
              />
              {meta.label}
            </li>
          ))}
        </ul>
      </div>

      <div>
        <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500">
          Severity
        </h3>
        <ul className="mt-2 space-y-1.5">
          {Object.entries(HAZARD_SEVERITIES).map(([key, meta]) => (
            <li key={key} className="flex items-center gap-2 text-sm text-gray-700">
              <span
                className="h-3 w-3 shrink-0 rounded-full"
                style={{ backgroundColor: meta.color }}
              />
              {meta.label}
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}

export function HazardLegend() {
  return (
    <>
      <details className="lg:hidden">
        <summary className="cursor-pointer text-sm font-semibold text-gray-900">
          Legend
        </summary>
        <div className="mt-2">
          <LegendContent />
        </div>
      </details>

      <div className="hidden lg:block">
        <LegendContent />
      </div>
    </>
  )
}
