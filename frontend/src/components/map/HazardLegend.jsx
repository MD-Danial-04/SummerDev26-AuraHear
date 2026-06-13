import {
  HAZARD_CATEGORIES,
  HAZARD_SEVERITIES,
} from '../../data/hazardTypes.js'

const FIGMA_SEVERITY_COLORS = {
  critical: '#FF3B30',
  high: '#FF3B30',
  medium: '#FF9500',
  low: '#34C759',
}

/**
 * @param {{ colors: import('../../hooks/useColorTheme.js').ThemeColors, fontSize?: number }} props
 */
function LegendContent({ colors, fontSize = 1 }) {
  return (
    <div className="space-y-4">
      <div>
        <h3
          style={{
            fontSize: `${fontSize * 0.75}rem`,
            fontWeight: 700,
            letterSpacing: '0.12em',
            color: colors.text,
          }}
        >
          CATEGORIES
        </h3>
        <ul className="mt-2 space-y-1.5">
          {Object.entries(HAZARD_CATEGORIES).map(([key, meta]) => (
            <li
              key={key}
              className="flex items-center gap-2"
              style={{ fontSize: `${fontSize * 0.9}rem`, color: colors.text }}
            >
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
        <h3
          style={{
            fontSize: `${fontSize * 0.75}rem`,
            fontWeight: 700,
            letterSpacing: '0.12em',
            color: colors.text,
          }}
        >
          SEVERITY
        </h3>
        <ul className="mt-2 space-y-1.5">
          {Object.entries(HAZARD_SEVERITIES).map(([key, meta]) => (
            <li
              key={key}
              className="flex items-center gap-2"
              style={{ fontSize: `${fontSize * 0.9}rem`, color: colors.text }}
            >
              <span
                className="h-3 w-3 shrink-0 rounded-full"
                style={{
                  backgroundColor: FIGMA_SEVERITY_COLORS[key] ?? meta.color,
                }}
              />
              {meta.label}
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}

/**
 * @param {{ colors?: import('../../hooks/useColorTheme.js').ThemeColors, fontSize?: number }} props
 */
export function HazardLegend({ colors, fontSize = 1 }) {
  const themed = colors ?? {
    text: '#111',
    muted: '#666',
    accent: '#000',
    border: '#ccc',
    background: '#fff',
    surface: '#f5f5f5',
  }

  return (
    <>
      <details className="lg:hidden">
        <summary
          className="cursor-pointer"
          style={{ fontWeight: 800, letterSpacing: '0.05em', color: themed.text }}
        >
          LEGEND
        </summary>
        <div className="mt-2">
          <LegendContent colors={themed} fontSize={fontSize} />
        </div>
      </details>

      <div className="hidden lg:block">
        <LegendContent colors={themed} fontSize={fontSize} />
      </div>
    </>
  )
}
