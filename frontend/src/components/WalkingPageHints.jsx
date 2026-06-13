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
          SETTINGS
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
          NAVIGATE
        </span>
      </div>

      <div
        className="absolute bottom-0 inset-x-0 grid grid-cols-3 items-center px-5 py-3 pointer-events-none"
        style={{ backgroundColor: withAlpha(colors.background, 0.6) }}
      >
        <span
          className="justify-self-start"
          style={{
            color: colors.text,
            fontSize: scaleRem(0.9, fontSize),
            letterSpacing: '0.06em',
          }}
        >
          SETTINGS ⟵
        </span>
        <div className="justify-self-center flex flex-col items-center gap-0.5">
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
          className="justify-self-end"
          style={{
            color: colors.text,
            fontSize: scaleRem(0.9, fontSize),
            letterSpacing: '0.06em',
          }}
        >
          NAVIGATE ⟶
        </span>
      </div>
    </>
  )
}
