import { useMemo, useState } from 'react'
import { Link } from 'react-router'

import { HazardLegend } from '../components/map/HazardLegend.jsx'
import { HazardMarkers } from '../components/map/HazardMarkers.jsx'
import { HazardSidebar } from '../components/map/HazardSidebar.jsx'
import { SingaporeMap } from '../components/map/SingaporeMap.jsx'
import sampleHazards from '../data/sampleHazards.js'
import { parseHazardFeatures } from '../utils/hazardGeoJson.js'

export function AuthorityMapPage() {
  const hazards = useMemo(() => parseHazardFeatures(sampleHazards), [])
  const [selectedId, setSelectedId] = useState(null)
  const [flyToTarget, setFlyToTarget] = useState(null)

  const handleSelectHazard = (hazard) => {
    setSelectedId(hazard.id)
    setFlyToTarget({ lat: hazard.lat, lng: hazard.lng })
  }

  return (
    <div className="flex h-svh flex-col bg-gray-100">
      <header className="flex shrink-0 items-center justify-between border-b border-gray-200 bg-white px-4 py-3 sm:px-6">
        <div>
          <h1 className="text-lg font-semibold text-gray-900">AuraHear — Hazard Map</h1>
          <p className="text-sm text-gray-500">Singapore infrastructure hazard overview</p>
        </div>
        <Link
          to="/"
          className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
        >
          Back to App
        </Link>
      </header>

      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        <aside
          className="flex shrink-0 flex-col gap-4 overflow-y-auto border-b border-gray-200 bg-white p-4 lg:w-80 lg:border-b-0 lg:border-r"
        >
          <HazardLegend />
          <HazardSidebar
            hazards={hazards}
            selectedId={selectedId}
            onSelect={handleSelectHazard}
          />
        </aside>

        <main className="relative min-h-0 flex-1">
          <SingaporeMap flyToTarget={flyToTarget}>
            <HazardMarkers hazards={hazards} selectedId={selectedId} />
          </SingaporeMap>
        </main>
      </div>
    </div>
  )
}
