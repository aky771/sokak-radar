import { useState, useEffect, useRef, useCallback } from 'react'

const GPS_ACCURACY_THRESHOLD = 500

const WATCH_OPTS = {
  enableHighAccuracy: true,
  maximumAge: 30000,
  timeout: 60000,
}

export default function useGeolocation() {
  const [ipLocation, setIpLocation]         = useState(null)
  const [gpsLocation, setGpsLocation]       = useState(null)
  const [manualLocation, setManualLocation] = useState(null)
  const [gpsStatus, setGpsStatus]           = useState('waiting')
  const [gpsAccuracy, setGpsAccuracy]       = useState(null)
  const [permissionState, setPermissionState] = useState('prompt') // 'prompt' | 'granted' | 'denied'

  const bestAccRef   = useRef(Infinity)
  const watchIdRef   = useRef(null)
  const permRef      = useRef(null)

  // ── 1. IP Geolocation ─────────────────────────────────────────
  useEffect(() => {
    const ctrl = new AbortController()
    ;(async () => {
      try {
        const res = await fetch('https://ipapi.co/json/', {
          signal: ctrl.signal, headers: { Accept: 'application/json' },
        })
        const d = await res.json()
        if (d.latitude && d.longitude && !d.error) {
          setIpLocation({ lat: +d.latitude, lng: +d.longitude, city: d.city || d.region || '' })
          return
        }
      } catch (_) {}
      try {
        const res2 = await fetch('https://ipwho.is/', { signal: ctrl.signal })
        const d2 = await res2.json()
        if (d2.success && d2.latitude)
          setIpLocation({ lat: +d2.latitude, lng: +d2.longitude, city: d2.city || '' })
      } catch (_) {}
    })()
    return () => ctrl.abort()
  }, [])

  // ── GPS helpers ────────────────────────────────────────────────
  const handlePosition = useCallback((pos) => {
    const { latitude, longitude, accuracy } = pos.coords
    setGpsAccuracy(Math.round(accuracy))
    if (accuracy >= GPS_ACCURACY_THRESHOLD) {
      setGpsStatus((s) => s === 'good' ? s : 'unreliable')
      return
    }
    if (accuracy < bestAccRef.current) {
      bestAccRef.current = accuracy
      setGpsLocation({ lat: latitude, lng: longitude, accuracy: Math.round(accuracy) })
      setGpsStatus('good')
    }
  }, [])

  const handleError = useCallback((err) => {
    if (err.code === 1) setGpsStatus('denied')
    else if (err.code !== 3) setGpsStatus('error')
  }, [])

  // ── GPS alma fonksiyonu (hem mount hem buton kullanır) ─────────
  const startLocation = useCallback(() => {
    if (!navigator.geolocation) { setGpsStatus('error'); return }

    // Low accuracy → hızlı cell/WiFi fix
    navigator.geolocation.getCurrentPosition(
      handlePosition,
      () => {
        // Low accuracy başarısız → high accuracy dene
        navigator.geolocation.getCurrentPosition(
          handlePosition,
          () => {},
          { enableHighAccuracy: true, maximumAge: 30000, timeout: 20000 }
        )
      },
      { enableHighAccuracy: false, maximumAge: 30000, timeout: 8000 }
    )

    // watchPosition daima çalışır
    if (watchIdRef.current !== null)
      navigator.geolocation.clearWatch(watchIdRef.current)
    watchIdRef.current = navigator.geolocation.watchPosition(
      handlePosition, handleError, WATCH_OPTS
    )
  }, [handlePosition, handleError])

  // ── 2. Sayfa yüklenince GPS başlat ────────────────────────────
  useEffect(() => {
    startLocation()
    return () => {
      if (watchIdRef.current !== null)
        navigator.geolocation.clearWatch(watchIdRef.current)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // ── 3. navigator.permissions izleme ──────────────────────────
  // • 'granted'  → otomatik konum al
  // • 'denied'   → Settings yönlendirmesi göster
  // • 'prompt'   → tekrar dialog açılabilir
  useEffect(() => {
    if (!navigator.permissions) return

    navigator.permissions.query({ name: 'geolocation' }).then((result) => {
      permRef.current = result
      setPermissionState(result.state)

      result.onchange = () => {
        const state = result.state
        setPermissionState(state)

        if (state === 'granted') {
          // Kullanıcı Settings'den izin verdi → otomatik başlat
          bestAccRef.current = Infinity
          startLocation()
        }
      }
    }).catch(() => {})

    return () => {
      if (permRef.current) permRef.current.onchange = null
    }
  }, [startLocation])

  // ── 4. "Konum Al" butonu ──────────────────────────────────────
  const requestLocation = useCallback(() => {
    if (!navigator.geolocation) return

    // Permissions API varsa durumu kontrol et
    if (navigator.permissions && permissionState === 'denied') {
      // Gerçekten kalıcı red → yalnızca Settings yönlendirmesi çalışır
      return
    }

    // 'prompt' veya 'granted' → getCurrentPosition çağrısı dialog açar
    bestAccRef.current = Infinity
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        handlePosition(pos)
        if (watchIdRef.current !== null)
          navigator.geolocation.clearWatch(watchIdRef.current)
        watchIdRef.current = navigator.geolocation.watchPosition(
          handlePosition, handleError, WATCH_OPTS
        )
      },
      (err) => {
        if (err.code === 1) {
          // Permissions API yoksa (eski iOS) — status'u denied yap
          if (!navigator.permissions) setGpsStatus('denied')
          // Permissions API varsa onchange zaten tetiklenir
        }
      },
      { enableHighAccuracy: false, maximumAge: 0, timeout: 15000 }
    )
  }, [handlePosition, handleError, permissionState])

  const location = manualLocation || gpsLocation || null

  return {
    location,
    ipLocation,
    gpsLocation,
    manualLocation,
    setManualLocation,
    gpsStatus,
    gpsAccuracy,
    permissionState,  // 'prompt' | 'granted' | 'denied'
    requestLocation,
  }
}
