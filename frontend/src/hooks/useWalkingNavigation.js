import { useCallback, useEffect, useRef, useState } from 'react'

import { buildWalkingRoute, geocodeLocation } from '../api/navigationClient.js'
import {
  distanceToPolylineMeters,
  findNearestStepIndex,
  haversineMeters,
  NAV_ARRIVAL_METERS,
  NAV_OFF_ROUTE_METERS,
  NAV_OFF_ROUTE_SECONDS,
  NAV_REROUTE_DEBOUNCE_MS,
  NAV_STEP_ADVANCE_METERS,
} from '../utils/geo.js'

/**
 * @param {{
 *   liveLocation: {
 *     coordinates: { lat: number, lon: number } | null,
 *     status: string,
 *     requestLocation: (options?: object) => Promise<{ lat: number, lon: number }>,
 *   },
 *   speak: (text: string, onEnd?: () => void) => Promise<void>,
 *   ensureCaptureForNavigation: () => Promise<boolean>,
 * }} options
 */
export function useWalkingNavigation({
  liveLocation,
  speak,
  ensureCaptureForNavigation,
}) {
  const [status, setStatus] = useState('idle')
  const [error, setError] = useState(null)
  const [candidates, setCandidates] = useState([])
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [route, setRoute] = useState(null)
  const [currentStepIndex, setCurrentStepIndex] = useState(0)
  const [rerouteCount, setRerouteCount] = useState(0)
  const [destinationQuery, setDestinationQuery] = useState('')

  const routeActiveRef = useRef(false)
  const destinationRef = useRef(null)
  const offRouteSinceRef = useRef(null)
  const lastRerouteAtRef = useRef(0)
  const rerouteInFlightRef = useRef(false)
  const routeRef = useRef(null)
  const currentStepIndexRef = useRef(0)
  const speakStepRef = useRef(null)
  const arrivedSpokenRef = useRef(false)

  useEffect(() => {
    routeRef.current = route
  }, [route])

  useEffect(() => {
    currentStepIndexRef.current = currentStepIndex
  }, [currentStepIndex])

  const hasValidGps = useCallback(() => {
    const { coordinates, status: locationStatus } = liveLocation
    if (!coordinates) return false
    return locationStatus === 'tracking' || locationStatus === 'ready'
  }, [liveLocation])

  const speakCandidateOption = useCallback(
    async (index, list) => {
      const candidate = list[index]
      if (!candidate) return
      await speak(
        `Option ${index + 1}: ${candidate.name}. Say next for another option, or tap confirm to use this destination.`,
      )
    },
    [speak],
  )

  const speakStepAt = useCallback(
    (routeData, stepIndex) => {
      const step = routeData?.steps?.[stepIndex]
      if (!step || !routeActiveRef.current) return

      void speak(step.spoken_instruction, () => {
        if (!routeActiveRef.current) return
        if (currentStepIndexRef.current !== stepIndex) return

        const nextIndex = stepIndex + 1
        if (nextIndex >= routeData.steps.length) {
          routeActiveRef.current = false
          setStatus('arrived')
          void speak('You have arrived at your destination.')
          return
        }

        setCurrentStepIndex(nextIndex)
        speakStepRef.current?.(routeData, nextIndex)
      })
    },
    [speak],
  )

  useEffect(() => {
    speakStepRef.current = speakStepAt
  }, [speakStepAt])

  const beginNavigation = useCallback(
    (routeData) => {
      setRoute(routeData)
      setCurrentStepIndex(0)
      routeActiveRef.current = true
      offRouteSinceRef.current = null
      arrivedSpokenRef.current = false
      setStatus('navigating')
      speakStepAt(routeData, 0)
    },
    [speakStepAt],
  )

  const fetchRoute = useCallback(
    async (origin, destination, destinationName) => {
      return buildWalkingRoute({
        origin: { lat: origin.lat, lon: origin.lon },
        destination: { lat: destination.lat, lon: destination.lon },
        originName: 'Your location',
        destinationName: destinationName ?? destination.name,
      })
    },
    [],
  )

  const confirmAndRoute = useCallback(
    async (candidate, queryLabel) => {
      const origin = liveLocation.coordinates
      if (!origin) {
        setStatus('error')
        setError('Location is unavailable.')
        await speak('Location is unavailable. Enable GPS and try again.')
        return
      }

      destinationRef.current = {
        lat: candidate.lat,
        lon: candidate.lon,
        name: candidate.name,
      }

      setStatus('routing')
      await speak('Calculating walking route.')

      try {
        const routeData = await fetchRoute(origin, candidate, candidate.name)
        setDestinationQuery(queryLabel)
        beginNavigation(routeData)
      } catch (err) {
        const message =
          err instanceof Error ? err.message : 'Could not calculate route.'
        setStatus('error')
        setError(message)
        routeActiveRef.current = false
        await speak(message)
      }
    },
    [beginNavigation, fetchRoute, liveLocation.coordinates, speak],
  )

  const triggerReroute = useCallback(
    async (position) => {
      const destination = destinationRef.current
      if (!destination || rerouteInFlightRef.current) return
      if (Date.now() - lastRerouteAtRef.current < NAV_REROUTE_DEBOUNCE_MS) return

      rerouteInFlightRef.current = true
      lastRerouteAtRef.current = Date.now()
      offRouteSinceRef.current = null

      try {
        const routeData = await fetchRoute(position, destination, destination.name)
        setRerouteCount((count) => count + 1)
        const nearestStep = findNearestStepIndex(position, routeData.steps)
        setRoute(routeData)
        setCurrentStepIndex(nearestStep)
        await speak('Route updated.')
        speakStepAt(routeData, nearestStep)
      } catch (err) {
        const message =
          err instanceof Error ? err.message : 'Could not update route.'
        await speak(message)
      } finally {
        rerouteInFlightRef.current = false
      }
    },
    [fetchRoute, speak, speakStepAt],
  )

  const startRoute = useCallback(
    async (destination) => {
      const trimmed = destination.trim()
      if (!trimmed) return

      setError(null)
      setDestinationQuery(trimmed)
      setStatus('locating')
      await speak('Finding your location.')

      const captureStarted = await ensureCaptureForNavigation()
      if (!captureStarted) {
        setStatus('error')
        setError('Camera and analysis must be running for navigation.')
        await speak('Could not start navigation. Camera access is required.')
        return
      }

      if (!hasValidGps()) {
        try {
          await liveLocation.requestLocation({ keepUpdated: true })
        } catch (err) {
          const message =
            err instanceof Error
              ? err.message
              : 'Location permission was denied.'
          setStatus('error')
          setError(message)
          await speak(
            'Location permission is required for navigation. Please enable GPS and try again.',
          )
          return
        }
      }

      if (!hasValidGps()) {
        setStatus('error')
        setError('Location is unavailable.')
        await speak('Location is unavailable. Enable GPS and try again.')
        return
      }

      setStatus('geocoding')
      await speak('Searching Singapore for your destination.')

      try {
        const geocoded = await geocodeLocation(trimmed, 5)
        setCandidates(geocoded.results)
        setSelectedIndex(0)

        if (geocoded.results.length === 1) {
          await confirmAndRoute(geocoded.results[0], trimmed)
          return
        }

        setStatus('disambiguating')
        await speakCandidateOption(0, geocoded.results)
      } catch (err) {
        const message =
          err instanceof Error ? err.message : 'Destination lookup failed.'
        setStatus('error')
        setError(message)
        await speak(message)
      }
    },
    [
      confirmAndRoute,
      ensureCaptureForNavigation,
      hasValidGps,
      liveLocation,
      speak,
      speakCandidateOption,
    ],
  )

  const confirmDestination = useCallback(async () => {
    const candidate = candidates[selectedIndex]
    if (!candidate) return
    await confirmAndRoute(candidate, destinationQuery)
  }, [candidates, confirmAndRoute, destinationQuery, selectedIndex])

  const selectCandidate = useCallback(
    (index) => {
      if (index < 0 || index >= candidates.length) return
      setSelectedIndex(index)
      void speakCandidateOption(index, candidates)
    },
    [candidates, speakCandidateOption],
  )

  const nextCandidate = useCallback(() => {
    if (!candidates.length) return
    const nextIndex = (selectedIndex + 1) % candidates.length
    selectCandidate(nextIndex)
  }, [candidates.length, selectCandidate, selectedIndex])

  const cancelRoute = useCallback(() => {
    routeActiveRef.current = false
    offRouteSinceRef.current = null
    rerouteInFlightRef.current = false
    destinationRef.current = null
    arrivedSpokenRef.current = false
    setStatus('idle')
    setError(null)
    setCandidates([])
    setSelectedIndex(0)
    setRoute(null)
    setCurrentStepIndex(0)
    setRerouteCount(0)
    setDestinationQuery('')
  }, [])

  const repeatCurrentStep = useCallback(() => {
    const routeData = routeRef.current
    if (!routeData || !routeActiveRef.current) return
    speakStepAt(routeData, currentStepIndexRef.current)
  }, [speakStepAt])

  useEffect(() => {
    if (status !== 'navigating' || !route || !liveLocation.coordinates) return

    const position = liveLocation.coordinates
    const steps = route.steps

    if (haversineMeters(position, route.destination) <= NAV_ARRIVAL_METERS) {
      if (!arrivedSpokenRef.current) {
        arrivedSpokenRef.current = true
        routeActiveRef.current = false
        setStatus('arrived')
        void speak('You have arrived at your destination.')
      }
      return
    }

    const nextIndex = currentStepIndex + 1
    if (
      nextIndex < steps.length &&
      haversineMeters(position, steps[nextIndex].location) <= NAV_STEP_ADVANCE_METERS &&
      currentStepIndexRef.current === currentStepIndex
    ) {
      setCurrentStepIndex(nextIndex)
      speakStepAt(route, nextIndex)
    }

    const offRouteDistance = distanceToPolylineMeters(position, route.path)
    if (offRouteDistance > NAV_OFF_ROUTE_METERS) {
      if (!offRouteSinceRef.current) {
        offRouteSinceRef.current = Date.now()
      } else if (
        Date.now() - offRouteSinceRef.current >=
        NAV_OFF_ROUTE_SECONDS * 1000
      ) {
        void triggerReroute(position)
      }
    } else {
      offRouteSinceRef.current = null
    }
  }, [
    currentStepIndex,
    liveLocation.coordinates,
    route,
    speak,
    speakStepAt,
    status,
    triggerReroute,
  ])

  const currentStep = route?.steps?.[currentStepIndex] ?? null
  const isActiveRoute = status === 'navigating' || status === 'arrived'

  return {
    status,
    error,
    candidates,
    selectedIndex,
    route,
    currentStep,
    currentStepIndex,
    rerouteCount,
    destinationQuery,
    isActiveRoute,
    startRoute,
    confirmDestination,
    selectCandidate,
    nextCandidate,
    cancelRoute,
    repeatCurrentStep,
  }
}
