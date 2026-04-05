import { useState, useEffect, useRef, useCallback } from 'react'

const GPS_ACCURACY_THRESHOLD = 500

// watchPosition için seçenekler
const WATCH_OPTS = {
  enableHighAccuracy: true,
  maximumAge: 30000,  // 30s önbellek → iOS'ta ilk fix hızlanır
  timeout: 60000,     // 60s → iç mekânda GPS için yeterli süre
}

export default function useGeolocation() {
  const [ipLocation, setIpLocation]         = useState(null)
  const [gpsLocation, setGpsLocation]       = useState(null)
  const [manualLocation, setManualLocation] = useState(null)
  const [gpsStatus, setGpsStatus]           = useState('waiting')
  const [gpsAccuracy, setGpsAccuracy]       = useState(null)
  const bestAccRef                          = useRef(Infinity)
  const watchIdRef                          = useRef(null)

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

  // ── GPS yardımcıları ───────────────────────────────────────────
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
    // TIMEOUT (code 3) → watchPosition devam ediyor, 'error' verme
    if (err.code === 1) setGpsStatus('denied')
    else if (err.code !== 3) setGpsStatus('error')
    // code 3 = timeout, bir sonraki denemede düzelir — mevcut status korunur
  }, [])

  // ── 2. Otomatik GPS ────────────────────────────────────────────
  useEffect(() => {
    if (!navigator.geolocation) { setGpsStatus('error'); return }

    // watchPosition HER ZAMAN başlar — getCurrentPosition'a bağlı değil
    watchIdRef.current = navigator.geolocation.watchPosition(
      handlePosition, handleError, WATCH_OPTS
    )

    // Hızlı ilk konum için low-accuracy getCurrentPosition (cell/WiFi tabanlı)
    // iOS Safari'de izin istemi için user gesture olmasa da çalışır
    navigator.geolocation.getCurrentPosition(
      handlePosition,
      () => {
        // Low accuracy başarısız → high accuracy dene
        navigator.geolocation.getCurrentPosition(
          handlePosition,
          () => {}, // sessizce başarısız ol, watch devam ediyor
          { enableHighAccuracy: true, maximumAge: 30000, timeout: 20000 }
        )
      },
      { enableHighAccuracy: false, maximumAge: 30000, timeout: 8000 }
    )

    return () => {
      if (watchIdRef.current !== null)
        navigator.geolocation.clearWatch(watchIdRef.current)
    }
  }, [handlePosition, handleError])

  // ── 3. Kullanıcı "İzin Ver" butonuyla tetikler ─────────────────
  const requestLocation = useCallback(() => {
    if (!navigator.geolocation) return
    // NOT: setGpsStatus('waiting') ÇAĞIRMIYORUZ
    // → banner gizlenmez, kullanıcı tekrar deneyebilir
    bestAccRef.current = gpsLocation ? gpsLocation.accuracy : Infinity

    // Önce low accuracy (hızlı, cell/WiFi — iOS'ta saniyeler içinde döner)
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        handlePosition(pos)
        // Başarılı → high accuracy watch'ı yeniden başlat
        if (watchIdRef.current !== null)
          navigator.geolocation.clearWatch(watchIdRef.current)
        watchIdRef.current = navigator.geolocation.watchPosition(
          handlePosition, handleError, WATCH_OPTS
        )
      },
      () => {
        // Low accuracy başarısız → high accuracy dene (izin yoksa reddedilir)
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            handlePosition(pos)
            if (watchIdRef.current !== null)
              navigator.geolocation.clearWatch(watchIdRef.current)
            watchIdRef.current = navigator.geolocation.watchPosition(
              handlePosition, handleError, WATCH_OPTS
            )
          },
          handleError,
          { enableHighAccuracy: true, maximumAge: 0, timeout: 30000 }
        )
      },
      { enableHighAccuracy: false, maximumAge: 30000, timeout: 10000 }
    )
  }, [handlePosition, handleError, gpsLocation])

  const location = manualLocation || gpsLocation || null

  return {
    location,
    ipLocation,
    gpsLocation,
    manualLocation,
    setManualLocation,
    gpsStatus,
    gpsAccuracy,
    requestLocation,
  }
}
