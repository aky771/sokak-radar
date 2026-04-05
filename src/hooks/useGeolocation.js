import { useState, useEffect, useRef, useCallback } from 'react'

const GPS_ACCURACY_THRESHOLD = 500

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

  // ── GPS helpers ────────────────────────────────────────────────
  const handlePosition = useCallback((pos) => {
    const { latitude, longitude, accuracy } = pos.coords
    setGpsAccuracy(Math.round(accuracy))
    if (accuracy >= GPS_ACCURACY_THRESHOLD) {
      setGpsStatus('unreliable')
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
    else setGpsStatus('error')
  }, [])

  // ── 2. GPS — watchPosition HER ZAMAN başlar ────────────────────
  // iOS Safari dahil tüm tarayıcılarda izin isteği bu tetikler.
  // getCurrentPosition'a bağımlı DEĞİL; biri başarısız olsa diğeri çalışmaya devam eder.
  useEffect(() => {
    if (!navigator.geolocation) {
      setGpsStatus('error')
      return
    }

    // watchPosition → izin isteğini tetikler + sürekli takip
    watchIdRef.current = navigator.geolocation.watchPosition(
      handlePosition,
      handleError,
      {
        enableHighAccuracy: true,
        maximumAge: 10000,   // 10s önbellek kabul et — iOS'ta ilk fix hızlanır
        timeout: 30000,      // 30s — iç mekan GPS için yeterli süre
      }
    )

    // getCurrentPosition → daha hızlı ilk konum (watch ile paralel çalışır)
    navigator.geolocation.getCurrentPosition(
      handlePosition,
      () => {},             // getCurrentPosition hatası watchPosition'ı etkilemez
      { enableHighAccuracy: true, maximumAge: 10000, timeout: 15000 }
    )

    return () => {
      if (watchIdRef.current !== null)
        navigator.geolocation.clearWatch(watchIdRef.current)
    }
  }, [handlePosition, handleError])

  // ── 3. Kullanıcı butonu ile tekrar iste ────────────────────────
  // iOS'ta Settings'den izin verince sayfayı yenilemek gerekir.
  // Bu fonksiyon "Yenile" butonundan çağrılır.
  const requestLocation = useCallback(() => {
    if (!navigator.geolocation) return
    setGpsStatus('waiting')
    bestAccRef.current = Infinity

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        handlePosition(pos)
        // Eski watch'ı durdur, yenisini başlat
        if (watchIdRef.current !== null)
          navigator.geolocation.clearWatch(watchIdRef.current)
        watchIdRef.current = navigator.geolocation.watchPosition(
          handlePosition, handleError,
          { enableHighAccuracy: true, maximumAge: 0, timeout: 30000 }
        )
      },
      handleError,
      { enableHighAccuracy: true, maximumAge: 0, timeout: 15000 }
    )
  }, [handlePosition, handleError])

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
