import { useEffect } from 'react'

import { NavOverlay } from '../components/navigation/NavOverlay.jsx'
import { WalkingPageHints } from '../components/WalkingPageHints.jsx'
import { useApp } from '../context/AppContext.js'
import { DEMO_USER_POSITION } from '../fixtures/demoNavigationRoute.js'
import { scaleRem } from '../utils/scaleFont.js'
import { withAlpha } from '../utils/withAlpha.js'

/**
 * UI preview for active navigation — no backend or GPS required.
 * Dev only: open /demo/navigation while `npm run dev` is running.
 */
export function NavigationDemoPage() {
  const { navigation, liveLocation, colors, fontSize, hazardMapEnabled, showToast } = useApp()
  const { startDemoRoute, showDemoArrived, cancelRoute } = navigation

  useEffect(() => {
    liveLocation.setDemoLocation(DEMO_USER_POSITION)
    startDemoRoute()
    showToast('Navigation UI demo loaded')

    return () => {
      cancelRoute()
    }
    // Demo bootstraps once on mount; tear down mock route on leave.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div
      className="size-full relative overflow-hidden"
      style={{ backgroundColor: colors.background, touchAction: 'none', userSelect: 'none' }}
    >
      <div
        className="absolute inset-0"
        style={{
          background: `linear-gradient(160deg, ${withAlpha(colors.background, 0.2)} 0%, ${withAlpha(colors.accent, 0.15)} 100%)`,
        }}
      />

      <div
        className="absolute top-5 left-5 z-20 flex flex-col gap-1 max-w-[60%]"
        style={{ pointerEvents: 'none' }}
      >
        <div
          className="flex items-center gap-2 px-3 py-1.5 rounded-full w-fit"
          style={{
            backgroundColor: withAlpha(colors.background, 0.85),
            outline: `2px solid ${colors.accent}`,
          }}
        >
          <span
            className="text-xs font-bold tracking-widest"
            style={{ color: colors.accent }}
          >
            DEMO
          </span>
        </div>
        <p
          style={{
            color: colors.text,
            fontSize: scaleRem(0.75, fontSize),
            opacity: 0.85,
            paddingLeft: '0.25rem',
          }}
        >
          Long-press direction card to test cancel
        </p>
      </div>

      <div className="absolute top-5 right-5 z-20 flex flex-col gap-1">
        <button
          type="button"
          onClick={() => {
            startDemoRoute()
            showToast('Navigating')
          }}
          className="rounded-lg px-3 py-1.5 active:opacity-80"
          style={{
            backgroundColor: colors.accent,
            color: colors.background,
            fontWeight: 800,
            fontSize: scaleRem(0.75, fontSize),
          }}
        >
          NAVIGATING
        </button>
        <button
          type="button"
          onClick={() => {
            showDemoArrived()
            showToast('Arrived')
          }}
          className="rounded-lg px-3 py-1.5 active:opacity-80"
          style={{
            backgroundColor: withAlpha(colors.background, 0.85),
            color: colors.text,
            fontWeight: 800,
            fontSize: scaleRem(0.75, fontSize),
            outline: `1px solid ${colors.text}`,
          }}
        >
          ARRIVED
        </button>
      </div>

      <NavOverlay />

      <WalkingPageHints
        colors={colors}
        fontSize={fontSize}
        hazardMapEnabled={hazardMapEnabled}
      />
    </div>
  )
}
