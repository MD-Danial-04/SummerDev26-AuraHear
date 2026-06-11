/** Sample infrastructure hazards as a GeoJSON FeatureCollection. */
export default {
  type: 'FeatureCollection',
  features: [
    {
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [103.8315, 1.3048] },
      properties: {
        id: 'hz-001',
        category: 'road_works',
        severity: 'high',
        title: 'Road resurfacing — Orchard Rd',
        description:
          'Lane narrowing near ION Orchard. No tactile paving diversion for pedestrians.',
        status: 'active',
        reportedAt: '2026-06-01T08:00:00Z',
      },
    },
    {
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [103.7424, 1.3330] },
      properties: {
        id: 'hz-002',
        category: 'missing_tactile_paving',
        severity: 'medium',
        title: 'Missing tactile paving — Jurong East MRT',
        description: 'Gap in tactile paving at exit A toward Jurong Gateway Road.',
        status: 'active',
        reportedAt: '2026-06-02T10:30:00Z',
      },
    },
    {
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [103.8590, 1.2830] },
      properties: {
        id: 'hz-003',
        category: 'construction',
        severity: 'critical',
        title: 'Marina Bay construction zone',
        description:
          'Active worksite with temporary barriers blocking pedestrian walkway.',
        status: 'active',
        reportedAt: '2026-06-03T14:00:00Z',
      },
    },
    {
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [103.8494, 1.3691] },
      properties: {
        id: 'hz-004',
        category: 'poor_lighting',
        severity: 'medium',
        title: 'Poor lighting — Ang Mo Kio Ave 3',
        description:
          'Underlit walkway between blocks 220–222. Visibility poor after 7pm.',
        status: 'active',
        reportedAt: '2026-06-04T19:15:00Z',
      },
    },
    {
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [103.8198, 1.3521] },
      properties: {
        id: 'hz-005',
        category: 'uneven_surface',
        severity: 'high',
        title: 'Uneven surface — Bishan Park connector',
        description:
          'Broken tiles and potholes along park connector path near Marymount Rd.',
        status: 'active',
        reportedAt: '2026-06-05T11:45:00Z',
      },
    },
    {
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [103.9025, 1.4043] },
      properties: {
        id: 'hz-006',
        category: 'obstruction',
        severity: 'low',
        title: 'Obstruction — Tampines Ave 5',
        description: 'Parked delivery vehicles blocking sidewalk near bus interchange.',
        status: 'active',
        reportedAt: '2026-06-06T09:00:00Z',
      },
    },
    {
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [103.7764, 1.2966] },
      properties: {
        id: 'hz-007',
        category: 'road_works',
        severity: 'medium',
        title: 'Road works — Clementi Ave 3',
        description: 'Temporary lane closure with uneven temporary surface at crossing.',
        status: 'active',
        reportedAt: '2026-06-07T07:30:00Z',
      },
    },
    {
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [103.8454, 1.2805] },
      properties: {
        id: 'hz-008',
        category: 'missing_tactile_paving',
        severity: 'high',
        title: 'Missing tactile paving — Raffles Place',
        description: 'Tactile paving ends abruptly at pedestrian crossing near MRT exit.',
        status: 'under_review',
        reportedAt: '2026-06-08T16:20:00Z',
      },
    },
  ],
}
