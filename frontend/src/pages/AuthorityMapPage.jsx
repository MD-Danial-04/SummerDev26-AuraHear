import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router'

import { HazardLegend } from '../components/map/HazardLegend.jsx'
import { HazardMarkers } from '../components/map/HazardMarkers.jsx'
import { HazardSidebar } from '../components/map/HazardSidebar.jsx'
import { SingaporeMap } from '../components/map/SingaporeMap.jsx'
import { useApp } from '../context/AppContext.js'
import sampleHazards from '../data/sampleHazards.js'
import { useAnnounce } from '../hooks/useAnnounce.js'
import { parseHazardFeatures } from '../utils/hazardGeoJson.js'

export function AuthorityMapPage() {
  const navigate = useNavigate()
  const { colors, fontSize, feedback } = useApp()
  const announce = useAnnounce()

  const hazards = useMemo(() => parseHazardFeatures(sampleHazards), [])
  const [selectedId, setSelectedId] = useState(null)
  const [flyToTarget, setFlyToTarget] = useState(null)

  useEffect(() => {
    const t = setTimeout(() => {
      announce(`Hazard map. ${hazards.length} reported hazards.`)
    }, 300)
    return () => clearTimeout(t)
  }, [announce, hazards.length])

  const handleSelectHazard = useCallback((hazard) => {
    setSelectedId(hazard.id)
    setFlyToTarget({ lat: hazard.lat, lng: hazard.lng })
  }, [])

  return (
    <div
      className="relative flex h-full min-h-0 flex-1 flex-col"
      style={{
        backgroundColor: colors.background,
        color: colors.text,
        touchAction: 'none',
        userSelect: 'none',
      }}
    >
      <header
        className="flex shrink-0 items-center justify-between px-4 py-3 sm:px-6"
        style={{ borderBottom: `3px solid ${colors.border}` }}
      >
        <div>
          <h1
            style={{
              fontSize: `${fontSize * 1.1}rem`,
              fontWeight: 900,
              letterSpacing: '0.06em',
            }}
          >
            HAZARD MAP
          </h1>
          <p
            className="hidden sm:block"
            style={{
              fontSize: `${fontSize * 0.85}rem`,
              color: colors.text,
              letterSpacing: '0.04em',
            }}
          >
            Singapore infrastructure overview
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            feedback.buttonPress()
            navigate('/')
          }}
          className="rounded-xl px-4 py-2 active:opacity-80"
          style={{
            border: `2px solid ${colors.border}`,
            backgroundColor: colors.surface,
            fontWeight: 800,
            fontSize: `${fontSize * 0.85}rem`,
            letterSpacing: '0.05em',
          }}
        >
          ← Home
        </button>
      </header>

      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        <main className="relative order-1 min-h-[55svh] flex-1 lg:order-none lg:min-h-0">
          <SingaporeMap flyToTarget={flyToTarget}>
            <HazardMarkers hazards={hazards} selectedId={selectedId} />
          </SingaporeMap>
        </main>

        <aside
          className="order-2 flex min-h-0 max-h-[35svh] flex-col gap-4 overflow-y-auto p-4 lg:order-none lg:max-h-none lg:w-80 lg:shrink-0 lg:border-l"
          style={{
            borderTop: `2px solid ${colors.border}`,
            backgroundColor: colors.surface,
          }}
        >
          <HazardLegend colors={colors} fontSize={fontSize} />
          <HazardSidebar
            hazards={hazards}
            selectedId={selectedId}
            onSelect={handleSelectHazard}
            colors={colors}
            fontSize={fontSize}
          />
        </aside>
      </div>
    </div>
  )
}
