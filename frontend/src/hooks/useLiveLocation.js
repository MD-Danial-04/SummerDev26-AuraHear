import { useCallback, useEffect, useRef, useState } from 'react'

/**
 * @typedef {{ lat: number, lon: number, accuracyMeters: number | null }} LiveCoordinates
 */

function messageForGeolocationError(error) {
  if (!error) {
    return 'Unable to determine your location.'
  }

  if (error.code === error.PERMISSION_DENIED) {
    return 'Location permission was denied.'
  }

  if (error.code === error.TIMEOUT) {
    return 'Timed out while finding your location.'
  }

  if (error.code === error.POSITION_UNAVAILABLE) {
    return 'Location is currently unavailable.'
  }

  return 'Unable to determine your location.'
}

export function useLiveLocation() {
  const watchIdRef = useRef(null)

  const [status, setStatus] = useState('idle')
  const [error, setError] = useState(null)
  const [coordinates, setCoordinates] = useState(/** @type {LiveCoordinates | null} */ (null))
  const [updatedAt, setUpdatedAt] = useState(null)

  const stopTracking = useCallback(() => {
    if (
      typeof window !== 'undefined' &&
      navigator.geolocation &&
      watchIdRef.current !== null
    ) {
      navigator.geolocation.clearWatch(watchIdRef.current)
    }

    watchIdRef.current = null
    setStatus((prev) => (prev === 'unsupported' ? prev : 'idle'))
  }, [])

  const requestLocation = useCallback(
    ({
      enableHighAccuracy = true,
      timeout = 10000,
      maximumAge = 15000,
      keepUpdated = true,
    } = {}) => {
      if (typeof window === 'undefined' || !navigator.geolocation) {
        setStatus('unsupported')
        setError('Location is not supported on this device.')
        return Promise.reject(new Error('Location is not supported on this device.'))
      }

      setStatus((prev) => (coordinates ? prev : 'requesting'))
      setError(null)

      return new Promise((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(
          (position) => {
            const nextCoordinates = {
              lat: position.coords.latitude,
              lon: position.coords.longitude,
              accuracyMeters:
                typeof position.coords.accuracy === 'number'
                  ? position.coords.accuracy
                  : null,
            }

            setCoordinates(nextCoordinates)
            setUpdatedAt(new Date().toISOString())
            setStatus(keepUpdated ? 'tracking' : 'ready')
            resolve(nextCoordinates)

            if (keepUpdated && watchIdRef.current === null) {
              watchIdRef.current = navigator.geolocation.watchPosition(
                (nextPosition) => {
                  setCoordinates({
                    lat: nextPosition.coords.latitude,
                    lon: nextPosition.coords.longitude,
                    accuracyMeters:
                      typeof nextPosition.coords.accuracy === 'number'
                        ? nextPosition.coords.accuracy
                        : null,
                  })
                  setUpdatedAt(new Date().toISOString())
                  setStatus('tracking')
                  setError(null)
                },
                (watchError) => {
                  setStatus('error')
                  setError(messageForGeolocationError(watchError))
                },
                {
                  enableHighAccuracy,
                  timeout,
                  maximumAge,
                },
              )
            }
          },
          (requestError) => {
            const message = messageForGeolocationError(requestError)
            setStatus('error')
            setError(message)
            reject(new Error(message))
          },
          {
            enableHighAccuracy,
            timeout,
            maximumAge,
          },
        )
      })
    },
    [coordinates],
  )

  useEffect(() => stopTracking, [stopTracking])

  return {
    status,
    error,
    coordinates,
    updatedAt,
    requestLocation,
    stopTracking,
    isTracking: status === 'tracking',
  }
}
