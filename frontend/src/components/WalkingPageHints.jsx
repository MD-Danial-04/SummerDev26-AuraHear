import { scaleRem } from '../utils/scaleFont.js'
import { withAlpha } from '../utils/withAlpha.js'

/**
 * @param {{
 *   colors: { text: string, background: string },
 *   fontSize: number,
 *   hazardMapEnabled: boolean,
 * }} props
 */
export function WalkingPageHints({ colors, fontSize, hazardMapEnabled }) {
  return (
    <>
      <div className="absolute left-0 top-1/2 -translate-y-1/2 flex flex-col items-center gap-1 pl-3 pointer-events-none">
        <span style={{ color: colors.text, fontSize: '1.6rem' }}>‹</span>
        <span
          style={{
            color: colors.text,
            fontSize: scaleRem(0.85, fontSize),
            letterSpacing: '0.08em',
            writingMode: 'vertical-rl',
            transform: 'rotate(180deg)',
          }}
        >
          NAVIGATE
        </span>
      </div>
      <div className="absolute right-0 top-1/2 -translate-y-1/2 flex flex-col items-center gap-1 pr-3 pointer-events-none">
        <span style={{ color: colors.text, fontSize: '1.6rem' }}>›</span>
        <span
          style={{
            color: colors.text,
            fontSize: scaleRem(0.85, fontSize),
            letterSpacing: '0.08em',
            writingMode: 'vertical-rl',
          }}
        >
          SETTINGS
        </span>
      </div>

      <div
        className="absolute bottom-0 inset-x-0 flex justify-between items-center px-5 py-3 pointer-events-none"
        style={{ backgroundColor: withAlpha(colors.background, 0.6) }}
      >
        <span
          style={{
            color: colors.text,
            fontSize: scaleRem(0.9, fontSize),
            letterSpacing: '0.06em',
          }}
        >
          NAVIGATE ⟵
        </span>
        <div className="flex flex-col items-center gap-0.5">
          <span
            style={{
              color: colors.text,
              fontSize: scaleRem(0.9, fontSize),
              letterSpacing: '0.06em',
            }}
          >
            ↑ HELP
          </span>
          {hazardMapEnabled && (
            <span
              style={{
                color: colors.text,
                fontSize: scaleRem(0.9, fontSize),
                letterSpacing: '0.06em',
              }}
            >
              ↓ HAZARD MAP
            </span>
          )}
        </div>
        <span
          style={{
            color: colors.text,
            fontSize: scaleRem(0.9, fontSize),
            letterSpacing: '0.06em',
          }}
        >
          SETTINGS ⟶
        </span>
      </div>
    </>
  )
}
