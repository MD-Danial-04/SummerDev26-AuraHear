/** Mock walking route for UI preview (Marina Bay area, Singapore). */

export const DEMO_DESTINATION_NAME = 'Marina Bay Sands'

export const DEMO_NAVIGATION_ROUTE = {
  destination: {
    lat: 1.284,
    lon: 103.8612,
    name: DEMO_DESTINATION_NAME,
  },
  summary: {
    distance_meters: 420,
    estimated_minutes: 6,
  },
  path: [
    { lat: 1.2834, lon: 103.8607 },
    { lat: 1.2837, lon: 103.8609 },
    { lat: 1.284, lon: 103.8612 },
  ],
  steps: [
    {
      instruction: 'Turn right onto Bayfront Avenue',
      spoken_instruction: 'Turn right onto Bayfront Avenue in about 85 meters.',
      street_name: 'Bayfront Avenue',
      distance_meters: 85,
      location: { lat: 1.2834, lon: 103.8607 },
    },
    {
      instruction: 'Continue straight for 120 m',
      spoken_instruction: 'Continue straight for about 120 meters.',
      street_name: 'Bayfront Avenue',
      distance_meters: 120,
      location: { lat: 1.2837, lon: 103.8609 },
    },
    {
      instruction: 'Arrive at your destination',
      spoken_instruction: 'You have arrived at your destination.',
      street_name: null,
      distance_meters: 0,
      location: { lat: 1.284, lon: 103.8612 },
    },
  ],
}

export const DEMO_USER_POSITION = { lat: 1.2834, lon: 103.8607, accuracyMeters: 8 }
